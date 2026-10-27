# Railhead

A browser logistics game: Summer 1941, you run German supply for Army Group Centre against a computer-run Red Army. Original design (not a copy of 1-48TACTIC or any other game).

- After every prompt about the game, add a short summary of it to [PROMPTS.md](PROMPTS.md) (spelling and typos fixed), as its note says
- At the end of each session, record its length in the **Sessions** table at the bottom of PROMPTS.md (keep that table last)
- After each change to the game, save a numbered screenshot in `screenshots/` (`05-short-name.png`, …), taken in a visible browser, then add it to `screenshots/list.json`
  - `node tools/shot.js <name> [days to play] [width]` with the game served at http://localhost:8766/ (`python -m http.server 8766`). It borrows Playwright from `..\harrier-carrier-playwright-tests`
- After a rules change, run `node tools/balance.js` (200 headless games per strategy) and check doing nothing still mostly loses while sensible play wins
- Save every picture the user supplies with a prompt in `prompt-art/` (numbered; git-ignored)
- Plain JavaScript, 2D canvas, classic scripts loaded in order (no modules, no `fetch` in the game), so it also runs straight from the file
  - `js/data.js` the map and every number to tune; `js/sim.js` the rules (no DOM, also runs in Node); `js/draw.js` the staff map; `js/ui.js` the panel, report and pop-ups; `js/main.js` start-up, the end-of-day animation and input
- The version number (`#ver` in `index.html`) goes up by 1 with every commit to the game: `git rev-list --count HEAD` + 1
- Tone: about trains, trucks and weather. No Nazi symbols or politics; demolitions hit infrastructure only
