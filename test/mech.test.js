// Prüft die Statik der Level gegen Handrechnungen: node test/mech.test.js
const MECH = require('../src/mech.js'), LEVELS = require('../src/levels.js');
let fails = 0;
function check(name, got, want) {
  if (Math.abs(got - want) > 1e-9) { fails++; console.log(`FEHLER ${name}: ${got} statt ${want}`); }
}

// Schnittgrößen je Level, von Hand gerechnet (Vorzeichen nach TM1)
const want = [
  { N: 2, Q: 0, My: 0 },    // Stab: Zug
  { N: 0, Q: 2, My: -2 },   // Kragarm, 1 m vor dem Ende
  { N: 0, Q: 2, My: -6 },   // Kragarm, 3 m vor dem Ende
  { N: 0, Q: 2, My: 2 },    // Einfeldträger, A = 2 kN mal 1 m
  { N: 0, Q: 2, My: 2 },    // dasselbe vom rechten Stück aus
  { N: 0, Q: 2, My: -2 },   // Streckenlast 1 kN/m auf 2 m, Hebel 1 m
  { N: 3, Q: 4, My: -8 }    // schräge Last 3 kN längs, 4 kN quer, Hebel 2 m
];
LEVELS.forEach((lv, k) => {
  const h = MECH.hold(lv, lv.cut, lv.hold), o = MECH.hold(lv, lv.cut, lv.hold === 'plus' ? 'minus' : 'plus');
  for (const c of ['N', 'Q', 'My']) {
    check(`${k + 1} ${lv.name} ${c}`, h[c], want[k][c]);
    check(`${k + 1} ${lv.name} ${c} vom anderen Stück`, o[c], h[c]);
  }
  // Haltekraft und Schnittgrößen passen zusammen
  const back = MECH.nqm(h.ax, h.sign, h.F, h.M);
  for (const c of ['N', 'Q', 'My']) check(`${k + 1} ${lv.name} ${c} aus Haltekraft`, back[c], h[c]);
  // Gleichgewicht am ganzen Stab
  const all = MECH.loadsIn(lv, 0, h.ax.L), R = MECH.reactions(lv), o0 = lv.member.p0;
  let fx = 0, fz = 0, m = 0;
  for (const e of all) { fx += e.f[0]; fz += e.f[1]; m += MECH.mom(e.p, e.f, o0); }
  for (const r of R) { fx += r.f[0]; fz += r.f[1]; m += MECH.mom(r.p, r.f, o0) + r.m; }
  check(`${k + 1} ${lv.name} Gleichgewicht Fx`, fx, 0);
  check(`${k + 1} ${lv.name} Gleichgewicht Fz`, fz, 0);
  check(`${k + 1} ${lv.name} Gleichgewicht M`, m, 0);
});

// Lagerkräfte: Einfeldträger A = B = 2 kN nach oben, Kragarm 2 kN nach oben und 8 kNm gegen den Uhrzeigersinn
const r = MECH.reactions(LEVELS[3]);
check('Einfeldträger A senkrecht', r[0].f[1], -2);
check('Einfeldträger A waagerecht', r[0].f[0], 0);
check('Einfeldträger B senkrecht', r[1].f[1], -2);
const rk = MECH.reactions(LEVELS[1]);
check('Kragarm Einspannung Fz', rk[0].f[1], -2);
check('Kragarm Einspannmoment', rk[0].m, 8);

// Station 2: Querkraftverläufe und Werte an den Halten, von Hand gerechnet (Q positiv nach unten am linken Stück)
const SPUR = require('../src/spur-levels.js');
const wantTrace = [
  [[0, 0], [0, 2], [2, 2], [2, -2], [4, -2], [4, 0]],                                   // A = B = 2
  [[0, 0], [0, 2.5], [1, 2.5], [1, 0.5], [3, 0.5], [3, -3.5], [4, -3.5], [4, 0]],      // A = 2,5, B = 3,5
  [[0, 0], [0, -1], [2, -1], [2, -3], [4, -3], [4, 0]],                                 // Kragarm, Einspannung rechts
  [[0, 0], [0, 0], [4, -4], [4, 0]],                                                    // Q = −x
  [[0, 0], [0, 3], [1, 3], [1, -1], [4, -1], [4, 0]],                                   // A = 3, B = 1
  [[0, 0], [0, 2], [4, -2], [4, 0]],                                                    // A = B = 2, linear
  [[0, 0], [0, -2], [2, -2], [2, 2], [4, 2], [4, 0]]                                    // A = 2 nach unten, B = 4
];
const wantStops = [[2, -2], [2.5, 0.5, -3.5], [-1, -3], [-1, -2, -3]];
SPUR.forEach((lv, k) => {
  const tr = MECH.traceQ(lv), w = wantTrace[k];
  if (tr.length !== w.length) { fails++; console.log(`FEHLER Spur ${k + 1} ${lv.name}: ${JSON.stringify(tr)}`); return; }
  tr.forEach((p, j) => { check(`Spur ${k + 1} Punkt ${j} s`, p[0], w[j][0]); check(`Spur ${k + 1} Punkt ${j} Q`, p[1], w[j][1]); });
  (lv.stops || []).forEach((s, j) => check(`Spur ${k + 1} Halt bei ${s} m`, MECH.hold(lv, s, 'minus').Q, wantStops[k][j]));
});

// Station 3: Momente an Kennstellen und größtes Moment, von Hand gerechnet (M positiv bei Zug unten)
const LEINE = require('../src/leine-levels.js');
const at = (lv, x) => MECH.hold(lv, x, 'minus').My;
const moved = (lv, xs) => ({ ...lv, loads: lv.loads.map((ld, j) => ({ ...ld, s: xs[j] })) });
const l1 = moved(LEINE[0], [1]);
check('Leine 1: M unter dem Gewicht bei 1 m', at(l1, 1), 3);
check('Leine 1: tiefster Punkt', MECH.peakM(l1).x, 1);
const l2 = moved(LEINE[1], [1, 3]);
check('Leine 2: M bei 1 m', at(l2, 1), 2);
check('Leine 2: M bei 2 m (waagerecht)', at(l2, 2), 2);
check('Leine 2: M bei 3 m', at(l2, 3), 2);
check('Leine 3: tiefster Punkt', MECH.peakM(LEINE[2]).x, 3);
check('Leine 3: M bei 1 m', at(LEINE[2], 1), 1.5);
check('Leine 3: M bei 3 m', at(LEINE[2], 3), 2.5);
check('Leine 4: q L²/8', MECH.peakM(LEINE[3]).M, 3);
check('Leine 4: tiefster Punkt', MECH.peakM(LEINE[3]).x, 2);
check('Leine 5: tiefster Punkt', MECH.peakM(LEINE[4]).x, 1.5);
check('Leine 5: M dort', MECH.peakM(LEINE[4]).M, 2.25);
check('Leine 6: tiefster Punkt', MECH.peakM(LEINE[5]).x, 2.5);
check('Leine 6: M dort', MECH.peakM(LEINE[5]).M, 3.125);
check('Leine 6: M am Gewicht', at(LEINE[5], 3), 3);
check('Leine 7: M bei 1,5 m', at(LEINE[6], 1.5), 1.5);
check('Leine 7: M über dem Lager B', at(LEINE[6], 3), -1.5);
check('Leine 7: M am freien Ende', at(LEINE[6], 4), 0);
const tm = MECH.traceM(LEINE[5]);
check('Leine 6: Linienzug beginnt bei null', tm[0][1], 0);
check('Leine 6: Linienzug endet bei null', tm[tm.length - 1][1], 0);
check('Leine 6: Knickstelle im Linienzug', tm.find(p => p[0] === 3)[1], 3);

console.log(fails ? `${fails} Fehler` : 'Alle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
