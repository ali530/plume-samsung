"""Run Plume in Chromium at 1920x1080 with a stand-in Samsung TV, football feed, Plex server and weather.
Usage: python3 harness.py <app dir> <assets dir> <out dir>
The assets dir holds abstract test icons, posters and badges (no real logos)."""
import asyncio, json, sys, os, datetime as dt, threading, http.server, functools, urllib.parse
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright

APP, ASSETS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
TZ = ZoneInfo('Asia/Riyadh')
NOW = dt.datetime.now(TZ)
TODAY = NOW.replace(hour=0, minute=0, second=0, microsecond=0)
PORT = 8765
ORIGIN = f'http://localhost:{PORT}'

def at(days, h, m):
    return (TODAY + dt.timedelta(days=days, hours=h, minutes=m)).astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')

TEAMS = {  # abbr: (id, name, short)
    'HIL': ('929', 'Al Hilal', 'Al Hilal'), 'NAS': ('2817', 'Al Nassr', 'Al Nassr'), 'ITT': ('2819', 'Al Ittihad', 'Al Ittihad'),
    'SAD': ('5051', 'Al Sadd', 'Al Sadd'), 'AHL': ('2818', 'Al Ahli', 'Al Ahli'), 'QAD': ('21017', 'Al Qadsiah', 'Al Qadsiah'),
    'SHA': ('2820', 'Al Shabab', 'Al Shabab'), 'ETT': ('2821', 'Al Ettifaq', 'Al Ettifaq'), 'TAA': ('2822', 'Al Taawoun', 'Al Taawoun'),
    'RMA': ('86', 'Real Madrid', 'Real Madrid'), 'MCI': ('382', 'Manchester City', 'Man City'), 'PSG': ('160', 'Paris Saint-Germain', 'PSG'),
    'ARS': ('359', 'Arsenal', 'Arsenal'), 'LIV': ('364', 'Liverpool', 'Liverpool'), 'CHE': ('363', 'Chelsea', 'Chelsea'),
    'MUN': ('360', 'Manchester United', 'Man United'), 'BRE': ('337', 'Brentford', 'Brentford'), 'BAR': ('83', 'Barcelona', 'Barcelona'),
    'SEV': ('243', 'Sevilla', 'Sevilla'), 'BAY': ('132', 'Bayern Munich', 'Bayern'), 'INT': ('110', 'Internazionale', 'Inter'),
    'ATM': ('1068', 'Atletico Madrid', 'Atletico'), 'VIL': ('102', 'Villarreal', 'Villarreal'),
    'KSA': ('655', 'Saudi Arabia', 'Saudi Arabia'), 'KUW': ('2595', 'Kuwait', 'Kuwait'),
}
def team(abbr):
    i, n, s = TEAMS[abbr]
    return {'id': i, 'displayName': n, 'shortDisplayName': s, 'abbreviation': abbr, 'color': '333333', 'logo': f'{ORIGIN}/testlogos/{abbr}.png'}

def ev(eid, h, a, when, state='pre', hs='0', as_='0', clock='', name='STATUS_SCHEDULED', detail='', goals=(), venue='', season=''):
    comps = [{'homeAway': 'home', 'score': hs, 'team': team(h)}, {'homeAway': 'away', 'score': as_, 'team': team(a)}]
    det = [{'scoringPlay': True, 'team': {'id': TEAMS[t][0]}, 'clock': {'displayValue': mn}, 'athletesInvolved': [{'displayName': who, 'shortName': who}]} for t, who, mn in goals]
    st = {'displayClock': clock, 'type': {'state': state, 'name': name, 'shortDetail': detail or ('FT' if state == 'post' else ''), 'completed': state == 'post'}}
    return {'id': str(eid), 'date': when, 'name': f'{a} at {h}', 'status': st, 'season': {'slug': season},
            'competitions': [{'competitors': comps, 'details': det, 'venue': {'fullName': venue}, 'status': st}]}

def feed():
    soon = (NOW + dt.timedelta(minutes=9)).astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
    return {
        'ksa.1': [ev(1, 'HIL', 'NAS', at(0, 21, 0), venue='Kingdom Arena'),
                  ev(2, 'SHA', 'ETT', at(-1, 19, 0), 'post', '1', '1', name='STATUS_FULL_TIME', goals=[('SHA', 'Carrasco', "34'"), ('ETT', 'Dembele', "77'")]),
                  ev(3, 'TAA', 'HIL', at(1, 19, 0), venue='King Abdullah Sport City Stadium'),
                  # a busy day: enough matches that the list has to slide
                  ev(4, 'ITT', 'TAA', at(0, 17, 0)), ev(5, 'AHL', 'ETT', at(0, 17, 30)), ev(6, 'QAD', 'SHA', at(0, 18, 0)),
                  ev(7, 'NAS', 'ETT', at(0, 18, 30)), ev(8, 'SHA', 'AHL', at(0, 19, 0))],
        'ksa.kings.cup': [ev(10, 'AHL', 'QAD', at(0, 0, 30) if NOW.hour >= 1 else at(0, 0, 0), 'post', '2', '1', name='STATUS_FULL_TIME',
                             goals=[('AHL', 'Toney', "18'"), ('QAD', 'Aubameyang', "52'"), ('AHL', 'Toney', "66'")], venue='King Abdullah Sports City')],
        'afc.champions': [ev(20, 'ITT', 'SAD', at(0, max(0, NOW.hour - 1), 0), 'in', '1', '0', clock="63'", name='STATUS_SECOND_HALF',
                             goals=[('ITT', 'Benzema', "41'")], venue='King Abdullah Sports City')],
        'global.gulf_cup': [ev(30, 'KSA', 'KUW', soon, venue='Al-Awal Park')],
        'uefa.champions': [ev(40, 'RMA', 'MCI', at(0, 22, 0), venue='Santiago Bernabeu', season='league-phase'),
                           ev(41, 'PSG', 'ARS', at(0, 22, 0), venue='Parc des Princes', season='league-phase'),
                           ev(42, 'BAY', 'INT', at(-1, 22, 0), 'post', '3', '2', name='STATUS_FULL_TIME', season='league-phase',
                              goals=[('BAY', 'Kane', "12'"), ('INT', 'Martinez', "30'"), ('BAY', 'Kane', "58'"), ('INT', 'Thuram', "70'"), ('BAY', 'Musiala', "81'")])],
        'eng.1': [ev(50, 'LIV', 'CHE', at(0, 22, 30), venue='Anfield'), ev(51, 'MUN', 'BRE', at(1, 17, 0), venue='Old Trafford')],
        'esp.1': [ev(60, 'BAR', 'SEV', at(0, 23, 0), venue='Spotify Camp Nou')],
    }

def standings(slug):
    if slug == 'ksa.1':
        order = ['HIL', 'ITT', 'NAS', 'AHL', 'QAD', 'TAA', 'ETT', 'SHA']
    elif slug == 'eng.1':
        order = ['LIV', 'ARS', 'MCI', 'CHE', 'MUN', 'BRE']
    else:
        order = ['RMA', 'BAR', 'ATM', 'VIL', 'SEV']
    entries = []
    for r, ab in enumerate(order, 1):
        i, n, s = TEAMS[ab]
        entries.append({'team': {'id': i, 'displayName': n, 'abbreviation': ab, 'logos': [{'href': f'{ORIGIN}/testlogos/{ab}.png'}]},
                        'stats': [{'name': 'rank', 'value': r}, {'name': 'gamesPlayed', 'value': 9}, {'name': 'points', 'value': 27 - r * 2},
                                  {'name': 'pointDifferential', 'value': 14 - r * 3}]})
    return {'children': [{'standings': {'entries': entries}}]}

PLEX_ITEMS = [
    {'ratingKey': '101', 'key': '/library/metadata/101', 'guid': 'plex://movie/ridge', 'lastViewedAt': 200, 'type': 'movie', 'title': 'The Long Ridge', 'duration': 8100000, 'viewOffset': 1100000, 'art': '/art/0'},
    {'ratingKey': '201', 'key': '/library/metadata/201', 'guid': 'plex://movie/ridge', 'lastViewedAt': 100, 'type': 'movie', 'title': 'The Long Ridge', 'duration': 8100000, 'viewOffset': 900000, 'art': '/art/0'},
    {'ratingKey': '102', 'key': '/library/metadata/102', 'type': 'episode', 'grandparentTitle': 'Harbour Lights', 'title': 'Low Tide', 'parentIndex': 1, 'index': 3, 'duration': 3300000, 'viewOffset': 1380000, 'thumb': '/art/1'},
    {'ratingKey': '103', 'key': '/library/metadata/103', 'type': 'episode', 'grandparentTitle': 'Northbound', 'grandparentRatingKey': 'NB', 'title': 'Chapter Eight', 'parentIndex': 2, 'index': 8, 'duration': 2700000, 'viewOffset': 2520000, 'thumb': '/art/2'},
    {'ratingKey': '104', 'key': '/library/metadata/104', 'type': 'episode', 'grandparentTitle': 'Field Notes', 'title': 'Pilot', 'parentIndex': 2, 'index': 7, 'duration': 2600000, 'viewOffset': 560000, 'thumb': '/art/3'},
    {'ratingKey': '105', 'key': '/library/metadata/105', 'type': 'movie', 'title': 'Sand and Stars', 'duration': 7600000, 'viewOffset': 900000, 'art': '/art/4'},
]

MOCK_TV = """
window.__calls = [];
(function(){
  var rec = function(n, a){ window.__calls.push([n].concat([].slice.call(a||[]))); };
  var icon = function(n){ return '%s/testicons/' + n + '.png'; };
  var APPS = [
    {id:'3201512006963', name:'Plex', iconPath: icon('plex'), show:true},
    {id:'111299001912', name:'YouTube', iconPath: icon('youtube'), show:true},
    {id:'3201907018807', name:'Netflix', iconPath: icon('netflix'), show:true},
    {id:'AbCdE12345.Shahid', name:'Shahid', iconPath: icon('shahid'), show:true},
    {id:'3201807016597', name:'Apple TV', iconPath: icon('appletv'), show:true},
    {id:'3201910019365', name:'Prime Video', iconPath: icon('prime'), show:true},
    {id:'3201606009684', name:'Spotify', iconPath: icon('spotify'), show:true},
    {id:'3201901017640', name:'Disney+', iconPath: icon('disney'), show:true},
    {id:'org.tizen.browser', name:'Internet', iconPath: icon('browser'), show:true},
    {id:'QwErTy9876.weather', name:'Weather Now', iconPath: icon('weather'), show:true},
    {id:'com.samsung.tv.csfs-daemon', name:'csfs-daemon', iconPath:'/usr/share/icons/default.png', show:false}
  ];
  function Ctl(op, uri, mime, cat, data){ this.operation = op; this.data = data; }
  function Data(k, v){ this.key = k; this.value = v; }
  window.tizen = {
    ApplicationControl: Ctl, ApplicationControlData: Data,
    application: {
      getAppsInfo: function(ok){ setTimeout(function(){ ok(APPS); }, 30); },
      launch: function(id, ok, err){ rec('launch', [id]); if (/^3|^111|^org|Shahid/.test(id)) ok && ok(); else err && err(new Error('nope')); },
      launchAppControl: function(ctl, id, ok){ rec('launchAppControl', [id, JSON.stringify(ctl.data)]); ok && ok(); },
      getCurrentApplication: function(){ return { hide: function(){ rec('hide'); }, exit: function(){ rec('exit'); } }; }
    },
    tvinputdevice: { getSupportedKeys: function(){ return [{name:'ColorF0Red'}]; }, registerKeyBatch: function(n){ rec('registerKeys', [n.join(',')]); } },
    systeminfo: { getPropertyValue: function(k, ok){ if (k === 'VIDEOSOURCE') ok({connected:[{type:'HDMI', number:1}, {type:'HDMI', number:2}]}); else ok({}); } },
    tvwindow: {
      setSource: function(src, ok){ rec('setSource', [src.type + src.number]); ok && ok(src); },
      show: function(ok){ rec('tvwindowShow'); ok && ok(); }, hide: function(ok){ rec('tvwindowHide'); ok && ok(); }
    }
  };
  window.webapis = { appcommon: { AppCommonScreenSaverState: {SCREEN_SAVER_ON:1, SCREEN_SAVER_OFF:0}, setScreenSaver: function(s){ rec('screensaver', [s]); } } };
})();
""" % ORIGIN


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def serve():
    h = functools.partial(Quiet, directory=APP)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h).serve_forever()


async def install_routes(ctx, state):
    data = feed()

    async def espn(route):
        u = urllib.parse.urlparse(route.request.url)
        parts = u.path.split('/')
        if 'standings' in u.path:
            slug = parts[-2]
            if slug == 'global.gulf_cup':
                grp = lambda name, abbrs: {'name': name, 'standings': {'entries': [{'team': {'id': TEAMS[a][0], 'displayName': TEAMS[a][1], 'abbreviation': a, 'logos': []},
                    'stats': [{'name': 'rank', 'value': i + 1}, {'name': 'gamesPlayed', 'value': 1}, {'name': 'points', 'value': 3 - i}, {'name': 'pointDifferential', 'value': 1 - i}]} for i, a in enumerate(abbrs)]}}
                await route.fulfill(json={'children': [grp('Group A', ['QAD', 'SHA']), grp('Group B', ['KSA', 'KUW'])]}); return
            if slug not in ('ksa.1', 'eng.1', 'esp.1'):
                await route.fulfill(json={}); return
            await route.fulfill(json=standings(slug)); return
        if u.path.endswith('/summary'):   # one match: stats, line-ups, events
            T = lambda a: {'id': TEAMS[a][0], 'displayName': TEAMS[a][1]}
            st = lambda a, pos, sh, on: {'team': T(a), 'statistics': [{'name': 'possessionPct', 'label': 'Possession', 'displayValue': pos}, {'name': 'totalShots', 'label': 'Shots', 'displayValue': sh}, {'name': 'shotsOnTarget', 'label': 'On target', 'displayValue': on}]}
            ros = lambda a, side, names: {'team': T(a), 'homeAway': side, 'roster': [{'starter': i < 11, 'jersey': str(i + 1), 'athlete': {'displayName': n}, 'position': {'abbreviation': 'M'}} for i, n in enumerate(names)]}
            await route.fulfill(json={'boxscore': {'teams': [st('QAD', '41', '9', '3'), st('AHL', '59', '15', '7')]},
                'rosters': [ros('AHL', 'home', ['Mendy', 'Ibañez', 'Demiral', 'Kessie', 'Mahrez', 'Firmino', 'Toney', 'Galeno', 'Majrashi', 'Hindi', 'Abdulhamid', 'Saint-Maximin']),
                            ros('QAD', 'away', ['Koen', 'Nacho', 'Otavio', 'Aubameyang', 'Quiñones', 'Carrasco', 'Bonsu', 'Al Fatil', 'Bakshi', 'Kadesh', 'Alhamdan'])],
                'keyEvents': [{'type': {'text': 'Goal'}, 'clock': {'displayValue': "18'"}, 'team': T('AHL'), 'participants': [{'athlete': {'displayName': 'Ivan Toney'}}]},
                              {'type': {'text': 'Yellow Card'}, 'clock': {'displayValue': "40'"}, 'team': T('QAD'), 'participants': [{'athlete': {'displayName': 'Nacho'}}]},
                              {'type': {'text': 'Goal'}, 'clock': {'displayValue': "52'"}, 'team': T('QAD'), 'participants': [{'athlete': {'displayName': 'Aubameyang'}}]}]}); return
        slug = parts[-2]
        await route.fulfill(json={'events': data.get(slug, [])})

    async def weather(route):
        await route.fulfill(json={'current': {'temperature_2m': 29.4, 'weather_code': 0, 'is_day': 1},
                                  'daily': {'sunrise': [TODAY.strftime('%Y-%m-%dT06:05'), (TODAY + dt.timedelta(days=1)).strftime('%Y-%m-%dT06:06')],
                                            'sunset': [TODAY.strftime('%Y-%m-%dT17:35'), (TODAY + dt.timedelta(days=1)).strftime('%Y-%m-%dT17:34')]}})

    async def plextv(route):
        u = route.request.url
        if u.endswith('/pins?strong=false'):
            await route.fulfill(json={'id': 42, 'code': 'X7KQ', 'expiresIn': 900}); return
        if '/pins/42' in u:
            state['polls'] += 1
            await route.fulfill(json={'id': 42, 'authToken': 'usertoken' if state['polls'] >= 2 else None}); return
        if u.endswith('/user'):
            await route.fulfill(json={'friendlyName': 'Ali'}); return
        if '/resources' in u:
            await route.fulfill(json=[{'name': 'Home Server', 'provides': 'server', 'owned': True, 'presence': True, 'accessToken': 'srvtok',
                                       'clientIdentifier': 'abc123', 'connections': [{'uri': 'http://192.168.1.20:32400', 'local': True, 'relay': False}]}]); return
        await route.fulfill(status=404, body='')

    async def pms(route):
        u = urllib.parse.urlparse(route.request.url)
        if u.path == '/identity':
            await route.fulfill(json={'MediaContainer': {}}); return
        if u.path.startswith('/hubs/continueWatching'):
            await route.fulfill(json={'MediaContainer': {'Hub': [{'hubIdentifier': 'continueWatching', 'Metadata': PLEX_ITEMS}]}}); return
        if u.path.startswith('/photo'):
            q = urllib.parse.parse_qs(u.query)
            n = q.get('url', ['/art/0'])[0].split('/')[-1]
            await route.fulfill(path=os.path.join(ASSETS, 'posters', f'p{n}.jpg')); return
        await route.fulfill(status=404, body='')

    async def unsplash(route):
        state['photo'] += 1
        await route.fulfill(path=os.path.join(APP, 'img', 'rockies-day.jpg' if state['photo'] % 2 else 'rockies-dusk.jpg'))

    async def local_assets(route):
        u = urllib.parse.urlparse(route.request.url)
        kind, name = u.path.strip('/').split('/', 1)
        folder = {'testicons': 'icons', 'testlogos': 'logos'}[kind]
        await route.fulfill(path=os.path.join(ASSETS, folder, name))

    await ctx.route('https://site.api.espn.com/**', espn)
    async def youtube(route):   # YouTube's search page, as a TV gets it
        yd = {'contents': {'twoColumnSearchResultsRenderer': {'primaryContents': {'sectionListRenderer': {'contents': [{'itemSectionRenderer': {'contents': [
            {'videoRenderer': {'videoId': 'OTHER00001', 'title': {'runs': [{'text': 'Al Ahli vs Al Qadsiah 2018 full match'}]}, 'ownerText': {'runs': [{'text': 'Random Uploads'}]}}},
            {'videoRenderer': {'videoId': 'THMANYAH01', 'title': {'runs': [{'text': 'ملخص المباراة: الأهلي ضد القادسية 2-1 | كأس الملك'}]}, 'ownerText': {'runs': [{'text': 'رياضة ثمانية'}]}}},
            {'videoRenderer': {'videoId': 'CLUBVID001', 'title': {'runs': [{'text': 'Al Ahli 2-1 Al Qadsiah | Highlights'}]}, 'ownerText': {'runs': [{'text': 'Al Ahli Saudi Club'}]}}}]}}]}}}}}
        await route.fulfill(body='<html><script>var ytInitialData = ' + json.dumps(yd) + ';</script></html>', content_type='text/html')
    await ctx.route('https://www.youtube.com/**', youtube)
    await ctx.route('https://api.open-meteo.com/**', weather)
    await ctx.route('https://plex.tv/**', plextv)
    await ctx.route('http://192.168.1.20:32400/**', pms)
    await ctx.route('https://images.unsplash.com/**', unsplash)
    await ctx.route(f'{ORIGIN}/testicons/**', local_assets)
    await ctx.route(f'{ORIGIN}/testlogos/**', local_assets)
    await ctx.route(f'{ORIGIN}/$WEBAPIS/**', lambda r: r.fulfill(body='', content_type='text/javascript'))


async def main():
    threading.Thread(target=serve, daemon=True).start()
    state = {'polls': 0, 'photo': 0}
    errors, results = [], []
    def check(name, ok, info=''):
        results.append((name, bool(ok), info))

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080}, timezone_id='Asia/Riyadh', locale='en-GB')
        await install_routes(ctx, state)
        await ctx.add_init_script(MOCK_TV)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        key = lambda k: pg.keyboard.press(k)
        async def shot(name):
            await pg.wait_for_timeout(450)
            await pg.screenshot(path=os.path.join(OUT, name + '.jpg'), type='jpeg', quality=86)
        async def hold():
            await pg.keyboard.down('Enter'); await pg.wait_for_timeout(750); await pg.keyboard.up('Enter')
        ev_ = lambda js: pg.evaluate(js)

        await pg.goto(ORIGIN + '/index.html')
        await pg.wait_for_timeout(1500)
        check('welcome dialog on first start', await ev_("!document.getElementById('dialog').hidden"))
        await shot('01-welcome')
        await key('Enter')                      # Connect Plex
        await pg.wait_for_timeout(700)
        check('sign-in code shown', await ev_("(document.getElementById('plexCode')||{}).textContent") == 'X7KQ')
        await shot('02-plex-code')
        await pg.wait_for_timeout(6500)         # two polls, then signed in
        check('signed in, dialog closed', await ev_("document.getElementById('dialog').hidden"))
        check('continue watching filled, 1080p/4K copy shown once', await ev_("document.querySelectorAll('#cwRow .cwcard:not(.note)').length") == 5)
        check('the copy watched last is kept', await ev_("P.Plex.items[0].key") == '101')
        await pg.wait_for_timeout(1200)
        check('app row order', await ev_("[...document.querySelectorAll('#appRow .tile')].map(t=>t.dataset.key).join(',')")
              == 'hdmi:ps5,hdmi:bein,app:plex,matches,app:youtube,app:netflix,app:shahid,app:appletv')
        check('logos turned into marks', await ev_("document.querySelectorAll('#appRow .mark').length") >= 5)
        check('strip shows live match', 'Al Ittihad' in (await ev_("document.getElementById('strip').textContent")))
        await shot('03-home-light')

        await key('ArrowUp'); await pg.wait_for_timeout(200)
        check('up from apps reaches the strip', await ev_("document.getElementById('strip').classList.contains('focus')"))
        await shot('04-strip-focus')
        await key('Enter'); await pg.wait_for_timeout(300)
        check('OK on live strip switches to beIN (HDMI 2)', 'HDMI2' in json.dumps(await ev_('window.__calls')))
        await key('Escape'); await pg.wait_for_timeout(200)   # back from the input to Plume
        await key('ArrowUp'); await pg.wait_for_timeout(150)
        check('up again reaches top icons', await ev_("document.querySelector('#icons .focus') !== null"))
        await key('ArrowDown'); await key('ArrowDown'); await pg.wait_for_timeout(150)

        # the football tile is the 4th tile
        await ev_("P.Home.focus('apps','matches')")
        await key('Enter'); await pg.wait_for_timeout(700)
        check('match centre open', await ev_("!document.getElementById('centre').hidden"))
        n_today = await ev_("document.querySelectorAll('#centre .mline').length")
        check('today: Barcelona v Sevilla hidden (big matches only)', 'Sevilla' not in await ev_("document.getElementById('centre').textContent"), n_today)
        side = {}
        for _ in range(14):
            t = await ev_("(document.querySelector('#centre .mline.focus .tn')||{}).textContent + '|' + (document.querySelector('#centre .t-head span')||{}).textContent")
            side[t.split('|')[0]] = t.split('|')[1]
            await key('ArrowDown'); await pg.wait_for_timeout(250)
        check('table follows the match: Premier League', side.get('Liverpool') == 'Premier League', side)
        check('cup without table shows its round', "King's Cup" in side.get('Al Ahli', ''), side)
        # quick presses: none dropped, the list slides, focus stays on the match through a live refresh
        await ev_("P.Centre.zone='list';P.Centre.at=0;P.Centre.focusId=P.Centre.list()[0].id;P.Centre.render()"); await pg.wait_for_timeout(200)
        n = await ev_("P.Centre.list().length")
        for _ in range(5): await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(40)
        await pg.wait_for_timeout(400)
        check('five quick presses move five matches', await ev_("P.Centre.at") == min(5, n - 1), [await ev_("P.Centre.at"), n])
        fid = await ev_("P.Centre.focusId")
        await ev_("P.bus.emit('football')"); await pg.wait_for_timeout(200)
        check('focus stays on the same match after a refresh', await ev_("P.Centre.list()[P.Centre.at].id") == fid)
        check('the list slides instead of jumping', 'translate3d' in (await ev_("document.getElementById('cTrack').style.transform") or '') or n <= 6, await ev_("document.getElementById('cTrack').style.transform"))
        # Down always goes to the next row on screen (the list is grouped by competition)
        await ev_("P.Centre.zone='list';P.Centre.at=0;P.Centre.focusId=null;P.Centre.render()"); await pg.wait_for_timeout(200)
        order_ok, seen = True, []
        rows = await ev_("document.querySelectorAll('#cList .mline').length")
        for i in range(rows - 1):
            await key('ArrowDown'); await pg.wait_for_timeout(120)
            pos = await ev_("[...document.querySelectorAll('#cList .mline')].findIndex(e=>e.classList.contains('focus'))")
            seen.append(pos)
            if pos != i + 1: order_ok = False
        check('Down goes to the next row on screen, every time', order_ok, seen)
        # a live update while you're down the list: the list must not move
        await ev_("P.Centre.zone='list';var ms=P.Centre.list();P.Centre.at=ms.length-1;P.Centre.focusId=ms[ms.length-1].id;P.Centre.render()"); await pg.wait_for_timeout(500)
        y0 = await ev_("document.getElementById('cTrack').style.transform")
        await ev_("(function(){var m=P.Centre.list().filter(x=>x.state=='in')[0]; m.clock=\"64'\"; m.detail=\"64'\"; P.bus.emit('football');})()")
        y1 = await ev_("document.getElementById('cTrack').style.transform")
        await pg.wait_for_timeout(60)
        y2 = await ev_("(function(){var t=document.getElementById('cTrack');return getComputedStyle(t).transform})()")
        y3 = await ev_("(function(){var t=document.getElementById('cTrack');return t.style.transform})()")
        check('live update: the list stays where it is', y1 == y0 and y3 == y0 and 'matrix' in y2 or y0 in ('', 'none'), [y0, y1, y2, y3])
        # highlights: the finder ranks the broadcaster first, the club next, and leaves out other matches
        rank = await ev_("""(function(){var H=P.Highlights, m={comp:'spl', date:new Date(Date.now()-5*3600e3), home:{name:'Al Ahli Saudi', short:'Al Ahli', score:'4'}, away:{name:'Al Khaleej', short:'Al Khaleej', score:'1'}};
            var t=function(title,ch,at){var j=H._judge({title:title,channel:ch,at:at||0},m);return j?j.tier:0};
            return [t('ملخص المباراة: الأهلي ضد الخليج 4-1 | الجولة 11 من دوري روشن السعودي','رياضة ثمانية'), t('Al Ahli 4-1 Al Khaleej | Highlights','Al Ahli Saudi Club'),
                    t('Al Ahli 4-1 Al Khaleej goals','Some Fan'), t('Al Ahli vs Al Khaleej full match','Some Fan'), t('Al Hilal 4-1 Al Nassr highlights','رياضة ثمانية'),
                    t('ملخص الأهلي والخليج 4-1','رياضة ثمانية', Date.now()-400*86400e3)]})()""")
        check('highlights ranking: broadcaster 1, club 2, any 3; full match, other teams, old meetings left out', rank == [1, 2, 3, 0, 0, 0], rank)
        mu = await ev_("(function(){var m={comp:'ucl', date:new Date(Date.now()-3600e3), home:{name:'Como', short:'Como', score:'4'}, away:{name:'Manchester United', short:'Man United', score:'1'}}; var j=P.Highlights._judge({title:'Como 4-1 Man Utd | Highlights', channel:'Manchester United', at:Date.now()}, m); return j && j.tier})()")
        check('club titles with short names: Como 4-1 Man Utd', mu == 2, mu)
        # a finished match: OK offers highlights, details and the table
        await ev_("(function(){var ms=P.Centre.list();var i=ms.findIndex(m=>m.state=='post');P.Centre.zone='list';P.Centre.at=i;P.Centre.focusId=ms[i].id;P.Centre.render();})()"); await pg.wait_for_timeout(300)
        await key('Enter'); await pg.wait_for_timeout(300)
        opts = await ev_("[...document.querySelectorAll('#dialog .mrow span')].map(e=>e.textContent)")
        check('finished match: Watch highlights, Match details, Whole table', opts == ['Watch highlights', 'Match details', 'Whole table'], opts)
        await key('Enter'); await pg.wait_for_timeout(1500)
        vids = await ev_("[...document.querySelectorAll('#dialog .mrow span')].map(e=>e.textContent)")
        check('highlights found, Thmanyah first, the full match from 2018 left out', len(vids) == 2 and vids[0].startswith('ملخص المباراة') and 'best match' in vids[0], vids)
        await shot('05c-highlights')
        await key('Enter'); await pg.wait_for_timeout(300)
        calls = await ev_("JSON.stringify(window.__calls.filter(c=>c[0]=='launchAppControl').slice(-1))")
        check('opens that video in the YouTube app', 'THMANYAH01' in calls, calls)
        await ev_("(function(){var ms=P.Centre.list();var i=ms.findIndex(m=>m.state=='post');P.Centre.zone='list';P.Centre.at=i;P.Centre.focusId=ms[i].id;P.Centre.render();})()"); await pg.wait_for_timeout(300)
        await key('Enter'); await pg.wait_for_timeout(300)
        await key('ArrowDown'); await key('Enter'); await pg.wait_for_timeout(900)
        det = await ev_("(document.getElementById('cFull')||{}).textContent||''")
        check('Match details: stats, timeline and line-ups', 'Possession' in det and 'Ivan Toney' in det and 'Substitutes' in det and 'Saint-Maximin' in det, det[:200])
        await shot('05d-match-details')
        await key('Escape'); await pg.wait_for_timeout(200)
        # the table: Right focuses it, OK opens the whole table and the coming matches
        await ev_("(function(){var ms=P.Centre.list();var i=ms.findIndex(m=>m.comp=='spl');P.Centre.zone='list';P.Centre.at=i<0?0:i;P.Centre.focusId=ms[P.Centre.at].id;P.Centre.render();})()"); await pg.wait_for_timeout(300)
        await key('ArrowRight'); await pg.wait_for_timeout(200)
        check('Right focuses the table', await ev_("P.Centre.zone == 'table' && !!document.querySelector('#cSide .c-table.focus')"))
        await key('Enter'); await pg.wait_for_timeout(1500)
        rows = await ev_("document.querySelectorAll('#fc0 .t-row').length")
        fx = await ev_("document.querySelectorAll('#fc1 .t-row').length")
        check('OK shows the whole table', rows >= 8, rows)
        check('...and the coming matches', fx >= 1, await ev_("document.getElementById('fc1').textContent.slice(0,120)"))
        await shot('05b-full-table')
        await key('ArrowRight'); await key('ArrowDown'); await pg.wait_for_timeout(200)
        check('Right moves to the coming matches', await ev_("document.getElementById('fc1').classList.contains('focus')"), await ev_("JSON.stringify([P.Centre.full && P.Centre.full.col, P.UI.top().name, !!document.getElementById('fc1')])"))
        await key('Escape'); await pg.wait_for_timeout(200)
        check('Back closes it', await ev_("!document.getElementById('cFull') && P.Centre.isOpen()"))
        await key('ArrowLeft'); await pg.wait_for_timeout(150)
        check('tournament shows the right group', side.get('Saudi Arabia') == 'Arabian Gulf Cup · Group B', side)
        for _ in range(9): await key('ArrowUp')
        await key('ArrowDown'); await key('ArrowDown'); await pg.wait_for_timeout(300)
        await shot('05-match-centre')
        for _ in range(6): await key('ArrowUp')
        await key('ArrowLeft'); await key('Enter'); await pg.wait_for_timeout(400)
        check('yesterday tab shows results', 'Bayern' in await ev_("document.getElementById('centre').textContent"))
        await key('ArrowDown'); await key('ArrowDown'); await pg.wait_for_timeout(250)
        await shot('06-match-centre-yesterday')
        await key('Escape'); await pg.wait_for_timeout(300)
        check('centre closed with Back', await ev_("document.getElementById('centre').hidden"))

        # hold OK on a tile: menu, then move
        await ev_("P.Home.focus('apps','app:youtube')")
        await hold(); await pg.wait_for_timeout(300)
        check('hold OK opens menu', await ev_("document.querySelector('#dialog .menu') !== null"))
        await shot('07-tile-menu')
        await key('Enter'); await pg.wait_for_timeout(200)   # Move
        await key('ArrowLeft'); await key('Enter'); await pg.wait_for_timeout(300)
        order = await ev_("P.S.get('row').join(',')")
        check('move swaps YouTube with Matches', order.index('app:youtube') < order.index('matches'), order)

        # PS5 tile: the input opens inside Plume (even if an old setting said otherwise)
        await ev_("window.__calls=[]; P.S.set('hdmiMethod','exit'); P.Home.focus('apps','hdmi:ps5')")
        await key('Enter'); await pg.wait_for_timeout(300)
        calls = json.dumps(await ev_('window.__calls'))
        check('PS5: HDMI1 shown inside Plume', 'HDMI1' in calls and 'tvwindowShow' in calls and 'tv-viewer' not in calls, calls)
        await key('Escape'); await pg.wait_for_timeout(200)

        # the other method: show the input inside Plume, Back returns
        await ev_("window.__calls=[]; P.S.set('hdmiMethod','inside'); P.Home.focus('apps','hdmi:bein')")
        await key('Enter'); await pg.wait_for_timeout(300)
        inside = await ev_("document.body.classList.contains('input-on')")
        await key('Escape'); await pg.wait_for_timeout(200)
        check('inside method shows beIN, Back returns', inside and not await ev_("document.body.classList.contains('input-on')")
              and 'tvwindowHide' in json.dumps(await ev_('window.__calls')))
        await ev_("P.S.set('hdmiMethod','exit')")

        # Plex card opens Plex
        await ev_("window.__calls=[]; P.Home.focus('cw')")
        await key('Enter'); await pg.wait_for_timeout(300)
        check('Plex card opens Plex', '3201512006963' in json.dumps(await ev_('window.__calls')))

        # settings
        await ev_("P.Settings.open()"); await pg.wait_for_timeout(500)
        await shot('08-settings')
        for _ in range(7): await key('ArrowDown')
        await pg.wait_for_timeout(300)
        label = await ev_("document.querySelector('#settings .s-row.focus .lab').textContent")
        check('settings row focus', label == 'Matches row on home', label)
        await key('Enter'); await pg.wait_for_timeout(200)
        await key('Escape'); await pg.wait_for_timeout(500)
        check('matches row shown when switched on', await ev_("!document.getElementById('matchSec').hidden"))
        await ev_("P.Home.focus('apps','app:plex')")
        await shot('09-home-matches-row')
        await key('ArrowDown'); await pg.wait_for_timeout(200)
        # match alerts: a goal in a watched match pops up, also over an HDMI input shown inside Plume
        await ev_("""(function(){var m=P.Football.day(0).filter(x=>x.state=='in')[0]; if(!P.Football.hasReminder(m)) P.Football.toggleReminder(m);
            P.Alerts.check(); m.home.score=String((+m.home.score||0)+1); m.goals.push({side:'home',who:'Benzema',min:"70'"});
            document.body.classList.add('input-on'); P.Alerts.check();})()""")
        await pg.wait_for_timeout(700)
        txt = await ev_("(document.getElementById('alert')||{}).textContent||''")
        check('goal alert pops up', 'Goal' in txt and 'Benzema' in txt and '2 – 0' in txt, txt)
        check('...over the HDMI view, without taking the remote', await ev_("getComputedStyle(document.getElementById('alert')).visibility=='visible' && P.UI.top().name != 'alert'"))
        await shot('09d-goal-alert')
        await ev_("document.body.classList.remove('input-on')")
        await ev_("(function(){var m=P.Football.day(0).filter(x=>x.state=='in')[0]; if(P.Football.hasReminder(m)) P.Football.toggleReminder(m);})()")   # tidy up: no reminder banner later
        check('down from apps reaches the matches title', (await ev_("P.Home.row")) == 'matchesH')
        await key('ArrowDown'); await pg.wait_for_timeout(200)
        check('...then the matches row', (await ev_("P.Home.row")) == 'matches')
        # folding: Up to the title, OK folds the row, OK again opens it; remembered
        await key('ArrowUp'); await key('Enter'); await pg.wait_for_timeout(300)
        check('OK on the title folds the row', await ev_("document.getElementById('matchSec').classList.contains('folded') && getComputedStyle(document.getElementById('matchRow')).display == 'none'"))
        await shot('09b-matches-folded')
        await key('ArrowDown'); await pg.wait_for_timeout(200)
        check('a folded row is skipped', (await ev_("P.Home.row")) == 'cwH', await ev_("P.Home.row"))
        await key('Enter'); await pg.wait_for_timeout(300)
        await shot('09c-both-folded')
        check('Continue Watching folds too, remembered', await ev_("document.getElementById('cwSec').classList.contains('folded') && P.S.get('folded').cw && P.S.get('folded').matches"))
        await key('Enter'); await key('ArrowUp'); await key('Enter'); await pg.wait_for_timeout(300)
        check('OK again opens them', await ev_("!document.querySelector('.sec.folded')"), await ev_("JSON.stringify([P.Home.row, P.UI.top().name, P.S.get('folded'), document.querySelector('#dialog .menu-title') && document.querySelector('#dialog .menu-title').textContent])"))
        await ev_("P.Home.focus('matches')")
        await ev_("P.S.set('matchesRow', false)")

        # all apps
        await ev_("P.AllApps.open()"); await pg.wait_for_timeout(500)
        check('all apps lists TV apps', await ev_("document.querySelectorAll('.aa-cell').length") >= 12)
        await key('ArrowRight'); await key('ArrowRight')
        await shot('10-all-apps')
        await key('Escape'); await pg.wait_for_timeout(200)

        # dark + colour logos
        await ev_("P.S.set('theme','dark'); P.S.set('logos','colour'); P.Home.focus('apps','app:netflix')")
        await pg.wait_for_timeout(1200)
        await shot('11-home-dark-colour')
        await ev_("P.S.set('logos','mono'); P.Home.focus('apps','app:plex')")
        await pg.wait_for_timeout(400)
        await shot('12-home-dark')

        # reminder banner: the Gulf Cup match kicks off in 9 minutes
        m = await ev_("(function(){var m=P.Football.day(0).filter(function(x){return x.home.name==='Saudi Arabia'})[0]; P.Football.toggleReminder(m); P.checkReminders(); return !document.getElementById('banner').hidden;})()")
        check('reminder banner 10 min before kick-off', m)
        await pg.wait_for_timeout(500)
        await shot('13-reminder')
        await key('Escape'); await pg.wait_for_timeout(400)

        # sleep screen
        await ev_("P.Sleep.show()"); await pg.wait_for_timeout(3500)
        await shot('15-sleep-dark')
        await ev_("P.Sleep.hide()"); await pg.wait_for_timeout(800)
        await ev_("P.S.set('theme','light'); P.Sleep.show()"); await pg.wait_for_timeout(3500)
        check('sleep screen shows matches', await ev_("document.querySelectorAll('.z-m').length") >= 2)
        await shot('14-sleep')
        await key('ArrowDown'); await pg.wait_for_timeout(800)
        check('any key closes the sleep screen', not await ev_("P.Sleep.active"))
        # hide a whole show from Plume; Settings → Plex → Hidden brings it back
        await ev_("P.Plex.hideAll(P.Plex.items.filter(c=>c.title=='Northbound')[0])"); await pg.wait_for_timeout(300)
        await ev_("P.Plex.refresh()"); await pg.wait_for_timeout(1200)
        check('Hide this show: gone, also after a refresh', not await ev_("P.Plex.items.some(c=>c.title=='Northbound')") and await ev_("P.Plex.items.length") > 0)
        check('listed under Hidden', await ev_("P.Plex.hiddenList().map(h=>h.title+':'+h.kind).join()") == 'Northbound:show')
        await ev_("P.Plex.unhide(P.Plex.hiddenList()[0])"); await pg.wait_for_timeout(1200)
        check('OK in Hidden brings it back', await ev_("P.Plex.items.some(c=>c.title=='Northbound')"))
        check('no Plex/football errors', not await ev_("P.Football.error"))

        await b.close()

    for name, ok, info in results:
        print(('PASS ' if ok else 'FAIL ') + name + (f'  [{info}]' if info and not ok else ''))
    errs = [e for e in errors if 'favicon' not in e and '404 (File not found)' not in e]  # optional tile pictures
    print('errors:', errs if errs else 'none')
    print(f"{sum(1 for r in results if r[1])}/{len(results)} passed")

asyncio.run(main())
