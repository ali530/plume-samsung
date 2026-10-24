/* Plume's own line icons (24×24, drawn here; no icon font, no brand marks). */
(function () {
  function gear() {
    var pts = [], teeth = 8, rO = 10, rI = 7.6;
    for (var i = 0; i < teeth * 4; i++) {
      var a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
      var r = (i % 4 === 0 || i % 4 === 1) ? rO : rI;
      pts.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12 + r * Math.sin(a)).toFixed(2));
    }
    return '<polygon points="' + pts.join(' ') + '" stroke-linejoin="round"/><circle cx="12" cy="12" r="3"/>';
  }
  function sunRays() {
    var s = '<circle cx="12" cy="12" r="4"/>';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, c = Math.cos(a), n = Math.sin(a);
      s += '<path d="M' + (12 + 6.5 * c).toFixed(1) + ' ' + (12 + 6.5 * n).toFixed(1) + 'L' + (12 + 9 * c).toFixed(1) + ' ' + (12 + 9 * n).toFixed(1) + '"/>';
    }
    return s;
  }
  function ball() {
    var s = '<circle cx="12" cy="12" r="9"/>', pent = [], i, a;
    for (i = 0; i < 5; i++) { a = -Math.PI / 2 + i * 2 * Math.PI / 5; pent.push([12 + 3.4 * Math.cos(a), 12 + 3.4 * Math.sin(a)]); }
    s += '<polygon points="' + pent.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ') + '" fill="currentColor" stroke-linejoin="round"/>';
    for (i = 0; i < 5; i++) {
      a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      var e = [12 + 6.4 * Math.cos(a), 12 + 6.4 * Math.sin(a)];
      s += '<path d="M' + pent[i][0].toFixed(2) + ' ' + pent[i][1].toFixed(2) + 'L' + e[0].toFixed(2) + ' ' + e[1].toFixed(2) + '"/>';
      var l = [12 + 9 * Math.cos(a - 0.36), 12 + 9 * Math.sin(a - 0.36)], r = [12 + 9 * Math.cos(a + 0.36), 12 + 9 * Math.sin(a + 0.36)];
      s += '<path d="M' + l[0].toFixed(2) + ' ' + l[1].toFixed(2) + 'L' + e[0].toFixed(2) + ' ' + e[1].toFixed(2) + 'L' + r[0].toFixed(2) + ' ' + r[1].toFixed(2) + '" fill="currentColor" stroke-linejoin="round"/>';
    }
    return s;
  }
  var CLOUD = 'M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 18z';
  var G = {
    wifi: '<path d="M2.5 9.2a14 14 0 0 1 19 0M5.6 12.6a9.4 9.4 0 0 1 12.8 0M8.8 16a4.6 4.6 0 0 1 6.4 0"/><circle cx="12" cy="19.3" r="1.3" fill="currentColor" stroke="none"/>',
    wifiOff: '<path d="M2.5 9.2a14 14 0 0 1 19 0M8.8 16a4.6 4.6 0 0 1 6.4 0M3 3l18 18"/><circle cx="12" cy="19.3" r="1.3" fill="currentColor" stroke="none"/>',
    grid: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8" fill="currentColor" stroke="none"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8" fill="currentColor" stroke="none"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" fill="currentColor" stroke="none"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" fill="currentColor" stroke="none"/>',
    gear: gear(),
    gamepad: '<path d="M6.2 7.5h11.6a4.2 4.2 0 0 1 4.1 5.1l-1 4.6a2.4 2.4 0 0 1-4.1 1.1L14.9 16H9.1l-1.9 2.3a2.4 2.4 0 0 1-4.1-1.1l-1-4.6a4.2 4.2 0 0 1 4.1-5.1z"/><path d="M7.5 10.2v3.6M5.7 12h3.6"/><circle cx="15.9" cy="11" r=".95" fill="currentColor" stroke="none"/><circle cx="18" cy="13.1" r=".95" fill="currentColor" stroke="none"/>',
    ball: ball(),
    settop: '<rect x="2.5" y="8" width="19" height="8.5" rx="2"/><path d="M6 19.5h12M6 12.2h6"/><circle cx="17.2" cy="12.2" r="1.1" fill="currentColor" stroke="none"/>',
    sun: sunRays(),
    moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    cloud: '<path d="' + CLOUD + '"/>',
    partly: '<path d="M8.5 4.2v1.6M3.6 9h1.6M4.9 5.4l1.1 1.1M12.1 5.4L11 6.5"/><path d="M5.8 11.4a3.3 3.3 0 0 1 5.6-3"/><path d="M9 20h8.5a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 9 20z"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
    storm: '<path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.3h3l-2 3.2"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    snow: '<path d="M7 14h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.3A3.4 3.4 0 0 0 7 14z"/><circle cx="8.5" cy="18" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r=".9" fill="currentColor" stroke="none"/><circle cx="15.5" cy="18" r=".9" fill="currentColor" stroke="none"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3"/>',
    star: '<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z" stroke-linejoin="round"/>',
    bell: '<path d="M6.2 16.5V11a5.8 5.8 0 0 1 11.6 0v5.5l1.6 1.8H4.6zM10 20.5a2.2 2.2 0 0 0 4 0"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    move: '<path d="M3.5 12h17M7.5 8l-4 4 4 4M16.5 8l4 4-4 4"/>',
    eyeOff: '<path d="M3 12s3.3-6 9-6c1.6 0 3 .5 4.2 1.1M21 12s-3.3 6-9 6c-1.6 0-3-.5-4.2-1.1M3.5 3.5l17 17"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke-linejoin="round"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.1"/><circle cx="4.8" cy="12" r="1.1"/><circle cx="4.8" cy="17.5" r="1.1"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  P.icon = function (name, cls) {
    return '<svg class="ic i-' + name + ' ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' + (G[name] || '') + '</svg>';
  };
})();
