/* The quick panel: the first icon at the top right of the home screen. Six tiles for what you change often,
   and round buttons for shortcuts. Arrows move, OK changes, Back closes. No volume: the remote does that. */
(function () {
  var Q = { at: 0 };
  var root = function () { return P.$('#quick'); };
  var get = function (k) { return P.S.get(k); };
  var set = function (k, v) { P.S.set(k, v); };
  var THEME = { auto: 'Automatic', light: 'Light', dark: 'Dark' };

  function items() {
    var dark = P.Home.dark;
    return [
      { icon: 'theme', label: 'Theme', value: function () { return THEME[get('theme')]; },
        act: function () { var l = ['auto', 'light', 'dark']; set('theme', l[(l.indexOf(get('theme')) + 1) % 3]); P.Home.applyTheme(); } },
      { icon: 'clock', label: 'Clock', value: function () { return get('clock24') ? '24-hour' : '12-hour'; },
        act: function () { set('clock24', !get('clock24')); P.Home.tick(); } },
      { icon: 'mountain', label: 'Wallpaper', value: function () { return get('wpDaily') ? 'A different one each day' : P.Walls.name(P.Walls.current(P.Home.dark)); },
        act: function () { P.Walls.next(P.Home.dark, 1); P.Home.showWall(); } },
      { icon: 'sleep', label: 'Sleep screen', value: function () { return 'Start now'; },
        act: function () { Q.close(); P.Sleep.show(); }, leaves: true },
      { icon: 'bell', label: 'Match alerts', value: function () { return get('matchAlerts') ? 'On' : 'Off'; },
        act: function () { set('matchAlerts', !get('matchAlerts')); } },
      { icon: 'lang', label: 'Language', value: function () { return get('lang') === 'ar' ? 'العربية' : 'English'; },
        act: function () { P.Settings.switchLanguage(); }, leaves: true },
      // round buttons
      { round: true, icon: 'rows', label: 'Matches row', on: function () { return get('matchesRow'); },
        act: function () { set('matchesRow', !get('matchesRow')); } },
      { round: true, icon: 'refresh', label: 'Refresh',
        act: function () { P.Football.refresh(); P.Plex.refresh(); P.Weather.refresh(); P.UI.toast(P.t('Refreshing matches, Plex and weather…'), 2000); } },
      { round: true, icon: 'ball', label: 'Matches', act: function () { Q.close(); P.Centre.open(); }, leaves: true },
      { round: true, icon: 'home', label: 'Samsung Home', act: function () { Q.close(); P.TV.hideSelf(); }, leaves: true },
      { round: true, icon: 'gear', label: 'Settings', act: function () { Q.close(); P.Settings.open(); }, leaves: true }
    ];
  }
  var list = [];

  Q.render = function () {
    list = items();
    var tiles = '', rounds = '';
    list.forEach(function (it, i) {
      if (it.round) rounds += '<button class="q-r' + (it.on && it.on() ? ' on' : '') + '" data-i="' + i + '">' + P.icon(it.icon) + '</button>';
      else tiles += '<div class="q-t" data-i="' + i + '"><span class="q-i">' + P.icon(it.icon) + '</span><span class="q-l"><b>' + P.esc(P.t(it.label)) + '</b>' +
        '<small>' + P.esc(P.t(it.value())) + '</small></span></div>';
    });
    root().innerHTML = '<div class="q-tiles">' + tiles + '</div><div class="q-rounds">' + rounds + '</div><div class="q-cap" id="qCap"></div>';
    paint();
  };
  function paint() {
    P.$$('[data-i]', root()).forEach(function (e) { e.classList.toggle('focus', +e.dataset.i === Q.at); });
    var it = list[Q.at], cap = P.$('#qCap');
    if (cap) cap.textContent = it && it.round ? P.t(it.label) + (it.on ? ' · ' + P.t(it.on() ? 'On' : 'Off') : '') : '';
  }

  /* tiles: two columns, 0–5; round buttons: one row, 6–10 */
  var NT = 6;
  function move(k) {
    var i = Q.at, n = list.length;
    if (i < NT) {
      if (k === 'left' && i % 2) i--;
      else if (k === 'right' && !(i % 2) && i + 1 < NT) i++;
      else if (k === 'up' && i >= 2) i -= 2;
      else if (k === 'down') i = i + 2 < NT ? i + 2 : (i % 2 ? n - 2 : NT);
    } else {
      if (k === 'left' && i > NT) i--;
      else if (k === 'right' && i < n - 1) i++;
      else if (k === 'up') i = i - NT < 2 ? NT - 2 : NT - 1;
    }
    Q.at = i; paint();
  }

  var layer = {
    name: 'quick',
    key: function (k) {
      if (k === 'back') { Q.close(); return; }
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') { move(k); return; }
      if (k === 'ok') {
        var it = list[Q.at]; if (!it) return;
        it.act();
        if (!it.leaves && Q.isOpen()) Q.render();
      }
    },
    resume: function () { if (Q.isOpen()) Q.render(); }
  };

  Q.open = function () {
    Q.at = 0;
    root().hidden = false;
    requestAnimationFrame(function () { root().classList.add('on'); });
    document.body.classList.add('quick-on');
    P.UI.push(layer);
    Q.render();
  };
  Q.close = function () {
    if (!Q.isOpen()) return;
    root().classList.remove('on'); document.body.classList.remove('quick-on');
    setTimeout(function () { if (!root().classList.contains('on')) { root().hidden = true; root().innerHTML = ''; } }, 200);
    P.UI.pop(layer);
  };
  Q.isOpen = function () { return P.UI.layers.indexOf(layer) >= 0; };

  P.Quick = Q;
})();
