# Type-Putt

The daily word hole. Guess today's five-letter word in 3 tries, then play a mini-golf hole built from it.

1. **Guess the word.** Each guess colours its letters: green for the right spot, ochre for the wrong spot, grey for not in the word.
2. **The word becomes the course.** It's a top-down green with a wooden rail around it. The five letters sit in two staggered rows between the tee (bottom) and the cup (top), so you can never aim straight at the flag. You weave through the gaps and bank off the rail and the letters. What each letter is depends on your guesses:
   - **right spot:** a raised wooden wall that blocks you but is great to bank off;
   - **wrong spot:** brittle type, a wall for one hit that then crumbles into an ink pit;
   - **missed:** the letter is cut out of the green as **wet ink**, a letter-shaped hazard.

   Guessing well turns hazards into walls you can use.
3. **Putt.** Drag back anywhere to aim and set power, with a short dotted preview and a power ring. The ball rolls with friction and only drops if it reaches the cup slowly; too fast and it lips out. Rolling into ink is +1 stroke and puts you back at your last spot. You pick up at 10. **Par** is worked out for your exact course by the solver (its best route plus one).

Every daily answer has its own green. Letter positions, tee and cup shift with the word.

**Share text:** `Type-Putt #1 | Word: 🟩🟨⬛🟩🟩 | Hole: 3 Strokes (Par 3) ⛳`

**Daily:** one word and hole per day (#1 = 18 Nov 2026, by local date). Progress survives reloads. You also get a countdown to the next hole, stats (played, words solved, streak, aces, score vs par), and an unranked practice mode. `?word=abcde` opens a test hole.

## Files
- `index.html`: the game (word stage, top-down course rendering, input, daily state, stats).
- `putt.js`: the 5×7 type face, course building, the ball physics (rolling friction, rail and letter bounces, ink, cup capture and lip-outs) and a shot solver. It uses only arithmetic and square roots, so shots behave identically everywhere.
- `words.js`: generated. It holds the daily answers in a fixed shuffled order, each answer's green, and every five-letter word accepted as a guess.
- `tools/answers.txt`: hand-picked daily answers. `tools/allowed.txt`: five-letter words from the MIT-licensed [`word-list`](https://github.com/sindresorhus/word-list) package (licence in `tools/allowed-LICENSE.txt`).
- `tools/layouts.js` → `tools/layouts.json`: builds a green for every answer and keeps it only if:
  - the tee and cup are on open grass;
  - the straight line between them runs into at least two letters;
  - the solver can finish it in 2–4 strokes with every letter solid, and in at most 5 with every letter missed.

  Takes about 80 s. Currently every green needs at least 2 strokes with all walls (91 need 3), and 225 need 3 when every letter is ink.
- `tools/build-words.js`: rebuilds `words.js` from the answers, layouts and dictionary.
- `tools/check.js`: re-checks every shipped green with the solver (run it after changing `putt.js`).
