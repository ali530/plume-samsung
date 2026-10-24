/* The sleep screen: drifting mountain and nature photos, a large thin clock, and today's matches.
   It starts after the idle time set in Settings while Plume is on screen; any button brings you back. */
(function () {
  var U = 'https://images.unsplash.com/';
  var Q = '?fm=jpg&q=78&w=1920&h=1080&fit=crop&auto=format';
  /* free-to-use photos (Unsplash licence), loaded from Unsplash when the sleep screen runs */
  var PHOTOS = [
    'photo-1642870776984-f808ed7acc14', 'photo-1777813317629-6874ec3f6a26', 'photo-1661511762608-fda6b7b45f18',
    'photo-1775641993731-266c30dc1833', 'photo-1578311363088-985cbc4616c6', 'photo-1629153990259-4ece816fb85d',
    'photo-1783638204102-c20f956b5663', 'photo-1768928969838-c29382c18f4e', 'photo-1640794722692-ff3eaeec02b7',
    'photo-1773685945461-819ac9d77dbe', 'photo-1652853289684-313e60eb5aee', 'photo-1544279049-e299ff972963',
    'photo-1608893268570-76fba26b6d58', 'photo-1701614753266-9ad5ba4f86ad', 'photo-1688735369158-8ee01eabc64b'
  ].map(function (id) { return U + id + Q; });
  var LOCAL = ['img/rockies-day.jpg', 'img/rockies-dusk.jpg'];

  var Z = { active: false, last: Date.now() };
  var order = [], at = 0, swapT = null, tickT = null, layerIdx = 0;
  var DRIFTS = ['drift-a', 'drift-b', 'drift-c', 'drift-d'];

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function build() {
    var s = P.$('#sleep');
    // Samsung's own video player (1 pixel, silent) plays a black loop: the TV then counts the screen as "watching"
    s.innerHTML = '<object class="awake" id="zAwake" type="application/avplayer"></object>' +
      '<div class="ph" id="ph0"></div><div class="ph" id="ph1"></div><div class="veil"></div>' +
      '<div class="z-when"><div class="z-clock" id="zClock"></div><div class="z-date" id="zDate"></div></div>' +
      '<div class="z-matches" id="zMatches"></div>';
  }

  function nextPhoto() {
    var list = P.TV.online() ? order : LOCAL;
    if (!list.length) list = LOCAL;
    var src = list[at++ % list.length];
    var img = new Image();
    img.onload = function () {
      if (!Z.active) return;
      layerIdx = 1 - layerIdx;
      var el = P.$('#ph' + layerIdx), other = P.$('#ph' + (1 - layerIdx));
      el.style.backgroundImage = 'url("' + src + '")';
      el.className = 'ph ' + DRIFTS[Math.floor(Math.random() * DRIFTS.length)];
      void el.offsetWidth;
      el.classList.add('on'); other.classList.remove('on');
    };
    img.onerror = function () { if (Z.active && list !== LOCAL) { order.splice((at - 1) % order.length, 1); nextPhoto(); } };
    img.src = src;
  }

  function tick() {
    var d = new Date();
    P.$('#zClock').textContent = P.clockText(d);
    P.$('#zDate').innerHTML = P.esc(P.dateText(d)) + (P.Weather.now ? '<span class="z-w">' + P.Weather.html() + '<span>' + P.esc(P.S.get('city')) + '</span></span>' : '');
    var F = P.Football, list = F.day(0).filter(function (m) { return m.state === 'in' || (m.state === 'pre' && m.date > Date.now()); });
    list.sort(function (a, b) { return (a.state === 'in' ? 0 : 1) - (b.state === 'in' ? 0 : 1) || (b.fav - a.fav) || (b.big - a.big) || (a.date - b.date); });
    P.$('#zMatches').innerHTML = list.slice(0, 3).map(function (m) {
      var st = '<span class="z-live">' + (m.state === 'in' ? P.esc(F.statusText(m)) : '') + '</span>';
      return '<div class="z-m">' + st + '<span class="h">' + P.esc(m.home.short) + '</span>' + P.UI.crest(m.home, 'sm') +
        '<b>' + F.centreText(m) + '</b>' + P.UI.crest(m.away, 'sm') + '<span>' + P.esc(m.away.short) + '</span></div>';
    }).join('');
  }

  /* ---------- the silent video in Samsung's player, and a log for Settings → About ---------- */
  // the last 3 sleep sessions, kept on the TV so a session survives Plume being sent to the background
  Z.history = (function () { try { return JSON.parse(localStorage.getItem('plume.sleepLog')) || []; } catch (e) { return []; } })();
  Z.check = Z.history[0] || 'not started yet';
  var loopOn = false, played = false, newSession = false;
  function hhmmss(d) { return P.hhmm(d) + ':' + P.pad(d.getSeconds()); }
  function keep() {
    if (newSession) { Z.history.unshift(Z.check); newSession = false; } else Z.history[0] = Z.check;
    Z.history = Z.history.slice(0, 3);
    try { localStorage.setItem('plume.sleepLog', JSON.stringify(Z.history)); } catch (e) {}
  }
  function note(t) { Z.check = t; P.log('sleep', t); keep(); }
  function add(t) { Z.check += t; keep(); }
  Z.showLog = function () {
    P.UI.dialog({ title: 'Sleep screen check', wide: true, body: Z.history.length ? Z.history.map(function (h, i) {
      return '<p' + (i ? ' style="opacity:.6"' : '') + '>' + P.esc(h) + '</p>'; }).join('') : '<p>No sleep screen yet.</p>',
      buttons: [{ label: 'Close' }] });
  };
  /* Where the video file is. Samsung's player won't read files inside an app's own folder, so Plume copies the
     tiny video once to the TV's Downloads storage (Downloads/Plume), which the player can read, like a USB stick.
     The older in-app addresses stay as a last resort. Whatever works is remembered. */
  var URLS = null, dl = { state: 'not tried', uris: [] };
  var SRC = 'wgt-package/img/keepawake-720.mp4', DIR = 'downloads/Plume', DST = 'downloads/Plume/keepawake-720.mp4';
  function strip(u) { return decodeURIComponent(String(u).replace(/^file:\/\//, '')); }
  function copyToDownloads(done) {
    var fs = window.tizen && tizen.filesystem;
    if (!fs) { dl.state = 'no file system'; done(); return; }
    var finish = function (state) {
      dl.state = state;
      try { var u = fs.toURI ? fs.toURI(DST) : null; if (u) dl.uris = [strip(u), u]; } catch (e) {}
      done();
    };
    try {
      if (fs.copyFile) {          // Tizen 5 and later
        var copy = function () { fs.copyFile(SRC, DST, true, function () { finish('copied'); }, function (e) { finish('copy refused (' + (e && e.name || e) + ')'); }); };
        try { if (fs.isFile && fs.isFile(DST)) { finish('already there'); return; } } catch (e) {}
        try { fs.createDirectory(DIR, true, copy, copy); } catch (e) { copy(); }
      } else {                    // older TVs
        fs.resolve('downloads', function (d) {
          var go = function (dir) {
            fs.resolve(SRC, function (f) {
              f.parent.copyTo(f.fullPath, dir.fullPath + '/keepawake-720.mp4', true, function () {
                dl.uris = [dir.fullPath + '/keepawake-720.mp4', dir.toURI() + '/keepawake-720.mp4'];
                dl.state = 'copied'; done();
              }, function (e) { dl.state = 'copy refused (' + (e && e.name || e) + ')'; done(); });
            }, function (e) { dl.state = 'video not found (' + (e && e.name || e) + ')'; done(); }, 'r');
          };
          try { go(d.resolve('Plume')); } catch (e) { try { go(d.createDirectory('Plume')); } catch (e2) { go(d); } }
        }, function (e) { dl.state = 'Downloads refused (' + (e && e.name || e) + ')'; done(); }, 'rw');
      }
    } catch (e) { dl.state = 'copy failed (' + e.message + ')'; done(); }
  }
  function urls() {
    var href = location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, '') + 'img/keepawake-720.mp4';
    var list = dl.uris.concat([strip(href), href, 'img/keepawake-720.mp4']).filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    var good = null; try { good = localStorage.getItem('plume.awakeUrl'); } catch (e) {}
    if (good && list.indexOf(good) > 0) { list.splice(list.indexOf(good), 1); list.unshift(good); }
    return list;
  }

  function startLoop() {
    var A = window.webapis && webapis.avplay;
    if (!A) { note('Samsung player not available'); return; }
    var started = new Date(), lastKey = new Date(Z.last);
    played = false; loopOn = true; newSession = true;
    note('Last button ' + hhmmss(lastKey) + ' · sleep screen ' + hhmmss(started) + ' · silent video starting…');
    var go = function () { add(' · Downloads: ' + dl.state); URLS = urls(); tryUrl(0); };
    if (dl.state === 'copied' || dl.state === 'already there') go(); else copyToDownloads(function () { if (loopOn) go(); });
  }
  function tryUrl(i) {
    var A = webapis.avplay;
    if (!loopOn) return;
    if (i >= URLS.length) { add(' · no address worked'); return; }
    var url = URLS[i], short = String(url).slice(-48);
    var next = function (why) { add(' · try ' + (i + 1) + ' refused (' + why + ') [' + short + ']'); try { A.close(); } catch (e) {} tryUrl(i + 1); };
    var failedOnce = false, fail = function (e) { if (failedOnce || !loopOn) return; failedOnce = true; next(e && (e.name || e.message) || e); };
    var step = 'open';
    try {
      try { A.stop(); A.close(); } catch (e) {}
      A.open(url);
      // a small picture in the corner, under the sleep screen's photos; the TV may refuse a 1-pixel size, so try a few
      step = 'size';
      var sized = [[0, 0, 64, 36], [0, 0, 1920, 1080]].some(function (r) { try { A.setDisplayRect(r[0], r[1], r[2], r[3]); return true; } catch (e) { return false; } });
      if (!sized) add(' · (size refused, kept the default)');
      step = 'listener';
      A.setListener({
        oncurrentplaytime: function () {
          if (played || !loopOn) return;
          played = true;
          try { localStorage.setItem('plume.awakeUrl', url); } catch (e) {}
          add(' · playing since ' + hhmmss(new Date()) + ' (try ' + (i + 1) + ' [' + short + '])');
        },
        onstreamcompleted: function () { if (!loopOn) return; try { A.seekTo(0, function () { A.play(); }, function () { restartLoop(); }); } catch (e) { restartLoop(); } },
        onerror: function (e) { if (!played) fail('player: ' + (e && (e.name || e.message) || e)); else add(' · stopped by the TV (' + (e && e.name || e) + ')'); }
      });
      step = 'prepare';
      A.prepareAsync(function () { if (!loopOn) return; try { A.play(); } catch (e) { fail('play: ' + (e.name || e.message)); } },
        function (e) { fail('prepare: ' + (e && (e.name || e.message) || e)); });
    } catch (e) { fail(step + ': ' + (e && (e.name || e.message) || e)); }
  }
  function restartLoop() { if (loopOn) { try { webapis.avplay.stop(); webapis.avplay.close(); } catch (e) {} tryUrl(0); } }
  function stopLoop(keepNote) {
    loopOn = false;
    try { var A = webapis.avplay; A.stop(); A.close(); } catch (e) {}
    if (!keepNote && /playing since/.test(Z.check)) add(' · until ' + hhmmss(new Date()));
  }
  // the TV's black screen sends Plume to the background: note when, so we can see what the TV reacted to
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && Z.active) add(' · hidden by the TV at ' + hhmmss(new Date()));
    else if (!document.hidden && Z.active) add(' · back at ' + hhmmss(new Date()));
  });

  /* the same silent video without the sleep screen: while highlights play in Plume (Samsung's screen would come at 2 min) */
  Z.keepAwake = function (on) {
    if (!on) { if (loopOn && !Z.active) stopLoop(); return; }
    if (loopOn) return;
    if (!document.querySelector('object[type="application/avplayer"]')) {
      var o = document.createElement('object'); o.type = 'application/avplayer'; o.id = 'awakeObj';
      o.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none';
      document.body.appendChild(o);
    }
    startLoop();
  };

  Z.show = function () {
    if (Z.active) return;
    Z.active = true;
    var s = P.$('#sleep');
    build();
    s.classList.toggle('lightmode', !P.Home.dark);
    startLoop();
    if (!order.length) order = shuffle(PHOTOS);
    s.hidden = false;
    requestAnimationFrame(function () { s.classList.add('on'); });
    tick(); tickT = setInterval(tick, 10000);
    nextPhoto(); swapT = setInterval(nextPhoto, 60000);
  };
  Z.hide = function () {
    if (!Z.active) return;
    Z.active = false;
    clearInterval(swapT); clearInterval(tickT);
    stopLoop();
    var s = P.$('#sleep');
    s.classList.remove('on');
    setTimeout(function () { if (!Z.active) { s.hidden = true; s.innerHTML = ''; } }, 600);
    Z.poke();
  };
  Z.poke = function () { Z.last = Date.now(); };

  Z.init = function () {
    setInterval(function () {
      var mins = P.S.get('sleepMin');
      var c = document.body.classList;
      if (!mins || Z.active || document.hidden || c.contains('input-on') || c.contains('playing')) { if (c.contains('playing')) Z.poke(); return; }
      if (Date.now() - Z.last >= mins * 60000) Z.show();
    }, 3000);   // checked often, so it starts on time (before Samsung's own screen)
    P.bus.on('football', function () { if (Z.active) tick(); });
  };

  P.Sleep = Z;
})();
