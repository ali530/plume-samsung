/* A show's seasons and episodes (hold OK on a Continue Watching episode → Episodes).
   Season tabs on top, episodes below; OK plays one in Plume's player, from where you stopped if you started it. */
(function () {
  var W = { open_: false };
  var st = null;
  var root = function () { return P.$('#show'); };

  function srv() { return (P.S.get('plex') || {}).server; }
  function get(path) { var s = srv(); return P.json(s.uri + path, { headers: P.Plex.hdrs(s.token) }, 12000); }
  function meta(d) { return ((d && d.MediaContainer) || {}).Metadata || []; }
  function img(path, w, h) {
    var s = srv(); if (!path) return '';
    return s.uri + '/photo/:/transcode?width=' + w + '&height=' + h + '&minSize=1&upscale=1&url=' + encodeURIComponent(path) + '&X-Plex-Token=' + encodeURIComponent(s.token);
  }

  function epLine(e) {
    var done = e.viewCount > 0 && !e.viewOffset, part = e.viewOffset && e.duration;
    var bits = [];
    if (part) bits.push(P.minutesLeft(e.duration - e.viewOffset));
    else if (e.duration) bits.push(P.t('{n} min', { n: Math.round(e.duration / 60000) }));
    if (done) bits.push(P.t('Watched'));
    return bits.join(' · ');
  }

  function render() {
    if (!st) return;
    var r = root();
    var head = '<div class="c-head"><button class="cbtn" data-z="back">' + P.icon('back') + P.t('Back') + '</button><h1>' + P.esc(st.title) + '</h1></div>';
    var tabs = '<div class="sh-tabs">' + st.seasons.map(function (s, i) {
      return '<button class="day' + (i === st.si ? ' on' : '') + '" data-z="s' + i + '">' + P.esc(P.t(s.title || ('Season ' + s.index))) + '</button>';
    }).join('') + '</div>';
    var list;
    if (st.loading) list = '<div class="c-empty">' + P.t('Loading…') + '</div>';
    else if (st.error) list = '<div class="c-empty">' + P.esc(st.error) + '</div>';
    else list = st.eps.map(function (e, i) {
      var pct = e.viewOffset && e.duration ? Math.round(e.viewOffset / e.duration * 100) : (e.viewCount > 0 ? 100 : 0);
      return '<div class="sh-ep' + (e.ratingKey === st.current ? ' here' : '') + '" data-z="e' + i + '">' +
        '<div class="sh-th">' + (e.thumb ? '<img src="' + P.esc(img(e.thumb, 384, 216)) + '" alt="" decoding="async">' : '') +
        (pct ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '') + '</div>' +
        '<div class="sh-tx"><div class="sh-t">' + P.t('E') + e.index + ' · ' + P.esc(e.title) + '</div>' +
        '<div class="sh-s">' + P.esc(epLine(e)) + '</div>' +
        (e.summary ? '<div class="sh-d">' + P.esc(e.summary) + '</div>' : '') + '</div></div>';
    }).join('');
    var html = head + tabs + '<div class="sh-list" id="shList">' + list + '</div>';
    if (r._html !== html) { r._html = html; r.innerHTML = html; }
    paint();
  }
  function paint() {
    var r = root();
    P.$$('.focus', r).forEach(function (e) { e.classList.remove('focus'); });
    var key = st.zone === 'back' ? 'back' : st.zone === 'tabs' ? 's' + st.ti : 'e' + st.ei;
    var el = P.$('[data-z="' + key + '"]', r);
    if (el) el.classList.add('focus');
    if (el && st.zone === 'eps') {
      var box = P.$('#shList'), top = el.offsetTop - box.offsetTop;
      if (top - box.scrollTop > box.clientHeight - el.offsetHeight - 30) box.scrollTop = top - box.clientHeight + el.offsetHeight + 30;
      if (top - box.scrollTop < 20) box.scrollTop = Math.max(0, top - 20);
    }
  }

  function loadSeason(i, focusKey) {
    st.si = i; st.ti = i; st.loading = true; st.eps = []; render();
    var mine = st;
    get('/library/metadata/' + st.seasons[i].ratingKey + '/children').then(function (d) {
      if (st !== mine) return;
      st.loading = false; st.error = null;
      st.eps = meta(d);
      var at = st.eps.findIndex(function (e) { return e.ratingKey === focusKey; });
      if (at < 0) at = st.eps.findIndex(function (e) { return !(e.viewCount > 0 && !e.viewOffset); });   // first not watched
      st.ei = Math.max(0, at);
      render();
    }).catch(function () { if (st === mine) { st.loading = false; st.error = P.t("Couldn't reach your Plex server"); render(); } });
  }

  function play(e) {
    P.Plex.open({ key: String(e.ratingKey), title: st.title, offset: e.viewOffset || 0, copies: [] });
  }

  var layer = {
    name: 'show',
    key: function (k) {
      if (!st) return;
      if (k === 'back') { W.close(); return; }
      if (st.zone === 'back') {
        if (k === 'ok') { W.close(); return; }
        if (k === 'down') st.zone = 'tabs';
        paint(); return;
      }
      if (st.zone === 'tabs') {
        if (k === 'left') st.ti = Math.max(0, st.ti - 1);
        if (k === 'right') st.ti = Math.min(st.seasons.length - 1, st.ti + 1);
        if (k === 'up') st.zone = 'back';
        if (k === 'ok' && st.ti !== st.si) { loadSeason(st.ti); st.zone = 'eps'; return; }
        if ((k === 'down' || k === 'ok') && st.eps.length) st.zone = 'eps';
        paint(); return;
      }
      if (k === 'up') { if (st.ei === 0) { st.zone = 'tabs'; st.ti = st.si; } else st.ei--; paint(); return; }
      if (k === 'down') { st.ei = Math.min(st.eps.length - 1, st.ei + 1); paint(); return; }
      if (k === 'ok' && st.eps[st.ei]) { play(st.eps[st.ei]); return; }
    },
    // back from the player: positions and watched marks have changed
    resume: function () { if (st && st.seasons.length) loadSeason(st.si, st.eps[st.ei] && st.eps[st.ei].ratingKey); }
  };

  W.open = function (card) {
    st = { title: card.title, seasons: [], eps: [], si: 0, ti: 0, ei: 0, zone: 'eps', loading: true, current: card.key };
    W.open_ = true;
    root().hidden = false; document.body.classList.add('overlay-on');
    P.UI.push(layer);
    render();
    var mine = st;
    get('/library/metadata/' + card.key).then(function (d) {
      var m = meta(d)[0];
      if (!m || !m.grandparentRatingKey) throw new Error('not a show');
      st.title = m.grandparentTitle || st.title;
      return get('/library/metadata/' + m.grandparentRatingKey + '/children').then(function (d2) {
        if (st !== mine) return;
        st.seasons = meta(d2).filter(function (s) { return s.type === 'season'; });
        if (!st.seasons.length) throw new Error('no seasons');
        var i = st.seasons.findIndex(function (s) { return String(s.ratingKey) === String(m.parentRatingKey); });
        loadSeason(Math.max(0, i), m.ratingKey);
      });
    }).catch(function () { if (st === mine) { st.loading = false; st.error = "Couldn't load this show"; render(); } });
  };
  W.close = function () {
    st = null; W.open_ = false;
    var r = root(); r.hidden = true; r.innerHTML = ''; r._html = '';
    document.body.classList.remove('overlay-on');
    P.UI.pop(layer);
  };

  P.Show = W;
})();
