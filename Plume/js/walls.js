/* Home screen wallpapers: one mountain photo for both themes. In dark mode a bright photo is dimmed;
   night photos (stars, moon) stay as they are and are used in dark mode only (light mode then shows the Rockies,
   so the dark clock stays readable). The Rockies have their own dusk photo for dark mode.
   install.bat downloads the free Unsplash and Pexels photos once (walls.ps1) and packs them into Plume
   (img/walls, listed in img/walls/list.js): they change at once and work offline. A photo that isn't packed
   loads from the internet; one that can't load at all falls back to the Rockies.
   "A different mountain each day" goes through them, a new one every day. */
(function () {
  var US = function (id) { return { src: 'unsplash', u: 'https://images.unsplash.com/photo-' + id }; };
  var PX = function (id, slug) {
    return { src: 'pexels', u: 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + (slug ? '/free-photo-of-' + slug : '') + '.jpeg' };
  };
  var LIST = [
    // day photos: as they are in light mode, dimmed in dark mode
    ['rockies-day', 'Rockies', 0, { src: 'plume', u: 'img/rockies-day.jpg', dusk: 'img/rockies-dusk.jpg' }],
    ['lake-mirror', 'Lake mirror', 0, US('1732130319312-99c2da8522fb')],
    ['snow-reflection', 'Snow reflection', 0, US('1632168593111-cd9b00e41ba1')],
    ['cloudy-lake', 'Cloudy lake', 0, US('1759390095773-dc0528e69ccb')],
    ['distant-range', 'Distant range', 0, US('1641353554926-2b2ab5db7ec7')],
    ['high-road', 'High road', 0, US('1721986558852-7adc6091936e')],
    ['winter-forest', 'Winter forest', 0, US('1704877270853-a3c7e35e5c4d')],
    ['blue-peaks', 'Blue peaks', 0, US('1718963705471-c498bed9be56')],
    ['foggy-peak', 'Foggy peak', 0, PX(2310653)],
    ['snow-caps', 'Snow caps from above', 0, PX(2542011)],
    ['sea-of-clouds', 'Sea of clouds', 0, PX(2887786)],
    ['green-sunrise', 'Green slopes at sunrise', 0, PX(2437289)],
    ['clear-summit', 'Clear summit', 0, PX(31340234, 'snowy-mountain-peak-under-clear-sky')],
    ['snowy-summit', 'Snowy summit', 0, PX(416779)],
    // night and dusk photos: dark mode only, as they are
    ['starry-peak', 'Starry peak', 1, US('1551770908-437bb2e457b8')],
    ['milky-way', 'Stars over the snow', 1, US('1764366795867-a0e7fcbf791e')],
    ['night-snow', 'Night snow', 1, US('1694900565922-d279cef76fd2')],
    ['star-summit', 'Summit under the stars', 1, US('1477840539360-4a1d23071046')],
    ['full-moon', 'Full moon', 1, US('1602138084375-99668d8020a8')],
    ['blue-hour', 'Blue hour', 1, US('1562422313-5195a5f0198a')],
    ['alpenglow', 'Alpenglow from above', 1, US('1764022363311-b09420ddf0ae')],
    ['layered-sunset', 'Layered sunset', 1, US('1762586357891-2336a811de2a')],
    ['first-light', 'First light', 1, US('1694507482314-a429436d4a0a')],
    ['night-mountain', 'Mountain at night', 1, PX(411987)]
  ].map(function (a) { return { id: a[0], name: a[1], night: !!a[2], src: a[3].src, base: a[3].u, dusk: a[3].dusk || '' }; });

  var W = { all: LIST, failed: {} };
  var byId = {}; LIST.forEach(function (w) { byId[w.id] = w; });
  W.byId = function (id) { return byId[id]; };
  W.rockies = byId['rockies-day'];
  W.local = function (w) { return w.src === 'plume' || !!(P.WALLS_LOCAL && P.WALLS_LOCAL[w.id]); };
  /* the photos a theme can show: all of them in dark mode, the day ones in light mode */
  W.pool = function (dark) { return LIST.filter(function (w) { return (dark || !w.night) && !W.failed[w.id]; }); };

  /* the photo's address. small: a preview (Settings, the quick panel); dark: the Rockies' dusk photo */
  W.url = function (w, small, dark) {
    if (w.src === 'plume') return dark && w.dusk ? w.dusk : w.base;
    if (P.WALLS_LOCAL && P.WALLS_LOCAL[w.id]) return 'img/walls/' + w.id + (small ? '-s' : '') + '.jpg';
    return W.remote(w, small ? 480 : 1920);
  };
  W.remote = function (w, width) {
    if (w.src === 'unsplash') return w.base + '?fm=jpg&q=' + (width > 1000 ? 80 : 70) + '&w=' + width + '&h=' + Math.round(width * 9 / 16) + '&fit=crop&auto=format';
    return w.base + '?auto=compress&cs=tinysrgb&w=' + width + '&h=' + Math.round(width * 9 / 16) + '&fit=crop';
  };
  W.credit = function (w) { return w.src === 'unsplash' ? 'Unsplash' : w.src === 'pexels' ? 'Pexels' : 'In Plume'; };
  W.name = function (w) { return P.t(w.name); };

  /* older versions kept a light and a dark choice ("plain" too): the light one becomes the choice for both */
  W.fix = function () {
    var w = byId[P.S.get('wp')];
    if (!w) {
      var old = byId[P.S.get('wpLight')];
      P.S.set('wp', old ? old.id : W.rockies.id);
    }
  };

  /* what the home screen shows now: { w, url, dim } */
  W.dayIndex = function (d) { d = d || new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  W.chosen = function (dark) {
    if (P.S.get('wpDaily')) {
      var pool = W.pool(dark);
      if (pool.length) return pool[W.dayIndex() % pool.length];
    }
    var w = byId[P.S.get('wp')] || W.rockies;
    if (W.failed[w.id] || (w.night && !dark)) return W.rockies;
    return w;
  };
  W.show = function (w, dark, small) {
    return { w: w, url: W.url(w, small, dark), dim: !!(dark && !w.night && !w.dusk) };
  };
  W.current = function (dark) { return W.show(W.chosen(dark), dark); };

  /* the quick panel's Wallpaper tile: the next photo this theme can show */
  W.next = function (dark, dir) {
    var l = W.pool(dark), i = l.map(function (w) { return w.id; }).indexOf(W.chosen(dark).id);
    var w = l[(i + (dir || 1) + l.length) % l.length];
    P.S.set('wp', w.id); P.S.set('wpDaily', false);
    return w;
  };
  /* load the next one ahead, so it shows at once */
  W.preloadNext = function (dark) {
    var l = W.pool(dark), i = l.map(function (w) { return w.id; }).indexOf(W.chosen(dark).id), w = l[(i + 1) % l.length];
    if (w) { var img = new Image(); img.src = W.url(w, false, dark); W._pre = img; }
  };

  P.Walls = W;
})();
