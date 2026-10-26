// Every piece of Plume's text that goes through P.t() needs an Arabic translation in js/ar.js.
// Usage: node i18n_check.js ../Plume
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(process.argv[2] || '../Plume', 'js');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'ar.js'), 'utf8'), ctx);
const AR = ctx.window.P.AR, RX = ctx.window.P.AR_RX;
const keys = new Set();
const lit = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'ar.js' && f !== 'i18n.js')) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  // P.t('…') and P.t(a ? '…' : '…')
  for (const m of s.matchAll(/P\.t\(([^()]*?)(?:,\s*\{|\))/g)) {
    for (const x of m[1].matchAll(lit)) {
      const k = (x[1] !== undefined ? x[1] : x[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (/[A-Za-z]/.test(k) && !/^(in|post|pre|episode|sub|ar|en)$/.test(k)) keys.add(k);
    }
  }
}
// settings rows are translated as they're drawn: their labels, sections, notes and fixed values
const st = fs.readFileSync(path.join(dir, 'settings.js'), 'utf8');
for (const m of st.matchAll(/(?:label|section|note|sub|title): '((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
for (const m of st.matchAll(/\['\w+', '([^']+)'(?:, '([^']+)')?\]/g)) { keys.add(m[1]); if (m[2]) keys.add(m[2]); }
// the quick panel's tiles, and the wallpaper names
const qk = fs.readFileSync(path.join(dir, 'quick.js'), 'utf8');
for (const m of qk.matchAll(/label: '((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
for (const m of qk.matchAll(/return [^;]*?'([A-Z][^']+)'(?: : '([A-Z][^']+)')?;/g)) { keys.add(m[1]); if (m[2]) keys.add(m[2]); }
const wl = fs.readFileSync(path.join(dir, 'walls.js'), 'utf8');
for (const m of wl.matchAll(/\['[\w-]+', '([^']+)', '(?:light|dark)'/g)) keys.add(m[1]);
for (const m of wl.matchAll(/'(Unsplash|Pexels|In Plume)'/g)) keys.add(m[1]);
const PASS = new Set(['PS5', 'beIN', 'Plume', 'Plex', 'English', 'P', '4K', '1080p', 'HDMI ', 'light', 'dark', 'colour', 'always', 'never', '4k', '1080', 'Unsplash', 'Pexels', 'Unsplash · Pexels']);   // names and stored values, not text
const missing = [...keys].filter(k => AR[k] == null && !PASS.has(k) && !RX.some(r => r[0].test(k)));
console.log(keys.size + ' texts, ' + missing.length + ' without Arabic');
missing.forEach(k => console.log('  MISSING: ' + k));
process.exit(missing.length ? 1 : 0);
