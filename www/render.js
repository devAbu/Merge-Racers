// Merge Racers - all art is drawn with code: 15 car designs, track themes, icons.
// Cars/tracks are pre-rendered to offscreen canvases so the per-frame cost is a few drawImage calls.
(function (root) {
  'use strict';
  const CFG = root.CFG;
  const TAU = Math.PI * 2;

  // ---------- helpers ----------
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---------- the 15 car designs (top-down, facing +x, length = 1 unit) ----------
  // w: body width, nose/tail: how much the tips narrow, cab: window style, stripe: livery,
  // spoil: 0 none / 1 lip / 2 wing, wheels: 0 normal / 1 open-wheel / 2 hover, flame: 0/1/2
  const SPEC = [null,
    { c0: '#b88f64', c1: '#7a5a3a', w: 0.50, nose: 0.10, tail: 0.05, cab: 0, stripe: 0, spoil: 0, wheels: 0, flame: 0, x: ['rust'], lamp: '#fff2b0' },
    { c0: '#86e8b8', c1: '#2fa57a', w: 0.48, nose: 0.22, tail: 0.10, cab: 0, stripe: 0, spoil: 0, wheels: 0, flame: 0, x: [], lamp: '#fff7c2' },
    { c0: '#79bdff', c1: '#2d6fd0', w: 0.47, nose: 0.26, tail: 0.12, cab: 1, stripe: 1, sc: '#ffffff', spoil: 0, wheels: 0, flame: 0, x: [], lamp: '#fff7c2' },
    { c0: '#ff6a6a', c1: '#c71f2e', w: 0.45, nose: 0.34, tail: 0.14, cab: 3, stripe: 1, sc: '#ffe9a8', spoil: 1, wheels: 0, flame: 0, x: [], lamp: '#fff7c2', helmet: '#ffe14a' },
    { c0: '#ffe05a', c1: '#e09b12', w: 0.44, nose: 0.38, tail: 0.16, cab: 1, stripe: 2, sc: '#2b2f3a', spoil: 1, wheels: 0, flame: 0, x: [], lamp: '#ffffff' },
    { c0: '#ffa84a', c1: '#d9531a', w: 0.44, nose: 0.42, tail: 0.18, cab: 1, stripe: 3, sc: '#ffffff', spoil: 2, wheels: 0, flame: 0, x: ['num'], lamp: '#ffffff' },
    { c0: '#3fe0cf', c1: '#12857f', w: 0.46, nose: 0.36, tail: 0.14, cab: 1, stripe: 0, spoil: 2, wheels: 0, flame: 0, x: ['dots', 'scoop'], lamp: '#ffffff' },
    { c0: '#c28cff', c1: '#6a2fc9', w: 0.50, nose: 0.40, tail: 0.12, cab: 2, stripe: 2, sc: '#ffd2f7', spoil: 2, wheels: 0, flame: 1, x: [], lamp: '#ffffff' },
    { c0: '#3a4256', c1: '#0c0f16', w: 0.44, nose: 0.50, tail: 0.18, cab: 4, stripe: 3, sc: '#37e8ff', spoil: 1, wheels: 0, flame: 1, x: ['under'], glow: '#37e8ff', lamp: '#9ff6ff' },
    { c0: '#ffe27a', c1: '#b8801a', w: 0.42, nose: 0.52, tail: 0.20, cab: 4, stripe: 2, sc: '#1b1f27', spoil: 2, wheels: 0, flame: 1, x: [], lamp: '#ffffff' },
    { c0: '#ffffff', c1: '#aeb7c7', w: 0.40, nose: 0.56, tail: 0.22, cab: 4, stripe: 3, sc: '#ff3b4a', spoil: 2, wheels: 0, flame: 1, x: [], lamp: '#ffffff' },
    { c0: '#58b4ff', c1: '#1450d6', w: 0.32, nose: 0.62, tail: 0.20, cab: 3, stripe: 1, sc: '#e8fbff', spoil: 2, wheels: 1, flame: 2, x: [], glow: '#33a0ff', lamp: '#d9f6ff', helmet: '#ffffff' },
    { c0: '#ff6fe0', c1: '#8a1dc9', w: 0.36, nose: 0.66, tail: 0.24, cab: 2, stripe: 0, spoil: 0, wheels: 2, flame: 2, x: ['hover', 'trail'], glow: '#ff4fd8', lamp: '#ffe3fa' },
    { c0: '#5cf2ff', cm: '#b46cff', c1: '#ffb84d', w: 0.38, nose: 0.68, tail: 0.26, cab: 2, stripe: 0, spoil: 0, wheels: 2, flame: 2, x: ['halo', 'trail'], glow: '#b46cff', lamp: '#ffffff' },
    { c0: '#ffffff', cm: '#ffeeb0', c1: '#f2b43c', w: 0.42, nose: 0.70, tail: 0.30, cab: 2, stripe: 0, spoil: 0, wheels: 2, flame: 2, x: ['halo', 'trail', 'wings', 'core'], glow: '#ffd45a', lamp: '#ffffff' }
  ];

  function bodyPath(g, hw, nose, tail) {
    const fw = hw * (1 - nose), rw = hw * (1 - tail);
    g.beginPath();
    g.moveTo(-0.5, -rw * 0.9);
    g.lineTo(-0.28, -hw);
    g.lineTo(0.2, -hw);
    g.quadraticCurveTo(0.5, -fw, 0.5, 0);
    g.quadraticCurveTo(0.5, fw, 0.2, hw);
    g.lineTo(-0.28, hw);
    g.lineTo(-0.5, rw * 0.9);
    g.quadraticCurveTo(-0.54, 0, -0.5, -rw * 0.9);
    g.closePath();
  }

  // draws one car centred on (0,0), facing +x, `len` pixels long
  function drawCar(g, lv, len) {
    const s = SPEC[lv] || SPEC[1];
    const hw = s.w / 2;
    const has = function (k) { return s.x.indexOf(k) >= 0; };
    g.save();
    g.scale(len, len);

    if (s.glow) {
      const r = g.createRadialGradient(0, 0, 0.05, 0, 0, 0.74);
      r.addColorStop(0, s.glow + '66'); r.addColorStop(1, s.glow + '00');
      g.fillStyle = r; g.fillRect(-0.8, -0.8, 1.6, 1.6);
    }
    if (has('trail')) {
      for (let i = -1; i <= 1; i++) {
        const gr = g.createLinearGradient(-0.5, 0, -0.74, 0);
        gr.addColorStop(0, s.glow + '99'); gr.addColorStop(1, s.glow + '00');
        g.fillStyle = gr; g.fillRect(-0.74, i * hw * 0.5 - 0.012, 0.26, 0.024);
      }
    }
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(0.02, 0.04, 0.5, hw * 1.08, 0, 0, TAU); g.fill();

    if (has('wings')) {
      g.fillStyle = s.c1;
      [-1, 1].forEach(function (sd) {
        g.beginPath(); g.moveTo(-0.05, sd * hw * 0.8); g.lineTo(-0.36, sd * (hw + 0.22)); g.lineTo(-0.40, sd * (hw + 0.2)); g.lineTo(-0.26, sd * hw * 0.8); g.closePath(); g.fill();
      });
    }
    if (has('hover') || has('halo')) {
      g.strokeStyle = s.glow + 'aa'; g.lineWidth = 0.02;
      g.beginPath(); g.ellipse(0, 0, has('halo') ? 0.56 : 0.47, hw * (has('halo') ? 1.55 : 1.2), 0, 0, TAU); g.stroke();
    }
    if (has('under')) {
      g.strokeStyle = s.glow + '99'; g.lineWidth = 0.018;
      rr(g, -0.46, -hw - 0.03, 0.92, hw * 2 + 0.06, 0.1); g.stroke();
    }
    // wheels
    if (s.wheels === 0) {
      g.fillStyle = '#12141a';
      [[0.27, -1], [0.27, 1], [-0.3, -1], [-0.3, 1]].forEach(function (p) { rr(g, p[0] - 0.08, p[1] * hw - 0.035 - (p[1] < 0 ? 0.01 : -0.01), 0.16, 0.07, 0.02); g.fill(); });
    } else if (s.wheels === 1) {
      g.fillStyle = '#12141a';
      [[0.3, -1, 0.2, 0.1], [0.3, 1, 0.2, 0.1], [-0.3, -1, 0.24, 0.12], [-0.3, 1, 0.24, 0.12]].forEach(function (p) {
        rr(g, p[0] - p[2] / 2, p[1] * (hw + 0.05) - p[3] / 2, p[2], p[3], 0.03); g.fill();
      });
    }
    // flames (behind the body)
    if (s.flame) {
      const fl = s.flame === 2 ? 0.2 : 0.11;
      [-0.5, 0.5].forEach(function (k) {
        const y = k * hw * 0.7;
        const gr = g.createLinearGradient(-0.5, 0, -0.5 - fl, 0);
        gr.addColorStop(0, s.flame === 2 ? '#ffffff' : '#ffe27a'); gr.addColorStop(0.5, s.flame === 2 ? '#7ad0ff' : '#ff8a2a'); gr.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-0.49, y - 0.035); g.lineTo(-0.5 - fl, y); g.lineTo(-0.49, y + 0.035); g.closePath(); g.fill();
      });
    }

    // body
    bodyPath(g, hw, s.nose, s.tail);
    const bg = g.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, s.c0);
    if (s.cm) bg.addColorStop(0.5, s.cm);
    bg.addColorStop(1, s.c1);
    g.fillStyle = bg; g.fill();
    g.lineWidth = 0.014; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke();

    g.save();
    bodyPath(g, hw, s.nose, s.tail); g.clip();
    // livery
    g.fillStyle = s.sc || '#fff';
    if (s.stripe === 1) g.fillRect(-0.5, -hw * 0.17, 1, hw * 0.34);
    else if (s.stripe === 2) { g.fillRect(-0.5, -hw * 0.34, 1, hw * 0.14); g.fillRect(-0.5, hw * 0.2, 1, hw * 0.14); }
    else if (s.stripe === 3) { g.fillRect(-0.5, -hw * 0.95, 1, hw * 0.12); g.fillRect(-0.5, hw * 0.83, 1, hw * 0.12); }
    if (has('rust')) {
      g.fillStyle = 'rgba(70,40,20,0.45)';
      [[-0.2, -0.1, 0.07], [0.12, 0.12, 0.06], [-0.35, 0.1, 0.05], [0.3, -0.08, 0.04]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill(); });
    }
    if (has('dots')) {
      g.fillStyle = 'rgba(10,40,50,0.4)';
      [[-0.32, -0.12, 0.045], [-0.2, 0.13, 0.05], [0.18, -0.14, 0.04], [0.3, 0.1, 0.045], [0.02, 0.0, 0.035]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill(); });
    }
    // gloss
    const gl = g.createLinearGradient(0, -hw, 0, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(-0.5, -hw, 1, hw);
    g.restore();

    if (has('num')) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.3, 0, hw * 0.34, 0, TAU); g.fill();
      g.fillStyle = s.c1; g.beginPath(); g.arc(0.3, 0, hw * 0.2, 0, TAU); g.fill();
    }

    // cabin
    const glass = g.createLinearGradient(0, -hw, 0, hw);
    glass.addColorStop(0, '#5c82a8'); glass.addColorStop(1, '#16202e');
    if (s.cab === 0) { rr(g, -0.14, -hw * 0.62, 0.32, hw * 1.24, 0.05); g.fillStyle = glass; g.fill(); }
    else if (s.cab === 1) { g.beginPath(); g.ellipse(0.0, 0, 0.19, hw * 0.62, 0, 0, TAU); g.fillStyle = glass; g.fill(); }
    else if (s.cab === 2) { g.beginPath(); g.ellipse(0.04, 0, 0.14, hw * 0.52, 0, 0, TAU); g.fillStyle = glass; g.fill(); }
    else if (s.cab === 4) { g.beginPath(); g.ellipse(0.06, 0, 0.25, hw * 0.4, 0, 0, TAU); g.fillStyle = glass; g.fill(); }
    else if (s.cab === 3) {
      rr(g, -0.08, -hw * 0.46, 0.2, hw * 0.92, 0.04); g.fillStyle = '#1a1d25'; g.fill();
      g.fillStyle = s.helmet || '#ffffff'; g.beginPath(); g.arc(0.03, 0, hw * 0.3, 0, TAU); g.fill();
      g.fillStyle = '#10131a'; g.beginPath(); g.ellipse(0.06, 0, hw * 0.13, hw * 0.2, 0, 0, TAU); g.fill();
    }
    if (s.cab !== 3) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.ellipse(0.02, -hw * 0.26, 0.09, hw * 0.1, 0, 0, TAU); g.fill();
    }
    if (has('scoop')) { rr(g, -0.12, -0.03, 0.08, 0.06, 0.015); g.fillStyle = '#0c2f33'; g.fill(); }
    if (has('core')) {
      const cr = g.createRadialGradient(0.04, 0, 0, 0.04, 0, 0.13);
      cr.addColorStop(0, '#ffffff'); cr.addColorStop(0.5, '#ffe27a'); cr.addColorStop(1, 'rgba(255,200,60,0)');
      g.fillStyle = cr; g.beginPath(); g.arc(0.04, 0, 0.13, 0, TAU); g.fill();
    }

    // spoiler
    if (s.spoil === 1) { rr(g, -0.52, -hw * 0.85, 0.05, hw * 1.7, 0.012); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill(); }
    else if (s.spoil === 2) {
      rr(g, -0.56, -hw * 1.08, 0.085, hw * 2.16, 0.016); g.fillStyle = '#161a22'; g.fill();
      g.fillStyle = s.sc || s.c0; g.fillRect(-0.56, -hw * 1.08, 0.03, hw * 2.16);
    }
    // lights
    g.fillStyle = s.lamp;
    const fy = hw * (1 - s.nose) * 0.55;
    g.beginPath(); g.ellipse(0.43, -fy, 0.03, 0.02, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.43, fy, 0.03, 0.02, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff3b3b';
    const ty = hw * (1 - s.tail) * 0.72;
    g.fillRect(-0.49, -ty - 0.015, 0.025, 0.03); g.fillRect(-0.49, ty - 0.015, 0.025, 0.03);
    g.restore();
  }

  // ---------- sprite sets (pre-rendered) ----------
  // cell sprite: whole grid cell (car + level badge). track sprite: car only, square. icon: car only.
  function buildSprites(cw, ch, trackLen, iconLen, dpr) {
    const out = { cell: [], track: [], icon: [], trackSide: trackLen * 1.5, iconSide: iconLen * 1.5 };
    const len = Math.min(cw * 0.8, ch * 1.45);
    for (let L = 1; L <= CFG.maxLevel; L++) {
      let c = makeCanvas(cw * dpr, ch * dpr), g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.save(); g.translate(cw / 2, ch / 2 - 1); drawCar(g, L, len); g.restore();
      // badge
      const bx = cw - 11, by = ch - 10;
      g.fillStyle = 'rgba(8,12,22,0.78)'; g.beginPath(); g.arc(bx, by, 8.5, 0, TAU); g.fill();
      g.lineWidth = 1.5; g.strokeStyle = L === CFG.maxLevel ? '#ffd45a' : 'rgba(255,255,255,0.35)'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = '700 ' + (L > 9 ? 9 : 10) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(L), bx, by + 0.5);
      out.cell.push(c);

      c = makeCanvas(out.trackSide * dpr, out.trackSide * dpr); g = c.getContext('2d');
      g.scale(dpr, dpr); g.translate(out.trackSide / 2, out.trackSide / 2); drawCar(g, L, trackLen);
      out.track.push(c);

      c = makeCanvas(out.iconSide * dpr, out.iconSide * dpr); g = c.getContext('2d');
      g.scale(dpr, dpr); g.translate(out.iconSide / 2, out.iconSide / 2); drawCar(g, L, iconLen);
      out.icon.push(c);
    }
    return out;
  }

  // ---------- track geometry + themes ----------
  function trackGeom(w, h) {
    const m = 8;
    const roadW = Math.max(30, Math.min(52, h * 0.26));
    const rc = (h - 2 * m - roadW) / 2;
    const ac = Math.max(10, (w - 2 * m - roadW) / 2 - rc);
    return { w: w, h: h, cx: w / 2, cy: h / 2, rc: rc, ac: ac, roadW: roadW, P: 4 * ac + Math.PI * 2 * rc };
  }
  // position of a car at phase 0..1; lane offset in px (+ = toward the infield). out = {x,y,a}
  function trackPos(geo, ph, off, out) {
    const rc = geo.rc, ac = geo.ac;
    const d = ph * geo.P;
    const s1 = 2 * ac, s2 = s1 + Math.PI * rc, s3 = s2 + 2 * ac;
    let x, y, a;
    if (d < s1) { x = geo.cx - ac + d; y = geo.cy - rc; a = 0; }
    else if (d < s2) { const f = (d - s1) / rc; x = geo.cx + ac + rc * Math.sin(f); y = geo.cy - rc * Math.cos(f); a = f; }
    else if (d < s3) { x = geo.cx + ac - (d - s2); y = geo.cy + rc; a = Math.PI; }
    else { const f = (d - s3) / rc; x = geo.cx - ac - rc * Math.sin(f); y = geo.cy + rc * Math.cos(f); a = Math.PI + f; }
    out.x = x - Math.sin(a) * off; out.y = y + Math.cos(a) * off; out.a = a;
  }

  function roadPath(g, geo) {
    g.beginPath();
    g.moveTo(geo.cx - geo.ac, geo.cy - geo.rc);
    g.lineTo(geo.cx + geo.ac, geo.cy - geo.rc);
    g.arc(geo.cx + geo.ac, geo.cy, geo.rc, -Math.PI / 2, Math.PI / 2);
    g.lineTo(geo.cx - geo.ac, geo.cy + geo.rc);
    g.arc(geo.cx - geo.ac, geo.cy, geo.rc, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  }
  function drawRoad(g, geo, pal) {
    g.lineJoin = 'round';
    roadPath(g, geo);
    g.lineWidth = geo.roadW + 10; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
    g.lineWidth = geo.roadW + 8; g.strokeStyle = pal.curbA; g.stroke();
    g.setLineDash([9, 9]); g.strokeStyle = pal.curbB; g.stroke(); g.setLineDash([]);
    g.lineWidth = geo.roadW; g.strokeStyle = pal.asphalt; g.stroke();
    g.lineWidth = 2; g.setLineDash([9, 11]); g.strokeStyle = pal.line; g.stroke(); g.setLineDash([]);
    // start / finish
    const sx = geo.cx - geo.ac, n = 6, sq = geo.roadW / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      g.fillRect(sx + j * 5 - 5, geo.cy - geo.rc - geo.roadW / 2 + i * sq, 5, sq);
    }
  }

  function themeCity(g, w, h, geo) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#202a44'); bg.addColorStop(1, '#2d3a5a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const rnd = mulberry(7);
    // rooftops
    for (let i = 0; i < 46; i++) {
      const bw = 16 + rnd() * 30, bh = 12 + rnd() * 24, x = rnd() * w - 6, y = rnd() * h - 6;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 3, y + 3, bw, bh);
      const sh = 52 + rnd() * 26;
      g.fillStyle = 'hsl(222,22%,' + sh * 0.55 + '%)'; g.fillRect(x, y, bw, bh);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x + 2, y + 2, bw - 4, 3);
      g.fillStyle = 'rgba(255,214,140,0.85)';
      for (let k = 0; k < 3; k++) if (rnd() > 0.35) g.fillRect(x + 3 + rnd() * (bw - 8), y + 6 + rnd() * (bh - 9), 3, 2);
    }
    // park in the infield
    const ix = geo.cx - geo.ac - 4, iw = geo.ac * 2 + 8, ih = (geo.rc - geo.roadW / 2 - 6) * 2;
    if (iw > 20 && ih > 10) {
      rr(g, ix, geo.cy - ih / 2, iw, ih, 10); g.fillStyle = '#2f6b45'; g.fill();
      for (let i = 0; i < 30; i++) {
        const x = ix + 6 + rnd() * (iw - 12), y = geo.cy - ih / 2 + 5 + rnd() * (ih - 10);
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(x + 1.5, y + 1.5, 5, 0, TAU); g.fill();
        g.fillStyle = 'hsl(' + (125 + rnd() * 20) + ',45%,' + (30 + rnd() * 12) + '%)'; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill();
      }
    }
    drawRoad(g, geo, { curbA: '#e8e8ee', curbB: '#d23a3a', asphalt: '#2a2e38', line: '#f2d56a' });
    // street lamps
    g.fillStyle = 'rgba(255,230,150,0.9)';
    for (let i = 0; i < 12; i++) {
      const p = { x: 0, y: 0, a: 0 }; trackPos(geo, i / 12, -(geo.roadW / 2 + 8), p);
      g.beginPath(); g.arc(p.x, p.y, 2.2, 0, TAU); g.fill();
    }
  }

  function themeDesert(g, w, h, geo) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#efcc86'); bg.addColorStop(1, '#d9a45c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const rnd = mulberry(21);
    // dunes
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w, y = rnd() * h, rx = 40 + rnd() * 70, ry = 14 + rnd() * 22;
      const gr = g.createRadialGradient(x - rx * 0.2, y - ry * 0.3, 2, x, y, rx);
      gr.addColorStop(0, 'rgba(255,236,176,0.55)'); gr.addColorStop(1, 'rgba(255,236,176,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, -0.1, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(160,110,50,0.25)'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.arc(x, y, 6 + rnd() * 14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    // oasis in the infield
    const oh = (geo.rc - geo.roadW / 2 - 8), ow = geo.ac + oh * 0.6;
    if (oh > 8) {
      g.fillStyle = '#4fb6c9'; g.beginPath(); g.ellipse(geo.cx, geo.cy, ow, oh, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU, r = 0.55 + rnd() * 0.5;
        palm(g, geo.cx + Math.cos(a) * ow * r * 0.8, geo.cy + Math.sin(a) * oh * r * 0.8, 6 + rnd() * 3);
      }
    }
    // rocks + cacti (kept off the road)
    const tp = { x: 0, y: 0, a: 0 };
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, kind = rnd() > 0.5, sz = 4 + rnd() * 5;
      let near = 1e9;
      for (let k = 0; k < 40; k++) { trackPos(geo, k / 40, 0, tp); near = Math.min(near, Math.hypot(tp.x - x, tp.y - y)); }
      if (near < geo.roadW / 2 + 12) continue;
      if (kind) cactus(g, x, y, sz * 0.8); else rock(g, x, y, sz);
    }
    drawRoad(g, geo, { curbA: '#f4ead0', curbB: '#c9552b', asphalt: '#5b5048', line: '#f4ead0' });
  }
  function palm(g, x, y, r) {
    g.strokeStyle = '#2d7a3c'; g.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
    g.fillStyle = '#7a4d28'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
  }
  function cactus(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 1.5, y + 1.5, r, 0, TAU); g.fill();
    g.fillStyle = '#4f9a50'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#6fbb67'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.5, 0, TAU); g.fill();
    g.strokeStyle = '#3b7b3f'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.65, 0, TAU); g.stroke();
  }
  function rock(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, r * 1.2, r * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = '#9a7a5a'; g.beginPath(); g.ellipse(x, y, r * 1.2, r * 0.85, 0.3, 0, TAU); g.fill();
    g.fillStyle = '#c0a07a'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.25, r * 0.55, r * 0.35, 0.3, 0, TAU); g.fill();
  }

  const THEMES = { city: themeCity, desert: themeDesert };

  function renderTrack(theme, w, h, dpr) {
    const geo = trackGeom(w, h);
    const c = makeCanvas(w * dpr, h * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    (THEMES[theme] || themeCity)(g, w, h, geo);
    return { canvas: c, geo: geo };
  }

  // ---------- icons ----------
  function icon(g, name, cx, cy, s, col, col2) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.12; g.lineJoin = 'round'; g.lineCap = 'round';
    if (name === 'bolt') {
      g.beginPath(); g.moveTo(0.1, -0.5); g.lineTo(-0.32, 0.08); g.lineTo(-0.02, 0.08); g.lineTo(-0.12, 0.5); g.lineTo(0.34, -0.12); g.lineTo(0.04, -0.12); g.closePath(); g.fill();
    } else if (name === 'gift') {
      g.fillRect(-0.36, -0.08, 0.72, 0.5);
      g.fillStyle = col2 || '#fff'; g.fillRect(-0.4, -0.2, 0.8, 0.16); g.fillRect(-0.06, -0.2, 0.12, 0.62);
      g.strokeStyle = col2 || '#fff'; g.beginPath(); g.arc(-0.12, -0.3, 0.1, 0, TAU); g.moveTo(0.22, -0.3); g.arc(0.12, -0.3, 0.1, 0, TAU); g.stroke();
    } else if (name === 'flag') {
      g.beginPath(); g.moveTo(-0.3, 0.5); g.lineTo(-0.3, -0.5); g.stroke();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? (col2 || '#222') : col; g.fillRect(-0.26 + i * 0.2, -0.46 + j * 0.2, 0.2, 0.2);
      }
    } else if (name === 'star') {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
    } else if (name === 'gear') {
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.fillRect(-0.09, -0.5, 0.18, 0.2); g.restore(); }
      g.beginPath(); g.arc(0, 0, 0.36, 0, TAU); g.fill();
      g.fillStyle = col2 || '#000'; g.beginPath(); g.arc(0, 0, 0.15, 0, TAU); g.fill();
    } else if (name === 'coin') {
      g.beginPath(); g.arc(0, 0, 0.5, 0, TAU); g.fill();
      g.strokeStyle = col2 || '#b8801a'; g.lineWidth = 0.1; g.beginPath(); g.arc(0, 0, 0.34, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-0.14, -0.16, 0.1, 0.05, -0.7, 0, TAU); g.fill();
    }
    g.restore();
  }

  root.Render = {
    rr: rr, drawCar: drawCar, buildSprites: buildSprites,
    trackGeom: trackGeom, trackPos: trackPos, renderTrack: renderTrack,
    icon: icon, SPEC: SPEC
  };
})(typeof self !== 'undefined' ? self : this);
