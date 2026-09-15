// ========================================================
// 畫面繪圖層：球員外觀、紙娃娃配件、表情、吊燈、雷達與主渲染
// ========================================================
function drawPlayerEntity(player, targetCtx) {
  const cosmetics = (player.card && player.card.cosmetics) ? player.card.cosmetics : { hat: 'hat_none', face: 'face_none', effect: 'fx_none' };
  const effectObj = (typeof COSMETICS_DB !== 'undefined') ? COSMETICS_DB.effects.find(e => e.id === cosmetics.effect) : null;
  const glowColor = effectObj ? effectObj.glow : null;

  // 1. 拖曳微粒殘影
  if (player.ghostTrail && player.ghostTrail.length > 0) {
    player.ghostTrail.forEach(t => {
      targetCtx.save();
      targetCtx.translate(t.x, t.y);
      if (t.isDiving) targetCtx.scale(t.facing * 1.6, 0.6);
      else targetCtx.scale(t.squashX, t.squashY);
      targetCtx.beginPath();
      targetCtx.arc(0, -player.radius, player.radius, 0, Math.PI * 2);
      targetCtx.fillStyle = player.color;
      targetCtx.globalAlpha = Math.max(0, t.alpha * 0.25);
      targetCtx.fill();
      targetCtx.restore();
    });
  }

  // 2. 本體繪製
  targetCtx.save();
  targetCtx.translate(player.x, player.y);
  if (player.isDiving) targetCtx.scale(player.facing * 1.6, 0.6);
  else targetCtx.scale(player.squashX, player.squashY);

  if (glowColor) {
    targetCtx.shadowColor = glowColor;
    targetCtx.shadowBlur = 18;
  }

  targetCtx.beginPath();
  targetCtx.arc(0, -player.radius, player.radius, 0, Math.PI * 2);
  targetCtx.fillStyle = player.color;
  targetCtx.fill();
  targetCtx.lineWidth = 3;
  targetCtx.strokeStyle = glowColor || '#fff';
  targetCtx.stroke();
  targetCtx.shadowBlur = 0;

  if (player.isBlocking) {
    targetCtx.save();
    targetCtx.strokeStyle = '#facc15'; targetCtx.lineWidth = 6; targetCtx.beginPath();
    const hx = player.isLeft ? 15 : -15;
    targetCtx.moveTo(hx, -player.radius * 2); targetCtx.lineTo(hx, -player.radius * 2 - 20); targetCtx.stroke();
    targetCtx.beginPath();
    targetCtx.arc(hx, -player.radius * 2 - 10, 18, -Math.PI * 0.45, Math.PI * 0.45, !player.isLeft);
    targetCtx.stroke(); targetCtx.restore();
  }

  // 3. 臉部五官與配件
  if (!player.isDiving) {
    const eyeX = player.facing * 8;
    targetCtx.fillStyle = 'rgba(244, 114, 182, 0.6)'; targetCtx.beginPath();
    targetCtx.arc(eyeX - 7, -player.radius + 6, 4, 0, Math.PI * 2);
    targetCtx.arc(eyeX + 7, -player.radius + 6, 4, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = '#1e1b4b'; targetCtx.beginPath();
    targetCtx.arc(eyeX - 5, -player.radius, 3.5, 0, Math.PI * 2);
    targetCtx.arc(eyeX + 5, -player.radius, 3.5, 0, Math.PI * 2);
    targetCtx.fill();

    // 臉飾完整向量繪製
    const fId = cosmetics.face;
    if (fId === 'face_mustache') {
      targetCtx.fillStyle = '#475569';
      targetCtx.beginPath();
      targetCtx.ellipse(eyeX - 6, -player.radius + 5, 6, 2.5, -0.3, 0, Math.PI * 2);
      targetCtx.ellipse(eyeX + 6, -player.radius + 5, 6, 2.5, 0.3, 0, Math.PI * 2);
      targetCtx.fill();
    } else if (fId === 'face_goatee') {
      targetCtx.fillStyle = '#94a3b8';
      targetCtx.beginPath();
      targetCtx.ellipse(eyeX - 7, -player.radius + 5, 7, 2.5, -0.3, 0, Math.PI * 2);
      targetCtx.ellipse(eyeX + 7, -player.radius + 5, 7, 2.5, 0.3, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.beginPath();
      targetCtx.moveTo(eyeX - 3, -player.radius + 6);
      targetCtx.lineTo(eyeX + 3, -player.radius + 6);
      targetCtx.lineTo(eyeX, -player.radius + 18);
      targetCtx.closePath(); targetCtx.fill();
    } else if (fId === 'face_spiral_glasses') {
      targetCtx.strokeStyle = '#000'; targetCtx.lineWidth = 2.2;
      [-7, 7].forEach(ox => {
        targetCtx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.25) {
          const r = a * 1.1;
          targetCtx.lineTo(eyeX + ox + Math.cos(a) * r, -player.radius + Math.sin(a) * r);
        }
        targetCtx.stroke();
      });
      targetCtx.beginPath(); targetCtx.moveTo(eyeX - 3, -player.radius); targetCtx.lineTo(eyeX + 3, -player.radius); targetCtx.stroke();
    } else if (fId === 'face_shades') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.fillRect(eyeX - 14, -player.radius - 3, 28, 8);
    } else if (fId === 'face_mask') {
      targetCtx.fillStyle = '#ffffff';
      targetCtx.fillRect(eyeX - 10, -player.radius + 2, 20, 11);
    } else if (fId === 'face_ruby_earring') {
      targetCtx.fillStyle = '#ef4444';
      targetCtx.beginPath(); targetCtx.arc(eyeX - player.radius * 0.8, -player.radius, 3, 0, Math.PI * 2); targetCtx.fill();
    } else if (fId === 'face_bandage') {
      targetCtx.fillStyle = '#fde047';
      targetCtx.fillRect(eyeX - 6, -player.radius + 2, 12, 4);
    } else if (fId === 'face_cigar') {
      targetCtx.fillStyle = '#78350f'; targetCtx.fillRect(eyeX + 2, -player.radius + 6, 8, 3);
      targetCtx.fillStyle = '#ef4444'; targetCtx.fillRect(eyeX + 10, -player.radius + 6, 2, 3);
    } else if (fId === 'face_eye_patch') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.beginPath(); targetCtx.arc(eyeX - 5, -player.radius, 5.5, 0, Math.PI * 2); targetCtx.fill();
    } else if (fId === 'face_bubble_gum') {
      targetCtx.fillStyle = '#f472b6';
      targetCtx.beginPath(); targetCtx.arc(eyeX + 6, -player.radius + 5, 6.5, 0, Math.PI * 2); targetCtx.fill();
    } else if (fId === 'face_blush') {
      targetCtx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      targetCtx.beginPath(); targetCtx.arc(eyeX - 8, -player.radius + 6, 5, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.arc(eyeX + 8, -player.radius + 6, 5, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.strokeStyle = '#dc2626'; targetCtx.lineWidth = 1;
      [-8, 8].forEach(bx => {
        targetCtx.beginPath();
        targetCtx.moveTo(eyeX + bx - 3, -player.radius + 8); targetCtx.lineTo(eyeX + bx - 1, -player.radius + 4);
        targetCtx.moveTo(eyeX + bx, -player.radius + 8); targetCtx.lineTo(eyeX + bx + 2, -player.radius + 4);
        targetCtx.stroke();
      });
    } else if (fId === 'face_monocle') {
      targetCtx.strokeStyle = '#facc15'; targetCtx.lineWidth = 2;
      targetCtx.beginPath(); targetCtx.arc(eyeX + 5, -player.radius, 6, 0, Math.PI * 2); targetCtx.stroke();
      targetCtx.beginPath(); targetCtx.moveTo(eyeX + 9, -player.radius + 4);
      targetCtx.quadraticCurveTo(eyeX + 14, -player.radius + 14, eyeX + 8, -player.radius + 20); targetCtx.stroke();
    } else if (fId === 'face_fox_mask') {
      targetCtx.fillStyle = '#fff';
      targetCtx.beginPath();
      targetCtx.ellipse(eyeX - 7, -player.radius - 2, 9, 13, -0.2, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.strokeStyle = '#dc2626'; targetCtx.lineWidth = 1.5;
      targetCtx.beginPath();
      targetCtx.moveTo(eyeX - 11, -player.radius - 4); targetCtx.lineTo(eyeX - 5, -player.radius);
      targetCtx.moveTo(eyeX - 10, -player.radius); targetCtx.lineTo(eyeX - 6, -player.radius + 4);
      targetCtx.stroke();
    } else if (fId === 'face_scuba') {
      targetCtx.strokeStyle = '#38bdf8'; targetCtx.lineWidth = 2.5;
      targetCtx.beginPath(); targetCtx.moveTo(eyeX + 2, -player.radius + 6);
      targetCtx.lineTo(eyeX + 12, -player.radius + 6);
      targetCtx.lineTo(eyeX + 14, -player.radius - 12); targetCtx.stroke();
      targetCtx.fillStyle = '#0284c7'; targetCtx.fillRect(eyeX + 12, -player.radius - 14, 4, 3);
    } else if (fId === 'face_vr') {
      targetCtx.fillStyle = '#1e293b'; targetCtx.fillRect(eyeX - 14, -player.radius - 6, 28, 12);
      targetCtx.fillStyle = '#06b6d4'; targetCtx.fillRect(eyeX - 12, -player.radius - 2, 24, 4);
      targetCtx.strokeStyle = '#38bdf8'; targetCtx.lineWidth = 1; targetCtx.strokeRect(eyeX - 14, -player.radius - 6, 28, 12);
    } else if (fId === 'face_clown_nose') {
      targetCtx.fillStyle = '#ef4444';
      targetCtx.beginPath(); targetCtx.arc(eyeX, -player.radius + 3, 5.5, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.fillStyle = '#fff'; targetCtx.beginPath(); targetCtx.arc(eyeX - 1.5, -player.radius + 1.5, 1.5, 0, Math.PI * 2); targetCtx.fill();
    } else if (fId === 'face_rose') {
      targetCtx.strokeStyle = '#15803d'; targetCtx.lineWidth = 2;
      targetCtx.beginPath(); targetCtx.moveTo(eyeX + 2, -player.radius + 6); targetCtx.lineTo(eyeX + 16, -player.radius + 8); targetCtx.stroke();
      targetCtx.fillStyle = '#e11d48';
      targetCtx.beginPath(); targetCtx.arc(eyeX + 16, -player.radius + 8, 4.5, 0, Math.PI * 2); targetCtx.fill();
    } else if (fId === 'face_scar') {
      targetCtx.strokeStyle = '#991b1b'; targetCtx.lineWidth = 2;
      targetCtx.beginPath(); targetCtx.moveTo(eyeX - 5, -player.radius - 8); targetCtx.lineTo(eyeX - 5, -player.radius + 8); targetCtx.stroke();
      targetCtx.lineWidth = 1;
      for (let sy = -6; sy <= 6; sy += 4) {
        targetCtx.beginPath(); targetCtx.moveTo(eyeX - 7, -player.radius + sy); targetCtx.lineTo(eyeX - 3, -player.radius + sy); targetCtx.stroke();
      }
    } else if (fId === 'face_toast') {
      targetCtx.fillStyle = '#b45309'; targetCtx.fillRect(eyeX + 2, -player.radius + 4, 15, 10);
      targetCtx.fillStyle = '#fef08a'; targetCtx.fillRect(eyeX + 3.5, -player.radius + 5.5, 12, 7);
    } else if (fId === 'face_gas_mask') {
      targetCtx.fillStyle = '#1e293b';
      targetCtx.beginPath(); targetCtx.arc(eyeX, -player.radius + 7, 7, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.strokeStyle = '#64748b'; targetCtx.lineWidth = 1.5;
      targetCtx.stroke();
      targetCtx.beginPath(); targetCtx.moveTo(eyeX - 5, -player.radius + 7); targetCtx.lineTo(eyeX + 5, -player.radius + 7); targetCtx.stroke();
    }

    // 頭飾完整向量繪製
    const hId = cosmetics.hat;
    if (hId === 'hat_santa') {
      targetCtx.fillStyle = '#dc2626';
      targetCtx.beginPath();
      targetCtx.moveTo(-16, -player.radius * 1.6);
      targetCtx.quadraticCurveTo(-4, -player.radius * 2.5, 12, -player.radius * 2.3);
      targetCtx.lineTo(16, -player.radius * 1.6);
      targetCtx.closePath(); targetCtx.fill();
      targetCtx.fillStyle = '#fff';
      targetCtx.beginPath(); targetCtx.arc(14, -player.radius * 2.3, 4.5, 0, Math.PI * 2); targetCtx.fill();
      for (let bx = -16; bx <= 16; bx += 5.5) {
        targetCtx.beginPath(); targetCtx.arc(bx, -player.radius * 1.65, 3.5, 0, Math.PI * 2); targetCtx.fill();
      }
    } else if (hId === 'hat_tophat') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.fillRect(-18, -player.radius * 1.7, 36, 4);
      targetCtx.fillRect(-11, -player.radius * 2.4, 22, 24);
      targetCtx.fillStyle = '#ef4444';
      targetCtx.fillRect(-11, -player.radius * 1.8, 22, 3);
    } else if (hId === 'hat_sprout') {
      targetCtx.strokeStyle = '#22c55e'; targetCtx.lineWidth = 2.5;
      targetCtx.beginPath(); targetCtx.moveTo(0, -player.radius * 1.7); targetCtx.lineTo(0, -player.radius * 2.1); targetCtx.stroke();
      targetCtx.fillStyle = '#22c55e';
      targetCtx.beginPath(); targetCtx.ellipse(-4, -player.radius * 2.2, 5, 2.5, -0.5, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.ellipse(4, -player.radius * 2.2, 5, 2.5, 0.5, 0, Math.PI * 2); targetCtx.fill();
    } else if (hId === 'hat_party') {
      targetCtx.fillStyle = '#facc15';
      targetCtx.beginPath(); targetCtx.moveTo(-10, -player.radius * 1.7); targetCtx.lineTo(0, -player.radius * 2.5); targetCtx.lineTo(10, -player.radius * 1.7); targetCtx.closePath(); targetCtx.fill();
    } else if (hId === 'hat_crown') {
      targetCtx.fillStyle = '#facc15';
      targetCtx.beginPath();
      targetCtx.moveTo(-10, -player.radius * 1.7);
      targetCtx.lineTo(-12, -player.radius * 2.1); targetCtx.lineTo(-5, -player.radius * 1.9);
      targetCtx.lineTo(0, -player.radius * 2.3);
      targetCtx.lineTo(5, -player.radius * 1.9); targetCtx.lineTo(12, -player.radius * 2.1);
      targetCtx.lineTo(10, -player.radius * 1.7);
      targetCtx.closePath(); targetCtx.fill();
    } else if (hId === 'hat_cat') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.beginPath(); targetCtx.moveTo(-14, -player.radius * 1.6); targetCtx.lineTo(-10, -player.radius * 2.3); targetCtx.lineTo(-4, -player.radius * 1.8); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.moveTo(14, -player.radius * 1.6); targetCtx.lineTo(10, -player.radius * 2.3); targetCtx.lineTo(4, -player.radius * 1.8); targetCtx.fill();
    } else if (hId === 'hat_rabbit') {
      targetCtx.fillStyle = '#ffffff';
      targetCtx.beginPath(); targetCtx.ellipse(-7, -player.radius * 2.2, 4, 12, -0.1, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.ellipse(7, -player.radius * 2.2, 4, 12, 0.1, 0, Math.PI * 2); targetCtx.fill();
    } else if (hId === 'hat_cap_red' || hId === 'hat_cap_blue' || hId === 'hat_cap_black') {
      targetCtx.fillStyle = hId === 'hat_cap_red' ? '#ef4444' : (hId === 'hat_cap_blue' ? '#3b82f6' : '#0f172a');
      targetCtx.beginPath(); targetCtx.arc(0, -player.radius * 1.6, 14, Math.PI, 0); targetCtx.fill();
      targetCtx.fillRect(player.facing === 1 ? 0 : -20, -player.radius * 1.6, 20, 3.5);
    } else if (hId === 'hat_halo') {
      targetCtx.strokeStyle = '#fef08a'; targetCtx.lineWidth = 2.5;
      targetCtx.beginPath(); targetCtx.ellipse(0, -player.radius * 2.2, 12, 4, 0, 0, Math.PI * 2); targetCtx.stroke();
    } else if (hId === 'hat_pompadour') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.beginPath();
      targetCtx.moveTo(-12, -player.radius * 1.6);
      targetCtx.quadraticCurveTo(player.facing * 18, -player.radius * 2.5, player.facing * 20, -player.radius * 1.9);
      targetCtx.quadraticCurveTo(player.facing * 10, -player.radius * 1.5, 0, -player.radius * 1.6);
      targetCtx.closePath(); targetCtx.fill();
    } else if (hId === 'hat_afro') {
      targetCtx.fillStyle = '#1e293b';
      targetCtx.beginPath();
      targetCtx.arc(0, -player.radius * 1.9, 18, 0, Math.PI * 2); targetCtx.fill();
    } else if (hId === 'hat_head_shades') {
      targetCtx.fillStyle = '#0f172a';
      targetCtx.fillRect(-12, -player.radius * 1.9, 24, 6);
      targetCtx.fillStyle = '#38bdf8'; targetCtx.fillRect(-9, -player.radius * 1.8, 8, 3); targetCtx.fillRect(1, -player.radius * 1.8, 8, 3);
    } else if (hId === 'hat_helmet') {
      targetCtx.fillStyle = '#64748b';
      targetCtx.beginPath(); targetCtx.arc(0, -player.radius * 1.4, 16, Math.PI, 0); targetCtx.fill();
      targetCtx.fillStyle = '#0f172a'; targetCtx.fillRect(-12, -player.radius * 1.5, 24, 4);
    } else if (hId === 'hat_dog') {
      targetCtx.fillStyle = '#d97706';
      targetCtx.beginPath(); targetCtx.ellipse(-12, -player.radius * 1.7, 5, 10, -0.4, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.ellipse(12, -player.radius * 1.7, 5, 10, 0.4, 0, Math.PI * 2); targetCtx.fill();
    } else if (hId === 'hat_devil') {
      targetCtx.fillStyle = '#dc2626';
      targetCtx.beginPath(); targetCtx.moveTo(-11, -player.radius * 1.6); targetCtx.quadraticCurveTo(-14, -player.radius * 2.2, -7, -player.radius * 2.2); targetCtx.lineTo(-5, -player.radius * 1.6); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.moveTo(11, -player.radius * 1.6); targetCtx.quadraticCurveTo(14, -player.radius * 2.2, 7, -player.radius * 2.2); targetCtx.lineTo(5, -player.radius * 1.6); targetCtx.fill();
    } else if (hId === 'hat_viking') {
      targetCtx.fillStyle = '#94a3b8'; targetCtx.beginPath(); targetCtx.arc(0, -player.radius * 1.6, 14, Math.PI, 0); targetCtx.fill();
      targetCtx.fillStyle = '#f8fafc';
      targetCtx.beginPath(); targetCtx.moveTo(-12, -player.radius * 1.7); targetCtx.quadraticCurveTo(-20, -player.radius * 2.3, -15, -player.radius * 2.4); targetCtx.lineTo(-10, -player.radius * 1.9); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.moveTo(12, -player.radius * 1.7); targetCtx.quadraticCurveTo(20, -player.radius * 2.3, 15, -player.radius * 2.4); targetCtx.lineTo(10, -player.radius * 1.9); targetCtx.fill();
    } else if (hId === 'hat_chef') {
      targetCtx.fillStyle = '#ffffff';
      targetCtx.fillRect(-11, -player.radius * 1.8, 22, 6);
      targetCtx.beginPath(); targetCtx.arc(-7, -player.radius * 2.1, 7, 0, Math.PI * 2); targetCtx.arc(0, -player.radius * 2.3, 8, 0, Math.PI * 2); targetCtx.arc(7, -player.radius * 2.1, 7, 0, Math.PI * 2); targetCtx.fill();
    } else if (hId === 'hat_bandana') {
      targetCtx.fillStyle = '#fff'; targetCtx.fillRect(-15, -player.radius * 1.7, 30, 6);
      targetCtx.fillStyle = '#dc2626'; targetCtx.beginPath(); targetCtx.arc(0, -player.radius * 1.7 + 3, 2.5, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.fillStyle = '#fff';
      targetCtx.beginPath(); targetCtx.moveTo(-15, -player.radius * 1.7); targetCtx.lineTo(-21, -player.radius * 1.4); targetCtx.lineTo(-15, -player.radius * 1.3); targetCtx.fill();
    } else if (hId === 'hat_straw') {
      targetCtx.fillStyle = '#fde047';
      targetCtx.beginPath(); targetCtx.ellipse(0, -player.radius * 1.65, 20, 5, 0, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.beginPath(); targetCtx.arc(0, -player.radius * 1.7, 10, Math.PI, 0); targetCtx.fill();
      targetCtx.fillStyle = '#dc2626'; targetCtx.fillRect(-10, -player.radius * 1.75, 20, 3);
    }
  }

  // 🌟 主控箭頭指標：動態鎖定本機操控者 (NET.mySlot)
  const isLocalControlled = (typeof NET !== 'undefined' && typeof NET.mySlot !== 'undefined')
    ? (player.slotIndex === NET.mySlot)
    : player.isUser;

  if (isLocalControlled) {
    targetCtx.fillStyle = '#facc15'; targetCtx.beginPath();
    targetCtx.moveTo(-7, -player.radius * 2 - 8); targetCtx.lineTo(7, -player.radius * 2 - 8); targetCtx.lineTo(0, -player.radius * 2);
    targetCtx.fill();
  }
  targetCtx.restore();

  drawPlayerStatusEmotes(player, targetCtx);

  if (player.swingTimer > 0) {
    targetCtx.save();
    targetCtx.translate(player.x, player.y - player.radius * 1.3);
    const progress = 1 - (player.swingTimer / 12);
    const topAngle = -Math.PI * 0.38, bottomAngle = Math.PI * 0.28;
    const currentStart = topAngle + (bottomAngle - topAngle) * Math.max(0, progress - 0.3);
    const currentEnd = topAngle + (bottomAngle - topAngle) * progress;

    targetCtx.beginPath();
    if (player.facing === 1) targetCtx.arc(0, 0, 68, currentStart, currentEnd, false);
    else targetCtx.arc(0, 0, 68, Math.PI - currentStart, Math.PI - currentEnd, true);

    targetCtx.strokeStyle = `rgba(244, 63, 94, ${player.swingTimer / 12})`;
    targetCtx.lineWidth = 14; targetCtx.lineCap = 'round'; targetCtx.stroke();
    targetCtx.strokeStyle = `rgba(255, 255, 255, ${(player.swingTimer / 12) * 0.85})`;
    targetCtx.lineWidth = 4; targetCtx.stroke(); targetCtx.restore();
  }

  if (player.thrustTimer > 0) {
    targetCtx.save();
    const startX = player.x + (player.facing * player.radius);
    const startY = player.y - player.radius * 1.1;
    const endX = player.thrustTargetX || (startX + player.facing * 75);
    const endY = player.thrustTargetY || startY;
    const alpha = player.thrustTimer / 12;

    targetCtx.beginPath(); targetCtx.moveTo(startX, startY); targetCtx.lineTo(endX, endY);
    targetCtx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.9})`;
    targetCtx.lineWidth = 6; targetCtx.lineCap = 'round'; targetCtx.stroke(); targetCtx.restore();
  }
}

function drawPlayerStatusEmotes(player, targetCtx) {
  targetCtx.save();
  if (player.jumpExhaustion < 0.70) {
    const dropOffset = (gameFrame * 0.8) % 12;
    targetCtx.fillStyle = '#38bdf8'; targetCtx.beginPath();
    targetCtx.arc(player.x + 16, player.y - player.radius * 2 + dropOffset, 2.5, 0, Math.PI * 2);
    targetCtx.fill();
  }
  if (player.depressedRallies > 0) {
    targetCtx.strokeStyle = '#4338ca'; targetCtx.lineWidth = 2.0; targetCtx.beginPath();
    for (let lx = -10; lx <= 10; lx += 5) {
      targetCtx.moveTo(player.x + lx, player.y - player.radius * 2 - 30);
      targetCtx.lineTo(player.x + lx, player.y - player.radius * 2 - 12);
    }
    targetCtx.stroke();
  }
  if (player.excitedRallies > 0) {
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const steamY = (gameFrame * 0.6) % 16;
    targetCtx.beginPath();
    targetCtx.arc(player.x - 6, player.y - player.radius * 2 - 18 - steamY, 3.5, 0, Math.PI * 2);
    targetCtx.arc(player.x + 6, player.y - player.radius * 2 - 22 - steamY, 4.5, 0, Math.PI * 2);
    targetCtx.fill();
  }

  if (player.mudDebuffTimer > 0) {
    targetCtx.fillStyle = '#78350f'; targetCtx.beginPath();
    targetCtx.arc(player.x - 6, player.y - player.radius * 1.8, 5, 0, Math.PI * 2);
    targetCtx.arc(player.x + 8, player.y - player.radius * 1.7, 4.5, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.strokeStyle = '#451a03'; targetCtx.lineWidth = 3; targetCtx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const dripX = player.x + (i * 12);
      const dripProgress = ((gameFrame * 0.8) + (i * 8)) % 22;
      targetCtx.beginPath();
      targetCtx.moveTo(dripX, player.y - player.radius);
      targetCtx.lineTo(dripX, player.y - player.radius + dripProgress);
      targetCtx.stroke();
      targetCtx.beginPath();
      targetCtx.arc(dripX, player.y - player.radius + dripProgress + 2, 2, 0, Math.PI * 2);
      targetCtx.fill();
    }
  }

  if (player.softWallRallies > 0) {
    targetCtx.strokeStyle = '#2dd4bf'; targetCtx.lineWidth = 2.5;
    targetCtx.beginPath();
    targetCtx.arc(player.x, player.y - player.radius, player.radius * 1.5, 0, Math.PI * 2);
    targetCtx.stroke();
  }

  if (player.godspeedCharges > 0) {
    targetCtx.strokeStyle = '#eab308'; targetCtx.lineWidth = 2.0;
    const boltAng = (gameFrame * 0.25) % (Math.PI * 2);
    targetCtx.beginPath();
    targetCtx.arc(player.x, player.y - player.radius, player.radius * 1.35, boltAng, boltAng + 2.5);
    targetCtx.stroke();
  }

  if (player.greaseDebuffRallies > 0) {
    targetCtx.fillStyle = '#0f172a';
    const oilDrip = (gameFrame * 0.7) % 18;
    targetCtx.beginPath();
    targetCtx.arc(player.x - 4, player.y - player.radius * 2 + oilDrip, 3, 0, Math.PI * 2);
    targetCtx.arc(player.x + 8, player.y - player.radius * 1.6 + (oilDrip * 0.8), 2.5, 0, Math.PI * 2);
    targetCtx.fill();
  }
  targetCtx.restore();
}

function drawStadiumAtmosphere() {
  ctx.save();
  ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(WORLD.WIDTH, 40);
  ctx.moveTo(0, 80); ctx.lineTo(WORLD.WIDTH, 80); ctx.stroke();

  ctx.strokeStyle = '#312e81'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = 0; x < WORLD.WIDTH; x += 60) {
    ctx.moveTo(x, 40); ctx.lineTo(x + 30, 80); ctx.lineTo(x + 60, 40);
  }
  ctx.stroke();

  const lampXs = [WORLD.LEFT - 120, WORLD.LEFT + 320, WORLD.RIGHT - 320, WORLD.RIGHT + 120];
  lampXs.forEach(lx => {
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lx, 80); ctx.lineTo(lx, 120); ctx.stroke();
    ctx.fillStyle = '#0f172a'; ctx.beginPath();
    ctx.moveTo(lx - 24, 134); ctx.lineTo(lx + 24, 134); ctx.lineTo(lx + 12, 120); ctx.lineTo(lx - 12, 120);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(lx, 134, 6, 0, Math.PI); ctx.fill();

    const coneGrad = ctx.createLinearGradient(lx, 134, lx, WORLD.FLOOR_Y);
    coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    coneGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.10)');
    coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0.00)');
    ctx.fillStyle = coneGrad; ctx.beginPath();
    ctx.moveTo(lx - 18, 134); ctx.lineTo(lx + 18, 134);
    ctx.lineTo(lx + 240, WORLD.FLOOR_Y); ctx.lineTo(lx - 240, WORLD.FLOOR_Y);
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}

function drawRadarBubble(realX, realY, color, isBall = false, isUser = false, entityRadius = 24) {
  if (isNaN(realX) || isNaN(realY)) return;
  const screenX = realX - camera.x, screenY = realY - camera.y;
  const isCompletelyOff = (screenX + entityRadius < 0 || screenX - entityRadius > VIEW_W || screenY + entityRadius < 0 || screenY - entityRadius > VIEW_H);
  if (!isCompletelyOff) return;

  const distOffscreen = Math.hypot(Math.max(0, -screenX, screenX - VIEW_W), Math.max(0, -screenY, screenY - VIEW_H));
  const scale = Math.min(2.5, 1.0 + (distOffscreen / 120) * 0.65);
  const baseR = isBall ? 15 : 18, bubbleR = baseR * scale, pointerLen = 12 * scale;
  const pad = Math.max(38, bubbleR + 12);
  const clampX = Math.max(pad, Math.min(VIEW_W - pad, screenX));
  const clampY = Math.max(pad, Math.min(VIEW_H - pad, screenY));
  const angle = Math.atan2(screenY - clampY, screenX - clampX);

  ctx.save(); ctx.translate(clampX, clampY);
  ctx.save(); ctx.rotate(angle); ctx.beginPath();
  ctx.arc(0, 0, bubbleR, 0.45, Math.PI * 2 - 0.45); ctx.lineTo(bubbleR + pointerLen, 0); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = Math.max(2.5, 3.5 * (scale * 0.65)); ctx.strokeStyle = '#0f172a'; ctx.stroke();
  ctx.restore();

  if (isBall) {
    const ballCoreR = bubbleR * 0.65;
    ctx.save(); ctx.rotate(ball.rotation); ctx.beginPath(); ctx.arc(0, 0, ballCoreR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.8 * scale; ctx.strokeStyle = '#1e1b4b'; ctx.stroke();
    ctx.fillStyle = ball.isPerfectSpike ? '#ef4444' : '#38bdf8'; ctx.beginPath(); ctx.arc(0, 0, ballCoreR, -0.5, 0.8); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, ballCoreR, 1.8, 3.0); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
  } else {
    const playerCoreR = bubbleR * 0.65;
    ctx.beginPath(); ctx.arc(0, 0, playerCoreR, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.8 * scale; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    if (isUser) {
      ctx.fillStyle = '#facc15'; ctx.beginPath();
      ctx.moveTo(-5 * scale, -4 * scale); ctx.lineTo(5 * scale, -4 * scale); ctx.lineTo(0, 4 * scale);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

function renderDebugTerminal() {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'; ctx.fillRect(15, 15, 480, 470);
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.0; ctx.strokeRect(15, 15, 480, 470);
  ctx.font = 'bold 11px "Courier New", monospace'; ctx.fillStyle = '#22c55e';
  ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 3;

  let y = 34;
  const line = (txt, color = '#22c55e') => { ctx.fillStyle = color; ctx.fillText(txt, 25, y); y += 15; };
  const ballSpeed = Math.hypot(ball.vx, ball.vy).toFixed(2);
  line(`=== [DEBUG MONITOR: ON (KEY: B)] ===`, '#4ade80');
  line(`FRAME: ${gameFrame} | PAUSED: ${isPaused ? 1 : 0} | CHRONO_SLOW: ${timeSlowTimer > 0 ? timeSlowTimer : 0} (${chronoCasterSide})`);
  line(`--------------------------------------------------------`, '#15803d');
  line(`[HISTORICAL PEAKS] MAX_SPEED: ${maxRecordedSpeed.toFixed(2)} px/f | MAX_SPIN: ${maxRecordedSpin.toFixed(2)}`);
  line(`[LAST CAST SKILL] ${lastCastSkillName} (at frame: ${lastCastFrame > 0 ? lastCastFrame : '-'})`, '#facc15');
  line(`[BLOCK RIGIDITY MONITOR] EFF_RIGIDITY: ${lastBlockDebug.effectiveRigidity.toFixed(1)} | VS_SPD: ${lastBlockDebug.incomingSpeed.toFixed(1)}`);
  line(` AP_REDUCE: -${lastBlockDebug.ap.toFixed(1)} | BROKEN: ${lastBlockDebug.isBroken ? 'YES' : 'NO'}`);
  line(`--------------------------------------------------------`, '#15803d');
  line(`[BALL RUNTIME] POS : X=${ball.x.toFixed(1)}, Y=${ball.y.toFixed(1)}`);
  line(` VEL : Vx=${ball.vx.toFixed(2)}, Vy=${ball.vy.toFixed(2)} | SPD : ${ballSpeed} px/f`);
  line(` HITTER : ${ball.lastHitter ? ball.lastHitter.name : 'null'}`);
  line(` ACTIVE_TAG: ${ball.activeSkillTag || 'NORMAL'}`, '#86efac');
  ctx.restore();
}

function renderChronoAnimation() {
  if (chronoAnimTimer <= 0) return;
  ctx.save();
  const centerX = 800, centerY = 250, radius = 160;
  ctx.translate(centerX, centerY);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 6; ctx.stroke();
  ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 30;

  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * (radius - 18), Math.sin(ang) * (radius - 18));
    ctx.lineTo(Math.cos(ang) * (radius - 6), Math.sin(ang) * (radius - 6));
    ctx.stroke();
  }

  const progress = 1 - (chronoAnimTimer / 28);
  const revAngle = -progress * Math.PI * 2;
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(revAngle) * (radius * 0.75), Math.sin(revAngle) * (radius * 0.75)); ctx.stroke();
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(revAngle * 0.1) * (radius * 0.5), Math.sin(revAngle * 0.1) * (radius * 0.5)); ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.save();
  
  // 體力條讀取本機主控 (NET.mySlot)
  const myPlayer = (typeof allPlayers !== 'undefined' && typeof NET !== 'undefined')
    ? (allPlayers[NET.mySlot] || userPlayer)
    : userPlayer;

  const pExh = myPlayer.jumpExhaustion;
  staminaFill.style.width = (pExh * 100) + '%';
  if (pExh > 0.8) staminaFill.style.backgroundColor = '#10b981';
  else if (pExh > 0.55) staminaFill.style.backgroundColor = '#facc15';
  else staminaFill.style.backgroundColor = '#ef4444';

  if (screenShakeTimer > 0) {
    screenShakeTimer--;
    ctx.translate((Math.random() - 0.5) * screenShakeIntensity, (Math.random() - 0.5) * screenShakeIntensity);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 🌟 WebRTC 訪客視角鏡像翻轉 (PVP 模式下)
  const isGuestMirror = (typeof NET !== 'undefined' && NET.isMultiplayer && !NET.isHost && NET.mode === 'PVP');
  if (isGuestMirror) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  // ==========================================
  // 1. 世界座標層（受相機平移影響）
  // ==========================================
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawStadiumAtmosphere();

  ctx.fillStyle = '#78350f'; ctx.fillRect(0, WORLD.FLOOR_Y, WORLD.WIDTH, 230);
  ctx.fillStyle = '#d97706'; ctx.fillRect(WORLD.LEFT, WORLD.FLOOR_Y, WORLD.RIGHT - WORLD.LEFT, 230);

  ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(WORLD.LEFT, WORLD.FLOOR_Y + 16); ctx.lineTo(WORLD.RIGHT, WORLD.FLOOR_Y + 16);
  ctx.moveTo(WORLD.LEFT, WORLD.FLOOR_Y + 32); ctx.lineTo(WORLD.RIGHT, WORLD.FLOOR_Y + 32); ctx.stroke();
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(WORLD.LEFT, WORLD.FLOOR_Y, WORLD.RIGHT - WORLD.LEFT, 2);

  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath();
  const leftAttackX = WORLD.NET_X - WORLD.ATTACK_LINE_DIST, rightAttackX = WORLD.NET_X + WORLD.ATTACK_LINE_DIST;
  ctx.moveTo(leftAttackX, WORLD.FLOOR_Y); ctx.lineTo(leftAttackX, WORLD.FLOOR_Y + 45);
  ctx.moveTo(rightAttackX, WORLD.FLOOR_Y); ctx.lineTo(rightAttackX, WORLD.FLOOR_Y + 45);
  ctx.stroke();

  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 8]); ctx.beginPath();
  ctx.moveTo(WORLD.LEFT, WORLD.FLOOR_Y - 160); ctx.lineTo(WORLD.LEFT, WORLD.FLOOR_Y);
  ctx.moveTo(WORLD.RIGHT, WORLD.FLOOR_Y - 160); ctx.lineTo(WORLD.RIGHT, WORLD.FLOOR_Y);
  ctx.stroke(); ctx.setLineDash([]);

  ctx.fillStyle = '#fef08a'; ctx.fillRect(WORLD.NET_X - WORLD.NET_W/2, WORLD.NET_TOP_Y, WORLD.NET_W, WORLD.NET_H);
  ctx.fillStyle = '#facc15'; ctx.fillRect(WORLD.NET_X - WORLD.NET_W/2 - 2, WORLD.NET_TOP_Y, WORLD.NET_W + 4, 8);

  for (let i = haloEffects.length - 1; i >= 0; i--) {
    const h = haloEffects[i];
    ctx.save(); ctx.beginPath(); ctx.arc(h.player.x, h.player.y - h.player.radius, h.r, 0, Math.PI * 2);
    ctx.strokeStyle = h.color; ctx.globalAlpha = Math.max(0, h.alpha); ctx.lineWidth = 4.0;
    ctx.stroke(); ctx.restore();
    h.r += (h.maxR - h.r) * 0.22; h.alpha -= (1.0 / h.life);
    if (h.alpha <= 0) haloEffects.splice(i, 1);
  }

  visualEffects.forEach(fx => {
    ctx.save();
    if (fx.type === 'shockwave') {
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.strokeStyle = fx.color; ctx.globalAlpha = Math.max(0, fx.alpha); ctx.lineWidth = 4; ctx.stroke();
    } else if (fx.type === 'spark') {
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = fx.color; ctx.globalAlpha = fx.life / fx.maxLife; ctx.fill();
    } else if (fx.type === 'mud_drop') {
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.size * (fx.life / fx.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = fx.color; ctx.globalAlpha = Math.min(1.0, fx.life / 10); ctx.fill();
    } else if (fx.type === 'skin_mote') {
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.size * (fx.life / fx.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = Math.min(0.8, fx.life / fx.maxLife);
      ctx.fill();
    }
    ctx.restore();
  });

  allPlayers.forEach(p => p.draw(ctx));

  // 發球蓄力條：動態對齊當前發球員
  if (serveState.charging && serveState.currentServer) {
    const s = serveState.currentServer;
    ctx.fillStyle = '#1e1b4b'; ctx.fillRect(s.x - 20, s.y - s.radius * 2 - 24, 40, 6);
    ctx.fillStyle = '#facc15'; ctx.fillRect(s.x - 20, s.y - s.radius * 2 - 24, (serveState.chargePower / 100) * 40, 6);
  }

  if (!isNaN(ball.x) && !isNaN(ball.y)) {
    ctx.save(); ctx.globalAlpha = ball.opacity;
    ctx.translate(ball.x, ball.y); ctx.rotate(ball.rotation);

    if (ball.glowColor) { ctx.shadowColor = ball.glowColor; ctx.shadowBlur = 35; }
    else if (ball.isPerfectSpike || ball.isSkyComet) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 30; }
    else if (ball.isSpiked) { ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 20; }

    ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#312e81'; ctx.stroke();
    ctx.fillStyle = ball.glowColor ? ball.glowColor : (ball.isSkyComet ? '#facc15' : (ball.isPerfectSpike ? '#ef4444' : (ball.isSpiked ? '#f43f5e' : '#38bdf8')));
    ctx.beginPath(); ctx.arc(0, 0, ball.radius, -0.5, 0.8); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, ball.radius, 1.8, 3.0); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
  }

  // 🌟 文字呼喊與跳幣：鏡像模式下二次翻轉文字，防止鏡像反字
  for (let i = calloutPopups.length - 1; i >= 0; i--) {
    const pop = calloutPopups[i];
    pop.timer--; pop.y -= 0.6;
    ctx.save();
    ctx.translate(pop.x, pop.y);
    if (isGuestMirror) ctx.scale(-1, 1);
    ctx.font = '900 24px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, pop.timer / 15);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color; ctx.fillText(pop.text, 0, 0);
    ctx.restore();
    if (pop.timer <= 0) calloutPopups.splice(i, 1);
  }

  for (let i = coinPopups.length - 1; i >= 0; i--) {
    const cp = coinPopups[i];
    cp.timer--; cp.y -= 0.8;
    ctx.save();
    ctx.translate(cp.x, cp.y);
    if (isGuestMirror) ctx.scale(-1, 1);
    ctx.font = '900 20px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, cp.timer / 15);
    ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3; ctx.strokeText(`+${cp.amount} 🪙`, 0, 0);
    ctx.fillStyle = '#facc15'; ctx.fillText(`+${cp.amount} 🪙`, 0, 0);
    ctx.restore();
    if (cp.timer <= 0) coinPopups.splice(i, 1);
  }

  if (timeSlowTimer > 0) {
    ctx.save(); ctx.fillStyle = 'rgba(15, 23, 42, 0.30)';
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT); ctx.restore();
  }

  ctx.restore(); // 結束世界座標層

  // ==========================================
  // 2. 螢幕視窗層（不受相機位移影響）
  // ==========================================
  renderChronoAnimation();
  allPlayers.forEach(p => {
    const isLocal = (typeof NET !== 'undefined' && typeof NET.mySlot !== 'undefined') ? (p.slotIndex === NET.mySlot) : p.isUser;
    drawRadarBubble(p.x, p.y - p.radius, p.color, false, isLocal, p.radius);
  });
  if (!isNaN(ball.x) && !isNaN(ball.y)) drawRadarBubble(ball.x, ball.y, '#facc15', true, false, ball.radius);

  // 🌟 得分/出界全域橫幅
  if (banner.active) {
    ctx.save();
    if (isGuestMirror) {
      ctx.translate(800, 215);
      ctx.scale(-1, 1);
      ctx.translate(-800, -215);
    }
    ctx.fillStyle = 'rgba(30, 27, 75, 0.95)';
    ctx.fillRect(350, 160, 900, 110);
    ctx.strokeStyle = banner.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(350, 160, 900, 110);
    ctx.shadowColor = banner.color;
    ctx.shadowBlur = 25;
    ctx.fillStyle = banner.color;
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(banner.mainText, 800, 212);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(banner.subText, 800, 248);
    ctx.restore();
  }

  if (debugHitbox) renderDebugTerminal();

  if (isGuestMirror) {
    ctx.restore(); // 還原鏡像翻轉
  }

  ctx.restore(); // 還原畫布最頂層 save
}