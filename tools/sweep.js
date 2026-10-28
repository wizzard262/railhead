// Tries different values of the numbers in js/data.js and plays each set with a few strategies:
// node tools/sweep.js "SHORT_SUPPLY=0.2,WELL_SUPPLIED=1.25" "LEVEL=hard" ...
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

const strategies = {
  idle: () => {},
  recon: st => {
    const t = st.intel && st.intel.sector, nb = BOMBER_GROUPS - st.bombersLost;
    for (const s of st.sectors) s.bombers = t ? (s.id === t ? nb : 0) : 2;
  },
  // Hold when the front is nearly out and can't be resupplied fast enough, advance again once stocked
  pulse: st => {
    for (const s of st.sectors) {
      if (s.front >= Sim.LINES[s.id].at(-1)) { s.posture = 'hold'; continue; }
      const n = Sim.needs(s, 'advance');
      const days = Math.min(s.stock.fuel / n.fuel, s.stock.ammo / n.ammo);
      const short = Sim.truckCapacity(st, s) < n.fuel + n.ammo;
      if (s.posture === 'advance' && days < 0.6 && short) s.posture = 'hold';
      else if (s.posture === 'hold' && days >= 2) s.posture = 'advance';
    }
  },
};
strategies.pulseRecon = st => { strategies.pulse(st); strategies.recon(st); };
// Hold whenever the front is nearly out, and only go again with 4 days in hand for the big push
strategies.build4 = st => {
  for (const s of st.sectors) {
    if (s.front >= Sim.LINES[s.id].at(-1)) { s.posture = 'hold'; continue; }
    const n = Sim.needs(s, 'advance');
    const days = Math.min(s.stock.fuel / n.fuel, s.stock.ammo / n.ammo);
    if (s.posture === 'advance' && days < 0.8) s.posture = 'hold';
    else if (s.posture === 'hold' && days >= 4) s.posture = 'advance';
  }
};
strategies.build4Recon = st => { strategies.build4(st); strategies.recon(st); };

for (const arg of process.argv.slice(2).length ? process.argv.slice(2) : ['']) {
  let data = read('data.js');
  let level = 'normal';
  for (const kv of arg.split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    if (k === 'LEVEL') { level = v; continue; }   // easy, normal or hard
    data = data.replace(new RegExp(`const ${k} = [^;]+;`), `const ${k} = ${v};`);
  }
  const ctx = vm.createContext({ Math, Date, console, module: undefined });
  vm.runInContext(data + '\n' + read('sim.js') + '\nthis.Sim = Sim; this.BOMBER_GROUPS = BOMBER_GROUPS;', ctx);
  global.Sim = ctx.Sim; global.BOMBER_GROUPS = ctx.BOMBER_GROUPS;
  const out = [];
  for (const [name, play] of Object.entries(strategies)) {
    let wins = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const st = ctx.Sim.newGame(seed, level);
      while (!st.won && !st.lost) { play(st); ctx.Sim.endDay(st); }
      if (st.won) wins++;
    }
    out.push(`${name} ${Math.round(wins / 1.5)}%`);
  }
  console.log((arg || 'as is').padEnd(50), out.join('  '));
}
