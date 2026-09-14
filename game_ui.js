// ========================================================
// UI 與動態彈窗系統：更衣室、紙娃娃化妝間、轉蛋大街、結算
// ========================================================
let currentSlot = 'user', stagedCard = null;

function initStagedCard() {
  const origin = ACTIVE_ROSTER[currentSlot];
  stagedCard = { id: origin.id, freePts: origin.freePts, stats: { ...origin.stats } };
}

function renderLocker() {
  const tabs = document.getElementById('roster-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  const slotLabels = { user: '球員 1 (主控)', mate: '球員 2 (搭檔)', enemyFront: '敵方 1', enemyBack: '敵方 2' };

  const visibleSlots = isCareerMode ? ['user', 'mate'] : ['user', 'mate', 'enemyFront', 'enemyBack'];
  if (!visibleSlots.includes(currentSlot)) currentSlot = 'user';

  visibleSlots.forEach(key => {
    const tab = document.createElement('div');
    tab.className = `roster-tab ${key === currentSlot ? 'active' : ''}`;
    tab.innerText = `${slotLabels[key]}: ${ACTIVE_ROSTER[key].name}`;
    tab.onclick = () => { currentSlot = key; initStagedCard(); renderLocker(); };
    tabs.appendChild(tab);
  });

  const origin = ACTIVE_ROSTER[currentSlot];
  document.getElementById('card-name').innerText = origin.name;
  document.getElementById('card-desc').innerText = `等級: Lv.${origin.level} (${origin.tier} 卡)`;
  document.getElementById('card-avatar').style.backgroundColor = origin.color;
  document.getElementById('card-exp').innerText = `EXP: ${origin.exp} / ${getRequiredExp(origin.level)}`;
  document.getElementById('free-pts-display').innerText = stagedCard.freePts;

  const skillSel = document.getElementById('skill-select');
  skillSel.innerHTML = '';
  SKILL_POOL.forEach(sk => {
    const isUnlocked = Array.isArray(UNLOCKED_SKILLS) ? UNLOCKED_SKILLS.includes(sk.id) : (sk.id === 'sk_breaker');
    if (isUnlocked || origin.equippedSkill === sk.id) {
      const opt = document.createElement('option');
      opt.value = sk.id; opt.innerText = `[${sk.type}] ${sk.name} (Cost: ${sk.cost})`;
      if (origin.equippedSkill === sk.id) opt.selected = true;
      skillSel.appendChild(opt);
    }
  });
  skillSel.disabled = isGameStarted;
  const currentEquippedSkill = SKILL_POOL.find(s => s.id === origin.equippedSkill) || SKILL_POOL[0];
  document.getElementById('skill-card-desc').innerText = isGameStarted ? '⚠️ 比賽進行中，鎖定更換技能！' : currentEquippedSkill.desc;

  const tierWeight = { SSR: 4, SR: 3, R: 2, N: 1 };
  const sortedInventory = [...INVENTORY].sort((a, b) => {
    if (tierWeight[b.tier] !== tierWeight[a.tier]) return tierWeight[b.tier] - tierWeight[a.tier];
    return b.level - a.level;
  });

  const assignedIds = Object.values(ACTIVE_ROSTER).map(c => c.id);
  const sel = document.getElementById('bench-select');
  sel.innerHTML = '';
  sortedInventory.forEach(item => {
    const isEquippedElsewhere = assignedIds.includes(item.id) && item.id !== origin.id;
    const opt = document.createElement('option');
    opt.value = item.id; opt.disabled = isEquippedElsewhere;
    opt.innerText = `[${item.tier}] ${item.name} (Lv.${item.level})${isEquippedElsewhere ? ' [場上已出場]' : ''}`;
    if (item.id === origin.id) opt.selected = true;
    sel.appendChild(opt);
  });

  const mount = document.getElementById('stats-mount');
  mount.innerHTML = '';
  const statMeta = {
    str: { label: '力量 (STR)', desc: '直接驅動扣球與跳發出膛初速、穿透攔網剛性。' },
    agi: { label: '敏捷 (AGI)', desc: '直接驅動場上橫移奔跑速度、地面魚躍撲救距離與防守轉向反應！' },
    jump: { label: '彈跳 (JUMP)', desc: '決定空中摸高打擊點、起跳滯空時間與前排封網天花板高度。' },
    dex: { label: '技巧 (DEX)', desc: '驅動扣殺與跳發的馬格努斯下旋加速度、跳飄氣流晃動與完美接球半徑。' },
    int: { label: '球商 (INT)', desc: '決定 AI 進攻意圖抉擇、出界放球反悔延遲與心態 Debuff 抵抗力。' }
  };

  for (let k in stagedCard.stats) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const currentVal = stagedCard.stats[k], baseVal = origin.baseStats[k];
    row.innerHTML = `
      <span>${statMeta[k].label} <small style="color:#94a3b8;">(${baseVal})</small></span>
      <div class="stat-tooltip">${statMeta[k].desc}</div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button class="stat-btn" onclick="adjustStagedStat('${k}', -1)" ${currentVal <= baseVal ? 'disabled' : ''}>-</button>
        <strong style="width: 24px; text-align: center; color: ${currentVal > baseVal ? '#facc15' : '#fff'};">${currentVal}</strong>
        <button class="stat-btn" onclick="adjustStagedStat('${k}', 1)" ${stagedCard.freePts <= 0 || currentVal >= 60 ? 'disabled' : ''}>+</button>
      </div>
    `;
    mount.appendChild(row);
  }

  const tempCard = { stats: stagedCard.stats, equippedSkill: origin.equippedSkill };
  const derived = deriveStats(tempCard);
  const derivedMount = document.getElementById('derived-mount');
  derivedMount.innerHTML = `
    <div class="stat-derived-row"><span>🏃 實時奔跑速度 (Run Speed)</span><strong style="color: #38bdf8;">${derived.speed.toFixed(2)} px/f</strong></div>
    <div class="stat-derived-row"><span>💥 扣球攻擊力 (Spike Atk)</span><strong style="color: #ef4444;">${derived.power.toFixed(1)}</strong></div>
    <div class="stat-derived-row"><span>🛡️ 防守卸力值 (Defense)</span><strong style="color: #10b981;">${derived.defense.toFixed(1)}</strong></div>
    <div class="stat-derived-row"><span>🧱 攔網手型剛性 (Block Guard)</span><strong style="color: #facc15;">${derived.blockRigidity.toFixed(1)}</strong></div>
    <div class="stat-derived-row"><span>🎯 完美起球半徑 (Sweet Spot)</span><strong style="color: #a78bfa;">${derived.sweetWindow} px</strong></div>
    <div class="stat-derived-row"><span>⚡ 神經反應延遲 (Reaction)</span><strong style="color: #f472b6;">${derived.reactionDelay} 幀</strong></div>
  `;
}

function equipSkillToActivePlayer(skillId) {
  const origin = ACTIVE_ROSTER[currentSlot];
  origin.equippedSkill = skillId;
  const sk = SKILL_POOL.find(s => s.id === skillId);
  if (sk) document.getElementById('skill-card-desc').innerText = sk.desc;
  if (typeof allPlayers !== 'undefined') allPlayers.forEach(p => p.rebind(true));
  saveGameData();
}

function adjustStagedStat(key, delta) {
  const origin = ACTIVE_ROSTER[currentSlot];
  if (delta > 0 && stagedCard.freePts > 0 && stagedCard.stats[key] < 60) {
    stagedCard.stats[key]++; stagedCard.freePts--;
  } else if (delta < 0 && stagedCard.stats[key] > origin.baseStats[key]) {
    stagedCard.stats[key]--; stagedCard.freePts++;
  }
  renderLocker();
}

function rollStagedStats() {
  const origin = ACTIVE_ROSTER[currentSlot];
  const pool = stagedCard.freePts + (Object.values(stagedCard.stats).reduce((a, b) => a + b, 0) - Object.values(origin.baseStats).reduce((a, b) => a + b, 0));
  for (let k in stagedCard.stats) stagedCard.stats[k] = origin.baseStats[k];
  let rem = pool;
  const keys = ['str', 'agi', 'jump', 'dex', 'int'];
  while (rem > 0) {
    const rk = keys[Math.floor(Math.random() * keys.length)];
    if (stagedCard.stats[rk] < 60) { stagedCard.stats[rk]++; rem--; }
  }
  stagedCard.freePts = 0; renderLocker();
}

function resetStagedStats() {
  const origin = ACTIVE_ROSTER[currentSlot];
  const spentPts = Object.values(stagedCard.stats).reduce((a, b) => a + b, 0) - Object.values(origin.baseStats).reduce((a, b) => a + b, 0);
  for (let k in stagedCard.stats) stagedCard.stats[k] = origin.baseStats[k];
  stagedCard.freePts += spentPts; renderLocker();
}

function saveStagedStats() {
  const origin = ACTIVE_ROSTER[currentSlot];
  origin.freePts = stagedCard.freePts; origin.stats = { ...stagedCard.stats };
  if (typeof allPlayers !== 'undefined') allPlayers.forEach(p => p.rebind(true));
  saveGameData(); renderLocker();
  alert(`✅ [${origin.name}] 配點已成功儲存並同步至 LocalStorage！`);
}

function swapActivePlayer(cardId) {
  const target = INVENTORY.find(c => c.id === cardId);
  if (target) {
    ACTIVE_ROSTER[currentSlot] = target; initStagedCard();
    if (typeof allPlayers !== 'undefined') allPlayers.forEach(p => p.rebind(true));
    saveGameData(); renderLocker();
  }
}

// ========================================================
// 🎰 轉蛋專區 (GACHA ARCADE) & 防手殘確認邏輯
// ========================================================
let pendingGachaAction = null;

function openGachaArcade() {
  document.getElementById('start-menu-modal').style.display = 'none';
  document.getElementById('gacha-arcade-modal').style.display = 'flex';
  const cd = document.getElementById('arcade-coin-display');
  if (cd) cd.innerText = userCoins;
}

function closeGachaArcade() {
  document.getElementById('gacha-arcade-modal').style.display = 'none';
  document.getElementById('start-menu-modal').style.display = 'flex';
  saveGameData();
}

function openGachaArcadeFromWardrobe() {
  document.getElementById('wardrobe-modal').style.display = 'none';
  openGachaArcade();
}

function promptConfirmGacha(type, isTen, cost) {
  if (userCoins < cost) {
    alert(`排球金幣不足！本次抽取需要 ${cost} 幣，目前持有 ${userCoins} 幣。`);
    return;
  }
  const typeLabels = { cosmetic: '時尚轉蛋', player: '角色轉蛋', skill: '技能轉蛋' };
  pendingGachaAction = { type, isTen, cost };
  document.getElementById('confirm-gacha-text').innerText = `確定要花費 ${cost} 排球金幣，進行【${typeLabels[type]}】${isTen ? '十抽' : '單抽'} 嗎？`;
  document.getElementById('confirm-gacha-modal').style.display = 'flex';
}

function closeConfirmGacha() {
  document.getElementById('confirm-gacha-modal').style.display = 'none';
  pendingGachaAction = null;
}

function executeConfirmedGacha() {
  if (!pendingGachaAction) return;
  const { type, isTen } = pendingGachaAction;
  closeConfirmGacha();

  if (type === 'cosmetic') triggerCosmeticGacha(isTen);
  else if (type === 'player') triggerGacha(isTen);
  else if (type === 'skill') triggerSkillGacha(isTen);
}

function rollSingleCard() {
  const rand = Math.random();
  let targetTier = 'N';
  if (rand < 0.05) targetTier = 'SSR';
  else if (rand < 0.25) targetTier = 'SR';
  else if (rand < 0.70) targetTier = 'R';

  let poolCandidates = GACHA_POOL.filter(c => c.tier === targetTier);
  if (poolCandidates.length === 0) poolCandidates = GACHA_POOL;
  const template = poolCandidates[Math.floor(Math.random() * poolCandidates.length)];
  const existingCard = INVENTORY.find(c => c.name === template.name);
  let isDup = false, resultMsg = '';

  if (existingCard) {
    isDup = true;
    if (existingCard.level < 20) {
      existingCard.exp += 350;
      let reqExp = getRequiredExp(existingCard.level);
      let upCount = 0;
      while (existingCard.exp >= reqExp && existingCard.level < 20) {
        existingCard.exp -= reqExp; existingCard.level++; existingCard.freePts += 5; upCount++;
        reqExp = getRequiredExp(existingCard.level);
      }
      resultMsg = `+350 EXP ${upCount > 0 ? `(升至 Lv.${existingCard.level}!)` : ''}`;
    } else {
      existingCard.freePts += 3; resultMsg = `神髓精煉 +3 AP!`;
    }
  } else {
    const newCard = {
      id: 'c_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      name: template.name, tier: template.tier, color: template.color, level: 1, exp: 0,
      freePts: 5 + template.bonusPts, baseStats: { ...template.base }, stats: { ...template.base },
      equippedSkill: 'sk_breaker', cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' }
    };
    INVENTORY.push(newCard); resultMsg = '🎉 新球員加入！';
  }
  return { template, isDup, resultMsg };
}

function triggerGacha(isTen = false) {
  const cost = isTen ? 900 : 100;
  if (userCoins < cost) { alert(`排球金幣不足 ${cost}！`); return; }
  userCoins -= cost;
  updateCoinHUD();

  const spinner = document.getElementById('gacha-spinner-modal');
  document.getElementById('spinner-msg').innerText = isTen ? '🎰 十連球探招募中...' : '🎰 球探招募中...';
  spinner.style.display = 'flex'; playSound('coin');

  setTimeout(() => {
    spinner.style.display = 'none';
    if (!isTen) {
      const result = rollSingleCard(); saveGameData();
      const dupBadge = document.getElementById('gacha-dup-badge');
      const rewardMsg = document.getElementById('gacha-reward-msg');
      if (result.isDup) {
        dupBadge.style.display = 'block'; dupBadge.innerText = '重複突破'; rewardMsg.innerText = `🔄 ${result.resultMsg}`;
      } else {
        dupBadge.style.display = 'none'; rewardMsg.innerText = result.resultMsg;
      }
      document.getElementById('gacha-avatar').style.backgroundColor = result.template.color;
      document.getElementById('gacha-tier').innerText = result.template.tier;
      document.getElementById('gacha-tier').style.color = result.template.tier === 'SSR' ? '#facc15' : (result.template.tier === 'SR' ? '#c084fc' : (result.template.tier === 'R' ? '#f97316' : '#94a3b8'));
      document.getElementById('gacha-name').innerText = result.template.name;
      document.getElementById('gacha-feature').innerText = result.template.desc;
      document.getElementById('gacha-anim-modal').style.display = 'flex';
    } else {
      const results = [];
      for (let i = 0; i < 10; i++) results.push(rollSingleCard());
      saveGameData();
      const grid = document.getElementById('ten-gacha-grid');
      grid.innerHTML = '';
      results.forEach(res => {
        const item = document.createElement('div');
        item.className = `ten-gacha-item ${res.template.tier.toLowerCase()}`;
        item.innerHTML = `
          <div style="width: 46px; height: 46px; border-radius: 50%; background: ${res.template.color}; border: 2px solid #fff; margin-bottom: 6px;"></div>
          <strong style="font-size: 13px; color: ${res.template.tier === 'SSR' ? '#facc15' : (res.template.tier === 'SR' ? '#c084fc' : '#fff')};">[${res.template.tier}] ${res.template.name}</strong>
          <span style="font-size: 10px; color: ${res.isDup ? '#f97316' : '#10b981'}; margin-top: 4px;">${res.resultMsg}</span>
        `;
        grid.appendChild(item);
      });
      document.getElementById('gacha-ten-modal').style.display = 'flex';
    }
  }, 950);
}

function updateCoinHUD() {
  const cd = document.getElementById('coin-display');
  if (cd) cd.innerText = userCoins;
  const acd = document.getElementById('arcade-coin-display');
  if (acd) acd.innerText = userCoins;
}

function closeGachaAnim() { document.getElementById('gacha-anim-modal').style.display = 'none'; }
function closeTenGachaModal() { document.getElementById('gacha-ten-modal').style.display = 'none'; }

function checkMatchWin() {
  if ((score.player >= 15 || score.enemy >= 15) && Math.abs(score.player - score.enemy) >= 2) openSettlement();
}

function openSettlement() {
  isSettlementOpen = true; isPaused = true;
  document.getElementById('settlement-modal').style.display = 'flex';
  const playerWon = score.player > score.enemy;
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
    const rating = ((s.spikeKills + s.toolOutKills) * 25) + (s.roofKills * 30) + (s.perfectAbsorbs * 15);
    if (rating > bestRating) { bestRating = rating; mvpSlot = slot; }
  }

  const baseExp = playerWon ? 150 : 60;
  const tbody = document.getElementById('settle-table-body');
  tbody.innerHTML = '';

  for (let slot in ACTIVE_ROSTER) {
    const card = ACTIVE_ROSTER[slot], s = proMatchStats[slot], isMvp = (slot === mvpSlot);
    const personalBonus = ((s.spikeKills + s.toolOutKills) * 20) + (s.roofKills * 25) + (s.perfectAbsorbs * 15) + (isMvp ? 50 : 0);
    const finalExp = baseExp + personalBonus;

    card.exp += finalExp;
    let reqExp = getRequiredExp(card.level), levelUp = false;
    while (card.exp >= reqExp && card.level < 20) {
      card.exp -= reqExp; card.level++; card.freePts += 5; levelUp = true;
      reqExp = getRequiredExp(card.level);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: ${card.color}; font-weight: bold; font-size: 11px;">${card.name} ${isMvp ? '👑MVP' : ''} (Lv.${card.level}${levelUp ? '⬆️' : ''})</td>
      <td>${s.totalSpikes}</td>
      <td style="color: #ef4444; font-weight: bold;">${s.spikeKills}</td>
      <td style="color: #10b981; font-weight: bold;">${s.toolOutKills}</td>
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
  
  // 🏆 聯賽獎勵與炫彩光效強制解鎖處理
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

function openCareerMenu() {
  isCareerMode = true;
  document.getElementById('start-menu-modal').style.display = 'none';
  document.getElementById('career-modal').style.display = 'flex';
  renderCareerStages();
}

function closeCareerMenu() {
  document.getElementById('career-modal').style.display = 'none';
  document.getElementById('start-menu-modal').style.display = 'flex';
}

function renderCareerStages() {
  const grid = document.getElementById('career-stages-grid');
  if (!grid) return;
  grid.innerHTML = '';

  CAREER_STAGES.forEach(stage => {
    const isUnlocked = stage.id <= careerProgress;
    const isCurrent = stage.id === currentCareerStage;
    const skinRewardObj = stage.rewardSkin ? COSMETICS_DB.effects.find(e => e.id === stage.rewardSkin) : null;
    const item = document.createElement('div');
    item.style.cssText = `
      background: ${isUnlocked ? '#18153d' : '#0f172a'};
      border: 2px solid ${isCurrent ? '#facc15' : (isUnlocked ? stage.color : '#334155')};
      border-radius: 14px; padding: 14px; display: flex; flex-direction: column;
      align-items: center; text-align: center; position: relative;
      opacity: ${isUnlocked ? 1.0 : 0.45};
      box-shadow: ${isCurrent ? '0 0 20px rgba(250, 204, 21, 0.4)' : 'none'};
    `;

    item.innerHTML = `
      <div style="font-size: 11px; font-weight: 900; color: ${stage.color}; margin-bottom: 4px;">STAGE 0${stage.id}</div>
      <h3 style="font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 2px;">${stage.name}</h3>
      <span style="font-size: 10px; color: #cbd5e1; margin-bottom: 8px;">${stage.subtitle}</span>
      <div style="display: flex; gap: 6px; margin: 8px 0;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${stage.front.color}; border: 1.5px solid #fff;" title="${stage.front.name}"></div>
        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${stage.back.color}; border: 1.5px solid #fff;" title="${stage.back.name}"></div>
      </div>
      <p style="font-size: 10px; color: #94a3b8; line-height: 1.3; min-height: 38px; margin-bottom: 8px;">${stage.desc}</p>
      <div style="font-size: 11px; color: #facc15; font-weight: bold;">🪙 獎勵: +${stage.rewardCoins} 幣</div>
      <div style="font-size: 10px; color: #f472b6; font-weight: bold; margin-bottom: 10px;">${skinRewardObj ? `✨ 光效:【${skinRewardObj.name}】` : '✨ (無限定光效)'}</div>
      <button class="btn-action" style="width: 100%; padding: 6px 0; font-size: 11px; ${isUnlocked ? '' : 'background: #334155; border-color: #475569; cursor: not-allowed;'}" 
        ${isUnlocked ? `onclick="startCareerMatch(${stage.id})"` : 'disabled'}>
        ${isUnlocked ? (stage.id < careerProgress ? '⚔️ 再次挑戰' : '⚔️ 開戰') : '🔒 尚未解鎖'}
      </button>
    `;
    grid.appendChild(item);
  });
}

function startCareerMatch(stageId) {
  currentCareerStage = stageId;
  const stage = CAREER_STAGES.find(s => s.id === stageId);
  if (!stage) return;

  ACTIVE_ROSTER.enemyFront = {
    id: `enemy_f_${stage.id}`,
    name: stage.front.name,
    tier: stage.front.tier,
    color: stage.front.color,
    level: stage.id * 3,
    stats: { ...stage.front.stats },
    equippedSkill: stage.front.equippedSkill,
    cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' }
  };

  ACTIVE_ROSTER.enemyBack = {
    id: `enemy_b_${stage.id}`,
    name: stage.back.name,
    tier: stage.back.tier,
    color: stage.back.color,
    level: stage.id * 3,
    stats: { ...stage.back.stats },
    equippedSkill: stage.back.equippedSkill,
    cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' }
  };

  if (typeof allPlayers !== 'undefined') {
    allPlayers.forEach(p => p.rebind(true));
  }

  document.getElementById('career-modal').style.display = 'none';
  isGameStarted = true;
  isPaused = false;
  score.player = 0;
  score.enemy = 0;
  scoreDisplay.innerText = '0 : 0';
  ball.resetForServe('player');
}

// ========================================================
// 🪞 主畫面試衣化妝間 (Wardrobe UI)
// ========================================================
let wbSlot = 'user', wbCategory = 'hats', wbPage = 0;

function openWardrobeModal() {
  document.getElementById('start-menu-modal').style.display = 'none';
  document.getElementById('wardrobe-modal').style.display = 'flex';
  renderWardrobeUI();
  runWardrobePreviewLoop();
}

function closeWardrobeModal() {
  document.getElementById('wardrobe-modal').style.display = 'none';
  document.getElementById('start-menu-modal').style.display = 'flex';
  if (typeof allPlayers !== 'undefined') allPlayers.forEach(p => p.rebind(true));
  saveGameData();
}

function switchWardrobeSlot(slot) {
  wbSlot = slot;
  document.getElementById('wb-slot-user').className = `roster-tab ${slot === 'user' ? 'active' : ''}`;
  document.getElementById('wb-slot-mate').className = `roster-tab ${slot === 'mate' ? 'active' : ''}`;
  renderWardrobeUI();
}

function switchWardrobeCategory(cat) {
  wbCategory = cat;
  wbPage = 0;
  document.getElementById('wb-tab-hats').className = `roster-tab ${cat === 'hats' ? 'active' : ''}`;
  document.getElementById('wb-tab-faces').className = `roster-tab ${cat === 'faces' ? 'active' : ''}`;
  document.getElementById('wb-tab-effects').className = `roster-tab ${cat === 'effects' ? 'active' : ''}`;
  renderWardrobeUI();
}

function changeWardrobePage(delta) {
  const list = COSMETICS_DB[wbCategory];
  const maxPages = Math.ceil(list.length / 9);
  wbPage = Math.max(0, Math.min(maxPages - 1, wbPage + delta));
  renderWardrobeUI();
}

function renderWardrobeUI() {
  const currentCard = ACTIVE_ROSTER[wbSlot];
  document.getElementById('wardrobe-char-name').innerText = currentCard.name;
  
  const hatName = (COSMETICS_DB.hats.find(h => h.id === currentCard.cosmetics.hat) || {}).name || '無';
  const faceName = (COSMETICS_DB.faces.find(f => f.id === currentCard.cosmetics.face) || {}).name || '無';
  const fxName = (COSMETICS_DB.effects.find(e => e.id === currentCard.cosmetics.effect) || {}).name || '無';
  document.getElementById('wardrobe-char-desc').innerText = `頭飾: ${hatName} | 臉飾: ${faceName} | 光效: ${fxName}`;

  const list = COSMETICS_DB[wbCategory];
  const maxPages = Math.ceil(list.length / 9);
  document.getElementById('wardrobe-page-num').innerText = `第 ${wbPage + 1} / ${maxPages} 頁`;

  const grid = document.getElementById('wardrobe-items-grid');
  grid.innerHTML = '';

  const pageItems = list.slice(wbPage * 9, (wbPage + 1) * 9);
  const unlockedList = UNLOCKED_COSMETICS[wbCategory] || [];

  pageItems.forEach(item => {
    const isNone = item.id.endsWith('_none');
    const isUnlocked = isNone || unlockedList.includes(item.id);
    const catSingular = wbCategory === 'hats' ? 'hat' : (wbCategory === 'faces' ? 'face' : 'effect');
    const isEquipped = currentCard.cosmetics[catSingular] === item.id;

    const box = document.createElement('div');
    box.style.cssText = `
      background: ${isUnlocked ? (isEquipped ? '#312e81' : '#18153d') : '#0f172a'};
      border: 2px solid ${isEquipped ? '#facc15' : (isUnlocked ? '#6366f1' : '#334155')};
      border-radius: 12px; padding: 10px; display: flex; flex-direction: column;
      align-items: center; justify-content: space-between; text-align: center;
      opacity: ${isUnlocked ? 1.0 : 0.45}; cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
      box-shadow: ${isEquipped ? '0 0 15px rgba(250, 204, 21, 0.4)' : 'none'};
    `;

    box.innerHTML = `
      <div style="font-size: 13px; font-weight: bold; color: ${isEquipped ? '#facc15' : '#fff'};">${item.name}</div>
      <p style="font-size: 10px; color: #a5b4fc; margin: 4px 0; line-height: 1.2;">${item.desc}</p>
      <span style="font-size: 10px; font-weight: 800; color: ${isUnlocked ? (isEquipped ? '#10b981' : '#38bdf8') : '#ef4444'};">
        ${isUnlocked ? (isEquipped ? '✓ 已穿戴' : '點擊換裝') : '🔒 未獲得'}
      </span>
    `;

    if (isUnlocked) {
      box.onclick = () => {
        currentCard.cosmetics[catSingular] = item.id;
        renderWardrobeUI();
      };
    }
    grid.appendChild(box);
  });
}

function unequipAllWardrobe() {
  const currentCard = ACTIVE_ROSTER[wbSlot];
  currentCard.cosmetics = { hat: 'hat_none', face: 'face_none', effect: 'fx_none' };
  renderWardrobeUI();
}

function runWardrobePreviewLoop() {
  const cvs = document.getElementById('wardrobe-preview-canvas');
  if (!cvs || document.getElementById('wardrobe-modal').style.display !== 'flex') return;
  const pCtx = cvs.getContext('2d');
  pCtx.clearRect(0, 0, cvs.width, cvs.height);

  const card = ACTIVE_ROSTER[wbSlot];
  const dummyPlayer = {
    x: 110, y: 160, radius: 36, color: card.color,
    facing: 1, squashX: 1, squashY: 1, isDiving: false, isBlocking: false,
    card: card
  };

  drawPlayerEntity(dummyPlayer, pCtx);
  requestAnimationFrame(runWardrobePreviewLoop);
}

function triggerCosmeticGacha(isTen = false) {
  const cost = isTen ? 450 : 50;
  if (userCoins < cost) { alert(`排球金幣不足 ${cost}！`); return; }

  const availablePool = [];
  ['hats', 'faces'].forEach(cat => {
    COSMETICS_DB[cat].forEach(item => {
      if (!item.id.endsWith('_none') && !UNLOCKED_COSMETICS[cat].includes(item.id)) {
        availablePool.push({ ...item, category: cat });
      }
    });
  });

  if (availablePool.length === 0) {
    alert('🎉 恭喜！服裝獎池已全數抽空，所有帽子與臉飾皆已解鎖！');
    return;
  }

  userCoins -= cost;
  updateCoinHUD();

  const pullCount = isTen ? Math.min(10, availablePool.length) : 1;
  const pulledItems = [];

  for (let i = 0; i < pullCount; i++) {
    const idx = Math.floor(Math.random() * availablePool.length);
    const item = availablePool.splice(idx, 1)[0];
    UNLOCKED_COSMETICS[item.category].push(item.id);
    pulledItems.push(item);
  }

  saveGameData();
  playSound('coin');
  alert(`🎉 成功抽得 ${pulledItems.length} 件全新服裝飾品：\n` + pulledItems.map(p => `• [${p.category === 'hats' ? '帽子' : '臉飾'}] ${p.name}`).join('\n'));
}

function triggerSkillGacha(isTen = false) {
  const cost = isTen ? 2350 : 250;
  if (userCoins < cost) { alert(`排球金幣不足 ${cost}！`); return; }

  const availableSkills = SKILL_POOL.filter(sk => !UNLOCKED_SKILLS.includes(sk.id));
  if (availableSkills.length === 0) {
    alert('⚡ 所有戰術技能皆已領悟研習完畢！');
    return;
  }

  userCoins -= cost;
  updateCoinHUD();

  const pullCount = isTen ? Math.min(10, availableSkills.length) : 1;
  const results = [];

  for (let i = 0; i < pullCount; i++) {
    const idx = Math.floor(Math.random() * availableSkills.length);
    const sk = availableSkills.splice(idx, 1)[0];
    UNLOCKED_SKILLS.push(sk.id);
    results.push(sk);
  }

  saveGameData();
  playSound('perfect_spike');
  alert(`⚡ 成功領悟 ${results.length} 個全新戰術技能：\n` + results.map(s => `• ${s.name} (${s.type})`).join('\n'));
}

window.addEventListener('DOMContentLoaded', () => {
  const menuCanvas = document.getElementById('menu-bg-canvas');
  if (!menuCanvas) return;
  const mCtx = menuCanvas.getContext('2d');
  let menuBalls = [];

  function resizeMenuCanvas() {
    menuCanvas.width = window.innerWidth;
    menuCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeMenuCanvas);
  resizeMenuCanvas();

  for (let i = 0; i < 4; i++) {
    menuBalls.push({
      x: Math.random() * window.innerWidth, y: Math.random() * (window.innerHeight * 0.5),
      vx: (Math.random() - 0.5) * 8 + 3, vy: Math.random() * 4 - 2,
      radius: 18 + Math.random() * 8, rotation: 0
    });
  }

  function updateAndDrawMenuBackground() {
    if (typeof isGameStarted !== 'undefined' && isGameStarted) return;
    mCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
    menuBalls.forEach(mb => {
      mb.x += mb.vx; mb.y += mb.vy; mb.vy += 0.25; mb.rotation += mb.vx * 0.04;
      if (mb.x - mb.radius < 0) { mb.x = mb.radius; mb.vx *= -0.85; }
      if (mb.x + mb.radius > menuCanvas.width) { mb.x = menuCanvas.width - mb.radius; mb.vx *= -0.85; }
      if (mb.y + mb.radius > menuCanvas.height) {
        mb.y = menuCanvas.height - mb.radius;
        mb.vy = -Math.abs(mb.vy) * 0.85;
        if (Math.abs(mb.vy) < 2) mb.vy = -12 - Math.random() * 6; 
      }
      mCtx.save(); mCtx.translate(mb.x, mb.y); mCtx.rotate(mb.rotation);
      mCtx.globalAlpha = 0.35; mCtx.beginPath(); mCtx.arc(0, 0, mb.radius, 0, Math.PI * 2);
      mCtx.fillStyle = '#fff'; mCtx.fill(); mCtx.lineWidth = 2; mCtx.strokeStyle = '#38bdf8'; mCtx.stroke();
      mCtx.fillStyle = '#facc15'; mCtx.beginPath(); mCtx.arc(0, 0, mb.radius, -0.6, 0.8); mCtx.lineTo(0, 0); mCtx.fill();
      mCtx.fillStyle = '#38bdf8'; mCtx.beginPath(); mCtx.arc(0, 0, mb.radius, 1.8, 3.2); mCtx.lineTo(0, 0); mCtx.fill();
      mCtx.restore();
    });
    requestAnimationFrame(updateAndDrawMenuBackground);
  }
  requestAnimationFrame(updateAndDrawMenuBackground);

  let heroIdx = 0;
  const heroPool = GACHA_POOL.slice(0, 5);
  setInterval(() => {
    if (typeof isGameStarted !== 'undefined' && isGameStarted) return;
    heroIdx = (heroIdx + 1) % heroPool.length;
    const h = heroPool[heroIdx];
    document.getElementById('menu-card-avatar').style.backgroundColor = h.color;
    document.getElementById('menu-card-tier').innerText = h.tier;
    document.getElementById('menu-card-tier').style.color = h.tier === 'SSR' ? '#facc15' : '#c084fc';
    document.getElementById('menu-card-name').innerText = h.name;
    document.getElementById('menu-card-desc').innerText = h.desc;
    document.getElementById('hero-sil-1').style.backgroundColor = h.color;
  }, 6000);
// ========================================================
// 多人連線大廳與房間信號交互
// ========================================================
// 拉到 game_ui.js 最底部，確保以下函式在全域層（不要包在任何括號內）：

function openMultiplayerModal() {
  document.getElementById('start-menu-modal').style.display = 'none';
  document.getElementById('multiplayer-modal').style.display = 'flex';
}

function closeMultiplayerModal() {
  if (NET.peer) { NET.peer.destroy(); NET.peer = null; }
  NET.isMultiplayer = false;
  document.getElementById('multiplayer-modal').style.display = 'none';
  document.getElementById('start-menu-modal').style.display = 'flex';
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// 👑 房主開房
function startHosting() {
  const selectedMode = document.querySelector('input[name="netMode"]:checked').value;
  NET.mode = selectedMode;
  NET.isHost = true;
  NET.isMultiplayer = true;
  NET.roomCode = generateRoomCode();

  const customPeerId = `VB2026_${NET.roomCode}`;
  NET.peer = new Peer(customPeerId);

  NET.peer.on('open', (id) => {
    document.getElementById('host-code-display').style.display = 'block';
    document.getElementById('room-code-text').innerText = NET.roomCode;
  });

  NET.peer.on('connection', (conn) => {
    NET.conn = conn;
    setupDataConnection();
    
    conn.on('open', () => {
      conn.send({ type: 'INIT_SYNC', mode: NET.mode });
      setTimeout(() => {
        document.getElementById('multiplayer-modal').style.display = 'none';
        startGameFromMenu();
      }, 500);
    });
  });

  NET.peer.on('error', (err) => {
    alert('建立房間失敗，請重試: ' + err);
  });
}

// 🎮 訪客加入
function joinRoom() {
  const inputCode = document.getElementById('join-room-input').value.trim().toUpperCase();
  if (inputCode.length !== 6) {
    document.getElementById('join-status-text').innerText = '請輸入正確的 6 碼代碼！';
    return;
  }
  document.getElementById('join-status-text').innerText = '正在尋找主機連線中...';

  NET.isHost = false;
  NET.isMultiplayer = true;
  NET.roomCode = inputCode;
  NET.peer = new Peer();

  NET.peer.on('open', () => {
    const targetPeerId = `VB2026_${inputCode}`;
    const conn = NET.peer.connect(targetPeerId);
    NET.conn = conn;

    conn.on('open', () => {
      setupDataConnection();
    });

    conn.on('data', (data) => {
      if (data.type === 'INIT_SYNC') {
        NET.mode = data.mode;
        document.getElementById('multiplayer-modal').style.display = 'none';
        startGameFromMenu();
      }
    });
  });

  NET.peer.on('error', (err) => {
    document.getElementById('join-status-text').innerText = '找不到該房間代碼或連線逾時！';
  });
}

function setupDataConnection() {
  NET.conn.on('data', (data) => {
    if (data.type === 'INPUT') {
      NET.remoteKeys = data.keys;
    } else if (data.type === 'STATE_SYNC') {
      applyWorldSync(data);
    }
  });
}