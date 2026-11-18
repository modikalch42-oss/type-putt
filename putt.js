/* Type-Putt: a top-down mini-golf hole built from the day's word. Deterministic: the simulation uses
   only + - * / and Math.sqrt (rotations use an exact rational cos/sin, slopes use polynomial bumps),
   so a shot behaves identically in every browser and in the tools.

   Five letters sit on the green between the tee and the cup. What each letter is comes from the word game:
     solid   (right letter, right spot)  raised wooden type you can bank off (solid VOWELS are rubber bumpers)
     brittle (right letter, wrong spot)  a wall for one hit, then it crumbles into ink
     wire    (missed)                    cut out of the green as wet ink: roll in = +1 stroke
   Each day also has a typeface (regular, italic, bold, stencil, bold italic), a warp in the paper (hills and
   dips that bend putts), a cup nestled inside one letter, and two ink dots to collect (-1 stroke each). */
(function (root) {
  const W = 420, H = 560, B = 18, R = 5, DT = 1 / 240, MAX_V = 700, MAX_STEPS = 240 * 12;
  const DECEL = 260, DRAG = .55, STOP = 6, CUP_R = 9, CUP_MAXV = 300, E_RAIL = .78, E_TYPE = .7, E_RUBBER = 1, KICK = 330, DOT_R = 6;
  const FONT = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '##.##'],
    B: ['####.', '.#..#', '.#..#', '.###.', '.#..#', '.#..#', '####.'],
    C: ['.####', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['####.', '.#..#', '.#..#', '.#..#', '.#..#', '.#..#', '####.'],
    E: ['#####', '.#..#', '.#...', '.###.', '.#...', '.#..#', '#####'],
    F: ['#####', '.#..#', '.#...', '.###.', '.#...', '.#...', '###..'],
    G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
    H: ['##.##', '#...#', '#...#', '#####', '#...#', '#...#', '##.##'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    K: ['##.##', '.#.#.', '.##..', '.#...', '.##..', '.#.#.', '##.##'],
    L: ['###..', '.#...', '.#...', '.#...', '.#...', '.#..#', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '##.##'],
    N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '.#..#', '.#..#', '.###.', '.#...', '.#...', '###..'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '.#..#', '.#..#', '.###.', '.#.#.', '.#..#', '##..#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '#.#.#', '..#..', '..#..', '..#..', '..#..', '.###.'],
    U: ['##.##', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '.#.#.', '.#.#.', '..#..', '.#.#.', '.#.#.', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '.###.'],
    Z: ['#####', '#...#', '...#.', '..#..', '.#...', '#...#', '#####']
  };
  const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
  // italic tilts each letter about 11.4 degrees using an exact rational rotation (tan half-angle 0.1)
  const IT = { co: .99 / 1.01, si: .2 / 1.01 };
  const STYLES = { regular: {}, italic: { tilt: 1 }, bold: { bold: 1 }, stencil: { stencil: 1 }, bolditalic: { bold: 1, tilt: 1 } };
  const BASE = { L: [[18, 126], [162, 126], [306, 126], [90, 306], [234, 306]], tee: [210, 505], cup: [210, 58], style: 'regular', dots: [], hills: [] };
  const snap = v => Math.round(v);   // letters live in their own frames, so whole-unit positions are enough

  // the cells of a letter in a style: bold thickens strokes, stencil cuts gaps in long strokes
  function glyph(ch, style) {
    const st = STYLES[style] || STYLES.regular, rows = FONT[ch]; let cells = new Set(), w = 5;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (rows[r][c] === '#') cells.add(c + ',' + r);
    if (st.bold) {   // thicken each stroke to the right, but never fill a one-cell notch (keeps A, H, U, M open)
      const orig = new Set(cells);
      for (const k of orig) { const [c, r] = k.split(',').map(Number); if (orig.has((c + 2) + ',' + r) && !orig.has((c + 1) + ',' + r)) continue; cells.add((c + 1) + ',' + r); }
      w = 6;
    }
    if (st.stencil) {
      const has = (c, r) => cells.has(c + ',' + r), rm = [];
      for (const k of cells) {
        const [c, r] = k.split(',').map(Number);
        if (r === 3 && has(c, 2) && has(c, 4) && !has(c - 1, 3) && !has(c + 1, 3)) rm.push(k);   // break vertical strokes
        if (c === 2 && has(1, r) && has(3, r) && !has(2, r - 1) && !has(2, r + 1)) rm.push(k);   // break horizontal bars
      }
      rm.forEach(k => cells.delete(k));
    }
    return { cells, w };
  }

  // kern: optional per-letter sideways nudges (the player slides solid letters before teeing off)
  function buildCourse(word, states, layout, kern) {
    word = word.toUpperCase(); layout = layout || BASE;
    const style = layout.style || 'regular', tilt = (STYLES[style] || {}).tilt, co = tilt ? IT.co : 1, si = tilt ? IT.si : 0;
    const letters = [];
    for (let li = 0; li < 5; li++) {
      const ch = word[li], g = glyph(ch, style), x0 = snap(layout.L[li][0]) + ((kern && kern[li]) || 0), y0 = snap(layout.L[li][1]);
      const lw = g.w * B, lh = 7 * B;
      letters.push({ li, ch, cells: g.cells, w: g.w, x0, y0, lw, lh, cx: x0 + lw / 2, cy: y0 + lh / 2, co, si, vowel: VOWELS.has(ch), rad: Math.sqrt(lw * lw + lh * lh) / 2 });
    }
    const course = { word, states: states.slice(), layout, style, letters, tee: { x: layout.tee[0], y: layout.tee[1] }, dots: (layout.dots || []).map(d => ({ x: d[0], y: d[1] })), hills: layout.hills || [] };
    const c = layout.cup;
    course.cup = Array.isArray(c) ? { x: c[0], y: c[1], li: -1 } : { ...toWorld(letters[c.li], (c.c + .5) * B, (c.r + .5) * B), li: c.li };
    return course;
  }
  function toLocal(L, x, y) { const dx = x - L.cx, dy = y - L.cy; return { x: dx * L.co + dy * L.si + L.lw / 2, y: -dx * L.si + dy * L.co + L.lh / 2 }; }
  function toWorld(L, lx, ly) { const ux = lx - L.lw / 2, uy = ly - L.lh / 2; return { x: L.cx + ux * L.co - uy * L.si, y: L.cy + ux * L.si + uy * L.co }; }
  // what a letter cell is right now: 'wall', 'pit' or null (open green)
  function cellKind(course, broken, L, c, r) {
    if (!L.cells.has(c + ',' + r)) return null;
    const st = course.states[L.li];
    if (st === 'solid') return 'wall';
    if (st === 'brittle') return broken[L.li] ? 'pit' : 'wall';
    return 'pit';
  }
  // the paper's warp: polynomial bumps; positive A pushes the ball away (a hill), negative pulls it in (a dip)
  function slopeAt(hills, x, y) {
    let ax = 0, ay = 0;
    for (const [hx, hy, r, A] of hills) {
      const dx = x - hx, dy = y - hy, d2 = dx * dx + dy * dy, r2 = r * r; if (d2 >= r2) continue;
      const q = 1 - d2 / r2, k = A * 2.6 * q / r; ax += k * dx; ay += k * dy;
    }
    return [ax, ay];
  }

  function start(course, x, y, vx, vy, broken, dotsGot) {
    const sp = Math.sqrt(vx * vx + vy * vy); if (sp > MAX_V) { vx = vx / sp * MAX_V; vy = vy / sp * MAX_V; }
    return { course, x, y, vx, vy, n: 0, done: null, hits: [], broken: broken ? broken.slice() : [false, false, false, false, false],
      breakNow: [], lip: false, dots: dotsGot ? dotsGot.slice() : course.dots.map(() => false), dotsNow: [] };
  }

  function bounce(s, nx, ny, pen, e, kick, li, qx, qy) {
    s.x += nx * pen; s.y += ny * pen;
    const vn = s.vx * nx + s.vy * ny; if (vn >= 0) return;
    const out = kick && -vn > 20 ? Math.max(-vn * e, kick) : -vn * e;
    s.vx += (out - vn) * nx; s.vy += (out - vn) * ny;
    if (-vn > 30) s.hits.push({ li, v: -vn, x: qx, y: qy, rubber: !!kick });
    if (li >= 0 && s.course.states[li] === 'brittle' && !s.broken[li]) { s.broken[li] = true; s.breakNow.push(li); }
  }

  // collide with one letter in its own (possibly tilted) frame
  function collideLetter(s, L) {
    const cs = s.course, p = toLocal(L, s.x, s.y);
    let lvx = s.vx * L.co + s.vy * L.si, lvy = -s.vx * L.si + s.vy * L.co, lx = p.x, ly = p.y, moved = false;
    const rubber = L.vowel && cs.states[L.li] === 'solid';
    const c0 = Math.floor((lx - R) / B), c1 = Math.floor((lx + R) / B), r0 = Math.floor((ly - R) / B), r1 = Math.floor((ly + R) / B);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (cellKind(cs, s.broken, L, c, r) !== 'wall') continue;
      const bx = c * B, by = r * B;
      const qx = lx < bx ? bx : lx > bx + B ? bx + B : lx, qy = ly < by ? by : ly > by + B ? by + B : ly;
      let nx = lx - qx, ny = ly - qy; const d2 = nx * nx + ny * ny;
      if (d2 >= R * R) continue;
      let pen;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx /= d; ny /= d; pen = R - d; } else { nx = 0; ny = -1; pen = R; }
      if (nx < 0 && cellKind(cs, s.broken, L, c - 1, r) === 'wall') nx = 0;
      if (nx > 0 && cellKind(cs, s.broken, L, c + 1, r) === 'wall') nx = 0;
      if (ny < 0 && cellKind(cs, s.broken, L, c, r - 1) === 'wall') ny = 0;
      if (ny > 0 && cellKind(cs, s.broken, L, c, r + 1) === 'wall') ny = 0;
      const l = Math.sqrt(nx * nx + ny * ny); if (l < 1e-9) continue; nx /= l; ny /= l;
      // resolve in local space using a temporary state, then rotate back
      const t = { x: lx, y: ly, vx: lvx, vy: lvy, hits: s.hits, broken: s.broken, breakNow: s.breakNow, course: cs };
      const wq = toWorld(L, qx, qy);
      bounce(t, nx, ny, pen, rubber ? E_RUBBER : E_TYPE, rubber ? KICK : 0, L.li, wq.x, wq.y);
      lx = t.x; ly = t.y; lvx = t.vx; lvy = t.vy; moved = true;
    }
    if (moved) { const w = toWorld(L, lx, ly); s.x = w.x; s.y = w.y; s.vx = lvx * L.co - lvy * L.si; s.vy = lvx * L.si + lvy * L.co; }
  }

  function step(s) {
    const cs = s.course; s.hits = []; s.breakNow = []; s.dotsNow = [];
    const [ax, ay] = slopeAt(cs.hills, s.x, s.y); s.vx += ax * DT; s.vy += ay * DT;
    let sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 0) { const ns = Math.max(0, sp - (DECEL + DRAG * sp) * DT), k = ns / sp; s.vx *= k; s.vy *= k; sp = ns; }
    s.x += s.vx * DT; s.y += s.vy * DT;
    if (s.x < R) bounce(s, 1, 0, R - s.x, E_RAIL, 0, -1, 0, s.y);
    if (s.x > W - R) bounce(s, -1, 0, s.x - (W - R), E_RAIL, 0, -1, W, s.y);
    if (s.y < R) bounce(s, 0, 1, R - s.y, E_RAIL, 0, -1, s.x, 0);
    if (s.y > H - R) bounce(s, 0, -1, s.y - (H - R), E_RAIL, 0, -1, s.x, H);
    for (const L of cs.letters) { const dx = s.x - L.cx, dy = s.y - L.cy, rr = L.rad + R + 2; if (dx * dx + dy * dy < rr * rr) collideLetter(s, L); }
    s.n++;
    sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    for (let i = 0; i < cs.dots.length; i++) { if (s.dots[i]) continue; const dx = s.x - cs.dots[i].x, dy = s.y - cs.dots[i].y; if (dx * dx + dy * dy < (R + DOT_R) * (R + DOT_R)) { s.dots[i] = true; s.dotsNow.push(i); } }
    // cup: slow balls drop, fast ones lip out
    const dx = s.x - cs.cup.x, dy = s.y - cs.cup.y, dc2 = dx * dx + dy * dy;
    if (dc2 < CUP_R * CUP_R) {
      if (sp < CUP_MAXV) { s.done = 'sunk'; return s; }
      if (!s.lip) { s.lip = true; const d = Math.sqrt(dc2) || 1, tx = -dy / d, ty = dx / d, f = .35 * (dx * s.vy - dy * s.vx > 0 ? 1 : -1);
        s.vx = (s.vx + tx * f * sp) * .8; s.vy = (s.vy + ty * f * sp) * .8; s.hits.push({ li: -3, v: sp, x: s.x, y: s.y }); }
    } else s.lip = false;
    // ink: the ball's centre over a pit cell
    for (const L of cs.letters) {
      const p = toLocal(L, s.x, s.y); if (p.x < 0 || p.y < 0 || p.x >= L.lw || p.y >= L.lh) continue;
      if (cellKind(cs, s.broken, L, Math.floor(p.x / B), Math.floor(p.y / B)) === 'pit') { s.done = 'inked'; return s; }
    }
    if (sp < STOP || s.n >= MAX_STEPS) s.done = 'rest';
    return s;
  }

  function shoot(course, x, y, vx, vy, broken, keepPath) {
    const s = start(course, x, y, vx, vy, broken), path = [];
    while (!s.done) { step(s); if (keepPath && s.n % 4 === 0) path.push([s.x, s.y]); }
    return { res: s.done, x: s.x, y: s.y, broken: s.broken, path, steps: s.n };
  }

  // fewest strokes the search can find (0 = none within maxStrokes). Ink returns the ball to where it was.
  function solve(course, maxStrokes = 4, angStep = 6, keep = 10) {
    let frontier = [{ x: course.tee.x, y: course.tee.y, broken: [false, false, false, false, false] }];
    const powers = [110, 160, 220, 290, 370, 460, 560, 680];
    for (let k = 1; k <= maxStrokes; k++) {
      const next = new Map();
      for (const st of frontier) for (let a = 0; a < 360; a += angStep) for (const p of powers) {
        const r = a * Math.PI / 180, s = shoot(course, st.x, st.y, Math.cos(r) * p, Math.sin(r) * p, st.broken);
        if (s.res === 'sunk') return k;
        if (s.res !== 'rest') continue;
        const key = Math.round(s.x / 10) + ',' + Math.round(s.y / 10) + s.broken.join('');
        if (!next.has(key)) next.set(key, { x: s.x, y: s.y, broken: s.broken });
      }
      const cup = course.cup;
      frontier = [...next.values()].sort((u, v) => ((u.x - cup.x) ** 2 + (u.y - cup.y) ** 2) - ((v.x - cup.x) ** 2 + (v.y - cup.y) ** 2)).slice(0, keep);
      if (!frontier.length) return 0;
    }
    return 0;
  }

  const api = { W, H, B, R, DT, MAX_V, CUP_R, CUP_MAXV, DOT_R, FONT, VOWELS, STYLES, IT, BASE, snap, glyph, buildCourse, toLocal, toWorld, cellKind, slopeAt, start, step, shoot, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Putt = api;
})(this);
