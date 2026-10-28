// Railhead: the staff map. It is 1000 units wide and as tall as its box allows.
// Stations are placed for a clear game board rather than true geography

const Draw = (() => {
  const W = 1000;
  let H = 425;
  let canvas, ctx, paper, paperH = 0, scale = 1;

  // Room left round the stations for their labels
  const M = { left: 70, right: 80, top: 40, bottom: 48 };

  // Where each station sits: x from 0 (left) to 1 (right), y from 0 (top) to 1 (bottom)
  const LAYOUT = {
    warsaw: [0.00, 0.60], bialystok: [0.18, 0.47], brest: [0.23, 1.00],
    lida: [0.36, 0.33], molodechno: [0.49, 0.20], polotsk: [0.66, 0.00], vitebsk: [0.79, 0.07],
    baranovichi: [0.42, 0.74], minsk: [0.55, 0.47], borisov: [0.64, 0.36], orsha: [0.79, 0.30], smolensk: [0.93, 0.19],
    slutsk: [0.55, 0.88], bobruisk: [0.69, 0.82], mogilev: [0.80, 0.58], roslavl: [1.00, 0.60],
  };

  // Map position from a layout position
  const px = (fx, fy) => ({ x: M.left + fx * (W - M.left - M.right), y: M.top + fy * (H - M.top - M.bottom) });
  const P = {};
  function project() { for (const id in NODES) P[id] = px(...LAYOUT[id]); }
  project();

  // Point a given distance (km from Warsaw) along a sector's line
  function along(sectorId, km) {
    const line = Sim.sectorDef(sectorId).line, kms = Sim.LINES[sectorId];
    for (let i = 1; i < line.length; i++) {
      if (km <= kms[i] || i === line.length - 1) {
        const f = Math.max(0, Math.min(1, (km - kms[i - 1]) / (kms[i] - kms[i - 1])));
        const a = P[line[i - 1]], b = P[line[i]];
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return P[line[0]];
  }

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    paperH = 0;
    resize();
  }

  // Fill the whole box (on narrow screens, or with no box, keep the 1000 x 425 shape)
  function resize() {
    const box = canvas.closest('.mapbox');
    const dpr = window.devicePixelRatio || 1;
    let w, h;
    if (box && !window.matchMedia('(max-width: 1250px)').matches && box.clientHeight > 100) {
      w = box.clientWidth; h = box.clientHeight;
    } else {
      w = box ? box.clientWidth : canvas.getBoundingClientRect().width; h = w * 425 / W;
    }
    H = Math.round(W * h / w);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = canvas.width / W;
    if (H !== paperH) { project(); paper = makePaper(); paperH = H; }
  }

  // Seeded scatter so the paper, forests and marsh look the same every time
  function scatter(seed) {
    let a = seed;
    return () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  }

  // The paper, rivers, forests and marsh never change, so they are drawn once
  function makePaper() {
    const c = document.createElement('canvas');
    c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    const grad = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
    grad.addColorStop(0, '#efe3c4'); grad.addColorStop(1, '#d9c79c');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const r = scatter(7);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(90,70,30,${r() * 0.06})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    // Map grid
    g.strokeStyle = 'rgba(120,95,50,.16)'; g.lineWidth = 0.7;
    for (let x = 50; x < W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 50; y < H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const pts = list => list.map(([fx, fy]) => px(fx, fy));
    // Pripet marshes: a small patch at the bottom
    const marsh = pts([[0.30, 1.12], [0.34, 0.96], [0.46, 0.93], [0.62, 0.96], [0.70, 1.12]]);
    g.fillStyle = 'rgba(110,130,100,.16)';
    g.beginPath(); g.moveTo(marsh[0].x, marsh[0].y);
    for (const p of marsh) g.lineTo(p.x, p.y);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,95,70,.45)'; g.lineWidth = 0.8;
    for (let i = 0; i < 160; i++) {
      const x = marsh[0].x + r() * (marsh[4].x - marsh[0].x), y = marsh[2].y + r() * (H - marsh[2].y);
      if (!g.isPointInPath(x, y)) continue;
      g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y);
      g.moveTo(x - 2, y); g.lineTo(x - 3, y - 4); g.moveTo(x, y); g.lineTo(x, y - 5); g.moveTo(x + 2, y); g.lineTo(x + 3, y - 4); g.stroke();
    }
    g.fillStyle = 'rgba(60,80,60,.55)'; g.font = 'italic 12px Georgia, serif';
    const ml = px(0.40, 1.02);
    g.fillText('P R I P E T   M A R S H E S', ml.x, ml.y);
    // Forests
    const forests = [[0.26, 0.24], [0.29, 0.62], [0.47, 0.06], [0.62, 0.62], [0.88, 0.04], [0.44, 0.48], [0.90, 0.42], [0.12, 0.30], [0.71, 0.20]];
    for (const [fx, fy] of forests) {
      const c0 = px(fx, fy);
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 36;
        const x = c0.x + Math.cos(a) * d * 1.4, y = c0.y + Math.sin(a) * d * 0.8;
        g.fillStyle = `rgba(80,105,60,${0.12 + r() * 0.12})`;
        g.beginPath(); g.arc(x, y, 3 + r() * 3, 0, Math.PI * 2); g.fill();
      }
    }
    // Rivers, drawn to pass the right towns on this layout
    const rivers = {
      'Dvina':    [[0.46, -0.12], [0.58, -0.04], [0.67, 0.03], [0.73, 0.06], [0.80, 0.10], [0.88, 0.07], [0.97, -0.06]],
      'Dnieper':  [[1.03, 0.14], [0.94, 0.22], [0.86, 0.26], [0.80, 0.33], [0.79, 0.45], [0.81, 0.61], [0.77, 0.80], [0.79, 1.12]],
      'Berezina': [[0.60, 0.10], [0.64, 0.38], [0.66, 0.60], [0.70, 0.84], [0.73, 1.12]],
      'Neman':    [[0.22, 0.12], [0.30, 0.30], [0.40, 0.40], [0.48, 0.38], [0.53, 0.30]],
      'Bug':      [[0.17, 1.12], [0.235, 1.03], [0.17, 0.86], [0.08, 0.76], [0.02, 0.66]],
      'Sozh':     [[0.98, 0.32], [0.93, 0.50], [0.89, 0.72], [0.86, 1.12]],
    };
    g.strokeStyle = 'rgba(70,110,150,.7)'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = 'rgba(50,90,130,.75)'; g.font = 'italic 11px Georgia, serif';
    for (const name in rivers) {
      const rp = pts(rivers[name]);
      g.lineWidth = name === 'Dnieper' || name === 'Dvina' ? 2.6 : 1.8;
      g.beginPath(); g.moveTo(rp[0].x, rp[0].y);
      for (let i = 1; i < rp.length - 1; i++) {
        const mx = (rp[i].x + rp[i + 1].x) / 2, my = (rp[i].y + rp[i + 1].y) / 2;
        g.quadraticCurveTo(rp[i].x, rp[i].y, mx, my);
      }
      g.lineTo(rp[rp.length - 1].x, rp[rp.length - 1].y); g.stroke();
      const m = rp[Math.max(1, Math.floor(rp.length / 3))];
      g.fillText(name, m.x + 6, m.y - 4);
    }
    // The border on 22 June
    const border = pts([[0.13, -0.12], [0.14, 0.28], [0.10, 0.48], [0.13, 0.72], [0.21, 0.95], [0.26, 1.12]]);
    g.strokeStyle = 'rgba(110,60,110,.55)'; g.lineWidth = 2; g.setLineDash([10, 5, 2, 5]);
    g.beginPath(); g.moveTo(border[0].x, border[0].y); for (const p of border) g.lineTo(p.x, p.y); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(110,60,110,.7)'; g.font = '10px "Special Elite", monospace';
    const bl = px(0.145, 0.10);
    g.save(); g.translate(bl.x, bl.y); g.rotate(1.53); g.fillText('Border 22.6.41', 0, 0); g.restore();
    // Title block
    g.fillStyle = 'rgba(40,30,15,.85)'; g.font = '22px "Special Elite", monospace';
    g.fillText('RAILHEAD', 24, 40);
    return c;
  }

  // Track: converted part solid, broad gauge dashed
  function drawLink(st, key) {
    const L = Sim.LINKS[key], a = P[L.a], b = P[L.b];
    const f = st.links[key].done / L.len;
    const mx = a.x + (b.x - a.x) * f, my = a.y + (b.y - a.y) * f;
    ctx.lineCap = 'butt';
    if (f < 1) {
      ctx.strokeStyle = 'rgba(120,40,30,.6)'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (f > 0) {
      ctx.strokeStyle = '#2b2418'; ctx.lineWidth = L.cap >= 7 ? 5 : 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
      // Railway sleepers
      ctx.strokeStyle = '#efe3c4'; ctx.lineWidth = 1.2;
      const len = Math.hypot(mx - a.x, my - a.y), ux = (mx - a.x) / (len || 1), uy = (my - a.y) / (len || 1);
      for (let d = 6; d < len; d += 9) {
        const x = a.x + ux * d, y = a.y + uy * d;
        ctx.beginPath(); ctx.moveTo(x - uy * 2.5, y + ux * 2.5); ctx.lineTo(x + uy * 2.5, y - ux * 2.5); ctx.stroke();
      }
      if (f < 1) {
        ctx.fillStyle = '#c47a1a';
        ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Buildings for a small and a large town: [x, height, width, roof] from the town's centre
  const TOWN = {
    small: [[-8, 8, 6, 'gable'], [-1, 11, 6, 'flat'], [5, 7, 5, 'gable']],
    large: [[-12, 9, 6, 'gable'], [-6, 15, 5, 'flat'], [-1, 20, 4, 'spire'], [3, 12, 6, 'flat'], [9, 8, 5, 'gable']],
  };

  // Each station is a small or large town; the more it is damaged, the more fire and smoke
  function drawStation(st, id, hover) {
    const p = P[id], n = st.nodes[id], N = NODES[id];
    const objective = OBJECTIVES.includes(id);
    const big = N.cap >= 9;
    const base = p.y + 6;
    ctx.lineWidth = 1.2;
    ctx.fillStyle = n.captured ? '#f4ead2' : '#e9c6b8';
    ctx.strokeStyle = n.captured ? '#2b2418' : '#8a2a1e';
    for (const [bx, h, w, roof] of TOWN[big ? 'large' : 'small']) {
      const x = p.x + bx, top = base - h;
      ctx.beginPath();
      ctx.rect(x, top, w, h);
      if (roof === 'gable') { ctx.moveTo(x - 1, top); ctx.lineTo(x + w / 2, top - 4); ctx.lineTo(x + w + 1, top); }
      if (roof === 'spire') { ctx.moveTo(x, top); ctx.lineTo(x + w / 2, top - 7); ctx.lineTo(x + w, top); }
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(p.x - (big ? 14 : 10), base); ctx.lineTo(p.x + (big ? 15 : 11), base); ctx.stroke();
    if (n.captured && id !== 'warsaw') {
      fire(p, base, 1 - n.cond / 100, big, id);
      // Condition bar
      const c = n.cond / 100;
      ctx.fillStyle = 'rgba(40,30,15,.25)'; ctx.fillRect(p.x - 12, base + 4, 24, 4);
      ctx.fillStyle = c > 0.66 ? '#3f7a3a' : c > 0.33 ? '#c47a1a' : '#a3291c';
      ctx.fillRect(p.x - 12, base + 4, 24 * c, 4);
    }
    if (objective) {
      ctx.strokeStyle = n.captured ? '#3f7a3a' : '#a3291c'; ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(p.x, p.y - 2, big ? 20 : 16, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (hover) { ctx.strokeStyle = '#1a5fa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 2, big ? 24 : 20, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#2b2418';
    ctx.font = (big ? 'bold 13px' : '12px') + ' Georgia, serif';
    const [lx, ly] = labelOffset(id);
    ctx.fillText(N.name, p.x + lx, p.y + ly);
  }

  function labelOffset(id) {
    const big = NODES[id].cap >= 9;
    if (id === 'warsaw') return [-40, -18];
    return [big ? 17 : 13, id === 'polotsk' ? -12 : -9];
  }

  // Flames and smoke over a damaged town: none when whole, more and bigger as damage grows
  function fire(p, base, dmg, big, id) {
    if (dmg < 0.08) return;
    let seed = 0;
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const spread = big ? 12 : 8;
    // Smoke first, so the flames sit in front of it
    const puffs = Math.round(dmg * 9);
    for (let k = 0; k < puffs; k++) {
      const up = 10 + k * (4 + dmg * 4);
      ctx.fillStyle = `rgba(60,55,50,${Math.max(0.08, 0.25 + dmg * 0.35 - k * 0.03)})`;
      ctx.beginPath(); ctx.arc(p.x + (r() - 0.3) * spread + k * 3, base - up - 6, 2.5 + k * 1.1 + dmg * 3, 0, Math.PI * 2); ctx.fill();
    }
    const flames = Math.max(1, Math.round(dmg * 7));
    for (let k = 0; k < flames; k++) {
      const x = p.x + (r() * 2 - 1) * spread, h = 4 + dmg * 16 * (0.6 + r() * 0.6), w = 2 + dmg * 3.5;
      const y = base - 4 - r() * (big ? 10 : 6);
      ctx.fillStyle = '#d9541e';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w, y - h * 0.6, x, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.6, x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2b233';
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w / 2, y - h * 0.4, x, y - h * 0.6); ctx.quadraticCurveTo(x + w / 2, y - h * 0.4, x + w / 2, y); ctx.closePath(); ctx.fill();
    }
  }

  // Unit pictures facing east, on a 24 x 16 grid: a soldier, a tank and a field gun.
  // Each part is drawn in order in the dark body colour or the light paper colour
  const UNIT_ART = {
    inf: [
      ['body', 'M15.3 3.1L16.2 3.7L9.7 13.7L8.8 13.1Z'],
      ['body', 'M10 3.5C10.1 1.6 11.1 0.6 12.5 0.6S14.9 1.6 15 3.5Z'],
      ['body', 'M11.1 4.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0Z'],
      ['body', 'M10.4 6H14.6L14.1 10.4H10.9Z'],
      ['body', 'M10.9 10.2H12.3L11.8 15.6H10.3Z'],
      ['body', 'M12.7 10.2H14.1L14.8 15.6H13.3Z'],
    ],
    pz: [
      ['body', 'M3.5 10H20.5A2.5 2.5 0 0 1 20.5 15H3.5A2.5 2.5 0 0 1 3.5 10Z'],
      ['light', 'M3.7 12.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM7.7 12.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM11.7 12.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0ZM15.7 12.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0Z'],
      ['body', 'M2.5 9.6L4.6 6.8H19.6L22 9.6Z'],
      ['body', 'M8 6.8V4.6Q8 3.6 9 3.6H14.2Q15 3.6 15.4 4.6L16 6.8Z'],
      ['body', 'M15.2 4.5H23.6V5.7H15.4Z'],
    ],
    art: [
      ['body', 'M9.6 10.6L1 15L1.5 15.9L10.4 12Z'],
      ['body', 'M8.6 8.3L22.6 2.9L23.1 4.2L9.3 10.1Z'],
      ['body', 'M11.2 5.6L13.6 4.6L14.5 9.2L11.8 9.8Z'],
      ['body', 'M5.8 11.5a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0-8.4 0Z'],
      ['light', 'M7.2 11.5a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0Z'],
      ['body', 'M9 11.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0Z'],
    ],
  };
  const UNIT_COLOURS = { body: '#4b5638', light: '#e6dcc0' };
  const paths = {};

  function unitPicture(type, x, y, w = 26, h = 17) {
    ctx.save(); ctx.translate(x, y); ctx.scale(w / 24, h / 16);
    for (const [part, d] of UNIT_ART[type]) {
      ctx.fillStyle = UNIT_COLOURS[part];
      ctx.fill(paths[d] || (paths[d] = new Path2D(d)));
    }
    ctx.restore();
  }

  // Reserves waiting at Warsaw: one picture per unit, a row per type, overlapping a little when there are many
  function drawReserves(st) {
    const box = reserveBox();
    let row = 0;
    for (const type of UNIT_ORDER) {
      const n = st.reserves.filter(u => u.type === type).length;
      if (!n) continue;
      const step = n > 1 ? Math.min(20, (box.w - 26) / (n - 1)) : 0;
      for (let k = 0; k < n; k++) unitPicture(type, box.x + k * step, box.y + 4 + row * ROW_H);
      row++;
    }
  }

  // A railhead flag in the sector's colour
  function drawRailhead(st, sec, i) {
    const rh = Sim.railhead(st, sec);
    if (rh.node === 'warsaw') return;
    const col = Sim.sectorDef(sec.id).colour;
    const past = rh.laid >= 1;
    // At a station the flag stands just left of the town; out on the line it stands on the track
    const p = past ? along(sec.id, rh.km) : P[rh.node];
    const ox = past ? 0 : -20 + (i - 1) * 6;
    ctx.strokeStyle = '#2b2418'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x + ox, p.y + 4); ctx.lineTo(p.x + ox, p.y - 20); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(p.x + ox, p.y - 20); ctx.lineTo(p.x + ox - 13, p.y - 16); ctx.lineTo(p.x + ox, p.y - 12); ctx.closePath(); ctx.fill();
  }

  // The front line and the Soviet side shaded
  function drawFront(st) {
    const pts = st.sectors.map(s => along(s.id, s.front));
    const top = { x: pts[0].x + 40, y: 0 }, bottom = { x: pts[2].x + 10, y: H };
    const line = [top, ...pts, bottom];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(line[0].x, line[0].y);
    for (const p of line) ctx.lineTo(p.x, p.y);
    ctx.lineTo(W, H); ctx.lineTo(W, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(170,50,35,.07)'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(170,50,35,.12)'; ctx.lineWidth = 1;
    for (let x = -H; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(150,35,25,.85)'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length - 1; i++) {
      const mx = (line[i].x + line[i + 1].x) / 2, my = (line[i].y + line[i + 1].y) / 2;
      ctx.quadraticCurveTo(line[i].x, line[i].y, mx, my);
    }
    ctx.lineTo(bottom.x, bottom.y); ctx.stroke();
    // Teeth facing the enemy
    ctx.fillStyle = 'rgba(150,35,25,.85)';
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      for (let d = 10; d < len - 5; d += 18) {
        const x = a.x + ux * d, y = a.y + uy * d;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - uy * 7 + ux * 4, y + ux * 7 + uy * 4); ctx.lineTo(x + ux * 8, y + uy * 8); ctx.fill();
      }
    }
  }

  // The sector's badge sits back on the German side, as a speech bubble whose tail points at its front
  const BADGE_W = 98, BADGE_H = 40;

  // The railhead flags, which badges must not cover either (same spots as drawRailhead uses)
  function flagBoxes(st) {
    return st.sectors.map((sec, i) => {
      const rh = Sim.railhead(st, sec);
      const past = rh.laid >= 1;
      const p = past ? along(sec.id, rh.km) : P[rh.node];
      const ox = past ? 0 : -20 + (i - 1) * 6;
      return { x: p.x + ox - 16, y: p.y - 23, w: 19, h: 29 };
    });
  }

  // The stack of reserve units beside Warsaw, and the room it may take
  const ROW_H = 20;
  function reserveBox() {
    const p = P.warsaw;
    return { x: p.x - 60, y: p.y + 8, w: 100, h: 6 + ROW_H * UNIT_ORDER.length };
  }

  // Everything a badge must not cover: each station and its name, and the reserves
  function stationBoxes() {
    const boxes = [reserveBox()];
    for (const id in NODES) {
      const p = P[id], big = NODES[id].cap >= 9;
      ctx.font = (big ? 'bold 13px' : '12px') + ' Georgia, serif';
      const [lx, ly] = labelOffset(id);
      boxes.push({ x: p.x - 16, y: p.y - 34, w: 32, h: 50 });                                   // town, its smoke, condition bar, objective ring
      boxes.push({ x: p.x + lx - 2, y: p.y + ly - 13, w: ctx.measureText(NODES[id].name).width + 4, h: 17 }); // its name
    }
    return boxes;
  }

  // How many points along a badge's tail (box centre to its front) fall inside another box
  function tailHits(box, front, other) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const len = Math.hypot(front.x - cx, front.y - cy);
    let n = 0;
    for (let d = 0; d <= len; d += 5) {
      const x = cx + (front.x - cx) * d / len, y = cy + (front.y - cy) * d / len;
      if (x > other.x && x < other.x + other.w && y > other.y && y < other.y + other.h && !(x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h)) n++;
    }
    return n;
  }

  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  // Where the three badges go: back from their fronts on the German side if there's room,
  // otherwise anywhere nearby (over the front if need be), never on a station or another badge
  let placeCache = { key: '', places: null };
  function badgePlaces(st) {
    // Only worked out again when a front, railhead or the map size changes
    const key = H + '|' + st.sectors.map(sec => Math.round(sec.front) + ':' + Math.round(Sim.railhead(st, sec).km)).join('|');
    if (placeCache.key === key) return placeCache.places;
    placeCache = { key, places: findPlaces(st) };
    return placeCache.places;
  }

  // Score spots for each badge on its own (stations, flags, distance), keep the best few for each,
  // then pick the best combination of three: no overlaps, no hidden tails, North above Centre above South
  function findPlaces(st) {
    const stations = stationBoxes().concat(flagBoxes(st));
    const tries = [];
    for (let dx = -270; dx <= 150; dx += 30) {
      for (let dy = -200; dy <= 200; dy += 20) tries.push({ dx, dy });
    }
    const KEEP = 24;
    const lists = st.sectors.map((sec, i) => {
      const p = along(sec.id, sec.front);
      const want = [{ dx: -150, dy: -100 }, { dx: -165, dy: -20 }, { dx: -140, dy: 60 }][i];
      const opts = [];
      for (const t of tries) {
        const box = { x: p.x + t.dx, y: p.y + t.dy, w: BADGE_W, h: BADGE_H, front: p };
        if (box.x < 4 || box.y < 4 || box.x + box.w > W - 4 || box.y + box.h > H - 4) continue;
        let hit = 0;
        for (const s of stations) hit += overlap(box, s) + tailHits(box, p, s) * 20;
        box.score = hit * 100 + Math.hypot(t.dx - want.dx, (t.dy - want.dy) * 1.5) + (t.dx > 0 ? 120 : 0);
        opts.push(box);
      }
      opts.sort((a, b) => a.score - b.score);
      if (!opts.length) opts.push({ x: Math.max(4, Math.min(W - BADGE_W - 4, p.x - 150)), y: Math.max(4, Math.min(H - BADGE_H - 4, p.y)), w: BADGE_W, h: BADGE_H, front: p, score: 0 });
      return opts.slice(0, KEEP);
    });
    // What two badges cost each other: overlapping, hiding a tail, or being in the wrong order (a above b wanted)
    const pair = (a, b) => {
      let hit = overlap({ x: a.x - 6, y: a.y - 6, w: a.w + 12, h: a.h + 12 }, b) * 10
        + tailHits(a, a.front, b) * 400 + tailHits(b, b.front, a) * 400;
      return hit * 100 + Math.max(0, a.y + 24 - b.y) * 60;
    };
    let best = null, bestScore = Infinity;
    for (const n of lists[0]) {
      for (const c of lists[1]) {
        const nc = n.score + c.score + pair(n, c);
        if (nc >= bestScore) continue;
        for (const so of lists[2]) {
          const total = nc + so.score + pair(c, so) + pair(n, so);
          if (total < bestScore) { bestScore = total; best = [n, c, so]; }
        }
      }
    }
    return best;
  }

  function drawCounter(st, sec, place) {
    const p = along(sec.id, sec.front), col = Sim.sectorDef(sec.id).colour;
    const w = BADGE_W, h = BADGE_H, x = place.x, y = place.y;
    // Tail: from the bubble's nearest side to the exact front point
    const cx = x + w / 2, cy = y + h / 2;
    const ang = Math.atan2(p.y - cy, p.x - cx);
    const nx = -Math.sin(ang) * 7, ny = Math.cos(ang) * 7;
    ctx.fillStyle = '#f4ead2'; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + nx, cy + ny); ctx.lineTo(p.x, p.y); ctx.lineTo(cx - nx, cy - ny); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 6) : ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    // Cover the tail's base inside the bubble
    ctx.beginPath(); ctx.moveTo(cx + nx * 0.8, cy + ny * 0.8); ctx.lineTo(cx - nx * 0.8, cy - ny * 0.8);
    ctx.strokeStyle = '#f4ead2'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(Sim.sectorDef(sec.id).name.toUpperCase(), x + 6, y + 12);
    // Icon, bar, then days in hand. Full bar = 3 days of advancing, the most the trucks stock at the front
    const n = Sim.needs(sec, 'advance');
    const row = (ch, days, yy, c) => {
      ctx.font = '9px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillText(ch, x + 5, yy + 2);
      ctx.fillStyle = 'rgba(40,30,15,.18)'; ctx.fillRect(x + 18, yy, 40, 5);
      ctx.fillStyle = c; ctx.fillRect(x + 18, yy, 40 * Math.max(0, Math.min(1, days / 3)), 5);
      ctx.fillStyle = days < 1 ? '#a3291c' : '#2b2418'; ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText(`${days.toFixed(1)} d`, x + 62, yy + 3);
      ctx.textBaseline = 'alphabetic';
    };
    row('⛽', sec.stock.fuel / (n.fuel || 1), y + 18, '#c47a1a');
    row('💥', sec.stock.ammo / (n.ammo || 1), y + 29, '#5a5a5a');
  }

  function arrow(from, to, col, wide) {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wide; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x - Math.cos(ang) * 10, to.y - Math.sin(ang) * 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - Math.cos(ang - 0.5) * 18, to.y - Math.sin(ang - 0.5) * 18);
    ctx.lineTo(to.x - Math.cos(ang + 0.5) * 18, to.y - Math.sin(ang + 0.5) * 18); ctx.fill();
  }

  function burst(p, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 7 : 16, a = i / 16 * Math.PI * 2;
      ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }

  function render(st, opts) {
    opts = opts || {};
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(paper, 0, 0, W, H);
    drawFront(st);
    for (const key in Sim.LINKS) drawLink(st, key);
    // Last day's Soviet attacks and the reported build-up
    for (const id of st.events.attacks || []) {
      const p = along(id, st.sectors.find(s => s.id === id).front);
      arrow({ x: p.x + 90, y: p.y + 10 }, { x: p.x + 10, y: p.y + 2 }, 'rgba(170,30,20,.85)', 6);
    }
    if (st.intel) {
      const sec = st.sectors.find(s => s.id === st.intel.sector);
      const p = along(sec.id, sec.front + 45);
      p.y -= 28;
      ctx.fillStyle = 'rgba(170,30,20,.8)'; ctx.font = 'bold 22px Georgia, serif';
      ctx.fillText('?', p.x + 4, p.y + 8);
      ctx.strokeStyle = 'rgba(170,30,20,.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.ellipse(p.x + 10, p.y, 26, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const id in NODES) drawStation(st, id, opts.hover === id);
    drawReserves(st);
    for (const id of st.events.raids || []) burst({ x: P[id].x + 14, y: P[id].y - 14 }, 'rgba(200,60,20,.75)');
    st.sectors.forEach((s, i) => drawRailhead(st, s, i));
    const places = badgePlaces(st);
    st.sectors.forEach((s, i) => drawCounter(st, s, places[i]));
    if (opts.anim) drawMoving(st, opts.anim);
  }

  // Share of their route the trains and lorries cover in one day's animation (keeps their speed when the animation is shorter)
  const ROLL = 0.5;

  // Trains and lorries moving during the end-of-day animation, using the same 🚂 and 🚚 as the sector rows
  function drawMoving(st, a) {
    const t = a.t * ROLL;
    st.sectors.forEach((sec, i) => {
      const rhKm = a.railheads[i], frontKm = a.fronts[i];
      const trains = Math.min(4, Math.round(sec.trains));
      for (let k = 0; k < trains; k++) {
        const p = along(sec.id, ((t + k / trains) % 1) * rhKm);
        icon('🚂', p.x, p.y - 9);
      }
      if (frontKm - rhKm < 2) return;
      const trucks = Math.min(3, sec.trucks);
      for (let k = 0; k < trucks; k++) {
        const p = along(sec.id, rhKm + ((t + k / trucks) % 1) * (frontKm - rhKm));
        icon('🚚', p.x, p.y + 9);
      }
    });
  }

  // Draw an emoji icon facing right (the emoji themselves face left)
  function icon(ch, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.font = '17px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  // Which station is under the pointer (canvas pixels in, station id out)
  function hit(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width * W, y = (clientY - r.top) / r.height * H;
    for (const id in P) if (Math.hypot(P[id].x - x, P[id].y - y) < 16) return id;
    const b = reserveBox();
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return 'warsaw';
    return null;
  }

  return { init, resize, render, hit, along, P, W, UNIT_ART, UNIT_COLOURS, get H() { return H; } };
})();
