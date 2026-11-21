// Merge Racers - all tunable gameplay/balance numbers live here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    // ---- grid ----
    cols: 4,
    rows: 5,

    // ---- cars ----
    maxLevel: 15,            // number of car designs (render.js has one design per level)
    prestigeLevel: 12,       // reach this car level to unlock prestige (MVP: 80% of maxLevel)
    buyLevelOffset: 3,       // Buy button gives level max(1, highestThisRun - offset)
    lapBase: 2,              // coins per lap for a level-1 car
    lapGrowth: 2.1,          // coins-per-lap multiplier per car level
    baseLapTime: 6,          // seconds for one lap, level-1 car
    speedStep: 0.07,         // each level adds this much speed (fraction of base)

    // ---- shop ----
    baseCost: 10,            // cost of the first level-1 car
    costGrowth: 1.15,        // cost multiplier per car bought at the same buy-level
    costLevelMul: 4.5,       // cost multiplier per buy-level

    // ---- start ----
    startCoins: 30,
    startCars: [1, 1],       // levels placed on a fresh run (first-run tutorial uses these)

    // ---- idle ----
    offlineCapSec: 4 * 3600,
    offlineRate: 1.0,        // share of online income earned while the app is closed
    offlineModalMinSec: 30,  // show the welcome-back popup only after this long away

    // ---- rewarded ----
    turboSeconds: 60,
    turboMult: 2,
    ads: {
      // simSeconds = fake ad length, cooldown = lock after the reward is granted
      turbo:   { simSeconds: 3, cooldown: 90 },
      freecar: { simSeconds: 3, cooldown: 45 },
      offline: { simSeconds: 3, cooldown: 0 }
    },

    // ---- tracks ----
    tracks: [
      { id: 'city',   cost: 0,    mult: 1.0 },
      { id: 'desert', cost: 4000, mult: 2.5 }
      // { id: 'mountain', cost: 250000, mult: 6 }  // theme drawn in render.js is not in the MVP
    ],

    // ---- prestige ----
    prestigeStarBase: 1,        // stars for reaching prestigeLevel
    prestigeStarPerLevel: 2,    // extra stars per level above prestigeLevel
    prestigeBonusPerStar: 0.35, // +35% income per star, permanent

    saveKey: 'mr_save_v1',
    autosaveSec: 5
  };
});
