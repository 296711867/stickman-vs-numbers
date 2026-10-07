/* ============================================================
 * 火柴人大战数字 —— 入口：setup / draw / 输入 / 自动测试
 * ============================================================ */
'use strict';

let AUTOTEST = false;

function setup() {
  loadStore();
  calcView();
  initFloaters();
  createCanvas(realW(), realH());
  try {
    AUTOTEST = new URLSearchParams(location.search).get('t') === '1';
  } catch (e) { AUTOTEST = false; }
  if (AUTOTEST) {
    noLoop();
    setTimeout(runAutoTest, 60);
  }
}

function windowResized() {
  resizeCanvas(realW(), realH());
  calcView();
}

/* ---------- 主循环 ---------- */
function draw() {
  /* 视口自校验：手机转屏/视口变化后 p5 事件时机不可靠，每帧兜底 */
  if (realW() !== width || realH() !== height) resizeCanvas(realW(), realH());
  calcView();
  uiClear();
  const rawDt = Math.min(1 / 20, Math.max(1 / 240, (deltaTime || 16.7) / 1000));
  let dt = rawDt;
  if (slowmoT > 0) { dt *= 0.32; slowmoT -= rawDt; }
  frameNo++;
  shakeAmt = Math.max(0, shakeAmt - 55 * rawDt);
  flashA = Math.max(0, flashA - 2.4 * rawDt);

  /* 全部画面（菜单/HUD/世界）统一套 letterbox 变换，逻辑分辨率恒为 1280×720 */
  push();
  translate(view.ox, view.oy); scale(view.s);
  switch (SCENE) {
    case 'title': updTitle(dt); drawTitle(); break;
    case 'select': updSelect(dt); drawSelect(); break;
    case 'play': updatePlay(dt); if (SCENE === 'play') drawPlay(); else drawSceneFallback(); break;
    case 'over': updOver(dt); drawOver(); break;
    case 'clear': updClear(dt); drawClear(); break;
    case 'allclear': updClear(dt); drawAllclear(); break;
    default: drawSceneFallback();
  }
  drawPortraitHint();
  pop();
  pressed = {};
}
function drawSceneFallback() {
  background(4, 5, 10);
  fill(255); textAlign(CENTER, CENTER); textSize(24); text('…', VW / 2, VH / 2);
}

/* ---------- 输入 ---------- */
function keyPressed(e) {
  const ev = e || window.event || {};
  const c = ev.code || '';
  if (c) { keys[c] = true; pressed[c] = true; }
  if (c === 'KeyM') { STORE.mute = !STORE.mute; saveStore(); }
  if (SCENE === 'play' && (c === 'KeyP' || c === 'Escape')) togglePause();
  if (SCENE === 'play' && play && play.state === 'levelup') {
    if (c === 'Digit1' || c === 'Numpad1') applyChoice(0);
    if (c === 'Digit2' || c === 'Numpad2') applyChoice(1);
    if (c === 'Digit3' || c === 'Numpad3') applyChoice(2);
  }
  if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space') && SCENE === 'select') {
    startPlay(Math.min(STORE.unlocked, LEVELS.length));
    sfx.ok();
  }
  return false;
}
function keyReleased(e) {
  const ev = e || window.event || {};
  if (ev.code) keys[ev.code] = false;
}

function mousePressed() {
  initAudio();
  const lx = toLX(mouseX), ly = toLY(mouseY);
  const r = uiHit(lx, ly);
  if (r) { r.cb(); return false; }
  if (SCENE === 'play' && play && play.state === 'run' && player && player.deadT < 0) {
    joyStart(0, lx, ly);
    /* 菜单场景的全屏点击（allclear） */
    for (let i = uiRects.length - 1; i >= 0; i--) { /* 已由 uiHit 处理 */ break; }
  }
  if (SCENE === 'allclear') { SCENE = 'select'; sceneT = 0; sfx.sel(); }
  if (SCENE === 'title') { SCENE = 'select'; sceneT = 0; sfx.ok(); }
  return false;
}
function mouseDragged() {
  if (joy.active) joyMove(toLX(mouseX), toLY(mouseY));
  return false;
}
function mouseReleased() {
  joyEnd();
  return false;
}

/* 触屏（浏览器会同时派发 mouse 事件，这里兜底 p5 触摸回调） */
function touchStarted() {
  const t = (typeof touches !== 'undefined' && touches && touches[0]) || { x: mouseX, y: mouseY };
  initAudio();
  const lx = toLX(t.x), ly = toLY(t.y);
  const r = uiHit(lx, ly);
  if (r) { r.cb(); return false; }
  if (SCENE === 'play' && play && play.state === 'run' && player && player.deadT < 0) joyStart(1, lx, ly);
  if (SCENE === 'allclear') { SCENE = 'select'; sceneT = 0; }
  if (SCENE === 'title') { SCENE = 'select'; sceneT = 0; }
  return false;
}
function touchMoved() {
  if (joy.active) {
    const t = (typeof touches !== 'undefined' && touches && touches[0]) || { x: mouseX, y: mouseY };
    joyMove(toLX(t.x), toLY(t.y));
  }
  return false;
}
function touchEnded() {
  if (joy.id === 1) joyEnd();
  return false;
}

/* ---------- 自动测试（?t=1）：无头快进全部逻辑路径，上报错误 ---------- */
function runAutoTest() {
  const ERR = [];
  window.__AT_ERR = ERR;
  window.__AT_DONE = false;
  const log = m => { ERR.push(String(m).slice(0, 400)); try { console.error('[AT]', m); } catch (e) { } };
  const guard = (tag, fn) => { try { fn(); } catch (err) { log(tag + ': ' + (err && err.stack ? err.stack : err)); } };
  const step = (n, tag) => {
    for (let i = 0; i < n; i++) {
      frameNo++;
      guard(tag, () => updatePlay(1 / 60));
      if (play && play.state === 'levelup' && play.choices && play.choices.length) {
        guard(tag + '/choice', () => applyChoice(rint(0, play.choices.length - 1)));
      }
      if (SCENE !== 'play') break;
    }
  };

  guard('boot', () => startPlay(1));
  step(60 * 45, 'lv1');
  guard('lv2', () => startPlay(2));
  step(60 * 25, 'lv2');
  guard('lv3', () => startPlay(3));
  step(60 * 25, 'lv3');
  guard('lv4', () => startPlay(4));
  step(60 * 25, 'lv4');
  guard('lv5', () => startPlay(5));
  step(60 * 25, 'lv5');
  guard('lv6', () => startPlay(6));
  step(60 * 25, 'lv6');
  guard('lv7', () => startPlay(7));
  step(60 * 25, 'lv7');
  guard('lv8', () => startPlay(8));
  step(60 * 25, 'lv8');
  guard('lv9', () => startPlay(9));
  step(60 * 25, 'lv9');
  guard('lv10', () => startPlay(10));
  step(60 * 25, 'lv10');

  /* 第 7 关 BOSS（通用渲染兜底路径） */
  guard('boss-path7', () => {
    startPlay(7);
    step(60 * 2, 'boss7-pre');
    play.t = 299.5;
    step(60 * 4, 'boss7-spawn');
    if (boss) {
      step(60 * 6, 'boss7-fight');
      while (boss && boss.hp > 0) hurtBoss(2, false);
      step(60 * 4, 'boss7-clear');
    } else log('boss-path7: BOSS 未生成');
  });

  /* 第 8 关 BOSS：双重生路径（应复活 2 次后才能击杀） */
  guard('boss-path8', () => {
    startPlay(8);
    step(60 * 2, 'boss8-pre');
    play.t = 299.5;
    step(60 * 4, 'boss8-spawn');
    if (boss) {
      step(60 * 6, 'boss8-fight');
      /* 双重生断言：反复打穿 HP，1 次真死 + 2 次复活 = 恰好 3 轮 */
      let loops = 0;
      while (boss && boss.hp > 0 && loops < 10) {
        boss.hp = 1;
        hurtBoss(5, false);
        loops++;
      }
      if (loops === 3) log('boss8: 双重生生效（恰好 3 轮击杀，预期）'); else log('boss8: 重生次数异常 loops=' + loops);
      step(60 * 4, 'boss8-clear');
    } else log('boss-path8: BOSS 未生成');
  });

  /* 第 9 关 BOSS（微分恶魔，通用渲染路径） */
  guard('boss-path9', () => {
    startPlay(9);
    step(60 * 2, 'boss9-pre');
    play.t = 299.5;
    step(60 * 4, 'boss9-spawn');
    if (boss) {
      step(60 * 6, 'boss9-fight');
      while (boss && boss.hp > 0) hurtBoss(2, false);
      step(60 * 4, 'boss9-clear');
    } else log('boss-path9: BOSS 未生成');
  });

  /* 第 10 关 BOSS：三形态断言（2 次复活换 2 次技能池，共 3 轮击杀） */
  guard('boss-path10', () => {
    startPlay(10);
    step(60 * 2, 'boss10-pre');
    play.t = 299.5;
    step(60 * 4, 'boss10-spawn');
    if (boss) {
      step(60 * 6, 'boss10-fight');
      const pats0 = boss.pats.join(',');
      let loops = 0;
      const seen = [pats0];
      while (boss && boss.hp > 0 && loops < 10) {
        boss.hp = 1;
        hurtBoss(5, false);
        loops++;
        if (boss) seen.push(boss.pats.join(','));
      }
      if (loops === 3 && seen[0] !== seen[1] && seen[1] !== seen[2]) log('boss10: 三形态生效（3 轮击杀+技能池两变，预期）');
      else log('boss10: 三形态异常 loops=' + loops + ' pools=' + seen.join(' | '));
      step(60 * 4, 'boss10-clear');
    } else log('boss-path10: BOSS 未生成');
  });

  /* 第 6 关 BOSS（通用渲染兜底路径） */
  guard('boss-path6', () => {
    startPlay(6);
    step(60 * 2, 'boss6-pre');
    play.t = 299.5;
    step(60 * 4, 'boss6-spawn');
    if (boss) {
      step(60 * 6, 'boss6-fight');
      while (boss && boss.hp > 0) hurtBoss(2, false);
      step(60 * 4, 'boss6-clear');
    } else log('boss-path6: BOSS 未生成');
  });

  /* BOSS 全路径：第 5 关（黄金螺旋/引力/∞重生）+ 第 4 关（虚化免疫）+ 第 1 关 */
  guard('boss-path5', () => {
    startPlay(5);
    step(60 * 2, 'boss5-pre');
    play.t = 299.5;
    step(60 * 4, 'boss5-spawn');
    if (boss) {
      step(60 * 6, 'boss5-fight');
      while (boss && boss.hp > 0) hurtBoss(2, false);
      if (boss && boss.revived) log('boss5: ∞ 重生已触发（预期）'); else log('boss5: 未触发重生（异常）');
      step(60 * 4, 'boss5-clear');
    } else log('boss-path5: BOSS 未生成');
  });
  guard('boss-path4', () => {
    startPlay(4);
    step(60 * 2, 'boss4-pre');
    play.t = 299.5;
    step(60 * 4, 'boss4-spawn');
    if (boss) {
      step(60 * 8, 'boss4-fight');
      /* 虚化免疫抽样：ghostT>0 时应扣不动血 */
      boss.hp = 60;
      boss.ghostT = 2;
      hurtBoss(30, false);
      if (boss.hp !== 60) log('boss4: 虚化期间受到伤害（异常）');
      boss.ghostT = 0;
      while (boss && boss.hp > 0) hurtBoss(2, false);
      step(60 * 4, 'boss4-clear');
    } else log('boss-path4: BOSS 未生成');
  });
  guard('boss-path1', () => {
    startPlay(1);
    step(60 * 2, 'boss1-pre');
    if (!boss) { play.t = 299.5; step(60 * 4, 'boss1-spawn'); }
    if (boss) {
      /* 让 BOSS 放几轮技能 */
      step(60 * 6, 'boss1-fight');
      while (boss && boss.hp > 0) hurtBoss(2, false);
      step(60 * 4, 'boss1-clear');
    } else log('boss-path1: BOSS 未生成');
  });

  /* 无尽模式：310 秒应出 BOSS，击杀后进第 2 轮且不结算 */
  guard('endless', () => {
    startPlay(0);
    if (!play.endless) log('endless: 未进入无尽模式（异常）');
    const runF = (n) => {
      for (let i = 0; i < n; i++) {
        if (player.deadT < 0) player.iframes = 2;
        updatePlay(1 / 60);
        frameNo++;
        if (play.state === 'levelup' && play.choices && play.choices.length) applyChoice(rint(0, play.choices.length - 1));
        if (SCENE !== 'play') break;
      }
    };
    runF(60 * 310);
    if (!boss) log('endless: 310 秒未出 BOSS（异常）');
    if (boss) {
      runF(60 * 8);
      while (boss && boss.hp > 0) hurtBoss(3, false);
      runF(60 * 5);
      if (play.round !== 2) log('endless: 击杀后未进第2轮（异常）round=' + play.round);
      if (SCENE !== 'play') log('endless: 不应结算通关（异常）scene=' + SCENE);
    }
    runF(60 * 10);
  });

  /* 道具全类型直达测试 */
  guard('drops', () => {
    startPlay(2);
    for (const t of ['milk', 'magnet', 'clock', 'bombI', 'gift', 'heart']) applyDrop(t, player.x + 10, player.y);
    for (let i = 0; i < 8; i++) applyChoice(0);
    step(60 * 3, 'drops');
  });

  /* 武器进化：满级铅笔+攻速被动 → 进化卡必出 → 进化后 evolved 且无异常 */
  guard('evolve', () => {
    startPlay(1);
    player.weapons = [{ id: 'pencil', lv: 5, cd: 0.5, ang: 0, sweepT: 0, evolved: false }];
    player.passives = { atk: 3 };
    recomputeStats();
    addXp(60);
    if (play.state === 'levelup' && play.choices && play.choices[0] && play.choices[0].kind === 'evo') {
      applyChoice(0);
      if (player.weapons[0].evolved) {
        for (let i = 0; i < 600; i++) { if (player.deadT < 0) player.iframes = 2; updatePlay(1 / 60); frameNo++; }
        log('evolve: 进化成功且运行无异常（预期）');
      } else log('evolve: 进化未生效（异常）');
    } else log('evolve: 进化卡未出现（异常）state=' + (play && play.state));
  });

  window.__AT_DONE = true;
  window.__AT_SCENE = SCENE;
  window.__AT_KILLS = play ? play.kills : -1;
  try { redraw(); } catch (e) { }
}
