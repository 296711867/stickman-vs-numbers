/* ============================================================
 * 场景系统 —— 对局主循环 / HUD / 菜单 / 结算 / 联动彩蛋
 * ============================================================ */
'use strict';

/* ---------- 对局启动 ---------- */
function startPlay(lv) {
  curLv = lv;
  player = makePlayer();
  recomputeStats();
  enemies = []; projs = []; dusts = []; drops = []; puddles = [];
  parts = []; pops = []; rings = [];
  boss = null; freezeT = 0; slowmoT = 0;
  play = {
    t: 0, kills: 0, acc: {}, banners: [],
    state: 'run', pendingLv: 0, choices: null,
    bossDone: false, clearT: 0,
    endless: lv === 0, round: 1, roundT: 0, interT: 0,
  };
  /* 波次事件标记复位 */
  for (const k in LV_WAVES) for (const ev of LV_WAVES[k].events) delete ev.done;
  /* 主题水洼（第二关沼泽等，数量来自关卡配置；无尽模式无） */
  const L0 = curLv >= 1 ? LEVELS[lv - 1] : null;
  for (let i = 0; i < ((L0 && L0.puddles) || 0); i++) {
    const x = rnd(200, ARENA_W - 200), y = rnd(200, ARENA_H - 200);
    if (dist2(x, y, ARENA_W / 2, ARENA_H / 2) > 300 * 300) puddles.push({ x, y, r: rnd(70, 115), life: null });
  }
  buildBg(play.endless ? 1 : lv);
  cam.x = clampN(player.x - VW / 2, 0, ARENA_W - VW);
  cam.y = clampN(player.y - VH / 2, 0, ARENA_H - VH);
  SCENE = 'play'; sceneT = 0;
}

function endGameOver() {
  play.chalkEarned = calcChalk(play.kills, false);
  STORE.meta.chalk += play.chalkEarned;
  if (play.endless) {
    const b = STORE.bestEndless;
    if (!b || play.kills > b.kills) STORE.bestEndless = { kills: play.kills, round: play.round, t: Math.floor(play.t) };
    /* 战绩历史：最近 5 局 */
    STORE.endlessLog = STORE.endlessLog || [];
    STORE.endlessLog.unshift({ kills: play.kills, round: play.round, t: Math.floor(play.t) });
    if (STORE.endlessLog.length > 5) STORE.endlessLog.length = 5;
  } else {
    STORE.best[curLv] = Math.max(STORE.best[curLv] || 0, play.kills);
  }
  saveStore();
  SCENE = 'over'; sceneT = 0;
}
function endClear() {
  play.chalkEarned = calcChalk(play.kills, true);
  STORE.meta.chalk += play.chalkEarned;
  markCodexBoss(LEVELS[curLv - 1].boss);
  grantAch('boss1');
  if (!(play.hurtCount > 0)) grantAch('nort');
  STORE.best[curLv] = Math.max(STORE.best[curLv] || 0, play.kills);
  if (curLv < LEVELS.length) STORE.unlocked = Math.max(STORE.unlocked, curLv + 1);
  saveStore();
  SCENE = curLv < LEVELS.length ? 'clear' : 'allclear';
  sceneT = 0;
}

/* ---------- 对局主循环 ---------- */
function updatePlay(dt) {
  if (SCENE !== 'play' || !play) return;
  freezeT = Math.max(0, freezeT - dt);
  if (play.state === 'run') {
    play.t += dt;
    updatePlayer(dt);
    if (player.deadT < 0) updateWeapons(dt);
    updateSpawner(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateBossTele(dt);
    updateProjs(dt);
    updateDusts(dt);
    updateDrops(dt);
    /* 水洼寿命（BOSS 减速新星会消散，沼泽水洼永久） */
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      if (p.life !== null && p.life !== undefined) { p.life -= dt; if (p.life <= 0) puddles.splice(i, 1); }
    }
    /* 飘字横幅 */
    for (let i = play.banners.length - 1; i >= 0; i--) { play.banners[i].t -= dt; if (play.banners[i].t <= 0) play.banners.splice(i, 1); }
    /* 进度落盘：无尽最佳实时刷新 + 每 10 秒自动存档（防中途退出丢进度） */
    if (play.endless) {
      var b0 = STORE.bestEndless;
      if (!b0 || play.kills > b0.kills) STORE.bestEndless = { kills: play.kills, round: play.round, t: Math.floor(play.t) };
    }
    play.autosaveT = (play.autosaveT === undefined ? 10 : play.autosaveT) - dt;
    if (play.autosaveT <= 0) { play.autosaveT = 10; saveStore(); }
    /* 死亡 / 通关流程 */
    if (player.deadT >= 0 && player.deadT > 1.9 && play.clearT <= 0) { endGameOver(); return; }
    if (play.clearT > 0) { play.clearT -= dt; if (play.clearT <= 0) { endClear(); return; } }
    updFx(dt);
  } else if (play.state === 'levelup') {
    updFx(dt);
  }
  /* 相机跟随 */
  const tx = clampN(player.x - VW / 2, 0, ARENA_W - VW);
  const ty = clampN(player.y - VH / 2, 0, ARENA_H - VH);
  const k = 1 - Math.pow(0.0015, dt);
  cam.x = lerpN(cam.x, tx, k);
  cam.y = lerpN(cam.y, ty, k);
}

function togglePause() {
  if (!play || play.state === 'levelup') return;
  if (play.state === 'run') { play.state = 'pause'; sfx.sel(); }
  else if (play.state === 'pause') { play.state = 'run'; sfx.sel(); }
}

/* ---------- 通用荧光按钮 ---------- */
function neonButton(label, x, y, w, h, cb, col, size) {
  const c = col || [240, 240, 245];
  const lx = toLX(mouseX), ly = toLY(mouseY);
  const hov = lx >= x && lx <= x + w && ly >= y && ly <= y + h;
  push();
  noFill();
  stroke(c[0], c[1], c[2], hov ? 255 : 170); strokeWeight(hov ? 3 : 2);
  if (hov) glowOn(c, 14);
  rect(x, y, w, h, 10);
  glowOff();
  if (hov) { noStroke(); fill(c[0], c[1], c[2], 22); rect(x, y, w, h, 10); }
  noStroke(); fill(c[0], c[1], c[2]); textAlign(CENTER, CENTER); textStyle(BOLD);
  textSize(size || 19);
  text(label, x + w / 2, y + h / 2 + 1);
  pop();
  uiRects.push({ x, y, w, h, cb });
}

/* ---------- 对局绘制（外层 letterbox 已由 draw() 统一施加） ---------- */
function drawPlay() {
  push();
  /* 屏幕震动 */
  if (shakeAmt > 0.3) translate(rnd(-shakeAmt, shakeAmt), rnd(-shakeAmt, shakeAmt));
  /* 相机 → 世界 */
  push();
  translate(-cam.x, -cam.y);

  drawBgWorld();
  /* 水洼 */
  push(); noStroke();
  const LC = curLvTheme().col;
  for (const p of puddles) {
    const isNova = p.life !== null && p.life !== undefined;
    fill(isNova ? 120 : LC[0], isNova ? 220 : LC[1], isNova ? 255 : LC[2], 26);
    circle(p.x, p.y, p.r * 2);
    noFill(); stroke(isNova ? 120 : LC[0], isNova ? 220 : LC[1], isNova ? 255 : LC[2], 60); strokeWeight(2);
    if (isNova && p.life < 2) drawingContext.setLineDash([8, 8]);
    circle(p.x, p.y, p.r * 2 - 6);
    drawingContext.setLineDash([]);
    noStroke();
  }
  pop();

  drawDusts();
  drawDrops();
  drawEnemies();
  drawBoss();
  if (player.deadT < 1 || player.deadT < 0) drawWeaponsWorld();
  drawPlayer();
  drawProjs();
  drawFx();
  pop();   // 相机

  /* BOSS tele 预警线是屏幕系的，画在相机外（用世界坐标转屏幕：省事直接在世界里画了，此处略） */
  drawVignette();
  /* 时钟冻结：全屏淡蓝脉动（敌人停走，BOSS 免疫） */
  if (freezeT > 0) {
    noStroke(); fill(120, 220, 255, 14 + Math.sin(frameNo * 0.2) * 6);
    rect(0, 0, VW, VH);
  }
  /* 剩 1 心：红色脉动边框警示 */
  if (player.hearts === 1 && player.deadT < 0 && play.clearT <= 0) {
    noFill(); stroke(255, 60, 80, 60 + Math.sin(frameNo * 0.12) * 40); strokeWeight(12);
    rect(6, 6, VW - 12, VH - 12, 20);
    noStroke();
  }

  /* 全屏闪白/红 */
  if (flashA > 0.5) { noStroke(); fill(flashC[0], flashC[1], flashC[2], 255 * (flashA - 0.5)); rect(0, 0, VW, VH); }
  pop();   // 视口

  drawHud();
  if (play.state === 'levelup') drawLevelup();
  if (play.state === 'pause') drawPause();

  /* 通关白闪渐出 */
  if (play.clearT > 0) {
    const k = clampN(1 - play.clearT / 2.1, 0, 1);
    fill(255, 255, 255, 90 * k); noStroke(); rect(0, 0, VW, VH);
    textAlign(CENTER, CENTER); textStyle(BOLD);
    const col = LEVELS[curLv - 1].col;
    glowOn(col, 24);
    fill(255); textSize(56);
    text('通 关 ！', VW / 2, VH / 2 - 20);
    glowOff();
    fill(col[0], col[1], col[2]); textSize(22);
    text('BOSS 已被击碎', VW / 2, VH / 2 + 40);
  }
}

/* ---------- HUD ---------- */
function drawHud() {
  push(); textStyle(BOLD);
  /* 心（剩 1 心时脉动提醒） */
  for (let i = 0; i < player.maxHearts; i++) {
    const filled = i < player.hearts;
    const hs = filled && player.hearts === 1 ? 24 + Math.sin(frameNo * 0.25) * 3.5 : 24;
    if (filled) glowOn([255, 64, 96], 8);
    heartShape(34 + i * 32, 36, hs, filled);
    glowOff();
  }
  /* 等级 + 经验 */
  noStroke(); fill(255, 214, 0); textSize(16); textAlign(LEFT, CENTER);
  text('Lv ' + player.lvl, 22, 70);
  neonBar(66, 62, 190, 14, player.xp / player.need, [255, 214, 0]);
  /* 击杀 */
  textAlign(RIGHT, CENTER); noStroke(); fill(255, 255, 255, 230); textSize(18);
  text('击杀 ' + play.kills, VW - 76, 60);
  /* 计时 */
  textAlign(CENTER, CENTER);
  if (boss) {
    glowOn([255, 80, 80], 12);
    fill(255, 90, 90); textSize(26);
    text('BOSS', VW / 2, 30);
    glowOff();
    /* BOSS 血条 */
    const bw = 440;
    neonBar(VW / 2 - bw / 2, 48, bw, 16, boss.hp / boss.maxHp, boss.enrage ? [255, 90, 80] : boss.def.col, false);
    noStroke(); fill(255, 255, 255, 220); textSize(13);
    text(boss.def.name + (boss.enrage ? ' · 狂暴!' : ''), VW / 2, 76);
  } else if (play.endless) {
    glowOn([255, 255, 255], 8);
    fill(255); textSize(30);
    text('第 ' + play.round + ' 轮 · ' + fmtTime(play.roundT), VW / 2, 30);
    glowOff();
    noStroke(); fill(255, 214, 0, 220); textSize(13);
    text('BOSS 将在 ' + Math.max(0, Math.ceil(300 - play.roundT)) + ' 秒后来袭', VW / 2, 58);
  } else {
    const rem = Math.max(0, 300 - play.t);
    glowOn([255, 255, 255], 8);
    fill(255); textSize(32);
    text(fmtTime(rem), VW / 2, 34);
    glowOff();
  }
  /* 冻结倒计时提示 */
  if (freezeT > 0) {
    glowOn([120, 220, 255], 12);
    fill(160, 235, 255); textSize(20);
    text('❄ 冻结 ' + freezeT.toFixed(1) + ' s', VW / 2, 100);
    glowOff();
  }
  /* 暂停按钮（右上角，触屏可点） */
  neonButton('⏸', VW - 56, 16, 40, 40, () => togglePause(), [220, 220, 230], 18);
  /* 武器栏（左下） */
  let wx = 30;
  const wy = VH - 34;
  textAlign(CENTER, CENTER);
  for (const w of player.weapons) {
    const wcol = WDEF[w.id].col;
    if (w.evolved) { glowOn([255, 214, 0], 10); stroke(255, 214, 0); strokeWeight(2.5); }
    else { noFill(); stroke(wcol[0], wcol[1], wcol[2], 120); strokeWeight(1.5); }
    circle(wx, wy, 40);
    if (w.evolved) glowOff();
    drawIcon(w.id, wx, wy, 28, wcol);
    noStroke(); fill(255, 255, 255, 200); textSize(10);
    text(w.evolved ? '★' : '' + w.lv, wx + 13, wy + 13);
    wx += 50;
  }
  /* 被动（武器后面的小图标） */
  let pi = 0;
  for (const id in player.passives) {
    const py = wy - 1 - Math.floor(pi / 4) * 44;
    const px = wx + 10 + (pi % 4) * 38;
    noStroke(); fill(255, 255, 255, 90); textSize(11); text('·', px - 12, py);
    drawIcon(id === 'heart' ? 'heart' : id, px, py, 22, PASS[id].col);
    noStroke(); fill(255, 255, 255, 170); textSize(9);
    text('' + player.passives[id], px + 11, py + 11);
    pi++;
  }
  /* 横幅 */
  for (const b of play.banners) {
    const a = Math.min(1, b.t / 0.4, (2.4 - b.t) / 0.25 + 1);
    push();
    textAlign(CENTER, CENTER); textStyle(BOLD);
    glowOn([255, 214, 0], 14);
    fill(255, 220, 120, 255 * a); textSize(30);
    text(b.txt, VW / 2, 150);
    glowOff();
    pop();
  }
  /* 虚拟摇杆 */
  if (joy.active) {
    push(); noFill();
    stroke(255, 255, 255, 70); strokeWeight(2.5);
    circle(joy.ox, joy.oy, 108);
    fill(255, 255, 255, 150); noStroke();
    circle(joy.ox + joy.dx, joy.oy + joy.dy, 46);
    pop();
  }
  pop();
}

/* ---------- 暂停菜单 ---------- */
function drawPause() {
  push();
  fill(0, 0, 0, 190); noStroke(); rect(0, 0, VW, VH);
  textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn([120, 220, 255], 16);
  fill(150, 230, 255); textSize(46);
  text('暂 停', VW / 2, 170);
  glowOff();
  neonButton('继续游戏', VW / 2 - 130, 250, 260, 56, () => togglePause(), [120, 220, 255]);
  neonButton('重开本关 (R)', VW / 2 - 130, 326, 260, 56, () => startPlay(curLv), [255, 214, 0]);
  neonButton('返回菜单', VW / 2 - 130, 402, 260, 56, () => { SCENE = 'select'; sceneT = 0; }, [255, 120, 140]);
  neonButton(STORE.mute ? '🔇 音效: 关' : '🔊 音效: 开', VW / 2 - 276, 486, 250, 50, () => { STORE.mute = !STORE.mute; saveStore(); sfx.sel(); }, [200, 200, 210], 16);
  neonButton(LOWFX ? '⚡ 性能模式: 开' : '✨ 性能模式: 关', VW / 2 + 26, 486, 250, 50, () => {
    LOWFX = !LOWFX; STORE.lowfx = LOWFX; saveStore();
    if (!LOWFX) vBuf = null;
    sfx.sel();
  }, [120, 220, 160], 16);
  pop();
}

/* ---------- 标题场景 ---------- */
let titleAng = 0;
function updTitle(dt) { updFloaters(dt); titleAng += dt * 1.6; if (kp('Enter') || kp('Space')) { SCENE = 'select'; sceneT = 0; sfx.ok(); } }
function drawTitle() {
  background(4, 5, 10);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  /* 主标题（微信小游戏注册名：字狂潮） */
  push();
  glowOn([255, 255, 255], 28);
  fill(245, 245, 250); textSize(112);
  text('字 狂 潮', VW / 2, 192);
  glowOff();
  pop();
  /* 中央火柴人 + 铅笔环绕 */
  const px = VW / 2, py = 430;
  push();
  noStroke(); fill(0, 0, 0, 110);
  ellipse(px, py + 34, 52, 14);
  glowOn([240, 240, 245], 14);
  stroke(240, 240, 245); strokeWeight(4.5); strokeCap(ROUND); noFill();
  line(px - 11, py + 18, px - 16, py + 34);
  line(px + 11, py + 18, px + 16, py + 34);
  line(px, py + 18, px, py - 8);
  line(px, py - 5, px - 15, py + 8);
  line(px, py - 5, px + 15, py + 8);
  fill(240, 240, 245); circle(px, py - 20, 20);
  glowOff();
  fill(10, 12, 16);
  circle(px + 6, py - 20, 6);
  circle(px - 2, py - 20, 6);
  for (let i = 0; i < 3; i++) {
    const a = titleAng + (i * TWO_PI) / 3;
    push(); translate(px + Math.cos(a) * 86, py + Math.sin(a) * 30); rotate(a + PI / 2);
    glowOn([255, 214, 0], 10);
    stroke(255, 214, 0); strokeWeight(4.5);
    line(-12, 0, 7, 0);
    noStroke(); fill(255, 240, 180); triangle(7, -3.6, 7, 3.6, 14, 0);
    glowOff();
    pop();
  }
  pop();
  /* 提示 */
  if (blink()) {
    noStroke(); fill(255, 255, 255, 220); textSize(21);
    text('点击 或 按 回车 开始', VW / 2, 570);
  }
  fill(160, 165, 180, 200); textSize(14); textStyle(NORMAL);
  text('俯视角割草肉鸽 · 数字就是血量，挨一下 -1', VW / 2, 636);
  text('世界观联动：《火柴人大战数学》', VW / 2, 660);
  fill(120, 125, 140, 210); textSize(12);
  textAlign(RIGHT, TOP);
  text('v2.2 · 收集图鉴', VW - 14, 8);
  pop();
}

/* ---------- 选关场景 ---------- */
let selPulse = 0;
function updSelect(dt) {
  updFloaters(dt);
  selPulse += dt;
  if (kp('Escape')) { SCENE = 'title'; sceneT = 0; sfx.sel(); }
  if (kp('Enter')) { if (STORE.unlocked >= 1) { startPlay(Math.min(STORE.unlocked, LEVELS.length)); sfx.ok(); } }
  if (kp('KeyE')) { startPlay(0); sfx.ok(); }
  if (kp('KeyB')) { SCENE = 'shop'; sceneT = 0; sfx.sel(); }
  if (kp('KeyC')) { SCENE = 'ach'; sceneT = 0; sfx.sel(); }
  if (kp('KeyT')) { SCENE = 'codex'; sceneT = 0; sfx.sel(); }
  for (let i = 1; i <= Math.min(9, LEVELS.length); i++) {
    if (kp('Digit' + i) && i <= STORE.unlocked) { startPlay(i); sfx.ok(); }
  }
  if (LEVELS.length >= 10 && kp('Digit0') && 10 <= STORE.unlocked) { startPlay(10); sfx.ok(); }
}
function drawSelect() {
  background(4, 5, 10);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  /* 标题 + 两侧装饰线 */
  glowOn([255, 214, 0], 16);
  fill(255, 214, 0); textSize(40);
  text('选择关卡', VW / 2, 74);
  glowOff();
  noFill(); stroke(255, 214, 0, 80); strokeWeight(2);
  line(VW / 2 - 252, 74, VW / 2 - 122, 74);
  line(VW / 2 + 122, 74, VW / 2 + 252, 74);
  fill(200, 205, 215); textSize(15.5); textStyle(NORMAL);
  text('每关 300 秒，活到最后击碎 BOSS 即通关', VW / 2, 116);
  fill(150, 158, 175, 220); textSize(13);
  const keyHint = LEVELS.length >= 10 ? '数字键 1~9、0 直达 · E 无尽 · B 强化 · C 成就 · T 图鉴' : '数字键直达已解锁关卡 · E 无尽 · B 强化 · C 成就 · T 图鉴';
  text(keyHint, VW / 2, 140);
  textStyle(BOLD);

  /* ---------- 卡片网格：≤5 张单行，>5 张自动 5+5 / 6+6 双行 ---------- */
  const n = LEVELS.length;
  const perRow = n <= 5 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / perRow);
  const gap = 22;
  const cw = Math.min(320, (VW - 80 - (perRow - 1) * gap) / perRow);
  const ch = rows === 1 ? 300 : 204;
  const y0 = rows === 1 ? 210 : 176;
  for (let i = 0; i < n; i++) {
    const L = LEVELS[i];
    const row = Math.floor(i / perRow), col = i % perRow;
    const rowCount = Math.min(perRow, n - row * perRow);
    const rowW = rowCount * cw + (rowCount - 1) * gap;
    const x = VW / 2 - rowW / 2 + col * (cw + gap), y = y0 + row * (ch + 18);
    const unlocked = i < STORE.unlocked;
    const hov = toLX(mouseX) >= x && toLX(mouseX) <= x + cw && toLY(mouseY) >= y && toLY(mouseY) <= y + ch;
    const c = L.col;
    const best = STORE.best[i + 1];
    push();
    if (unlocked && hov) translate(x + cw / 2, y + ch / 2), scale(1.04), translate(-(x + cw / 2), -(y + ch / 2));
    /* 卡框 */
    noFill();
    stroke(c[0], c[1], c[2], unlocked ? (hov ? 255 : 190) : 80);
    strokeWeight(hov ? 3.5 : 2.5);
    if (unlocked) glowOn(c, hov ? 18 : 9);
    rect(x, y, cw, ch, 14);
    glowOff();
    if (unlocked) { noStroke(); fill(c[0], c[1], c[2], 20); rect(x, y, cw, ch, 14); }
    const cx = x + cw / 2;
    /* 顶部：关卡号 + 名称 */
    noStroke();
    fill(unlocked ? 165 : 120, unlocked ? 170 : 125, unlocked ? 180 : 135);
    textSize(12.5); textStyle(NORMAL);
    text(L.tag, cx, y + 28);
    if (unlocked) { glowOn(c, 8); fill(c[0], c[1], c[2]); }
    else fill(130, 135, 145);
    textStyle(BOLD); textSize(20);
    text(L.name, cx, y + 56);
    glowOff();
    /* 中部：大数字（锁定卡换成锁图形） */
    if (unlocked) {
      glowOn(c, 12);
      fill(c[0], c[1], c[2]);
      textSize(54);
      text('' + (i + 1), cx, y + 112);
      glowOff();
    } else {
      /* 手绘荧光锁（占大数字位） */
      noFill(); stroke(150, 158, 175, 220); strokeWeight(4);
      arc(cx, y + 100, 30, 34, PI, 0);
      noStroke(); fill(150, 158, 175, 210);
      rect(cx - 21, y + 100, 42, 30, 6);
      fill(4, 5, 10);
      circle(cx, y + 111, 9);
      rect(cx - 2, y + 111, 4, 13, 2);
    }
    /* 下部：三行特性（按卡宽自动缩字号） */
    fill(215, 220, 230, unlocked ? 225 : 90);
    textStyle(NORMAL);
    const mc = Math.max(...L.feats.map(f => f.length));
    textSize(Math.min(11.5, (cw - 14) / mc));
    for (let li = 0; li < L.feats.length; li++) text(L.feats[li], cx, y + 140 + li * 18.5);
    textStyle(BOLD);
    /* 底部：最佳战绩 / 悬停提示 */
    if (unlocked) {
      if (hov && blink()) {
        noStroke(); fill(255); textSize(14);
        text('点击进入 ▶', cx, y + ch - 13);
      } else {
        noStroke(); fill(best ? [255, 214, 0] : [150, 158, 175], best ? 220 : 160); textSize(11.5);
        text(best ? '★ 最佳击杀 ' + best : '尚未通关', cx, y + ch - 13);
      }
      /* 已通关角标 ✓ */
      if (best) {
        noFill(); stroke(c[0], c[1], c[2], 230); strokeWeight(2.5);
        circle(x + cw - 17, y + 17, 17);
        strokeWeight(3);
        line(x + cw - 22, y + 17, x + cw - 18, y + 21);
        line(x + cw - 18, y + 21, x + cw - 12, y + 12);
      }
      const li_ = i;
      uiRects.push({ x, y, w: cw, h: ch, cb: () => { startPlay(li_ + 1); sfx.ok(); } });
    } else {
      noStroke(); fill(150, 158, 175, 235); textSize(12);
      text('通关上一关解锁', cx, y + ch - 13);
    }
    pop();
  }

  /* ---------- 底部操作区：返回 + 无尽入口 同排 ---------- */
  const gridBottom = y0 + rows * ch + (rows - 1) * 18;
  const btnY = Math.min(gridBottom + 18, VH - 96);
  const eb = STORE.bestEndless;
  neonButton('返回', 30, btnY, 100, 52, () => { SCENE = 'title'; sceneT = 0; sfx.sel(); }, [200, 200, 210], 16);
  neonButton('📖 图鉴', 146, btnY, 100, 52, () => { SCENE = 'codex'; sceneT = 0; sfx.sel(); }, [140, 200, 255], 16);
  neonButton('🏆 成就', 262, btnY, 100, 52, () => { SCENE = 'ach'; sceneT = 0; sfx.sel(); }, [255, 214, 0], 16);
  neonButton('🔧 强化', VW - 150, btnY, 120, 52, () => { SCENE = 'shop'; sceneT = 0; sfx.sel(); }, [205, 160, 255], 16);
  neonButton(
    '♾ 无尽模式' + (eb ? ' · 最佳 ' + eb.kills + ' 杀 / 第 ' + eb.round + ' 轮' : ' · 300秒一轮BOSS，轮轮加强，看你能撑几轮'),
    378, btnY, VW - 378 - 150 - 18, 52,
    () => { startPlay(0); sfx.ok(); },
    [205, 160, 255], 18);
  /* 近期战绩 */
  const log = STORE.endlessLog || [];
  if (log.length) {
    noStroke(); fill(190, 175, 220, 210); textAlign(CENTER, CENTER); textSize(12.5); textStyle(NORMAL);
    text('近期：' + log.slice(0, 3).map(r => r.kills + '杀/第' + r.round + '轮').join(' · '), VW / 2, btnY + 70);
    textStyle(BOLD);
  }
  pop();
}

/* ---------- 失败场景 ---------- */
function updOver(dt) {
  updFloaters(dt);
  if (kp('Enter') || kp('KeyR')) { startPlay(curLv); sfx.ok(); }
  if (kp('Escape')) { SCENE = 'select'; sceneT = 0; sfx.sel(); }
}
function drawOver() {
  background(16, 4, 8);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn([255, 80, 90], 20);
  fill(255, 90, 100); textSize(52);
  text('火柴人倒下了…', VW / 2, 200);
  glowOff();
  noStroke(); fill(230, 230, 240); textSize(20);
  if (play.endless) {
    text('无尽模式 · 止步第 ' + play.round + ' 轮', VW / 2, 260);
    fill(255, 214, 0); textSize(24);
    text('击杀 ' + play.kills + '  ·  存活 ' + fmtTime(play.t), VW / 2, 318);
    fill(205, 160, 255); textSize(17);
    text('粉笔 +' + (play.chalkEarned || 0), VW / 2, 350);
    const be = STORE.bestEndless;
    if (be) { fill(180, 185, 200); textSize(16); text('最佳：击杀 ' + be.kills + ' · 第 ' + be.round + ' 轮', VW / 2, 382); }
  } else {
    text('被数字大军淹没在 ' + LEVELS[curLv - 1].name, VW / 2, 260);
    fill(255, 214, 0); textSize(24);
    text('本局击杀 ' + play.kills + '  ·  到达 ' + fmtTime(Math.min(300, play.t)), VW / 2, 318);
    fill(205, 160, 255); textSize(17);
    text('粉笔 +' + (play.chalkEarned || 0), VW / 2, 350);
    const best = STORE.best[curLv];
    if (best) { fill(180, 185, 200); textSize(16); text('最佳击杀 ' + best, VW / 2, 382); }
  }
  neonButton('再战一局', VW / 2 - 280, 430, 260, 58, () => { startPlay(curLv); sfx.ok(); }, [255, 214, 0]);
  neonButton('返回选关', VW / 2 + 20, 430, 260, 58, () => { SCENE = 'select'; sceneT = 0; sfx.sel(); }, [200, 200, 210]);
  pop();
}

/* ---------- 通关 / 全通场景 ---------- */
let clearT2 = 0;
function updClear(dt) {
  updFloaters(dt); clearT2 += dt;
  /* Enter = 主按钮：战役通关进下一关；全通/无下一关回选关；R = 重打本关 */
  const hasNext = SCENE === 'clear' && curLv < LEVELS.length;
  if (sceneT > 30 && kp('Enter')) {
    if (hasNext) { startPlay(curLv + 1); sfx.ok(); }
    else { SCENE = 'select'; sceneT = 0; sfx.ok(); }
  }
  if (sceneT > 30 && kp('KeyR')) { startPlay(curLv); sfx.ok(); }
  if (kp('Escape')) { SCENE = 'select'; sceneT = 0; sfx.sel(); }
}
function drawClear() {
  background(4, 10, 6);
  drawFloaters();
  const L = LEVELS[curLv - 1];
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn(L.col, 24);
  fill(255); textSize(54);
  text(L.tag + ' 「' + L.name + '」 通关！', VW / 2, 170);
  glowOff();
  noStroke(); fill(230, 232, 240); textSize(21);
  text('击碎 ' + BOSS_DEF[L.boss].name + ' · 本局击杀 ' + play.kills, VW / 2, 236);
  fill(205, 160, 255); textSize(17);
  text('粉笔 +' + (play.chalkEarned || 0), VW / 2, 270);
  if (curLv < LEVELS.length) {
    neonButton('进入下一关 ▶', VW / 2 - 280, 330, 260, 60, () => { startPlay(curLv + 1); sfx.ok(); }, L.col);
    neonButton('返回选关', VW / 2 + 20, 330, 260, 60, () => { SCENE = 'select'; sceneT = 0; sfx.sel(); }, [200, 200, 210]);
  } else {
    neonButton('返回选关', VW / 2 - 130, 330, 260, 60, () => { SCENE = 'select'; sceneT = 0; sfx.ok(); }, L.col);
  }
  pop();
}

/* 全通彩蛋：原点之神终章 + 联动前作《火柴人大战数学》第二季伏笔 */
function drawAllclear() {
  background(10, 10, 14);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  const t = sceneT;
  /* 原点之神「0」剪影 */
  push();
  translate(VW / 2, 290 + Math.sin(t * 0.03) * 6);
  const c = [230, 230, 240];
  glowOn(c, 30);
  noFill(); stroke(c[0], c[1], c[2], 235); strokeWeight(26);
  circle(0, 0, 190);
  strokeWeight(5);
  line(-40, 130, -46 + Math.sin(t * 2) * 6, 148); line(40, 130, 46 - Math.sin(t * 2) * 6, 148);
  glowOff();
  noStroke(); fill(255, 214, 0, 235);
  triangle(-46, -104, -36, -142, -26, -106);
  triangle(-24, -114, 0, -158, 24, -114);
  triangle(26, -106, 36, -142, 46, -104);
  pop();
  glowOn([230, 230, 240], 18);
  fill(240, 240, 250); textSize(40);
  text('数字狂潮 · 全通关！', VW / 2, 92);
  glowOff();
  fill(240, 240, 250); textSize(22); textStyle(NORMAL);
  const best10 = STORE.best[LEVELS.length];
  const lines = [
    '原点归零，数字大军化作漫天粉笔屑……',
    '「零即是无限。火柴人，你就是新的原点。」',
    best10 ? '黑板世界记住了你的 ' + best10 + ' 次击杀。' : '黑板世界重归寂静。',
    '粉笔 +' + ((play && play.chalkEarned) || 0) + ' 入账。',
    '',
    '—— 正传《火柴人大战数学》第二季《乘方女王》伏笔，在此应验 ——',
  ];
  for (let i = 0; i < lines.length; i++) {
    if (i === 4) fill(255, 214, 0); else fill(235, 235, 245);
    textSize(i === 4 ? 17 : 22);
    text(lines[i], VW / 2, 470 + i * 34);
  }
  if (blink() && sceneT > 60) { noStroke(); fill(255, 255, 255, 210); textStyle(BOLD); textSize(18); text('点击 / 回车 返回选关', VW / 2, 662); }
  uiRects.push({ x: 0, y: 0, w: VW, h: VH, cb: () => { SCENE = 'select'; sceneT = 0; } });
  pop();
}

/* ---------- 永久强化商店（全局货币：粉笔） ---------- */
const META_ORDER = ['heart', 'spd', 'luck', 'atk', 'mag', 'xp', 'boot', 'gain'];
function updShop(dt) {
  updFloaters(dt);
  if (kp('Escape') || kp('Enter')) { SCENE = 'select'; sceneT = 0; sfx.sel(); }
  for (let i = 0; i < META_ORDER.length; i++) {
    if (kp('Digit' + (i + 1))) buyMeta(META_ORDER[i]);
  }
}
function drawShop() {
  background(8, 6, 14);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn([205, 160, 255], 16);
  fill(215, 175, 255); textSize(40);
  text('永 久 强 化', VW / 2, 60);
  glowOff();
  noStroke(); fill(205, 160, 255); textSize(17); textStyle(NORMAL);
  text('🖍 粉笔 ' + STORE.meta.chalk + ' · 每局按击杀结算', VW / 2, 100);
  textStyle(BOLD);

  const n = META_ORDER.length;
  const cols = 4;
  const cw = 274, ch = 218, gap = 22;
  const x0 = VW / 2 - (cols * cw + (cols - 1) * gap) / 2, y0 = 136;
  for (let i = 0; i < n; i++) {
    const id = META_ORDER[i], d = META_DEF[id];
    const lv = metaLv(id), cost = metaCost(id);
    const row = Math.floor(i / cols), col = i % cols;
    const x = x0 + col * (cw + gap), y = y0 + row * (ch + 20);
    const maxed = lv >= d.max, afford = STORE.meta.chalk >= cost;
    push();
    noFill();
    stroke(d.col[0], d.col[1], d.col[2], maxed ? 90 : (afford ? 230 : 110));
    strokeWeight(afford && !maxed ? 3 : 2);
    if (afford && !maxed) glowOn(d.col, 10);
    rect(x, y, cw, ch, 14);
    glowOff();
    if (afford && !maxed) { noStroke(); fill(d.col[0], d.col[1], d.col[2], 18); rect(x, y, cw, ch, 14); }
    /* 图标 + 名称 + 等级 */
    push(); glowOn(d.col, 10); drawIcon(d.icon, x + 40, y + 42, 40, d.col); glowOff(); pop();
    noStroke(); fill(d.col[0], d.col[1], d.col[2]); textAlign(LEFT, CENTER); textSize(21);
    text(d.name, x + 72, y + 36);
    fill(255, 255, 255, 200); textSize(14);
    text('Lv ' + lv + ' / ' + d.max, x + 72, y + 60);
    /* 效果说明 */
    fill(220, 224, 235); textSize(14.5); textStyle(NORMAL);
    text(d.tip, x + 22, y + 104);
    textStyle(BOLD);
    /* 等级格 */
    for (let k = 0; k < d.max; k++) {
      noStroke();
      if (k < lv) fill(d.col[0], d.col[1], d.col[2]); else fill(255, 255, 255, 40);
      rect(x + 22 + k * 26, y + 132, 18, 10, 3);
    }
    /* 价格 / 满级 */
    textAlign(CENTER, CENTER);
    if (maxed) {
      noStroke(); fill(255, 214, 0); textSize(17);
      text('★ 已满级', x + cw / 2, y + ch - 26);
    } else {
      noStroke(); fill(afford ? 255 : 150, afford ? 214 : 155, afford ? 0 : 170); textSize(18);
      text('🖍 ' + cost, x + cw / 2, y + ch - 26);
    }
    pop();
    if (!maxed) uiRects.push({ x, y, w: cw, h: ch, cb: () => buyMeta(id) });
  }
  /* 底部返回 */
  const rows = Math.ceil(n / cols);
  const by = Math.min(y0 + rows * (ch + 20) + 4, VH - 76);
  neonButton('返回选关 (Esc)', VW / 2 - 130, by, 260, 52, () => { SCENE = 'select'; sceneT = 0; sfx.sel(); }, [200, 200, 210], 17);
  pop();
}

/* ---------- 成就页 + 存档导入导出（v2.1） ---------- */
function updAch(dt) {
  updFloaters(dt);
  if (kp('Escape') || kp('Enter')) { SCENE = 'select'; sceneT = 0; sfx.sel(); }
}
function drawAch() {
  background(10, 8, 5);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn([255, 214, 0], 16);
  fill(255, 220, 120); textSize(40);
  text('成 就', VW / 2, 56);
  glowOff();
  const done = ACH_ORDER.filter(id => STORE.ach[id]).length;
  noStroke(); fill(230, 225, 210); textSize(16); textStyle(NORMAL);
  text('已解锁 ' + done + ' / ' + ACH_ORDER.length + ' · 成就奖励以粉笔发放', VW / 2, 94);
  textStyle(BOLD);
  const cols = 2, cw = 560, ch = 86, gap = 20;
  const x0 = VW / 2 - (cols * cw + gap) / 2, y0 = 120;
  for (let i = 0; i < ACH_ORDER.length; i++) {
    const id = ACH_ORDER[i], d = ACH_DEF[id];
    const got = !!STORE.ach[id];
    const row = Math.floor(i / cols), col = i % cols;
    const x = x0 + col * (cw + gap), y = y0 + row * (ch + 14);
    push();
    noFill();
    stroke(got ? 255 : 130, got ? 214 : 132, got ? 0 : 145, got ? 220 : 90);
    strokeWeight(got ? 2.5 : 1.5);
    if (got) glowOn([255, 214, 0], 8);
    rect(x, y, cw, ch, 12);
    glowOff();
    if (got) { noStroke(); fill(255, 214, 0, 22); rect(x, y, cw, ch, 12); }
    textAlign(CENTER, CENTER);
    noStroke(); fill(got ? 255 : 120, got ? 214 : 124, got ? 0 : 136); textSize(24);
    text(got ? '🏆' : '🔒', x + 40, y + ch / 2);
    textAlign(LEFT, CENTER);
    noStroke(); fill(got ? 255 : 200, got ? 220 : 202, got ? 120 : 212); textSize(19);
    text(d.name, x + 74, y + 28);
    fill(205, 208, 220); textSize(14); textStyle(NORMAL);
    text(d.tip, x + 74, y + 56);
    textStyle(BOLD);
    textAlign(RIGHT, CENTER);
    fill(got ? 120 : 255, got ? 210 : 160, got ? 130 : 255);
    textSize(15);
    text((got ? '已获得 ' : '奖励 🖍 ') + d.reward, x + cw - 18, y + ch / 2);
    pop();
  }
  const rows = Math.ceil(ACH_ORDER.length / cols);
  const by = Math.min(y0 + rows * (ch + 14) + 8, VH - 76);
  neonButton('返回选关 (Esc)', 30, by, 200, 52, () => { SCENE = 'select'; sceneT = 0; sfx.sel(); }, [200, 200, 210], 17);
  neonButton('📤 导出存档', VW / 2 - 220, by, 200, 52, exportSave, [120, 220, 255], 16);
  neonButton('📥 导入存档', VW / 2 + 20, by, 200, 52, importSave, [160, 220, 160], 16);
  pop();
}
function exportSave() {
  const data = JSON.stringify({ v: 2, exportedAt: Date.now(), store: STORE });
  const done = () => showToast('存档已复制到剪贴板');
  try {
    navigator.clipboard.writeText(data).then(done, () => fallbackCopy(data, done));
  } catch (e) { fallbackCopy(data, done); }
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { showToast('复制失败'); }
}
function importSave() {
  const s = prompt('粘贴存档 JSON（导入会覆盖当前进度）：');
  if (!s) return;
  try {
    const p = JSON.parse(s);
    const st = p && p.store ? p.store : p;
    if (!st || !(st.unlocked >= 1)) throw new Error('bad');
    STORE.unlocked = st.unlocked;
    STORE.best = st.best || {};
    STORE.mute = !!st.mute; STORE.lowfx = !!st.lowfx;
    STORE.bestEndless = st.bestEndless || null;
    STORE.endlessLog = st.endlessLog || [];
    STORE.meta = st.meta && st.meta.lv ? st.meta : { chalk: 0, lv: {} };
    STORE.ach = st.ach || {};
    STORE.codex = st.codex && st.codex.kinds ? st.codex : { kinds: {}, bosses: {} };
    STORE.codexRew = st.codexRew || {};
    saveStore(); sfx.ok();
    showToast('存档导入成功');
  } catch (e) { showToast('存档格式无效'); }
}

/* ---------- 怪物图鉴页（v2.2） ---------- */
function updCodex(dt) {
  updFloaters(dt);
  if (kp('Escape') || kp('Enter')) { SCENE = 'select'; sceneT = 0; sfx.sel(); }
}
function drawCodex() {
  background(6, 8, 12);
  drawFloaters();
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  glowOn([140, 200, 255], 16);
  fill(170, 215, 255); textSize(36);
  text('怪 物 图 鉴', VW / 2, 42);
  glowOff();
  const total = CODEX_KIND_ORDER.length + Object.keys(BOSS_DEF).length;
  let n = 0;
  for (const k of CODEX_KIND_ORDER) if (STORE.codex.kinds[k]) n++;
  for (const b in STORE.codex.bosses) if (STORE.codex.bosses[b]) n++;
  noStroke(); fill(200, 210, 230); textSize(15); textStyle(NORMAL);
  text('已收录 ' + n + ' / ' + total + '（' + Math.round((n / total) * 100) + '%） · 25/50/75/100% 里程碑有粉笔奖励', VW / 2, 74);
  textStyle(BOLD);
  textAlign(RIGHT, TOP);
  fill(150, 158, 175, 210); textSize(13);
  text('Esc 返回选关', VW - 14, 8);
  textAlign(CENTER, CENTER); textStyle(BOLD);

  const cw = 236, gap = 12, x0 = VW / 2 - (5 * cw + 4 * gap) / 2;
  /* 怪物区 */
  noStroke(); fill(140, 200, 255, 200); textSize(15);
  text('—— 怪 物 ——', VW / 2, 106);
  for (let i = 0; i < CODEX_KIND_ORDER.length; i++) {
    const id = CODEX_KIND_ORDER[i], kd = CODEX_KINDS[id];
    const got = !!STORE.codex.kinds[id];
    const col = got ? (id === 'num' ? [140, 255, 170] : (KIND_COL[id] || [235, 235, 245])) : [54, 58, 70];
    const row = Math.floor(i / 5), c = i % 5;
    const x = x0 + c * (cw + gap), y = 120 + row * 128;
    push();
    noFill(); stroke(col[0], col[1], col[2], got ? 210 : 70); strokeWeight(got ? 2.5 : 1.5);
    if (got) glowOn(col, 9);
    rect(x, y, cw, 118, 12);
    glowOff();
    textAlign(CENTER, CENTER);
    noStroke(); fill(col[0], col[1], col[2], got ? 255 : 90); textSize(38);
    text(CODEX_CHAR[id], x + cw / 2, y + 40);
    fill(got ? 235 : 112, got ? 238 : 114, got ? 246 : 124, got ? 230 : 80); textSize(15);
    text(got ? kd.name : '？？？', x + cw / 2, y + 78);
    if (got) {
      fill(160, 168, 185); textSize(12); textStyle(NORMAL);
      text(kd.tip, x + cw / 2, y + 100);
      textStyle(BOLD);
    }
    pop();
  }
  /* BOSS 区 */
  noStroke(); fill(255, 120, 140, 210); textSize(15);
  text('—— BOSS ——', VW / 2, 520);
  const bKeys = Object.keys(BOSS_DEF);
  for (let i = 0; i < bKeys.length; i++) {
    const key = bKeys[i], d = BOSS_DEF[key];
    const got = !!STORE.codex.bosses[key];
    const col = got ? d.col : [54, 58, 70];
    const row = Math.floor(i / 5), c = i % 5;
    const x = x0 + c * (cw + gap), y = 532 + row * 90;
    const lvTag = (LEVELS.find(l => l.boss === key) || {}).tag || '';
    push();
    noFill(); stroke(col[0], col[1], col[2], got ? 220 : 70); strokeWeight(got ? 2.5 : 1.5);
    if (got) glowOn(col, 10);
    rect(x, y, cw, 82, 12);
    glowOff();
    textAlign(CENTER, CENTER);
    noStroke(); fill(col[0], col[1], col[2], got ? 255 : 90); textSize(30);
    text(d.char, x + 36, y + 41);
    textAlign(LEFT, CENTER);
    fill(got ? 240 : 112, got ? 242 : 114, got ? 250 : 124, got ? 235 : 80); textSize(17);
    text(got ? d.name : '？？？', x + 68, y + 33);
    fill(160, 168, 185); textSize(12); textStyle(NORMAL);
    text(got ? lvTag : '击败后收录', x + 68, y + 58);
    textStyle(BOLD);
    pop();
  }
  pop();
}
