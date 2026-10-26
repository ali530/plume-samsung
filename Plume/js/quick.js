/* The quick panel: the first icon at the top right of the home screen. Tiles for what you change often,
   and round buttons for shortcuts. Arrows move, OK changes, Back closes. No volume: the remote does that.
   Hold OK on one: Move (arrows, then OK) or Hide. Settings → Home screen → Quick panel brings hidden ones back. */
(function () {
  var Q = { at: 0, moving: null };
  var root = function () { return P.$('#quick'); };
  var get = function (k) { return P.S.get(k); };
  var set = function (k, v) { P.S.set(k, v); };
  var THEME = { auto: 'Automatic', light: 'Light', dark: 'Dark' };

  var ALL = {
    theme: { icon: 'theme', label: 'Theme', value: function () { return THEME[get('theme')]; },
      act: function () { var l = ['auto', 'light', 'dark']; set('theme', l[(l.indexOf(get('theme')) + 1) % 3]); P.Home.applyTheme(); } },
    clock: { icon: 'clock', label: 'Clock', value: function () { return get('clock24') ? '24-hour' : '12-hour'; },
      act: function () { set('clock24', !get('clock24')); P.Home.tick(); } },
    wall: { icon: 'mountain', label: 'Wallpaper', value: function () { return get('wpDaily') ? 'A different one each day' : P.Walls.name(P.Walls.chosen(P.Home.dark)); },
      act: function () { P.Walls.next(P.Home.dark, 1); P.Home.showWall(); P.Walls.preloadNext(P.Home.dark); } },
    sleep: { icon: 'sleep', label: 'Sleep screen', value: function () { return 'Start now'; },
      act: function () { Q.close(); P.Sleep.show(); }, leaves: true },
    alerts: { icon: 'bell', label: 'Match alerts', value: function () { return get('matchAlerts') ? 'On' : 'Off'; },
      act: function () { set('matchAlerts', !get('matchAlerts')); } },
    lang: { icon: 'lang', label: 'Language', value: function () { return get('lang') === 'ar' ? 'العربية' : 'English'; },
      act: function () { P.Settings.switchLanguage(); }, leaves: true },
    matchesRow: { round: true, icon: 'matchRow', label: 'Matches row', on: function () { return get('matchesRow'); },
      act: function () { set('matchesRow', !get('matchesRow')); } },
    refresh: { round: true, icon: 'refresh', label: 'Refresh',
      act: function () { P.Football.refresh(); P.Plex.refresh(); P.Weather.refresh(); P.UI.toast(P.t('Refreshing matches, Plex and weather…'), 2000); } },
    matches: { round: true, icon: 'ball', label: 'Matches', act: function () { Q.close(); P.Centre.open(); }, leaves: true },
    home: { round: true, icon: 'home', label: 'Samsung Home', act: function () { Q.close(); P.TV.hideSelf(); }, leaves: true },
    settings: { round: true, icon: 'gear', label: 'Settings', act: function () { Q.close(); P.Settings.open(); }, leaves: true }
  };
  Object.keys(ALL).forEach(function (k) { ALL[k].key = k; });
  var TILES = ['theme', 'clock', 'wall', 'sleep', 'alerts', 'lang'], ROUNDS = ['matchesRow', 'refresh', 'matches', 'home', 'settings'];
  Q.ALL = ALL;

  /* your order (new items from later versions go at the end), without the hidden ones */
  Q.order = function () {
    var o = get('quickOrder') || {}, fix = function (saved, all) {
      saved = (saved || []).filter(function (k) { return all.indexOf(k) >= 0; });
      return saved.concat(all.filter(function (k) { return saved.indexOf(k) < 0; }));
    };
    return { tiles: fix(o.tiles, TILES), rounds: fix(o.rounds, ROUNDS) };
  };
  function shown() {
    var o = Q.order(), hid = get('quickHidden') || [];
    var keep = function (k) { return hid.indexOf(k) < 0; };
    return { tiles: o.tiles.filter(keep), rounds: o.rounds.filter(keep) };
  }
  var list = [], NT = 0;

  Q.render = function () {
    var s = shown();
    NT = s.tiles.length;
    list = s.tiles.concat(s.rounds).map(function (k) { return ALL[k]; });
    if (Q.at >= list.length) Q.at = Math.max(0, list.length - 1);
    var tiles = '', rounds = '';
    list.forEach(function (it, i) {
      var mv = Q.moving === it.key ? ' moving' : '';
      if (it.round) rounds += '<button class="q-r' + (it.on && it.on() ? ' on' : '') + mv + '" data-i="' + i + '">' + P.icon(it.icon) + '</button>';
      else tiles += '<div class="q-t' + mv + '" data-i="' + i + '"><span class="q-i">' + P.icon(it.icon) + '</span><span class="q-l"><b>' + P.esc(P.t(it.label)) + '</b>' +
        '<small>' + P.esc(P.t(it.value())) + '</small></span></div>';
    });
    root().innerHTML = (NT ? '<div class="q-tiles">' + tiles + '</div>' : '') + (list.length > NT ? '<div class="q-rounds">' + rounds + '</div>' : '') +
      '<div class="q-cap" id="qCap"></div>';
    paint();
  };
  function paint() {
    P.$$('[data-i]', root()).forEach(function (e) { e.classList.toggle('focus', +e.dataset.i === Q.at); });
    var it = list[Q.at], cap = P.$('#qCap');
    if (!cap) return;
    if (Q.moving) cap.textContent = P.t('Use ◀ ▶ ▲ ▼ to move · OK when done');
    else cap.textContent = it && it.round ? P.t(it.label) + (it.on ? ' · ' + P.t(it.on() ? 'On' : 'Off') : '') : '';
  }

  /* tiles: two columns, 0…NT-1; round buttons: one row after them */
  function target(i, k) {
    var n = list.length;
    if (i < NT) {
      if (k === 'left' && i % 2) return i - 1;
      if (k === 'right' && !(i % 2) && i + 1 < NT) return i + 1;
      if (k === 'up' && i >= 2) return i - 2;
      if (k === 'down') return i + 2 < NT ? i + 2 : n > NT ? (i % 2 ? Math.max(NT, n - 2) : NT) : i;
      return i;
    }
    if (k === 'left' && i > NT) return i - 1;
    if (k === 'right' && i < n - 1) return i + 1;
    if (k === 'up' && NT) return NT % 2 ? NT - 1 : (i - NT) < (n - NT) / 2 ? NT - 2 : NT - 1;
    return i;
  }
  function move(k) { Q.at = target(Q.at, k); paint(); }

  /* moving one: it swaps places with its neighbour, inside its own group */
  function shift(k) {
    var it = list[Q.at], j = target(Q.at, k);
    if (j === Q.at || !list[j] || !!list[j].round !== !!it.round) return;
    var o = Q.order(), grp = it.round ? o.rounds : o.tiles;
    var a = grp.indexOf(it.key), b = grp.indexOf(list[j].key);
    grp[a] = list[j].key; grp[b] = it.key;
    set('quickOrder', o);
    Q.at = j; Q.render();
  }
  function hold() {
    var it = list[Q.at]; if (!it) return;
    var el = P.$('[data-i="' + Q.at + '"]', root());
    P.UI.menu(el, P.t(it.label), [
      { label: P.t('Move'), icon: 'move', act: function () { Q.moving = it.key; Q.render(); } },
      { label: P.t('Hide'), icon: 'eyeOff', act: function () {
        set('quickHidden', (get('quickHidden') || []).concat([it.key]));
        P.UI.toast(P.t('Hidden. Settings → Home screen → Quick panel brings it back'), 3000);
        Q.render();
      } }]);
  }

  var layer = {
    name: 'quick',
    key: function (k) {
      if (Q.moving) {
        if (k === 'ok' || k === 'back' || k === 'hold') { Q.moving = null; Q.render(); }
        else if (k === 'left' || k === 'right' || k === 'up' || k === 'down') shift(k);
        return;
      }
      if (k === 'back') { Q.close(); return; }
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') { move(k); return; }
      if (k === 'hold') { hold(); return; }
      if (k === 'ok') {
        var it = list[Q.at]; if (!it) return;
        it.act();
        if (!it.leaves && Q.isOpen()) Q.render();
      }
    },
    resume: function () { if (Q.isOpen()) Q.render(); }
  };

  Q.open = function () {
    Q.at = 0; Q.moving = null;
    root().hidden = false;
    requestAnimationFrame(function () { root().classList.add('on'); });
    document.body.classList.add('quick-on');
    P.UI.push(layer);
    Q.render();
    P.Walls.preloadNext(P.Home.dark);
  };
  Q.close = function () {
    if (!Q.isOpen()) return;
    Q.moving = null;
    root().classList.remove('on'); document.body.classList.remove('quick-on');
    setTimeout(function () { if (!root().classList.contains('on')) { root().hidden = true; root().innerHTML = ''; } }, 200);
    P.UI.pop(layer);
  };
  Q.isOpen = function () { return P.UI.layers.indexOf(layer) >= 0; };

  P.Quick = Q;
})();
