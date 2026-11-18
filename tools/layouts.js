// Builds a validated green layout for each daily answer (letter positions, tee and cup), seeded by the word.
// A layout is kept only if:
//   - the tee and cup sit on open green, clear of every letter, and the straight line between them runs into two letters;
//   - with every letter set solid, the solver can finish in 2-4 strokes (no straight-line ace);
//   - with every letter missed (all ink pits), the solver can finish in at most 5.
// Par for a player's course is interpolated between those two results (see index.html).
// Usage: node tools/layouts.js [from] [to] [out.json]
const P = require('../putt.js'), fs = require('fs');
const words = fs.readFileSync(__dirname + '/answers.txt', 'utf8').split(/\s+/).filter(Boolean);
const from = +(process.argv[2] || 0), to = Math.min(words.length, +(process.argv[3] || words.length));
const hash = w => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;
const out = {}, t0 = Date.now();
for (const w of words.slice(from, to)) {
  let a = hash(w); const rnd = () => (a = a * 16807 % 2147483647) / 2147483647, j = (v, d) => Math.round(v + (rnd() * 2 - 1) * d);
  let found = null;
  for (let attempt = 0; attempt < 30 && !found; attempt++) {
    const L = P.BASE.L.map(([x, y]) => [j(x, attempt ? 20 : 8), j(y, attempt ? 24 : 8)]);
    L.forEach(p => { p[0] = Math.max(0, Math.min(P.W - 5 * P.B, p[0])); });
    const lay = { L, tee: [j(210, 150), j(510, 18)], cup: [j(210, 150), j(56, 16)] };
    const solid = P.buildCourse(w, Array(5).fill('solid'), lay), wire = P.buildCourse(w, Array(5).fill('wire'), lay);
    const clear = (x, y) => solid.blocks.every(b => Math.max(Math.abs(x - (b.x + P.B / 2)), Math.abs(y - (b.y + P.B / 2))) > P.B / 2 + 14);
    if (!clear(...lay.tee) || !clear(...lay.cup)) continue;
    // the straight line from tee to cup must run into at least two letters: no aiming straight at the flag
    const crossed = new Set();
    for (let t = 0; t <= 1; t += .005) { const x = lay.tee[0] + (lay.cup[0] - lay.tee[0]) * t, y = lay.tee[1] + (lay.cup[1] - lay.tee[1]) * t, b = solid.cells.get(Math.floor(x / P.B) + ',' + Math.floor(y / P.B)); if (b) crossed.add(b.li); }
    if (crossed.size < 2) continue;
    const s = P.solve(solid, 4); if (s < 2) continue;
    const m = P.solve(wire, 5); if (!m) continue;
    found = { ...lay, ps: s, pw: m };
  }
  out[w] = found;
}
const n = Object.keys(out).length, bad = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
console.error(`${from}-${to}: ${n} words in ${((Date.now() - t0) / 1000).toFixed(1)}s, no layout: ${bad.length} ${bad.join(' ')}`);
const vals = Object.values(out).filter(Boolean);
console.error('solid min strokes:', JSON.stringify(vals.reduce((m, v) => (m[v.ps] = (m[v.ps] || 0) + 1, m), {})), ' missed min strokes:', JSON.stringify(vals.reduce((m, v) => (m[v.pw] = (m[v.pw] || 0) + 1, m), {})));
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(out));
