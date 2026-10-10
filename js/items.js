/* ============================================================
 * 掉落物 —— 粉笔屑(经验) + 概率道具（幸运提升掉率）
 * ============================================================ */
'use strict';

const DROP_TABLE = [
  { type: 'milk', p: 0.030, name: '牛奶', col: [235, 245, 255] },
  { type: 'magnet', p: 0.015, name: '磁铁', col: [255, 90, 130] },
  { type: 'clock', p: 0.012, name: '时钟', col: [120, 220, 255] },
  { type: 'bombI', p: 0.012, name: '黑板擦', col: [255, 130, 80] },
  { type: 'gift', p: 0.010, name: '礼盒', col: [255, 214, 0] },
  { type: 'heart', p: 0.004, name: '红心', col: [255, 64, 96] },
];
function dropName(t) { const d = DROP_TABLE.find(d => d.type === t); return d ? d.name : t; }
function dropCol(t) { const d = DROP_TABLE.find(d => d.type === t); return d ? d.col : [255, 255, 255]; }

function rollOnce() {
  const r = Math.random();
  let acc = 0;
  for (const d of DROP_TABLE) {
    const p = d.p * player.luck;
    if (r < acc + p) return d.type;
    acc += p;
  }
  return null;
}
function rollDrop(e) {
  const times = e.kind === 'elite' ? 3 : 1;
  for (let k = 0; k < times; k++) {
    const t = rollOnce();
    if (t) {
      if (drops.length > 24) drops.shift();
      drops.push({ type: t, x: e.x + rnd(-10, 10), y: e.y + rnd(-10, 10), t: 0, life: 30 });
    }
  }
}

/* ---------- 粉笔屑（经验） ---------- */
let lastPickSfx = 0;
function updateDusts(dt) {
  for (let i = dusts.length - 1; i >= 0; i--) {
    const d = dusts[i];
    const dx = player.x - d.x, dy = player.y - d.y, dd = Math.hypot(dx, dy) || 1;
    if (d.attract || dd < player.magR) {
      d.vx += dx / dd * 1500 * dt; d.vy += dy / dd * 1500 * dt;
      const sp = Math.hypot(d.vx, d.vy);
      if (sp > 760) { d.vx = d.vx / sp * 760; d.vy = d.vy / sp * 760; }
    } else {
      d.vx *= Math.max(0, 1 - 5 * dt); d.vy *= Math.max(0, 1 - 5 * dt);
    }
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (dd < 22) {
      dusts.splice(i, 1);
      addXp(1);
      const now = performance.now();
      if (now - lastPickSfx > 70) { sfx.pick(); lastPickSfx = now; }
    }
  }
  if (dusts.length > 300) dusts.splice(0, dusts.length - 300);
}
function drawDusts() {
  push(); noStroke();
  for (const d of dusts) {
    if (!inView(d.x, d.y, 30)) continue;
    fill(255, 245, 200, 235);
    circle(d.x, d.y, 5.5);
    fill(255, 245, 200, 70);
    circle(d.x, d.y, 10);
  }
  pop();
}
function addXp(n) {
  player.xp += n * (player.xpMul || 1);
  while (player.xp >= player.need) {
    player.xp -= player.need;
    player.lvl++;
    player.need = needXp(player.lvl);
    play.pendingLv++;
    ringFx(player.x, player.y - 18, 12, 60, 0.5, [255, 214, 0], 3);
  }
  if (play.pendingLv > 0 && play.state === 'run') openLevelup();
}

/* ---------- 道具 ---------- */
function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt; d.life -= dt;
    if (d.life <= 0) { drops.splice(i, 1); continue; }
    if (player.deadT < 0 && dist2(d.x, d.y, player.x, player.y) < (player.r + 16) * (player.r + 16)) {
      applyDrop(d.type, d.x, d.y);
      drops.splice(i, 1);
    }
  }
}
function applyDrop(type, x, y) {
  const col = dropCol(type);
  popText(player.x, player.y - 54, dropName(type) + '!', col, 20);
  ringFx(x, y, 8, 40, 0.4, col, 3);
  switch (type) {
    case 'milk':
      if (player.hearts < player.maxHearts) { player.hearts++; sfx.heal(); }
      else {
        popText(player.x, player.y - 74, '已经满了，化作粉笔屑', [200, 210, 220], 13);
        for (let k = 0; k < 3; k++) dusts.push({ x, y, vx: rnd(-80, 80), vy: rnd(-80, 80), attract: true });
        sfx.pick();
      }
      break;
    case 'magnet':
      for (const d of dusts) d.attract = true;
      ringFx(player.x, player.y, 20, 420, 0.6, [255, 90, 130], 3);
      sfx.magnet();
      break;
    case 'clock':
      freezeT = 3;
      addFlash(0.25, [120, 220, 255]);
      sfx.clock(); sfx.freezeFx();
      break;
    case 'bombI':
      addShake(14); addFlash(0.4, [255, 240, 210]);
      sfx.boom();
      ringFx(player.x, player.y, 30, Math.max(VW, VH) * 0.8, 0.55, [255, 160, 100], 5);
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        hurtEnemy(e, e.kind === 'elite' ? 5 : 8, Math.atan2(e.y - player.y, e.x - player.x), 200, 0, false);
      }
      if (boss && boss.hp > 0) hurtBoss(3, false);
      break;
    case 'gift': {
      const up = player.weapons.filter(w => w.lv < 5);
      if (up.length) {
        const w = pick(up);
        w.lv++;
        if (player.weapons.some(x => x.lv >= 5)) grantAch('lv5');
        popText(player.x, player.y - 74, WDEF[w.id].name + ' Lv' + w.lv + '!', WDEF[w.id].col, 18);
        sfx.gift();
      } else {
        player.hearts = Math.min(player.maxHearts, player.hearts + 1);
        sfx.heal();
      }
      break;
    }
    case 'heart':
      if (player.maxHearts < 8) {
        player.maxHearts++;
        player.hearts = Math.min(player.maxHearts, player.hearts + 1);
        popText(player.x, player.y - 74, '心血上限 +1!', [255, 64, 96], 20);
      } else {
        player.hearts = Math.min(player.maxHearts, player.hearts + 2);
      }
      sfx.heartS();
      break;
  }
}
function drawDrops() {
  push(); textAlign(CENTER, CENTER);
  for (const d of drops) {
    if (!inView(d.x, d.y, 40)) continue;
    const bob = Math.sin(d.t * 4) * 4;
    const col = dropCol(d.type);
    if (d.life < 6 && frameNo % 20 < 8) continue;   // 即将消失：闪烁
    const sc = d.t < 0.25 ? d.t / 0.25 : 1;
    push(); translate(d.x, d.y + bob); scale(sc);
    glowOn(col, 12);
    noFill(); stroke(col[0], col[1], col[2], 120); strokeWeight(1.5);
    circle(0, 0, 34);
    drawIcon(d.type === 'bombI' ? 'bomb' : d.type, 0, 0, 26, col);
    glowOff();
    pop();
  }
  pop();
}
