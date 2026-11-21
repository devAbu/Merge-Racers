// Merge Racers - pure game logic (no DOM, no canvas). Shared by the game and tools/sim.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'));
  else root.Core = factory(root.CFG);
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  'use strict';

  const N = CFG.cols * CFG.rows;

  function newState() {
    const grid = new Array(N).fill(0);
    for (let i = 0; i < CFG.startCars.length; i++) grid[i] = CFG.startCars[i];
    return {
      v: 1,
      coins: CFG.startCoins,
      grid: grid,
      buyCount: {},
      highestRun: Math.max.apply(null, CFG.startCars),
      highestEver: Math.max.apply(null, CFG.startCars),
      stars: 0,
      prestiges: 0,
      tracks: { city: 1 },
      activeTrack: 'city',
      totalEarnedRun: 0,
      lastSeen: 0,
      turboUntil: 0,
      tut: 0,                // tutorial step (see main.js), 99 = done
      merges: 0,
      best: 0,               // best coins-per-second ever
      settings: { music: true, sfx: true, vibe: true }
    };
  }

  // ---------- economy ----------
  const lapCoinsTbl = [0], lapsTbl = [0];
  for (let L = 1; L <= CFG.maxLevel + 5; L++) {
    lapCoinsTbl[L] = Math.round(CFG.lapBase * Math.pow(CFG.lapGrowth, L - 1));
    lapsTbl[L] = (1 + CFG.speedStep * (L - 1)) / CFG.baseLapTime; // laps per second
  }
  function lapCoins(L) { return lapCoinsTbl[L]; }
  function lapsPerSec(L) { return lapsTbl[L]; }

  function trackDef(id) {
    for (let i = 0; i < CFG.tracks.length; i++) if (CFG.tracks[i].id === id) return CFG.tracks[i];
    return CFG.tracks[0];
  }
  function trackMult(S) { return trackDef(S.activeTrack).mult; }
  function prestigeMult(S) { return 1 + CFG.prestigeBonusPerStar * S.stars; }
  function incomeMult(S) { return trackMult(S) * prestigeMult(S); }
  function turboActive(S, now) { return now < S.turboUntil; }

  // coins per second of the whole grid at normal speed (turbo doubles it)
  function cps(S, turbo) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const L = S.grid[i];
      if (L) sum += lapCoinsTbl[L] * lapsTbl[L];
    }
    return sum * incomeMult(S) * (turbo ? CFG.turboMult : 1);
  }

  // ---------- grid ----------
  function freeCell(S) {
    for (let i = 0; i < N; i++) if (!S.grid[i]) return i;
    return -1;
  }
  function carCount(S) {
    let n = 0;
    for (let i = 0; i < N; i++) if (S.grid[i]) n++;
    return n;
  }
  function place(S, idx, L) {
    S.grid[idx] = L;
    if (L > S.highestRun) S.highestRun = L;
    if (L > S.highestEver) S.highestEver = L;
  }

  function buyLevel(S) { return Math.max(1, S.highestRun - CFG.buyLevelOffset); }
  function buyCost(S) {
    const bl = buyLevel(S);
    const n = S.buyCount[bl] || 0;
    return Math.ceil(CFG.baseCost * Math.pow(CFG.costLevelMul, bl - 1) * Math.pow(CFG.costGrowth, n));
  }
  function canAfford(S) { return S.coins >= buyCost(S); }

  // returns the cell index of the new car, -1 if grid full, -2 if too poor
  function buy(S) {
    const idx = freeCell(S);
    if (idx < 0) return -1;
    const cost = buyCost(S);
    if (S.coins < cost) return -2;
    const bl = buyLevel(S);
    S.coins -= cost;
    S.buyCount[bl] = (S.buyCount[bl] || 0) + 1;
    place(S, idx, bl);
    return idx;
  }
  // free car (rewarded). returns cell index or -1
  function freeCar(S) {
    const idx = freeCell(S);
    if (idx < 0) return -1;
    place(S, idx, buyLevel(S));
    return idx;
  }

  // result: 0 nothing, 1 move to empty, 2 swap, 3 merge
  function move(S, from, to) {
    if (from === to || !S.grid[from]) return 0;
    const a = S.grid[from], b = S.grid[to];
    if (!b) { S.grid[to] = a; S.grid[from] = 0; return 1; }
    if (a === b && a < CFG.maxLevel) {
      S.grid[from] = 0;
      place(S, to, a + 1);
      S.merges++;
      return 3;
    }
    S.grid[from] = b; S.grid[to] = a;
    return 2;
  }

  // first mergeable pair (lowest level first) -> [a, b] or null
  function findPair(S) {
    let best = null, bl = 99;
    for (let i = 0; i < N; i++) {
      const L = S.grid[i];
      if (!L || L >= CFG.maxLevel || L >= bl) continue;
      for (let j = i + 1; j < N; j++) {
        if (S.grid[j] === L) { best = [i, j]; bl = L; break; }
      }
    }
    return best;
  }

  // ---------- idle ----------
  function offlineEarn(S, seconds) {
    const t = Math.min(Math.max(seconds, 0), CFG.offlineCapSec);
    return Math.floor(cps(S, false) * t * CFG.offlineRate);
  }

  // ---------- tracks ----------
  function buyTrack(S, id) {
    const d = trackDef(id);
    if (S.tracks[id]) return true;
    if (S.coins < d.cost) return false;
    S.coins -= d.cost;
    S.tracks[id] = 1;
    return true;
  }

  // ---------- prestige ----------
  function canPrestige(S) { return S.highestRun >= CFG.prestigeLevel; }
  function prestigeGain(S) {
    if (!canPrestige(S)) return 0;
    return CFG.prestigeStarBase + CFG.prestigeStarPerLevel * (S.highestRun - CFG.prestigeLevel);
  }
  function doPrestige(S) {
    if (!canPrestige(S)) return false;
    S.stars += prestigeGain(S);
    S.prestiges++;
    S.coins = CFG.startCoins;
    S.grid = new Array(N).fill(0);
    for (let i = 0; i < CFG.startCars.length; i++) S.grid[i] = CFG.startCars[i];
    S.buyCount = {};
    S.highestRun = Math.max.apply(null, CFG.startCars);
    S.totalEarnedRun = 0;
    S.turboUntil = 0;
    return true;
  }

  // ---------- number formatting ----------
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  function fmt(n) {
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
    let i = 0;
    while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + SUF[i];
  }

  // merge saved data over fresh defaults (forward compatible)
  function hydrate(raw) {
    const S = newState();
    if (!raw || typeof raw !== 'object') return S;
    for (const k in S) {
      if (raw[k] === undefined) continue;
      if (k === 'settings' || k === 'tracks' || k === 'buyCount') {
        if (raw[k] && typeof raw[k] === 'object') S[k] = Object.assign(S[k], raw[k]);
      } else if (k === 'grid') {
        if (Array.isArray(raw.grid) && raw.grid.length === N) S.grid = raw.grid.map(function (x) { return x | 0; });
      } else S[k] = raw[k];
    }
    if (!(S.coins >= 0) || !isFinite(S.coins)) S.coins = CFG.startCoins;
    return S;
  }

  return {
    N: N, newState: newState, hydrate: hydrate,
    lapCoins: lapCoins, lapsPerSec: lapsPerSec, cps: cps,
    trackDef: trackDef, trackMult: trackMult, prestigeMult: prestigeMult, incomeMult: incomeMult,
    turboActive: turboActive,
    freeCell: freeCell, carCount: carCount, place: place,
    buyLevel: buyLevel, buyCost: buyCost, canAfford: canAfford, buy: buy, freeCar: freeCar,
    move: move, findPair: findPair,
    offlineEarn: offlineEarn, buyTrack: buyTrack,
    canPrestige: canPrestige, prestigeGain: prestigeGain, doPrestige: doPrestige,
    fmt: fmt
  };
});
