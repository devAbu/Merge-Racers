// Balance sanity check + milestone report. `node tools/sim.js` (exit code 1 if balance is broken).
// A simulated player taps once per second: merge a pair if one exists, otherwise buy a car.
const CFG = require('../www/config.js');
const Core = require('../www/core.js');

function play(opts) {
  const S = Core.newState();
  const dt = 1;                       // one player action per second
  let t = 0;
  const mile = {};
  let desertAt = null;
  const maxT = opts.maxHours * 3600;
  while (t < maxT) {
    // buy the desert track as soon as it is affordable
    if (S.tracks.desert !== 1 && S.coins >= Core.trackDef('desert').cost) {
      Core.buyTrack(S, 'desert'); S.activeTrack = 'desert'; desertAt = t;
    }
    // player action
    let acted = false;
    const pair = Core.findPair(S);
    if (pair) { Core.move(S, pair[0], pair[1]); acted = true; }
    else if (Core.canAfford(S) && Core.freeCell(S) >= 0) { Core.buy(S); acted = true; }
    // time passes
    const earn = Core.cps(S, false) * dt;
    S.coins += earn; S.totalEarnedRun += earn;
    t += dt;
    for (let L = 2; L <= CFG.maxLevel; L++) if (S.highestRun >= L && mile[L] === undefined) mile[L] = t;
    if (S.highestRun >= CFG.maxLevel) break;
    if (!acted && Core.freeCell(S) < 0 && !Core.findPair(S)) { mile.stuck = t; break; }
  }
  return { S: S, t: t, mile: mile, desertAt: desertAt };
}

const r = play({ maxHours: 24 });
const m = (s) => s === undefined ? 'never' : (s < 3600 ? (s / 60).toFixed(1) + ' min' : (s / 3600).toFixed(2) + ' h');
console.log('Milestones (active play, 1 action/s):');
for (let L = 2; L <= CFG.maxLevel; L++) console.log('  car level ' + L + ': ' + m(r.mile[L]));
console.log('  desert track bought at: ' + m(r.desertAt));
console.log('  final cps: ' + Core.fmt(Core.cps(r.S, false)) + '/s, cars on grid: ' + Core.carCount(r.S));
if (r.mile.stuck) console.log('  STUCK (grid full, no pair) at ' + m(r.mile.stuck));

// offline cap check
const S2 = Core.newState();
const off = Core.offlineEarn(S2, 99 * 3600);
const expect = Math.floor(Core.cps(S2, false) * CFG.offlineCapSec * CFG.offlineRate);

const fails = [];
if (r.mile[5] === undefined || r.mile[5] < 60 || r.mile[5] > 12 * 60) fails.push('level 5 should take 1-12 min, got ' + m(r.mile[5]));
if (r.mile[CFG.prestigeLevel] === undefined) fails.push('prestige level ' + CFG.prestigeLevel + ' is not reachable within 24 h');
else if (r.mile[CFG.prestigeLevel] < 20 * 60) fails.push('prestige level reached too fast: ' + m(r.mile[CFG.prestigeLevel]));
else if (r.mile[CFG.prestigeLevel] > 10 * 3600) fails.push('prestige level too slow: ' + m(r.mile[CFG.prestigeLevel]));
if (r.mile.stuck) fails.push('simulated player got stuck');
if (off !== expect) fails.push('offline cap broken');

// prestige reset check
const S3 = Core.newState(); S3.highestRun = CFG.prestigeLevel + 1; S3.coins = 5;
const gain = Core.prestigeGain(S3);
Core.doPrestige(S3);
if (S3.stars !== gain || gain < 1 || S3.coins !== CFG.startCoins || Core.carCount(S3) !== CFG.startCars.length) fails.push('prestige reset broken');
if (Core.cps(S3, false) <= Core.cps(Core.newState(), false)) fails.push('prestige gives no bonus');

// merge rules check
const S4 = Core.newState(); S4.grid.fill(0); S4.grid[0] = 3; S4.grid[1] = 3; S4.grid[2] = 5; S4.grid[3] = CFG.maxLevel; S4.grid[4] = CFG.maxLevel;
if (Core.move(S4, 0, 1) !== 3 || S4.grid[1] !== 4 || S4.grid[0] !== 0) fails.push('merge broken');
if (Core.move(S4, 1, 2) !== 2) fails.push('swap broken');
if (Core.move(S4, 3, 4) !== 2) fails.push('max level cars must not merge');

if (fails.length) { console.error('\nFAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('\nOK');
