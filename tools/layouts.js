// Builds a validated green for every daily slot (in words.js order), seeded by the word.
// Each green has: letter positions, the day's typeface (by weekday), a tee, a cup nestled in a nook of
// one letter, two ink dots (-1 stroke each) in awkward spots, and a warp in the paper (hills and dips).
// A green is kept only if:
//   - letters don't overlap, and the tee and dots sit on open grass;
//   - the straight line from tee to cup runs into a letter other than the cup's own;
//   - with every letter solid, the solver finishes in 2-4 strokes; with every letter missed, in at most 5.
// Usage: node tools/layouts.js [from] [to] [out.json]   (merge several outputs with tools/merge-layouts.js)
const P = require('../putt.js'), fs = require('fs');
global.window = {}; require('../words.js');
const order = window.TP_ANSWERS;
const STYLE_BY_DOW = ['bolditalic', 'regular', 'italic', 'stencil', 'bold', 'italic', 'bold'];   // Sun..Sat
const dowOf = d => ((2 + d) % 7 + 7) % 7;                                                              // day 1 = Wednesday
const from = +(process.argv[2] || 0), to = Math.min(order.length, +(process.argv[3] || order.length));
const hash = w => [...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;

// empty cells inside a letter that are reachable from outside and walled on 2-3 sides: where a cup can nestle
function nooks(g) {
  const filled = (c, r) => g.cells.has(c + ',' + r), seen = new Set(), st = [];
  for (let c = -1; c <= g.w; c++) for (let r = -1; r <= 7; r++) if (c < 0 || r < 0 || c === g.w || r === 7) { seen.add(c + ',' + r); st.push([c, r]); }
  while (st.length) { const [c, r] = st.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr, k = nc + ',' + nr;
    if (nc < -1 || nr < -1 || nc > g.w || nr > 7 || seen.has(k) || filled(nc, nr)) continue; seen.add(k); st.push([nc, nr]); } }
  const out = [];
  for (let c = 0; c < g.w; c++) for (let r = 0; r < 7; r++) {
    if (filled(c, r) || !seen.has(c + ',' + r)) continue;
    const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => filled(c + dc, r + dr)).length;
    if (walls >= 2) out.push({ c, r, walls });
  }
  return out;
}
const out = {}, t0 = Date.now();
for (let idx = from; idx < to; idx++) {
  const w = order[idx], style = STYLE_BY_DOW[dowOf(idx + 1)];
  let a = hash(w + style); const rnd = () => (a = a * 16807 % 2147483647) / 2147483647, j = (v, d) => Math.round(v + (rnd() * 2 - 1) * d);
  let found = null;
  // letters are placed by their centres (three on top, two below); bold faces are wider so they get less jitter
  const bold = !!(P.STYLES[style] || {}).bold, lw = (bold ? 6 : 5) * P.B, jx = bold ? 7 : 18;
  // regular faces: three letters on top, two below. Bold faces don't fit three across, so they zigzag 2-1-2.
  const CENTRES = bold ? [[110, 130], [310, 130], [210, 280], [110, 430], [310, 430]] : [[70, 189], [210, 189], [350, 189], [140, 369], [280, 369]];
  const YMIN = bold ? 54 : 70, YMAX = bold ? 508 : 470, TEEY = bold ? [538, 3] : [512, 16];
  for (let attempt = 0; attempt < 140 && !found; attempt++) {
    const L = CENTRES.map(([cx, cy]) => [j(cx - lw / 2, attempt ? jx : 3), j(cy - 63, attempt ? (bold ? 2 : 22) : 1)]);
    const probe = P.buildCourse(w, Array(5).fill('solid'), { L, tee: [0, 0], cup: [0, 0], style });
    const ext = Lt => [Math.abs(Lt.co) * Lt.lw / 2 + Math.abs(Lt.si) * Lt.lh / 2, Math.abs(Lt.si) * Lt.lw / 2 + Math.abs(Lt.co) * Lt.lh / 2];
    const ok = probe.letters.every((A, i) => { const [ax, ay] = ext(A); if (A.cx - ax < 4 || A.cx + ax > P.W - 4 || A.cy - ay < YMIN || A.cy + ay > YMAX) return false;
      return probe.letters.every((Bl, k) => k <= i || (() => { const [bx, by] = ext(Bl); return Math.abs(A.cx - Bl.cx) > ax + bx + 4 || Math.abs(A.cy - Bl.cy) > ay + by + 4; })()); });
    if (!ok) continue;
    // cup: a nook in one of the top-row letters if possible
    const order3 = [0, 1, 2].sort(() => rnd() - .5).concat([3, 4]);
    let cup = null;
    for (const li of order3) { const ns = nooks(P.glyph(w[li].toUpperCase(), style)); if (!ns.length) continue;
      ns.sort((u, v) => v.walls - u.walls || rnd() - .5); cup = { li, c: ns[0].c, r: ns[0].r }; break; }
    if (!cup) continue;
    const lay = { L, tee: [j(210, 150), j(...TEEY)], cup, style, dots: [], hills: [] };
    const solid = P.buildCourse(w, Array(5).fill('solid'), lay), wire = P.buildCourse(w, Array(5).fill('wire'), lay);
    const onLetter = (x, y, pad) => solid.letters.some(Lt => { const p = P.toLocal(Lt, x, y); for (const k of Lt.cells) { const [c, r] = k.split(',').map(Number);
      if (p.x > c * P.B - pad && p.x < (c + 1) * P.B + pad && p.y > r * P.B - pad && p.y < (r + 1) * P.B + pad) return true; } return false; });
    if (onLetter(...lay.tee, 12) || onLetter(solid.cup.x, solid.cup.y, 0) || solid.cup.y > YMAX) continue;
    // the direct line must run into a letter other than the cup's
    const crossed = new Set();
    for (let t = 0; t <= 1; t += .004) { const x = lay.tee[0] + (solid.cup.x - lay.tee[0]) * t, y = lay.tee[1] + (solid.cup.y - lay.tee[1]) * t;
      for (const Lt of solid.letters) { if (Lt.li === cup.li) continue; const p = P.toLocal(Lt, x, y); if (Lt.cells.has(Math.floor(p.x / P.B) + ',' + Math.floor(p.y / P.B))) crossed.add(Lt.li); } }
    if (!crossed.size) continue;
    // ink dots: awkward spots far from the straight line, clear of letters, tee and cup
    const lineD = (x, y) => { const [x1, y1] = lay.tee, x2 = solid.cup.x, y2 = solid.cup.y, dx = x2 - x1, dy = y2 - y1; return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy); };
    for (let n = 0; n < 2; n++) { let best = null, bs = -1;
      for (let t = 0; t < 40; t++) { const x = 26 + rnd() * (P.W - 52), y = 30 + rnd() * (P.H - 120);
        if (onLetter(x, y, 10) || Math.hypot(x - lay.tee[0], y - lay.tee[1]) < 70 || Math.hypot(x - solid.cup.x, y - solid.cup.y) < 45 || lay.dots.some(d => Math.hypot(d[0] - x, d[1] - y) < 90)) continue;
        const sc = lineD(x, y); if (sc > bs) { bs = sc; best = [Math.round(x), Math.round(y)]; } }
      if (best) lay.dots.push(best); }
    // the warp: two or three hills/dips
    const nh = 2 + (rnd() < .5 ? 1 : 0);
    for (let n = 0; n < nh; n++) lay.hills.push([Math.round(30 + rnd() * (P.W - 60)), Math.round(60 + rnd() * (P.H - 120)), Math.round(90 + rnd() * 80), Math.round((rnd() < .5 ? -1 : 1) * (70 + rnd() * 70))]);
    const s2 = P.buildCourse(w, Array(5).fill('solid'), lay), m2 = P.buildCourse(w, Array(5).fill('wire'), lay);
    const s = P.solve(s2, 4); if (s < 2) continue;
    const m = P.solve(m2, 5); if (!m) continue;
    found = { ...lay, ps: s, pw: m };
  }
  out[w] = found;
}
const vals = Object.values(out).filter(Boolean), bad = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
console.error(`${from}-${to}: ${to - from} greens in ${((Date.now() - t0) / 1000).toFixed(1)}s · none found: ${bad.length} ${bad.join(' ')}`);
console.error('solid min strokes', JSON.stringify(vals.reduce((m, v) => (m[v.ps] = (m[v.ps] || 0) + 1, m), {})), '· missed min strokes', JSON.stringify(vals.reduce((m, v) => (m[v.pw] = (m[v.pw] || 0) + 1, m), {})));
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(out));
