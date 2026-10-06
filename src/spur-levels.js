// Level von Station 2 „Säge-Spur“. Maße in m, Kräfte in kN, z nach unten (eine Last nach unten hat f = [0, +F]).
// mode 'stops': Die Säge hält an den Stellen stops, man stellt Q ein und prüft. mode 'draw': Man zeichnet den ganzen
// Verlauf, dann fährt die Säge und deckt auf. dims: Bemaßung entlang der Achse.
(function (root) {
  'use strict';
  const beam = { member: { p0: [0, 0], p1: [4, 0] }, dimOff: 1.15, view: [-0.9, -1.95, 4.9, 3.85] };
  const einfeld = [{ kind: 'fest', s: 0, name: 'A' }, { kind: 'los', s: 4, name: 'B' }];
  const kragRechts = [{ kind: 'einspannung', s: 4, name: 'B' }];
  const halt = 'Die Säge hält an. Mit welcher Kraft Q halten Sie das linke Stück? Ziehen Sie den Pfeil im Diagramm, dann prüfen.';
  const zeichne = 'Zeichnen Sie den ganzen Verlauf von Q von links nach rechts ins Diagramm. Dann fährt die Säge und deckt auf.';

  const SPUR = [
    {
      name: 'Einfeldträger', mode: 'stops', ...beam, supports: einfeld, loads: [{ s: 2, f: [0, 4] }], stops: [1, 3], dims: [0, 2, 4], task: halt,
      hint: 'Links der Säge wirkt zuerst nur die Lagerkraft A = 2 kN nach oben. Sie halten also mit 2 kN nach unten: Q = +2 kN, im Diagramm nach unten.',
      aha: 'Zwischen A und F bleibt Q gleich. Erst wenn die Säge an F vorbeikommt, gehört die Last zum linken Stück: Q springt um 4 kN von +2 auf −2 kN.'
    },
    {
      name: 'Zwei Lasten', mode: 'stops', ...beam, supports: einfeld, loads: [{ s: 1, f: [0, 2], name: 'F1' }, { s: 3, f: [0, 4], name: 'F2' }], stops: [0.5, 2, 3.5],
      dims: [0, 1, 3, 4], task: halt,
      hint: 'Zählen Sie alle Kräfte links der Säge zusammen, nach oben positiv: A = 2,5 kN, dann kommen F1 und F2 dazu.',
      aha: 'Jede Kraft, an der die Säge vorbeikommt, lässt Q um genau ihren Betrag springen. Dazwischen bleibt Q konstant.'
    },
    {
      name: 'Kragarm', mode: 'stops', ...beam, supports: kragRechts, loads: [{ s: 0, f: [0, 1], name: 'F1' }, { s: 2, f: [0, 2], name: 'F2' }], stops: [1, 3],
      dims: [0, 2, 4], task: halt,
      hint: 'Links der Säge hängen nur Lasten nach unten. Halten müssen Sie also nach oben: Q ist negativ und steht im Diagramm über der Achse.',
      aha: 'Ohne Lager links ist Q negativ und wächst im Betrag mit jeder Last. Erst die Einspannung rechts holt es auf null zurück.'
    },
    {
      name: 'Streckenlast', mode: 'stops', ...beam, supports: kragRechts, loads: [{ q: [0, 1], s0: 0, s1: 4 }], stops: [1, 2, 3],
      dims: [0, 1, 2, 3, 4], task: halt,
      hint: 'Links der Säge liegt ein Stück der Streckenlast: 1 kN/m mal die Länge bis zur Säge.',
      aha: 'Unter der Streckenlast ändert sich Q gleichmäßig, je Meter um 1 kN. Der Verlauf ist eine schräge Gerade.'
    },
    {
      name: 'Spur: Einfeldträger', mode: 'draw', ...beam, supports: einfeld, loads: [{ s: 1, f: [0, 4] }], dims: [0, 1, 4], task: zeichne,
      hint: 'Beginnen Sie bei A: Q springt auf +3 kN. An F geht es um 4 kN zurück, an B wieder auf null.',
      aha: 'Ein Verlauf ist nichts anderes als viele Schnitte hintereinander: Sprünge an jeder Kraft, dazwischen konstant.'
    },
    {
      name: 'Spur: Streckenlast', mode: 'draw', ...beam, supports: einfeld, loads: [{ q: [0, 1], s0: 0, s1: 4 }], dims: [0, 2, 4], task: zeichne,
      hint: 'Bei A springt Q auf +2 kN, dann nimmt es je Meter um 1 kN ab.',
      aha: 'Unter der Streckenlast fällt Q gleichmäßig von +2 auf −2 kN und ist in der Mitte null. Genau dort hat das Moment sein Maximum.'
    },
    {
      name: 'Spur: Kragende', mode: 'draw', ...beam, supports: [{ kind: 'fest', s: 0, name: 'A' }, { kind: 'los', s: 2, name: 'B' }],
      loads: [{ s: 4, f: [0, 2] }], dims: [0, 2, 4], task: zeichne,
      hint: 'Achtung: Die Lagerkraft A zeigt hier nach unten. Q beginnt also negativ.',
      aha: 'A zieht nach unten, darum startet Q bei −2 kN. An B springt es um 4 kN auf +2 kN und an der Last zurück auf null.'
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = SPUR; else root.SPUR = SPUR;
})(this);
