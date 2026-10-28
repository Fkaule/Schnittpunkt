// Schnittpunkt, Baukasten: einen eigenen Träger bauen (Lager und Lasten im Raster von 0,5 m), dann in Station 2 den Verlauf von Q
// oder in Station 3 die Leine (M) vorhersagen. Der Träger steht als Code im Link (#bau-…); Lagerkräfte und Verläufe zeigt der
// Baukasten nicht, die sollen erst geschätzt werden. Welt in m, x nach rechts, z nach unten, Kräfte in kN.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const { FS, HB, num } = KIT;
  const { LEN, STEP, FMAX, QMAX, NMAX } = BAU;
  const VIEW = [-0.9, -1.95, 4.9, 1.6];
  const DIM = 1;          // Bemaßung unter den Lagern (m)
  const F0 = 2, Q0 = 1;   // Betrag neuer Lasten (kN, kN/m)
  const NAME = { fest: 'Festlager', los: 'Loslager', einspannung: 'Einspannung' };
  const C = {};
  let G = null;
  const st = { d: start(), tool: 'last', sel: null, drag: null, hover: null, hoverPart: null, msg: '' };
  // d: Träger wie in BAU, sel: gewähltes Teil { t: 'sup' | 'load', i }, drag: Verschieben oder neue Streckenlast,
  // hover: Stelle unter dem Zeiger (zum Setzen), hoverPart: Teil unter dem Zeiger

  // Träger aus dem Link, sonst ein Einfeldträger ohne Lasten
  function start() {
    const r = BAU.fromHash(location.hash);
    return r ? r.d : { supports: [{ kind: 'fest', s: 0 }, { kind: 'los', s: LEN }], loads: [] };
  }

  // ---------- Zahlen und Geometrie ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const snap = x => clamp(Math.round(x / STEP) * STEP, 0, LEN) + 0;
  const isLine = ld => 's0' in ld;
  const lv = () => BAU.level(st.d);   // mit Namen (A, B, F1 …) und Bemaßung
  // Griff eines Teils: Kopf einer Einzellast, Mitte über einer Streckenlast, unter einem Lager, an der Einspannung
  function anchor(h) {
    if (h.t === 'sup') { const sp = st.d.supports[h.i]; return sp.kind === 'einspannung' ? [sp.s, 0] : [sp.s, HB / 2 + 0.2]; }
    const ld = st.d.loads[h.i];
    return isLine(ld) ? [(ld.s0 + ld.s1) / 2, -HB / 2 - 0.45] : [ld.s, -HB / 2 - ld.F * FS];
  }

  // ---------- Maßstab und Zeichenwerkzeuge ----------
  function layout() { G = KIT.fit(cv, wrap, VIEW) || G; }
  const toWorld = q => [G.x0 + (q[0] - G.ox) / G.s, G.z0 + q[1] / G.s];
  const K = KIT.make(ctx, { G: () => G, C, P: s => [s, 0], ex: () => [1, 0], ez: () => [0, 1], now: () => 0 });
  const { px, worldView, line, knob, support, member, pointLoad, lineLoad, beside, axesIcon } = K;

  // ---------- Zeichnen ----------
  // Raster als feine Striche auf der Maßlinie, darüber die Bemaßung an allen Kennstellen
  function grid(L) {
    ctx.save(); ctx.strokeStyle = C.ink2; ctx.globalAlpha = 0.5; ctx.lineWidth = px(1);
    for (let s = 0; s <= LEN + 1e-9; s += STEP) line([s, DIM - 0.05], [s, DIM + 0.05]);
    ctx.restore();
    K.dims({ ...L, dimOff: DIM });
  }
  // Vorschau des Werkzeugs an der Stelle unter dem Zeiger, blass, mit Führungslinie und Stelle
  function preview(later) {
    const s = st.hover, t = st.tool;
    if (s == null || st.drag) return;
    ctx.save(); ctx.globalAlpha = 0.35;
    if (t === 'fest' || t === 'los') support({ kind: t, s });
    else if (t === 'einspannung') support({ kind: t, s: s < LEN / 2 ? 0 : LEN });
    else if (t === 'last') pointLoad(s, [0, F0], C.accent, 'F', false, false, false);
    else if (t === 'strecke') { const a = Math.min(s, LEN - 1); lineLoad({ q: [0, Q0] }, a, a + 1, false, null, null); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = C.accent; ctx.lineWidth = px(1.2); ctx.setLineDash([px(4), px(4)]); line([s, -1.25], [s, DIM]); ctx.restore();
    later.push([`${num(s)} m`, C.accent, [beside([s, DIM], [0, 1], 30), beside([s, -1.25], [0, -1], 12)], { weight: 600 }]);
  }
  function render() {
    if (!G) return;
    K.reset();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    worldView();
    const L = lv(), later = [];
    axesIcon(); grid(L);
    for (const sp of L.supports) support(sp);
    member(0, LEN);
    K.loads(L.loads, 0, LEN, true, later);
    preview(later);
    if (st.sel) knob(anchor(st.sel), C.accent, false);
    if (st.tool === 'weg' && st.hoverPart) knob(anchor(st.hoverPart), C.bad, false);
    for (const [str, col, spots, o] of later) K.place(str, col, spots, o);
  }

  // ---------- Ablauf ----------
  // Lager setzen: höchstens ein Festlager und ein Loslager, eine Einspannung trägt allein (an dem Ende, das näher liegt)
  function setSupport(kind, s) {
    const d = st.d;
    if (kind === 'einspannung') d.supports = [{ kind, s: s < LEN / 2 ? 0 : LEN }];
    else d.supports = d.supports.filter(sp => sp.kind !== kind && sp.kind !== 'einspannung').concat({ kind, s });
    st.sel = { t: 'sup', i: d.supports.findIndex(sp => sp.kind === kind) };
  }
  function addLoad(ld) {
    if (st.d.loads.length >= NMAX) { st.msg = `Höchstens ${NMAX} Lasten. Entfernen Sie erst eine.`; return false; }
    st.d.loads.push(ld);
    st.sel = { t: 'load', i: st.d.loads.length - 1 };
    return true;
  }
  // Werkzeug an der Stelle s anwenden; danach lässt sich das neue Teil gleich weiterziehen
  function place(s) {
    const t = st.tool, d = st.d;
    if (t === 'fest' || t === 'los' || t === 'einspannung') setSupport(t, s);
    else if (t === 'last') {
      const j = d.loads.findIndex(ld => !isLine(ld) && ld.s === s);
      if (j >= 0) st.sel = { t: 'load', i: j }; else if (!addLoad({ s, F: F0 })) return false;
    } else if (t === 'strecke') {
      const a = Math.min(s, LEN - STEP);
      if (!addLoad({ s0: a, s1: a + STEP, q: Q0 })) return false;
      st.drag = { t: 'neu', a: s, moved: false, i: st.sel.i };
      return true;
    }
    st.drag = { t: 'move', h: st.sel, off: 0 };
    return true;
  }
  function remove(h) { (h.t === 'sup' ? st.d.supports : st.d.loads).splice(h.i, 1); st.sel = null; }
  // Wert eines Teils um einen Rasterschritt ändern: s Stelle (Streckenlast: ganz verschieben, Einspannung: Seite wechseln),
  // s0 und s1 die Enden einer Streckenlast, F und q die Beträge
  function adjust(h, f, k) {
    const step = k * STEP;
    if (h.t === 'sup') { const sp = st.d.supports[h.i]; sp.s = sp.kind === 'einspannung' ? LEN - sp.s : clamp(sp.s + step, 0, LEN); return; }
    const ld = st.d.loads[h.i];
    if (f === 'F') ld.F = clamp(ld.F + step, STEP, FMAX);
    else if (f === 'q') ld.q = clamp(ld.q + step, STEP, QMAX);
    else if (f === 's0') ld.s0 = clamp(ld.s0 + step, 0, ld.s1 - STEP);
    else if (f === 's1') ld.s1 = clamp(ld.s1 + step, ld.s0 + STEP, LEN);
    else if (isLine(ld)) { const m = clamp(step, -ld.s0, LEN - ld.s1); ld.s0 += m; ld.s1 += m; }
    else ld.s = clamp(ld.s + step, 0, LEN);
  }
  // nach jeder Änderung: Code in den Link (Neuladen behält den Träger), Seitenleiste und Zeichnung
  function commit() {
    const c = BAU.code(st.d);
    history.replaceState(null, '', c ? '#bau-' + c : location.pathname + location.search);
    panel(); render();
  }

  // ---------- Oberfläche ----------
  function supText(L) {
    if (!L.supports.length) return 'noch keins';
    return L.supports.map(sp => (sp.kind === 'einspannung' ? `Einspannung ${sp.name} ${sp.s ? 'rechts' : 'links'}`
      : `${NAME[sp.kind]} ${sp.name} bei ${num(sp.s)} m`)).join(', ');
  }
  function loadText(L) {
    if (!L.loads.length) return 'noch keine';
    return L.loads.map(ld => (ld.q ? `q = ${num(ld.q[1])} kN/m von ${num(ld.s0)} bis ${num(ld.s1)} m`
      : `${ld.name} = ${num(ld.f[1])} kN bei ${num(ld.s)} m`)).join(', ');
  }
  const row = (label, f, val) => `<div class="frow"><span class="fk">${label}</span><button type="button" data-f="${f}" data-d="-1" aria-label="${label} kleiner">−</button>`
    + `<output>${val}</output><button type="button" data-f="${f}" data-d="1" aria-label="${label} größer">+</button></div>`;
  function selBox(L) {
    const box = $('selbox'), h = st.sel;
    if (!h) { box.innerHTML = '<h2>Gewählt</h2><p class="howto">Klicken Sie ein Lager oder eine Last an, um es zu ändern oder zu entfernen.</p>'; return; }
    let title, rows;
    if (h.t === 'sup') {
      const sp = L.supports.find(x => x.i === h.i);
      title = `${NAME[sp.kind]} ${sp.name}`;
      rows = [sp.kind === 'einspannung' ? row('Seite', 's', sp.s ? 'rechts' : 'links') : row('Stelle', 's', `${num(sp.s)} m`)];
    } else {
      const ld = L.loads.find(x => x.i === h.i);
      if (ld.q) { title = 'Streckenlast'; rows = [row('Anfang', 's0', `${num(ld.s0)} m`), row('Ende', 's1', `${num(ld.s1)} m`), row('q', 'q', `${num(ld.q[1])} kN/m`)]; }
      else { title = `Einzellast ${ld.name}`; rows = [row('Stelle', 's', `${num(ld.s)} m`), row('Betrag', 'F', `${num(ld.f[1])} kN`)]; }
    }
    box.innerHTML = `<h2>Gewählt: ${title}</h2>${rows.join('')}<button type="button" class="btn" id="b-del">Entfernen</button>`;
  }
  function verdictHtml(p) {
    const msg = st.msg ? `<p class="t-bad">${st.msg}</p>` : '';
    if (p.bau.length) return msg + p.bau.map(t => `<p class="t-bad">${t}</p>`).join('');
    const no = (what, list) => (list.length ? `<p><b>${what} geht nicht:</b> ${list.join(' ')}</p>` : '');
    return `${msg}<p class="t-ok">Statisch bestimmt. Was sagt Ihr Bauchgefühl? Zeichnen Sie Q oder M vorher.</p>${no('Q zeichnen', p.q)}${no('M zeichnen', p.m)}`;
  }
  function panel() {
    const L = lv(), p = BAU.problems(st.d);
    for (const b of $('tools').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.t === st.tool);
    $('tb-sup').textContent = supText(L);
    $('tb-loads').textContent = loadText(L);
    $('tb-check').textContent = p.bau.length ? 'noch nicht fertig' : 'statisch bestimmt';
    selBox(L);
    $('b-q').disabled = p.bau.length + p.q.length > 0;
    $('b-m').disabled = p.bau.length + p.m.length > 0;
    $('b-clear').disabled = !st.d.supports.length && !st.d.loads.length;
    $('verdict').innerHTML = verdictHtml(p);
  }

  // ---------- Eingabe ----------
  const pointerAt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onBeam = w => w[0] > -0.4 && w[0] < LEN + 0.4 && w[1] > -1.6 && w[1] < 0.8;
  // Teil unter dem Zeiger: Einzellasten vor Streckenlasten (sie stehen darüber), dann Lager
  function hitAt(w) {
    const r = px(14), [x, z] = w, loads = st.d.loads, sups = st.d.supports;
    for (let i = 0; i < loads.length; i++) {
      const ld = loads[i];
      if (!isLine(ld) && Math.abs(x - ld.s) <= r && z >= -HB / 2 - ld.F * FS - r && z <= 0) return { t: 'load', i };
    }
    for (let i = 0; i < loads.length; i++) {
      const ld = loads[i];
      if (isLine(ld) && x >= ld.s0 - r && x <= ld.s1 + r && z >= -HB / 2 - 0.45 - r && z <= 0) return { t: 'load', i };
    }
    for (let i = 0; i < sups.length; i++) {
      const sp = sups[i], dx = Math.abs(x - sp.s);
      if (sp.kind === 'einspannung' ? dx <= 0.25 && Math.abs(z) <= 0.5 : dx <= 0.3 && z >= -0.02 && z <= 0.62) return { t: 'sup', i };
    }
    return null;
  }
  // ein anderes Lager unter dem Zeiger, während ein Lagerwerkzeug gewählt ist: Das Werkzeug ersetzt es an seiner Stelle
  const swaps = h => !!h && h.t === 'sup' && !!NAME[st.tool] && st.d.supports[h.i].kind !== st.tool;
  function drag(w) {
    const g = st.drag;
    if (g.t === 'neu') {   // neue Streckenlast: vom Anfang bis zum Zeiger, mindestens ein Rasterschritt
      const ld = st.d.loads[g.i], b = snap(w[0]);
      if (b !== g.a) { g.moved = true; ld.s0 = Math.min(g.a, b); ld.s1 = Math.max(g.a, b); }
    } else if (g.h.t === 'sup') {
      const sp = st.d.supports[g.h.i];
      sp.s = sp.kind === 'einspannung' ? (w[0] < LEN / 2 ? 0 : LEN) : snap(w[0] - g.off);
    } else {
      const ld = st.d.loads[g.h.i];
      if (isLine(ld)) { const l = ld.s1 - ld.s0; ld.s0 = clamp(snap(w[0] - g.off - l / 2), 0, LEN - l); ld.s1 = ld.s0 + l; }
      else ld.s = snap(w[0] - g.off);
    }
    commit();
  }
  cv.addEventListener('pointerdown', e => {
    if (!G) return;
    const w = toWorld(pointerAt(e)), h = hitAt(w);
    st.msg = '';
    if (st.tool === 'weg') { if (h) { remove(h); st.hoverPart = null; commit(); } return; }
    const swap = swaps(h), s = swap ? st.d.supports[h.i].s : snap(w[0]);
    if (swap) remove(h);
    if (h && !swap) { st.sel = h; st.drag = { t: 'move', h, off: 0 }; }
    else if (!swap && !onBeam(w)) { st.sel = null; panel(); render(); return; }
    else if (!place(s)) { panel(); render(); return; }
    if (st.drag.t === 'move') st.drag.off = w[0] - anchor(st.drag.h)[0];
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    st.hover = null; cv.className = st.drag.t === 'move' ? 'grabbing' : 'pen';
    commit();
  });
  cv.addEventListener('pointermove', e => {
    if (!G) return;
    const w = toWorld(pointerAt(e));
    if (st.drag) { drag(w); return; }
    const h = hitAt(w), swap = swaps(h);
    st.hoverPart = swap ? null : h;
    st.hover = swap ? st.d.supports[h.i].s : !h && onBeam(w) && st.tool !== 'weg' ? snap(w[0]) : null;
    cv.className = h && !swap ? (st.tool === 'weg' ? 'cut' : 'grab') : st.hover != null ? 'pen' : '';
    render();
  });
  cv.addEventListener('pointerleave', () => { if (!st.drag) { st.hover = null; st.hoverPart = null; render(); } });
  const endDrag = () => {
    const g = st.drag;
    if (!g) return;
    if (g.t === 'neu' && !g.moved) { const ld = st.d.loads[g.i], a = Math.min(g.a, LEN - 1); ld.s0 = a; ld.s1 = a + 1; }   // nur geklickt: 1 m lang
    st.drag = null;
    commit();
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('tools').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (b) { st.tool = b.dataset.t; st.msg = ''; panel(); render(); }
  });
  $('selbox').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !st.sel) return;
    if (b.id === 'b-del') remove(st.sel); else adjust(st.sel, b.dataset.f, +b.dataset.d);
    commit();
  });
  // Tastatur für das gewählte Teil: Pfeile links und rechts verschieben, hoch und runter ändern den Betrag, Entf entfernt
  addEventListener('keydown', e => {
    const h = st.sel;
    if (!h || e.altKey || e.ctrlKey || e.metaKey) return;
    const size = h.t === 'load' ? (isLine(st.d.loads[h.i]) ? 'q' : 'F') : null;
    const k = { ArrowLeft: ['s', -1], ArrowRight: ['s', 1], ArrowUp: [size, 1], ArrowDown: [size, -1] }[e.key];
    if (e.key === 'Delete' || e.key === 'Backspace') remove(h);
    else if (k && k[0]) adjust(h, k[0], k[1]);
    else return;
    e.preventDefault();
    commit();
  });
  const go = page => { location.href = `${page}#bau-${BAU.code(st.d)}`; };
  $('b-q').addEventListener('click', () => go('spur.html'));
  $('b-m').addEventListener('click', () => go('leine.html'));
  $('b-clear').addEventListener('click', () => { st.d = { supports: [], loads: [] }; st.sel = null; st.msg = ''; commit(); });
  addEventListener('hashchange', () => { st.d = start(); st.sel = null; commit(); });   // anderer Träger per Link im selben Tab
  addEventListener('resize', () => { layout(); render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { KIT.colors(C); render(); });

  KIT.colors(C);
  layout(); commit();
  if (document.fonts) document.fonts.ready.then(render);
})();
