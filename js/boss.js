/* ============================================================
 * BOSS —— 加号大王 / 减号女巫 / 乘方女王（联动前作第二季伏笔）
 * 同样遵守"挨一下 -1"，但免疫时钟冻结
 * ============================================================ */
'use strict';

const BOSS_DEF = {
  plusKing:   { name: '加号大王', hp: 120, r: 46, spd: 66, col: [110, 255, 140], char: '+', pats: ['cross', 'ring', 'summon'] },
  minusWitch: { name: '减号女巫', hp: 160, r: 44, spd: 76, col: [100, 210, 255], char: '−', pats: ['fan', 'nova', 'blink', 'summon'] },
  powerQueen: { name: '乘方女王', hp: 200, r: 50, spd: 84, col: [255, 80, 120], char: '2', pats: ['expo', 'charge', 'guard', 'crown'] },
  sqrtDemon:  { name: '根号魔王', hp: 240, r: 48, spd: 88, col: [190, 120, 255], char: '√', pats: ['blink', 'ring', 'summon', 'phase'] },
  phiKing:    { name: '黄金之王', hp: 300, r: 52, spd: 92, col: [255, 200, 40], char: 'φ', pats: ['spiral', 'vortex', 'tide', 'guard'], revive: true },
  pctKing:    { name: '百分大帝', hp: 260, r: 48, spd: 90, col: [150, 210, 255], char: '%', pats: ['cross', 'fan', 'nova', 'ring'] },
  tongfenColossus: { name: '通分巨像', hp: 280, r: 52, spd: 88, col: [80, 255, 170], char: '½', pats: ['ring', 'spiral', 'summon', 'crown'] },
  infWalker:  { name: '无穷行者', hp: 320, r: 52, spd: 94, col: [235, 235, 245], char: '∞', pats: ['blink', 'phase', 'tide', 'vortex'], reviveN: 2 },
  diffDemon:  { name: '微分恶魔', hp: 340, r: 50, spd: 96, col: [170, 120, 255], char: '∂', pats: ['expo', 'spiral', 'charge', 'guard'] },
  originGod:  { name: '原点之神', hp: 400, r: 56, spd: 98, col: [235, 235, 240], char: '0', pats: ['ring', 'cross', 'summon'],
    phasePats: [['ring', 'cross', 'summon'], ['spiral', 'tide', 'nova', 'fan'], ['expo', 'vortex', 'charge', 'phase', 'crown']],
    phaseBanners: ['原点之神 · 第二形态！', '原点之神 · 最终形态！'], reviveN: 2 },
};

function spawnBoss() {
  const key = play.endless
    ? LEVELS[(play.round - 1) % LEVELS.length].boss
    : LEVELS[curLv - 1].boss;
  const def = BOSS_DEF[key];
  const hpS = play.endless ? 1 + (play.round - 1) * 0.25 : 1;
  boss = {
    key, def, hp: Math.round(def.hp * hpS), maxHp: Math.round(def.hp * hpS), r: def.r,
    pats: def.pats.slice(),   // 技能池副本：三形态换池不污染全局定义
    x: clampN(player.x + 420, 120, ARENA_W - 120),
    y: clampN(player.y - 300, 120, ARENA_H - 120),
    state: 'chase', patCd: 2.2, pat: null, patT: 0, step: 0, data: {},
    hitT: 0, enrage: false, spawnT: 0.8, face: 1, vx: 0, vy: 0, ghostT: 0, revived: false,
  };
}
function hurtBoss(n, crit) {
  if (!boss || boss.hp <= 0 || boss.spawnT > 0) return;
  /* 虚数态：免疫一切伤害 */
  if (boss.ghostT > 0) {
    if (frameNo % 9 === 0) popText(boss.x + rnd(-10, 10), boss.y - boss.r - 12, '虚化免疫', [225, 185, 255], 15);
    return;
  }
  boss.hp -= n;
  boss.hitT = 0.13;
  popText(boss.x + rnd(-14, 14), boss.y - boss.r - 14, crit ? '-2' : '-1', crit ? [255, 214, 0] : [255, 255, 255], crit ? 24 : 17);
  if (crit) sfx.crit();
  if (!boss.enrage && boss.hp > 0 && boss.hp / boss.maxHp < 0.35) {
    boss.enrage = true;
    banner('BOSS 狂暴！');
    addFlash(0.3, [255, 60, 60]); addShake(10);
    sfx.roar();
  }
  if (boss.hp <= 0) {
    /* ∞ 重生（通用化）：def.reviveN 次数，旧 revive:true 视为 1 次；每次复活血量递减 */
    const rn = boss.def.reviveN || (boss.def.revive ? 1 : 0);
    if (rn > 0 && (boss.revives || 0) < rn) {
      boss.revives = (boss.revives || 0) + 1;
      boss.revived = true;
      boss.hp = Math.floor(boss.maxHp * (boss.revives === 1 ? 0.55 : 0.32));
      boss.enrage = false;
      boss.state = 'chase'; boss.patCd = 1.2; boss.pat = null;
      /* 三形态：换技能池（副本），阶段横幅可自定义 */
      if (boss.def.phasePats && boss.def.phasePats[boss.revives]) boss.pats = boss.def.phasePats[boss.revives].slice();
      banner((boss.def.phaseBanners && boss.def.phaseBanners[boss.revives - 1]) || ('∞ 重生 ×' + boss.revives + '！'));
      addFlash(0.35, [255, 220, 120]); addShake(10);
      ringFx(boss.x, boss.y, 16, 260, 0.7, boss.def.col, 5);
      burst(boss.x, boss.y, boss.def.col, 24, 240);
      sfx.roar();
      return;
    }
    killBoss();
  }
}
function killBoss() {
  const bx = boss.x, by = boss.y, bcol = boss.def.col;
  boss.hp = 0;
  slowmoT = 1.3;
  addShake(18); addFlash(0.5, [255, 255, 255]);
  burst(bx, by, bcol, 40, 300);
  burst(bx, by, [255, 255, 255], 20, 200);
  dustBurst(bx, by, 30);
  ringFx(bx, by, 20, 340, 0.8, bcol, 5);
  for (let k = 0; k < 26; k++) dusts.push({ x: bx + rnd(-60, 60), y: by + rnd(-60, 60), vx: rnd(-140, 140), vy: rnd(-180, 40), attract: false });
  sfx.boom(); sfx.win();
  /* 无尽模式：不掉通关，而是推进轮次、回血、换场景 */
  if (play.endless) {
    boss = null;
    play.round++;
    play.roundT = 0;
    play.interT = 2.5;
    player.hearts = Math.min(player.maxHearts, player.hearts + 1);
    popText(player.x, player.y - 60, '+1♥', [255, 90, 110], 22);
    banner('第 ' + play.round + ' 轮 · 场景变换，难度提升！');
    buildBg(((play.round - 1) % LEVELS.length) + 1);
    return;
  }
  play.clearT = 2.1;
}

/* BOSS 减速新星区域（借用 puddles，带 life 自动消散） */
function addZone(x, y, r, life) { puddles.push({ x, y, r, life }); }

/* ---------- BOSS 更新 ---------- */
function updateBoss(dt) {
  if (!boss || boss.hp <= 0) return;
  boss.hitT = Math.max(0, boss.hitT - dt);
  boss.ghostT = Math.max(0, boss.ghostT - dt);
  if (boss.spawnT > 0) { boss.spawnT -= dt; return; }
  const D = boss.def;
  const spd = D.spd * (boss.enrage ? 1.3 : 1);
  const pdx = player.x - boss.x, pdy = player.y - boss.y, pd = Math.hypot(pdx, pdy) || 1;
  if (Math.abs(pdx) > 20) boss.face = pdx > 0 ? 1 : -1;

  switch (boss.state) {
    case 'chase': {
      boss.x += pdx / pd * spd * dt;
      boss.y += pdy / pd * spd * dt;
      boss.patCd -= dt;
      if (boss.patCd <= 0) {
        const pats = (boss.pats || D.pats).filter(p => p !== boss.pat);
        startPattern(pick(pats));
      }
      break;
    }
    case 'tele': {
      boss.patT -= dt;
      if (boss.patT <= 0) { boss.state = 'act'; boss.patT = boss.data.actT; boss.step = 0; boss.stepT = 0; }
      break;
    }
    case 'act': {
      boss.patT -= dt;
      boss.stepT -= dt;
      runPattern(dt);
      if (boss.patT <= 0) {
        boss.state = 'chase';
        boss.patCd = (boss.enrage ? 1.5 : 2.5) + rnd(0, 0.9);
        boss.pat = null;
      }
      break;
    }
  }
  boss.x = clampN(boss.x, 80, ARENA_W - 80);
  boss.y = clampN(boss.y, 80, ARENA_H - 80);

  /* 碰玩家 */
  if (player.deadT < 0 && dist2(boss.x, boss.y, player.x, player.y) < (boss.r + player.r - 4) * (boss.r + player.r - 4)) {
    hurtPlayer(1, boss.x, boss.y);
  }
}

function startPattern(pat) {
  boss.pat = pat;
  boss.state = 'tele';
  boss.data = {};
  const tele = { cross: 0.9, ring: 0.7, summon: 0.6, fan: 0.7, nova: 0.8, blink: 0.45, expo: 0.7, charge: 0.8, guard: 0.6, crown: 0.95, phase: 0.8, spiral: 0.7, vortex: 0.7, tide: 0.6 };
  boss.patT = tele[pat] * (boss.enrage ? 0.75 : 1);
  const pdx = player.x - boss.x, pdy = player.y - boss.y;
  switch (pat) {
    case 'cross':
      boss.data.actT = 0.62;
      boss.data.axis = Math.abs(pdx) > Math.abs(pdy) ? 'x' : 'y';
      boss.data.dir = (boss.data.axis === 'x' ? (pdx > 0 ? 1 : -1) : (pdy > 0 ? 1 : -1));
      break;
    case 'ring': boss.data.actT = 1.0; break;
    case 'summon': boss.data.actT = 0.4; break;
    case 'fan': boss.data.actT = 0.9; break;
    case 'nova': boss.data.actT = 0.5; break;
    case 'blink': boss.data.actT = 0.3; break;
    case 'expo': boss.data.actT = 2.2; break;
    case 'charge': boss.data.actT = 2.2; boss.data.phase = 'dash'; boss.data.stepT = 0; break;
    case 'guard': boss.data.actT = 0.4; break;
    case 'crown': boss.data.actT = 0.55; boss.data.spots = []; break;
    case 'phase': boss.data.actT = 2.3; boss.data.burst = false; break;
    case 'spiral': boss.data.actT = 2.4; boss.data.ga = rnd(0, TWO_PI); break;
    case 'vortex': boss.data.actT = 1.5; boss.data.stepT = 0.35; break;
    case 'tide': boss.data.actT = 2.0; break;
  }
}

function bossShot(a, spd, char, col, r) {
  projs.push({ type: 'bshot', x: boss.x, y: boss.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 4.5, char, col, r: r || 9 });
}

function runPattern(dt) {
  const en = boss.enrage ? 1.25 : 1;
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  switch (boss.pat) {
    case 'cross': {
      const sp = 780 * en;
      if (boss.data.axis === 'x') boss.x += boss.data.dir * sp * dt;
      else boss.y += boss.data.dir * sp * dt;
      if (frameNo % 3 === 0) burst(boss.x, boss.y, boss.def.col, 2, 60);
      break;
    }
    case 'ring': {
      const base = boss.step === 0 ? 0 : PI / 12;
      if (boss.stepT <= 0 && boss.step < 2) {
        const n = boss.enrage ? 16 : 12;
        for (let i = 0; i < n; i++) bossShot((i / n) * TWO_PI + base, 230 * en, '+', [110, 255, 140], 9);
        boss.step++; boss.stepT = 0.5;
        sfx.shoot();
      }
      break;
    }
    case 'summon': {
      if (boss.step === 0) {
        boss.step++;
        const hp = boss.key === 'plusKing' ? 2 : 3;
        for (let i = 0; i < (boss.enrage ? 6 : 4); i++) {
          const a = (i / 4) * TWO_PI;
          spawnEnemy('num', hp, clampN(boss.x + Math.cos(a) * 90, 40, ARENA_W - 40), clampN(boss.y + Math.sin(a) * 90, 40, ARENA_H - 40));
        }
        ringFx(boss.x, boss.y, 20, 110, 0.4, boss.def.col, 3);
      }
      break;
    }
    case 'fan': {
      if (boss.stepT <= 0 && boss.step < 2) {
        for (let i = -2; i <= 2; i++) {
          const a = aim + i * 0.24;
          projs.push({ type: 'blade', x: boss.x, y: boss.y, vx: Math.cos(a) * 330 * en, vy: Math.sin(a) * 330 * en, life: 3.4 });
        }
        boss.step++; boss.stepT = 0.45;
        sfx.shoot();
      }
      break;
    }
    case 'nova': {
      if (boss.step === 0) {
        boss.step++;
        for (let i = 0; i < 3; i++) addZone(clampN(player.x + rnd(-220, 220), 60, ARENA_W - 60), clampN(player.y + rnd(-220, 220), 60, ARENA_H - 60), 110, 6);
        ringFx(player.x, player.y, 20, 300, 0.5, [100, 210, 255], 3);
        sfx.freezeFx();
      }
      break;
    }
    case 'blink': {
      if (boss.step === 0) {
        boss.step++;
        burst(boss.x, boss.y, boss.def.col, 14, 200);
        const a = rnd(0, TWO_PI);
        boss.x = clampN(player.x + Math.cos(a) * 300, 80, ARENA_W - 80);
        boss.y = clampN(player.y + Math.sin(a) * 300, 80, ARENA_H - 80);
        burst(boss.x, boss.y, boss.def.col, 14, 200);
        sfx.roar();
      }
      break;
    }
    case 'expo': {
      if (boss.stepT <= 0 && boss.step < 4) {
        const n = [2, 4, 8, 16][boss.step];
        for (let i = 0; i < n; i++) bossShot((i / n) * TWO_PI + boss.step * 0.3, 190 + boss.step * 35, '²', [255, 80, 120], 8);
        boss.step++; boss.stepT = 0.42 / en;
        sfx.shoot();
      }
      break;
    }
    case 'charge': {
      boss.data.stepT -= dt;
      if (boss.data.phase === 'dash') {
        if (!boss.data.dx) {
          const a = aim;
          boss.data.dx = Math.cos(a); boss.data.dy = Math.sin(a);
        }
        boss.x += boss.data.dx * 700 * en * dt;
        boss.y += boss.data.dy * 700 * en * dt;
        if (frameNo % 3 === 0) burst(boss.x, boss.y, boss.def.col, 3, 80);
        if (boss.data.stepT <= 0) { boss.data.phase = 'gap'; boss.data.stepT = 0.28; boss.data.dx = 0; }
      } else {
        if (boss.data.stepT <= 0) {
          boss.data.phase = 'dash'; boss.data.stepT = 0.36;
          boss.data.step = (boss.data.step || 0) + 1;
          if (boss.data.step > 2) boss.data.step = 3;
        }
      }
      break;
    }
    case 'guard': {
      if (boss.step === 0) {
        boss.step++;
        for (const dx of [-70, 70]) spawnEnemy('num', 4, clampN(boss.x + dx, 40, ARENA_W - 40), boss.y);
        ringFx(boss.x, boss.y, 20, 100, 0.4, boss.def.col, 3);
      }
      break;
    }
    case 'crown': {
      /* tele 期间已在 startPattern 后记录落点：act 开时炸 */
      if (boss.step === 0) {
        boss.step++;
        for (const s of boss.data.spots) {
          ringFx(s.x, s.y, 10, 95, 0.4, [255, 80, 120], 4);
          burst(s.x, s.y, [255, 80, 120], 10, 220);
          if (player.deadT < 0 && dist2(s.x, s.y, player.x, player.y) < 95 * 95) hurtPlayer(1, s.x, s.y);
          for (const e of enemies) {
            if (e.hp > 0 && dist2(s.x, s.y, e.x, e.y) < 95 * 95) hurtEnemy(e, 4, rnd(0, TWO_PI), 150, 0, false);
          }
        }
        addShake(9); sfx.boom();
      }
      break;
    }
    case 'phase': {
      /* 虚数态：免疫 + 漂向玩家，结束时爆发 'i' 弹环 */
      if (boss.step === 0) { boss.step++; boss.ghostT = boss.patT + 0.05; sfx.freezeFx(); }
      const gdx = player.x - boss.x, gdy = player.y - boss.y, gd = Math.hypot(gdx, gdy) || 1;
      boss.x += gdx / gd * 250 * en * dt;
      boss.y += gdy / gd * 250 * en * dt;
      if (frameNo % 4 === 0) burst(boss.x, boss.y, boss.def.col, 2, 40);
      if (boss.patT <= 0.3 && !boss.data.burst) {
        boss.data.burst = true;
        const nn = boss.enrage ? 16 : 12;
        for (let i = 0; i < nn; i++) bossShot((i / nn) * TWO_PI, 260 * en, 'i', [225, 185, 255], 8);
        sfx.shoot();
      }
      break;
    }
    case 'spiral': {
      /* 黄金螺旋弹幕：每次旋转黄金角 2.4 弧度 */
      if (boss.stepT <= 0 && boss.step < 20) {
        boss.data.ga += 2.39996;
        for (const off of [0, PI]) {
          const a = boss.data.ga + off;
          bossShot(a, 200 + (boss.step % 6) * 20, 'φ', boss.def.col, 7);
        }
        boss.step++; boss.stepT = 0.13;
        if (boss.step % 4 === 0) sfx.shoot();
      }
      break;
    }
    case 'vortex': {
      /* 引力漩涡：把火柴人往身边拉 + 慢速狙击弹 */
      boss.data.stepT -= dt;
      if (player.deadT < 0) {
        const ddx = player.x - boss.x, ddy = player.y - boss.y, dd = Math.hypot(ddx, ddy) || 1;
        if (dd > 90) { player.x -= ddx / dd * 160 * en * dt; player.y -= ddy / dd * 160 * en * dt; }
      }
      if (frameNo % 5 === 0) ringFx(boss.x, boss.y, 170, 50, 0.5, boss.def.col, 2);
      if (boss.data.stepT <= 0) {
        boss.data.stepT = 0.35;
        const a = Math.atan2(player.y - boss.y, player.x - boss.x);
        bossShot(a, 180, '0', boss.def.col, 8);
      }
      break;
    }
    case 'tide': {
      /* 弹幕潮：横向游走 + 三连扇形齐射 */
      if (boss.stepT <= 0 && boss.step < 5) {
        const a0 = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (let i = -1; i <= 1; i++) bossShot(a0 + i * 0.22, 310 * en, 'φ', boss.def.col, 7);
        boss.step++; boss.stepT = 0.42;
        sfx.shoot();
      }
      boss.x += Math.cos(frameNo * 0.05) * 90 * dt;
      break;
    }
  }
}

/* crown 的落点在 tele 阶段采样 */
function updateBossTele(dt) {
  if (boss && boss.state === 'tele' && boss.pat === 'crown') {
    boss.data.spotT = (boss.data.spotT || 0) - dt;
    if (boss.data.spotT <= 0 && boss.data.spots.length < 3) {
      boss.data.spots.push({ x: player.x, y: player.y });
      boss.data.spotT = 0.28;
    }
  }
}

/* ---------- BOSS 绘制 ---------- */
function drawBoss() {
  if (!boss) return;
  const D = boss.def;
  const flash = boss.hitT > 0;
  const bsc = boss.spawnT > 0 ? 1 - boss.spawnT / 0.8 : 1;
  const wob = Math.sin(frameNo * 0.08) * 3;
  const col = flash ? [255, 255, 255] : (boss.enrage ? [255, 90, 80] : D.col);
  const shk = boss.enrage ? rnd(-1.5, 1.5) : 0;
  const ghost = boss.ghostT > 0;
  if (ghost) drawingContext.globalAlpha = 0.45;

  push();
  translate(boss.x + shk, boss.y + wob);
  scale(bsc);
  textAlign(CENTER, CENTER); textStyle(BOLD);

  /* 影子 */
  noStroke(); fill(0, 0, 0, 100);
  ellipse(0, boss.r * 0.85, boss.r * 2.1, boss.r * 0.5);

  glowOn(col, boss.enrage ? 26 : 18);
  stroke(col[0], col[1], col[2]); fill(col[0], col[1], col[2]);
  const step = Math.sin(frameNo * 0.2) * 6;

  if (boss.key === 'plusKing') {
    strokeWeight(14); strokeCap(ROUND);
    line(-boss.r * 0.62, 0, boss.r * 0.62, 0);
    line(0, -boss.r * 0.62, 0, boss.r * 0.62);
    /* 脚 */
    strokeWeight(5); line(-16, boss.r * 0.62, -20 + step, boss.r * 0.62 + 12); line(16, boss.r * 0.62, 20 - step, boss.r * 0.62 + 12);
    glowOff();
    drawEyes(-boss.r * 0.28, -boss.r * 0.3, 5, clampN((player.x - boss.x) / 80, -3, 3), true);
  } else if (boss.key === 'minusWitch') {
    strokeWeight(13); strokeCap(ROUND);
    line(-boss.r * 0.6, 0, boss.r * 0.6, 0);
    strokeWeight(5);
    line(-16, boss.r * 0.5, -20 - step, boss.r * 0.5 + 12); line(16, boss.r * 0.5, 20 + step, boss.r * 0.5 + 12);
    glowOff();
    drawEyes(0, -boss.r * 0.34, 4.6, clampN((player.x - boss.x) / 80, -3, 3), true);
    /* 女巫帽 */
    noStroke(); fill(col[0], col[1], col[2]);
    triangle(-26, -boss.r * 0.5, 26, -boss.r * 0.5, 0, -boss.r * 1.15);
    rect(-30, -boss.r * 0.56, 60, 8, 3);
  } else if (boss.key === 'sqrtDemon') {
    /* 根号魔王：巨大的 √，眼睛藏在勾里 */
    noStroke();
    textSize(boss.r * 2.4);
    text('√', -boss.r * 0.2, 0);
    stroke(col[0], col[1], col[2]);
    strokeWeight(5); strokeCap(ROUND);
    line(-14, boss.r * 0.9, -18 - step, boss.r * 0.9 + 12); line(14, boss.r * 0.9, 18 + step, boss.r * 0.9 + 12);
    glowOff();
    drawEyes(boss.r * 0.45, -boss.r * 0.18, 5, clampN((player.x - boss.x) / 80, -3, 3), true);
    if (ghost) {
      noStroke(); fill(255, 255, 255, 180); textSize(17);
      text('虚数态 i', 0, -boss.r - 26);
    }
  } else if (boss.key === 'phiKing') {
    /* 黄金之王：巨大的 φ + 金冠 */
    noStroke();
    textSize(boss.r * 2.6);
    text('φ', 0, 0);
    stroke(col[0], col[1], col[2]);
    strokeWeight(5); strokeCap(ROUND);
    line(-14, boss.r * 0.9, -18 - step, boss.r * 0.9 + 12); line(14, boss.r * 0.9, 18 + step, boss.r * 0.9 + 12);
    glowOff();
    drawEyes(0, -boss.r * 0.35, 5, clampN((player.x - boss.x) / 80, -3, 3), true);
    noStroke(); fill(255, 214, 0);
    triangle(-22, -boss.r * 1.02, -16, -boss.r * 1.30, -9, -boss.r * 1.04);
    triangle(-8, -boss.r * 1.10, 0, -boss.r * 1.42, 8, -boss.r * 1.10);
    triangle(9, -boss.r * 1.04, 16, -boss.r * 1.30, 22, -boss.r * 1.02);
    if (boss.revived) {
      fill(255, 120, 120); textSize(14);
      text('已重生', 0, boss.r + 34);
    }
  } else if (boss.key === 'powerQueen') {
    /* 乘方女王：巨大的 2 */
    noStroke();
    textSize(boss.r * 2.3);
    text('2', 0, 0);
    /* 指数 n */
    textSize(boss.r * 0.8);
    text('ⁿ', boss.r * 0.85, -boss.r * 0.75);
    /* 披风 */
    noFill(); stroke(col[0], col[1], col[2], 140); strokeWeight(6);
    arc(0, 0, boss.r * 2.6, boss.r * 2.6, PI * 0.15, PI * 0.85);
    strokeWeight(5);
    line(-14, boss.r * 0.9, -18 - step, boss.r * 0.9 + 12); line(14, boss.r * 0.9, 18 + step, boss.r * 0.9 + 12);
    glowOff();
    drawEyes(-boss.r * 0.05, -boss.r * 0.32, 5, clampN((player.x - boss.x) / 80, -3, 3), true);
    /* 皇冠 */
    noStroke(); fill(255, 214, 0);
    triangle(-20, -boss.r * 1.02, -14, -boss.r * 1.28, -8, -boss.r * 1.04);
    triangle(-7, -boss.r * 1.08, 0, -boss.r * 1.38, 7, -boss.r * 1.08);
    triangle(8, -boss.r * 1.04, 14, -boss.r * 1.28, 20, -boss.r * 1.02);
  } else {
    /* 通用BOSS渲染：def.char 大字符 + 金冠 + 怒目 + 小短腿（新关卡零代码适配） */
    noStroke();
    textSize(boss.r * 2.2);
    text(boss.def.char || '?', 0, 0);
    stroke(col[0], col[1], col[2]);
    strokeWeight(5); strokeCap(ROUND);
    line(-14, boss.r * 0.85, -18 - step, boss.r * 0.85 + 12); line(14, boss.r * 0.85, 18 + step, boss.r * 0.85 + 12);
    glowOff();
    drawEyes(0, -boss.r * 0.3, 5, clampN((player.x - boss.x) / 80, -3, 3), true);
    noStroke(); fill(255, 214, 0);
    triangle(-20, -boss.r * 1.0, -14, -boss.r * 1.26, -8, -boss.r * 1.02);
    triangle(-7, -boss.r * 1.08, 0, -boss.r * 1.38, 7, -boss.r * 1.08);
    triangle(8, -boss.r * 1.02, 14, -boss.r * 1.26, 20, -boss.r * 1.0);
    if (boss.revived) {
      fill(255, 120, 120); textSize(14);
      text(boss.revives > 1 ? '已重生 ×' + boss.revives : '已重生', 0, boss.r + 34);
    }
  }
  glowOff();
  drawingContext.globalAlpha = 1;
  pop();

  /* tele 预警 */
  if (boss.state === 'tele') drawBossTele();
}
function drawBossTele() {
  push();
  const k = 1 - boss.patT / 1.0;
  switch (boss.pat) {
    case 'cross': {
      const a = 120 + Math.sin(frameNo * 0.4) * 80;
      stroke(255, 90, 90, a); strokeWeight(5);
      line(cam.x, boss.y, cam.x + VW, boss.y);
      line(boss.x, cam.y, boss.x, cam.y + VH);
      break;
    }
    case 'charge': {
      const a = Math.atan2(player.y - boss.y, player.x - boss.x);
      stroke(255, 90, 90, 130 + Math.sin(frameNo * 0.5) * 60); strokeWeight(4);
      drawingContext.setLineDash([14, 10]);
      line(boss.x, boss.y, boss.x + Math.cos(a) * 900, boss.y + Math.sin(a) * 900);
      drawingContext.setLineDash([]);
      break;
    }
    case 'crown': {
      noFill(); stroke(255, 80, 120, 200); strokeWeight(3);
      drawingContext.setLineDash([10, 8]);
      for (const s of boss.data.spots) circle(s.x, s.y, 190);
      drawingContext.setLineDash([]);
      break;
    }
    case 'phase': {
      noFill(); stroke(255, 255, 255, 150 + Math.sin(frameNo * 0.5) * 60); strokeWeight(3);
      circle(boss.x, boss.y, boss.r * 3);
      noStroke(); fill(225, 185, 255, 210); textSize(19);
      text('虚化', boss.x, boss.y - boss.r - 24);
      break;
    }
    case 'ring': case 'fan': case 'expo': case 'spiral': case 'vortex': case 'tide': {
      noFill(); stroke(boss.def.col[0], boss.def.col[1], boss.def.col[2], 150); strokeWeight(3);
      circle(boss.x, boss.y, boss.r * 2.6 + Math.sin(frameNo * 0.5) * 6);
      break;
    }
  }
  pop();
}
