// Headless tests for the rules in js/sim.js: node tools/test.js
// The same file works in Railhead and Beachhead (the Beachhead-only checks are skipped where there are no ports or truck wear)
const fs = require('fs'), vm = require('vm'), path = require('path');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
load('data.js'); load('sim.js');

// Fingerprint of 30 full games per strategy below. It changes only when the rules or numbers change.
// After a deliberate rules change, run the tests and paste the new value it prints here
const FINGERPRINT = 'd25a3866';

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { failed++; console.log('FAIL ', name, '\n      ', e.message); }
}
function assert(ok, message) { if (!ok) throw new Error(message); }

const lineEnd = sec => Sim.LINES[sec.id][Sim.LINES[sec.id].length - 1];

// Strategies: leave everything alone, or play actively (hold to stock up, bombers on recon, send every reserve, move trucks about)
const strategies = {
  idle: () => {},
  active: st => {
    for (const s of st.sectors) {
      const n = Sim.needs(s, 'advance');
      const days = Math.min(s.stock.fuel / n.fuel, s.stock.ammo / n.ammo);
      if (s.front >= lineEnd(s)) s.posture = 'hold';
      else if (s.posture === 'advance' && days < 0.6) s.posture = 'hold';
      else if (s.posture === 'hold' && days >= 2) s.posture = 'advance';
    }
    const target = st.intel && st.intel.sector, groups = BOMBER_GROUPS - st.bombersLost;
    for (const s of st.sectors) s.bombers = target ? (s.id === target ? groups : 0) : Math.floor(groups / st.sectors.length);
    // Free a train from the busiest sector, then send the first reserve unit to the sector furthest behind
    if (st.reserves.length && Sim.freeTrains(st) < UNIT_TYPES[st.reserves[0].type].trains) {
      const busiest = st.sectors.slice().sort((a, b) => b.trains - a.trains)[0];
      if (busiest.trains > 1) busiest.trains--;
    }
    const behind = st.sectors.slice().sort((a, b) => (lineEnd(b) - b.front) - (lineEnd(a) - a.front))[0];
    if (st.reserves.length) Sim.sendUnit(st, st.reserves[0].id, behind.id);
    // Rest the most worn truck column (Beachhead)
    if (Sim.moveTrucks) {
      const worn = st.sectors.slice().sort((a, b) => a.truckCond - b.truckCond)[0];
      if (worn.truckCond < st.restCond - 25) { Sim.moveTrucks(st, worn, -1); Sim.moveTrucks(st, worn, +1); }
    }
  },
};

// Plays one game to the end, calling `each` before every day
function play(seed, strategy, each) {
  const st = Sim.newGame(seed);
  while (!st.won && !st.lost) {
    strategies[strategy](st);
    if (each) each(st);
    Sim.endDay(st);
  }
  return st;
}

// What a finished game looks like, rounded so tiny float differences don't matter
function summary(st) {
  return {
    day: st.day, won: st.won, wonDay: st.wonDay, bombersLost: st.bombersLost,
    fronts: st.sectors.map(s => Math.round(s.front * 100) / 100),
    conds: Object.keys(st.nodes).map(id => Math.round(st.nodes[id].cond)),
    forces: st.sectors.map(s => UNIT_ORDER.map(u => s.forces[u]).join('')),
  };
}

// A short hash of a string (FNV-1a), enough to spot any change
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
}

check('the same seed plays the same game', () => {
  const a = JSON.stringify(summary(play(7, 'active')));
  const b = JSON.stringify(summary(play(7, 'active')));
  assert(a === b, 'two games with seed 7 ended differently');
});

check('rules unchanged (fingerprint of 60 games)', () => {
  const all = [];
  for (const strategy of Object.keys(strategies)) for (let seed = 1; seed <= 30; seed++) all.push(summary(play(seed, strategy)));
  const now = hash(JSON.stringify(all));
  assert(now === FINGERPRINT, `fingerprint is ${now}, expected ${FINGERPRINT}. If you changed the rules on purpose, set FINGERPRINT = '${now}'`);
});

check('nothing goes negative or out of range on any day', () => {
  for (const strategy of Object.keys(strategies)) {
    for (let seed = 1; seed <= 40; seed++) {
      play(seed, strategy, st => {
        const where = `seed ${seed}, ${strategy}, day ${st.day}`;
        assert(Sim.freePool(st, 'trucks', TRUCK_COLUMNS) >= 0, `trucks over-assigned (${where})`);
        assert(Sim.freePool(st, 'engineers', ENGINEERS) >= 0, `engineers over-assigned (${where})`);
        assert(Sim.freePool(st, 'bombers', BOMBER_GROUPS - st.bombersLost) >= 0, `bombers over-assigned (${where})`);
        assert(Number.isInteger(Sim.freeTrains(st)), `free trains not a whole number (${where})`);
        for (const s of st.sectors) {
          for (const k of ['fuel', 'ammo']) {
            assert(Number.isFinite(s.depot[k]) && s.depot[k] >= 0, `${s.id} depot ${k} is ${s.depot[k]} (${where})`);
            assert(Number.isFinite(s.stock[k]) && s.stock[k] >= 0, `${s.id} front ${k} is ${s.stock[k]} (${where})`);
          }
          assert(s.front >= 0 && s.front <= lineEnd(s) + 1e-6, `${s.id} front at ${s.front} km (${where})`);
          if (s.truckCond !== undefined) assert(s.truckCond >= 5 && s.truckCond <= 100, `${s.id} trucks at ${s.truckCond}% (${where})`);
        }
        for (const id in st.nodes) assert(st.nodes[id].cond >= 0 && st.nodes[id].cond <= 100, `${id} station at ${st.nodes[id].cond}% (${where})`);
        if (st.ports) {
          const used = Object.values(st.ports).reduce((a, p) => a + p.companies, 0);
          assert(used <= PORT_COMPANIES, `${used} port companies in use (${where})`);
          for (const id in st.ports) assert(st.ports[id].cond <= 100, `${id} port at ${st.ports[id].cond}% (${where})`);
        }
      });
    }
  }
});

check('every game ends by the deadline', () => {
  for (const level of Object.keys(DIFFICULTY)) {
    const st = Sim.newGame(3, level);
    while (!st.won && !st.lost) Sim.endDay(st);
    assert(st.day <= DIFFICULTY[level].lastDay + 1, `${level} game ran to day ${st.day}`);
    if (st.won) assert(st.wonDay <= DIFFICULTY[level].lastDay, `${level} game won after the deadline`);
  }
});

check('sending a unit and cancelling it gives it back', () => {
  const st = Sim.newGame(5);
  for (const s of st.sectors) s.trains = 0;
  const before = st.reserves.length, unit = st.reserves[0];
  assert(Sim.sendUnit(st, unit.id, st.sectors[0].id), 'unit not sent with every train free');
  assert(st.reserves.length === before - 1 && st.queue.length === 1, 'unit not moved to the loading queue');
  Sim.cancelUnit(st, unit.id);
  assert(st.reserves.length === before && st.queue.length === 0, 'unit not given back');
});

check('a unit cannot be sent without free trains', () => {
  const st = Sim.newGame(5);
  for (const s of st.sectors) s.trains = 99;
  assert(!Sim.sendUnit(st, st.reserves[0].id, st.sectors[0].id), 'unit sent with no free trains');
});

check('day 1 is the campaign start date', () => {
  const expected = START_DATE.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  assert(Sim.dateText(1) === expected, `day 1 shows ${Sim.dateText(1)}`);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
