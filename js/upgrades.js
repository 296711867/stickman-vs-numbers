/* ============================================================
 * 升级三选一 —— 肉鸽构筑：新武器 / 武器升级 / 被动
 * ============================================================ */
'use strict';

const PASS = {
  atk:    { name: '攻击速度', tip: '所有武器冷却 -12%', max: 5, col: [255, 214, 0] },
  area:   { name: '范围扩大', tip: '武器范围 +15%', max: 5, col: [120, 220, 255] },
  magnet: { name: '磁力粉笔', tip: '经验拾取范围 +40%', max: 3, col: [255, 150, 200] },
  speed:  { name: '轻快步伐', tip: '移动速度 +8%', max: 3, col: [110, 255, 140] },
  heart:  { name: '心之容器', tip: '心血上限 +1，并回复 1 心', max: 3, col: [255, 64, 96] },
  luck:   { name: '幸运星', tip: '道具掉落率 +35%', max: 3, col: [255, 214, 0] },
  crit:   { name: '会心一击', tip: '8% 概率一次 -2', max: 5, col: [255, 170, 70] },
  shield: { name: '粉笔护盾', tip: '抵挡 1 次伤害，18 秒充能', max: 1, col: [120, 220, 255] },
};

function openLevelup() {
  play.state = 'levelup';
  play.choices = buildChoices();
  sfx.lvlup();
}

function evoReadyList() {
  return player.weapons.filter(w => w.lv >= 5 && !w.evolved && (player.passives[(WDEF[w.id].evo || {}).pass] || 0) >= 1);
}

function buildChoices() {
  /* 进化优先：满级武器 + 对应被动已持有 → 金色进化卡必占首位 */
  const ready = evoReadyList();
  if (ready.length) {
    const w = pick(ready);
    const rest = [];
    for (const ww of player.weapons) if (ww.lv < 5 && ww.id !== w.id) rest.push({ kind: 'w', id: ww.id, lv: ww.lv + 1 });
    for (const id in PASS) {
      const cur = player.passives[id] || 0;
      if (cur > 0 && cur < PASS[id].max) rest.push({ kind: 'p', id, lv: cur + 1 });
    }
    rest.push({ kind: 'heal' });
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [{ kind: 'evo', id: w.id }, ...rest.slice(0, 2)];
  }
  const pool = [];
  /* 武器升级 / 新武器 */
  for (const w of player.weapons) {
    if (w.lv < 5) pool.push({ kind: 'w', id: w.id, lv: w.lv + 1 });
  }
  if (player.weapons.length < 4) {
    for (const id in WDEF) {
      if (!player.weapons.find(w => w.id === id)) pool.push({ kind: 'w', id, lv: 1, isNew: true });
    }
  }
  /* 被动升级 / 新被动 */
  const pCount = Object.keys(player.passives).length;
  for (const id in PASS) {
    const cur = player.passives[id] || 0;
    if (cur > 0 && cur < PASS[id].max) pool.push({ kind: 'p', id, lv: cur + 1 });
    else if (cur === 0 && pCount < 4) pool.push({ kind: 'p', id, lv: 1, isNew: true });
  }
  /* 兜底：回心血 */
  pool.push({ kind: 'heal' });
  /* 打乱取 3 */
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function applyChoice(idx) {
  const c = play.choices && play.choices[idx];
  if (!c) return;
  sfx.ok();
  if (c.kind === 'evo') {
    const w = player.weapons.find(x => x.id === c.id);
    if (w) {
      w.evolved = true;
      popText(player.x, player.y - 66, '进化！' + WDEF[c.id].evo.name, [255, 214, 0], 24);
      burst(player.x, player.y - 20, [255, 214, 0], 26, 260);
      ringFx(player.x, player.y - 18, 14, 90, 0.6, [255, 214, 0], 4);
      addFlash(0.25, [255, 230, 160]);
      sfx.gift(); sfx.lvlup();
    }
  } else if (c.kind === 'w') {
    const owned = player.weapons.find(w => w.id === c.id);
    if (owned) owned.lv = c.lv;
    else player.weapons.push({ id: c.id, lv: 1, cd: 0.3, ang: rnd(0, TWO_PI), sweepT: 0 });
    popText(player.x, player.y - 60, WDEF[c.id].name + ' Lv' + c.lv + '!', WDEF[c.id].col, 20);
  } else if (c.kind === 'p') {
    player.passives[c.id] = c.lv;
    if (c.id === 'heart') player.maxHearts = Math.min(8, player.maxHearts + 1);
    if (c.id === 'shield') player.shieldUp = true;
    recomputeStats();
    popText(player.x, player.y - 60, PASS[c.id].name + ' Lv' + c.lv + '!', PASS[c.id].col, 20);
  } else if (c.kind === 'heal') {
    player.hearts = Math.min(player.maxHearts, player.hearts + 1);
    popText(player.x, player.y - 60, '回复 1 心', [255, 64, 96], 20);
    sfx.heal();
  }
  play.pendingLv--;
  burst(player.x, player.y - 20, [255, 214, 0], 12, 200);
  if (play.pendingLv > 0) play.choices = buildChoices();
  else { play.choices = null; play.state = 'run'; }
}

/* ---------- 三选一绘制 ---------- */
function cardInfo(c) {
  if (c.kind === 'evo') {
    const d = WDEF[c.id];
    return {
      title: d.evo.name, col: [255, 214, 0], icon: c.id,
      lvTxt: '★ 进化 · MAX',
      tip: d.evo.desc,
    };
  }
  if (c.kind === 'w') {
    const d = WDEF[c.id];
    return {
      title: d.name, col: d.col, icon: c.id,
      lvTxt: c.isNew ? '新武器!' : 'Lv ' + (c.lv - 1) + ' → ' + c.lv,
      tip: c.isNew ? d.tip : d.desc[c.lv - 2],
    };
  }
  if (c.kind === 'p') {
    const d = PASS[c.id];
    return {
      title: d.name, col: d.col, icon: c.id,
      lvTxt: c.isNew ? '新被动!' : 'Lv ' + (c.lv - 1) + ' → ' + c.lv,
      tip: d.tip,
    };
  }
  return { title: '粉笔牛奶', col: [255, 64, 96], icon: 'milk', lvTxt: '即时回复', tip: '回复 1 颗心血' };
}

function drawLevelup() {
  const n = play.choices.length;
  fill(0, 0, 0, 200); noStroke();
  rect(0, 0, VW, VH);
  textAlign(CENTER, CENTER); textStyle(BOLD);
  /* 标题 */
  glowOn([255, 214, 0], 16);
  fill(255, 214, 0); textSize(40);
  text('升 级 ！', VW / 2, 96);
  glowOff();
  fill(220, 220, 230); textSize(17);
  text('选择一项强化' + (play.pendingLv > 1 ? '（还有 ' + (play.pendingLv - 1) + ' 次待选）' : ''), VW / 2, 140);

  const cw = 252, ch = 330, gap = 46;
  const total = n * cw + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    const c = play.choices[i], info = cardInfo(c);
    const x = VW / 2 - total / 2 + i * (cw + gap), y = 190;
    const hov = mouseX !== undefined && toLX(mouseX) >= x && toLX(mouseX) <= x + cw && toLY(mouseY) >= y && toLY(mouseY) <= y + ch;
    push();
    if (hov) translate(x + cw / 2, y + ch / 2), scale(1.04), translate(-(x + cw / 2), -(y + ch / 2));
    /* 卡框 */
    noFill(); stroke(info.col[0], info.col[1], info.col[2], hov ? 255 : 190); strokeWeight(hov ? 3.5 : 2.5);
    glowOn(info.col, c.kind === 'evo' ? (16 + Math.sin(frameNo * 0.2) * 8) : (hov ? 16 : 8));
    rect(x, y, cw, ch, 14);
    glowOff();
    fill(info.col[0], info.col[1], info.col[2], 26); noStroke();
    rect(x, y, cw, ch, 14);
    /* 进化徽标 */
    if (c.kind === 'evo') {
      noStroke(); fill(255, 214, 0);
      textAlign(CENTER, CENTER); textStyle(BOLD); textSize(14);
      text('⚡ 武 器 进 化 ⚡', x + cw / 2, y + 26);
    }
    /* 图标 */
    push();
    glowOn(info.col, 12);
    drawIcon(info.icon, x + cw / 2, y + 86, 56, info.col);
    glowOff();
    pop();
    /* 名称 / 等级 / 描述 */
    fill(info.col[0], info.col[1], info.col[2]); textSize(23);
    text(info.title, x + cw / 2, y + 156);
    fill(255, 255, 255, 210); textSize(15);
    text(info.lvTxt, x + cw / 2, y + 186);
    fill(225, 228, 235); textSize(14.5); textStyle(NORMAL);
    /* 手动换行 */
    const words = info.tip;
    if (textWidth(words) > cw - 36) {
      const mid = Math.ceil(words.length / 2);
      text(words.slice(0, mid), x + cw / 2, y + 224);
      text(words.slice(mid), x + cw / 2, y + 246);
    } else {
      text(words, x + cw / 2, y + 234);
    }
    textStyle(BOLD);
    /* 按键提示 */
    noFill(); stroke(255, 255, 255, 90); strokeWeight(1.5);
    rect(x + cw / 2 - 16, y + ch - 42, 32, 26, 6);
    noStroke(); fill(255, 255, 255, 170); textSize(15);
    text('' + (i + 1), x + cw / 2, y + ch - 29);
    pop();
    uiRects.push({ x, y, w: cw, h: ch, cb: () => applyChoice(i) });
  }
}
