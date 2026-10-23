/* Match alerts: kick-off, goals and full time for your teams' matches and the ones you set a reminder for.
   They pop up over whatever Plume is showing, including the PS5 or beIN shown inside Plume, and go away by
   themselves after 10 seconds. They never take the remote: Back and every other button keep working as usual. */
(function () {
  var A = { seen: {}, queue: [], showing: false };
  var el = null, hideT = null;

  function watched(m) { return m.fav || P.Football.hasReminder(m); }
  A.watchedLive = function () {
    var now = Date.now();
    return P.Football.day(0).some(function (m) {
      return watched(m) && (m.state === 'in' || (m.state === 'pre' && m.date - now < 5 * 60000 && now - m.date < 3 * 3600000));
    });
  };

  function score(m) { return [parseInt(m.home.score, 10) || 0, parseInt(m.away.score, 10) || 0]; }

  /* compare with what Plume saw last time */
  A.check = function () {
    var F = P.Football, out = [];
    [-1, 0].forEach(function (d) {
      F.day(d).forEach(function (m) {
        if (!watched(m)) return;
        var now = { state: m.state, sc: score(m) }, before = A.seen[m.id];
        A.seen[m.id] = now;
        if (!before) return;                         // first look: nothing to compare with
        if (before.state === 'pre' && now.state === 'in') out.push({ at: Date.now(), kind: 'Kick-off', m: m });
        if (now.state !== 'pre') {
          ['home', 'away'].forEach(function (side, i) {
            var n = now.sc[i] - before.sc[i];
            if (n > 0) {
              var g = m.goals.filter(function (x) { return x.side === side; }).slice(-1)[0];
              out.push({ at: Date.now(), kind: 'Goal', m: m, team: m[side], who: g ? g.who + (g.min ? ' ' + g.min : '') + (g.pen ? ' (pen)' : '') + (g.og ? ' (og)' : '') : '' });
            }
          });
        }
        if (before.state === 'in' && now.state === 'post') out.push({ at: Date.now(), kind: 'Full time', m: m });
      });
    });
    if (!P.S.get('matchAlerts')) return;
    out.forEach(function (a) { A.queue.push(a); });
    next();
  };

  function html(a) {
    var m = a.m, F = P.Football, sc = score(m);
    var head = a.kind === 'Goal' ? 'Goal · ' + P.esc(a.team.short) : a.kind;
    var line = (a.kind === 'Goal' && a.who ? P.esc(a.who) + ' · ' : '') + P.esc(m.compName) + (m.state === 'in' && F.statusText(m) ? ' · ' + P.esc(F.statusText(m)) : '');
    return '<div class="al-k' + (a.kind === 'Goal' ? ' goal' : '') + '">' + (a.kind === 'Goal' ? P.icon('ball') : '') + head + '</div>' +
      '<div class="al-m">' + P.UI.crest(m.home, 'sm') + '<span>' + P.esc(m.home.short) + '</span><b>' + sc[0] + ' – ' + sc[1] + '</b><span>' + P.esc(m.away.short) + '</span>' + P.UI.crest(m.away, 'sm') + '</div>' +
      '<div class="al-l">' + line + '</div>';
  }
  function next() {
    if (A.showing || !A.queue.length) return;
    // not over a film you're watching in Plume; they wait until you stop
    if (document.hidden || document.body.classList.contains('playing')) return;
    var a = A.queue.shift();
    if (Date.now() - a.at > 10 * 60000) { next(); return; }   // too old to be news
    if (!el) { el = P.el('div', 'alert'); el.id = 'alert'; document.body.appendChild(el); }
    el.innerHTML = html(a);
    A.showing = true;
    requestAnimationFrame(function () { el.classList.add('on'); });
    clearTimeout(hideT);
    hideT = setTimeout(function () {
      el.classList.remove('on');
      setTimeout(function () { A.showing = false; next(); }, 400);
    }, 10000);
  }
  A.next = next;
  // alerts that waited for a film to end: keep only the last few minutes' worth
  setInterval(function () { if (A.queue.length > 6) A.queue = A.queue.slice(-6); next(); }, 5000);

  P.bus.on('football', A.check);
  P.Alerts = A;
})();
