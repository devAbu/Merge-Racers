// Merge Racers - music + sound effects synthesized with Web Audio (no files, fully offline).
// Separate switches for music and effects. Vibration lives here too (Haptic).
(function (root) {
  'use strict';

  let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let sfxOn = true, musicOn = true, vibeOn = true;
  let timer = null, nextTime = 0, step = 0, active = 0, lastLap = 0;

  const midi = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function init() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musicOn ? 0.28 : 0; musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    let out = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    out.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.02);
    if (!o.music) { active++; osc.onended = function () { active--; }; }
  }
  function noise(o) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf;
    f.type = o.ftype || 'bandpass'; f.frequency.value = o.freq || 2000; f.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t); src.stop(t + o.dur + 0.02);
  }

  // ---------- sound effects ----------
  const SFX = {
    tap: function () { tone({ type: 'sine', f0: 520, f1: 700, dur: 0.07, gain: 0.18 }); },
    pick: function () { tone({ type: 'triangle', f0: 420, f1: 560, dur: 0.06, gain: 0.16 }); },
    drop: function () { tone({ type: 'sine', f0: 300, f1: 180, dur: 0.09, gain: 0.2 }); },
    buy: function () {
      tone({ type: 'square', f0: 330, f1: 660, dur: 0.1, gain: 0.1, lp: 2400 });
      tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.14, gain: 0.12, t: ctx.currentTime + 0.05 });
    },
    merge: function (lv) {
      const base = 60 + Math.min(lv || 1, 15);
      const t = ctx.currentTime;
      tone({ type: 'triangle', f0: midi(base), f1: midi(base + 7), dur: 0.2, gain: 0.22, t: t });
      tone({ type: 'sine', f0: midi(base + 12), dur: 0.28, gain: 0.14, t: t + 0.07 });
      tone({ type: 'sine', f0: midi(base + 19), dur: 0.35, gain: 0.1, t: t + 0.13 });
      noise({ freq: 5000, q: 0.7, dur: 0.12, gain: 0.07, ftype: 'highpass' });
    },
    lap: function () {
      const t = ctx.currentTime;
      if (t - lastLap < 0.09 || active > 10) return;
      lastLap = t;
      tone({ type: 'sine', f0: 1500 + Math.random() * 300, dur: 0.06, gain: 0.05 });
    },
    error: function () {
      tone({ type: 'square', f0: 160, f1: 110, dur: 0.16, gain: 0.1, lp: 900 });
    },
    reward: function () {
      const t = ctx.currentTime;
      [72, 76, 79, 84].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.22, gain: 0.16, t: t + i * 0.07 }); });
    },
    turbo: function () {
      tone({ type: 'sawtooth', f0: 120, f1: 520, dur: 0.5, gain: 0.1, lp: 1800 });
      noise({ freq: 900, q: 0.8, dur: 0.5, gain: 0.08 });
    },
    unlock: function () {
      const t = ctx.currentTime;
      [67, 72, 76, 79, 84].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.3, gain: 0.15, t: t + i * 0.08 }); });
    },
    prestige: function () {
      const t = ctx.currentTime;
      tone({ type: 'sawtooth', f0: 90, f1: 900, dur: 0.9, gain: 0.12, lp: 2400, t: t });
      [60, 67, 72, 79, 84, 91].forEach(function (n, i) { tone({ type: 'triangle', f0: midi(n), dur: 0.5, gain: 0.13, t: t + 0.5 + i * 0.07 }); });
    }
  };

  // ---------- music: bright arpeggio + bass + hats, 4-chord loop ----------
  const CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]; // Am F C G
  const BASS = [45, 41, 36, 43];
  const STEP = 60 / 118 / 4; // 16th note at 118 bpm
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 1, 3, 2];

  function scheduleStep(t, s) {
    const bar = (s >> 4) & 3, i = s & 15;
    const ch = CHORDS[bar];
    tone({ type: 'triangle', f0: midi(ch[ARP[i]] + 12), dur: STEP * 1.6, gain: 0.2, t: t, dest: musBus, music: true, lp: 3000 });
    if (i % 4 === 0) tone({ type: 'sine', f0: midi(BASS[bar]), dur: STEP * 3.4, gain: 0.5, t: t, dest: musBus, music: true });
    if (i % 4 === 2) noise({ freq: 7500, q: 0.6, dur: 0.04, gain: 0.1, t: t, dest: musBus, ftype: 'highpass' });
    if (i === 0 && bar === 0 && (s >> 6) % 2 === 1) tone({ type: 'sine', f0: midi(ch[3] + 24), dur: STEP * 6, gain: 0.08, t: t, dest: musBus, music: true });
  }
  function pump() {
    if (!ctx) return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.35) { scheduleStep(nextTime, step); nextTime += STEP; step = (step + 1) & 63; }
  }
  function startMusic() {
    if (!ctx || timer) return;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(pump, 100);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
  function refreshMusic() {
    if (!ctx) return;
    musBus.gain.value = musicOn ? 0.28 : 0;
    if (musicOn && ctx.state === 'running') startMusic(); else stopMusic();
  }

  root.Sound = {
    // call from the first user touch (browsers/WebView need a gesture)
    unlock: function () {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      refreshMusic();
    },
    setMusic: function (on) { musicOn = on; refreshMusic(); },
    setSfx: function (on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; },
    setVibe: function (on) { vibeOn = on; },
    play: function (name, arg) {
      if (!sfxOn || !ctx || ctx.state !== 'running') return;
      const f = SFX[name];
      if (f) { try { f(arg); } catch (e) { /* ignore */ } }
    },
    pause: function () { stopMusic(); if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx) { const p = ctx.resume(); if (p && p.then) p.then(refreshMusic); else refreshMusic(); } },
    vibe: function (ms) {
      if (vibeOn && root.navigator && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
    }
  };
})(typeof self !== 'undefined' ? self : this);
