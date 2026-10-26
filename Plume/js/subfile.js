/* Reading a subtitle track straight out of an MKV file on your Plex server, a few kilobytes at a time.
   For subtitles inside the video (ASS, SSA, SRT) when the server won't convert them and the TV can't show them.

   An MKV file keeps an index (its "Cues") of where things are. Most files list every subtitle line in it, with the
   exact spot of each line inside the file: Plume reads the index once, then fetches only the subtitle lines, a little
   ahead of where you're watching. Files whose index lists no subtitle lines: Plume reads the file's pieces (clusters)
   just ahead of you instead, if they're small enough (a few MB). The video itself is never downloaded twice.

   P.SubFile.open(url, want) → Promise of a reader:
     reader.mode   'index' (subtitle lines in the index) or 'pieces' (reading pieces ahead)
     reader.fill(fromMs, toMs) → Promise of new lines [{a, b, t, top}] in that stretch of time */
(function () {
  var ID = { EBML: 0x1A45DFA3, SEGMENT: 0x18538067, SEEKHEAD: 0x114D9B74, SEEK: 0x4DBB, SEEKID: 0x53AB, SEEKPOS: 0x53AC,
    INFO: 0x1549A966, SCALE: 0x2AD7B1, TRACKS: 0x1654AE6B, ENTRY: 0xAE, NUMBER: 0xD7, TYPE: 0x83, CODEC: 0x86, PRIVATE: 0x63A2,
    LANG: 0x22B59C, NAME: 0x536E, ENCODINGS: 0x6D80, ENCODING: 0x6240, COMPRESSION: 0x5034, COMPALGO: 0x4254, COMPSET: 0x4255,
    ENCRYPTION: 0x5035, CUES: 0x1C53BB6B, CUEPOINT: 0xBB, CUETIME: 0xB3, CUEPOS: 0xB7, CUETRACK: 0xF7, CUECLUSTER: 0xF1,
    CUEREL: 0xF0, CUEDUR: 0xB2, CLUSTER: 0x1F43B675, TIMECODE: 0xE7, SIMPLEBLOCK: 0xA3, GROUP: 0xA0, BLOCK: 0xA1, BLOCKDUR: 0x9B,
    ATTACHMENTS: 0x1941A469, ATTACHED: 0x61A7, FILENAME: 0x466E, FILEMIME: 0x4660, FILEDATA: 0x465C };
  var utf8 = new TextDecoder('utf-8');

  /* ---------- EBML: the building blocks of an MKV file ---------- */
  function vlen(b) { for (var n = 1, m = 0x80; n <= 8; n++, m >>= 1) if (b & m) return n; return 0; }
  function readId(u, p) {
    var n = vlen(u[p]); if (!n || n > 4 || p + n > u.length) return null;
    var v = 0; for (var i = 0; i < n; i++) v = v * 256 + u[p + i];
    return { id: v, len: n };
  }
  function readSize(u, p) {
    var n = vlen(u[p]); if (!n || p + n > u.length) return null;
    var v = u[p] & (0xFF >> n), all = v === (0xFF >> n);
    for (var i = 1; i < n; i++) { v = v * 256 + u[p + i]; if (u[p + i] !== 0xFF) all = false; }
    return { size: all ? -1 : v, len: n };
  }
  function uint(u, p, n) { var v = 0; for (var i = 0; i < n; i++) v = v * 256 + u[p + i]; return v; }
  function str(u, p, n) { return utf8.decode(u.subarray(p, p + n)).replace(/\0+$/, ''); }
  /* the elements one after another between start and end: fn(id, dataStart, size, headStart) */
  function each(u, start, end, fn) {
    var p = start;
    while (p < end) {
      var id = readId(u, p); if (!id) return;
      var sz = readSize(u, p + id.len); if (!sz) return;
      var d = p + id.len + sz.len;
      if (fn(id.id, d, sz.size, p) === false) return;
      if (sz.size < 0) return;
      p = d + sz.size;
    }
  }

  /* ---------- fetching a stretch of the file ---------- */
  function ranger(url) {
    var bytes = 0;
    var get = function (start, end) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
      return fetch(url, { headers: { Range: 'bytes=' + start + '-' + end }, signal: ctrl && ctrl.signal }).then(function (r) {
        // a server that ignores Range would send the whole video: stop at once
        if (r.status !== 206) { if (ctrl) ctrl.abort(); clearTimeout(t); throw new Error(r.ok ? "the server won't send parts of the file" : 'the server said ' + r.status); }
        return r.arrayBuffer();
      }).then(function (b) { clearTimeout(t); bytes += b.byteLength; return new Uint8Array(b); }, function (e) { clearTimeout(t); throw e; });
    };
    get.used = function () { return bytes; };
    return get;
  }

  function inflate(u) {        // zlib, for files that store their subtitles compressed
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('compressed subtitles'));
    var s = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /* ---------- the file's layout: tracks, time scale, where the index is ---------- */
  function readTracks(u, s, e) {
    var list = [];
    each(u, s, e, function (id, d, size) {
      if (id !== ID.ENTRY) return;
      var t = { num: 0, type: 0, codec: '', priv: null, lang: '', name: '', comp: null, bad: false };
      each(u, d, d + size, function (cid, cd, cs) {
        if (cid === ID.NUMBER) t.num = uint(u, cd, cs);
        else if (cid === ID.TYPE) t.type = uint(u, cd, cs);
        else if (cid === ID.CODEC) t.codec = str(u, cd, cs);
        else if (cid === ID.PRIVATE) t.priv = u.slice(cd, cd + cs);
        else if (cid === ID.LANG) t.lang = str(u, cd, cs);
        else if (cid === ID.NAME) t.name = str(u, cd, cs);
        else if (cid === ID.ENCODINGS) each(u, cd, cd + cs, function (eid, ed, es) {
          if (eid !== ID.ENCODING) return;
          each(u, ed, ed + es, function (xid, xd, xs) {
            if (xid === ID.ENCRYPTION) t.bad = true;
            if (xid === ID.COMPRESSION) {
              t.comp = { algo: 0, set: null };
              each(u, xd, xd + xs, function (zid, zd, zs) { if (zid === ID.COMPALGO) t.comp.algo = uint(u, zd, zs); if (zid === ID.COMPSET) t.comp.set = u.slice(zd, zd + zs); });
            }
          });
        });
      });
      list.push(t);
    });
    return list;
  }

  function layout(get) {
    var L = { seg: 0, scale: 1000000, tracks: null, cuesAt: -1, attachAt: -1 };
    return get(0, 262143).then(function (u) {
      var p = 0, seg = null;
      each(u, 0, u.length, function (id, d, size, h) { if (id === ID.SEGMENT) { seg = { d: d, size: size }; return false; } });
      if (!seg) throw new Error('not an MKV file');
      L.seg = seg.d;
      var need = [];
      each(u, seg.d, u.length, function (id, d, size, h) {
        if (id === ID.CLUSTER) return false;
        if (size >= 0 && d + size > u.length) { if (id === ID.TRACKS || id === ID.INFO || id === ID.SEEKHEAD) need.push({ id: id, at: h, end: d + size }); return; }
        if (id === ID.INFO) each(u, d, d + size, function (i2, d2, s2) { if (i2 === ID.SCALE) L.scale = uint(u, d2, s2); });
        if (id === ID.TRACKS) L.tracks = readTracks(u, d, d + size);
        if (id === ID.SEEKHEAD) each(u, d, d + size, function (i2, d2, s2) {
          if (i2 !== ID.SEEK) return;
          var sid = 0, spos = -1;
          each(u, d2, d2 + s2, function (i3, d3, s3) { if (i3 === ID.SEEKID) sid = uint(u, d3, s3); if (i3 === ID.SEEKPOS) spos = uint(u, d3, s3); });
          if (sid === ID.CUES) L.cuesAt = L.seg + spos;
          if (sid === ID.ATTACHMENTS) L.attachAt = L.seg + spos;
          if (sid === ID.TRACKS && !L.tracks) need.push({ id: ID.TRACKS, at: L.seg + spos, end: -1 });
        });
        if (id === ID.CUES && size >= 0) L.cuesAt = h;
        if (id === ID.ATTACHMENTS) L.attachAt = h;
      });
      // the track list further into the file (big font attachments before it, for example)
      var tr = need.filter(function (n) { return n.id === ID.TRACKS; })[0];
      if (L.tracks || !tr) return L;
      return get(tr.at, tr.at + 1048575).then(function (v) {
        each(v, 0, v.length, function (id, d, size) { if (id === ID.TRACKS) { L.tracks = readTracks(v, d, Math.min(v.length, d + size)); return false; } });
        return L;
      });
    });
  }

  function readCues(get, L) {
    if (L.cuesAt < 0) return Promise.resolve([]);
    return get(L.cuesAt, L.cuesAt + 15).then(function (h) {
      var id = readId(h, 0), sz = id && readSize(h, id.len);
      if (!id || id.id !== ID.CUES || !sz || sz.size < 0) return [];
      if (sz.size > 16 * 1048576) throw new Error('the file index is too big');
      var d = L.cuesAt + id.len + sz.len;
      return get(d, d + sz.size - 1).then(function (u) {
        var out = [];
        each(u, 0, u.length, function (cid, cd, cs) {
          if (cid !== ID.CUEPOINT) return;
          var time = 0, pos = [];
          each(u, cd, cd + cs, function (i2, d2, s2) {
            if (i2 === ID.CUETIME) time = uint(u, d2, s2);
            if (i2 === ID.CUEPOS) {
              var c = { track: 0, cluster: -1, rel: -1, dur: -1 };
              each(u, d2, d2 + s2, function (i3, d3, s3) {
                if (i3 === ID.CUETRACK) c.track = uint(u, d3, s3); else if (i3 === ID.CUECLUSTER) c.cluster = uint(u, d3, s3);
                else if (i3 === ID.CUEREL) c.rel = uint(u, d3, s3); else if (i3 === ID.CUEDUR) c.dur = uint(u, d3, s3);
              });
              pos.push(c);
            }
          });
          pos.forEach(function (c) { c.time = time; out.push(c); });
        });
        return out;
      });
    });
  }

  /* ---------- turning a subtitle block into a line ---------- */
  function topStyles(priv) {     // styles the file places at the top (ASS alignment 7–9, old SSA 5–7)
    var tops = {};
    if (!priv) return tops;
    var txt = utf8.decode(priv), fmt = null, ssa = /\[V4 Styles\]/i.test(txt) && !/\[V4\+ Styles\]/i.test(txt);
    txt.split(/\r?\n/).forEach(function (l) {
      var f = l.match(/^\s*Format:\s*(.*)$/i);
      if (f && /alignment/i.test(f[1])) { fmt = f[1].split(',').map(function (x) { return x.trim().toLowerCase(); }); return; }
      var s = l.match(/^\s*Style:\s*(.*)$/i); if (!s || !fmt) return;
      var parts = s[1].split(','), al = +((parts[fmt.indexOf('alignment')] || '').trim());
      if (ssa ? (al >= 5 && al <= 7) : (al >= 7 && al <= 9)) tops[(parts[fmt.indexOf('name')] || '').trim()] = true;
    });
    return tops;
  }
  function makeLine(track, tops, text) {
    var top = false;
    if (/^S_TEXT\/(ASS|SSA)/i.test(track.codec)) {
      // ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      var parts = text.split(','), style = (parts[2] || '').trim();
      text = parts.slice(8).join(',');
      var raw = { ReadOrder: +parts[0] || 0, Layer: +parts[1] || 0, Style: style, Name: parts[3] || '', MarginL: +parts[4] || 0, MarginR: +parts[5] || 0,
        MarginV: +parts[6] || 0, Effect: parts[7] || '', Text: text };
      if (/\{[^}]*\\p[1-9]/.test(text)) return { raw: raw, skip: true };   // a drawn shape: for the styled look only
      top = !!tops[style] || /\\an[789]/.test(text) || /\\a(5|6|7|9|10|11)(?!\d)/.test(text);
      text = text.replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ');
      text = text.replace(/[ \t]+\n/g, '\n').trim();
      return { t: text, top: top, raw: raw, skip: !text };
    } else {                                                        // SRT inside the file (may carry {\an8} too)
      top = /\{[^}]*\\an[789][^}]*\}/.test(text);
      text = text.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]+>/g, '');
    }
    text = text.replace(/[ \t]+\n/g, '\n').trim();
    return text ? { t: text, top: top } : null;
  }
  function payload(track, u) {
    if (!track.comp) return Promise.resolve(u);
    if (track.comp.algo === 3) { var s = track.comp.set || new Uint8Array(0), o = new Uint8Array(s.length + u.length); o.set(s); o.set(u, s.length); return Promise.resolve(o); }
    if (track.comp.algo === 0) return inflate(u);
    return Promise.reject(new Error('compressed subtitles'));
  }
  /* one Block or SimpleBlock (in a BlockGroup, with its duration) → {track, rel time, dur, data} */
  function readBlock(u, p) {
    var id = readId(u, p), sz = id && readSize(u, p + id.len); if (!id || !sz) return null;
    var d = p + id.len + sz.len, end = d + sz.size;
    if (end > u.length) return { short: end - p };
    var blk = null, dur = -1;
    var parse = function (bd, be) {
      var tn = readSize(u, bd); if (!tn) return null;
      var q = bd + tn.len, rel = (u[q] << 8 | u[q + 1]); if (rel & 0x8000) rel -= 0x10000;
      return { track: tn.size, rel: rel, flags: u[q + 2], data: u.subarray(q + 3, be) };
    };
    if (id.id === ID.SIMPLEBLOCK) blk = parse(d, end);
    else if (id.id === ID.GROUP) each(u, d, end, function (i2, d2, s2) {
      if (i2 === ID.BLOCK) blk = parse(d2, d2 + s2);
      if (i2 === ID.BLOCKDUR) dur = uint(u, d2, s2);
    });
    else return null;
    if (blk) { blk.dur = dur; blk.size = end - p; }
    return blk;
  }

  /* ---------- fonts stored in the file ---------- */
  function readFonts(get, L, maxBytes) {
    if (L.attachAt < 0) return Promise.resolve([]);
    return get(L.attachAt, L.attachAt + 15).then(function (h) {
      var id = readId(h, 0), sz = id && readSize(h, id.len);
      if (!id || id.id !== ID.ATTACHMENTS || !sz || sz.size < 0) return [];
      if (sz.size > maxBytes) throw new Error('the fonts in the file are too big (' + Math.round(sz.size / 1048576) + ' MB)');
      var d = L.attachAt + id.len + sz.len;
      return get(d, d + sz.size - 1).then(function (u) {
        var out = [];
        each(u, 0, u.length, function (aid, ad, as) {
          if (aid !== ID.ATTACHED) return;
          var f = { name: '', mime: '', data: null };
          each(u, ad, ad + as, function (fid, fd, fs) {
            if (fid === ID.FILENAME) f.name = str(u, fd, fs); else if (fid === ID.FILEMIME) f.mime = str(u, fd, fs);
            else if (fid === ID.FILEDATA) f.data = u.slice(fd, fd + fs);
          });
          if (f.data && (/font|truetype|opentype/i.test(f.mime) || /\.(ttf|otf|ttc|woff2?)$/i.test(f.name))) out.push(f);
        });
        return out;
      });
    });
  }

  /* ---------- the reader ---------- */
  P.SubFile = {
    open: function (url, want) {
      var get = ranger(url);
      return layout(get).then(function (L) {
        var tracks = L.tracks || [];
        if (!tracks.length) throw new Error("couldn't find the file's track list");
        // the subtitle Plex means: by its place in the file (Plex's index counts every track), else by order and language
        var subs = tracks.filter(function (t) { return t.type === 0x11; });
        var tr = tracks[want.index];
        if (!tr || tr.type !== 0x11) tr = subs[want.nth] || null;
        if (tr && want.lang && tr.lang && tr.lang.slice(0, 2) !== want.lang.slice(0, 2) && tr.lang !== 'und') {
          var byLang = subs.filter(function (t) { return t.lang.slice(0, 2) === want.lang.slice(0, 2); });
          if (byLang.length === 1) tr = byLang[0];
        }
        if (!tr) throw new Error("couldn't find this subtitle in the file");
        if (!/^S_TEXT\/(ASS|SSA|UTF8)/i.test(tr.codec)) throw new Error('this kind of subtitle (' + tr.codec + ") can't be read from the file");
        if (tr.bad) throw new Error('the subtitle is encrypted');
        var tops = topStyles(tr.priv), ms = L.scale / 1000000;
        return readCues(get, L).then(function (cues) {
          var mine = want.noIndex ? [] : cues.filter(function (c) { return c.track === tr.num && c.cluster >= 0; });   // noIndex: for the tests
          var R = { mode: mine.length && mine.every(function (c) { return c.rel >= 0; }) ? 'index' : 'pieces', codec: tr.codec, lines: mine.length, used: get.used,
            header: tr.priv && /^S_TEXT\/(ASS|SSA)/i.test(tr.codec) ? utf8.decode(tr.priv) : '' };
          /* the fonts stored in the file (for the styled look), up to maxBytes in all */
          R.fonts = function (maxBytes) { return readFonts(get, L, maxBytes); };
          var heads = {};             // cluster → where its blocks start, and its time
          var head = function (cl) {
            if (heads[cl]) return heads[cl];
            var at = L.seg + cl;
            return (heads[cl] = get(at, at + 31).then(function (u) {
              var id = readId(u, 0), sz = id && readSize(u, id.len);
              if (!id || id.id !== ID.CLUSTER) throw new Error('the file index points to the wrong place');
              var d = id.len + sz.len, time = 0;
              each(u, d, u.length, function (i2, d2, s2) { if (i2 === ID.TIMECODE && d2 + s2 <= u.length) { time = uint(u, d2, s2); return false; } });   // after a checksum, often
              return { at: at, data: at + d, size: sz.size, time: time };
            }, function (e) { delete heads[cl]; throw e; }));
          };
          var toLine = function (blk, clTime, cueDur) {
            var a = (clTime + blk.rel) * ms, len = blk.dur >= 0 ? blk.dur * ms : cueDur >= 0 ? cueDur * ms : 3000;
            return payload(tr, blk.data).then(function (bytes) {
              var l = makeLine(tr, tops, utf8.decode(bytes));
              if (!l) return null;
              return { a: a, b: a + len, t: l.skip ? '' : l.t, top: l.top, raw: l.raw || null, skip: !!l.skip };
            });
          };
          if (R.mode === 'index') {
            var done = {};
            /* limit: at most this many lines; focus: the lines nearest this moment come first (where you landed after a skip) */
            R.fill = function (from, to, limit, focus) {
              var at = focus != null ? focus : from;
              var list = mine.filter(function (c) { var t = c.time * ms; return t >= from - 15000 && t <= to && !done[c.cluster + ':' + c.rel]; })
                .sort(function (x, y) { var dx = x.time * ms - at, dy = y.time * ms - at; return (dx < -3000 ? 1e12 - dx : dx) - (dy < -3000 ? 1e12 - dy : dy); });
              if (limit) list = list.slice(0, limit);
              list.forEach(function (c) { done[c.cluster + ':' + c.rel] = true; });
              // six at a time, so they arrive in order and never crowd the network
              R.left = mine.filter(function (c) { return !done[c.cluster + ':' + c.rel]; }).length;
              var out = [], i = 0;
              var next = function () {
                if (i >= list.length) return Promise.resolve(out);
                var batch = list.slice(i, i + 6); i += 6;
                return Promise.all(batch.map(function (c) {
                  return head(c.cluster).then(function (h) {
                    var at = h.data + c.rel;
                    return get(at, at + 2047).then(function (u) {
                      var b = readBlock(u, 0);
                      if (b && b.short) return get(at, at + b.short - 1).then(function (v) { return readBlock(v, 0); });
                      return b;
                    }).then(function (b) { return b && b.track === tr.num ? toLine(b, h.time, c.dur) : null; });
                  }).catch(function (e) { delete done[c.cluster + ':' + c.rel]; throw e; });
                })).then(function (ls) { ls.forEach(function (l) { if (l) out.push(l); }); return next(); });
              };
              return next();
            };
            return R;
          }
          // no subtitle lines in the index: read the pieces of the file just ahead, if they're small
          var points = cues.filter(function (c) { return c.cluster >= 0; }).map(function (c) { return { t: c.time * ms, cl: c.cluster }; })
            .sort(function (x, y) { return x.t - y.t; });
          if (!points.length) throw new Error('the file has no index');
          var seen = {};
          R.fill = function (from, to) {
            var start = points[0];
            points.forEach(function (p) { if (p.t <= from) start = p; });
            var out = [];
            var step = function (cl, n) {
              if (n > 12 || seen[cl] === 'busy') return Promise.resolve(out);
              return head(cl).then(function (h) {
                if (h.time * ms > to) return out;
                if (h.size < 0 || h.size > 6 * 1048576) throw new Error("the file's pieces are too big to read");
                var nextCl = cl + (h.data - h.at) + h.size;
                if (seen[cl]) return step(nextCl, n + 1);
                seen[cl] = 'busy';
                return get(h.data, h.data + h.size - 1).then(function (u) {
                  var lines = [];
                  each(u, 0, u.length, function (id, d, size, hp) {
                    if (id !== ID.SIMPLEBLOCK && id !== ID.GROUP) return;
                    var b = readBlock(u, hp); if (b && !b.short && b.track === tr.num) lines.push(toLine(b, h.time, -1));
                  });
                  return Promise.all(lines);
                }).then(function (ls) { seen[cl] = true; ls.forEach(function (l) { if (l) out.push(l); }); return step(nextCl, n + 1); },
                  function (e) { delete seen[cl]; throw e; });
              });
            };
            return step(start.cl, 0);
          };
          return R;
        });
      });
    },
    _inflate: inflate, _topStyles: topStyles   // for the tests
  };

  /* The last 10 episodes' subtitle lines, kept on the TV (IndexedDB), so an episode you open again shows them at once. */
  var DBN = 'plume-subs', KEEP = 10, dbP = null;
  function db() {
    if (dbP) return dbP;
    return (dbP = new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('no storage')); return; }
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('subs', { keyPath: 'key' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error || new Error('storage')); };
    }).catch(function (e) { dbP = null; throw e; }));
  }
  function store(mode) { return db().then(function (d) { return d.transaction('subs', mode).objectStore('subs'); }); }
  function req(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
  P.SubCache = {
    get: function (key) {
      return store('readonly').then(function (st) { return req(st.get(key)); }).then(function (e) {
        if (e) P.SubCache.touch(key);
        return e || null;
      }).catch(function () { return null; });
    },
    touch: function (key) {
      store('readwrite').then(function (st) { var g = st.get(key); g.onsuccess = function () { var e = g.result; if (e) { e.at = Date.now(); st.put(e); } }; }).catch(function () {});
    },
    /* entry: { lines, header, codec } */
    put: function (key, entry) {
      entry.key = key; entry.at = Date.now();
      return store('readwrite').then(function (st) { return req(st.put(entry)); }).then(function () {
        return store('readwrite').then(function (st) { return req(st.getAll()); });
      }).then(function (all) {
        all.sort(function (a, b) { return b.at - a.at; });
        if (all.length <= KEEP) return;
        return store('readwrite').then(function (st) { all.slice(KEEP).forEach(function (e) { st.delete(e.key); }); });
      }).catch(function () {});
    },
    clear: function () { return store('readwrite').then(function (st) { return req(st.clear()); }).catch(function () {}); }
  };
})();
