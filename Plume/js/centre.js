/* The match centre (the football tile): Yesterday / Today / Tomorrow, matches grouped by competition,
   details of the focused match, and the Saudi Pro League table. */
(function () {
  var C = { day: 0, zone: 'list', bar: 2, at: 0, open_: false };
  var root = function () { return P.$('#centre'); };
  var DAYS = [['d:-1', 'Yesterday', -1], ['d:0', 'Today', 0], ['d:1', 'Tomorrow', 1]];

  /* what OK does on a match */
  C.act = function (m) {
    var F = P.Football;
    if (m.state === 'in') { P.Apps.switchTo('hdmi:bein'); return; }
    if (m.state === 'post') { P.UI.toast(P.esc(m.home.short + ' ' + F.centreText(m) + ' ' + m.away.short) + ' · ' + F.statusText(m)); return; }
    if (/postpon|cancel/i.test(m.statusName)) { P.UI.toast('This match is ' + F.statusText(m).toLowerCase()); return; }
    var on = F.toggleReminder(m);
    P.UI.toast(on ? 'Reminder set · pops up 10 min before kick-off' : 'Reminder removed');
    C.render(); P.Home.renderStrip(); P.Home.renderMatchesRow();
  };
  C.okLabel = function (m) {
    if (m.state === 'in') return 'Watch on beIN';
    if (m.state === 'post') return 'Result';
    return P.Football.hasReminder(m) ? 'Remove reminder' : 'Remind me';
  };

  function list() { return P.Football.day(C.day); }

  function detail(m) {
    var F = P.Football;
    if (!m) return '<div class="c-detail empty"></div>';
    var st = F.statusText(m), when = m.state === 'pre' ? (m.date > Date.now() ? 'Kick-off in ' + P.until(m.date - Date.now()) : 'Kick-off ' + P.hhmm(m.date)) : st;
    var goals = function (side) {
      return m.goals.filter(function (g) { return g.side === side; }).map(function (g) {
        return '<div>' + P.esc(g.who) + ' ' + P.esc(g.min) + (g.pen ? ' (pen)' : '') + (g.og ? ' (og)' : '') + '</div>';
      }).join('');
    };
    var gh = goals('home'), ga = goals('away');
    return '<div class="c-detail">' +
      '<div class="d-comp">' + P.esc(m.compName) + (m.tag ? ' · ' + P.esc(m.tag) : '') + '</div>' +
      '<div class="d-teams"><div class="d-team">' + P.UI.crest(m.home, 'lg') + '<span>' + P.esc(m.home.name) + '</span></div>' +
      '<div class="d-mid"><b class="' + (m.state === 'pre' ? 'ko' : '') + '">' + F.centreText(m) + '</b><span class="' + (m.state === 'in' ? 'live' : '') + '">' +
      (m.state === 'in' ? '<i class="dot"></i>' : '') + P.esc(when) + '</span></div>' +
      '<div class="d-team">' + P.UI.crest(m.away, 'lg') + '<span>' + P.esc(m.away.name) + '</span></div></div>' +
      ((gh || ga) ? '<div class="d-goals"><div>' + gh + '</div>' + P.icon('ball') + '<div class="r">' + ga + '</div></div>' : '') +
      (m.venue ? '<div class="d-venue">' + P.icon('pin') + P.esc(m.venue) + '</div>' : '') +
      '<div class="d-ok"><span class="key">OK</span>' + C.okLabel(m) + '</div></div>';
  }

  function tableRows(title, rows, m) {
    var F = P.Football, ids = m ? [m.home.id, m.away.id] : [];
    var want = {};
    rows.forEach(function (r, i) { if (i < 4 || ids.indexOf(r.id) >= 0 || F.isFavName(r.name)) want[i] = true; });
    if (rows.length <= 8) rows.forEach(function (r, i) { want[i] = true; });
    var show = [], last = -1;
    rows.forEach(function (r, i) { if (!want[i]) return; if (last >= 0 && i > last + 1) show.push(null); show.push(r); last = i; });
    show = show.slice(0, 9);
    return '<div class="c-table"><div class="t-head"><span>' + P.esc(title) + '</span><span class="cols"><i>P</i><i>GD</i><i>Pts</i></span></div>' +
      show.map(function (r) {
        if (!r) return '<div class="t-gap">···</div>';
        var cls = (F.isFavName(r.name) ? ' fav' : '') + (ids.indexOf(r.id) >= 0 ? ' here' : '');
        return '<div class="t-row' + cls + '"><span class="rk">' + r.rank + '</span>' +
          P.UI.crest({ logo: r.logo, abbr: r.abbr, color: '#7a7f87' }, 'xs') + '<span class="nm">' + P.esc(r.name) + '</span>' +
          '<span class="cols"><i>' + r.played + '</i><i>' + (r.gd > 0 ? '+' : '') + r.gd + '</i><b>' + r.points + '</b></span></div>';
      }).join('') + '</div>';
  }
  function roundRows(m, side) {
    var F = P.Football;
    return '<div class="c-table"><div class="t-head"><span>' + P.esc(m.compName + ' · ' + side.stage) + '</span></div>' +
      side.matches.slice(0, 8).map(function (x) {
        var when = x.state === 'pre' ? P.DAYS[x.date.getDay()] + ' ' + P.hhmm(x.date) : F.centreText(x);
        return '<div class="t-row' + (x.id === m.id ? ' here' : '') + '">' + P.UI.crest(x.home, 'xs') + '<span class="nm">' + P.esc(x.home.short) + '</span>' +
          '<b class="rd">' + P.esc(when) + '</b><span class="nm r">' + P.esc(x.away.short) + '</span>' + P.UI.crest(x.away, 'xs') + '</div>';
      }).join('') + '</div>';
  }
  /* beside the list: the focused match's league table, its group, or its cup round */
  function table(m) {
    var F = P.Football;
    C.sideComp = null;
    if (m) {
      var side = F.side(m.comp);
      if (side) C.sideComp = m.comp;
      if (side && side.kind === 'table') return tableRows(m.compName, side.groups[0].rows, m);
      if (side && side.kind === 'groups') {
        var g = side.groups.filter(function (x) { return x.rows.some(function (r) { return r.id === m.home.id || r.id === m.away.id; }); })[0] || side.groups[0];
        return tableRows(m.compName + (g.name ? ' · ' + g.name : ''), g.rows, m);
      }
      if (side && side.kind === 'round') return roundRows(m, side);
    }
    if (F.table.length) { C.sideComp = 'spl'; return tableRows('Saudi Pro League', F.table, null); }
    return '';
  }

  /* ---------- the whole table and the coming matches of one competition (OK on the table) ---------- */
  function whenText(d) {
    var t = P.dayStart(new Date()), k = Math.round((P.dayStart(d) - t) / 86400000);
    return k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : P.dateText(d);
  }
  function fullTable(comp, m) {
    var F = P.Football, side = F.side(comp), ids = m ? [m.home.id, m.away.id] : [];
    if (!side && comp === 'spl' && F.table.length) side = { kind: 'table', groups: [{ name: '', rows: F.table }] };
    if (!side) return '<div class="f-empty">Loading the table…</div>';
    if (side.kind === 'round') {
      return '<div class="f-h">' + P.esc(side.stage) + '</div>' + side.matches.map(function (x) { return fixLine(x, ids); }).join('');
    }
    return side.groups.map(function (g) {
      return (side.groups.length > 1 || g.name ? '<div class="f-h">' + P.esc(g.name || '') + '</div>' : '') +
        '<div class="t-head"><span></span><span class="cols"><i>P</i><i>GD</i><i>Pts</i></span></div>' +
        g.rows.map(function (r) {
          var cls = (F.isFavName(r.name) ? ' fav' : '') + (ids.indexOf(r.id) >= 0 ? ' here' : '');
          return '<div class="t-row' + cls + '"><span class="rk">' + r.rank + '</span>' +
            P.UI.crest({ logo: r.logo, abbr: r.abbr, color: '#7a7f87' }, 'xs') + '<span class="nm">' + P.esc(r.name) + '</span>' +
            '<span class="cols"><i>' + r.played + '</i><i>' + (r.gd > 0 ? '+' : '') + r.gd + '</i><b>' + r.points + '</b></span></div>';
        }).join('');
    }).join('');
  }
  function fixLine(x, ids) {
    var F = P.Football, mid = x.state === 'pre' ? P.hhmm(x.date) : F.centreText(x);
    var cls = (x.fav ? ' fav' : '') + (ids && (ids.indexOf(x.home.id) >= 0 && ids.indexOf(x.away.id) >= 0) ? ' here' : '');
    return '<div class="t-row' + cls + '">' + (x.state === 'in' ? '<i class="dot"></i>' : '') + P.UI.crest(x.home, 'xs') + '<span class="nm">' + P.esc(x.home.short) + '</span>' +
      '<b class="rd">' + P.esc(mid) + '</b><span class="nm r">' + P.esc(x.away.short) + '</span>' + P.UI.crest(x.away, 'xs') + '</div>';
  }
  function fixtures(comp, m) {
    var list = P.Football.fixtures(comp), ids = m ? [m.home.id, m.away.id] : [];
    if (!list) return '<div class="f-empty">Loading the coming matches…</div>';
    if (!list.length) return '<div class="f-empty">No matches in the next two weeks.</div>';
    var out = '', last = '';
    list.forEach(function (x) {
      var d = whenText(x.date);
      if (d !== last) { out += '<div class="f-h">' + d + '</div>'; last = d; }
      out += fixLine(x, ids);
    });
    return out;
  }
  function renderFull() {
    var f = C.full, F = P.Football, c = F.byKey[f.comp] || {}, box = P.$('#cFull');
    if (!box) { box = P.el('div', 'c-full'); box.id = 'cFull'; root().appendChild(box); }
    var html = '<div class="f-top"><h2>' + P.esc(c.name || '') + '</h2><span class="f-keys"><span class="key">◀ ▶</span>Switch · <span class="key">▲ ▼</span>Scroll · <span class="key">Back</span>Close</span></div>' +
      '<div class="f-cols"><section class="f-col' + (f.col === 0 ? ' focus' : '') + '" id="fc0"><div class="f-title">Table</div>' + fullTable(f.comp, f.m) + '</section>' +
      '<section class="f-col' + (f.col === 1 ? ' focus' : '') + '" id="fc1"><div class="f-title">Coming matches</div>' + fixtures(f.comp, f.m) + '</section></div>';
    if (box._html !== html) {
      var s0 = P.$('#fc0') ? P.$('#fc0').scrollTop : 0, s1 = P.$('#fc1') ? P.$('#fc1').scrollTop : 0;
      box._html = html; box.innerHTML = html;
      P.$('#fc0').scrollTop = s0; P.$('#fc1').scrollTop = s1;
    }
  }
  C.openFull = function () {
    if (!C.sideComp) return;
    C.full = { comp: C.sideComp, m: list()[C.at] && list()[C.at].comp === C.sideComp ? list()[C.at] : null, col: 0 };
    root().classList.add('full-on');
    renderFull();
  };
  function closeFull() {
    C.full = null; root().classList.remove('full-on');
    var b = P.$('#cFull'); if (b) b.remove();
    paint();
  }

  C.render = function () {
    if (!C.open_) return;
    var F = P.Football, ms = list();
    // live updates can reorder the list: stay on the same match, not the same position
    if (C.focusId) { var j = ms.findIndex(function (x) { return x.id === C.focusId; }); if (j >= 0) C.at = j; }
    if (C.at >= ms.length) C.at = Math.max(0, ms.length - 1);
    var focusM = ms[C.at];
    var bar = '<div class="c-head"><button class="cbtn" data-b="0">' + P.icon('back') + 'Back</button><h1>Matches</h1><span class="grow"></span>' +
      DAYS.map(function (d, i) { return '<button class="day' + (C.day === d[2] ? ' on' : '') + '" data-b="' + (i + 1) + '">' + d[1] + '</button>'; }).join('') + '</div>';
    var body;
    if (!F.ready) body = '<div class="c-empty">Loading matches…</div>';
    else if (!ms.length) body = '<div class="c-empty">' + (F.error ? P.esc(F.error) + '. Check the internet connection.' : 'No matches ' + (C.day === 0 ? 'today' : C.day < 0 ? 'yesterday' : 'tomorrow') + ' in your competitions.') + '</div>';
    else {
      var idx = 0;
      body = F.byComp(ms).map(function (g) {
        return '<div class="grp"><div class="g-name">' + P.esc(g.comp.name) + '</div>' + g.list.map(function (m) {
          var i = ms.indexOf(m); idx++;
          var st = m.state === 'in' ? '<span class="live"><i class="dot"></i>' + P.esc(F.statusText(m)) + '</span>'
            : m.state === 'post' ? '<span>' + (F.statusText(m) === 'Full time' ? 'FT' : P.esc(F.statusText(m))) + '</span>'
            : '<span>' + (F.hasReminder(m) ? P.icon('bell') : m.big ? P.icon('star') : '') + P.hhmm(m.date) + '</span>';
          return '<div class="mline' + (m.fav ? ' fav' : '') + '" data-m="' + i + '"><span class="st">' + st + '</span>' +
            P.UI.crest(m.home, 'sm') + '<span class="tn' + (P.Football.isFavName(m.home.name) ? ' me' : '') + '">' + P.esc(m.home.name) + '</span>' +
            '<b class="sc">' + (m.state === 'pre' ? '–' : F.centreText(m)) + '</b>' +
            '<span class="tn r' + (P.Football.isFavName(m.away.name) ? ' me' : '') + '">' + P.esc(m.away.name) + '</span>' + P.UI.crest(m.away, 'sm') + '</div>';
        }).join('') + '</div>';
      }).join('');
    }
    var html = bar + '<div class="c-body"><div class="c-list" id="cList"><div class="c-track" id="cTrack">' + body + '</div></div><aside class="c-side" id="cSide"></aside></div>';
    if (root()._html !== html) { root()._html = html; root().innerHTML = html; if (C.full) renderFull(); }  // the list itself only when it changed
    C.side(); paint();
    if (C.full) renderFull();
  };
  /* the details card and the table: only these change while you move through the list */
  C.side = function () {
    var box = P.$('#cSide'); if (!box) return;
    var m = list()[C.at], html = detail(m) + table(m);
    if (box._html !== html) { box._html = html; box.innerHTML = html; }
  };
  /* each press moves the focus at once; the details card and table follow when you pause, so presses never queue up */
  var sideT = null;
  function moveTo(i) {
    C.at = i; var m = list()[i]; C.focusId = m ? m.id : null;
    paint();
    clearTimeout(sideT); sideT = setTimeout(C.side, 120);
  }

  function paint() {
    var r = root();
    P.$$('.focus', r).forEach(function (e) { if (!e.closest('#cFull')) e.classList.remove('focus'); });
    var el = C.zone === 'bar' ? P.$('[data-b="' + C.bar + '"]', r) : C.zone === 'table' ? P.$('#cSide .c-table', r) : P.$('[data-m="' + C.at + '"]', r);
    if (!el && C.zone === 'table') { C.zone = 'list'; el = P.$('[data-m="' + C.at + '"]', r); }
    if (!el && C.zone === 'list') { C.zone = 'bar'; el = P.$('[data-b="' + C.bar + '"]', r); }
    if (el) el.classList.add('focus');
    if (el && C.zone === 'list') {   // the list slides on the graphics chip instead of jumping
      var box = P.$('#cList'), track = P.$('#cTrack'), y = track._y || 0, top = el.offsetTop, h = el.offsetHeight, bh = box.clientHeight;
      if (top + h - y > bh - 40) y = top + h - bh + 40;
      if (top - y < 40) y = Math.max(0, top - 60);
      if (y !== track._y) { track._y = y; track.style.transform = 'translate3d(0,' + (-y) + 'px,0)'; }
    }
  }

  var layer = {
    name: 'centre',
    key: function (k) {
      var ms = list();
      if (C.full) {
        var col = P.$('#fc' + C.full.col);
        if (k === 'back') { closeFull(); return; }
        if (k === 'left' || k === 'right') { C.full.col = k === 'left' ? 0 : 1; renderFull(); return; }
        if ((k === 'up' || k === 'down') && col) col.scrollTop += k === 'up' ? -300 : 300;
        return;
      }
      if (k === 'back') { if (C.zone === 'table') { C.zone = 'list'; paint(); return; } C.close(); return; }
      if (C.zone === 'table') {
        if (k === 'left') { C.zone = 'list'; paint(); return; }
        if (k === 'ok') { C.openFull(); return; }
        return;
      }
      if (C.zone === 'bar') {
        if (k === 'left') C.bar = Math.max(0, C.bar - 1);
        if (k === 'right') C.bar = Math.min(3, C.bar + 1);
        if (k === 'down' && ms.length) { C.zone = 'list'; moveTo(0); return; }
        if (k === 'ok') {
          if (C.bar === 0) { C.close(); return; }
          C.day = DAYS[C.bar - 1][2]; C.at = 0; C.focusId = null; C.render(); return;
        }
        paint(); return;
      }
      if (k === 'up') { if (C.at === 0) { C.zone = 'bar'; C.bar = C.day + 2; paint(); return; } moveTo(C.at - 1); return; }
      if (k === 'down') { moveTo(Math.min(ms.length - 1, C.at + 1)); return; }
      if (k === 'right') { if (P.$('#cSide .c-table')) { C.zone = 'table'; paint(); } return; }
      if (k === 'left') return;
      if ((k === 'ok' || k === 'hold') && ms[C.at]) C.act(ms[C.at]);
    },
    resume: function () { C.render(); }
  };

  C.open = function (matchId) {
    C.open_ = true; C.day = 0; C.at = 0; C.zone = 'list'; C.bar = 2; C.focusId = null;
    if (matchId) {
      var m = P.Football.find(matchId);
      if (m) {
        C.day = Math.round((P.dayStart(m.date) - P.dayStart(new Date())) / 86400000);
        if (C.day < -1 || C.day > 1) C.day = 0;
        var i = list().indexOf(m); if (i >= 0) { C.at = i; C.focusId = m.id; }
      }
    }
    root().hidden = false;
    document.body.classList.add('centre-on');
    P.UI.push(layer);
    C.render();
    if (Date.now() - P.Football.loadedAt > 120000) P.Football.refresh();
  };
  C.close = function () {
    C.full = null; root().classList.remove('full-on');
    C.open_ = false; root().hidden = true; root().innerHTML = ''; root()._html = '';
    document.body.classList.remove('centre-on');
    P.UI.pop(layer);
  };
  C.isOpen = function () { return C.open_; };
  P.bus.on('football', function () { if (C.open_) C.render(); });
  P.bus.on('football-side', function () { if (C.open_) C.render(); });

  P.Centre = C;
})();
