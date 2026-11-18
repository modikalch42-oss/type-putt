/* Type-Putt: a top-down mini-golf hole built from the day's word. Deterministic (only + - * /
   and Math.sqrt in the simulation), so shots behave identically in every browser and in the tools.

   The five letters sit on the green in two staggered rows between the tee (bottom) and the cup (top),
   in a 5x7 block face. What each letter is depends on the word game:
     solid   (right letter, right spot)  raised wooden type: a wall you can bank off
     brittle (right letter, wrong spot)  a wall for one hit, then it crumbles into an ink pit
     wire    (missed)                    the letter is cut out of the green as wet ink: fall in = +1 stroke
   The ball rolls with friction and only drops into the cup if it's moving slowly enough. */
(function (root) {
  const W = 420, H = 560, B = 18, R = 5, DT = 1 / 240, MAX_V = 700, MAX_STEPS = 240 * 12;
  const DECEL = 260, DRAG = .55, STOP = 6, CUP_R = 9, CUP_MAXV = 300, E_RAIL = .78, E_TYPE = .7;
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
  // default layout: C O R on the upper row, A L on the lower row (all positions are letter top-left corners)
  const BASE = { L: [[18, 126], [162, 126], [306, 126], [90, 306], [234, 306]], tee: [210, 505], cup: [210, 58] };

  // letters snap to the B grid so walls line up cell by cell
  const snap = v => Math.round(v / B) * B;
  function buildCourse(word, states, layout) {
    word = word.toUpperCase(); layout = layout || BASE;
    const cells = new Map(), blocks = [];
    for (let li = 0; li < 5; li++) {
      const g = FONT[word[li]], x0 = snap(layout.L[li][0]), y0 = snap(layout.L[li][1]);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '#') continue;
        const cx = x0 / B + c, cy = y0 / B + r, b = { cx, cy, x: cx * B, y: cy * B, li };
        cells.set(cx + ',' + cy, b); blocks.push(b);
      }
    }
    return { word, states: states.slice(), layout, cells, blocks, tee: { x: layout.tee[0], y: layout.tee[1] }, cup: { x: layout.cup[0], y: layout.cup[1] } };
  }
  // what a cell is right now: 'wall', 'pit' or null (open green)
  function cellKind(course, broken, cx, cy) {
    const b = course.cells.get(cx + ',' + cy); if (!b) return null;
    const st = course.states[b.li];
    if (st === 'solid') return 'wall';
    if (st === 'brittle') return broken[b.li] ? 'pit' : 'wall';
    return 'pit';
  }

  function start(course, x, y, vx, vy, broken) {
    const sp = Math.sqrt(vx * vx + vy * vy); if (sp > MAX_V) { vx = vx / sp * MAX_V; vy = vy / sp * MAX_V; }
    return { course, x, y, vx, vy, n: 0, done: null, hits: [], broken: broken ? broken.slice() : [false, false, false, false, false], breakNow: [], lip: false };
  }

  function bounce(s, nx, ny, pen, e, li, qx, qy) {
    s.x += nx * pen; s.y += ny * pen;
    const vn = s.vx * nx + s.vy * ny; if (vn >= 0) return;
    s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny;
    if (-vn > 30) s.hits.push({ li, v: -vn, x: qx, y: qy });
    if (li >= 0 && s.course.states[li] === 'brittle' && !s.broken[li]) { s.broken[li] = true; s.breakNow.push(li); }
  }

  function step(s) {
    const cs = s.course; s.hits = []; s.breakNow = [];
    // rolling friction: constant deceleration plus a little drag
    let sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 0) { const ns = Math.max(0, sp - (DECEL + DRAG * sp) * DT), k = ns / sp; s.vx *= k; s.vy *= k; sp = ns; }
    s.x += s.vx * DT; s.y += s.vy * DT;
    // the wooden frame around the green
    if (s.x < R) bounce(s, 1, 0, R - s.x, E_RAIL, -1, 0, s.y);
    if (s.x > W - R) bounce(s, -1, 0, s.x - (W - R), E_RAIL, -1, W, s.y);
    if (s.y < R) bounce(s, 0, 1, R - s.y, E_RAIL, -1, s.x, 0);
    if (s.y > H - R) bounce(s, 0, -1, s.y - (H - R), E_RAIL, -1, s.x, H);
    // letter walls
    const c0 = Math.floor((s.x - R) / B), c1 = Math.floor((s.x + R) / B), r0 = Math.floor((s.y - R) / B), r1 = Math.floor((s.y + R) / B);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      if (cellKind(cs, s.broken, cx, cy) !== 'wall') continue;
      const bx = cx * B, by = cy * B;
      const qx = s.x < bx ? bx : s.x > bx + B ? bx + B : s.x, qy = s.y < by ? by : s.y > by + B ? by + B : s.y;
      let nx = s.x - qx, ny = s.y - qy; const d2 = nx * nx + ny * ny;
      if (d2 >= R * R) continue;
      let pen;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx /= d; ny /= d; pen = R - d; } else { nx = 0; ny = -1; pen = R; }
      if (nx < 0 && cellKind(cs, s.broken, cx - 1, cy) === 'wall') nx = 0;
      if (nx > 0 && cellKind(cs, s.broken, cx + 1, cy) === 'wall') nx = 0;
      if (ny < 0 && cellKind(cs, s.broken, cx, cy - 1) === 'wall') ny = 0;
      if (ny > 0 && cellKind(cs, s.broken, cx, cy + 1) === 'wall') ny = 0;
      const l = Math.sqrt(nx * nx + ny * ny); if (l < 1e-9) continue;
      bounce(s, nx / l, ny / l, pen, E_TYPE, cs.cells.get(cx + ',' + cy).li, qx, qy);
    }
    s.n++;
    // cup: slow balls drop, fast ones lip out (deflected and slowed)
    const dx = s.x - cs.cup.x, dy = s.y - cs.cup.y, dc2 = dx * dx + dy * dy;
    if (dc2 < CUP_R * CUP_R) {
      if (sp < CUP_MAXV) { s.done = 'sunk'; return s; }
      if (!s.lip) { s.lip = true; const d = Math.sqrt(dc2) || 1, tx = -dy / d, ty = dx / d, f = .35 * (dx * s.vy - dy * s.vx > 0 ? 1 : -1);
        s.vx = (s.vx + tx * f * sp) * .8; s.vy = (s.vy + ty * f * sp) * .8; s.hits.push({ li: -3, v: sp, x: s.x, y: s.y }); }
    } else s.lip = false;
    // ink: the ball's centre over a pit cell
    if (cellKind(cs, s.broken, Math.floor(s.x / B), Math.floor(s.y / B)) === 'pit') { s.done = 'inked'; return s; }
    if (sp < STOP) s.done = 'rest';
    else if (s.n >= MAX_STEPS) s.done = 'rest';
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

  const api = { W, H, B, R, DT, MAX_V, CUP_R, CUP_MAXV, FONT, BASE, snap, buildCourse, cellKind, start, step, shoot, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Putt = api;
})(this);
