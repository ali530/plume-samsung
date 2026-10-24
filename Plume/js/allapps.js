/* All apps: everything installed, plus the HDMI tiles and Matches. Hold OK to add an app to the row or take it out. */
(function () {
  var G = { at: 0, cols: 8 };
  var root = function () { return P.$('#allApps'); };

  function items() { return P.Apps.all(); }

  G.render = function () {
    var A = P.Apps, colour = P.S.get('logos') === 'colour', inRow = P.S.get('row');
    var list = items();
    root().innerHTML = '<div class="aa-head"><h1>' + P.t('All apps') + '</h1><span class="hint"><span class="key">' + P.t('Hold OK') + '</span> ' + P.t('add to the row or remove') + '</span></div>' +
      '<div class="aa-grid">' + list.map(function (it, i) {
        return '<div class="aa-cell" data-i="' + i + '"><div class="tile app kind-' + it.kind + (inRow.indexOf(it.key) >= 0 ? ' inrow' : '') + '"><div class="logo">' +
          A.logoHTML(it, P.Home.dark, colour) + '</div>' + (inRow.indexOf(it.key) >= 0 ? '<span class="pinned">' + P.icon('check') + '</span>' : '') +
          '</div><div class="name">' + P.esc(A.label(it)) + '</div></div>';
      }).join('') + '</div>';
    paint();
  };
  function paint() {
    P.$$('.aa-cell', root()).forEach(function (c, i) { c.classList.toggle('focus', i === G.at); });
    var el = P.$('.aa-cell.focus', root()), grid = P.$('.aa-grid', root());
    if (el && grid) {
      var top = el.offsetTop - grid.offsetTop;
      if (top - grid.scrollTop > grid.clientHeight - el.offsetHeight - 20) grid.scrollTop = top - grid.clientHeight + el.offsetHeight + 40;
      if (top < grid.scrollTop) grid.scrollTop = Math.max(0, top - 40);
    }
  }

  var layer = {
    name: 'allapps',
    key: function (k) {
      var list = items(), n = list.length;
      if (k === 'back') { G.close(); return; }
      if (k === 'left') G.at = Math.max(0, G.at - 1);
      if (k === 'right') G.at = Math.min(n - 1, G.at + 1);
      if (k === 'up') { if (G.at - G.cols >= 0) G.at -= G.cols; }
      if (k === 'down') G.at = Math.min(n - 1, G.at + G.cols);
      var it = list[G.at];
      if (k === 'ok' && it) { G.close(); P.Apps.open(it); return; }
      if (k === 'hold' && it) {
        var row = P.S.get('row'), on = row.indexOf(it.key) >= 0;
        var ops = on ? [{ label: P.t('Remove from row'), icon: 'eyeOff', act: function () { P.S.set('row', row.filter(function (x) { return x !== it.key; })); G.render(); } }]
          : [{ label: P.t('Add to the end of the row'), icon: 'check', act: function () { P.S.set('row', row.concat([it.key])); G.render(); } },
             { label: P.t('Add to the front of the row'), icon: 'move', act: function () { P.S.set('row', [it.key].concat(row)); G.render(); } }];
        P.UI.menu(P.$('.aa-cell.focus', root()), P.Apps.label(it), ops);
        return;
      }
      paint();
    },
    resume: function () { paint(); }
  };

  G.open = function () {
    G.at = 0;
    root().hidden = false; document.body.classList.add('overlay-on');
    P.UI.push(layer);
    G.render();
  };
  G.close = function () { root().hidden = true; root().innerHTML = ''; document.body.classList.remove('overlay-on'); P.UI.pop(layer); };

  P.AllApps = G;
})();
