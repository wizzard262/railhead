# Railhead: the prompts

> **Note for Claude:** every time a prompt is given to work on this game, add a short summary of it here (spelling and typos fixed), newest at the bottom. Include any decisions made in reply to your questions. Keep summarising as much as possible: this file is the history of how the game was made, and the game links to it (top right, **prompts**).

## 1. The idea (2026-10-27)

- Started from 1-48TACTIC (a WWII skirmish miniatures game by Baueda). No copy of it, even renamed or with "very similar" rules: only an original design or Steve's own rules
- Then: a grand strategy game about **logistics, not battles**. What exists (Unity of Command, Shadow Empire, Foxhole, Gary Grigsby's War in the East) and what we could make
- We play the **Germans on the Eastern Front**: train tracks, scorched earth, winter, airdrops
- **1 player against a computer-run Red Army**
- View: **top-down staff map** (not isometric)
- Also wanted, later: airlifts (Demyansk, Stalingrad), bomber runs on Soviet rail, troops and artillery as cargo, damage that cuts capacity (a bombed station stops the trains short)
- No Nazi symbols or politics; German demolitions in 1943 hit infrastructure only

## 2. Build the MVP

- Make the minimum viable product first: what is the core of the game?
- Folder: `C:\DEV\Repositories\GitHub\railhead`, local git only for now (GitHub later)
- MVP core chosen: **B, supply + forces**: rail (gauge conversion, railheads), trucks, engineers and bombers; trains carry fuel and ammo **and** infantry, panzers and artillery; the generals fight. One campaign: Summer 1941. Not yet: weather, airlifts, partisans, later campaigns

## Sessions

| # | Date | Length | What we did |
|---|------|--------|-------------|
| 1 | 2026-10-27 | about 120 min | Prompts 1–2: the idea and design, then the MVP: staff map from Warsaw to Smolensk, three sectors, trains, gauge conversion, trucks, engineers with a focus, bombers, reserves sent by train, Soviet build-ups, counterattacks, air raids and scorched earth, a headless balance check |
