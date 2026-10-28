// Railhead: the rules. No drawing here, so it also runs headless (tools/balance.js)

const Sim = (() => {
  // Seeded random numbers, so a game can be replayed
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Rail distance between two stations (straight line plus 15% for curves)
  function railKm(a, b) {
    const A = NODES[a], B = NODES[b];
    const dx = (B.lon - A.lon) * 65, dy = (B.lat - A.lat) * 111;
    return Math.round(Math.hypot(dx, dy) * 1.15);
  }

  const linkKey = (a, b) => a + '|' + b;

  // Each sector's line with the distance of every station from Warsaw
  const LINES = {};
  const LINKS = {};
  for (const s of SECTORS) {
    const kms = [0];
    for (let i = 1; i < s.line.length; i++) {
      const a = s.line[i - 1], b = s.line[i];
      const len = railKm(a, b);
      kms.push(kms[i - 1] + len);
      const key = linkKey(a, b);
      LINKS[key] = { key, a, b, len, cap: LINK_CAP[key] || LINK_CAP_DEFAULT };
    }
    LINES[s.id] = kms;
  }

  function newGame(seed, level) {
    seed = seed || (Date.now() % 1e9);
    level = DIFFICULTY[level] ? level : 'normal';
    const st = {
      seed, day: 1, rand: null, level, lastDay: DIFFICULTY[level].lastDay,
      nodes: {}, links: {}, sectors: [],
      reserves: [], queue: [], marching: [],
      bombersLost: 0,
      soviet: { pool: 10, buildup: null, lastTarget: null },
      report: [], events: { attacks: [], raids: [], captures: [], bombed: [] },
      intel: null, won: false, lost: false, wonDay: null,
      history: [],
    };
    for (const id in NODES) st.nodes[id] = { captured: id === 'warsaw', everCaptured: id === 'warsaw', cond: 100, day: 0 };
    for (const id in START_CAPTURED) Object.assign(st.nodes[id], { captured: true, everCaptured: true, cond: START_CAPTURED[id] });
    for (const key in LINKS) st.links[key] = { done: START_CONVERTED.includes(key) ? LINKS[key].len : 0 };
    for (const s of SECTORS) {
      const startKm = LINES[s.id][1] + 5;
      const sec = {
        id: s.id, posture: 'advance',
        trains: s.id === 'north' ? 4 : 5, fuelMix: 50, focus: 'balanced', trucks: s.id === 'north' ? 4 : 5, engineers: 6, bombers: 2,
        front: startKm, lastAdvance: 0, lastCapture: 1,
        forces: Object.assign({}, s.forces),
        depot: { fuel: 2500, ammo: 2000 }, stock: { fuel: 0, ammo: 0 },
        res: s.resistance,
        got: { trains: 0, tons: 0, trucked: 0 },
        status: '', limit: '',
      };
      const need = needs(sec, 'advance');
      sec.stock.fuel = need.fuel * 3;
      sec.stock.ammo = need.ammo * 3;
      st.sectors.push(sec);
    }
    st.rand = rng(seed);
    arrivals(st);
    st.report = ['22 June 1941. The attack has begun. Keep the army moving east: take Vitebsk, Smolensk and Roslavl.'];
    return st;
  }

  // Tons a day a sector's forces need
  function needs(sec, posture) {
    const n = { fuel: 0, ammo: 0 };
    for (const t of UNIT_ORDER) {
      const per = UNIT_TYPES[t].need[posture || sec.posture];
      n.fuel += per.fuel * sec.forces[t];
      n.ammo += per.ammo * sec.forces[t];
    }
    return n;
  }

  function power(sec, kind) {
    let p = 0;
    for (const t of UNIT_ORDER) p += UNIT_TYPES[t][kind] * sec.forces[t];
    return p;
  }

  // km a day the sector could make with full supply
  function limits(sec) {
    const mobility = Math.min(MAX_SPEED, BASE_SPEED + UNIT_ORDER.reduce((a, t) => a + UNIT_TYPES[t].speed * sec.forces[t], 0));
    const combat = COMBAT_SPEED * power(sec, 'attack') / Math.max(8, sec.res);
    return { mobility, combat };
  }

  function sectorDef(id) { return SECTORS.find(s => s.id === id); }

  // How far up the line trains can run: converted track to a captured, usable station
  function railheadIndex(st, sec) {
    const line = sectorDef(sec.id).line;
    let i = 0;
    while (i + 1 < line.length) {
      const key = linkKey(line[i], line[i + 1]);
      const n = st.nodes[line[i + 1]];
      if (st.links[key].done < LINKS[key].len || !n.captured || n.cond <= 0) break;
      i++;
    }
    return i;
  }

  // Where trains can unload: the last usable station, plus any converted track beyond it towards the front
  function railhead(st, sec) {
    const i = railheadIndex(st, sec);
    const line = sectorDef(sec.id).line, kms = LINES[sec.id];
    let laid = 0;
    if (i + 1 < line.length) laid = Math.min(st.links[linkKey(line[i], line[i + 1])].done, Math.max(0, sec.front - kms[i]));
    return { index: i, node: line[i], stationKm: kms[i], laid, km: kms[i] + laid };
  }

  function gap(st, sec) { return Math.max(0, sec.front - railhead(st, sec).km); }

  // Tons a day the sector's trucks can carry from the railhead to the front
  function truckCapacity(st, sec) {
    const d = Math.max(20, gap(st, sec));
    const trips = Math.min(2, TRUCK_KM_PER_DAY / (2 * d));
    return Math.round(sec.trucks * TRUCK_TONS * trips);
  }

  // Trains each sector asks for today: supply trains plus troop trains queued for it
  function requested(st, sec) {
    const troop = st.queue.filter(q => q.sector === sec.id).reduce((a, q) => a + UNIT_TYPES[q.type].trains - q.loaded, 0);
    return { supply: sec.trains, troop };
  }

  // Share the trains out where track or stations are the bottleneck
  function allocateTrains(st) {
    const want = {}, use = {};
    for (const sec of st.sectors) {
      const r = requested(st, sec);
      want[sec.id] = r.supply + r.troop;
      const rh = railheadIndex(st, sec);
      const line = sectorDef(sec.id).line;
      const res = [];
      for (let i = 1; i <= rh; i++) {
        res.push('L' + linkKey(line[i - 1], line[i]));
        res.push('N' + line[i]);
      }
      use[sec.id] = res;
    }
    const cap = r => r[0] === 'L'
      ? LINKS[r.slice(1)].cap
      : NODES[r.slice(1)].cap * st.nodes[r.slice(1)].cond / 100;
    const got = Object.assign({}, want);
    let total = Object.values(got).reduce((a, b) => a + b, 0);
    if (total > TRAINS_PER_DAY) for (const id in got) got[id] *= TRAINS_PER_DAY / total;
    for (let pass = 0; pass < 4; pass++) {
      const load = {};
      for (const id in got) for (const r of use[id]) load[r] = (load[r] || 0) + got[id];
      for (const r in load) {
        const c = cap(r);
        if (load[r] > c + 1e-6) {
          const f = c / load[r];
          for (const id in got) if (use[id].includes(r)) got[id] *= f;
        }
      }
    }
    return got;
  }

  // Forecast for the panel: what each sector would get if the day ended now
  function forecast(st) {
    const got = allocateTrains(st);
    const out = {};
    for (const sec of st.sectors) {
      const troop = requested(st, sec).troop;
      out[sec.id] = { trains: got[sec.id], supplyTrains: Math.max(0, got[sec.id] - troop) };
    }
    return out;
  }

  function freePool(st, field, total) {
    return total - st.sectors.reduce((a, s) => a + s[field], 0);
  }

  function freeTrains(st) {
    const troop = st.queue.reduce((a, q) => a + UNIT_TYPES[q.type].trains - q.loaded, 0);
    return TRAINS_PER_DAY - troop - st.sectors.reduce((a, s) => a + s.trains, 0);
  }

  function arrivals(st) {
    for (const r of REINFORCEMENTS) if (r.day === st.day) st.reserves.push({ type: r.type, id: 'u' + st.day + Math.floor(st.rand() * 1e6) });
  }

  // Player orders: send a reserve unit east on the next trains
  function sendUnit(st, unitId, sectorId) {
    const i = st.reserves.findIndex(u => u.id === unitId);
    if (i < 0) return false;
    const u = st.reserves[i];
    if (freeTrains(st) < UNIT_TYPES[u.type].trains) return false;
    st.reserves.splice(i, 1);
    st.queue.push({ id: u.id, type: u.type, sector: sectorId, loaded: 0 });
    return true;
  }

  function cancelUnit(st, unitId) {
    const i = st.queue.findIndex(q => q.id === unitId);
    if (i < 0 || st.queue[i].loaded > 0) return;
    st.reserves.push({ id: st.queue[i].id, type: st.queue[i].type });
    st.queue.splice(i, 1);
  }

  // How weak a sector looks to the Soviets
  function weakness(st, sec) {
    const n = needs(sec, 'hold');
    const daysAmmo = sec.stock.ammo / Math.max(1, n.ammo + 200);
    const neighbours = st.sectors.filter(s => s !== sec);
    const ahead = sec.front - neighbours.reduce((a, s) => a + s.front, 0) / neighbours.length;
    return (daysAmmo < 1 ? 3 : daysAmmo < 2 ? 1.5 : 0)
      + gap(st, sec) / 150
      + Math.max(0, ahead) / 120
      - power(sec, 'defend') / 15
      - (sec.posture === 'hold' ? 1 : 0)
      + st.rand() * 0.6;
  }

  const SECTOR_NAME = id => sectorDef(id).name;

  // One day passes
  function endDay(st) {
    if (st.won || st.lost) return;
    const R = st.rand;
    const rep = [];
    const ev = { attacks: [], raids: [], captures: [], bombed: [], arrived: [] };
    const sov = st.soviet;

    // 1. Soviet reserves grow and are sent to the front
    sov.pool += SOVIET_GROWTH + st.day * SOVIET_GROWTH_PER_DAY;
    let attack = null;
    if (sov.buildup) {
      sov.buildup.strength += sov.pool * 0.7;
      sov.pool *= 0.3;
      sov.buildup.days--;
      if (sov.buildup.days <= 0) { attack = sov.buildup; sov.buildup = null; }
    } else if (sov.pool >= 30 && R() < BUILDUP_CHANCE) {
      let best = null, bestW = -1e9;
      for (const sec of st.sectors) {
        if (sec.front >= LINES[sec.id][LINES[sec.id].length - 1]) continue;
        const w = weakness(st, sec);
        if (w > bestW) { bestW = w; best = sec; }
      }
      if (best) {
        sov.buildup = { sector: best.id, strength: sov.pool, days: 2 + Math.floor(R() * 2) };
        sov.pool = 0;
      }
    } else if (sov.pool >= 15) {
      // Stiffen the line, most where the Germans are moving fastest
      const fast = st.sectors.reduce((a, b) => (b.lastAdvance > a.lastAdvance ? b : a));
      fast.res += 6; sov.pool -= 6;
      for (const sec of st.sectors) sec.res += 2;
      sov.pool -= 6;
    }
    for (const sec of st.sectors) sec.res += 0.6;

    // 2. Bombers: fuel from the sector's depot, hit the Soviet build-up or the line
    for (const sec of st.sectors) {
      let flying = 0;
      for (let g = 0; g < sec.bombers; g++) {
        if (sec.depot.fuel < BOMBER_FUEL) break;
        sec.depot.fuel -= BOMBER_FUEL;
        flying++;
      }
      if (!flying) continue;
      sec.res = Math.max(8, sec.res - flying * 2);
      if (sov.buildup && sov.buildup.sector === sec.id) {
        const hit = Math.min(sov.buildup.strength, flying * 6);
        sov.buildup.strength -= hit;
        ev.bombed.push(sec.id);
        rep.push(`✈️ ${SECTOR_NAME(sec.id)}: bombers caught Soviet columns moving up.`);
      }
      for (let g = 0; g < flying; g++) {
        if (R() < BOMBER_LOSS && sec.bombers > 0) {
          sec.bombers--; st.bombersLost++;
          rep.push(`❌ ${SECTOR_NAME(sec.id)}: a bomber group was lost.`);
          break;
        }
      }
    }

    // 3. Trains: troop trains first, the rest is supply
    const got = allocateTrains(st);
    for (const sec of st.sectors) {
      let trains = got[sec.id];
      const mine = st.queue.filter(q => q.sector === sec.id);
      for (const q of mine) {
        // A unit can take several days to load if the line is busy
        const take = Math.min(trains, UNIT_TYPES[q.type].trains - q.loaded);
        q.loaded += take;
        trains -= take;
        if (q.loaded + 1e-6 >= UNIT_TYPES[q.type].trains) {
          st.queue.splice(st.queue.indexOf(q), 1);
          const g = gap(st, sec);
          const days = Math.max(1, Math.ceil(g / UNIT_TYPES[q.type].march));
          if (q.type === 'pz') sec.depot.fuel = Math.max(0, sec.depot.fuel - g * 1.2);
          st.marching.push({ id: q.id, type: q.type, sector: sec.id, day: st.day + days });
          rep.push(`🚂 ${SECTOR_NAME(sec.id)}: ${UNIT_TYPES[q.type].name} unloaded at ${NODES[railhead(st, sec).node].name}, ${days} day${days > 1 ? 's' : ''} to the front.`);
        }
      }
      const tons = Math.max(0, trains) * TRAIN_TONS;
      sec.depot.fuel += tons * sec.fuelMix / 100;
      sec.depot.ammo += tons * (100 - sec.fuelMix) / 100;
      sec.got = { trains: got[sec.id], tons: Math.round(tons), trucked: 0 };
    }

    // 4. Soviet air raid on the fullest depot
    if (R() < 0.28) {
      const target = st.sectors.reduce((a, b) => (b.depot.fuel + b.depot.ammo > a.depot.fuel + a.depot.ammo ? b : a));
      if (target.depot.fuel + target.depot.ammo > 1500) {
        const rh = railhead(st, target);
        const lossF = target.depot.fuel * 0.25, lossA = target.depot.ammo * 0.25;
        target.depot.fuel -= lossF; target.depot.ammo -= lossA;
        if (rh.node !== 'warsaw') st.nodes[rh.node].cond = Math.max(0, st.nodes[rh.node].cond - 20 - R() * 15);
        ev.raids.push(rh.node);
        rep.push(`💥 Air raid on ${NODES[rh.node].name}: ${Math.round(lossF + lossA).toLocaleString()} t of supplies burnt, station damaged.`);
      }
    }

    // 5. Trucks: railhead depot to the front, burning fuel on the way
    for (const sec of st.sectors) {
      // Trucks keep the front topped up to 3 days of advancing, even while it holds
      const n = needs(sec, 'advance');
      const d = Math.max(20, gap(st, sec));
      const burn = d * TRUCK_FUEL;
      const keep = sec.posture === 'hold' ? HOLD_STOCK_DAYS : STOCK_DAYS;
      let wf = Math.max(0, n.fuel * keep - sec.stock.fuel);
      let wa = Math.max(0, n.ammo * keep - sec.stock.ammo);
      if (attack && attack.sector === sec.id) wa += attack.strength * 4;
      wf = Math.min(wf, sec.depot.fuel / (1 + burn));
      wa = Math.min(wa, sec.depot.ammo);
      const cap = truckCapacity(st, sec);
      if (wf + wa > cap) { const f = cap / (wf + wa); wf *= f; wa *= f; }
      let fuelForBurn = (wf + wa) * burn;
      if (fuelForBurn > sec.depot.fuel - wf) {
        const f = Math.max(0, sec.depot.fuel - wf) / Math.max(1, fuelForBurn);
        wa *= f; fuelForBurn = (wf + wa) * burn;
      }
      sec.depot.fuel -= wf + fuelForBurn;
      sec.depot.ammo -= wa;
      sec.stock.fuel += wf;
      sec.stock.ammo += wa;
      sec.got.trucked = Math.round(wf + wa);
    }

    // 6. Fighting: Soviet attack first, then the advance
    for (const sec of st.sectors) {
      const name = SECTOR_NAME(sec.id);
      let halted = false, slowed = false;
      if (attack && attack.sector === sec.id && attack.strength > 5) {
        const S = attack.strength;
        const ammoNeed = S * 8;
        const used = Math.min(sec.stock.ammo, ammoNeed);
        sec.stock.ammo -= used;
        const dug = sec.posture === 'hold' ? HOLD_DEFENCE : 1;
        const def = power(sec, 'defend') * 10 * (used / ammoNeed) * dug;
        ev.attacks.push(sec.id);
        if (def >= S) {
          slowed = true;
          rep.push(`🛡️ ${name}: Soviet counterattack beaten off (${Math.round(used).toLocaleString()} t of ammo fired).`);
        } else {
          halted = true;
          const back = Math.round(clamp((S - def) / S * 35, 3, 40));
          const floor = railhead(st, sec).km + 5;
          sec.front = Math.max(floor, sec.front - back);
          sec.res += 5;
          rep.push(`⚠️ ${name}: Soviet counterattack broke through. Pushed back ${back} km.`);
          if (S > def * 1.4) {
            const t = ['inf', 'art', 'pz'].find(t => sec.forces[t] > 1);
            if (t) { sec.forces[t]--; rep.push(`❌ ${name}: a ${UNIT_TYPES[t].name.toLowerCase()} was destroyed.`); }
          }
        }
      }
      const n = needs(sec);
      if (sec.posture === 'hold' || halted) {
        // Holding with ammo to spare: the guns soften up the Soviets for the next push
        if (!halted && sec.stock.ammo >= n.ammo * 2) sec.res = Math.max(8, sec.res - HOLD_SOFTEN * (1 + 0.5 * sec.forces.art));
        sec.stock.fuel = Math.max(0, sec.stock.fuel - n.fuel);
        sec.stock.ammo = Math.max(0, sec.stock.ammo - n.ammo);
        sec.lastAdvance = 0;
        sec.status = halted ? 'Pushed back' : 'Holding';
        continue;
      }
      const end = LINES[sec.id][LINES[sec.id].length - 1];
      if (sec.front >= end) {
        sec.lastAdvance = 0; sec.status = 'Objective taken';
        const h = needs(sec, 'hold');
        sec.stock.fuel = Math.max(0, sec.stock.fuel - h.fuel);
        sec.stock.ammo = Math.max(0, sec.stock.ammo - h.ammo);
        continue;
      }
      const rF = sec.stock.fuel / Math.max(1, n.fuel), rA = sec.stock.ammo / Math.max(1, n.ammo);
      const r = clamp(Math.min(rF, rA), 0, 1);
      sec.stock.fuel -= n.fuel * r;
      sec.stock.ammo -= n.ammo * r;
      // Speed is the slowest of: how fast the units can move, how hard the Soviets resist, and supply.
      // Short supply is wasted (units burn it but barely move); a well-stocked front pushes harder
      const lim = limits(sec);
      const push = r <= SHORT_SUPPLY ? 0 : (r - SHORT_SUPPLY) / (1 - SHORT_SUPPLY);
      const inHand = Math.min(sec.stock.fuel / Math.max(1, n.fuel), sec.stock.ammo / Math.max(1, n.ammo));
      const stocked = r >= 1 ? 1 + WELL_SUPPLIED * Math.min(4, inHand) : 1;
      let km = Math.min(lim.mobility, lim.combat) * push * stocked * (0.85 + R() * 0.3) * (slowed ? 0.5 : 1);
      sec.limit = r < 0.98 ? 'supply' : lim.combat < lim.mobility ? 'resistance' : 'mobility';
      km = Math.min(km, end - sec.front);
      sec.front += km;
      sec.lastAdvance = km;
      sec.res = Math.max(8, sec.res - km * 0.05);
      if (r < 0.98) {
        const short = rF < rA ? 'fuel' : 'ammo';
        sec.status = r < 0.1 ? `Stalled: out of ${short}` : `Slowed: short of ${short}`;
        if (r < 0.6) rep.push(`🔻 ${name}: ${sec.status.toLowerCase()} at the front (${Math.round(km)} km).`);
      } else sec.status = `Advancing ${Math.round(km)} km`;
    }

    // 7. Stations captured: the Soviets wreck what they had time to
    for (const sec of st.sectors) {
      const line = sectorDef(sec.id).line, kms = LINES[sec.id];
      for (let i = 1; i < line.length; i++) {
        const node = st.nodes[line[i]];
        if (sec.front >= kms[i] && !node.captured) {
          node.captured = true;
          if (!node.everCaptured) {
            node.everCaptured = true;
            const days = st.day - sec.lastCapture;
            let cond = clamp(85 - days * 7 + (R() * 30 - 15), 5, 90);
            if (R() < 0.12) cond = 0;
            node.cond = Math.round(cond);
            node.day = st.day;
            ev.captures.push(line[i]);
            const what = cond === 0 ? 'station blown up' : cond < 35 ? 'badly wrecked' : cond < 65 ? 'damaged' : 'lightly damaged';
            rep.push(`🚩 ${NODES[line[i]].name} taken (${what}, ${node.cond}%).`);
          }
          sec.lastCapture = st.day;
        }
      }
    }
    // Pushed back past a station that trains don't reach yet: it is lost again
    for (const id in st.nodes) {
      if (id === 'warsaw' || !st.nodes[id].captured) continue;
      let held = false;
      for (const sec of st.sectors) {
        const i = sectorDef(sec.id).line.indexOf(id);
        if (i < 0) continue;
        if (sec.front >= LINES[sec.id][i] || railheadIndex(st, sec) >= i) held = true;
      }
      if (!held) { st.nodes[id].captured = false; rep.push(`⚠️ ${NODES[id].name} lost.`); }
    }

    // 8. Engineers: repair badly hit stations, convert track, then tidy up
    for (const sec of st.sectors) {
      let b = sec.engineers * (sec.posture === 'hold' ? HOLD_ENGINEERS : 1);
      const line = sectorDef(sec.id).line, kms = LINES[sec.id];
      const rh = railheadIndex(st, sec);
      const top = Math.min(rh + 1, line.length - 1);
      const repair = (limit) => {
        for (let i = 1; i <= top && b > 0; i++) {
          const n = st.nodes[line[i]];
          if (!n.captured || n.cond >= limit) continue;
          const needB = (limit - n.cond) / REPAIR;
          const useB = Math.min(b, needB);
          n.cond = Math.min(100, n.cond + useB * REPAIR);
          b -= useB;
        }
      };
      // The player's focus: push the track forward, or keep stations running
      repair(ENGINEER_FOCUS[sec.focus].repairFirst);
      if (b > 0 && rh + 1 < line.length) {
        const key = linkKey(line[rh], line[rh + 1]);
        const link = st.links[key];
        const reach = Math.min(LINKS[key].len, Math.max(...st.sectors
          .filter(s => sectorDef(s.id).line.includes(line[rh + 1]))
          .map(s => s.front - kms[rh])));
        const left = Math.max(0, reach - link.done);
        const useB = Math.min(b, left / CONVERT_KM);
        link.done = Math.min(LINKS[key].len, link.done + useB * CONVERT_KM);
        b -= useB;
      }
      if (b > 0) repair(100);
    }
    for (const sec of st.sectors) {
      const before = sec._rh;
      const rh = railhead(st, sec);
      if (before !== undefined && rh.index > before) rep.push(`🚂 ${SECTOR_NAME(sec.id)}: railhead moved up to ${NODES[rh.node].name}.`);
      if (before !== undefined && rh.index < before) rep.push(`⚠️ ${SECTOR_NAME(sec.id)}: railhead pulled back to ${NODES[rh.node].name}.`);
      sec._rh = rh.index;
    }

    // 9. Units reach the front
    for (const m of st.marching.slice()) {
      if (m.day <= st.day + 1) {
        const sec = st.sectors.find(s => s.id === m.sector);
        sec.forces[m.type]++;
        st.marching.splice(st.marching.indexOf(m), 1);
        ev.arrived.push(m.sector);
        rep.push(`✅ ${SECTOR_NAME(m.sector)}: ${UNIT_TYPES[m.type].name} reached the front.`);
      }
    }

    // 10. Intelligence: right most of the time
    st.intel = null;
    if (sov.buildup) {
      const right = R() < 0.75;
      const others = st.sectors.filter(s => s.id !== sov.buildup.sector);
      const guess = right ? sov.buildup.sector : others[Math.floor(R() * others.length)].id;
      st.intel = { sector: guess, text: `🔍 Air recon: Soviet forces massing opposite ${SECTOR_NAME(guess)}.` };
    }

    for (const sec of st.sectors) for (const k of ['fuel', 'ammo']) {
      sec.depot[k] = Math.max(0, sec.depot[k]);
      sec.stock[k] = Math.max(0, sec.stock[k]);
    }
    st.history.push(st.sectors.map(s => Math.round(s.front)));
    st.day++;
    arrivals(st);
    for (const r of REINFORCEMENTS) if (r.day === st.day) rep.push(`🆕 ${UNIT_TYPES[r.type].name} arrived at Warsaw, ready to send east.`);

    if (OBJECTIVES.every(id => st.nodes[id].captured)) {
      st.won = true; st.wonDay = st.day - 1;
      rep.unshift(`🏆 All objectives taken on ${dateText(st.wonDay)}.`);
    } else if (st.day > st.lastDay) {
      st.lost = true;
      rep.unshift('⌛ Time is up. The offensive has run out of steam before reaching all the objectives.');
    }
    st.report = rep.length ? rep : ['A quiet day.'];
    st.events = ev;
  }

  function dateText(day) {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + day - 1);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  return {
    LINES, LINKS, linkKey, newGame, endDay, needs, power, limits, railhead, railheadIndex, gap,
    truckCapacity, forecast, freePool, freeTrains, sendUnit, cancelUnit, dateText, sectorDef,
  };
})();

if (typeof module !== 'undefined') module.exports = Sim;
