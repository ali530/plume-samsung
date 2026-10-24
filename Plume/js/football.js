/* Today's football: fixtures, live scores, scorers, the Saudi Pro League table.
   Source: ESPN's public scoreboard feed (free, no account). Times are shown in the TV's own time zone. */
(function () {
  var BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  /* mode: all = every match · saudi = only matches with a Saudi club (or one of your teams)
           ksa = only Saudi Arabia (or your teams) · eu = all, or only big matches when "big matches only" is on */
  var COMPS = [
    { k: 'spl',      slug: 'ksa.1',            name: 'Saudi Pro League',           short: 'SPL',        mode: 'all' },
    { k: 'kc',       slug: 'ksa.kings.cup',    name: "King's Cup",                 short: "King's Cup", mode: 'all' },
    { k: 'acle',     slug: 'afc.champions',    name: 'AFC Champions League Elite', short: 'ACL Elite',  mode: 'saudi' },
    { k: 'acl2',     slug: 'afc.cup',          name: 'AFC Champions League Two',   short: 'ACL Two',    mode: 'saudi' },
    { k: 'cwc',      slug: 'fifa.cwc',         name: 'Club World Cup',             short: 'Club WC',    mode: 'all' },
    { k: 'wcq',      slug: 'fifa.worldq.afc',  name: 'World Cup qualifiers (Asia)', short: 'WC qualifier', mode: 'all' },
    { k: 'wc',       slug: 'fifa.world',       name: 'World Cup',                  short: 'World Cup',  mode: 'all' },
    { k: 'asian',    slug: 'afc.asian.cup',    name: 'AFC Asian Cup',              short: 'Asian Cup',  mode: 'all' },
    { k: 'gulf',     slug: 'global.gulf_cup',  name: 'Arabian Gulf Cup',           short: 'Gulf Cup',   mode: 'all' },
    { k: 'friendly', slug: 'fifa.friendly',    name: 'International friendlies',   short: 'Friendly',   mode: 'ksa' },
    { k: 'ucl',      slug: 'uefa.champions',   name: 'Champions League',           short: 'UCL',        mode: 'eu' },
    { k: 'epl',      slug: 'eng.1',            name: 'Premier League',             short: 'Premier League', mode: 'eu' },
    { k: 'liga',     slug: 'esp.1',            name: 'La Liga',                    short: 'La Liga',    mode: 'eu' }
  ];
  var ORDER = COMPS.map(function (c) { return c.k; });

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-.']/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var RIVALRIES = [
    ['al hilal', 'al nassr', 'Riyadh derby'], ['al ittihad', 'al ahli', 'Jeddah derby'],
    ['al hilal', 'al ittihad', 'Big match'], ['al nassr', 'al ittihad', 'Big match'], ['al hilal', 'al ahli', 'Big match'], ['al nassr', 'al ahli', 'Big match'],
    ['real madrid', 'barcelona', 'El Clásico'], ['real madrid', 'atletico madrid', 'Madrid derby'], ['barcelona', 'atletico madrid', 'Big match'],
    ['sevilla', 'real betis', 'Seville derby'],
    ['manchester united', 'manchester city', 'Manchester derby'], ['manchester united', 'liverpool', 'Big match'],
    ['arsenal', 'tottenham hotspur', 'North London derby'], ['liverpool', 'everton', 'Merseyside derby'],
    ['liverpool', 'manchester city', 'Big match'], ['arsenal', 'manchester united', 'Big match'], ['arsenal', 'chelsea', 'London derby'],
    ['chelsea', 'tottenham hotspur', 'London derby'], ['arsenal', 'manchester city', 'Big match'], ['arsenal', 'liverpool', 'Big match'],
    ['chelsea', 'manchester united', 'Big match'], ['chelsea', 'liverpool', 'Big match']
  ];
  var GIANTS = ['real madrid', 'barcelona', 'bayern munich', 'manchester city', 'liverpool', 'arsenal', 'paris saint germain', 'internazionale',
    'juventus', 'ac milan', 'chelsea', 'manchester united', 'atletico madrid', 'borussia dortmund'];
  var STAGES = { 'knockout-round-playoffs': 'Knockout play-off', 'round-of-16': 'Round of 16', 'quarterfinals': 'Quarter-final', 'semifinals': 'Semi-final', 'final': 'Final' };

  /* teams offered in Settings → Favourite teams (Saudi Pro League clubs are added from the live table) */
  var EXTRA_TEAMS = ['Saudi Arabia', 'Manchester United', 'Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Tottenham Hotspur',
    'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Bayern Munich', 'Paris Saint-Germain', 'Internazionale', 'Juventus', 'AC Milan'];

  var F = {
    COMPS: COMPS, byKey: {}, matches: {}, table: [], top4: {}, saudiIds: {}, loadedAt: 0, error: null, ready: false
  };
  COMPS.forEach(function (c) { F.byKey[c.k] = c; });

  function isFav(team) {
    var n = norm(team.name);
    return P.S.get('favs').some(function (f) { var x = norm(f); return n === x || n.indexOf(x + ' ') === 0; });
  }
  F.isFavName = function (name) { return isFav({ name: name }); };

  function side(c) {
    var t = c.team || {};
    return {
      id: String(t.id || ''), name: t.displayName || t.name || '?', short: t.shortDisplayName || t.displayName || '?',
      abbr: t.abbreviation || (t.displayName || '?').slice(0, 3).toUpperCase(), logo: t.logo || '',
      color: t.color ? '#' + t.color : '#7a7f87', score: c.score != null ? String(c.score) : ''
    };
  }

  function toMatch(ev, comp) {
    var cp = (ev.competitions || [])[0] || {};
    var cs = cp.competitors || [];
    var h = cs.filter(function (c) { return c.homeAway === 'home'; })[0] || cs[0] || {};
    var a = cs.filter(function (c) { return c.homeAway === 'away'; })[0] || cs[1] || {};
    var st = (ev.status || cp.status || {}), ty = st.type || {};
    var home = side(h), away = side(a);
    var goals = [], reds = [], pmiss = [];
    (cp.details || []).forEach(function (d) {
      var who = (d.athletesInvolved || [])[0];
      var name = who ? (who.shortName || who.displayName || '') : '';
      var tid = String((d.team || {}).id || '');
      var ev = { side: tid === home.id ? 'home' : 'away', who: name.split(' ').slice(-1)[0] || name, min: (d.clock || {}).displayValue || '' };
      var ty = ((d.type || {}).text || '');
      if (d.scoringPlay) { ev.og = !!d.ownGoal; ev.pen = !!d.penaltyKick; goals.push(ev); }
      else if (d.redCard || /red card/i.test(ty)) reds.push(ev);
      else if (/penalty/i.test(ty) && /miss|saved/i.test(ty)) { ev.saved = /saved/i.test(ty); pmiss.push(ev); }
    });
    var m = {
      id: String(ev.id), comp: comp.k, compName: comp.name, compShort: comp.short, date: new Date(ev.date),
      state: ty.state || 'pre', completed: !!ty.completed, statusName: ty.name || '', detail: ty.shortDetail || ty.detail || '',
      clock: st.displayClock || '', home: home, away: away, venue: (cp.venue || {}).fullName || '',
      stage: (ev.season || {}).slug || '', goals: goals, reds: reds, pmiss: pmiss
    };
    return m;
  }

  /* decide: big match? your team? shown at all? */
  function judge(m) {
    var comp = F.byKey[m.comp], hn = norm(m.home.name), an = norm(m.away.name);
    m.fav = isFav(m.home) || isFav(m.away);
    m.tag = '';
    RIVALRIES.forEach(function (r) { if ((hn === r[0] && an === r[1]) || (hn === r[1] && an === r[0])) m.tag = r[2]; });
    var top = F.top4[comp.slug];
    var bothTop = top && top[m.home.id] && top[m.away.id];
    if (!m.tag && m.comp === 'ucl' && STAGES[m.stage]) m.tag = STAGES[m.stage];
    if (!m.tag && m.comp === 'ucl' && GIANTS.indexOf(hn) >= 0 && GIANTS.indexOf(an) >= 0) m.tag = 'Big match';
    if (!m.tag && bothTop) m.tag = 'Top of the table';
    m.big = !!m.tag || m.fav;
    if (!m.tag && m.fav) m.tag = 'Your team';
    var saudi = F.saudiIds[m.home.id] || F.saudiIds[m.away.id];
    var show = P.S.get('comps')[m.comp] !== false;
    if (show) {
      if (comp.mode === 'saudi') show = saudi || m.fav;
      else if (comp.mode === 'ksa') show = hn === 'saudi arabia' || an === 'saudi arabia' || m.fav;
      else if (comp.mode === 'eu') show = !P.S.get('euBigOnly') || m.big;
    }
    m.show = show;
    return m;
  }

  /* label for the middle of a card: score, or kick-off time */
  F.centreText = function (m) {
    if (m.state === 'pre') return /postpon|cancel/i.test(m.statusName) ? '–' : P.hhmm(m.date);
    return (m.home.score || '0') + ' – ' + (m.away.score || '0');
  };
  /* short status: LIVE 63' / HT / FT / 21:00 */
  F.statusText = function (m) {
    if (/postpon/i.test(m.statusName)) return 'Postponed';
    if (/cancel/i.test(m.statusName)) return 'Cancelled';
    if (m.state === 'in') return /half_?time/i.test(m.statusName) ? 'Half time' : (m.clock || 'Live');
    if (m.state === 'post') return /pen/i.test(m.detail) ? 'Penalties' : /aet|extra/i.test(m.detail) ? 'After extra time' : 'Full time';
    return P.hhmm(m.date);
  };

  function dayOffset(d) {
    return Math.round((P.dayStart(d) - P.dayStart(new Date())) / 86400000);
  }

  /* matches for a day (0 = today, -1 = yesterday, 1 = tomorrow), shown ones only, in a sensible order */
  F.day = function (off) {
    var out = [];
    Object.keys(F.matches).forEach(function (k) {
      F.matches[k].forEach(function (m) { if (m.show && dayOffset(m.date) === off) out.push(m); });
    });
    return out.sort(function (a, b) {
      var rank = function (m) { return m.state === 'in' ? 0 : m.state === 'pre' ? 1 : 2; };
      return rank(a) - rank(b) || (rank(a) === 2 ? b.date - a.date : a.date - b.date) || (b.big - a.big);
    });
  };
  F.byComp = function (list) {
    return ORDER.map(function (k) { return { comp: F.byKey[k], list: list.filter(function (m) { return m.comp === k; }) }; })
      .filter(function (g) { return g.list.length; });
  };
  F.live = function () {
    return F.day(0).filter(function (m) { return m.state === 'in'; }).sort(function (a, b) { return (b.fav - a.fav) || (b.big - a.big) || (a.date - b.date); });
  };
  /* next big match (or one of your teams) still to come today */
  F.next = function () {
    var now = Date.now();
    return F.day(0).filter(function (m) { return m.state === 'pre' && m.big && m.date > now && !/postpon|cancel/i.test(m.statusName); })
      .sort(function (a, b) { return a.date - b.date; })[0] || null;
  };
  F.find = function (id) {
    var hit = null;
    Object.keys(F.matches).forEach(function (k) { F.matches[k].forEach(function (m) { if (m.id === id) hit = m; }); });
    return hit;
  };

  /* ---------- loading ----------
     The feed's dates follow US time, so each local day is covered by asking for the day before as well;
     matches are then placed on your own calendar by their real kick-off time. */
  function feedDays(liveOnly) {
    var now = new Date(), out = [];
    for (var d = liveOnly ? -1 : -2; d <= (liveOnly ? 0 : 1); d++) out.push(P.ymd(P.dayStart(now, d)));
    return out;
  }
  /* matches are kept by id: a refresh replaces what it loaded and keeps the other days you've opened */
  var fetchedDays = {};
  function mergeInto(c, list) {
    var fresh = {}; list.forEach(function (m) { fresh[m.id] = true; });
    F.matches[c.k] = list.concat((F.matches[c.k] || []).filter(function (m) { return !fresh[m.id]; }));
  }
  function wantedComps() {
    var comps = P.S.get('comps');
    return COMPS.filter(function (c) { return comps[c.k] || c.k === 'spl'; });
  }
  /* any day in the matches page's week (the matches page's date strip): loaded when you open it */
  F.dayState = {};
  F.loadDay = function (off) {
    if (off >= -1 && off <= 1) return;                         // loaded with every refresh
    var st = F.dayState[off];
    if (st && (st.loading || Date.now() - st.at < (off < -1 ? 6 * 3600000 : 30 * 60000))) return;
    F.dayState[off] = { loading: true, at: Date.now() };
    var day = P.dayStart(new Date(), off);
    var dates = [P.ymd(P.dayStart(day, -1)), P.ymd(day)];      // the feed's dates follow US time
    Promise.all(wantedComps().map(function (c) {
      return Promise.all(dates.map(function (d) {
        if (fetchedDays[c.k + d] && Date.now() - fetchedDays[c.k + d] < 30 * 60000) return [];
        return P.json(BASE + c.slug + '/scoreboard?dates=' + d, {}, 12000).then(function (x) { fetchedDays[c.k + d] = Date.now(); return x.events || []; }, function () { return []; });
      })).then(function (lists) {
        var seen = {}, list = [];
        [].concat.apply([], lists).forEach(function (ev) { if (!seen[ev.id]) { seen[ev.id] = true; list.push(toMatch(ev, c)); } });
        mergeInto(c, list);
      });
    })).then(function () {
      F.dayState[off] = { loading: false, at: Date.now() };
      F.rejudge(); P.bus.emit('football');
    });
  };

  function loadComp(c, liveOnly) {
    var days = feedDays(liveOnly), ok = 0;
    return Promise.all(days.map(function (day) {
      return P.json(BASE + c.slug + '/scoreboard?dates=' + day, {}, 12000).then(function (d) { ok++; return d.events || []; }, function () { return []; });
    })).then(function (lists) {
      if (!ok) throw new Error('feed unavailable');
      var seen = {}, list = [];
      [].concat.apply([], lists).forEach(function (ev) { if (!seen[ev.id]) { seen[ev.id] = true; list.push(toMatch(ev, c)); } });
      if (c.k === 'spl' || c.k === 'kc') list.forEach(function (m) { F.saudiIds[m.home.id] = true; F.saudiIds[m.away.id] = true; });
      days.forEach(function (d) { fetchedDays[c.k + d] = Date.now(); });
      mergeInto(c, list);
    }).catch(function (e) { P.log('feed', c.slug, e.message); if (!F.matches[c.k]) F.matches[c.k] = []; throw e; });
  }
  function parseRows(entries) {
    return (entries || []).map(function (e) {
      var stat = function (n) { var s = (e.stats || []).filter(function (x) { return x.name === n; })[0]; return s && s.value != null ? Math.round(s.value) : 0; };
      var t = e.team || {};
      return { id: String(t.id), name: t.displayName || t.name, abbr: t.abbreviation, logo: ((t.logos || [])[0] || {}).href || '',
        rank: stat('rank'), played: stat('gamesPlayed'), points: stat('points'), gd: stat('pointDifferential') };
    }).sort(function (a, b) { return a.rank - b.rank; });
  }
  /* standings as groups: a league has one group, a tournament several */
  function loadStandings(slug) {
    return P.json('https://site.api.espn.com/apis/v2/sports/soccer/' + slug + '/standings', {}, 12000).then(function (d) {
      var kids = (d.children && d.children.length) ? d.children : [d];
      return kids.map(function (g) { return { name: g.name || g.abbreviation || '', rows: parseRows((g.standings || {}).entries) }; })
        .filter(function (g) { return g.rows.length; });
    });
  }
  function loadTable(slug) {
    return loadStandings(slug).then(function (groups) {
      var rows = (groups[0] || {}).rows || [];
      var top = {}; rows.slice(0, 4).forEach(function (r) { top[r.id] = true; });
      F.top4[slug] = top;
      if (slug === 'ksa.1') { F.table = rows; rows.forEach(function (r) { F.saudiIds[r.id] = true; }); }
    }).catch(function (e) { P.log('table', slug, e.message); });
  }

  /* ---------- the panel beside the match list: a table, a group, or the current round ---------- */
  var sideCache = {};
  F.side = function (compKey) {
    var c = F.byKey[compKey]; if (!c) return null;
    var hit = sideCache[compKey];
    if (hit && (hit.loading || Date.now() - hit.at < 30 * 60000)) return hit.data;
    sideCache[compKey] = { loading: true, data: hit ? hit.data : null, at: Date.now() };
    loadStandings(c.slug).then(function (groups) {
      if (groups.length) return { kind: groups.length > 1 ? 'groups' : 'table', groups: groups };
      throw new Error('no standings');
    }).catch(function () {
      // knockout cups: the round being played now
      return P.json(BASE + c.slug + '/scoreboard', {}, 12000).then(function (d) {
        var ms = (d.events || []).map(function (ev) { return toMatch(ev, c); }).sort(function (a, b) { return a.date - b.date; });
        var lg = (d.leagues || [])[0] || {}, stage = '';
        (lg.calendar || []).forEach(function (cal) {
          (cal.entries || []).forEach(function (e) { if (ms[0] && new Date(e.startDate) <= ms[0].date && ms[0].date <= new Date(e.endDate)) stage = e.label; });
        });
        return ms.length ? { kind: 'round', stage: stage || 'This round', matches: ms } : null;
      });
    }).then(function (data) {
      sideCache[compKey] = { data: data, at: Date.now() };
      P.bus.emit('football-side');
    }, function () { sideCache[compKey] = { data: null, at: Date.now() }; });
    return sideCache[compKey].data;
  };

  /* the competition's coming matches: today and the next 13 days, all teams (only when you open its full table) */
  var fixCache = {};
  F.fixtures = function (compKey) {
    var c = F.byKey[compKey]; if (!c) return null;
    var hit = fixCache[compKey];
    if (hit && (hit.loading || Date.now() - hit.at < 30 * 60000)) return hit.data;
    fixCache[compKey] = { loading: true, data: hit ? hit.data : null, at: Date.now() };
    var days = []; for (var d = -15; d <= 14; d++) days.push(P.ymd(P.dayStart(new Date(), d)));
    Promise.all(days.map(function (day) {
      return P.json(BASE + c.slug + '/scoreboard?dates=' + day, {}, 12000).then(function (x) { return x.events || []; }, function () { return []; });
    })).then(function (lists) {
      var seen = {}, out = [], now = Date.now();
      [].concat.apply([], lists).forEach(function (ev) {
        if (seen[ev.id]) return; seen[ev.id] = true;
        var m = toMatch(ev, c);
        if (Math.abs(m.date - now) < 15 * 86400000) out.push(m);   // results and coming matches, two weeks each way
      });
      out.sort(function (a, b) { return a.date - b.date; });
      fixCache[compKey] = { data: out, at: Date.now() };
      P.bus.emit('football-side');
    });
    return fixCache[compKey].data;
  };

  /* one match in detail (OK on a finished match → Match details): stats, line-ups and the goals, cards and changes */
  var sumCache = {};
  F.summary = function (m, fresh) {
    var c = F.byKey[m.comp]; if (!c) return Promise.reject(new Error('unknown competition'));
    var hit = sumCache[m.id];
    if (!fresh && hit && Date.now() - hit.at < 10 * 60000) return Promise.resolve(hit.data);
    return P.json(BASE + c.slug + '/summary?event=' + m.id, {}, 12000).then(function (d) {
      var side = function (tid) { return String(tid) === m.home.id ? 'home' : 'away'; };
      var stats = {};
      ((d.boxscore || {}).teams || []).forEach(function (t) {
        var sd = side((t.team || {}).id);
        (t.statistics || []).forEach(function (x) { (stats[x.name] = stats[x.name] || { label: x.label || x.name })[sd] = x.displayValue; });
      });
      var lineups = { home: [], away: [] }, formation = {};
      (d.rosters || []).forEach(function (r) {
        var sd = r.homeAway || side((r.team || {}).id);
        formation[sd] = r.formation || '';
        (r.roster || []).forEach(function (p) {
          var a = p.athlete || {};
          (lineups[sd] = lineups[sd] || []).push({ name: a.displayName || '', last: a.lastName || (a.displayName || '').split(' ').slice(-1)[0], num: p.jersey || '',
            pos: ((p.position || {}).abbreviation) || '', posName: ((p.position || {}).displayName || (p.position || {}).name) || '',
            place: +p.formationPlace || 0, starter: !!p.starter, off: !!p.subbedOut, on: !!p.subbedIn });
        });
      });
      var events = (d.keyEvents || []).map(function (e) {
        var ty = ((e.type || {}).text || '');
        var kind = /goal|penalty - scored/i.test(ty) ? 'goal' : /red/i.test(ty) ? 'red' : /yellow/i.test(ty) ? 'yellow' : /substitution/i.test(ty) ? 'sub' : null;
        if (!kind) return null;
        var who = (e.participants || []).map(function (x) { return (x.athlete || {}).displayName; }).filter(Boolean);
        return { kind: kind, min: (e.clock || {}).displayValue || '', side: side((e.team || {}).id), who: who, own: /own goal/i.test(ty + ' ' + (e.text || '')), pen: /penalty/i.test(ty) };
      }).filter(Boolean);
      var data = { stats: stats, lineups: lineups, formation: formation, events: events };
      sumCache[m.id] = { data: data, at: Date.now() };
      return data;
    });
  };

  var tablesAt = 0, loading = false;
  F.refresh = function (onlyLive) {
    if (loading) return Promise.resolve();
    loading = true;
    var comps = P.S.get('comps');
    var want = COMPS.filter(function (c) {
      if (!comps[c.k] && c.k !== 'spl') return false;
      if (!onlyLive) return true;
      var now = Date.now();
      return (F.matches[c.k] || []).some(function (m) { return m.state === 'in' || (m.state === 'pre' && m.date - now < 15 * 60000 && now - m.date < 4 * 3600000); });
    });
    var jobs = [];
    if (!onlyLive && Date.now() - tablesAt > 6 * 3600000) {
      tablesAt = Date.now();
      jobs.push(loadTable('ksa.1'));
      if (comps.epl) jobs.push(loadTable('eng.1'));
      if (comps.liga) jobs.push(loadTable('esp.1'));
    }
    return Promise.all(jobs).then(function () {
      var fails = 0;
      return Promise.all(want.map(function (c) { return loadComp(c, onlyLive).catch(function () { fails++; }); })).then(function () {
        F.error = fails && fails === want.length ? "Couldn't load matches" : null;
      });
    }).then(function () {
      F.rejudge();
      F.loadedAt = Date.now(); F.ready = true; loading = false;
      P.bus.emit('football');
    }, function () { loading = false; });
  };
  F.rejudge = function () { Object.keys(F.matches).forEach(function (k) { F.matches[k].forEach(judge); }); };
  P.bus.on('setting:favs', function () { F.rejudge(); P.bus.emit('football'); });
  P.bus.on('setting:euBigOnly', function () { F.rejudge(); P.bus.emit('football'); });
  P.bus.on('setting:comps', function () { F.refresh(); });

  F.anyLiveSoon = function () {
    var now = Date.now();
    return F.day(0).some(function (m) { return m.state === 'in' || (m.state === 'pre' && m.date - now < 15 * 60000 && m.date - now > -3 * 3600000); });
  };

  F.teamChoices = function () {
    var names = F.table.map(function (r) { return r.name; });
    EXTRA_TEAMS.forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    P.S.get('favs').forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    return names;
  };

  /* ---------- following a match (alerts for it, also once it's started) ---------- */
  F.isFollowed = function (m) { return P.S.get('follows').some(function (r) { return r.id === m.id; }); };
  F.toggleFollow = function (m) {
    var now = Date.now();
    var list = P.S.get('follows').filter(function (r) { return r.id !== m.id && now - r.at < 5 * 3600000; });   // old ones go
    var on = !F.isFollowed(m);
    if (on) list.push({ id: m.id, at: +m.date });
    P.S.set('follows', list);
    return on;
  };
  /* does this match give alerts? */
  F.alerting = function (m) {
    var w = P.S.get('alertWho');
    if (w.mine && m.fav) return true;
    if (w.followed && (F.isFollowed(m) || F.hasReminder(m))) return true;
    if (w.big && m.big) return true;
    return !!P.S.get('alertComps')[m.comp];
  };

  /* ---------- reminders (10 minutes before kick-off, while Plume is on screen) ---------- */
  F.hasReminder = function (m) { return P.S.get('reminders').some(function (r) { return r.id === m.id; }); };
  F.toggleReminder = function (m) {
    var list = P.S.get('reminders').filter(function (r) { return r.id !== m.id; });
    var on = list.length === P.S.get('reminders').length;
    if (on) list.push({ id: m.id, at: +m.date, title: m.home.short + ' vs ' + m.away.short, fired: false });
    P.S.set('reminders', list);
    return on;
  };
  F.dueReminder = function () {
    var now = Date.now(), list = P.S.get('reminders'), due = null, changed = false;
    list = list.filter(function (r) { var keep = now - r.at < 3 * 3600000; if (!keep) changed = true; return keep; });
    list.forEach(function (r) { if (!r.fired && r.at - now <= 10 * 60000) { r.fired = true; due = r; changed = true; } });
    if (changed) P.S.set('reminders', list);
    return due;
  };

  P.Football = F;
})();
