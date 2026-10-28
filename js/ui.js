// Railhead: the sector rows, the report, the reserves and the pop-up windows

const UI = (() => {
  let st, onChange;
  const $ = s => document.querySelector(s);
  const t = n => Math.round(n).toLocaleString('en-GB');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  // The train and truck emoji face left; wrap them so they face right (east, towards the front)
  function faceRight(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (/[🚂🚚]/u.test(n.nodeValue) && !n.parentElement.classList.contains('face-right')) hits.push(n);
    }
    for (const n of hits) {
      const frag = document.createDocumentFragment();
      for (const part of n.nodeValue.split(/([🚂🚚])/u)) {
        if (!part) continue;
        if (part === '🚂' || part === '🚚') frag.append(el('span', 'face-right', part));
        else frag.append(document.createTextNode(part));
      }
      n.replaceWith(frag);
    }
  }

  // The same unit pictures as on the map: a soldier, a tank and a field gun
  function unitIcon(type) {
    const parts = Draw.UNIT_ART[type].map(([part, d]) => `<path d="${d}" fill="${Draw.UNIT_COLOURS[part]}"/>`).join('');
    return `<svg class="unit-icon" viewBox="0 0 24 16" width="21" height="14" aria-hidden="true">${parts}</svg>`;
  }

  function init(state, changed) {
    st = state; onChange = changed;
    buildSectors();
    $('#unit-legend').innerHTML = UNIT_ORDER.map(u => `${unitIcon(u)} ${UNIT_TYPES[u].short}`).join(' · ') + ': reserves wait beside Warsaw';
    $('#help-btn').onclick = $('#help-btn2').onclick = () => show('#help');
    $('#new-btn').onclick = () => { if (confirm('Start a new game?')) window.Game.restart(); };
    for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => hide(b.closest('.modal'));
    $('#again-btn').onclick = () => { hide($('#result')); window.Game.restart(); };
  }

  function setState(state) { st = state; buildSectors(); }

  function show(sel) { $(sel).hidden = false; }
  function hide(m) { (typeof m === 'string' ? $(m) : m).hidden = true; }

  // A [-] n [+] control with a note under it
  function stepper(label, get, set, canUp, note) {
    const cell = el('div', 'cell');
    cell.dataset.label = label;
    const box = el('span', 'step');
    const minus = el('button', '', '−'), val = el('b'), plus = el('button', '', '+');
    minus.setAttribute('aria-label', 'Less ' + label); plus.setAttribute('aria-label', 'More ' + label);
    minus.onclick = () => { if (get() > 0) { set(get() - 1); onChange(); } };
    plus.onclick = () => { if (canUp()) { set(get() + 1); onChange(); } };
    box.append(minus, val, plus);
    const n = el('span', 'note');
    cell.append(box, n);
    cell.update = () => { val.textContent = get(); minus.disabled = get() <= 0; plus.disabled = !canUp(); n.innerHTML = note(); };
    return cell;
  }

  // A row of buttons where one is chosen
  function segment(options, get, set) {
    const seg = el('span', 'seg');
    for (const o of options) {
      const b = el('button', '', o.label);
      if (o.title) b.title = o.title;
      b.onclick = () => { set(o.value); onChange(); };
      b.value = o.value;
      seg.append(b);
    }
    seg.update = rec => {
      for (const b of seg.children) {
        b.classList.toggle('on', String(get()) === b.value);
        b.classList.toggle('rec', rec !== undefined && String(rec) === b.value);
      }
    };
    return seg;
  }

  const cards = [];

  // One row per sector: name, supply line, trains, trucks, engineers, mix, bombers, then the advice
  function buildSectors() {
    const wrap = $('#sectors');
    wrap.textContent = '';
    cards.length = 0;
    st.sectors.forEach(sec => {
      const def = Sim.sectorDef(sec.id);
      const row = el('section', 'brow card');
      row.style.setProperty('--sec', def.colour);

      const name = el('div', 'c-name');
      name.append(el('h3', '', def.name));
      const status = el('span', 'status');
      const posture = segment([
        { value: 'advance', label: 'Advance', title: 'Push east. Uses the most fuel and ammo' },
        { value: 'hold', label: 'Hold', title: 'Dig in. Uses far less, so stocks build up' },
      ], () => sec.posture, v => sec.posture = v);
      const forces = el('div', 'forces');
      name.append(status, posture, forces);

      const pipe = el('div', 'cell c-pipe pipe');

      const free = (field, total) => Sim.freePool(st, field, total) > 0;
      const trains = stepper('🚂 Trains', () => sec.trains, v => sec.trains = v, () => Sim.freeTrains(st) > 0, () => {
        const f = window.Game.forecast[sec.id];
        const short = f && f.trains + 0.05 < sec.trains + troopFor(sec.id);
        return `${t(sec.trains * TRAIN_TONS)} t a day` + (short ? `<br><span class="warn">line takes ${f.trains.toFixed(1)}</span>` : '');
      });
      const trucks = stepper('🚚 Trucks', () => sec.trucks, v => sec.trucks = v, () => free('trucks', TRUCK_COLUMNS), () =>
        `${t(Sim.truckCapacity(st, sec))} t a day<br>over ${t(Math.max(20, Sim.gap(st, sec)))} km`);
      const engineers = stepper('🛠️ Engineers', () => sec.engineers, v => sec.engineers = v, () => free('engineers', ENGINEERS), () => engineerNote(sec));
      const focus = segment(Object.keys(ENGINEER_FOCUS).map(k => ({ value: k, label: ENGINEER_FOCUS[k].name, title: ENGINEER_FOCUS[k].hint })),
        () => sec.focus, v => sec.focus = v);
      engineers.insertBefore(focus, engineers.lastChild);
      engineers.classList.add('wide');
      const bombers = stepper('✈️ Bombers', () => sec.bombers, v => sec.bombers = v, () => Sim.freePool(st, 'bombers', BOMBER_GROUPS - st.bombersLost) > 0, () =>
        sec.bombers ? `burn ${t(sec.bombers * BOMBER_FUEL)} t<br>of fuel a day` : 'none');

      const mixCell = el('div', 'cell wide');
      mixCell.dataset.label = '⛽ / 💥 Mix';
      const mix = segment(MIXES.map(m => ({ value: m.fuel, label: m.label, title: `${m.fuel}% fuel, ${100 - m.fuel}% ammo` })),
        () => sec.fuelMix, v => sec.fuelMix = v);
      const mixNote = el('span', 'note');
      mixNote.classList.add('mix-top');
      mixCell.append(mixNote, mix);

      const advice = el('div', 'c-advice');
      row.append(name, pipe, trains, trucks, engineers, mixCell, bombers, advice);
      wrap.append(row);
      cards.push({ sec, status, posture, forces, pipe, steppers: [trains, trucks, engineers, bombers], focus, mix, mixNote, advice });
    });
  }

  function troopFor(id) {
    return st.queue.filter(q => q.sector === id).reduce((a, q) => a + UNIT_TYPES[q.type].trains - q.loaded, 0);
  }

  // The mix button closest to what the sector burns, bombers and truck fuel included
  function matchMix(sec) {
    const n = Sim.needs(sec);
    const extraFuel = sec.bombers * BOMBER_FUEL + (n.fuel + n.ammo) * Math.max(20, Sim.gap(st, sec)) * TRUCK_FUEL;
    const share = 100 * (n.fuel + extraFuel) / (n.fuel + extraFuel + n.ammo);
    return MIXES.reduce((a, b) => (Math.abs(b.fuel - share) < Math.abs(a.fuel - share) ? b : a)).fuel;
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
    const n = Sim.needs(sec), adv = Sim.needs(sec, 'advance');
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
      // Days in hand are always days of advancing, so they mean the same on Hold
      daysF: sec.stock.fuel / Math.max(1, adv.fuel), daysA: sec.stock.ammo / Math.max(1, adv.ammo),
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
    if (sec.posture === 'hold') {
      const inHand = Math.min(f.daysF, f.daysA);
      const ready = inHand >= 4;
      return [ready ? 'ok' : 'meh', ready
        ? `▶️ ${inHand.toFixed(1)} days in hand: press <b>Advance</b> for a push about ${Math.round(WELL_SUPPLIED * 4 * 100)}% faster than usual.`
        : `⏸️ Holding: dug in (defence +${Math.round((HOLD_DEFENCE - 1) * 100)}%), engineers working ${HOLD_ENGINEERS}× as fast, guns softening the Soviets, and trucks stocking the front up to ${HOLD_STOCK_DAYS} days. Advance at about 4 days in hand.`];
    }
    const choke = () => {
      const c = chokeStation(sec);
      if (!c) return '';
      if (st.nodes[c].cond >= 85) {
        const users = st.sectors.filter(o => Sim.sectorDef(o.id).line.indexOf(c) > 0 && Sim.sectorDef(o.id).line.indexOf(c) <= Sim.railhead(st, o).index);
        if (users.length > 1) return `: the track through <b>${NODES[c].name}</b> is shared by ${users.map(o => secName(o.id)).join(' and ')} and is full`;
      }
      return `: <b>${NODES[c].name}</b> station is at ${Math.round(st.nodes[c].cond)}%`;
    };
    if (f.lineShort && f.trainRatio < 1) return ['bad', `🚧 The line only takes <b>${f.lineTakes.toFixed(1)}</b> trains a day${choke()}. Set engineers to <b>Station 🚉</b> so more get through.`];
    const depotDays = Math.min(f.depotDaysF, f.depotDaysA);
    // Advancing on a trickle wastes it: better to stop, stock up and go again
    const frontDays = Math.min(f.daysF, f.daysA);
    if (frontDays < 0.6 && Math.min(f.truckRatio, f.trainRatio) < SHORT_SUPPLY + 0.3) {
      return ['bad', `⏸️ The front is nearly empty and supply can't keep up, so advancing wastes what arrives. <b>Hold</b> for a few days to stock up, then Advance.`];
    }
    if (f.truckRatio < 1 && (f.truckRatio <= f.trainRatio || depotDays > 2)) {
      const more = Math.ceil((f.need - f.truckCap) / Math.max(1, f.perTruck));
      return [tone(f.truckRatio), `🚚 Trucks carry ${t(f.truckCap)} of the ${t(f.need)} t a day the front uses, over ${t(f.gap)} km. Add <b>${more}</b> truck${more > 1 ? 's' : ''}${source(sec, 'trucks', more)}, or more <b>engineers</b> to bring the railhead closer.`];
    }
    if (f.trainRatio < 1 && depotDays < 3) {
      const more = Math.ceil((f.trainNeed - f.trainTons) / TRAIN_TONS);
      return [tone(f.trainRatio), `🚂 Trains bring ${t(f.trainTons)} t a day; this sector needs about ${t(f.trainNeed)} with truck and bomber fuel. Add <b>${more}</b> train${more > 1 ? 's' : ''}${source(sec, 'trains', more)}.`];
    }
    if (f.lineShort) return ['meh', `🚧 Only <b>${f.lineTakes.toFixed(1)}</b> of your trains get through${choke()}. Move the extra trains to another sector, or set engineers to <b>Station 🚉</b>.`];
    if (f.depotDaysA < 1 && f.depotDaysF > 3) return ['meh', '💥 The depot is nearly out of <b>ammo</b> but has spare fuel. Pick the mix underlined in green, or one more toward 💥.'];
    if (f.depotDaysF < 1 && f.depotDaysA > 3) return ['meh', '⛽ The depot is nearly out of <b>fuel</b> but has spare ammo. Pick the mix underlined in green, or one more toward ⛽.'];
    if (sec.depot.fuel + sec.depot.ammo > 9000) return ['meh', '🎯 This depot is very full: a magnet for Soviet bombers. Send some of its trains to a sector that needs them.'];
    if (sec.limit === 'resistance') return ['meh', '🛡️ Supply is fine; Soviet resistance is the brake. Add <b>bombers</b>, or send <b>artillery</b> or a <b>panzer division</b>.'];
    if (sec.limit === 'mobility') {
      const pz = st.reserves.some(u => u.type === 'pz');
      return ['ok', `✅ Supply is keeping up. It's moving as fast as its units can${pz ? ': a <b>panzer division</b> from the reserves would speed it up' : ''}.`];
    }
    return ['ok', '✅ Supply is keeping up.'];
  }

  // Warsaw → train → station → train on to the end of the track → truck → front.
  // Train legs are dashed black like good track, truck legs dashed brown; the label colour shows if it keeps up
  function pipeHTML(sec) {
    const f = flows(sec), rh = Sim.railhead(st, sec);
    const weakest = Math.min(f.trainRatio, f.truckRatio);
    const seg = (mode, r, label, sub, neck) => `<div class="pipe-seg ${mode} ${tone(r)}"><span class="flow">${label}</span><i></i><span class="sub">${sub}</span>${neck && r < 1 && r === weakest ? '<span class="neck">narrowest</span>' : ''}</div>`;
    // Icon, bar (full = 3 days of advancing), then days in hand: the same as the map badges
    const days = (v, c, cls) => `<span class="dayrow"><span>${c}</span><span class="bar ${cls}"><i style="width:${Math.min(100, v / 3 * 100)}%"></i></span><span class="${v < 1 ? 'warn' : ''}">${v.toFixed(1)} d</span></span>`;
    const past = rh.laid >= 1;
    return `
      <div class="pipe-node"><b>Warsaw</b><small>base</small></div>
      ${seg('train', f.trainRatio, `🚂 ${t(f.trainTons)} t/d`, f.lineShort ? '<span class="warn">line limit</span>' : `needs ${t(f.trainNeed)}`, true)}
      <div class="pipe-node" title="${past ? `Trains run on ${t(rh.laid)} km past ${NODES[rh.node].name}; the depot is at the end of the track` : `The depot is at ${NODES[rh.node].name}`}"><b>${NODES[rh.node].name}</b>${health(rh.node)}<small>⛽ ${t(sec.depot.fuel)}</small><small>💥 ${t(sec.depot.ammo)}</small></div>
      <div class="pipe-pair" title="Train to the end of the track, then trucks to the front">
        ${past ? seg('train extend', f.trainRatio, `🚂 +${t(rh.laid)} km`, 'to track end', false) : ''}
        ${seg('truck', f.truckRatio, `🚚 ${t(f.truckCap)} t/d`, `${t(f.gap)} km`, true)}
      </div>
      <div class="pipe-node"><b>Front</b><small>${days(f.daysF, '⛽', 'fuel')}</small><small>${days(f.daysA, '💥', 'ammo')}</small><small>uses ${t(f.need)}/d</small></div>
      ${nextStation(sec)}`;
  }

  // A station's health bar: green, amber or red like the bars under the towns on the map
  function health(id) {
    if (id === 'warsaw') return '';
    const c = Math.round(st.nodes[id].cond);
    const col = c > 66 ? 'var(--good)' : c > 33 ? 'var(--fuel)' : 'var(--bad)';
    return `<small class="dayrow" title="Station condition: trains it can take scale with this"><span class="bar"><i style="width:${c}%;background:${col}"></i></span><span class="${c <= 33 ? 'warn' : ''}">${c}%</span></small>`;
  }

  // How far the front still has to go to the next station on its line
  function nextStation(sec) {
    const line = Sim.sectorDef(sec.id).line, kms = Sim.LINES[sec.id];
    const i = kms.findIndex(k => k > sec.front + 0.5);
    if (i < 0) return '<div class="pipe-next done"><span class="flow">🏁</span><span class="sub">line taken</span></div>';
    return `<div class="pipe-next" title="The next station the front will take"><span class="flow">${t(kms[i] - sec.front)} km</span><i></i><span class="sub">${NODES[line[i]].name}${OBJECTIVES.includes(line[i]) ? ' 🎯' : ''}</span></div>`;
  }

  function freeBadge(id, n) {
    const e = $(id);
    e.textContent = n + ' free';
    e.classList.toggle('have', n > 0);
  }

  function update() {
    const date = Sim.dateText(Math.min(st.day, LAST_DAY));
    $('#date').textContent = date;
    $('#day').textContent = `Day ${Math.min(st.day, LAST_DAY)} of ${LAST_DAY}`;
    $('#objectives').innerHTML = OBJECTIVES.map(id => `<span class="obj ${st.nodes[id].captured ? 'done' : ''}">${st.nodes[id].captured ? '✅' : '🎯'} ${NODES[id].name}</span>`).join('');
    freeBadge('#free-trains', Sim.freeTrains(st));
    freeBadge('#free-trucks', Sim.freePool(st, 'trucks', TRUCK_COLUMNS));
    freeBadge('#free-engineers', Sim.freePool(st, 'engineers', ENGINEERS));
    freeBadge('#free-bombers', Sim.freePool(st, 'bombers', BOMBER_GROUPS - st.bombersLost));

    for (const c of cards) {
      const { sec } = c;
      c.status.textContent = sec.status || 'Ready';
      c.status.className = 'status ' + (/Stalled|Pushed|out of/.test(sec.status) ? 'bad' : /Slowed/.test(sec.status) ? 'meh' : 'ok');
      c.posture.update();
      c.pipe.innerHTML = pipeHTML(sec);
      const [adviceTone, adviceText] = advise(sec);
      c.advice.className = 'c-advice ' + adviceTone;
      c.advice.innerHTML = adviceText;
      for (const s of c.steppers) s.update();
      c.focus.update();
      const rec = matchMix(sec);
      c.mix.update(rec);
      c.mixNote.innerHTML = sec.fuelMix === rec ? '<span>matches what it uses</span>' : '<span><span class="warn">green line</span> matches what it uses</span>';
      const forces = UNIT_ORDER.map(u => `<span class="force" title="${UNIT_TYPES[u].name}">${unitIcon(u)} ${UNIT_TYPES[u].short}: <b>${sec.forces[u]}</b></span>`).join('');
      const coming = [
        ...st.queue.filter(q => q.sector === sec.id).map(q => `${unitIcon(q.type)} ${UNIT_TYPES[q.type].short} loading`),
        ...st.marching.filter(m => m.sector === sec.id).map(m => `${unitIcon(m.type)} ${UNIT_TYPES[m.type].short} in ${Math.max(1, m.day - st.day + 1)} d`),
      ];
      c.forces.innerHTML = forces + (coming.length ? `<span class="coming">coming: ${coming.join(', ')}</span>` : '');
    }

    // Reserves at Warsaw
    const res = $('#reserves');
    res.textContent = '';
    if (!st.reserves.length && !st.queue.length) res.append(el('p', 'muted', 'No units waiting. More arrive over the coming weeks.'));
    if (st.reserves.length && Sim.freeTrains(st) < 2) res.append(el('p', 'res-hint', '👉 Free trains first: lower a 🚂 Trains below'));
    for (const type of UNIT_ORDER) {
      const units = st.reserves.filter(u => u.type === type);
      if (!units.length) continue;
      const T = UNIT_TYPES[type];
      const row = el('div', 'unit');
      row.append(el('div', '', `${unitIcon(type)} <b>${units.length} × ${T.name}</b> <span class="muted cost">${T.trains} 🚂 · ${T.need.advance.fuel + T.need.advance.ammo} t/d</span>`));
      const btns = el('div', 'send');
      btns.title = `Each takes ${T.trains} trains to send, then uses ${T.need.advance.fuel + T.need.advance.ammo} t a day`;
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
      row.append(el('span', '', `${unitIcon(q.type)} <b>${UNIT_TYPES[q.type].name}</b> <span class="muted">loading for ${Sim.sectorDef(q.sector).name}</span> `));
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
    faceRight(document.body);
  }

  // Station hover: condition, traffic, and the stocks held there
  function tooltip(id, x, y) {
    const tip = $('#tip');
    if (!id) { tip.hidden = true; return; }
    const n = st.nodes[id], N = NODES[id];
    const lines = [`<b>${N.name}</b>${OBJECTIVES.includes(id) ? ' 🎯 objective' : ''}`];
    if (id === 'warsaw') {
      lines.push(`Supply base: ${TRAINS_PER_DAY} trains a day start here`);
      const waiting = UNIT_ORDER.map(u => [u, st.reserves.filter(r => r.type === u).length]).filter(([, k]) => k);
      lines.push(waiting.length ? 'Reserves: ' + waiting.map(([u, k]) => `${k} ${UNIT_TYPES[u].short}`).join(', ') : 'No reserves waiting');
    } else if (!n.captured) {
      lines.push('Held by the Soviets');
      for (const sec of st.sectors) {
        const i = Sim.sectorDef(sec.id).line.indexOf(id);
        if (i > 0) lines.push(`${t(Sim.LINES[sec.id][i] - sec.front)} km ahead of the ${Sim.sectorDef(sec.id).name} front`);
      }
    } else {
      // Trains a day through here, against what the station can take
      let through = 0;
      for (const sec of st.sectors) {
        const i = Sim.sectorDef(sec.id).line.indexOf(id);
        if (i > 0 && i <= Sim.railhead(st, sec).index) through += (window.Game.forecast[sec.id] || { trains: 0 }).trains;
      }
      lines.push(`Condition <b>${Math.round(n.cond)}%</b> · trains ${through.toFixed(1)} of ${(N.cap * n.cond / 100).toFixed(1)} a day`);
      const depots = st.sectors.filter(sec => Sim.railhead(st, sec).node === id);
      for (const sec of depots) {
        const rh = Sim.railhead(st, sec);
        lines.push(`<b>${Sim.sectorDef(sec.id).name} depot</b>${rh.laid >= 1 ? ` (at the end of the track, ${t(rh.laid)} km on)` : ''}: ⛽ ${t(sec.depot.fuel)} t · 💥 ${t(sec.depot.ammo)} t`);
      }
      if (!depots.length) lines.push('No depot here: trains pass through');
    }
    tip.innerHTML = lines.join('<br>');
    tip.hidden = false;
    tip.style.left = Math.min(x + 14, window.innerWidth - 270) + 'px';
    tip.style.top = Math.min(y + 14, window.innerHeight - 120) + 'px';
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
