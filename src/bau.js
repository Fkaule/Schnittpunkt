// Baukasten von Schnittpunkt: eigene Träger als Code im Link, Prüfung und Level für Station 2 (Q zeichnen) und Station 3
// (M als Wäscheleine). Träger 4 m, Raster 0,5 m. Lager: Festlager und Loslager oder eine Einspannung an einem Ende.
// Lasten nach unten: Einzellast { s, F } in kN, Streckenlast { s0, s1, q } in kN/m. Code: f0~l4~F2:4~q0-4:1, dazu z87 als
// Ziel beim Herausfordern (Treffer in %). Läuft im Browser (global BAU, braucht MECH) und in Node (module.exports).
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const MECH = node ? require('./mech.js') : root.MECH;
  const LEN = 4, STEP = 0.5, FMAX = 4.5, QMAX = 2, NMAX = 5;
  const QLIM = 4.5;             // Station 2: Diagramm bis ±4,5 kN, so lang dürfen auch die Pfeile der Lagerkräfte werden
  const MLO = -2.4, MHI = 3.6;  // Station 3: Platz für die Leine über und unter den Pfostenköpfen (kNm)
  const KIND = { f: 'fest', l: 'los', e: 'einspannung' };
  const num = v => (v < -1e-9 ? '−' : '') + (Math.round(Math.abs(v) * 1000) / 1000).toLocaleString('de-DE');   // wie KIT.num
  const signed = v => (v > 1e-9 ? '+' : '') + num(v);
  const list = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} und ${a[a.length - 1]}`);
  const onStep = v => Math.abs(v / STEP - Math.round(v / STEP)) < 1e-9;
  const isLine = ld => 's0' in ld;
  const inner = s => s > 1e-9 && s < LEN - 1e-9;
  const str = v => String(+v.toFixed(3));
  // Teile nach Lage, damit derselbe Träger immer denselben Code bekommt
  const bySupport = (a, b) => a.s - b.s || a.kind.localeCompare(b.kind);
  const byLoad = (a, b) => (isLine(a) ? a.s0 : a.s) - (isLine(b) ? b.s0 : b.s) || isLine(a) - isLine(b)
    || (isLine(a) ? a.s1 - b.s1 || a.q - b.q : a.F - b.F);

  function code(d) {
    const t = d.supports.slice().sort(bySupport).map(sp => sp.kind[0] + str(sp.s));
    for (const ld of d.loads.slice().sort(byLoad)) t.push(isLine(ld) ? `q${str(ld.s0)}-${str(ld.s1)}:${str(ld.q)}` : `F${str(ld.s)}:${str(ld.F)}`);
    return t.join('~');
  }

  const N = '(\\d+(?:\\.\\d+)?)';
  const RX = { sup: new RegExp(`^([fle])${N}$`), F: new RegExp(`^F${N}:${N}$`), q: new RegExp(`^q${N}-${N}:${N}$`), z: /^z(\d{1,3})$/ };
  // Träger und Ziel aus dem Code; null, wenn etwas nicht stimmt (Raster, Bereich, Lager doppelt, unbekannt)
  function parse(c) {
    const d = { supports: [], loads: [] };
    let ziel = null, m;
    for (const t of String(c).split('~')) {
      if ((m = RX.sup.exec(t))) d.supports.push({ kind: KIND[m[1]], s: +m[2] });
      else if ((m = RX.F.exec(t))) d.loads.push({ s: +m[1], F: +m[2] });
      else if ((m = RX.q.exec(t))) d.loads.push({ s0: +m[1], s1: +m[2], q: +m[3] });
      else if ((m = RX.z.exec(t)) && +m[1] <= 100) ziel = +m[1];
      else return null;
    }
    const pos = s => s >= 0 && s <= LEN && onStep(s), size = (v, max) => v >= STEP && v <= max && onStep(v);
    const kinds = d.supports.map(sp => sp.kind);
    if (d.supports.some(sp => !pos(sp.s)) || new Set(kinds).size < kinds.length) return null;
    if (kinds.includes('einspannung') && (kinds.length > 1 || inner(d.supports[0].s))) return null;
    if (d.loads.length > NMAX) return null;
    for (const ld of d.loads) {
      if (isLine(ld) ? !pos(ld.s0) || !pos(ld.s1) || ld.s1 <= ld.s0 || !size(ld.q, QMAX) : !pos(ld.s) || !size(ld.F, FMAX)) return null;
    }
    return { d, ziel };
  }
  function fromHash(h) {
    const m = /^#bau-(.+)$/.exec(h || '');
    if (!m) return null;
    try { return parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  // Level-Daten wie in den Stationen: Lager A und B von links (eine Einspannung heißt nach ihrer Seite A oder B), Einzellasten
  // F oder F1, F2 … von links, Bemaßung an allen Kennstellen; i ist die Stelle des Teils im Träger d
  function level(d) {
    const supports = d.supports.map((sp, i) => ({ kind: sp.kind, s: sp.s, i })).sort(bySupport);
    supports.forEach((sp, k) => { sp.name = sp.kind === 'einspannung' ? (sp.s ? 'B' : 'A') : 'AB'[k]; });
    const loads = d.loads.map((ld, i) => ({ ...ld, i })).sort(byLoad)
      .map(ld => (isLine(ld) ? { q: [0, ld.q], s0: ld.s0, s1: ld.s1, i: ld.i } : { s: ld.s, f: [0, ld.F], i: ld.i }));
    const pts = loads.filter(ld => !ld.q);
    pts.forEach((ld, k) => { ld.name = pts.length > 1 ? `F${k + 1}` : 'F'; });
    const xs = new Set([0, LEN]);
    for (const sp of supports) xs.add(sp.s);
    for (const ld of loads) { if (ld.q) { xs.add(ld.s0); xs.add(ld.s1); } else xs.add(ld.s); }
    return { member: { p0: [0, 0], p1: [LEN, 0] }, supports, loads, dims: [...xs].sort((a, b) => a - b) };
  }

  // Was dem Träger fehlt (bau) und was Station 2 (q) oder Station 3 (m) daran hindert; leere Listen heißen: geht
  function problems(d) {
    const out = { bau: [], q: [], m: [] }, of = k => d.supports.filter(sp => sp.kind === k);
    const fest = of('fest'), los = of('los'), ein = of('einspannung');
    if (!d.supports.length) out.bau.push('Es fehlt ein Lager: Festlager und Loslager oder eine Einspannung.');
    else if (!ein.length && !los.length) out.bau.push('Es fehlt das Loslager: Auf dem Festlager allein dreht sich der Träger.');
    else if (!ein.length && !fest.length) out.bau.push('Es fehlt das Festlager: Auf dem Loslager allein kippt der Träger und rutscht weg.');
    else if (!ein.length && fest[0].s === los[0].s) out.bau.push('Festlager und Loslager stehen an derselben Stelle: Der Träger dreht sich um diesen Punkt.');
    if (!d.loads.length) out.bau.push('Es fehlt eine Last.');
    if (out.bau.length) return out;
    const lv = level(d), less = ' Lasten verkleinern oder näher an die Lager setzen.';
    const big = MECH.reactions(lv).filter(r => Math.abs(r.f[1]) > QLIM + 1e-9).map(r => `${r.name} = ${num(Math.abs(r.f[1]))} kN`);
    const qmax = Math.max(...MECH.traceQ(lv).map(p => Math.abs(p[1])));
    if (qmax > QLIM + 1e-9) out.q.push(`Q wird bis ${num(qmax)} kN groß, das Diagramm reicht bis ${num(QLIM)} kN.${less}`);
    if (big.length) {
      const t = `Lagerkraft ${list(big)}: Mehr als ${num(QLIM)} kN passen nicht ins Bild.${less}`;
      if (!out.q.length) out.q.push(t);
      out.m.push(t);
    }
    if (ein.length) out.m.push('Am eingespannten Ende ist M nicht null, die Leine hängt dort aber am Pfosten.');
    else if (!out.m.length) {
      const ms = MECH.traceM(lv).map(p => p[1]), lo = Math.min(...ms), hi = Math.max(...ms);
      if (hi > MHI + 1e-9 || lo < MLO - 1e-9) out.m.push(`M reicht von ${num(lo)} bis ${num(hi)} kNm, für die Leine ist Platz von ${num(MLO)} bis ${num(MHI)} kNm.${less}`);
    }
    return out;
  }

  const forces = R => R.map(r => (Math.abs(r.f[1]) < 1e-9 ? `${r.name} = 0`
    : `${r.name} = ${num(Math.abs(r.f[1]))} kN ${r.f[1] < 0 ? 'nach oben' : 'nach unten'}`));
  const goal = z => (z == null ? '' : ` Zu schlagen: ${z} % Treffer.`);
  // Querkraftverlauf in Worten: Sprünge, schräge Abschnitte, Vorzeichenwechsel
  function qStory(tr) {
    const jumps = [], ramps = [], zeros = [];
    for (let j = 0; j + 1 < tr.length; j++) {
      const [x0, a] = tr[j], [x1, b] = tr[j + 1];
      if (Math.abs(b - a) < 1e-9) continue;
      if (x1 - x0 < 1e-9) jumps.push(`bei ${num(x0)} m auf ${signed(b)} kN`);
      else ramps.push(`von ${num(x0)} bis ${num(x1)} m von ${signed(a)} auf ${signed(b)} kN`);
      if (a * b < 0) zeros.push(x1 - x0 < 1e-9 ? x0 : x0 + (x1 - x0) * a / (a - b));
    }
    if (!jumps.length && !ramps.length) return 'Q bleibt überall null: Alle Lasten stehen direkt auf den Lagern.';
    return (jumps.length ? `Q springt ${list(jumps)}.` : '')
      + (ramps.length ? ` Unter der Streckenlast ändert es sich gleichmäßig, ${list(ramps)}.` : ' Dazwischen bleibt Q konstant.')
      + (zeros.length ? ` Wo Q das Vorzeichen wechselt (bei ${list(zeros.map(x => `${num(x)} m`))}), ist das Moment am größten oder am kleinsten.` : '');
  }

  // Level für Station 2 aus dem Link (#bau-…), mit Zeichnung und Maßstab wie das Level base; null ohne passenden Träger
  function spur(h, base) {
    const r = fromHash(h), p = r && problems(r.d);
    if (!r || p.bau.length || p.q.length) return null;
    const lv = { ...base, ...level(r.d) }, R = MECH.reactions(lv), hasQ = lv.loads.some(ld => ld.q);
    return {
      ...lv, name: 'Eigener Träger', mode: 'draw', bau: code(r.d), ziel: r.ziel,
      task: 'Zeichnen Sie den Verlauf von Q für diesen Träger von links nach rechts ins Diagramm. Dann fährt die Säge und deckt auf.' + goal(r.ziel),
      hint: `Zuerst die Lagerkräfte: ${list(forces(R))}. Dann von links nach rechts: Jede Kraft, an der die Säge vorbeikommt, lässt Q um ihren Betrag springen${hasQ ? ', unter der Streckenlast ändert sich Q je Meter um q' : ''}.`,
      aha: qStory(MECH.traceQ(lv))
    };
  }
  // Level für Station 3 aus dem Link, wie spur; ohne Einspannung, die Leine hängt zwischen Pfosten an den Trägerenden
  function leine(h, base) {
    const r = fromHash(h), p = r && problems(r.d);
    if (!r || p.bau.length || p.m.length) return null;
    const lv = { ...base, ...level(r.d) }, R = MECH.reactions(lv);
    const mid = lv.supports.some(sp => inner(sp.s)), free = [0, LEN].some(x => !lv.supports.some(sp => sp.s === x));
    const knicks = [];
    if (lv.loads.some(ld => !ld.q && inner(ld.s))) knicks.push('unter jedem Gewicht');
    if (mid) knicks.push('an jedem Lager zwischen den Pfosten');
    const shape = (knicks.length ? `Die Leine knickt ${list(knicks)}` : 'Die Leine knickt nirgends')
      + (lv.loads.some(ld => ld.q) ? ', unter Schnee biegt sie sich zur Parabel.' : knicks.length ? ' und ist dazwischen gerade.' : '.');
    const pk = MECH.peakM(lv), lo = MECH.traceM(lv).reduce((a, q) => (q[1] < a[1] ? q : a), [0, 0]), aha = [];
    if (pk.M > 1e-9) aha.push(`Am tiefsten hängt die Leine bei ${num(pk.x)} m: M = ${num(pk.M)} kNm.`);
    if (lo[1] < -1e-9) aha.push(`Bei ${num(lo[0])} m ist M = ${num(lo[1])} kNm: Dort hat der Träger oben Zug, die Leine steigt über die Pfosten.`);
    if (!aha.length) aha.push('Die Leine bleibt gerade: Alle Lasten stehen direkt auf den Lagern, M ist überall null.');
    return {
      ...lv, name: 'Eigener Träger', mode: 'draw', bau: code(r.d), ziel: r.ziel,
      task: 'Zeichnen Sie die Leine, wie sie unter diesem Träger hängen wird, von Pfosten zu Pfosten. Dann loslassen.'
        + (mid ? ' Ein Lager zwischen den Pfosten hält die Leine: als Haken nach oben oder als Abspannung nach unten.' : '')
        + (free ? ' An einem freien Ende ist M = 0, dort steht ein Pfosten.' : '') + goal(r.ziel),
      hint: `Zuerst die Lagerkräfte: ${list(forces(R))}. ${shape} Am tiefsten hängt sie dort, wo Q das Vorzeichen wechselt.`,
      aha: aha.join(' ')
    };
  }

  // Herausfordern nach dem Aufdecken (nur im Browser): Ergebnis gegen das Ziel aus dem Link, Knopf für den Link mit dem eigenen
  // Treffer p (in %) als Ziel; msg ist die Rückmeldung nach dem Kopieren
  function challengeHtml(lv, p, msg) {
    const z = lv.ziel, res = p > z ? 'Gewonnen' : p === z ? 'Gleichstand' : 'Verloren';
    return (z == null ? '' : `<p class="${p > z ? 't-ok' : 't-bad'}">${res}: ${p} % gegen ${z} %.</p>`)
      + '<p><button type="button" class="btn" id="b-share">Herausfordern: Link kopieren</button></p>' + (msg || '');
  }
  function share(lv, p, done) {
    const url = `${location.origin}${location.pathname}#bau-${lv.bau}~z${p}`;
    const ok = () => done(`<p>Link kopiert. Wer ihn öffnet, bekommt denselben Träger und muss mehr als ${p} % treffen.</p>`);
    const manual = () => done(`<p>Link zum Weitergeben: <a href="${url}">${url}</a></p>`);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, manual); else manual();
  }

  const BAU = { LEN, STEP, FMAX, QMAX, NMAX, code, parse, fromHash, level, problems, spur, leine, challengeHtml, share };
  if (node) module.exports = BAU; else root.BAU = BAU;
})(this);
