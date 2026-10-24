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
    var list = [{ id: 'original', label: [resLabel(media.videoResolution), br ? mbps(br) : ''].filter(Boolean).join(' · ') + ' (Original)', q: null }];
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
        var t = m[3].replace(/<[^>]+>/g, '').trim();
        if (t) out.push({ a: parseTime(a), b: parseTime(b), t: t, top: /line:\s*[0-9]{1,2}%/.test(blk.split('\n')[0] || '') && !/line:\s*[5-9][0-9]%/.test(blk) });
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
    st.cues = null; st.cueAt = 0; setSubText(''); stopEmbedded();
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
      })
      .catch(function (e) {
        if (!st || st.subGen !== want) return;
        // the TV can read the track inside the video, but only once the video is ready: wait for it if needed
        if (st.plan.direct && !sub.key) {
          if (!st.ready) { st.pendingSub = sub; st.subHow = 'Waiting for the video'; return; }
          if (useEmbeddedSubs(sub)) { st.subHow = 'Shown by the TV'; return; }
        }
        fallback(sub, e && e.message || 'error');
      });
  }
  /* The subtitle is inside the video, the server won't hand it over as a file and the TV can't read it (ASS, for example).
     1) ask the server to repackage the video (picture and sound copied, no quality loss) and send the subtitles as text;
     2) if that's refused, the server draws them into the picture (automatic, slightly lower picture quality). */
  function fallback(sub, why) {
    if (!st || !sub || IMAGE_SUBS.test(sub.codec || '')) return;
    st.subLog = (st.subLog || []).concat(why);
    var pl = st.plan;
    if (!st.triedRemux) { st.triedRemux = true; pl.remuxSubs = true; pl.forceBurn = false; st.subHow = 'Asking the server to send them as text'; restart({}); return; }
    if (!st.triedBurn) { st.triedBurn = true; pl.remuxSubs = false; pl.forceBurn = true; st.subHow = 'Drawn into the picture by the server'; restart({}); return; }
    st.subHow = "Couldn't show them (" + st.subLog.join(' · ') + ')';
  }

  /* ---------- the remuxed stream: picture from its own playlist, subtitles from theirs (WebVTT pieces) ---------- */
  function startStream(at) {
    var pl = st.plan, url = streamUrl(pl, st.key, at);
    clearInterval(st.vttT); st.vttSeen = {};
    if (!pl.remuxSubs) { startAV(url, at); return; }
    var mine = st, session = st.session, s = srv();
    root.classList.add('waiting');
    fetch(url, { headers: P.Plex.hdrs(s.token) }).then(function (r) { if (!r.ok) throw new Error('server said ' + r.status); return r.text(); }).then(function (master) {
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
    root.innerHTML = '<object id="avp" type="application/avplayer"></object>' +
      '<div class="pl-sub" id="plSub"></div><div class="pl-sub top" id="plSubTop"></div>' +
      '<div class="pl-wait" id="plWait"><i></i></div>' +
      '<div class="pl-ui" id="plUi"><div class="pl-shade"></div>' +
      '<div class="pl-top"><div><div class="pl-title" id="plTitle"></div><div class="pl-ep" id="plEp"></div></div><div class="pl-clock" id="plClock"></div></div>' +
      '<div class="pl-bar" id="plBar"><i id="plFill"></i><b id="plKnob"></b><div class="pl-prev" id="plPrev"><img id="plPrevImg" alt=""><span id="plPrevT"></span></div></div>' +
      '<div class="pl-times"><span id="plT"></span><span id="plLeft"></span></div>' +
      '<div class="pl-btns"><div class="pl-l"><button data-b="set">' + ICONS.gear + '</button><button data-b="info">' + ICONS.info + '</button></div>' +
      '<div class="pl-c"><button data-b="rw">−10</button><button data-b="pp" class="big" id="plPP"></button><button data-b="ff">+10</button></div>' +
      '<div class="pl-r"><button data-b="next" class="pill" id="plNextBtn">Next episode</button></div></div></div>' +
      '<button class="pl-skip" id="plSkip">Skip intro</button>' +
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
    P.$('#plLeft').textContent = fmt(d - t) + ' left';
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
    rows.push({ h: 'Subtitles' }); rows.push({ k: 'sub', v: 0, label: 'Off', on: !pl.sub });
    var sl = labels(pl.subs, true);
    pl.subs.forEach(function (x, i) { rows.push({ k: 'sub', v: x.id, label: sl[i], on: x === pl.sub }); });
    rows.push({ h: 'Audio' });
    var al = labels(pl.audios, false);
    pl.audios.forEach(function (x, i) { rows.push({ k: 'aud', v: x.id, label: al[i], on: x === pl.audio }); });
    rows.push({ h: 'Quality' });
    (st.qualities || []).forEach(function (q) { rows.push({ k: 'q', v: q.id, label: q.label, on: st.quality === q.id }); });
    return rows;
  }
  /* Clear names, so two Arabic tracks don't read the same: Arabic (SRT) · Forced, English · SDH, ... */
  function labels(list, isSub) {
    var out = list.map(function (x) {
      var t = x.extendedDisplayTitle || x.displayTitle || x.language || (isSub ? 'Subtitles' : 'Audio');
      var extra = [];
      if (x.title && t.indexOf(x.title) < 0) extra.push(x.title);
      if (x.forced && !/forced/i.test(t)) extra.push('Forced');
      if (x.hearingImpaired && !/sdh/i.test(t)) extra.push('SDH');
      return t + (extra.length ? ' · ' + extra.join(' · ') : '');
    });
    out = out.map(function (t, i) {
      if (out.filter(function (u) { return u === t; }).length < 2) return t;
      var x = list[i];
      return t + ' · ' + (isSub ? (x.key ? 'External' : 'In the file') : (x.codec || '').toUpperCase()) ;
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
    }).join('') + '<div class="pp-note">Starts with Plex\'s choices for this ' + (st.meta && st.meta.type === 'episode' ? 'episode' : 'title') + '. Subtitle and audio changes are saved to Plex.</div>';
    var f = P.$('#plPanel .pp-r.focus'); if (f) f.scrollIntoView({ block: 'nearest' });
    return pick;
  }
  function choosePanel() {
    var r = renderPanel()[st.pi]; if (!r) return;
    var pl = st.plan;
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

  function renderInfo() {
    var pl = st.plan, m = pl.media;
    var res = (m.videoResolution || '').toUpperCase(); if (res === '4K' || res === '1080' || res === '720') res = res === '4K' ? '4K' : res + 'p';
    var hdr = (pl.part.Stream || []).filter(function (x) { return x.streamType === 1; })[0] || {};
    var dr = hdr.DOVIPresent ? 'Dolby Vision' : /hdr|pq|smpte2084|hlg/i.test((hdr.colorTrc || '') + (hdr.displayTitle || '')) ? 'HDR10' : 'SDR';
    var qq = qOf(st.quality);
    var how = pl.direct ? 'Directly, no conversion' : pl.remuxSubs ? 'Repackaged: picture and sound copied, subtitles sent as text' : pl.q ? 'Converted to ' + (qq ? qq.label : '') : pl.burn ? 'Picture converted to show subtitles' : 'Audio converted, picture original';
    var sl = pl.sub ? labels(pl.subs, true)[pl.subs.indexOf(pl.sub)] : 'Off';
    var rows = [['Video', [res, dr, (m.videoCodec || '').toUpperCase()].filter(Boolean).join(' · ')],
      ['Audio', pl.audio ? labels(pl.audios, false)[pl.audios.indexOf(pl.audio)] : '—'], ['Subtitles', sl + (st.subHow ? ' — ' + st.subHow : '')],
      ['Version', st.versionLabel || '—'], ['Playing', how], ['Server', srv().name], ['Bitrate', m.bitrate ? mbps(m.bitrate) : '—']];
    P.$('#plInfo').innerHTML = rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + P.esc(r[1]) + '</b></div>'; }).join('');
  }

  function renderNext() {
    var n = st.nextMeta, el = P.$('#plNext');
    if (!st.upNext || !n) { el.classList.remove('on'); return; }
    var img = n.thumb ? srv().uri + '/photo/:/transcode?width=480&height=270&minSize=1&upscale=1&url=' + encodeURIComponent(n.thumb) + '&X-Plex-Token=' + tok() : '';
    el.innerHTML = '<div class="pn-img">' + (img ? '<img src="' + img + '" alt="">' : '') + '<span>Up next in <b>' + st.count + '</b></span></div>' +
      '<div class="pn-t">S' + n.parentIndex + ' E' + n.index + ' · ' + P.esc(n.title) + '</div>' +
      '<div class="pn-b"><button class="' + (st.nsel === 0 ? 'focus' : '') + '">Play now</button><button class="' + (st.nsel === 1 ? 'focus' : '') + '">Stay here</button></div>';
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
          if (st.plan.sub === ps) { if (useEmbeddedSubs(ps)) st.subHow = 'Shown by the TV'; else fallback(ps, 'the TV has no such track'); }
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
    if (st.plan && st.plan.remuxSubs) { st.plan.remuxSubs = false; fallback(st.plan.sub, 'repackaging refused'); return; }
    if (st.plan && st.plan.forceBurn) {   // the server won't draw them in either: play on without them
      st.plan.forceBurn = false; st.plan.sub = null; restart({});
      st.subHow = "Couldn't show them: the server refused to repackage or convert this title"; return;
    }
    if (st.plan && st.plan.direct && !st.triedConvert) {   // the TV couldn't play the file as it is: let the server help once
      st.triedConvert = true; st.plan.convertAudio = true; restart({});
      return;
    }
    var card = st.card;
    V.close();
    P.UI.dialog({ title: "Couldn't play this here", body: '<p>Your Plex server or the TV refused this title' + (st && st.plan && !st.plan.direct ? ' (your provider may not allow conversion)' : '') + '. Open it in the Plex app instead?</p>',
      buttons: [{ label: 'Open in Plex', act: function () { P.Plex.openApp(card); } }, { label: 'Cancel' }] });
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
      st.versionLabel = c.play.label ? c.play.label + (key ? ' — your pick' : c.why ? ' — ' + c.why : '') : '';
      if (card.guid) P.Plex.remember(card, st.key);
      return get('/library/metadata/' + st.key + '?includeMarkers=1');
    }).then(function (d) {
      var meta = ((d.MediaContainer || {}).Metadata || [])[0];
      if (!meta || !st) throw new Error('not found');
      st.meta = meta; st.dur = meta.duration || 0; st.markers = meta.Marker || [];
      P.$('#plTitle').textContent = meta.type === 'episode' ? meta.grandparentTitle : meta.title;
      P.$('#plEp').textContent = meta.type === 'episode' ? 'S' + meta.parentIndex + ' E' + meta.index + ' · ' + meta.title : (meta.year || '');
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
    clearInterval(tickT); clearInterval(saveT); clearInterval(otherT); clearTimeout(hideT); clearTimeout(jumpT); clearInterval(st.vttT);
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
