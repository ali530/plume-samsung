/* Highlights inside Plume, with YouTube's own embedded player (the official way to show a YouTube video in an app).
   Plume's remote works as in its Plex player: OK or Play/Pause pauses, ◀ ▶ (or ⏪ ⏩) jump 10 seconds, Back closes.
   A video whose channel doesn't allow playing outside YouTube opens in the YouTube app instead. */
(function () {
  var Y = { open_: false };
  var root = null, player = null, st = null, apiWait = [];

  function loadApi(done) {
    if (window.YT && YT.Player) { done(); return; }
    apiWait.push(done);
    if (apiWait.length > 1) return;
    window.onYouTubeIframeAPIReady = function () { var w = apiWait; apiWait = []; w.forEach(function (f) { f(); }); };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { var w = apiWait; apiWait = []; w.forEach(function (f) { f(new Error('no YouTube')); }); };
    document.head.appendChild(s);
  }

  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + P.pad(sec % 60); }
  function paint() {
    if (!st || !root) return;
    var cur = 0, dur = 0;
    try { cur = player.getCurrentTime(); dur = player.getDuration(); } catch (e) {}
    P.$('#ytT').textContent = fmt(cur) + (dur ? ' / ' + fmt(dur) : '');
    P.$('#ytFill').style.transform = 'scaleX(' + (dur ? Math.min(1, cur / dur) : 0).toFixed(4) + ')';
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
    if (v) { P.UI.toast((why ? P.esc(why) + ' · ' : '') + 'Opening it in YouTube', 3500); P.Highlights.playApp(v); }
  }

  Y.open = function (v) {
    if (Y.open_) Y.close();
    st = { v: v, playing: false, paused: false, hideT: null, failT: null, tickT: null };
    Y.open_ = true;
    root = P.el('div', 'ytp ui-on'); root.id = 'ytp';
    root.innerHTML = '<div id="ytFrame"></div><div class="ytp-wait" id="ytWait"><i></i></div>' +
      '<div class="ytp-ui"><div class="ytp-top"><div class="ytp-t">' + P.esc(v.title) + '</div><div class="ytp-c">' + P.esc(v.channel) + '</div></div>' +
      '<div class="ytp-bottom"><span class="ytp-pp" id="ytPP"></span><div class="ytp-bar"><i id="ytFill"></i></div><span class="ytp-time" id="ytT"></span></div></div>';
    document.body.appendChild(root);
    document.body.classList.add('playing');            // like the Plex player: no sleep screen, alerts wait
    P.UI.push(layer);
    // if nothing plays within 12 seconds, the YouTube app takes over
    st.failT = setTimeout(function () { if (st && !st.playing) toApp(); }, 12000);
    var mine = st;
    loadApi(function (err) {
      if (st !== mine) return;
      if (err) { toApp("Couldn't reach YouTube"); return; }
      player = new YT.Player('ytFrame', {
        width: 1920, height: 1080, videoId: v.id,
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3, fs: 0, disablekb: 1, enablejsapi: 1 },
        events: {
          onReady: function (e) { if (st === mine) { try { e.target.playVideo(); } catch (x) {} } },
          onStateChange: function (e) {
            if (st !== mine) return;
            if (e.data === 1) {                               // playing
              st.playing = true; st.paused = false; P.$('#ytWait').style.display = 'none';
              // Samsung's protection screen comes 2 minutes after the last button: before that, start the silent video.
              // If it upsets YouTube's playback, stop it again.
              if (!st.awakeT && !st.noAwake) st.awakeT = setTimeout(function () {
                if (st !== mine || st.paused) { if (st === mine) st.awakeT = null; return; }
                st.awake = true; P.Sleep.keepAwake(true);
                setTimeout(function () {
                  if (st !== mine || st.paused) return;
                  var ps = -1; try { ps = player.getPlayerState(); } catch (x) {}
                  if (ps !== 1) { P.Sleep.keepAwake(false); st.awake = false; st.noAwake = true; try { player.playVideo(); } catch (x) {} }
                }, 6000);
              }, 100000);
              show();
            }
            if (e.data === 2) { st.paused = true; root.classList.add('ui-on'); paint(); }
            if (e.data === 0) Y.close();                      // finished
          },
          // 100 removed · 101/150 the channel doesn't allow it here · 152/153 YouTube won't play it in apps
          onError: function (e) { if (st === mine) toApp(/^(101|150|152|153)$/.test(String(e.data)) ? 'This channel plays its videos only on YouTube' : ''); }
        }
      });
      st.tickT = setInterval(function () { if (root && root.classList.contains('ui-on')) paint(); }, 500);
    });
  };

  Y.close = function () {
    if (!st) return;
    clearTimeout(st.hideT); clearTimeout(st.failT); clearInterval(st.tickT); clearTimeout(st.awakeT);
    if (st.awake) P.Sleep.keepAwake(false);
    try { player && player.destroy(); } catch (e) {}
    player = null; st = null; Y.open_ = false;
    if (root) { root.remove(); root = null; }
    document.body.classList.remove('playing');
    P.UI.pop(layer);
  };

  function jump(s) { try { player.seekTo(Math.max(0, player.getCurrentTime() + s), true); } catch (e) {} show(); }
  function toggle() {
    try { if (st.paused) player.playVideo(); else player.pauseVideo(); } catch (e) {}
    show();
  }
  var layer = {
    name: 'youtube',
    key: function (k) {
      if (!st) return;
      if (k === 'back' || k === 'stop') { Y.close(); return; }
      if (k === 'ok' || k === 'pp') { toggle(); return; }
      if (k === 'left' || k === 'rw') { jump(-10); return; }
      if (k === 'right' || k === 'ff') { jump(10); return; }
      show();
    }
  };

  P.YT = Y;
})();
