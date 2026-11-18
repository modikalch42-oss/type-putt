# Type-Putt

The daily word hole. Guess today's five-letter word in 3 tries, then play a mini-golf hole built from it.

1. **Guess the word.** Each guess colours its letters: green for the right spot, ochre for the wrong spot, grey for not in the word.
2. **The word becomes the course.** It's a top-down green with a wooden rail around it. The five letters sit between the tee (bottom) and the cup, so you can never aim straight at the flag. What each letter is depends on your guesses:
   - **right spot:** raised wooden type you can bank off. **Right-spot vowels are rubber** (red): they kick the ball back hard, like a pinball bumper.
   - **wrong spot:** brittle type. It's a wall for one hit, then it crumbles into an ink pit.
   - **missed:** the letter is cut out of the green as **wet ink**, a letter-shaped hazard.

   Guessing well turns hazards into walls you can use.
3. **Kern.** Before your first putt you can slide any solid letter up to 1.5 cells sideways. Use it to open a gap or line up a bank. It can't overlap another letter, the tee, the ball, the cup or an ink dot.
4. **Putt.** Drag back anywhere to aim and set power, with a short dotted preview and a power ring.
   - The ball rolls with friction, and it only drops if it reaches the cup slowly; too fast and it lips out.
   - The cup is tucked into a nook of one of the letters.
   - Rolling into ink is +1 stroke and puts you back at your last spot. You pick up at 10.
5. **Ink dots and warped paper.** Each green has two red ink dots: roll over one for **−1 stroke**. The paper is **warped** with 2–3 hills and dips that bend putts. They're shown by light-from-the-top-left shading and small downhill arrows.

**Score** = strokes − ink dots (minimum 1). **Par** is worked out for your exact course before kerning: the solver's best route plus one.

**Typeface of the day:**

| Day | Typeface | Effect |
| --- | --- | --- |
| Monday | Roman | plain upright type |
| Tuesday, Friday | Italic | letters lean about 11°, so banks come off at an angle |
| Wednesday | Stencil | gaps cut in the long strokes that the ball can slip through |
| Thursday, Saturday | Bold | thick walls, tight gaps |
| Sunday | Bold italic | thick and leaning |

Every daily answer has its own green: letter positions, tee, cup nook, ink dots and warp all change with the word.

**Share text:** `Type-Putt #1 · Stencil | Word: 🟩🟨⬛🟩🟩 | Hole: 3 (Par 4) ⛳ 🔴🔴`

**Daily:** one word and hole per day (#1 = 18 Nov 2026, by local date). Progress, including kerning and collected dots, survives reloads. You also get a countdown to the next hole, stats (played, words solved, streak, aces, score vs par), and an unranked practice mode.

Test hooks:
- `?day=N` opens hole N, unranked.
- `?word=abcde` opens a test hole for any word. Add `&style=italic|bold|stencil|bolditalic` to pick its typeface.

## Files
- `index.html`: the game (word stage, course rendering, kerning, input, daily state, stats).
- `putt.js`: the course model and physics.
  - the 5×7 type and its typefaces;
  - letters in their own (possibly tilted) frames;
  - ball physics: rolling friction, slopes, rail, wood and rubber bounces, ink, ink dots, cup capture and lip-outs;
  - a shot solver.

  It uses only arithmetic and square roots. Italic uses an exact rational rotation and slopes use polynomial bumps, so shots behave identically everywhere.
- `words.js`: generated. It holds the daily answers in a fixed shuffled order, each answer's green, and every five-letter word accepted as a guess.
- `tools/answers.txt`: hand-picked daily answers. `tools/allowed.txt`: five-letter words from the MIT-licensed [`word-list`](https://github.com/sindresorhus/word-list) package (licence in `tools/allowed-LICENSE.txt`).
- `tools/layouts.js` → `tools/layouts.json`: builds a green for every daily slot. The day's typeface comes from its weekday. It then places the letters, the tee and a cup in a letter nook, adds two ink dots well off the tee-to-cup line, and adds a warp. A green is kept only if:
  - nothing overlaps, and the tee and dots are on open grass;
  - the straight line from tee to cup runs into a letter other than the cup's own;
  - the solver can finish it in 2–4 strokes with every letter solid, and in at most 5 with every letter missed.

  It takes about 2.5 minutes for all 603 days. `node tools/layouts.js FROM TO out.json` builds a range, and `tools/merge-layouts.js` merges range files.
- `tools/build-words.js`: rebuilds `words.js` from the answers, layouts and dictionary.
- `tools/check.js`: re-checks every shipped green with the solver (run it after changing `putt.js`).
