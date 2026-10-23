/* Everything that talks to the Samsung TV itself (Tizen web APIs). In a desktop browser these fall back to
   harmless stand-ins, so the whole launcher can be tried and tested without a TV. */
(function () {
  var T = {};
  var tz = window.tizen;
  T.onTV = !!(tz && tz.application);

  T.KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACKSPACE: 8, ESC: 27 };

  /* ---------- apps ---------- */
  T.listApps = function (done) {
    if (!T.onTV || !tz.application.getAppsInfo) { done(null); return; }
    try {
      tz.application.getAppsInfo(function (list) { done(list || []); }, function (e) { P.log('getAppsInfo', e && e.message); done(null); });
    } catch (e) { P.log('getAppsInfo threw', e.message); done(null); }
  };

  /* try each id in turn until one opens */
  T.launch = function (ids, ok, fail) {
    ids = (ids || []).filter(Boolean);
    if (!T.onTV) { P.log('launch', ids.join(',')); if (ok) ok(ids[0]); return; }
    var i = 0;
    (function next() {
      if (i >= ids.length) { if (fail) fail(); return; }
      var id = ids[i++];
      try { tz.application.launch(id, function () { if (ok) ok(id); }, next); } catch (e) { next(); }
    })();
  };

  /* open an app and ask the TV to tell Plume when it closes, so Plume can come back to the front.
     Samsung apps don't always honour this; then the app opens normally and closing it goes to Samsung's home. */
  T.launchAndReturn = function (ids, ok, fail) {
    ids = (ids || []).filter(Boolean);
    if (!T.onTV || !tz.ApplicationControl) { T.launch(ids, ok, fail); return; }
    var self = null; try { self = tz.application.getCurrentApplication().appInfo.id; } catch (e) {}
    var at = Date.now();
    // only when the app really closed after use: an app that answers right away must not bounce you back
    var back = function () { if (self && Date.now() - at > 8000 && P.S.get('returnToPlume')) try { tz.application.launch(self); } catch (e) {} };
    var i = 0;
    (function next() {
      if (i >= ids.length) { T.launch(ids, ok, fail); return; }
      var id = ids[i++];
      try {
        var ctl = new tz.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, []);
        tz.application.launchAppControl(ctl, id, function () { if (ok) ok(id); }, next, { onsuccess: back, onfailure: back });
      } catch (e) { next(); }
    })();
  };

  /* open an app with extra data (used to ask Plex to open a specific title); falls back to a plain launch */
  T.launchWithData = function (appId, data, ok, fail) {
    if (!T.onTV || !tz.ApplicationControl) { T.launch([appId], ok, fail); return; }
    try {
      var items = Object.keys(data).map(function (k) { return new tz.ApplicationControlData(k, [String(data[k])]); });
      var ctl = new tz.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null, items);
      tz.application.launchAppControl(ctl, appId, function () { if (ok) ok(appId); }, function () { T.launch([appId], ok, fail); });
    } catch (e) { T.launch([appId], ok, fail); }
  };

  T.hideSelf = function () {
    try { tz.application.getCurrentApplication().hide(); return true; } catch (e) { return false; }
  };

  /* ---------- keys ---------- */
  T.registerKeys = function () {
    try {
      if (tz && tz.tvinputdevice) {
        var want = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaFastForward', 'MediaRewind', 'MediaStop'];
        var have = tz.tvinputdevice.getSupportedKeys().map(function (k) { return k.name; });
        var names = want.filter(function (n) { return have.indexOf(n) >= 0; });
        if (names.length) tz.tvinputdevice.registerKeyBatch(names);
      }
    } catch (e) { P.log('registerKeys', e.message); }
  };

  /* ---------- Samsung's own screensaver: off while Plume is on screen, so Plume's sleep screen shows instead ---------- */
  T.saverStatus = 'not tried';
  T.systemScreensaver = function (on) {
    try {
      var ac = window.webapis && webapis.appcommon;
      if (ac && ac.setScreenSaver) {
        ac.setScreenSaver(on ? ac.AppCommonScreenSaverState.SCREEN_SAVER_ON : ac.AppCommonScreenSaverState.SCREEN_SAVER_OFF,
          function () { T.saverStatus = 'accepted'; }, function (e) { T.saverStatus = 'refused (' + ((e && e.message) || 'error') + ')'; });
        if (T.saverStatus === 'not tried') T.saverStatus = 'sent';
      } else T.saverStatus = 'not available on this TV';
    } catch (e) { T.saverStatus = 'failed (' + e.message + ')'; P.log('screensaver', e.message); }
  };

  /* ---------- HDMI inputs ----------
     Samsung gives apps no "switch input" command. What is available is the TV window: Plume points it at the
     HDMI port, then either steps aside (the TV keeps showing that input, with its own picture modes such as
     Game Mode) or shows it full screen inside Plume. Which one works best is a setting, because models differ. */
  var shownInside = false;
  function findSource(port, done) {
    var fallback = { type: 'HDMI', number: port };
    try {
      tz.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
        var list = (info && (info.connected || info.connectedVideoSources)) || [];
        var hit = null;
        list.forEach(function (s) { if (s && s.type === 'HDMI' && Number(s.number) === Number(port)) hit = s; });
        done(hit || fallback, list.length ? !!hit : null);
      }, function () { done(fallback, null); });
    } catch (e) { done(fallback, null); }
  }

  T.switchInput = function (port, method, ok, fail) {
    if (!T.onTV || !tz.tvwindow) { P.log('switch HDMI', port, method); if (ok) ok('test'); return; }
    findSource(port, function (src, connected) {
      try {
        tz.tvwindow.setSource(src, function () {
          if (method === 'inside') {
            tz.tvwindow.show(function () { shownInside = true; if (ok) ok('inside'); },
              function (e) { if (fail) fail(e && e.message); }, ['0px', '0px', '1920px', '1080px'], 'MAIN', 'FRONT');
          } else {
            // experiment: ask the TV's own input viewer to come forward on that input, so the TV's picture
            // modes (Game Mode) apply; if it won't open, step aside as before
            T.launch(['org.tizen.tv-viewer', 'com.samsung.tv.tv-viewer', 'org.tizen.tv-viewer.tv-viewer'], function () { if (ok) ok('exit'); },
              function () { if (T.hideSelf()) { if (ok) ok('exit'); } else if (fail) fail('hide'); });
          }
        }, function (e) { if (fail) fail((e && e.message) || 'setSource', connected); }, 'MAIN');
      } catch (e) { if (fail) fail(e.message, connected); }
    });
  };
  T.insideActive = function () { return shownInside; };
  T.closeInside = function () {
    shownInside = false;
    try { tz.tvwindow.hide(function () {}, function () {}, 'MAIN'); } catch (e) {}
  };

  /* ---------- visibility (Plume going to the background and coming back) ---------- */
  T.onVisible = function (fn) {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) fn(); });
  };

  T.online = function () { return navigator.onLine !== false; };

  P.TV = T;
})();
