/* The home screen: clock, match strip, apps row, optional matches row, Plex Continue Watching. */
(function () {
  var H = { row: 'apps', key: null, editing: null, dark: false };
  var WALLS = { 'rockies-day': 'img/rockies-day.jpg', 'rockies-dusk': 'img/rockies-dusk.jpg', 'plain': '' };
  H.WALL_NAMES = { 'rockies-day': 'Rockies (day)', 'rockies-dusk': 'Rockies (dusk)', 'plain': 'Plain' };

  /* ---------- theme and wallpaper ---------- */
  H.applyTheme = function () {
    var t = P.S.get('theme');
    var dark = t === 'dark' || (t === 'auto' && P.Weather.isNight());
    var changed = dark !== H.dark || !document.body.classList.contains(dark ? 'dark' : 'light');
    H.dark = dark;
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light', !dark);
    var src = WALLS[P.S.get(dark ? 'wpDark' : 'wpLight')];
    var img = P.$('#wallImg');
    if (src === '') { img.removeAttribute('src'); img.style.opacity = 0; }
    else if (img.getAttribute('src') !== src) { img.style.opacity = 0; img.onload = function () { img.style.opacity = 1; }; img.src = src; }
    else img.style.opacity = 1;
    if (changed) H.renderApps();
  };

  /* ---------- clock, date, weather ---------- */
  H.busyElsewhere = function () {
    var c = document.body.classList;
    return document.hidden || P.Sleep.active || c.contains('playing') || c.contains('centre-on') || c.contains('overlay-on') || c.contains('input-on');
  };
  H.tick = function () {
    if (document.hidden) return;
    var d = new Date();
    P.$('#clock').textContent = P.clockText(d);
    P.$('#date').textContent = P.dateText(d);
    P.$('#weather').innerHTML = P.Weather.html();
    P.$('#net').innerHTML = P.icon(P.TV.online() ? 'wifi' : 'wifiOff');
    P.$('#net').classList.toggle('off', !P.TV.online());
  };

  /* ---------- the match strip under the date ---------- */
  var stripAt = 0, stripT = null, stripMatch = null;
  H.renderStrip = function () {
    var el = P.$('#strip'), F = P.Football;
    var live = F.live(), m = null, html = '', counter = '';
    if (live.length) {
      var favs = live.filter(function (x) { return x.fav; });
      var pool = favs.length ? favs : live;           // a live match of your team stays on screen
      if (stripAt >= pool.length) stripAt = 0;
      m = pool[stripAt];
      if (live.length > 1) counter = '<span class="count">' + (live.indexOf(m) + 1) + '/' + live.length + '</span>';
      html = '<span class="live"><i class="dot"></i>' + P.esc(F.statusText(m)) + '</span>' +
        P.UI.crest(m.home, 'sm') + '<span class="tn">' + P.esc(m.home.short) + '</span><b class="sc">' + F.centreText(m) + '</b>' +
        '<span class="tn">' + P.esc(m.away.short) + '</span>' + P.UI.crest(m.away, 'sm') +
        '<span class="sub">· ' + P.esc(m.compShort) + '</span>' + counter;
    } else {
      m = F.next();
      if (m) {
        var tag = m.tag && m.tag !== 'Your team' ? m.tag + ' · ' : '';
        html = '<span class="nx">' + P.icon(F.hasReminder(m) ? 'bell' : 'star') + '</span><span class="sub">' + P.esc(tag) + '</span>' +
          P.UI.crest(m.home, 'sm') + '<span class="tn">' + P.esc(m.home.short) + '</span><span class="vs">vs</span><span class="tn">' + P.esc(m.away.short) + '</span>' + P.UI.crest(m.away, 'sm') +
          '<span class="sub">· ' + P.hhmm(m.date) + ' · in ' + P.until(m.date - Date.now()) + '</span>';
      }
    }
    stripMatch = m;
    if (!m) {
      el.hidden = true; el.innerHTML = '';
      if (H.row === 'strip') H.focus('apps');
      return;
    }
    el.hidden = false;
    el.dataset.key = 'strip';
    if (el.innerHTML !== html) el.innerHTML = html;
    H.paintFocus();
  };
  function rotateStrip() {
    if (H.busyElsewhere()) return;
    if (H.row === 'strip') return; // hold still while you look at it
    stripAt++;
    H.renderStrip();
  }

  /* ---------- apps row ---------- */
  H.renderApps = function () {
    var row = P.$('#appRow'), A = P.Apps, colour = P.S.get('logos') === 'colour', names = P.S.get('names');
    var items = A.row();
    row.classList.toggle('named', names === 'always');
    row.innerHTML = '<div class="track">' + items.map(function (it) {
      return '<div class="tile app kind-' + it.kind + '" data-key="' + it.key + '"><div class="logo">' + A.logoHTML(it, H.dark, colour) + '</div>' +
        (names === 'always' ? '<div class="name">' + P.esc(it.name) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    H.paintFocus();
  };

  /* ---------- optional matches row ---------- */
  H.renderMatchesRow = function () {
    var sec = P.$('#matchSec'), F = P.Football;
    var list = P.S.get('matchesRow') ? F.day(0) : [];
    sec.hidden = !list.length;
    document.body.classList.toggle('with-matches', !!list.length);
    if (!list.length) { if (H.row === 'matches' || H.row === 'matchesH') H.focus('apps'); return; }
    var live = list.filter(function (m) { return m.state === 'in'; }).length;
    P.$('#matchCount').textContent = list.length + (live ? ' · ' + live + ' live now' : '');
    var mr = P.$('#matchRow'), html = '<div class="track">' + list.map(function (m) { return H.matchCard(m); }).join('') + '</div>';
    if (mr._html !== html) { mr._html = html; mr.innerHTML = html; }
    H.paintFocus();
  };
  H.matchCard = function (m) {
    var F = P.Football, st = F.statusText(m);
    var status = m.state === 'in' ? '<span class="live"><i class="dot"></i>' + P.esc(st) + '</span>'
      : m.state === 'post' ? '<span>' + P.esc(st) + '</span>'
      : (m.tag ? '<span class="tag">' + P.icon(F.hasReminder(m) ? 'bell' : 'star') + P.esc(m.tag) + '</span>' : (F.hasReminder(m) ? '<span class="tag">' + P.icon('bell') + '</span>' : ''));
    var line = function (t, score) {
      return '<div class="mt' + (P.Football.isFavName(t.name) ? ' me' : '') + '">' + P.UI.crest(t, 'sm') + '<span class="tn">' + P.esc(t.short) + '</span>' + (m.state === 'pre' ? '' : '<b>' + P.esc(score || '0') + '</b>') + '</div>';
    };
    return '<div class="mcard' + (m.fav ? ' fav' : '') + '" data-key="m:' + m.id + '"><div class="mtop"><span class="comp">' + P.esc(m.compName) + '</span>' + status + '</div>' +
      '<div class="mbody"><div class="mteams">' + line(m.home, m.home.score) + line(m.away, m.away.score) + '</div>' +
      (m.state === 'pre' ? '<div class="ko">' + F.centreText(m) + '</div>' : '') + '</div></div>';
  };

  /* ---------- Continue Watching ---------- */
  H.renderCW = function () {
    var X = P.Plex, sec = P.$('#cwSec'), row = P.$('#cwRow'), html = '';
    if (X.state !== 'in') {
      html = '<div class="cwcard note" data-key="cw:connect"><div class="poster">' + '<div class="note-in">' + P.icon('play') +
        '<b>Connect Plex</b><span>See what you were watching</span></div></div></div>';
    } else if (!X.items.length && X.error) {
      html = '<div class="cwcard note" data-key="cw:retry"><div class="poster"><div class="note-in"><b>Plex server not reachable</b><span>Press OK to try again</span></div></div></div>';
    } else {
      html = X.items.map(function (c) {
        return '<div class="cwcard" data-key="cw:' + P.esc(c.key) + '"><div class="poster">' + (c.image ? '<img src="' + P.esc(c.image) + '" alt="" decoding="async" onload="this.classList.add(\'ok\')">' : '') + '</div>' +
          '<div class="bar' + (c.progress > 0 ? '' : ' none') + '"><i style="width:' + Math.round(c.progress * 100) + '%"></i></div>' +
          '<div class="t">' + P.esc(c.title) + '</div><div class="s">' + P.icon('play') + P.esc(c.sub) + '</div></div>';
      }).join('');
    }
    sec.hidden = !html;
    if (html) html = '<div class="track">' + html + '</div>';
    if (row._html !== html) { row._html = html; row.innerHTML = html; }
    if (!html && (H.row === 'cw' || H.row === 'cwH')) H.focus('apps');
    H.paintFocus();
  };

  /* ---------- focus ---------- */
  function rowEl(r) {
    return { icons: P.$('#icons'), strip: P.$('#home .when'), apps: P.$('#appRow'), matches: P.$('#matchRow'), cw: P.$('#cwRow') }[r];
  }
  function folded(r) { return !!(P.S.get('folded') || {})[r]; }
  /* OK on a row's title folds the row away or opens it again; Plume remembers it */
  H.applyFolds = function () {
    ['matches', 'cw'].forEach(function (r) { P.$(r === 'cw' ? '#cwSec' : '#matchSec').classList.toggle('folded', folded(r)); });
  };
  H.toggleFold = function (r) {
    var f = Object.assign({}, P.S.get('folded') || {}); f[r] = !f[r];
    P.S.set('folded', f);
    H.applyFolds();
    H.focus(r + 'H');
  };
  function itemsOf(r) {
    if (r === 'strip') return P.$('#strip').hidden ? [] : [P.$('#strip')];
    if (r === 'matchesH') return P.$('#matchSec').hidden ? [] : [P.$('#matchHead')];
    if (r === 'cwH') return P.$('#cwSec').hidden ? [] : [P.$('#cwHead')];
    if (r === 'matches' && (P.$('#matchSec').hidden || folded('matches'))) return [];
    if (r === 'cw' && (P.$('#cwSec').hidden || folded('cw'))) return [];
    return P.$$('[data-key]', rowEl(r)).filter(function (e) { return !e.hidden; });
  }
  var ROWS = ['icons', 'strip', 'apps', 'matchesH', 'matches', 'cwH', 'cw'];
  H.current = function () {
    var list = itemsOf(H.row);
    return list.filter(function (e) { return e.dataset.key === H.key; })[0] || list[0] || null;
  };
  H.focus = function (row, key) {
    H.row = row;
    var list = itemsOf(row);
    H.key = key || (list[0] && list[0].dataset.key) || null;
    H.paintFocus();
  };
  H.paintFocus = function () {
    var cur = (P.UI.top() === H.layer) ? H.current() : null;
    P.$$('#home .focus').forEach(function (e) { if (e !== cur) e.classList.remove('focus'); });
    if (cur) {
      cur.classList.add('focus');
      H.key = cur.dataset.key;
      scrollInto(cur);
    }
    // the shared app name under the focused tile
    var label = P.$('#rowLabel'), names = P.S.get('names');
    if (cur && H.row === 'apps' && names === 'focus') {
      var it = P.Apps.items[cur.dataset.key];
      label.textContent = it ? P.Apps.label(it) : '';
      var tr = cur.parentNode;
      label.style.transform = 'translate3d(' + Math.round(cur.offsetLeft + cur.offsetWidth / 2 - (tr._x || 0)) + 'px,0,0) translateX(-50%)';
      label.classList.add('on');
    } else label.classList.remove('on');
    P.$('#appRow').classList.toggle('editing', !!H.editing);
  };
  /* rows slide with a GPU transform rather than scrolling, which the TV redraws far more cheaply */
  function scrollInto(el) {
    var track = el.parentNode, row = track && track.parentNode;
    if (!track || !track.classList || !track.classList.contains('track')) return;
    var x = track._x || 0, vis = row.clientWidth - 40, l = el.offsetLeft, r = l + el.offsetWidth;
    if (r > x + vis) x = r - vis; else if (l < x) x = l;
    x = Math.max(0, Math.round(x));
    if (x !== (track._x || 0)) { track._x = x; track.style.transform = 'translate3d(' + (-x) + 'px,0,0)'; }
  }

  function moveRow(dir) {
    var cur = H.current(), x = cur ? cur.getBoundingClientRect().left + cur.offsetWidth / 2 : 400;
    var i = ROWS.indexOf(H.row);
    for (var j = i + dir; j >= 0 && j < ROWS.length; j += dir) {
      var list = itemsOf(ROWS[j]);
      if (!list.length) continue;
      if (ROWS[j] === 'icons' && H.row !== 'strip' && dir < 0 && !P.$('#strip').hidden) continue; // apps → strip first
      var best = list[0], bd = 1e9;
      list.forEach(function (e) { var r = e.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x); if (d < bd) { bd = d; best = e; } });
      H.focus(ROWS[j], best.dataset.key);
      return;
    }
  }
  function moveIn(dir) {
    var list = itemsOf(H.row), cur = H.current(), i = list.indexOf(cur);
    var n = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    if (n) { H.key = n.dataset.key; H.paintFocus(); }
  }

  /* ---------- editing the apps row (hold OK → Move) ---------- */
  function startMove(key) { H.editing = key; H.paintFocus(); P.UI.toast('Use ◀ ▶ to move · OK when done'); }
  function moveTile(dir) {
    var row = P.S.get('row').slice(), shown = P.Apps.row().map(function (it) { return it.key; });
    var i = shown.indexOf(H.editing), j = i + dir;
    if (j < 0 || j >= shown.length) return;
    var a = row.indexOf(shown[i]), b = row.indexOf(shown[j]);
    row[a] = shown[j]; row[b] = shown[i];
    P.S.set('row', row);
    H.renderApps();
  }
  H.removeFromRow = function (key) {
    P.S.set('row', P.S.get('row').filter(function (k) { return k !== key; }));
    H.renderApps();
    var list = itemsOf('apps'); H.focus('apps', list[0] && list[0].dataset.key);
    P.UI.toast('Removed from the row. It stays in All apps');
  };

  /* ---------- OK and hold OK ---------- */
  function press(hold) {
    var cur = H.current(); if (!cur) return;
    var k = cur.dataset.key;
    if (H.row === 'matchesH' || H.row === 'cwH') { H.toggleFold(H.row.slice(0, -1)); return; }
    if (H.row === 'icons') { if (k === 'settings') P.Settings.open(); else if (k === 'allapps') P.AllApps.open(); return; }
    if (H.row === 'strip') {
      if (hold || !stripMatch) { P.Centre.open(stripMatch && stripMatch.id); return; }
      // the strip is a shortcut: live → beIN at once, upcoming → reminder; the match centre has the full menu
      if (stripMatch.state === 'in') P.Apps.switchTo('hdmi:bein'); else if (stripMatch.state === 'pre') P.Centre.remind(stripMatch); else P.Centre.act(stripMatch);
      return;
    }
    if (H.row === 'apps') {
      var it = P.Apps.items[k];
      if (!hold) { P.Apps.open(it); return; }
      var ops = [{ label: 'Move', icon: 'move', act: function () { startMove(k); } },
        { label: 'Remove from row', icon: 'eyeOff', act: function () { H.removeFromRow(k); } }];
      if (it.kind === 'hdmi') ops.push({ label: 'Change HDMI port', icon: 'settop', act: function () { P.Settings.open('inputs'); } });
      ops.push({ label: 'All apps', icon: 'grid', act: function () { P.AllApps.open(); } });
      P.UI.menu(cur, P.Apps.label(it), ops);
      return;
    }
    if (H.row === 'matches') {
      var m = P.Football.find(k.slice(2)); if (!m) return;
      if (hold) P.Centre.open(m.id); else P.Centre.act(m);
      return;
    }
    if (H.row === 'cw') {
      if (k === 'cw:connect') { P.Settings.plexSignIn(); return; }
      if (k === 'cw:retry') { P.Plex.refresh(); P.UI.toast('Trying again…'); return; }
      var card = P.Plex.items.filter(function (c) { return 'cw:' + c.key === k; })[0]; if (!card) return;
      if (!hold) { P.Plex.open(card); return; }
      var rest = (card.type === 'episode' ? [{ label: 'Episodes', icon: 'list', act: function () { P.Show.open(card); } }] : []).concat([
        { label: 'Open in the Plex app', icon: 'grid', act: function () { P.Plex.openApp(card); } },
        { label: 'Remove from Continue Watching', icon: 'eyeOff', act: function () { P.Plex.hide(card); } },
        { label: card.type === 'episode' ? 'Hide this show' : 'Hide this movie', icon: 'eyeOff', act: function () { P.Plex.hideAll(card); } }]);
      if (!card.copies || card.copies.length < 2) { P.UI.menu(cur, card.title, [{ label: 'Play', icon: 'play', act: function () { P.Plex.open(card); } }].concat(rest)); return; }
      // the title is on your server more than once: one Play row per version, the one that would play first
      P.Plex.versions(card).then(function (vs) {
        var first = P.Plex.choose(card, vs).play.key;
        vs.sort(function (a, b) { return (b.key === first) - (a.key === first); });
        P.UI.menu(cur, card.title, vs.map(function (v) {
          return { label: 'Play · ' + P.esc(v.label), icon: 'play', act: function () { P.Plex.open(card, v.key); } };
        }).concat(rest));
      });
    }
  }

  H.layer = {
    name: 'home',
    key: function (k) {
      if (H.editing) {
        if (k === 'left') moveTile(-1); else if (k === 'right') moveTile(1);
        else if (k === 'ok' || k === 'back' || k === 'hold') { H.editing = null; H.paintFocus(); }
        return;
      }
      if (k === 'left') moveIn(-1);
      else if (k === 'right') moveIn(1);
      else if (k === 'up') moveRow(-1);
      else if (k === 'down') moveRow(1);
      else if (k === 'ok') press(false);
      else if (k === 'hold') press(true);
      else if (k === 'back') { if (H.row !== 'apps') H.focus('apps'); }
    },
    resume: function () { H.paintFocus(); }
  };

  H.init = function () {
    P.$('#icons [data-act=allapps]').innerHTML = P.icon('grid');
    P.$('#icons [data-act=settings]').innerHTML = P.icon('gear');
    H.applyTheme();
    H.tick(); setInterval(H.tick, 10000);
    setInterval(H.applyTheme, 60000);
    H.applyFolds(); H.renderApps(); H.renderMatchesRow(); H.renderCW(); H.renderStrip();
    stripT = setInterval(rotateStrip, 6000);
    setInterval(function () { if (!P.Football.live().length) H.renderStrip(); }, 30000); // countdown
    P.bus.on('football', function () { H.renderStrip(); H.renderMatchesRow(); });
    P.bus.on('plex', H.renderCW);
    var logosT = null;
    P.bus.on('logos', function () { clearTimeout(logosT); logosT = setTimeout(H.renderApps, 50); });
    P.bus.on('weather', function () { H.tick(); H.applyTheme(); });
    P.bus.on('setting', function (k) {
      if (/^(theme|wpLight|wpDark)$/.test(k)) H.applyTheme();
      if (/^(row|logos|names|ps5Port|beinPort)$/.test(k)) H.renderApps();
      if (/^(matchesRow|favs|euBigOnly|comps|reminders)$/.test(k)) { H.renderMatchesRow(); H.renderStrip(); }
    });
    H.focus('apps');
  };

  P.Home = H;
})();
