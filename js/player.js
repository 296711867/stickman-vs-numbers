/* ============================================================
 * 火柴人（玩家）—— 移动 / 心血 / 受击 / 荧光粉笔小人绘制
 * ============================================================ */
'use strict';

function needXp(l) { return Math.floor(3 + l * 3 + Math.pow(l, 1.7)); }

function makePlayer() {
  return {
    x: ARENA_W / 2, y: ARENA_H / 2, r: 15,
    hearts: 5, maxHearts: 5, iframes: 0,
    spd: 245, face: 1, walkT: 0, moving: false,
    xp: 0, lvl: 1, need: needXp(1),
    weapons: [{ id: 'pencil', lv: 1, cd: 0.6, ang: 0, sweepT: 0 }],
    passives: {},
    /* 被动聚合出的实时属性（recomputeStats 更新） */
    atkMul: 1, areaMul: 1, magR: 72, luck: 1, crit: 0, hasShield: false, shieldUp: false, shieldCd: 0,
    slowFactor: 1,           // 被减号兵/水洼减速时的系数
    hurtFx: 0, deadT: -1,
  };
}

/* 由被动等级重算实时属性 */
function recomputeStats() {
  const p = player.passives;
  player.atkMul = Math.pow(0.88, p.atk || 0);
  player.areaMul = 1 + 0.15 * (p.area || 0);
  player.magR = 72 * (1 + 0.4 * (p.magnet || 0));
  player.spd = 245 * (1 + 0.08 * (p.speed || 0));
  player.luck = 1 + 0.35 * (p.luck || 0);
  player.crit = 0.08 * (p.crit || 0);
  player.hasShield = (p.shield || 0) > 0;
  if (player.hasShield && player.shieldUp === undefined) player.shieldUp = true;
}

function updatePlayer(dt) {
  const P = player;
  if (P.deadT >= 0) { P.deadT += dt; return; }
  /* ---- 移动输入：键盘 + 虚拟摇杆 ---- */
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  const jv = joyVec();
  if (jv) { mx += jv.x; my += jv.y; }
  const ml = Math.hypot(mx, my);
  P.moving = ml > 0.05;
  if (P.moving) {
    if (ml > 1) { mx /= ml; my /= ml; }
    /* 减速：减号兵光环 & 沼泽水洼 */
    let sf = 1;
    for (const e of enemies) {
      if (e.kind === 'minus' && dist2(e.x, e.y, P.x, P.y) < 110 * 110) { sf = 0.6; break; }
    }
    if (sf === 1) {
      for (const pd of puddles) {
        if (dist2(pd.x, pd.y, P.x, P.y) < pd.r * pd.r) { sf = 0.6; break; }
      }
    }
    P.slowFactor = sf;
    P.x += mx * P.spd * sf * dt;
    P.y += my * P.spd * sf * dt;
    if (Math.abs(mx) > 0.1) P.face = mx > 0 ? 1 : -1;
    P.walkT += dt * (sf < 1 ? 6 : 9);
  }
  P.x = clampN(P.x, 40, ARENA_W - 40);
  P.y = clampN(P.y, 40, ARENA_H - 40);

  P.iframes = Math.max(0, P.iframes - dt);
  P.hurtFx = Math.max(0, P.hurtFx - dt);
  /* 护盾充能 */
  if (P.hasShield && !P.shieldUp) {
    P.shieldCd -= dt;
    if (P.shieldCd <= 0) { P.shieldUp = true; ringFx(P.x, P.y - 18, 10, 42, 0.4, [120, 220, 255], 3); sfx.shield(); }
  }
}

/* 受击（n 点心血）；来源坐标用于击退方向 */
function hurtPlayer(n, sx, sy) {
  const P = player;
  if (P.iframes > 0 || P.deadT >= 0) return;
  if (P.hasShield && P.shieldUp) {
    P.shieldUp = false; P.shieldCd = 18;
    ringFx(P.x, P.y - 18, 44, 8, 0.35, [120, 220, 255], 4);
    popText(P.x, P.y - 46, '护盾抵挡!', [120, 220, 255], 18);
    P.iframes = 0.8; sfx.shield(); addShake(4);
    return;
  }
  P.hearts -= n;
  P.iframes = 1.25;
  P.hurtFx = 0.35;
  if (sx !== undefined) {
    const d = Math.max(1, Math.hypot(P.x - sx, P.y - sy));
    P.x += (P.x - sx) / d * 26; P.y += (P.y - sy) / d * 26;
  }
  addShake(9); addFlash(0.32, [255, 60, 70]);
  burst(P.x, P.y - 16, [255, 70, 90], 10, 150);
  popText(P.x, P.y - 50, '-1♥', [255, 90, 110], 22);
  sfx.hurt();
  if (P.hearts <= 0) {
    P.hearts = 0; P.deadT = 0; slowmoT = 1.1;
    burst(P.x, P.y - 20, [235, 235, 235], 26, 220);
    dustBurst(P.x, P.y - 20, 16);
    sfx.lose();
  }
}

/* ---------- 荧光粉笔火柴人（伪俯视：正面小人 + 影子） ---------- */
function drawPlayer() {
  const P = player;
  if (P.deadT >= 0 && P.deadT > 0.25) return;   // 碎裂后消失
  /* 影子 */
  noStroke(); fill(0, 0, 0, 90);
  ellipse(P.x, P.y + 14, 34, 10);
  if (P.iframes > 0 && frameNo % 8 < 3) return; // 受击无敌闪烁

  const walking = P.moving && P.deadT < 0;
  const bob = walking ? Math.abs(Math.sin(P.walkT)) * 2.5 : Math.sin(frameNo * 0.05) * 1.2;
  const bx = P.x, by = P.y - 20 - bob;
  const lunge = walking ? Math.sin(P.walkT) * 4 : 0;

  let col = [240, 240, 245];
  if (P.hurtFx > 0) col = [255, 90, 100];
  if (P.deadT >= 0) col = [180, 180, 190];

  push();
  glowOn(col, 12);
  stroke(col[0], col[1], col[2]); strokeWeight(3.4); strokeCap(ROUND); noFill();
  /* 腿 */
  const legA = walking ? Math.sin(P.walkT) * 6 * P.face : 2 * P.face;
  line(bx, by + 12, bx + legA, by + 26);
  line(bx, by + 12, bx - legA, by + 26);
  /* 身体 */
  line(bx, by + 12, bx, by - 4);
  /* 手臂：跑动前后摆，待机微张 */
  const armA = walking ? -Math.sin(P.walkT) * 7 : 4;
  line(bx, by - 1, bx + (armA + 3) * P.face + lunge * 0.4, by + 6);
  line(bx, by - 1, bx - (armA + 3) * P.face, by + 6);
  /* 头 + 眼睛 */
  fill(col[0], col[1], col[2]);
  circle(bx, by - 11, 13);
  glowOff();
  fill(8, 10, 12);
  circle(bx + 4.5 * P.face + P.face, by - 11, 4.4);
  circle(bx + 4.5 * P.face - P.face * 1.6, by - 11, 4.4);
  /* 受击汗滴 */
  if (P.hurtFx > 0) {
    stroke(120, 220, 255); strokeWeight(2); noFill();
    circle(bx + 9 * P.face, by - 20, 4);
  }
  glowOff();
  pop();

  /* 护盾环 */
  if (P.hasShield && P.shieldUp) {
    push(); noFill();
    stroke(120, 220, 255, 150 + Math.sin(frameNo * 0.15) * 50); strokeWeight(2.2);
    circle(P.x, P.y - 18, 52 + Math.sin(frameNo * 0.1) * 3);
    pop();
  }
}
