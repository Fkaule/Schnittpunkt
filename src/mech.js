// Statik eines geraden Stabs für Schnittpunkt, Station 1 „Festhalten“.
// Koordinaten wie in TM1: x nach rechts, z nach unten, y zum Betrachter; M_y positiv gegen den Uhrzeigersinn.
// Einheiten: m, kN, kNm. Läuft im Browser (global MECH) und in Node (module.exports).
(function (root) {
  'use strict';
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  // Moment M_y der Kraft f mit Angriffspunkt p um den Bezugspunkt o
  const mom = (p, f, o) => (p[1] - o[1]) * f[0] - (p[0] - o[0]) * f[1];
  const clean = v => (Math.abs(v) < 1e-9 ? 0 : v);

  // Stabachse: Länge, ex längs, ez quer (ez geht aus ex hervor wie z aus x)
  function axes(m) {
    const dx = m.p1[0] - m.p0[0], dz = m.p1[1] - m.p0[1], L = Math.hypot(dx, dz), ex = [dx / L, dz / L];
    return { L, ex, ez: [-ex[1], ex[0]] };
  }
  function point(lv, s) {
    const a = axes(lv.member);
    return [lv.member.p0[0] + s * a.ex[0], lv.member.p0[1] + s * a.ex[1]];
  }

  // Lasten im Bereich a ≤ s ≤ b als Einzelkräfte; eine Streckenlast zählt mit der Resultierenden ihres Anteils
  function loadsIn(lv, a, b) {
    const out = [];
    for (const ld of lv.loads) {
      if (ld.q) {
        const s0 = Math.max(a, ld.s0), s1 = Math.min(b, ld.s1), l = s1 - s0;
        if (l > 0) out.push({ p: point(lv, (s0 + s1) / 2), f: [ld.q[0] * l, ld.q[1] * l], m: 0 });
      } else if (ld.s >= a && ld.s <= b) out.push({ p: point(lv, ld.s), f: ld.f.slice(), m: 0 });
    }
    return out;
  }

  // 3 × 3 nach Cramer, c sind die Spalten
  function solve3(c, r) {
    const det = (a, b, d) => a[0] * (b[1] * d[2] - b[2] * d[1]) - b[0] * (a[1] * d[2] - a[2] * d[1]) + d[0] * (a[1] * b[2] - a[2] * b[1]);
    const D = det(c[0], c[1], c[2]);
    if (Math.abs(D) < 1e-12) throw new Error('Lagerung beweglich');
    return [det(r, c[1], c[2]) / D, det(c[0], r, c[2]) / D, det(c[0], c[1], r) / D];
  }

  // Lagerkräfte aus dem Gleichgewicht am ganzen Stab. Unbekannte: Einspannung Fx, Fz und M, Festlager Fx und Fz,
  // Loslager eine Kraft in Richtung dir (Standard senkrecht). Die Level sind statisch bestimmt: genau drei Unbekannte.
  function reactions(lv) {
    const o = lv.member.p0, cols = [], refs = [];
    lv.supports.forEach((sp, i) => {
      const p = point(lv, sp.s), dirs = sp.kind === 'los' ? [sp.dir || [0, 1]] : [[1, 0], [0, 1]];
      for (const d of dirs) { cols.push([d[0], d[1], mom(p, d, o)]); refs.push({ i, d }); }
      if (sp.kind === 'einspannung') { cols.push([0, 0, 1]); refs.push({ i, m: true }); }
    });
    if (cols.length !== 3) throw new Error(`Lagerung nicht statisch bestimmt (${cols.length} Unbekannte)`);
    const rhs = [0, 0, 0];
    for (const e of loadsIn(lv, 0, axes(lv.member).L)) { rhs[0] -= e.f[0]; rhs[1] -= e.f[1]; rhs[2] -= mom(e.p, e.f, o); }
    const x = solve3(cols, rhs);
    const out = lv.supports.map(sp => ({ kind: sp.kind, name: sp.name, s: sp.s, p: point(lv, sp.s), f: [0, 0], m: 0 }));
    refs.forEach((r, k) => {
      const R = out[r.i];
      if (r.m) R.m += x[k]; else { R.f[0] += x[k] * r.d[0]; R.f[1] += x[k] * r.d[1]; }
    });
    for (const R of out) { R.f = R.f.map(clean); R.m = clean(R.m); }
    return out;
  }

  // Schnittgrößen aus Kraft F und Moment M, die am Schnittufer auf das Stück wirken. sign: +1 positives Schnittufer
  // (n zeigt in +x, positive Schnittgrößen in Achsenrichtung), −1 negatives (sie zeigen gegen die Achsen)
  const nqm = (ax, sign, F, M) => ({ N: clean(sign * dot(F, ax.ex)), Q: clean(sign * dot(F, ax.ez)), My: clean(sign * M) });

  // Schnitt bei sc; gehalten wird das Stück 'plus' (s > sc) oder 'minus' (s < sc). Auf das Stück wirken seine Lasten und
  // Lagerkräfte; F und M (um den Schnittpunkt c) sind die Haltekraft und das Haltemoment, die es ins Gleichgewicht bringen.
  function hold(lv, sc, side) {
    const ax = axes(lv.member), c = point(lv, sc), [a, b] = side === 'plus' ? [sc, ax.L] : [0, sc];
    const ext = loadsIn(lv, a, b);
    for (const R of reactions(lv)) if (R.s >= a && R.s <= b) ext.push({ p: R.p, f: R.f, m: R.m });
    const F = [0, 0];
    let M = 0;
    for (const e of ext) { F[0] -= e.f[0]; F[1] -= e.f[1]; M -= mom(e.p, e.f, c) + e.m; }
    const sign = side === 'plus' ? -1 : 1;
    return { c, ax, sign, F: F.map(clean), M: clean(M), ...nqm(ax, sign, F, M) };
  }

  const MECH = { axes, point, loadsIn, reactions, hold, nqm, mom };
  if (typeof module !== 'undefined' && module.exports) module.exports = MECH; else root.MECH = MECH;
})(this);
