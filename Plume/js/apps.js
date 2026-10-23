/* The apps row: which apps the TV has, their logos, and how to open each tile.
   Logos come from the TV itself (each installed app's own icon). Plume turns an icon into a clean single-colour
   mark at run time, the way Plume on Android does, and can tint it with the app's own colour. */
(function () {
  /* Samsung app ids, tried in order (they differ by model year and region). `match` finds the app by name in the
     TV's own list, which also covers apps whose id differs on your TV. */
  var CATALOG = [
    { key: 'plex',    name: 'Plex',        ids: ['3201512006963'], match: /^plex$/i },
    { key: 'youtube', name: 'YouTube',     ids: ['com.samsung.tv.cobalt-yt', '111299001912'], match: /^youtube$/i },
    { key: 'netflix', name: 'Netflix',     ids: ['3201907018807', '11101200001'], match: /^netflix$/i },
    { key: 'shahid',  name: 'Shahid',      ids: [], match: /shahid|شاهد/i },
    { key: 'appletv', name: 'Apple TV',    ids: ['3201807016597'], match: /^apple tv/i },
    { key: 'prime',   name: 'Prime Video', ids: ['3201910019365', '3201512006785'], match: /prime video/i },
    { key: 'disney',  name: 'Disney+',     ids: ['3201901017640', '3202009021709', '3202204027038'], match: /disney/i },
    { key: 'spotify', name: 'Spotify',     ids: ['3201606009684'], match: /spotify/i },
    { key: 'osn',     name: 'OSN+',        ids: [], match: /^osn/i },
    { key: 'stctv',   name: 'stc tv',      ids: [], match: /^stc/i },
    { key: 'starz',   name: 'STARZPLAY',   ids: [], match: /starz/i },
    { key: 'crunchy', name: 'Crunchyroll', ids: ['3202302030097'], match: /crunchyroll/i },
    { key: 'twitch',  name: 'Twitch',      ids: ['3202203026841'], match: /twitch/i },
    { key: 'tiktok',  name: 'TikTok',      ids: ['3202008021577'], match: /tiktok/i },
    { key: 'browser', name: 'Internet',    ids: ['org.tizen.browser', '3201907018784', '3202010022079'], match: /^internet$/i }
  ];
  /* apps that come with Samsung TVs and sometimes don't appear in the TV's own app list */
  var PREINSTALLED = ['app:youtube', 'app:netflix', 'app:prime', 'app:appletv', 'app:disney', 'app:browser', 'app:spotify'];
  var STORE_ID = /^([A-Za-z0-9]{10}\.[A-Za-z0-9_-]+|\d{9,})$/;
  var SYSTEM_NAME = /daemon|manager|hotel|proto|popup|autofill|editor|maintenance|promotion|csapi|p2p|hitcomp|launcher|service|agent|^com\.|^org\.|^[a-z0-9]+(-[a-z0-9]+)+$/i;

  var A = { items: {}, known: false };

  function addCatalog() {
    CATALOG.forEach(function (c) {
      A.items['app:' + c.key] = { key: 'app:' + c.key, kind: 'app', name: c.name, ids: c.ids.slice(), icon: '', installed: null, catalog: true };
    });
    A.items['hdmi:ps5'] = { key: 'hdmi:ps5', kind: 'hdmi', name: 'PS5', glyphIcon: 'gamepad', installed: true };
    A.items['hdmi:bein'] = { key: 'hdmi:bein', kind: 'hdmi', name: 'beIN', word: 'beIN', installed: true };
    A.items['matches'] = { key: 'matches', kind: 'matches', name: 'Matches', glyphIcon: 'ball', installed: true };
  }
  addCatalog();

  /* your pictures that keep their own colours in Colour mode (the others are tinted, so black logos stay visible) */
  var KEEP_COLOURS = { 'app:shahid': true };
  /* your own picture for any tile: Plume/img/tiles/<name>.png (ps5, bein, matches, youtube, netflix, disney, …) */
  A.tileImages = function (done) {
    var tiles = [['hdmi:ps5', 'ps5'], ['hdmi:bein', 'bein'], ['matches', 'matches']]
      .concat(CATALOG.map(function (c) { return ['app:' + c.key, c.key]; }));
    var left = tiles.length;
    tiles.forEach(function (t) {
      var img = new Image(), src = 'img/tiles/' + t[1] + '.png';
      img.onload = function () { var it = A.items[t[0]]; it.icon = src; it.own = true; it._glyph = undefined; delete it.word; delete it.glyphIcon; if (--left === 0) done(); };
      img.onerror = function () { if (--left === 0) done(); };
      img.src = src;
    });
  };

  A.port = function (key) { return key === 'hdmi:ps5' ? P.S.get('ps5Port') : P.S.get('beinPort'); };
  A.label = function (it) { return it.kind === 'hdmi' ? it.name + ' · HDMI ' + A.port(it.key) : it.name; };

  A.refresh = function (done) {
    P.TV.listApps(function (list) {
      if (!list) { // no TV app list (desktop browser): every catalog app counts as installed
        Object.keys(A.items).forEach(function (k) { if (A.items[k].installed === null) A.items[k].installed = true; });
        if (done) done();
        return;
      }
      A.known = true;
      A.report = list.map(function (a) { return { id: a.id, name: a.name, icon: a.iconPath || '', show: a.show }; });
      var iconUse = {};
      list.forEach(function (a) { if (a && a.iconPath) iconUse[a.iconPath] = (iconUse[a.iconPath] || 0) + 1; });
      var useIcon = function (p) { return p && iconUse[p] === 1 && !/default|tizen-logo|noicon/i.test(p); };
      var found = {};
      list.forEach(function (a) {
        if (!a || !a.id || !a.name || a.id.indexOf('PlumeTV001') === 0) return;
        var hit = null;
        for (var i = 0; i < CATALOG.length; i++) {
          var c = CATALOG[i];
          if (c.ids.indexOf(a.id) >= 0 || c.match.test(a.name) || c.match.test(a.id.split('.').pop())) { hit = 'app:' + c.key; break; }
        }
        if (!hit && (a.show === false || !STORE_ID.test(a.id) || SYSTEM_NAME.test(a.name))) return;
        var key = hit || ('app:id:' + a.id);
        var it = A.items[key] || (A.items[key] = { key: key, kind: 'app', name: a.name, ids: [], icon: '', installed: true });
        var cat = hit ? CATALOG.filter(function (c) { return 'app:' + c.key === hit; })[0] : null;
        var official = !cat || cat.ids.indexOf(a.id) >= 0;
        var at = it.ids.indexOf(a.id); if (at >= 0) it.ids.splice(at, 1);
        if (official) it.ids.unshift(a.id); else it.ids.push(a.id);
        // the TV's own copy opens; another copy (an old store version) never lends it its icon
        if (cat) it.ids.sort(function (x, y) { var ix = cat.ids.indexOf(x), iy = cat.ids.indexOf(y); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy); });
        it.installed = true;
        if (!it.catalog) it.name = a.name;
        var ownCopyFound = cat && list.some(function (b) { return cat.ids.indexOf(b.id) >= 0; });
        if (!it.own && a.iconPath && (!ownCopyFound || official) && (useIcon(a.iconPath) || (hit && !/tizen-logo|noicon/i.test(a.iconPath))))
          it.icon = a.iconPath.indexOf('://') > 0 ? a.iconPath : 'file://' + a.iconPath;
        found[key] = true;
      });
      Object.keys(A.items).forEach(function (k) {
        var it = A.items[k];
        if (it.kind === 'app' && !found[k]) it.installed = (it.ids.length && PREINSTALLED.indexOf(k) >= 0) ? null : false;
      });
      if (done) done();
    });
  };

  /* the apps row, in your order, skipping apps the TV doesn't have */
  A.row = function () {
    return P.S.get('row').map(function (k) { return A.items[k]; }).filter(function (it) { return it && it.installed !== false; });
  };
  A.all = function () {
    var list = Object.keys(A.items).map(function (k) { return A.items[k]; }).filter(function (it) { return it.installed !== false && (it.kind !== 'app' || it.installed || !A.known || it.ids.length); });
    return list.sort(function (a, b) {
      var ka = a.kind === 'app' ? 1 : 0, kb = b.kind === 'app' ? 1 : 0;
      return ka - kb || a.name.localeCompare(b.name);
    });
  };

  A.open = function (it) {
    if (it.kind === 'matches') { P.Centre.open(); return; }
    if (it.kind === 'hdmi') { A.switchTo(it.key); return; }
    P.TV.launchAndReturn(it.ids, function () {}, function () { P.UI.toast("Couldn't open " + it.name); });
  };

  A.switchTo = function (key) {
    var it = A.items[key], port = A.port(key), method = 'inside';
    P.TV.switchInput(port, method, function (how) {
      if (how === 'inside') P.UI.inputView(it.name, port);
      else if (how === 'test') P.UI.toast('Switching to ' + it.name + ' (HDMI ' + port + ')');
    }, function (why, connected) {
      P.log('switch failed', why);
      P.UI.toast(connected === false ? 'Nothing is connected to HDMI ' + port + '. Check Settings → Inputs'
        : "Couldn't switch to HDMI " + port + '. Try the other method in Settings → Inputs');
    });
  };

  /* ---------- logos ---------- */
  var glyphCache = {};
  try { glyphCache = JSON.parse(localStorage.getItem('plume.glyphs2') || '{}'); } catch (e) {}
  var tainted = false;
  function saveCache() { try { localStorage.setItem('plume.glyphs2', JSON.stringify(glyphCache)); } catch (e) {} }

  function hueOf(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d === 0) return { h: 0, s: 0, v: mx / 255 };
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return { h: h, s: d / mx, v: mx / 255 };
  }

  /* icon → {mark: data URL of a white symbol on transparent, brand: '#rrggbb' or null}, or null if the icon is a picture */
  function makeGlyph(img, keepColours) {
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    var g = c.getContext('2d');
    var sc = Math.min(N / img.width, N / img.height) * 0.98, w = img.width * sc, h = img.height * sc;
    g.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);            // keep the picture's shape
    var px = g.getImageData(0, 0, N, N).data; // throws if the TV won't let us read the icon
    var ring = [], inset = Math.round(N * 0.1);
    for (var i = inset; i < N - inset; i++) {
      [[i, inset], [i, N - 1 - inset], [inset, i], [N - 1 - inset, i]].forEach(function (p) {
        var o = (p[1] * N + p[0]) * 4;
        if (px[o + 3] > 200) ring.push([px[o], px[o + 1], px[o + 2]]);
      });
    }
    var opaqueRing = ring.length > (N - 2 * inset) * 4 * 0.6;
    var bg = null;
    if (opaqueRing) {
      var med = function (ch) { var v = ring.map(function (r) { return r[ch]; }).sort(function (a, b) { return a - b; }); return v[v.length >> 1]; };
      bg = [med(0), med(1), med(2)];
    }
    var alpha = new Float32Array(N * N), minX = N, minY = N, maxX = -1, maxY = -1, on = 0;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var o2 = (y * N + x) * 4, a = px[o2 + 3] / 255, v;
      if (bg) {
        var dr = px[o2] - bg[0], dg = px[o2 + 1] - bg[1], db = px[o2 + 2] - bg[2];
        var dist = Math.sqrt(dr * dr + dg * dg + db * db) / 441;
        v = Math.max(0, Math.min(1, (dist - 0.1) / 0.22)) * a;
      } else v = a;
      alpha[y * N + x] = v;
      if (v > 0.3) { on++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) return null;
    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (bw > N * 0.94 && bh > N * 0.94) return null;          // fills the whole icon: a picture, not a symbol
    if (on > bw * bh * 0.85 && bw * bh > N * N * 0.5) return null;
    var out = document.createElement('canvas'); out.width = bw; out.height = bh;
    var og = out.getContext('2d'), od = og.createImageData(bw, bh);
    var buckets = {};
    for (var yy = 0; yy < bh; yy++) for (var xx = 0; xx < bw; xx++) {
      var si = (minY + yy) * N + (minX + xx), so = si * 4, oi = (yy * bw + xx) * 4;
      od.data[oi] = od.data[oi + 1] = od.data[oi + 2] = 255;
      od.data[oi + 3] = Math.round(alpha[si] * 255);
      if (alpha[si] > 0.6) {
        var hsv = hueOf(px[so], px[so + 1], px[so + 2]);
        if (hsv.s > 0.35 && hsv.v > 0.3) {
          var b = Math.floor(hsv.h / 30);
          (buckets[b] = buckets[b] || []).push([px[so], px[so + 1], px[so + 2]]);
        }
      }
    }
    og.putImageData(od, 0, 0);
    var orig = null;
    if (keepColours) {   // your picture as it is, for Colour mode
      var oc = document.createElement('canvas'); oc.width = bw; oc.height = bh;
      oc.getContext('2d').drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh);
      orig = oc.toDataURL('image/png');
    }
    var brand = null, top = null;
    Object.keys(buckets).forEach(function (k) { if (!top || buckets[k].length > top.length) top = buckets[k]; });
    if (top && top.length > 20) {
      var s = [0, 0, 0]; top.forEach(function (p) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
      brand = [s[0] / top.length, s[1] / top.length, s[2] / top.length];
    } else if (bg) {
      var bh2 = hueOf(bg[0], bg[1], bg[2]);
      if (bh2.s > 0.35 && bh2.v > 0.25) brand = bg;
    }
    var hex = brand ? '#' + brand.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('') : null;
    return { mark: out.toDataURL('image/png'), brand: hex, ratio: bw / bh, orig: orig };
  }

  A.glyph = function (it, done) {
    if (!it.icon || tainted) { done(null); return; }
    var mine = it.icon.indexOf('img/') === 0;   // your own tile pictures: always re-read, you may have replaced them
    if (!mine && it.icon in glyphCache) { done(glyphCache[it.icon]); return; }
    var img = new Image();
    img.onload = function () {
      var r = null;
      try { r = makeGlyph(img, mine && KEEP_COLOURS[it.key]); } catch (e) { tainted = true; P.log('icons cannot be read; using them as they are'); done(null); return; }
      if (!mine) { glyphCache[it.icon] = r; saveCache(); } done(r);
    };
    img.onerror = function () { it._iconFailed = true; done(null); };
    img.src = it.icon;
  };

  A.iconFailed = function (img, key) {
    var it = A.items[key]; if (it) it._iconFailed = true;
    var w = document.createElement('span'); w.className = 'word' + (it && it.name.length > 7 ? ' long' : ''); w.textContent = it ? it.name : '';
    if (img.parentNode) img.parentNode.replaceChild(w, img);
  };
  /* what Plume did with each app's icon, for Settings → About */
  A.iconStatus = function (appId) {
    var it = null;
    Object.keys(A.items).forEach(function (k) { if ((A.items[k].ids || []).indexOf(appId) >= 0) it = A.items[k]; });
    if (!it) return 'Not shown';
    if (it.ids[0] !== appId) return 'Another copy opens';
    if (it.own) return 'Your picture';
    if (it._glyph) return 'Logo from its icon';
    if (it._iconFailed) return "TV won't share the icon";
    if (it.icon) return 'Icon shown as it is';
    return 'No icon';
  };

  /* make a colour readable on the current background */
  A.readable = function (hex, dark) {
    if (!hex) return null;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (!dark && lum > 0.72) { var f = 0.62 / lum; r *= f; g *= f; b *= f; }
    if (dark && lum < 0.18) { var k = 0.32 / Math.max(lum, 0.02); r = Math.min(255, r * k + 40); g = Math.min(255, g * k + 40); b = Math.min(255, b * k + 40); }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  };

  /* the inside of a tile: a mark, a word, or (if the icon can't be turned into a mark) the icon itself */
  A.logoHTML = function (it, dark, colour) {
    if (it.word) return '<span class="word">' + P.esc(it.word) + '</span>';
    if (it.glyphIcon) return P.icon(it.glyphIcon, 'mark-ic');
    var g = it._glyph;
    if (g) {
      var tint = colour ? (A.readable(g.brand, dark) || '') : '';
      // every mark gets about the same visual weight, whatever its shape
      var r = g.ratio || 2, area = 5600, w = Math.min(132, Math.sqrt(area * r)), h = Math.min(96, w / r); w = h * r;
      if (colour && g.orig) return '<img class="mark" alt="" style="width:' + Math.round(w) + 'px;height:' + Math.round(h) + 'px" src="' + g.orig + '">';
      // a ready-coloured picture: much cheaper for the TV to redraw than a live mask while tiles zoom
      return '<img class="mark" alt="" style="width:' + Math.round(w) + 'px;height:' + Math.round(h) + 'px" src="' + A.tinted(g.mark, tint || (dark ? '#F5F5F5' : '#111214')) + '">';
    }
    if (it.icon && !it._iconFailed) return '<img class="appicon' + (colour ? '' : ' mono') + '" src="' + P.esc(it.icon) + '" alt="" onerror="P.Apps.iconFailed(this, \'' + it.key + '\')">';
    return '<span class="word' + (it.name.length > 7 ? ' long' : '') + '">' + P.esc(it.name) + '</span>';
  };

  var tintCache = {};
  A.tinted = function (mark, colour) {
    var k = colour + '|' + mark.length + '|' + mark.slice(-40);
    if (tintCache[k]) return tintCache[k];
    var img = new Image(); img.src = mark;
    if (!img.complete || !img.width) { // not decoded yet: show the mask version this once, swap when ready
      img.onload = function () { tintCache[k] = paint(img, colour); P.bus.emit('logos'); };
      return mark;
    }
    return (tintCache[k] = paint(img, colour));
  };
  function paint(img, colour) {
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  /* work out marks for every item that has an icon, then call back once */
  A.prepareLogos = function (done) {
    var list = Object.keys(A.items).map(function (k) { return A.items[k]; }).filter(function (it) { return it.icon && it._glyph === undefined; });
    var left = list.length;
    if (!left) { done(); return; }
    list.forEach(function (it) {
      var icon = it.icon;
      // your own picture may arrive while the TV's icon is still being read: never let the older one win
      A.glyph(it, function (g) { if (it.icon === icon) it._glyph = g; if (--left === 0) done(); });
    });
  };

  P.Apps = A;
})();
