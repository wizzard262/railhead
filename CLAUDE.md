# Railhead

Repo: private GitHub `wizzard262/railhead`. A browser logistics game: Summer 1941, you run German supply for Army Group Centre against a computer-run Red Army. Original design (not a copy of 1-48TACTIC or any other game).

- After every prompt about the game, add a short summary of it to [PROMPTS.md](PROMPTS.md) (spelling and typos fixed), as its note says
- At the end of each session, record its length in the **Sessions** table at the bottom of PROMPTS.md (keep that table last)
- After each change to the game, save a numbered screenshot in `screenshots/` (`05-short-name.png`, …), taken in a visible browser, then add it to `screenshots/list.json`
  - `node tools/shot.js <name> [days to play] [width]` with the game served at http://localhost:8766/ (`python -m http.server 8766`). It borrows Playwright from `..\harrier-carrier-playwright-tests`
- Run `node tools/test.js` before every commit (headless checks of the rules: same seed same game, nothing negative or out of range, deadlines, sending units). Its fingerprint of 60 games changes only when the rules or numbers change: after a deliberate rules change, paste in the new value it prints
- After a rules change, run `node tools/balance.js` (200 headless games per strategy; `node tools/sweep.js "NAME=value,..."` tries other numbers) and check doing nothing still mostly loses while sensible play wins
- Save every picture the user supplies with a prompt in `prompt-art/` (numbered; git-ignored)
- Plain JavaScript, 2D canvas, classic scripts loaded in order (no modules, no `fetch` in the game), so it also runs straight from the file
  - `js/data.js` the map and every number to tune; `js/sim.js` the rules (no DOM, also runs in Node); `js/draw.js` the staff map; `js/ui.js` the panel, report and pop-ups; `js/main.js` start-up, the end-of-day animation and input
- The version number (`#ver` in `index.html`) goes up by 1 with every commit to the game: `git rev-list --count HEAD` + 1. Put the same number on every script link (`js/ui.js?v=8`), or browsers mix a new page with old cached scripts (the website caches scripts for a day)
- Tone: about trains, trucks and weather. No Nazi symbols or politics; demolitions hit infrastructure only
- Published on harriercarrier.com: a copy lives in `C:\DEV\Repositories\Azure\HarrierCarrierWebsite\railhead` (live at https://www.harriercarrier.com/railhead/index.html), with a banner panel at the bottom of the home page
  - To update it: copy `index.html`, `js/`, `prompts.html`, `PROMPTS.md`, `screenshots.html` and `screenshots/` over that folder, then commit and push the website repo (Azure DevOps; the first push sometimes says Authentication failed, push again)
  - Banner: `node tools/banner.js <folder>` makes `railhead_banner.webp` and `railhead_banner_1440.webp` for the website's `assets/`
