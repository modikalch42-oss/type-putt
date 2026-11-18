// Checks that every daily answer makes a finishable hole in both extremes: every letter missed
// (only the tee box, cup pad and spacer posts are solid) and every letter set solid.
// It searches routes stroke by stroke: from each resting spot it tries a sweep of angles and
// powers, keeps the most promising resting spots, and reports the fewest strokes it found.
// Usage: node tools/check.js [answers.txt] [limit] [bad.json]
const P = require('../putt.js'), fs = require('fs');
const words = fs.readFileSync(process.argv[2] || __dirname + '/answers.txt', 'utf8').split(/\s+/).filter(Boolean);
const limit = +(process.argv[3] || words.length), MAXS = 4;
function strokesToHole(course) {
  let frontier = [{ x: course.tee.x, y: course.tee.y, broken: [false, false, false, false, false] }];
  for (let k = 1; k <= MAXS; k++) {
    const next = new Map();
    for (const st of frontier) for (let a = -20; a <= 200; a += 4) for (let p = 80; p <= P.MAX_V; p += 20) {
      const r = a * Math.PI / 180, s = P.shoot(course, st.x, st.y, Math.cos(r) * p, -Math.sin(r) * p, st.broken);
      if (s.res === 'sunk') return k;
      if (s.res !== 'rest') continue;
      const key = Math.round(s.x / 12) + ',' + Math.round(s.y / 12) + s.broken.join('');
      if (!next.has(key)) next.set(key, { x: s.x, y: s.y, broken: s.broken });
    }
    // keep the resting spots closest to the cup
    frontier = [...next.values()].sort((u, v) => Math.abs(u.x - course.cup.x) - Math.abs(v.x - course.cup.x)).slice(0, 12);
    if (!frontier.length) return 0;
  }
  return 0;
}
const bad = [], t0 = Date.now(), out = [], tally = { wire: {}, solid: {} };
for (const w of words.slice(0, limit)) {
  const a = strokesToHole(P.buildCourse(w, Array(5).fill('wire'))), b = strokesToHole(P.buildCourse(w, Array(5).fill('solid')));
  tally.wire[a] = (tally.wire[a] || 0) + 1; tally.solid[b] = (tally.solid[b] || 0) + 1;
  const ok = a > 0 && b > 0;
  out.push(`${w} missed-all:${a || '✗'} solid:${b || '✗'}${ok ? '' : '  <-- BAD'}`);
  if (!ok) bad.push(w);
}
console.log(out.slice(0, 8).join('\n'));
console.log('fewest strokes found (0 = none within ' + MAXS + '):', JSON.stringify(tally));
console.log(`checked ${Math.min(limit, words.length)} words in ${((Date.now() - t0) / 1000).toFixed(1)}s · bad: ${bad.length} ${bad.join(' ')}`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(bad));
