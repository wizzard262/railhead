// Railhead: the side panel, the report and the pop-up windows

const UI = (() => {
  let st, onChange;
  const $ = s => document.querySelector(s);
  const t = n => Math.round(n).toLocaleString('en-GB');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  function init(state, changed) {
    st = state; onChange = changed;
    buildSectors();
    $('#help-btn').onclick = $('#help-btn2').onclick = () => show('#help');
    $('#new-btn').onclick = () => { if (confirm('Start a new game?')) window.Game.restart(); };
    for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => hide(b.closest('.modal'));
    $('#again-btn').onclick = () => { hide($('#result')); window.Game.restart(); };
  }

  function setState(state) { st = state; buildSectors(); }

  function show(sel) { $(sel).hidden = false; }
  function hide(m) { (typeof m === 'string' ? $(m) : m).hidden = true; }

  // A [-] n [+] control
  function stepper(label, get, set, canUp, note) {
    const row = el('div', 'row');
    row.append(el('span', 'lbl', label));
    const box = el('span', 'step');
    const minus = el('button', '', '−'), val = el('b'), plus = el('button', '', '+');
    minus.setAttribute('aria-label', 'Less ' + label); plus.setAttribute('aria-label', 'More ' + label);
    minus.onclick = () => { if (get() > 0) { set(get() - 1); onChange(); } };
    plus.onclick = () => { if (canUp()) { set(get() + 1); onChange(); } };
    box.append(minus, val, plus);
    row.append(box);
    const n = el('span', 'note');
    row.append(n);
    row.update = () => { val.textContent = get(); minus.disabled = get() <= 0; plus.disabled = !canUp(); n.innerHTML = note(); };
    return row;
  }

  const cards = [];

  function buildSectors() {
    const wrap = $('#sectors');
    wrap.textContent = '';
    cards.length = 0;
    st.sectors.forEach(sec => {
      const def = Sim.sectorDef(sec.id);
      const card = el('section', 'card');
      card.style.setProperty('--sec', def.colour);
      const head = el('div', 'card-head');
      head.append(el('h3', '', def.name));
      const status = el('span', 'status');
      head.append(status);
      const posture = el('span', 'seg');
      const adv = el('button', '', 'Advance'), hold = el('button', '', 'Hold');
      adv.onclick = () => { sec.posture = 'advance'; onChange(); };
      hold.onclick = () => { sec.posture = 'hold'; onChange(); };
      adv.title = 'Push east. Uses the most fuel and ammo';
      hold.title = 'Dig in. Uses far less, so stocks build up';
      posture.append(adv, hold);
      head.append(posture);
      card.append(head);

      const pipe = el('div', 'pipe');
      const advice = el('div', 'advice');
      card.append(pipe, advice);

      const free = (field, total) => Sim.freePool(st, field, total) > 0;
      const rows = [
        stepper('🚂 Trains', () => sec.trains, v => sec.trains = v, () => Sim.freeTrains(st) > 0, () => {
          const f = window.Game.forecast[sec.id];
          const short = f && f.trains + 0.05 < sec.trains + troopFor(sec.id);
          return `${t(sec.trains * TRAIN_TONS)} t a day` + (short ? ` · <span class="warn">line only takes ${f.trains.toFixed(1)}</span>` : '');
        }),
        stepper('🚚 Trucks', () => sec.trucks, v => sec.trucks = v, () => free('trucks', TRUCK_COLUMNS), () =>
          `carry ${t(Sim.truckCapacity(st, sec))} t a day over ${t(Math.max(20, Sim.gap(st, sec)))} km`),
        stepper('🛠️ Engineers', () => sec.engineers, v => sec.engineers = v, () => free('engineers', ENGINEERS), () => engineerNote(sec)),
        stepper('✈️ Bombers', () => sec.bombers, v => sec.bombers = v, () => Sim.freePool(st, 'bombers', BOMBER_GROUPS - st.bombersLost) > 0, () =>
          sec.bombers ? `burn ${t(sec.bombers * BOMBER_FUEL)} t of fuel a day` : 'none'),
      ];
      for (const r of rows) card.append(r);

      // Engineer focus
      const focus = el('div', 'row');
      focus.append(el('span', 'lbl', '↳ Focus'));
      const fseg = el('span', 'seg small');
      for (const k in ENGINEER_FOCUS) {
        const b = el('button', '', ENGINEER_FOCUS[k].name);
        b.title = ENGINEER_FOCUS[k].hint;
        b.dataset.k = k;
        b.onclick = () => { sec.focus = k; onChange(); };
        fseg.append(b);
      }
      focus.append(fseg);
      card.append(focus);

      // Fuel and ammo share of the supply trains
      const mix = el('div', 'row');
      mix.append(el('span', 'lbl', '⛽ / 💥 mix'));
      const slider = el('input');
      slider.type = 'range'; slider.min = 0; slider.max = 100; slider.step = 5;
      slider.setAttribute('aria-label', 'Fuel share of supply trains');
      slider.oninput = () => { sec.fuelMix = +slider.value; onChange(); };
      const mixNote = el('span', 'note');
      const match = el('button', 'tiny', 'Match needs');
      match.title = 'Set the mix to what this sector uses, plus bomber and truck fuel';
      match.onclick = () => { sec.fuelMix = matchMix(sec); onChange(); };
      mix.append(slider, mixNote, match);
      card.append(mix);

      const forces = el('div', 'forces');
      card.append(forces);

      wrap.append(card);
      cards.push({ sec, status, adv, hold, pipe, advice, rows, fseg, slider, mixNote, forces });
    });
  }

  function troopFor(id) {
    return st.queue.filter(q => q.sector === id).reduce((a, q) => a + UNIT_TYPES[q.type].trains - q.loaded, 0);
  }

  function matchMix(sec) {
    const n = Sim.needs(sec);
    const extraFuel = sec.bombers * BOMBER_FUEL + (n.fuel + n.ammo) * Math.max(20, Sim.gap(st, sec)) * TRUCK_FUEL;
    const f = n.fuel + extraFuel;
    return Math.max(0, Math.min(100, Math.round(f / (f + n.ammo) * 20) * 5));
  }

  function engineerNote(sec) {
    const rh = Sim.railhead(st, sec), line = Sim.sectorDef(sec.id).line;
    const damaged = line.slice(1, rh.index + 2).filter(id => st.nodes[id].captured && st.nodes[id].cond < 100);
    if (rh.index + 1 >= line.length) return damaged.length ? `repairing ${damaged.map(id => NODES[id].name).join(', ')}` : 'line finished';
    const key = Sim.linkKey(line[rh.index], line[rh.index + 1]);
    const left = Math.round(Sim.LINKS[key].len - st.links[key].done);
    const next = st.nodes[line[rh.index + 1]];
    let s = `${left} km to convert to ${NODES[line[rh.index + 1]].name}`;
    if (left === 0 && next.captured && next.cond <= 0) s = `${NODES[line[rh.index + 1]].name} station needs repair`;
    else if (left === 0 && !next.captured) s = `${NODES[line[rh.index + 1]].name} not taken yet`;
    if (damaged.length) s += ` · ${damaged.length} station${damaged.length > 1 ? 's' : ''} damaged`;
    return s;
  }

  // What flows through each part of a sector's pipe, in tons a day
  function flows(sec) {
    const n = Sim.needs(sec);
    const need = n.fuel + n.ammo;
    const gap = Sim.gap(st, sec);
    const d = Math.max(20, gap);
    const perTruck = TRUCK_TONS * Math.min(2, TRUCK_KM_PER_DAY / (2 * d));
    const truckCap = Sim.truckCapacity(st, sec);
    const burn = need * d * TRUCK_FUEL;
    const bomberFuel = sec.bombers * BOMBER_FUEL;
    const f = window.Game.forecast[sec.id] || { trains: 0, supplyTrains: 0 };
    const trainTons = f.supplyTrains * TRAIN_TONS;
    const trainNeed = need + burn + bomberFuel;
    return {
      n, need, gap, perTruck, truckCap, burn, bomberFuel, trainTons, trainNeed,
      lineShort: f.trains + 0.05 < sec.trains + troopFor(sec.id), lineTakes: f.trains,
      trainRatio: trainTons / Math.max(1, trainNeed),
      truckRatio: truckCap / Math.max(1, need),
      daysF: sec.stock.fuel / Math.max(1, n.fuel), daysA: sec.stock.ammo / Math.max(1, n.ammo),
      depotDaysF: sec.depot.fuel / Math.max(1, n.fuel + burn + bomberFuel),
      depotDaysA: sec.depot.ammo / Math.max(1, n.ammo),
    };
  }

  const tone = r => r >= 1 ? 'ok' : r >= 0.75 ? 'meh' : 'bad';
  const secName = id => Sim.sectorDef(id).name;

  // The worst station between Warsaw and this sector's railhead
  function chokeStation(sec) {
    const rh = Sim.railhead(st, sec), line = Sim.sectorDef(sec.id).line;
    let worst = null;
    for (let i = 1; i <= rh.index; i++) {
      if (!worst || st.nodes[line[i]].cond < st.nodes[worst].cond) worst = line[i];
    }
    return worst;
  }

  // Another sector with trucks or trains to spare
  function donor(sec, kind) {
    let best = null, spare = 0;
    for (const o of st.sectors) {
      if (o === sec) continue;
      const f = flows(o);
      const s = kind === 'trucks'
        ? (o.posture === 'hold' ? o.trucks - 1 : Math.floor((f.truckCap - f.need) / Math.max(1, f.perTruck)))
        : (o.posture === 'hold' ? o.trains - 1 : Math.floor((f.trainTons - f.trainNeed) / TRAIN_TONS + (f.depotDaysF > 4 && f.depotDaysA > 4 ? 1 : 0)));
      if (s > spare) { spare = s; best = o; }
    }
    return best ? { sec: best, n: spare } : null;
  }

  // Where to get more trucks or trains from
  function source(sec, kind, more) {
    const free = kind === 'trucks' ? Sim.freePool(st, 'trucks', TRUCK_COLUMNS) : Sim.freeTrains(st);
    if (free > 0) return ` (${free} free)`;
    const d = donor(sec, kind);
    return d ? ` (take ${Math.min(more, d.n)} from <b>${secName(d.sec.id)}</b>)` : '';
  }

  // One line of advice: the most urgent thing to fix in this sector
  function advise(sec) {
    const f = flows(sec);
    const atEnd = sec.front >= Sim.LINES[sec.id][Sim.LINES[sec.id].length - 1];
    const threat = st.intel && st.intel.sector === sec.id;
    if (atEnd && sec.posture === 'advance') return ['ok', '🏁 Objective taken. Set <b>Hold</b> and give its trains, trucks and engineers to the other sectors.'];
    if (atEnd) return ['ok', '🏁 Objective held. Keep a little ammo coming in case the Soviets counterattack.'];
    if (threat && (f.daysA < 2.5 || sec.bombers < 3)) {
      const what = [];
      if (sec.bombers < 3) what.push('send <b>bombers</b> here to break up the build-up');
      if (f.daysA < 2.5) what.push('get <b>ammo</b> to the front');
      return ['bad', `🔍 Recon says the Soviets are massing here: ${what.join(', and ')}.`];
    }
    if (sec.posture === 'hold') return ['meh', '⏸️ Holding: stocks are building up. Press <b>Advance</b> once the front has about 3 days of fuel and ammo.'];
    const choke = () => {
      const c = chokeStation(sec);
      if (!c) return '';
      if (st.nodes[c].cond >= 85) {
        const users = st.sectors.filter(o => Sim.sectorDef(o.id).line.indexOf(c) > 0 && Sim.sectorDef(o.id).line.indexOf(c) <= Sim.railhead(st, o).index);
        if (users.length > 1) return `: the track through <b>${NODES[c].name}</b> is shared by ${users.map(o => secName(o.id)).join(' and ')} and is full`;
      }
      return `: <b>${NODES[c].name}</b> station is at ${Math.round(st.nodes[c].cond)}%`;
    };
    if (f.lineShort && f.trainRatio < 1) return ['bad', `🚧 The line only takes <b>${f.lineTakes.toFixed(1)}</b> trains a day${choke()}. Set engineers to <b>Repair</b> so more get through.`];
    const depotDays = Math.min(f.depotDaysF, f.depotDaysA);
    if (f.truckRatio < 1 && (f.truckRatio <= f.trainRatio || depotDays > 2)) {
      const more = Math.ceil((f.need - f.truckCap) / Math.max(1, f.perTruck));
      return [tone(f.truckRatio), `🚚 Trucks carry ${t(f.truckCap)} of the ${t(f.need)} t a day the front uses, over ${t(f.gap)} km. Add <b>${more}</b> truck${more > 1 ? 's' : ''}${source(sec, 'trucks', more)}, or more <b>engineers</b> to bring the railhead closer.`];
    }
    if (f.trainRatio < 1 && depotDays < 3) {
      const more = Math.ceil((f.trainNeed - f.trainTons) / TRAIN_TONS);
      return [tone(f.trainRatio), `🚂 Trains bring ${t(f.trainTons)} t a day; this sector needs about ${t(f.trainNeed)} with truck and bomber fuel. Add <b>${more}</b> train${more > 1 ? 's' : ''}${source(sec, 'trains', more)}.`];
    }
    if (f.lineShort) return ['meh', `🚧 Only <b>${f.lineTakes.toFixed(1)}</b> of your trains get through${choke()}. Move the extra trains to another sector, or set engineers to <b>Repair</b>.`];
    if (f.depotDaysA < 1 && f.depotDaysF > 3) return ['meh', '💥 The depot is nearly out of <b>ammo</b> but has spare fuel. Move the mix toward ammo, or press <b>Match needs</b>.'];
    if (f.depotDaysF < 1 && f.depotDaysA > 3) return ['meh', '⛽ The depot is nearly out of <b>fuel</b> but has spare ammo. Move the mix toward fuel, or press <b>Match needs</b>.'];
    if (sec.depot.fuel + sec.depot.ammo > 9000) return ['meh', '🎯 This depot is very full: a magnet for Soviet bombers. Send some of its trains to a sector that needs them.'];
    if (sec.limit === 'resistance') return ['meh', '🛡️ Supply is fine; Soviet resistance is the brake. Add <b>bombers</b>, or send <b>artillery</b> or a <b>panzer division</b>.'];
    if (sec.limit === 'mobility') {
      const pz = st.reserves.some(u => u.type === 'pz');
      return ['ok', `✅ Supply is keeping up. It's moving as fast as its units can${pz ? ': a <b>panzer division</b> from the reserves would speed it up' : ''}.`];
    }
    return ['ok', '✅ Supply is keeping up.'];
  }

  // Warsaw → trains → depot → trucks → front, narrowest part in red
  function pipeHTML(sec) {
    const f = flows(sec), rh = Sim.railhead(st, sec);
    const weakest = Math.min(f.trainRatio, f.truckRatio);
    const seg = (r, label, sub) => `<div class="pipe-seg ${tone(r)}"><span class="flow">${label}</span><i></i><span class="sub">${sub}</span>${r < 1 && r === weakest ? '<span class="neck">narrowest</span>' : ''}</div>`;
    const days = (v, c) => `<span class="${v < 1 ? 'warn' : ''}">${c} ${v.toFixed(1)} d</span>`;
    return `
      <div class="pipe-node"><b>Warsaw</b><small>base</small></div>
      ${seg(f.trainRatio, `🚂 ${t(f.trainTons)} t/d`, f.lineShort ? '<span class="warn">line limit</span>' : `needs ${t(f.trainNeed)}`)}
      <div class="pipe-node" title="Railhead depot"><b>${NODES[rh.node].name}</b><small>⛽ ${t(sec.depot.fuel)}</small><small>💥 ${t(sec.depot.ammo)}</small></div>
      ${seg(f.truckRatio, `🚚 ${t(f.truckCap)} t/d`, `${t(f.gap)} km`)}
      <div class="pipe-node"><b>Front</b><small>${days(f.daysF, '⛽')}</small><small>${days(f.daysA, '💥')}</small><small>uses ${t(f.need)}</small></div>`;
  }

  function update() {
    const date = Sim.dateText(Math.min(st.day, LAST_DAY));
    $('#date').textContent = date;
    $('#day').textContent = `Day ${Math.min(st.day, LAST_DAY)} of ${LAST_DAY}`;
    $('#objectives').innerHTML = OBJECTIVES.map(id => `<span class="obj ${st.nodes[id].captured ? 'done' : ''}">${st.nodes[id].captured ? '✅' : '🎯'} ${NODES[id].name}</span>`).join('');
    const ft = Sim.freeTrains(st), fk = Sim.freePool(st, 'trucks', TRUCK_COLUMNS), fe = Sim.freePool(st, 'engineers', ENGINEERS), fb = Sim.freePool(st, 'bombers', BOMBER_GROUPS - st.bombersLost);
    $('#pools').innerHTML = `<b>Free to assign:</b> <span class="${ft ? 'have' : ''}">🚂 ${ft} trains</span> <span class="${fk ? 'have' : ''}">🚚 ${fk} trucks</span> <span class="${fe ? 'have' : ''}">🛠️ ${fe} engineers</span> <span class="${fb ? 'have' : ''}">✈️ ${fb} bombers</span>`;

    for (const c of cards) {
      const { sec } = c;
      c.status.textContent = sec.status || '';
      c.status.className = 'status ' + (/Stalled|Pushed|out of/.test(sec.status) ? 'bad' : /Slowed/.test(sec.status) ? 'meh' : 'ok');
      c.adv.classList.toggle('on', sec.posture === 'advance');
      c.hold.classList.toggle('on', sec.posture === 'hold');
      c.pipe.innerHTML = pipeHTML(sec);
      const [adviceTone, adviceText] = advise(sec);
      c.advice.className = 'advice ' + adviceTone;
      c.advice.innerHTML = adviceText;
      for (const r of c.rows) r.update();
      for (const b of c.fseg.children) b.classList.toggle('on', b.dataset.k === sec.focus);
      c.slider.value = sec.fuelMix;
      c.mixNote.textContent = `${sec.fuelMix}% fuel`;
      const forces = UNIT_ORDER.map(u => `<span title="${UNIT_TYPES[u].name}">${UNIT_TYPES[u].short} <b>${sec.forces[u]}</b></span>`).join(' ');
      const coming = [
        ...st.queue.filter(q => q.sector === sec.id).map(q => `${UNIT_TYPES[q.type].short} loading ${q.loaded > 0 ? `(${q.loaded.toFixed(1)}/${UNIT_TYPES[q.type].trains})` : ''}`),
        ...st.marching.filter(m => m.sector === sec.id).map(m => `${UNIT_TYPES[m.type].short} marching, ${Math.max(1, m.day - st.day + 1)} d`),
      ];
      c.forces.innerHTML = `<b>Forces</b> ${forces}${coming.length ? ` · <span class="muted">on the way: ${coming.join(', ')}</span>` : ''}`;
    }

    // Reserves at Warsaw
    const res = $('#reserves');
    res.textContent = '';
    if (!st.reserves.length && !st.queue.length) res.append(el('p', 'muted', 'No units waiting. More arrive over the coming weeks.'));
    if (st.reserves.length && Sim.freeTrains(st) < 2) res.append(el('p', 'res-hint', "👉 To send a unit, free some trains first: lower a sector's 🚂 Trains."));
    for (const type of UNIT_ORDER) {
      const units = st.reserves.filter(u => u.type === type);
      if (!units.length) continue;
      const T = UNIT_TYPES[type];
      const row = el('div', 'unit');
      row.append(el('span', '', `<b>${units.length} × ${T.name}</b> <span class="muted">each needs ${T.trains} trains, then ${T.need.advance.fuel + T.need.advance.ammo} t a day</span>`));
      const btns = el('span', 'send');
      for (const sec of st.sectors) {
        const b = el('button', '', '→ ' + Sim.sectorDef(sec.id).name);
        b.style.setProperty('--sec', Sim.sectorDef(sec.id).colour);
        b.disabled = Sim.freeTrains(st) < T.trains;
        b.title = b.disabled ? `Free ${T.trains} trains first (take them off a sector's supply trains)` : `Load one on the next trains to ${Sim.sectorDef(sec.id).name}`;
        b.onclick = () => { Sim.sendUnit(st, units[0].id, sec.id); onChange(); };
        btns.append(b);
      }
      row.append(btns);
      res.append(row);
    }
    for (const q of st.queue) {
      const row = el('div', 'unit queued');
      row.append(el('span', '', `<b>${UNIT_TYPES[q.type].name}</b> <span class="muted">loading for ${Sim.sectorDef(q.sector).name}</span>`));
      if (q.loaded === 0) {
        const b = el('button', 'tiny', 'Cancel');
        b.onclick = () => { Sim.cancelUnit(st, q.id); onChange(); };
        row.append(b);
      }
      res.append(row);
    }

    // Yesterday's report
    const rep = $('#report');
    rep.textContent = '';
    if (st.intel) rep.append(el('li', 'intel', st.intel.text));
    for (const line of st.report) rep.append(el('li', '', line));

    $('#end-btn').disabled = st.won || st.lost;
  }

  function tooltip(id, x, y) {
    const tip = $('#tip');
    if (!id) { tip.hidden = true; return; }
    const n = st.nodes[id], N = NODES[id];
    const lines = [`<b>${N.name}</b>`];
    if (id === 'warsaw') lines.push('Supply base. Trains start here.');
    else if (!n.captured) lines.push('Held by the Soviets');
    else lines.push(`Station condition <b>${Math.round(n.cond)}%</b>`, `Handles ${(N.cap * n.cond / 100).toFixed(1)} of ${N.cap} trains a day`);
    if (OBJECTIVES.includes(id)) lines.push('🎯 Objective');
    tip.innerHTML = lines.join('<br>');
    tip.hidden = false;
    tip.style.left = Math.min(x + 14, window.innerWidth - 220) + 'px';
    tip.style.top = (y + 14) + 'px';
  }

  function result() {
    const box = $('#result-text');
    if (st.won) {
      const d = st.wonDay;
      const vs = d <= HISTORICAL_DAY ? 'Faster than the real Army Group Centre, which took Smolensk on 16 July.' : `The real Army Group Centre took Smolensk on 16 July (day ${HISTORICAL_DAY}).`;
      box.innerHTML = `<h2>🏆 Objectives taken</h2><p>Vitebsk, Smolensk and Roslavl are all in German hands on <b>${Sim.dateText(d)}</b>, day ${d} of ${LAST_DAY}.</p><p>${vs}</p>`;
    } else {
      const done = OBJECTIVES.filter(id => st.nodes[id].captured).map(id => NODES[id].name);
      box.innerHTML = `<h2>⌛ Out of time</h2><p>By ${Sim.dateText(LAST_DAY)} the offensive had stalled. ${done.length ? 'Taken: ' + done.join(', ') + '.' : 'No objective was taken.'}</p><p>Watch the gap between railhead and front, and the line limits on the trains.</p>`;
    }
    show('#result');
  }

  return { init, setState, update, tooltip, result, show, hide };
})();
