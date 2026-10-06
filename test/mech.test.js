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

console.log(fails ? `${fails} Fehler` : 'Alle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
