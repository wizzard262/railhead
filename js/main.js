// Railhead: start-up, the end-of-day animation and input

window.Game = (() => {
  const ANIM_MS = 3200;   // how long the trains and lorries roll at the end of each day
  let st, busy = false, hover = null;
  const canvas = document.getElementById('map');
  const G = window.Game = { forecast: {} };

  function refresh() {
    G.forecast = Sim.forecast(st);
    UI.update();
    Draw.render(st, { hover });
  }

  function start(seed) {
    st = Sim.newGame(seed);
    G.state = st;
    return st;
  }

  // Trains and lorries roll along for a few seconds, then the day is worked out.
  // Pressing End day again (or Enter) skips the rest of the animation
  let skip = false;
  function endDay() {
    if (st.won || st.lost) return;
    if (busy) { skip = true; return; }
    busy = true; skip = false;
    const anim = {
      t: 0,
      railheads: st.sectors.map(s => Sim.railhead(st, s).km),
      fronts: st.sectors.map(s => s.front),
    };
    const t0 = performance.now();
    const step = now => {
      anim.t = skip ? 1 : Math.min(1, (now - t0) / ANIM_MS);
      Draw.render(st, { hover, anim });
      if (anim.t < 1) return requestAnimationFrame(step);
      Sim.endDay(st);
      busy = false;
      refresh();
      if (st.won || st.lost) UI.result();
    };
    requestAnimationFrame(step);
  }

  G.restart = () => { start(); UI.setState(st); refresh(); };
  G.endDay = endDay;

  start();
  Draw.init(canvas);
  UI.init(st, refresh);
  document.getElementById('end-btn').onclick = endDay;
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.target.closest('button, input') && document.querySelectorAll('.modal:not([hidden])').length === 0) { e.preventDefault(); endDay(); }
    if ((e.key === 'h' || e.key === 'H' || e.key === '?') && !e.target.closest('input')) UI.show('#help');
    if (e.key === 'Escape') for (const m of document.querySelectorAll('.modal')) m.hidden = true;
  });
  canvas.addEventListener('pointermove', e => {
    const id = Draw.hit(e.clientX, e.clientY);
    if (id !== hover) { hover = id; if (!busy) Draw.render(st, { hover }); }
    UI.tooltip(id, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { hover = null; UI.tooltip(null); if (!busy) Draw.render(st, {}); });
  // Refit the map whenever its box changes size (window resized, rows below grow)
  const fit = () => { Draw.resize(); if (!busy) Draw.render(st, { hover }); };
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.querySelector('.mapbox'));
  else window.addEventListener('resize', fit);
  // Redraw once the map font has loaded
  if (document.fonts) document.fonts.ready.then(() => { Draw.init(canvas); refresh(); });
  refresh();
  return G;
})();
