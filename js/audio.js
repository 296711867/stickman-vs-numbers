/* ============================================================
 * 火柴人大战数字 —— WebAudio 实时合成音效（无音频文件）
 * ============================================================ */
'use strict';

let audioCtx = null;
let _audioApi = 'none';   // 音频后端标记：AudioContext / wx.createWebAudioContext / none
let _intWired = false;

function initAudio() {
  if (audioCtx) { _resumeAudio(); return; }
  try {
    if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
      audioCtx = wx.createWebAudioContext();      // 微信小游戏
      _audioApi = 'wx.createWebAudioContext';
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { audioCtx = new AC(); _audioApi = 'AudioContext'; }
    }
  } catch (e) { audioCtx = null; }
  _resumeAudio();
  /* 电话/后台中断自动处理（仅 wx 有此事件） */
  if (typeof wx !== 'undefined' && wx.onAudioInterruptionBegin && !_intWired) {
    _intWired = true;
    wx.onAudioInterruptionBegin(function () { try { if (audioCtx && audioCtx.suspend) audioCtx.suspend(); } catch (e) {} });
    wx.onAudioInterruptionEnd(function () { try { if (audioCtx && audioCtx.resume) audioCtx.resume(); } catch (e) {} });
  }
}
function _resumeAudio() {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); return; }
    if (audioCtx.resume) audioCtx.resume();       // wx ctx 可能无 state，直接尝试恢复
  } catch (e) {}
}
function tone(freq, dur, type, vol, slide) {
  if (!audioCtx || STORE.mute) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur);
  } catch (e) { /* 静默 */ }
}
function noiseSfx(dur, vol) {
  if (!audioCtx || STORE.mute) return;
  try {
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = vol || 0.1;
    s.connect(g); g.connect(audioCtx.destination); s.start();
  } catch (e) { /* 静默 */ }
}
let lastHitSfx = 0;
const sfx = {
  /* 武器命中（限频，避免刷屏爆音） */
  hit() {
    const now = performance.now();
    if (now - lastHitSfx < 55) return;
    lastHitSfx = now;
    tone(rnd(700, 900), 0.05, 'square', 0.028, -300);
  },
  crit() { tone(1200, 0.07, 'square', 0.05, -500); noiseSfx(0.05, 0.06); },
  kill() { noiseSfx(0.09, 0.09); tone(320, 0.09, 'square', 0.04, -180); },
  pick() { tone(880, 0.06, 'sine', 0.045); },
  heal() { tone(520, 0.1, 'sine', 0.06); setTimeout(() => tone(780, 0.14, 'sine', 0.06), 90); },
  magnet() { tone(400, 0.25, 'sine', 0.06, 900); },
  clock() { tone(1000, 0.4, 'sine', 0.05, -700); },
  gift() { tone(523, 0.08, 'triangle', 0.06); setTimeout(() => tone(659, 0.08, 'triangle', 0.06), 80); setTimeout(() => tone(784, 0.12, 'triangle', 0.06), 160); },
  heartS() { tone(660, 0.12, 'sine', 0.06); setTimeout(() => tone(990, 0.16, 'sine', 0.06), 100); },
  lvlup() { tone(440, 0.09, 'square', 0.05); setTimeout(() => tone(554, 0.09, 'square', 0.05), 90); setTimeout(() => tone(659, 0.09, 'square', 0.05), 180); setTimeout(() => tone(880, 0.16, 'square', 0.055), 270); },
  hurt() { tone(180, 0.2, 'sawtooth', 0.09, -90); noiseSfx(0.12, 0.1); },
  shield() { tone(300, 0.15, 'triangle', 0.06, 200); },
  shoot() { tone(760, 0.07, 'sine', 0.03, -350); },
  boom() { noiseSfx(0.45, 0.2); tone(85, 0.4, 'sine', 0.12, -45); },
  freezeFx() { tone(1400, 0.5, 'sine', 0.045, -1100); },
  boss() { tone(90, 0.7, 'sawtooth', 0.1, 60); tone(45, 0.9, 'sine', 0.12); noiseSfx(0.5, 0.12); },
  roar() { tone(70, 0.5, 'sawtooth', 0.1, -30); noiseSfx(0.3, 0.1); },
  wave() { tone(392, 0.1, 'triangle', 0.05); setTimeout(() => tone(523, 0.14, 'triangle', 0.05), 110); },
  sel() { tone(520, 0.06, 'square', 0.04); },
  ok() { tone(440, 0.08, 'square', 0.05); setTimeout(() => tone(660, 0.11, 'square', 0.05), 85); },
  deny() { tone(140, 0.15, 'square', 0.06, -40); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06), i * 130)); },
  lose() { [400, 300, 220, 150].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.06), i * 160)); },
};

/* ============================================================
 * BGM —— WebAudio 合成芯片音乐循环（无音频文件，浏览器/微信通用）
 * 两个 pattern：menu（标题/选关/结算，84BPM 柔和琶音）/ battle（战斗，132BPM 低音+旋律+hat）
 * lookahead 调度：setInterval 90ms 轮询，提前 0.35s 排音符（挂起恢复不追赶不爆音）
 * 首次交互（initAudio）后随场景自动起播；M 键静音即停排，取消静音自动续
 * 调音量 _BGM_V；换旋律直接改 _BGM_PATTERNS（MIDI 编号，0=休止，32 步一循环）
 * ============================================================ */
let bgmOn = false, _bgmPat = '', _bgmStep = 0, _bgmNextT = 0, _bgmTimer = null;
const _BGM_V = 1.0;
const _BGM_BPM = { menu: 84, battle: 132, boss: 142 };
function _nf(n) { return 440 * Math.pow(2, (n - 69) / 12); }
const _BGM_PATTERNS = {
  battle: {
    /* 低音：A2 A2 C3 G2 | A2 A2 F2 G2（每 4 步一音） */
    bass: [45, 0, 0, 0, 45, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
    /* 主旋律（A 小调，五声为主）：E5..C5 D5.C5. A4... C5D5E5. | G5..E5 .C5D5. C5A4.G4. A4.. */
    lead: [76, 0, 0, 72, 74, 0, 72, 0, 69, 0, 0, 0, 72, 74, 76, 0, 79, 0, 0, 76, 0, 72, 74, 0, 72, 69, 0, 67, 0, 69, 0, 0],
  },
  /* BOSS 战变奏：142BPM，A 和声小调（G#/F 张力），八分音符驱动低音 + 半音摩擦刺音 */
  boss: {
    bass: [45, 0, 45, 0, 44, 0, 45, 0, 45, 0, 44, 0, 45, 0, 48, 0, 45, 0, 45, 0, 44, 0, 45, 0, 41, 0, 41, 0, 43, 0, 44, 0],
    lead: [76, 0, 72, 0, 77, 0, 76, 0, 72, 0, 76, 0, 0, 0, 77, 0, 76, 0, 72, 0, 77, 0, 79, 0, 81, 0, 80, 0, 77, 0, 76, 0],
  },
  menu: {
    bass: [45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0],
    /* 琶音：Am / F / C / G，每 8 步一个和弦，偶数步走 chord tones */
    arp: [[69, 72, 76, 72], [65, 69, 72, 69], [67, 72, 76, 72], [67, 71, 74, 71]],
  },
};
function _bgNote(freq, t0, dur, type, vol) {
  if (!freq || !audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol * _BGM_V, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) {}
}
function _bgNoiseAt(t0, dur, vol) {
  if (!audioCtx) return;
  try {
    const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = vol * _BGM_V;
    s.connect(g); g.connect(audioCtx.destination); s.start(t0);
  } catch (e) {}
}
function _bgmTick() {
  if (!bgmOn || !audioCtx || STORE.mute) return;
  const now = audioCtx.currentTime;
  if (_bgmNextT < now) _bgmNextT = now + 0.06;   /* 首启/挂起恢复：从当前时刻起排，不追赶 */
  const spb = 60 / (_BGM_BPM[_bgmPat] || 120) / 4;   /* 十六分音符时长 */
  while (_bgmNextT < now + 0.35) {
    const s = _bgmStep, t = _bgmNextT, pat = _BGM_PATTERNS[_bgmPat] || _BGM_PATTERNS.menu;
    if (_bgmPat === 'battle') {
      if (pat.bass[s]) _bgNote(_nf(pat.bass[s]), t, spb * 3.2, 'square', 0.028);
      if (pat.lead[s]) _bgNote(_nf(pat.lead[s]), t, spb * 1.7, 'square', 0.03);
      if (s % 4 === 2) _bgNoiseAt(t, spb * 0.5, 0.013);
    } else if (_bgmPat === 'boss') {
      if (pat.bass[s]) _bgNote(_nf(pat.bass[s]), t, spb * 1.8, 'square', 0.032);
      if (pat.lead[s]) _bgNote(_nf(pat.lead[s]), t, spb * 1.5, 'square', 0.028);
      if (s % 2 === 1) _bgNoiseAt(t, spb * 0.4, 0.011);   /* 八分音符 hat，推紧张感 */
    } else {
      if (s % 8 === 0 && pat.bass[s]) _bgNote(_nf(pat.bass[s]), t, spb * 30, 'triangle', 0.026);
      if (s % 2 === 0) _bgNote(_nf(pat.arp[(s / 8) | 0][(s % 8) / 2]), t, spb * 3.4, 'triangle', 0.024);
    }
    _bgmStep = (_bgmStep + 1) % 32;
    _bgmNextT += spb;
  }
}
function bgmStart(pat) {
  if (_bgmPat !== pat) { _bgmPat = pat; _bgmStep = 0; }
  bgmOn = true;
  if (audioCtx) { _bgmNextT = Math.max(_bgmNextT, audioCtx.currentTime + 0.06); _bgmTick(); }
  if (!_bgmTimer) _bgmTimer = setInterval(_bgmTick, 90);
}
function bgmScene(sc, bossActive) { bgmStart(sc === 'play' ? (bossActive ? 'boss' : 'battle') : 'menu'); }
