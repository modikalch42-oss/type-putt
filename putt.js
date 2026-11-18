/* Type-Putt course + physics. Deterministic (only + - * / and Math.sqrt in the simulation),
   so the same shot behaves identically in every browser and in tools/check.js.

   The course is the day's word set in big 5x7 "wood type" blocks standing over an ink pit.
   Letter states come from the word game:  solid (found in place) · brittle (found, wrong spot:
   breaks after one hit) · wire (missed: the ball passes straight through).
   The line is locked up like real type: wooden spacer posts stand between the letters and a brass
   rule runs across the top, so the letters are the ground you putt along, not scenery to lob over.
   The tee sits on a tee box on top of the first letter. The cup sits in the last letter at the
   bottom of its centre column (inside the loop of an O, at the foot of an L), with a shaft cut
   above it so it can always be reached from the sky. */
(function (root) {
  const B = 20, COLS = 31, W = 620, H = 400, TOP = 170;           // block size, world size, letter top
  const R = 6, G = 900, DT = 1 / 240, MAX_V = 540, MAX_STEPS = 240 * 14;
  const CEIL_Y = TOP - 36;                                          // the brass rule across the top: no lobbing over the word
  const PIT_Y = TOP + 7 * B + 30;                                    // fall below this = inked
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
  const letterX = i => 20 + i * 6 * B;                               // left edge of letter i

  // the cell (row) in a glyph's centre column where the tee / cup sits: lowest empty cell with a block below,
  // or on top of the letter if the column is solid all the way up (T, I)
  function seat(glyph) {
    for (let r = 5; r >= 0; r--) if (glyph[r][2] === '.' && glyph[r + 1][2] === '#') return r;
    return -1;
  }

  // states: array of 5 of 'solid' | 'brittle' | 'wire'
  function buildCourse(word, states) {
    word = word.toUpperCase();
    const blocks = [];                                               // {c, r, x, y, li, pad}
    const grid = new Map();                                          // "c,r" -> block
    let tee = null, cup = null;
    for (let li = 0; li < 5; li++) {
      const glyph = FONT[word[li]].map(s => s.split(''));
      // tee: a tee box on top of the first letter (launching from inside a bowl can't get anywhere).
      // cup: at the bottom of the last letter's centre column, with a shaft cut above it.
      const seatRow = li === 0 ? -1 : seat(glyph);
      if (li === 0) glyph[0][2] = '#';                               // make sure there's a block to tee off
      if (li === 4) for (let r = 0; r < seatRow; r++) glyph[r][2] = '.';
      const c0 = letterX(li) / B | 0;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (glyph[r][c] !== '#') continue;
        const padRow = seatRow + 1;                                  // the block the tee / cup rests on
        const pad = (li === 0 || li === 4) && c === 2 && r === (seatRow === -1 ? 0 : padRow);
        const b = { c: c0 + c, r, x: (c0 + c) * B, y: TOP + r * B, li, pad };
        blocks.push(b); grid.set(b.c + ',' + r, b);
      }
      const cx = (c0 + 2) * B + B / 2, cy = TOP + seatRow * B;       // top-left y of the seat cell
      // wooden spacer posts lock the line up: one full-height post either side of every letter
      for (const pc of li === 4 ? [c0 - 1, c0 + 5] : [c0 - 1]) for (let r = 0; r < 7; r++) {
        if (grid.has(pc + ',' + r)) continue;
        const b = { c: pc, r, x: pc * B, y: TOP + r * B, li: -1, pad: true, post: true };
        blocks.push(b); grid.set(pc + ',' + r, b);
      }
      if (li === 0) tee = { x: cx, y: cy + B - R - .01, col: c0 + 2, row: seatRow };
      if (li === 4) cup = { x: (c0 + 2) * B, y: cy, col: c0 + 2, row: seatRow };
    }
    return { word, states: states.slice(), blocks, grid, tee, cup };
  }

  const solidAt = (course, broken, c, r) => {
    const b = course.grid.get(c + ',' + r);
    if (!b) return null;
    if (b.pad) return b;
    const st = course.states[b.li];
    if (st === 'wire' || (st === 'brittle' && broken[b.li])) return null;
    return b;
  };

  function start(course, x, y, vx, vy, broken) {
    const sp = Math.sqrt(vx * vx + vy * vy); if (sp > MAX_V) { vx = vx / sp * MAX_V; vy = vy / sp * MAX_V; }
    return { course, x, y, vx, vy, n: 0, still: 0, done: null, hits: [], broken: broken ? broken.slice() : [false, false, false, false, false], breakNow: [] };
  }

  function step(s) {
    const cs = s.course; s.hits = []; s.breakNow = [];
    s.vy += G * DT; s.x += s.vx * DT; s.y += s.vy * DT;
    if (s.x < R) { s.x = R; if (s.vx < 0) s.vx = -s.vx * .5; }
    if (s.x > W - R) { s.x = W - R; if (s.vx > 0) s.vx = -s.vx * .5; }
    if (s.y < CEIL_Y + R) { s.y = CEIL_Y + R; if (s.vy < 0) { if (-s.vy > 60) s.hits.push({ li: -2, v: -s.vy, x: s.x, y: CEIL_Y, pad: true }); s.vy = -s.vy * .42; } }
    let touching = false;
    const c0 = Math.floor((s.x - R) / B), c1 = Math.floor((s.x + R) / B), r0 = Math.floor((s.y - R - TOP) / B), r1 = Math.floor((s.y + R - TOP) / B);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const b = solidAt(cs, s.broken, c, r); if (!b) continue;
      const qx = s.x < b.x ? b.x : s.x > b.x + B ? b.x + B : s.x, qy = s.y < b.y ? b.y : s.y > b.y + B ? b.y + B : s.y;
      let nx = s.x - qx, ny = s.y - qy; const d2 = nx * nx + ny * ny;
      if (d2 >= R * R) continue;
      let pen;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx /= d; ny /= d; pen = R - d; }
      else { nx = 0; ny = -1; pen = R; }
      // ignore faces shared with a neighbouring block, so the ball rolls smoothly over seams
      if (nx < 0 && solidAt(cs, s.broken, c - 1, r)) nx = 0;
      if (nx > 0 && solidAt(cs, s.broken, c + 1, r)) nx = 0;
      if (ny < 0 && solidAt(cs, s.broken, c, r - 1)) ny = 0;
      if (ny > 0 && solidAt(cs, s.broken, c, r + 1)) ny = 0;
      const l = Math.sqrt(nx * nx + ny * ny); if (l < 1e-9) continue; nx /= l; ny /= l;
      s.x += nx * pen; s.y += ny * pen; touching = true;
      const vn = s.vx * nx + s.vy * ny;
      if (vn < 0) {
        const e = -vn > 90 ? .42 : 0;
        s.vx -= (1 + e) * vn * nx; s.vy -= (1 + e) * vn * ny;
        const tx = -ny, ty = nx, vt = s.vx * tx + s.vy * ty, f = 1 - 2.4 * DT;   // rolling friction
        s.vx -= tx * vt * (1 - f); s.vy -= ty * vt * (1 - f);
        if (-vn > 60) s.hits.push({ li: b.li, v: -vn, x: qx, y: qy, pad: b.pad });
        if (!b.pad && cs.states[b.li] === 'brittle' && !s.broken[b.li]) { s.broken[b.li] = true; s.breakNow.push(b.li); }
      }
    }
    s.n++;
    const cup = cs.cup;
    if (s.x > cup.x - 2 && s.x < cup.x + B + 2 && s.y > cup.y + 4 && s.y < cup.y + B + 2) s.done = 'sunk';
    else if (s.y > PIT_Y) s.done = 'inked';
    else if (s.n >= MAX_STEPS) s.done = 'rest';
    else if (touching && s.vx * s.vx + s.vy * s.vy < 64) { if (++s.still > 72) s.done = 'rest'; }
    else s.still = 0;
    return s;
  }

  function shoot(course, x, y, vx, vy, broken, keepPath) {
    const s = start(course, x, y, vx, vy, broken), path = [];
    while (!s.done) { step(s); if (keepPath && s.n % 4 === 0) path.push([s.x, s.y]); }
    return { res: s.done, x: s.x, y: s.y, broken: s.broken, path, steps: s.n };
  }

  const api = { B, COLS, W, H, TOP, R, G, DT, MAX_V, PIT_Y, CEIL_Y, FONT, letterX, seat, buildCourse, solidAt, start, step, shoot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Putt = api;
})(this);
