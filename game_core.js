// ========================================================
// 核心業務層：相機、物理碰撞、發扣判定、Slot 控制器解耦、WebRTC 雙向通訊
// ========================================================
const camera = {
  x: WORLD.NET_X - (VIEW_W / 2),
  y: WORLD.FLOOR_Y - 450,
  targetX: WORLD.NET_X - (VIEW_W / 2),
  targetY: WORLD.FLOOR_Y - 450,

  update(ball) {
    if (isNaN(ball.x) || isNaN(ball.y)) return;
    const defaultX = WORLD.NET_X - (VIEW_W / 2);
    const defaultY = WORLD.FLOOR_Y - 450;
    let targetX = defaultX, targetY = defaultY;

    if (ball.x < WORLD.NET_X - 150) {
      targetX = defaultX - (((WORLD.NET_X - 150) - ball.x) * 0.85);
    } else if (ball.x > WORLD.NET_X + 150) {
      targetX = defaultX + ((ball.x - (WORLD.NET_X + 150)) * 0.85);
    }

    if (ball.y < 280) {
      targetY = defaultY - Math.pow(280 - ball.y, 1.08) * 0.9;
    }

    this.targetX = Math.max(0, Math.min(WORLD.WIDTH - VIEW_W, targetX));
    this.targetY = Math.max(0, Math.min(WORLD.HEIGHT - VIEW_H, targetY));
    this.x += (this.targetX - this.x) * 0.065;
    this.y += (this.targetY - this.y) * 0.065;
  }
};

let debugHitbox = false, maxRecordedSpeed = 0, maxRecordedSpin = 0;
let lastCastSkillName = 'None', lastCastFrame = -999;
let lastBlockDebug = { effectiveRigidity: 0, incomingSpeed: 0, ap: 0, isBroken: false };

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const userUltFill = document.getElementById('user-ult-fill');
const mateUltFill = document.getElementById('mate-ult-fill');
const userUltText = document.getElementById('user-ult-text');
const mateUltText = document.getElementById('mate-ult-text');
const mainPillarFrame = document.getElementById('main-pillar-frame');
const subPillarFrame = document.getElementById('sub-pillar-frame');
const staminaFill = document.getElementById('stamina-fill');
const scoreDisplay = document.getElementById('score-display');
const statusSubtext = document.getElementById('status-subtext');

let isGameStarted = false, isPaused = true, isLockerOpen = false, isSettlementOpen = false;
let score = { player: 0, enemy: 0 }, gameFrame = 0;
let screenShakeTimer = 0, screenShakeIntensity = 0, visualEffects = [];
let calloutPopups = [], coinPopups = [], haloEffects = [];

let timeSlowTimer = 0, chronoCasterSide = 'player', chronoAnimTimer = 0;
let hitStopFrames = 0;

const banner = { active: false, timer: 0, mainText: '', subText: '', color: '#38bdf8', winnerTeam: 'LEFT' };
let pendingCoinReward = 0, pendingCoinReason = '';

let proMatchStats = {
  user: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
  mate: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
  enemyFront: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
  enemyBack: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 }
};

class Player {
  constructor(slotKey, x, isLeft, slotIndex) {
    this.slotKey = slotKey;
    this.slotIndex = slotIndex;
    this.x = x; this.y = WORLD.FLOOR_Y; this.vx = 0; this.vy = 0;
    this.radius = 24; this.isLeft = isLeft; this.isGrounded = true;
    this.isDiving = false; this.diveTimer = 0; this.diveTouched = false;
    this.isBlocking = false; this.wantsToBlock = false; this.blockTimer = 0;
    this.facing = isLeft ? 1 : -1; this.squashX = 1; this.squashY = 1;
    this.jumpStartX = x; this.swingTimer = 0; this.thrustTimer = 0;
    this.thrustTargetX = 0; this.thrustTargetY = 0;
    this.hasBlockSelfHitPrivilege = false; this.runMomentum = 0;
    this.reactionTimer = 0; this.despairTimer = 0; this.recheckDelay = 0;
    this.jumpExhaustion = 1.0; this.energy = 0; this.hasPlayedFullSound = false;
    this.depressedRallies = 0; this.excitedRallies = 0;
    this.mudDebuffTimer = 0; this.softWallRallies = 0;
    this.godspeedCharges = 0; this.greaseDebuffRallies = 0;
    this.ghostTrail = [];
    this.rebind(false);
  }

  get isLocallyControlled() {
    return (typeof NET !== 'undefined') ? (this.slotIndex === NET.mySlot) : (this.slotIndex === 0);
  }

  get effectiveSpeed() {
    let spd = this.stats.speed;
    if (this.depressedRallies > 0) spd *= 0.88;
    if (this.excitedRallies > 0) spd *= 1.08;
    if (this.mudDebuffTimer > 0) spd *= 0.60;
    if (timeSlowTimer > 0) {
      const isVictim = (chronoCasterSide === 'player' && !this.isLeft) || (chronoCasterSide === 'enemy' && this.isLeft);
      if (isVictim) spd *= 0.50;
    }
    return spd;
  }

  addEnergy(amount) {
    const maxCost = this.stats.skill.cost, oldEnergy = this.energy;
    this.energy = Math.min(maxCost, this.energy + amount);
    if (oldEnergy < maxCost && this.energy >= maxCost && !this.hasPlayedFullSound) {
      this.hasPlayedFullSound = true;
      if (this.isLocallyControlled) playSound('p1_full');
      else if (this.slotIndex === NET.mateSlot) playSound('p2_full');
    }
    updateSideUltHUD();
  }

  consumeSkill(requiredType = null) {
    const sk = this.stats.skill;
    if (requiredType && sk.type !== requiredType) return false;
    if (this.energy >= sk.cost) {
      this.energy = 0; this.hasPlayedFullSound = false;
      lastCastSkillName = sk.name; lastCastFrame = gameFrame;
      updateSideUltHUD();
      return true;
    }
    return false;
  }

  refundEnergy(percent = 0.5) {
    const refund = Math.floor(this.stats.skill.cost * percent);
    this.addEnergy(refund);
    if (this.isLocallyControlled) pushCallout(this.x, this.y - 45, `+${refund} 能量返還!`, '#38bdf8');
  }

  forceGrounded(x = null) {
    if (x !== null) this.x = x;
    this.y = WORLD.FLOOR_Y; this.vx = 0; this.vy = 0;
    this.isGrounded = true; this.isDiving = false; this.diveTimer = 0; this.diveTouched = false;
    this.isBlocking = false; this.wantsToBlock = false; this.blockTimer = 0;
    this.swingTimer = 0; this.thrustTimer = 0; this.jumpStartX = this.x;
    this.runMomentum = 0; this.reactionTimer = 0; this.despairTimer = 0; this.recheckDelay = 0;
    this.ghostTrail = [];
  }

  rebind(triggerHUD = true) {
    this.card = ACTIVE_ROSTER[this.slotKey];
    this.color = this.card.color; this.name = this.card.name;
    this.stats = deriveStats(this.card);
    if (triggerHUD) updateSideUltHUD();
  }

  jump(power = null) {
    if (this.isGrounded && !this.isDiving) {
      this.jumpStartX = this.x;
      const baseJump = power !== null ? power : this.stats.jump;
      let exhMult = this.jumpExhaustion;
      if (this.depressedRallies > 0) exhMult *= 0.90;
      if (this.excitedRallies > 0) exhMult *= 1.05;
      if (this.mudDebuffTimer > 0) exhMult *= 0.70;
      if (timeSlowTimer > 0) {
        const isVictim = (chronoCasterSide === 'player' && !this.isLeft) || (chronoCasterSide === 'enemy' && this.isLeft);
        if (isVictim) exhMult *= 0.50;
      }
      this.vy = baseJump * exhMult;
      this.jumpExhaustion = Math.max(0.35, this.jumpExhaustion * 0.78);
      this.isGrounded = false; this.squashX = 0.75; this.squashY = 1.3;
    }
  }

  dive() {
    if (this.isGrounded && !this.isDiving) {
      this.isDiving = true; this.diveTimer = 24; this.diveTouched = false;
      this.vx = this.facing * (this.effectiveSpeed * 1.20); this.vy = -2.2;
      this.isGrounded = false; this.runMomentum = 0; playSound('dive');
    }
  }

  triggerBlock() {
    if (match.inServeRally) return false;
    if (Math.abs(this.x - WORLD.NET_X) < 110) {
      if (this.consumeSkill('BLOCK_STANCE')) {
        this.softWallRallies = 3;
        pushCallout(this.x, this.y - 45, '引力柔網 (SOFT WALL)!!', '#2dd4bf');
        playSound('time_freeze');
      }
      this.wantsToBlock = true; this.blockTimer = 30; return true;
    }
    return false;
  }

  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.reactionTimer > 0) this.reactionTimer--;
    if (this.despairTimer > 0) this.despairTimer--;
    if (this.recheckDelay > 0) this.recheckDelay--;
    if (this.mudDebuffTimer > 0) this.mudDebuffTimer--;

    if (this.isGrounded) {
      if (Math.abs(this.vx) < 0.1) this.jumpExhaustion = Math.min(1.0, this.jumpExhaustion + 0.0035);
      if ((this.facing === 1 && this.vx > 0.5) || (this.facing === -1 && this.vx < -0.5)) {
        this.runMomentum = Math.min(25, this.runMomentum + 1.4);
      } else {
        this.runMomentum = Math.max(0, this.runMomentum - 2.0);
      }
    } else {
      let g = WORLD.GRAVITY;
      if (timeSlowTimer > 0) {
        const isVictim = (chronoCasterSide === 'player' && !this.isLeft) || (chronoCasterSide === 'enemy' && this.isLeft);
        if (isVictim) g *= 0.25;
      }
      this.vy += g;
    }

    this.squashX += (1 - this.squashX) * 0.15;
    this.squashY += (1 - this.squashY) * 0.15;
    if (this.swingTimer > 0) this.swingTimer--;
    if (this.thrustTimer > 0) this.thrustTimer--;

    // 🌟 欄位攔網判定：真人操控者只看 wantsToBlock，絕不吃 AI 起跳自動亮盾
    const isHuman = (typeof isSlotHumanControlled === 'function') ? isSlotHumanControlled(this) : this.isLocallyControlled;
    if (isHuman) {
      if (this.wantsToBlock) {
        this.blockTimer--;
        this.isBlocking = (!this.isGrounded && this.y < WORLD.NET_TOP_Y + 50);
        if (this.blockTimer <= 0 || this.isGrounded) { this.wantsToBlock = false; this.isBlocking = false; }
      } else {
        this.isBlocking = false;
      }
    } else {
      const isNetJump = Math.abs(this.jumpStartX - WORLD.NET_X) < 95;
      const isAttacking = this.swingTimer > 0 || this.thrustTimer > 0;
      this.isBlocking = (!this.isGrounded && isNetJump && !isAttacking);
    }

    if (this.isDiving) {
      this.diveTimer--; this.vx *= 0.90;
      if (this.y >= WORLD.FLOOR_Y) { this.y = WORLD.FLOOR_Y; this.vy = 0; }
      if (this.diveTimer <= 0) { this.isDiving = false; this.diveTouched = false; this.y = WORLD.FLOOR_Y; this.isGrounded = true; }
    } else if (this.y >= WORLD.FLOOR_Y) {
      if (serveState.active && serveState.currentServer === this) {
        const isLandedInCourt = this.isLeft ? (this.x >= WORLD.LEFT) : (this.x <= WORLD.RIGHT);
        if (isLandedInCourt) triggerFault(this.isLeft ? 'RIGHT' : 'LEFT', 'FOOT FAULT!!', '發球未擊球前落地踩線進場');
      }
      this.y = WORLD.FLOOR_Y; this.vy = 0; this.isGrounded = true;
      this.wantsToBlock = false; this.isBlocking = false; this.jumpStartX = this.x;
    }

    if (serveState.active) {
      const isServer = (serveState.currentServer === this);
      if (isServer) {
        if (this.isGrounded) {
          const isSteppedIn = this.isLeft ? (this.x >= WORLD.LEFT) : (this.x <= WORLD.RIGHT);
          if (isSteppedIn) triggerFault(this.isLeft ? 'RIGHT' : 'LEFT', 'FOOT FAULT!!', '發球員地面踩線違例');
        }
      } else {
        if (this.isLeft) {
          if (this.x < WORLD.LEFT + this.radius) this.x = WORLD.LEFT + this.radius;
          if (this.x > WORLD.NET_X - this.radius - 8) this.x = WORLD.NET_X - this.radius - 8;
        } else {
          if (this.x < WORLD.NET_X + this.radius + 8) this.x = WORLD.NET_X + this.radius + 8;
          if (this.x > WORLD.RIGHT - this.radius) this.x = WORLD.RIGHT - this.radius;
        }
      }
    } else {
      if (this.isLeft) {
        if (this.x < 50) this.x = 50;
        if (this.x > WORLD.NET_X - this.radius - 8) this.x = WORLD.NET_X - this.radius - 8;
      } else {
        if (this.x < WORLD.NET_X + this.radius + 8) this.x = WORLD.NET_X + this.radius + 8;
        if (this.x > WORLD.WIDTH - 50) this.x = WORLD.WIDTH - 50;
      }
    }
  }

  draw(targetCtx) {
    drawPlayerEntity(this, targetCtx);
  }
}

// 🌟 客觀物理 4 大格子實例化 (Slot 0 ~ 3)
const userPlayer = new Player('user', WORLD.LEFT - 100, true, 0);
const mateAI     = new Player('mate', WORLD.LEFT + 240, true, 1);
const enemyA     = new Player('enemyFront', WORLD.RIGHT - 240, false, 2);
const enemyB     = new Player('enemyBack', WORLD.RIGHT + 100, false, 3);
const allPlayers = [userPlayer, mateAI, enemyA, enemyB];

function resetMatchState() {
  score.player = 0; score.enemy = 0;
  scoreDisplay.innerText = '0 : 0';
  match.leftHits = 0; match.rightHits = 0;
  match.isBlockedBack = false;
  timeSlowTimer = 0; chronoAnimTimer = 0; hitStopFrames = 0;
  
  proMatchStats = {
    user: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
    mate: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
    enemyFront: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 },
    enemyBack: { totalSpikes: 0, spikeKills: 0, toolOutKills: 0, serviceAces: 0, maxSpeed: 0, totalReceives: 0, perfectAbsorbs: 0, normalBumps: 0, deflects: 0, coverSaves: 0, totalBlocks: 0, roofKills: 0 }
  };

  allPlayers.forEach(p => {
    p.energy = 0;
    p.jumpExhaustion = 1.0;
    p.depressedRallies = 0;
    p.excitedRallies = 0;
    p.mudDebuffTimer = 0;
    p.softWallRallies = 0;
    p.godspeedCharges = 0;
    p.greaseDebuffRallies = 0;
    p.hasPlayedFullSound = false;
    p.forceGrounded();
  });
  updateSideUltHUD();
}

function updateSideUltHUD() {
  const p1Actor = allPlayers[NET.mySlot] || userPlayer;
  const p2Actor = allPlayers[NET.mateSlot] || mateAI;

  if (p1Actor && p1Actor.stats && p1Actor.stats.skill) {
    const uSk = p1Actor.stats.skill;
    const uRatio = Math.min(1.0, p1Actor.energy / uSk.cost);
    userUltFill.style.height = (uRatio * 100) + '%';
    userUltText.innerText = `P1 ${Math.floor(uRatio * 100)}%`;

    if (uRatio >= 1.0) {
      userUltFill.style.background = 'linear-gradient(180deg, #fef08a 0%, #f59e0b 60%, #b45309 100%)';
      mainPillarFrame.style.borderColor = '#facc15';
      mainPillarFrame.style.boxShadow = '0 0 15px rgba(250, 204, 21, 0.8)';
    } else {
      userUltFill.style.background = 'linear-gradient(180deg, #ef4444 0%, #b91c1c 65%, #4c0519 100%)';
      mainPillarFrame.style.borderColor = '#cbd5e1';
      mainPillarFrame.style.boxShadow = 'inset 0 0 4px #000';
    }
  }

  if (p2Actor && p2Actor.stats && p2Actor.stats.skill) {
    const mSk = p2Actor.stats.skill;
    const mRatio = Math.min(1.0, p2Actor.energy / mSk.cost);
    mateUltFill.style.height = (mRatio * 100) + '%';
    mateUltText.innerText = `P2 ${Math.floor(mRatio * 100)}%`;

    if (mRatio >= 1.0) {
      mateUltFill.style.background = 'linear-gradient(180deg, #a7f3d0 0%, #10b981 60%, #064e3b 100%)';
      subPillarFrame.style.borderColor = '#34d399';
      subPillarFrame.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.8)';
    } else {
      mateUltFill.style.background = 'linear-gradient(180deg, #38bdf8 0%, #1d4ed8 70%, #0f172a 100%)';
      subPillarFrame.style.borderColor = '#94a3b8';
      subPillarFrame.style.boxShadow = 'inset 0 0 4px #000';
    }
  }
}

const ball = {
  x: WORLD.LEFT - 100, y: WORLD.FLOOR_Y - 40, vx: 0, vy: 0, radius: 13, rotation: 0,
  isSpiked: false, isPerfectSpike: false, isFloat: false, isTacticalThrust: false,
  isBrokenSpike: false, isUltimate: false, isTopspin: false, topspinRating: 0.5, armorPiercing: 0, lastHitter: null,
  opacity: 1.0, activeSkillTag: '', isSineFloat: false, isSkyComet: false, isPhantomDrop: false, glowColor: null,
  isBungeeGum: false, isGravityDrop: false, greaseCharges: 0, hasTossedFromGodspeed: false,

  resetForServe(winnerSide) {
    serveState.active = true; serveState.tossed = false; serveState.charging = false; serveState.chargePower = 0;
    this.isSpiked = false; this.isPerfectSpike = false; this.isFloat = false; this.isTacticalThrust = false;
    this.isBrokenSpike = false; this.isUltimate = false; this.isTopspin = false; this.topspinRating = 0.5;
    this.armorPiercing = 0; this.lastHitter = null;
    this.opacity = 1.0; this.activeSkillTag = ''; this.isSineFloat = false; this.isSkyComet = false; this.isPhantomDrop = false; this.glowColor = null;
    this.isBungeeGum = false; this.isGravityDrop = false; this.greaseCharges = 0; this.hasTossedFromGodspeed = false;
    this.vx = 0; this.vy = 0; match.leftHits = 0; match.rightHits = 0; match.isBlockedBack = false;
    match.inServeRally = true;
    timeSlowTimer = 0; chronoAnimTimer = 0; hitStopFrames = 0;
    pendingCoinReward = 0; pendingCoinReason = '';

    const servingTeam = (winnerSide === 'LEFT') ? 'player' : 'enemy';
    if (servingTeam !== match.currentServingTeam) {
      match.currentServingTeam = servingTeam;
      if (servingTeam === 'player') match.playerServerIdx = (match.playerServerIdx + 1) % 2;
      else match.enemyServerIdx = (match.enemyServerIdx + 1) % 2;
    }

    setTimeout(() => { if (!isPaused && !isSettlementOpen && isGameStarted) playWhistle(false); }, 200);

    if (match.currentServingTeam === 'player') {
      serveState.currentServer = (match.playerServerIdx === 0) ? userPlayer : mateAI;
      userPlayer.forceGrounded(serveState.currentServer === userPlayer ? WORLD.LEFT - 100 : WORLD.LEFT + 180);
      mateAI.forceGrounded(serveState.currentServer === mateAI ? WORLD.LEFT - 100 : WORLD.LEFT + 320);
      enemyA.forceGrounded(WORLD.RIGHT - 320); enemyB.forceGrounded(WORLD.RIGHT - 180);
      this.x = serveState.currentServer.x + 15; this.y = WORLD.FLOOR_Y - 35;
    } else {
      serveState.currentServer = (match.enemyServerIdx === 0) ? enemyB : enemyA;
      userPlayer.forceGrounded(WORLD.LEFT + 180); mateAI.forceGrounded(WORLD.LEFT + 320);
      enemyA.forceGrounded(serveState.currentServer === enemyA ? WORLD.RIGHT + 100 : WORLD.RIGHT - 320);
      enemyB.forceGrounded(serveState.currentServer === enemyB ? WORLD.RIGHT + 100 : WORLD.RIGHT - 180);
      this.x = serveState.currentServer.x - 15; this.y = WORLD.FLOOR_Y - 35;
    }

    const myPlayer = allPlayers[NET.mySlot] || userPlayer;
    if (serveState.currentServer === myPlayer) {
      statusSubtext.innerText = '★ 我方發球：長按 [K] 高拋 ➔ [W+J] 跳發或 [W+L] 跳飄！';
    } else if (serveState.currentServer.isLeft === myPlayer.isLeft) {
      statusSubtext.innerText = `★ 隊友 (${serveState.currentServer.name}) 發球中...`;
    } else {
      statusSubtext.innerText = `▲ 敵方 (${serveState.currentServer.name}) 發球中...`;
    }

    const isHumanServer = (typeof isSlotHumanControlled === 'function')
      ? isSlotHumanControlled(serveState.currentServer)
      : serveState.currentServer.isLocallyControlled;

    serveState.aiServeTimer = !isHumanServer ? 75 : 0;
  }
};

const serveState = { active: true, currentServer: userPlayer, tossed: false, charging: false, chargePower: 0, aiServeTimer: 0 };
const match = { currentServingTeam: 'player', playerServerIdx: 0, enemyServerIdx: 0, leftHits: 0, rightHits: 0, lastTouchFrame: -100, isBlockedBack: false, inServeRally: true };

// 🌟 pushCallout：若為房主，廣播給訪客同步繪製
function pushCallout(x, y, text, color = '#facc15') { 
  calloutPopups.push({ x, y: y - 28, text, color, timer: 45, maxTimer: 45 }); 
  if (typeof NET !== 'undefined' && NET.isMultiplayer && NET.isHost && NET.conn && NET.conn.open) {
    NET.conn.send({ type: 'CALLOUT_SYNC', x, y, text, color });
  }
}

function triggerCoinPopup(x, y, amount) { playSound('coin'); coinPopups.push({ x, y: y - 35, amount, timer: 50, maxTimer: 50 }); }
function triggerHalo(player, color, isTimingThreeState = false) {
  if (!player.isLeft) return; 
  haloEffects.push({
    player, color, r: player.radius * 0.8,
    maxR: player.radius * (isTimingThreeState ? 2.2 : 1.7),
    alpha: 1.0, isTimingThreeState, life: isTimingThreeState ? 18 : 14, maxLife: isTimingThreeState ? 18 : 14
  });
}

function executePlayerTimingReceive(player, isCover = false) {
  if (isNaN(ball.x) || isNaN(ball.y)) return;
  const shoulderX = player.x, shoulderY = player.y - player.radius;
  const dist = Math.hypot(shoulderX - ball.x, shoulderY - ball.y);
  let ballSpeed = Math.hypot(ball.vx, ball.vy);

  let extraDefPenalty = 0;
  if (ball.isSkyComet) extraDefPenalty += 20.0; 
  if (ball.isSineFloat) extraDefPenalty += 14.0; 
  if (ball.isPhantomDrop) extraDefPenalty += 16.0; 
  if (player.greaseDebuffRallies > 0) extraDefPenalty += 8.0;

  const isOpponentBall = ball.lastHitter && (ball.lastHitter.isLeft !== player.isLeft);

  if (isOpponentBall && ball.greaseCharges > 0) {
    ball.greaseCharges--;
    player.greaseDebuffRallies = 3;
    pushCallout(player.x, player.y - 45, '油滑沾染 (DEF-8)!!', '#475569');
    playSound('dong');
  }

  if (isOpponentBall && ball.activeSkillTag === '泥沼重扣') {
    player.mudDebuffTimer = 140;
    createMudSplash(player.x, player.y - player.radius, 16);
    pushCallout(player.x, player.y - player.radius * 2, 'MUD TRAPPED!!', '#78350f');
  }

  const effectiveDef = Math.max(0, player.stats.defense - extraDefPenalty);
  proMatchStats[player.slotKey].totalReceives++;

  if (isCover) {
    proMatchStats[player.slotKey].coverSaves++;
    player.addEnergy(15);
    pushCallout(player.x, player.y - 45, 'COVER +15 能量!', '#38bdf8');
  }

  const isShockReturn = player.consumeSkill('DEF_SAVE') && (player.stats.skill.id === 'sk_shock_return');
  if (isShockReturn) {
    playSound('perfect_spike'); triggerScreenShake(12, 12);
    createImpactSparks(ball.x, ball.y, 24, '#0ea5e9');
    pushCallout(player.x, player.y - player.radius * 2, '暴風反彈 (SHOCK RETURN)!!', '#0ea5e9');

    const targetX = player.isLeft ? (WORLD.NET_X + 120 + Math.random() * 280) : (WORLD.NET_X - 120 - Math.random() * 280);
    const effGravity = WORLD.GRAVITY * 1.6, reqVy = -21.0;
    const tUp = Math.abs(reqVy) / effGravity, tDown = Math.sqrt((2 * (WORLD.FLOOR_Y - 90)) / effGravity);
    ball.vx = (targetX - ball.x) / (tUp + tDown); ball.vy = reqVy;
    ball.isSpiked = true; ball.isUltimate = true; ball.armorPiercing = 8.0; ball.glowColor = '#0ea5e9';
    ball.lastHitter = player;
    match.isBlockedBack = false;
    return;
  }

  if (ball.isBungeeGum) {
    playSound('dong');
    ball.vx = (player.isLeft ? 1 : -1) * 2.5;
    ball.vy = -3.8;
    ball.isSpiked = false; ball.isPerfectSpike = false; ball.isBungeeGum = false;
    pushCallout(player.x, player.y - player.radius * 2, '黏稠軟墜 (BUNGEE)!!', '#f472b6');
    match.isBlockedBack = false;
    return;
  }

  if (dist < player.stats.sweetWindow && extraDefPenalty < 15.0) {
    playSound('pia'); triggerHalo(player, '#10b981', true);
    createImpactSparks(ball.x, ball.y, 16, '#10b981');
    if (player.isLocallyControlled) addCoins(1, 'PERFECT ABSORB', player.x, player.y - player.radius * 2);
    pushCallout(player.x, player.y - player.radius * 2 - 15, 'PERFECT ABSORB!!', '#10b981');

    player.jumpExhaustion = 1.0; player.depressedRallies = 0; player.addEnergy(30);
    proMatchStats[player.slotKey].perfectAbsorbs++;

    const finalTargetX = player.isLeft ? (WORLD.NET_X - 120) : (WORLD.NET_X + 120);
    const targetVy = -14.2;
    const timeInAir = (2 * Math.abs(targetVy)) / (WORLD.GRAVITY * 0.72);
    ball.vx = (finalTargetX - ball.x) / timeInAir; ball.vy = targetVy;
    ball.isSpiked = false; ball.isPerfectSpike = false; ball.isFloat = false; ball.isTacticalThrust = false;
    ball.isBrokenSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
    ball.opacity = 1.0; ball.isSineFloat = false; ball.isSkyComet = false; ball.isPhantomDrop = false; ball.glowColor = null;
    match.isBlockedBack = false;
    if (player.isLeft && !player.isLocallyControlled) pushCallout(player.x, player.y - player.radius * 2, 'CHANCE!', '#facc15');
    return;
  }

  if (dist <= 64) {
    const floatBonus = ball.isFloat ? 8.5 : 0;
    let pressure = Math.max(0, (ballSpeed + floatBonus) * 0.95 - effectiveDef) * (1.0 - player.stats.technique * 0.4);
    
    if ((ball.isBrokenSpike || ball.isSkyComet || pressure > 8.5) && Math.random() < 0.65) {
      playSound('dong'); triggerHalo(player, '#ef4444', true);
      pushCallout(player.x, player.y - player.radius * 2 - 15, 'DEFLECT!', '#ef4444');
      ball.vx = (player.isLeft ? -1 : 1) * (12.0 + Math.random() * 5.0);
      ball.vy = -12.0;
      ball.isSpiked = false; ball.isPerfectSpike = false; ball.isBrokenSpike = false; ball.isTopspin = false;
      ball.opacity = 1.0; ball.isSineFloat = false; ball.isSkyComet = false; ball.isPhantomDrop = false; ball.glowColor = null;
      match.isBlockedBack = false;
      proMatchStats[player.slotKey].deflects++;
      return;
    }

    playSound('bump'); triggerHalo(player, '#f97316', true);
    player.addEnergy(15);
    proMatchStats[player.slotKey].normalBumps++;

    const baseTargetX = player.isLeft ? (WORLD.NET_X - 120) : (WORLD.NET_X + 120);
    let deflection = (Math.random() > 0.4 ? 1.0 : -0.5) * (pressure * 10.0);
    const targetVy = -13.8 - (pressure * 0.25);
    const timeInAir = (2 * Math.abs(targetVy)) / (WORLD.GRAVITY * 0.72);

    ball.vx = (baseTargetX + deflection - ball.x) / timeInAir; ball.vy = targetVy;
    ball.isSpiked = false; ball.isPerfectSpike = false; ball.isFloat = false; ball.isTacticalThrust = false;
    ball.isBrokenSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
    ball.opacity = 1.0; ball.isSineFloat = false; ball.isSkyComet = false; ball.isPhantomDrop = false; ball.glowColor = null;
    match.isBlockedBack = false;
    if (player === mateAI) pushCallout(mateAI.x, mateAI.y - mateAI.radius * 2, 'NICE!', '#38bdf8');
    return;
  }

  playSound('dong'); triggerHalo(player, '#ef4444', true);
  pushCallout(player.x, player.y - player.radius * 2 - 15, 'DEFLECT!', '#ef4444');
  ball.vx = (player.isLeft ? -1 : 1) * (10.0 + Math.random() * 5.0); ball.vy = -12.0;
  ball.isSpiked = false; ball.isPerfectSpike = false; ball.isFloat = false; ball.isTacticalThrust = false;
  ball.isBrokenSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
  ball.opacity = 1.0; ball.isSineFloat = false; ball.isSkyComet = false; ball.isPhantomDrop = false; ball.glowColor = null;
  match.isBlockedBack = false;
  proMatchStats[player.slotKey].deflects++;
}

function executeSetterPass(setter) {
  if (isNaN(ball.x) || isNaN(ball.y)) return;
  const isLeft = setter.isLeft;
  if (isLeft && !setter.isLocallyControlled) triggerHalo(setter, '#38bdf8', false);

  if (setter.consumeSkill('SET_TACTIC') && setter.stats.skill.id === 'sk_godspeed_toss') {
    setter.godspeedCharges = 3;
    pushCallout(setter.x, setter.y - 45, '神速二傳 (GODSPEED)!!', '#eab308');
  }

  if (setter.godspeedCharges > 0) {
    ball.hasTossedFromGodspeed = true;
    setter.godspeedCharges--;
    createImpactSparks(setter.x, setter.y - setter.radius, 14, '#eab308');
  } else {
    ball.hasTossedFromGodspeed = false;
  }

  const minNetDist = 65, maxNetDist = WORLD.ATTACK_LINE_DIST - 10;
  const targetOffset = minNetDist + Math.random() * (maxNetDist - minNetDist);
  const idealTargetX = isLeft ? (WORLD.NET_X - targetOffset) : (WORLD.NET_X + targetOffset);

  const distToTarget = Math.abs(setter.x - idealTargetX);
  const distFactor = distToTarget / 240;
  const randomSpread = (Math.random() - 0.5) * 2;
  const errAmplitude = Math.max(20, (55 - setter.stats.intellect) * 2.8 + (1.0 - setter.stats.technique) * 55);
  const naturalError = randomSpread * errAmplitude * distFactor;
  const finalTargetX = idealTargetX + naturalError;

  const targetVy = -13.8;
  const timeInAir = (2 * Math.abs(targetVy)) / (WORLD.GRAVITY * 0.72);
  ball.vx = (finalTargetX - ball.x) / timeInAir; ball.vy = targetVy;
  ball.isSpiked = false; ball.isPerfectSpike = false; ball.isFloat = false; 
  ball.isTacticalThrust = false; ball.isBrokenSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
  ball.opacity = 1.0; ball.glowColor = null;
  playSound('set');
  if (setter === mateAI) pushCallout(ball.x, ball.y - 15, 'CHANCE!', '#facc15');
}

function addCoins(amount, desc = '', spawnX = null, spawnY = null) {
  userCoins += amount;
  const cd = document.getElementById('coin-display');
  if (cd) cd.innerText = userCoins;
  saveGameData();
  if (spawnX !== null && spawnY !== null) triggerCoinPopup(spawnX, spawnY, amount);
  if (desc && !isPaused) statusSubtext.innerText = `🪙 +${amount} 幣 (${desc})!`;
}

function recordTouch(hitter, isBlockTouch = false) {
  if (ball.isPhantomDrop && ball.lastHitter && ball.lastHitter.isLeft !== hitter.isLeft) {
    ball.opacity = 1.0; ball.isPhantomDrop = false;
  }

  if (match.inServeRally && !serveState.active && hitter.isLeft !== serveState.currentServer.isLeft) {
    match.inServeRally = false;
  }

  if (ball.lastHitter && ball.lastHitter.isLeft !== hitter.isLeft) {
    if (hitter.isLeft) match.leftHits = 0;
    else match.rightHits = 0;
    allPlayers.forEach(p => p.hasBlockSelfHitPrivilege = false);
  }

  const isAttacking = hitter.swingTimer > 0 || hitter.thrustTimer > 0;
  const isOpponentBall = (ball.lastHitter && ball.lastHitter.isLeft !== hitter.isLeft);

  const isHuman = (typeof isSlotHumanControlled === 'function') ? isSlotHumanControlled(hitter) : hitter.isLocallyControlled;
  let isLegitBlock = false;
  if (!match.inServeRally && isOpponentBall && !isAttacking && !hitter.isGrounded && ball.y < WORLD.NET_TOP_Y + 50) {
    isLegitBlock = isHuman ? (hitter.isBlocking && Math.abs(hitter.x - WORLD.NET_X) < 110) : (Math.abs(hitter.jumpStartX - WORLD.NET_X) < 95 || isBlockTouch);
  }

  if (isLegitBlock) {
    ball.lastHitter = hitter;
    match.lastTouchFrame = gameFrame;
    hitter.hasBlockSelfHitPrivilege = true;
    hitter.addEnergy(25);
    proMatchStats[hitter.slotKey].totalBlocks++;
    return true; 
  }

  const isSelfConsecutive = (ball.lastHitter === hitter);
  if (isSelfConsecutive) {
    if (hitter.hasBlockSelfHitPrivilege) {
      hitter.hasBlockSelfHitPrivilege = false; 
    } else {
      triggerFault(hitter.isLeft ? 'RIGHT' : 'LEFT', 'DOUBLE HIT!!', '同一球員連續觸球違例');
      return false;
    }
  }

  hitter.hasBlockSelfHitPrivilege = false;

  if (hitter.isLeft) {
    match.leftHits++;
    if (match.leftHits > 3) { triggerFault('RIGHT', 'FOUR HITS!!', '左隊超過 3 次擊球違例'); return false; }
  } else {
    match.rightHits++;
    if (match.rightHits > 3) { triggerFault('LEFT', 'FOUR HITS!!', '右隊超過 3 次擊球違例'); return false; }
  }

  ball.lastHitter = hitter;
  match.lastTouchFrame = gameFrame;
  return true;
}

// 🌟 客觀勝負陣營判定：winnerTeam 為 'LEFT' 或 'RIGHT'
function triggerFault(winnerTeam, title, desc) {
  if (banner.active || isSettlementOpen) return;
  playWhistle(true);
  banner.winnerTeam = winnerTeam;
  timeSlowTimer = 0; chronoAnimTimer = 0;
  hitStopFrames = 15;

  allPlayers.forEach(p => {
    if (p.depressedRallies > 0) p.depressedRallies--;
    if (p.excitedRallies > 0) p.excitedRallies--;
    if (p.softWallRallies > 0) p.softWallRallies--;
    if (p.greaseDebuffRallies > 0) p.greaseDebuffRallies--;
  });

  const isSevereMistake = desc.includes('ROOF') || desc.includes('出界') || desc.includes('FAULT') || desc.includes('違例');
  const baseDepressChance = isSevereMistake ? 0.50 : 0.18;

  allPlayers.forEach(p => {
    const isWinnerSide = (winnerTeam === 'LEFT' && p.isLeft) || (winnerTeam === 'RIGHT' && !p.isLeft);
    const intVal = (p.card && p.card.stats && p.card.stats.int) ? p.card.stats.int : 20;
    const depressResist = Math.min(0.70, intVal * 0.015);

    if (isWinnerSide) {
      if (p.depressedRallies <= 0) {
        if (Math.random() < 0.35) p.excitedRallies = Math.max(p.excitedRallies, 2);
      }
    } else {
      if (p.excitedRallies <= 0) {
        const finalChance = baseDepressChance * (1.0 - depressResist);
        if (Math.random() < finalChance) p.depressedRallies = Math.max(p.depressedRallies, 1);
      }
    }
  });

  const isTouchOut = desc.includes('TOUCH OUT'), isAce = title.includes('ACE');

  if (winnerTeam === 'LEFT') { 
    score.player++; 
    userPlayer.addEnergy(20);
    if (pendingCoinReward > 0) {
      if (isTouchOut) addCoins(pendingCoinReward + 2, 'TOUCH OUT 打手出界加權', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
      else addCoins(pendingCoinReward, pendingCoinReason, userPlayer.x, userPlayer.y - userPlayer.radius * 2);
    } else if (ball.lastHitter && ball.lastHitter.isLocallyControlled) {
      if (isAce) addCoins(3, 'SERVICE ACE!! 發球得分', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
      else addCoins(1, '進攻得分', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
    }

    if (ball.lastHitter && ball.lastHitter.isLeft) {
      if (isAce) proMatchStats[ball.lastHitter.slotKey].serviceAces++;
      else if (isTouchOut) proMatchStats[ball.lastHitter.slotKey].toolOutKills++;
      else proMatchStats[ball.lastHitter.slotKey].spikeKills++;
    }
  } else { 
    score.enemy++;
    pendingCoinReward = 0; pendingCoinReason = '';
    if (ball.lastHitter && !ball.lastHitter.isLeft) {
      if (isAce) proMatchStats[ball.lastHitter.slotKey].serviceAces++;
      else if (isTouchOut) proMatchStats[ball.lastHitter.slotKey].toolOutKills++;
      else proMatchStats[ball.lastHitter.slotKey].spikeKills++;
    }
  }

  scoreDisplay.innerText = `${score.player} : ${score.enemy}`;
  banner.active = true; banner.timer = 85; banner.mainText = title; banner.subText = desc;

  // 🌟 自主色彩判定：依本機陣營判斷藍字/紅字
  const myIsLeft = (typeof NET !== 'undefined') ? (NET.mySlot === 0 || NET.mySlot === 1) : true;
  const amIWinner = (winnerTeam === 'LEFT' && myIsLeft) || (winnerTeam === 'RIGHT' && !myIsLeft);
  banner.color = amIWinner ? '#38bdf8' : '#f43f5e';

  ball.vy = -Math.max(6.5, Math.abs(ball.vy) * 0.65);
  ball.vx *= 0.85;

  if (typeof checkMatchWin === 'function') checkMatchWin();
}

// 🌟 房主檢查比賽結束，並透過 MATCH_SETTLEMENT 同步給訪客
function checkMatchWin() {
  if ((score.player >= 15 || score.enemy >= 15) && Math.abs(score.player - score.enemy) >= 2) {
    const winnerSide = (score.player > score.enemy) ? 'LEFT' : 'RIGHT';
    openSettlement(winnerSide);

    if (typeof NET !== 'undefined' && NET.isMultiplayer && NET.isHost && NET.conn && NET.conn.open) {
      NET.conn.send({
        type: 'MATCH_SETTLEMENT',
        stats: proMatchStats,
        winnerSide: winnerSide,
        score: score
      });
    }
  }
}

// 🌟 結算面板：依 winnerSide 與本機陣營展示 VICTORY 或 DEFEAT
function openSettlement(winnerSide = 'LEFT') {
  isSettlementOpen = true; isPaused = true;
  document.getElementById('settlement-modal').style.display = 'flex';

  const myIsLeft = (typeof NET !== 'undefined') ? (NET.mySlot === 0 || NET.mySlot === 1) : true;
  const playerWon = (winnerSide === 'LEFT' && myIsLeft) || (winnerSide === 'RIGHT' && !myIsLeft);

  document.getElementById('settle-title').innerText = playerWon ? 'MATCH VICTORY!!' : 'MATCH DEFEAT...';
  document.getElementById('settle-title').style.color = playerWon ? '#facc15' : '#f43f5e';
  document.getElementById('settle-desc').innerText = playerWon ? '率先拿下 15 分局勝利！' : '惜敗，再接再厲！';
  
  if (playerWon) {
    addCoins(40, '15 分勝場大獎', 800, 250);
    document.getElementById('settle-coins-reward').innerText = '🪙 +40 排球金幣存入存檔！';
  } else {
    document.getElementById('settle-coins-reward').innerText = '🪙 惜敗無勝場金幣';
  }

  let bestRating = -1, mvpSlot = 'user';
  for (let slot in ACTIVE_ROSTER) {
    const s = proMatchStats[slot];
    const aces = s.serviceAces || 0;
    const rating = ((s.spikeKills + s.toolOutKills) * 25) + (aces * 25) + (s.roofKills * 30) + (s.perfectAbsorbs * 15);
    if (rating > bestRating) { bestRating = rating; mvpSlot = slot; }
  }

  const baseExp = playerWon ? 150 : 60;
  const tbody = document.getElementById('settle-table-body');
  tbody.innerHTML = '';

  for (let slot in ACTIVE_ROSTER) {
    const card = ACTIVE_ROSTER[slot], s = proMatchStats[slot], isMvp = (slot === mvpSlot);
    const aces = s.serviceAces || 0;
    const personalBonus = ((s.spikeKills + s.toolOutKills) * 20) + (aces * 20) + (s.roofKills * 25) + (s.perfectAbsorbs * 15) + (isMvp ? 50 : 0);
    const finalExp = baseExp + personalBonus;

    // 只有本機背包裡的角色才累加 EXP 存檔；電腦臨時物件結算完不寫入存檔
// 🌟 連線模式防串存檔：只有「本機玩家自己出戰操控的角色 (NET.mySlot)」才享有存檔升級加點！
    let shouldUpdateLocalExp = true;
    if (typeof NET !== 'undefined' && NET.isMultiplayer) {
      const mySlotKey = allPlayers[NET.mySlot] ? allPlayers[NET.mySlot].slotKey : 'user';
      if (slot !== mySlotKey) {
        shouldUpdateLocalExp = false; // 對手或隊友出的角色，本機背包不存檔、不升級
      }
    }

    const localInvCard = shouldUpdateLocalExp ? INVENTORY.find(c => c.id === card.id || c.name === card.name) : null;
    let levelUp = false;
    if (localInvCard) {
      localInvCard.exp += finalExp;
      let reqExp = getRequiredExp(localInvCard.level);
      while (localInvCard.exp >= reqExp && localInvCard.level < 20) {
        localInvCard.exp -= reqExp; localInvCard.level++; localInvCard.freePts += 5; levelUp = true;
        reqExp = getRequiredExp(localInvCard.level);
      }
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: ${card.color}; font-weight: bold; font-size: 11px;">${card.name} ${isMvp ? '👑MVP' : ''} (Lv.${card.level}${levelUp ? '⬆️' : ''})</td>
      <td>${s.totalSpikes}</td>
      <td style="color: #ef4444; font-weight: bold;">${s.spikeKills}</td>
      <td style="color: #10b981; font-weight: bold;">${s.toolOutKills}</td>
      <td style="color: #facc15; font-weight: bold;">${aces}</td>
      <td style="color: #facc15;">${s.maxSpeed.toFixed(1)}</td>
      <td>${s.totalReceives}</td>
      <td style="color: #10b981;">${s.perfectAbsorbs}</td>
      <td style="color: #f97316;">${s.normalBumps}</td>
      <td style="color: #ef4444;">${s.deflects}</td>
      <td style="color: #38bdf8;">${s.coverSaves}</td>
      <td>${s.totalBlocks}</td>
      <td style="color: #facc15; font-weight: bold;">${s.roofKills}</td>
      <td style="color: #38bdf8; font-weight: bold;">+${finalExp} EXP</td>
    `;
    tbody.appendChild(tr);
  }
  
  if (isCareerMode && playerWon) {
    const stage = CAREER_STAGES.find(s => s.id === currentCareerStage);
    if (stage) {
      addCoins(stage.rewardCoins, `通過 STAGE 0${stage.id} 關卡大獎`, 800, 220);
      let rewardText = `🏆 擊破【${stage.name}】！🪙 +${stage.rewardCoins} 幣`;
      if (!UNLOCKED_COSMETICS.effects) UNLOCKED_COSMETICS.effects = ['fx_none'];
      if (stage.rewardSkin && !UNLOCKED_COSMETICS.effects.includes(stage.rewardSkin)) {
        UNLOCKED_COSMETICS.effects.push(stage.rewardSkin);
        const skObj = COSMETICS_DB.effects.find(e => e.id === stage.rewardSkin);
        rewardText += ` ＋ 🎽 解鎖限定光效【${skObj ? skObj.name : ''}】！`;
      }
      document.getElementById('settle-coins-reward').innerText = rewardText;
      if (currentCareerStage === careerProgress && careerProgress < CAREER_STAGES.length) {
        careerProgress++;
      }
    }
  }

  saveGameData();
}

// 🌟 結算再戰：連線時退回 30 秒戰術準備室，單人時直接開局
function handleSettlementRematch() {
  document.getElementById('settlement-modal').style.display = 'none';
  isSettlementOpen = false;

  if (typeof NET !== 'undefined' && NET.isMultiplayer) {
    if (NET.conn && NET.conn.open) {
      NET.conn.send({ type: 'REMATCH_PREP' });
    }
    startNetPreparation();
  } else {
    closeSettlementAndNextMatch();
  }
}

function closeSettlementAndNextMatch() {
  document.getElementById('settlement-modal').style.display = 'none';
  isSettlementOpen = false; isPaused = false;
  resetMatchState();
  ball.resetForServe('LEFT');
}

function returnToStartMenu() {
  if (confirm('確定要結束目前比賽並返回主選單嗎？目前比分將會重置。')) {
    saveGameData(); isGameStarted = false; isPaused = true;
    resetMatchState();
    document.getElementById('start-menu-modal').style.display = 'flex';
  }
}

function returnToStartMenuFromSettle() {
  document.getElementById('settlement-modal').style.display = 'none';
  isSettlementOpen = false; isGameStarted = false; isPaused = true;
  saveGameData();
  resetMatchState();
  document.getElementById('start-menu-modal').style.display = 'flex';
}

function closeLockerToMenu() {
  isLockerOpen = false; document.getElementById('locker-modal').style.display = 'none';
  if (!isGameStarted) document.getElementById('start-menu-modal').style.display = 'flex';
}

function toggleLocker() {
  if (isSettlementOpen) return;
  isLockerOpen = !isLockerOpen; isPaused = isLockerOpen || !isGameStarted;
  document.getElementById('locker-modal').style.display = isLockerOpen ? 'flex' : 'none';
  if (isLockerOpen) { initStagedCard(); renderLocker(); }
  else { allPlayers.forEach(p => p.rebind(true)); }
}

function startGameFromMenu() {
  document.getElementById('start-menu-modal').style.display = 'none';
  isGameStarted = true; isPaused = false;
  resetMatchState();
  ball.resetForServe('LEFT');
}

// 🌟 全鍵盤 ESC 智能監聽
const keys = {};
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); keys[k] = true;
  
  if (e.key === 'Escape') {
    if (isLockerOpen) {
      if (!isGameStarted) closeLockerToMenu();
      else toggleLocker();
    } else if (isSettlementOpen) {
      handleSettlementRematch();
    } else if (isGameStarted) {
      togglePauseMenu();
    }
  }

  if (e.key === 'Enter') {
    if (isSettlementOpen) handleSettlementRematch();
  }
  if (k === 'b') debugHitbox = !debugHitbox;

  // 🌟 本機玩家實體按鍵分流
  const myActor = allPlayers[NET.mySlot] || userPlayer;

  if (!isPaused && !isLockerOpen && !banner.active && !isSettlementOpen && isGameStarted && !isPauseMenuOpen) {
    if (serveState.active && serveState.currentServer === myActor) {
      if (k === 'k' && !serveState.tossed) serveState.charging = true;
      if (k === 'j' && serveState.tossed) handleServeSpike(myActor);
      if (k === 'l' && serveState.tossed) handleServeFloat(myActor);
    } else if (!serveState.active) {
      if (e.code === 'Space') myActor.triggerBlock();
      if (k === 'j') handleUserAttack(myActor);
      if (k === 'l') { if (!myActor.isGrounded) handleUserThrust(myActor); else myActor.dive(); }
      if (k === 'k') handleUserBump(myActor);
      if (k === 'o') handleUserSet(myActor);
    }
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase(); keys[k] = false;
  const myActor = allPlayers[NET.mySlot] || userPlayer;
  if (serveState.active && serveState.currentServer === myActor && k === 'k' && serveState.charging && !serveState.tossed) {
    serveState.charging = false; serveState.tossed = true;
    const pRatio = Math.max(0.35, serveState.chargePower / 100);
    ball.vx = myActor.isLeft ? 1.0 : -1.0;
    ball.vy = myActor.stats.jump * (0.80 + pRatio * 0.65);
    playSound('set');
    statusSubtext.innerText = '高拋完成！助跑 ➔ [W+J] 跳發暴扣 或 [W+L] 跳飄！';
  }
});

// 🌟 記錄訪客上一幀的按鍵狀態（過濾邊緣觸發，杜絕連擊二觸）
let lastRemoteKeys = {};

// 🌟 通用真人動作執行器 (支援房主本地與遠端訪客按鍵呼叫)
function executePlayerAction(actor, inputKeys) {
  if (!actor || !inputKeys) return;
  if (serveState.active && serveState.currentServer === actor) {
    if (inputKeys['k'] && !serveState.tossed) serveState.charging = true;
    if (inputKeys['j'] && serveState.tossed) handleServeSpike(actor);
    if (inputKeys['l'] && serveState.tossed) handleServeFloat(actor);
  } else if (!serveState.active) {
    if (inputKeys['space']) actor.triggerBlock();
    if (inputKeys['j']) handleUserAttack(actor);
    if (inputKeys['l']) { if (!actor.isGrounded) handleUserThrust(actor); else actor.dive(); }
    if (inputKeys['k']) handleUserBump(actor);
    if (inputKeys['o']) handleUserSet(actor);
  }
}

// 🌟 專用訪客動作分流器：補齊放開 K 拋球，並只在「剛按下一瞬間」觸發擊球動作
function executeGuestActionWithEdge(guestPlayer, currentKeys) {
  if (!guestPlayer || !currentKeys) return;

const justPressed = {};
  const justReleased = {};
  // 🌟 補齊空白鍵的三種瀏覽器標準鍵名（' '、'space'、'spacebar'）
  const checkKeys = ['w', 'a', 's', 'd', 'j', 'k', 'l', 'o', 'space', ' ', 'spacebar'];
  
  for (let k of checkKeys) {
    if (currentKeys[k] && !lastRemoteKeys[k]) justPressed[k] = true;
    if (!currentKeys[k] && lastRemoteKeys[k]) justReleased[k] = true;
  }
  lastRemoteKeys = { ...currentKeys };

  // 🌟 空白鍵相容整合：只要任何一種空白鍵有按，就認定 space 觸發
  const isSpacePressed = justPressed['space'] || justPressed[' '] || justPressed['spacebar'];
  // 發球階段
  if (serveState.active && serveState.currentServer === guestPlayer) {
    if (justPressed['k'] && !serveState.tossed) {
      serveState.charging = true; // 開始蓄力
    }
    // 🌟 解決訪客 K 丟不出去：只要訪客放開 K，房主立刻結算拋球！
    if (justReleased['k'] && serveState.charging && !serveState.tossed) {
      serveState.charging = false;
      serveState.tossed = true;
      const pRatio = Math.max(0.35, serveState.chargePower / 100);
      ball.vx = guestPlayer.isLeft ? 1.0 : -1.0;
      ball.vy = guestPlayer.stats.jump * (0.80 + pRatio * 0.65);
      playSound('set');
      statusSubtext.innerText = '高拋完成！助跑 ➔ [W+J] 跳發暴扣 或 [W+L] 跳飄！';
    }
    if (justPressed['j'] && serveState.tossed) handleServeSpike(guestPlayer);
    if (justPressed['l'] && serveState.tossed) handleServeFloat(guestPlayer);
  } 
// 常規攻防階段：嚴格只在剛按下的那一幀 (justPressed) 觸發一次，徹底消滅二觸！
  else if (!serveState.active) {
    if (isSpacePressed) guestPlayer.triggerBlock();
    if (justPressed['j']) handleUserAttack(guestPlayer);
    if (justPressed['l']) { 
      if (!guestPlayer.isGrounded) handleUserThrust(guestPlayer); 
      else guestPlayer.dive(); 
    }
    if (justPressed['k']) handleUserBump(guestPlayer);
    if (justPressed['o']) handleUserSet(guestPlayer);
  }
}
function getDist(p, b = ball) {
  if (isNaN(b.x) || isNaN(b.y)) return 99999;
  const px = p.isDiving ? p.x + p.facing * 18 : p.x;
  const py = p.isDiving ? WORLD.FLOOR_Y - 8 : p.y - p.radius;
  return Math.hypot(px - b.x, py - b.y);
}

function handleServeSpike(actor) {
  if (getDist(actor) > 95) return;
  const isFootFault = actor.isLeft ? (actor.jumpStartX >= WORLD.LEFT) : (actor.jumpStartX <= WORLD.RIGHT);
  if (isFootFault) {
    triggerFault(actor.isLeft ? 'RIGHT' : 'LEFT', 'FOOT FAULT!!', '發球起跳踩線違例');
    serveState.active = false; return;
  }
  actor.swingTimer = 12; serveState.active = false; recordTouch(actor);

  const isCometSkill = actor.consumeSkill('SERVE_SPIKE');
  const serveMomentum = (actor.runMomentum / 25) * 4.5;
  const rawSpikeSpeed = (actor.stats.power * 0.98 + serveMomentum);
  const facingDir = actor.isLeft ? 1 : -1;

  if (isCometSkill) {
    ball.isSkyComet = true; ball.activeSkillTag = '天際墜石'; ball.armorPiercing = 7.5; ball.glowColor = '#facc15';
    const targetX = actor.isLeft ? (WORLD.NET_X + 120 + Math.random() * 260) : (WORLD.NET_X - 120 - Math.random() * 260);
    const effGravity = WORLD.GRAVITY * 1.8, reqVy = -22.5; 
    const tUp = Math.abs(reqVy) / effGravity, tDown = Math.sqrt((2 * (WORLD.FLOOR_Y - 90)) / effGravity);
    ball.vx = (targetX - ball.x) / (tUp + tDown); ball.vy = reqVy;
    playSound('perfect_spike'); triggerScreenShake(12, 12); createImpactSparks(ball.x, ball.y, 20, '#facc15');
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, '天際墜石 (SKY COMET)!!', '#facc15');
    pendingCoinReward = 3; pendingCoinReason = 'SKY COMET';
  } else if (!actor.isGrounded) {
    const contactDy = ball.y - (actor.y - actor.radius * 1.5);
    if (ball.y < WORLD.NET_TOP_Y - 60 && ball.y > WORLD.NET_TOP_Y - 240 && getDist(actor) < 80) {
      ball.vx = facingDir * rawSpikeSpeed; ball.vy = (contactDy * 0.08) - 1.5;
      ball.isSpiked = true; ball.isPerfectSpike = true; ball.isTopspin = true;
      ball.topspinRating = actor.stats.technique;
      playSound('perfect_spike'); triggerScreenShake(8, 9); createImpactSparks(ball.x, ball.y, 16, '#ef4444');
      pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'PERFECT JUMP SERVE!!', '#ef4444');
      pendingCoinReward = 2; pendingCoinReason = 'PERFECT ACE';
    } else if (ball.y <= WORLD.NET_TOP_Y - 240) {
      ball.vx = facingDir * rawSpikeSpeed * 1.18; ball.vy = -5.0; ball.isSpiked = true;
      playSound('spike'); pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'OUT BALL!!', '#eab308');
    } else {
      ball.vx = facingDir * rawSpikeSpeed * 0.65; ball.vy = 4.0;
      playSound('bump'); pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'NET FAULT!!', '#f97316');
    }
  } else {
    ball.vx = facingDir * rawSpikeSpeed * 0.70; ball.vy = -4.0;
    playSound('spike'); pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'STANDING SERVE', '#94a3b8');
  }
  statusSubtext.innerText = '';
}

function handleServeFloat(actor) {
  if (getDist(actor) > 95) return;
  const isFootFault = actor.isLeft ? (actor.jumpStartX >= WORLD.LEFT) : (actor.jumpStartX <= WORLD.RIGHT);
  if (isFootFault) {
    triggerFault(actor.isLeft ? 'RIGHT' : 'LEFT', 'FOOT FAULT!!', '發球起跳踩線違例');
    serveState.active = false; return;
  }
  actor.thrustTimer = 12; actor.thrustTargetX = ball.x; actor.thrustTargetY = ball.y;
  serveState.active = false; recordTouch(actor);
  const facingDir = actor.isLeft ? 1 : -1;

  const isSineSkill = actor.consumeSkill('SERVE_FLOAT');
  if (isSineSkill) {
    ball.isFloat = true; ball.isSineFloat = true; ball.activeSkillTag = '落日正弦'; ball.glowColor = '#f59e0b';
    ball.vx = facingDir * 11.2; ball.vy = -10.5; playSound('set');
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, '落日正弦 (SOLAR SINE)!!', '#f59e0b');
  } else {
    ball.isFloat = true; ball.isTacticalThrust = false; ball.isTopspin = false; playSound('set');
    const floatSpeed = 17.5 + (actor.stats.technique * 2.0);
    ball.vx = facingDir * (!actor.isGrounded ? floatSpeed : 15.0);
    ball.vy = !actor.isGrounded ? -1.5 : -3.5;
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'FLOAT SERVE!', '#10b981');
  }
  statusSubtext.innerText = '';
}

function handleUserAttack(actor) {
  const shoulderX = actor.x, shoulderY = actor.y - actor.radius * 1.5;
  const dx = (ball.x - shoulderX) * actor.facing, dy = -(ball.y - shoulderY);
  if (dx < -10 || dx > 80 || Math.abs(dy) > 80) return;
  actor.swingTimer = 12;
  if (!recordTouch(actor)) return;

  proMatchStats[actor.slotKey].totalSpikes++;
  ball.isTacticalThrust = false; ball.isTopspin = true;
  ball.topspinRating = actor.stats.technique;

  const isSkillActivated = actor.consumeSkill('SPIKE');
  const currentSkill = actor.stats.skill;

  if (!actor.isGrounded) {
    const angle = Math.atan2(dy, dx);
    const momentumRatio = actor.runMomentum / 25;
    const bonusPower = momentumRatio * 4.2;
    const techFactor = 0.85 + (actor.stats.technique * 0.25);
    let effectivePower = (actor.stats.power + bonusPower) * techFactor;

    if (ball.hasTossedFromGodspeed) {
      effectivePower += 4.0;
      ball.hasTossedFromGodspeed = false;
      createImpactSparks(ball.x, ball.y, 14, '#eab308');
      pushCallout(actor.x, actor.y - 45, 'GODSPEED SPIKE +4.0!!', '#eab308');
    }

    if (isSkillActivated) {
      effectivePower *= (currentSkill.speedMult || 1.10);
      ball.vx = actor.facing * (effectivePower + 4.0); ball.vy = 14.5;
      ball.isSpiked = true; ball.isPerfectSpike = true; ball.isUltimate = true;
      ball.armorPiercing = currentSkill.armorPiercing || 0;
      ball.topspinRating += (currentSkill.extraDown || 0);
      ball.activeSkillTag = currentSkill.name; ball.glowColor = currentSkill.glowColor || '#ef4444';

      if (currentSkill.id === 'sk_bungee_gum') ball.isBungeeGum = true;
      if (currentSkill.id === 'sk_gravity_drop') { ball.isGravityDrop = true; ball.vy = 2.0; }
      if (currentSkill.id === 'sk_greased_ball') ball.greaseCharges = 2;

      playSound('perfect_spike'); triggerScreenShake(12, 12); createImpactSparks(ball.x, ball.y, 20, ball.glowColor);
      pushCallout(actor.x, actor.y - actor.radius * 2 - 15, `${currentSkill.name}!!`, ball.glowColor);
      pendingCoinReward = 2; pendingCoinReason = currentSkill.name;
    } else if (angle > 0.6) {
      ball.vx = actor.facing * (effectivePower * 1.15); ball.vy = 6.8;
      ball.isSpiked = true; ball.isPerfectSpike = false; ball.isUltimate = false; ball.armorPiercing = 0; ball.glowColor = null;
      playSound('spike'); triggerScreenShake(5, 6); createImpactSparks(ball.x, ball.y, 8, '#38bdf8');
      pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'DEEP SPIKE!', '#38bdf8');
    } else if (angle >= 0.1 && angle <= 0.6) {
      ball.vx = actor.facing * effectivePower; ball.vy = 12.0;
      ball.isSpiked = true; ball.isPerfectSpike = true; ball.isUltimate = false; ball.armorPiercing = 0; ball.glowColor = null;
      playSound('perfect_spike'); triggerScreenShake(8, 9); createImpactSparks(ball.x, ball.y, 14, '#ef4444');
      pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'PERFECT SPIKE!!', '#ef4444');
      pendingCoinReward = 1; pendingCoinReason = 'PERFECT SPIKE';
    } else {
      ball.vx = actor.facing * (effectivePower * 0.72); ball.vy = 16.5;
      ball.isSpiked = true; ball.isPerfectSpike = true; ball.isUltimate = false; ball.armorPiercing = 0; ball.glowColor = null;
      playSound('perfect_spike'); triggerScreenShake(9, 10); createImpactSparks(ball.x, ball.y, 16, '#facc15');
      pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'STEEP CUT!', '#facc15');
      pendingCoinReward = 1; pendingCoinReason = 'STEEP CUT';
    }
  } else {
    const targetX = WORLD.NET_X + (actor.facing * 180);
    const effGravity = WORLD.GRAVITY * 0.72, apexY = WORLD.NET_TOP_Y - 48;
    const deltaY = Math.max(10, ball.y - apexY);
    const reqVy = -Math.sqrt(2 * effGravity * deltaY);
    const tUp = Math.abs(reqVy) / effGravity, tDown = Math.sqrt((2 * (WORLD.FLOOR_Y - apexY)) / effGravity);

    ball.vx = (targetX - ball.x) / (tUp + tDown); ball.vy = reqVy;
    ball.isSpiked = false; ball.isPerfectSpike = false; ball.isUltimate = false; ball.armorPiercing = 0;
    ball.isTopspin = false; ball.glowColor = null; playSound('bump');
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'SAFE PUSH', '#38bdf8');
  }

  const curSpd = Math.hypot(ball.vx, ball.vy);
  if (curSpd > proMatchStats[actor.slotKey].maxSpeed) proMatchStats[actor.slotKey].maxSpeed = curSpd;
}

function handleUserThrust(actor) {
  const shoulderX = actor.x, shoulderY = actor.y - actor.radius * 1.5;
  const forwardDist = (ball.x - shoulderX) * actor.facing;
  const verticalDelta = ball.y - shoulderY;
  if (forwardDist < 0 || forwardDist > 85 || Math.abs(verticalDelta) > 65) return;
  actor.thrustTimer = 12; actor.thrustTargetX = ball.x; actor.thrustTargetY = ball.y;
  if (!recordTouch(actor)) return;

  proMatchStats[actor.slotKey].totalSpikes++;
  const currentSkill = actor.stats.skill;
  const isPhantomThrust = actor.consumeSkill('THRUST');
  const isBungeeThrust = (currentSkill.id === 'sk_bungee_gum') && actor.consumeSkill('SPIKE');
  const hits = actor.isLeft ? match.leftHits : match.rightHits;
  const isPhantomDrop = (hits === 2) && actor.consumeSkill('SET_ATTACK');

  if (isPhantomDrop) {
    ball.isPhantomDrop = true; ball.opacity = 0.05; ball.activeSkillTag = '幽靈吊球'; ball.glowColor = null;
    const targetX = WORLD.NET_X + (actor.facing * 130), effGravity = WORLD.GRAVITY * 0.72, apexY = WORLD.NET_TOP_Y - 30;
    const deltaY = Math.max(10, ball.y - apexY), reqVy = -Math.sqrt(2 * effGravity * deltaY);
    const tUp = Math.abs(reqVy) / effGravity, tDown = Math.sqrt((2 * (WORLD.FLOOR_Y - apexY)) / effGravity);
    ball.vx = (targetX - ball.x) / (tUp + tDown); ball.vy = reqVy; playSound('set');
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, '幽靈吊球!!', '#c084fc');
    return;
  }

  const baseSpeed = isPhantomThrust ? 15.0 : 12.5;
  ball.vx = actor.facing * baseSpeed; ball.isTacticalThrust = true; ball.isTopspin = false;

  if (isBungeeThrust) {
    ball.isBungeeGum = true;
    ball.vy = 0.5; ball.activeSkillTag = '伸縮自在的愛'; ball.glowColor = '#f472b6';
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, '伸縮自在的愛!!', '#f472b6');
  } else if (isPhantomThrust) {
    ball.vy = 0.2; ball.activeSkillTag = '幻影抹手'; ball.glowColor = '#10b981';
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, `${currentSkill.name}!!`, '#10b981');
  } else if (verticalDelta < -15) {
    ball.vy = -3.2; pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'PUSH DEEP!', '#38bdf8');
  } else if (verticalDelta >= -15 && verticalDelta <= 15) {
    ball.vy = 0.5; pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'TOOL OUT!', '#10b981');
  } else {
    ball.vy = 4.8; pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'SOFT ROLL!', '#facc15');
  }
  ball.isSpiked = false; ball.isPerfectSpike = false; ball.isFloat = false; ball.isUltimate = (isPhantomThrust || isBungeeThrust); ball.armorPiercing = 0;
  playSound('set');
  const curSpd = Math.hypot(ball.vx, ball.vy);
  if (curSpd > proMatchStats[actor.slotKey].maxSpeed) proMatchStats[actor.slotKey].maxSpeed = curSpd;
}

function handleUserBump(actor) {
  const sk = actor.stats.skill;
  if (sk.id === 'sk_savage_roar' && actor.energy >= sk.cost) {
    actor.consumeSkill('DEF_SAVE');
    playSound('time_freeze'); triggerScreenShake(8, 12);
    createShockwave(actor.x, actor.y - actor.radius, '#dc2626');
    pushCallout(actor.x, actor.y - 45, '野蠻怒吼 (SAVAGE ROAR)!!', '#dc2626');
    allPlayers.forEach(p => {
      if (p.isLeft === actor.isLeft) p.excitedRallies = 3;
      else p.depressedRallies = 3;
    });
    return;
  }

  const isRollingThunderReady = (sk.type === 'DEF_SAVE') && (actor.energy >= sk.cost);
  const isBallInMyCourt = actor.isLeft ? (ball.x <= WORLD.NET_X - 10) : (ball.x >= WORLD.NET_X + 10);
  const isBallEligibleHeight = ball.y > 260 && ball.y < WORLD.FLOOR_Y - 15;

  if (isRollingThunderReady && isBallInMyCourt && isBallEligibleHeight && sk.id === 'sk_rolling_thunder') {
    actor.consumeSkill('DEF_SAVE');
    createImpactSparks(actor.x, actor.y - actor.radius, 14, '#38bdf8');
    const minX = actor.isLeft ? WORLD.LEFT + 30 : WORLD.NET_X + 40;
    const maxX = actor.isLeft ? WORLD.NET_X - 40 : WORLD.RIGHT - 30;
    actor.x = Math.max(minX, Math.min(maxX, ball.x - (actor.facing * 8)));
    actor.y = WORLD.FLOOR_Y; actor.isGrounded = true; actor.vx = 0; actor.vy = 0;
    playSound('teleport');
    createImpactSparks(actor.x, actor.y - actor.radius, 18, '#10b981');
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'ROLLING THUNDER!!', '#38bdf8');
    ball.x = actor.x + (actor.facing * 12); ball.y = actor.y - actor.radius * 1.2;
    ball.vx = 0; ball.vy = 0;
    if (recordTouch(actor)) executePlayerTimingReceive(actor, false);
    return;
  }

  const d = getDist(actor);
  const reach = 56 + (actor.stats.technique * 8.0);
  if (d > reach) return;
  const wasBlocked = match.isBlockedBack;
  if (!recordTouch(actor)) return;
  executePlayerTimingReceive(actor, wasBlocked);
}

function handleUserSet(actor) {
  if (getDist(actor) > 85) return;
  if (!recordTouch(actor)) return;

  const isChrono = actor.consumeSkill('SET_TACTIC');
  if (isChrono && actor.stats.skill.id === 'sk_chrono_spike') {
    timeSlowTimer = 180; chronoCasterSide = actor.isLeft ? 'player' : 'enemy'; chronoAnimTimer = 28;
    triggerScreenShake(6, 12); playSound('clock_tick');
    setTimeout(() => { playSound('time_freeze'); }, 180);
    pushCallout(actor.x, actor.y - actor.radius * 2 - 15, 'CHRONO SPIKE!!', '#ec4899');
  }
  executeSetterPass(actor);
}

function moveTowards(char, targetX, speed) {
  if (char.x < targetX - 6) { char.vx = speed; char.facing = 1; }
  else if (char.x > targetX + 6) { char.vx = -speed; char.facing = -1; }
  else { char.vx = 0; }
}

function handlePhysics() {
  if (banner.active || isSettlementOpen) {
    if (banner.active) {
      banner.timer--;
      if (banner.timer <= 0) { banner.active = false; ball.resetForServe(banner.winnerTeam); }
    }
    if (hitStopFrames <= 0) {
      ball.x += ball.vx; ball.y += ball.vy; ball.vy += WORLD.GRAVITY;
      ball.rotation += ball.vx * 0.06;
      if (ball.y >= WORLD.FLOOR_Y) {
        ball.y = WORLD.FLOOR_Y;
        ball.vy = -Math.abs(ball.vy) * 0.55;
        ball.vx *= 0.85;
      }
    } else {
      hitStopFrames--;
    }
    return;
  }

  if (timeSlowTimer > 0) timeSlowTimer--;
  if (chronoAnimTimer > 0) chronoAnimTimer--;

  if (serveState.active && !serveState.tossed) {
    const s = serveState.currentServer;
    ball.x = s.x + (s.isLeft ? 20 : -12); ball.y = s.y - 10;
    const isHumanServer = (typeof isSlotHumanControlled === 'function')
      ? isSlotHumanControlled(s)
      : s.isLocallyControlled;
    if (isHumanServer && serveState.charging) {
      serveState.chargePower = Math.min(100, serveState.chargePower + 2.4);
    }
    return;
  }

  if (serveState.active && serveState.tossed) {
    ball.x += ball.vx; ball.y += ball.vy; ball.vy += WORLD.GRAVITY * 0.72;
    if (ball.y >= WORLD.FLOOR_Y) {
      triggerFault(serveState.currentServer.isLeft ? 'RIGHT' : 'LEFT', 'FAULT!!', '發球拋球落地未擊中');
    }
    return;
  }

  ball.x += ball.vx; ball.y += ball.vy;
  let effGravity = WORLD.GRAVITY * 0.72;

  if (ball.isGravityDrop) {
    const isCrossedNet = (ball.vx > 0 && ball.x > WORLD.NET_X + 60) || (ball.vx < 0 && ball.x < WORLD.NET_X - 60);
    if (isCrossedNet) {
      effGravity = WORLD.GRAVITY * 12.0;
      ball.vx *= 0.15;
      if (ball.vy < 14.0) ball.vy = 18.0;
    }
  }

  if (ball.activeSkillTag === '泥沼重扣' && gameFrame % 2 === 0) {
    visualEffects.push({
      type: 'mud_drop', x: ball.x, y: ball.y,
      vx: -ball.vx * 0.15 + (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 2, life: 20, maxLife: 20, color: '#78350f'
    });
  }

  if (ball.isSkyComet) {
    effGravity = WORLD.GRAVITY * 1.8;
    if (ball.vy > 0) ball.vy = Math.min(39.5, ball.vy + 0.8);
  }

  if (ball.isTopspin) {
    const magnusLiftCoeff = 0.00032 + (ball.topspinRating * 0.00018);
    const downforce = (ball.vx * ball.vx) * magnusLiftCoeff;
    effGravity += downforce;
  }

  ball.vy += effGravity;
  ball.rotation += ball.vx * 0.05;

  if (ball.isSineFloat && Math.abs(ball.vx) > 2) {
    ball.y += Math.sin(gameFrame * 0.45) * 4.2; ball.x += Math.cos(gameFrame * 0.35) * 1.8;
  } else if (ball.isFloat && Math.abs(ball.vx) > 3) {
    ball.y += Math.sin(gameFrame * 0.38) * 2.2;
    if ((ball.vx > 0 && ball.x > WORLD.NET_X) || (ball.vx < 0 && ball.x < WORLD.NET_X)) ball.vy += 0.18;
  }

  ball.opacity = ball.isPhantomDrop ? (ball.y > WORLD.FLOOR_Y - 70 ? Math.min(1.0, ball.opacity + 0.18) : 0.05) : 1.0;

  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  if (currentSpeed > maxRecordedSpeed) maxRecordedSpeed = currentSpeed;
  if (ball.topspinRating > maxRecordedSpin) maxRecordedSpin = ball.topspinRating;

  const netLeft = WORLD.NET_X - WORLD.NET_W / 2 - ball.radius;
  const netRight = WORLD.NET_X + WORLD.NET_W / 2 + ball.radius;

  if (ball.x > netLeft && ball.x < netRight) {
    if (ball.y + ball.radius >= WORLD.NET_TOP_Y && ball.y < WORLD.NET_TOP_Y + 14) {
      if (ball.vy > 0) { 
        ball.y = WORLD.NET_TOP_Y - ball.radius; 
        ball.vy = -Math.abs(ball.vy) * 0.45; ball.vx *= 0.75; playSound('bump');
      }
    } else if (ball.y >= WORLD.NET_TOP_Y + 14) {
      const movingRight = ball.vx > 0;
      ball.vx *= -0.7; ball.x = movingRight ? netLeft : netRight; playSound('bump');
    }
  }

  if (!match.inServeRally) {
    allPlayers.forEach(p => {
      const isAttacking = p.swingTimer > 0 || p.thrustTimer > 0;
      const isOpponentBall = (ball.lastHitter && ball.lastHitter.isLeft !== p.isLeft);
      const isHuman = (typeof isSlotHumanControlled === 'function') ? isSlotHumanControlled(p) : p.isLocallyControlled;
      let isEligibleBlock = false;

      if (isOpponentBall && !isAttacking && !p.isGrounded && ball.y < WORLD.NET_TOP_Y + 50) {
        isEligibleBlock = isHuman ? (p.isBlocking && Math.abs(p.x - WORLD.NET_X) < 110) : (Math.abs(p.jumpStartX - WORLD.NET_X) < 95);
      }

      if (isEligibleBlock && getDist(p) < 70) {
        recordTouch(p, true);
        p.isBlocking = false; p.wantsToBlock = false; match.isBlockedBack = true;
        if (p.isLeft) match.rightHits = 0; else match.leftHits = 0;

        const incomingSpeed = Math.hypot(ball.vx, ball.vy);
        const incomingVy = ball.vy, handTopY = p.y - p.radius * 2 - 20;

        if (ball.lastHitter && ball.lastHitter.isLeft !== p.isLeft) {
          if (ball.greaseCharges > 0) {
            ball.greaseCharges--;
            p.greaseDebuffRallies = 3;
            pushCallout(p.x, p.y - 45, '油滑沾染 (DEF-8)!!', '#475569');
          }
          if (ball.activeSkillTag === '泥沼重扣') {
            p.mudDebuffTimer = 140;
            createMudSplash(p.x, p.y - p.radius, 14);
            pushCallout(p.x, p.y - p.radius * 2, 'MUD TRAPPED!!', '#78350f');
          }
        }

        let isFingertip = false, isToolOut = false;

        const isIronWall = p.consumeSkill('BLOCK') && (p.stats.skill.id === 'sk_iron_wall');
        if (isIronWall) {
          hitStopFrames = 60;
          triggerScreenShake(15, 20); playSound('block_roof');
          const oppFloorX = p.isLeft ? (WORLD.NET_X + 60) : (WORLD.NET_X - 60);
          ball.x = oppFloorX; ball.y = WORLD.NET_TOP_Y + 40;
          ball.vx = 0; ball.vy = 32.0;
          createShockwave(ball.x, WORLD.FLOOR_Y, '#fbbf24');
          createImpactSparks(ball.x, ball.y, 30, '#fbbf24');
          pushCallout(p.x, p.y - p.radius * 2, '銅牆鐵壁 (IRON WALL)!!', '#fbbf24');
          return;
        }

        if (p.softWallRallies > 0) {
          playSound('bump');
          ball.vx = (p.isLeft ? -1 : 1) * 3.5; ball.vy = -12.5;
          ball.isSpiked = false; ball.isPerfectSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
          pushCallout(p.x, p.y - p.radius * 2, '引力柔網!!', '#2dd4bf');
          return;
        }

        if (ball.isTacticalThrust) {
          const rand = Math.random();
          if (ball.activeSkillTag === '幻影抹手') {
            if (rand < 0.50) isToolOut = true; else isFingertip = true;
          } else {
            if (rand < 0.65) isFingertip = true; else if (rand < 0.85) isToolOut = true;
          }
        } else {
          isFingertip = (ball.y <= handTopY + 14);
        }

        const rigidityNoise = (Math.random() - 0.5) * 4.0;
        let effectiveRigidity = p.stats.blockRigidity + rigidityNoise;
        if (ball.armorPiercing) effectiveRigidity = Math.max(0, effectiveRigidity - ball.armorPiercing);

        const isBreakThrough = ball.isSpiked && (incomingSpeed > effectiveRigidity);
        lastBlockDebug = { effectiveRigidity, incomingSpeed, ap: ball.armorPiercing || 0, isBroken: isBreakThrough };

        allPlayers.forEach(mate => {
          if (mate.isLeft !== p.isLeft) mate.reactionTimer = Math.max(mate.reactionTimer, mate.stats.reactionDelay);
        });

        if (isBreakThrough) {
          ball.vx *= 0.84; ball.vy = Math.max(3.0, ball.vy * 0.75);
          ball.isSpiked = true; ball.isPerfectSpike = false; ball.isBrokenSpike = true;
          ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
          playSound('block_break'); triggerScreenShake(10, 10);
          createImpactSparks(ball.x, ball.y, 18, '#ef4444');
          pushCallout(p.x, p.y - p.radius * 2, 'BROKEN!!', '#ef4444');
          if (ball.lastHitter && ball.lastHitter.isLocallyControlled) {
            addCoins(2, 'SPIKE THROUGH BLOCK', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
            pushCallout(userPlayer.x, userPlayer.y - userPlayer.radius * 2 - 15, 'THROUGH BLOCK!!', '#facc15');
          }
        } else if (isToolOut) {
          ball.vx = (p.isLeft ? 1 : -1) * 21.0; ball.vy = -10.5;
          ball.isSpiked = false; ball.isPerfectSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
          playSound('bump'); pushCallout(p.x, p.y - p.radius * 2 - 15, 'TOOL OUT SUCCESS!!', '#10b981');
        } else if (isFingertip) {
          if (ball.activeSkillTag === '幻影抹手' && ball.lastHitter) ball.lastHitter.refundEnergy(0.5);
          const retainRatio = Math.max(0.25, 0.65 - (p.stats.technique * 0.22) - (p.stats.defense * 0.005));
          ball.vx *= retainRatio; ball.vy = -Math.max(9.0, Math.abs(incomingVy) * 0.75);
          ball.isSpiked = false; ball.isPerfectSpike = false; ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
          playSound('bump'); pushCallout(p.x, p.y - p.radius * 2 - 15, 'ONE TOUCH!!', '#38bdf8');
        } else {
          p.addEnergy(20); proMatchStats[p.slotKey].roofKills++;
          pushCallout(p.x, p.y - 45, 'ROOF +20 能量!', '#facc15');
          if (ball.activeSkillTag === '幻影抹手' && ball.lastHitter) ball.lastHitter.refundEnergy(0.5);
          if (ball.isPhantomDrop) { ball.opacity = 1.0; ball.isPhantomDrop = false; }

          const strVal = (p.card && p.card.stats && p.card.stats.str) ? p.card.stats.str : 20;
          const reboundRatio = 0.65 + (strVal * 0.006);
          const reboundDir = p.isLeft ? 1 : -1;

          ball.x = WORLD.NET_X + (reboundDir * (WORLD.NET_W/2 + ball.radius + 24));
          ball.vx = reboundDir * Math.max(4.0, Math.abs(ball.vx) * 0.55);
          ball.vy = Math.max(5.5, incomingSpeed * reboundRatio);
          ball.isSpiked = true; ball.isPerfectSpike = (incomingSpeed > 20); ball.isUltimate = false; ball.isTopspin = false; ball.armorPiercing = 0;
          playSound('block_roof'); triggerScreenShake(9, 10);
          createImpactSparks(ball.x, ball.y, 16, '#facc15');
          if (p.isLocallyControlled) {
            addCoins(3, 'MONSTER BLOCK', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
            pushCallout(userPlayer.x, userPlayer.y - userPlayer.radius * 2 - 15, 'ROOF BLOCK!!', '#facc15');
          }
        }
      }
    });
  }

  allPlayers.forEach(p => {
    if (p.isDiving && !p.diveTouched && getDist(p) < 85) {
      if (recordTouch(p)) {
        p.diveTouched = true; p.addEnergy(25);
        executePlayerTimingReceive(p, match.isBlockedBack); playSound('dive');
        if (p.isLocallyControlled) { 
          addCoins(2, 'DIVE SAVE', userPlayer.x, userPlayer.y - userPlayer.radius * 2);
          pushCallout(p.x, p.y - p.radius * 2 - 15, 'SUPER DIVE SAVE!!', '#38bdf8');
        }
      }
    }
  });

  if (ball.y + ball.radius >= WORLD.FLOOR_Y) {
    if (ball.isPerfectSpike || ball.isSkyComet) { 
      triggerScreenShake(10, 12); createShockwave(ball.x, WORLD.FLOOR_Y, '#ef4444'); 
    }
    const isOut = (ball.x < WORLD.LEFT || ball.x > WORLD.RIGHT);
    const serverSide = serveState.currentServer ? (serveState.currentServer.isLeft ? 'LEFT' : 'RIGHT') : 'LEFT';
    const receiverSide = (serverSide === 'LEFT') ? 'RIGHT' : 'LEFT';
    const receiverTouches = (serverSide === 'LEFT') ? match.rightHits : match.leftHits;
    const isAceRally = match.inServeRally && (receiverTouches <= 1);

    if (isOut) {
      if (ball.lastHitter) {
        const hitterSide = ball.lastHitter.isLeft ? 'LEFT' : 'RIGHT';
        const winSide = (hitterSide === 'LEFT') ? 'RIGHT' : 'LEFT';
        if (isAceRally && hitterSide === receiverSide) {
          triggerFault(serverSide, 'SERVICE ACE!!', '發球強力破壞一傳直接得分!');
        } else {
          triggerFault(winSide, 'OUT BALL!!', hitterSide === 'LEFT' ? 'TOUCH OUT / 左隊出界' : 'TOUCH OUT / 右隊出界');
        }
      } else { 
        triggerFault('RIGHT', 'OUT BALL!!', '出界'); 
      }
    } else {
      if (ball.x < WORLD.NET_X) {
        if (isAceRally && serverSide === 'RIGHT') {
          triggerFault('RIGHT', 'SERVICE ACE!!', '右隊發球直接落地得分!');
        } else {
          triggerFault('RIGHT', 'BALL IN!!', '左半場失守 (右隊得分)');
        }
      } else {
        if (isAceRally && serverSide === 'LEFT') {
          triggerFault('LEFT', 'SERVICE ACE!!', '發球無解直接落地得分 (ACE)!');
        } else {
          triggerFault('LEFT', (ball.isPerfectSpike || ball.isSkyComet) ? 'SUPER SPIKE KILL!!' : 'BALL IN!!', '右半場失守 (左隊得分!)');
        }
      }
    }
  }
}

function triggerScreenShake(intensity, frames) { screenShakeIntensity = intensity; screenShakeTimer = frames; }
function createShockwave(x, y, color = '#ef4444') { visualEffects.push({ type: 'shockwave', x, y, radius: 10, alpha: 1.0, color }); }
function createImpactSparks(x, y, count = 8, color = '#facc15') {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = Math.random() * 8 + 3;
    visualEffects.push({ type: 'spark', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 20, maxLife: 20, color });
  }
}
function createMudSplash(x, y, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
    const speed = Math.random() * 5 + 2;
    visualEffects.push({
      type: 'mud_drop', x: x + (Math.random() - 0.5) * 20, y: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 3, life: 28, maxLife: 28, color: '#78350f'
    });
  }
}

// 🌟 套用網路同步封包 (包含狀態機、Banner 與浮動文字)
function applyWorldSync(data) {
  // 🌟 客戶端球體平滑：保留原本狀態標籤，但座標採用微插值過渡，撫平掉幀抖動
  const snapDist = Math.hypot(ball.x - data.ball.x, ball.y - data.ball.y);
  if (snapDist > 250 || serveState.active) {
    // 瞬移或發球重置時直接瞬移對齊
    Object.assign(ball, data.ball);
  } else {
    // 平時用 0.85 比例柔和逼近，消除肉眼微跳頓
    ball.x += (data.ball.x - ball.x) * 0.85;
    ball.y += (data.ball.y - ball.y) * 0.85;
    ball.vx = data.ball.vx;
    ball.vy = data.ball.vy;
    ball.rotation = data.ball.rotation;
    ball.opacity = data.ball.opacity;
    ball.glowColor = data.ball.glowColor;
    ball.isSpiked = data.ball.isSpiked;
    ball.isPerfectSpike = data.ball.isPerfectSpike;
    ball.isFloat = data.ball.isFloat;
    ball.activeSkillTag = data.ball.activeSkillTag;
  }

  score.player = data.score.player;
  score.enemy = data.score.enemy;
  scoreDisplay.innerText = `${score.player} : ${score.enemy}`;

  if (data.banner) {
    Object.assign(banner, data.banner);
    const myIsLeft = (NET.mySlot === 0 || NET.mySlot === 1);
    const amIWinner = (banner.winnerTeam === 'LEFT' && myIsLeft) || (banner.winnerTeam === 'RIGHT' && !myIsLeft);
    banner.color = amIWinner ? '#38bdf8' : '#f43f5e';
  }

  data.players.forEach((pData, idx) => {
    if (allPlayers[idx]) {
      // 🌟 本地操控的英雄 (NET.mySlot) 依靠預測運行，不被網路座標生硬覆蓋
      if (idx === NET.mySlot) {
        // 只同步房主算出的狀態/體力/能量，座標微幅修正
        allPlayers[idx].energy = pData.energy;
        allPlayers[idx].jumpExhaustion = pData.jumpExhaustion;
        allPlayers[idx].isBlocking = pData.isBlocking;
        allPlayers[idx].mudDebuffTimer = pData.mudDebuffTimer;
        allPlayers[idx].depressedRallies = pData.depressedRallies;
        allPlayers[idx].excitedRallies = pData.excitedRallies;
        allPlayers[idx].softWallRallies = pData.softWallRallies;
        allPlayers[idx].godspeedCharges = pData.godspeedCharges;
        allPlayers[idx].greaseDebuffRallies = pData.greaseDebuffRallies;
        // 誤差過大才校準拉回
        if (Math.hypot(allPlayers[idx].x - pData.x, allPlayers[idx].y - pData.y) > 40) {
          allPlayers[idx].x += (pData.x - allPlayers[idx].x) * 0.3;
          allPlayers[idx].y += (pData.y - allPlayers[idx].y) * 0.3;
        }
      } else {
        Object.assign(allPlayers[idx], pData);
      }
    }
  });

  updateSideUltHUD();
}
function fixedUpdate() {
  gameFrame++;

  if (typeof NET !== 'undefined' && NET.isMultiplayer) {
    if (NET.isHost) {
      if (NET.conn && NET.conn.open) {
        NET.conn.send({
          type: 'STATE_SYNC',
          ball: {
            x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, rotation: ball.rotation,
            opacity: ball.opacity, glowColor: ball.glowColor, isSpiked: ball.isSpiked,
            isPerfectSpike: ball.isPerfectSpike, isFloat: ball.isFloat, activeSkillTag: ball.activeSkillTag
          },
          score: score,
          banner: { active: banner.active, timer: banner.timer, mainText: banner.mainText, subText: banner.subText, color: banner.color, winnerTeam: banner.winnerTeam },
          players: allPlayers.map(p => ({
            x: p.x, y: p.y, vx: p.vx, vy: p.vy, facing: p.facing,
            squashX: p.squashX, squashY: p.squashY, isDiving: p.isDiving,
            isBlocking: p.isBlocking, energy: p.energy, jumpExhaustion: p.jumpExhaustion,
            depressedRallies: p.depressedRallies, excitedRallies: p.excitedRallies,
            mudDebuffTimer: p.mudDebuffTimer, softWallRallies: p.softWallRallies,
            godspeedCharges: p.godspeedCharges, greaseDebuffRallies: p.greaseDebuffRallies
          }))
        });
      }

      // 🌟 房主為遠端訪客執行動作分流
      const rk = NET.remoteKeys || {};
      const guestSlot = (NET.mode === 'COOP') ? 1 : 2;
      const guestPlayer = allPlayers[guestSlot];
      const forwardDir = (NET.mode === 'COOP') ? 1 : -1;

      guestPlayer.vx = 0;
      if (rk['a']) { guestPlayer.vx = -forwardDir * guestPlayer.effectiveSpeed; guestPlayer.facing = -forwardDir; }
      if (rk['d']) { guestPlayer.vx = forwardDir * guestPlayer.effectiveSpeed; guestPlayer.facing = forwardDir; }
      if (rk['w']) guestPlayer.jump();
      
// 🌟 訪客按鍵呼叫防二觸與邊緣判定分流器
      executeGuestActionWithEdge(guestPlayer, rk);
    } else {
if (NET.conn && NET.conn.open) {
        NET.conn.send({ type: 'INPUT', keys: keys });
      }

      // 🌟 訪客客戶端預測 (0ms 本機先動)：自己的角色按下 A/D/W 立即位移，告別笨重感
      const myHero = allPlayers[NET.mySlot];
      if (myHero && !isPaused && !isSettlementOpen) {
        const forwardDir = (NET.mode === 'COOP') ? 1 : -1;
        myHero.vx = 0;
        if (keys['a']) { myHero.vx = -forwardDir * myHero.effectiveSpeed; myHero.facing = -forwardDir; }
        if (keys['d']) { myHero.vx = forwardDir * myHero.effectiveSpeed; myHero.facing = forwardDir; }
        if (keys['w']) myHero.jump();
        myHero.update();
      }

      camera.update(ball);
      return;    }
  }

  // 🌟 本機玩家 (Slot 0) 移動
  const myPlayer = allPlayers[NET.mySlot] || userPlayer;
  myPlayer.vx = 0;
  if (keys['a']) { myPlayer.vx = -myPlayer.effectiveSpeed; myPlayer.facing = -1; }
  if (keys['d']) { myPlayer.vx = myPlayer.effectiveSpeed; myPlayer.facing = 1; }
  if (keys['w']) myPlayer.jump();

  allPlayers.forEach(p => {
    p.update();
    const cosmetics = (p.card && p.card.cosmetics) ? p.card.cosmetics : { effect: 'fx_none' };
    const effectObj = (typeof COSMETICS_DB !== 'undefined') ? COSMETICS_DB.effects.find(e => e.id === cosmetics.effect) : null;
    const isMoving = Math.abs(p.vx) > 1.2 || !p.isGrounded;

    if (gameFrame % 3 === 0) {
      if (isMoving) {
        p.ghostTrail.push({ x: p.x, y: p.y, facing: p.facing, squashX: p.squashX, squashY: p.squashY, isDiving: p.isDiving, alpha: 0.55 });
      }
      if (effectObj && effectObj.glow && (isMoving || Math.random() < 0.3)) {
        visualEffects.push({
          type: 'skin_mote',
          color: effectObj.glow,
          x: p.x + (Math.random() - 0.5) * 16,
          y: p.y - p.radius + (Math.random() - 0.5) * 16,
          vx: -p.vx * 0.15 + (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.4,
          size: 2.5,
          life: 20,
          maxLife: 20
        });
      }
    }

    for (let i = p.ghostTrail.length - 1; i >= 0; i--) {
      p.ghostTrail[i].alpha -= 0.07;
      if (p.ghostTrail[i].alpha <= 0) p.ghostTrail.splice(i, 1);
    }
  });

  if (serveState.active && serveState.currentServer !== myPlayer) {
    const isServerHuman = (typeof isSlotHumanControlled === 'function')
      ? isSlotHumanControlled(serveState.currentServer)
      : serveState.currentServer.isLocallyControlled;

    if (!isServerHuman && serveState.aiServeTimer > 0) {
      serveState.aiServeTimer--;
      const server = serveState.currentServer, isLeft = server.isLeft;

      if (serveState.aiServeTimer === 35) {
        serveState.tossed = true; 
        ball.vx = isLeft ? 2.2 : -2.2; 
        ball.vy = server.stats.jump * 1.15; 
        playSound('set');
      }
      if (serveState.aiServeTimer === 10) server.jump();
      if (serveState.aiServeTimer <= 0) {
        server.swingTimer = 12; serveState.active = false; recordTouch(server);
        const isAISkyComet = server.consumeSkill('SERVE_SPIKE');
        const isAISolarSine = server.consumeSkill('SERVE_FLOAT');

        if (isAISkyComet) {
          ball.isSkyComet = true; ball.activeSkillTag = '天際墜石'; ball.armorPiercing = 7.5; ball.glowColor = '#facc15';
          const targetX = isLeft ? (WORLD.NET_X + 120 + Math.random() * 260) : (WORLD.NET_X - 120 - Math.random() * 260);
          const effGravity = WORLD.GRAVITY * 1.8, reqVy = -22.5;
          const tUp = Math.abs(reqVy) / effGravity, tDown = Math.sqrt((2 * (WORLD.FLOOR_Y - 90)) / effGravity);
          ball.vx = (targetX - ball.x) / (tUp + tDown); ball.vy = reqVy;
          playSound('perfect_spike'); pushCallout(server.x, server.y - server.radius * 2, '天際墜石!!', '#facc15');
        } else if (isAISolarSine) {
          ball.isFloat = true; ball.isSineFloat = true; ball.activeSkillTag = '落日正弦'; ball.glowColor = '#f59e0b';
          ball.vx = (isLeft ? 1 : -1) * 11.2; ball.vy = -10.5;
          playSound('set'); pushCallout(server.x, server.y - server.radius * 2, '落日正弦!!', '#f59e0b');
        } else {
          const prefersFloat = server.stats.technique > 0.85 && Math.random() < 0.6;
          if (prefersFloat) {
            ball.isFloat = true; ball.isTopspin = false; ball.glowColor = null;
            const floatSpeed = 17.5 + (server.stats.technique * 2.0);
            ball.vx = (isLeft ? 1 : -1) * floatSpeed; ball.vy = -1.5; playSound('set');
          } else {
            const serveMomentum = (server.runMomentum / 25) * 4.5;
            const rawSpikeSpeed = (server.stats.power * 0.98 + serveMomentum);
            ball.vx = (isLeft ? 1 : -1) * rawSpikeSpeed; ball.vy = -2.0; 
            ball.isSpiked = true; ball.isTopspin = true; ball.topspinRating = server.stats.technique;
            ball.glowColor = null; playSound('spike');
          }
        }
        statusSubtext.innerText = '';
      }
    }
  } else if (!serveState.active && !banner.active && !isSettlementOpen) {
    if (ball.x < WORLD.NET_X) {
      runTeamBrain(userPlayer, mateAI, match.leftHits, WORLD.NET_X - 120, true);
      updateBlockAI();
    } else { 
      moveTowards(mateAI, WORLD.LEFT + 220, mateAI.effectiveSpeed); 
    }
    if (ball.x > WORLD.NET_X) {
      runTeamBrain(enemyA, enemyB, match.rightHits, WORLD.NET_X + 120, false);
      updateBlockAI();
    } else { 
      const distA = Math.abs(enemyA.x - WORLD.NET_X);
      const backEnemy = (distA < Math.abs(enemyB.x - WORLD.NET_X)) ? enemyB : enemyA;
      moveTowards(backEnemy, WORLD.RIGHT - 220, backEnemy.effectiveSpeed); 
      updateBlockAI();
    }
  }

  handlePhysics();
  camera.update(ball);

  for (let i = visualEffects.length - 1; i >= 0; i--) {
    const fx = visualEffects[i];
    if (fx.type === 'shockwave') {
      fx.radius += 5.5; fx.alpha -= 0.08; if (fx.alpha <= 0) visualEffects.splice(i, 1);
    } else if (fx.type === 'spark') {
      fx.x += fx.vx; fx.y += fx.vy; fx.life--; if (fx.life <= 0) visualEffects.splice(i, 1);
    } else if (fx.type === 'mud_drop') {
      fx.x += fx.vx; fx.y += fx.vy; fx.vy += 0.25; fx.life--;
      if (fx.life <= 0 || fx.y >= WORLD.FLOOR_Y) visualEffects.splice(i, 1);
    } else if (fx.type === 'skin_mote') {
      fx.x += fx.vx; fx.y += fx.vy; fx.life--;
      if (fx.life <= 0) visualEffects.splice(i, 1);
    }
  }
}

let lastFrameTime = performance.now(), accumulator = 0;
const TIME_STEP = 1000 / 60;
function mainLoop(currentTime) {
  if (!isPaused && !isSettlementOpen && isGameStarted) {
    let delta = currentTime - lastFrameTime;
    if (delta > 250) delta = 250;
    lastFrameTime = currentTime; accumulator += delta;
    while (accumulator >= TIME_STEP) { fixedUpdate(); accumulator -= TIME_STEP; }
    render();
  } else { 
    lastFrameTime = currentTime; 
    if (!isGameStarted) render();
  }
  requestAnimationFrame(mainLoop);
}

loadGameData();
allPlayers.forEach(p => p.rebind(true));
updateSideUltHUD();
requestAnimationFrame(mainLoop);
// 🌟 解決切視窗/分頁時間凍結：使用不受背景降頻限制的 Web Worker 維持 60FPS 連線心跳
const bgHeartbeatBlob = new Blob([`
  let bgTimer = null;
  self.onmessage = function(e) {
    if (e.data === 'start') {
      if (!bgTimer) bgTimer = setInterval(() => self.postMessage('tick'), 1000 / 60);
    } else if (e.data === 'stop') {
      clearInterval(bgTimer);
      bgTimer = null;
    }
  };
`], { type: 'application/javascript' });

const bgHeartbeat = new Worker(URL.createObjectURL(bgHeartbeatBlob));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    bgHeartbeat.postMessage('start');
  } else {
    bgHeartbeat.postMessage('stop');
  }
});

bgHeartbeat.onmessage = function(e) {
  if (e.data === 'tick' && document.hidden) {
    if (!isPaused && !isSettlementOpen && isGameStarted) {
      fixedUpdate(); // 房主切去其他分頁，遊戲物理與廣播依然正常跑！
    }
  }
};