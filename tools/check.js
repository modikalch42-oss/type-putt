// Re-checks the shipped greens in words.js: for every daily answer, the solver must be able to finish
// the hole (in its typeface, with its warp) both with every letter set solid and with every letter missed.
// tools/layouts.js already does this when it builds layouts; run this after changing putt.js.
// Usage: node tools/check.js
const P = require('../putt.js');
global.window = {}; require('../words.js');
const L = window.TP_LAYOUTS, words = window.TP_ANSWERS, bad = [], t0 = Date.now(), tally = { solid: {}, missed: {} };
for (const w of words) {
  const lay = L[w];   // { L, tee, cup, style, dots, hills }
  const s = P.solve(P.buildCourse(w, Array(5).fill('solid'), lay), 4), m = P.solve(P.buildCourse(w, Array(5).fill('wire'), lay), 5);
  tally.solid[s] = (tally.solid[s] || 0) + 1; tally.missed[m] = (tally.missed[m] || 0) + 1;
  if (!s || !m) bad.push(w);
}
console.log('fewest strokes found (0 = none):', JSON.stringify(tally));
console.log(`checked ${words.length} greens in ${((Date.now() - t0) / 1000).toFixed(1)}s · unfinishable: ${bad.length} ${bad.join(' ')}`);
process.exit(bad.length ? 1 : 0);
