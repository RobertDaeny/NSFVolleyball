// ========================================================
// AI 戰術決策層：拋物線落點預判、三觸分配、智慧封網與新技能施放
// ========================================================
function runTeamBrain(pA, pB, teamHits, baseNetX, isLeft) {
  const isCooldown = (gameFrame - match.lastTouchFrame) < 18;
  let realLandingX = ball.x;
  if ((isLeft && ball.vx < -0.8) || (!isLeft && ball.vx > 0.8)) {
    const distToFloor = Math.max(0, WORLD.FLOOR_Y - ball.y);
    const timeToFloor = Math.max(3, distToFloor / Math.max(3, ball.vy + 4));
    realLandingX = ball.x + (ball.vx * timeToFloor);
  }

  const timeA = Math.hypot(pA.x - realLandingX, pA.y - WORLD.FLOOR_Y) / pA.effectiveSpeed;
  const timeB = Math.hypot(pB.x - realLandingX, pB.y - WORLD.FLOOR_Y) / pB.effectiveSpeed;
  const actor = (timeA <= timeB) ? pA : pB;
  const partner = (actor === pA) ? pB : pA;

  if (actor.reactionTimer > 0) return;

  let skillNoise = 0;
  if (ball.isSineFloat) skillNoise = Math.sin(gameFrame * 0.25) * 45;
  if (ball.isPhantomDrop && ball.opacity < 0.2) {
    skillNoise = Math.sin(gameFrame * 0.4) * 55;
    actor.reactionTimer = Math.max(actor.reactionTimer, 12);
  }

  const intelNoise = (Math.sin(gameFrame * 0.1) * actor.stats.outballThreshold) + skillNoise;
  const perceivedLandingX = realLandingX + intelNoise;
  const isPerceivedOut = isLeft ? (perceivedLandingX < WORLD.LEFT) : (perceivedLandingX > WORLD.RIGHT);
  const isBallThreat = (isLeft ? ball.vx <= 0 : ball.vx >= 0) && (ball.vy > 0.1 || match.isBlockedBack);

  if (isBallThreat && (teamHits === 0 || match.isBlockedBack)) {
    if (!actor.isUser) {
      // 🦁 AI 施放【野蠻怒吼】判定
      if (actor.stats.skill.id === 'sk_savage_roar' && actor.energy >= actor.stats.skill.cost) {
        actor.consumeSkill('DEF_SAVE');
        playSound('time_freeze'); triggerScreenShake(8, 12);
        createShockwave(actor.x, actor.y - actor.radius, '#dc2626');
        pushCallout(actor.x, actor.y - 45, '野蠻怒吼 (SAVAGE ROAR)!!', '#dc2626');
        actor.excitedRallies = 3; partner.excitedRallies = 3;
        const opps = isLeft ? [enemyA, enemyB] : [userPlayer, mateAI];
        opps.forEach(op => op.depressedRallies = 3);
      }

      // ⚡ AI 施放【雷霆瞬步】判定
      const isBallInCourt = isLeft ? (ball.x <= WORLD.NET_X - 10) : (ball.x >= WORLD.NET_X + 10);
      const isActorThunder = (actor.stats.skill.id === 'sk_rolling_thunder') && (actor.energy >= actor.stats.skill.cost);
      if (isActorThunder && isBallInCourt && ball.y > 260 && ball.y < WORLD.FLOOR_Y - 20) {
        actor.consumeSkill('DEF_SAVE');
        createImpactSparks(actor.x, actor.y - actor.radius, 14, '#38bdf8');
        actor.x = Math.max(isLeft ? WORLD.LEFT + 30 : WORLD.NET_X + 30, Math.min(isLeft ? WORLD.NET_X - 40 : WORLD.RIGHT - 30, ball.x - (actor.facing * 8)));
        actor.y = WORLD.FLOOR_Y; actor.isGrounded = true; actor.vx = 0; actor.vy = 0;
        playSound('teleport');
        pushCallout(actor.x, actor.y - actor.radius * 2, 'ROLLING THUNDER!!', '#38bdf8');
        ball.x = actor.x + (actor.facing * 12); ball.y = actor.y - actor.radius * 1.2; ball.vx = 0; ball.vy = 0;
        if (recordTouch(actor)) executePlayerTimingReceive(actor, false);
        return;
      }

      if (isPerceivedOut && !match.isBlockedBack && Math.abs(realLandingX - (isLeft ? WORLD.LEFT : WORLD.RIGHT)) > 30) {
        moveTowards(actor, isLeft ? WORLD.LEFT + 180 : WORLD.RIGHT - 180, actor.effectiveSpeed);
        if (actor.recheckDelay <= 0) {
          pushCallout(actor.x, actor.y - actor.radius * 2, 'OUT!', '#facc15');
          actor.recheckDelay = Math.max(8, Math.round(26 - actor.stats.intellect * 0.35));
        }
      } else {
        if (actor.recheckDelay > 0 && Math.abs(realLandingX - (isLeft ? WORLD.LEFT : WORLD.RIGHT)) <= 30) {
          pushCallout(actor.x, actor.y - actor.radius * 2, 'Inside!', '#10b981');
          actor.recheckDelay = 0;
        }

        moveTowards(actor, perceivedLandingX, actor.effectiveSpeed);
        const d = getDist(actor);
        const isEmergencyFloor = ball.y > WORLD.FLOOR_Y - 70 && ball.vy > 1.2;
        const isTooFarToRun = d > 75 && d < 160;

        if (!actor.isBlocking && !actor.isDiving && isEmergencyFloor && isTooFarToRun) {
          actor.facing = (realLandingX > actor.x) ? 1 : -1; actor.dive();
        }

        const canTouch = (!isCooldown || match.isBlockedBack) && (ball.lastHitter !== actor || actor.hasBlockSelfHitPrivilege);
        const isBlockerInAir = !actor.isGrounded && Math.abs(actor.jumpStartX - WORLD.NET_X) < 95;

        if (!actor.isDiving && !isBlockerInAir && !actor.isBlocking && actor.isGrounded && d < 64 && canTouch) {
          const wasBlocked = match.isBlockedBack;
          if (recordTouch(actor)) executePlayerTimingReceive(actor, wasBlocked);
        } else if (d > 165 && ball.y > WORLD.FLOOR_Y - 50 && actor.despairTimer <= 0) {
          const phrases = ['接不到！', '來不及了！', '啊！'];
          pushCallout(actor.x, actor.y - actor.radius * 2, phrases[Math.floor(Math.random() * phrases.length)], '#f87171');
          actor.despairTimer = 90;
        }
      }
    }

    if (!partner.isUser && partner.reactionTimer <= 0) {
      const isBallExtremelyDeep = (isLeft && ball.x < WORLD.LEFT - 120) || (!isLeft && ball.x > WORLD.RIGHT + 120);
      const defensiveHomeX = isBallExtremelyDeep ? (isLeft ? WORLD.LEFT + 320 : WORLD.RIGHT - 320) : (isLeft ? WORLD.NET_X - 260 : WORLD.NET_X + 260);
      moveTowards(partner, defensiveHomeX, partner.effectiveSpeed);
    }
  } 
  else if (teamHits === 1) {
    const handler = (ball.lastHitter === pA) ? pB : pA;
    const spiker = (handler === pA) ? pB : pA;

    if (!handler.isUser && handler.reactionTimer <= 0) {
      moveTowards(handler, ball.x, handler.effectiveSpeed);
      if (!handler.isDiving && getDist(handler) < 64 && ball.lastHitter !== handler && !isCooldown) {
        if (recordTouch(handler)) {
          // ⏳ AI 施放【時流差】判定
          if (handler.stats.skill.id === 'sk_chrono_spike' && handler.energy >= handler.stats.skill.cost) {
            handler.consumeSkill('SET_TACTIC');
            timeSlowTimer = 180; chronoCasterSide = isLeft ? 'player' : 'enemy'; chronoAnimTimer = 28;
            triggerScreenShake(6, 12); playSound('clock_tick');
            setTimeout(() => { playSound('time_freeze'); }, 180);
            pushCallout(handler.x, handler.y - handler.radius * 2, 'CHRONO SPIKE!!', '#ec4899');
          }
          // ⚡ AI 施放【神速二傳】判定
          if (handler.stats.skill.id === 'sk_godspeed_toss' && handler.energy >= handler.stats.skill.cost) {
            handler.consumeSkill('SET_TACTIC');
            handler.godspeedCharges = 3;
            pushCallout(handler.x, handler.y - 45, '神速二傳 (GODSPEED)!!', '#eab308');
          }
          executeSetterPass(handler);
        }
      }
    }
    if (!spiker.isUser && spiker.reactionTimer <= 0) {
      moveTowards(spiker, isLeft ? (WORLD.NET_X - 180) : (WORLD.NET_X + 180), spiker.effectiveSpeed);
    }
  } 
  else if (teamHits === 2) {
    const spiker = (ball.lastHitter === pA) ? pB : pA;
    const supporter = (spiker === pA) ? pB : pA;

    if (!supporter.isUser && supporter.reactionTimer <= 0) {
      moveTowards(supporter, spiker.x + (isLeft ? 30 : -30), supporter.effectiveSpeed);
    }

    if (!spiker.isUser && spiker.reactionTimer <= 0) {
      moveTowards(spiker, ball.x, spiker.effectiveSpeed);
      const distToNet = Math.abs(spiker.x - WORLD.NET_X);
      const isNearNet = distToNet < 280;
      const sweetSpot = (ball.y > WORLD.NET_TOP_Y - 240 && ball.y < WORLD.NET_TOP_Y - 20 && ball.vy > 0);

      if (isNearNet && sweetSpot && spiker.isGrounded && Math.abs(spiker.x - ball.x) < 80) spiker.jump();

      if (!spiker.isDiving && getDist(spiker) < 70 && ball.lastHitter !== spiker && !isCooldown) {
        spiker.swingTimer = 12;
        if (recordTouch(spiker)) {
          proMatchStats[spiker.slotKey].totalSpikes++;
          ball.isTacticalThrust = false; ball.isTopspin = true;
          ball.topspinRating = spiker.stats.technique;
          const isAISkill = spiker.consumeSkill('SPIKE');

          if (!spiker.isGrounded && isNearNet) {
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

            const oppFront = isLeft ? enemyA : userPlayer;
            const isOpponentBlocking = oppFront.isBlocking && Math.abs(oppFront.x - WORLD.NET_X) < 110;

            let intent = 'POWER';
            if (distToNet < 130 && isApex) {
              intent = (isOpponentBlocking && Math.random() < (spiker.stats.intellect * 0.02)) ? 'DEEP' : 'STEEP';
            } else if (distToNet >= 180) {
              intent = 'DEEP';
            }

            const skillPrecision = Math.max(0.08, 0.45 - (spiker.stats.intellect * 0.006) - (spiker.stats.technique * 0.15));
            const angleScatter = (Math.random() - 0.5) * skillPrecision * 5.0;

            if (isAISkill) {
              const sk = spiker.stats.skill;
              ball.vx = facingDir * (aiBasePower * (sk.speedMult || 1.12)); ball.vy = 13.5;
              ball.isSpiked = true; ball.isPerfectSpike = true; ball.isUltimate = true;
              ball.armorPiercing = sk.armorPiercing || 0; ball.activeSkillTag = sk.name;
              ball.glowColor = sk.glowColor || '#ef4444';

              // 🌟 觸發特定專屬技能狀態
              if (sk.id === 'sk_bungee_gum') ball.isBungeeGum = true;
              if (sk.id === 'sk_gravity_drop') { ball.isGravityDrop = true; ball.vy = 2.0; }
              if (sk.id === 'sk_greased_ball') ball.greaseCharges = 2;

              playSound('perfect_spike'); triggerScreenShake(10, 10);
              createImpactSparks(ball.x, ball.y, 18, isLeft ? '#38bdf8' : '#f43f5e');
              pushCallout(spiker.x, spiker.y - spiker.radius * 2, `${sk.name}!!`, ball.glowColor);
            } else if (intent === 'STEEP') {
              ball.vx = facingDir * (aiBasePower * 0.85); ball.vy = 14.5 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = true; ball.glowColor = null;
              playSound('perfect_spike'); triggerScreenShake(8, 9);
              createImpactSparks(ball.x, ball.y, 14, isLeft ? '#38bdf8' : '#f43f5e');
            } else if (intent === 'POWER') {
              ball.vx = facingDir * (aiBasePower * 1.05); ball.vy = 9.5 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = isApex; ball.glowColor = null;
              if (isApex) playSound('perfect_spike'); else playSound('spike');
            } else {
              ball.vx = facingDir * (aiBasePower * 1.15); ball.vy = 6.2 + angleScatter;
              ball.isSpiked = true; ball.isPerfectSpike = false; ball.glowColor = null; playSound('spike');
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
}

function updateBlockAI() {
  if (match.inServeRally) return;

  if (ball.x < WORLD.NET_X && match.leftHits >= 1) {
    const distUser = Math.hypot(userPlayer.x - ball.x, userPlayer.y - ball.y);
    const distMate = Math.hypot(mateAI.x - ball.x, mateAI.y - ball.y);
    const leftAttacker = (distUser <= distMate) ? userPlayer : mateAI;
    const distA = Math.abs(enemyA.x - WORLD.NET_X), distB = Math.abs(enemyB.x - WORLD.NET_X);
    const blocker = (distA <= distB) ? enemyA : enemyB;
    const defender = (blocker === enemyA) ? enemyB : enemyA;

    moveTowards(blocker, WORLD.NET_X + 42, blocker.effectiveSpeed);
    moveTowards(defender, WORLD.RIGHT - 180, defender.effectiveSpeed);

    const inZone = Math.abs(blocker.x - WORLD.NET_X) < 95;
    const attackerIsAirborne = !leftAttacker.isGrounded && leftAttacker.y < WORLD.NET_TOP_Y + 55;
    const isDirectAttack = (ball.vx > 13.0 && ball.x > WORLD.NET_X - 120);
    if (inZone && blocker.isGrounded && (attackerIsAirborne || isDirectAttack)) {
      // 🧱 AI 施放【引力柔網】判定
      if (blocker.stats.skill.id === 'sk_soft_wall' && blocker.energy >= blocker.stats.skill.cost) {
        blocker.consumeSkill('BLOCK_STANCE');
        blocker.softWallRallies = 3;
        pushCallout(blocker.x, blocker.y - 45, '引力柔網 (SOFT WALL)!!', '#2dd4bf');
      }
      blocker.jump(); blocker.triggerBlock();
    }
  }

  if (ball.x > WORLD.NET_X && match.rightHits >= 1) {
    const userDistToNet = Math.abs(userPlayer.x - WORLD.NET_X);
    const mateDistToNet = Math.abs(mateAI.x - WORLD.NET_X);

    if (mateDistToNet <= userDistToNet) {
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