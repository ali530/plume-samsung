/* Plume settings: a panel on the right, worked entirely with the remote. */
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

  function pages() {
    var plex = get('plex'), F = P.Football;
    return {
      main: { title: 'Settings', rows: [
        { section: 'Look' },
        { label: 'Theme', value: function () { return THEME[get('theme')]; }, act: cycle('theme', ['auto', 'light', 'dark']), note: 'Automatic turns dark at sunset' },
        { label: 'Light mode wallpaper', value: function () { return P.Home.WALL_NAMES[get('wpLight')]; }, act: cycle('wpLight', ['rockies-day', 'plain']) },
        { label: 'Dark mode wallpaper', value: function () { return P.Home.WALL_NAMES[get('wpDark')]; }, act: cycle('wpDark', ['rockies-dusk', 'plain']) },
        { label: 'Logos', value: function () { return get('logos') === 'mono' ? 'Mono' : 'Colour'; }, act: cycle('logos', ['mono', 'colour']) },
        { label: 'App names', value: function () { return NAMES[get('names')]; }, act: cycle('names', ['focus', 'always', 'never']) },
        { section: 'Home screen' },
        { label: 'Apps in row', value: function () { return P.Apps.row().length + ' apps'; }, open: 'row' },
        { label: 'Rearrange the row', value: function () { return 'Hold OK on a tile'; }, act: function () { S.close(); P.Home.focus('apps'); P.UI.toast('Hold OK on a tile, then choose Move'); } },
        { label: 'Matches row on home', value: function () { return get('matchesRow') ? 'On' : 'Off'; }, act: function () { set('matchesRow', !get('matchesRow')); }, toggle: function () { return get('matchesRow'); } },
        { section: 'Plex' },
        { label: 'Account', value: function () { return plex ? plex.user : 'Sign in'; }, act: function () { if (get('plex')) S.plexSignOut(); else S.plexSignIn(); } },
        plex ? { label: 'Default quality', value: function () { return { last: 'Last played', '4k': '4K', '1080': '1080p' }[get('plexCopy')]; }, act: cycle('plexCopy', ['last', '4k', '1080']) } : null,
        plex ? { label: 'Hidden', value: function () { var n = P.Plex.hiddenList().length; return n ? n + (n === 1 ? ' title' : ' titles') : 'None'; }, open: 'hidden' } : null,
        plex ? { label: 'Next episode', value: function () { return get('autoNext') ? 'Plays automatically' : 'Ask first'; }, act: function () { set('autoNext', !get('autoNext')); } } : null,
        { section: 'Football' },
        { label: 'Competitions', value: function () { var c = get('comps'); return Object.keys(c).filter(function (k) { return c[k]; }).length + ' of ' + F.COMPS.length; }, open: 'comps' },
        { label: 'Match alerts', value: function () { return ''; }, toggle: function () { return get('matchAlerts'); }, act: function () { set('matchAlerts', !get('matchAlerts')); }, note: "Kick-off, goals and full time of your teams' matches and the ones you set a reminder for, also over the PS5 and beIN" },
        { label: 'Your teams', value: function () { return get('favs').length ? get('favs').join(', ') : 'None'; }, open: 'favs' },
        { section: 'Inputs' },
        { label: 'PS5', value: function () { return 'HDMI ' + get('ps5Port'); }, act: cycle('ps5Port', [1, 2, 3, 4]) },
        { label: 'beIN', value: function () { return 'HDMI ' + get('beinPort'); }, act: cycle('beinPort', [1, 2, 3, 4]) },
        { label: 'Back to Plume when an app closes', value: function () { return ''; }, toggle: function () { return get('returnToPlume'); },
          act: function () { set('returnToPlume', !get('returnToPlume')); }, note: 'Works only with apps that let the TV know they closed' },
        { section: 'Sleep screen' },
        { label: 'Start after', value: function () { var m = get('sleepMin'); return m ? String(m).replace('.5', '½') + ' min' : 'Never'; }, act: cycle('sleepMin', SLEEP) },
        { label: 'Preview the sleep screen', value: function () { return ''; }, act: function () { S.close(); P.Sleep.show(); } },
        { section: 'Weather' },
        { label: 'City', value: function () { return get('city'); }, open: 'city' },
        { section: 'About' },
        { label: 'Plume for Samsung', value: function () { return 'Version 2.4'; }, act: function () {} }
      ].filter(Boolean) },

      row: { title: 'Apps in row', rows: P.Apps.all().map(function (it) {
        return { label: P.Apps.label(it), toggle: function () { return get('row').indexOf(it.key) >= 0; },
          act: function () { var r = get('row'); set('row', r.indexOf(it.key) >= 0 ? r.filter(function (k) { return k !== it.key; }) : r.concat([it.key])); } };
      }) },

      comps: { title: 'Competitions', rows: F.COMPS.map(function (c) {
        return { label: c.name, sub: c.mode === 'saudi' ? 'Matches with Saudi clubs' : c.mode === 'ksa' ? 'Saudi Arabia only' : '',
          toggle: function () { return get('comps')[c.k] !== false; },
          act: function () { var x = JSON.parse(JSON.stringify(get('comps'))); x[c.k] = !(x[c.k] !== false); set('comps', x); } };
      }) },

      favs: { title: 'Your teams', note: 'Their matches always show, come first, and stay on the strip while live.', rows: F.teamChoices().map(function (n) {
        return { label: n, toggle: function () { return get('favs').indexOf(n) >= 0; },
          act: function () { var f = get('favs'); set('favs', f.indexOf(n) >= 0 ? f.filter(function (x) { return x !== n; }) : f.concat([n])); } };
      }) },

      city: { title: 'City', rows: P.Weather.cities.map(function (c) {
        return { label: c, toggle: function () { return get('city') === c; }, radio: true, act: function () { set('city', c); P.Weather.refresh(); } };
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

      hidden: { title: 'Hidden', note: 'Shows and movies hidden from Continue Watching. OK brings one back.', rows: P.Plex.hiddenList().map(function (h) {
        return { label: h.title || 'Untitled', sub: h.kind === 'show' ? 'Show' : 'Movie', toggle: function () { return P.Plex.hiddenList().some(function (x) { return x.kind === h.kind && x.id === h.id; }); },
          act: function () { if (P.Plex.hiddenList().some(function (x) { return x.kind === h.kind && x.id === h.id; })) P.Plex.unhide(h); else { var l = P.S.get('plexHidden').slice(); l.push(h); P.S.set('plexHidden', l); P.Plex.refresh(); } } };
      }) },
      server: { title: 'Plex server', rows: ((plex && plex.servers) || []).map(function (n) {
        return { label: n, radio: true, toggle: function () { return ((get('plex') || {}).server || {}).name === n; },
          act: function () { P.UI.toast('Connecting to ' + P.esc(n) + '…'); P.Plex.useServer(n).then(function () { S.render(); }, function (e) { P.UI.toast(P.esc(e.message)); }); } };
      }) }
    };
  }

  S.render = function () {
    var pg = pages()[S.page];
    var rows = pg.rows;
    var html = '<div class="s-head">' + (S.page !== 'main' ? P.icon('back') : '') + '<h2>' + P.esc(pg.title) + '</h2></div>' +
      (pg.note ? '<p class="s-note">' + P.esc(pg.note) + '</p>' : '') + '<div class="s-list" id="sList">';
    var n = 0;
    rows.forEach(function (r) {
      if (r.section) { html += '<div class="s-sec">' + P.esc(r.section) + '</div>'; return; }
      var val = r.toggle ? '<span class="sw' + (r.radio ? ' radio' : '') + (r.toggle() ? ' on' : '') + '"><i></i></span>' : '<span class="val">' + P.esc(r.value ? r.value() : '') + (r.open ? ' ›' : '') + '</span>';
      html += '<div class="s-row" data-r="' + (n++) + '"><span class="lab">' + P.esc(r.label) + (r.sub ? '<small>' + P.esc(r.sub) + '</small>' : '') + '</span>' + val + '</div>';
    });
    html += '</div><div class="s-foot" id="sFoot"></div>';
    root().innerHTML = html;
    paint();
  };
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
    P.$('#sFoot').textContent = r && r.note ? r.note : '';
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
        if (r.open) { if (k === 'left') return; S.stack.push({ page: S.page, at: S.at }); S.page = r.open; S.at = 0; S.render(); if (r.onOpen) r.onOpen(); return; }
        if (r.act) { r.act(k === 'left' ? -1 : 1); S.render(); }
      }
    },
    resume: function () { S.render(); }
  };

  S.open = function (page) {
    S.page = 'main'; S.at = 0; S.stack = [];
    if (page === 'inputs') { S.at = actionable().map(function (r) { return r.label; }).indexOf('PS5'); }
    root().hidden = false;
    requestAnimationFrame(function () { root().classList.add('on'); });
    document.body.classList.add('panel-on');
    P.UI.push(layer);
    S.render();
  };
  S.close = function () {
    root().classList.remove('on'); document.body.classList.remove('panel-on');
    setTimeout(function () { if (!root().classList.contains('on')) { root().hidden = true; root().innerHTML = ''; } }, 250);
    P.UI.pop(layer);
  };

  /* ---------- Plex sign-in ---------- */
  S.plexSignIn = function () {
    var d = P.UI.dialog({
      title: 'Connect Plex', wide: true,
      body: '<div class="link"><div class="link-l"><p>On your phone or computer, go to</p><div class="link-url">plex.tv/link</div><p>and enter this code:</p>' +
        '<div class="link-code" id="plexCode">····</div><p class="dim" id="plexStatus">Getting a code…</p></div><div class="link-r">' + P.UI.qr('https://plex.tv/link', 240) + '<p class="dim">Scan to open plex.tv/link</p></div></div>',
      buttons: [{ label: 'Cancel', act: function () { P.Plex.cancelLink(); } }],
      onClose: function () { P.Plex.cancelLink(); }
    });
    P.Plex.startLink(function (code) {
      var c = P.$('#plexCode'); if (c) c.textContent = code;
      var s = P.$('#plexStatus'); if (s) s.textContent = 'Waiting for you to enter the code…';
    }, function (user, server) {
      d.close();
      P.UI.toast('Signed in to Plex as ' + P.esc(user) + ' · ' + P.esc(server));
      if (S.isOpen()) S.render();
    }, function (msg) {
      var s = P.$('#plexStatus'); if (s) s.textContent = msg;
    });
  };
  S.plexSignOut = function () {
    P.UI.dialog({ title: 'Sign out of Plex?', body: '<p>Continue Watching will be empty until you sign in again.</p>',
      buttons: [{ label: 'Sign out', act: function () { P.Plex.signOut(); S.render(); } }, { label: 'Cancel' }], start: 1 });
  };
  S.isOpen = function () { return !root().hidden; };

  P.Settings = S;
})();
