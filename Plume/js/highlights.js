/* Highlights of a finished match, on YouTube.
   Plume searches YouTube (with your free YouTube key from youtube-key.txt, or YouTube's own search page without one),
   then ranks what it finds:
     1. the competition's broadcaster or the league's own channel (Thmanyah, beIN, Premier League, LaLiga, UEFA, AFC…)
     2. a club's own channel
     3. any channel
   A video counts only if it was posted after kick-off and its title has the score, or both teams. */
(function () {
  var H = { key: '', cache: {} };

  // the broadcasters and league channels for each competition, by words in the channel's name
  var BROADCASTERS = {
    spl: ['ثمانية', 'thmanyah', 'ssc', 'روشن', 'roshn', 'saudi pro league', 'spl'],
    kc: ['ثمانية', 'thmanyah', 'ssc', 'كأس الملك', 'saff'],
    acle: ['afc', 'ثمانية', 'thmanyah', 'bein', 'بي ان'],
    acl2: ['afc', 'ثمانية', 'thmanyah', 'bein', 'بي ان'],
    cwc: ['fifa', 'dazn', 'bein', 'بي ان'],
    wcq: ['afc', 'fifa', 'ssc', 'ثمانية', 'bein', 'بي ان', 'المنتخب السعودي', 'saff'],
    wc: ['fifa', 'bein', 'بي ان', 'ssc'],
    asian: ['afc', 'bein', 'بي ان', 'ssc', 'ثمانية'],
    gulf: ['ssc', 'ثمانية', 'خليجي', 'gulf', 'bein', 'بي ان'],
    friendly: ['ssc', 'ثمانية', 'saff', 'المنتخب السعودي'],
    ucl: ['bein', 'بي ان', 'uefa', 'champions league', 'cbs sports golazo', 'tnt sports'],
    epl: ['premier league', 'bein', 'بي ان', 'sky sports', 'nbc sports'],
    liga: ['laliga', 'la liga', 'bein', 'بي ان']
  };
  // Arabic names, as Thmanyah and beIN write them
  var ARABIC = {
    'al hilal': ['الهلال'], 'al nassr': ['النصر'], 'al ahli': ['الأهلي', 'الاهلي'], 'al ittihad': ['الاتحاد'], 'al shabab': ['الشباب'],
    'al ettifaq': ['الاتفاق'], 'al taawoun': ['التعاون'], 'al fateh': ['الفتح'], 'al fayha': ['الفيحاء'], 'al khaleej': ['الخليج'],
    'al riyadh': ['الرياض'], 'al okhdood': ['الأخدود', 'الاخدود'], 'al kholood': ['الخلود'], 'al qadsiah': ['القادسية'], 'damac': ['ضمك'],
    'al wehda': ['الوحدة'], 'al raed': ['الرائد'], 'al orobah': ['العروبة'], 'al najma': ['النجمة'], 'neom': ['نيوم'], 'al hazem': ['الحزم'],
    'al tai': ['الطائي'], 'abha': ['أبها', 'ابها'], 'al akhdoud': ['الأخدود'], 'al sadd': ['السد'], 'al ain': ['العين'], 'al wahda': ['الوحدة'],
    'persepolis': ['بيرسبوليس'], 'esteghlal': ['استقلال'], 'saudi arabia': ['السعودية', 'المنتخب السعودي', 'الأخضر'], 'kuwait': ['الكويت'],
    'qatar': ['قطر'], 'uae': ['الإمارات'], 'united arab emirates': ['الإمارات'], 'bahrain': ['البحرين'], 'oman': ['عمان'], 'iraq': ['العراق'],
    'jordan': ['الأردن'], 'japan': ['اليابان'], 'south korea': ['كوريا'], 'australia': ['أستراليا'], 'china': ['الصين'], 'indonesia': ['إندونيسيا'],
    'real madrid': ['ريال مدريد'], 'barcelona': ['برشلونة'], 'manchester united': ['مانشستر يونايتد'], 'manchester city': ['مانشستر سيتي'],
    'liverpool': ['ليفربول'], 'arsenal': ['أرسنال', 'ارسنال'], 'chelsea': ['تشيلسي'], 'bayern munich': ['بايرن'], 'paris saint-germain': ['باريس'],
    'atletico madrid': ['أتلتيكو', 'اتلتيكو'], 'internazionale': ['إنتر', 'انتر']
  };
  // the short forms clubs use in their own titles
  var SHORT = { 'manchester united': ['man utd', 'man united', 'manchester utd'], 'manchester city': ['man city'], 'paris saint-germain': ['psg'],
    'internazionale': ['inter'], 'bayern munich': ['bayern'], 'tottenham hotspur': ['spurs', 'tottenham'], 'wolverhampton wanderers': ['wolves'],
    'newcastle united': ['newcastle'], 'west ham united': ['west ham'], 'brighton & hove albion': ['brighton'], 'atletico madrid': ['atleti', 'atletico'] };

  function norm(t) {
    return String(t || '').toLowerCase()
      .replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[-_.'’|:()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function aliases(team) {
    var n = norm(team.name).replace(/ saudi$/, '').replace(/ fc$/, '').replace(/^al ([a-z])/, 'al $1');
    var out = [n, norm(team.short)];
    (SHORT[n] || []).forEach(function (x) { out.push(norm(x)); });
    (ARABIC[n] || []).forEach(function (x) { out.push(norm(x)); });
    if (/^al /.test(n)) out.push(n.slice(3));                 // "Hilal", "Nassr"
    return out.filter(function (x, i, a) { return x && x.length > 2 && a.indexOf(x) === i; });
  }
  function has(title, list) { return list.some(function (a) { return (' ' + title + ' ').indexOf(' ' + a + ' ') >= 0 || (a.length > 4 && title.indexOf(a) >= 0); }); }

  /* how good a video is for this match: null = not this match */
  function judge(v, m) {
    var t = norm(v.title), ch = norm(v.channel);
    var hA = aliases(m.home), aA = aliases(m.away);
    var hH = has(t, hA), hAw = has(t, aA);
    var sc = [m.home.score, m.away.score].map(function (x) { return parseInt(x, 10); });
    var scoreIn = !isNaN(sc[0]) && !isNaN(sc[1]) && new RegExp('(^|\\D)(' + sc[0] + '\\s*[-–:]\\s*' + sc[1] + '|' + sc[1] + '\\s*[-–:]\\s*' + sc[0] + ')(\\D|$)').test(v.title);
    if (!((hH || hAw) && (scoreIn || (hH && hAw)))) return null;
    if (v.at && v.at < +m.date - 30 * 60000) return null;       // older than the match: an earlier meeting
    if (/full match|المباراة كاملة|كاملة|live|بث مباشر|preview|توقعات|press conference|مؤتمر/i.test(v.title) && !/highlights|ملخص|أهداف|اهداف/i.test(v.title)) return null;
    var tier = (BROADCASTERS[m.comp] || []).some(function (b) { return ch.indexOf(norm(b)) >= 0; }) ? 1 : (has(ch, hA) || has(ch, aA)) ? 2 : 3;
    var points = (scoreIn ? 4 : 0) + (hH && hAw ? 3 : 1) + (/highlights|ملخص|أهداف|اهداف|goals/i.test(v.title) ? 3 : 0);
    return { tier: tier, points: points };
  }

  /* ---------- searching ---------- */
  function queries(m) {
    var q = [m.home.name + ' ' + m.away.name + ' highlights'];
    var ah = ARABIC[norm(m.home.name).replace(/ saudi$/, '')], aa = ARABIC[norm(m.away.name).replace(/ saudi$/, '')];
    if (ah || aa) q.unshift('ملخص ' + (ah ? ah[0] : m.home.name) + ' ' + (aa ? aa[0] : m.away.name));
    return q;
  }
  function viaApi(q, after) {
    var u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&order=relevance' +
      '&publishedAfter=' + encodeURIComponent(new Date(after).toISOString()) + '&q=' + encodeURIComponent(q) + '&key=' + encodeURIComponent(H.key);
    return P.json(u, {}, 10000).then(function (d) {
      if (d && d.error) throw new Error(d.error.message || 'YouTube refused');
      return (d.items || []).map(function (it) {
        var s = it.snippet || {};
        return { id: it.id && it.id.videoId, title: decode(s.title), channel: decode(s.channelTitle), at: Date.parse(s.publishedAt) || 0 };
      }).filter(function (v) { return v.id; });
    });
  }
  function decode(t) { var e = document.createElement('textarea'); e.innerHTML = t || ''; return e.value; }
  /* without a key: YouTube's own search page (the same as typing in its search box) */
  function viaPage(q) {
    return fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=CAI%253D', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('YouTube said ' + r.status); return r.text(); })
      .then(function (html) {
        var m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) || html.match(/ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
        if (!m) throw new Error('YouTube changed its page');
        var data = JSON.parse(m[1]), out = [];
        (function walk(o, depth) {
          if (!o || typeof o !== 'object' || depth > 30 || out.length >= 30) return;
          if (o.videoRenderer && o.videoRenderer.videoId) {
            var v = o.videoRenderer;
            out.push({ id: v.videoId, title: ((v.title || {}).runs || [{}])[0].text || '', channel: (((v.ownerText || {}).runs) || [{}])[0].text || '', at: 0, ago: (v.publishedTimeText || {}).simpleText || '' });
            return;
          }
          for (var k in o) if (o.hasOwnProperty(k)) walk(o[k], depth + 1);
        })(data, 0);
        return out;
      });
  }

  /* the best few videos for a finished match, best first */
  H.find = function (m) {
    var hit = H.cache[m.id];
    if (hit && (hit.list.length || Date.now() - hit.at < 20 * 60000) && Date.now() - hit.at < 6 * 3600000) return Promise.resolve(hit.list);
    var qs = queries(m), after = +m.date;
    var search = function (q) { return H.key ? viaApi(q, after).catch(function () { return viaPage(q); }) : viaPage(q); };
    var seen = {}, all = [], errs = [];
    return qs.reduce(function (p, q) {
      return p.then(function () {
        return search(q).then(function (list) { list.forEach(function (v) { if (!seen[v.id]) { seen[v.id] = true; all.push(v); } }); }, function (e) { errs.push(e.message); });
      });
    }, Promise.resolve()).then(function () {
      var good = all.map(function (v) { var j = judge(v, m); return j ? { v: v, tier: j.tier, points: j.points } : null; }).filter(Boolean);
      good.sort(function (a, b) { return a.tier - b.tier || b.points - a.points || (a.v.at || 0) - (b.v.at || 0); });
      var list = good.slice(0, 4).map(function (g) { g.v.tier = g.tier; return g.v; });
      if (!list.length && errs.length && !all.length) throw new Error(errs[0]);
      H.cache[m.id] = { list: list, at: Date.now() };
      return list;
    });
  };

  /* play one inside Plume (YouTube's embedded player); the YouTube app when that's not allowed */
  H.play = function (v) { if (P.S.get('highlightsIn') === 'plume' && P.YT) P.YT.open(v); else H.playApp(v); };
  H.playApp = function (v) {
    var it = P.Apps.items['app:youtube'], ids = (it && it.ids.length ? it.ids : ['111299001912', 'com.samsung.tv.cobalt-yt']);
    P.TV.launchWithData(ids[0], { PAYLOAD: JSON.stringify({ values: 'v=' + v.id }) }, null, function () { P.UI.toast(P.t("Couldn't open YouTube")); });
  };

  /* the menu: the videos found, best first */
  H.open = function (m, anchor) {
    P.UI.toast(P.t('Looking for highlights…'), 2500);
    H.find(m).then(function (list) {
      if (!list.length) { P.UI.toast(P.t('No highlights yet · they usually go up within a couple of hours of the final whistle'), 5000); return; }
      P.UI.menu(anchor, P.t('Highlights') + ' · ' + P.team(m.home, true) + ' ' + P.Football.centreText(m) + ' ' + P.team(m.away, true), list.map(function (v, i) {
        return { label: '<bdi>' + P.esc(v.title) + '</bdi><small><bdi>' + P.esc(v.channel) + '</bdi>' + (i === 0 ? ' · ' + P.t('best match') : '') + '</small>', icon: 'play', act: function () { H.play(v); } };
      }), true);
      P.UI.toast('', 1);
    }).catch(function (e) { P.UI.toast(P.t("Couldn't search YouTube") + ' · ' + P.esc(e.message), 5000); });
  };

  // your YouTube key, from youtube-key.txt next to index.html (see the README)
  fetch('youtube-key.txt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
    var k = String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; })[0] || '';
    if (/^AIza[0-9A-Za-z_\-]{30,}$/.test(k)) H.key = k;
  }).catch(function () {});

  H._judge = judge; H._aliases = aliases;   // for the tests
  P.Highlights = H;
})();
