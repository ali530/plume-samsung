/* Weather under the clock, and sunrise/sunset for the automatic theme. Open-Meteo: free, no account. */
(function () {
  var CITIES = {
    'Riyadh': [24.7136, 46.6753], 'Jeddah': [21.4858, 39.1925], 'Mecca': [21.3891, 39.8579], 'Medina': [24.5247, 39.5692],
    'Dammam': [26.4207, 50.0888], 'Khobar': [26.2172, 50.1971], 'Dhahran': [26.2361, 50.0393], 'Taif': [21.2703, 40.4158],
    'Abha': [18.2164, 42.5053], 'Tabuk': [28.3835, 36.5662], 'Buraidah': [26.3260, 43.9750], 'Hail': [27.5114, 41.7208],
    'Jazan': [16.8892, 42.5511], 'Najran': [17.5656, 44.2289], 'AlUla': [26.6085, 37.9232], 'Al Ahsa': [25.3830, 49.5860]
  };
  var W = { now: null, sun: null, cities: Object.keys(CITIES) };

  function iconFor(code, isDay) {
    if (code === 0) return isDay ? 'sun' : 'moon';
    if (code <= 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloud';
  }

  W.refresh = function () {
    var c = CITIES[P.S.get('city')] || CITIES.Riyadh;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c[0] + '&longitude=' + c[1] +
      '&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=2';
    return P.json(url, {}, 12000).then(function (d) {
      var cur = d.current || {};
      W.now = { temp: Math.round(cur.temperature_2m), icon: iconFor(cur.weather_code, cur.is_day !== 0), day: cur.is_day !== 0 };
      if (d.daily && d.daily.sunrise) {
        W.sun = { rise: new Date(d.daily.sunrise[0]), set: new Date(d.daily.sunset[0]), riseNext: new Date(d.daily.sunrise[1]) };
      }
      P.bus.emit('weather');
    }).catch(function (e) { P.log('weather', e.message); });
  };

  /* is it night for the automatic theme? */
  W.isNight = function (d) {
    d = d || new Date();
    if (W.sun && !isNaN(W.sun.rise)) {
      var mins = d.getHours() * 60 + d.getMinutes();
      var rise = W.sun.rise.getHours() * 60 + W.sun.rise.getMinutes();
      var set = W.sun.set.getHours() * 60 + W.sun.set.getMinutes();
      return mins < rise || mins >= set;
    }
    return d.getHours() < 6 || d.getHours() >= 18;
  };

  W.html = function () {
    if (!W.now || isNaN(W.now.temp)) return '';
    return P.icon(W.now.icon) + '<span>' + W.now.temp + '°</span>';
  };

  P.Weather = W;
})();
