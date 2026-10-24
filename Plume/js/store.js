/* Settings, saved on the TV (localStorage). Every value here can be changed from Plume's settings panel. */
(function () {
  var PREFIX = 'plume.';
  var DEFAULTS = {
    theme: 'auto',                 // auto | light | dark   (auto: dark from sunset to sunrise)
    wpLight: 'rockies-day',
    wpDark: 'rockies-dusk',
    logos: 'mono',                 // mono | colour
    names: 'focus',                // focus | always | never
    row: ['hdmi:ps5', 'hdmi:bein', 'app:plex', 'matches', 'app:youtube', 'app:netflix', 'app:shahid', 'app:appletv'],
    matchesRow: false,             // layout A's "Today's matches" row on the home screen
    comps: { spl: true, kc: true, acle: true, acl2: true, cwc: true, wcq: true, wc: true, asian: true, gulf: true, friendly: true, ucl: true, epl: true, liga: true },
    euBigOnly: true,
    favs: ['Al Hilal', 'Saudi Arabia', 'Manchester United'],
    ps5Port: 1,
    beinPort: 2,
    sleepMin: 1.5,                 // 0 = never. Before Samsung's own OLED protection screen (2 min on the S90CA)
    city: 'Riyadh',
    returnToPlume: true,
    plexCopy: 'last',              // which version plays: last (the one you played last) | 4k | 1080 (same language only)
    plexPicks: {},
    subOffsets: {},                // subtitle timing you set, per episode/film and subtitle (ms)
    folded: {},                    // rows folded away on the home screen: {cw: true, matches: true}
    highlightsIn: 'plume',         // where highlights play: plume (in Plume) | app (the YouTube app: your account, no ads)
    matchAlerts: true,             // kick-off, goals and full time of your teams' matches and reminded ones
    alertWhat: { kickoff: true, goal: true, red: true, ht: false, sh: false, ft: true, pen: false },   // which alerts
    alertWho: { mine: true, followed: true, big: false },   // which matches: your teams, followed/reminded, big matches
    alertComps: {},                // every match of these competitions alerts: {epl: true}
    alertOverFilms: false,         // a small alert in the corner over Plume's players (else they wait)
    alertSecs: 10,
    follows: [],                   // matches you follow: [{id, at}]
    autoNext: true,                // play the next episode after the countdown
    plex: null,                    // {token, user, server:{name, uri, token}}
    plexHidden: [],
    reminders: [],                 // [{id, at, title}]
    clientId: null
  };

  var cache = {};
  function load(k) {
    if (k in cache) return cache[k];
    var v;
    try { var raw = localStorage.getItem(PREFIX + k); v = raw == null ? undefined : JSON.parse(raw); } catch (e) { v = undefined; }
    if (v === undefined) v = JSON.parse(JSON.stringify(DEFAULTS[k] === undefined ? null : DEFAULTS[k]));
    // new competitions added in later versions start switched on
    if (k === 'comps' && v) Object.keys(DEFAULTS.comps).forEach(function (c) { if (!(c in v)) v[c] = true; });
    cache[k] = v;
    return v;
  }
  function save(k, v) {
    cache[k] = v;
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {}
    P.bus.emit('setting', k);
    P.bus.emit('setting:' + k, v);
  }

  P.S = {
    get: load,
    set: save,
    reset: function (k) { delete cache[k]; try { localStorage.removeItem(PREFIX + k); } catch (e) {} P.bus.emit('setting', k); },
    defaults: DEFAULTS
  };

  // 1.1: sleep screen at 2 minutes (before the S90CA's own screensaver)
  try {
    if (!localStorage.getItem(PREFIX + 'v11')) {
      localStorage.setItem(PREFIX + 'v11', '1');
      if (load('sleepMin') === 10) save('sleepMin', 2);
    }
  } catch (e) {}

  // 1.7: Samsung's protection screen comes at 2 minutes, so Plume's sleep screen starts at 1½
  try {
    if (!localStorage.getItem(PREFIX + 'v17')) {
      localStorage.setItem(PREFIX + 'v17', '1');
      if (load('sleepMin') === 2) save('sleepMin', 1.5);
    }
  } catch (e) {}

  if (!load('clientId')) {
    save('clientId', 'plume-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  }
})();
