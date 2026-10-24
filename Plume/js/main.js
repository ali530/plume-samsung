/* Start-up, the remote control, and the background refresh schedule. */
(function () {
  var K = P.TV.KEY;
  var NAMES = {}; NAMES[K.LEFT] = 'left'; NAMES[K.RIGHT] = 'right'; NAMES[K.UP] = 'up'; NAMES[K.DOWN] = 'down';
  NAMES[K.BACK] = 'back'; NAMES[K.BACKSPACE] = 'back'; NAMES[K.ESC] = 'back';
  // remote media buttons (used by the player): Play/Pause, Play, Pause, Fast-forward, Rewind, Stop
  NAMES[10252] = 'pp'; NAMES[415] = 'pp'; NAMES[19] = 'pp'; NAMES[417] = 'ff'; NAMES[412] = 'rw'; NAMES[413] = 'stop';

  /* OK: a short press acts, holding it (0.6 s) opens the tile's menu */
  var okDown = false, okTimer = null, okHeld = false, swallowUp = false;

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode;
    var known = code === K.ENTER || NAMES[code];
    if (known) e.preventDefault();
    P.Sleep.poke();
    if (P.Sleep.active) { if (!e.repeat) { P.Sleep.hide(); swallowUp = code === K.ENTER; } return; }
    if (code === K.ENTER) {
      if (okDown) return; // key repeat while held
      okDown = true; okHeld = false;
      okTimer = setTimeout(function () { okHeld = true; move('hold'); }, 600);
      return;
    }
    if (NAMES[code]) move(NAMES[code], e.repeat);
  });

  /* Arrows: at most one move per frame. Holding a key sends presses faster than the TV can draw; extra ones
     are dropped so focus stays with your finger instead of catching up afterwards. */
  var queue = [], lastMove = 0, running = false;
  function move(name, repeat) {
    var now = performance.now();
    if (repeat && (queue.length || now - lastMove < 90)) return;   // held key: drop what the screen can't keep up with
    queue.push([name, now]);                                       // separate presses are all kept, one per frame
    if (!running) { running = true; requestAnimationFrame(step); }
  }
  function step() {
    var q = queue.shift();
    if (!q) { running = false; return; }
    lastMove = performance.now();
    try { P.UI.key(q[0]); } catch (e) { P.log('key', q[0], e && e.message); }  // never let one error freeze the remote
    var t0 = q[1];
    requestAnimationFrame(function () { P.speed.add(performance.now() - t0); });
    requestAnimationFrame(step);
  }
  /* speed check: how long a press takes to show on screen (Settings → About) */
  P.speed = { list: [], add: function (ms) { this.list.push(ms); if (this.list.length > 40) this.list.shift(); },
    text: function () {
      if (!this.list.length) return 'Move around the home screen first';
      var a = this.list.slice().sort(function (x, y) { return x - y; });
      return 'Typical ' + Math.round(a[a.length >> 1]) + ' ms · slowest ' + Math.round(a[a.length - 1]) + ' ms';
    } };
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== K.ENTER) return;
    if (swallowUp) { swallowUp = false; okDown = false; return; }
    clearTimeout(okTimer);
    if (okDown && !okHeld) move('ok');
    okDown = false; okHeld = false;
  });

  /* ---------- schedule ---------- */
  var fullAt = Date.now(), liveAt = 0;
  function footballLoop() {
    if (document.hidden) return;
    var F = P.Football, now = Date.now();
    // while you watch a film in Plume: only the live scores of matches that alert you, and only if alerts may show over films
    if (document.body.classList.contains('playing')) {
      if (P.S.get('matchAlerts') && P.S.get('alertOverFilms') && F.ready && P.Alerts.watchedLive() && now - liveAt >= 25000) { liveAt = now; F.refresh(true); }
      return;
    }
    if (now - fullAt >= 15 * 60000) { fullAt = now; liveAt = now; F.refresh(false); return; }
    // live scores every minute; every 25 s while one of your matches is on, so alerts come quickly
    var gap = P.S.get('matchAlerts') && P.Alerts.watchedLive() ? 25000 : 55000;
    if (F.ready && F.anyLiveSoon() && now - liveAt >= gap) { liveAt = now; F.refresh(true); }
  }
  function reminderLoop() {
    var r = P.Football.dueReminder();
    if (!r) return;
    if (P.Sleep.active) P.Sleep.hide();
    var mins = Math.max(0, Math.round((r.at - Date.now()) / 60000));
    P.UI.banner({ title: r.title, sub: mins ? 'Kicks off in ' + mins + ' min' : 'Kicking off now', okLabel: 'Watch on beIN',
      onOk: function () { P.Apps.switchTo('hdmi:bein'); } });
  }

  P.checkReminders = reminderLoop;
  P.footballLoop = footballLoop;
  footballLoop.reset = function () { liveAt = 0; };   // for tests

  function start() {
    P.TV.registerKeys();
    P.TV.systemScreensaver(false);
    setInterval(function () { if (!document.hidden) P.TV.systemScreensaver(false); }, 60000); // the S90CA needs reminding
    P.UI.push(P.Home.layer);
    P.Home.init();
    P.Sleep.init();
    P.Apps.refresh(function () {
      P.Home.renderApps();
      P.Apps.tileImages(function () { P.Apps.prepareLogos(function () { P.Home.renderApps(); }); });
      P.Apps.prepareLogos(function () { P.Home.renderApps(); });
    });
    P.Weather.refresh();
    setInterval(P.Weather.refresh, 30 * 60000);
    P.Football.refresh();
    setInterval(footballLoop, 20000);
    setInterval(reminderLoop, 20000);
    P.Plex.refresh();
    setInterval(function () { if (!document.body.classList.contains('playing')) P.Plex.refresh(); }, 5 * 60000);

    P.TV.onVisible(function () {
      P.Sleep.poke();
      P.TV.systemScreensaver(false);
      P.Home.tick(); P.Home.applyTheme();
      if (Date.now() - P.Football.loadedAt > 120000) P.Football.refresh();
      P.Plex.refresh();
      P.Apps.refresh(function () { P.Apps.prepareLogos(function () { P.Home.renderApps(); }); });
    });
    window.addEventListener('online', function () { P.Home.tick(); P.Football.refresh(); P.Plex.refresh(); P.Weather.refresh(); });
    window.addEventListener('offline', P.Home.tick);

    // first start: invite you to connect Plex once
    try {
      if (!localStorage.getItem('plume.welcomed')) {
        localStorage.setItem('plume.welcomed', '1');
        if (!P.S.get('plex')) setTimeout(function () {
          P.UI.dialog({ title: 'Welcome to Plume', body: '<p>Connect Plex to see what you were watching on the home screen. You can do it later from Settings.</p>',
            buttons: [{ label: 'Connect Plex', act: P.Settings.plexSignIn }, { label: 'Later' }] });
        }, 800);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
