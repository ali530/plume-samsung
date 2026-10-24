/* Plume's languages: English and Arabic. Every piece of Plume's own text goes through P.t('English text'), which
   gives the Arabic when Arabic is chosen (Settings → Look → Language). Arabic also turns the whole screen
   right-to-left. Changing the language restarts Plume, so everything is drawn again in the new language.
   Team names come from ESPN in English: P.team() gives the Arabic name (see teams-ar.js). */
(function () {
  var lang = 'en';
  try { lang = JSON.parse(localStorage.getItem('plume.lang') || '"en"') === 'ar' ? 'ar' : 'en'; } catch (e) {}
  P.lang = lang;
  P.rtl = lang === 'ar';
  P.AR = P.AR || {};

  /* P.t('Kick-off in {t}', {t: '2h'}) */
  P.t = function (s, vars) {
    if (typeof s !== 'string') return s == null ? '' : String(s);
    var out = s;
    if (P.rtl && s) {
      if (P.AR[s] != null) out = P.AR[s];
      else (P.AR_RX || []).some(function (r) { if (r[0].test(s)) { out = s.replace(r[0], r[1]); return true; } return false; });
    }
    if (vars) out = out.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return out;
  };

  /* Arabic plural forms for counts: P.tn(n, 'title', 'titles') → "3 titles" / "٣ عناوين" style (digits stay 1 2 3) */
  P.count = function (n, one, many) {
    if (!P.rtl) return n + ' ' + (n === 1 ? one : many);
    var a = P.AR['#' + one] || [one, one, many, many];   // [1, 2, 3–10, 11+]
    if (n === 1) return a[0];
    if (n === 2) return a[1];
    return n + ' ' + (n >= 3 && n <= 10 ? a[2] : a[3]);
  };

  if (P.rtl) {
    P.DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    P.MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    P.until = function (ms) {
      var m = Math.round(ms / 60000);
      if (m <= 0) return 'الآن';
      if (m < 60) return m + '\u00a0د';
      return Math.floor(m / 60) + '\u00a0س\u00a0' + P.pad(m % 60) + '\u00a0د';
    };
    P.minutesLeft = function (ms) {
      var m = Math.max(1, Math.round(ms / 60000));
      if (m < 60) return 'متبقٍ ' + m + ' د';
      var h = Math.floor(m / 60), r = m % 60;
      return 'متبقٍ ' + h + ' س' + (r ? ' ' + r + ' د' : '');
    };
  }

  /* a piece that reads left to right inside Arabic text: 63', +11, 4-3-3, a player's name and minute */
  P.ltr = function (s) { return P.rtl && s !== '' && s != null ? '\u2066' + s + '\u2069' : (s == null ? '' : s); };

  /* the start and end side of the screen, and sliding a row of tiles toward its start */
  P.lead = function (el, track) {             // distance of el from the track's start edge (left, or right in Arabic)
    var l = el.offsetLeft;
    return P.rtl ? track.offsetWidth - l - el.offsetWidth : l;
  };
  P.slideX = function (track, x) { track.style.transform = 'translate3d(' + (P.rtl ? x : -x) + 'px,0,0)'; };

  /* a team's name to show: Arabic when Arabic is chosen */
  P.team = function (t, short) {
    if (!t) return '';
    var en = short ? (t.short || t.name) : (t.name || t.short);
    return P.rtl && P.teamAr ? P.teamAr(t.name || en, en) : en;
  };

  document.documentElement.lang = lang;
  document.documentElement.dir = P.rtl ? 'rtl' : 'ltr';

  /* text written in index.html: <h2 data-t>Continue Watching …</h2> */
  P.translatePage = function () {
    if (!P.rtl) return;
    P.$$('[data-t]').forEach(function (e) {
      var n = e.firstChild; if (n && n.nodeType === 3) n.nodeValue = P.t(n.nodeValue.trim()) + ' ';
    });
    P.$$('[title]').forEach(function (e) { e.title = P.t(e.title); });
  };
})();
