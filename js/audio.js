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
