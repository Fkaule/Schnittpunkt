// Schnittpunkt, Station 2 „Säge-Spur“: Die Säge wandert am Träger entlang, an jeder Stelle hält Q das linke Stück.
// Erst einzelne Halte (Q einstellen und prüfen), dann den ganzen Verlauf zeichnen und von der Säge aufdecken lassen.
// Diagramm wie in der Vorlesung: positive Werte nach unten. Weltkoordinaten in m, x nach rechts, z nach unten, Kräfte in kN.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { BODY, FS, HB, GAP, RSAW, num, signed } = KIT;
  const QS = 0.25;      // Diagramm: m je kN
  const ZQ = 2.55;      // Nulllinie des Diagramms unter dem Träger (m)
  const QMAX = 4.5;     // Grenze beim Einstellen und Zeichnen (kN)
  const N = 160;        // Stützstellen der gezeichneten Spur
  const TOL = 0.3;      // die Spur trifft, wenn sie höchstens so weit danebenliegt (kN)
  const STEP = 0.5;
  const KEY = 'schnittpunkt-spur';
  const C = {};
  let G = null;
  const st = {
    i: 0, lv: null, ax: null, react: [], tr: [], truth: [], phase: 'draw', k: 0, saw: -0.6, scan: null, shown: -1,
    guess: 0, guesses: [], pen: [], last: null, got: 0, score: 0, tip: false, touched: false, anim: null, drag: false, now: 0,
    stars: readStars()
  };
  // Halte: move (Säge fährt), guess (Q einstellen), scan (aufdecken), result; nach dem letzten Halt scan bis zum Ende, dann done.
  // Spur: draw (zeichnen), run (Säge fährt und deckt auf), done

  function readStars() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(a)) return SPUR.map((_, k) => Math.min(3, a[k] | 0));
    } catch (e) { /* ohne Speicher geht es auch */ }
    return SPUR.map(() => 0);
  }
  function saveStars() { try { localStorage.setItem(KEY, JSON.stringify(st.stars)); } catch (e) { /* ohne Speicher */ } }

  // ---------- Zahlen und Geometrie ----------
  const zero = v => Math.abs(v) < 1e-6;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const clampQ = v => Math.max(-QMAX, Math.min(QMAX, v));
  const snap = v => clampQ(Math.round(v / STEP) * STEP) + 0;
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
  const P = s => MECH.point(st.lv, s);
  const ex = () => st.ax.ex, ez = () => st.ax.ez;
  const L = () => st.ax.L;
  const zOf = q => ZQ + q * QS, qOf = z => (z - ZQ) / QS;   // Diagramm: Wert und Lage, positiv nach unten
  const Qat = x => MECH.hold(st.lv, x, 'minus').Q;          // Querkraft am linken Stück, Säge bei x
  const xOfK = k => k / N * L();
  const breaks = () => [...new Set(st.tr.map(p => p[0]))];  // Bereichsgrenzen: Kräfte, Lager, Enden
  const drawn = () => st.pen.filter(v => v != null).length >= 10;

  // ---------- Maßstab und Zeichenwerkzeuge ----------
  function layout() { G = KIT.fit(cv, wrap, st.lv.view) || G; }
  const toWorld = q => [G.x0 + (q[0] - G.ox) / G.s, G.z0 + q[1] / G.s];
  const K = KIT.make(ctx, { G: () => G, C, P, ex, ez, now: () => st.now });
  const { px, worldView, line, arrow, place, beside, knob, support, member, pointLoad, axesIcon, drawSaw } = K;

  // ---------- Zeichnen ----------
  // Wo der Träger geteilt ist: an der Säge, solange sie unterwegs ist; beim Zeichnen und am Ende ganz
  const splitAt = () => (st.phase === 'draw' || st.phase === 'done' ? null : st.saw);
  // Träger, links der Säge fest mit allen Kräften, rechts nur angedeutet. Die Lager wirken mit ihren Kräften (Pfeile)
  function beam(later) {
    const x = splitAt(), len = L();
    ctx.save(); ctx.globalAlpha = 0.35;
    for (const sp of st.lv.supports) support(sp);
    ctx.restore();
    const reacts = (s0, s1, lab) => {
      for (const R of st.react) if (R.s >= s0 - 1e-9 && R.s <= s1 + 1e-9) pointLoad(R.s, R.f, C.react, R.name, false, false, lab, later);
    };
    if (x == null || x >= len) { member(0, len); K.loads(st.lv.loads, 0, len, true, later); reacts(0, len, true); return; }
    if (x > 0) { member(0, x); K.loads(st.lv.loads, 0, x, true, later); reacts(0, x, true); }
    const r0 = x < 0 ? 0 : x + 1e-6;
    ctx.save(); ctx.globalAlpha = 0.32;
    member(x < 0 ? 0 : Math.min(len, x + GAP), len, true); K.loads(st.lv.loads, r0, len, false); reacts(r0, len, false);
    ctx.restore();
  }
  // Diagramm: Bereichsgrenzen wie auf der Folie, Raster, Achse mit Q, + unten und − oben
  function band() {
    const len = L(), bot = zOf(QMAX);
    ctx.save(); ctx.strokeStyle = C.ink2; ctx.globalAlpha = 0.55; ctx.lineWidth = px(1); ctx.setLineDash([px(4), px(4)]);
    for (const s of breaks()) line([s, HB / 2 + 0.06], [s, bot + 0.1]);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = C.rule; ctx.lineWidth = px(0.8);
    for (let v = -4; v <= 4; v++) if (v) line([0, zOf(v)], [len, zOf(v)]);
    ctx.restore();
    for (const v of [-4, -2, 2, 4]) K.label(signed(v), [len + 0.1, zOf(v)], C.ink2, { size: 11, align: 'left' });
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.6); line([0, ZQ], [len, ZQ]); ctx.restore();
    K.label('Q', [-0.45, ZQ], C.cQ, { font: BODY, weight: 700, size: 18 });
    K.label('+', [-0.45, zOf(1.7)], C.ink2, { font: BODY, weight: 700, size: 16 });
    K.label('−', [-0.45, zOf(-1.7)], C.ink2, { font: BODY, weight: 700, size: 16 });
  }
  // Linienzug bis xmax, das letzte Stück angeschnitten
  function clip(pts, xmax) {
    const out = [];
    for (const p of pts) {
      if (p[0] <= xmax + 1e-9) { out.push(p); continue; }
      const q = out[out.length - 1];
      if (q && p[0] > q[0]) out.push([xmax, q[1] + (p[1] - q[1]) * (xmax - q[0]) / (p[0] - q[0])]);
      break;
    }
    return out;
  }
  // richtiger Verlauf, so weit die Säge ihn aufgedeckt hat, mit den Werten der ganz aufgedeckten Abschnitte
  function trace(later) {
    if (st.shown < -0.5) return;
    const W = clip(st.tr, st.shown).map(p => [p[0], zOf(p[1])]);
    if (W.length < 2) return;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(W[0][0], ZQ); for (const w of W) ctx.lineTo(w[0], w[1]); ctx.lineTo(W[W.length - 1][0], ZQ); ctx.closePath();
    ctx.fillStyle = C.cQ; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(W[0][0], W[0][1]); for (const w of W) ctx.lineTo(w[0], w[1]);
    ctx.strokeStyle = C.cQ; ctx.lineWidth = px(2.6); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    for (let j = 0; j + 1 < st.tr.length; j++) {
      const a = st.tr[j], b = st.tr[j + 1];
      if (b[0] - a[0] < 1e-9 || b[0] > st.shown + 1e-9) continue;
      const ends = zero(a[1] - b[1]) ? [[(a[0] + b[0]) / 2, a[1]]] : [a, b];
      for (const [x, q] of ends) if (!zero(q)) {
        const p = [x, zOf(q)], d = q > 0 ? [0, 1] : [0, -1];
        later.push([`${signed(q)} kN`, C.cQ, [beside(p, d, 13), beside(p, [1, 0], 8), beside(p, [-1, 0], 8)], { weight: 600 }]);
      }
    }
  }
  // gezeichnete Spur: blau, so weit aufgedeckt grün, wo sie trifft, rot, wo sie danebenliegt
  function pen() {
    if (st.lv.mode !== 'draw') return;
    ctx.save(); ctx.lineWidth = px(2.4); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < N; k++) {
      const a = st.pen[k], b = st.pen[k + 1];
      if (a == null || b == null) continue;
      const j = st.truth[k] != null ? k : k + 1, hit = st.truth[j] == null ? null : Math.abs(st.pen[j] - st.truth[j]) <= TOL;
      ctx.strokeStyle = xOfK(k + 1) > st.shown || hit == null ? C.accent : hit ? C.ok : C.bad;
      line([xOfK(k), zOf(a)], [xOfK(k + 1), zOf(b)]);
    }
    ctx.restore();
  }
  // geprüfte Halte: grüner oder roter Punkt am eingestellten Wert
  function stopMarks() {
    for (const g of st.guesses) {
      ctx.save(); ctx.fillStyle = g.right ? C.ok : C.bad; ctx.strokeStyle = C.sheet; ctx.lineWidth = px(1.5);
      ctx.beginPath(); ctx.arc(g.x, zOf(g.q), px(5.5), 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  // Pfeil im Diagramm und am Schnittufer des linken Stücks: Q hält das linke Stück, positiv nach unten.
  // Blau ist der eigene Wert, grün der richtige
  function holdArrow(x, q, col, own, first) {
    const c = P(x);
    if (!zero(q)) arrow(c, [c[0], c[1] + q * FS], col, 3, 12);   // am Schnittufer, gleicher Maßstab wie die Lasten
    const h = [x, zOf(q)];
    if (!zero(q)) {
      arrow([x, ZQ], h, col, 3, 12);
      first.push([`${signed(q)} kN`, col, [beside(h, [1, 0], 12), beside(h, [-1, 0], 12), beside(h, [0, q > 0 ? 1 : -1], 16)], { weight: 600 }]);
    }
    if (own) knob(h, col, !st.touched && !reduce);
  }
  function arrows(first) {
    const ph = st.phase;
    if (st.scan != null) {   // Aufdecken: gestrichelte Schnittlinie, der richtige Pfeil wandert mit
      ctx.save(); ctx.strokeStyle = C.cut; ctx.lineWidth = px(1.6); ctx.setLineDash([px(5), px(4)]);
      line([st.scan, HB / 2 + 0.06], [st.scan, zOf(QMAX) + 0.1]); ctx.restore();
      if (st.scan > 0 && st.scan < L()) {
        const q = Qat(st.scan), h = [st.scan, zOf(q)];
        if (!zero(q)) arrow([st.scan, ZQ], h, C.cQ, 3, 12);
      }
    }
    if (ph === 'guess') holdArrow(st.saw, st.guess, C.accent, true, first);
    if (ph === 'scan' && st.lv.mode === 'stops' && st.guesses.length === st.k) holdArrow(st.saw, st.guess, C.accent, false, first);
    if (ph === 'result') { const g = st.guesses[st.guesses.length - 1]; holdArrow(g.x, g.truth, C.cQ, false, first); }
    if (ph === 'run' && st.saw > 0 && st.saw < L()) { const c = P(st.saw), q = Qat(st.saw); if (!zero(q)) arrow(c, [c[0], c[1] + q * FS], C.cQ, 3, 12); }
  }
  function render() {
    if (!G) return;
    K.reset();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    worldView();
    axesIcon(); K.dims(st.lv); band();
    const first = [], later = [];   // Beschriftungen zuletzt, die Werte im Diagramm zuerst
    beam(later); trace(later); pen(); stopMarks();
    // Säge über dem Schnitt, im Stand blass, damit ein Pfeil nach oben sichtbar bleibt
    const sx = st.phase === 'draw' ? -0.55 : st.saw;
    ctx.save(); ctx.globalAlpha = st.phase === 'guess' || st.phase === 'result' ? 0.25 : 1;
    drawSaw([sx, -(HB / 2 + RSAW - 0.05)], sx / RSAW);
    ctx.restore();
    arrows(first);
    for (const [str, col, spots, o] of [...first, ...later]) place(str, col, spots, o);
  }

  // ---------- Bewegung ----------
  let raf = 0;
  const busy = () => !!st.anim || (st.phase === 'guess' && !st.touched && !reduce);
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    st.now = now;
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
  function moveTo(x) {
    const x0 = st.saw;
    st.phase = 'move'; panel();
    animate(Math.max(0.5, Math.abs(x - x0) / 2.2), t => { st.saw = x0 + (x - x0) * ease(t / st.anim.dur); }, () => {
      st.saw = x; st.phase = 'guess'; panel(); render();
    });
  }
  // aufdecken bis x, die Säge fährt mit, wenn moveSaw
  function scanTo(x, moveSaw, done) {
    const x0 = Math.max(st.shown, -0.3), s0 = st.saw;
    st.phase = 'scan'; panel();
    animate(Math.max(0.6, (x - x0) / 1.6), t => {
      const f = t / st.anim.dur;
      st.scan = x0 + (x - x0) * f; st.shown = st.scan;
      if (moveSaw) st.saw = s0 + (x - s0) * f;
    }, () => { st.scan = null; st.shown = x; done(); });
  }
  function check() {
    if (st.phase !== 'guess') return;
    const x = st.lv.stops[st.k];
    scanTo(x, false, () => {
      const truth = Qat(x);
      st.guesses.push({ x, q: st.guess, truth, right: Math.abs(st.guess - truth) < 1e-6 });
      st.phase = 'result'; panel(); render();
    });
  }
  function next() {
    if (st.k + 1 < st.lv.stops.length) {
      st.k++; st.guess = st.guesses[st.guesses.length - 1].truth;   // der Pfeil startet beim letzten richtigen Wert
      moveTo(st.lv.stops[st.k]);
      return;
    }
    scanTo(L() + 0.4, true, () => {
      const n = st.guesses.filter(g => g.right).length, all = st.guesses.length;
      st.score = n / all;
      finish(n === all ? 3 : n === all - 1 ? 2 : 1, `${n} / ${all}`);
    });
  }
  function run() {
    if (st.phase !== 'draw' || !drawn()) return;
    const x0 = -0.4, x1 = L() + 0.4;
    st.phase = 'run'; st.saw = x0; st.shown = -1; panel();
    animate((x1 - x0) / 1.4, t => { st.saw = x0 + (x1 - x0) * t / st.anim.dur; st.scan = st.saw; st.shown = st.saw; }, () => {
      st.scan = null; st.shown = x1;
      const ks = st.truth.map((v, k) => k).filter(k => st.truth[k] != null);
      st.score = ks.filter(k => st.pen[k] != null && Math.abs(st.pen[k] - st.truth[k]) <= TOL).length / ks.length;
      const p = Math.round(st.score * 100);
      finish(st.score >= 0.95 ? 3 : st.score >= 0.85 ? 2 : st.score >= 0.7 ? 1 : 0, `${p} %`);
    });
  }
  function finish(stars, text) {
    st.phase = 'done'; st.got = stars;
    if (stars > st.stars[st.i]) { st.stars[st.i] = stars; saveStars(); }
    const el = $('stamp');
    el.textContent = text;
    el.className = 'stamp ' + (stars ? 'ok' : 'bad') + (reduce ? '' : ' hit');
    el.hidden = false;
    levelsNav(); panel(); render();
  }
  function loadLevel(i) {
    st.i = i; st.lv = SPUR[i]; st.ax = MECH.axes(st.lv.member); st.react = MECH.reactions(st.lv); st.tr = MECH.traceQ(st.lv);
    const brk = breaks();   // an den Sprüngen wird nicht gewertet
    st.truth = Array.from({ length: N + 1 }, (_, k) => (brk.some(b => Math.abs(b - xOfK(k)) < 0.06) ? null : Qat(xOfK(k))));
    Object.assign(st, { k: 0, saw: -0.6, scan: null, shown: -1, guess: 0, guesses: [], pen: new Array(N + 1).fill(null), last: null,
      got: 0, score: 0, tip: false, touched: false, anim: null, drag: false, phase: st.lv.mode === 'stops' ? 'move' : 'draw' });
    $('stamp').hidden = true;
    levelsNav(); layout(); panel(); render();
    if (st.lv.mode === 'stops') moveTo(st.lv.stops[0]);
  }

  // ---------- Oberfläche ----------
  function levelsNav() {
    $('levels').innerHTML = SPUR.map((lv, k) => `<button type="button" data-k="${k}" aria-pressed="${k === st.i}" title="${lv.name}"
      aria-label="Level ${k + 1}: ${lv.name}, ${st.stars[k]} von 3 Sternen">${k + 1}<span class="st">${starStr(st.stars[k])}</span></button>`).join('');
  }
  // Was links der Säge wirkt, nach Lage geordnet, und was daraus für Q folgt
  function sumText(x) {
    const parts = [];
    for (const R of st.react) if (R.s <= x && !zero(R.f[1])) parts.push([R.s, `${R.name} ${num(Math.abs(R.f[1]))} kN ${R.f[1] < 0 ? 'nach oben' : 'nach unten'}`]);
    for (const ld of st.lv.loads) {
      if (ld.q) { const l = Math.min(x, ld.s1) - ld.s0; if (l > 1e-9) parts.push([ld.s0, `Streckenlast ${num(ld.q[1] * l)} kN nach unten`]); }
      else if (ld.s <= x) parts.push([ld.s, `${ld.name || 'F'} ${num(Math.abs(ld.f[1]))} kN ${ld.f[1] > 0 ? 'nach unten' : 'nach oben'}`]);
    }
    parts.sort((a, b) => a[0] - b[0]);
    const q = Qat(x), hold = zero(q) ? 'Das gleicht sich aus: Q = 0.' : `Sie halten mit ${num(Math.abs(q))} kN ${q > 0 ? 'nach unten' : 'nach oben'}, also Q = ${signed(q)} kN.`;
    return `Links der Säge: ${parts.map(p => p[1]).join(', ')}. ${hold}`;
  }
  function verdictHtml() {
    const lv = st.lv, ph = st.phase, tip = st.tip ? `<p class="tip">Tipp: ${lv.hint}</p>` : '';
    if (ph === 'move') return `<p>Die Säge fährt ${st.k ? 'zum nächsten Halt' : 'zum ersten Halt'}.</p>${tip}`;
    if (ph === 'guess') return `<p><b>Halt ${st.k + 1} von ${lv.stops.length}.</b> ${lv.task}</p>${tip}`;
    if (ph === 'scan') return '<p>Die Säge deckt den Verlauf auf.</p>';
    if (ph === 'result') {
      const g = st.guesses[st.guesses.length - 1];
      return (g.right ? `<p class="t-ok">Richtig: Q = ${signed(g.truth)} kN.</p>` : `<p class="t-bad">Hier ist Q = ${signed(g.truth)} kN, Sie hatten ${signed(g.q)} kN.</p>`)
        + `<p>${sumText(g.x)}</p>`;
    }
    if (ph === 'draw') return `<p>${lv.task}</p>${tip}`;
    if (ph === 'run') return '<p>Die Säge deckt auf: grün trifft, rot liegt daneben.</p>';
    const head = lv.mode === 'stops' ? `${st.guesses.filter(g => g.right).length} von ${st.guesses.length} Halten richtig.` : `Treffer: ${Math.round(st.score * 100)} %.`;
    const rule = lv.mode === 'stops' ? 'Sterne: alle Halte richtig drei, einer daneben zwei, sonst einer.' : 'Sterne ab 70, 85 und 95 % Treffer. Gewertet wird die ganze Länge außer direkt an den Sprüngen.';
    const end = st.i + 1 === SPUR.length ? '<p><b>Station 2 geschafft.</b> Als Nächstes käme Station 3, die Wäscheleine: Dort geht es um die Form des Momentenverlaufs.</p>' : '';
    return `<p class="${st.got ? 't-ok' : 't-bad'}">${head}</p><p>${lv.aha}</p><p class="tip">${rule}</p>${end}`;
  }
  const HOW_STOPS = 'Die Säge hält an. <b>Ziehen</b> Sie den blauen Pfeil im Diagramm auf den Wert von Q: die Kraft, mit der Sie das linke Stück an der Säge halten, positiv nach unten. Dann <b>Prüfen</b>.';
  const HOW_DRAW = '<b>Zeichnen</b> Sie mit gedrückter Maus oder dem Finger den Verlauf von Q ins Diagramm, von links nach rechts, positiv nach unten. Dann <b>Säge los</b>.';
  function panel() {
    const lv = st.lv, ph = st.phase, stops = lv.mode === 'stops';
    $('tb-name').textContent = `${st.i + 1} von ${SPUR.length}: ${lv.name}`;
    $('tb-task').textContent = lv.task;
    $('tb-hits').textContent = stops ? (st.guesses.length ? `${st.guesses.filter(g => g.right).length} von ${st.guesses.length}` : 'noch keiner')
      : ph === 'done' ? `${Math.round(st.score * 100)} %` : 'noch offen';
    $('tb-stars').textContent = starStr(st.stars[st.i]);
    $('howto').innerHTML = stops ? HOW_STOPS : HOW_DRAW;
    $('qbox').hidden = !stops;
    for (const b of $('qbox').querySelectorAll('button')) b.disabled = ph !== 'guess';
    $('v-Q').textContent = `${signed(st.guess)} kN`;
    const main = $('b-main');
    main.textContent = { move: 'Prüfen', guess: 'Prüfen', scan: 'Prüfen', draw: 'Säge los', run: 'Säge los',
      result: st.k + 1 < (lv.stops || []).length ? 'Nächster Halt' : 'Zu Ende fahren', done: st.i + 1 < SPUR.length ? 'Weiter' : 'Von vorn' }[ph];
    main.disabled = ph === 'move' || ph === 'scan' || ph === 'run' || (ph === 'draw' && !drawn());
    const alt = $('b-alt');
    alt.hidden = !(ph === 'draw' || ph === 'done');
    alt.textContent = ph === 'done' ? 'Nochmal' : 'Spur löschen';
    alt.disabled = ph === 'draw' && !st.pen.some(v => v != null);
    $('b-tip').disabled = st.tip || ph === 'done';
    $('verdict').innerHTML = verdictHtml();
  }

  // ---------- Eingabe ----------
  const pointerAt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const inBand = w => w[0] > -0.6 && w[0] < L() + 0.6 && w[1] > zOf(-QMAX) - 0.35 && w[1] < zOf(QMAX) + 0.35;
  // Spur bis zur Zeigerstelle nachziehen: zwischen der letzten und der neuen Stelle gerade, senkrecht an derselben Stelle
  function penTo(w) {
    const x = Math.max(0, Math.min(L(), w[0])), v = clampQ(qOf(w[1])), k1 = Math.round(x / L() * N);
    if (st.last) {
      const [k0, v0] = st.last;
      if (k0 !== k1) for (let k = Math.min(k0, k1); k <= Math.max(k0, k1); k++) st.pen[k] = v0 + (v - v0) * (k - k0) / (k1 - k0);
    }
    st.pen[k1] = v;
    st.last = [k1, v];
  }
  function input(w) {
    if (st.phase === 'guess') { const v = snap(qOf(w[1])); if (v !== st.guess) { st.guess = v; panel(); } }
    else if (st.phase === 'draw') { const had = drawn(); penTo(w); if (drawn() !== had || !had) panel(); }
    render();
  }
  cv.addEventListener('pointerdown', e => {
    const w = toWorld(pointerAt(e));
    if (!inBand(w) || (st.phase !== 'guess' && st.phase !== 'draw')) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    st.drag = true; st.touched = true; st.last = null;
    input(w);
  });
  cv.addEventListener('pointermove', e => {
    const w = toWorld(pointerAt(e));
    if (st.drag) { input(w); return; }
    cv.className = inBand(w) && st.phase === 'guess' ? 'grab' : inBand(w) && st.phase === 'draw' ? 'pen' : '';
  });
  const endDrag = () => { if (st.drag) { st.drag = false; st.last = null; panel(); } };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('b-main').addEventListener('click', () => {
    if (st.phase === 'guess') check();
    else if (st.phase === 'result') next();
    else if (st.phase === 'draw') run();
    else if (st.phase === 'done') loadLevel((st.i + 1) % SPUR.length);
  });
  $('b-alt').addEventListener('click', () => {
    if (st.phase === 'draw') { st.pen = new Array(N + 1).fill(null); panel(); render(); }
    else if (st.phase === 'done') loadLevel(st.i);
  });
  $('b-tip').addEventListener('click', () => { st.tip = true; panel(); });
  $('qbox').addEventListener('click', e => {
    const b = e.target.closest('button[data-d]');
    if (!b || st.phase !== 'guess') return;
    st.guess = snap(st.guess + +b.dataset.d * STEP); st.touched = true;
    panel(); render();
  });
  $('levels').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) loadLevel(+b.dataset.k); });
  addEventListener('resize', () => { layout(); render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { KIT.colors(C); render(); });

  KIT.colors(C);
  loadLevel(0);
  if (document.fonts) document.fonts.ready.then(render);
})();
