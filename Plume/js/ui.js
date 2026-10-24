/* Shared screen pieces: the layer stack for remote-control focus, toasts, dialogs, menus and the
   reminder banner. Each layer handles keys: left/right/up/down/ok/hold/back. */
(function () {
  var U = { layers: [] };

  function modal() { document.body.classList.toggle('modal-on', U.layers.length > 1); }
  U.push = function (layer) { U.layers.push(layer); modal(); if (layer.enter) layer.enter(); };
  U.pop = function (layer) {
    var i = U.layers.indexOf(layer);
    if (i >= 0) U.layers.splice(i, 1);
    modal();
    if (layer.leave) layer.leave();
    var top = U.top(); if (top && top.resume) top.resume();
  };
  U.top = function () { return U.layers[U.layers.length - 1]; };
  U.key = function (name) {
    var top = U.top();
    if (top && top.key) top.key(name);
  };

  /* ---------- toast ---------- */
  var toastT = null;
  U.toast = function (text, ms) {
    var t = P.$('#toast');
    t.innerHTML = text; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('on'); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.hidden = true; }, 250); }, ms || 2600);
  };

  /* ---------- a vertical/horizontal list of focusable buttons, used by dialogs and menus ---------- */
  function buttonsLayer(root, opts) {
    var btns = P.$$('[data-i]', root), at = opts.start || 0;
    function paint() { btns.forEach(function (b, i) { b.classList.toggle('focus', i === at); }); }
    paint();
    return {
      name: opts.name,
      key: function (k) {
        if (k === 'back') { opts.close(); return; }
        if (k === 'ok') { var b = btns[at]; if (b) opts.choose(Number(b.dataset.i)); return; }
        var horiz = opts.horizontal;
        if ((horiz && k === 'left') || (!horiz && k === 'up')) at = Math.max(0, at - 1);
        if ((horiz && k === 'right') || (!horiz && k === 'down')) at = Math.min(btns.length - 1, at + 1);
        paint();
      },
      refresh: function () { btns = P.$$('[data-i]', root); at = Math.min(at, btns.length - 1); paint(); }
    };
  }

  /* ---------- dialog: title, body, buttons along the bottom ---------- */
  U.dialog = function (o) {
    var wrap = P.$('#dialog');
    wrap.innerHTML = '<div class="dialog' + (o.wide ? ' wide' : '') + '">' +
      (o.title ? '<h3>' + o.title + '</h3>' : '') + '<div class="body">' + (o.body || '') + '</div>' +
      '<div class="btns' + (o.vertical ? ' vertical' : '') + '">' + (o.buttons || []).map(function (b, i) {
        return '<button class="btn" data-i="' + i + '">' + b.label + '</button>';
      }).join('') + '</div></div>';
    wrap.hidden = false;
    var layer;
    function close() { wrap.hidden = true; wrap.innerHTML = ''; U.pop(layer); if (o.onClose) o.onClose(); }
    layer = buttonsLayer(wrap, {
      name: 'dialog', horizontal: !o.vertical, start: o.start || 0, close: close,
      choose: function (i) { var b = o.buttons[i]; if (b.keep) { b.act(); return; } close(); if (b.act) b.act(); }
    });
    layer.close = close;
    layer.root = wrap;
    U.push(layer);
    return layer;
  };

  /* ---------- small menu (hold OK on a tile) ---------- */
  U.menu = function (anchor, title, options, wide) {
    var wrap = P.$('#dialog'), W = wide ? 860 : 480;
    var r = anchor ? anchor.getBoundingClientRect() : { left: 760, top: 400, width: 400, bottom: 400 };
    wrap.innerHTML = '<div class="menu' + (wide ? ' wide' : '') + '" style="left:' + Math.max(40, Math.min(1920 - W - 40, r.left + r.width / 2 - W / 2)) + 'px;' +
      (r.top > 540 ? 'bottom:' + (1080 - r.top + 24) + 'px' : 'top:' + (r.bottom + 24) + 'px') + '">' +
      (title ? '<div class="menu-title">' + P.esc(title) + '</div>' : '') +
      options.map(function (op, i) { return '<button class="mrow" data-i="' + i + '">' + (op.icon ? P.icon(op.icon) : '') + '<span>' + op.label + '</span></button>'; }).join('') +
      '</div>';
    wrap.hidden = false; wrap.classList.add('clear');
    var layer;
    function close() { wrap.hidden = true; wrap.classList.remove('clear'); wrap.innerHTML = ''; U.pop(layer); }
    layer = buttonsLayer(wrap, { name: 'menu', close: close, choose: function (i) { close(); options[i].act(); } });
    U.push(layer);
  };

  /* ---------- banner (match reminders) ---------- */
  var bannerT = null;
  U.banner = function (o) {
    var b = P.$('#banner');
    b.innerHTML = '<div class="b-ic">' + P.icon('bell') + '</div><div class="b-txt"><b>' + P.esc(o.title) + '</b><span>' + P.esc(o.sub || '') + '</span></div>' +
      '<div class="b-keys"><span class="key">OK</span> ' + P.esc(o.okLabel || 'Open') + '<span class="key">Back</span> Dismiss</div>';
    b.hidden = false;
    requestAnimationFrame(function () { b.classList.add('on'); });
    var layer = {
      name: 'banner',
      key: function (k) {
        if (k === 'ok') { close(); if (o.onOk) o.onOk(); return; }
        if (k === 'back') { close(); return; }
        // any other key: let the screen underneath move, the banner stays
        var i = U.layers.indexOf(layer); var under = U.layers[i - 1]; if (under && under.key) under.key(k);
      }
    };
    function close() { clearTimeout(bannerT); b.classList.remove('on'); setTimeout(function () { b.hidden = true; }, 300); U.pop(layer); }
    U.push(layer);
    clearTimeout(bannerT); bannerT = setTimeout(close, 45000);
  };

  /* ---------- an HDMI input shown inside Plume ---------- */
  U.inputView = function (name, port) {
    document.body.classList.add('input-on');
    U.toast(name + ' · HDMI ' + port + ' — press Back to return to Plume', 3500);
    var layer = { name: 'input', key: function (k) { if (k === 'back') { P.TV.closeInside(); document.body.classList.remove('input-on'); U.pop(layer); } } };
    U.push(layer);
  };

  /* ---------- QR code as an SVG ---------- */
  U.qr = function (text, px) {
    if (typeof qrcode === 'undefined') return '';
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    var n = q.getModuleCount(), cells = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) cells += 'M' + x + ' ' + y + 'h1v1h-1z';
    return '<svg class="qr" width="' + px + '" height="' + px + '" viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + cells + '" fill="#000"/></svg>';
  };

  /* ---------- a crest: the team's logo, or a coloured disc with its short name if the logo can't load ---------- */
  var loadedLogos = {};
  U.logoLoaded = function (img) { loadedLogos[img.getAttribute('src')] = true; img.parentNode.classList.add('ok'); };
  U.crest = function (t, cls) {
    var fb = '<span class="crest-fb" style="background:' + P.esc(t.color || '#888') + '">' + P.esc((t.abbr || '').slice(0, 3)) + '</span>';
    if (!t.logo) return '<span class="crest ' + (cls || '') + '">' + fb + '</span>';
    var ok = loadedLogos[t.logo] ? ' ok' : '';
    return '<span class="crest ' + (cls || '') + ok + '">' + fb + '<img src="' + P.esc(t.logo) + '" alt="" onload="P.UI.logoLoaded(this)" onerror="this.remove()"></span>';
  };

  P.UI = U;
})();
