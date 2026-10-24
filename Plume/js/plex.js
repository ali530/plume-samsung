/* Plex Continue Watching.
   Sign-in: Plume shows a short code, you enter it at plex.tv/link on your phone. Plume never sees your password.
   Then it finds your Plex server, reads its Continue Watching list, and shows those titles on the home screen. */
(function () {
  var PLEX_APP = '3201512006963';
  var X = { state: 'out', items: [], error: null, link: null };

  function hdrs(token) {
    var h = {
      'Accept': 'application/json',
      'X-Plex-Product': 'Plume for Samsung',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Client-Identifier': P.S.get('clientId'),
      'X-Plex-Platform': 'Tizen',
      'X-Plex-Device': 'Samsung TV',
      'X-Plex-Device-Name': 'Plume (Samsung TV)'
    };
    if (token) h['X-Plex-Token'] = token;
    return h;
  }

  var acct = P.S.get('plex');
  if (acct && acct.token) X.state = 'in';

  /* ---------- sign in with a code ---------- */
  var pollT = null;
  X.startLink = function (onCode, onDone, onFail) {
    X.cancelLink();
    P.json('https://plex.tv/api/v2/pins?strong=false', { method: 'POST', headers: hdrs() }, 12000).then(function (pin) {
      X.link = { id: pin.id, code: pin.code, until: Date.now() + (pin.expiresIn || 900) * 1000 };
      onCode(pin.code);
      pollT = setInterval(function () {
        if (!X.link) return;
        if (Date.now() > X.link.until) { X.cancelLink(); onFail('The code expired. Try again.'); return; }
        P.json('https://plex.tv/api/v2/pins/' + X.link.id, { headers: hdrs() }, 8000).then(function (p) {
          if (p && p.authToken) { X.cancelLink(); finish(p.authToken, onDone, onFail); }
        }).catch(function () {});
      }, 2500);
    }).catch(function (e) { onFail("Couldn't reach plex.tv. Check the TV's internet connection."); P.log('pin', e.message); });
  };
  X.cancelLink = function () { if (pollT) clearInterval(pollT); pollT = null; X.link = null; };

  function finish(token, onDone, onFail) {
    P.json('https://plex.tv/api/v2/user', { headers: hdrs(token) }, 10000).then(function (u) {
      var user = (u && (u.friendlyName || u.username || u.title)) || 'Plex';
      return X.findServers(token).then(function (servers) {
        if (!servers.length) throw new Error('No Plex server found on your account.');
        return pickConnection(servers[0]).then(function (srv) {
          P.S.set('plex', { token: token, user: user, server: srv, servers: servers.map(function (s) { return s.name; }) });
          X.state = 'in';
          onDone(user, srv.name);
          X.refresh();
        });
      });
    }).catch(function (e) { onFail(e.message || "Couldn't finish signing in."); });
  }

  X.findServers = function (token) {
    return P.json('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', { headers: hdrs(token) }, 12000).then(function (list) {
      return (list || []).filter(function (r) { return /server/.test(r.provides || ''); })
        .sort(function (a, b) { return (b.owned ? 1 : 0) - (a.owned ? 1 : 0) || (b.presence ? 1 : 0) - (a.presence ? 1 : 0); });
    });
  };

  /* try the server's addresses: on your network first, then remote, then Plex's relay */
  function pickConnection(server) {
    var token = server.accessToken;
    var conns = (server.connections || []).slice().sort(function (a, b) {
      var s = function (c) { return c.relay ? 2 : c.local ? 0 : 1; };
      return s(a) - s(b);
    });
    var i = 0;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= conns.length) { reject(new Error(P.t("Found {name} but couldn't connect to it.", { name: server.name }))); return; }
        var c = conns[i++];
        P.json(c.uri + '/identity', { headers: hdrs(token) }, 4000).then(function () {
          resolve({ name: server.name, id: server.clientIdentifier, uri: c.uri, token: token });
        }).catch(next);
      })();
    });
  }

  X.useServer = function (name) {
    var a = P.S.get('plex'); if (!a) return Promise.resolve();
    return X.findServers(a.token).then(function (servers) {
      var s = servers.filter(function (x) { return x.name === name; })[0] || servers[0];
      return pickConnection(s).then(function (srv) { a.server = srv; a.servers = servers.map(function (x) { return x.name; }); P.S.set('plex', a); X.refresh(); });
    });
  };

  X.signOut = function () {
    P.S.set('plex', null); X.state = 'out'; X.items = []; P.bus.emit('plex');
  };

  /* ---------- Continue Watching ---------- */
  function metadataOf(d) {
    var mc = (d && d.MediaContainer) || {};
    if (mc.Metadata) return mc.Metadata;
    var out = [];
    (mc.Hub || []).forEach(function (h) { if (/continue|ondeck|inprogress/i.test(h.hubIdentifier || h.key || '') || (mc.Hub.length === 1)) out = out.concat(h.Metadata || []); });
    return out;
  }

  function toCard(m, srv) {
    var left = m.duration ? Math.max(0, m.duration - (m.viewOffset || 0)) : 0;
    var isEp = m.type === 'episode';
    var img = isEp ? (m.thumb || m.art || m.grandparentArt) : (m.art || m.thumb);
    return {
      key: String(m.ratingKey),
      title: isEp ? (m.grandparentTitle || m.title) : m.title,
      sub: (isEp ? P.t('S{s} E{e}', { s: m.parentIndex || 0, e: m.index || 0 }) + ' · ' : '') + (left ? P.minutesLeft(left) : (isEp ? m.title : '')),
      progress: m.duration ? Math.min(1, (m.viewOffset || 0) / m.duration) : 0,
      image: img ? srv.uri + '/photo/:/transcode?width=440&height=248&minSize=1&upscale=1&url=' + encodeURIComponent(img) + '&X-Plex-Token=' + encodeURIComponent(srv.token) : '',
      plexKey: m.key, guid: m.guid || ((m.grandparentTitle || '') + '|' + m.title + '|' + (m.year || '')),
      viewed: m.lastViewedAt || 0, offset: m.viewOffset || 0, type: m.type, lib: m.librarySectionTitle || '',
      show: isEp ? { id: m.grandparentGuid || String(m.grandparentRatingKey || ''), title: m.grandparentTitle || '' } : null,
      res: String(((m.Media || [])[0] || {}).videoResolution || '').toLowerCase()
    };
  }

  var busy = false, retried = false;
  X.refresh = function () {
    var a = P.S.get('plex');
    if (!a || !a.server || busy) return;
    busy = true;
    var srv = a.server, base = srv.uri;
    var paths = ['/hubs/continueWatching?count=16', '/hubs/home/continueWatching?count=16', '/library/onDeck'];
    var i = 0;
    (function next() {
      if (i >= paths.length) {
        busy = false;
        if (!retried) { retried = true; X.useServer(srv.name).catch(function () {}); } // the address may have changed
        X.error = "Couldn't reach your Plex server";
        P.bus.emit('plex');
        return;
      }
      P.json(base + paths[i++], { headers: hdrs(srv.token) }, 8000).then(function (d) {
        busy = false; retried = false; X.error = null;
        var hidden = P.S.get('plexHidden');
        // 1080p and 4K copies (or two languages) of one title share its Plex id: show it once, the copy watched last
        var best = {};
        var copies = {};
        metadataOf(d).map(function (m) { return toCard(m, srv); }).forEach(function (c) {
          (copies[c.guid] = copies[c.guid] || []).push({ key: c.key, res: c.res, viewed: c.viewed, offset: c.offset, lib: c.lib });
          var b = best[c.guid]; if (!b || c.viewed > b.viewed) best[c.guid] = c;
        });
        Object.keys(best).forEach(function (g) { best[g].copies = copies[g]; });
        X.items = Object.keys(best).map(function (k) { return best[k]; })
          .sort(function (a, b) { return b.viewed - a.viewed; })
          .filter(function (c) { return !isHidden(c, hidden); });
        P.bus.emit('plex');
      }).catch(next);
    })();
  };

  /* Open a title in Samsung's Plex app at the right spot. Plex apps can be told what to play over the network
     ("Plex Companion", what casting from your phone uses), so Plume opens Plex, waits for it to come online as a
     player on your account, and sends it the title and position. If that doesn't work, Plex simply stays on its home. */
  var cmd = 1;
  function tvIp() { try { return window.webapis && webapis.network && webapis.network.getIp(); } catch (e) { return null; } }
  function playQueue(srv, card) {
    var uri = 'server://' + srv.id + '/com.plexapp.plugins.library' + card.plexKey;
    return P.json(srv.uri + '/playQueues?type=video&continuous=0&uri=' + encodeURIComponent(uri), { method: 'POST', headers: hdrs(srv.token) }, 8000)
      .then(function (d) { return (d.MediaContainer || {}).playQueueID; }).catch(function () { return null; });
  }
  function sendPlay(player, srv, card, pq) {
    var u = srv.uri.match(/^(https?):\/\/([^:/]+):?(\d+)?/) || [];
    var q = 'key=' + encodeURIComponent(card.plexKey) + '&offset=' + card.offset + '&machineIdentifier=' + srv.id +
      '&protocol=' + u[1] + '&address=' + u[2] + '&port=' + (u[3] || (u[1] === 'https' ? 443 : 80)) + '&token=' + encodeURIComponent(srv.token) +
      (pq ? '&containerKey=' + encodeURIComponent('/playQueues/' + pq + '?own=1&window=200') : '') + '&type=video&commandID=' + (cmd++);
    var h = hdrs(P.S.get('plex').token); h['X-Plex-Target-Client-Identifier'] = player.clientIdentifier;
    var direct = (player.connections || []).map(function (c) { return c.uri; });
    var tries = direct.map(function (uri) { return uri + '/player/playback/playMedia?' + q; });
    tries.push(srv.uri + '/player/playback/playMedia?' + q); // or through your server
    var i = 0;
    return new Promise(function (ok, no) {
      (function next() {
        if (i >= tries.length) { no(); return; }
        fetch(tries[i++], { headers: h }).then(function (r) { if (r.ok) ok(); else next(); }, next);
      })();
    });
  }
  /* a short log of the last attempt, for Settings → About → Plex check */
  function note(t) {
    var l = P.S.get('plexLog') || []; l.push(new Date().toTimeString().slice(0, 8) + '  ' + t); P.S.set('plexLog', l.slice(-12));
  }
  X.loadPlayers = function (done) {
    var a = P.S.get('plex'); if (!a) { X.playerList = []; done(); return; }
    P.json('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', { headers: hdrs(a.token) }, 8000).then(function (list) {
      X.playerList = (list || []).filter(function (r) { return /player/.test(r.provides || ''); }).map(function (r) {
        return { name: r.name, product: r.product, platform: r.platform, online: !!r.presence, seen: r.lastSeenAt,
          addr: (r.connections || []).map(function (c) { return c.address; }).join(', ') };
      });
      done();
    }).catch(function (e) { X.playerList = null; X.playerError = e.message; done(); });
  };

  /* OK on a card: Plume's own player (loaded the first time it's needed, so it never slows the home screen) */
  var playerLoading = null;
  /* ---------- versions of one title (4K / 1080p, original / dubbed) ---------- */
  var LANGS = { ara: 'Arabic', eng: 'English', fre: 'French', fra: 'French', spa: 'Spanish', ger: 'German', deu: 'German', ita: 'Italian',
    tur: 'Turkish', hin: 'Hindi', jpn: 'Japanese', kor: 'Korean', chi: 'Chinese', zho: 'Chinese', por: 'Portuguese', rus: 'Russian', urd: 'Urdu' };
  function resName(r) { r = String(r || '').toLowerCase(); return r === '4k' ? '4K' : /^\d+$/.test(r) ? r + 'p' : r.toUpperCase(); }
  /* Reads every version's details from the server (their own "last watched" times, language and resolution). */
  X.versions = function (card) {
    var s = P.S.get('plex').server;
    var list = card.copies && card.copies.length ? card.copies : [{ key: card.key, res: card.res, viewed: card.viewed, offset: card.offset, lib: card.lib }];
    return Promise.all(list.map(function (c) {
      return P.json(s.uri + '/library/metadata/' + c.key, { headers: hdrs(s.token) }, 8000).then(function (d) {
        var m = ((d.MediaContainer || {}).Metadata || [])[0] || {};
        var media = (m.Media || [])[0] || {}, streams = ((media.Part || [])[0] || {}).Stream || [];
        var auds = streams.filter(function (x) { return x.streamType === 2; });
        var a = auds.filter(function (x) { return x.selected; })[0] || auds[0] || {};
        var code = a.languageCode || '';
        return { key: c.key, res: String(media.videoResolution || c.res || '').toLowerCase(), viewed: Math.max(m.lastViewedAt || 0, c.viewed || 0),
          offset: m.viewOffset != null ? m.viewOffset : c.offset || 0, lang: code, langName: LANGS[code] ? P.t(LANGS[code]) : a.language || '', lib: m.librarySectionTitle || c.lib || '' };
      }).catch(function () { return { key: c.key, res: c.res || '', viewed: c.viewed || 0, offset: c.offset || 0, lang: '', langName: '', lib: c.lib || '' }; });
    })).then(function (vs) {
      var langs = {}, ress = {};
      vs.forEach(function (v) { langs[v.lang] = 1; ress[v.res] = 1; });
      var manyLang = Object.keys(langs).length > 1, manyRes = Object.keys(ress).length > 1;
      vs.forEach(function (v) {
        var bits = [];
        if (manyLang || !manyRes) bits.push(v.langName || v.lib);
        if (manyRes || !manyLang) bits.push(resName(v.res));
        v.label = bits.filter(Boolean).join(' · ') || v.lib || P.t('Version');
      });
      // two versions that still read the same: tell them apart by their library
      vs.forEach(function (v) { if (vs.filter(function (w) { return w.label === v.label; }).length > 1 && v.lib) v.label += ' · ' + v.lib; });
      return vs;
    });
  };
  /* Which version plays. Plex's own "last watched" times can't be trusted here (Plume saves your position on every
     version, and the TV's clock may differ from your server's), so Plume keeps a snapshot of each version's position
     when you stop watching in Plume:
     - a version that moved on since that snapshot was watched in the Plex app → it plays;
     - otherwise the version you played in Plume plays;
     - no snapshot yet: the version furthest along, then the most recent, then 4K.
     Settings → Copy to play (4K / 1080p) then picks that resolution among versions in the same language. */
  var RANK = { '4k': 4, '2160': 4, '1080': 3, '720': 2 };
  function furthest(vs) {
    return vs.slice().sort(function (a, b) {
      if (Math.abs(b.offset - a.offset) > 60000) return b.offset - a.offset;
      if (Math.abs(b.viewed - a.viewed) > 300) return b.viewed - a.viewed;
      return (RANK[b.res] || 1) - (RANK[a.res] || 1);
    })[0];
  }
  X.choose = function (card, vs) {
    var pick = (P.S.get('plexPicks') || {})[card.guid], base = null, why = '';
    if (pick && pick.snap) {
      var moved = vs.filter(function (v) {
        var s = pick.snap[v.key];
        return s && (Math.abs(v.offset - s[1]) > 60000 || v.viewed - s[0] > 120);
      });
      if (moved.length) { base = furthest(moved); why = 'watched in the Plex app'; }
    }
    if (!base && pick && pick.snap) { base = vs.filter(function (v) { return v.key === pick.key; })[0]; if (base) why = 'last played in Plume'; }
    if (!base) { base = furthest(vs); why = 'furthest along on Plex'; }
    var want = P.S.get('plexCopy');
    if (want === '4k' || want === '1080') {
      var hit = vs.filter(function (v) { return v.lang === base.lang && (want === '4k' ? v.res === '4k' : /^1080/.test(v.res)); })[0];
      if (hit && hit !== base) { base = hit; why = 'your setting: ' + (want === '4k' ? '4K' : '1080p'); }
    }
    return { play: base, all: vs, offset: furthest(vs).offset || base.offset || 0, why: why };
  };
  /* after you stop watching in Plume: which version you played, and every version's position as Plex now has it */
  X.remember = function (card, key, vs) {
    if (!card.guid) return;
    var m = P.S.get('plexPicks') || {};
    var snap = {};
    (vs || []).forEach(function (v) { snap[v.key] = [v.viewed, v.offset]; });
    m[card.guid] = { key: key, at: Date.now(), snap: vs ? snap : (m[card.guid] && m[card.guid].key === key ? m[card.guid].snap : null) };
    var ks = Object.keys(m);
    if (ks.length > 200) ks.sort(function (a, b) { return m[a].at - m[b].at; }).slice(0, ks.length - 200).forEach(function (k) { delete m[k]; });
    P.S.set('plexPicks', m);
  };
  X.snapshot = function (card, key) {
    if (!card.guid || !card.copies || card.copies.length < 2) return;
    setTimeout(function () { X.versions(card).then(function (vs) { X.remember(card, key, vs); }); }, 4000);   // after Plex has saved your position
  };

  X.open = function (card, key) {
    if (P.Player) { P.Player.open(card, key); return; }
    if (playerLoading) return;
    playerLoading = document.createElement('script');
    playerLoading.src = 'js/player.js';
    playerLoading.onload = function () { P.Player.open(card, key); };
    playerLoading.onerror = function () { playerLoading = null; X.openApp(card); };
    document.body.appendChild(playerLoading);
  };

  X.openApp = function (card) {
    var a = P.S.get('plex'), srv = a && a.server;
    P.S.set('plexLog', []);
    note('Opening Plex for "' + card.title + '"');
    P.TV.launchAndReturn(P.Apps.items['app:plex'].ids, function () {
      if (!srv) return;
      var ip = tvIp(), started = Date.now(), tries = 0;
      note('This TV is ' + (ip || 'unknown address') + '. Looking for its Plex app on your account…');
      playQueue(srv, card).then(function (pq) {
        (function look() {
          if (Date.now() - started > 25000) { note('Gave up after 25 s: the TV\'s Plex app never showed up as a player'); return; }
          tries++;
          P.json('https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1', { headers: hdrs(a.token) }, 8000).then(function (list) {
            var players = (list || []).filter(function (r) { return /player/.test(r.provides || '') && r.clientIdentifier !== P.S.get('clientId'); });
            var mine = players.filter(function (r) { return (r.connections || []).some(function (c) { return ip && c.address === ip; }); })
              .concat(players.filter(function (r) { return /tizen|samsung/i.test((r.platform || '') + ' ' + (r.product || '') + ' ' + (r.device || '')); }));
            var p = mine[0];
            if (tries === 1) note('Players on your account: ' + (players.map(function (r) { return r.name + ' (' + (r.product || '?') + (r.presence ? ', online' : '') + ')'; }).join('; ') || 'none'));
            if (!p || !p.presence) { setTimeout(look, 2000); return; }
            note('Sending the title to ' + p.name + '…');
            sendPlay(p, srv, card, pq).then(function () { note('Plex accepted it'); }, function () { note(p.name + ' did not accept it; retrying'); setTimeout(look, 2500); });
          }).catch(function (e) { note('plex.tv not reachable (' + e.message + ')'); setTimeout(look, 2500); });
        })();
      });
    }, function () { P.UI.toast(P.t("Couldn't open Plex")); });
  };

  /* Hide from Continue Watching: in Plume only (Plex keeps it). The title comes back by itself when you watch it
     again, here or in the Plex app. Older Plume versions saved just the id; those stay hidden as before. */
  function isHidden(c, hidden) {
    return hidden.some(function (h) {
      if (typeof h === 'string') return h === c.key;
      if (h.kind === 'show') return !!(c.show && c.show.id && c.show.id === h.id);
      if (h.kind === 'movie') return c.guid === h.id;
      return (h.guid === c.guid || h.key === c.key) && (c.viewed || 0) <= (h.viewed || 0);
    });
  }
  X.hide = function (card) {
    var h = P.S.get('plexHidden').slice(); h.push({ key: card.key, guid: card.guid, viewed: card.viewed || 0 }); P.S.set('plexHidden', h.slice(-300));
    X.items = X.items.filter(function (c) { return c.key !== card.key; });
    P.bus.emit('plex');
  };

  /* Hide a whole show (every episode, also ones watched later) or a movie from Plume; Plex keeps them.
     Settings → Plex → Hidden lists them, and OK there brings one back. */
  X.hideAll = function (card) {
    var h = P.S.get('plexHidden').slice();
    var e = card.show && card.show.id ? { kind: 'show', id: card.show.id, title: card.show.title || card.title } : { kind: 'movie', id: card.guid, title: card.title };
    if (!e.id) { X.hide(card); return; }
    h.push(e); P.S.set('plexHidden', h.slice(-300));
    X.items = X.items.filter(function (c) { return !isHidden(c, [e]); });
    P.bus.emit('plex');
    P.UI.toast(P.t('{title} is hidden · Settings → Plex → Hidden brings it back', { title: P.esc(e.title) }));
  };
  X.hiddenList = function () { return P.S.get('plexHidden').filter(function (h) { return h && (h.kind === 'show' || h.kind === 'movie'); }); };
  X.unhide = function (entry) {
    P.S.set('plexHidden', P.S.get('plexHidden').filter(function (h) { return !(h && h.kind === entry.kind && h.id === entry.id); }));
    X.refresh();
  };

  X.hdrs = hdrs;
  P.Plex = X;
})();
