// Prüft den Baukasten: Code im Link, Prüfung, Level für Station 2 und 3 und die erzeugten Texte: node test/bau.test.js
const MECH = require('../src/mech.js'), BAU = require('../src/bau.js');
const SPUR = require('../src/spur-levels.js'), LEINE = require('../src/leine-levels.js');
let fails = 0;
const ok = (name, cond, info = '') => { if (!cond) { fails++; console.log(`FEHLER ${name} ${info}`); } };
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `${JSON.stringify(got)} statt ${JSON.stringify(want)}`);

// Code hin und zurück, Reihenfolge der Teile egal
const d1 = { supports: [{ kind: 'los', s: 4 }, { kind: 'fest', s: 0 }], loads: [{ s0: 0, s1: 2, q: 1 }, { s: 3, F: 2.5 }] };
same('Code', BAU.code(d1), 'f0~l4~q0-2:1~F3:2.5');
same('Code zurück', BAU.code(BAU.parse(BAU.code(d1)).d), BAU.code(d1));
same('Ziel aus dem Link', BAU.fromHash('#bau-f0~l4~F2:4~z87').ziel, 87);
same('ohne Ziel', BAU.fromHash('#bau-f0~l4~F2:4').ziel, null);
same('Link mit Prozentzeichen-Kodierung', BAU.code(BAU.fromHash('#bau-f0%7El4%7EF2:4').d), 'f0~l4~F2:4');

// Ungültige Codes: Raster, Bereich, doppelte Lager, Einspannung nicht am Ende oder mit weiterem Lager, zu viele Lasten
for (const c of ['f0~l4~F2.3:4', 'f0~l4~F2:5', 'f0~l4~F5:2', 'f0~f4', 'e2', 'e0~f1', 'f0~l4~q2-2:1', 'f0~l4~q0-2:2.5',
  'x1', 'f0~l4~F0:1~F1:1~F2:1~F3:1~F3.5:1~F4:1', '', 'f0~l4~z101'])
  ok(`ungültig: ${c}`, BAU.parse(c) === null);
ok('fremder Hash', BAU.fromHash('#3') === null);

// Prüfung
const prob = c => BAU.problems(BAU.parse(c).d);
const allOk = c => { const p = prob(c); return !p.bau.length && !p.q.length && !p.m.length; };
ok('ohne Lager', /fehlt ein Lager/.test(prob('F2:2').bau[0]));
ok('nur Festlager', /fehlt das Loslager/.test(prob('f0~F2:2').bau[0]));
ok('nur Loslager', /fehlt das Festlager/.test(prob('l0~F2:2').bau[0]));
ok('Lager an derselben Stelle', /derselben Stelle/.test(prob('f2~l2~F1:2').bau[0]));
ok('ohne Last', /fehlt eine Last/.test(prob('f0~l4').bau[0]));
ok('Einfeldträger geht', allOk('f0~l4~F2:3'));   // M = 3 kNm passt auf die Leine, 4 kN in der Mitte (4 kNm) nicht
ok('Überstand geht', allOk('f0~l3~F1.5:3~F4:1.5'));
ok('Einspannung: Q ja, M nein', (p => !p.q.length && p.m.length === 1 && /eingespannten Ende/.test(p.m[0]))(prob('e4~F0:2')));
ok('Q zu groß', /Q wird bis 6 kN/.test(prob('e4~F0:3~F2:3').q[0]));
ok('M zu groß für die Leine', (p => !p.q.length && /M reicht von 0 bis 4,5 kNm/.test(p.m[0]))(prob('f0~l4~F2:4.5')));
ok('Lagerkraft zu groß', (p => /Q wird bis 6 kN/.test(p.q[0]) && /B = 8 kN/.test(p.m[0]))(prob('f0~l1~F4:2')));

// Namen und Bemaßung wie in den Stationen
const L1 = BAU.level(BAU.parse('l4~f0~F3:2~F1:2~q0-4:1').d);
same('Namen der Lager', L1.supports.map(s => s.name), ['A', 'B']);
same('Namen der Einzellasten', L1.loads.filter(l => !l.q).map(l => `${l.name}@${l.s}`), ['F1@1', 'F2@3']);
same('Bemaßung', L1.dims, [0, 1, 3, 4]);
same('Einspannung rechts heißt B', BAU.level(BAU.parse('e4~F2:1').d).supports[0].name, 'B');
same('eine Einzellast heißt F', BAU.level(BAU.parse('f0~l4~F2:1').d).loads[0].name, 'F');

// Die Level von Station 2 und 3 lassen sich im Baukasten nachbauen und ergeben dieselben Verläufe
const toCode = lv => BAU.code({ supports: lv.supports.map(sp => ({ kind: sp.kind, s: sp.s })),
  loads: lv.loads.map(ld => (ld.q ? { s0: ld.s0, s1: ld.s1, q: ld.q[1] } : { s: ld.s, F: ld.f[1] })) });
SPUR.forEach((lv, k) => {
  const own = BAU.spur('#bau-' + toCode(lv), SPUR[4]);
  ok(`Station 2, Level ${k + 1} im Baukasten`, !!own);
  if (own) same(`Station 2, Level ${k + 1}: Querkraftverlauf`, MECH.traceQ(own), MECH.traceQ(lv));
});
LEINE.forEach((lv, k) => {
  const c = toCode(lv), own = BAU.leine('#bau-' + c, LEINE[3]), fits = !BAU.problems(BAU.parse(c).d).m.length;
  ok(`Station 3, Level ${k + 1}: passt auf die Leine, wenn gezeichnet wird`, fits || lv.mode !== 'draw');
  ok(`Station 3, Level ${k + 1} im Baukasten`, !!own === fits);
  if (own) same(`Station 3, Level ${k + 1}: Momentenlinie`, MECH.traceM(own), MECH.traceM(lv));
});

// Erzeugte Texte
const e = BAU.spur('#bau-f0~l4~F1:4', SPUR[4]);
ok('Tipp nennt die Lagerkräfte', e.hint.startsWith('Zuerst die Lagerkräfte: A = 3 kN nach oben und B = 1 kN nach oben.'), e.hint);
same('Auflösung Einfeldträger', e.aha, 'Q springt bei 0 m auf +3 kN, bei 1 m auf −1 kN und bei 4 m auf 0 kN. Dazwischen bleibt Q konstant. '
  + 'Wo Q das Vorzeichen wechselt (bei 1 m), ist das Moment am größten oder am kleinsten.');
same('Rückweg zum Baukasten', e.bau, 'f0~l4~F1:4');
const q = BAU.spur('#bau-f0~l4~q0-4:1~z80', SPUR[4]);
ok('Ziel in der Aufgabe', q.task.endsWith('Zu schlagen: 80 % Treffer.'), q.task);
ok('Nulldurchgang unter der Streckenlast', q.aha.includes('von 0 bis 4 m von +2 auf −2 kN') && q.aha.includes('(bei 2 m)'), q.aha);
ok('Station 2 ohne passenden Träger', BAU.spur('#bau-f0~F2:2', SPUR[4]) === null && BAU.spur('#bau-e4~F0:3~F2:3', SPUR[4]) === null);
const m = BAU.leine('#bau-f0~l4~q0-4:1.5', LEINE[3]);
ok('Leine: tiefster Punkt', m.aha === 'Am tiefsten hängt die Leine bei 2 m: M = 3 kNm.', m.aha);
const u = BAU.leine('#bau-f0~l3~F1.5:3~F4:1.5', LEINE[3]);
ok('Leine: negatives Moment über B', u.aha.includes('Bei 3 m ist M = −1,5 kNm'), u.aha);
ok('Leine: Pfosten am freien Ende', u.task.includes('An einem freien Ende ist M = 0'), u.task);
ok('Leine: Lager zwischen den Pfosten', u.task.includes('als Haken nach oben oder als Abspannung nach unten'), u.task);
ok('Leine mit Einspannung gibt es nicht', BAU.leine('#bau-e4~F2:1', LEINE[3]) === null);
const g = BAU.leine('#bau-f0~l4~F0:2~F4:1', LEINE[3]);
ok('Lasten nur auf den Lagern', g && g.aha.startsWith('Die Leine bleibt gerade'), g && g.aha);

console.log(fails ? `${fails} Fehler` : 'Alle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
