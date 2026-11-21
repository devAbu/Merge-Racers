// Merge Racers - rewarded-ad service. The ONLY place that knows how ads are shown.
//
// The game calls:
//   AdService.request('turbo', onReward)   -> starts an ad, calls onReward() once when the reward is earned
//   AdService.info('turbo')                -> { phase: 'ready'|'playing'|'cooldown', sec }  (for button labels)
//   AdService.update(now)                  -> call every frame
//
// Today the provider is a simulator (countdown on the button, then reward, then cooldown).
// To use real AdMob later, call AdService.setProvider({ show(placement, onReward, onFail) { ... } })
// with a function that shows a rewarded video and calls onReward() when the user earned it.
// Nothing else in the game needs to change.
(function (root) {
  'use strict';
  const CFG = root.CFG;
  const ph = {};   // placement -> { phase, end, cb }

  const simProvider = {
    simulated: true,
    show: function (placement, onReward, onFail, state) {
      state.end = Date.now() + CFG.ads[placement].simSeconds * 1000;
      state.sim = onReward;
    }
  };
  let provider = simProvider;

  function get(p) { return ph[p] || (ph[p] = { phase: 'ready', end: 0, cb: null, sim: null }); }

  function info(p, now) {
    const s = get(p);
    now = now || Date.now();
    if (s.phase === 'ready') return { phase: 'ready', sec: 0 };
    return { phase: s.phase, sec: s.end ? Math.max(0, Math.ceil((s.end - now) / 1000)) : 0 };
  }

  function request(p, onReward) {
    const s = get(p);
    if (s.phase !== 'ready') return false;
    s.phase = 'playing';
    s.cb = onReward;
    provider.show(p, function () { grant(p); }, function () { fail(p); }, s);
    return true;
  }

  function grant(p) {
    const s = get(p);
    if (s.phase !== 'playing') return;
    const cb = s.cb; s.cb = null; s.sim = null;
    const cd = CFG.ads[p].cooldown;
    if (cd > 0) { s.phase = 'cooldown'; s.end = Date.now() + cd * 1000; }
    else { s.phase = 'ready'; s.end = 0; }
    if (cb) cb();
  }
  function fail(p) {
    const s = get(p);
    s.phase = 'ready'; s.cb = null; s.sim = null; s.end = 0;
  }

  function update(now) {
    for (const p in ph) {
      const s = ph[p];
      if (s.phase === 'playing' && s.sim && now >= s.end) grant(p);
      else if (s.phase === 'cooldown' && now >= s.end) { s.phase = 'ready'; s.end = 0; }
    }
  }

  root.AdService = {
    request: request, info: info, update: update,
    isReady: function (p) { return get(p).phase === 'ready'; },
    isSimulated: function () { return !!provider.simulated; },
    setProvider: function (pr) { provider = pr; }
  };
})(typeof self !== 'undefined' ? self : this);
