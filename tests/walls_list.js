// Writes walls.txt (the photos install.bat downloads into Plume) from Plume/js/walls.js, or with --check,
// fails when walls.txt is out of date. Usage: node walls_list.js ../Plume ../walls.txt [--check]
const fs = require('fs'), path = require('path'), vm = require('vm');
const app = process.argv[2] || '../Plume', out = process.argv[3] || '../walls.txt', check = process.argv.includes('--check');
const ctx = { window: {} }; ctx.P = ctx.window.P = { S: { get: () => null, set: () => {} }, t: s => s }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(app, 'js', 'walls.js'), 'utf8'), ctx);
const W = ctx.P.Walls;
const lines = ['# Wallpapers install.bat downloads once into Plume\\img\\walls (made by tests/walls_list.js from js/walls.js)',
  '# id<TAB>photo (1920 wide)<TAB>preview (480 wide)']
  .concat(W.all.filter(w => w.src !== 'plume').map(w => [w.id, W.remote(w, 1920), W.remote(w, 480)].join('\t')));
const text = lines.join('\r\n') + '\r\n';
if (check) {
  const ok = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === text;
  console.log(ok ? 'walls.txt is up to date' : 'walls.txt is OUT OF DATE: run node tests/walls_list.js Plume walls.txt');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(out, text);
console.log('wrote ' + (lines.length - 2) + ' photos to ' + out);
