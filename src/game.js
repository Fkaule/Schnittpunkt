// Schnittpunkt, Station 1 „Festhalten“: Träger durchsägen, das abgeschnittene Stück mit N, Q und M halten, loslassen.
// Hält es, folgen die Vorzeichen nach TM1. Gezeichnet wird in Weltkoordinaten (m, x nach rechts, z nach unten), Kräfte in kN.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), wrap = $('wrap');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { BODY, FS, MS, HB, GAP, RSAW, num, signed, add, neg } = KIT;   // Maßstäbe und Helfer aus src/draw.js
  const STEP = 0.5, FMAX = 6, MMAX = 11;                 // Raster und Grenzen der Haltegrößen
  const RM = 0.42;                                       // Radius des Momentenbogens (m)
  const KA = 1.75, KR = 0.73, T_FALL = 1.3;              // Loslassen: m/s² je kN, rad/s² je kNm, Dauer in s
  const KEY = 'schnittpunkt-festhalten';
  const C = {};
  let G = null;
  const st = {
    i: 0, lv: null, sol: null, react: [], phase: 'ready', a: 0, b: 0, M: 0, pose: [0, 0, 0], frozen: [0, 0, 0],
    live: false, usedLive: false, tries: 0, touched: false, tip: false, quiz: [], got: null, msg: '',
    anim: null, saw: null, dust: [], drag: null, now: 0, stars: readStars()
  };
  // Ablauf: ready (Säge wartet), cutting, hold (Zeit steht still), release (Loslassen läuft), held (Vorzeichen), done

  function readStars() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(a)) return LEVELS.map((_, k) => Math.min(3, a[k] | 0));
    } catch (e) { /* ohne Speicher geht es auch */ }
    return LEVELS.map(() => 0);
  }
  function saveStars() { try { localStorage.setItem(KEY, JSON.stringify(st.stars)); } catch (e) { /* ohne Speicher */ } }
  const readColors = () => KIT.colors(C);

  // ---------- Zahlen und Richtungen ----------
  const zero = v => Math.abs(v) < 1e-6;
  const snap = (v, max) => Math.max(-max, Math.min(max, Math.round(v / STEP) * STEP)) + 0;
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const has = c => st.lv.dof.includes(c);
  // Richtung eines Vektors in Worten (z nach unten), etwa „nach rechts unten“
  function dirWord(v) {
    const n = Math.hypot(v[0], v[1]), h = Math.abs(v[0]) > 0.3 * n ? (v[0] > 0 ? 'rechts' : 'links') : '';
    const w = Math.abs(v[1]) > 0.3 * n ? (v[1] > 0 ? 'unten' : 'oben') : '';
    return 'nach ' + [h, w].filter(Boolean).join(' ');
  }
  const arrowSym = v => (Math.abs(v[0]) > 0.5 ? (v[0] > 0 ? '→' : '←') : (v[1] > 0 ? '↓' : '↑'));
  const turnWord = m => (m > 0 ? 'gegen den Uhrzeigersinn' : 'im Uhrzeigersinn');

  // ---------- Geometrie ----------
  const P = s => MECH.point(st.lv, s);
  const ex = () => st.sol.ax.ex, ez = () => st.sol.ax.ez;
  const force = () => add(add([0, 0], ex(), st.a), ez(), st.b);   // Haltekraft auf das Stück, global in kN
  function imbalance() {
    const F = force();
    return { R: [F[0] - st.sol.F[0], F[1] - st.sol.F[1]], dM: st.M - st.sol.M };
  }
  const balanced = () => { const { R, dM } = imbalance(); return zero(R[0]) && zero(R[1]) && zero(dM); };
  const onHeld = s => (st.lv.hold === 'plus' ? s > st.lv.cut : s < st.lv.cut);
  const heldRange = () => (st.lv.hold === 'plus' ? [st.lv.cut, st.sol.ax.L] : [0, st.lv.cut]);
  const otherRange = () => (st.lv.hold === 'plus' ? [0, st.lv.cut - GAP] : [st.lv.cut + GAP, st.sol.ax.L]);
  const gapDir = () => (st.lv.hold === 'plus' ? -1 : 1);   // vom Schnittufer zum Spalt, entlang ex
  const outward = () => [ex()[0] * st.sol.sign, ex()[1] * st.sol.sign];   // Normale n des gehaltenen Schnittufers
  // Lage des gehaltenen Stücks: verschoben um (x, z) und um den Schnittpunkt gedreht (r gegen den Uhrzeigersinn)
  function posed(p, pose = st.pose) {
    const c = st.sol.c, [tx, tz, r] = pose, dx = p[0] - c[0], dz = p[1] - c[1], co = Math.cos(r), si = Math.sin(r);
    return [c[0] + tx + dx * co + dz * si, c[1] + tz - dx * si + dz * co];
  }
  function unposed(p, pose = st.pose) {
    const c = st.sol.c, [tx, tz, r] = pose, dx = p[0] - c[0] - tx, dz = p[1] - c[1] - tz, co = Math.cos(r), si = Math.sin(r);
    return [c[0] + dx * co - dz * si, c[1] + dx * si + dz * co];
  }
  // Beschleunigung beim Loslassen aus Restkraft und Restmoment, gedeckelt, damit nichts davonfliegt
  function accel(R, dM) {
    const n = Math.hypot(R[0], R[1]), f = n ? KA * 3 * Math.tanh(n / 3) / n : 0;
    return [R[0] * f, R[1] * f, KR * 3 * Math.tanh(dM / 3)];
  }
  // Zeitlupe nach dem Schnitt: so weit kommt das Stück in 0,45 s ohne Halt, gedeckelt
  function startPose() {
    const acc = accel([-st.sol.F[0], -st.sol.F[1]], -st.sol.M), t2 = 0.5 * 0.45 * 0.45;
    const d = [acc[0] * t2, acc[1] * t2], n = Math.hypot(d[0], d[1]), k = n ? 0.25 * Math.tanh(n / 0.25) / n : 0;
    return [d[0] * k, d[1] * k, 0.16 * Math.tanh(acc[2] * t2 / 0.16)];
  }

  // ---------- Maßstab ----------
  function layout() { G = KIT.fit(cv, wrap, st.lv.view) || G; }
  const toScreen = p => [G.ox + (p[0] - G.x0) * G.s, (p[1] - G.z0) * G.s];
  const toWorld = q => [G.x0 + (q[0] - G.ox) / G.s, G.z0 + q[1] / G.s];
  // Zeichenwerkzeuge (src/draw.js), gebunden an Maßstab, Farben und den Stab des aktuellen Levels
  const K = KIT.make(ctx, { G: () => G, C, P, ex, ez, now: () => st.now });
  const { px, worldView, line, arrow, place, beside, arcSpots, knob, support, member, pointLoad, axesIcon, drawSaw } = K;
  // Momentenbogen schräg auf der Spaltseite beginnen (zwischen n und −z), dort liegen weder Längs- noch Querkraftpfeile
  const arcStart = () => { const n = outward(), q = ez(); return Math.atan2(n[1] - q[1], n[0] - q[0]); };
  const momArc = (c, m, r, col, w, dash) => K.momArc(c, m, r, col, w, dash, arcStart());
  // Streckenlasten rücken an der Schnittstelle ein, sobald geschnitten ist
  const loads = (s0, s1, withLabel, later) => K.loads(st.lv.loads, s0, s1, withLabel, later, st.phase === 'ready' || st.phase === 'cutting' ? null : st.lv.cut);
  const dims = () => K.dims(st.lv);
  const cutMark = () => K.cutMark(st.lv.cut);
  const rm = () => Math.max(RM, px(34));    // Radius des Momentenbogens, am Handy nicht zu klein
  function heldView() {
    const c = st.sol.c, [tx, tz, r] = st.pose;
    ctx.translate(c[0] + tx, c[1] + tz); ctx.rotate(-r); ctx.translate(-c[0], -c[1]);
  }

  // ---------- Zeichnen: Säge ----------
  const sawFrom = () => HB / 2 + RSAW + 0.12;   // Abstand des Blattmittelpunkts von der Achse vor und nach dem Schnitt
  const kerfMid = () => add(P(st.lv.cut), ex(), gapDir() * GAP / 2);
  const sawAt = u => add(kerfMid(), ez(), -sawFrom() + 2 * sawFrom() * u);   // u: 0 vor, 1 nach dem Schnitt
  const sawLead = u => -sawFrom() + 2 * sawFrom() * u + RSAW;                 // Vorderkante des Blatts quer zur Achse
  // Sägespalt während des Schnitts, von der Seite der Säge so tief, wie das Blatt schon ist
  function kerf(u) {
    const depth = Math.max(0, Math.min(HB, sawLead(u) + HB / 2));
    if (!depth) return;
    const q = ez(), a0 = add(P(st.lv.cut), q, -HB / 2), a1 = add(a0, ex(), gapDir() * GAP), b0 = add(a0, q, depth), b1 = add(a1, q, depth);
    ctx.save(); ctx.fillStyle = C.sheet; ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.2);
    ctx.beginPath(); ctx.moveTo(...a0); ctx.lineTo(...a1); ctx.lineTo(...b1); ctx.lineTo(...b0); ctx.closePath(); ctx.fill();
    line(a0, b0); line(a1, b1);
    ctx.restore();
  }
  function spawnDust(p) {
    if (reduce) return;
    for (let k = 0; k < 2; k++) {
      const sp = (0.6 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1);
      st.dust.push({ p: p.slice(), v: add(add([0, 0], ex(), sp), ez(), -0.6 - Math.random()), life: 0.5 + Math.random() * 0.3 });
    }
  }
  function drawDust() {
    const s = px(2.6);
    ctx.save(); ctx.fillStyle = C.steel2;
    for (const d of st.dust) { ctx.globalAlpha = Math.min(1, d.life * 2); ctx.fillRect(d.p[0] - s / 2, d.p[1] - s / 2, s, s); }
    ctx.restore();
  }

  // ---------- Zeichnen: Haltekräfte und Vorzeichen ----------
  // Die drei Funktionen zeichnen nur Pfeile und Griffe und geben ihre Beschriftungen zurück: [Text, Farbe, Plätze, Schrift].
  // render setzt sie zuletzt, die eigenen Werte zuerst, damit sie nichts überdeckt
  function holdArrows() {
    const c = st.sol.c, e = ex(), q = ez(), n = outward(), F = force(), act = st.phase === 'hold', pulse = act && !st.touched && !reduce;
    const tipN = add(c, e, st.a * FS), tipQ = add(c, q, st.b * FS), tipF = add(c, F, FS), out = [], bold = { weight: 600 };
    if (has('N') && has('Q') && st.a && st.b && st.phase !== 'done') {   // N und Q zusammen ergeben die Haltekraft
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1); ctx.setLineDash([px(3), px(3)]);
      line(tipN, tipF); line(tipQ, tipF); ctx.restore();
      arrow(c, tipF, C.ink2, 1.4, 9, true);
    }
    if (has('N') && st.a) {
      const mid = add(c, e, st.a * FS / 2), d = st.a > 0 ? e : neg(e);
      arrow(c, tipN, C.cN, 3.2, 13);
      out.push([`${num(Math.abs(st.a))} kN`, C.cN, [beside(mid, neg(q), 15), beside(mid, q, 15), beside(tipN, d, 20)], bold]);
    }
    if (has('Q') && st.b) {
      const mid = add(c, q, st.b * FS / 2), d = st.b > 0 ? q : neg(q);
      arrow(c, tipQ, C.cQ, 3.2, 13);
      // zuerst auf der Seite des Stücks, auf der Spaltseite beginnt der Momentenbogen
      out.push([`${num(Math.abs(st.b))} kN`, C.cQ, [beside(mid, neg(n), 10), beside(mid, n, 10), beside(tipQ, d, 24)], bold]);
    }
    let tipM = null;
    if (has('M')) {
      const r = rm();
      if (act && zero(st.M)) {   // Drehknopf ohne Moment: gestrichelter Kreis zeigt, wo man dreht
        ctx.save(); ctx.strokeStyle = C.cM; ctx.globalAlpha = 0.45; ctx.lineWidth = px(1.2); ctx.setLineDash([px(3), px(4)]);
        ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
      }
      const arc = momArc(c, st.M, r, C.cM, 3.2);
      tipM = arc.tip;
      if (st.M) out.push([`${num(Math.abs(st.M))} kNm`, C.cM, arcSpots(c, r, arc), bold]);
    }
    if (act) {
      if (has('N') || has('Q')) knob(tipF, has('N') && has('Q') ? C.ink : has('Q') ? C.cQ : C.cN, pulse && zero(st.a) && zero(st.b));
      if (tipM) knob(tipM, C.cM, pulse && zero(st.M));
    }
    return out;
  }
  // Nach dem Halten: Normale n des Schnittufers; nach der Auflösung die positiven Richtungen gestrichelt daneben
  function signMarks() {
    const out = [], bold = { weight: 600 };
    if (st.phase !== 'held' && st.phase !== 'done') return out;
    const s = st.sol, c = s.c, n = outward(), q = ez();
    if (has('Q') || has('M')) {
      const o = has('N') ? add(c, q, 0.14) : c, h = add(o, n, 0.42);
      arrow(o, h, C.ink, 1.8, 10);
      out.push(['n', C.ink, [beside(h, neg(q), 14), beside(h, q, 14), beside(h, n, 10)], { font: BODY, weight: 700, size: 15 }]);
    }
    if (st.phase !== 'done') return out;
    if (has('N') && !zero(s.N)) {   // unter der Achse und unter n
      const o = add(c, q, 0.27), h = add(o, n, Math.abs(s.N) * FS);
      arrow(o, h, C.cN, 1.6, 10, true);
      out.push(['+N', C.cN, [beside(h, q, 14), beside(h, n, 12), beside(h, neg(q), 14)], bold]);
    }
    if (has('Q') && !zero(s.Q)) {
      const o = add(c, n, 0.12), d = s.sign > 0 ? q : neg(q), h = add(o, d, Math.abs(s.Q) * FS);
      arrow(o, h, C.cQ, 1.6, 10, true);
      out.push(['+Q', C.cQ, [beside(h, n, 12), beside(h, d, 16), beside(h, neg(n), 12)], bold]);
    }
    if (has('M') && !zero(s.My)) {
      const r = rm() * 1.35;
      out.push(['+M', C.cM, arcSpots(c, r, momArc(c, s.sign * Math.abs(s.My), r, C.cM, 1.6, true)), bold]);
    }
    return out;
  }
  // Tipp bei Streckenlast: Resultierende auf dem gehaltenen Stück
  function tipRes() {
    const out = [];
    if (!st.tip || !st.lv.tipRes) return out;
    const [a, b] = heldRange();
    for (const r of MECH.loadsIn({ ...st.lv, loads: st.lv.loads.filter(l => l.q) }, a, b)) {
      const n = Math.hypot(r.f[0], r.f[1]), u = [r.f[0] / n, r.f[1] / n], h = add(r.p, u, -HB / 2), t = add(h, u, -n * FS);
      const mid = [(t[0] + h[0]) / 2, (t[1] + h[1]) / 2];
      arrow(t, h, C.ink2, 2, 11, true);
      out.push([`R = ${num(n)} kN`, C.ink2, [beside(mid, ex(), 8), beside(mid, neg(ex()), 8), beside(t, neg(u), 14)], { weight: 600 }]);
    }
    return out;
  }

  function render() {
    if (!G) return;
    K.reset();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    worldView();
    axesIcon(); dims();
    const lv = st.lv;
    if (st.phase === 'ready' || st.phase === 'cutting') {
      for (const sp of lv.supports) support(sp);
      member(0, st.sol.ax.L); loads(0, st.sol.ax.L);
      if (st.phase === 'ready') cutMark();
      if (st.saw != null) kerf(st.saw);
      drawSaw(sawAt(st.saw || 0), st.now / (st.saw == null ? 900 : 110));
    } else {
      const [h0, h1] = heldRange(), [r0, r1] = otherRange();
      ctx.save(); ctx.globalAlpha = 0.32;   // weggeschnittenes Stück und alle Lager nur angedeutet
      for (const sp of lv.supports) support(sp);
      member(r0, r1, true); loads(r0, r1, false);
      ctx.restore();
      // gehaltenes Stück: erst alle Pfeile, dann die Beschriftungen obenauf, die eigenen Werte zuerst
      const later = [];
      ctx.save(); heldView();
      member(h0, h1); loads(h0, h1, true, later);
      for (const R of st.react) if (onHeld(R.s)) pointLoad(R.s, R.f, C.react, R.name, false, false, true, later);
      const res = tipRes(), ghosts = signMarks(), own = holdArrows();
      for (const [str, col, spots, o] of [...own, ...later, ...res, ...ghosts]) place(str, col, spots, o);
      ctx.restore();
    }
    drawDust();
  }

  // ---------- Bewegung ----------
  let raf = 0, last = 0;
  const busy = () => !!st.anim || st.dust.length > 0 || (!reduce && st.phase === 'ready') ||
    (st.phase === 'hold' && (st.live || (!st.touched && !reduce)));
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(now, dt); render();
    if (busy()) raf = requestAnimationFrame(frame);
  }
  function animate(dur, fn, done) { st.anim = { t0: performance.now(), dur, fn, done }; kick(); }
  function step(now, dt) {
    st.now = now;
    const a = st.anim;
    if (a) {
      const t = Math.min(Math.max(0, now - a.t0) / 1000, a.dur);
      a.fn(t);
      if (t >= a.dur && st.anim === a) { st.anim = null; if (a.done) a.done(); }
    } else if (st.phase === 'hold' && st.live) {   // Live-Hilfe: das Stück hängt an einer weichen Feder und zeigt, wohin es will
      const { R, dM } = imbalance(), n = Math.hypot(R[0], R[1]), k = n ? 0.5 * Math.tanh(n / 3) / n : 0;
      const goal = [R[0] * k, R[1] * k, 0.5 * Math.tanh(dM / 4)], f = 1 - Math.exp(-dt * 8);
      st.pose = st.pose.map((v, j) => v + (goal[j] - v) * f);
    }
    for (const d of st.dust) { d.v[1] += 5 * dt; d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.life -= dt; }
    st.dust = st.dust.filter(d => d.life > 0);
  }

  // ---------- Ablauf ----------
  function cut() {
    if (st.phase !== 'ready') return;
    st.phase = 'cutting'; st.saw = 0; panel();
    animate(1.1, t => {
      st.saw = t / 1.1;
      const lead = sawLead(st.saw);
      if (Math.abs(lead) <= HB / 2) spawnDust(add(kerfMid(), ez(), lead));
    }, () => {
      st.saw = null; st.phase = 'hold';
      if (!st.live) {   // Zeitlupe: das Stück beginnt zu fallen, dann steht die Zeit still
        const goal = startPose();
        animate(0.45, t => { const k = (t / 0.45) ** 2; st.pose = goal.map(v => v * k); }, () => { st.frozen = st.pose.slice(); });
      }
      panel();
    });
  }
  function release() {
    if (st.phase !== 'hold') return;
    st.anim = null;
    if (st.live) st.usedLive = true;
    st.tries++; st.msg = '';
    const { R, dM } = imbalance(), p0 = st.pose.slice();
    st.phase = 'release';
    if (balanced()) {
      stamp(true);
      animate(0.9, t => { const k = Math.exp(-5 * t) * Math.cos(10 * t); st.pose = p0.map(v => v * k); }, () => {
        st.pose = [0, 0, 0]; st.phase = 'held'; st.quiz = buildQuiz(); panel();
      });
    } else {
      const acc = accel(R, dM);
      animate(T_FALL, t => { st.pose = p0.map((v, j) => v + 0.5 * acc[j] * t * t); }, () => {
        stamp(false); st.msg = motionText(R, dM); panel();
        animate(1.0, () => {}, () => { $('stamp').hidden = true; st.pose = st.frozen.slice(); st.phase = 'hold'; panel(); });
      });
    }
    panel();
  }
  function motionText(R, dM) {
    const parts = [];
    if (!zero(R[0]) || !zero(R[1])) parts.push('rutscht ' + dirWord(R));
    if (!zero(dM)) parts.push('dreht sich ' + turnWord(dM));
    return `Es fällt: Das Stück ${parts.join(' und ')}.`;
  }
  function stamp(ok) {
    const el = $('stamp');
    el.textContent = ok ? 'HÄLT' : 'FÄLLT';
    el.className = 'stamp ' + (ok ? 'ok' : 'bad') + (reduce ? '' : ' hit');
    el.hidden = false;
  }
  function buildQuiz() {
    const s = st.sol, q = [];
    if (has('Q') || has('M')) q.push({ id: 'face', text: 'Welches Schnittufer hat das gehaltene Stück? Die Normale n zeigt aus der Schnittfläche heraus.',
      opts: ['positiv', 'negativ'], right: s.sign > 0 ? 'positiv' : 'negativ' });
    if (has('N') && !zero(s.N)) q.push({ id: 'N', text: `N: Ihre Kraft längs ist ${s.N > 0 ? 'Zug' : 'Druck'}. Welches Vorzeichen hat N?`,
      opts: ['+', '−'], right: s.N > 0 ? '+' : '−' });
    if (has('Q') && !zero(s.Q)) q.push({ id: 'Q', text: `Q: Ihre Kraft quer zeigt ${dirWord(add([0, 0], ez(), st.b))}. Welches Vorzeichen hat Q?`,
      opts: ['+', '−'], right: s.Q > 0 ? '+' : '−' });
    if (has('M') && !zero(s.My)) q.push({ id: 'M', text: `M: Ihr Moment dreht ${turnWord(st.M)}. Welches Vorzeichen hat M?`,
      opts: ['+', '−'], right: s.My > 0 ? '+' : '−' });
    return q.map(x => ({ ...x, got: null }));
  }
  function finish() {
    st.phase = 'done';
    st.got = [true, st.tries === 1 && !st.usedLive, st.quiz.every(x => x.got === x.right)];
    const n = st.got.filter(Boolean).length;
    if (n > st.stars[st.i]) { st.stars[st.i] = n; saveStars(); }
    levelsNav(); panel(); render();
  }
  function loadLevel(i) {
    st.i = i; st.lv = LEVELS[i];
    st.sol = MECH.hold(st.lv, st.lv.cut, st.lv.hold); st.react = MECH.reactions(st.lv);
    Object.assign(st, { phase: 'ready', a: 0, b: 0, M: 0, pose: [0, 0, 0], frozen: [0, 0, 0], usedLive: st.live, tries: 0,
      touched: false, tip: false, quiz: [], got: null, msg: '', anim: null, saw: null, dust: [], drag: null });
    $('stamp').hidden = true;
    setRows(); levelsNav(); layout(); panel(); render(); kick();
  }

  // ---------- Oberfläche ----------
  function levelsNav() {
    $('levels').innerHTML = LEVELS.map((lv, k) => `<button type="button" data-k="${k}" aria-pressed="${k === st.i}" title="${lv.name}"
      aria-label="Level ${k + 1}: ${lv.name}, ${st.stars[k]} von 3 Sternen">${k + 1}<span class="st">${starStr(st.stars[k])}</span></button>`).join('');
  }
  // Pfeiltasten je Level: Richtung der Achsen, links die Gegenrichtung
  function setRows() {
    const dir = { N: ex(), Q: ez() };
    for (const c of ['N', 'Q', 'M']) $('row-' + c).hidden = !has(c);
    for (const c of ['N', 'Q']) for (const b of $('row-' + c).querySelectorAll('button')) {
      const v = +b.dataset.d > 0 ? dir[c] : [-dir[c][0], -dir[c][1]];
      b.textContent = arrowSym(v); b.title = dirWord(v);
    }
  }
  function quizHtml() {
    return '<ol class="quiz">' + st.quiz.map(q => {
      const btns = q.opts.map(v => {
        const cls = q.got == null ? '' : v === q.right ? 'right' : v === q.got ? 'wrong' : '';
        return `<button type="button" data-q="${q.id}" data-v="${v}" class="${cls}"${q.got == null ? '' : ' disabled'}>${v}</button>`;
      }).join('');
      const res = q.got == null ? '' : q.got === q.right ? '<span class="qr t-ok">richtig</span>' : '<span class="qr t-bad">leider nicht</span>';
      return `<li><span>${q.text}</span><span class="qb">${btns}${res}</span></li>`;
    }).join('') + '</ol>';
  }
  function verdictHtml() {
    const lv = st.lv, ph = st.phase, s = st.sol, tip = st.tip ? `<p class="tip">Tipp: ${lv.hint}</p>` : '';
    if (ph === 'ready' || ph === 'cutting')
      return `<p>${lv.task}</p><p>Klicken Sie auf <b>Sägen</b> oder auf die Säge. Danach steht die Zeit still, bis Sie loslassen.</p>${tip}`;
    if (ph === 'hold' || ph === 'release') {
      const how = {
        N: 'Ziehen Sie am Punkt an der Schnittstelle: Der Pfeil ist Ihre Haltekraft.',
        QM: 'Kraft: am Punkt an der Schnittstelle ziehen. Moment: am Kreis drehen. Die Pfeiltasten rechts gehen auch.',
        NQM: 'Die Kraft lässt sich jetzt in jede Richtung ziehen: Ihr Anteil längs ist N, quer Q. Moment: am Kreis drehen.'
      }[lv.dof];
      return (st.msg ? `<p class="t-bad">${st.msg}</p>` : '') + `<p>${how} Dann <b>Loslassen</b>.</p>${tip}`;
    }
    if (ph === 'held') return `<p class="t-ok">Hält!</p><p>Und die Vorzeichen nach TM1?</p>${quizHtml()}`;
    const vals = ['N', 'Q', 'M'].filter(has).map(c => (c === 'M' ? `M = ${signed(s.My)} kNm` : `${c} = ${signed(s[c])} kN`)).join('<br>');
    const rule = lv.dof === 'N' ? 'Zug ist positiv: Die positive Normalkraft zeigt am Schnittufer aus dem Stück heraus.'
      : 'Am positiven Schnittufer (n zeigt in +x) zeigen positive Schnittgrößen in Achsenrichtung, am negativen entgegen. Gestrichelt: die positiven Richtungen an diesem Schnittufer.';
    const names = ['Hält', 'Beim ersten Loslassen, ohne Live-Hilfe', 'Alle Vorzeichen richtig'];
    const stars = '<ul class="starlist">' + names.map((t, k) => `<li class="${st.got[k] ? 'on' : ''}">${t}</li>`).join('') + '</ul>';
    const end = st.i + 1 === LEVELS.length
      ? '<p><b>Station 1 geschafft.</b> Als Nächstes käme Station 2, die Säge-Spur: Der Schnitt wandert, und aus vielen Schnitten wird der Verlauf.</p>' : '';
    return `<p class="t-ok">Gelöst</p>${quizHtml()}<p class="vals">${vals}</p><p>${rule}</p><p>${lv.aha}</p>${stars}${end}`;
  }
  function panel() {
    const lv = st.lv, ph = st.phase, edit = ph === 'hold';
    $('tb-name').textContent = `${st.i + 1} von ${LEVELS.length}: ${lv.name}`;
    $('tb-task').textContent = lv.task;
    $('tb-tries').textContent = st.tries ? `${st.tries}-mal` : 'noch nicht';
    $('tb-stars').textContent = starStr(st.stars[st.i]);
    for (const b of $('forces').querySelectorAll('button')) b.disabled = !edit;
    $('v-N').textContent = zero(st.a) ? '0' : `${num(Math.abs(st.a))} kN ${st.sol.sign * st.a > 0 ? 'Zug' : 'Druck'}`;
    $('v-Q').textContent = zero(st.b) ? '0' : `${num(Math.abs(st.b))} kN ${dirWord(add([0, 0], ez(), st.b))}`;
    $('v-M').textContent = zero(st.M) ? '0' : `${num(Math.abs(st.M))} kNm ${st.M > 0 ? '↺' : '↻'}`;
    const main = $('b-main');
    main.textContent = { ready: 'Sägen', cutting: 'Sägen', hold: 'Loslassen', release: 'Loslassen', held: 'Weiter',
      done: st.i + 1 < LEVELS.length ? 'Weiter' : 'Von vorn' }[ph];
    main.disabled = ph === 'cutting' || ph === 'release' || ph === 'held';
    $('b-tip').disabled = st.tip || ph === 'held' || ph === 'done';
    $('b-zero').disabled = !edit;
    $('c-live').checked = st.live;
    const bd = $('badge');
    bd.hidden = !edit && ph !== 'release';
    bd.className = 'badge' + (st.live ? ' live' : '');
    bd.innerHTML = st.live ? '<i></i>Live-Hilfe' : '<i></i>Zeit angehalten';
    $('verdict').innerHTML = verdictHtml();
    cv.className = ph === 'ready' ? 'cut' : '';
  }

  // ---------- Eingabe ----------
  const pointerAt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // Griff unter dem Zeiger: Kraftpunkt, Momentenkreis oder sonst in der Nähe der Schnittstelle die Kraft
  function hit(q) {
    if (st.phase !== 'hold') return null;
    const c = st.sol.c, cs = toScreen(posed(c)), fs = toScreen(posed(add(c, force(), FS))), dc = Math.hypot(q[0] - cs[0], q[1] - cs[1]);
    const withF = has('N') || has('Q');
    if (withF && Math.hypot(q[0] - fs[0], q[1] - fs[1]) < 18) return 'F';
    if (has('M') && Math.abs(dc - rm() * G.s) < 14) return 'M';
    if (withF && dc < 2.2 * G.s) return 'F';
    return null;
  }
  const angAt = q => { const cs = toScreen(posed(st.sol.c)); return Math.atan2(q[1] - cs[1], q[0] - cs[0]); };
  function dragF(q) {
    const w = unposed(toWorld(q)), c = st.sol.c, v = [(w[0] - c[0]) / FS, (w[1] - c[1]) / FS];
    const a = has('N') ? snap(v[0] * ex()[0] + v[1] * ex()[1], FMAX) : 0, b = has('Q') ? snap(v[0] * ez()[0] + v[1] * ez()[1], FMAX) : 0;
    if (a !== st.a || b !== st.b) { st.a = a; st.b = b; changed(); }
  }
  function dragM(q) {
    const a = angAt(q);
    let d = a - st.drag.ang;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    st.drag.ang = a; st.drag.acc += d;
    const m = snap(st.drag.m0 - st.drag.acc / MS, MMAX);   // Bildschirmwinkel wachsen im Uhrzeigersinn, M_y dagegen
    if (m !== st.M) { st.M = m; changed(); }
  }
  function changed() { panel(); render(); if (st.live) kick(); }

  cv.addEventListener('pointerdown', e => {
    if (st.phase === 'ready') { cut(); return; }
    const q = pointerAt(e), k = hit(q);
    if (!k) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    st.drag = k === 'M' ? { kind: 'M', ang: angAt(q), m0: st.M, acc: 0 } : { kind: 'F' };
    st.touched = true; cv.className = 'grabbing';
    if (k === 'F') dragF(q);
    render();
  });
  cv.addEventListener('pointermove', e => {
    const q = pointerAt(e);
    if (st.drag) { if (st.drag.kind === 'F') dragF(q); else dragM(q); return; }
    if (st.phase === 'hold') cv.className = hit(q) ? 'grab' : '';
  });
  const endDrag = () => { if (st.drag) { st.drag = null; cv.className = ''; } };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  $('b-main').addEventListener('click', () => {
    if (st.phase === 'ready') cut();
    else if (st.phase === 'hold') release();
    else if (st.phase === 'done') loadLevel((st.i + 1) % LEVELS.length);
  });
  $('b-tip').addEventListener('click', () => { st.tip = true; panel(); render(); });
  $('b-zero').addEventListener('click', () => { if (st.phase !== 'hold') return; st.a = st.b = st.M = 0; changed(); });
  $('c-live').addEventListener('change', e => {
    st.live = e.target.checked;
    if (st.live && st.phase !== 'held' && st.phase !== 'done') st.usedLive = true;
    if (!st.live) st.frozen = st.pose.slice();
    panel(); kick();
  });
  $('forces').addEventListener('click', e => {
    const b = e.target.closest('button[data-c]');
    if (!b || st.phase !== 'hold') return;
    const d = +b.dataset.d * STEP;
    if (b.dataset.c === 'N') st.a = snap(st.a + d, FMAX);
    else if (b.dataset.c === 'Q') st.b = snap(st.b + d, FMAX);
    else st.M = snap(st.M + d, MMAX);
    st.touched = true; changed();
  });
  $('verdict').addEventListener('click', e => {
    const b = e.target.closest('button[data-q]');
    if (!b || st.phase !== 'held') return;
    const q = st.quiz.find(x => x.id === b.dataset.q);
    if (!q || q.got != null) return;
    q.got = b.dataset.v;
    if (st.quiz.every(x => x.got != null)) finish(); else panel();
  });
  $('levels').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) loadLevel(+b.dataset.k); });
  addEventListener('resize', () => { layout(); render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); render(); });

  readColors();
  loadLevel(0);
  if (document.fonts) document.fonts.ready.then(render);
})();
