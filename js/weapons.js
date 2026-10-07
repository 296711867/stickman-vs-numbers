/* ============================================================
 * 武器系统 —— 6 把全自动武器 + 投射物 + 伤害结算
 * 核心规则：单次命中固定 -1（暴击 -2），成长全靠数量/频率/范围
 * ============================================================ */
'use strict';

/* ---------- 武器定义（升级描述给三选一卡片用） ---------- */
const WDEF = {
  pencil: {
    name: '铅笔环绕', col: [255, 214, 0],
    tip: '铅笔绕体旋转，接触即 -1',
    desc: ['再召唤 1 支铅笔（2→3 支）', '半径+转速提升（3→4 支）', '再召唤 1 支（4→5 支）', '6 支铅笔·旋风形态'],
    evo: { pass: 'atk', name: '铅笔风暴', desc: '满级铅笔+攻速被动 → 8 支双圈旋风，转速暴增' },
  },
  ruler: {
    name: '直尺旋斩', col: [255, 245, 220],
    tip: '周期性 360° 大范围横扫',
    desc: ['冷却缩短，半径+15%', '冷却缩短，半径+15%', '冷却缩短，击退增强', '双连扫！一圈两道尺光'],
    evo: { pass: 'area', name: '圆规巨斩', desc: '满级直尺+范围被动 → 半径巨幅扩大，冷却减半' },
  },
  sym: {
    name: '符号卫星', col: [200, 120, 255],
    tip: '加减乘除符号绕体飞行，各带特效',
    desc: ['多 1 颗符号卫星（2→3）', '多 1 颗（3→4），轨道扩大', '多 1 颗（4→5）', '6 星连珠·特效强化'],
    evo: { pass: 'crit', name: '公式矩阵', desc: '满级符号+会心被动 → 8 星高速，命中溅射周围' },
  },
  chalk: {
    name: '粉笔射手', col: [255, 255, 255],
    tip: '自动锁定最近的敌人投掷粉笔头',
    desc: ['每次多投 1 支（1→2）', '每次多投 1 支（2→3）', '粉笔头可穿透（3→4）', '5 连发·极速投掷'],
    evo: { pass: 'speed', name: '神速投手', desc: '满级粉笔+移速被动 → 8 连发·无限穿透' },
  },
  boomer: {
    name: '橡皮回旋镖', col: [255, 150, 200],
    tip: '飞出去再飞回来，双程都算 -1',
    desc: ['多 1 枚回旋镖（1→2）', '射程+30%（2→2 枚）', '多 1 枚（2→3）', '4 连发·超远距回旋'],
    evo: { pass: 'luck', name: '黄金回旋镖', desc: '满级回旋镖+幸运被动 → 4 枚巨镖·超远·命中减速' },
  },
  bomb: {
    name: '黑板擦炸弹', col: [255, 120, 80],
    tip: '定时砸向怪最密集处，范围 -8',
    desc: ['爆炸范围+20%', '一次砸 2 块黑板擦', '冷却缩短，范围扩大', '3 连砸·超大范围'],
    evo: { pass: 'heart', name: '末日黑板擦', desc: '满级炸弹+心容器被动 → 3 连大轰，爆炸中心追加伤害' },
  },
};

/* ---------- 伤害工具 ---------- */
function rollDmg() {
  if (player.crit > 0 && Math.random() < player.crit) return { n: 2, crit: true };
  return { n: 1, crit: false };
}
/* 对 (x,y,r) 范围内的敌人+BOSS 各结算一次 */
function aoeHit(x, y, r, opts) {
  opts = opts || {};
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (dist2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) {
      let n = opts.n !== undefined ? opts.n : rollDmg().n;
      if (opts.eliteN !== undefined && (e.kind === 'elite' || e.hp >= 8)) n = opts.eliteN;
      const ang = Math.atan2(e.y - y, e.x - x);
      hurtEnemy(e, n, ang, opts.kb || 0, opts.slow || 0, opts.crit);
    }
  }
  if (boss && boss.hp > 0) {
    let n = opts.bossN !== undefined ? opts.bossN : rollDmg().n;
    if (dist2(x, y, boss.x, boss.y) < (r + boss.r) * (r + boss.r)) hurtBoss(n, opts.crit);
  }
}
/* 最近的 n 个目标坐标（含 BOSS） */
function nearestTargets(n) {
  const list = [];
  for (const e of enemies) if (e.hp > 0) list.push({ x: e.x, y: e.y, d: dist2(e.x, e.y, player.x, player.y) });
  if (boss && boss.hp > 0) list.push({ x: boss.x, y: boss.y, d: dist2(boss.x, boss.y, player.x, player.y) });
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, n);
}

/* ---------- 武器主循环 ---------- */
function updateWeapons(dt) {
  for (const w of player.weapons) {
    w.cd -= dt * player.atkMul;
    w.ang = (w.ang || 0) + dt * (2.4 + (w.id === 'pencil' ? w.lv * 0.18 : 0) + (w.id === 'pencil' && w.evolved ? 1.5 : 0));
    if (w.sweepT > 0) w.sweepT -= dt;
    switch (w.id) {
      case 'pencil': updPencil(w); break;
      case 'ruler':
        if (w.pend !== undefined) { w.pend -= dt; if (w.pend <= 0) { rulerSweep(w, true); w.pend = undefined; } }
        if (w.cd <= 0) { rulerSweep(w, false); w.cd += (3.1 - w.lv * 0.27) * (w.evolved ? 0.45 : 1); if (w.lv >= 5) w.pend = 0.24; }
        break;
      case 'sym': updSym(w); break;
      case 'chalk':
        if (w.cd <= 0) { fireChalk(w); w.cd += w.evolved ? 0.5 : (1.2 - w.lv * 0.09); }
        break;
      case 'boomer':
        if (w.cd <= 0) { fireBoomer(w); w.cd += (2.7 - w.lv * 0.22) * (w.evolved ? 0.75 : 1); }
        break;
      case 'bomb':
        if (w.cd <= 0) { fireBomb(w); w.cd += w.evolved ? 1.7 : (4.4 - w.lv * 0.45); }
        break;
    }
  }
}

/* 铅笔环绕：接触判定 + 每怪 0.4s 一跳（进化：8 支大圈） */
function updPencil(w) {
  const cnt = w.evolved ? 8 : (1 + w.lv), R = (w.evolved ? 88 : 64 + w.lv * 7) * player.areaMul;
  for (let i = 0; i < cnt; i++) {
    const a = w.ang + (i * TWO_PI) / cnt;
    const px = player.x + Math.cos(a) * R, py = player.y + Math.sin(a) * R;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (dist2(px, py, e.x, e.y) < (e.r + 11) * (e.r + 11) && play.t - (e.reP || -9) > 0.4) {
        e.reP = play.t;
        const d = rollDmg();
        hurtEnemy(e, d.n, a, 60, 0, d.crit);
      }
    }
    if (boss && boss.hp > 0 && dist2(px, py, boss.x, boss.y) < (boss.r + 11) * (boss.r + 11) && play.t - (boss.reP || -9) > 0.4) {
      boss.reP = play.t; const d = rollDmg(); hurtBoss(d.n, d.crit);
    }
  }
}
function drawPencil(w) {
  const cnt = w.evolved ? 8 : (1 + w.lv), R = (w.evolved ? 88 : 64 + w.lv * 7) * player.areaMul;
  push();
  for (let i = 0; i < cnt; i++) {
    const a = w.ang + (i * TWO_PI) / cnt;
    const px = player.x + Math.cos(a) * R, py = player.y + Math.sin(a) * R;
    push(); translate(px, py); rotate(a + PI / 2);
    glowOn(WDEF.pencil.col, 8);
    stroke(255, 214, 0); strokeWeight(3.6); strokeCap(ROUND);
    line(-11, 0, 7, 0);
    noStroke(); fill(255, 240, 180);
    triangle(7, -3.4, 7, 3.4, 13, 0);
    glowOff();
    pop();
  }
  pop();
}

/* 直尺旋斩：施放瞬间结算一圈（进化：巨半径+强击退） */
function rulerSweep(w, second) {
  const R = (w.evolved ? 150 + w.lv * 20 : 100 + w.lv * 14) * player.areaMul;
  const d = rollDmg();
  aoeHit(player.x, player.y, R, { n: d.n, crit: d.crit, kb: w.lv >= 4 ? (w.evolved ? 480 : 340) : 240 });
  w.sweepT = 0.38; w.sweepA = rnd(0, TWO_PI);
  ringFx(player.x, player.y, R * 0.4, R, 0.32, [255, 245, 220], 3);
  addShake(2); sfx.hit();
}
function drawRuler(w) {
  if (w.sweepT <= 0) return;
  const k = 1 - w.sweepT / 0.38;
  const R = (w.evolved ? 150 + w.lv * 20 : 100 + w.lv * 14) * player.areaMul;
  push(); translate(player.x, player.y); noFill();
  stroke(255, 245, 220, 220 * (1 - k)); strokeWeight(11); strokeCap(ROUND);
  glowOn([255, 245, 220], 10);
  arc(0, 0, R * 2, R * 2, w.sweepA + k * PI * 2 * 1.5 - 0.7, w.sweepA + k * PI * 2 * 1.5 + 0.7);
  glowOff();
  stroke(255, 245, 220, 90); strokeWeight(1.5); noFill();
  circle(0, 0, R * 2);
  pop();
}

/* 符号卫星 */
const SYM_CHARS = ['+', '−', '×', '÷'];
const SYM_COLS = [[110, 255, 140], [100, 210, 255], [255, 170, 70], [210, 130, 255]];
function updSym(w) {
  const cnt = w.evolved ? 8 : Math.min(6, 1 + w.lv), R = (80 + w.lv * 6) * player.areaMul;
  for (let i = 0; i < cnt; i++) {
    const a = w.ang * 1.2 + (i * TWO_PI) / cnt;
    const px = player.x + Math.cos(a) * R, py = player.y + Math.sin(a) * R;
    const ch = SYM_CHARS[i % 4];
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const reh = w.evolved ? 0.3 : (ch === '÷' ? 0.28 : 0.55);
      if (dist2(px, py, e.x, e.y) < (e.r + 10) * (e.r + 10) && play.t - (e.reS || -9) > reh) {
        e.reS = play.t;
        const d = rollDmg();
        const opt = { slow: ch === '−' ? 1.6 : 0 };
        hurtEnemy(e, d.n, a, ch === '+' ? 300 : (ch === '×' ? 200 : 80), opt.slow, d.crit);
        if (ch === '×') ringFx(e.x, e.y, 6, 34, 0.25, SYM_COLS[2], 2);
        /* 进化·公式矩阵：命中溅射周围最多 3 只 */
        if (w.evolved) {
          let sp = 0;
          for (const o of enemies) {
            if (o !== e && o.hp > 0 && sp < 3 && dist2(o.x, o.y, e.x, e.y) < 46 * 46) {
              hurtEnemy(o, 1, a, 70, 0, false);
              sp++;
            }
          }
        }
      }
    }
    if (boss && boss.hp > 0 && dist2(px, py, boss.x, boss.y) < (boss.r + 10) * (boss.r + 10) && play.t - (boss.reS || -9) > 0.55) {
      boss.reS = play.t; const d = rollDmg(); hurtBoss(d.n, d.crit);
    }
  }
}
function drawSym(w) {
  const cnt = w.evolved ? 8 : Math.min(6, 1 + w.lv), R = (80 + w.lv * 6) * player.areaMul;
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  for (let i = 0; i < cnt; i++) {
    const a = w.ang * 1.2 + (i * TWO_PI) / cnt;
    const px = player.x + Math.cos(a) * R, py = player.y + Math.sin(a) * R;
    const ch = SYM_CHARS[i % 4], c = SYM_COLS[i % 4];
    glowOn(c, 9);
    fill(c[0], c[1], c[2]); textSize(22);
    text(ch, px, py);
    glowOff();
  }
  pop();
}

/* 粉笔射手（进化：8 连发无限穿透） */
function fireChalk(w) {
  const n = w.evolved ? 8 : w.lv, targets = nearestTargets(Math.min(n, 5));
  if (!targets.length) { w.cd = Math.min(w.cd + 0.25, 0.25); return; }
  for (let i = 0; i < n; i++) {
    const t = targets[i % targets.length];
    const a = Math.atan2(t.y - player.y, t.x - player.x) + rnd(-0.06, 0.06);
    projs.push({ type: 'chalk', x: player.x, y: player.y - 14, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, life: 1.15, pierce: w.evolved ? 99 : (w.lv >= 4 ? 3 : 1), hit: new Set() });
  }
  sfx.shoot();
}
/* 橡皮回旋镖（进化：4 枚巨镖超远+减速） */
function fireBoomer(w) {
  const cnt = w.evolved ? 4 : (1 + Math.floor(w.lv / 2));
  const ts = nearestTargets(1);
  const baseA = ts.length ? Math.atan2(ts[0].y - player.y, ts[0].x - player.x) : rnd(0, TWO_PI);
  for (let i = 0; i < cnt; i++) {
    const a = baseA + (i - (cnt - 1) / 2) * 0.5;
    projs.push({
      type: 'boomer', x: player.x, y: player.y - 12, ax: player.x, ay: player.y,
      dirx: Math.cos(a), diry: Math.sin(a), phase: 'out', dist: 0,
      maxDist: (250 + w.lv * 35) * player.areaMul * (w.evolved ? 1.8 : 1), spd: w.evolved ? 640 : 560, rot: rnd(0, TWO_PI), hit: new Set(), life: 6, evo: w.evolved,
    });
  }
  sfx.shoot();
}
/* 黑板擦炸弹：落在怪最密处（进化：3 连大轰+中心追加） */
function fireBomb(w) {
  const n = w.evolved ? 3 : (w.lv >= 5 ? 3 : (w.lv >= 3 ? 2 : 1));
  const R = (w.evolved ? 170 : 115 + w.lv * 12) * player.areaMul;
  const pool = enemies.filter(e => e.hp > 0);
  for (let i = 0; i < n; i++) {
    let bx, by;
    if (pool.length) {
      /* 采样 6 只怪，取邻居最多的那只脚下 */
      let best = null, bestN = -1;
      for (let k = 0; k < 6; k++) {
        const e = pick(pool);
        let c = 0;
        for (const o of pool) if (dist2(o.x, o.y, e.x, e.y) < 110 * 110) c++;
        if (c > bestN) { bestN = c; best = e; }
      }
      bx = best.x + rnd(-24, 24); by = best.y + rnd(-24, 24);
    } else {
      bx = player.x + rnd(-160, 160); by = player.y + rnd(-160, 160);
    }
    projs.push({ type: 'boomTele', x: bx, y: by, r: R, t: 0.75, evo: w.evolved });
  }
}

/* ---------- 投射物更新 ---------- */
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    let dead = false;
    switch (p.type) {
      case 'chalk': {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) dead = true;
        for (const e of enemies) {
          if (e.hp <= 0 || p.hit.has(e.id)) continue;
          if (dist2(p.x, p.y, e.x, e.y) < (e.r + 8) * (e.r + 8)) {
            p.hit.add(e.id);
            const d = rollDmg();
            hurtEnemy(e, d.n, Math.atan2(p.vy, p.vx), 90, 0, d.crit);
            if (--p.pierce <= 0) { dead = true; break; }
          }
        }
        if (!dead && boss && boss.hp > 0 && !p.hit.has(-1) && dist2(p.x, p.y, boss.x, boss.y) < (boss.r + 8) * (boss.r + 8)) {
          p.hit.add(-1); const d = rollDmg(); hurtBoss(d.n, d.crit);
          if (--p.pierce <= 0) dead = true;
        }
        break;
      }
      case 'boomer': {
        p.life -= dt; p.rot += dt * 14;
        if (p.phase === 'out') {
          p.dist += p.spd * dt;
          p.x = p.ax + p.dirx * p.dist; p.y = p.ay + p.diry * p.dist;
          if (p.dist >= p.maxDist || p.life <= 0) p.phase = 'back';
        } else {
          const dx = player.x - p.x, dy = (player.y - 12) - p.y, dd = Math.hypot(dx, dy);
          if (dd < 24) { dead = true; break; }
          p.x += dx / dd * p.spd * 1.15 * dt; p.y += dy / dd * p.spd * 1.15 * dt;
        }
        for (const e of enemies) {
          if (e.hp <= 0 || p.hit.has(e.id)) continue;
          if (dist2(p.x, p.y, e.x, e.y) < (e.r + 9) * (e.r + 9)) {
            p.hit.add(e.id);
            const d = rollDmg();
            hurtEnemy(e, d.n, Math.atan2(p.diry, p.dirx), 70, p.evo ? 1.2 : 0, d.crit);
          }
        }
        if (boss && boss.hp > 0 && !p.hit.has(-1) && dist2(p.x, p.y, boss.x, boss.y) < (boss.r + 9) * (boss.r + 9)) {
          p.hit.add(-1); const d = rollDmg(); hurtBoss(d.n, d.crit);
        }
        break;
      }
      case 'blade': {   // 敌方 ÷ 飞刃
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) dead = true;
        if (player.deadT < 0 && dist2(p.x, p.y, player.x, player.y - 12) < (player.r + 9) * (player.r + 9)) {
          hurtPlayer(1, p.x, p.y); dead = true;
        }
        break;
      }
      case 'bshot': {   // BOSS 弹幕（wave=正弦波弹道）
        if (p.wave) {
          p.len += p.spd * dt; p.wt += dt;
          const off = Math.sin(p.wt * p.waveF) * p.waveA;
          p.x = p.sx + p.ux * p.len + p.nx * off;
          p.y = p.sy + p.uy * p.len + p.ny * off;
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        p.life -= dt;
        if (p.life <= 0) dead = true;
        if (player.deadT < 0 && dist2(p.x, p.y, player.x, player.y - 12) < (player.r + p.r) * (player.r + p.r)) {
          hurtPlayer(1, p.x, p.y); dead = true;
        }
        break;
      }
      case 'boomTele': {  // 黑板擦落点预警
        p.t -= dt;
        if (p.t <= 0) {
          aoeHit(p.x, p.y, p.r, { n: 8, eliteN: 5, bossN: 3, kb: 320 });
          /* 进化·末日黑板擦：爆心追加一段伤害 */
          if (p.evo) aoeHit(p.x, p.y, p.r * 0.45, { n: 4, eliteN: 2, bossN: 1, kb: 160 });
          ringFx(p.x, p.y, 12, p.r, 0.4, [255, 130, 80], 4);
          ringFx(p.x, p.y, 6, p.r * 0.6, 0.3, [255, 220, 160], 3);
          burst(p.x, p.y, [255, 150, 90], 16, 260);
          dustBurst(p.x, p.y, 10);
          addShake(7); sfx.boom();
          dead = true;
        }
        break;
      }
    }
    if (dead) projs.splice(i, 1);
  }
}

/* ---------- 投射物绘制 ---------- */
function drawProjs() {
  push(); textAlign(CENTER, CENTER); textStyle(BOLD);
  for (const p of projs) {
    switch (p.type) {
      case 'chalk': {
        const a = Math.atan2(p.vy, p.vx);
        push(); translate(p.x, p.y); rotate(a);
        stroke(255, 250, 220); strokeWeight(4); strokeCap(ROUND);
        glowOn([255, 250, 200], 7);
        line(-9, 0, 6, 0);
        noStroke(); fill(255, 255, 255); circle(7, 0, 5);
        glowOff();
        pop(); break;
      }
      case 'boomer': {
        push(); translate(p.x, p.y); rotate(p.rot);
        stroke(255, 150, 200); strokeWeight(4); noFill(); strokeCap(ROUND);
        glowOn([255, 150, 200], 8);
        arc(0, 0, 22, 22, PI * 0.1, PI * 0.9);
        arc(3, 5, 12, 12, PI * 0.2, PI * 0.8);
        glowOff();
        pop(); break;
      }
      case 'blade': {
        glowOn([210, 130, 255], 9);
        fill(210, 130, 255); textSize(24); text('÷', p.x, p.y);
        glowOff(); break;
      }
      case 'bshot': {
        glowOn(p.col, 10);
        fill(p.col[0], p.col[1], p.col[2]);
        circle(p.x, p.y, p.r * 2);
        fill(10, 12, 16); textSize(p.r * 1.4); text(p.char, p.x, p.y + 0.5);
        glowOff(); break;
      }
      case 'boomTele': {
        const k = 1 - p.t / 0.75;
        noFill();
        stroke(255, 120, 80, 200); strokeWeight(2.5);
        drawingContext.setLineDash([9, 8]);
        circle(p.x, p.y, p.r * 2);
        drawingContext.setLineDash([]);
        stroke(255, 160, 100, 160); strokeWeight(5);
        arc(p.x, p.y, p.r * 2, p.r * 2, -PI / 2, -PI / 2 + TWO_PI * k);
        fill(255, 130, 80, 200); textSize(15); text('擦!', p.x, p.y - 8);
        break;
      }
    }
  }
  glowOff();
  pop();
}

/* ---------- 世界层武器绘制入口 ---------- */
function drawWeaponsWorld() {
  for (const w of player.weapons) {
    switch (w.id) {
      case 'pencil': drawPencil(w); break;
      case 'ruler': drawRuler(w); break;
      case 'sym': drawSym(w); break;
    }
  }
}
