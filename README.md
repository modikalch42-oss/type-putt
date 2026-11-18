# Type-Putt

The daily word hole. Guess today's five-letter word in 3 tries, then putt a golf ball across it.

1. **Guess the word.** Each guess colours its letters: green for the right spot, ochre for the wrong spot, grey for not in the word.
2. **The word becomes the course.** It's set in big wooden type standing over an ink pit:
   - letters you got in the right spot are **solid type**;
   - letters you found in the wrong spot are **brittle** and shatter after one hit;
   - letters you missed are **dashed outlines**, and the ball falls straight through them.

   The line is **locked up like real type**: wooden spacer posts stand between the letters, and a brass rule runs just above them. So you putt *along* the word rather than lobbing over it, and every letter's shape matters: A's peak, U's dip, the notch where two letters meet. Letter 2 is the first ground you cross. A better word gives you more to stand on and bank off. Every daily word is checked: with every letter missed the best route is 4 strokes (hopping post to post), and with every letter set it's 1–2. Par is 2 if you set every letter, 3 with three or four, 4 with one or two, and 5 with none.
3. **Putt.** Drag back anywhere to aim (a dotted line previews the shot), then let go. The tee box sits on top of the first letter. The cup sits in the last letter, at the bottom of its centre column (inside the loop of an O, at the foot of an L), with a shaft cut above it. Falling in the ink is +1 stroke and puts you back at your last spot. You pick up at 10.

**Share text:** `Type-Putt #1 | Word: 🟩🟨⬛🟩🟩 | Hole: 3 Strokes (Par 3) ⛳`

**Daily:** one word and hole per day (#1 = 18 Nov 2026, by local date). Progress survives reloads. You also get a countdown to the next hole, stats (played, words solved, streak, aces, score vs par), and an unranked practice mode. `?word=abcde` opens a test hole.

## Files
- `index.html`: the game (word stage, course rendering, input, daily state, stats).
- `putt.js`: the 5×7 wood-type face, course building and the ball physics. It uses only arithmetic and square roots, so shots behave identically everywhere, including in the checker.
- `words.js`: generated. It holds the daily answers in a fixed shuffled order, plus every five-letter word accepted as a guess.
- `tools/answers.txt`: hand-picked daily answers. `tools/allowed.txt`: five-letter words from the MIT-licensed [`word-list`](https://github.com/sindresorhus/word-list) package (licence in `tools/allowed-LICENSE.txt`).
- `tools/check.js`: for every answer, searches stroke-by-stroke routes and checks that the hole can be finished both with every letter missed and with every letter solid, reporting the fewest strokes found.
- `tools/build-words.js`: rebuilds `words.js`, optionally dropping words that failed the check. Usage: `node tools/check.js tools/answers.txt 9999 bad.json` then `node tools/build-words.js bad.json`.
