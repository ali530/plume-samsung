/* Home screen wallpapers: mountain photos for light mode and for dark mode.
   The two Rockies photos are inside Plume and always work, also offline. The others are free photos
   (Unsplash licence, Pexels licence) loaded from the internet; one that doesn't load falls back to the Rockies.
   "A different mountain each day" picks the next photo of that mode every day. */
(function () {
  var US = function (id) { return { src: 'unsplash', u: 'https://images.unsplash.com/photo-' + id }; };
  var PX = function (id, slug) {
    return { src: 'pexels', u: 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + (slug ? '/free-photo-of-' + slug : '') + '.jpeg' };
  };
  var LIST = [
    // light mode
    ['rockies-day', 'Rockies (day)', 'light', { src: 'plume', u: 'img/rockies-day.jpg' }],
    ['lake-mirror', 'Lake mirror', 'light', US('1732130319312-99c2da8522fb')],
    ['snow-reflection', 'Snow reflection', 'light', US('1632168593111-cd9b00e41ba1')],
    ['cloudy-lake', 'Cloudy lake', 'light', US('1759390095773-dc0528e69ccb')],
    ['distant-range', 'Distant range', 'light', US('1641353554926-2b2ab5db7ec7')],
    ['high-road', 'High road', 'light', US('1721986558852-7adc6091936e')],
    ['winter-forest', 'Winter forest', 'light', US('1704877270853-a3c7e35e5c4d')],
    ['blue-peaks', 'Blue peaks', 'light', US('1718963705471-c498bed9be56')],
    ['foggy-peak', 'Foggy peak', 'light', PX(2310653)],
    ['snow-caps', 'Snow caps from above', 'light', PX(2542011)],
    ['sea-of-clouds', 'Sea of clouds', 'light', PX(2887786)],
    ['green-sunrise', 'Green slopes at sunrise', 'light', PX(2437289)],
    ['clear-summit', 'Clear summit', 'light', PX(31340234, 'snowy-mountain-peak-under-clear-sky')],
    ['snowy-summit', 'Snowy summit', 'light', PX(416779)],
    // dark mode
    ['rockies-dusk', 'Rockies (dusk)', 'dark', { src: 'plume', u: 'img/rockies-dusk.jpg' }],
    ['starry-peak', 'Starry peak', 'dark', US('1551770908-437bb2e457b8')],
    ['milky-way', 'Stars over the snow', 'dark', US('1764366795867-a0e7fcbf791e')],
    ['night-snow', 'Night snow', 'dark', US('1694900565922-d279cef76fd2')],
    ['star-summit', 'Summit under the stars', 'dark', US('1477840539360-4a1d23071046')],
    ['full-moon', 'Full moon', 'dark', US('1602138084375-99668d8020a8')],
    ['blue-hour', 'Blue hour', 'dark', US('1562422313-5195a5f0198a')],
    ['alpenglow', 'Alpenglow from above', 'dark', US('1764022363311-b09420ddf0ae')],
    ['layered-sunset', 'Layered sunset', 'dark', US('1762586357891-2336a811de2a')],
    ['first-light', 'First light', 'dark', US('1694507482314-a429436d4a0a')],
    ['night-mountain', 'Mountain at night', 'dark', PX(411987)]
  ].map(function (a) { return { id: a[0], name: a[1], mode: a[2], src: a[3].src, base: a[3].u }; });

  var W = { all: LIST, failed: {} };
  var byId = {}; LIST.forEach(function (w) { byId[w.id] = w; });
  W.byId = function (id) { return byId[id]; };
  W.list = function (mode) { return LIST.filter(function (w) { return w.mode === mode; }); };
  W.fallback = function (mode) { return byId[mode === 'dark' ? 'rockies-dusk' : 'rockies-day']; };

  /* the photo's address at a width: 1920 for the wallpaper, smaller for previews */
  W.url = function (w, width) {
    width = width || 1920;
    if (w.src === 'plume') return w.base;
    if (w.src === 'unsplash') return w.base + '?fm=jpg&q=' + (width > 1000 ? 80 : 70) + '&w=' + width + '&h=' + Math.round(width * 9 / 16) + '&fit=crop&auto=format';
    return w.base + '?auto=compress&cs=tinysrgb&w=' + width + '&h=' + Math.round(width * 9 / 16) + '&fit=crop';
  };
  W.credit = function (w) { return w.src === 'unsplash' ? 'Unsplash' : w.src === 'pexels' ? 'Pexels' : 'In Plume'; };
  W.name = function (w) { return P.t(w.name); };

  /* stored choices from older versions ("plain", or a photo since removed) go back to the Rockies */
  W.fix = function () {
    ['wpLight', 'wpDark'].forEach(function (k) {
      var mode = k === 'wpDark' ? 'dark' : 'light', w = byId[P.S.get(k)];
      if (!w || w.mode !== mode) P.S.set(k, W.fallback(mode).id);
    });
  };

  /* today's wallpaper for a mode: the chosen one, or with "each day" on, the next one every day */
  W.dayIndex = function (d) { d = d || new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  W.current = function (dark) {
    var mode = dark ? 'dark' : 'light';
    if (P.S.get('wpDaily')) {
      var pool = W.list(mode).filter(function (w) { return !W.failed[w.id]; });
      if (pool.length) return pool[W.dayIndex() % pool.length];
    }
    var w = byId[P.S.get(dark ? 'wpDark' : 'wpLight')] || W.fallback(mode);
    return W.failed[w.id] ? W.fallback(mode) : w;
  };
  W.next = function (dark, dir) {
    var mode = dark ? 'dark' : 'light', l = W.list(mode), key = dark ? 'wpDark' : 'wpLight';
    var i = l.map(function (w) { return w.id; }).indexOf(P.S.get(key));
    var w = l[(i + (dir || 1) + l.length) % l.length];
    P.S.set(key, w.id); P.S.set('wpDaily', false);
    return w;
  };

  P.Walls = W;
})();
