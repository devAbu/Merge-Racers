// Merge Racers - ALL user-visible text lives here (English). Translate by copying this object.
// Placeholders: {n}, {s}, {t}, {name}, {p}
(function (root) {
  'use strict';
  const STR = {
    appName: 'Merge Racers',

    // main screen
    buy: 'Buy',
    perSec: '{n}/s',
    turbo: 'Turbo',
    freeCar: 'Free car',
    tracks: 'Tracks',
    prestige: 'Prestige',
    adCountdown: 'Ad {s}',
    wait: 'Wait {t}',
    max: 'MAX',
    garageFull: 'Garage is full!',
    notEnough: 'Not enough coins',
    newCar: 'New car!',
    turboOn: 'Turbo x2',

    // popups / menus
    close: 'Close',
    settings: 'Settings',
    music: 'Music',
    sfx: 'Sound effects',
    vibration: 'Vibration',
    on: 'ON',
    off: 'OFF',
    reset: 'Reset progress',
    resetConfirm: 'Tap again to erase everything',
    stats: 'Best car: Lv {n}   Best income: {p}/s   Prestiges: {t}',
    version: 'Merge Racers v1.0 (offline)',

    welcomeTitle: 'Welcome back!',
    welcomeBody: 'Your cars kept racing while you were away.',
    collect: 'Collect',
    collectX2: 'Collect x2',
    awayFor: 'Away for {t}',

    tracksTitle: 'Tracks',
    incomeMult: 'x{n} income',
    select: 'Select',
    selected: 'Selected',
    unlock: 'Unlock {n}',
    trackNames: { city: 'Downtown Loop', desert: 'Dune Run' },

    prestigeTitle: 'Prestige',
    prestigeBody: 'Reset your cars and coins. Keep your tracks and gain a permanent income bonus.',
    prestigeNow: 'Current bonus: +{p}%',
    prestigeGain: 'Prestige now: +{n} stars (+{p}%)',
    prestigeLocked: 'Reach car level {n} to unlock prestige.',
    prestigeButton: 'Prestige',
    prestigeConfirm: 'Tap again to confirm',
    stars: 'Stars: {n}',

    carNames: [
      '', 'Rustbucket', 'Hatchling', 'Cruiser', 'Roadster', 'Coupe', 'Sprinter', 'Rally Cat',
      'Drifter', 'Phantom', 'Thunder GT', 'Apex', 'Vortex', 'Comet', 'Nova', 'Hyper Ion'
    ],

    t: function (key, vars) {
      let s = STR[key];
      if (typeof s !== 'string') return key;
      if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
      return s;
    }
  };
  root.STR = STR;
})(typeof self !== 'undefined' ? self : this);
