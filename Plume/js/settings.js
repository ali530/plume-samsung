/* Plume settings: full screen, groups on the right and a live preview of the focused one on the left,
   over the wallpaper, blurred. Worked entirely with the remote. */
(function () {
  var S = { page: 'main', at: 0, stack: [] };
  var root = function () { return P.$('#settings'); };
  var get = function (k) { return P.S.get(k); };
  var set = function (k, v) { P.S.set(k, v); };

  function cycle(key, values) {
    return function (dir) {
      var i = values.indexOf(get(key)); i = (i + (dir || 1) + values.length) % values.length; set(key, values[i]);
    };
  }
  var THEME = { auto: 'Automatic', light: 'Light', dark: 'Dark' };
  var NAMES = { focus: 'On focus', always: 'Always', never: 'Never' };
  var SLEEP = [1, 1.5, 2, 5, 10, 15, 30, 60, 0];
  var VERSION = '2.14.0';
  function sleepText() { var m = get('sleepMin'); return m ? P.t('after {n} min', { n: String(m).replace('.5', '½') }) : 'Never'; }
  function wallSummary() { return get('wpDaily') ? 'A different one each day' : P.Walls.name(P.Walls.current(P.Home.dark)); }
  /* the photos for one mode; the preview on the left shows the focused one on a small home screen */
  function wallPage(mode) {
    var key = mode === 'dark' ? 'wpDark' : 'wpLight';
    return { title: mode === 'dark' ? 'Dark mode wallpaper' : 'Light mode wallpaper', prev: 'wall:' + mode,
      note: get('wpDaily') ? 'A different mountain each day is on: choosing one here turns it off' : '',
      rows: P.Walls.list(mode).map(function (w) {
        return { label: w.name, sub: P.Walls.credit(w), radio: true, wall: w, toggle: function () { return get(key) === w.id; },
          act: function () { set(key, w.id); set('wpDaily', false); } };
      }) };
  }
  S.switchLanguage = function () {
    set('lang', get('lang') === 'ar' ? 'en' : 'ar');
    P.UI.toast(get('lang') === 'ar' ? 'العربية…' : 'English…', 1500);
    setTimeout(function () { location.reload(); }, 400);
  };

  function pages() {
    var plex = get('plex'), F = P.Football;
    return {
      main: { title: 'Settings', rows: [
        { label: 'Apps', prev: 'apps', value: function () { return P.t('{n} in the row', { n: P.Apps.row().length }); }, open: 'row' },
        { label: 'Inputs', prev: 'inputs', value: function () { return 'PS5 · beIN'; }, open: 'inputs' },
        { label: 'Home screen', prev: 'home', value: function () { return P.t(wallSummary()) + ' · ' + P.t(get('matchesRow') ? 'Matches row on' : 'Matches row off'); }, open: 'home' },
        { label: 'Sleep screen', prev: 'sleep', value: sleepText, open: 'sleep' },
        { label: 'Appearance', prev: 'look', value: function () { return THEME[get('theme')]; }, open: 'look' },
        { label: 'Language and Clock', prev: 'lang', value: function () { return (get('lang') === 'ar' ? 'العربية' : 'English') + ' · ' + P.t(get('clock24') ? '24-hour' : '12-hour'); }, open: 'lang' },
        { label: 'Weather', prev: 'weather', value: function () { return P.t(get('city')); }, open: 'city' },
        { label: 'Football', prev: 'football', value: function () { var n = get('favs').length; return n ? P.count(n, 'team', 'teams') : 'None'; }, open: 'football' },
        { label: 'Plex', prev: 'plex', value: function () { return plex ? plex.user : 'Sign in'; }, open: 'plex' },
        { label: 'About', prev: 'about', value: function () { return VERSION; }, open: 'about' }
      ] },

      inputs: { title: 'Inputs', prev: 'inputs', rows: [
        { label: 'PS5', value: function () { return 'HDMI ' + get('ps5Port'); }, act: cycle('ps5Port', [1, 2, 3, 4]) },
        { label: 'beIN', value: function () { return 'HDMI ' + get('beinPort'); }, act: cycle('beinPort', [1, 2, 3, 4]) },
        { label: 'Back to Plume when an app closes', toggle: function () { return get('returnToPlume'); },
          act: function () { set('returnToPlume', !get('returnToPlume')); }, note: 'Works only with apps that let the TV know they closed' }
      ] },

      home: { title: 'Home screen', prev: 'home', rows: [
        { section: 'Wallpaper' },
        { label: 'Light mode', value: function () { return P.Walls.name(P.Walls.byId(get('wpLight'))); }, open: 'wpLight', prev: 'wall:light' },
        { label: 'Dark mode', value: function () { return P.Walls.name(P.Walls.byId(get('wpDark'))); }, open: 'wpDark', prev: 'wall:dark' },
        { label: 'A different mountain each day', toggle: function () { return get('wpDaily'); }, act: function () { set('wpDaily', !get('wpDaily')); },
          note: 'Light and dark mode each go through their own photos, a new one every day' },
        { section: 'Rows' },
        { label: 'Matches row on home', toggle: function () { return get('matchesRow'); }, act: function () { set('matchesRow', !get('matchesRow')); } }
      ] },

      wpLight: wallPage('light'),
      wpDark: wallPage('dark'),

      sleep: { title: 'Sleep screen', prev: 'sleep', rows: [
        { label: 'Start after', value: sleepText, act: cycle('sleepMin', SLEEP) },
        { label: 'Preview the sleep screen', value: function () { return ''; }, act: function () { S.close(); P.Sleep.show(); } }
      ] },

      look: { title: 'Appearance', prev: 'look', rows: [
        { label: 'Theme', value: function () { return THEME[get('theme')]; }, act: cycle('theme', ['auto', 'light', 'dark']), note: 'Automatic turns dark at sunset' },
        { label: 'Logos', value: function () { return get('logos') === 'mono' ? 'Mono' : 'Colour'; }, act: cycle('logos', ['mono', 'colour']) },
        { label: 'App names', value: function () { return NAMES[get('names')]; }, act: cycle('names', ['focus', 'always', 'never']) }
      ] },

      lang: { title: 'Language and Clock', prev: 'lang', rows: [
        { label: 'Language', value: function () { return get('lang') === 'ar' ? 'العربية' : 'English'; }, act: function () { S.switchLanguage(); },
          note: 'Arabic turns the whole screen right to left. Plume restarts to change it' },
        { label: 'Clock', value: function () { return get('clock24') ? '24-hour' : '12-hour'; }, act: function () { set('clock24', !get('clock24')); } }
      ] },

      football: { title: 'Football', prev: 'football', rows: [
        { label: 'Your teams', value: function () { return get('favs').length ? get('favs').map(function (n) { return P.team({ name: n }); }).join(P.rtl ? '، ' : ', ') : 'None'; }, open: 'favs' },
        { label: 'Competitions', value: function () { var c = get('comps'); return P.t('{a} of {b}', { a: Object.keys(c).filter(function (k) { return c[k]; }).length, b: F.COMPS.length }); }, open: 'comps' },
        { label: 'Match alerts', value: function () { return get('matchAlerts') ? 'On' : 'Off'; }, open: 'alerts' },
        { label: 'Highlights play in', value: function () { return get('highlightsIn') === 'plume' ? 'Plume' : 'YouTube app'; }, act: function () { set('highlightsIn', get('highlightsIn') === 'plume' ? 'app' : 'plume'); } }
      ] },

      plex: { title: 'Plex', prev: 'plex', rows: [
        { label: 'Account', value: function () { return plex ? plex.user : 'Sign in'; }, act: function () { if (get('plex')) S.plexSignOut(); else S.plexSignIn(); } },
        plex ? { label: 'Default quality', value: function () { return { last: 'Last played', '4k': '4K', '1080': '1080p' }[get('plexCopy')]; }, act: cycle('plexCopy', ['last', '4k', '1080']) } : null,
        plex ? { label: 'Hidden', value: function () { var n = P.Plex.hiddenList().length; return n ? P.count(n, 'title', 'titles') : 'None'; }, open: 'hidden' } : null,
        plex ? { label: 'Subtitle style', value: function () { return get('subStyle') === 'plain' ? 'Simple' : 'Styled'; }, act: cycle('subStyle', ['file', 'plain']),
          note: 'Styled: ASS subtitles keep their own fonts, colours and places on screen. Simple: clear white lines' } : null,
        plex ? { label: 'Next episode', value: function () { return get('autoNext') ? 'Plays automatically' : 'Ask first'; }, act: function () { set('autoNext', !get('autoNext')); } } : null
      ].filter(Boolean) },

      about: { title: 'About', prev: 'about', rows: [
        { label: 'Plume for Samsung', value: function () { return P.t('Version {v}', { v: VERSION }); }, act: function () {} },
        { label: 'Wallpapers', value: function () { return 'Unsplash · Pexels'; }, act: function () {}, note: 'Free photos under the Unsplash and Pexels licences. The Rockies are inside Plume and work without internet' }
      ] },

      row: { title: 'Apps in row', prev: 'apps', rows: P.Apps.all().map(function (it) {
        return { label: P.Apps.label(it), toggle: function () { return get('row').indexOf(it.key) >= 0; },
          act: function () { var r = get('row'); set('row', r.indexOf(it.key) >= 0 ? r.filter(function (k) { return k !== it.key; }) : r.concat([it.key])); } };
      }) },

      comps: { title: 'Competitions', prev: 'football', rows: F.COMPS.map(function (c) {
        return { label: c.name, sub: c.mode === 'saudi' ? 'Matches with Saudi clubs' : c.mode === 'ksa' ? 'Saudi Arabia only' : '',
          toggle: function () { return get('comps')[c.k] !== false; },
          act: function () { var x = JSON.parse(JSON.stringify(get('comps'))); x[c.k] = !(x[c.k] !== false); set('comps', x); } };
      }) },

      alerts: { title: 'Match alerts', prev: 'football', note: 'Pop-ups over anything Plume shows, the PS5 and beIN included. To follow any match, even a live one: OK on it in Matches → Follow.', rows: [
        { label: 'Match alerts', toggle: function () { return get('matchAlerts'); }, act: function () { set('matchAlerts', !get('matchAlerts')); } },
        { section: 'When' }].concat(
        [['kickoff', 'Kick-off'], ['goal', 'Goals', 'With the scorer and minute'], ['red', 'Red cards'], ['ht', 'Half time', 'With the score'],
         ['sh', 'Second half starts'], ['ft', 'Full time'], ['pen', 'Penalty missed or saved', 'When ESPN reports it']].map(function (w) {
          return { label: w[1], sub: w[2] || '', toggle: function () { return !!get('alertWhat')[w[0]]; },
            act: function () { var x = JSON.parse(JSON.stringify(get('alertWhat'))); x[w[0]] = !x[w[0]]; set('alertWhat', x); } };
        }),
        [{ section: 'Which matches' }],
        [['mine', 'Your teams'], ['followed', 'Matches you follow or set a reminder for'], ['big', 'All big matches', 'The ones with a star: derbies, top of the table, big Champions League nights']].map(function (w) {
          return { label: w[1], sub: w[2] || '', toggle: function () { return !!get('alertWho')[w[0]]; },
            act: function () { var x = JSON.parse(JSON.stringify(get('alertWho'))); x[w[0]] = !x[w[0]]; set('alertWho', x); } };
        }),
        [{ label: 'Every match of…', value: function () { var c = get('alertComps'), n = Object.keys(c).filter(function (k) { return c[k]; });
            return n.length ? n.map(function (k) { return (F.byKey[k] || {}).short || k; }).join(P.rtl ? '، ' : ', ') : 'None'; }, open: 'alertComps' },
         { section: 'Where' },
         { label: 'Over films and shows in Plume', sub: 'Small, in the bottom corner. Off: they wait until you stop', toggle: function () { return get('alertOverFilms'); }, act: function () { set('alertOverFilms', !get('alertOverFilms')); } },
         { label: 'Show each alert for', value: function () { return P.t('{n} seconds', { n: get('alertSecs') }); }, act: cycle('alertSecs', [6, 10, 15]) }]) },

      alertComps: { title: 'Every match of…', note: 'Every match Plume shows for these competitions gives alerts, whoever plays. A busy day means many pop-ups.', rows: F.COMPS.map(function (c) {
        return { label: c.name, toggle: function () { return !!get('alertComps')[c.k]; },
          act: function () { var x = JSON.parse(JSON.stringify(get('alertComps'))); x[c.k] = !x[c.k]; set('alertComps', x); } };
      }) },

      favs: { title: 'Your teams', prev: 'football', note: 'Their matches always show, come first, and stay on the strip while live.', rows: F.teamChoices().map(function (n) {
        return { label: P.team({ name: n }), toggle: function () { return get('favs').indexOf(n) >= 0; },
          act: function () { var f = get('favs'); set('favs', f.indexOf(n) >= 0 ? f.filter(function (x) { return x !== n; }) : f.concat([n])); } };
      }) },

      city: { title: 'City', prev: 'weather', rows: P.Weather.cities.map(function (c) {
        return { label: P.t(c), toggle: function () { return get('city') === c; }, radio: true, act: function () { set('city', c); P.Weather.refresh(); } };
      }) },

      report: { title: 'Apps the TV reports', note: 'What the TV tells Plume about each app. "No icon" means the TV gives Plume no picture for it.',
        rows: (P.Apps.report || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (a) {
          return { label: a.name, sub: a.id + (a.icon ? ' · ' + a.icon.split('/').slice(-3).join('/') : ' · no icon path'), value: function () { return P.Apps.iconStatus(a.id); }, act: function () {} };
        }) },

      plexcheck: { title: 'Plex check', note: 'Plex apps your account can see as players, and what happened the last time you opened a Continue Watching card.',
        rows: [{ section: 'Players on your account' }].concat(
          P.Plex.playerList === undefined ? [{ label: 'Looking…', act: function () {} }]
          : P.Plex.playerList === null ? [{ label: "Couldn't reach plex.tv", sub: P.Plex.playerError || '', act: function () {} }]
          : P.Plex.playerList.length ? P.Plex.playerList.map(function (p) { return { label: p.name, sub: (p.product || '') + ' · ' + (p.platform || '') + (p.addr ? ' · ' + p.addr : ''), value: function () { return p.online ? 'Online' : 'Offline'; }, act: function () {} }; })
          : [{ label: 'None', sub: "Samsung's Plex app isn't showing itself as a player", act: function () {} }],
          [{ section: 'Last attempt' }],
          (get('plexLog') || []).length ? get('plexLog').map(function (l) { return { label: l, act: function () {} }; }) : [{ label: 'Open a Continue Watching card first', act: function () {} }]) },

      hidden: { title: 'Hidden', prev: 'plex', note: 'Shows and movies hidden from Continue Watching. OK brings one back.', rows: P.Plex.hiddenList().map(function (h) {
        return { label: h.title || 'Untitled', sub: h.kind === 'show' ? 'Show' : 'Movie', toggle: function () { return P.Plex.hiddenList().some(function (x) { return x.kind === h.kind && x.id === h.id; }); },
          act: function () { if (P.Plex.hiddenList().some(function (x) { return x.kind === h.kind && x.id === h.id; })) P.Plex.unhide(h); else { var l = P.S.get('plexHidden').slice(); l.push(h); P.S.set('plexHidden', l); P.Plex.refresh(); } } };
      }) },
      server: { title: 'Plex server', rows: ((plex && plex.servers) || []).map(function (n) {
        return { label: n, radio: true, toggle: function () { return ((get('plex') || {}).server || {}).name === n; },
          act: function () { P.UI.toast(P.t('Connecting to {name}…', { name: P.esc(n) })); P.Plex.useServer(n).then(function () { S.render(); }, function (e) { P.UI.toast(P.esc(e.message)); }); } };
      }) }
    };
  }

  S.render = function () {
    var pg = pages()[S.page];
    var rows = pg.rows;
    var html = '<div class="st-bg" id="sBg"></div><div class="st-prev" id="sPrev"></div><div class="st-main">' +
      '<div class="s-head">' + (S.page !== 'main' ? P.icon('back') : '') + '<h2>' + P.esc(P.t(pg.title)) + '</h2></div>' +
      (pg.note ? '<p class="s-note">' + P.esc(P.t(pg.note)) + '</p>' : '') + '<div class="s-list" id="sList">';
    var n = 0;
    rows.forEach(function (r) {
      if (r.section) { html += '<div class="s-sec">' + P.esc(P.t(r.section)) + '</div>'; return; }
      var val = r.toggle ? '<span class="sw' + (r.radio ? ' radio' : '') + (r.toggle() ? ' on' : '') + '"><i></i></span>' : '<span class="val">' + P.esc(P.t(r.value ? r.value() : '')) + (r.open ? (P.rtl ? ' ‹' : ' ›') : '') + '</span>';
      html += '<div class="s-row" data-r="' + (n++) + '"><span class="lab">' + P.esc(P.t(r.label)) + (r.sub ? '<small>' + P.esc(P.t(r.sub)) + '</small>' : '') + '</span>' + val + '</div>';
    });
    html += '</div><div class="s-foot" id="sFoot"></div></div>';
    root().innerHTML = html;
    lastPrev = '';
    var w = P.Home.wall || P.Walls.current(P.Home.dark);
    P.$('#sBg').style.backgroundImage = 'url("' + P.Walls.url(w, 640) + '"), url("' + P.Walls.url(P.Walls.fallback(w.mode)) + '")';
    paint();
  };
  function chosenIndex() {   // a list of choices opens on the chosen one
    var i = actionable().map(function (r) { return !!(r.radio && r.toggle()); }).indexOf(true);
    return i < 0 ? 0 : i;
  }
  function actionable() { return pages()[S.page].rows.filter(function (r) { return !r.section; }); }
  function paint() {
    var list = actionable();
    if (S.at >= list.length) S.at = list.length - 1;
    P.$$('.s-row', root()).forEach(function (e, i) { e.classList.toggle('focus', i === S.at); });
    var el = P.$('.s-row.focus', root()), box = P.$('#sList');
    if (el && box) {
      var top = el.offsetTop - box.offsetTop;
      if (top - box.scrollTop > box.clientHeight - el.offsetHeight - 30) box.scrollTop = top - box.clientHeight + el.offsetHeight + 30;
      if (top - box.scrollTop < 30) box.scrollTop = Math.max(0, top - 80);
    }
    var r = list[S.at];
    P.$('#sFoot').textContent = r && r.note ? P.t(r.note) : '';
    var h = previewHTML(r && r.prev || pages()[S.page].prev || 'home', r);
    if (h !== lastPrev) { lastPrev = h; P.$('#sPrev').innerHTML = h; }
  }

  /* ---------- the live preview on the left ---------- */
  var lastPrev = '';
  function cap(t, sub) { return '<div class="pv-cap">' + P.esc(P.t(t)) + (sub ? '<small>' + P.esc(sub) + '</small>' : '') + '</div>'; }
  function miniHome(w, dark, hi) {
    var d = new Date(), apps = P.Apps.row().slice(0, 8);
    return '<div class="pv-home ' + (dark ? 'dark' : 'light') + (hi ? ' hi-' + hi : '') + '"><img src="' + P.esc(P.Walls.url(w, 960)) + '" alt="" onerror="this.src=\'' + P.Walls.url(P.Walls.fallback(w.mode)) + '\'">' +
      '<div class="pv-clock">' + P.esc(P.clockText(d)) + '</div><div class="pv-date">' + P.esc(P.dateText(d)) + '</div>' +
      '<div class="pv-apps">' + apps.map(function (it, i) { return '<i class="' + (i === 0 ? 'f' : '') + '"><span>' + P.esc(P.Apps.label(it)) + '</span></i>'; }).join('') + '</div>' +
      (get('matchesRow') ? '<div class="pv-matches"><b></b><b></b><b></b><b></b><b></b></div>' : '') +
      '<div class="pv-cw"><b></b><b></b><b></b><b></b></div></div>';
  }
  function wallThumb(mode) {
    var w = get('wpDaily') ? P.Walls.current(mode === 'dark') : P.Walls.byId(get(mode === 'dark' ? 'wpDark' : 'wpLight')) || P.Walls.fallback(mode);
    var on = (mode === 'dark') === !!P.Home.dark;
    return '<div class="pv-th' + (on ? ' on' : '') + '"><img src="' + P.esc(P.Walls.url(w, 480)) + '" alt=""><span>' + P.esc(P.t(mode === 'dark' ? 'Dark mode' : 'Light mode')) + ' · ' + P.esc(P.Walls.name(w)) + '</span></div>';
  }
  function crestFor(name) {
    var F = P.Football, t = null;
    for (var o = -3; o <= 7 && !t; o++) {
      (F.day(o) || []).some(function (m) { if (m.home.name === name) t = m.home; else if (m.away.name === name) t = m.away; return !!t; });
    }
    return P.UI.crest(t || { abbr: name.replace(/[^A-Z]/g, '').slice(0, 3) || name.slice(0, 3), color: '#5b616b' }, 'lg');
  }
  function previewHTML(kind, r) {
    var dark = P.Home.dark, d = new Date();
    if (kind.indexOf('wall:') === 0) {
      var mode = kind.slice(5), w = r && r.wall;
      if (!w) w = get('wpDaily') ? P.Walls.current(mode === 'dark') : P.Walls.byId(get(mode === 'dark' ? 'wpDark' : 'wpLight')) || P.Walls.fallback(mode);
      return miniHome(w, mode === 'dark') + cap(P.Walls.name(w), P.t(P.Walls.credit(w)));
    }
    if (kind === 'home') return miniHome(P.Walls.current(dark), dark) + '<div class="pv-ths">' + wallThumb('light') + wallThumb('dark') + '</div>' + cap('Your home screen, as it is now');
    if (kind === 'apps') return miniHome(P.Walls.current(dark), dark, 'apps') + cap('Apps in row', P.count(P.Apps.row().length, 'app', 'apps'));
    if (kind === 'look') return miniHome(P.Walls.current(dark), dark) + cap(P.t('Theme') + ': ' + P.t(THEME[get('theme')]), P.t(get('logos') === 'mono' ? 'Mono' : 'Colour') + ' · ' + P.t(NAMES[get('names')]));
    if (kind === 'sleep') {
      return '<div class="pv-sleep"><img src="img/rockies-dusk.jpg" alt=""><div class="pv-zclock">' + P.esc(P.clockText(d)) + '</div><div class="pv-zdate">' + P.esc(P.dateText(d)) + '</div></div>' +
        cap(get('sleepMin') ? P.t('Starts {t} with nothing pressed', { t: sleepText() }) : 'Never starts by itself', P.t('Any button brings you back'));
    }
    if (kind === 'lang') {
      return '<div class="pv-big"><div class="pv-bclock">' + P.esc(P.clockText(d)) + '</div><div class="pv-bdate">' + P.esc(P.dateText(d)) + '</div></div>' +
        cap((get('lang') === 'ar' ? 'العربية' : 'English') + ' · ' + P.t(get('clock24') ? '24-hour' : '12-hour'));
    }
    if (kind === 'weather') return '<div class="pv-big"><div class="pv-bclock pv-w">' + P.Weather.html() + '</div></div>' + cap(get('city'), P.t('Open-Meteo, every 30 minutes'));
    if (kind === 'inputs') {
      return '<div class="pv-big pv-icons">' + P.icon('gamepad') + P.icon('settop') + '</div>' +
        cap('PS5 · HDMI ' + get('ps5Port') + '  ·  beIN · HDMI ' + get('beinPort'), P.t(get('returnToPlume') ? 'Back to Plume when an app closes' : 'Stays in the app when it closes'));
    }
    if (kind === 'football') {
      var favs = get('favs').slice(0, 3), nx = P.Football.next && P.Football.next();
      var c = get('comps'), on = Object.keys(c).filter(function (k) { return c[k]; }).length;
      return '<div class="pv-teams">' + (favs.length ? favs.map(function (n) { return '<div>' + crestFor(n) + '<span>' + P.esc(P.team({ name: n })) + '</span></div>'; }).join('') : '<div class="dim">' + P.esc(P.t('No teams chosen')) + '</div>') + '</div>' +
        (nx ? '<div class="pv-next"><b>' + P.esc(P.t('Next')) + ' · ' + P.esc(P.team(nx.home)) + ' – ' + P.esc(P.team(nx.away)) + '</b><small>' + P.esc(P.hhmm(new Date(nx.date))) + ' · ' + P.esc((P.Football.byKey[nx.comp] || {}).name || '') + '</small></div>' : '') +
        cap('Your teams', P.t('{a} competitions', { a: on }) + ' · ' + P.t(get('matchAlerts') ? 'alerts on' : 'alerts off'));
    }
    if (kind === 'plex') {
      var px = get('plex');
      return '<div class="pv-big pv-icons">' + P.icon('plex') + '</div>' +
        cap(px ? P.t('Signed in as {user}', { user: px.user }) : 'Not signed in', px ? ((px.server || {}).name || '') + ' · ' + P.t('Subtitles') + ': ' + P.t(get('subStyle') === 'plain' ? 'Simple' : 'Styled') : '');
    }
    if (kind === 'about') return '<div class="pv-big"><div class="pv-bclock">Plume</div><div class="pv-bdate">' + P.esc(P.t('Version {v}', { v: VERSION })) + '</div></div>' + cap('Made for the Samsung S90CA');
    return '';
  }

  var layer = {
    name: 'settings',
    key: function (k) {
      var list = actionable(), r = list[S.at];
      if (k === 'back') { if (S.stack.length) { var b = S.stack.pop(); S.page = b.page; S.at = b.at; S.render(); } else S.close(); return; }
      if (k === 'up') { S.at = Math.max(0, S.at - 1); paint(); return; }
      if (k === 'down') { S.at = Math.min(list.length - 1, S.at + 1); paint(); return; }
      if (!r) return;
      if (k === 'ok' || k === 'right' || k === 'left') {
        if (r.open) { if (k === 'left') return; S.stack.push({ page: S.page, at: S.at }); S.page = r.open; S.at = chosenIndex(); S.render(); if (r.onOpen) r.onOpen(); return; }
        if (r.act) { r.act(k === 'left' ? -1 : 1); S.render(); }
      }
    },
    resume: function () { S.render(); }
  };

  S.open = function (page) {
    S.page = 'main'; S.at = 0; S.stack = [];
    if (page && pages()[page]) { S.at = actionable().map(function (r) { return r.open; }).indexOf(page); S.stack.push({ page: 'main', at: Math.max(0, S.at) }); S.page = page; S.at = chosenIndex(); }
    root().hidden = false;
    requestAnimationFrame(function () { root().classList.add('on'); });
    document.body.classList.add('settings-on');
    P.UI.push(layer);
    S.render();
  };
  S.close = function () {
    root().classList.remove('on'); document.body.classList.remove('settings-on');
    setTimeout(function () { if (!root().classList.contains('on')) { root().hidden = true; root().innerHTML = ''; } }, 250);
    P.UI.pop(layer);
  };

  /* ---------- Plex sign-in ---------- */
  S.plexSignIn = function () {
    var d = P.UI.dialog({
      title: P.t('Connect Plex'), wide: true,
      body: '<div class="link"><div class="link-l"><p>' + P.t('On your phone or computer, go to') + '</p><div class="link-url">plex.tv/link</div><p>' + P.t('and enter this code:') + '</p>' +
        '<div class="link-code" id="plexCode">····</div><p class="dim" id="plexStatus">' + P.t('Getting a code…') + '</p></div><div class="link-r">' + P.UI.qr('https://plex.tv/link', 240) + '<p class="dim">' + P.t('Scan to open plex.tv/link') + '</p></div></div>',
      buttons: [{ label: P.t('Cancel'), act: function () { P.Plex.cancelLink(); } }],
      onClose: function () { P.Plex.cancelLink(); }
    });
    P.Plex.startLink(function (code) {
      var c = P.$('#plexCode'); if (c) c.textContent = code;
      var s = P.$('#plexStatus'); if (s) s.textContent = P.t('Waiting for you to enter the code…');
    }, function (user, server) {
      d.close();
      P.UI.toast(P.t('Signed in to Plex as {user}', { user: P.esc(user) }) + ' · ' + P.esc(server));
      if (S.isOpen()) S.render();
    }, function (msg) {
      var s = P.$('#plexStatus'); if (s) s.textContent = P.t(msg);
    });
  };
  S.plexSignOut = function () {
    P.UI.dialog({ title: P.t('Sign out of Plex?'), body: '<p>' + P.t('Continue Watching will be empty until you sign in again.') + '</p>',
      buttons: [{ label: P.t('Sign out'), act: function () { P.Plex.signOut(); S.render(); } }, { label: P.t('Cancel') }], start: 1 });
  };
  S.isOpen = function () { return !root().hidden; };

  P.Settings = S;
})();
