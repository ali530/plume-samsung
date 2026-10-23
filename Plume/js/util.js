/* Small helpers shared by every part of Plume. Plain ES2017: the S90C runs Tizen 7 (Chromium 94). */
var P = window.P || {};
window.P = P;

P.$ = function (sel, root) { return (root || document).querySelector(sel); };
P.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

P.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

P.pad = function (n) { return (n < 10 ? '0' : '') + n; };

/* 12-hour clock without am/pm, like the Plume screenshots ("3:32"). */
P.clockText = function (d) {
  var h = d.getHours() % 12 || 12;
  return h + ':' + P.pad(d.getMinutes());
};
P.hhmm = function (d) { return P.pad(d.getHours()) + ':' + P.pad(d.getMinutes()); };
P.DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
P.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
P.dateText = function (d) { return P.DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + P.MONTHS[d.getMonth()]; };
P.ymd = function (d) { return d.getFullYear() + P.pad(d.getMonth() + 1) + P.pad(d.getDate()); };
P.dayStart = function (d, offsetDays) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (offsetDays) x.setDate(x.getDate() + offsetDays);
  return x;
};
/* "6h 48m", "25m", "Now" */
P.until = function (ms) {
  var m = Math.round(ms / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + P.pad(m % 60) + 'm';
};
P.minutesLeft = function (ms) {
  var m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + ' min left';
  var h = Math.floor(m / 60), r = m % 60;
  return h + ' hr ' + (r ? r + ' min ' : '') + 'left';
};

/* fetch with a timeout; resolves to parsed JSON or rejects */
P.json = function (url, opts, timeoutMs) {
  opts = opts || {};
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (ctrl) opts.signal = ctrl.signal;
  var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 10000);
  return fetch(url, opts).then(function (r) {
    clearTimeout(t);
    if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.text().then(function (txt) { return txt ? JSON.parse(txt) : {}; });
  }, function (e) { clearTimeout(t); throw e; });
};

P.log = function () {
  try { console.log.apply(console, ['[plume]'].concat([].slice.call(arguments))); } catch (e) {}
};

P.el = function (tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

/* simple event hub so parts can refresh each other without knowing about each other */
P.bus = (function () {
  var map = {};
  return {
    on: function (name, fn) { (map[name] = map[name] || []).push(fn); },
    emit: function (name, data) { (map[name] || []).forEach(function (fn) { try { fn(data); } catch (e) { P.log('bus', name, e); } }); }
  };
})();
