"""Player checks: runs Plume with a stand-in Samsung video player (AVPlay) and a stand-in Plex server.
Usage: python3 player_test.py <app dir> <assets dir> <out dir>"""
import sys, os, asyncio, threading, json, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'harness.py')).read().rsplit('asyncio.run(main())', 1)[0]
src = src.replace('PORT = 8765', 'PORT = 8799')
g = {}; exec(src, g)
from playwright.async_api import async_playwright

AVPLAY = """
window.__av = [];
(function(){
  var l = null, t = 0, timer = null, dur = 3300000, url = '', pendingErr = null;
  function rec(){ window.__av.push([].slice.call(arguments)); }
  // like the TV: a converted stream may report the title's own time (window.__absTime)
  function off(){ return url.indexOf('m3u8') > 0 || url.indexOf('index.m3u8') > 0 ? (+(/offset=(\\d+)/.exec(url)||[0,0])[1]) * 1000 : 0; }
  function run(){ clearInterval(timer); timer = setInterval(function(){ t += 1000; var rep = t + (window.__absTime && !/file\\.mkv/.test(url) ? (window.__lastOffset || 0) : 0); l && l.oncurrentplaytime && l.oncurrentplaytime(rep); if (t >= dur) { clearInterval(timer); l.onstreamcompleted(); } }, 250); }
  window.webapis = window.webapis || {};
  webapis.avplay = {
    open: function(u){ if (window.__avReject > 0) { window.__avReject--; rec('refused', u); throw {name:'InvalidValuesError'}; }
      // like the TV: interrupting a start reports an error for the old one, a moment later
      if (pendingErr && window.__staleErrors) { var pe = pendingErr; setTimeout(function(){ pe({name:'PLAYER_ERROR_INVALID_OPERATION'}); }, 5); }
      pendingErr = null; url = u; t = 0; clearInterval(timer); rec('open', u); },
    setDisplayRect: function(x,y,w,h){ if (w < 2) throw {name:'TypeMismatchError'}; rec('rect'); }, setDisplayMethod: function(){}, setStreamingProperty: function(k,v){ rec('prop', k, v); },
    setListener: function(x){ l = x; },
    prepareAsync: function(ok, err){ rec('prepare'); pendingErr = err || null; var mine = err;
      setTimeout(function(){ if (pendingErr !== mine) return; pendingErr = null;
        if (window.__failBurn && url.indexOf('subtitles=burn') > 0) { setTimeout(function(){ l && l.onerror && l.onerror('PLAYER_ERROR_CONNECTION_FAILED'); }, 30); return; }
        ok(); }, 60); },
    getDuration: function(){ return url.indexOf('m3u8') > 0 ? dur - (+(/offset=(\\d+)/.exec(url)||[0,0])[1]) * 1000 : dur; },
    play: function(){ rec('play'); run(); }, pause: function(){ rec('pause'); clearInterval(timer); },
    seekTo: function(ms, ok){ rec('seek', ms); t = ms; l && l.oncurrentplaytime(t); ok && ok(); },
    stop: function(){ clearInterval(timer); }, close: function(){ rec('close'); },
    getTotalTrackInfo: function(){ var t = [{type:'AUDIO', index:1},{type:'AUDIO', index:2}]; if (!window.__noText) t.push({type:'TEXT', index:3, extra_info:'{"track_lang":"ar"}'}); return t; },
    setSelectTrack: function(k,i){ rec('track', k, i); }, setSilentSubtitle: function(){}
  };
  window.__avjump = function(ms){ t = ms; l && l.oncurrentplaytime(t); };
})();
"""

EP = lambda key, idx, title, res='4k', part=9001, viewed=0, lang='eng': {
    'ratingKey': key, 'key': '/library/metadata/' + key, 'type': 'episode', 'title': title, 'grandparentTitle': 'Harbour Lights',
    'index': idx, 'parentIndex': 1, 'lastViewedAt': viewed, 'viewOffset': 1380000 if viewed else 0, 'parentRatingKey': 'S1', 'grandparentRatingKey': 'SH', 'duration': 3300000, 'thumb': '/art/1',
    'Media': [{'videoResolution': res, 'videoCodec': 'hevc', 'bitrate': 42000 if res == '4k' else 10400, 'Part': [{'id': part, 'key': '/library/parts/%d/123/file.mkv' % part, 'indexes': 'sd', 'Stream': [
        {'streamType': 1, 'codec': 'hevc', 'DOVIPresent': True},
        {'id': 11, 'streamType': 2, 'codec': 'truehd', 'languageCode': lang, 'displayTitle': 'English (TrueHD Atmos 7.1)', 'selected': True},
        {'id': 12, 'streamType': 2, 'codec': 'eac3', 'languageCode': 'eng', 'displayTitle': 'English (Dolby Digital Plus 5.1)'},
        {'id': 21, 'streamType': 3, 'codec': 'srt', 'languageCode': 'ara', 'displayTitle': 'Arabic (SRT)', 'selected': True},
        {'id': 23, 'streamType': 3, 'codec': 'srt', 'languageCode': 'ara', 'displayTitle': 'Arabic (SRT)', 'forced': True},
        {'id': 22, 'streamType': 3, 'codec': 'pgs', 'languageCode': 'eng', 'displayTitle': 'English (PGS)'}]}]}],
    'Marker': [{'type': 'intro', 'startTimeOffset': 0, 'endTimeOffset': 90000}, {'type': 'credits', 'startTimeOffset': 3200000, 'endTimeOffset': 3300000}]}
SRT = "1\n00:22:58,000 --> 00:23:40,000\nلا تلتفت إلى الوراء\n\n2\n00:23:41,000 --> 00:23:50,000\nسطر ثانٍ\n"


async def main():
    APP, ASSETS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(OUT, exist_ok=True)
    threading.Thread(target=g['serve'], daemon=True).start()
    hits, results, plexapp, subsmode = [], [], {'moved': 0}, {'master': 'text'}
    check = lambda n, ok, info='': results.append((n, bool(ok), info))
    # two copies of the same episode: 102 (4K, watched last) and 202 (1080p)
    items = [dict(x, guid='plex://' + x['ratingKey']) for x in g['PLEX_ITEMS']]
    for x in items:
        if x['ratingKey'] == '102': x.update({'lastViewedAt': 200, 'viewOffset': 1380000, 'Media': [{'videoResolution': '4k'}], 'index': 3, 'parentIndex': 1})
    ep102 = [x for x in items if x['ratingKey'] == '102'][0]
    items.append(dict(ep102, ratingKey='202', key='/library/metadata/202', lastViewedAt=100, viewOffset=600000, Media=[{'videoResolution': '1080'}]))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080}, timezone_id='Asia/Riyadh')
        await g['install_routes'](ctx, {'polls': 0, 'photo': 0})

        async def pms(route):
            u = urllib.parse.urlparse(route.request.url); path = u.path
            hits.append(route.request.method + ' ' + path + '?' + u.query)
            if path.startswith('/hubs/continueWatching'):
                await route.fulfill(json={'MediaContainer': {'Hub': [{'hubIdentifier': 'continueWatching', 'Metadata': items}]}}); return
            if path == '/library/metadata/102':
                m = EP('102', 3, 'Low Tide', '4k', 9001, 200); m['viewOffset'] += plexapp['moved']
                await route.fulfill(json={'MediaContainer': {'Metadata': [m]}}); return
            if path == '/library/metadata/202':
                await route.fulfill(json={'MediaContainer': {'Metadata': [EP('202', 3, 'Low Tide', '1080', 9002, 100)]}}); return
            if path == '/library/metadata/103':
                await route.fulfill(json={'MediaContainer': {'Metadata': [EP('103', 4, 'High Water')]}}); return
            if path in ('/library/metadata/401', '/library/metadata/402', '/library/metadata/403'):
                m = EP(path.split('/')[-1], 1, 'Subtitled')
                m['Media'][0]['Part'][0]['Stream'] = [{'streamType': 1, 'codec': 'h264'}, {'id': 12, 'streamType': 2, 'codec': 'eac3', 'languageCode': 'eng', 'displayTitle': 'English', 'selected': True},
                    {'id': 41, 'streamType': 3, 'codec': 'ass', 'languageCode': 'eng', 'displayTitle': 'English (ASS)', 'selected': True}]
                m['Media'][0]['videoResolution'] = '1080'
                if subsmode.get('added') and path.endswith('/403'):
                    m['Media'][0]['Part'][0]['Stream'].append({'id': 55, 'key': '/library/streams/55', 'streamType': 3, 'codec': 'srt', 'languageCode': 'ara', 'displayTitle': 'Arabic (SRT External)'})
                await route.fulfill(json={'MediaContainer': {'Metadata': [m]}}); return
            if path == '/video/:/transcode/universal/decision':
                if subsmode['master'] == 'refuse':
                    await route.fulfill(json={'MediaContainer': {'generalDecisionCode': 2000, 'generalDecisionText': 'Transcoding is disabled by the server admin'}}); return
                await route.fulfill(json={'MediaContainer': {'generalDecisionCode': 1001, 'generalDecisionText': 'Direct Stream'}}); return
            if path == '/library/metadata/403/subtitles' and route.request.method == 'GET':
                await route.fulfill(json={'MediaContainer': {'Stream': [{'key': '/subtitles/os/777', 'codec': 'srt', 'languageCode': 'ara', 'displayTitle': 'Arabic (SRT)', 'providerTitle': 'OpenSubtitles'}]}}); return
            if path == '/library/metadata/403/subtitles' and route.request.method == 'PUT':
                subsmode['added'] = True; await route.fulfill(status=200, body=''); return
            if path == '/library/streams/55':
                await route.fulfill(body='1\n00:00:00,000 --> 02:00:00,000\nمرحبا من الإنترنت\n', content_type='text/plain; charset=utf-8'); return
            if path == '/library/streams/41':
                await route.fulfill(status=404, body=''); return
            if path == '/video/:/transcode/universal/start.m3u8':
                if subsmode['master'] == 'refuse':
                    await route.fulfill(status=400, body=''); return
                if subsmode['master'] == 'text':
                    await route.fulfill(body='#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="session/abc/subs.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=8000000,SUBTITLES="subs"\nsession/abc/base/index.m3u8\n', content_type='application/vnd.apple.mpegurl'); return
                await route.fulfill(body='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=8000000\nsession/abc/base/index.m3u8\n', content_type='application/vnd.apple.mpegurl'); return
            if path.endswith('/session/abc/subs.m3u8'):
                await route.fulfill(body='#EXTM3U\n#EXT-X-TARGETDURATION:60\n#EXTINF:60,\nseg0.vtt\n', content_type='application/vnd.apple.mpegurl'); return
            if path.endswith('/session/abc/seg0.vtt'):
                await route.fulfill(body='WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000\n\n00:00:01.000 --> 00:59:00.000\nHello from the server\n', content_type='text/vtt'); return
            if path == '/library/metadata/SH/children':
                await route.fulfill(json={'MediaContainer': {'Metadata': [{'ratingKey': 'S1', 'type': 'season', 'index': 1, 'title': 'Season 1'}, {'ratingKey': 'S2', 'type': 'season', 'index': 2, 'title': 'Season 2'}]}}); return
            if path == '/library/metadata/301':
                await route.fulfill(json={'MediaContainer': {'Metadata': [dict(EP('301', 1, 'New Moon'), parentRatingKey='S2', parentIndex=2)]}}); return
            if path == '/library/metadata/S2/children':
                await route.fulfill(json={'MediaContainer': {'Metadata': [dict(EP('301', 1, 'New Moon'), ratingKey='301', parentRatingKey='S2', parentIndex=2)]}}); return
            if path == '/library/metadata/S1/children':
                await route.fulfill(json={'MediaContainer': {'Metadata': [EP('102', 3, 'Low Tide'), EP('103', 4, 'High Water')]}}); return
            if path == '/library/streams/21':
                await route.fulfill(body=SRT, content_type='text/plain; charset=utf-8'); return
            if path.startswith('/photo') or '/indexes/' in path:
                await route.fulfill(path=os.path.join(ASSETS, 'posters', 'p1.jpg')); return
            await route.fulfill(json={})
        await ctx.unroute('http://192.168.1.20:32400/**')
        await ctx.route('http://192.168.1.20:32400/**', pms)
        await ctx.add_init_script(g['MOCK_TV'])
        await ctx.add_init_script(AVPLAY)
        await ctx.add_init_script("localStorage.setItem('plume.welcomed','1');localStorage.setItem('plume.plex', JSON.stringify({token:'usertoken',user:'Ali',server:{name:'Home Server',id:'abc123',uri:'http://192.168.1.20:32400',token:'srvtok'}}));")
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        ev = pg.evaluate
        async def key(k, wait=180): await pg.keyboard.press(k); await pg.wait_for_timeout(wait)
        async def shot(n): await pg.wait_for_timeout(300); await pg.screenshot(path=os.path.join(OUT, n + '.jpg'), type='jpeg', quality=84)

        await pg.goto(g['ORIGIN'] + '/index.html'); await pg.wait_for_timeout(2500)
        cards = await ev("P.Plex.items.map(c=>c.title+':'+c.copies.length)")
        check('one card per title, copies kept', 'Harbour Lights:2' in cards and len([c for c in cards if c.startswith('Harbour')]) == 1, cards)
        await ev("P.Home.focus('cw','cw:102')")
        await key('Enter', 1500)
        check('player opens', await ev("document.body.classList.contains('playing') && !!document.getElementById('player')"))
        av = await ev('window.__av')
        opened = [a for a in av if a[0] == 'open']
        check('plays the 4K copy directly', opened and '/library/parts/9001/' in opened[0][1] and 'm3u8' not in opened[0][1], opened[:1])
        check('TrueHD swapped for the DD+ track (no conversion)', await ev("P.Player && document.getElementById('plInfo') !== null"))
        check('resumes from your latest position', ['seek', 1380000] in av, [a for a in av if a[0] == 'seek'])
        check('4K mode set', ['prop', 'SET_MODE_4K', 'TRUE'] in av)
        await pg.wait_for_timeout(600)
        sub = await ev("document.getElementById('plSub').textContent")
        check('Arabic subtitle drawn', 'لا تلتفت' in sub, sub)
        await shot('p1-controls')
        await pg.wait_for_timeout(4600)
        check('controls hide after 4 s', not await ev("document.getElementById('player').classList.contains('ui-on')"))
        await shot('p2-playing')
        n0 = len([a for a in await ev('window.__av') if a[0] == 'seek'])
        for _ in range(3):
            await ev("(function(){var e=new KeyboardEvent('keydown',{bubbles:true}); Object.defineProperty(e,'keyCode',{get:function(){return 417}}); document.dispatchEvent(e);})()"); await pg.wait_for_timeout(80)
        await pg.wait_for_timeout(900)
        seeks = [a for a in await ev('window.__av') if a[0] == 'seek'][n0:]
        check('three +10 presses make one jump of 30 s', len(seeks) == 1, seeks)
        await key('ArrowDown')
        for _ in range(3): await key('ArrowLeft', 120)
        await key('Enter', 400)
        check('gear opens the panel', await ev("document.getElementById('plPanel').classList.contains('on')"))
        await shot('p3-panel')
        rows = await ev("[...document.querySelectorAll('#plPanel .pp-r span:first-child')].map(e=>e.textContent)")
        check('panel lists subtitles, audio, quality', 'Arabic (SRT)' in rows and 'English (Dolby Digital Plus 5.1)' in rows and '4K · 42 Mbps (Original)' in rows, rows)
        check('two Arabic tracks read differently', 'Arabic (SRT) · Forced' in rows, rows)
        check('quality steps only below this file', '4K · 40 Mbps' in rows and '1080p · 8 Mbps' in rows and not any('Original' in r for r in rows if r != '4K · 42 Mbps (Original)'), rows)
        check('one audio checkmark', await ev("[...document.querySelectorAll('#plPanel .pp-r')].filter(r=>r.lastChild.textContent).length") == 3)
        # pick English (PGS): picture subtitles -> the server burns them in
        await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 900)   # panel opens on Arabic; Arabic forced, then English (PGS)
        av = await ev('window.__av'); last = [a for a in av if a[0] == 'open'][-1][1]
        check('picture subtitles: converted stream with burn-in', 'start.m3u8' in last and 'subtitles=burn' in last, last[:160])
        check('subtitle choice saved to Plex', any(h.startswith('PUT /library/parts/9001') and 'subtitleStreamID=22' in h for h in hits))
        await key('Escape', 300)
        # info
        await key('ArrowLeft'); await key('ArrowLeft'); await key('ArrowLeft'); await key('ArrowRight'); await key('Enter', 300)
        check('info opens', await ev("document.getElementById('plInfo').classList.contains('on')"))
        await shot('p4-info')
        await key('Escape', 300)
        # credits -> up next
        await ev("window.__avjump(3201000 - P.Player.debug().base)")
        await pg.wait_for_timeout(1300)
        check('up next appears at the credits', await ev("document.getElementById('plNext').classList.contains('on')"))
        await shot('p5-upnext')
        await key('Enter', 1500)
        av = await ev('window.__av'); opened = [a for a in av if a[0] == 'open']
        check('Play now opens the next episode', any('/library/metadata/103' in h for h in hits), [h for h in hits if '103' in h][:2])
        # media keys
        await ev("(function(){var e=new KeyboardEvent('keydown',{bubbles:true}); Object.defineProperty(e,'keyCode',{get:function(){return 10252}}); document.dispatchEvent(e);})()")
        await pg.wait_for_timeout(300)
        check('Play/Pause button pauses', any(a[0] == 'pause' for a in await ev('window.__av')))
        # leave
        await key('Escape', 200); await key('Escape', 200); await key('Escape', 800)
        check('Back leaves the player', not await ev("document.body.classList.contains('playing')"))
        check('progress reported to Plex', any('/:/timeline' in h and 'state=stopped' in h for h in hits))
        check('position saved on the other copy too', any('/:/progress' in h and 'key=202' in h for h in hits))
        check('home screen still answers', (await ev("P.UI.top().name")) == 'home')
        # versions: hold OK lists both, pick 1080p, then a plain OK plays 1080p again (remembered)
        await ev("P.Home.focus('cw','cw:102')"); await pg.wait_for_timeout(200)
        await ev("P.Home.activate ? 0 : 0")
        await ev("(function(){var c=P.Plex.items.filter(x=>x.key=='102')[0]; P.Plex.versions(c).then(v=>window.__vs=v.map(x=>x.label));})()")
        await pg.wait_for_timeout(500)
        check('versions named by resolution', sorted(await ev('window.__vs')) == ['1080p', '4K'], await ev('window.__vs'))
        await ev("P.Plex.open(P.Plex.items.filter(x=>x.key=='102')[0], '202')"); await pg.wait_for_timeout(1500)
        last = [a for a in await ev('window.__av') if a[0] == 'open'][-1][1]
        check('picked version plays', '/library/parts/9002/' in last, last[:90])
        q = await ev("P.Player.debug().qualities.map(q=>q.label)")
        check('1080p version: its own Original and lower steps', q[0] == '1080p · 10.4 Mbps (Original)' and '1080p · 8 Mbps' in q and not any('4K' in x for x in q), q)
        await key('Escape', 200); await key('Escape', 5000)   # Plume keeps a snapshot a few seconds after you stop
        await ev("P.Plex.open(P.Plex.items.filter(x=>x.key=='102')[0])"); await pg.wait_for_timeout(1500)
        last = [a for a in await ev('window.__av') if a[0] == 'open'][-1][1]
        check('remembers the version you played last', '/library/parts/9002/' in last, last[:90])
        check('info says why', 'last played in Plume' in (await ev("P.Player.debug().versionLabel")), await ev("P.Player.debug().versionLabel"))
        await key('Escape', 200); await key('Escape', 5000)
        plexapp['moved'] = 600000   # you watched the 4K version 10 more minutes in the Plex app
        await ev("P.Plex.open(P.Plex.items.filter(x=>x.key=='102')[0])"); await pg.wait_for_timeout(1500)
        last = [a for a in await ev('window.__av') if a[0] == 'open'][-1][1]
        check('version watched in the Plex app plays', '/library/parts/9001/' in last and 'Plex app' in (await ev("P.Player.debug().versionLabel")), last[:90])
        check('...from where the Plex app stopped', ['seek', 1980000] in await ev('window.__av'))
        await key('Escape', 200); await key('Escape', 800)
        # a show's seasons and episodes: hold OK → Episodes
        await ev("P.Show.open(P.Plex.items.filter(x=>x.key=='102')[0])"); await pg.wait_for_timeout(1200)
        eps = await ev("[...document.querySelectorAll('#show .sh-ep .sh-t')].map(e=>e.textContent)")
        check('Episodes shows the season of the episode', eps[:2] == ['E3 · Low Tide', 'E4 · High Water'], eps)
        check('season tabs listed', await ev("document.querySelectorAll('#show .sh-tabs .day').length") == 2)
        await pg.screenshot(path=os.path.join(OUT, 'p7-episodes.jpg'), type='jpeg', quality=84)
        await key('ArrowUp'); await key('ArrowRight'); await key('Enter', 900)
        eps2 = await ev("[...document.querySelectorAll('#show .sh-ep .sh-t')].map(e=>e.textContent)")
        check('another season opens', eps2 == ['E1 · New Moon'], eps2)
        n0 = len([a for a in await ev('window.__av') if a[0] == 'open'])
        await key('Enter', 1500)
        check('OK plays the episode in Plume', await ev("document.body.classList.contains('playing')") and any('/library/metadata/301' in h for h in hits), [await ev("P.UI.top().name"), [h for h in hits if '301' in h][:3]])
        await key('Escape', 200); await key('Escape', 900)
        check('Back returns to the episodes', await ev("P.UI.top().name") == 'show')
        await key('Escape', 300)
        check('...and Back again to home', await ev("P.UI.top().name") == 'home')
        # hide in Plume only, back when watched again
        await ev("P.Plex.hide(P.Plex.items.filter(x=>x.key=='103' || x.title=='Northbound')[0] || P.Plex.items[0])")
        hidden = await ev("JSON.stringify(P.S.get('plexHidden').slice(-1))")
        check('hide keeps what to compare with', 'viewed' in hidden, hidden)
        # ASS reader: invisible marker, the file's own column order, two lines at once, a line at the top
        ass = '\ufeff[Script Info]\nTitle: x\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + \
              'Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,Hello, {\\i1}world{\\i0}\\Nsecond line\n' + \
              'Dialogue: 0,0:00:02.00,0:00:04.00,Sign,,0,0,0,,{\\an8}A sign\n' + \
              'Dialogue: 0,0:00:02.00,0:00:04.00,Draw,,0,0,0,,{\\p1}m 0 0 l 10 10{\\p0}\n'
        parsed = await ev("JSON.stringify(P.Player._parseSubs(%s))" % json.dumps(ass))
        check('ASS: read despite the hidden marker, two lines, top line, no shapes', '"t":"Hello, world\\nsecond line"' in parsed and '"top":true' in parsed and parsed.count('"a"') == 2, parsed)
        # embedded ASS the server won't hand over and the TV can't read: remux with text subtitles
        await ev("window.__noText = true")
        await ev("P.Plex.open({key:'401', title:'Subtitled', offset:0, copies:[]})"); await pg.wait_for_timeout(3500)
        av = await ev('window.__av'); last = [a for a in av if a[0] == 'open'][-1][1]
        check('embedded ASS: the server repackages and sends text', 'session/abc/base/index.m3u8' in last and any('subtitles=auto' in h for h in hits), last[:120])
        sub = await ev("document.getElementById('plSub').textContent")
        check('...and Plume draws them', 'Hello from the server' in sub, [sub, await ev("P.Player.debug().subHow")])
        await key('Escape', 200); await key('Escape', 900)
        # no text track from the server: drawn into the picture, automatically
        subsmode['master'] = 'none'
        await ev("P.Plex.open({key:'402', title:'Subtitled', offset:0, copies:[]})"); await pg.wait_for_timeout(3500)
        av = await ev('window.__av'); last = [a for a in av if a[0] == 'open'][-1][1]
        check('...else drawn into the picture by the server', 'subtitles=burn' in last, [last[:160], await ev("P.Player.debug() && P.Player.debug().subHow")])
        await key('Escape', 200); await key('Escape', 900)
        # your case: resume at 10:00, the server refuses both, the TV reports stale errors and the title's own time
        subsmode['master'] = 'refuse'
        await ev("window.__staleErrors = true; window.__failBurn = true; window.__absTime = true; window.__lastOffset = 600000")
        n0 = len(await ev('window.__av'))
        await ev("P.Plex.open({key:'403', title:'Subtitled', offset:600000, copies:[]})"); await pg.wait_for_timeout(5000)
        av = (await ev('window.__av'))[n0:]; opens = [a[1] for a in av if a[0] == 'open']
        st_ = await ev("(function(){var s=P.Player.debug();return s?{t:s.t,how:s.subHow,top:P.UI.top().name,direct:s.plan.direct}:{top:P.UI.top().name}})()")
        check('refused twice: keeps playing, no error box', st_.get('top') == 'player' and st_.get('direct') and opens and 'file.mkv' in opens[-1], [st_, [o[-60:] for o in opens]])
        check("...and says why in Info, in Plex's words", "Couldn't show them" in (st_.get('how') or '') and 'Plex says Transcoding is disabled by the server admin' in (st_.get('how') or ''), st_.get('how'))
        # Search subtitles online: pick one, the server adds it as a file, Plume draws it
        await ev("(function(){var s=P.Player.debug(); s.panel=true; document.getElementById('plPanel').classList.add('on');})()")
        await ev("P.Player.layer.key('ok')")   # opens nothing: the panel needs its row; go through the rows instead
        rows = await ev("[...document.querySelectorAll('#plPanel .pp-r span:first-child')].map(e=>e.textContent)")
        idx = rows.index('Search subtitles online…') if 'Search subtitles online…' in rows else -1
        check('gear panel offers Search subtitles online', idx >= 0, rows)
        await ev("(function(){var s=P.Player.debug(); s.pi=%d;})()" % max(idx, 0)); await ev("P.Player.layer.key('ok')"); await pg.wait_for_timeout(600)
        rows = await ev("[...document.querySelectorAll('#plPanel .pp-r span:first-child')].map(e=>e.textContent)")
        check('search lists what Plex found', 'Arabic (SRT) · OpenSubtitles' in rows, rows)
        await ev("(function(){var s=P.Player.debug(); s.pi=0;})()"); await ev("P.Player.layer.key('ok')"); await pg.wait_for_timeout(3500)
        sub = await ev("document.getElementById('plSub').textContent")
        check('picked one: added on the server and drawn by Plume', 'مرحبا' in sub and any(h.startswith('PUT /library/metadata/403/subtitles') for h in hits), [sub, await ev("P.Player.debug().subHow")])
        check('the clock stays right (no jumping)', 600000 <= st_.get('t', 0) <= 640000, st_.get('t'))
        await key('Escape', 200); await key('Escape', 900)
        # a remuxed stream that reports the title's own time: the clock still counts once
        subsmode['master'] = 'text'
        await ev("window.__failBurn = false")
        await ev("P.Plex.open({key:'403', title:'Subtitled', offset:600000, copies:[]})"); await pg.wait_for_timeout(4000)
        st2 = await ev("(function(){var s=P.Player.debug();return {t:s.t, mode:s.timeMode, how:s.subHow}})()")
        check('remuxed stream: clock counted once', 600000 <= st2['t'] <= 640000 and st2['mode'] == 'abs', st2)
        await key('Escape', 200); await key('Escape', 900)
        await ev("window.__staleErrors = false; window.__absTime = false")
        # sleep screen: a silent loop plays in Samsung's player, and stops on any button
        n0 = len(await ev('window.__av'))
        await ev("""tizen.filesystem = { copyFile: function(a, b, o, ok){ window.__copied = [a, b]; setTimeout(ok, 30); }, isFile: function(){ return false; },
            createDirectory: function(d, r, ok){ ok(); }, toURI: function(p){ return 'file:///opt/usr/home/owner/media/Downloads/Plume/keepawake-720.mp4'; } }""")
        await ev("window.__avReject = 1; P.Sleep.show()"); await pg.wait_for_timeout(1500)
        av = (await ev('window.__av'))[n0:]
        check('sleep screen plays the silent loop in Samsung\'s player', any(a[0] == 'open' and 'keepawake-720.mp4' in a[1] for a in av) and ['play'] in av, av[:4])
        check('sleep screen check reports it', 'playing since' in await ev("P.Sleep.check"), await ev("P.Sleep.check"))
        check('video copied to Downloads/Plume once', (await ev("window.__copied")) == ['wgt-package/img/keepawake-720.mp4', 'downloads/Plume/keepawake-720.mp4'] and 'Downloads: copied' in await ev("P.Sleep.check"))
        check('plays from Downloads', any(a[0] == 'refused' and a[1] == '/opt/usr/home/owner/media/Downloads/Plume/keepawake-720.mp4' for a in av), av[:3])
        check('a refused address: the next one is tried', 'try 1 refused' in await ev("P.Sleep.check") and '(try 2 [' in await ev("P.Sleep.check"), await ev("P.Sleep.check"))
        await key('ArrowLeft', 800)
        await ev("P.Sleep.showLog()"); await pg.wait_for_timeout(300)
        txt = await ev("document.querySelector('#dialog .body').textContent")
        await pg.screenshot(path=os.path.join(OUT, 'p6-sleepcheck.jpg'), type='jpeg', quality=84)
        check('OK shows the whole sleep check', 'Last button' in txt and 'playing since' in txt and 'until' in txt, txt)
        await key('Enter', 300)
        check('a button stops the loop', not await ev("P.Sleep.active") and ['close'] in (await ev('window.__av'))[n0:])
        await b.close()
    for n, ok, info in results:
        print(('PASS ' if ok else 'FAIL ') + n + (f'  [{info}]' if not ok and info else ''))
    print('errors:', errs or 'none')
    print(f"{sum(r[1] for r in results)}/{len(results)} passed")

asyncio.run(main())
