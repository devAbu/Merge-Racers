// Merge Racers - game loop, layout, input, HUD, popups. Logic is in core.js, art in render.js.
(function () {
  'use strict';
  const CFG = window.CFG, Core = window.Core, STR = window.STR, T = STR.t;
  const R = window.Render, Ad = window.AdService, Snd = window.Sound;
  const N = Core.N, COLS = CFG.cols, ROWS = CFG.rows, TAU = Math.PI * 2;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const saEl = document.getElementById('sa');
  const modalEl = document.getElementById('modal'), cardEl = document.getElementById('card');
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const LIFT = 22;                        // dragged car floats above the finger

  // ---------------------------------------------------------------- save
  function loadSave() { try { const r = localStorage.getItem(CFG.saveKey); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function writeSave() { try { S.lastSeen = Date.now(); localStorage.setItem(CFG.saveKey, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  let S = Core.hydrate(loadSave());

  // ---------------------------------------------------------------- runtime state
  const phase = new Float32Array(N);      // 0..1 position of each grid car on the loop
  const pop = new Float32Array(N);        // spawn / merge pop animation (1 -> 0)
  let selected = -1, drag = null, pressed = null;
  let cpsC = 0, turbo = false, idle = 0, clock = 0;
  let toastStr = '', toastT = 0, shakeT = 0, flashT = 0, newCarT = 0, newCarLv = 1;
  let lapAcc = 0, lapTimer = 0, textTimer = 0, saveTimer = 0, hintTimer = 0;
  let hintType = 0, hintA = 0, hintB = 0, hintClock = 0;
  let modal = null;

  function resetRuntime() {
    for (let i = 0; i < N; i++) { phase[i] = Math.random(); pop[i] = 0; }
    selected = -1; drag = null;
  }
  resetRuntime();

  // particle / text pools (no allocations per frame)
  const PN = 56, px = new Float32Array(PN), py = new Float32Array(PN), pvx = new Float32Array(PN), pvy = new Float32Array(PN);
  const plife = new Float32Array(PN), pmax = new Float32Array(PN), psz = new Float32Array(PN), pcol = new Uint8Array(PN);
  const PCOL = ['#ffd45a', '#ff6a6a', '#7be0b0', '#79bdff', '#c28cff', '#ffffff'];
  let pnext = 0;
  function burst(x, y, n, speed) {
    for (let k = 0; k < n; k++) {
      const i = pnext; pnext = (pnext + 1) % PN;
      const a = Math.random() * TAU, v = (0.4 + Math.random() * 0.6) * speed;
      px[i] = x; py[i] = y; pvx[i] = Math.cos(a) * v; pvy[i] = Math.sin(a) * v - 30;
      plife[i] = pmax[i] = 0.5 + Math.random() * 0.4; psz[i] = 2 + Math.random() * 2.5; pcol[i] = (Math.random() * PCOL.length) | 0;
    }
  }
  const FN = 10, fx = new Float32Array(FN), fy = new Float32Array(FN), flife = new Float32Array(FN), ftxt = new Array(FN).fill('');
  let fnext = 0;
  function floatText(x, y, s) { const i = fnext; fnext = (fnext + 1) % FN; fx[i] = x; fy[i] = y; flife[i] = 1; ftxt[i] = s; }

  // ---------------------------------------------------------------- layout
  let W = 0, H = 0, dpr = 1, insT = 0, insB = 0, padX = 12;
  let gridX = 0, gridY = 0, cellW = 0, cellH = 0;
  let trackRect = { x: 0, y: 0, w: 0, h: 0 }, geo = null, laneOff = 0;
  let bg = null, sprites = null, coinImg = null, faces = null, trackImgs = {};
  const btns = [];                         // {id,x,y,w,h}
  const tmp = { x: 0, y: 0, a: 0 };
  const hud = { coins: '0', cps: '', mult: '', turboLbl: '', turboSt: 'blue', freeLbl: '', freeSt: 'blue', prestSt: 'blue', trkDot: false, buyOk: false, cost: '', max: false };

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr); return c; }
  function makeFace(w, h, c0, c1) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    g.scale(dpr, dpr);
    R.rr(g, 0, 2, w, h - 2, 13); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
    R.rr(g, 0, 0, w, h - 3, 13);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fill();
    R.rr(g, 2, 1.5, w - 4, (h - 3) * 0.45, 11); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
    return c;
  }
  function roundCanvas(c, w, h, r) {
    const g = c.getContext('2d');
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'destination-in'; R.rr(g, 0, 0, w, h, r); g.fillStyle = '#000'; g.fill();
    g.restore();
  }
  function getTrackImg(id) {
    if (!trackImgs[id]) {
      const t = R.renderTrack(id, trackRect.w, trackRect.h, dpr);
      roundCanvas(t.canvas, trackRect.w, trackRect.h, 16);
      trackImgs[id] = t.canvas;
    }
    return trackImgs[id];
  }

  function layout() {
    W = window.innerWidth; H = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const cs = window.getComputedStyle(saEl);
    insT = parseFloat(cs.paddingTop) || 0; insB = parseFloat(cs.paddingBottom) || 0;

    const hudH = 54 + insT, botH = 8 + 54 + 8 + 44 + 8 + insB;
    const avail = H - hudH - botH - 12;
    cellW = (W - 2 * padX) / COLS;
    const gridH = Math.min(ROWS * cellW * 0.92, avail * 0.62);
    cellH = gridH / ROWS;
    trackRect = { x: padX, y: hudH, w: W - 2 * padX, h: Math.max(90, avail - gridH) };
    gridX = padX; gridY = trackRect.y + trackRect.h + 6;
    geo = R.trackGeom(trackRect.w, trackRect.h);
    laneOff = geo.roadW * 0.2;

    // buttons
    btns.length = 0;
    const botY = H - botH;
    btns.push({ id: 'buy', x: padX, y: botY + 8, w: W - 2 * padX, h: 54 });
    const sw = (W - 2 * padX - 3 * 8) / 4, sy = botY + 8 + 54 + 8;
    ['turbo', 'free', 'tracks', 'prest'].forEach(function (id, i) { btns.push({ id: id, x: padX + i * (sw + 8), y: sy, w: sw, h: 44 }); });
    btns.push({ id: 'gear', x: W - padX - 40, y: insT + 7, w: 40, h: 40 });

    // static background (one drawImage per frame)
    bg = makeCanvas(W, H);
    const g = bg.getContext('2d'); g.scale(dpr, dpr);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#141b2b'); gr.addColorStop(1, '#0d121c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    R.rr(g, trackRect.x - 2, trackRect.y - 2, trackRect.w + 4, trackRect.h + 4, 18); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fill();
    for (let i = 0; i < N; i++) {
      const c = i % COLS, r = (i / COLS) | 0;
      R.rr(g, gridX + c * cellW + 3, gridY + r * cellH + 3, cellW - 6, cellH - 6, 10);
      g.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.085)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; g.stroke();
    }
    R.rr(g, 0, botY - 2, W, botH + 2, 0); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();

    // sprites + faces
    sprites = R.buildSprites(cellW, cellH, Math.max(22, Math.min(34, geo.roadW * 0.62)), 38, dpr);
    coinImg = makeCanvas(22, 22);
    const cg = coinImg.getContext('2d'); cg.scale(dpr, dpr);
    R.icon(cg, 'coin', 11, 11, 20, '#ffd45a', '#b8801a');
    const bw = W - 2 * padX;
    faces = {
      buyGreen: makeFace(bw, 54, '#4ade80', '#15803d'), buySlate: makeFace(bw, 54, '#4b5675', '#2f3750'),
      blue: makeFace(sw, 44, '#4aa8ff', '#2154c4'), gray: makeFace(sw, 44, '#4a5268', '#323950'),
      orange: makeFace(sw, 44, '#ffb340', '#d9480f'), gold: makeFace(sw, 44, '#ffe066', '#e08a00'),
      gear: makeFace(40, 40, '#3a4560', '#232b40')
    };
    trackImgs = {};
    textTimer = 0;
  }

  // ---------------------------------------------------------------- helpers
  function cellCX(i) { return gridX + (i % COLS) * cellW + cellW / 2; }
  function cellCY(i) { return gridY + ((i / COLS) | 0) * cellH + cellH / 2; }
  function cellAt(x, y) {
    const c = Math.floor((x - gridX) / cellW), r = Math.floor((y - gridY) / cellH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return r * COLS + c;
  }
  function btn(id) { for (let i = 0; i < btns.length; i++) if (btns[i].id === id) return btns[i]; return null; }
  function hitBtn(x, y) {
    for (let i = 0; i < btns.length; i++) { const b = btns[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id; }
    return null;
  }
  function toast(s) { toastStr = s; toastT = 1.7; }
  function fmtT(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function fmtDur(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (sec % 60) + 's';
  }
  function vibe(ms) { Snd.vibe(ms); }

  // ---------------------------------------------------------------- game actions
  function afterPlaced(idx, hiBefore) {
    phase[idx] = Math.random(); pop[idx] = 1;
    burst(cellCX(idx), cellCY(idx), 8, 70);
    if (S.highestEver > hiBefore) {
      newCarLv = S.highestEver; newCarT = 2.4; burst(W / 2, trackRect.y + trackRect.h / 2, 26, 160);
      Snd.play('unlock'); vibe([20, 40, 20]);
    }
  }
  function doBuy() {
    const hi = S.highestEver;
    const idx = Core.buy(S);
    if (idx === -1) { toast(T('garageFull')); Snd.play('error'); vibe(30); shakeT = 0.3; return; }
    if (idx === -2) { toast(T('notEnough')); Snd.play('error'); vibe(30); shakeT = 0.3; return; }
    Snd.play('buy'); vibe(12);
    afterPlaced(idx, hi);
    if (S.tut === 1) S.tut = 2;
    hintTimer = 0;
  }
  function doMove(from, to) {
    const hi = S.highestEver;
    const r = Core.move(S, from, to);
    if (r === 3) {
      pop[to] = 1; burst(cellCX(to), cellCY(to), 16, 110);
      Snd.play('merge', S.grid[to]); vibe(18);
      if (S.highestEver > hi) { newCarLv = S.highestEver; newCarT = 2.4; burst(W / 2, trackRect.y + trackRect.h / 2, 26, 160); Snd.play('unlock'); vibe([20, 40, 20]); }
      if (S.tut === 0) S.tut = 1; else if (S.tut === 2) S.tut = 99;
      selected = -1; hintTimer = 0;
    } else if (r === 2) {
      const t = phase[from]; phase[from] = phase[to]; phase[to] = t;
      pop[from] = pop[to] = 0.6; Snd.play('drop'); selected = -1;
    } else if (r === 1) {
      phase[to] = phase[from]; pop[to] = 0.6; Snd.play('drop'); selected = -1;
    }
  }
  function tapCell(i) {
    if (selected === i) { selected = -1; return; }
    if (selected >= 0 && S.grid[selected]) {
      const same = S.grid[selected] === S.grid[i];
      if (same || !S.grid[i]) { doMove(selected, i); return; }
    }
    selected = i;
  }
  function doFreeCar() {
    if (Core.freeCell(S) < 0) { toast(T('garageFull')); Snd.play('error'); vibe(30); return; }
    Ad.request('freecar', function () {
      const hi = S.highestEver;
      const idx = Core.freeCar(S);
      Snd.play('reward'); vibe(25);
      if (idx < 0) { S.coins += Core.buyCost(S); toast(T('garageFull')); return; }
      afterPlaced(idx, hi);
    });
  }
  function doTurbo() {
    if (Core.turboActive(S, Date.now())) return;
    Ad.request('turbo', function () {
      S.turboUntil = Date.now() + CFG.turboSeconds * 1000;
      Snd.play('turbo'); vibe(40); toast(T('turboOn'));
    });
  }
  function activate(id) {
    Snd.play('tap');
    if (id === 'buy') doBuy();
    else if (id === 'free') doFreeCar();
    else if (id === 'turbo') doTurbo();
    else if (id === 'tracks') openTracks();
    else if (id === 'prest') openPrestige();
    else if (id === 'gear') openSettings();
  }
  function doPrestige() {
    Core.doPrestige(S);
    resetRuntime(); trackImgs = {};
    flashT = 1; Snd.play('prestige'); vibe([30, 60, 30, 60, 90]);
    textTimer = 0; writeSave();
  }

  // ---------------------------------------------------------------- input
  function pt(e) { return { x: e.clientX, y: e.clientY }; }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    Snd.unlock();
    if (modal) return;
    const p = pt(e); idle = 0;
    const b = hitBtn(p.x, p.y);
    if (b) { pressed = b; return; }
    const ci = cellAt(p.x, p.y);
    if (ci >= 0 && S.grid[ci]) { drag = { i: ci, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false }; Snd.play('pick'); }
  }, { passive: false });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    e.preventDefault();
    const p = pt(e); drag.x = p.x; drag.y = p.y;
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 9) drag.moved = true;
  }, { passive: false });
  function onUp(e) {
    e.preventDefault();
    const p = pt(e); idle = 0;
    if (pressed) {
      if (hitBtn(p.x, p.y) === pressed) activate(pressed);
      pressed = null; return;
    }
    if (drag) {
      const d = drag; drag = null;
      if (d.moved) {
        const t = cellAt(d.x, d.y - LIFT);
        if (t >= 0 && t !== d.i) doMove(d.i, t);
      } else tapCell(d.i);
    }
  }
  canvas.addEventListener('pointerup', onUp, { passive: false });
  canvas.addEventListener('pointercancel', function () { drag = null; pressed = null; });

  // ---------------------------------------------------------------- modals (DOM)
  function el(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function openModal(type, closable, build) {
    cardEl.innerHTML = '';
    modal = { type: type, closable: closable, refresh: null };
    modal.refresh = build(cardEl) || null;
    modalEl.classList.remove('hidden');
    drag = null; pressed = null;
  }
  function closeModal() { modal = null; modalEl.classList.add('hidden'); cardEl.innerHTML = ''; }
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl && modal && modal.closable) closeModal(); });

  function openSettings() {
    openModal('settings', true, function (c) {
      el('h2', '', T('settings'), c);
      const defs = [['music', 'music'], ['sfx', 'sfx'], ['vibe', 'vibration']];
      defs.forEach(function (d) {
        const row = el('div', 'row', '', c); el('span', '', T(d[1]), row);
        const b = el('button', 'tog', '', row);
        const paint = function () { b.textContent = S.settings[d[0]] ? T('on') : T('off'); b.className = 'tog' + (S.settings[d[0]] ? ' on' : ''); };
        paint();
        b.addEventListener('click', function () {
          S.settings[d[0]] = !S.settings[d[0]];
          if (d[0] === 'music') Snd.setMusic(S.settings.music); else if (d[0] === 'sfx') Snd.setSfx(S.settings.sfx); else Snd.setVibe(S.settings.vibe);
          paint(); Snd.play('tap'); if (d[0] === 'vibe') vibe(30); writeSave();
        });
      });
      el('p', 'small', T('stats', { n: S.highestEver, p: Core.fmt(S.best), t: S.prestiges }), c);
      const rs = el('button', 'btn alt', T('reset'), c);
      let armed = false;
      rs.addEventListener('click', function () {
        if (!armed) { armed = true; rs.className = 'btn red'; rs.textContent = T('resetConfirm'); return; }
        try { localStorage.removeItem(CFG.saveKey); } catch (e) { /* ignore */ }
        S = Core.newState(); S.lastSeen = Date.now(); resetRuntime(); trackImgs = {};
        applySettings(); closeModal(); textTimer = 0; writeSave();
      });
      const cl = el('button', 'btn blue', T('close'), c);
      cl.addEventListener('click', closeModal);
      el('p', 'small', T('version'), c);
    });
  }

  function openTracks() {
    openModal('tracks', true, function (c) {
      el('h2', '', T('tracksTitle'), c);
      const rows = [];
      CFG.tracks.forEach(function (td) {
        const box = el('div', 'trk', '', c);
        const pv = R.renderTrack(td.id, 300, 150, Math.min(dpr, 1.5));
        pv.canvas.style.aspectRatio = '300 / 150';
        box.appendChild(pv.canvas);
        const nm = el('div', 'nm', '', box);
        el('span', '', STR.trackNames[td.id] || td.id, nm);
        el('span', '', T('incomeMult', { n: td.mult }), nm);
        const b = el('button', 'btn', '', box);
        b.addEventListener('click', function () {
          if (S.tracks[td.id]) { S.activeTrack = td.id; Snd.play('tap'); }
          else if (Core.buyTrack(S, td.id)) { S.activeTrack = td.id; Snd.play('unlock'); vibe(30); }
          else { Snd.play('error'); return; }
          textTimer = 0; writeSave();
        });
        rows.push({ td: td, b: b });
      });
      const cl = el('button', 'btn alt', T('close'), c);
      cl.addEventListener('click', closeModal);
      return function () {
        rows.forEach(function (r) {
          let txt, cls = 'btn', dis = false;
          if (S.tracks[r.td.id]) { if (S.activeTrack === r.td.id) { txt = T('selected'); cls = 'btn alt'; dis = true; } else txt = T('select'); }
          else { txt = T('unlock', { n: Core.fmt(r.td.cost) }); cls = S.coins >= r.td.cost ? 'btn gold' : 'btn alt'; dis = S.coins < r.td.cost; }
          if (r.b.textContent !== txt) r.b.textContent = txt;
          if (r.b.className !== cls) r.b.className = cls;
          if (r.b.disabled !== dis) r.b.disabled = dis;
        });
      };
    });
  }

  function openPrestige() {
    openModal('prestige', true, function (c) {
      el('h2', '', T('prestigeTitle'), c);
      el('p', '', T('prestigeBody'), c);
      el('div', 'big', T('stars', { n: S.stars }), c);
      el('p', '', T('prestigeNow', { p: Math.round((Core.prestigeMult(S) - 1) * 100) }), c);
      const gain = Core.prestigeGain(S);
      const info = el('p', '', '', c);
      const go = el('button', 'btn gold', T('prestigeButton'), c);
      if (Core.canPrestige(S)) {
        const newMult = 1 + CFG.prestigeBonusPerStar * (S.stars + gain);
        info.textContent = T('prestigeGain', { n: gain, p: Math.round((newMult - 1) * 100) });
        info.style.color = '#ffd45a';
      } else {
        info.textContent = T('prestigeLocked', { n: CFG.prestigeLevel });
        go.disabled = true; go.className = 'btn alt';
      }
      let armed = false;
      go.addEventListener('click', function () {
        if (!armed) { armed = true; go.textContent = T('prestigeConfirm'); go.className = 'btn red'; return; }
        closeModal(); doPrestige();
      });
      const cl = el('button', 'btn alt', T('close'), c);
      cl.addEventListener('click', closeModal);
    });
  }

  function openWelcome(earn, away) {
    S.lastSeen = Date.now();
    openModal('welcome', false, function (c) {
      el('h2', '', T('welcomeTitle'), c);
      el('p', '', T('welcomeBody'), c);
      el('div', 'big', '+' + Core.fmt(earn), c);
      el('p', 'small', T('awayFor', { t: fmtDur(away) }), c);
      const x2 = el('button', 'btn gold', T('collectX2'), c);
      const one = el('button', 'btn alt', T('collect'), c);
      let done = false;
      const claim = function (mult) {
        if (done) return; done = true;
        S.coins += earn * mult; S.totalEarnedRun += earn * mult;
        Snd.play('reward'); vibe(20); closeModal(); writeSave();
      };
      one.addEventListener('click', function () { claim(1); });
      x2.addEventListener('click', function () { Ad.request('offline', function () { claim(2); }); });
      return function (now) {
        const inf = Ad.info('offline', now);
        const playing = inf.phase === 'playing';
        const t = playing ? T('adCountdown', { s: inf.sec > 0 ? inf.sec : '...' }) : T('collectX2');
        if (x2.textContent !== t) x2.textContent = t;
        x2.disabled = playing; one.disabled = playing;
      };
    });
  }

  function applySettings() { Snd.setMusic(S.settings.music); Snd.setSfx(S.settings.sfx); Snd.setVibe(S.settings.vibe); }

  // ---------------------------------------------------------------- idle / offline
  function handleReturn() {
    const now = Date.now();
    if (!S.lastSeen) { S.lastSeen = now; return; }
    const away = (now - S.lastSeen) / 1000;
    S.lastSeen = now;
    if (away < 1) return;
    const earn = Core.offlineEarn(S, away);
    if (earn <= 0) return;
    if (away >= CFG.offlineModalMinSec && !modal) openWelcome(earn, away);
    else { S.coins += earn; S.totalEarnedRun += earn; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { writeSave(); Snd.pause(); }
    else { Snd.resume(); handleReturn(); }
  });
  window.addEventListener('pagehide', writeSave);

  // ---------------------------------------------------------------- update
  function refreshTexts(now) {
    const sec = S.coins;
    hud.coins = Core.fmt(Math.floor(sec));
    hud.cps = T('perSec', { n: Core.fmt(cpsC) }) + (turbo ? '  ' + T('turboOn') : '');
    const m = Core.incomeMult(S);
    hud.mult = m > 1.001 ? 'x' + (Math.round(m * 100) / 100) : '';
    // turbo button
    if (turbo) { hud.turboLbl = fmtT(Math.max(0, Math.ceil((S.turboUntil - now) / 1000))); hud.turboSt = 'orange'; }
    else {
      const ti = Ad.info('turbo', now);
      if (ti.phase === 'playing') { hud.turboLbl = T('adCountdown', { s: ti.sec > 0 ? ti.sec : '...' }); hud.turboSt = 'gray'; }
      else if (ti.phase === 'cooldown') { hud.turboLbl = T('wait', { t: fmtT(ti.sec) }); hud.turboSt = 'gray'; }
      else { hud.turboLbl = T('turbo'); hud.turboSt = 'blue'; }
    }
    const fi = Ad.info('freecar', now), full = Core.freeCell(S) < 0;
    if (fi.phase === 'playing') { hud.freeLbl = T('adCountdown', { s: fi.sec > 0 ? fi.sec : '...' }); hud.freeSt = 'gray'; }
    else if (fi.phase === 'cooldown') { hud.freeLbl = T('wait', { t: fmtT(fi.sec) }); hud.freeSt = 'gray'; }
    else { hud.freeLbl = T('freeCar'); hud.freeSt = full ? 'gray' : 'blue'; }
    hud.prestSt = Core.canPrestige(S) ? 'gold' : 'gray';
    hud.trkDot = false;
    for (let i = 0; i < CFG.tracks.length; i++) { const td = CFG.tracks[i]; if (!S.tracks[td.id] && S.coins >= td.cost) hud.trkDot = true; }
    hud.cost = Core.fmt(Core.buyCost(S));
    hud.buyOk = Core.canAfford(S) && !full;
    hud.max = false;
  }

  function computeHint() {
    hintType = 0;
    if (modal || drag || newCarT > 0) return;
    const pair = Core.findPair(S);
    const canBuy = Core.canAfford(S) && Core.freeCell(S) >= 0;
    if (S.tut === 0) { if (pair) { hintType = 1; hintA = pair[0]; hintB = pair[1]; } }
    else if (S.tut === 1) { if (canBuy) hintType = 2; else if (pair) { hintType = 1; hintA = pair[0]; hintB = pair[1]; } }
    else if (S.tut === 2) { if (pair) { hintType = 1; hintA = pair[0]; hintB = pair[1]; } else if (canBuy) hintType = 2; }
    else if (idle > 7 && S.merges < 40) {
      if (pair) { hintType = 1; hintA = pair[0]; hintB = pair[1]; } else if (canBuy) hintType = 2;
    }
  }

  function update(dt, now) {
    clock += dt; idle += dt;
    Ad.update(now);
    turbo = Core.turboActive(S, now);
    const mul = turbo ? CFG.turboMult : 1, im = Core.incomeMult(S);
    // cars drive; each completed lap pays out
    for (let i = 0; i < N; i++) {
      const L = S.grid[i];
      if (!L) continue;
      let p = phase[i] + Core.lapsPerSec(L) * mul * dt;
      if (p >= 1) {
        p -= 1;
        const amt = Core.lapCoins(L) * im;
        S.coins += amt; S.totalEarnedRun += amt; lapAcc += amt;
        Snd.play('lap');
      }
      phase[i] = p;
      if (pop[i] > 0) pop[i] = Math.max(0, pop[i] - dt * 3.2);
    }
    lapTimer += dt;
    if (lapTimer >= 0.45) {
      lapTimer = 0;
      if (lapAcc > 0) { floatText(trackRect.x + geo.cx + (Math.random() * 60 - 30), trackRect.y + geo.cy + 8, '+' + Core.fmt(lapAcc)); lapAcc = 0; }
    }
    // pools
    for (let i = 0; i < PN; i++) {
      if (plife[i] <= 0) continue;
      plife[i] -= dt; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt; pvy[i] += 220 * dt;
    }
    for (let i = 0; i < FN; i++) if (flife[i] > 0) { flife[i] -= dt * 0.9; fy[i] -= 26 * dt; }
    if (toastT > 0) toastT -= dt;
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt * 1.4;
    if (newCarT > 0) newCarT -= dt;

    textTimer -= dt;
    if (textTimer <= 0) {
      textTimer = 0.1;
      cpsC = Core.cps(S, turbo);
      if (cpsC > S.best) S.best = cpsC;
      refreshTexts(now);
    }
    hintTimer -= dt;
    if (hintTimer <= 0) { hintTimer = 0.25; computeHint(); }
    hintClock = hintType ? hintClock + dt : 0;

    saveTimer += dt;
    if (saveTimer >= CFG.autosaveSec) { saveTimer = 0; writeSave(); }
    if (modal && modal.refresh) modal.refresh(now);
  }

  // ---------------------------------------------------------------- render
  function setFont(w, px) { ctx.font = w + ' ' + px + 'px ' + FONT; }

  function drawFace(b, face, scale) {
    const s = scale || 1;
    if (s === 1) { ctx.drawImage(face, b.x, b.y, b.w, b.h); return; }
    ctx.setTransform(dpr * s, 0, 0, dpr * s, (b.x + b.w / 2) * dpr, (b.y + b.h / 2) * dpr);
    ctx.drawImage(face, -b.w / 2, -b.h / 2, b.w, b.h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawHud() {
    ctx.drawImage(coinImg, padX, insT + 10, 22, 22);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    setFont('800', 24); ctx.fillStyle = '#ffffff'; ctx.fillText(hud.coins, padX + 28, insT + 29);
    setFont('600', 12); ctx.fillStyle = turbo ? '#ffb340' : '#8ef0b5'; ctx.fillText(hud.cps, padX + 2, insT + 47);
    const g = btn('gear');
    drawFace(g, faces.gear, pressed && pressed === 'gear' ? 0.94 : 1);
    R.icon(ctx, 'gear', g.x + 20, g.y + 19, 20, '#cfd8f0', '#232b40');
    if (hud.mult) {
      setFont('800', 13); ctx.textAlign = 'right'; ctx.fillStyle = '#ffd45a';
      ctx.fillText(hud.mult, g.x - 10, insT + 31);
    }
  }

  function drawTrack() {
    const tr = trackRect;
    ctx.drawImage(getTrackImg(S.activeTrack), tr.x, tr.y, tr.w, tr.h);
    if (turbo) {
      ctx.strokeStyle = 'rgba(255,179,64,' + (0.35 + 0.25 * Math.sin(clock * 8)) + ')'; ctx.lineWidth = 3;
      R.rr(ctx, tr.x + 1.5, tr.y + 1.5, tr.w - 3, tr.h - 3, 15); ctx.stroke();
    }
    const side = sprites.trackSide;
    for (let i = 0; i < N; i++) {
      const L = S.grid[i];
      if (!L) continue;
      R.trackPos(geo, phase[i], (i & 1 ? 1 : -1) * laneOff, tmp);
      const c = Math.cos(tmp.a) * dpr, s = Math.sin(tmp.a) * dpr;
      ctx.setTransform(c, s, -s, c, (tr.x + tmp.x) * dpr, (tr.y + tmp.y) * dpr);
      ctx.drawImage(sprites.track[L - 1], -side / 2, -side / 2, side, side);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // lap payouts
    setFont('800', 14); ctx.textAlign = 'center';
    for (let i = 0; i < FN; i++) {
      if (flife[i] <= 0) continue;
      ctx.globalAlpha = Math.min(1, flife[i] * 1.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeText(ftxt[i], fx[i], fy[i]);
      ctx.fillStyle = '#ffe27a'; ctx.fillText(ftxt[i], fx[i], fy[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    const dragIdx = drag && drag.moved ? drag.i : -1;
    const dragLv = dragIdx >= 0 ? S.grid[dragIdx] : 0;
    for (let i = 0; i < N; i++) {
      const L = S.grid[i];
      const x = gridX + (i % COLS) * cellW, y = gridY + ((i / COLS) | 0) * cellH;
      if (dragLv && i !== dragIdx && L === dragLv && L < CFG.maxLevel) {
        ctx.strokeStyle = 'rgba(120,255,170,' + (0.55 + 0.35 * Math.sin(clock * 9)) + ')'; ctx.lineWidth = 2.5;
        R.rr(ctx, x + 3, y + 3, cellW - 6, cellH - 6, 10); ctx.stroke();
      }
      if (!L) continue;
      if (i === dragIdx) { ctx.globalAlpha = 0.25; ctx.drawImage(sprites.cell[L - 1], x, y, cellW, cellH); ctx.globalAlpha = 1; continue; }
      if (i === selected) {
        ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2.5;
        R.rr(ctx, x + 3, y + 3, cellW - 6, cellH - 6, 10); ctx.stroke();
      }
      if (pop[i] > 0) {
        const sc = 1 + 0.28 * Math.sin(pop[i] * Math.PI);
        ctx.setTransform(dpr * sc, 0, 0, dpr * sc, (x + cellW / 2) * dpr, (y + cellH / 2) * dpr);
        ctx.drawImage(sprites.cell[L - 1], -cellW / 2, -cellH / 2, cellW, cellH);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.drawImage(sprites.cell[L - 1], x, y + Math.sin(clock * 2.2 + i * 1.7) * 0.9, cellW, cellH);
      }
    }
    if (drag && drag.moved && dragLv) {
      const sc = 1.15;
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, drag.x * dpr, (drag.y - LIFT) * dpr);
      ctx.drawImage(sprites.cell[dragLv - 1], -cellW / 2, -cellH / 2, cellW, cellH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = cellAt(drag.x, drag.y - LIFT);
      if (t >= 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        R.rr(ctx, gridX + (t % COLS) * cellW + 3, gridY + ((t / COLS) | 0) * cellH + 3, cellW - 6, cellH - 6, 10); ctx.stroke();
      }
    }
  }

  function drawBottom() {
    const b = btn('buy');
    const bl = Core.buyLevel(S);
    const sh = shakeT > 0 ? Math.sin(shakeT * 70) * 5 * (shakeT / 0.3) : 0;
    const bb = { x: b.x + sh, y: b.y, w: b.w, h: b.h };
    drawFace(bb, hud.buyOk ? faces.buyGreen : faces.buySlate, pressed === 'buy' ? 0.97 : 1);
    const iside = sprites.iconSide;
    ctx.drawImage(sprites.icon[bl - 1], bb.x + 14, bb.y + 27 - iside / 2, iside, iside);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    setFont('800', 18); ctx.fillStyle = '#ffffff'; ctx.fillText(STR.buy, bb.x + 76, bb.y + 24);
    ctx.drawImage(coinImg, bb.x + 76, bb.y + 29, 18, 18);
    setFont('800', 16); ctx.fillStyle = hud.buyOk ? '#fff7c2' : '#c4cde6'; ctx.fillText(hud.cost, bb.x + 98, bb.y + 43);
    setFont('700', 12); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Lv ' + bl, bb.x + bb.w - 16, bb.y + 33);

    // small buttons
    const defs = [
      ['turbo', hud.turboSt, 'bolt', hud.turboLbl],
      ['free', hud.freeSt, 'gift', hud.freeLbl],
      ['tracks', 'blue', 'flag', STR.tracks],
      ['prest', hud.prestSt, 'star', STR.prestige]
    ];
    for (let i = 0; i < 4; i++) {
      const d = defs[i], r = btn(d[0]);
      const pulse = d[0] === 'prest' && d[1] === 'gold' ? 1 + 0.03 * Math.sin(clock * 5) : 1;
      drawFace(r, faces[d[1]], (pressed === d[0] ? 0.95 : 1) * pulse);
      const dim = d[1] === 'gray';
      R.icon(ctx, d[2], r.x + r.w / 2, r.y + 15, 17, dim ? '#aab3cc' : '#ffffff', dim ? '#4a5268' : (d[2] === 'gift' ? '#d9480f' : '#2154c4'));
      ctx.textAlign = 'center'; setFont('700', 11); ctx.fillStyle = dim ? '#aab3cc' : '#ffffff';
      ctx.fillText(d[3], r.x + r.w / 2, r.y + 37, r.w - 6);
      if (d[0] === 'tracks' && hud.trkDot) { ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(r.x + r.w - 8, r.y + 8, 5, 0, TAU); ctx.fill(); }
    }
  }

  // animated finger hints (no text)
  function drawFinger(x, y, press) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.arc(x, y, 13 - press * 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 19 + press * 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(40,60,100,0.35)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  }
  function drawHint() {
    if (!hintType || modal || drag) return;
    const a = 0.55 + 0.35 * Math.sin(clock * 7);
    if (hintType === 1) {
      const ax = cellCX(hintA), ay = cellCY(hintA), bx = cellCX(hintB), by = cellCY(hintB);
      ctx.strokeStyle = 'rgba(120,255,170,' + a + ')'; ctx.lineWidth = 2.5;
      R.rr(ctx, ax - cellW / 2 + 3, ay - cellH / 2 + 3, cellW - 6, cellH - 6, 10); ctx.stroke();
      R.rr(ctx, bx - cellW / 2 + 3, by - cellH / 2 + 3, cellW - 6, cellH - 6, 10); ctx.stroke();
      const u = (hintClock % 2.6) / 2.6;
      let k, al = 1, press = 0;
      if (u < 0.14) { k = 0; al = u / 0.14; }
      else if (u < 0.62) { const e = (u - 0.14) / 0.48; k = e * e * (3 - 2 * e); press = 1; }
      else if (u < 0.8) { k = 1; press = 1; }
      else { k = 1; al = 1 - (u - 0.8) / 0.2; }
      ctx.globalAlpha = al;
      drawFinger(ax + (bx - ax) * k, ay + (by - ay) * k - (press ? 6 : 0), press);
      ctx.globalAlpha = 1;
    } else if (hintType === 2) {
      const b = btn('buy');
      const e = (hintClock % 1.4) / 1.4;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - e)) + ')'; ctx.lineWidth = 3;
      R.rr(ctx, b.x - e * 8, b.y - e * 8, b.w + e * 16, b.h + e * 16, 14 + e * 6); ctx.stroke();
      drawFinger(b.x + b.w - 60, b.y + b.h / 2 + 8 - (e < 0.5 ? e * 6 : 0), e < 0.5 ? 1 : 0);
    }
  }

  function drawOverlays() {
    // particles
    for (let i = 0; i < PN; i++) {
      if (plife[i] <= 0) continue;
      ctx.globalAlpha = Math.min(1, plife[i] / pmax[i] * 1.5);
      ctx.fillStyle = PCOL[pcol[i]];
      ctx.fillRect(px[i] - psz[i] / 2, py[i] - psz[i] / 2, psz[i], psz[i]);
    }
    ctx.globalAlpha = 1;
    // toast
    if (toastT > 0) {
      const al = Math.min(1, toastT * 2.5);
      setFont('700', 14); ctx.textAlign = 'center';
      const tw = ctx.measureText(toastStr).width + 28;
      ctx.globalAlpha = al;
      R.rr(ctx, W / 2 - tw / 2, trackRect.y + 10, tw, 30, 15); ctx.fillStyle = 'rgba(8,12,22,0.85)'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText(toastStr, W / 2, trackRect.y + 30);
      ctx.globalAlpha = 1;
    }
    // new car popup
    if (newCarT > 0) {
      const t = 2.4 - newCarT;
      const sc = t < 0.35 ? (function (u) { const c1 = 1.70158; return 1 + (c1 + 1) * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); })(t / 0.35) : 1;
      const al = Math.min(1, newCarT * 2.5);
      const cx = W / 2, cy = trackRect.y + trackRect.h / 2;
      ctx.globalAlpha = al;
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, cx * dpr, cy * dpr);
      R.rr(ctx, -110, -58, 220, 116, 20); ctx.fillStyle = 'rgba(10,14,26,0.88)'; ctx.fill();
      ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(0, -8); R.drawCar(ctx, newCarLv, 78); ctx.restore();
      ctx.textAlign = 'center'; setFont('800', 13); ctx.fillStyle = '#ffd45a'; ctx.fillText(STR.newCar, 0, 30);
      setFont('700', 14); ctx.fillStyle = '#ffffff'; ctx.fillText(STR.carNames[newCarLv] || '', 0, 48);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }
    if (flashT > 0) { ctx.globalAlpha = Math.min(1, flashT); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    drawHud();
    drawTrack();
    drawGrid();
    drawBottom();
    drawHint();
    drawOverlays();
  }

  // ---------------------------------------------------------------- boot
  let last = 0;
  function frame(ts) {
    window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
    update(dt, Date.now());
    render();
  }
  window.addEventListener('resize', function () { layout(); });
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });

  applySettings();
  layout();
  handleReturn();
  cpsC = Core.cps(S, false); refreshTexts(Date.now());
  window.requestAnimationFrame(function (ts) { last = ts; frame(ts); });

  // tiny debug/test hook (used by the headless smoke test, harmless in the app)
  window.__mr = { get S() { return S; }, Core: Core, doBuy: doBuy, doMove: doMove, layout: layout, openSettings: openSettings, openTracks: openTracks, openPrestige: openPrestige, openWelcome: openWelcome, save: writeSave };
})();
