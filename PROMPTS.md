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

## 3. Is it derivative? I'm not sure I understand it

- It's very good, but is it derivative of anything? And I'm not sure I understand it
- Answer: an original design; it shares the genre and the real history (railheads, broad gauge) with games like Unity of Command, but there you move the armies and here you only run the supply chain
- Offered four ways to make it easier to learn; Steve picked **B** and **C**

## 4. Adviser line and supply pipe (B + C)

- **B:** each sector card has an adviser line: the most urgent thing to fix, with numbers (e.g. "Trucks carry 600 of the 1,140 t a day… add 3 trucks, take 2 from Centre"), coloured green, amber or red
- **C:** each sector card shows its pipe: Warsaw → trains → railhead depot → trucks → front. Each pipe is green, amber or red by how well it keeps up, and the narrowest one is labelled
- Reserves grouped by type (e.g. "3 × Infantry division")

## 5. Publish it on harriercarrier.com

- Publish it at the bottom of the Harrier Carrier home page, like Swooping Simulator. Steve will play it on his laptop later
- Stop. First make it easy to find the start-screen pop-up again, then publish
  - **📖 How to play** is now a bright orange button at the top, there's an orange **?** next to End day, and **H** opens it; the pop-up says so

## 6. Layout on one page, mix and focus buttons, distances on the map

- Engineer focus is now **🛤️ Track | Balanced | Station 🚉**, with each icon at its own end
- The fuel/ammo mix is 5 buttons in the same style, **⛽ 4:1 | 2:1 | 1:1 | 1:2 | 1:4 💥**; the one that matches what the sector uses is underlined in green (replaces the slider and Match needs)
- The three sector panels sit at the bottom as full-width rows, with their fields laid out side by side, so it all fits on one laptop screen; the map is wider and flatter (1000 × 425) with everything on it moved to fit
- **End day** (and the **?**) sit at the top right of the map
- The **free to assign** counts are above the sector rows, each over its own resource column
- Hover a station to see its stocks (the depot held there), its trains a day against what it can take, and for Soviet-held stations how far ahead of the front they are
- On the map: each line shows the next station and how far the front still has to go (e.g. "Minsk 45 km ▸")
- Trains can now run past their last station to the end of the converted track; the map flag moves there with "+42 km laid", and the supply line shows "+42 km past it". Track conversion slowed a little (2.5 → 1.9 km per battalion a day) to keep the balance (doing nothing wins 40%, bombing reported build-ups 77%)
- On the website: the Google Play badge on the Showdown panel is twice the size, and Railhead's picture is on the portfolio page under Battle of Hoth (it was already in the portfolio list)

## 7. Hold shouldn't kill your chances

- Leaving everything on default and pressing End day won; tuning it didn't, and any Hold seemed to ruin the game
- Are resources only kept at the front-most station? (Yes: each sector has one depot at its railhead, plus the stocks with the troops at the front; stations behind only pass trains through)
- Changes so Hold is worth using:
  - Trucks keep the front topped up to 3 days of **advancing** even while it holds (before, a holding sector barely built up)
  - Advancing on a trickle is wasted: below 40% of a day's needs a sector can't advance, and speed climbs to full from there
  - A front with 2 days in hand after today pushes 30% faster
  - A sector on Hold is dug in: defence +60%, and the Soviets are less likely to pick it
  - The adviser says when to Hold and when to Advance again; How to play explains it
  - Deadline moved from 4 to 10 August to make room for pauses
  - Balance (200 games each): doing nothing 38%, holding when short 45%, bombing reported build-ups 72%, both 73%
- The live game looked broken on Steve's laptop: the browser mixed the new page with yesterday's cached scripts. The scripts now carry the version number (`js/ui.js?v=8`), so a new version always loads fresh

## 8. Stretch the map

- Stretch the map to 100% of the width available (keep the reserves and report panels), and spread the stations to fill the map from left to right and top to bottom
- The map now fills its whole box; the stations' corners (Warsaw, Roslavl, Polotsk, Brest) sit just inside its edges

## 9. Train and truck legs in the supply line

- Between the railhead station and the front, show two arrows: the train going on past the station to the end of the track, then the truck for the rest
- Train arrows dashed black like good track, truck arrows dashed brown (instead of green); the label colour still shows whether each part keeps up

## 10. Cleaner map

- Remove the distances from the map (the "km laid" and next-station tags)
- Move the North, Centre and South badges further back, as speech bubbles whose tail points exactly at their front

## 11. Smaller report

- Yesterday's report was always too big: make it half the size so all the reserves show without scrolling
- The report now takes a quarter of the side column; each reserve is one line with its cost (trains, then tons a day) beside the name

## 12. Row layout and a spread-out map

- Vertical lines between each section of the North, Centre and South rows: name | supply line | trains | trucks | engineers | mix | bombers
- The train mix moved one place left (bombers now on the right) and down, in line with the engineers' focus buttons
- Warsaw higher and the other stations spread wider top to bottom; smaller Pripet marshes; real geography doesn't matter. Stations now sit on a hand-made board layout, with the rivers redrawn to pass the right towns, and the map's subtitle dropped so it doesn't clash with the border

## 13. End-of-track mark

- Don't push yet: more changes coming
- Where the track meets the road, put a mark like this: -----|-------
- The supply line now has a short upright bar where the dashed black train leg ends and the dashed brown truck leg starts

## 14. Slower trains and lorries

- The animated blobs that move along the track and road at the end of each day: make them much slower, and use train and truck icons
- They now roll for about 3 seconds (was under 1): small steam engines in each sector's colour, with smoke, from Warsaw to the end of the track, then field-grey lorries to the front; each faces the way it travels
- Pressing End day or Enter again skips the rest of the animation

## 15. Same icons, all facing right

- Make the trains and trucks all face right, and use the same icons and colours as the rest of the game when they move along the track and road
- The animation now uses the 🚂 and 🚚 from the sector rows, mirrored so they face right (east, towards the front)

## 16. Shorter animation, same speed

- Keep the trains' and trucks' speed but halve the animation's length: it now runs 1.6 seconds and they cover half their route
- Do the bars on the North, Centre and South badges show a storage limit at the front? (A full bar is 3 days of advancing, the most the trucks will stock at the front. Fixed: a holding sector's bars used its smaller holding needs, so they looked full too early)

## 17. Every train and truck faces right

- Make all the truck and train icons face right: in the rows, headers, supply line, advice, report, reserves and How to play (the emoji face left, so they are mirrored)

## 18. Days in hand, and badges that keep clear

- On the map badges, draw the fuel and ammo icons in front of the two bars, then the bar, then the days in hand (e.g. "1.3 d"); repeat this layout in the Front box of each sector row below
- Don't let the North, Centre and South badges overlap, don't let them cover any station, move them right over the front if needed, and don't let a badge hide its neighbour's arrow
- Each badge now tries spots round its front (German side first, the Soviet side if needed) and takes the closest one that covers no station or station name, no other badge, and no other badge's tail, with its own tail kept off stations where it can

## 19. Flags clear, towns on fire

- Don't let the badges cover the railhead flags either
- Show each station as a small or large town; when damaged, flames and smoke come off it, more for more damage
- Towns are drawn in ink (German-held) or red (Soviet-held), with a church spire in the big ones; from about 10% damage a town shows flames, and smoke rises higher and darker as damage grows; a destroyed station is a tower of smoke
- Railhead flags now stand just left of their town so the buildings stay clear

## 20. Badges in order, a roomier report

- Where possible keep the North badge at the top, Centre in the middle and South below
- The three badges are now placed together: the best few spots for each are tried in every combination, and the winner has no overlaps or hidden tails and keeps North above Centre above South
- Is Yesterday's report large enough for its text now? (Not on busy days.) The report now takes all the room the reserves don't need, its text is a little smaller, and the side column is a little wider: a seven-line day fits without scrolling

## 21. Reserves you can see

- Show icons for the reserves stacked up next to Warsaw, one for each unit, so 2 infantry show 2 icons
- In the first box of each sector row, list the forces with an icon: Inf: 4, Pz: 1, Art: 7
- The icons should be pictures: a soldier, a tank and an artillery gun
- Reserves now stand beside Warsaw as little pictures (a soldier, a tank, a field gun), one per unit and a row per type, overlapping a little when there are many; hovering them shows Warsaw's tooltip. The same pictures head the force list in each sector row, the reserves box and the map legend

## 22. Reserves live, and the next station

- On the live game the reserves waiting at Warsaw didn't show: the version with them drawn beside Warsaw hadn't been published yet (now it is)
- After the front in each row, show a line to the next station: a dashed red line (Soviet track) with the distance and the station's name, 🎯 if it's an objective, 🏁 once the line is taken
- The rows fit smaller laptop screens without scrolling sideways (a more compact supply line below 1500 px wide, stacked rows below 1300 px)
- "coming: Inf loading": the unit pictures now show there too, and in the loading list under the reserves

## 23. Station health bar

- Show the station's % in its box in each row's supply line as a health bar: green, amber or red, the same as the bar under the town on the map

## 24. Rebalance: Hold that pays

- Playing on defaults without sending anything still won more than half the time; tuning seemed to make it worse; any Hold felt like wasted pushing time. How can we rebalance? (Options offered: no free defaults, units wearing down, overreach punished, stars)
- Steve's pick: make holding more significant, so a sector can repair and build up resources
- A sector on Hold now:
  - has its engineers working 1.5× as fast (repairs and track)
  - gets trucked up to 5 days of advancing at the front (3 while advancing)
  - wears the Soviets down with its guns (more with artillery)
  - stays dug in (defence +60%)
- Every day of fuel and ammo in hand makes the next push faster (+8% a day, up to +32% with 4 days), so a pause and a big push beats crawling on a trickle
- Days in hand are always counted in days of advancing, so they read the same on Hold
- Deadline 10 → 8 August
- Balance (200 games each): defaults alone 17%, bombing reported build-ups 44%, holding when short 87%, both 99%

## 25. Pick a level

- It feels too hard now, though very close; on defaults it was too easy. Not sure what the balance should be
- Chosen: pick a level each game, on the How to play screen: **Easy** (deadline 12 August: leaving everything alone wins about 45%), **Normal** (10 August, the default: about 34%, good play 81–100%), **Hard** (8 August: about 17%)
- The level is remembered on this computer; choosing one before the first End day starts that game again at the new level, later it applies to the next New game. The header shows it (e.g. "Day 3 of 50 · Normal")

## 26. Marsh to the edge

- Redraw the Pripet marshes so they reach the bottom of the map

## 27. Balanced engineers that finish repairs

- Engineers on Balanced, but after a day both bombed stations on that line stayed at 70%
- That was Balanced's old rule: repair up to 70%, then lay track, and only finish repairs with whatever was left. Now **Balanced** fixes anything below 50% first, then splits the rest **half on repairs up to 100%, half on track** (one side's spare goes to the other). **Track** still only patches stations under 25%; **Station** still repairs everything first
- New balance (200 games each, leaving everything alone / bombing build-ups / holding when short / both): Easy 36 / 96 / 89 / 100%, Normal 26 / 78 / 83 / 99%, Hard 9 / 21 / 67 / 91%. Level hints updated
- Steve: leave it as it was (he hadn't known Balanced stops at 70%). Put back: Balanced repairs stations up to 70%, then lays track, then finishes repairs with what's left

## 28. Legend tidy

- Removed "■ big station" from the legend: the town pictures on the map already show the big cities

## 29. Whole trains

- The free trains count could show a long fraction while a unit was part-way through loading: it now rounds down to whole trains

## Sessions

| # | Date | Length | What we did |
|---|------|--------|-------------|
| 1 | 2026-10-27 | about 150 min | Prompts 1–5: the idea and design, then the MVP: staff map from Warsaw to Smolensk, three sectors, trains, gauge conversion, trucks, engineers with a focus, bombers, reserves sent by train, Soviet build-ups, counterattacks, air raids and scorched earth, a headless balance check; then an adviser line and a supply pipe on each sector card; How to play easy to find again; published on harriercarrier.com |
| 2 | 2026-10-28 | about 310 min | Prompts 6–27: everything on one page with the sector rows at the bottom, mix and focus buttons, station stocks on hover, distances to the next station, trains running to the end of the converted track; a bigger Google Play badge and Railhead on the portfolio; Hold made worth using; versioned scripts; the map stretched to fill its box; train and truck legs; speech-bubble badges; a smaller report; row separators and a spread-out board map |
| 3 | 2026-10-28 | about 25 min | Prompt 21: reserves drawn beside Warsaw, one picture per unit, and soldier, tank and gun icons on the force lists |
