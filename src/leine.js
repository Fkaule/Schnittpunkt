// Schnittpunkt, Station 3 „Wäscheleine“: Gewichte an einer Leine zwischen zwei Pfosten hängen genau wie die Momentenlinie des
// Trägers darüber (Seillinie = M geteilt durch den Horizontalzug). Erst Gewichte setzen, den tiefsten Punkt antippen oder die
// Leine zeichnen, dann loslassen. Wie in der Vorlesung: positive Momente nach unten. Welt in m, x nach rechts, z nach unten.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { BODY, HB, num, signed } = KIT;
  const MSC = 0.25;              // Leine: m Durchhang je kNm
  const ZM = 2.05;               // Höhe der Pfostenköpfe = Nulllinie des Momentenbilds (m)
  const GROUND = 3.55;           // Boden unter den Pfosten
  const MLO = -2.4, MHI = 3.6;   // Bereich beim Zeichnen (kNm), über der Nulllinie ist weniger Platz
  const N = 160, TOL = 0.4;      // Stützstellen der gezeichneten Leine, Treffer bis 0,4 kNm daneben
  const SNAP = 0.25;             // Raster beim Verschieben der Gewichte (m)
  const KEY = 'schnittpunkt-leine';
  const C = {};
  let G = null;
  const st = {
    i: 0, lv: null, loads: [], ax: null, react: [], rope: [], peak: null, phase: 'build', drop: 0, tap: null, pen: [], last: null,
    tries: 0, ok: false, got: 0, score: 0, tip: false, touched: false, anim: null, drag: null, now: 0, stars: readStars()
  };
  // build (Gewichte setzen, antippen oder zeichnen, die Gewichte werden noch gehalten), drop (die Leine fällt), hung (ausgewertet)

  function readStars() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(a)) return LEINE.map((_, k) => Math.min(3, a[k] | 0));
    } catch (e) { /* ohne Speicher geht es auch */ }
    return LEINE.map(() => 0);
  }
  function saveStars() { try { localStorage.setItem(KEY, JSON.stringify(st.stars)); } catch (e) { /* ohne Speicher */ } }

  // ---------- Zahlen und Geometrie ----------
  const zero = v => Math.abs(v) < 1e-6;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const lvNow = () => ({ ...st.lv, loads: st.loads });   // Level mit den aktuellen Lagen der Gewichte
  const P = s => MECH.point(st.lv, s);
  const ex = () => st.ax.ex, ez = () => st.ax.ez;
  const L = () => st.ax.L;
  const zOf = m => ZM + m * MSC, mOf = z => (z - ZM) / MSC;
  const xOfK = k => k / N * L();
  const Mat = x => MECH.hold(lvNow(), x, 'minus').My;
  function recompute() { const lv = lvNow(); st.react = MECH.reactions(lv); st.rope = MECH.traceM(lv); st.peak = MECH.peakM(lv); }
  // wie weit die Leine durchhängt: gehalten 0, beim Fallen mit Nachschwingen, hängend 1
  const sag = () => (st.phase === 'build' ? 0 : st.phase === 'drop' ? 1 - Math.exp(-3.2 * st.drop) * Math.cos(7.5 * st.drop) : 1);
  // Moment unter der Leine bei x, aus dem Linienzug
  function ropeM(x) {
    const r = st.rope;
    for (let j = 1; j < r.length; j++) if (x <= r[j][0] + 1e-9) {
      const a = r[j - 1], b = r[j];
      return b[0] > a[0] ? a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]) : b[1];
    }
    return 0;
  }
  const ropeZ = x => zOf(ropeM(x) * sag());
  const dragLoads = () => st.loads.filter(ld => ld.drag);
  const ready = () => st.lv.mode === 'place' || (st.lv.mode === 'tap' ? st.tap != null : st.pen.filter(v => v != null).length >= 10);

  // ---------- Maßstab und Zeichenwerkzeuge ----------
  function layout() { G = KIT.fit(cv, wrap, st.lv.view) || G; }
  const toScreen = p => [G.ox + (p[0] - G.x0) * G.s, (p[1] - G.z0) * G.s];
  const toWorld = q => [G.x0 + (q[0] - G.ox) / G.s, G.z0 + q[1] / G.s];
  const K = KIT.make(ctx, { G: () => G, C, P, ex, ez, now: () => st.now });
  const { px, worldView, line, arrow, place, beside, knob, support, member, pointLoad, axesIcon } = K;

  // ---------- Zeichnen ----------
  // Bereichsgrenzen wie auf der Folie: gestrichelt vom Träger bis zum Boden
  function guides() {
    const xs = new Set([0, L()]);
    for (const ld of st.loads) { if (ld.q) { xs.add(ld.s0); xs.add(ld.s1); } else xs.add(ld.s); }
    for (const sp of st.lv.supports) xs.add(sp.s);
    ctx.save(); ctx.strokeStyle = C.ink2; ctx.globalAlpha = 0.55; ctx.lineWidth = px(1); ctx.setLineDash([px(4), px(4)]);
    for (const s of xs) line([s, HB / 2 + 0.06], [s, GROUND]);
    ctx.restore();
  }
  // Träger mit Lasten, die Lager wirken mit ihren Kräften (Pfeile)
  function beam(later) {
    ctx.save(); ctx.globalAlpha = 0.35;
    for (const sp of st.lv.supports) support(sp);
    ctx.restore();
    member(0, L()); K.loads(st.loads, 0, L(), true, later);
    for (const R of st.react) pointLoad(R.s, R.f, C.react, R.name, false, false, true, later);
  }
  // Raster, Nulllinie zwischen den Pfostenköpfen mit M, + unten und − oben, Boden und Pfosten an den Trägerenden
  function yard() {
    const len = L();
    ctx.save(); ctx.strokeStyle = C.rule; ctx.lineWidth = px(0.8);
    for (const m of [-2, -1, 1, 2, 3]) line([0, zOf(m)], [len, zOf(m)]);
    ctx.restore();
    for (const m of [-2, -1, 1, 2, 3]) K.label(signed(m), [len + 0.12, zOf(m)], C.ink2, { size: 11, align: 'left' });
    ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1); ctx.setLineDash([px(2), px(3)]); line([0, ZM], [len, ZM]); ctx.restore();
    K.label('M', [-0.45, ZM], C.cM, { font: BODY, weight: 700, size: 18 });
    K.label('+', [-0.45, zOf(1.8)], C.ink2, { font: BODY, weight: 700, size: 16 });
    K.label('−', [-0.45, zOf(-1.5)], C.ink2, { font: BODY, weight: 700, size: 16 });
    ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1.4); line([-0.35, GROUND], [len + 0.35, GROUND]);
    ctx.lineWidth = px(1);
    for (let x = -0.35; x < len + 0.35 - 1e-9; x += 0.12) line([x + 0.12, GROUND], [x, GROUND + 0.12]);
    ctx.strokeStyle = C.ink; ctx.lineWidth = px(5); ctx.lineCap = 'round';
    for (const x of [0, len]) line([x, ZM], [x, GROUND]);
    ctx.restore();
  }
  // Schneeflocke: drei Striche durch die Mitte
  function flake(p) {
    const r = px(4);
    for (let a = 0; a < 3; a++) {
      const c = Math.cos(a * Math.PI / 3), s = Math.sin(a * Math.PI / 3);
      line([p[0] - c * r, p[1] - s * r], [p[0] + c * r, p[1] + s * r]);
    }
  }
  // Gewicht am Haken unter der Leine, größer, je schwerer; verschiebbare mit Griff
  function weight(ld, later) {
    const F = ld.f[1], x = ld.s, z = ropeZ(x), wt = 0.14 + 0.025 * F, wb = wt * 1.3, h = 0.13 + 0.03 * F, y0 = z + 0.12;
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.4);
    line([x, z], [x, y0]);
    ctx.beginPath(); ctx.moveTo(x - wt / 2, y0); ctx.lineTo(x + wt / 2, y0); ctx.lineTo(x + wb / 2, y0 + h); ctx.lineTo(x - wb / 2, y0 + h); ctx.closePath();
    ctx.fillStyle = C.steel2; ctx.fill(); ctx.stroke();
    ctx.restore();
    later.push([`${num(F)} kN`, C.ink, [beside([x, y0 + h], [0, 1], 11), beside([x + wb / 2, y0 + h / 2], [1, 0], 6), beside([x - wb / 2, y0 + h / 2], [-1, 0], 6)], {}]);
    if (ld.drag && st.phase === 'build') knob([x, z], C.accent, !st.touched && !reduce);
  }
  // Leine mit Schnee, Gewichten und Haken (Lager mitten unter dem Träger ziehen die Leine nach oben)
  function rope(later) {
    const len = L(), f = sag();
    ctx.save(); ctx.strokeStyle = C.cM; ctx.lineWidth = px(2.8); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    st.rope.forEach((p, j) => { const z = zOf(p[1] * f); if (j) ctx.lineTo(p[0], z); else ctx.moveTo(p[0], z); });
    ctx.stroke(); ctx.restore();
    for (const ld of st.loads) if (ld.q) {
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1.3); ctx.lineCap = 'round';
      for (let x = ld.s0 + 0.1; x <= ld.s1 - 0.1 + 1e-9; x += 0.2) flake([x, ropeZ(x) - 0.1]);
      ctx.restore();
      const xm = (ld.s0 + ld.s1) / 2;
      later.push([`Schnee ${num(ld.q[1])} kN/m`, C.ink2, [beside([xm, ropeZ(xm) - 0.12], [0, -1], 12), beside([xm, ropeZ(xm)], [0, 1], 30)], {}]);
    }
    for (const R of st.react) if (R.s > 1e-6 && R.s < len - 1e-6 && R.f[1] < 0) {
      const z = ropeZ(R.s), t = [R.s, z - 0.16], r = 0.05;   // Haken: Schaft nach oben, unten ein Bogen um die Leine
      ctx.save(); ctx.strokeStyle = C.react; ctx.lineWidth = px(2.4); ctx.lineCap = 'round';
      line(t, [R.s, z - r]);
      ctx.beginPath(); ctx.arc(R.s, z, r, -Math.PI / 2, Math.PI / 9, true); ctx.stroke();   // links herum unter der Leine durch
      ctx.restore();
      later.push([`Haken ${R.name}: ${num(-R.f[1])} kN`, C.react, [beside(t, [1, 0], 8), beside(t, [-1, 0], 8), beside(t, [0, -1], 12)], {}]);
    }
    for (const ld of st.loads) if (!ld.q && ld.s > 1e-6 && ld.s < len - 1e-6) weight(ld, later);   // am Pfosten zieht ein Gewicht nicht an der Leine
  }
  // Vorhersage: Marke beim Antippen, gezeichnete Leine (blau, nach dem Hängen grün, wo sie trifft, rot daneben)
  function prediction(later) {
    const mode = st.lv.mode;
    if (mode === 'tap' && st.tap != null) {
      const x = st.tap, b = GROUND - 0.02, s = px(7);
      ctx.save(); ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = px(2); ctx.setLineDash([px(5), px(4)]);
      line([x, zOf(MLO) + 0.1], [x, b]); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, b - s * 1.4); ctx.lineTo(x - s, b); ctx.lineTo(x + s, b); ctx.closePath(); ctx.fill();
      ctx.restore();
      later.push([`Ihr Tipp: ${num(x)} m`, C.accent, [beside([x, GROUND], [0, 1], 16), beside([x, b], [1, 0], 12)], { weight: 600 }]);
    }
    if (mode === 'draw') {
      ctx.save(); ctx.lineWidth = px(2.4); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < N; k++) {
        const a = st.pen[k], b = st.pen[k + 1];
        if (a == null || b == null) continue;
        ctx.strokeStyle = st.phase !== 'hung' ? C.accent : Math.abs(a - Mat(xOfK(k))) <= TOL ? C.ok : C.bad;
        line([xOfK(k), zOf(a)], [xOfK(k + 1), zOf(b)]);
      }
      ctx.restore();
    }
  }
  // nach dem Hängen: Werte an den Knicken und am tiefsten Punkt, dort eine kurze Waagerechte
  function results(first) {
    if (st.phase !== 'hung') return;
    const len = L(), xs = new Set([st.peak.x]);
    for (const ld of st.loads) if (!ld.q && ld.s > 1e-6 && ld.s < len - 1e-6) xs.add(ld.s);
    for (const R of st.react) if (R.s > 1e-6 && R.s < len - 1e-6) xs.add(R.s);
    let [a, b] = [st.peak.x - 0.3, st.peak.x + 0.3];
    if (st.lv.goal && st.lv.goal.flat && st.ok) { const d = dragLoads().map(ld => ld.s).sort((u, v) => u - v); [a, b] = [d[0], d[d.length - 1]]; }
    const zp = zOf(st.peak.M) - px(6);   // knapp über der Leine, damit sie rot bleibt
    ctx.save(); ctx.strokeStyle = C.ok; ctx.lineWidth = px(3); ctx.lineCap = 'round'; line([Math.max(0, a), zp], [Math.min(len, b), zp]); ctx.restore();
    for (const x of xs) {
      const m = ropeM(x);
      if (zero(m)) continue;
      const p = [x, zOf(m)];
      const toAxis = m > 0 ? [0, -1] : [0, 1];   // zwischen Leine und Nulllinie ist Platz
      first.push([`${signed(m)} kNm`, C.cM, [beside(p, toAxis, 15), beside(p, [1, 0], 12), beside(p, [-1, 0], 12)], { weight: 600 }]);
    }
  }
  function render() {
    if (!G) return;
    K.reset();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    worldView();
    axesIcon(); K.dims(st.lv); guides();
    const first = [], later = [];   // Beschriftungen zuletzt, die Momente zuerst
    beam(later); yard(); prediction(later); rope(later); results(first);
    for (const [str, col, spots, o] of [...first, ...later]) place(str, col, spots, o);
  }

  // ---------- Bewegung ----------
  let raf = 0;
  const busy = () => !!st.anim || (st.phase === 'build' && st.lv.mode === 'place' && !st.touched && !reduce);
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0; st.now = now;
    const a = st.anim;
    if (a) {
      const t = Math.min(Math.max(0, now - a.t0) / 1000, a.dur);
      a.fn(t);
      if (t >= a.dur && st.anim === a) { st.anim = null; if (a.done) a.done(); }
    }
    render();
    if (busy()) raf = requestAnimationFrame(frame);
  }
  function animate(dur, fn, done) { st.anim = { t0: performance.now(), dur: reduce ? 0.01 : dur, fn, done }; kick(); }

  // ---------- Ablauf ----------
  function release() {
    if (st.phase !== 'build' || !ready()) return;
    st.tries++; st.phase = 'drop'; st.drop = 0; panel();
    animate(1.7, t => { st.drop = t; }, () => { st.phase = 'hung'; evaluate(); });
  }
  function goalMet() {
    const g = st.lv.goal;
    if (g.lowest != null) return Math.abs(st.peak.x - g.lowest) <= 0.13;
    const xs = dragLoads().map(ld => ld.s).sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1];
    return x1 - x0 >= 0.99 && Math.abs(Mat(x0) - Mat(x1)) < 1e-6;
  }
  function evaluate() {
    const mode = st.lv.mode;
    let stars, text;
    if (mode === 'place') {
      st.ok = goalMet();
      stars = st.ok ? Math.max(1, 4 - st.tries) : 0;   // im ersten Versuch drei, im zweiten zwei, danach einer
      text = st.ok ? 'PASST' : 'NOCHMAL';
    } else if (mode === 'tap') {
      st.ok = true; st.score = Math.abs(st.tap - st.peak.x);
      stars = st.score <= 0.25 ? 3 : st.score <= 0.5 ? 2 : 1;
      text = st.score <= 0.25 ? 'GENAU' : st.score <= 0.5 ? 'NAH DRAN' : 'DANEBEN';
    } else {
      st.ok = true;
      let hit = 0;
      for (let k = 1; k < N; k++) if (st.pen[k] != null && Math.abs(st.pen[k] - Mat(xOfK(k))) <= TOL) hit++;
      st.score = hit / (N - 1);
      stars = st.score >= 0.95 ? 3 : st.score >= 0.85 ? 2 : st.score >= 0.7 ? 1 : 0;
      text = `${Math.round(st.score * 100)} %`;
    }
    st.got = stars;
    if (stars > st.stars[st.i]) { st.stars[st.i] = stars; saveStars(); }
    const el = $('stamp');
    el.textContent = text;
    el.className = 'stamp ' + (stars ? 'ok' : 'bad') + (reduce ? '' : ' hit');
    el.hidden = false;
    levelsNav(); panel(); render();
  }
  // nochmal: Gewichte, Tipp und Zeichnung bleiben, die Leine wird wieder gehalten
  function again() {
    st.phase = 'build'; st.drop = 0; st.ok = false;
    $('stamp').hidden = true;
    panel(); render(); kick();
  }
  function loadLevel(i) {
    st.i = i; st.lv = LEINE[i]; st.ax = MECH.axes(st.lv.member);
    st.loads = st.lv.loads.map(ld => ({ ...ld }));
    Object.assign(st, { phase: 'build', drop: 0, tap: null, pen: new Array(N + 1).fill(null), last: null, tries: 0, ok: false,
      got: 0, score: 0, tip: false, touched: false, anim: null, drag: null });
    recompute();
    $('stamp').hidden = true;
    levelsNav(); layout(); panel(); render(); kick();
  }

  // ---------- Oberfläche ----------
  function levelsNav() {
    $('levels').innerHTML = LEINE.map((lv, k) => `<button type="button" data-k="${k}" aria-pressed="${k === st.i}" title="${lv.name}"
      aria-label="Level ${k + 1}: ${lv.name}, ${st.stars[k]} von 3 Sternen">${k + 1}<span class="st">${starStr(st.stars[k])}</span></button>`).join('');
  }
  const HOW = {
    place: '<b>Ziehen</b> Sie die Gewichte an der Leine an ihren Platz, noch halten Sie sie fest. Dann <b>Loslassen</b>: Die Leine hängt so, wie die Momentenlinie des Trägers darüber verläuft, positiv nach unten.',
    tap: '<b>Tippen</b> Sie im unteren Bild auf die Stelle, an der die Leine am tiefsten hängen wird. Dann <b>Loslassen</b>.',
    draw: '<b>Zeichnen</b> Sie im unteren Bild die Leine, wie sie hängen wird, von Pfosten zu Pfosten. Dann <b>Loslassen</b>.'
  };
  const RULE = {
    place: 'Sterne: im ersten Versuch drei, im zweiten zwei, danach einer.',
    tap: 'Sterne: bis 0,25 m daneben drei, bis 0,5 m zwei, sonst einer.',
    draw: 'Sterne ab 70, 85 und 95 % Treffer, gewertet mit 0,4 kNm Spielraum.'
  };
  function verdictHtml() {
    const lv = st.lv, ph = st.phase, mode = lv.mode, tip = st.tip ? `<p class="tip">Tipp: ${lv.hint}</p>` : '';
    if (ph === 'build') return `<p>${lv.task}</p>${tip}`;
    if (ph === 'drop') return '<p>Die Leine fällt.</p>';
    if (mode === 'place' && !st.ok) {
      if (lv.goal.lowest != null) return `<p class="t-bad">Noch nicht: Die Leine hängt bei ${num(st.peak.x)} m am tiefsten.</p><p>Verschieben Sie das Gewicht und lassen Sie noch einmal los.</p>${tip}`;
      const d = dragLoads().slice().sort((a, b) => a.s - b.s), m0 = Mat(d[0].s), m1 = Mat(d[d.length - 1].s);
      return `<p class="t-bad">Noch schräg: Unter ${d[0].name} ist M = ${num(m0)} kNm, unter ${d[d.length - 1].name} ${num(m1)} kNm.</p><p>Verschieben Sie die Gewichte und lassen Sie noch einmal los.</p>${tip}`;
    }
    const head = mode === 'place' ? '<p class="t-ok">Passt.</p>'
      : mode === 'tap' ? `<p class="${st.got === 3 ? 't-ok' : 't-bad'}">Am tiefsten hängt die Leine bei ${num(st.peak.x)} m, Ihr Tipp: ${num(st.tap)} m.</p>`
        : `<p class="${st.got ? 't-ok' : 't-bad'}">Treffer: ${Math.round(st.score * 100)} %.</p>`;
    const end = st.i + 1 === LEINE.length
      ? '<p><b>Station 3 geschafft.</b> Als Nächstes käme Station 4, der Verlauf-Detektiv: Fehler in fremden Skizzen finden.</p>' : '';
    return `${head}<p>${lv.aha}</p><p class="tip">${RULE[mode]}</p>${end}`;
  }
  function panel() {
    const lv = st.lv, ph = st.phase, mode = lv.mode;
    $('tb-name').textContent = `${st.i + 1} von ${LEINE.length}: ${lv.name}`;
    $('tb-task').textContent = lv.task;
    $('tb-res').textContent = ph !== 'hung' ? (st.tries ? `${st.tries}-mal losgelassen` : 'noch offen')
      : mode === 'place' ? (st.ok ? `geschafft im ${st.tries}. Versuch` : 'noch nicht')
        : mode === 'tap' ? `${num(st.score)} m daneben` : `${Math.round(st.score * 100)} % Treffer`;
    $('tb-stars').textContent = starStr(st.stars[st.i]);
    $('howto').innerHTML = HOW[mode];
    const main = $('b-main'), alt = $('b-alt');
    main.textContent = ph === 'hung' ? (st.ok ? (st.i + 1 < LEINE.length ? 'Weiter' : 'Von vorn') : 'Nochmal') : 'Loslassen';
    main.disabled = ph === 'drop' || (ph === 'build' && !ready());
    alt.hidden = !((ph === 'hung' && st.ok) || (ph === 'build' && mode === 'draw'));
    alt.textContent = ph === 'hung' ? 'Nochmal' : 'Leine löschen';
    alt.disabled = ph === 'build' && !st.pen.some(v => v != null);
    $('b-tip').disabled = st.tip || (ph === 'hung' && st.ok);
    $('verdict').innerHTML = verdictHtml();
  }

  // ---------- Eingabe ----------
  const pointerAt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const inBand = w => w[0] > -0.3 && w[0] < L() + 0.3 && w[1] > zOf(MLO) - 0.3 && w[1] < GROUND + 0.2;
  // verschiebbares Gewicht unter dem Zeiger: Griff an der Leine oder der Klotz darunter
  function weightAt(q) {
    let best = -1, bd = 26;
    st.loads.forEach((ld, j) => {
      if (!ld.drag) return;
      const h = toScreen([ld.s, ZM]), b = toScreen([ld.s, ZM + 0.25]);
      const d = Math.min(Math.hypot(q[0] - h[0], q[1] - h[1]), Math.hypot(q[0] - b[0], q[1] - b[1]));
      if (d < bd) { bd = d; best = j; }
    });
    return best;
  }
  // Leine bis zur Zeigerstelle nachziehen: zwischen der letzten und der neuen Stelle gerade
  function penTo(w) {
    const x = Math.max(0, Math.min(L(), w[0])), v = Math.max(MLO, Math.min(MHI, mOf(w[1]))), k1 = Math.round(x / L() * N);
    if (st.last) {
      const [k0, v0] = st.last;
      if (k0 !== k1) for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) st.pen[k] = v0 + (v - v0) * (k - k0) / (k1 - k0);
    }
    st.pen[k1] = v;
    st.last = [k1, v];
  }
  function input(w) {
    const mode = st.lv.mode;
    if (mode === 'place') {
      const x = Math.max(SNAP, Math.min(L() - SNAP, Math.round(w[0] / SNAP) * SNAP)), ld = st.loads[st.drag];
      if (ld.s !== x) { ld.s = x; recompute(); panel(); }
    } else if (mode === 'tap') { st.tap = Math.round(Math.max(0, Math.min(L(), w[0])) * 20) / 20; panel(); }
    else { const had = ready(); penTo(w); if (ready() !== had) panel(); }
    render();
  }
  cv.addEventListener('pointerdown', e => {
    if (st.phase !== 'build') return;
    const q = pointerAt(e), w = toWorld(q), mode = st.lv.mode;
    if (mode === 'place') { const j = weightAt(q); if (j < 0) return; st.drag = j; }
    else if (inBand(w)) st.drag = mode;
    else return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    st.touched = true; st.last = null;
    input(w);
  });
  cv.addEventListener('pointermove', e => {
    const q = pointerAt(e), w = toWorld(q);
    if (st.drag != null) { input(w); return; }
    const mode = st.lv.mode;
    cv.className = st.phase !== 'build' ? '' : mode === 'place' ? (weightAt(q) >= 0 ? 'grab' : '') : inBand(w) ? 'pen' : '';
  });
  const endDrag = () => { if (st.drag != null) { st.drag = null; st.last = null; panel(); } };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('b-main').addEventListener('click', () => {
    if (st.phase === 'build') release();
    else if (st.phase === 'hung') { if (st.ok) loadLevel((st.i + 1) % LEINE.length); else again(); }
  });
  $('b-alt').addEventListener('click', () => {
    if (st.phase === 'hung') again();
    else if (st.phase === 'build' && st.lv.mode === 'draw') { st.pen = new Array(N + 1).fill(null); panel(); render(); }
  });
  $('b-tip').addEventListener('click', () => { st.tip = true; panel(); });
  $('levels').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) loadLevel(+b.dataset.k); });
  addEventListener('resize', () => { layout(); render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { KIT.colors(C); render(); });

  KIT.colors(C);
  loadLevel(0);
  if (document.fonts) document.fonts.ready.then(render);
})();
