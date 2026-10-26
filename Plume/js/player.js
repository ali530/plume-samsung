/* The Plex player: plays a Continue Watching title inside Plume with Samsung's own video player (AVPlay),
   so the TV's hardware does the decoding (4K, HDR10, Dolby Vision, Dolby Atmos) and Plume only draws the controls.
   Loaded only when you open a card, so it costs the home screen nothing. */
(function () {
  var V = P.Player = { open_: false };
  var av = function () { return window.webapis && webapis.avplay; };
  var BAD_AUDIO = /^(dca|dts|truehd|mlp|dts-hd|dtshd)/i;          // the S90CA can't play these
  var IMAGE_SUBS = /pgs|hdmv|vobsub|dvd_sub|dvb_sub/i;
  // Plex's own ladder of lower qualities; each title shows only the steps below its own file
  var LADDER = [[40000, '4K', '3840x2160'], [30000, '4K', '3840x2160'], [20000, '4K', '3840x2160'],
    [20000, '1080p', '1920x1080'], [12000, '1080p', '1920x1080'], [10000, '1080p', '1920x1080'], [8000, '1080p', '1920x1080'],
    [4000, '720p', '1280x720'], [3000, '720p', '1280x720'], [2000, '720p', '1280x720'],
    [1500, '480p', '720x480'], [720, '480p', '720x480']];
  var RES_H = { '4k': 2160, '2160': 2160, '1080': 1080, '720': 720, '576': 576, '480': 480, sd: 480 };
  function mbps(k) { return k >= 1000 ? (Math.round(k / 100) / 10).toString().replace(/\.0$/, '') + ' Mbps' : k + ' kbps'; }
  function resLabel(r) { r = String(r || '').toLowerCase(); return r === '4k' ? '4K' : /^\d+$/.test(r) ? r + 'p' : r.toUpperCase(); }
  function qualities(media) {
    var br = media.bitrate || 0, h = RES_H[String(media.videoResolution || '').toLowerCase()] || 2160;
    var list = [{ id: 'original', label: [resLabel(media.videoResolution), br ? mbps(br) : ''].filter(Boolean).join(' · ') + ' (' + P.t('Original') + ')', q: null }];
    LADDER.forEach(function (l) {
      var lh = +l[2].split('x')[1];
      if ((!br || l[0] < br) && lh <= h) list.push({ id: l[0] + '-' + l[1], label: l[1] + ' · ' + mbps(l[0]), q: { kbps: l[0], res: l[2] } });
    });
    return list;
  }
  function qOf(id) { return (st.qualities || []).filter(function (x) { return x.id === id; })[0] || null; }

  var st = null;      // everything about what is playing
  var root = null, hideT = null, saveT = null, otherT = null, tickT = null;

  /* ---------- talking to the Plex server ---------- */
  function srv() { return (P.S.get('plex') || {}).server; }
  function get(path) { var s = srv(); return P.json(s.uri + path, { headers: P.Plex.hdrs(s.token) }, 12000); }
  function put(path) { var s = srv(); return fetch(s.uri + path, { method: 'PUT', headers: P.Plex.hdrs(s.token) }).catch(function () {}); }
  function ping(path) { var s = srv(); return fetch(s.uri + path, { headers: P.Plex.hdrs(s.token) }).catch(function () {}); }
  function tok() { return encodeURIComponent(srv().token); }

  /* ---------- deciding how to play: directly, or with the server converting what the TV can't play ---------- */
  function plan(meta, quality) {
    var media = (meta.Media || [])[0] || {}, part = (media.Part || [])[0] || {}, streams = part.Stream || [];
    var audios = streams.filter(function (x) { return x.streamType === 2; }), subs = streams.filter(function (x) { return x.streamType === 3; });
    var audio = audios.filter(function (x) { return x.selected; })[0] || audios[0];
    // Like the Plex app: if the chosen audio can't play here, take another track in the same language that can
    if (audio && BAD_AUDIO.test(audio.codec || '')) {
      var alt = audios.filter(function (x) { return !BAD_AUDIO.test(x.codec || '') && (x.languageCode || x.language) === (audio.languageCode || audio.language); })[0];
      if (alt) audio = alt;
    }
    var sub = subs.filter(function (x) { return x.selected; })[0] || null;
    var burn = !!(sub && IMAGE_SUBS.test(sub.codec || ''));
    var convertAudio = !!(audio && BAD_AUDIO.test(audio.codec || ''));
    var qq = qOf(quality), q = qq && qq.q;
    return { media: media, part: part, audios: audios, subs: subs, audio: audio, sub: sub, burn: burn,
      convertAudio: convertAudio, quality: quality, direct: !burn && !convertAudio && !q, q: q };
  }

  function streamUrl(pl, key, offsetMs) {
    var s = srv();
    if (pl.direct) return s.uri + pl.part.key + '?X-Plex-Token=' + tok();
    var q = pl.q;
    var p = ['path=' + encodeURIComponent('/library/metadata/' + key), 'mediaIndex=0', 'partIndex=0', 'protocol=hls', 'fastSeek=1',
      'directPlay=0', 'directStream=' + (q ? 0 : 1), 'directStreamAudio=' + (pl.convertAudio ? 0 : 1),
      'subtitles=' + (pl.burn ? 'burn' : pl.remuxSubs ? 'auto' : 'none'), 'subtitleSize=100',
      // asking for the subtitles as text alongside a copied picture (WebVTT in the stream)
      pl.remuxSubs ? 'X-Plex-Client-Profile-Extra=' + encodeURIComponent('add-transcode-target-subtitle-codec(type=videoProfile&context=streaming&protocol=hls&subtitleCodec=webvtt)') : '', 'audioBoost=100', 'location=wan',
      'maxVideoBitrate=' + (q ? q.kbps : 200000), q ? 'videoResolution=' + q.res : '', 'offset=' + Math.floor(offsetMs / 1000),
      'session=' + st.session, 'X-Plex-Session-Identifier=' + st.session, 'X-Plex-Client-Identifier=' + encodeURIComponent(P.S.get('clientId')),
      'X-Plex-Product=Plume%20for%20Samsung', 'X-Plex-Platform=Tizen', 'X-Plex-Token=' + tok()].filter(Boolean);
    return s.uri + '/video/:/transcode/universal/start.m3u8?' + p.join('&');
  }

  /* ---------- subtitles drawn by Plume (text ones): fetched once, shown line by line ---------- */
  function parseTime(t) { var m = t.replace(',', '.').split(':'); return ((+m[0]) * 3600 + (+m[1]) * 60 + parseFloat(m[2])) * 1000; }
  /* ASS / SSA: the file's own Format line says where the start, end and text are. Styling codes and drawn shapes are
     dropped; lines the file places at the top ({\an8} and friends) stay at the top. */
  function parseAss(txt) {
    var out = [], fmt = null, DEF = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    txt.split(/\r?\n/).forEach(function (l) {
      var f = l.match(/^\s*Format:\s*(.*)$/i);
      if (f && /start/i.test(f[1]) && /text/i.test(f[1])) { fmt = f[1].split(',').map(function (x) { return x.trim().toLowerCase(); }); return; }
      var d = l.match(/^\s*Dialogue:\s*(.*)$/i); if (!d) return;
      var cols = fmt || DEF, parts = d[1].split(','), ti = cols.indexOf('text'); if (ti < 0) ti = cols.length - 1;
      var col = function (k) { var i = cols.indexOf(k); return i >= 0 ? (parts[i] || '').trim() : ''; };
      var text = parts.slice(ti).join(',');
      if (/\{[^}]*\\p[1-9]/.test(text)) return;                      // a drawn shape, not words
      var top = /\\an[789]/.test(text) || /\\a(5|6|7|9|10|11)(?!\d)/.test(text);
      text = text.replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
      if (!text || !col('start')) return;
      out.push({ a: parseTime(col('start')), b: parseTime(col('end')), t: text, top: top });
    });
    return out;
  }
  function parseSubs(txt) {
    var out = [];
    txt = String(txt || '').replace(/^﻿/, '');                  // an invisible marker some files start with
    if (/^\s*\[Script Info\]/i.test(txt) || /^\s*Dialogue:/im.test(txt)) out = parseAss(txt);
    else {                                   // SRT / WebVTT
      txt.replace(/\r/g, '').split(/\n\n+/).forEach(function (blk) {
        var m = blk.match(/(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)[^\n]*\n([\s\S]*)/) ||
                blk.match(/(\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+[.,]\d+)[^\n]*\n([\s\S]*)/);
        if (!m) return;
        var a = m[1].split(':').length === 2 ? '0:' + m[1] : m[1], b = m[2].split(':').length === 2 ? '0:' + m[2] : m[2];
        // many SRT files carry ASS position codes like {\an8} (Plex reads them): at the top, never shown as text
        var raw = m[3], codeTop = /\{[^}]*\\an[789][^}]*\}/.test(raw) || /\{[^}]*\\a(5|6|7|9|10|11)(?!\d)[^}]*\}/.test(raw);
        var t = raw.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]+>/g, '').replace(/\\N/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
        var vttTop = /line:\s*[0-9]{1,2}%/.test(blk.split('\n')[0] || '') && !/line:\s*[5-9][0-9]%/.test(blk);
        if (t) out.push({ a: parseTime(a), b: parseTime(b), t: t, top: codeTop || vttTop });
      });
    }
    return out.sort(function (x, y) { return x.a - y.a; });
  }
  /* Text subtitles: Plume draws them from the subtitle file (a separate file next to the video, or read out of the video
     by the server). If that fails, the TV reads the track inside the video itself. */
  function textSubsInFile() { return st.plan.subs.filter(function (x) { return !x.key && !IMAGE_SUBS.test(x.codec || ''); }); }
  function stopEmbedded() {
    if (!st.embedded) return;
    try { av().setSilentSubtitle(true); } catch (e) {}
    st.embedded = false;
  }
  function loadSubs(sub) {
    st.cues = null; st.cueAt = 0; st.subOff = null; setSubText(''); stopEmbedded();
    clearInterval(st.fileT); st.fileSubs = null; stopStyled(); st.styleNote = '';
    st.subHow = sub ? 'Loading…' : '';
    var want = st.subGen = (st.subGen || 0) + 1;
    if (!sub || IMAGE_SUBS.test(sub.codec || '')) { st.subHow = sub ? 'Drawn into the picture by the server' : ''; return; }
    if (st.plan.remuxSubs) { st.subHow = 'Waiting for the server to send them as text'; return; }
    var s = srv(), path = sub.key || '/library/streams/' + sub.id;
    fetch(s.uri + path + (path.indexOf('?') < 0 ? '?' : '&') + 'X-Plex-Token=' + tok(), { headers: P.Plex.hdrs(s.token) })
      .then(function (r) { if (!r.ok) throw new Error('server said ' + r.status); return r.text(); })
      .then(function (t) {
        if (!st || st.subGen !== want) return;
        var cues = parseSubs(t);
        if (!cues.length) throw new Error('empty');
        st.cues = cues; st.subHow = 'Drawn by Plume'; subsAt(st.t);
        if (isAssText(t)) styledFromText(t, want);
      })
      .catch(function (e) {
        if (!st || st.subGen !== want) return;
        if (sub.key) { fallback(sub, e && e.message || 'error'); return; }       // a separate subtitle file that failed
        // inside the video: 1) Plex sends the subtitle on its own, like the Plex app; 2) the TV reads it (not ASS);
        // 3) Plume reads it from the file; then the server's conversions as before
        st.subLog = (st.subLog || []).concat('subtitle file: ' + (e && e.message || 'error'));
        st.subHow = 'Asking Plex for them…';
        fromPlex(sub).then(function (got) {
          if (!st || st.subGen !== want) return;
          st.cues = got.cues; st.subHow = 'Sent by Plex'; subsAt(st.t);
          if (isAssText(got.raw)) styledFromText(got.raw, want);
        }, function (e1) {
          if (!st || st.subGen !== want) return;
          st.subLog = st.subLog.concat('Plex on its own: ' + e1.message);
          if (st.plan.direct && !ASS.test(sub.codec || '')) {
            if (!st.ready) { st.pendingSub = sub; st.subHow = 'Waiting for the video'; return; }
            if (useEmbeddedSubs(sub)) { st.subHow = 'Shown by the TV'; return; }
            st.subLog = st.subLog.concat('the TV: it has no such track');
          }
          fromFile(sub, want);
        });
      });
  }

  /* ---------- the styled look (Settings → Plex → Subtitle style: As in the file): ASS drawn as the file styles it ----------
     libass (vendor/libass, the engine VLC and Plex's web player use) draws on a canvas over the video, with the file's
     own fonts, colours, outlines, positions and movement. Plume keeps its plain lines ready underneath: if the engine
     can't start or stops, they show again at once. */
  var LIB = 'vendor/libass/', libP = null;
  function styled() { return P.S.get('subStyle') !== 'plain'; }
  function isAssText(t) { return /^\s*\[Script Info\]/i.test(String(t || '').replace(/^\uFEFF/, '')) && /^\s*Dialogue:/im.test(t); }
  function abs(u) { return new URL(u, location.href).href; }
  function loadLib() {
    if (window.SubtitlesOctopus) return Promise.resolve();
    if (libP) return libP;
    return (libP = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = LIB + 'subtitles-octopus.js';
      s.onload = ok; s.onerror = function () { libP = null; no(new Error("couldn't load the subtitle engine")); };
      document.body.appendChild(s);
    }));
  }
  function fontsFromFile() {          // the fonts stored in the video file, when it's an MKV the TV plays as it is
    var pl = st.plan, s = srv();
    if (!P.SubFile || !/\.mkv(\?|$)/i.test(pl.part.key || '')) return Promise.resolve([]);
    return P.SubFile.open(s.uri + pl.part.key + (pl.part.key.indexOf('?') < 0 ? '?' : '&') + 'X-Plex-Token=' + tok(), { index: (pl.sub || {}).index, nth: 0, lang: '' })
      .then(function (R) { return R.fonts(25 * 1048576); })
      .catch(function (e) { st.styleNote = 'fonts: ' + e.message; return []; });
  }
  function styledFromText(txt, want) {
    if (!styled()) return;
    fontsFromFile().then(function (fonts) { if (st && st.subGen === want) startStyled(txt, fonts, want, false); });
  }
  function startStyled(content, fonts, want, feed) {
    stopStyled();
    var mine = st;
    loadLib().then(function () {
      if (st !== mine || st.subGen !== want) return;
      var urls = (fonts || []).map(function (f) { return URL.createObjectURL(new Blob([f.data])); });
      var A = { oct: null, ready: false, feed: !!feed, queue: [], styles: null, urls: urls, gen: want };
      st.ass = A;
      var fail = function (why) {
        if (st !== mine || st.ass !== A) return;
        stopStyled(); st.styleNote = why || 'the subtitle engine stopped';
      };
      A.timer = setTimeout(function () { if (!A.ready) fail("the subtitle engine didn't start"); }, 12000);
      try {
        A.oct = new SubtitlesOctopus({
          canvas: P.$('#plAss'), subContent: content, workerUrl: abs(LIB + 'subtitles-octopus-worker.js'),
          fonts: urls.concat([abs('css/noto-sans-arabic-arabic-wght-normal.woff2')]), fallbackFont: abs(LIB + 'default.woff2'),
          targetFps: 24, maxRenderHeight: 1080, libassMemoryLimit: 40, libassGlyphLimit: 40,
          onError: function () { fail('the subtitle engine stopped'); },
          onReady: function () {
            if (st !== mine || st.ass !== A) return;
            A.ready = true; clearTimeout(A.timer);
            root.classList.add('ass-on'); setSubText('');
            if (!A.feed) { syncStyled(true); return; }
            A.oct.getStyles(function (list) {            // a line names its style; the engine wants the style's number
              A.styles = {}; (list || []).forEach(function (s, i) { A.styles[s.Name] = s._index != null ? s._index : i; });
              var q = A.queue; A.queue = []; feedStyled(q); syncStyled(true);
            }, function () { A.styles = {}; var q = A.queue; A.queue = []; feedStyled(q); syncStyled(true); });
          }
        });
      } catch (e) { fail(e.message); }
    }, function (e) { if (st === mine) st.styleNote = e.message; });
  }
  function feedStyled(lines) {
    var A = st && st.ass; if (!A || !A.feed || !lines || !lines.length) return;
    if (!A.styles) { A.queue = A.queue.concat(lines); return; }
    lines.forEach(function (l) {
      if (!l.raw) return;
      var r = l.raw;
      A.oct.createEvent({ Start: Math.round(l.a), Duration: Math.max(1, Math.round(l.b - l.a)), ReadOrder: r.ReadOrder, Layer: r.Layer,
        Style: A.styles[r.Style] != null ? A.styles[r.Style] : (A.styles.Default != null ? A.styles.Default : 0), Name: r.Name,
        MarginL: r.MarginL, MarginR: r.MarginR, MarginV: r.MarginV, Effect: r.Effect, Text: r.Text });
    });
    syncStyled(true);
  }
  function syncStyled(force) {
    var A = st && st.ass; if (!A || !A.ready) return;
    var t = Math.max(0, (st.t - (st.subOff || 0)) / 1000), paused = !st.playing;
    if (!force && A.lastPaused === paused && Math.abs(t - (A.lastT || 0)) < 0.05) return;
    A.lastPaused = paused; A.lastT = t;
    try { A.oct.setIsPaused(paused, t); } catch (e) {}
  }
  function stopStyled() {
    if (!st || !st.ass) return;
    var A = st.ass; st.ass = null;
    clearTimeout(A.timer);
    try { if (A.oct) A.oct.dispose(); } catch (e) {}
    A.urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    if (root) { root.classList.remove('ass-on'); var c = P.$('#plAss'); if (c) { try { c.getContext('2d').clearRect(0, 0, c.width, c.height); } catch (e) {} } }
    lastSub = null; lastTop = null; if (st.cues) subsAt(st.t);
  }

  /* 1) Plex sends the subtitle on its own while the video plays untouched (no conversion of the picture) */
  var ASS = /^(ass|ssa)$/i;
  function fromPlex(sub) {
    var s = srv(), errs = [];
    var common = ['path=' + encodeURIComponent('/library/metadata/' + st.key), 'mediaIndex=0', 'partIndex=0', 'protocol=http', 'directPlay=1', 'directStream=1',
      'subtitles=sidecar', 'subtitleStreamID=' + sub.id, 'session=' + encodeURIComponent(st.session + '-subs'),
      'X-Plex-Client-Identifier=' + encodeURIComponent(P.S.get('clientId')), 'X-Plex-Product=Plume', 'X-Plex-Token=' + tok()].join('&');
    var tries = [ASS.test(sub.codec || '') ? 'ass' : 'srt', 'srt'].filter(function (f, i, a) { return a.indexOf(f) === i; });
    return tries.reduce(function (p, f) {
      return p.catch(function () {
        var extra = 'add-transcode-target(type=subtitleProfile&context=all&protocol=http&container=' + f + '&subtitleCodec=' + f + ')';
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
        return fetch(s.uri + '/video/:/transcode/universal/subtitles?' + common + '&subtitleFormat=' + f + '&X-Plex-Client-Profile-Extra=' + encodeURIComponent(extra),
          { headers: P.Plex.hdrs(s.token), signal: ctrl && ctrl.signal }).then(function (r) {
          return r.text().then(function (txt) {
            clearTimeout(t);
            if (!r.ok) throw new Error('server said ' + r.status + (txt ? ': ' + txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : ''));
            var cues = parseSubs(txt);
            if (!cues.length) throw new Error('nothing in what it sent');
            return { cues: cues, raw: txt };
          });
        }).catch(function (e) { clearTimeout(t); errs.push(e.name === 'AbortError' ? 'no answer' : e.message); throw new Error(errs.join(' / ')); });
      });
    }, Promise.reject(new Error('')));
  }

  /* 3) Plume reads the subtitle lines out of the video file, a little ahead of where you are (see subfile.js) */
  function fromFile(sub, want) {
    var pl = st.plan, s = srv();
    var isMkv = /\.mkv(\?|$)/i.test(pl.part.key || '') || /mkv|matroska/i.test((pl.part.container || '') + ' ' + (pl.media.container || ''));
    if (!P.SubFile || !isMkv) { fallback(sub, P.SubFile ? 'reading from the file: only MKV files hold these' : 'reading from the file: not available'); return; }
    st.subHow = 'Reading them from the file…';
    var inFile = pl.subs.filter(function (x) { return !x.key; });
    P.SubFile.open(s.uri + pl.part.key + (pl.part.key.indexOf('?') < 0 ? '?' : '&') + 'X-Plex-Token=' + tok(),
      { index: sub.index, nth: inFile.indexOf(sub), lang: sub.languageCode || '' }).then(function (R) {
      if (!st || st.subGen !== want) return;
      var mine = st.fileSubs = { R: R, busy: false, first: true, have: {} };
      if (styled() && R.header) R.fonts(25 * 1048576).catch(function (e) { st.styleNote = 'fonts: ' + e.message; return []; }).then(function (fonts) {
        if (st && st.fileSubs === mine) startStyled(R.header, fonts, want, true);
      });
      var ahead = R.mode === 'index' ? 120000 : 25000;
      var pull = function () {
        if (!st || st.fileSubs !== mine) { clearInterval(t2); return; }
        if (mine.busy) return;
        mine.busy = true;
        R.fill(Math.max(0, st.t - (st.subOff || 0)), st.t + ahead).then(function (lines) {
          mine.busy = false;
          if (!st || st.fileSubs !== mine) return;
          var add = lines.filter(function (l) { var k = l.a + '|' + (l.raw ? l.raw.Text : l.t); if (mine.have[k]) return false; mine.have[k] = true; return true; });
          var plain = add.filter(function (l) { return !l.skip; });
          if (plain.length) { st.cues = (st.cues || []).concat(plain).sort(function (x, y) { return x.a - y.a; }); subsAt(st.t); }
          feedStyled(add);
          if (mine.first) { mine.first = false; st.subHow = R.mode === 'index' ? 'Read from the file' : 'Read from the file, piece by piece'; }
        }, function (e) {
          mine.busy = false;
          if (!st || st.fileSubs !== mine) return;
          if (mine.first) { clearInterval(t2); st.fileSubs = null; fallback(sub, 'reading from the file: ' + e.message); }
          else P.log('subs from file', e.message);   // a hiccup later on: try again on the next round
        });
      };
      var t2 = st.fileT = setInterval(pull, 2000);
      pull();
    }, function (e) {
      if (!st || st.subGen !== want) return;
      fallback(sub, 'reading from the file: ' + e.message);
    });
  }
  /* The subtitle is inside the video, the server won't hand it over as a file and the TV can't read it (ASS, for example).
     1) ask the server to repackage the video (picture and sound copied, no quality loss) and send the subtitles as text;
     2) if that's refused, the server draws them into the picture (automatic, slightly lower picture quality). */
  /* Before converting, ask the server what it will do, the way the Plex apps do. Its answer is in its own words. */
  function decide(pl, at) {
    var url = streamUrl(pl, st.key, at).replace('/start.m3u8?', '/decision?');
    var s = srv();
    return fetch(url, { headers: P.Plex.hdrs(s.token) }).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = JSON.parse(t); } catch (e) {}
        var mc = (d && d.MediaContainer) || {};
        var words = [mc.generalDecisionText, mc.transcodeDecisionText, mc.mdeDecisionText].filter(Boolean).join(' · ') || (r.ok ? '' : 'server said ' + r.status + (t && !d ? ': ' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) : ''));
        var code = +mc.generalDecisionCode || 0, tcode = +mc.transcodeDecisionCode || 0;
        // 2000s / 4000s: the server won't do it
        return { ok: r.ok && code < 2000 && tcode < 4000 && !/disabled|not allowed|denied|forbidden|permission|refus/i.test(words), words: words };
      });
    }).catch(function (e) { return { ok: true, words: '' }; });   // can't ask: just try
  }

  function fallback(sub, why) {
    if (!st || !sub || IMAGE_SUBS.test(sub.codec || '')) return;
    // what each step got back, for Info: the subtitle file, the repackaged stream, the converted picture
    var stepName = st.triedBurn ? 'converted picture' : st.triedRemux ? 'repackaged stream' : 'subtitle file';
    st.subLog = (st.subLog || []).concat(/^reading from the file/.test(why) ? why : stepName + ': ' + why);
    var pl = st.plan;
    if (!st.triedRemux) { st.triedRemux = true; pl.remuxSubs = true; pl.forceBurn = false; st.subHow = 'Asking the server to send them as text'; restart({}); return; }
    if (!st.triedBurn) { st.triedBurn = true; pl.remuxSubs = false; pl.forceBurn = true; st.subHow = 'Drawn into the picture by the server'; restart({}); return; }
    st.subHow = P.t("Couldn't show them") + ' — ' + st.subLog.join(' · ') + P.t('. Try Search subtitles online in ⚙');
  }

  /* ---------- the remuxed stream: picture from its own playlist, subtitles from theirs (WebVTT pieces) ---------- */
  function startStream(at) {
    var pl = st.plan, url = streamUrl(pl, st.key, at);
    clearInterval(st.vttT); st.vttSeen = {};
    // a subtitle step: ask the server first, so a refusal comes back in its own words instead of a failed stream
    if ((pl.remuxSubs || pl.forceBurn) && !pl.decided) {
      var mine0 = st, session0 = st.session;
      root.classList.add('waiting');
      decide(pl, at).then(function (d) {
        if (st !== mine0 || st.session !== session0) return;
        if (!d.ok) {
          var step = pl.remuxSubs ? 'remux' : 'burn';
          pl.remuxSubs = false; pl.forceBurn = false;
          st.subLog = (st.subLog || []).concat((step === 'remux' ? 'repackaged stream' : 'converted picture') + ': Plex says ' + (d.words || 'no'));
          if (step === 'remux' && !st.triedBurn) { st.triedBurn = true; pl.forceBurn = true; restart({}); return; }
          st.plan.sub = null; restart({});
          st.subHow = P.t("Couldn't show them") + ' — ' + st.subLog.join(' · ') + P.t('. Try Search subtitles online in ⚙');
          return;
        }
        pl.decided = true; startStream(at); pl.decided = false;
      });
      return;
    }
    if (!pl.remuxSubs) { startAV(url, at); return; }
    var mine = st, session = st.session, s = srv();
    root.classList.add('waiting');
    fetch(url, { headers: P.Plex.hdrs(s.token) }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('server said ' + r.status + (t ? ': ' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) : '')); });
      return r.text();
    }).then(function (master) {
      if (st !== mine || st.session !== session) return;
      var dir = url.split('?')[0].replace(/[^\/]*$/, '');
      var abs = function (u) {
        u = /^https?:/.test(u) ? u : u.charAt(0) === '/' ? s.uri + u : dir + u;
        return u.indexOf('X-Plex-Token=') < 0 ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'X-Plex-Token=' + tok() : u;
      };
      var sm = master.match(/#EXT-X-MEDIA:[^\n]*TYPE=SUBTITLES[^\n]*URI="([^"]+)"/);
      if (!sm) throw new Error('the server sent no text track');
      var lines = master.split(/\r?\n/), variant = null;
      for (var i = 0; i < lines.length; i++) if (/^#EXT-X-STREAM-INF/.test(lines[i])) { variant = lines[i + 1]; break; }
      startAV(variant ? abs(variant) : url, at);
      st.subHow = 'Sent as text by the server';
      pollVtt(abs(sm[1]), session);
    }).catch(function (e) { if (st === mine) { pl.remuxSubs = false; fallback(pl.sub, e.message); } });
  }
  function pollVtt(listUrl, session) {
    var s = srv(), busy = false, mapShift = null;
    var once = function () {
      if (!st || st.session !== session || busy) return;
      busy = true;
      fetch(listUrl, { headers: P.Plex.hdrs(s.token) }).then(function (r) { return r.text(); }).then(function (txt) {
        var dir = listUrl.split('?')[0].replace(/[^\/]*$/, '');
        var segs = txt.split(/\r?\n/).filter(function (l) { return l && l.charAt(0) !== '#'; }).filter(function (u) { return !st.vttSeen[u]; }).slice(0, 12);
        return segs.reduce(function (p, u) {
          return p.then(function () {
            st.vttSeen[u] = true;
            var full = /^https?:/.test(u) ? u : u.charAt(0) === '/' ? s.uri + u : dir + u;
            if (full.indexOf('X-Plex-Token=') < 0) full += (full.indexOf('?') < 0 ? '?' : '&') + 'X-Plex-Token=' + tok();
            return fetch(full).then(function (r) { return r.text(); }).then(function (vtt) {
              if (!st || st.session !== session) return;
              var m = vtt.match(/X-TIMESTAMP-MAP=[^\n]*MPEGTS:(\d+)[^\n]*LOCAL:([\d:.]+)/) || vtt.match(/X-TIMESTAMP-MAP=[^\n]*LOCAL:([\d:.]+)[^\n]*MPEGTS:(\d+)/);
              var shift = 0;
              if (m) { var mpeg = +(/MPEGTS:(\d+)/.exec(m[0])[1]), local = /LOCAL:([\d:.]+)/.exec(m[0])[1]; shift = mpeg / 90 - parseTime(local.split(':').length === 2 ? '0:' + local : local); }
              var cues = parseSubs(vtt.replace(/^WEBVTT[^\n]*\n(?:[^\n]+\n)*/, ''));
              if (!cues.length) return;
              // the pieces count either from the start of the title or from where this stream began
              if (mapShift === null) mapShift = (cues[0].a + shift < (st.base || 0) - 30000) ? (st.base || 0) + shift : shift;
              cues.forEach(function (c) { c.a += mapShift; c.b += mapShift; });
              st.cues = (st.cues || []).concat(cues).sort(function (x, y) { return x.a - y.a; });
            });
          });
        }, Promise.resolve());
      }).catch(function () {}).then(function () { busy = false; });
    };
    once();
    st.vttT = setInterval(once, 6000);
  }
  function useEmbeddedSubs(sub) {   // the TV reads the subtitle track inside the file: match it by its place among the file's text tracks
    try {
      var tracks = av().getTotalTrackInfo().filter(function (t) { return t.type === 'TEXT'; });
      var inFile = textSubsInFile(), n = inFile.indexOf(sub);
      var t = tracks[n];
      if (!t || tracks.length !== inFile.length) {   // counts differ: fall back to the language
        var lang = (sub.languageCode || '').slice(0, 2);
        t = tracks.filter(function (x) { return (x.extra_info || '').indexOf('"' + lang) >= 0; })[0];
      }
      if (!t) return false;
      av().setSelectTrack('TEXT', t.index); av().setSilentSubtitle(false);
      st.embedded = true;
      return true;
    } catch (e) { P.log('subs', e.message); return false; }
  }
  var subEl = null, subTopEl = null, lastSub = null, lastTop = null;
  function setSubText(t, top) {
    top = top || '';
    if (subEl && t !== lastSub) { lastSub = t; subEl.textContent = t; subEl.style.visibility = t ? 'visible' : 'hidden'; }   // only when it changes
    if (subTopEl && top !== lastTop) { lastTop = top; subTopEl.textContent = top; subTopEl.style.visibility = top ? 'visible' : 'hidden'; }
  }
  /* every line due at this moment (ASS often has two at once, such as a sign and the dialogue) */
  function subsAt(ms) {
    var c = st.cues; if (!c || !c.length) return;
    if (st.subOff == null) st.subOff = getOff();
    ms -= st.subOff;                                   // later: a line shows that much after its time
    var lo = 0, hi = c.length - 1, last = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (c[mid].a <= ms) { last = mid; lo = mid + 1; } else hi = mid - 1; }
    var bottom = [], top = [];
    for (var i = last, n = 0; i >= 0 && n < 40; i--, n++) {
      if (c[i].b >= ms) (c[i].top ? top : bottom).unshift(c[i].t);
    }
    setSubText(bottom.join('\n'), top.join('\n'));
  }

  /* ---------- the screen ---------- */
  var ICONS = {
    gear: P.icon('gear'), info: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.4"/></svg>',
    pause: '<svg class="ic" viewBox="0 0 24 24"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor"/></svg>',
    play: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>'
  };
  var BTNS = ['set', 'info', 'rw', 'pp', 'ff', 'next'];
  function fmt(ms) { var x = Math.max(0, Math.round(ms / 1000)), h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), s = x % 60; return (h ? h + ':' + P.pad(m) : m) + ':' + P.pad(s); }

  function build() {
    root = P.el('div', 'pl'); root.id = 'player';
    root.innerHTML = '<object id="avp" type="application/avplayer"></object><canvas class="pl-ass" id="plAss" width="1920" height="1080"></canvas>' +
      '<div class="pl-sub" id="plSub"></div><div class="pl-sub top" id="plSubTop"></div>' +
      '<div class="pl-wait" id="plWait"><i></i></div>' +
      '<div class="pl-ui" id="plUi"><div class="pl-shade"></div>' +
      '<div class="pl-top"><div><div class="pl-title" id="plTitle"></div><div class="pl-ep" id="plEp"></div></div><div class="pl-clock" id="plClock"></div></div>' +
      '<div class="pl-bar" id="plBar"><i id="plFill"></i><b id="plKnob"></b><div class="pl-prev" id="plPrev"><img id="plPrevImg" alt=""><span id="plPrevT"></span></div></div>' +
      '<div class="pl-times"><span id="plT"></span><span id="plLeft"></span></div>' +
      '<div class="pl-btns"><div class="pl-l"><button data-b="set">' + ICONS.gear + '</button><button data-b="info">' + ICONS.info + '</button></div>' +
      '<div class="pl-c"><button data-b="rw">−10</button><button data-b="pp" class="big" id="plPP"></button><button data-b="ff">+10</button></div>' +
      '<div class="pl-r"><button data-b="next" class="pill" id="plNextBtn">' + P.t('Next episode') + '</button></div></div></div>' +
      '<button class="pl-skip" id="plSkip">' + P.t('Skip intro') + '</button>' +
      '<div class="pl-panel" id="plPanel"></div><div class="pl-info" id="plInfo"></div><div class="pl-next" id="plNext"></div>';
    document.body.appendChild(root);
    subEl = P.$('#plSub'); subTopEl = P.$('#plSubTop'); lastSub = null; lastTop = null;
  }

  function show(on) {
    st.ui = on;
    root.classList.toggle('ui-on', on);
    clearTimeout(hideT);
    if (on && st.playing && !st.panel && !st.info) hideT = setTimeout(function () { show(false); }, 4000);
  }
  function paint() {
    if (!st) return;
    var t = st.seek != null ? st.seek : st.jumpTo != null ? st.jumpTo : st.t, d = st.dur || 1, p = Math.min(100, t / d * 100);
    P.$('#plFill').style.transform = 'scaleX(' + (p / 100).toFixed(4) + ')';
    var bw = st.bw || (st.bw = P.$('#plBar').offsetWidth || 1766);
    P.$('#plKnob').style.transform = 'translate3d(' + (p / 100 * bw).toFixed(1) + 'px,0,0)';
    P.$('#plT').textContent = fmt(t);
    P.$('#plLeft').textContent = P.t('{t} left', { t: fmt(d - t) });
    P.$('#plPP').innerHTML = st.playing ? ICONS.pause : ICONS.play;
    P.$$('#plUi [data-b]').forEach(function (b) { b.classList.toggle('focus', st.zone === 'btns' && BTNS[st.sel] === b.dataset.b); });
    P.$('#plBar').classList.toggle('focus', st.zone === 'bar');
    P.$('#plNextBtn').style.visibility = st.nextMeta ? 'visible' : 'hidden';
    var prev = P.$('#plPrev');
    var pv = st.seek != null ? st.seek : st.jumpTo;
    if (pv != null) {
      prev.style.transform = 'translate3d(' + Math.max(160, Math.min(bw - 160, p / 100 * bw)).toFixed(0) + 'px,0,0) translateX(-50%)';
      P.$('#plPrevT').textContent = fmt(pv);
      var img = P.$('#plPrevImg');
      if (st.thumbs) { var u = srv().uri + '/library/parts/' + st.plan.part.id + '/indexes/sd/' + Math.round(pv) + '?X-Plex-Token=' + tok(); if (img.getAttribute('src') !== u) img.src = u; img.style.display = 'block'; }
      else img.style.display = 'none';
      prev.style.display = 'block';
    } else prev.style.display = 'none';
    P.$('#plSkip').classList.toggle('on', !!st.skipTo);
    P.$('#plSkip').classList.toggle('focus', !!st.skipTo && st.zone === 'skip');
  }
  function clock() { var c = P.$('#plClock'); if (c) c.textContent = P.hhmm(new Date()); }

  /* ---------- the gear panel: subtitles, audio, quality ---------- */
  function panelRows() {
    var pl = st.plan, rows = [];
    if (st.search) {                       // the results of "Search subtitles online"
      var S = st.search;
      rows.push({ h: P.t('Subtitles online') + ' · ' + P.t(S.langName) });
      if (S.state === 'loading') rows.push({ k: 'none', label: P.t('Searching…') });
      else if (S.state === 'saving') rows.push({ k: 'none', label: P.t('Adding it to your server…') });
      else if (S.state === 'error') rows.push({ k: 'none', label: S.error });
      else {
        var list = S.showAll ? S.items.concat(S.others || []) : S.items;
        if (!list.length) rows.push({ k: 'none', label: P.t('Nothing found for {what}', { what: S.what || P.t('this title') }) });
        list.forEach(function (x, i) {
          var name = x.title && x.title !== x.displayTitle ? x.title : (x.displayTitle || x.languageTitle || 'Subtitles');
          rows.push({ k: 'pick', v: i, label: (x._ep ? '✓ ' + P.t('This episode') + ' · ' : +x.perfectMatch ? '✓ ' + P.t('Made for your file') + ' · ' : '') + name + (x.providerTitle ? ' · ' + x.providerTitle : '') });
        });
        if (!S.showAll && S.others && S.others.length) rows.push({ k: 'all', label: P.t('Show all results ({n} more)', { n: S.others.length }) });
      }
      if (S.state !== 'loading' && S.state !== 'saving' && S.other) rows.push({ k: 'lang', label: P.t('Search in {lang} instead', { lang: P.t(S.other.name) }) });
      rows.push({ k: 'back', label: P.t('Back') });
      return rows;
    }
    rows.push({ h: P.t('Subtitles') }); rows.push({ k: 'sub', v: 0, label: P.t('Off'), on: !pl.sub });
    var sl = labels(pl.subs, true);
    pl.subs.forEach(function (x, i) { rows.push({ k: 'sub', v: x.id, label: sl[i], on: x === pl.sub }); });
    if (st.cues) rows.push({ k: 'offset', label: P.t('Subtitle timing') + '   ◀ ' + offText() + ' ▶' });
    rows.push({ k: 'search', label: P.t('Search subtitles online…') });
    rows.push({ h: P.t('Audio') });
    var al = labels(pl.audios, false);
    pl.audios.forEach(function (x, i) { rows.push({ k: 'aud', v: x.id, label: al[i], on: x === pl.audio }); });
    rows.push({ h: P.t('Quality') });
    (st.qualities || []).forEach(function (q) { rows.push({ k: 'q', v: q.id, label: P.t(q.label), on: st.quality === q.id }); });
    return rows;
  }
  /* Clear names, so two Arabic tracks don't read the same: Arabic (SRT) · Forced, English · SDH, ... */
  function labels(list, isSub) {
    var out = list.map(function (x) {
      var t = x.extendedDisplayTitle || x.displayTitle || x.language || (isSub ? 'Subtitles' : 'Audio');
      var extra = [];
      if (x.title && t.indexOf(x.title) < 0) extra.push(x.title);
      if (x.forced && !/forced/i.test(t)) extra.push(P.t('Forced'));
      if (x.hearingImpaired && !/sdh/i.test(t)) extra.push('SDH');
      return t + (extra.length ? ' · ' + extra.join(' · ') : '');
    });
    out = out.map(function (t, i) {
      if (out.filter(function (u) { return u === t; }).length < 2) return t;
      var x = list[i];
      return t + ' · ' + (isSub ? P.t(x.key ? 'External' : 'In the file') : (x.codec || '').toUpperCase()) ;
    });
    var seen = {};
    return out.map(function (t) { seen[t] = (seen[t] || 0) + 1; return seen[t] > 1 ? t + ' (' + seen[t] + ')' : t; });
  }
  function renderPanel() {
    var rows = panelRows(), i = 0;
    var pick = rows.filter(function (r) { return !r.h; });
    if (st.pi >= pick.length) st.pi = pick.length - 1;
    P.$('#plPanel').innerHTML = rows.map(function (r) {
      if (r.h) return '<div class="pp-h">' + r.h + '</div>';
      var f = i++ === st.pi;
      return '<div class="pp-r' + (f ? ' focus' : '') + '"><span>' + P.esc(r.label) + '</span><span>' + (r.on ? '✓' : '') + '</span></div>';
    }).join('') + '<div class="pp-note">' + P.t(st.meta && st.meta.type === 'episode' ? "Starts with Plex's choices for this episode. Subtitle and audio changes are saved to Plex." : "Starts with Plex's choices for this title. Subtitle and audio changes are saved to Plex.") + '</div>';
    var f = P.$('#plPanel .pp-r.focus'); if (f) f.scrollIntoView({ block: 'nearest' });
    return pick;
  }
  /* Subtitle timing: ◀ earlier, ▶ later, half a second a press; remembered for this episode or film */
  function offKey() { return st.key + ':' + (st.plan.sub ? st.plan.sub.id : ''); }
  function getOff() { var m = P.S.get('subOffsets') || {}; return +m[offKey()] || 0; }
  function offText() { var o = getOff(); return o === 0 ? P.t('on time') : P.t(o > 0 ? '+{s} s later' : '−{s} s earlier', { s: Math.abs(o / 1000).toFixed(1) }); }
  function shiftSubs(dir) {
    var m = Object.assign({}, P.S.get('subOffsets') || {}), k = offKey();
    m[k] = Math.max(-30000, Math.min(30000, (+m[k] || 0) + dir * 500));
    if (!m[k]) delete m[k];
    var ks = Object.keys(m); if (ks.length > 300) delete m[ks[0]];
    P.S.set('subOffsets', m);
    st.subOff = m[k] || 0;
    subsAt(st.t); renderPanel();
  }
  function choosePanel() {
    var r = renderPanel()[st.pi]; if (!r) return;
    var pl = st.plan;
    if (r.k === 'none') return;
    if (r.k === 'search') { searchSubs(); return; }
    if (r.k === 'back') { st.search = null; st.pi = 0; renderPanel(); return; }
    if (r.k === 'lang') { searchSubs(st.search.other); return; }
    if (r.k === 'all') { st.search.showAll = true; renderPanel(); return; }
    if (r.k === 'pick') { pickOnline((st.search.showAll ? st.search.items.concat(st.search.others || []) : st.search.items)[r.v]); return; }
    if (r.k === 'sub') {
      put('/library/parts/' + pl.part.id + '?subtitleStreamID=' + r.v + '&allParts=1');
      var sub = pl.subs.filter(function (x) { return x.id === r.v; })[0] || null;
      var needBurn = !!(sub && IMAGE_SUBS.test(sub.codec || ''));
      var special = pl.remuxSubs || pl.forceBurn;
      pl.remuxSubs = false; pl.forceBurn = false; st.triedRemux = false; st.triedBurn = false; st.subLog = [];
      if (needBurn !== pl.burn || special) { restart({ sub: sub }); return; }
      pl.sub = sub;
      loadSubs(needBurn ? null : sub);
    } else if (r.k === 'aud') {
      put('/library/parts/' + pl.part.id + '?audioStreamID=' + r.v + '&allParts=1');
      var a = pl.audios.filter(function (x) { return x.id === r.v; })[0];
      if (!a || a === pl.audio) { renderPanel(); return; }
      if (BAD_AUDIO.test(a.codec || '') || !pl.direct) { restart({ audio: a }); return; }
      try {
        var tracks = av().getTotalTrackInfo().filter(function (t) { return t.type === 'AUDIO'; });
        var n = pl.audios.indexOf(a);
        if (!tracks[n] || tracks.length !== pl.audios.length) throw new Error('track');
        av().setSelectTrack('AUDIO', tracks[n].index);
        pl.audio = a;
      } catch (e) { restart({ audio: a }); return; }
    } else if (r.k === 'q') {
      if (r.v !== st.quality) { st.quality = r.v; restart({}); return; }
    }
    renderPanel();
  }

  /* ---------- Plex's own subtitle search (OpenSubtitles, like "Search" in the Plex app). The one you pick is saved on
     your server as a separate file, so Plume draws it at full picture quality, without any conversion. ---------- */
  var LANG = { ara: 'Arabic', eng: 'English' };
  function searchSubs(lang) {
    var want = lang || { code: 'ara', name: 'Arabic' };
    var other = want.code === 'ara' ? { code: 'eng', name: 'English' } : { code: 'ara', name: 'Arabic' };
    st.search = { state: 'loading', items: [], lang: want.code, langName: want.name, other: other };
    st.pi = 0; renderPanel();
    var mine = st, s = srv();
    // Plex versions differ in how they want the question: try the forms the Plex apps use, keep the server's own words
    var two = want.code === 'ara' ? 'ar' : 'en';
    var forms = ['language=' + want.code + '&hearingImpaired=0&forced=0', 'language=' + two + '&hearingImpaired=0&forced=0', 'language=' + two, 'language=' + want.code];
    var lastErr = '';
    (function attempt(i) {
      if (st !== mine || !st.search) return;
      if (i >= forms.length) { st.search.state = 'error'; st.search.error = P.t("Couldn't search") + ': ' + (lastErr || P.t('your server refused')); renderPanel(); return; }
      fetch(s.uri + '/library/metadata/' + st.key + '/subtitles?' + forms[i], { headers: P.Plex.hdrs(s.token) }).then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) { lastErr = 'your server said ' + r.status + (t ? ' (' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) + ')' : ''); throw 0; }
          var d = {}; try { d = JSON.parse(t); } catch (e) { lastErr = 'unexpected answer'; throw 0; }
          if (st !== mine || !st.search) return;
          var mc = d.MediaContainer || {};
          var items = (mc.Stream || mc.Metadata || []);
          // Your server's search matches loosely ("Black Torch" brings "Black Clover"). Keep the ones whose name has the
          // show's (or film's) title; the right episode first, then the ones Plex made for your file, then Plex's score.
          var meta = st.meta || {}, norm = function (t) { return ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim() + ' '; };
          var words = norm(meta.grandparentTitle || meta.title).trim().split(' ').filter(function (w) { return w.length > 1 && !/^(the|a|an|of|and)$/.test(w); });
          var ep = meta.type === 'episode' ? new RegExp('s0*' + meta.parentIndex + '\\s*e0*' + meta.index + '(?!\\d)|(^|\\D)' + meta.parentIndex + 'x0*' + meta.index + '(?!\\d)') : null;
          var named = items.some(function (x) { return x.title || x.fileName; });
          items.forEach(function (x) {
            var n = norm((x.title || '') + ' ' + (x.fileName || ''));
            x._ok = !named || !words.length || words.every(function (w) { return n.indexOf(' ' + w + ' ') >= 0; });
            x._ep = !!(ep && ep.test(n.replace(/ /g, '')) || ep && ep.test(n));
          });
          items.sort(function (a, b) { return (b._ep - a._ep) || (+(b.perfectMatch || 0) - +(a.perfectMatch || 0)) || ((+b.score || 0) - (+a.score || 0)); });
          st.search.items = items.filter(function (x) { return x._ok; }).slice(0, 12);
          st.search.others = items.filter(function (x) { return !x._ok; }).slice(0, 20);
          st.search.what = (meta.grandparentTitle || meta.title || '') + (meta.type === 'episode' ? ' ' + P.t('S{s} E{e}', { s: meta.parentIndex, e: meta.index }) : '');
          st.search.state = 'list'; renderPanel();
        });
      }).catch(function () { attempt(i + 1); });
    })(0);
  }
  function pickOnline(x) {
    var S = st.search, mine = st, before = {};
    st.plan.subs.forEach(function (s) { before[s.id] = true; });
    S.state = 'saving'; renderPanel();
    var q = 'key=' + encodeURIComponent(x.key || x.sourceKey || '') + '&codec=' + encodeURIComponent(x.codec || 'srt') + '&language=' + encodeURIComponent(x.languageCode || S.lang) +
      '&hearingImpaired=' + (x.hearingImpaired ? 1 : 0) + '&forced=' + (x.forced ? 1 : 0) + (x.providerTitle ? '&providerTitle=' + encodeURIComponent(x.providerTitle) : '');
    var s = srv();
    fetch(s.uri + '/library/metadata/' + st.key + '/subtitles?' + q, { method: 'PUT', headers: P.Plex.hdrs(s.token) }).then(function (r) {
      if (!r.ok) throw new Error('your server said ' + r.status);
      // the server downloads it; look for the new subtitle a few times
      var tries = 0;
      return new Promise(function (done, fail) {
        (function look() {
          get('/library/metadata/' + mine.key).then(function (d) {
            if (st !== mine) return;
            var m = ((d.MediaContainer || {}).Metadata || [])[0] || {};
            var part = ((((m.Media || [])[0] || {}).Part || [])[0]) || {};
            var subs = (part.Stream || []).filter(function (z) { return z.streamType === 3; });
            var fresh = subs.filter(function (z) { return !before[z.id] && z.key; })[0];
            if (fresh) { done({ subs: subs, fresh: fresh }); return; }
            if (++tries >= 8) { fail(new Error('the server didn\'t add it')); return; }
            setTimeout(look, 2000);
          }, fail);
        })();
      });
    }).then(function (res) {
      if (st !== mine) return;
      st.plan.subs = res.subs; st.search = null;
      put('/library/parts/' + st.plan.part.id + '?subtitleStreamID=' + res.fresh.id + '&allParts=1');
      var special = st.plan.remuxSubs || st.plan.forceBurn;
      st.plan.remuxSubs = false; st.plan.forceBurn = false; st.triedRemux = false; st.triedBurn = false; st.subLog = [];
      if (special || st.plan.burn) restart({ sub: res.fresh }); else { st.plan.sub = res.fresh; loadSubs(res.fresh); }
      st.pi = 0; renderPanel();
    }).catch(function (e) {
      if (st !== mine || !st.search) return;
      S.state = 'error'; S.error = P.t("Couldn't add it") + ': ' + (e && e.message || 'error'); renderPanel();
    });
  }

  function renderInfo() {
    var pl = st.plan, m = pl.media;
    var res = (m.videoResolution || '').toUpperCase(); if (res === '4K' || res === '1080' || res === '720') res = res === '4K' ? '4K' : res + 'p';
    var hdr = (pl.part.Stream || []).filter(function (x) { return x.streamType === 1; })[0] || {};
    var dr = hdr.DOVIPresent ? 'Dolby Vision' : /hdr|pq|smpte2084|hlg/i.test((hdr.colorTrc || '') + (hdr.displayTitle || '')) ? 'HDR10' : 'SDR';
    var qq = qOf(st.quality);
    var how = pl.direct ? P.t('Directly, no conversion') : pl.remuxSubs ? P.t('Repackaged: picture and sound copied, subtitles sent as text') : pl.q ? P.t('Converted to {q}', { q: qq ? P.t(qq.label) : '' }) : pl.burn ? P.t('Picture converted to show subtitles') : P.t('Audio converted, picture original');
    var sl = pl.sub ? labels(pl.subs, true)[pl.subs.indexOf(pl.sub)] : P.t('Off');
    var rows = [['Video', [res, dr, (m.videoCodec || '').toUpperCase()].filter(Boolean).join(' · ')],
      ['Audio', pl.audio ? labels(pl.audios, false)[pl.audios.indexOf(pl.audio)] : '—'], ['Subtitles', sl + (st.subHow ? ' — ' + P.t(st.subHow) : '') + (st.ass && st.ass.ready ? ' · ' + P.t('styled as in the file') : pl.sub && st.styleNote ? ' · ' + P.t('plain') + ' (' + st.styleNote + ')' : '')],
      ['Version', st.versionLabel || '—'], ['Playing', how], ['Server', srv().name], ['Bitrate', m.bitrate ? mbps(m.bitrate) : '—']];
    P.$('#plInfo').innerHTML = rows.map(function (r) { return '<div><span>' + P.t(r[0]) + '</span><b>' + P.esc(r[1]) + '</b></div>'; }).join('');
  }

  function renderNext() {
    var n = st.nextMeta, el = P.$('#plNext');
    if (!st.upNext || !n) { el.classList.remove('on'); return; }
    var img = n.thumb ? srv().uri + '/photo/:/transcode?width=480&height=270&minSize=1&upscale=1&url=' + encodeURIComponent(n.thumb) + '&X-Plex-Token=' + tok() : '';
    el.innerHTML = '<div class="pn-img">' + (img ? '<img src="' + img + '" alt="">' : '') + '<span>' + P.t('Up next in') + ' <b>' + st.count + '</b></span></div>' +
      '<div class="pn-t">' + P.t('S{s} E{e}', { s: n.parentIndex, e: n.index }) + ' · ' + P.esc(n.title) + '</div>' +
      '<div class="pn-b"><button class="' + (st.nsel === 0 ? 'focus' : '') + '">' + P.t('Play now') + '</button><button class="' + (st.nsel === 1 ? 'focus' : '') + '">' + P.t('Stay here') + '</button></div>';
    el.classList.add('on');
  }

  /* ---------- playing ---------- */
  /* Every stream gets a number. Samsung's player still reports on a stream after Plume has closed it (an error for the
     interrupted start, a last time update); anything about an older stream is ignored, so it can't upset the new one. */
  var streamGen = 0;
  function startAV(url, offsetMs) {
    var A = av(), gen = ++streamGen, mine = st;
    var live = function () { return st && st === mine && gen === streamGen; };
    try { A.stop(); A.close(); } catch (e) {}
    st.timeMode = st.plan.direct || !st.base ? 'abs' : null;   // a converted stream may count from its start or from the title's
    A.open(url);
    A.setDisplayRect(0, 0, 1920, 1080);
    try { A.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e) {}
    if (String(st.plan.media.videoResolution).toLowerCase() === '4k' && !st.plan.q) { try { A.setStreamingProperty('SET_MODE_4K', 'TRUE'); } catch (e) {} }
    A.setListener({
      onbufferingstart: function () { if (live()) root.classList.add('waiting'); },
      onbufferingcomplete: function () { if (live()) root.classList.remove('waiting'); },
      oncurrentplaytime: function (ms) {
        if (!live()) return;
        // the first update tells which: a time near the start position means the player already counts from the title's start
        if (!st.timeMode) st.timeMode = ms >= st.base - 20000 ? 'abs' : 'rel';
        st.t = st.timeMode === 'abs' ? ms : st.base + ms;
        tick();
      },
      onstreamcompleted: function () { if (live()) finished(); },
      onerror: function (e) { if (live()) failed(e); },
      onsubtitlechange: function (dur, text) { if (live() && st.embedded) setSubText(String(text || '').replace(/<[^>]+>/g, '')); }
    });
    root.classList.add('waiting');
    st.ready = false;
    A.prepareAsync(function () {
      if (!live()) return;
      st.dur = (st.meta && st.meta.duration) || (A.getDuration() + (st.base || 0)) || st.dur;   // the title's own length, never the stream's
      var go = function () {
        A.play(); st.playing = true; st.ready = true; root.classList.remove('waiting'); report('playing'); show(true); paint();
        if (st.pendingSub) {   // a subtitle that needed the video to be ready first
          var ps = st.pendingSub; st.pendingSub = null;
          if (st.plan.sub === ps) { if (useEmbeddedSubs(ps)) st.subHow = 'Shown by the TV'; else { st.subLog = (st.subLog || []).concat('the TV: it has no such track'); fromFile(ps, st.subGen); } }
        }
      };
      if (st.plan.direct && offsetMs > 1000) A.seekTo(offsetMs, go, go); else go();
    }, function (e) { if (live()) failed(e); });
  }

  function restart(change) {
    var end = (st.meta && st.meta.duration) || st.dur || 0;
    var at = Math.max(0, end ? Math.min(st.t, end - 5000) : st.t);   // never ask for a position past the end
    st.t = at;
    report('stopped');
    if (!st.plan.direct) ping('/video/:/transcode/universal/stop?session=' + st.session);
    st.session = 'plume-' + Date.now().toString(36);
    if (change.audio) st.plan.audio = change.audio;
    if ('sub' in change) st.plan.sub = change.sub;
    var pl = st.plan;
    pl.burn = !!(pl.sub && (IMAGE_SUBS.test(pl.sub.codec || '') || pl.forceBurn));
    pl.convertAudio = !!(pl.audio && BAD_AUDIO.test(pl.audio.codec || ''));
    var qq = qOf(st.quality); pl.q = qq && qq.q; pl.direct = !pl.burn && !pl.convertAudio && !pl.q && !pl.remuxSubs;
    st.base = pl.direct ? 0 : at;            // a converted stream starts at the position asked for
    st.panel = false; P.$('#plPanel').classList.remove('on');
    loadSubs(pl.burn ? null : pl.sub);
    startStream(at);
  }

  function tick() {
    if (!st) return;
    var t = st.t;
    if (st.cues) subsAt(t);
    syncStyled();
    // skip intro: only when Plex marked the intro
    var intro = (st.markers || []).filter(function (m) { return m.type === 'intro' && t >= m.startTimeOffset && t < m.endTimeOffset - 1500; })[0];
    st.skipTo = intro ? intro.endTimeOffset : null;
    if (!st.skipTo && st.zone === 'skip') st.zone = 'btns';
    // up next: when the credits start (Plex marker), or 25 s before the end
    var credits = (st.markers || []).filter(function (m) { return m.type === 'credits'; })[0];
    var at = credits ? credits.startTimeOffset : st.dur - 25000;
    if (st.nextMeta && !st.upNext && !st.stayed && st.dur > 60000 && t >= at) { st.upNext = true; st.count = 10; st.nsel = 0; renderNext(); }
    if (st.ui || st.seek != null) paint(); else if (st.skipTo || P.$('#plSkip').classList.contains('on')) paint();
  }
  function countdown() {
    if (!st || !st.upNext || !st.playing) return;
    st.count--;
    if (st.count <= 0 && P.S.get('autoNext') !== false) { playNext(); return; }
    renderNext();
  }

  function report(state) {
    if (!st || !st.key) return;
    if (st.dur && st.t > st.dur + 5000) return;          // never save a position past the end
    var q = '/:/timeline?ratingKey=' + st.key + '&key=' + encodeURIComponent('/library/metadata/' + st.key) + '&state=' + state +
      '&time=' + Math.round(st.t) + '&duration=' + Math.round(st.dur || 0) + '&X-Plex-Session-Identifier=' + st.session;
    ping(q);
    if (state !== 'playing') others();
  }
  function others() {   // the same position on your other copies of this title
    (st.copies || []).forEach(function (c) {
      if (c.key !== st.key) ping('/:/progress?key=' + c.key + '&identifier=com.plexapp.plugins.library&time=' + Math.round(st.t) + '&state=stopped');
    });
  }

  function finished() {
    if (!st) return;
    st.t = st.dur; report('stopped');
    if (st.nextMeta && P.S.get('autoNext') !== false && !st.stayed) playNext(); else V.close();
  }
  function failed(e) {
    P.log('player error', e);
    if (!st) return;
    var code = e && (e.name || e.message) || String(e || 'error');
    if (st.plan && st.plan.remuxSubs) { st.plan.remuxSubs = false; fallback(st.plan.sub, 'the TV couldn\'t play it (' + code + ')'); return; }
    if (st.plan && st.plan.forceBurn) {   // the server won't draw them in either: play on without them
      st.subLog = (st.subLog || []).concat('converted picture: the TV couldn\'t play it (' + code + ')');
      st.plan.forceBurn = false; st.plan.sub = null; restart({});
      st.subHow = P.t("Couldn't show them") + ' — ' + st.subLog.join(' · ') + P.t('. Try Search subtitles online in ⚙'); return;
    }
    if (st.plan && st.plan.direct && !st.triedConvert) {   // the TV couldn't play the file as it is: let the server help once
      st.triedConvert = true; st.plan.convertAudio = true; restart({});
      return;
    }
    var card = st.card;
    V.close();
    P.UI.dialog({ title: P.t("Couldn't play this here"), body: '<p>' + P.t('Your Plex server or the TV refused this title') + (st && st.plan && !st.plan.direct ? P.t(' (your provider may not allow conversion)') : '') + P.t('. Open it in the Plex app instead?') + '</p>',
      buttons: [{ label: P.t('Open in Plex'), act: function () { P.Plex.openApp(card); } }, { label: P.t('Cancel') }] });
  }

  function loadNext(meta) {
    st.nextMeta = null;
    if (meta.type !== 'episode') return;
    get('/library/metadata/' + meta.parentRatingKey + '/children').then(function (d) {
      var eps = (d.MediaContainer || {}).Metadata || [];
      var n = eps.filter(function (e) { return e.index === meta.index + 1; })[0];
      if (n) return n;
      return get('/library/metadata/' + meta.grandparentRatingKey + '/children').then(function (d2) {
        var seasons = ((d2.MediaContainer || {}).Metadata || []).filter(function (s) { return s.index === meta.parentIndex + 1; });
        if (!seasons.length) return null;
        return get('/library/metadata/' + seasons[0].ratingKey + '/children').then(function (d3) { return (((d3.MediaContainer || {}).Metadata) || [])[0] || null; });
      });
    }).then(function (n) { if (st) { st.nextMeta = n; paint(); } }).catch(function () {});
  }
  function playNext() {
    var n = st.nextMeta; if (!n) return;
    var card = { key: String(n.ratingKey), title: st.card.title, offset: 0, copies: [{ key: String(n.ratingKey), res: '', viewed: Date.now(), offset: 0 }] };
    V.close(true);
    V.open(card);
  }

  /* ---------- opening and closing ---------- */
  /* which version plays: the one you chose from the card's menu, else the one you played last (here or in the Plex app) */
  function pickVersion(card, key) {
    if (!card.copies || card.copies.length < 2)
      return Promise.resolve({ play: { key: card.key, label: '' }, all: [{ key: card.key }], offset: card.offset || 0 });
    return P.Plex.versions(card).then(function (vs) {
      var c = P.Plex.choose(card, vs);
      if (key) c.play = vs.filter(function (v) { return v.key === key; })[0] || c.play;
      return c;
    });
  }

  V.open = function (card, key) {
    if (!av()) { P.Plex.openApp(card); return; }       // only on the TV
    st = { card: card, key: null, copies: [], t: 0, dur: 0, base: 0, playing: false, ui: true, zone: 'btns', sel: 3,
      seek: null, panel: false, info: false, pi: 0, quality: 'original', session: 'plume-' + Date.now().toString(36) };
    V.open_ = true;
    build();
    document.body.classList.add('playing');
    P.UI.push(layer);
    clock(); tickT = setInterval(function () { clock(); countdown(); }, 1000);
    saveT = setInterval(function () { if (st && st.playing) report('playing'); }, 10000);
    otherT = setInterval(function () { if (st && st.playing) others(); }, 60000);
    var mine = st;
    pickVersion(card, key).then(function (c) {
      if (st !== mine) throw new Error('closed');
      st.key = c.play.key; st.copies = c.all; st.t = c.offset;
      st.versionLabel = c.play.label ? c.play.label + (key ? ' — ' + P.t('your pick') : c.why ? ' — ' + P.t(c.why) : '') : '';
      if (card.guid) P.Plex.remember(card, st.key);
      return get('/library/metadata/' + st.key + '?includeMarkers=1');
    }).then(function (d) {
      var meta = ((d.MediaContainer || {}).Metadata || [])[0];
      if (!meta || !st) throw new Error('not found');
      st.meta = meta; st.dur = meta.duration || 0; st.markers = meta.Marker || [];
      P.$('#plTitle').textContent = meta.type === 'episode' ? meta.grandparentTitle : meta.title;
      P.$('#plEp').textContent = meta.type === 'episode' ? P.t('S{s} E{e}', { s: meta.parentIndex, e: meta.index }) + ' · ' + meta.title : (meta.year || '');
      st.qualities = qualities((meta.Media || [])[0] || {});
      st.plan = plan(meta, st.quality);
      st.thumbs = /sd/.test(st.plan.part.indexes || '');
      st.base = st.plan.direct ? 0 : st.t;
      loadSubs(st.plan.burn ? null : st.plan.sub);
      loadNext(meta);
      startStream(st.t);
      paint();
    }).catch(function (e) { if (st === mine) failed(e); });
  };

  V.close = function (quiet) {
    if (!st) return;
    try { report('stopped'); } catch (e) {}
    if (st.key) P.Plex.snapshot(st.card, st.key);
    if (st.plan && !st.plan.direct) ping('/video/:/transcode/universal/stop?session=' + st.session);
    try { av().stop(); av().close(); } catch (e) {}
    clearInterval(tickT); clearInterval(saveT); clearInterval(otherT); clearTimeout(hideT); clearTimeout(jumpT); clearInterval(st.vttT); clearInterval(st.fileT); st.fileSubs = null; stopStyled();
    st = null; V.open_ = false;
    if (root) { root.remove(); root = null; } subEl = null;
    document.body.classList.remove('playing');
    P.UI.pop(layer);
    if (!quiet) setTimeout(P.Plex.refresh, 1500);   // your new position shows on the home screen
  };

  /* ---------- remote ---------- */
  function playPause() {
    if (!st || !st.plan) return;
    try { if (st.playing) { av().pause(); st.playing = false; report('paused'); } else { av().play(); st.playing = true; report('playing'); } } catch (e) {}
    show(true); paint();
  }
  /* −10 / +10: the bar and time move at once; the video jumps once, shortly after the last press,
     so several presses cost one jump (one wait for your provider's server) instead of one each */
  var jumpT = null;
  function jump(ms) {
    if (!st || !st.plan) return;
    var from = st.jumpTo != null ? st.jumpTo : st.t;
    st.jumpTo = Math.max(0, Math.min(st.dur - 2000, from + ms));
    clearTimeout(jumpT);
    jumpT = setTimeout(function () { if (st && st.jumpTo != null) { var to = st.jumpTo; st.jumpTo = null; seekNow(to); } }, 550);
    show(true); paint();
  }
  function seekNow(to) {
    if (!st || !st.plan) return;
    clearTimeout(jumpT); st.jumpTo = null;
    to = Math.max(0, Math.min(st.dur - 2000, to));
    st.cueAt = 0;
    if (st.plan.direct) { try { av().seekTo(to); } catch (e) {} st.t = to; }
    else { st.t = to; restart({}); }
    show(true); paint();
  }

  var layer = {
    name: 'player',
    key: function (k) {
      if (!st) return;
      if (k === 'pp') { playPause(); return; }
      if (k === 'ff') { jump(10000); return; }
      if (k === 'rw') { jump(-10000); return; }
      if (k === 'stop') { V.close(); return; }
      if (!st.plan) { if (k === 'back') V.close(); return; }   // still starting
      if (st.upNext && !st.panel && !st.info) {
        if (k === 'left' || k === 'right') { st.nsel = 1 - st.nsel; renderNext(); return; }
        if (k === 'ok') { if (st.nsel === 0) playNext(); else { st.upNext = false; st.stayed = true; renderNext(); } return; }
        if (k === 'back') { st.upNext = false; st.stayed = true; renderNext(); return; }
      }
      if (st.panel) {
        var n = renderPanel().length;
        if (k === 'up') st.pi = Math.max(0, st.pi - 1);
        if (k === 'down') st.pi = Math.min(n - 1, st.pi + 1);
        if (k === 'ok') { choosePanel(); return; }
        var cur = renderPanel()[st.pi];
        if (cur && cur.k === 'offset' && (k === 'left' || k === 'right')) { shiftSubs(k === 'left' ? -1 : 1); return; }
        if ((k === 'back' || k === 'left') && st.search) { st.search = null; st.pi = 0; renderPanel(); return; }
        if (k === 'back' || k === 'left') { st.panel = false; P.$('#plPanel').classList.remove('on'); show(true); paint(); return; }
        renderPanel(); return;
      }
      if (st.info) { if (k === 'back' || k === 'ok') { st.info = false; P.$('#plInfo').classList.remove('on'); show(true); } return; }
      if (!st.ui) {
        if (k === 'back') { V.close(); return; }
        if (k === 'ok' && st.skipTo) { jumpTo(st.skipTo); return; }
        show(true); paint(); return;
      }
      if (k === 'back') { if (st.seek != null) { st.seek = null; st.zone = 'btns'; paint(); return; } show(false); return; }
      if (st.zone === 'skip') {
        if (k === 'ok') { jumpTo(st.skipTo); st.zone = 'btns'; }
        if (k === 'down') st.zone = 'bar';
        show(true); paint(); return;
      }
      if (st.zone === 'bar') {
        if (k === 'left' || k === 'right') {
          // held or pressed quickly: 30 s steps, then 1 min, then 2 min
          var now = Date.now(); st.run = now - (st.lastStep || 0) < 450 ? (st.run || 0) + 1 : 0; st.lastStep = now;
          var step = st.run > 12 ? 120000 : st.run > 5 ? 60000 : 30000;
          st.seek = Math.max(0, Math.min(st.dur - 2000, (st.seek != null ? st.seek : st.t) + (k === 'left' ? -step : step)));
        }
        if (k === 'ok' && st.seek != null) { var to = st.seek; st.seek = null; seekNow(to); }
        if (k === 'down') { st.seek = null; st.zone = 'btns'; }
        if (k === 'up' && st.skipTo) { st.seek = null; st.zone = 'skip'; }
        show(true); paint(); return;
      }
      if (k === 'left') st.sel = Math.max(0, st.sel - 1);
      if (k === 'right') { st.sel = Math.min(BTNS.length - 1, st.sel + 1); if (BTNS[st.sel] === 'next' && !st.nextMeta) st.sel--; }
      if (k === 'up') st.zone = 'bar';
      if (k === 'ok') {
        var b = BTNS[st.sel];
        if (b === 'pp') { playPause(); return; }
        if (b === 'rw') { jump(-10000); return; }
        if (b === 'ff') { jump(10000); return; }
        if (b === 'set') { st.panel = true; st.pi = Math.max(0, panelRows().filter(function (r) { return !r.h; }).findIndex(function (r) { return r.on; })); renderPanel(); P.$('#plPanel').classList.add('on'); clearTimeout(hideT); return; }
        if (b === 'info') { st.info = true; renderInfo(); P.$('#plInfo').classList.add('on'); clearTimeout(hideT); return; }
        if (b === 'next' && st.nextMeta) { playNext(); return; }
      }
      show(true); paint();
    }
  };
  function jumpTo(ms) { seekNow(ms); }
  V.layer = layer;
  V.debug = function () { return st; };
  V._parseSubs = parseSubs;   // for the tests
})();
