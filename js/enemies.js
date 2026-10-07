/* ============================================================
 * 数字怪 —— 数字=血量，挨一下-1，减到0碎裂
 * 波次表驱动生成（每关 300 秒 + BOSS）
 * ============================================================ */
'use strict';

/* 怪物配色（按血量分层） */
function tierCol(hp) {
  if (hp <= 3) return [90, 255, 140];
  if (hp <= 6) return [90, 220, 255];
  return [255, 150, 120];
}
const KIND_COL = { plus: [110, 255, 140], minus: [100, 210, 255], mul: [255, 175, 80], div: [210, 130, 255], elite: [255, 214, 0], sqrt: [200, 140, 255], phi: [255, 200, 40], inf: [235, 235, 255], neg: [160, 210, 255], frac: [80, 255, 170], ghost: [225, 225, 245], sin: [140, 200, 255], cos: [205, 150, 255] };
const KIND_CHAR = { plus: '+', minus: '−', mul: '×', div: '÷', sqrt: '√', phi: 'φ', inf: '∞', neg: '−', frac: '½', ghost: '?', sin: '∫', cos: 'Σ' };

function spawnEnemy(kind, hp, x, y, opts) {
  opts = opts || {};
  let spd = 165 - hp * 9 + rnd(-12, 12);
  let r = 14 + hp * 1.1;
  if (kind === 'plus') { spd = 78; r = 17; }
  if (kind === 'minus') { spd = 72; r = 17; }
  if (kind === 'mul') { spd = 96; r = 16; }
  if (kind === 'div') { spd = 88; r = 15; }
  if (kind === 'elite') { spd = 52; r = 30; }
  if (kind === 'sqrt') { spd = 84; r = 16; }
  if (kind === 'phi') { spd = 150; r = 14; }
  if (kind === 'inf') { spd = 70; r = 18; }
  if (kind === 'neg') { spd = 105; r = 15; }
  if (kind === 'frac') { spd = 92; r = opts.child ? 11 : 16; }
  if (kind === 'ghost') { spd = 118; r = 14 + hp; }
  if (kind === 'sin') { spd = 86; r = 15; }
  if (kind === 'cos') { spd = 78; r = 16; }
  const e = {
    id: ++eid, kind, hp, maxHp: hp, x, y, r,
    spd, hitT: 0, slowT: 0, kbx: 0, kby: 0,
    shootCd: rnd(1.2, 2.4), orbDir: Math.random() < 0.5 ? 1 : -1, orbT: rnd(1.5, 3),
    chT: rnd(2, 4), chPhase: 'chase', chTm: 0, chDx: 0, chDy: 0,
    shT: rnd(1.5, 3), shieldUp: false, revived: false,
    child: !!opts.child, ch: opts.ch || null,
  };
  enemies.push(e);
  return e;
}

/* 屏幕外一圈生成位置 */
function spawnPosOut() {
  const d = Math.hypot(VW, VH) / 2 + 80;
  for (let k = 0; k < 6; k++) {
    const a = rnd(0, TWO_PI);
    const x = clampN(player.x + Math.cos(a) * d, 40, ARENA_W - 40);
    const y = clampN(player.y + Math.sin(a) * d, 40, ARENA_H - 40);
    if (dist2(x, y, player.x, player.y) > (d * 0.72) * (d * 0.72)) return { x, y };
  }
  return { x: clampN(player.x + d, 40, ARENA_W - 40), y: player.y };
}
function spawnOut(kind, hp) { const p = spawnPosOut(); return spawnEnemy(kind, hp, p.x, p.y); }
function spawnRing(n, kind, hp) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TWO_PI + rnd(-0.1, 0.1);
    const x = clampN(player.x + Math.cos(a) * 420, 40, ARENA_W - 40);
    const y = clampN(player.y + Math.sin(a) * 420, 40, ARENA_H - 40);
    spawnEnemy(kind, hp, x, y);
  }
}

/* ---------- 三关波次表 ---------- */
const LV_WAVES = {
  1: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 1, every: 1.6, n: 1 },
      { t0: 25, t1: 160, kind: 'num', hp: 2, every: 3.4, n: 2 },
      { t0: 60, t1: 300, kind: 'plus', hp: 4, every: 9, n: 1 },
      { t0: 130, t1: 300, kind: 'num', hp: 3, every: 2.7, n: 2 },
      { t0: 190, t1: 300, kind: 'num', hp: 5, every: 6.5, n: 1 },
      { t0: 240, t1: 300, kind: 'num', hp: 2, every: 1.5, n: 2 },
    ],
    events: [
      { t: 2, banner: '第一关 · 加号草原' },
      { t: 60, banner: '加号兵登场！它会给同伴回血，优先打！' },
      { t: 120, ring: { n: 14, kind: 'num', hp: 3 }, banner: '数字 3 环形合围！' },
      { t: 200, ring: { n: 18, kind: 'num', hp: 2 } },
      { t: 255, banner: '最后一波，守住！', ring: { n: 20, kind: 'num', hp: 3 } },
    ],
  },
  2: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 2, every: 1.5, n: 1 },
      { t0: 30, t1: 300, kind: 'num', hp: 3, every: 2.6, n: 2 },
      { t0: 50, t1: 300, kind: 'minus', hp: 4, every: 7.5, n: 1 },
      { t0: 80, t1: 300, kind: 'num', hp: 5, every: 4.5, n: 1 },
      { t0: 100, t1: 300, kind: 'div', hp: 3, every: 8, n: 1 },
      { t0: 150, t1: 300, kind: 'num', hp: 7, every: 7, n: 1 },
      { t0: 200, t1: 300, kind: 'num', hp: 6, every: 3.4, n: 2 },
    ],
    events: [
      { t: 2, banner: '第二关 · 减号沼泽' },
      { t: 50, banner: '减号兵登场！小心减速光环' },
      { t: 100, banner: '除号兵狙击手出现！' },
      { t: 115, ring: { n: 16, kind: 'num', hp: 4 } },
      { t: 170, elite: 10, banner: '精英 [10] 出现！' },
      { t: 235, ring: { n: 20, kind: 'num', hp: 5 } },
      { t: 272, elite: 10, ring: { n: 12, kind: 'num', hp: 3 } },
    ],
  },
  3: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 3, every: 1.4, n: 2 },
      { t0: 40, t1: 300, kind: 'num', hp: 5, every: 3.2, n: 2 },
      { t0: 70, t1: 300, kind: 'mul', hp: 4, every: 6.5, n: 1 },
      { t0: 100, t1: 300, kind: 'num', hp: 7, every: 5, n: 1 },
      { t0: 130, t1: 300, kind: 'div', hp: 4, every: 7, n: 1 },
      { t0: 160, t1: 300, kind: 'num', hp: 8, every: 6, n: 1 },
      { t0: 200, t1: 300, kind: 'mul', hp: 6, every: 5.5, n: 2 },
    ],
    events: [
      { t: 2, banner: '第三关 · 乘方王座' },
      { t: 70, banner: '乘号兵来袭！它会分裂，注意走位' },
      { t: 120, elite: 12, banner: '精英 [12] 出现！' },
      { t: 165, ring: { n: 18, kind: 'num', hp: 6 } },
      { t: 212, elite: 12, ring: { n: 14, kind: 'num', hp: 5 } },
      { t: 252, banner: '精英冲锋！', ring: { n: 10, kind: 'num', hp: 8 } },
      { t: 282, ring: { n: 22, kind: 'num', hp: 4 } },
    ],
  },
  4: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 4, every: 1.5, n: 1 },
      { t0: 30, t1: 300, kind: 'num', hp: 5, every: 2.6, n: 2 },
      { t0: 45, t1: 300, kind: 'sqrt', hp: 5, every: 7, n: 1 },
      { t0: 90, t1: 300, kind: 'num', hp: 7, every: 4.5, n: 1 },
      { t0: 130, t1: 300, kind: 'div', hp: 5, every: 7.5, n: 1 },
      { t0: 180, t1: 300, kind: 'num', hp: 8, every: 5.5, n: 1 },
      { t0: 220, t1: 300, kind: 'sqrt', hp: 7, every: 6, n: 1 },
    ],
    events: [
      { t: 2, banner: '第四关 · 根号深渊' },
      { t: 45, banner: '根号兵登场！护盾会弹开一次伤害' },
      { t: 120, ring: { n: 16, kind: 'num', hp: 5 } },
      { t: 170, elite: 20, banner: '精英 [20] 出现！' },
      { t: 240, banner: '深渊合围！', ring: { n: 18, kind: 'num', hp: 6 } },
      { t: 282, ring: { n: 20, kind: 'num', hp: 4 } },
    ],
  },
  5: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 5, every: 1.4, n: 2 },
      { t0: 35, t1: 300, kind: 'num', hp: 7, every: 2.8, n: 2 },
      { t0: 60, t1: 300, kind: 'phi', hp: 4, every: 5.5, n: 1 },
      { t0: 90, t1: 300, kind: 'num', hp: 8, every: 4.5, n: 1 },
      { t0: 120, t1: 300, kind: 'sqrt', hp: 6, every: 7, n: 1 },
      { t0: 150, t1: 300, kind: 'phi', hp: 6, every: 6, n: 2 },
      { t0: 200, t1: 300, kind: 'inf', hp: 10, every: 12, n: 1 },
    ],
    events: [
      { t: 2, banner: '第五关 · 黄金比例宫' },
      { t: 60, banner: 'φ兵登场！小心蛇形突进' },
      { t: 110, ring: { n: 16, kind: 'num', hp: 6 } },
      { t: 150, elite: 25, banner: '精英 [25] 出现！' },
      { t: 200, banner: '∞兵登场！它会复活一次！' },
      { t: 260, elite: 30, banner: '终极精英 [30]！', ring: { n: 14, kind: 'num', hp: 7 } },
      { t: 290, ring: { n: 22, kind: 'num', hp: 5 } },
    ],
  },
  6: {
    cont: [
      { t0: 0, t1: 300, kind: 'neg', hp: 3, every: 2.0, n: 1 },
      { t0: 25, t1: 300, kind: 'num', hp: 4, every: 1.6, n: 1 },
      { t0: 55, t1: 300, kind: 'neg', hp: 6, every: 3.4, n: 1 },
      { t0: 85, t1: 300, kind: 'mul', hp: 5, every: 7, n: 1 },
      { t0: 115, t1: 300, kind: 'num', hp: 7, every: 3.2, n: 2 },
      { t0: 150, t1: 300, kind: 'sqrt', hp: 6, every: 7.5, n: 1 },
      { t0: 190, t1: 300, kind: 'div', hp: 5, every: 8, n: 1 },
      { t0: 225, t1: 300, kind: 'neg', hp: 8, every: 5, n: 1 },
    ],
    events: [
      { t: 2, banner: '第六关 · 负数冰窟' },
      { t: 30, banner: '负数兵登场！它们免疫击退' },
      { t: 90, banner: '乘号兵混编，小心分裂', ring: { n: 12, kind: 'num', hp: 5 } },
      { t: 150, elite: 22, banner: '精英 [22] 出现！' },
      { t: 215, ring: { n: 18, kind: 'neg', hp: 5 }, banner: '负数合围！推不动它们！' },
      { t: 265, ring: { n: 16, kind: 'num', hp: 7 } },
      { t: 290, ring: { n: 18, kind: 'num', hp: 5 } },
    ],
  },
  7: {
    cont: [
      { t0: 0, t1: 300, kind: 'frac', hp: 4, every: 2.2, n: 1 },
      { t0: 25, t1: 300, kind: 'num', hp: 5, every: 1.5, n: 2 },
      { t0: 60, t1: 300, kind: 'frac', hp: 6, every: 3.6, n: 1 },
      { t0: 95, t1: 300, kind: 'num', hp: 8, every: 4.5, n: 1 },
      { t0: 130, t1: 300, kind: 'neg', hp: 6, every: 5, n: 1 },
      { t0: 165, t1: 300, kind: 'sqrt', hp: 7, every: 7.5, n: 1 },
      { t0: 200, t1: 300, kind: 'div', hp: 5, every: 8, n: 1 },
      { t0: 235, t1: 300, kind: 'num', hp: 9, every: 6, n: 1 },
    ],
    events: [
      { t: 2, banner: '第七关 · 分数裂谷' },
      { t: 40, banner: '分数兵 ½ 登场！会一分为二' },
      { t: 90, ring: { n: 14, kind: 'num', hp: 6 } },
      { t: 140, elite: 26, banner: '精英 [26] 出现！' },
      { t: 210, ring: { n: 16, kind: 'neg', hp: 5 }, banner: '负数合围！推不动！' },
      { t: 265, ring: { n: 18, kind: 'num', hp: 8 } },
      { t: 290, ring: { n: 20, kind: 'num', hp: 6 } },
    ],
  },
  8: {
    cont: [
      { t0: 0, t1: 300, kind: 'ghost', hp: 4, every: 1.8, n: 1 },
      { t0: 25, t1: 300, kind: 'num', hp: 6, every: 1.6, n: 1 },
      { t0: 60, t1: 300, kind: 'inf', hp: 8, every: 10, n: 1 },
      { t0: 100, t1: 300, kind: 'num', hp: 8, every: 3.5, n: 2 },
      { t0: 140, t1: 300, kind: 'sqrt', hp: 8, every: 7, n: 1 },
      { t0: 180, t1: 300, kind: 'ghost', hp: 7, every: 4, n: 2 },
      { t0: 220, t1: 300, kind: 'div', hp: 6, every: 8, n: 1 },
    ],
    events: [
      { t: 2, banner: '第八关 · 无穷回廊' },
      { t: 30, banner: '幻影数登场！打它就瞬移' },
      { t: 90, banner: '∞ 兵大潮！到处都会复活', ring: { n: 12, kind: 'num', hp: 6 } },
      { t: 150, elite: 28, banner: '精英 [28] 出现！' },
      { t: 215, ring: { n: 16, kind: 'ghost', hp: 5 }, banner: '幻影合围！' },
      { t: 265, ring: { n: 18, kind: 'num', hp: 8 } },
      { t: 290, ring: { n: 20, kind: 'num', hp: 6 } },
    ],
  },
  9: {
    cont: [
      { t0: 0, t1: 300, kind: 'sin', hp: 4, every: 2.4, n: 1 },
      { t0: 20, t1: 300, kind: 'num', hp: 6, every: 1.6, n: 1 },
      { t0: 55, t1: 300, kind: 'cos', hp: 5, every: 4.5, n: 1 },
      { t0: 90, t1: 300, kind: 'num', hp: 9, every: 5, n: 1 },
      { t0: 130, t1: 300, kind: 'sqrt', hp: 8, every: 7.5, n: 1 },
      { t0: 170, t1: 300, kind: 'sin', hp: 7, every: 4, n: 1 },
      { t0: 210, t1: 300, kind: 'neg', hp: 7, every: 5.5, n: 1 },
      { t0: 250, t1: 300, kind: 'cos', hp: 8, every: 4, n: 1 },
    ],
    events: [
      { t: 2, banner: '第九关 · 函数迷宫' },
      { t: 30, banner: '∫ 兵登场！弹道会拐弯' },
      { t: 55, banner: 'Σ 兵放环绕弹环，注意走位' },
      { t: 150, elite: 32, banner: '精英 [32] 出现！' },
      { t: 215, ring: { n: 14, kind: 'sin', hp: 5 }, banner: '弹幕迷宫！' },
      { t: 265, ring: { n: 16, kind: 'num', hp: 9 } },
      { t: 290, ring: { n: 18, kind: 'num', hp: 7 } },
    ],
  },
  10: {
    cont: [
      { t0: 0, t1: 300, kind: 'num', hp: 6, every: 1.4, n: 1 },
      { t0: 20, t1: 300, kind: 'plus', hp: 5, every: 7, n: 1 },
      { t0: 45, t1: 300, kind: 'minus', hp: 5, every: 8, n: 1 },
      { t0: 70, t1: 300, kind: 'mul', hp: 6, every: 7, n: 1 },
      { t0: 95, t1: 300, kind: 'div', hp: 5, every: 8, n: 1 },
      { t0: 120, t1: 300, kind: 'sqrt', hp: 8, every: 7, n: 1 },
      { t0: 145, t1: 300, kind: 'phi', hp: 5, every: 6, n: 1 },
      { t0: 170, t1: 300, kind: 'inf', hp: 10, every: 11, n: 1 },
      { t0: 195, t1: 300, kind: 'neg', hp: 8, every: 5.5, n: 1 },
      { t0: 220, t1: 300, kind: 'frac', hp: 7, every: 6, n: 1 },
      { t0: 245, t1: 300, kind: 'ghost', hp: 7, every: 4.5, n: 1 },
      { t0: 265, t1: 300, kind: 'sin', hp: 6, every: 4, n: 1 },
      { t0: 285, t1: 300, kind: 'cos', hp: 7, every: 4.5, n: 1 },
      { t0: 60, t1: 300, kind: 'num', hp: 9, every: 3.2, n: 2 },
    ],
    events: [
      { t: 2, banner: '最终关 · 零之原点' },
      { t: 30, banner: '前九关大军，全员复刻！' },
      { t: 100, ring: { n: 14, kind: 'num', hp: 7 } },
      { t: 150, elite: 40, banner: '终极精英 [40]！' },
      { t: 215, ring: { n: 14, kind: 'ghost', hp: 6 }, banner: '幻影合围！' },
      { t: 265, ring: { n: 16, kind: 'num', hp: 9 }, banner: '最后的大军！' },
      { t: 290, ring: { n: 20, kind: 'num', hp: 7 } },
    ],
  },
};

/* ---------- 生成器主循环 ---------- */
function updateSpawner(dt) {
  if (play.endless) { updateSpawnerEndless(dt); return; }
  const W = LV_WAVES[curLv];
  if (!W) return;
  for (let i = 0; i < W.cont.length; i++) {
    const c = W.cont[i];
    if (play.t < c.t0 || play.t > c.t1) continue;
    play.acc[i] = (play.acc[i] === undefined ? c.every : play.acc[i]) - dt;
    while (play.acc[i] <= 0) {
      if (enemies.length < 80) {
        for (let k = 0; k < c.n; k++) spawnOut(c.kind, c.hp);
      }
      play.acc[i] += c.every;
    }
  }
  for (const ev of W.events) {
    if (ev.done || play.t < ev.t) continue;
    ev.done = true;
    if (ev.banner) banner(ev.banner);
    if (ev.ring) spawnRing(ev.ring.n, ev.ring.kind, ev.ring.hp);
    if (ev.elite) { const p = spawnPosOut(); spawnEnemy('elite', ev.elite, p.x, p.y); sfx.roar(); }
    if (ev.ring || ev.elite) sfx.wave();
  }
  if (!play.bossDone && play.t >= 300 && !boss) {
    play.bossDone = true;
    banner('⚠ BOSS 来袭！');
    spawnBoss();
    sfx.boss(); addShake(10);
  }
}

/* ---------- 无尽模式刷怪器：300 秒一轮，轮轮加强 ---------- */
function updateSpawnerEndless(dt) {
  const p = play, r = p.round, rt = p.roundT;
  /* 轮内计时 + BOSS 触发（轮间隙不计时） */
  if (!boss || boss.hp <= 0) {
    if (p.interT > 0) { p.interT -= dt; return; }
    p.roundT += dt;
    if (p.roundT >= 300) {
      p.roundT = 300;
      banner('⚠ 第 ' + r + ' 轮 BOSS 来袭！');
      spawnBoss();
      sfx.boss(); addShake(10);
      return;
    }
  }
  /* 常规数字潮：血量与密度随轮数/轮内时间提升 */
  const hp = Math.min(11, 1 + Math.floor(rt / 35) + Math.floor((r - 1) * 0.8));
  p.eNum = (p.eNum === undefined ? 1.2 : p.eNum) - dt;
  if (p.eNum <= 0) {
    const n = 1 + (r >= 2 ? 1 : 0) + (rt > 150 ? 1 : 0);
    if (enemies.length < 90) for (let k = 0; k < n; k++) spawnOut('num', hp);
    p.eNum += Math.max(0.45, 1.7 - r * 0.12 - rt * 0.0022);
  }
  /* 符号怪混编：解锁随轮数推进 */
  p.eSym = (p.eSym === undefined ? 6 : p.eSym) - dt;
  if (p.eSym <= 0) {
    const pool = ['plus'];
    if (rt > 60 || r >= 2) pool.push('minus');
    if (rt > 100 || r >= 2) pool.push('mul', 'div');
    if (r >= 3) pool.push('sqrt');
    if (r >= 4) pool.push('phi');
    if (r >= 5) pool.push('inf');
    if (enemies.length < 90) spawnOut(pick(pool), Math.max(3, hp - 1));
    p.eSym += Math.max(4.5, 9 - r * 0.7);
  }
  /* 精英周期 */
  p.eElite = (p.eElite === undefined ? 45 : p.eElite) - dt;
  if (p.eElite <= 0) {
    spawnOut('elite', Math.min(30, 8 + r * 3 + Math.floor(rt / 60) * 2));
    banner('精英来袭！');
    sfx.roar();
    p.eElite = Math.max(24, 48 - r * 3);
  }
  /* 合围环周期 */
  p.eRing = (p.eRing === undefined ? 40 : p.eRing) - dt;
  if (p.eRing <= 0) {
    spawnRing(Math.min(22, 8 + r * 2), 'num', Math.max(2, hp));
    sfx.wave();
    p.eRing = Math.max(26, 42 - r * 2);
  }
}
function banner(txt) { play.banners.push({ txt, t: 2.4 }); }

/* 正弦波弹道弹：飞行路径按 sin 曲线横向摆动 */
function waveShot(x, y, ang, spd, A, F) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  projs.push({
    type: 'bshot', x, y, vx: ux * spd, vy: uy * spd,
    wave: true, sx: x, sy: y, ux, uy, nx: -uy, ny: ux, spd, len: 0,
    wt: rnd(0, TWO_PI), waveA: A, waveF: F,
    life: 4.5, char: '◦', col: [140, 200, 255], r: 8,
  });
}
function ringShot(x, y, ang, spd, col, r, ch) {
  projs.push({ type: 'bshot', x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 3.8, char: ch || '·', col, r: r || 7 });
}

/* ---------- 敌人更新 ---------- */
function updateEnemies(dt) {
  const spdMul = play.endless
    ? 1 + Math.min(0.9, (play.round - 1) * 0.13 + Math.min(1, play.roundT / 300) * 0.35)
    : 1 + Math.min(0.4, play.t / 300 * 0.35);
  /* 精英光环（加速周围小怪） */
  const elites = enemies.filter(e => e.kind === 'elite' && e.hp > 0);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) { enemies.splice(i, 1); continue; }
    e.hitT = Math.max(0, e.hitT - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    /* 根号兵护盾循环 */
    if (e.kind === 'sqrt') {
      e.shT -= dt;
      if (e.shT <= 0) {
        e.shieldUp = !e.shieldUp;
        e.shT = e.shieldUp ? 1.8 : 3.5;
        if (e.shieldUp) ringFx(e.x, e.y, e.r + 4, e.r + 18, 0.3, KIND_COL.sqrt, 2);
      }
    }
    if (freezeT > 0) continue;   // 被时钟冻结

    let spd = e.spd * spdMul * (e.slowT > 0 ? 0.5 : 1);
    for (const el of elites) {
      if (el !== e && dist2(el.x, el.y, e.x, e.y) < 140 * 140) { spd *= 1.25; break; }
    }
    let mx = 0, my = 0;
    const pdx = player.x - e.x, pdy = player.y - e.y, pd = Math.hypot(pdx, pdy) || 1;

    if (e.kind === 'div') {
      /* 远程：保持距离 + 环绕 + 射击 */
      e.orbT -= dt;
      if (e.orbT <= 0) { e.orbDir *= -1; e.orbT = rnd(1.5, 3); }
      if (pd > 300) { mx = pdx / pd; my = pdy / pd; }
      else if (pd < 220) { mx = -pdx / pd; my = -pdy / pd; }
      else { mx = -pdy / pd * e.orbDir; my = pdx / pd * e.orbDir; }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && pd < 620) {
        e.shootCd = rnd(2.4, 3.2);
        const a = Math.atan2(pdy, pdx);
        projs.push({ type: 'blade', x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 3.2 });
        tone(500, 0.08, 'sine', 0.02, -200);
      }
    } else if (e.kind === 'sin') {
      /* ∫ 兵：保持中距 + 发正弦波弹道弹 */
      e.orbT -= dt;
      if (e.orbT <= 0) { e.orbDir *= -1; e.orbT = rnd(1.4, 2.8); }
      if (pd > 340) { mx = pdx / pd; my = pdy / pd; }
      else if (pd < 250) { mx = -pdx / pd; my = -pdy / pd; }
      else { mx = -pdy / pd * e.orbDir; my = pdx / pd * e.orbDir; }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && pd < 660) {
        e.shootCd = rnd(2.4, 3.2);
        const a = Math.atan2(pdy, pdx);
        waveShot(e.x, e.y, a, 260, 46, 5.5);
        waveShot(e.x, e.y, a + 0.35, 260, 46, 5.5);
        tone(620, 0.1, 'sine', 0.03, 240);
      }
    } else if (e.kind === 'cos') {
      /* Σ 兵：贴近后放环绕弹环 */
      if (pd > 300) { mx = pdx / pd; my = pdy / pd; }
      else if (pd < 210) { mx = -pdx / pd * 0.7; my = -pdy / pd * 0.7; }
      e.shootCd -= dt;
      if (e.shootCd <= 0 && pd < 430) {
        e.shootCd = rnd(3.0, 3.8);
        const n2 = 6, base = rnd(0, TWO_PI);
        for (let k = 0; k < n2; k++) ringShot(e.x, e.y, base + (k / n2) * TWO_PI, 135, KIND_COL.cos, 7);
        ringFx(e.x, e.y, 8, 44, 0.35, KIND_COL.cos, 2);
        tone(340, 0.12, 'triangle', 0.03, -80);
      }
    } else if (e.kind === 'num' && e.hp >= 6 && e.maxHp <= 9) {
      /* 大数字：蓄力冲撞 */
      e.chT -= dt;
      if (e.chPhase === 'chase') {
        mx = pdx / pd; my = pdy / pd;
        if (e.chT <= 0 && pd < 420) { e.chPhase = 'tele'; e.chTm = 0.7; e.chDx = pdx / pd; e.chDy = pdy / pd; }
      } else if (e.chPhase === 'tele') {
        e.chTm -= dt;
        if (e.chTm <= 0) { e.chPhase = 'dash'; e.chTm = 0.55; }
      } else {
        e.chTm -= dt;
        mx = e.chDx; my = e.chDy;
        spd = e.spd * 3.4;
        if (e.chTm <= 0) { e.chPhase = 'chase'; e.chT = rnd(3.5, 5); }
      }
    } else {
      mx = pdx / pd; my = pdy / pd;
      if (e.kind === 'phi') {
        /* 蛇形突进：追击方向叠加垂直正弦摆动 */
        const wob = Math.sin(frameNo * 0.07 + e.id * 1.7) * 1.1;
        mx += -pdy / pd * wob; my += pdx / pd * wob;
        const l2 = Math.hypot(mx, my) || 1;
        mx /= l2; my /= l2;
      }
    }

    e.x += (mx * spd + e.kbx) * dt;
    e.y += (my * spd + e.kby) * dt;
    e.kbx *= Math.max(0, 1 - 7 * dt);
    e.kby *= Math.max(0, 1 - 7 * dt);
    e.x = clampN(e.x, 30, ARENA_W - 30);
    e.y = clampN(e.y, 30, ARENA_H - 30);

    /* 碰玩家 */
    if (player.deadT < 0 && dist2(e.x, e.y, player.x, player.y) < (e.r + player.r - 4) * (e.r + player.r - 4)) {
      hurtPlayer(1, e.x, e.y);
      e.kbx -= (player.x - e.x) * 2; e.kby -= (player.y - e.y) * 2;
    }
  }

  /* 轻量分离：防止叠成一坨 */
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < Math.min(i + 7, enemies.length); j++) {
      const b = enemies[j];
      const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
      const min = (a.r + b.r) * 0.8;
      if (dd > 0.01 && dd < min * min) {
        const d = Math.sqrt(dd), push = (min - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
}

/* ---------- 伤害结算 ---------- */
function hurtEnemy(e, n, ang, kb, slow, crit) {
  if (e.hp <= 0) return;
  /* 负数兵：免疫击退 */
  if (e.kind === 'neg') kb = 0;
  /* 根号兵护盾：弹开这一次伤害 */
  if (e.kind === 'sqrt' && e.shieldUp) {
    e.shieldUp = false; e.shT = 3.5;
    e.hitT = 0.12;
    popText(e.x, e.y - e.r - 10, '盾!', [230, 190, 255], 16);
    tone(240, 0.08, 'square', 0.04, -60);
    return;
  }
  e.hp -= n;
  e.hitT = 0.13;
  if (kb) { e.kbx += Math.cos(ang) * kb; e.kby += Math.sin(ang) * kb; }
  if (slow) e.slowT = Math.max(e.slowT, slow);
  popText(e.x + rnd(-6, 6), e.y - e.r - 10, crit ? '-2' : '-1', crit ? [255, 214, 0] : [235, 235, 235], crit ? 23 : 16);
  if (crit) sfx.crit(); else sfx.hit();
  /* 幻影数：受击瞬移到玩家周围（残影粒子） */
  if (e.hp > 0 && e.kind === 'ghost') {
    burst(e.x, e.y, KIND_COL.ghost, 6, 120);
    const a = rnd(0, TWO_PI), d = rnd(130, 210);
    e.x = clampN(player.x + Math.cos(a) * d, 30, ARENA_W - 30);
    e.y = clampN(player.y + Math.sin(a) * d, 30, ARENA_H - 30);
    e.hitT = 0.05;
    burst(e.x, e.y, KIND_COL.ghost, 6, 120);
  }
  if (e.hp <= 0) {
    /* ∞兵：第一次击杀会原地复活 */
    if (e.kind === 'inf' && !e.revived) {
      e.revived = true;
      e.hp = Math.max(2, Math.ceil(e.maxHp / 2));
      e.slowT = 0;
      popText(e.x, e.y - e.r - 14, '∞ 重生!', KIND_COL.inf, 18);
      ringFx(e.x, e.y, 10, 70, 0.5, KIND_COL.inf, 3);
      sfx.roar();
      return;
    }
    killEnemy(e);
  }
}

function killEnemy(e) {
  play.kills++;
  const col = e.kind === 'num' ? tierCol(e.hp) : KIND_COL[e.kind] || [255, 255, 255];
  burst(e.x, e.y, col, e.kind === 'elite' ? 22 : 9, 180);
  dustBurst(e.x, e.y, e.kind === 'elite' ? 10 : 4);
  sfx.kill();

  /* 掉落粉笔屑（经验） */
  const dn = e.kind === 'elite' ? 5 : 1;
  for (let k = 0; k < dn; k++) {
    dusts.push({ x: e.x + rnd(-14, 14), y: e.y + rnd(-14, 14), vx: rnd(-60, 60), vy: rnd(-60, 60), attract: false });
  }
  /* 道具掉落 */
  rollDrop(e);

  /* 乘号兵分裂 */
  if (e.kind === 'mul' && enemies.length < 90) {
    const s = Math.max(1, Math.ceil(e.maxHp / 2));
    for (const dx of [-16, 16]) {
      const c = spawnEnemy('num', s, clampN(e.x + dx, 30, ARENA_W - 30), e.y);
      c.hitT = 0.2;
      popText(c.x, c.y - 26, '×分裂!', KIND_COL.mul, 13);
    }
  }
  /* 分数兵一分为二（只分一次：孩子带 child 标记） */
  if (e.kind === 'frac' && !e.child && e.maxHp >= 2 && enemies.length < 90) {
    const s = Math.max(1, Math.ceil(e.maxHp / 2));
    for (const dx of [-15, 15]) {
      const c = spawnEnemy('frac', s, clampN(e.x + dx, 30, ARENA_W - 30), e.y, { child: true, ch: '¼' });
      c.hitT = 0.2;
      popText(c.x, c.y - 26, '÷2!', KIND_COL.frac, 13);
    }
  }
  /* 加号兵阵亡治疗同伴 */
  if (e.kind === 'plus') {
    ringFx(e.x, e.y, 20, 150, 0.5, KIND_COL.plus, 2.5);
    for (const o of enemies) {
      if (o.hp > 0 && o !== e && dist2(o.x, o.y, e.x, e.y) < 150 * 150 && o.hp < o.maxHp) {
        o.hp = Math.min(o.maxHp, o.hp + 2);
        popText(o.x, o.y - o.r - 12, '+2', KIND_COL.plus, 14);
      }
    }
  }
  if (e.kind === 'elite') { addShake(5); sfx.roar(); }
}

/* ---------- 绘制 ---------- */
function inView(x, y, m) {
  return x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
}
function drawEnemies() {
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  for (const e of enemies) {
    if (!inView(e.x, e.y, 70)) continue;
    const flash = e.hitT > 0;
    const bump = 1 + e.hitT * 1.4;
    const wob = Math.sin(frameNo * 0.15 + e.id) * 1.5;

    if (e.kind === 'num' || e.kind === 'neg' || e.kind === 'ghost') {
      const col = e.kind === 'neg' ? KIND_COL.neg : (e.kind === 'ghost' ? KIND_COL.ghost : tierCol(e.hp));
      const size = clampN(30 + e.hp * 3.2, 34, 62) * (e.kind === 'neg' ? 0.82 : 1) * bump;
      const shk = e.chPhase === 'tele' ? rnd(-1.5, 1.5) : 0;
      /* 小短腿 */
      const step = Math.sin(frameNo * 0.25 + e.id) * 4;
      stroke(col[0], col[1], col[2], 230); strokeWeight(3); strokeCap(ROUND);
      line(e.x - 6, e.y + e.r * 0.7, e.x - 8 + step, e.y + e.r * 0.7 + 7);
      line(e.x + 6, e.y + e.r * 0.7, e.x + 8 - step, e.y + e.r * 0.7 + 7);
      noStroke();
      glowOn(flash ? [255, 255, 255] : col, 8);
      fill(flash ? 255 : col[0], flash ? 255 : col[1], flash ? 255 : col[2]);
      textSize(size);
      if (e.kind === 'ghost') drawingContext.globalAlpha = 0.72;
      text((e.kind === 'neg' ? '−' : '') + Math.max(1, e.hp), e.x + shk, e.y - size * 0.06 + wob * 0.4);
      if (e.kind === 'ghost') drawingContext.globalAlpha = 1;
      glowOff();
      drawEyes(e.x + shk, e.y - size * 0.32 + wob * 0.4, 2.6, clampN((player.x - e.x) / 60, -2, 2), e.chPhase !== 'chase');
      if (e.chPhase === 'tele') { fill(255, 80, 80); textSize(20); text('!', e.x, e.y - e.r - 16); }
      if (e.slowT > 0) { noFill(); stroke(100, 210, 255, 180); strokeWeight(2); circle(e.x, e.y, e.r * 2.4); noStroke(); }
    } else if (e.kind === 'elite') {
      const col = KIND_COL.elite;
      /* 光环 */
      noFill(); stroke(col[0], col[1], col[2], 26); strokeWeight(3);
      circle(e.x, e.y, 280);
      const size = 44 * bump;
      const step = Math.sin(frameNo * 0.22 + e.id) * 5;
      stroke(col[0], col[1], col[2], 230); strokeWeight(4); strokeCap(ROUND);
      line(e.x - 9, e.y + 18, e.x - 12 + step, e.y + 26);
      line(e.x + 9, e.y + 18, e.x + 12 - step, e.y + 26);
      noStroke();
      glowOn(col, 14);
      fill(flash ? 255 : col[0], flash ? 255 : col[1], flash ? 255 : col[2]);
      textSize(size);
      text('' + Math.max(1, e.hp), e.x, e.y - 6 + wob * 0.5);
      glowOff();
      /* 小皇冠 */
      fill(col[0], col[1], col[2]);
      triangle(e.x - 12, e.y - size * 0.62, e.x - 12, e.y - size * 0.62 - 9, e.x - 6, e.y - size * 0.62 - 2);
      triangle(e.x - 4, e.y - size * 0.64, e.x - 2, e.y - size * 0.64 - 11, e.x + 2, e.y - size * 0.64 - 2);
      triangle(e.x + 8, e.y - size * 0.62, e.x + 12, e.y - size * 0.62 - 9, e.x + 12, e.y - size * 0.62);
      drawEyes(e.x, e.y - size * 0.3 + wob * 0.5, 3.2, clampN((player.x - e.x) / 60, -2, 2), true);
    } else {
      /* 符号怪 */
      const col = KIND_COL[e.kind];
      const size = 40 * bump;
      const step = Math.sin(frameNo * 0.25 + e.id) * 4;
      stroke(col[0], col[1], col[2], 230); strokeWeight(3); strokeCap(ROUND);
      line(e.x - 5, e.y + 13, e.x - 7 + step, e.y + 20);
      line(e.x + 5, e.y + 13, e.x + 7 - step, e.y + 20);
      noStroke();
      glowOn(flash ? [255, 255, 255] : col, 9);
      fill(flash ? 255 : col[0], flash ? 255 : col[1], flash ? 255 : col[2]);
      textSize(size);
      text(e.ch || KIND_CHAR[e.kind], e.x, e.y + wob * 0.4);
      glowOff();
      /* 血量角标 ×n */
      fill(255, 255, 255, 220); textSize(13);
      text('×' + e.hp, e.x + 16, e.y - 18 + wob * 0.4);
      drawEyes(e.x, e.y - 4 + wob * 0.4, 2.6, clampN((player.x - e.x) / 60, -2, 2), e.kind === 'div');
      if (e.kind === 'minus') {   /* 减速光环提示 */
        noFill(); stroke(col[0], col[1], col[2], 40); strokeWeight(2);
        circle(e.x, e.y, 220);
        noStroke();
      }
      if (e.kind === 'sqrt' && e.shieldUp) {
        noFill(); stroke(230, 190, 255, 190); strokeWeight(2.5);
        circle(e.x, e.y + wob * 0.4, e.r * 2.7);
        noStroke();
      }
      if (e.kind === 'inf' && e.revived) {
        fill(255, 130, 130, 220); textSize(11);
        text('已重生', e.x, e.y + 30);
      }
    }
  }
  pop();
}
