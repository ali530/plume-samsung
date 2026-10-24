/* Match alerts: kick-off, goals, red cards, half time, second half, missed penalties and full time, for the matches
   you choose in Settings → Football → Match alerts (your teams, matches you follow or set a reminder for, big matches,
   whole competitions). They pop up over whatever Plume is showing, including the PS5 or beIN shown inside Plume, and
   go away by themselves. They never take the remote: Back and every other button keep working as usual. */
(function () {
  var A = { seen: {}, queue: [], showing: false };
  var el = null, hideT = null;

  function watched(m) { return P.Football.alerting(m); }
  A.watchedLive = function () {
    var now = Date.now();
    return P.Football.day(0).some(function (m) {
      return watched(m) && (m.state === 'in' || (m.state === 'pre' && m.date - now < 5 * 60000 && now - m.date < 3 * 3600000));
    });
  };

  function score(m) { return [parseInt(m.home.score, 10) || 0, parseInt(m.away.score, 10) || 0]; }
  function isHT(m) { return m.state === 'in' && /half_?time/i.test(m.statusName); }
  function who(e) { return e ? e.who + (e.min ? ' ' + e.min : '') : ''; }

  /* compare with what Plume saw last time */
  A.check = function () {
    var F = P.Football, out = [], what = P.S.get('alertWhat');
    [-1, 0].forEach(function (d) {
      F.day(d).forEach(function (m) {
        var now = { state: m.state, ht: isHT(m), sc: score(m), reds: (m.reds || []).length, pm: (m.pmiss || []).length }, before = A.seen[m.id];
        A.seen[m.id] = now;                          // every match is tracked, so following a live one starts from now
        if (!before || !watched(m)) return;
        var t = Date.now();
        if (before.state === 'pre' && now.state === 'in' && what.kickoff) out.push({ at: t, kind: 'Kick-off', m: m });
        if (now.state !== 'pre') {
          ['home', 'away'].forEach(function (side, i) {
            if (now.sc[i] > before.sc[i] && what.goal) {
              var g = m.goals.filter(function (x) { return x.side === side; }).slice(-1)[0];
              out.push({ at: t, kind: 'Goal', m: m, team: m[side], who: g ? who(g) + (g.pen ? ' (pen)' : '') + (g.og ? ' (og)' : '') : '' });
            }
          });
          if (now.reds > before.reds && what.red) (m.reds || []).slice(before.reds).forEach(function (r) {
            out.push({ at: t, kind: 'Red card', m: m, team: m[r.side], who: who(r) });
          });
          if (now.pm > before.pm && what.pen) (m.pmiss || []).slice(before.pm).forEach(function (r) {
            out.push({ at: t, kind: r.saved ? 'Penalty saved' : 'Penalty missed', m: m, team: m[r.side], who: who(r) });
          });
        }
        if (!before.ht && now.ht && what.ht) out.push({ at: t, kind: 'Half time', m: m });
        if (before.ht && !now.ht && now.state === 'in' && what.sh) out.push({ at: t, kind: 'Second half', m: m });
        if (before.state === 'in' && now.state === 'post' && what.ft) out.push({ at: t, kind: 'Full time', m: m });
      });
    });
    if (!P.S.get('matchAlerts')) return;
    out.forEach(function (a) { A.queue.push(a); });
    next();
  };

  function html(a) {
    var m = a.m, F = P.Football, sc = score(m);
    var head = a.team ? P.esc(a.kind) + ' · ' + P.esc(a.team.short) : P.esc(a.kind);
    var line = (a.who ? P.esc(a.who) + ' · ' : '') + P.esc(m.compName) + (m.state === 'in' && F.statusText(m) && a.kind !== 'Half time' ? ' · ' + P.esc(F.statusText(m)) : '');
    var cls = a.kind === 'Goal' ? ' goal' : a.kind === 'Red card' ? ' red' : '';
    return '<div class="al-k' + cls + '">' + (a.kind === 'Goal' ? P.icon('ball') : a.kind === 'Red card' ? '<i class="card"></i>' : '') + head + '</div>' +
      '<div class="al-m">' + P.UI.crest(m.home, 'sm') + '<span>' + P.esc(m.home.short) + '</span><b>' + sc[0] + ' – ' + sc[1] + '</b><span>' + P.esc(m.away.short) + '</span>' + P.UI.crest(m.away, 'sm') + '</div>' +
      '<div class="al-l">' + line + '</div>';
  }
  function next() {
    if (A.showing || !A.queue.length) return;
    // over a film you're watching in Plume: small in a corner if you chose so, otherwise they wait until you stop
    var film = document.body.classList.contains('playing');
    if (document.hidden || (film && !P.S.get('alertOverFilms'))) return;
    var a = A.queue.shift();
    if (Date.now() - a.at > 10 * 60000) { next(); return; }   // too old to be news
    if (!el) { el = P.el('div', 'alert'); el.id = 'alert'; document.body.appendChild(el); }
    el.innerHTML = html(a);
    el.classList.toggle('mini', film);
    A.showing = true;
    requestAnimationFrame(function () { el.classList.add('on'); });
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      el.classList.remove('on');
      setTimeout(function () { A.showing = false; next(); }, 400);
    }, (P.S.get('alertSecs') || 10) * 1000);
  }
  A.next = next;
  // alerts that waited for a film to end: keep only the last few minutes' worth
  setInterval(function () { if (A.queue.length > 6) A.queue = A.queue.slice(-6); next(); }, 5000);

  P.bus.on('football', A.check);
  P.Alerts = A;
})();
