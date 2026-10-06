// Level von Station 1 „Festhalten“. Maße in m, Kräfte in kN, z nach unten (eine Last nach unten hat f = [0, +F]).
// cut: Schnittstelle, hold: gehaltenes Stück ('plus' hinter, 'minus' vor dem Schnitt), dof: welche Haltegrößen es gibt,
// dims: Bemaßung entlang der Achse (Abstand dimOff quer dazu), view: Zeichenausschnitt [x0, z0, x1, z1].
(function (root) {
  'use strict';
  const kragarm = { member: { p0: [0, 0], p1: [4, 0] }, supports: [{ kind: 'einspannung', s: 0 }] };
  const einfeld = {
    member: { p0: [0, 0], p1: [4, 0] },
    supports: [{ kind: 'fest', s: 0, name: 'A' }, { kind: 'los', s: 4, name: 'B' }],
    loads: [{ s: 2, f: [0, 4] }], dims: [0, 1, 2, 4], dimOff: 1.2, view: [-0.9, -1.9, 4.9, 1.75]
  };

  const LEVELS = [
    {
      name: 'Hängender Stab', task: 'Halten Sie das untere Stück fest.',
      member: { p0: [0, 0], p1: [0, 3] }, supports: [{ kind: 'einspannung', s: 0 }],
      loads: [{ s: 3, f: [0, 2], pull: true }],
      cut: 1.5, hold: 'plus', dof: 'N', dims: [0, 1.5, 3], dimOff: -0.9, view: [-2.4, -0.75, 2.4, 4.25],
      hint: 'Ohne Halt fällt das untere Stück mit der Last nach unten. Halten Sie mit genau so viel Kraft dagegen.',
      aha: 'Ihre Kraft zieht vom Stück weg: Das ist Zug, also eine positive Normalkraft, N = +2 kN. Vor dem Schnitt hat das obere Stück genau so am unteren gezogen.'
    },
    {
      name: 'Kragarm', task: 'Halten Sie das rechte Stück fest.', ...kragarm,
      loads: [{ s: 4, f: [0, 2] }],
      cut: 3, hold: 'plus', dof: 'QM', dims: [0, 3, 4], dimOff: 0.9, view: [-0.8, -1.9, 5.0, 1.5],
      hint: 'Die Last zieht das Stück nach unten und dreht es um Ihre Hand. Halten Sie mit einer Kraft dagegen und mit einem Moment gegen das Kippen.',
      aha: 'Q hält die Last, M hält gegen das Kippen. Das Moment ist Kraft mal Hebelarm: 2 kN mal 1 m.'
    },
    {
      name: 'Kragarm, weiter innen', task: 'Halten Sie das rechte Stück fest. Der Schnitt liegt jetzt weiter innen.', ...kragarm,
      loads: [{ s: 4, f: [0, 2] }],
      cut: 1, hold: 'plus', dof: 'QM', dims: [0, 1, 4], dimOff: 0.9, view: [-0.8, -1.9, 5.0, 1.5],
      hint: 'Die Last ist dieselbe wie eben, nur der Hebelarm bis zur Schnittstelle ist länger.',
      aha: 'Gleiche Last, dreifacher Hebelarm: Q bleibt 2 kN, der Betrag von M wächst von 2 auf 6 kNm. Am größten ist das Moment an der Einspannung.'
    },
    {
      name: 'Einfeldträger', task: 'Halten Sie das linke Stück fest. Das Lager A wirkt darauf mit seiner Kraft.', ...einfeld,
      cut: 1, hold: 'minus', dof: 'QM',
      hint: 'Auf das linke Stück wirkt nur die Lagerkraft A = 2 kN nach oben. Was macht sie mit dem Stück, wenn Sie loslassen?',
      aha: 'Die Lagerkraft gehört zum Stück: Ohne Ihre Hand drückt A es hoch und dreht es. Q = +2 kN und M = A mal 1 m = +2 kNm, positiv, weil das linke Stück ein positives Schnittufer hat.'
    },
    {
      name: 'Einfeldträger, andere Seite', task: 'Halten Sie jetzt das rechte Stück fest.', ...einfeld,
      cut: 1, hold: 'plus', dof: 'QM',
      hint: 'Auf das rechte Stück wirken die Last und die Lagerkraft B. Oder kürzer: Wie haben Sie eben das linke Stück gehalten?',
      aha: 'Dieselben Werte wie links, Q = +2 kN und M = +2 kNm, nur zeigen alle Pfeile andersherum. Darum hängt das Vorzeichen am Schnittufer und nicht an der Pfeilrichtung. Von links ging es einfacher: Nehmen Sie immer das einfachere Teilstück.'
    },
    {
      name: 'Streckenlast', task: 'Halten Sie das rechte Stück fest.', ...kragarm,
      loads: [{ q: [0, 1], s0: 0, s1: 4 }],
      cut: 2, hold: 'plus', dof: 'QM', dims: [0, 2, 4], dimOff: 0.9, view: [-0.8, -1.9, 4.8, 1.5], tipRes: true,
      hint: 'Fassen Sie die Streckenlast auf dem Stück zusammen: 1 kN/m auf 2 m ergibt 2 kN in der Mitte des Stücks.',
      aha: 'Die Streckenlast wirkt wie ihre Resultierende: 2 kN im Abstand 1 m, also Q = +2 kN und M = −2 kNm. Weiter links geschnitten wächst Q linear und M quadratisch.'
    },
    {
      name: 'Schräge Last', task: 'Halten Sie das rechte Stück fest. Jetzt braucht es N, Q und M.',
      member: { p0: [0, 0], p1: [3, 0] }, supports: [{ kind: 'einspannung', s: 0 }],
      loads: [{ s: 3, f: [3, 4], pull: true, parts: true }],
      cut: 1, hold: 'plus', dof: 'NQM', dims: [0, 1, 3], dimOff: 1.0, view: [-0.8, -1.9, 4.9, 1.75],
      hint: 'Zerlegen Sie die Last: 3 kN ziehen längs am Träger, 4 kN quer. Nur der Querteil hat einen Hebelarm.',
      aha: 'Alle drei auf einmal: N = +3 kN (Zug), Q = +4 kN und M = −8 kNm aus 4 kN mal 2 m. Der Längsteil der Last liegt auf der Stabachse und macht kein Moment.'
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS; else root.LEVELS = LEVELS;
})(this);
