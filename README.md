# Plume for Samsung

A calm, ad-free home screen for Samsung TVs (Tizen), built after
[Plume Launcher](https://github.com/aradhyas8/Plume_Launcher) for Android TV, with Plex and today's football added.
Made and tested on a Samsung **S90C** OLED (2023); it should run on Samsung TVs from about 2020 on.

![Home, light](screens/home-light.jpg)
![Home, dark](screens/home-dark.jpg)

## What's in it

- **Home screen:** clock (12- or 24-hour), date and weather, a mountain wallpaper (light, dark or automatic at sunset), one row of app logos, and Plex Continue Watching.
- **Wallpapers:** 24 mountain photos, one choice for both themes (Settings → Home screen → Wallpaper, with a light and dark preview). In dark mode a day photo is dimmed; the Rockies switch to their dusk photo; night photos (stars, moon) are for dark mode only. *A different mountain each day* goes through them. install.bat downloads the free Unsplash and Pexels photos once (`walls.ps1`, list in `walls.txt`) and packs them into Plume, so they change at once and work offline; one that couldn't be downloaded loads from the internet, or shows the Rockies.
- **Quick panel** (the first icon at the top right): tiles for Theme, Clock (12/24-hour), Wallpaper (OK: the next one), Sleep screen now, Match alerts and Language, and round buttons for the matches row on/off, Refresh (matches, Plex and weather), Matches, Samsung Home and Settings. No volume: the remote does that. Hold OK on a tile or button to move it or hide it. Settings → Home screen → *Quick panel* brings hidden ones back and has 13 more you can turn on: Wallpaper each day, Logos, App names, Continue Watching row, Sleep after, Subtitle style, Highlights play in, Resume watching, Next match, PS5, beIN, All apps, Plex app.
- **Network:** focus the Wi-Fi icon at the top right to see the network's name and signal. (Samsung doesn't let apps change the network.)
- **Match strip** under the date. It shows a live match with the score and minute, and rotates through matches when several are live (a match of one of your teams stays put). Before anything starts, it shows the next big match with a countdown. When the day's matches are over, it disappears. OK on a live match switches to beIN; on an upcoming one it sets a reminder.
- **App row:** the TV's own app icons turned into clean single-colour marks, or tinted in each app's colour. Hold OK on a tile to move it or remove it. **PS5** (HDMI 1) and **beIN** (HDMI 2) have their own tiles; the ports are set in Settings → Inputs. App names: on focus, always, or never.
- **Matches tile:** matches grouped by competition, with scorers, stadium and a countdown. Beside the list: the focused match's league table, group or cup round.
- **Competitions:** Saudi Pro League, King's Cup, AFC Champions League Elite and Two (matches with Saudi clubs), Club World Cup, Saudi Arabia's matches (World Cup qualifiers, Asian Cup, Gulf Cup, friendlies), and the Premier League, La Liga and Champions League (all matches).
- **Your teams:** chosen in Settings → Football (it starts with Al Hilal, Saudi Arabia and Manchester United). Their matches always show and come first. Competitions can be switched on and off there too.
- **Match alerts:** kick-off, goals (with the scorer), red cards, half time, second half, missed or saved penalties and full time, each switched on or off in Settings → Football → *Match alerts*. Choose which matches: your teams, matches you follow or set a reminder for, all big matches, or every match of chosen competitions. To follow any match, even one that's already live: OK on it in Matches → *Follow*. Alerts pop up over anything Plume shows, the PS5 and beIN included, and never take the remote. Over a film in Plume they wait, or show small in the corner if you switch that on. Live scores refresh every 25 seconds while an alerting match is on.
- **Matches page:** a strip of dates for the week: 3 days back and 3 ahead (Today first); each day loads when you open it. OK on a match opens a menu: *Match details* first (before, during and after the match: stats, goals, cards and changes, line-ups on a pitch from the team's formation; it refreshes itself during the match and when line-ups are due), then *Watch on beIN* (live), *Watch highlights* (finished) or *Remind me* (coming), *Follow* (alerts for that match, also once it's live), and *Whole table*.
- **Highlights:** searched on YouTube and ranked: the competition's broadcaster or league channel first (Thmanyah, beIN, Premier League, LaLiga, UEFA, AFC…), then the clubs' channels, then any channel; a video counts only if it was posted after kick-off and its title has the score or both teams. They play inside Plume (OK pauses, ◀ ▶ jump 10 s, Back closes) through a one-page player on GitHub Pages ([ali530/plume-player](https://github.com/ali530/plume-player)), because YouTube's embedded player only plays on a web page with a real address; a channel that allows its videos only on YouTube opens in the YouTube app, and the message says YouTube's reason.
- **League page** (Right on the table beside the list, then OK): the whole table, and one list of results and coming matches two weeks each way, opening at today.
- **Reminders** pop up 10 minutes before kick-off while Plume is on screen. OK switches to beIN.
- **Sleep screen** after 1½ minutes idle (before an OLED's own protection screen at 2 minutes): drifting mountain and nature photos, a large clock with the date and weather, and up to three live or upcoming matches.
- **Plex player:** a Continue Watching card plays right where you stopped, inside Plume, with Samsung's own video player (4K, HDR10, Dolby Vision, Dolby Atmos). Settings and Info on the left, −10 / pause / +10 in the middle, Next episode on the right; Up for the progress bar (hold to speed up). Each episode starts with Plex's own choices for it: its subtitle track, its audio track and its Original quality. The gear lists that episode's subtitles and audio, its Original (resolution and bitrate) and the lower steps below it; changes are saved to Plex. Several presses of −10/+10 make one jump. When the bar comes back it's on Play/Pause, in the middle. With the bar hidden, ◀ ▶ go back or forward 10 s. Info shows just the video, audio and subtitles. The gear lists Arabic and English subtitles first; the other languages are under *More subtitles*. The next episode plays after a 10-second countdown, from the same version. Your position is saved to Plex on every version of the title. Info shows the version playing and how subtitles are shown.
- **Episodes:** hold OK on an episode in Continue Watching → *Episodes*: the show's seasons and episodes, with progress and watched marks. OK plays any episode in Plume's player.
- **Hide:** hold OK on a card. *Remove from Continue Watching* takes away that one title until it's watched again. *Hide this show* (or *movie*) keeps the whole show off Plume, including episodes watched later on another device using the same Plex account. Plex itself keeps everything. Settings → Plex → *Hidden* lists hidden shows and movies; OK brings one back.
- **Subtitle timing:** ⚙ → *Subtitle timing*, ◀ earlier / ▶ later by half a second, remembered per episode (for subtitles Plume draws). *Search subtitles online* lists the ones made for your exact file first.
- **Subtitles:** SRT and WebVTT are drawn by Plume as clear white lines. ASS subtitles keep their own fonts, colours, outlines, positions and movement (drawn by libass, in `vendor/libass`, with the fonts stored in the video file); Settings → Plex → *Subtitle style: Simple* draws them as white lines instead, and Plume falls back to plain lines by itself if the engine can't start. A subtitle stored inside the video comes from Plex on its own (no conversion), or else Plume reads its lines straight out of the MKV file (`js/subfile.js`): where you are first, then the rest of the episode in about half a minute, so skips never wait. The last 10 episodes' lines are kept on the TV, so an episode opened again shows them at once. Only then does the server convert. Info (ⓘ) says which way worked.
- **Versions** (4K and 1080p, or original and dubbed): one card plays the version you played last: if you watched a version further in the Plex app since you last stopped in Plume, that one; otherwise the one you played in Plume (with no history yet: the one furthest along, then 4K). Info shows which version is playing and why. Hold OK on the card to pick another version (*Play · 4K*, *Play · Arabic*, …); Plume remembers it. Settings → Plex → *Default quality*: Last played, 4K or 1080p (same language only).
- **Fold rows away:** press Up from the cards to reach a row's title (Continue Watching, or Today's matches when that row is on) and press OK to fold the row away; OK again opens it. Plume remembers it.
- **Smooth on the TV:** rows slide on the graphics chip, focus effects fade ready-made layers, posters load at the size shown, and a held arrow never builds up a backlog.
- **Settings** (gear icon): full screen over the blurred wallpaper, in groups: Apps, Inputs, Home screen, Sleep screen, Appearance, Language and Clock, Weather, Football, Plex, About. The left side shows a live preview of the focused group: a small home screen with your wallpaper, the sleep screen, your teams and the next big match, the clock in your format.

## Install (about 45 minutes the first time, a minute after that)

Plume isn't in Samsung's app store: you install it from a Windows PC with Samsung's free developer tools, on the same home network as the TV.

1. **Tizen Studio on the PC.** Download **Tizen Studio** (with IDE installer) from developer.tizen.org and install it in `C:\tizen-studio`. Open **Package Manager** → *Extension SDK* → install **Samsung Certificate Extension** and **TV Extensions**.
2. **Developer Mode on the TV.** On the TV open **Apps**, press **1 2 3 4 5** on the remote, turn **Developer mode** on, enter your PC's IP address, then restart the TV (hold the power button until it restarts).
3. **Connect the TV.** Tizen Studio → Tools → **Device Manager** → Remote Device Manager → **+** → any name, the TV's IP address (TV: Settings → General → Network → Network Status → IP Settings), port `26101` → Add → switch **Connection** on.
4. **A certificate for your TV.** Tizen Studio → Tools → **Certificate Manager** → **+** → **Samsung** → **TV** → give the profile a name → create a new author certificate (any name and password) → sign in with your Samsung account → in the distributor step, check that your TV's **DUID** is listed (it appears while the TV is connected) → Finish. Leave this profile **active** (the tick).
5. **Install.** Download this repository (**Code → Download ZIP**), unzip it somewhere outside OneDrive (for example `C:\Plume`), open the folder and double-click **install.bat**. It asks nothing: it uses the active certificate profile and the connected TV (or finds the TV on your network), remembers both in `install.cfg`, then packages, signs, installs and opens Plume.

To update later: replace the files with the new ones and double-click `install.bat` again. Your settings on the TV stay.

## YouTube key for highlights (optional, about 10 minutes, free)

Without a key Plume reads YouTube's plain search page, which YouTube sometimes blocks. With a key it uses YouTube's official search.

1. Go to **console.cloud.google.com** and sign in with a Google account.
2. At the top, **Select a project → New project**, name it `Plume`, **Create**, and select it.
3. **APIs & Services → Library**, search **YouTube Data API v3**, open it and press **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**. Copy the key (it starts with `AIza`).
5. Optional but wise: on that key, **Edit → API restrictions → Restrict key → YouTube Data API v3 → Save**.
6. Open `Plume\youtube-key.txt`, paste the key on its own line, save, and run `install.bat` again.

Settings → Football → *YouTube key for highlights* then shows **Set**. The free allowance (about 100 searches a day) is far more than needed; each finished match you open costs one or two searches, and results are remembered for a few hours.

## First run on the TV

- **Connect Plex:** Plume shows a code. On your phone, go to **plex.tv/link** (or scan the QR code) and enter it.
- **Put Plume first:** Home → highlight Plume → press Down → **Move** → first place.
- **Open with the TV:** Settings → General → Smart Features → turn on **Autorun Last App**, and turn off **Autorun Smart Hub**. Leave Plume open when you turn the TV off.
- **Inputs:** Plume has tiles for a PS5 (HDMI 1) and a beIN receiver (HDMI 2). Change the ports in Plume → Settings → Inputs, or remove the tiles from the row (hold OK on a tile).
- **Your own tile pictures:** app logos come from the TV itself. For any tile you can add your own picture to `Plume\img\tiles\`: `ps5.png`, `bein.png`, `matches.png`, or an app's name such as `youtube.png`, `disney.png`, `shahid.png`, `netflix.png` (a logo on a transparent background, 256 px or larger), then run `install.bat` again. The PS5, beIN, Matches, YouTube, Disney+ and Shahid pictures are included; the logos belong to their companies.

## Samsung limits

- Samsung doesn't let apps replace Smart Hub or the Home button. Plume is an app: put it first in the apps bar and use Autorun Last App.
- The sleep screen and reminders work only while Plume is on screen. Samsung OLEDs' own protection screen (the black screen with moving lights) comes 2 minutes after the last button press and ignores an app's request to hold it; only a playing video keeps it away. So while Plume's sleep screen is on, Samsung's own player plays a silent 720p black loop, copied once to the TV's Downloads/Plume folder (the player can't read files inside an app). Any button stops it. Tested on an S90C: no black screen.
- Apps have no direct "switch input" command. Plume shows the PS5 or beIN inside Plume, and Back returns to Plume. For the PS5, turn on Game Mode in the TV's picture menu if you notice lag.
- Plex: Samsung's Plex app can't be told to play a title from another app, so Plume plays it itself. If a title won't play here, Plume offers to open the Plex app instead. Lower qualities need your server to convert, which your provider may not allow.
- Closing an app opened from Plume should bring you back to Plume. Some Samsung apps don't allow that and go to Samsung's home; then press Home and pick Plume.
- Logos come from the TV's own app icons. If the TV won't let Plume read an icon, it shows the icon as it is (greyed in Mono mode).

## Privacy

No account, no ads, no tracking. Plume connects only to:
- **plex.tv** and your Plex server, for Continue Watching (Plume never sees your Plex password),
- **ESPN's public scoreboard feed**, for fixtures, scores and tables (unofficial: ESPN could change it at any time),
- **Open-Meteo**, for the weather of the city you pick,
- **Unsplash** and **Pexels**, for the sleep screen photos and the wallpapers you choose,
- **YouTube**, only when you ask for a match's highlights.

## Files

| | |
|---|---|
| `Plume/` | The TV app (HTML, CSS, JavaScript; no build step) |
| `Plume/js/` | `home.js` home screen · `football.js` feed and rules · `centre.js` match centre · `plex.js` · `apps.js` app row and logos · `settings.js` · `quick.js` quick panel · `walls.js` wallpapers · `sleep.js` · `tv.js` Samsung APIs |
| `install.bat` | Package, sign, install and open on the TV (Windows) |
| `tests/harness.py` | Runs Plume in a browser with a stand-in TV, feed and Plex server, and checks the remote-control flows |

## Credits

- Design after **Plume Launcher** by aradhyas8 (MIT).
- Wallpaper: "Canada" by Thomas Curryer, via Unsplash (CC0), as bundled with Plume Launcher.
- Sleep screen photos and wallpapers: Unsplash (Unsplash License) and Pexels (Pexels License), loaded at run time.
- Fonts: Inter, and IBM Plex Sans Arabic for Arabic (SIL Open Font License); Noto Sans Arabic for Arabic subtitles. QR codes: qrcode-generator by Kazuhiko Arase (MIT).
- Football data: ESPN. Weather: Open-Meteo. All trademarks belong to their owners.
