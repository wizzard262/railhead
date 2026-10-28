// Plays 200 games headless with simple strategies, to check the balance: node tools/balance.js
const fs = require('fs'), vm = require('vm');
const path = require('path');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
load('data.js'); load('sim.js');
function run(name, setup, each) {
  const days = []; let wins = 0; const lim = {};
  for (let seed = 1; seed <= 200; seed++) {
    const st = Sim.newGame(seed); setup && setup(st);
    while (!st.won && !st.lost) { each && each(st); Sim.endDay(st); for (const s of st.sectors) lim[s.id + ':' + s.limit] = (lim[s.id + ':' + s.limit] || 0) + 1; }
    if (st.won) { wins++; days.push(st.wonDay); }
  }
  days.sort((a, b) => a - b);
  console.log(name.padEnd(28), 'won', wins, 'median', days[days.length >> 1], ' limits/game', Object.entries(lim).sort().map(([k, v]) => k + ' ' + (v / 200).toFixed(0)).join(' '));
}
const end = s => Sim.LINES[s.id].at(-1);
// Hold a sector once its objective is taken; advance again if it gets pushed back off it
const holdDone = st => { for (const s of st.sectors) { if (s.front >= end(s)) s.posture = 'hold'; else if (s.posture === 'hold' && s.done) s.posture = 'advance'; s.done = s.front >= end(s); } };
run('idle', null, null);
// Bombers where air recon reports the Soviet build-up
run('bombers to recon', null, st => {
  holdDone(st);
  const t = st.intel && st.intel.sector, nb = BOMBER_GROUPS - st.bombersLost;
  for (const s of st.sectors) s.bombers = t ? (s.id === t ? nb : 0) : 2;
});

// Hold when the front is nearly out and trucks can't keep up, advance again once 2 days are in hand
const holdSmart = st => {
  holdDone(st);
  for (const s of st.sectors) {
    if (s.front >= end(s)) continue;
    const n = Sim.needs(s, 'advance');
    const days = Math.min(s.stock.fuel / n.fuel, s.stock.ammo / n.ammo);
    const short = Sim.truckCapacity(st, s) < n.fuel + n.ammo;
    if (s.posture === 'advance' && days < 0.6 && short) s.posture = 'hold';
    else if (s.posture === 'hold' && days >= 2) s.posture = 'advance';
  }
};
run('hold when short', null, holdSmart);
run('hold when short + recon', null, st => {
  holdSmart(st);
  const t = st.intel && st.intel.sector, nb = BOMBER_GROUPS - st.bombersLost;
  for (const s of st.sectors) s.bombers = t ? (s.id === t ? nb : 0) : 2;
});

