/* ============================================================
 * 字狂潮（火柴人 VS 数字）—— 全局常量 / 状态 / 工具 / 特效 / 背景
 * 荧光黑板风俯视割草木鸽 · p5.js 2.3.2
 * ============================================================ */
'use strict';

/* ---------- 逻辑视口（固定 1280×720，等比缩放留黑边） ---------- */
const VW = 1280, VH = 720;
const ARENA_W = 2400, ARENA_H = 1800;

/* ---------- 关卡主题 ---------- */
const LEVELS = [
  { name: '加号草原', tag: '第一关', col: [72, 255, 128], dim: [10, 30, 18], boss: 'plusKing', puddles: 0,
    feats: ['数字1~5军团', '加号兵·治疗', '加号大王'] },
  { name: '减号沼泽', tag: '第二关', col: [64, 224, 255], dim: [10, 26, 36], boss: 'minusWitch', puddles: 7,
    feats: ['减号兵·减速', '除号兵·狙击', '减号女巫'] },
  { name: '乘方王座', tag: '第三关', col: [255, 64, 106], dim: [40, 10, 20], boss: 'powerQueen', puddles: 0,
    feats: ['乘号兵·分裂', '精英[12]冲锋', '乘方女王'] },
  { name: '根号深渊', tag: '第四关', col: [190, 120, 255], dim: [24, 12, 42], boss: 'sqrtDemon', puddles: 0,
    feats: ['根号兵√护盾', '精英[20]', '根号魔王·虚化'] },
  { name: '黄金比例宫', tag: '第五关', col: [255, 200, 40], dim: [42, 30, 8], boss: 'phiKing', puddles: 0,
    feats: ['φ兵·蛇形', '∞兵·复活', '黄金之王·重生'] },
  { name: '负数冰窟', tag: '第六关', col: [140, 200, 255], dim: [14, 26, 46], boss: 'pctKing', puddles: 4,
    feats: ['负数兵·免击退', '精英[22]', '百分大帝%'] },
  { name: '分数裂谷', tag: '第七关', col: [80, 255, 170], dim: [12, 38, 26], boss: 'tongfenColossus', puddles: 0,
    feats: ['分数兵½分裂', '精英[26]', '通分巨像'] },
  { name: '无穷回廊', tag: '第八关', col: [235, 235, 245], dim: [30, 30, 40], boss: 'infWalker', puddles: 0,
    feats: ['幻影数·瞬移', '∞兵潮·精英[28]', '无穷行者·重生'] },
  { name: '函数迷宫', tag: '第九关', col: [170, 120, 255], dim: [26, 16, 44], boss: 'diffDemon', puddles: 0,
    feats: ['∫兵·正弦弹道', 'Σ兵·弹环', '微分恶魔∂'] },
  { name: '零之原点', tag: '最终关', col: [230, 230, 235], dim: [28, 28, 34], boss: 'originGod', puddles: 0,
    feats: ['九关大军复刻', '终极精英[40]', '原点之神·三形'] },
];

/* ---------- 场景与全局状态 ---------- */
let SCENE = 'title';            // title select play over clear allclear
let sceneT = 0;
let frameNo = 0;
let keys = {};                  // 按住的键 (e.code)
let pressed = {};               // 本帧刚按下的键
let curLv = 1;
let view = { s: 1, ox: 0, oy: 0 };
let cam = { x: 0, y: 0 };
let shakeAmt = 0, flashA = 0, flashC = [255, 80, 80];
let slowmoT = 0, freezeT = 0;

/* ---------- 对局状态（startPlay 中重置） ---------- */
let player = null, play = null;
let enemies = [], projs = [], dusts = [], drops = [], puddles = [];
let boss = null, eid = 0;

/* ---------- 存档 ---------- */
let STORE = { unlocked: 1, best: {}, mute: false, bestEndless: null, endlessLog: [] };
function saveStore() {
  try { localStorage.setItem('svsn_v1', JSON.stringify(STORE)); } catch (e) { /* file:// 下可能受限 */ }
}
function loadStore() {
  try {
    const s = localStorage.getItem('svsn_v1');
    if (s) { const p = JSON.parse(s); if (p && p.unlocked >= 1) STORE = Object.assign(STORE, p); }
  } catch (e) { /* 忽略 */ }
  LOWFX = !!STORE.lowfx;
}

/* ---------- 小工具 ---------- */
/* 当前关卡主题（无尽模式按轮数轮换场景） */
function curLvTheme() {
  if (curLv >= 1) return LEVELS[curLv - 1];
  return LEVELS[(play && play.round ? play.round - 1 : 0) % LEVELS.length];
}
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const clampN = (v, a, b) => (v < a ? a : (v > b ? b : v));
const lerpN = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const kp = c => !!pressed[c];
const blink = () => frameNo % 60 < 40;
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ---------- 视口缩放 ---------- */
/* 不用 p5 的 windowWidth/Height：部分环境（IAB 视口模拟/部分手机浏览器）报告不准 */
function realW() { return (document.documentElement && document.documentElement.clientWidth) || windowWidth; }
function realH() { return (document.documentElement && document.documentElement.clientHeight) || windowHeight; }
function calcView() {
  const w = realW(), h = realH();
  const s = Math.min(w / VW, h / VH);
  view.s = s;
  view.ox = (w - VW * s) / 2;
  view.oy = (h - VH * s) / 2;
}
/* 屏幕坐标 → 逻辑坐标 */
function toLX(px) { return (px - view.ox) / view.s; }
function toLY(py) { return (py - view.oy) / view.s; }

/* ---------- 指针输入（虚拟摇杆 / UI 点击） ---------- */
let joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
let uiRects = [];               // 每帧重建 {x,y,w,h,cb}（逻辑坐标）
function uiClear() { uiRects.length = 0; }
function uiHit(lx, ly) {
  for (let i = uiRects.length - 1; i >= 0; i--) {
    const r = uiRects[i];
    if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return r;
  }
  return null;
}
function joyStart(id, lx, ly) { joy.active = true; joy.id = id; joy.ox = lx; joy.oy = ly; joy.dx = 0; joy.dy = 0; }
function joyMove(lx, ly) {
  let dx = lx - joy.ox, dy = ly - joy.oy;
  const d = Math.hypot(dx, dy);
  if (d > 74) { dx = dx / d * 74; dy = dy / d * 74; }
  joy.dx = dx; joy.dy = dy;
}
function joyEnd() { joy.active = false; joy.id = -1; joy.dx = 0; joy.dy = 0; }
/* 摇杆 → 移动向量（-1..1） */
function joyVec() {
  if (!joy.active) return null;
  const d = Math.hypot(joy.dx, joy.dy);
  if (d < 9) return { x: 0, y: 0 };
  const k = Math.min(1, d / 64);
  return { x: joy.dx / d * k, y: joy.dy / d * k };
}

/* ---------- 屏幕效果 ---------- */
function addShake(a) { shakeAmt = Math.min(22, shakeAmt + a); }
function addFlash(a, c) { flashA = Math.max(flashA, a); if (c) flashC = c; }

/* ---------- 粒子 / 飘字 / 扩散环 ---------- */
let parts = [], pops = [], rings = [];
function burst(x, y, col, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(spd * 0.3, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.3, 0.8), t: 0, col, r: rnd(2, 5), g: 260 });
  }
}
function dustBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(20, 130);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rnd(0.3, 0.7), t: 0, col: [235, 235, 225], r: rnd(1.5, 3.5), g: 180 });
  }
}
function popText(x, y, txt, col, size) {
  if (pops.length > 60) pops.shift();
  pops.push({ x, y, txt, col: col || [255, 255, 255], size: size || 17, t: 0, life: 0.55, vy: -70 });
}
function ringFx(x, y, r0, r1, life, col, w, dash) {
  rings.push({ x, y, r0, r1, life, t: 0, col, w: w || 3, dash: !!dash });
}
function updFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.985;
    if (p.t >= p.life) parts.splice(i, 1);
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 0.94;
    if (p.t >= p.life) pops.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt;
    if (r.t >= r.life) rings.splice(i, 1);
  }
}
function drawFx() {
  noStroke();
  for (const p of parts) {
    const a = 1 - p.t / p.life;
    fill(p.col[0], p.col[1], p.col[2], 255 * a);
    circle(p.x, p.y, p.r * (0.5 + a));
  }
  for (const r of rings) {
    const k = r.t / r.life, rr = lerpN(r.r0, r.r1, 1 - Math.pow(1 - k, 2));
    noFill();
    if (r.dash) drawingContext.setLineDash([10, 9]);
    stroke(r.col[0], r.col[1], r.col[2], 255 * (1 - k));
    strokeWeight(r.w * (1 - k * 0.4));
    circle(r.x, r.y, rr * 2);
    drawingContext.setLineDash([]);
  }
  textAlign(CENTER, CENTER); noStroke(); textStyle(BOLD);
  for (const p of pops) {
    const a = p.t < 0.35 ? 1 : 1 - (p.t - 0.35) / 0.2;
    fill(p.col[0], p.col[1], p.col[2], 255 * a);
    textSize(p.size);
    text(p.txt, p.x, p.y);
  }
}

/* ---------- 轻提示 toast（静音切换等即时反馈，随 draw 衰减） ---------- */
let toastTxt = '', toastT = 0;
function showToast(txt) { toastTxt = txt; toastT = 1.4; }

/* ---------- 荧光发光辅助 ---------- */
let LOWFX = false;   // 性能模式：关发光/暗角，手机流畅
function glowOn(col, blur) {
  if (LOWFX) return;
  drawingContext.shadowBlur = blur || 14;
  drawingContext.shadowColor = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
}
function glowOff() { drawingContext.shadowBlur = 0; drawingContext.shadowColor = 'rgba(0,0,0,0)'; }

/* ---------- 漂浮符号（菜单装饰） ---------- */
let floaters = [];
function initFloaters() {
  floaters = [];
  const chs = ['+', '−', '×', '÷', '=', '1', '2', '3', '7', '8', '9', 'π', '√', '∑', '∞', '?', '%'];
  const cs = [[57, 255, 128], [64, 224, 255], [255, 64, 106], [255, 214, 0], [200, 120, 255]];
  for (let i = 0; i < 30; i++) {
    floaters.push({ x: rnd(0, VW), y: rnd(0, VH), ch: pick(chs), s: rnd(20, 48), vy: rnd(-24, -6), rot: rnd(-0.4, 0.4), a: rnd(14, 44), c: pick(cs) });
  }
}
function updFloaters(dt) {
  for (const f of floaters) { f.y += f.vy * dt; f.rot += 0.12 * dt; if (f.y < -50) { f.y = VH + 50; f.x = rnd(0, VW); } }
}
function drawFloaters() {
  push(); textAlign(CENTER, CENTER); noStroke();
  for (const f of floaters) {
    push(); translate(f.x, f.y); rotate(f.rot);
    fill(f.c[0], f.c[1], f.c[2], f.a); textSize(f.s); text(f.ch, 0, 0);
    pop();
  }
  pop();
}

/* ---------- 小表情眼睛 ---------- */
function drawEyes(cx, cy, er, look, angry, dark) {
  noStroke();
  for (const s of [-1, 1]) {
    fill(255); circle(cx + s * er * 1.5, cy, er * 2.1);
    fill(dark || [20, 24, 22]); circle(cx + s * er * 1.5 + look, cy + er * 0.18, er);
  }
  if (angry) {
    stroke(20, 24, 22); strokeWeight(er * 0.5); strokeCap(ROUND);
    line(cx - er * 2.5, cy - er * 2.3, cx - er * 0.7, cy - er * 1.35);
    line(cx + er * 2.5, cy - er * 2.3, cx + er * 0.7, cy - er * 1.35);
    noStroke();
  }
}

/* ---------- 荧光血条 ---------- */
function neonBar(x, y, w, h, k, col, showCell) {
  push();
  noFill(); stroke(col[0], col[1], col[2], 200); strokeWeight(2); rect(x, y, w, h, 4);
  noStroke(); fill(col[0], col[1], col[2]);
  const ww = Math.max(0, (w - 6) * clampN(k, 0, 1));
  if (ww > 1) rect(x + 3, y + 3, ww, h - 6, 3);
  if (showCell) {
    stroke(0, 0, 0, 90); strokeWeight(1);
    for (let i = 1; i < 4; i++) line(x + w * i / 4, y + 2, x + w * i / 4, y + h - 2);
  }
  pop();
}

/* ---------- 背景烘焙（每个关卡一次，画进 ARENA 大小的离屏缓冲） ---------- */
let bgBuf = null;
function buildBg(lv) {
  const L = LEVELS[lv - 1];
  bgBuf = createGraphics(ARENA_W, ARENA_H);
  const g = bgBuf;
  g.noStroke();
  g.background(3, 4, 8);
  // 主题色暗晕
  for (let i = 0; i < 26; i++) {
    g.fill(L.dim[0], L.dim[1], L.dim[2], rnd(5, 12));
    g.circle(rnd(0, ARENA_W), rnd(0, ARENA_H), rnd(200, 560));
  }
  // 荧光格线
  g.stroke(L.col[0], L.col[1], L.col[2], 13); g.strokeWeight(1);
  for (let x = 0; x <= ARENA_W; x += 80) g.line(x, 0, x, ARENA_H);
  for (let y = 0; y <= ARENA_H; y += 80) g.line(0, y, ARENA_W, y);
  // 粉笔灰噪点
  for (let i = 0; i < 260; i++) { g.fill(255, 255, 255, rnd(2, 7)); g.noStroke(); g.circle(rnd(0, ARENA_W), rnd(0, ARENA_H), rnd(6, 30)); }
  // 数学涂鸦
  const fs = ['a²+b²=c²', 'E=mc²', '∫x dx', 'π≈3.14159', 'x²−3x+2=0', 'sin²θ+cos²θ=1',
    'y=kx+b', '|x|<1', '√2', 'Δ=b²−4ac', '∑ 1+2+…+n', 'lim x→0', 'f(x)=sin x', 'log₂8=3',
    '2ⁿ', 'n!', '9×9=81', '1+1=2', 'x→∞', '½+¼+⅛…'];
  g.noStroke(); g.textAlign(CENTER, CENTER); g.textStyle(BOLD);
  for (let i = 0; i < 90; i++) {
    g.fill(L.col[0], L.col[1], L.col[2], rnd(10, 26));
    g.textSize(rnd(14, 30));
    g.text(pick(fs), rnd(80, ARENA_W - 80), rnd(60, ARENA_H - 60));
  }
  // 边界荧光框
  g.noFill(); g.stroke(L.col[0], L.col[1], L.col[2], 120); g.strokeWeight(4);
  g.rect(10, 10, ARENA_W - 20, ARENA_H - 20, 24);
  g.stroke(255, 255, 255, 40); g.strokeWeight(1.5);
  g.rect(18, 18, ARENA_W - 36, ARENA_H - 36, 20);
}
function drawBgWorld() {
  if (!bgBuf) buildBg(curLv);
  image(bgBuf, 0, 0);
}

/* ---------- 暗角（一次性烘焙，叠在最上层） ---------- */
let vBuf = null;
function buildVignette() {
  vBuf = createGraphics(VW, VH);
  const g = vBuf, ctx = g.drawingContext;
  const grd = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.36, VW / 2, VH / 2, VH * 0.85);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VW, VH);
}
function drawVignette() { if (LOWFX) return; if (!vBuf) buildVignette(); image(vBuf, 0, 0); }

/* ---------- 竖屏提示（非阻塞横幅） ---------- */
function drawPortraitHint() {
  if (realW() <= realH()) {
    push();
    textAlign(CENTER, CENTER); textStyle(BOLD);
    const a = blink() ? 220 : 120;
    noStroke(); fill(0, 0, 0, 150);
    const w = 340, h = 40;
    rect(VW / 2 - w / 2, VH - h - 14, w, h, 20);
    fill(255, 214, 0, a); textSize(18);
    text('↻ 建议横屏游玩，体验更佳', VW / 2, VH - h / 2 - 14);
    pop();
  }
}

/* ---------- 图标（武器 / 被动 / 道具，程序化荧光粉笔） ---------- */
function drawIcon(id, x, y, s, col) {
  const c = col || [235, 235, 235];
  push(); translate(x, y); stroke(c[0], c[1], c[2]); fill(c[0], c[1], c[2]);
  strokeWeight(s * 0.09); strokeCap(ROUND); strokeJoin(ROUND); noFill();
  const u = s / 2;
  switch (id) {
    case 'pencil': // 铅笔
      push(); rotate(-0.7);
      line(-u * 0.7, 0, u * 0.45, 0);
      noStroke(); triangle(u * 0.45, -u * 0.14, u * 0.45, u * 0.14, u * 0.75, 0);
      pop(); break;
    case 'ruler': // 直尺
      push(); rotate(-0.5); rect(-u * 0.8, -u * 0.28, u * 1.6, u * 0.56, 2);
      for (let i = -2; i <= 2; i++) line(i * u * 0.3, -u * 0.28, i * u * 0.3, -u * 0.1);
      pop(); break;
    case 'sym': // 符号卫星
      textStyle(BOLD); textSize(s * 0.9); textAlign(CENTER, CENTER);
      text('×', 0, 0); break;
    case 'chalk': // 粉笔射手
      line(-u * 0.5, u * 0.35, u * 0.3, -u * 0.2);
      noStroke(); circle(u * 0.45, -u * 0.32, s * 0.2);
      stroke(c[0], c[1], c[2], 120); line(-u * 0.85, u * 0.55, -u * 0.55, u * 0.42); break;
    case 'boomer': // 回旋镖
      arc(0, 0, s * 1.2, s * 1.2, PI * 0.15, PI * 0.85);
      arc(0, u * 0.25, s * 0.7, s * 0.7, PI * 0.2, PI * 0.8); break;
    case 'bomb': // 黑板擦炸弹
      push(); rotate(0.5); rect(-u * 0.55, -u * 0.35, u * 1.1, u * 0.7, 3);
      line(-u * 0.2, -u * 0.35, -u * 0.2, -u * 0.55);
      noStroke(); circle(-u * 0.2, -u * 0.62, s * 0.12); pop(); break;
    /* ---- 被动 ---- */
    case 'atk': line(-u * 0.5, -u * 0.4, -u * 0.1, 0); line(-u * 0.1, 0, -u * 0.5, u * 0.4); line(u * 0.1, -u * 0.4, u * 0.5, 0); line(u * 0.5, 0, u * 0.1, u * 0.4); break;
    case 'area': circle(0, 0, s * 1.1); circle(0, 0, s * 0.4); break;
    case 'magnet': arc(0, -u * 0.1, s * 0.9, s * 0.9, PI, 0); line(-u * 0.45, -u * 0.1, -u * 0.45, u * 0.45); line(u * 0.45, -u * 0.1, u * 0.45, u * 0.45); break;
    case 'speed': for (let i = 0; i < 3; i++) { line(-u * 0.6 + i * u * 0.5, -u * 0.4, -u * 0.2 + i * u * 0.5, 0); line(-u * 0.2 + i * u * 0.5, 0, -u * 0.6 + i * u * 0.5, u * 0.4); } break;
    case 'heart': heartShape(0, 0, s * 0.8, true); break;
    case 'luck': for (let a = 0; a < 4; a++) { push(); rotate(a * PI / 2); ellipse(0, -u * 0.3, u * 0.35, u * 0.55); pop(); } break;
    case 'crit': drawStarShape(0, 0, s * 0.5, s * 0.22, 5, true); break;
    case 'shield': beginShape(); vertex(0, -u * 0.7); vertex(u * 0.55, -u * 0.45); vertex(u * 0.55, u * 0.1); vertex(0, u * 0.7); vertex(-u * 0.55, u * 0.1); vertex(-u * 0.55, -u * 0.45); endShape(CLOSE); break;
    /* ---- 道具 ---- */
    case 'milk': rect(-u * 0.3, -u * 0.25, u * 0.6, u * 0.9, 3); rect(-u * 0.18, -u * 0.55, u * 0.36, u * 0.3, 2); break;
    case 'clock': circle(0, 0, s * 0.95); line(0, 0, 0, -u * 0.35); line(0, 0, u * 0.28, u * 0.1); break;
    case 'gift': rect(-u * 0.5, -u * 0.3, u * 1.0, u * 0.8, 2); line(-u * 0.5, -u * 0.05, u * 0.5, -u * 0.05); line(0, -u * 0.3, 0, u * 0.5); break;
    default: circle(0, 0, s * 0.8);
  }
  pop();
}
function heartShape(x, y, s, fillIt) {
  push(); translate(x, y);
  noStroke();
  if (fillIt) { fill(255, 64, 96); }
  else { noFill(); stroke(255, 64, 96); strokeWeight(2); }
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.25) {
    const r = s * 0.5 * (1 - Math.sin(a) * 0.5) * (Math.cos(a) >= 0 ? 1 : 0.9);
    vertex(Math.sin(a) * r * 1.1, -Math.cos(a) * r * 1.05 + s * 0.1);
  }
  endShape(CLOSE);
  pop();
}
function drawStarShape(x, y, r1, r2, n, fillIt) {
  push(); translate(x, y);
  noStroke();
  if (!fillIt) { noFill(); stroke(255); }
  beginShape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2, a = -PI / 2 + i * PI / n;
    vertex(Math.cos(a) * r, Math.sin(a) * r);
  }
  endShape(CLOSE);
  pop();
}
