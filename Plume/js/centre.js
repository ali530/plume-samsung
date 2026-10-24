/* The match centre (the football tile): a month of days each way (today first), matches grouped by competition,
   details of the focused match, and its table. OK on a match: its details first, then beIN, highlights or a reminder. */
(function () {
  var RANGE = 30;                              // days back and ahead in the date strip
  var C = { day: 0, zone: 'list', bar: RANGE + 1, at: 0, open_: false };
  var root = function () { return P.$('#centre'); };
  function dayLabel(off) {
    if (off === 0) return 'Today'; if (off === -1) return 'Yesterday'; if (off === 1) return 'Tomorrow';
    var d = P.dayStart(new Date(), off); return P.DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + P.MONTHS[d.getMonth()];
  }

  function remind(m) {
    var F = P.Football, on = F.toggleReminder(m);
    P.UI.toast(on ? 'Reminder set · pops up 10 min before kick-off' : 'Reminder removed');
    C.render(); P.Home.renderStrip(); P.Home.renderMatchesRow();
  }
  /* what OK does on a match: a menu, with the match's details first */
  C.act = function (m) {
    var F = P.Football, anchor = P.$('#centre .mline.focus') || P.$('.mcard.focus');
    var second = null;
    if (m.state === 'in') second = { label: 'Watch on beIN', icon: 'play', act: function () { P.Apps.switchTo('hdmi:bein'); } };
    else if (m.state === 'post') second = { label: 'Watch highlights', icon: 'play', act: function () { P.Highlights.open(m, anchor); } };
    else if (!/postpon|cancel/i.test(m.statusName)) second = { label: F.hasReminder(m) ? 'Remove reminder' : 'Remind me', icon: 'bell', act: function () { remind(m); } };
    P.UI.menu(anchor, m.home.short + ' ' + F.centreText(m) + ' ' + m.away.short, [
      { label: m.state === 'in' ? 'Live details' : 'Match details', icon: 'list', act: function () { if (!C.open_) C.open(m.id); C.openDetails(m); } },
      second,
      { label: 'Whole table', icon: 'grid', act: function () { if (!C.open_) C.open(m.id); C.sideComp = m.comp; C.openFull(); } }].filter(Boolean));
  };
  C.okLabel = function (m) {
    return 'Details · ' + (m.state === 'in' ? 'Watch on beIN' : m.state === 'post' ? 'Highlights' : P.Football.hasReminder(m) ? 'Reminder' : 'Remind me');
  };

  /* the matches in the order they're shown: grouped by competition (moving Down follows the screen, not kick-off times) */
  function list() {
    var F = P.Football;
    return [].concat.apply([], F.byComp(F.day(C.day)).map(function (g) { return g.list; }));
  }

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
    return k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : k === -1 ? 'Yesterday' : P.dateText(d);
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
  /* results and coming matches in one list, two weeks each way; it opens at today */
  function fixtures(comp, m) {
    var list = P.Football.fixtures(comp), ids = m ? [m.home.id, m.away.id] : [];
    if (!list) return '<div class="f-empty">Loading matches…</div>';
    if (!list.length) return '<div class="f-empty">No matches two weeks either side of today.</div>';
    var out = '', last = '', marked = false, today = +P.dayStart(new Date());
    list.forEach(function (x) {
      var d = whenText(x.date);
      if (d !== last) {
        var mark = !marked && (x.date >= today || x.state !== 'post');
        if (mark) marked = true;
        out += '<div class="f-h"' + (mark ? ' id="fToday"' : '') + '>' + d + '</div>'; last = d;
      }
      out += fixLine(x, ids);
    });
    return out;
  }
  /* ---------- one finished match: stats and timeline on the left, line-ups on the right ---------- */
  var STATS = [['possessionPct', 'Possession', '%'], ['totalShots', 'Shots'], ['shotsOnTarget', 'On target'], ['wonCorners', 'Corners'],
    ['foulsCommitted', 'Fouls'], ['offsides', 'Offsides'], ['yellowCards', 'Yellow cards'], ['redCards', 'Red cards'], ['saves', 'Saves']];
  function detailsLeft(m, d) {
    if (!d) return '<div class="f-empty">Loading the match…</div>';
    if (d.error) return '<div class="f-empty">' + P.esc(d.error) + '</div>';
    if (m.state === 'pre' && !d.events.length && !Object.keys(d.stats).length)
      return '<div class="f-h">Kick-off</div><div class="pre-ko">' + P.esc(P.dateText(m.date) + ' · ' + P.hhmm(m.date)) + '<small>' + (m.date > Date.now() ? 'in ' + P.esc(P.until(m.date - Date.now())) : '') + '</small></div>' +
        (m.venue ? '<div class="pre-v">' + P.icon('pin') + P.esc(m.venue) + '</div>' : '') + '<div class="f-empty">Stats and the minute-by-minute appear once the match starts.</div>';
    var rows = STATS.filter(function (s) { return d.stats[s[0]]; }).map(function (s) {
      var x = d.stats[s[0]], h = parseFloat(x.home) || 0, a = parseFloat(x.away) || 0, tot = h + a || 1;
      return '<div class="ds-r"><b>' + P.esc(x.home || '0') + (s[2] || '') + '</b><span class="ds-l">' + s[1] + '</span><b class="r">' + P.esc(x.away || '0') + (s[2] || '') + '</b>' +
        '<div class="ds-bar"><i style="width:' + Math.round(h / tot * 100) + '%"></i><i class="a" style="width:' + Math.round(a / tot * 100) + '%"></i></div></div>';
    }).join('');
    var ICON = { goal: '⚽', yellow: '<i class="card y"></i>', red: '<i class="card r"></i>', sub: '⇄' };
    var tl = d.events.map(function (e) {
      var who = e.kind === 'sub' ? (e.who[0] || '') + (e.who[1] ? ' ↔ ' + e.who[1] : '') : (e.who[0] || '') + (e.pen ? ' (pen)' : '') + (e.own ? ' (og)' : '');
      return '<div class="tl-r ' + e.side + (e.kind === 'goal' ? ' goal' : '') + '"><span class="tl-m">' + P.esc(e.min) + '</span><span class="tl-i">' + ICON[e.kind] + '</span><span class="tl-w">' + P.esc(who) + '</span></div>';
    }).join('');
    return (rows ? '<div class="f-h">Stats</div>' + rows : '') + (tl ? '<div class="f-h">Match</div>' + tl : '') || '<div class="f-empty">No details for this match.</div>';
  }
  /* ---------- line-ups on a pitch: each team's formation from its keeper outwards; home on the left ---------- */
  function lineOf(p) {
    var a = (p.pos || '').toUpperCase(), n = (p.posName || '').toLowerCase();
    if (a === 'G' || a === 'GK' || /goalkeeper/.test(n)) return 0;
    if (/^(CD|CB|LB|RB|D|SW|LWB|RWB|WB|CB-L|CB-R)/.test(a) || /defender|full.?back|centre.?back|center.?back/.test(n)) return 1;
    if (/^DM/.test(a) || /defensive mid/.test(n)) return 2;
    if (/^AM/.test(a) || /attacking mid/.test(n)) return 4;
    if (/^(LW|RW|F|CF|ST|S|LF|RF|W)/.test(a) || /forward|striker|wing/.test(n)) return 5;
    return 3;
  }
  function sideOf(p) { var a = (p.pos || '').toUpperCase(); return /(^L|-L$)/.test(a) ? 0 : /(^R|-R$)/.test(a) ? 2 : 1; }
  function shape(players, formation) {
    var st = players.filter(function (p) { return p.starter; });
    if (st.length !== 11) return null;
    var gk = st.filter(function (p) { return lineOf(p) === 0; })[0] || st.slice().sort(function (a, b) { return a.place - b.place; })[0];
    var rest = st.filter(function (p) { return p !== gk; }).sort(function (a, b) { return lineOf(a) - lineOf(b) || a.place - b.place; });
    var sizes = String(formation || '').split('-').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x > 0; });
    var lines = [];
    if (sizes.length && sizes.reduce(function (a, b) { return a + b; }, 0) === 10) {
      var i = 0; sizes.forEach(function (n) { lines.push(rest.slice(i, i + n)); i += n; });
    } else {                                    // no formation: one line per kind of position
      rest.forEach(function (p) { var k = lineOf(p); var l = lines.filter(function (x) { return lineOf(x[0]) === k; })[0]; if (l) l.push(p); else lines.push([p]); });
    }
    lines.forEach(function (l) { l.sort(function (a, b) { return sideOf(a) - sideOf(b) || a.place - b.place; }); });
    return [[gk]].concat(lines);
  }
  function pitch(m, d) {
    var home = shape(d.lineups.home, d.formation.home), away = shape(d.lineups.away, d.formation.away);
    if (!home || !away) return '';
    var dots = '';
    [[home, 'home'], [away, 'away']].forEach(function (t) {
      var lines = t[0], n = lines.length;
      lines.forEach(function (line, li) {
        var x = 5 + li * (36 / Math.max(1, n - 1));             // keeper at the goal, the last line short of halfway
        line.forEach(function (p, pi) {
          var y = (pi + 1) / (line.length + 1) * 100;            // a team's left side is at the top for the team attacking right
          if (t[1] === 'away') { x = 100 - (5 + li * (36 / Math.max(1, n - 1))); y = 100 - y; }
          dots += '<div class="pd ' + t[1] + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%"><b>' + P.esc(p.num) + '</b><span>' + P.esc(p.last || p.name) + (p.off ? ' ↓' : '') + '</span></div>';
        });
      });
    });
    return '<div class="pitch-h"><span>' + P.esc(m.home.short) + (d.formation.home ? ' · ' + P.esc(d.formation.home) : '') + '</span><span>' + (d.formation.away ? P.esc(d.formation.away) + ' · ' : '') + P.esc(m.away.short) + '</span></div>' +
      '<div class="pitch"><i class="pl-half"></i><i class="pl-circle"></i><i class="pl-box l"></i><i class="pl-box r"></i>' + dots + '</div>';
  }
  function detailsRight(m, d) {
    if (!d || d.error) return '';
    var pt = pitch(m, d);
    if (pt) {
      var bench = function (list) { return list.filter(function (p) { return !p.starter; }).map(function (p) { return '<div class="lu-r"><span class="lu-n">' + P.esc(p.num) + '</span><span class="lu-p">' + P.esc(p.name) + (p.on ? ' <i class="on">↑</i>' : '') + '</span><span class="lu-pos">' + P.esc(p.pos) + '</span></div>'; }).join(''); };
      return pt + '<div class="lu"><div><div class="lu-h">Substitutes · ' + P.esc(m.home.short) + '</div>' + bench(d.lineups.home) + '</div><div><div class="lu-h">Substitutes · ' + P.esc(m.away.short) + '</div>' + bench(d.lineups.away) + '</div></div>';
    }
    var col = function (list) {
      var st = list.filter(function (p) { return p.starter; }), bench = list.filter(function (p) { return !p.starter; });
      var line = function (p) { return '<div class="lu-r"><span class="lu-n">' + P.esc(p.num) + '</span><span class="lu-p">' + P.esc(p.name) + (p.off ? ' <i>↓</i>' : '') + (p.on ? ' <i class="on">↑</i>' : '') + '</span><span class="lu-pos">' + P.esc(p.pos) + '</span></div>'; };
      return st.map(line).join('') + (bench.length ? '<div class="lu-h">Substitutes</div>' + bench.map(line).join('') : '');
    };
    if (!d.lineups.home.length && !d.lineups.away.length) return '<div class="f-empty">' + (m.state === 'pre' ? 'Line-ups appear about an hour before kick-off.' : 'No line-ups for this match.') + '</div>';
    return '<div class="lu"><div><div class="f-h">' + P.esc(m.home.short) + '</div>' + col(d.lineups.home) + '</div><div><div class="f-h">' + P.esc(m.away.short) + '</div>' + col(d.lineups.away) + '</div></div>';
  }
  C.openDetails = function (m) {
    C.full = { kind: 'details', m: m, comp: m.comp, col: 0, data: null };
    root().classList.add('full-on');
    renderFull();
    var f = C.full;
    var load = function (fresh) {
      P.Football.summary(m, fresh).then(function (d) { if (C.full === f) { f.data = d; renderFull(); } },
        function () { if (C.full === f && !f.data) { f.data = { error: "Couldn't load this match's details" }; renderFull(); } });
    };
    load(false);
    // during the match, and in the last hours before it (line-ups), the page keeps itself up to date
    f.timer = setInterval(function () {
      if (C.full !== f) return;
      var soon = m.state === 'pre' && m.date - Date.now() < 3 * 3600000;
      if (m.state === 'in' || soon) load(true);
    }, 30000);
  };
  function okAction(m) {
    if (m.state === 'post') return ['Highlights', function () { P.Highlights.open(m, null); }];
    if (m.state === 'in') return ['Watch on beIN', function () { P.Apps.switchTo('hdmi:bein'); }];
    if (/postpon|cancel/i.test(m.statusName)) return null;
    return [P.Football.hasReminder(m) ? 'Remove reminder' : 'Remind me', function () { remind(m); renderFull(); }];
  }

  function renderFull() {
    var f = C.full, F = P.Football, c = F.byKey[f.comp] || {}, box = P.$('#cFull');
    if (f.kind === 'details') {
      if (!box) { box = P.el('div', 'c-full'); box.id = 'cFull'; root().appendChild(box); }
      var m = f.m;
      var dhtml = '<div class="f-top"><h2 class="d-h">' + P.UI.crest(m.home, 'sm') + P.esc(m.home.short) + ' <b>' + F.centreText(m) + '</b> ' + P.esc(m.away.short) + P.UI.crest(m.away, 'sm') +
        '<small>' + P.esc(m.compName + ' · ' + F.statusText(m) + (m.venue ? ' · ' + m.venue : '')) + '</small></h2>' +
        (okAction(m) ? '<span class="f-keys"><span class="key">OK</span>' + okAction(m)[0] + '</span>' : '') + '</div>' +
        '<div class="f-cols"><section class="f-col' + (f.col === 0 ? ' focus' : '') + '" id="fc0">' + detailsLeft(m, f.data) + '</section>' +
        '<section class="f-col' + (f.col === 1 ? ' focus' : '') + '" id="fc1"><div class="f-title">Line-ups</div>' + detailsRight(m, f.data) + '</section></div>';
      if (box._html !== dhtml) {   // a live update keeps where you've scrolled to
        var d0 = P.$('#fc0') ? P.$('#fc0').scrollTop : 0, d1 = P.$('#fc1') ? P.$('#fc1').scrollTop : 0;
        box._html = dhtml; box.innerHTML = dhtml;
        P.$('#fc0').scrollTop = d0; P.$('#fc1').scrollTop = d1;
      }
      return;
    }
    if (!box) { box = P.el('div', 'c-full'); box.id = 'cFull'; root().appendChild(box); }
    var html = '<div class="f-top"><h2>' + P.esc(c.name || '') + '</h2><span class="f-keys"><span class="key">◀ ▶</span>Switch · <span class="key">▲ ▼</span>Scroll · <span class="key">Back</span>Close</span></div>' +
      '<div class="f-cols"><section class="f-col' + (f.col === 0 ? ' focus' : '') + '" id="fc0"><div class="f-title">Table</div>' + fullTable(f.comp, f.m) + '</section>' +
      '<section class="f-col' + (f.col === 1 ? ' focus' : '') + '" id="fc1"><div class="f-title">Matches</div>' + fixtures(f.comp, f.m) + '</section></div>';
    if (box._html !== html) {
      var s0 = P.$('#fc0') ? P.$('#fc0').scrollTop : 0, s1 = P.$('#fc1') ? P.$('#fc1').scrollTop : 0;
      box._html = html; box.innerHTML = html;
      P.$('#fc0').scrollTop = s0; P.$('#fc1').scrollTop = s1;
      // the first time the matches arrive: open at today, the latest results just above
      var mk = P.$('#fToday');
      if (mk && !f.placed) { f.placed = true; var c1 = P.$('#fc1'); c1.style.scrollBehavior = 'auto'; c1.scrollTop = Math.max(0, mk.offsetTop - c1.offsetTop - 200); c1.style.scrollBehavior = ''; }
    }
  }
  C.openFull = function () {
    if (!C.sideComp) return;
    C.full = { comp: C.sideComp, m: list()[C.at] && list()[C.at].comp === C.sideComp ? list()[C.at] : null, col: 0 };
    root().classList.add('full-on');
    renderFull();
  };
  function closeFull() {
    if (C.full && C.full.timer) clearInterval(C.full.timer);
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
    var pills = '';
    for (var o = -RANGE; o <= RANGE; o++) pills += '<button class="day' + (C.day === o ? ' on' : '') + '" data-b="' + (o + RANGE + 1) + '">' + dayLabel(o) + '</button>';
    var bar = '<div class="c-head"><button class="cbtn" data-b="0">' + P.icon('back') + 'Back</button><h1>Matches</h1>' +
      '<div class="c-days" id="cDays"><div class="c-dtrack" id="cDtrack">' + pills + '</div></div></div>';
    var body, ds = F.dayState[C.day];
    if (!F.ready || (ds && ds.loading && !ms.length)) body = '<div class="c-empty">Loading matches…</div>';
    else if (!ms.length) body = '<div class="c-empty">' + (F.error && C.day >= -1 && C.day <= 1 ? P.esc(F.error) + '. Check the internet connection.' : 'No matches ' + (C.day === 0 ? 'today' : C.day === -1 ? 'yesterday' : C.day === 1 ? 'tomorrow' : 'on ' + dayLabel(C.day)) + ' in your competitions.') + '</div>';
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
    // the date strip slides to keep the focused (or chosen) day in view
    var dt = P.$('#cDtrack'), dbox = P.$('#cDays');
    if (dt && dbox) {
      var pill = P.$('[data-b="' + (C.zone === 'bar' && C.bar > 0 ? C.bar : C.day + RANGE + 1) + '"]', dt);
      if (pill) {
        var x = dt._x == null ? pill.offsetLeft - dbox.clientWidth / 2 + pill.offsetWidth / 2 : dt._x, w = dbox.clientWidth;
        if (pill.offsetLeft - x < 20) x = pill.offsetLeft - 20;
        if (pill.offsetLeft + pill.offsetWidth - x > w - 20) x = pill.offsetLeft + pill.offsetWidth - w + 20;
        x = Math.max(0, Math.min(x, dt.scrollWidth - w));
        if (x !== dt._x) { dt._x = x; dt.style.transform = 'translate3d(' + (-x) + 'px,0,0)'; }
      }
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
        if (k === 'ok' && C.full.kind === 'details') { var oa = okAction(C.full.m); if (oa) oa[1](); }
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
        if (k === 'right') C.bar = Math.min(2 * RANGE + 1, C.bar + 1);
        if (k === 'down' && ms.length) { C.zone = 'list'; moveTo(0); return; }
        if (k === 'ok') {
          if (C.bar === 0) { C.close(); return; }
          C.day = C.bar - RANGE - 1; C.at = 0; C.focusId = null;
          P.Football.loadDay(C.day); C.render(); return;
        }
        paint(); return;
      }
      if (k === 'up') { if (C.at === 0) { C.zone = 'bar'; C.bar = C.day + RANGE + 1; paint(); return; } moveTo(C.at - 1); return; }
      if (k === 'down') { moveTo(Math.min(ms.length - 1, C.at + 1)); return; }
      if (k === 'right') { if (P.$('#cSide .c-table')) { C.zone = 'table'; paint(); } return; }
      if (k === 'left') return;
      if ((k === 'ok' || k === 'hold') && ms[C.at]) C.act(ms[C.at]);
    },
    resume: function () { C.render(); }
  };

  C.open = function (matchId) {
    C.open_ = true; C.day = 0; C.at = 0; C.zone = 'list'; C.bar = RANGE + 1; C.focusId = null;
    if (matchId) {
      var m = P.Football.find(matchId);
      if (m) {
        C.day = Math.round((P.dayStart(m.date) - P.dayStart(new Date())) / 86400000);
        if (C.day < -RANGE || C.day > RANGE) C.day = 0;
        P.Football.loadDay(C.day);
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
    if (C.full && C.full.timer) clearInterval(C.full.timer);
    C.full = null; root().classList.remove('full-on');
    C.open_ = false; root().hidden = true; root().innerHTML = ''; root()._html = '';
    document.body.classList.remove('centre-on');
    P.UI.pop(layer);
  };
  C.isOpen = function () { return C.open_; };
  C.remind = remind;
  C.list = function () { return list(); };
  P.bus.on('football', function () { if (C.open_) C.render(); });
  P.bus.on('football-side', function () { if (C.open_) C.render(); });

  P.Centre = C;
})();
