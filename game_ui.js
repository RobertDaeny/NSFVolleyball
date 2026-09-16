// ========================================================
// UI 與動態彈窗系統：更衣室、試衣間、轉蛋大街、結算、連線大廳與準備室
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

  const visibleSlots = (typeof isPracticeMode !== 'undefined' && isPracticeMode) || !isGameStarted ? ['user', 'mate', 'enemyFront', 'enemyBack'] : ['user', 'mate'];
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

  const currentEquippedSkill = SKILL_POOL.find(s => s.id === origin.equippedSkill) || SKILL_POOL[0];
  document.getElementById('skill-card-desc').innerText = currentEquippedSkill.desc;

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
dex: { label: '技巧 (DEX)', desc: '驅動扣殺下旋加速度與跳飄氣流晃動；每點提升 0.25px 實體接球判定範圍與完美吸震半徑。' },
    int: { label: '球商 (INT)', desc: '決定進攻決策與出界放球判斷；每點提供 0.15px 接球預判卡位範圍，並降低心態受挫機率。' }
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
    <div class="stat-derived-row"><span>🛡️ 實體防守覆蓋半徑 (Reach)</span><strong style="color: #38bdf8;">${derived.reach.toFixed(1)} px</strong></div>
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
  alert(`✅ [${origin.name}] 配點已成功儲存！`);
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
// ⏸️ ESC 暫停選單
// ========================================================
let isPauseMenuOpen = false;
let isPracticeMode = false;

function openLockerFromMenu() {
  document.getElementById('start-menu-modal').style.display = 'none';
  isGameStarted = false;
  isLockerOpen = true;
  document.getElementById('locker-modal').style.display = 'flex';
  initStagedCard();
  renderLocker();
}

function closeLockerToMenu() {
  isLockerOpen = false;
  document.getElementById('locker-modal').style.display = 'none';
  if (!isGameStarted) {
    document.getElementById('start-menu-modal').style.display = 'flex';
  }
}

function openLockerFromPause() {
  if (NET.isMultiplayer || isCareerMode) return;
  isPauseMenuOpen = false;
  document.getElementById('pause-menu-modal').style.display = 'none';
  toggleLocker();
}

function toggleLocker() {
  if (isSettlementOpen) return;
  if (!isGameStarted) {
    closeLockerToMenu();
    return;
  }
  isLockerOpen = !isLockerOpen;
  isPaused = isLockerOpen;
  document.getElementById('locker-modal').style.display = isLockerOpen ? 'flex' : 'none';

  if (isLockerOpen) {
    initStagedCard();
    renderLocker();
  } else {
    allPlayers.forEach(p => p.rebind(true));
  }
}

function togglePauseMenu() {
  if (isSettlementOpen || !isGameStarted) return;
  isPauseMenuOpen = !isPauseMenuOpen;
  document.getElementById('pause-menu-modal').style.display = isPauseMenuOpen ? 'flex' : 'none';

  const lockerBtn = document.getElementById('pause-btn-locker');
  const modeStatus = document.getElementById('pause-mode-status');

  if (NET.isMultiplayer) {
    isPaused = false;
    lockerBtn.disabled = true;
    lockerBtn.innerText = '🔒 更衣室 (連線中禁用)';
    modeStatus.innerText = '🌐 線上對戰中 · 賽局即時進行中 (未暫停)';
    modeStatus.style.color = '#38bdf8';
  } else if (isCareerMode) {
    isPaused = isPauseMenuOpen;
    lockerBtn.disabled = true;
    lockerBtn.innerText = '🔒 更衣室 (聯賽中禁用)';
    modeStatus.innerText = '🏆 聯賽進行中 · 時間已凍結';
    modeStatus.style.color = '#facc15';
  } else {
    isPaused = isPauseMenuOpen;
    lockerBtn.disabled = false;
    lockerBtn.innerText = '👕 角色戰術更衣室';
    modeStatus.innerText = '🏐 無盡練習模式 · 時間已凍結';
    modeStatus.style.color = '#10b981';
  }
}

function resumeGame() {
  isPauseMenuOpen = false;
  document.getElementById('pause-menu-modal').style.display = 'none';
  if (!NET.isMultiplayer) isPaused = false;
}

function toggleBgmPlay() {
  const btn = document.getElementById('btn-bgm');
  if (!isAudioLoaded) { alert('請先點擊上方按鈕選擇本機 MP3！'); return; }
  if (customAudio.paused) {
    customAudio.play(); btn.innerText = 'BGM: 播放中'; btn.style.background = '#10b981';
  } else {
    customAudio.pause(); btn.innerText = 'BGM: 暫停'; btn.style.background = '#312e81';
  }
}

function returnToStartMenuFromPause() {
  if (confirm('確定要結束比賽並返回大廳嗎？')) {
    resumeGame();
    if (NET.isMultiplayer && NET.conn && NET.conn.open) {
      NET.conn.send({ type: 'PEER_QUIT' });
      NET.peer.destroy(); NET.peer = null; NET.isMultiplayer = false;
    }
    returnToStartMenu();
  }
}

function startPracticeMode() {
  isPracticeMode = true;
  isCareerMode = false;
  document.getElementById('start-menu-modal').style.display = 'none';
  isGameStarted = true; isPaused = false;
  if (typeof resetMatchState === 'function') resetMatchState();
  ball.resetForServe('LEFT');
}

// ========================================================
// ⏳ 連線賽前戰術配置室 (30 秒倒數 + 雙方 Ready 縮為 5 秒)
// ========================================================
let netPrepTimer = null, netPrepSeconds = 30;
let isMyReady = false, isMateReady = false;

function toggleDifficultySelect(isCoop) {
  const wrap = document.getElementById('pve-difficulty-wrap');
  if (wrap) wrap.style.display = isCoop ? 'block' : 'none';
}

function startNetPreparation() {
  document.getElementById('multiplayer-modal').style.display = 'none';
  document.getElementById('settlement-modal').style.display = 'none';
  document.getElementById('net-prep-modal').style.display = 'flex';
  netPrepSeconds = 30;
  isMyReady = false;
  isMateReady = false;

  const timerEl = document.getElementById('net-prep-timer');
  timerEl.innerText = `⏳ 倒數: ${netPrepSeconds}s`;
  timerEl.style.color = '#ef4444';

  const readyBtn = document.getElementById('btn-net-prep-ready');
  readyBtn.disabled = false;
  readyBtn.style.background = '#10b981';
  readyBtn.innerText = '⚔️ 準備完成 (READY)';

  document.getElementById('net-prep-ready-status').innerText = '等待雙方確認...';
  document.getElementById('net-prep-ready-status').style.color = '#cbd5e1';

  const myCharSel = document.getElementById('net-prep-my-char');
  const mySkillSel = document.getElementById('net-prep-my-skill');
  const mateCharSel = document.getElementById('net-prep-mate-char');
  const mateSkillSel = document.getElementById('net-prep-mate-skill');
  const mateTitle = document.getElementById('mate-prep-title');
  const diffHint = document.getElementById('net-prep-difficulty-hint');

  myCharSel.disabled = false;
  mySkillSel.disabled = false;
  myCharSel.innerHTML = '';
  INVENTORY.forEach((c, idx) => {
    myCharSel.innerHTML += `<option value="${c.id}" ${idx === 0 ? 'selected' : ''}>[${c.tier}] ${c.name} (Lv.${c.level})</option>`;
  });

  mySkillSel.innerHTML = '';
  SKILL_POOL.forEach(sk => {
    mySkillSel.innerHTML += `<option value="${sk.id}">[${sk.type}] ${sk.name}</option>`;
  });

const myCloudId = (typeof currentCloudUser !== 'undefined' && currentCloudUser) ? currentCloudUser : '我方主控';
  const myTitleEl = document.querySelector('#panel-my-prep h3');
  if (myTitleEl) myTitleEl.innerText = `👤 [${myCloudId}] 的出戰配置`;

  if (NET.mode === 'COOP') {
    mateTitle.innerText = '🤝 隊友配置 (即時連動)';
    mateCharSel.disabled = true;
    mateSkillSel.disabled = true;
    mateCharSel.innerHTML = `<option value="">(隊友選擇中...)</option>`;
    mateSkillSel.innerHTML = `<option value="">(技能同步中...)</option>`;

    const diffNames = { 1: '入門新手', 2: '泥濘沼澤', 3: '常盤鋼鐵', 4: '疾風怒濤', 5: '神域全明星' };
    diffHint.innerText = `👾 挑戰難度：【${diffNames[NET.pveDifficulty] || '隨機難度'}】(電腦將於開賽時登場)`;
  } else {
    mateTitle.innerText = '🤖 我的電腦隊友 (AI 搭檔)';    mateCharSel.disabled = false;
    mateSkillSel.disabled = false;
    mateCharSel.innerHTML = '';
    INVENTORY.forEach((c, idx) => {
      mateCharSel.innerHTML += `<option value="${c.id}" ${idx === 1 ? 'selected' : ''}>[${c.tier}] ${c.name} (Lv.${c.level})</option>`;
    });
    mateSkillSel.innerHTML = '';
    SKILL_POOL.forEach(sk => {
      mateSkillSel.innerHTML += `<option value="${sk.id}">[${sk.type}] ${sk.name}</option>`;
    });
    diffHint.innerText = '⚔️ 隔網對抗：雙方各帶一名自選電腦隊友交戰！';
  }

  onNetPrepChange();

  clearInterval(netPrepTimer);
  netPrepTimer = setInterval(() => {
    netPrepSeconds--;
    timerEl.innerText = `⏳ 倒數: ${netPrepSeconds}s`;
    if (netPrepSeconds <= 0) {
      clearInterval(netPrepTimer);
      finalizeNetStart();
    }
  }, 1000);
}

function onNetPrepChange() {
  const charId = document.getElementById('net-prep-my-char').value;
  const skillId = document.getElementById('net-prep-my-skill').value;
  const myCharObj = INVENTORY.find(c => c.id === charId) || INVENTORY[0];

  if (NET.conn && NET.conn.open) {
    NET.conn.send({
      type: 'LOBBY_SELECT_UPDATE',
      char: { name: myCharObj.name, tier: myCharObj.tier, level: myCharObj.level, color: myCharObj.color },
      skillId: skillId
    });
  }
}

function handleRemoteLobbyUpdate(data) {
  if (NET.mode === 'COOP') {
    const mateCharSel = document.getElementById('net-prep-mate-char');
    const mateSkillSel = document.getElementById('net-prep-mate-skill');
    const sk = SKILL_POOL.find(s => s.id === data.skillId) || SKILL_POOL[0];

    mateCharSel.innerHTML = `<option value="">[${data.char.tier}] ${data.char.name} (Lv.${data.char.level})</option>`;
    mateSkillSel.innerHTML = `<option value="">[${sk.type}] ${sk.name}</option>`;
  }
}

function confirmNetPrepReady() {
  if (isMyReady) return;
  isMyReady = true;

  const readyBtn = document.getElementById('btn-net-prep-ready');
  readyBtn.disabled = true;
  readyBtn.style.background = '#64748b';
  readyBtn.innerText = '✓ 我已就緒 (WAITING)';

  document.getElementById('net-prep-my-char').disabled = true;
  document.getElementById('net-prep-my-skill').disabled = true;
  document.getElementById('net-prep-mate-char').disabled = true;
  document.getElementById('net-prep-mate-skill').disabled = true;

  const myCharId = document.getElementById('net-prep-my-char').value;
  const mySkillId = document.getElementById('net-prep-my-skill').value;
  const mateCharId = document.getElementById('net-prep-mate-char').value;
  const mateSkillId = document.getElementById('net-prep-mate-skill').value;

  const myCharObj = INVENTORY.find(c => c.id === myCharId) || INVENTORY[0];
  const mateCharObj = INVENTORY.find(c => c.id === mateCharId) || INVENTORY[1];

  const payload = {
    type: 'READY_CHECK',
    ready: true,
    p1: { name: myCharObj.name, color: myCharObj.color, stats: myCharObj.stats, skillId: mySkillId, cosmetics: myCharObj.cosmetics },
    p2: (NET.mode === 'PVP') ? { name: mateCharObj.name, color: mateCharObj.color, stats: mateCharObj.stats, skillId: mateSkillId, cosmetics: mateCharObj.cosmetics } : null
  };

  if (NET.conn && NET.conn.open) {
    NET.conn.send(payload);
  }

  // 套用本機選手配置到對應 Slot
  if (NET.isHost) {
    ACTIVE_ROSTER.user = { ...myCharObj, equippedSkill: mySkillId };
    if (NET.mode === 'PVP') {
      ACTIVE_ROSTER.mate = { ...mateCharObj, equippedSkill: mateSkillId };
    }
  } else {
    if (NET.mode === 'COOP') {
      ACTIVE_ROSTER.mate = { ...myCharObj, equippedSkill: mySkillId };
    } else {
      ACTIVE_ROSTER.enemyFront = { ...myCharObj, equippedSkill: mySkillId };
      ACTIVE_ROSTER.enemyBack = { ...mateCharObj, equippedSkill: mateSkillId };
    }
  }

  checkBothReadyToAccelerate();
}

function handleRemoteReady(data) {
  isMateReady = true;

  if (NET.isHost) {
    if (NET.mode === 'COOP') {
      ACTIVE_ROSTER.mate = { id: 'remote_guest', name: data.p1.name, color: data.p1.color, stats: data.p1.stats, equippedSkill: data.p1.skillId, cosmetics: data.p1.cosmetics };
    } else {
      ACTIVE_ROSTER.enemyFront = { id: 'remote_guest', name: data.p1.name, color: data.p1.color, stats: data.p1.stats, equippedSkill: data.p1.skillId, cosmetics: data.p1.cosmetics };
      if (data.p2) {
        ACTIVE_ROSTER.enemyBack = { id: 'remote_guest_mate', name: data.p2.name, color: data.p2.color, stats: data.p2.stats, equippedSkill: data.p2.skillId, cosmetics: data.p2.cosmetics };
      }
    }
  } else {
    if (NET.mode === 'COOP') {
      ACTIVE_ROSTER.user = { id: 'remote_host', name: data.p1.name, color: data.p1.color, stats: data.p1.stats, equippedSkill: data.p1.skillId, cosmetics: data.p1.cosmetics };
    } else {
      ACTIVE_ROSTER.user = { id: 'remote_host', name: data.p1.name, color: data.p1.color, stats: data.p1.stats, equippedSkill: data.p1.skillId, cosmetics: data.p1.cosmetics };
      if (data.p2) {
        ACTIVE_ROSTER.mate = { id: 'remote_host_mate', name: data.p2.name, color: data.p2.color, stats: data.p2.stats, equippedSkill: data.p2.skillId, cosmetics: data.p2.cosmetics };
      }
    }
  }

  document.getElementById('net-prep-ready-status').innerText = '對手已準備完成！';
  document.getElementById('net-prep-ready-status').style.color = '#34d399';

  checkBothReadyToAccelerate();
}

function checkBothReadyToAccelerate() {
  if (isMyReady && isMateReady) {
    if (netPrepSeconds > 5) {
      netPrepSeconds = 5;
      const timerEl = document.getElementById('net-prep-timer');
      timerEl.innerText = `⏳ 雙方就緒！最後 5 秒...`;
      timerEl.style.color = '#facc15';
    }
  }
}

function finalizeNetStart() {
  clearInterval(netPrepTimer);
  document.getElementById('net-prep-modal').style.display = 'none';

  if (typeof allPlayers !== 'undefined') {
    allPlayers.forEach(p => p.rebind(true));
  }
  if (typeof resetMatchState === 'function') resetMatchState();

  isGameStarted = true;
  isPaused = false;

  if (NET.isHost) {
    if (NET.conn && NET.conn.open) {
      NET.conn.send({ type: 'START_MATCH' });
    }
    ball.resetForServe('LEFT');
  }
}

// ========================================================
// 🌐 多人連線大廳控制器
// ========================================================
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

function startHosting() {
  const selectedMode = document.querySelector('input[name="netMode"]:checked').value;
  NET.mode = selectedMode;
  NET.isHost = true;
  NET.isMultiplayer = true;
  NET.mySlot = 0;
  NET.mateSlot = (selectedMode === 'COOP') ? 1 : 1;
  NET.myTeam = 'LEFT';
  NET.roomCode = generateRoomCode();

  if (selectedMode === 'COOP') {
    const diffVal = parseInt(document.getElementById('pve-diff-select').value) || 5;
    NET.pveDifficulty = diffVal;
    
    // 預先產生 PVE 雙電腦對手配置
    const stage = CAREER_STAGES.find(s => s.id === diffVal) || CAREER_STAGES[4];
    ACTIVE_ROSTER.enemyFront = {
      id: `ai_f_${Date.now()}`, name: stage.front.name, tier: stage.front.tier,
      color: stage.front.color, level: diffVal * 3, stats: { ...stage.front.stats },
      equippedSkill: stage.front.equippedSkill, cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' }
    };
    ACTIVE_ROSTER.enemyBack = {
      id: `ai_b_${Date.now()}`, name: stage.back.name, tier: stage.back.tier,
      color: stage.back.color, level: diffVal * 3, stats: { ...stage.back.stats },
      equippedSkill: stage.back.equippedSkill, cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' }
    };
  }

  const customPeerId = `VB2026_${NET.roomCode}`;
  NET.peer = new Peer(customPeerId);

  NET.peer.on('open', () => {
    document.getElementById('host-code-display').style.display = 'block';
    document.getElementById('room-code-text').innerText = NET.roomCode;
  });

  NET.peer.on('connection', (conn) => {
    NET.conn = conn;
    setupDataConnection();
    conn.on('open', () => {
      conn.send({
        type: 'INIT_SYNC',
        mode: NET.mode,
        diff: NET.pveDifficulty,
        enemyFront: ACTIVE_ROSTER.enemyFront,
        enemyBack: ACTIVE_ROSTER.enemyBack
      });
      startNetPreparation();
    });
  });

  NET.peer.on('error', (err) => { alert('建立房間失敗: ' + err); });
}

function joinRoom() {
  const inputCode = document.getElementById('join-room-input').value.trim().toUpperCase();
  if (inputCode.length !== 6) {
    document.getElementById('join-status-text').innerText = '請輸入 6 碼代碼！';
    return;
  }
  document.getElementById('join-status-text').innerText = '連線中...';

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
        NET.pveDifficulty = data.diff || 5;
        if (NET.mode === 'COOP') {
          NET.mySlot = 1;
          NET.mateSlot = 0;
          NET.myTeam = 'LEFT';
          if (data.enemyFront) ACTIVE_ROSTER.enemyFront = data.enemyFront;
          if (data.enemyBack) ACTIVE_ROSTER.enemyBack = data.enemyBack;
        } else {
          NET.mySlot = 2;
          NET.mateSlot = 3;
          NET.myTeam = 'RIGHT';
        }
        startNetPreparation();
      }
    });
  });

  NET.peer.on('error', () => {
    document.getElementById('join-status-text').innerText = '找不到該房間代碼！';
  });
}

function setupDataConnection() {
  NET.conn.on('data', (data) => {
    if (data.type === 'INPUT') {
      NET.remoteKeys = data.keys;
    } else if (data.type === 'STATE_SYNC') {
      applyWorldSync(data);
    } else if (data.type === 'CALLOUT_SYNC') {
      calloutPopups.push({ x: data.x, y: data.y - 28, text: data.text, color: data.color, timer: 45, maxTimer: 45 });
} else if (data.type === 'MANGA_SHOUT_SYNC') {
      if (typeof triggerMangaShout === 'function') {
        triggerMangaShout(data.speaker, data.text, data.sub, data.color);
      }
    } else if (data.type === 'LOBBY_SELECT_UPDATE') {
      handleRemoteLobbyUpdate(data);
    } else if (data.type === 'READY_CHECK') {
      handleRemoteReady(data);
    } else if (data.type === 'START_MATCH') {
      finalizeNetStart();
    } else if (data.type === 'MATCH_SETTLEMENT') {
      proMatchStats = data.stats;
      score = data.score;
      openSettlement(data.winnerSide);
    } else if (data.type === 'REMATCH_PREP') {
      document.getElementById('settlement-modal').style.display = 'none';
      isSettlementOpen = false;
      startNetPreparation();
    } else if (data.type === 'PEER_QUIT') {
      alert('⚠️ 對手已退出比賽，正在返回主選單...');
      location.reload();
    }
  });

  NET.conn.on('close', () => {
    if (netPrepTimer) clearInterval(netPrepTimer);
    alert('⚠️ 與對手的連線已中斷！正在返回主選單...');
    location.reload();
  });
}

// ========================================================
// 🪞 試衣化妝間 (支援全背包角色換裝)
// ========================================================
let wbSelectedCharId = 'c1', wbCategory = 'hats', wbPage = 0;

function openWardrobeModal() {
  document.getElementById('start-menu-modal').style.display = 'none';
  document.getElementById('wardrobe-modal').style.display = 'flex';

  const sel = document.getElementById('wb-char-select');
  sel.innerHTML = '';
  INVENTORY.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = `[${c.tier}] ${c.name} (Lv.${c.level})`;
    if (c.id === wbSelectedCharId) opt.selected = true;
    sel.appendChild(opt);
  });

  renderWardrobeUI();
  runWardrobePreviewLoop();
}

function onWardrobeCharChange(charId) {
  wbSelectedCharId = charId;
  renderWardrobeUI();
}

function closeWardrobeModal() {
  document.getElementById('wardrobe-modal').style.display = 'none';
  document.getElementById('start-menu-modal').style.display = 'flex';
  if (typeof allPlayers !== 'undefined') allPlayers.forEach(p => p.rebind(true));
  saveGameData();
}

function switchWardrobeCategory(cat) {
  wbCategory = cat;
  wbPage = 0;
  document.getElementById('wb-tab-hats').className = `btn-sound ${cat === 'hats' ? 'active' : ''}`;
  document.getElementById('wb-tab-faces').className = `btn-sound ${cat === 'faces' ? 'active' : ''}`;
  document.getElementById('wb-tab-effects').className = `btn-sound ${cat === 'effects' ? 'active' : ''}`;
  renderWardrobeUI();
}

function changeWardrobePage(delta) {
  const list = COSMETICS_DB[wbCategory];
  const maxPages = Math.ceil(list.length / 9);
  wbPage = Math.max(0, Math.min(maxPages - 1, wbPage + delta));
  renderWardrobeUI();
}

function renderWardrobeUI() {
  const currentCard = INVENTORY.find(c => c.id === wbSelectedCharId) || INVENTORY[0];
  if (!currentCard.cosmetics) currentCard.cosmetics = { hat: 'hat_none', face: 'face_none', effect: 'fx_none' };

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
  const currentCard = INVENTORY.find(c => c.id === wbSelectedCharId) || INVENTORY[0];
  currentCard.cosmetics = { hat: 'hat_none', face: 'face_none', effect: 'fx_none' };
  renderWardrobeUI();
}

function runWardrobePreviewLoop() {
  const cvs = document.getElementById('wardrobe-preview-canvas');
  if (!cvs || document.getElementById('wardrobe-modal').style.display !== 'flex') return;
  const pCtx = cvs.getContext('2d');
  pCtx.clearRect(0, 0, cvs.width, cvs.height);

  const card = INVENTORY.find(c => c.id === wbSelectedCharId) || INVENTORY[0];
  const dummyPlayer = {
    x: 110, y: 160, radius: 36, color: card.color,
    facing: 1, squashX: 1, squashY: 1, isDiving: false, isBlocking: false,
    card: card
  };

  drawPlayerEntity(dummyPlayer, pCtx);
  requestAnimationFrame(runWardrobePreviewLoop);
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
  const spinnerMsg = document.getElementById('spinner-msg');
  if (spinner) {
    if (spinnerMsg) spinnerMsg.innerText = isTen ? '🎰 十連球探招募中...' : '🎰 球探招募中...';
    spinner.style.display = 'flex';
  }
  playSound('coin');

  setTimeout(() => {
    if (spinner) spinner.style.display = 'none';
    if (!isTen) {
      const result = rollSingleCard();
      saveGameData();

      const dupBadge = document.getElementById('gacha-dup-badge');
      const rewardMsg = document.getElementById('gacha-reward-msg');
      if (dupBadge) {
        if (result.isDup) {
          dupBadge.style.display = 'block';
          dupBadge.innerText = '重複突破';
          if (rewardMsg) rewardMsg.innerText = `🔄 ${result.resultMsg}`;
        } else {
          dupBadge.style.display = 'none';
          if (rewardMsg) rewardMsg.innerText = result.resultMsg;
        }
      }

      const ava = document.getElementById('gacha-avatar');
      if (ava) ava.style.backgroundColor = result.template.color;

      const tierEl = document.getElementById('gacha-tier');
      if (tierEl) {
        tierEl.innerText = result.template.tier;
        tierEl.style.color = result.template.tier === 'SSR' ? '#facc15' : (result.template.tier === 'SR' ? '#c084fc' : (result.template.tier === 'R' ? '#f97316' : '#94a3b8'));
      }

      const nameEl = document.getElementById('gacha-name');
      if (nameEl) nameEl.innerText = result.template.name;

// 🌟 動態掛載對應階級發光 class (n, r, sr, ssr)
    const stageEl = document.getElementById('gacha-card-stage');
    if (stageEl) {
      stageEl.className = result.template.tier.toLowerCase();
      // 重新觸發彈出動畫
      stageEl.style.animation = 'none';
      stageEl.offsetHeight; // 強制重繪
      stageEl.style.animation = '';
    }

      const featEl = document.getElementById('gacha-feature');
      if (featEl) featEl.innerText = result.template.desc;

      const animModal = document.getElementById('gacha-anim-modal');
      if (animModal) animModal.style.display = 'flex';
      else alert(`🎉 成功抽得：[${result.template.tier}] ${result.template.name}！已收入名冊更衣室。`);
    } else {
      const results = [];
      for (let i = 0; i < 10; i++) results.push(rollSingleCard());
      saveGameData();

const grid = document.getElementById('ten-gacha-grid');
      if (grid) {
        grid.innerHTML = '';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        grid.style.gap = '14px';
        grid.style.margin = '18px 0';

        results.forEach(res => {
          const tier = res.template.tier;
          const tierLower = tier.toLowerCase();
          const item = document.createElement('div');
          // 🌟 使用獨立的卡牌插槽 class
          item.className = `ten-card-slot ${tierLower}`;
          
          let tierColor = '#94a3b8';
          if (tier === 'SSR') tierColor = '#facc15';
          else if (tier === 'SR') tierColor = '#c084fc';
          else if (tier === 'R') tierColor = '#38bdf8';

          item.innerHTML = `
            <div style="width: 52px; height: 52px; border-radius: 50%; background: ${res.template.color}; border: 2.5px solid #fff; margin-bottom: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
            <strong style="font-size: 13px; font-weight: 900; color: ${tierColor}; letter-spacing: 0.5px;">[${tier}] ${res.template.name}</strong>
            <span style="font-size: 10px; color: ${res.isDup ? '#f97316' : '#10b981'}; margin-top: 4px; font-weight: bold;">${res.resultMsg}</span>
          `;
          grid.appendChild(item);
        });
      }

      const tenModal = document.getElementById('gacha-ten-modal');
      if (tenModal) tenModal.style.display = 'flex';
      else alert('🎉 十連抽完成！新角色與突破 EXP 已全數存入更衣室名冊。');
    }
  }, 400);
}

function updateCoinHUD() {
  const cd = document.getElementById('coin-display');
  if (cd) cd.innerText = userCoins;
  const acd = document.getElementById('arcade-coin-display');
  if (acd) acd.innerText = userCoins;
}

function closeGachaAnim() { document.getElementById('gacha-anim-modal').style.display = 'none'; }
function closeTenGachaModal() { document.getElementById('gacha-ten-modal').style.display = 'none'; }

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
  if (typeof resetMatchState === 'function') resetMatchState();
  ball.resetForServe('LEFT');
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
    const ava = document.getElementById('menu-card-avatar');
    const tier = document.getElementById('menu-card-tier');
    const name = document.getElementById('menu-card-name');
    const desc = document.getElementById('menu-card-desc');
    const sil = document.getElementById('hero-sil-1');

    if (ava) ava.style.backgroundColor = h.color;
    if (tier) {
      tier.innerText = h.tier;
      tier.style.color = h.tier === 'SSR' ? '#facc15' : '#c084fc';
    }
    if (name) name.innerText = h.name;
    if (desc) desc.innerText = h.desc;
    if (sil) sil.style.backgroundColor = h.color;
  }, 6000);});

window.addEventListener('DOMContentLoaded', () => {
  const audioFileInput = document.getElementById('audio-file');
  if (audioFileInput) {
    audioFileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) {
        customAudio.src = URL.createObjectURL(f);
        customAudio.play().then(() => {
          isAudioLoaded = true;
          const btn = document.getElementById('btn-bgm');
          if (btn) { btn.innerText = 'BGM: 播放中'; btn.style.background = '#10b981'; }
        });
      }
    });
  }
});