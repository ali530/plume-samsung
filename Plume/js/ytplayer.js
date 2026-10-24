/* Highlights inside Plume. YouTube's embedded player only plays on a web page with a real address, and Plume runs
   from files on the TV, so Plume shows a one-page player hosted on GitHub Pages (github.com/ali530/plume-player)
   and drives it with messages: OK or Play/Pause pauses, ◀ ▶ (or ⏪ ⏩) jump 10 seconds, Back closes.
   If YouTube won't play a video there (some channels allow it only on YouTube), the YouTube app opens instead,
   and the message says YouTube's reason. */
(function () {
  var PAGE = 'https://ali530.github.io/plume-player/';
  var Y = { open_: false, page: PAGE };
  var root = null, frame = null, st = null;
  var REASONS = { 2: P.t('YouTube says the video link is wrong'), 5: P.t("YouTube's player had a problem"), 100: P.t('the video was removed or made private'),
    101: P.t('the channel allows it only on YouTube'), 150: P.t('the channel allows it only on YouTube'), 152: P.t('YouTube refused to play it here'), 153: P.t('YouTube refused to play it here') };

  function cmd(c, by) { try { frame.contentWindow.postMessage({ cmd: c, by: by }, '*'); } catch (e) {} }
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + P.pad(sec % 60); }
  function paint() {
    if (!st || !root) return;
    P.$('#ytT').textContent = fmt(st.t) + (st.d ? ' / ' + fmt(st.d) : '');
    P.$('#ytFill').style.transform = 'scaleX(' + (st.d ? Math.min(1, st.t / st.d) : 0).toFixed(4) + ')';
    P.$('#ytPP').innerHTML = st.paused ? P.icon('play') : '<svg class="ic" viewBox="0 0 24 24"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/></svg>';
  }
  function show() {
    if (!root) return;
    root.classList.add('ui-on'); paint();
    clearTimeout(st.hideT); st.hideT = setTimeout(function () { if (root && !st.paused) root.classList.remove('ui-on'); }, 3500);
  }
  function toApp(why) {
    var v = st && st.v;
    Y.close();
    if (v) { P.UI.toast((why ? P.esc(why) + ' · ' : '') + P.t('Opening it in YouTube'), 4500); P.Highlights.playApp(v); }
  }

  function onMsg(e) {
    var m = e.data;
    if (!st || !m || !m.plume || (frame && e.source !== frame.contentWindow)) return;
    st.heard = true;
    if (m.ev === 'error') { toApp(REASONS[m.code] ? REASONS[m.code] + ' (' + m.code + ')' : P.t('YouTube error {n}', { n: m.code })); return; }
    if (m.ev === 'time') { st.t = m.t; st.d = m.d; if (root.classList.contains('ui-on')) paint(); }
    if (m.ev === 'state' || m.ev === 'time') {
      var s = m.s;
      if (s === 1) {                                   // playing
        if (!st.playing) { st.playing = true; st.offerApp = false; P.$('#ytWait').style.display = 'none'; P.$('#ytHint').classList.remove('on'); show(); armAwake(); }
        if (st.paused && m.ev === 'state') { st.paused = false; show(); }
      }
      if (s === 2 && m.ev === 'state') { st.paused = true; root.classList.add('ui-on'); paint(); }
      if (s === 0 && m.ev === 'state') Y.close();       // finished
      st.lastState = s;
    }
  }
  /* Samsung's protection screen comes 2 minutes after the last button: start the silent video before that.
     If it upsets YouTube's playback, stop it again. */
  function armAwake() {
    var mine = st;
    if (st.awakeT || st.noAwake) return;
    st.awakeT = setTimeout(function () {
      if (st !== mine || st.paused) { if (st === mine) st.awakeT = null; return; }
      st.awake = true; P.Sleep.keepAwake(true);
      setTimeout(function () {
        if (st !== mine || st.paused) return;
        if (st.lastState !== 1) { P.Sleep.keepAwake(false); st.awake = false; st.noAwake = true; cmd('play'); }
      }, 6000);
    }, 100000);
  }

  Y.open = function (v) {
    if (Y.open_) Y.close();
    st = { v: v, playing: false, paused: false, t: 0, d: 0, heard: false };
    Y.open_ = true;
    root = P.el('div', 'ytp ui-on'); root.id = 'ytp';
    root.innerHTML = '<iframe id="ytFrame" allow="autoplay; encrypted-media; fullscreen" referrerpolicy="strict-origin-when-cross-origin" src="' +
      P.esc(Y.page + '?v=' + encodeURIComponent(v.id) + '&hl=' + (/[؀-ۿ]/.test(v.title) ? 'ar' : 'en')) + '"></iframe>' +
      '<div class="ytp-wait" id="ytWait"><i></i></div>' +
      '<div class="ytp-hint" id="ytHint">' + P.t('An ad?') + ' <span class="key">OK</span>' + P.t('Open it in the YouTube app (no ads with your subscription) · Settings → Football → Highlights play in') + '</div>' +
      '<div class="ytp-ui"><div class="ytp-top"><div class="ytp-t">' + P.esc(v.title) + '</div><div class="ytp-c">' + P.esc(v.channel) + '</div></div>' +
      '<div class="ytp-bottom"><span class="ytp-pp" id="ytPP"></span><div class="ytp-bar"><i id="ytFill"></i></div><span class="ytp-time" id="ytT"></span></div></div>';
    document.body.appendChild(root);
    frame = P.$('#ytFrame');
    frame.addEventListener('load', function () { if (st) st.loaded = true; });   // the TV loaded the page (even if it stays silent)
    document.body.classList.add('playing');            // like the Plex player: no sleep screen, alerts wait
    P.UI.push(layer);
    window.addEventListener('message', onMsg);
    var mine = st;
    // Not playing after 15 seconds. If the page or YouTube never answered, the YouTube app takes over. If YouTube is
    // answering, it's usually an ad before the video (YouTube reports "not started" while one plays): wait, and offer
    // OK to open it in YouTube instead.
    st.failT = setTimeout(function () {
      if (st !== mine || st.playing) return;
      if (!st.loaded) { toApp(P.t("The TV didn't load the player page")); return; }
      if (!st.heard) { toApp(P.t('The player page loaded but YouTube stayed silent')); return; }
      st.offerApp = true;
      var h = P.$('#ytHint'); if (h) h.classList.add('on');
    }, 15000);
  };

  Y.close = function () {
    if (!st) return;
    clearTimeout(st.hideT); clearTimeout(st.failT); clearTimeout(st.awakeT);
    if (st.awake) P.Sleep.keepAwake(false);
    window.removeEventListener('message', onMsg);
    try { cmd('stop'); } catch (e) {}
    st = null; Y.open_ = false;
    if (root) { root.remove(); root = null; } frame = null;
    document.body.classList.remove('playing');
    P.UI.pop(layer);
  };

  function toggle() { if (st.paused) cmd('play'); else cmd('pause'); show(); }
  var layer = {
    name: 'youtube',
    key: function (k) {
      if (!st) return;
      if (k === 'stop') { Y.close(); return; }
      if (k === 'back') { if (root.classList.contains('ui-on') && !st.paused) { clearTimeout(st.hideT); root.classList.remove('ui-on'); return; } Y.close(); return; }
      if (k === 'ok' && st.offerApp && !st.playing) { toApp(''); return; }
      if (k === 'ok' || k === 'pp') { toggle(); return; }
      if (k === 'left' || k === 'rw') { cmd('seek', -10); show(); return; }
      if (k === 'right' || k === 'ff') { cmd('seek', 10); show(); return; }
      show();
    }
  };

  P.YT = Y;
})();
