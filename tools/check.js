// Checks that every daily answer makes a sinkable hole in both extremes:
//   all letters missed (only the tee and cup pads are solid) and all letters solid.
// For each, it scans launch angles and powers for a hole-in-one; if none exists in the
// all-solid case it also looks for a two-stroke route. Usage: node tools/check.js [answers.txt] [limit]
const P = require('../putt.js'), fs = require('fs');
const words = fs.readFileSync(process.argv[2] || __dirname + '/answers.txt', 'utf8').split(/\s+/).filter(Boolean);
const limit = +(process.argv[3] || words.length);
function oneShot(course, x, y, broken, angStep = 2, powStep = 10) {
  let found = 0, first = null;
  for (let a = 0; a <= 180; a += angStep) for (let p = 120; p <= P.MAX_V; p += powStep) {
    const r = a * Math.PI / 180, vx = Math.cos(r) * p, vy = -Math.sin(r) * p;
    const s = P.shoot(course, x, y, vx, vy, broken);
    if (s.res === 'sunk') { found++; if (!first) first = [a, p]; }
  }
  return { found, first };
}
function twoShot(course) {
  const seen = new Set();
  for (let a = 0; a <= 180; a += 6) for (let p = 120; p <= P.MAX_V; p += 40) {
    const r = a * Math.PI / 180, s = P.shoot(course, course.tee.x, course.tee.y, Math.cos(r) * p, -Math.sin(r) * p);
    if (s.res !== 'rest') continue;
    const key = Math.round(s.x / 10) + ',' + Math.round(s.y / 10); if (seen.has(key)) continue; seen.add(key);
    if (oneShot(course, s.x, s.y, s.broken, 4, 20).found) return true;
  }
  return false;
}
const bad = [], t0 = Date.now(), out = [];
for (const w of words.slice(0, limit)) {
  const wire = P.buildCourse(w, Array(5).fill('wire')), solid = P.buildCourse(w, Array(5).fill('solid'));
  const a = oneShot(wire, wire.tee.x, wire.tee.y), b = oneShot(solid, solid.tee.x, solid.tee.y);
  let ok = a.found > 0 && (b.found > 0 || twoShot(solid));
  out.push(`${w} wire:${a.found} solid:${b.found}${ok ? '' : '  <-- BAD'}`);
  if (!ok) bad.push(w);
}
console.log(out.slice(0, 12).join('\n'));
console.log(`checked ${Math.min(limit, words.length)} words in ${((Date.now() - t0) / 1000).toFixed(1)}s · bad: ${bad.length} ${bad.join(' ')}`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(bad));
