// ========================================================
// AI 戰術決策層：拋物線落點預判、三觸分配、智慧封網與新技能施放
// ========================================================

// 🌟 核心身分仲裁：精準判斷該格子是否為「真人玩家」（本機或遠端訪客）
function isSlotHumanControlled(player) {
  if (!player) return false;
  if (typeof NET !== 'undefined' && typeof NET.mySlot !== 'undefined') {
    // 1. 本機操控者必定是真人
    if (player.slotIndex === NET.mySlot) return true;
    // 2. 若本機是房主，連線進來的訪客也是真人，AI 絕對不可插手！
    if (NET.isMultiplayer && NET.isHost) {
      const guestSlot = (NET.mode === 'COOP') ? 1 : 2;
      if (player.slotIndex === guestSlot) return true;
    }
  } else {
    // 單人模式回歸基準判定
    if (player.isUser) return true;
  }
  return false;
}

// ========================================================
// AI 防守共用工具（左右隊完全共用，同一組權重 / 門檻）
// 目的：讓 AI 先理解「這顆球最後會去哪」，再決定 OUT / 跑接 / 緊急魚躍。
// 注意：這裡只做預測，不改動真實 ball 狀態。
// ========================================================
function predictBallLandingForAI(maxFrames = 240) {
  let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
  let floatDrift = ball.floatDrift || 0;
  const radius = ball.radius || 13;
  const topHalfW = 4 / 2 + radius; // V10：球的網頂碰撞寬度
  const postHalfW = WORLD.NET_W / 2 + radius;

  for (let frame = 1; frame <= maxFrames; frame++) {
    x += vx; y += vy;
    let effGravity = WORLD.GRAVITY * 0.72;

    if (ball.isGravityDrop) {
      const crossedNet = (vx > 0 && x > WORLD.NET_X + 60) || (vx < 0 && x < WORLD.NET_X - 60);
      if (crossedNet) { effGravity = WORLD.GRAVITY * 12.0; vx *= 0.15; if (vy < 14.0) vy = 18.0; }
    }
    if (ball.isSkyComet) {
      effGravity = WORLD.GRAVITY * 1.8;
      if (vy > 0) vy = Math.min(39.5, vy + 0.8);
    }
    if (ball.isSineFloat) effGravity *= 0.45;
    if (ball.isTopspin) {
      const magnusLiftCoeff = 0.00032 + (ball.topspinRating * 0.00018);
      effGravity += (vx * vx) * magnusLiftCoeff;
    }
    vy += effGravity;

    if (ball.isSineFloat) {
      // V32：AI 不讀 sineTargetX。正弦球只用當下觀測到的瞬時速度推估，因此會被巨大 S 路徑反覆欺騙。
      vx += Math.sin((typeof gameFrame !== 'undefined' ? gameFrame : 0) * 0.17 + (ball.floatPhase || 0)) * 0.35;
    } else if (ball.isFloat && Math.abs(vx) > 3) {
      // V11：預測器使用 V10 普通跳飄同一套 deterministic 氣動公式。
      const speedSq = Math.min(625, vx * vx + vy * vy);
      const aero = Math.min(1.0, speedSq / 400);
      const phase = ball.floatPhase || 0;
      const futureFrame = gameFrame + frame;
      const gust = Math.sin(futureFrame * 0.19 + phase) * 0.62
                 + Math.sin(futureFrame * 0.071 + phase * 1.73) * 0.38;
      const dropGust = Math.sin(futureFrame * 0.137 + phase * 0.61) * 0.55
                     + Math.sin(futureFrame * 0.049 + phase * 2.11) * 0.45;
      const travelDir = vx >= 0 ? 1 : -1;
      floatDrift = floatDrift * 0.90 + gust * aero * 0.055;
      vx += travelDir * floatDrift;
      vy += dropGust * aero * 0.045;
      if ((vx > 0 && x > WORLD.NET_X) || (vx < 0 && x < WORLD.NET_X)) vy += 0.20 * aero;
    }

    // V10：網頂薄、下方網柱維持原 WORLD.NET_W。
    const dxNet = Math.abs(x - WORLD.NET_X);
    if (y + radius >= WORLD.NET_TOP_Y && y < WORLD.NET_TOP_Y + 14 && dxNet < topHalfW) {
      if (vy > 0) { y = WORLD.NET_TOP_Y - radius; vy = -Math.abs(vy) * 0.45; vx *= 0.75; }
    } else if (y >= WORLD.NET_TOP_Y + 14 && dxNet < postHalfW) {
      const movingRight = vx > 0; vx *= -0.7;
      x = movingRight ? WORLD.NET_X - postHalfW : WORLD.NET_X + postHalfW;
    }

    if (y + radius >= WORLD.FLOOR_Y) return { x, frames: frame };
  }
  return { x, frames: maxFrames };
}

// V11 Landing Read：同一套真實物理預測，INT 只決定角色「讀到多少」。
// 不新增角色能力值；誤差、圈大小、更新間隔全部由既有 INT/reactionDelay/outballThreshold 派生。
function getLandingRead(player) {
  if (!player || !player.stats) return predictBallLandingForAI();
  if (!player._landingRead) player._landingRead = { x: ball.x, frames: 0, nextUpdate: -1, touchKey: -99999 };

  const read = player._landingRead;
  const touchKey = match.lastTouchFrame;
  const intellect = Math.max(0, Math.min(60, player.stats.intellect || 0));
  const iq = intellect / 60;
  const baseDelay = Math.max(2, player.stats.reactionDelay || 8);
  // 高 INT 更新快；低 INT 保留舊判讀較久。Float 額外要求持續重讀。
  let updateEvery = Math.max(2, Math.round(baseDelay * (ball.isFloat ? 0.80 : 1.0)));
  const blackout = (typeof venueIncidentState!=='undefined' && venueIncidentState.active==='BLACKOUT');
  const brightInBlackout = blackout && [WORLD.LEFT+260,WORLD.RIGHT-260].some(x=>Math.abs(player.x-x)<210);
  if(blackout && !brightInBlackout) updateEvery=Math.max(updateEvery,Math.round(updateEvery*2.2));
  // V74-16 CHRONO: the victim AI's perception also runs in Bullet Time.
  const chronoVictimAI = (typeof timeSlowTimer !== 'undefined' && timeSlowTimer > 0) &&
    ((chronoCasterSide === 'player' && !player.isLeft) || (chronoCasterSide === 'enemy' && player.isLeft));
  if (chronoVictimAI) updateEvery = Math.max(updateEvery, Math.round(updateEvery * 3.0));

  if (read.touchKey !== touchKey || gameFrame >= read.nextUpdate) {
    let truth = predictBallLandingForAI();
    // V74-23 Phantom Wipe deception: AI is not omniscient. When a live fake ball exists on this team's side,
    // it can commit its landing read to the decoy. Higher INT is fooled less often, but never reads the fake flag perfectly.
    if (typeof phantomDecoys !== 'undefined') {
      const decoy = phantomDecoys.find(d => d && d.fade<=0 && d.sourceIsLeft !== player.isLeft);
      if (decoy) {
        const deceiveChance = 0.65 - iq * 0.35; // INT 0: 65%, INT 60: 30%
        const deceiveSeed = Math.sin((match.lastTouchFrame+31)*17.17 + (player.slotIndex+5)*43.73) * 43758.5453;
        const deceiveRoll = deceiveSeed - Math.floor(deceiveSeed);
        if (deceiveRoll < deceiveChance) {
          let dx=decoy.x, dy=decoy.y, dvx=decoy.vx, dvy=decoy.vy, frames=240;
          const rr=decoy.radius||13;
          for(let f=1;f<=240;f++){dx+=dvx;dy+=dvy;dvy+=WORLD.GRAVITY*.72;if(dy+rr>=WORLD.FLOOR_Y){frames=f;break;}}
          truth={x:dx,frames};
        }
      }
    }
    // 低 INT 的中心位置有較大的穩定判讀誤差；每次「重新讀球」才改變，不會每幀亂跳。
    let maxError = 8 + (1 - iq) * 82;
    if(blackout && !brightInBlackout) maxError*=2.35;
    const epoch = Math.floor(gameFrame / updateEvery);
    const seed = (touchKey + 17) * 12.9898 + (player.slotIndex + 3) * 78.233 + epoch * 19.19;
    const raw = Math.sin(seed) * 43758.5453;
    const noiseUnit = ((raw - Math.floor(raw)) * 2) - 1;
    read.x = truth.x + noiseUnit * maxError;
    read.frames = truth.frames;
    if (typeof pushAIDebug === 'function' && typeof isSlotHumanControlled === 'function' && !isSlotHumanControlled(player)) {
      pushAIDebug(player, 'LANDING READ', `x=${read.x.toFixed(0)} ±${(24 + (1 - iq) * 86).toFixed(0)} / ${updateEvery}f`);
    }
    read.nextUpdate = gameFrame + updateEvery;
    read.touchKey = touchKey;
  }

  const uncertaintyRadius = 24 + (1 - iq) * 86;
  return { x: read.x, frames: read.frames, radius: uncertaintyRadius };
}

// V75-1 DEFENSE RELIABILITY helpers. These only arbitrate AI responsibility; they do not change ball physics.
function estimateAIChaseFrames(player, targetX, reach = null) {
  if (!player) return 9999;
  const r = reach == null ? (player.stats.reach || 64) : reach;
  const gap = Math.max(0, Math.abs(targetX - player.x) - r);
  return gap / Math.max(1, player.effectiveSpeed || 1);
}

function aiCanActNow(player) {
  return !!player && player.reactionTimer <= 0 && !(typeof player.stunTimer !== 'undefined' && player.stunTimer > 0);
}

function steerAIToFreshBallIntent(player, targetX, speed, touchFrame, label='CHASE') {
  if (!player) return;
  // When a legal touch changes the ball path, a previous SUPPORT/FORMATION instruction must not keep pulling
  // the newly assigned handler the wrong way. We only damp stale locomotion once per touch transition;
  // this is braking, not teleportation or a speed buff.
  if (player._aiMoveIntentTouch !== touchFrame) {
    const desiredDir = targetX > player.x + 6 ? 1 : (targetX < player.x - 6 ? -1 : 0);
    if (player.isGrounded && desiredDir && player.vx * desiredDir < -0.25) {
      player.vx *= 0.45;
      if (typeof pushAIDebug === 'function') pushAIDebug(player, 'INTENT BRAKE', `${label} new path`);
    }
    player._aiMoveIntentTouch = touchFrame;
  }
  moveTowards(player, targetX, speed);
}

function canAIAirborneCover(player, distance, aiReach) {
  if (!player || player.isGrounded || player.isDiving || player.isBlocking) return false;
  // Never recreate the old superhuman sequence: spike -> blocked -> zero-frame perfect self-cover.
  const sinceAttack = gameFrame - (player._lastAttackContactFrame ?? -9999);
  if (sinceAttack < 10 || player.swingTimer > 0 || player.thrustTimer > 0) return false;
  // Airborne cover is an emergency body-control action with a deliberately smaller contact envelope.
  const airReach = Math.min(aiReach * 0.72, 52);
  return distance < airReach;
}


// V75-2 DEFENSE ACTION SELECTION
// Responsibility is decided first; only the assigned owner chooses K / Dive / airborne Cover.
// This keeps the owner system stable while making the actual defensive action inspectable in debug.
function chooseAIDefenseAction(player, perceivedLandingX, framesToFloor, distance, aiReach, isCover) {
  const speed = Math.max(1, player.effectiveSpeed || 1);
  const horizontalGap = Math.max(0, Math.abs(perceivedLandingX - player.x) - aiReach);
  const runFramesNeeded = horizontalGap / speed;
  const runIsTooLate = framesToFloor <= (runFramesNeeded + 3);
  const kReachableNow = player.isGrounded && !player.isDiving && !player.isBlocking && distance < aiReach;
  const airCoverReachable = !!isCover && canAIAirborneCover(player, distance, aiReach);

  // A committed dive owns its own follow-through. Do not oscillate back to K mid-dive.
  if (player.isDiving) {
    return { action:'DIVE_ACTIVE', reason:'DIVE_ALREADY_COMMITTED', horizontalGap, runFramesNeeded, runIsTooLate, kReachableNow, airCoverReachable };
  }

  // Planted K is the control-first option whenever the ball is already inside the real receive envelope.
  if (kReachableNow) {
    return { action:'K', reason:'K_IN_RANGE', horizontalGap, runFramesNeeded, runIsTooLate, kReachableNow, airCoverReachable };
  }

  // Airborne Cover is legal only through the recovery gate above; it never replaces ordinary airborne receiving.
  if (airCoverReachable) {
    return { action:'AIR_COVER', reason:'LEGAL_AIR_COVER', horizontalGap, runFramesNeeded, runIsTooLate, kReachableNow, airCoverReachable };
  }

  // Dive is a rescue action, not a stronger K. Wait until running is no longer sufficient and the ball is in a
  // realistic emergency window. Even when the dive ETA is poor, a live chance ball should still get an attempt.
  const diveWindowOpen = framesToFloor <= 18 && ball.y > WORLD.NET_TOP_Y - 40;
  const needsDive = player.isGrounded && !player.isBlocking && distance > aiReach * 0.90 && runIsTooLate && diveWindowOpen;
  if (needsDive) {
    const diveGap = Math.max(0, Math.abs(perceivedLandingX - player.x) - 85);
    const diveFramesNeeded = diveGap / Math.max(1, speed * 2.0);
    return { action:'DIVE', reason:(diveFramesNeeded <= framesToFloor + 2 ? 'RUN_LATE_DIVE_REACHABLE' : 'RUN_LATE_LAST_CHANCE'), horizontalGap, runFramesNeeded, diveFramesNeeded, runIsTooLate, kReachableNow, airCoverReachable };
  }

  return { action:'CHASE', reason:(runIsTooLate ? 'TOO_EARLY_FOR_DIVE_WINDOW' : 'RUN_CAN_STILL_REACH'), horizontalGap, runFramesNeeded, runIsTooLate, kReachableNow, airCoverReachable };
}

function traceAIDefenseDecision(player, decision, framesToFloor, distance, aiReach) {
  if (!player || !decision || typeof pushAIDebug !== 'function') return;
  const key = `${match.lastTouchFrame}|${decision.action}|${decision.reason}`;
  if (player._aiDefenseDecisionKey === key) return;
  player._aiDefenseDecisionKey = key;
  const eta = Number.isFinite(decision.runFramesNeeded) ? decision.runFramesNeeded.toFixed(1) : '-';
  const diveEta = Number.isFinite(decision.diveFramesNeeded) ? ` diveETA=${decision.diveFramesNeeded.toFixed(1)}` : '';
  pushAIDebug(player, `DEFENSE -> ${decision.action}`, `${decision.reason} | d=${distance.toFixed(0)}/${aiReach.toFixed(0)} floor=${framesToFloor}f runETA=${eta}${diveEta}`);
}

function runTeamBrain(pA, pB, teamHits, baseNetX, isLeft) {
  const isCooldown = (gameFrame - match.lastTouchFrame) < 18;
  const landingPrediction = predictBallLandingForAI();
  const realLandingX = landingPrediction.x; // 僅供球路/Block Return 的物理歸屬，不直接給 AI 當答案。
  const framesToFloor = landingPrediction.frames;
  const readA = getLandingRead(pA);
  const readB = getLandingRead(pB);

  // V4 接球責任：先用「預測落點 + 目前站位 + 實際接球範圍」分配責任，
  // 再讓被分配到的人決定跑接或 Dive。Dive 絕對不能反過來搶責任。
  // 這裡故意不以角色跑速直接決定誰搶球，避免高速 AI 從已站好位置的真人手上搶接發。
  const receiveReachA = isSlotHumanControlled(pA) ? Math.max(70, pA.stats.reach || 70) : (pA.stats.reach || 64);
  const receiveReachB = isSlotHumanControlled(pB) ? Math.max(70, pB.stats.reach || 70) : (pB.stats.reach || 64);
  const claimGapA = Math.max(0, Math.abs(pA.x - readA.x) - receiveReachA);
  const claimGapB = Math.max(0, Math.abs(pB.x - readB.x) - receiveReachB);

  let actor;
  if (Math.abs(claimGapA - claimGapB) > 8) {
    actor = (claimGapA <= claimGapB) ? pA : pB;
  } else {
    // 幾乎等距才用到達時間作為 tie-break；這樣保留速度差，但不讓速度凌駕站位責任。
    const timeA = claimGapA / Math.max(1, pA.effectiveSpeed);
    const timeB = claimGapB / Math.max(1, pB.effectiveSpeed);
    actor = (timeA <= timeB) ? pA : pB;
  }
  let partner = (actor === pA) ? pB : pA;

  // V75-0 FOUNDATION: one unavailable actor must never shut down the whole team brain.
  // If the claimed receiver is temporarily unavailable, transfer the live-ball responsibility to the teammate
  // when that teammate is AI-controlled and available. Humans are never commandeered here.
  const actorUnavailable = actor.reactionTimer > 0 || (typeof actor.stunTimer !== 'undefined' && actor.stunTimer > 0);
  const partnerUnavailable = partner.reactionTimer > 0 || (typeof partner.stunTimer !== 'undefined' && partner.stunTimer > 0);
  if (actorUnavailable && !partnerUnavailable && !isSlotHumanControlled(partner)) {
    const oldActor = actor; actor = partner; partner = oldActor;
    if (typeof pushAIBrainTrace === 'function') pushAIBrainTrace(isLeft?'LEFT':'RIGHT', 'OWNER FAILOVER', `${oldActor.name} unavailable -> ${actor.name}`);
  } else if (actorUnavailable && partnerUnavailable) {
    if (typeof flagAIBug === 'function') flagAIBug(isLeft?'LEFT':'RIGHT', 'BOTH_UNAVAILABLE', `${actor.name}/${partner.name}`);
    return;
  }

  // V75-1 live-ball reassignment: keep the original positional claimant unless it is clearly becoming unreachable.
  // This fixes rare chance-ball freezes without making both teammates chase every ball. A human teammate is never commandeered.
  const actorClaimRead = (actor === pA) ? readA : readB;
  const partnerClaimRead = (partner === pA) ? readA : readB;
  const actorReachForEta = actor.stats.reach || 64;
  const partnerReachForEta = partner.stats.reach || 64;
  const actorEta = estimateAIChaseFrames(actor, actorClaimRead.x, actorReachForEta);
  const partnerEta = estimateAIChaseFrames(partner, partnerClaimRead.x, partnerReachForEta);
  const actorLikelyLate = actorEta > Math.max(0, framesToFloor - 3);
  const partnerClearlyBetter = partnerEta + 7 < actorEta && partnerEta <= Math.max(0, framesToFloor + 2);
  if (actorLikelyLate && partnerClearlyBetter && !isSlotHumanControlled(partner) && aiCanActNow(partner)) {
    const oldActor = actor; actor = partner; partner = oldActor;
    if (typeof pushAIBrainTrace === 'function') pushAIBrainTrace(isLeft?'LEFT':'RIGHT', 'LIVE REASSIGN', `${oldActor.name} ETA ${actorEta.toFixed(1)}f -> ${actor.name} ${partnerEta.toFixed(1)}f`);
  }

  let skillNoise = 0;
  if (ball.isSineFloat) skillNoise = Math.sin(gameFrame * 0.25) * 45;
  if (ball.isPhantomDrop && ball.opacity < 0.2) {
    skillNoise = Math.sin(gameFrame * 0.4) * 55;
    actor.reactionTimer = Math.max(actor.reactionTimer, 12);
  }

  // V11：AI 跑位與 OUT 判斷使用角色自己的 Landing Read，不直接讀真實落點。
  const actorRead = (actor === pA) ? readA : readB;
  const ownSideline = isLeft ? WORLD.LEFT : WORLD.RIGHT;
  const outballUncertainty = Math.max(8, actor.stats.outballThreshold || 8);
  const perceivedLandingX = actorRead.x + skillNoise;
  const signedOutDistance = isLeft ? (WORLD.LEFT - perceivedLandingX) : (perceivedLandingX - WORLD.RIGHT);
  const obviousOutMargin = Math.max(18, outballUncertainty * 1.25);
  const isClearlyOut = signedOutDistance > obviousOutMargin;
  const isPerceivedOut = isClearlyOut || (isLeft ? (perceivedLandingX < WORLD.LEFT) : (perceivedLandingX > WORLD.RIGHT));

  // 一般來球：最後觸球者是對手，而且球已經進入我方半場。
  // 攔網觸球則不能只看 lastHitter：ONE TOUCH / 卸力後最後觸球者雖然是我方攔網手，
  // 球仍可能落回我方後場，這時我方必須救；ROOF / TOOL OUT 則可能回到攻擊方。
  // 因此 Block Return 以「預測落點落在哪一側」決定哪一隊需要處理，且左右完全鏡像共用。
  const lastTouchFromOpponent = !!ball.lastHitter && (ball.lastHitter.isLeft !== isLeft);
  const ballOnOurHalf = isLeft ? (ball.x <= WORLD.NET_X) : (ball.x >= WORLD.NET_X);
  const blockedBallTargetsLeft = realLandingX < WORLD.NET_X;
  const blockedBallTargetsOurSide = isLeft ? blockedBallTargetsLeft : !blockedBallTargetsLeft;
  // V54 場地中立活球（目前 UFO 拋回）：沒有 lastHitter 仍然是必須處理的 Rally 球。
  // 雙方 AI 依自己的 Landing Read 判斷責任區，不把 UFO 假冒成任何一隊的最後擊球者。
  const neutralBallTargetsOurSide = !!ball.venueNeutralLive && (isLeft ? realLandingX < WORLD.NET_X : realLandingX >= WORLD.NET_X);
  const isBallThreat = match.isBlockedBack
    ? blockedBallTargetsOurSide
    : (ball.venueNeutralLive ? neutralBallTargetsOurSide : (lastTouchFromOpponent && ballOnOurHalf));

  // 🌟 真人檢查：若執行者是真人，AI 大腦立刻物理退出，完全交給鍵盤/連線！
  const actorIsHuman = isSlotHumanControlled(actor);
  const partnerIsHuman = isSlotHumanControlled(partner);

  // V75-0: incoming opponent/blocked-back ball ALWAYS overrides stale offensive hit-count state.
  // Before the first new touch, match.leftHits/rightHits can still contain the previous possession's 1/2 hits.
  // Gating defense on teamHits===0 caused rare chance balls (especially non-3rd-touch J returns) to be treated as SET/ATTACK phases.
  if (isBallThreat) {
    if (typeof setAITeamIntent === 'function') setAITeamIntent(isLeft?'LEFT':'RIGHT', match.isBlockedBack?'COVER_CHASE':'RECEIVE_CHASE', actor, partner, perceivedLandingX, match.isBlockedBack?'BLOCK_RETURN':'INCOMING_OPPONENT', teamHits, 'THIRD_BALL_SAFETY');
    if (!actorIsHuman) {
      // V12 COVER READ：攔網反彈不是 AI 瞬間知道答案。
      // 第一次辨識到 blocked-back 時，用既有 reactionDelay / INT 產生短暫辨識延遲；
      // 真人仍完全手動，AI 只是在延遲結束後才允許尋路/接球。
      if (match.isBlockedBack) {
        if (actor._coverReadTouch !== match.lastTouchFrame) {
          actor._coverReadTouch = match.lastTouchFrame;
          const intVal = Math.max(0, Math.min(60, actor.stats.intellect || 0));
          const baseReact = Math.max(3, actor.stats.reactionDelay || 8);
          const coverDelay = Math.max(2, Math.round(baseReact * (1.05 - intVal / 120)));
          actor._coverReadUntil = gameFrame + coverDelay;
          if (typeof pushAIDebug === 'function') pushAIDebug(actor, 'COVER READ', `WAIT ${coverDelay}f`);
        }
        if (gameFrame < actor._coverReadUntil) return;
      }
      // 🦁 AI 施放【野蠻怒吼】判定
      if (actor.stats.skill.id === 'sk_savage_roar' && actor.energy >= actor.stats.skill.cost) {
        actor.consumeSkill('DEF_SAVE');
        playSound('time_freeze'); triggerScreenShake(8, 12);
        createShockwave(actor.x, actor.y - actor.radius, '#dc2626');
        pushCallout(actor.x, actor.y - 45, '野蠻怒吼 (SAVAGE ROAR)!!', '#dc2626');
        actor.excitedRallies = 4; actor.depressedRallies = 0; actor.roarMoodRallies = 4;
        partner.excitedRallies = 4; partner.depressedRallies = 0; partner.roarMoodRallies = 4;
        allPlayers.forEach(p => {
          if (p.isLeft !== isLeft) { p.depressedRallies = 4; p.excitedRallies = 0; p.roarMoodRallies = 4; }
        });
      }

      // OUT 不是單純看「會不會出界」，還要看最後觸球權。
      // 對手最後碰：OUT 可以放；我方攔網手最後碰：即使預測 OUT 仍必須追救。
      const canLetBallGoOut = lastTouchFromOpponent;

      // ⚡ V28 AI 雷霆瞬步：先做「值不值得救」判斷，再做技能判斷。
      // 對手最後碰且 AI 自己的 Landing Read 已判定明確 OUT 時，禁止為 Outball 浪費雷霆。
      // 這仍使用 AI 感知值 perceivedLandingX，不偷讀真實未來落點。
      const thunderWorthSaving = !(isPerceivedOut && canLetBallGoOut);
      if (thunderWorthSaving && typeof canExecuteRollingThunder === 'function' && canExecuteRollingThunder(actor)) {
        const dThunder = getDist(actor);
        const normalReach = Math.max(70, actor.stats.reach || 70);
        const floorEmergency = ball.vy > 0.1 && ball.y > WORLD.FLOOR_Y - 150;
        const cannotReachNormally = dThunder > normalReach;
        const coverEmergency = !!match.isBlockedBack;
        if ((cannotReachNormally && floorEmergency) || (coverEmergency && dThunder > normalReach * 0.8)) {
          if (executeRollingThunder(actor)) {
            if (typeof pushAIDebug === 'function') pushAIDebug(actor, 'ROLLING THUNDER', `SAVE d=${dThunder.toFixed(0)}`);
            return;
          }
        }
      }
      if (isPerceivedOut && canLetBallGoOut) {
        moveTowards(actor, isLeft ? WORLD.LEFT + 180 : WORLD.RIGHT - 180, actor.effectiveSpeed*(typeof venuePlayerSpeedFactor==='function'?venuePlayerSpeedFactor(actor):1));
        if (actor.recheckDelay <= 0) {
          pushCallout(actor.x, actor.y - actor.radius * 2, 'OUT!', '#facc15');
          actor.recheckDelay = Math.max(8, Math.round(26 - actor.stats.intellect * 0.35));
        }
      } else {
        if (actor.recheckDelay > 0 && !isPerceivedOut) {
          pushCallout(actor.x, actor.y - actor.radius * 2, 'Inside!', '#10b981');
          actor.recheckDelay = 0;
        }

        steerAIToFreshBallIntent(actor, perceivedLandingX, actor.effectiveSpeed*(typeof venuePlayerSpeedFactor==='function'?venuePlayerSpeedFactor(actor):1), match.lastTouchFrame, match.isBlockedBack?'COVER_CHASE':'RECEIVE_CHASE');
        const d = getDist(actor);
        const aiReach = actor.stats.reach || 64;

        // V75-2: owner first, action second. K / Dive / airborne Cover are mutually exclusive decisions
        // from the same live ball read, so we can debug exactly why an AI did or did not dive.
        const defenseDecision = chooseAIDefenseAction(actor, perceivedLandingX, framesToFloor, d, aiReach, match.isBlockedBack);
        traceAIDefenseDecision(actor, defenseDecision, framesToFloor, d, aiReach);

        if (defenseDecision.action === 'DIVE') {
          actor.facing = (perceivedLandingX > actor.x) ? 1 : -1;
          actor.dive();
        }

        const canTouch = (!isCooldown) && (ball.lastHitter !== actor || actor.hasBlockSelfHitPrivilege);
        if ((defenseDecision.action === 'K' || defenseDecision.action === 'AIR_COVER') && canTouch) {
          const wasBlocked = match.isBlockedBack;
          if (recordTouch(actor)) executePlayerTimingReceive(actor, wasBlocked, defenseDecision.action === 'AIR_COVER' ? 'AIR_COVER' : 'K');
        } else if (d > 165 && ball.y > WORLD.FLOOR_Y - 50 && actor.despairTimer <= 0) {
          const phrases = ['接不到！', '來不及了！', '啊！'];
          pushCallout(actor.x, actor.y - actor.radius * 2, phrases[Math.floor(Math.random() * phrases.length)], '#f87171');
          actor.despairTimer = 90;
        }
      }
    }

    if (!partnerIsHuman && partner.reactionTimer <= 0) {
      // V6：第一觸責任已經屬於 actor，partner 不再跟著來球追後場。
      // 用既有的預測落點與 PERFECT RECEIVE 目標，提前站到下一觸的支援區。
      // 只移動 AI controller；真人同隊時絕不替玩家下移動指令。
      const idealReceiveTargetX = isLeft ? (WORLD.NET_X - 120) : (WORLD.NET_X + 120);
      const supportPrepareX = realLandingX * 0.35 + idealReceiveTargetX * 0.65;
      const minSupportX = isLeft ? WORLD.LEFT + 90 : WORLD.NET_X + 90;
      const maxSupportX = isLeft ? WORLD.NET_X - 90 : WORLD.RIGHT - 90;
      const clampedSupportX = Math.max(minSupportX, Math.min(maxSupportX, supportPrepareX));
      moveTowards(partner, clampedSupportX, partner.effectiveSpeed);
    }
  } 
  else if (teamHits === 1) {
    const handler = (ball.lastHitter === pA) ? pB : pA;
    const spiker = (handler === pA) ? pB : pA;
    if (typeof setAITeamIntent === 'function') setAITeamIntent(isLeft?'LEFT':'RIGHT', 'SET_CHASE', handler, spiker, ball.x, 'TEAM_HIT_1', teamHits, 'THIRD_BALL_SAFETY');
    const handlerIsHuman = isSlotHumanControlled(handler);
    const spikerIsHuman = isSlotHumanControlled(spiker);

    if (!handlerIsHuman && handler.reactionTimer <= 0) {
      steerAIToFreshBallIntent(handler, ball.x, handler.effectiveSpeed, match.lastTouchFrame, 'SET_CHASE');

      // V15：二次進攻只看自己的球況 + 既有 INT/DEX，不讀對手防守站位。
      // 每次第一觸後只擲一次，避免逐幀重骰讓低機率變相成為必出。
      const secondTouchEpoch = match.lastTouchFrame;
      if (handler._secondAttackEpoch !== secondTouchEpoch) {
        handler._secondAttackEpoch = secondTouchEpoch;
        handler._secondAttackCommit = false;

        const distToNet2 = Math.abs(handler.x - WORLD.NET_X);
        const ballNearNet2 = Math.abs(ball.x - WORLD.NET_X) < 185;
        const attackHeight2 = ball.y > WORLD.NET_TOP_Y - 225 && ball.y < WORLD.NET_TOP_Y - 35;
        const playable2 = ballNearNet2 && distToNet2 < 210 && attackHeight2 && ball.vy > -2.5;
        let reason2 = 'SET DEFAULT';

        if (playable2) {
          const int2 = Math.max(0, Math.min(60, handler.stats.intellect || 0));
          const dex2 = Math.max(0, Math.min(60, (handler.stats.technique - 0.45) / 0.02));
          let chance2 = Math.max(0.06, Math.min(0.20,
            0.06 + (int2 / 60) * 0.09 + (dex2 / 60) * 0.05));
          if (handler.stats.skill.id === 'sk_phantom_drop' && handler.energy >= handler.stats.skill.cost) chance2 = Math.max(chance2, 0.32);
          handler._secondAttackCommit = Math.random() < chance2;
          reason2 = handler._secondAttackCommit
            ? `GOOD WINDOW <${(chance2 * 100).toFixed(0)}%`
            : `SET >=${(chance2 * 100).toFixed(0)}%`;
        } else if (!ballNearNet2 || distToNet2 >= 210) reason2 = 'TOO FAR FROM NET';
        else if (!attackHeight2) reason2 = 'CONTACT HEIGHT NG';
        else reason2 = 'BALL TIMING NG';

        if (typeof pushAIDebug === 'function') {
          pushAIDebug(handler, handler._secondAttackCommit ? '2ND ATTACK: YES' : '2ND ATTACK: NO', reason2);
        }
      }

      if (handler._secondAttackCommit) {
        // 決定偷二也不能作弊：自己跑、自己跳、自己進玩家 J 的實際擊球窗。
        handler.facing = isLeft ? 1 : -1;
        const distToNet2 = Math.abs(handler.x - WORLD.NET_X);
        const jumpWindow2 = ball.y > WORLD.NET_TOP_Y - 215 && ball.y < WORLD.NET_TOP_Y - 65 && ball.vy > -1.5;
        if (handler.isGrounded && distToNet2 < 210 && jumpWindow2 && Math.abs(handler.x - ball.x) < 82) {
          handler.jump();
        }

        if (!handler.isGrounded && !handler.isDiving && ball.lastHitter !== handler && !isCooldown) {
          const shoulderX2 = handler.x, shoulderY2 = handler.y - handler.radius * 1.5;
          const dx2 = (ball.x - shoulderX2) * handler.facing;
          const dy2 = -(ball.y - shoulderY2);
          if (dx2 >= -10 && dx2 <= 80 && Math.abs(dy2) <= 80) {
            if (typeof pushAIDebug === 'function') {
              pushAIDebug(handler, '2ND TOUCH: ATTACK', `J-window dx=${dx2.toFixed(0)} dy=${dy2.toFixed(0)}`);
            }
            // 幽靈吊球是二觸 L 技；AI 也必須走同一個 Human handler，不能另造物理。
            if (handler.stats.skill.id === 'sk_phantom_drop' && handler.energy >= handler.stats.skill.cost) handleUserThrust(handler);
            else handleUserAttack(handler);
          }
        }
      } else if (!handler.isDiving && getDist(handler) < 64 && ball.lastHitter !== handler && !isCooldown) {
        if (recordTouch(handler)) {
          if (handler.stats.skill.id === 'sk_chrono_spike' && handler.energy >= handler.stats.skill.cost) {
            handler.consumeSkill('SET_TACTIC');
            timeSlowTimer = 180; chronoCasterSide = isLeft ? 'player' : 'enemy'; chronoAnimTimer = 28;
            triggerScreenShake(6, 12); playSound('clock_tick');
            setTimeout(() => { playSound('time_freeze'); }, 180);
            pushCallout(handler.x, handler.y - handler.radius * 2, 'CHRONO SPIKE!!', '#ec4899');
          }
          if (handler.stats.skill.id === 'sk_godspeed_toss' && handler.energy >= handler.stats.skill.cost) {
            handler.consumeSkill('SET_TACTIC');
            handler.godspeedCharges = 3;
            pushCallout(handler.x, handler.y - 45, '神速二傳 (GODSPEED)!!', '#eab308');
          }
          if (typeof pushAIDebug === 'function') pushAIDebug(handler, '2ND TOUCH: SET', `dist=${getDist(handler).toFixed(1)}`);
          executeSetterPass(handler);
        }
      }
    }
    if (!spikerIsHuman && spiker.reactionTimer <= 0) {
      // V6：第三觸準備。不要固定站死在底線/網前；依第二觸者「現有力量能送到哪裡」準備。
      // 這不是新軌跡預測：只重用二傳目標、handler 位置與既有 power。
      const idealAttackX = isLeft ? (WORLD.NET_X - 120) : (WORLD.NET_X + 120);
      const handlerPower = handler.stats.power || 18.5;
      const expectedSetTravel = Math.max(250, Math.min(410, 250 + Math.max(0, handlerPower - 18.5) * 10.0));
      const desiredDelta = idealAttackX - handler.x;
      const reachableDelta = Math.max(-expectedSetTravel, Math.min(expectedSetTravel, desiredDelta));
      const expectedSetX = handler.x + reachableDelta;
      const attackPrepareX = expectedSetX + (isLeft ? -35 : 35);
      const minAttackX = isLeft ? WORLD.LEFT + 90 : WORLD.NET_X + 75;
      const maxAttackX = isLeft ? WORLD.NET_X - 75 : WORLD.RIGHT - 90;
      moveTowards(spiker, Math.max(minAttackX, Math.min(maxAttackX, attackPrepareX)), spiker.effectiveSpeed);
    }
  } 
  else if (teamHits === 2) {
    const spiker = (ball.lastHitter === pA) ? pB : pA;
    const supporter = (spiker === pA) ? pB : pA;
    if (typeof setAITeamIntent === 'function') setAITeamIntent(isLeft?'LEFT':'RIGHT', 'THIRD_TOUCH', spiker, supporter, ball.x, 'TEAM_HIT_2', teamHits, 'COVER_SUPPORT');
    const spikerIsHuman = isSlotHumanControlled(spiker);
    const supporterIsHuman = isSlotHumanControlled(supporter);

    if (!supporterIsHuman && supporter.reactionTimer <= 0) {
      moveTowards(supporter, spiker.x + (isLeft ? 30 : -30), supporter.effectiveSpeed);
    }

    if (!spikerIsHuman && spiker.reactionTimer <= 0) {
      moveTowards(spiker, ball.x, spiker.effectiveSpeed);
      const distToNet = Math.abs(spiker.x - WORLD.NET_X);
      const isNearNet = distToNet < 280;
      const sweetSpot = (ball.y > WORLD.NET_TOP_Y - 240 && ball.y < WORLD.NET_TOP_Y - 20 && ball.vy > 0);

      if (isNearNet && sweetSpot && spiker.isGrounded && Math.abs(spiker.x - ball.x) < 80) spiker.jump();

      if (!spiker.isDiving && getDist(spiker) < 70 && ball.lastHitter !== spiker && !isCooldown) {
        spiker.swingTimer = 12;
        if (recordTouch(spiker)) {
          proMatchStats[spiker.slotKey].totalSpikes++;
          ball.lastAttackHitter = spiker; ball.pointContext = null;
          ball.isTacticalThrust = false; ball.isTopspin = true;
          ball.topspinRating = spiker.stats.technique + ((spiker.stats.perks && spiker.stats.perks.topspinBonus) || 0);
          // V27: 先確認真正進入空中攻擊窗再扣技能能量，避免第三觸站地處理偷吃 SPIKE。
          let isAISkill = false;

          if (!spiker.isGrounded && isNearNet) {
            isAISkill = spiker.consumeSkill('SPIKE');
            const isApex = Math.abs(spiker.vy) < 2.5, facingDir = isLeft ? 1 : -1;
            const aiMomentum = (spiker.runMomentum / 25) * 3.8;
            const techFactor = 0.85 + (spiker.stats.technique * 0.25);
            let aiBasePower = (spiker.stats.power + aiMomentum) * techFactor;
            
            // ⚡ 神速二傳初速加成
            if (ball.hasTossedFromGodspeed) {
              aiBasePower += 4.0;
              ball.hasTossedFromGodspeed = false;
              createImpactSparks(ball.x, ball.y, 14, '#eab308');
            }

            // 🌟 尋找敵方前排封網者
            const oppFront = isLeft ? enemyA : allPlayers[NET.mySlot || 0];
            const isOpponentBlocking = oppFront && oppFront.isBlocking && Math.abs(oppFront.x - WORLD.NET_X) < 110;

            // V12 THIRD-TOUCH CHOICE：不新增角色定位，只用既有 INT/DEX/球況調整既有攻擊選擇。
            // POWER / STEEP / DEEP 都是原本已存在的出球；這裡只把「何時選哪個」從固定 if 改成權重。
            const intVal = Math.max(0, Math.min(60, spiker.stats.intellect || 0));
            const dexVal = Math.max(0, Math.min(60, (spiker.stats.technique - 0.45) / 0.02));
            const iq = intVal / 60;
            const dexRead = Math.max(0, Math.min(1, dexVal / 60));

            let powerW = 1.00;
            let steepW = isApex ? (0.55 + iq * 0.55) : 0.18;
            let deepW = 0.42 + iq * 0.30;

            if (distToNet < 135 && isApex) steepW += 0.65;
            if (distToNet >= 180) deepW += 0.90;
            if (isOpponentBlocking) {
              // 看見攔網後，高 INT 比較願意改打深；低 INT 仍可能照原節奏硬打。
              deepW += 0.35 + iq * 0.95;
              powerW -= iq * 0.28;
              steepW -= iq * 0.18;
            }
            // DEX/technique 高：更願意選需要控制的角度球；不是增加新招式。
            deepW += dexRead * 0.22;
            steepW += dexRead * 0.18;

            powerW = Math.max(0.12, powerW);
            steepW = Math.max(0.08, steepW);
            deepW = Math.max(0.08, deepW);
            const totalW = powerW + steepW + deepW;
            let roll = Math.random() * totalW;
            let intent = 'POWER';
            if (roll < powerW) intent = 'POWER';
            else if ((roll -= powerW) < steepW) intent = 'STEEP';
            else intent = 'DEEP';
            if (typeof pushAIDebug === 'function') {
              pushAIDebug(spiker, `3RD TOUCH: ${intent}`,
                `P=${powerW.toFixed(2)} S=${steepW.toFixed(2)} D=${deepW.toFixed(2)} block=${isOpponentBlocking ? 'Y' : 'N'} apex=${isApex ? 'Y' : 'N'}`);
            }

            const skillPrecision = Math.max(0.08, 0.45 - (spiker.stats.intellect * 0.006) - (spiker.stats.technique * 0.15));
            const angleScatter = (Math.random() - 0.5) * skillPrecision * 5.0;

            if (isAISkill) {
              const sk = spiker.stats.skill;
              ball.vx = facingDir * (aiBasePower * (sk.speedMult || 1.12)); ball.vy = 13.5;
              ball.isSpiked = true; ball.isPerfectSpike = true; ball.isUltimate = true;
              ball.armorPiercing = (sk.armorPiercing || 0) + (spiker.stats.bonusAP || 0); ball.topspinRating += (sk.extraDown || 0); ball.activeSkillTag = sk.name;
              ball.glowColor = sk.glowColor || '#ef4444';

              if (sk.id === 'sk_breaker') { ball.vx *= 1.03; ball.vy = 10.5; ball.armorPiercing += 5.0; ball.breakerSourceIsLeft=spiker.isLeft; ball.breakerImpactDone=false; ball.breakerTrailFrames=90; }
              if (sk.id === 'sk_deep_impact') { ball.vx *= 1.16; ball.vy = 4.8; ball.deepWaterActive = true; }
              if (sk.id === 'sk_steepexec') { ball.vx *= 0.82; ball.vy = 18.5; }
              if (sk.id === 'sk_bungee_gum') ball.isBungeeGum = true;
              if (sk.id === 'sk_gravity_drop') {
                ball.isGravityDrop = true; ball.gravityDropTriggered = false;
                const halfSpan = WORLD.RIGHT - WORLD.NET_X;
                ball.gravityDropTargetX = isLeft ? WORLD.NET_X + halfSpan * (0.10 + Math.random() * 0.80) : WORLD.NET_X - halfSpan * (0.10 + Math.random() * 0.80);
              }
              if (sk.id === 'sk_greased_ball') { ball.greaseCharges = 1; ball.greaseSourceIsLeft = spiker.isLeft; }
              if (sk.id === 'sk_mud_spike') { ball.mudContaminationAvailable = true; ball.mudCharges = 2; ball.mudSourceIsLeft = spiker.isLeft; }
              if (sk.id === 'sk_time_lag') { ball.timeLagStoredVx = ball.vx; ball.timeLagStoredVy = ball.vy; ball.timeLagFrames = 24; ball.vx = 0; ball.vy = 0; ball.timeLagVfxSeed = Math.random()*1000; playSkillAsset('SFX/skills/time_1.wav',1.0,{key:'time_lag_hold'}); }

              if (sk.id !== 'sk_time_lag') playSound('perfect_spike'); triggerScreenShake(10, 10);
              createImpactSparks(ball.x, ball.y, 18, isLeft ? '#38bdf8' : '#f43f5e');
              pushCallout(spiker.x, spiker.y - spiker.radius * 2, `${sk.name}!!`, ball.glowColor);
            } else if (intent === 'STEEP') {
              ball.vx = facingDir * (aiBasePower * 0.85); ball.vy = 14.5 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = true; ball.armorPiercing = (spiker.stats.bonusAP || 0); ball.glowColor = null;
              playSound('perfect_spike'); triggerScreenShake(8, 9);
              createImpactSparks(ball.x, ball.y, 14, isLeft ? '#38bdf8' : '#f43f5e');
            } else if (intent === 'POWER') {
              ball.vx = facingDir * (aiBasePower * 1.05); ball.vy = 9.5 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = isApex; ball.armorPiercing = (spiker.stats.bonusAP || 0); ball.glowColor = null;
              if (isApex) playSound('perfect_spike'); else playSound('spike');
            } else {
              ball.vx = facingDir * (aiBasePower * 1.15); ball.vy = 6.2 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = false; ball.armorPiercing = (spiker.stats.bonusAP || 0); ball.glowColor = null; playSound('spike');
            }
          } else {
            const randomScatter = (Math.random() - 0.5) * 80;
            const targetCrossX = (isLeft ? WORLD.RIGHT - 220 : WORLD.LEFT + 220) + randomScatter;
            const targetVy = -11.0;
            const timeInAir = (2 * Math.abs(targetVy)) / (WORLD.GRAVITY * 0.72);
            ball.vx = (targetCrossX - ball.x) / timeInAir; ball.vy = targetVy;
            ball.isSpiked = false; ball.isPerfectSpike = false; ball.isUltimate = false;
            ball.armorPiercing = 0; ball.isTopspin = false; ball.glowColor = null; playSound('bump');
          }
          ball.isFloat = false;
          const curSpd = Math.hypot(ball.vx, ball.vy);
          if (curSpd > proMatchStats[spiker.slotKey].maxSpeed) proMatchStats[spiker.slotKey].maxSpeed = curSpd;
        }
      }
    }
  }

  // V75-0 lightweight anomaly detector: emits breadcrumbs instead of silently failing.
  if (typeof flagAIBug === 'function' && isBallThreat && framesToFloor <= 42) {
    const side = isLeft ? 'LEFT' : 'RIGHT';
    const state = (typeof aiTeamIntentState !== 'undefined') ? aiTeamIntentState[side] : null;
    if (!state || gameFrame - state.frame > 2) flagAIBug(side, 'NO_FRESH_INTENT', `floor=${framesToFloor}f hits=${teamHits}`);
    const bothFar = Math.min(Math.abs(pA.x-realLandingX), Math.abs(pB.x-realLandingX)) > 260;
    if (bothFar && framesToFloor <= 24) flagAIBug(side, 'LATE_TO_CHANCE', `landing=${realLandingX.toFixed(0)} floor=${framesToFloor}f`);
    if (state && state.ownerKey) {
      const owner = [pA,pB].find(p => (p.slotKey||`slot${p.slotIndex}`) === state.ownerKey);
      const other = owner===pA?pB:pA;
      if (owner && other) {
        const oe = estimateAIChaseFrames(owner, realLandingX);
        const pe = estimateAIChaseFrames(other, realLandingX);
        if (oe > framesToFloor + 5 && pe + 8 < oe) flagAIBug(side, 'OWNER_LATE', `${owner.name} ${oe.toFixed(1)}f / ${other.name} ${pe.toFixed(1)}f / floor ${framesToFloor}f`);
      }
    }
  }
}

function updateBlockAI() {
  if (match.inServeRally) return;

  // 左半場防守 AI（敵方進攻時）
  if (ball.x < WORLD.NET_X && match.leftHits >= 1) {
    const leftAttacker = (Math.hypot(userPlayer.x - ball.x, userPlayer.y - ball.y) <= Math.hypot(mateAI.x - ball.x, mateAI.y - ball.y)) ? userPlayer : mateAI;
    const distA = Math.abs(enemyA.x - WORLD.NET_X), distB = Math.abs(enemyB.x - WORLD.NET_X);
    const blocker = (distA <= distB) ? enemyA : enemyB;
    const defender = (blocker === enemyA) ? enemyB : enemyA;

    // 🌟 只有純電腦才能執行 AI 自動貼網起跳開盾！
    if (!isSlotHumanControlled(blocker)) {
      moveTowards(blocker, WORLD.NET_X + 42, blocker.effectiveSpeed);
      const inZone = Math.abs(blocker.x - WORLD.NET_X) < 95;
      const attackerIsAirborne = !leftAttacker.isGrounded && leftAttacker.y < WORLD.NET_TOP_Y + 55;
      const isDirectAttack = (ball.vx > 13.0 && ball.x > WORLD.NET_X - 120);
      if (inZone && blocker.isGrounded && (attackerIsAirborne || isDirectAttack)) {
        if (blocker.stats.skill.id === 'sk_soft_wall' && blocker.energy >= blocker.stats.skill.cost) {
          blocker.consumeSkill('BLOCK_STANCE');
          blocker.softWallRallies = 3;
          pushCallout(blocker.x, blocker.y - 45, '引力柔網!!', '#2dd4bf');
        }
        blocker.jump(); blocker.triggerBlock();
      }
    }

    if (!isSlotHumanControlled(defender)) {
      moveTowards(defender, WORLD.RIGHT - 180, defender.effectiveSpeed);
    }
  }

  // 右半場防守 AI（我方進攻時）
  if (ball.x > WORLD.NET_X && match.rightHits >= 1) {
    const userDistToNet = Math.abs(userPlayer.x - WORLD.NET_X);
    const mateDistToNet = Math.abs(mateAI.x - WORLD.NET_X);

    if (mateDistToNet <= userDistToNet && !isSlotHumanControlled(mateAI)) {
      moveTowards(mateAI, WORLD.NET_X - 42, mateAI.effectiveSpeed);
      const inZone = Math.abs(mateAI.x - WORLD.NET_X) < 95;
      const rightAttackerAir = (!enemyA.isGrounded && enemyA.y < WORLD.NET_TOP_Y + 55) || (!enemyB.isGrounded && enemyB.y < WORLD.NET_TOP_Y + 55);
      const isDirectAttack = (ball.vx < -13.0 && ball.x < WORLD.NET_X + 120);
      if (inZone && mateAI.isGrounded && (rightAttackerAir || isDirectAttack)) {
        if (mateAI.stats.skill.id === 'sk_soft_wall' && mateAI.energy >= mateAI.stats.skill.cost) {
          mateAI.consumeSkill('BLOCK_STANCE');
          mateAI.softWallRallies = 3;
          pushCallout(mateAI.x, mateAI.y - 45, '引力柔網!!', '#2dd4bf');
        }
        mateAI.jump(); mateAI.triggerBlock();
      }
    }
  }
}