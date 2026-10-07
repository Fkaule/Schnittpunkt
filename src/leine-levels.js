// Level von Station 3 „Wäscheleine“. Maße in m, Kräfte in kN, z nach unten. Die Leine hängt zwischen Pfosten an den Trägerenden,
// Einzellasten sind Gewichte, Streckenlasten Schnee, ein Lager in der Mitte zieht als Haken nach oben.
// mode 'place': Gewichte (drag) verschieben, bis goal erfüllt ist; 'tap': tiefsten Punkt antippen; 'draw': Leine vorher zeichnen.
(function (root) {
  'use strict';
  const beam = { member: { p0: [0, 0], p1: [4, 0] }, dimOff: 3.95, view: [-0.9, -1.95, 4.9, 4.35] };
  const einfeld = [{ kind: 'fest', s: 0, name: 'A' }, { kind: 'los', s: 4, name: 'B' }];
  const tippe = 'Wo wird die Leine am tiefsten hängen? Tippen Sie im unteren Bild auf die Stelle, dann loslassen.';
  const zeichne = 'Zeichnen Sie die Leine, wie sie gleich hängen wird, von Pfosten zu Pfosten. Dann loslassen.';

  const LEINE = [
    {
      name: 'Ein Gewicht', mode: 'place', goal: { lowest: 1 }, ...beam, supports: einfeld, loads: [{ s: 2, f: [0, 4], drag: true }],
      dims: [0, 1, 2, 3, 4], task: 'Hängen Sie das Gewicht so an die Leine, dass sie bei 1 m am tiefsten hängt. Dann loslassen.',
      hint: 'Unter einem Gewicht knickt die Leine. Wo hängt sie dann am tiefsten?',
      aha: 'Die Leine knickt unter dem Gewicht und ist sonst gerade. Genau so verläuft die Momentenlinie des Trägers: M steigt von A bis zur Last gerade auf A mal 1 m = 3 kNm und fällt dann gerade auf null.'
    },
    {
      name: 'Zwei Gewichte', mode: 'place', goal: { flat: true }, ...beam, supports: einfeld,
      loads: [{ s: 0.5, f: [0, 2], drag: true, name: 'F1' }, { s: 2, f: [0, 2], drag: true, name: 'F2' }], dims: [0, 1, 2, 3, 4],
      task: 'Hängen Sie die beiden Gewichte so, dass die Leine zwischen ihnen waagerecht hängt. Dann loslassen.',
      hint: 'Waagerecht heißt: Dort hält sich alles die Waage. Probieren Sie es symmetrisch.',
      aha: 'Symmetrisch hängt die Leine zwischen den Gewichten waagerecht: Dort ist Q = 0 und das Moment konstant. Das ist die Vierpunktbiegung aus der Werkstoffprüfung.'
    },
    {
      name: 'Ungleiche Gewichte', mode: 'tap', ...beam, supports: einfeld, loads: [{ s: 1, f: [0, 1], name: 'F1' }, { s: 3, f: [0, 3], name: 'F2' }],
      dims: [0, 1, 3, 4], task: tippe,
      hint: 'Am tiefsten Punkt geht es links bergab und rechts bergauf. Die Steigung der Leine ist Q: Wo wechselt Q das Vorzeichen?',
      aha: 'Am tiefsten Punkt wechselt die Steigung ihr Vorzeichen, genau wie Q: Links von 3 m ist Q = +0,5 kN, rechts −2,5 kN. Das größte Moment liegt dort, wo Q durch null geht.'
    },
    {
      name: 'Schnee', mode: 'draw', ...beam, supports: einfeld, loads: [{ q: [0, 1.5], s0: 0, s1: 4 }], dims: [0, 2, 4], task: zeichne,
      hint: 'Ohne einzelne Gewichte gibt es keinen Knick. Die Leine wird überall gleichmäßig krumm.',
      aha: 'Unter gleichmäßiger Last hängt die Leine als Parabel, am tiefsten in der Mitte: M = q L² / 8 = 3 kNm. Die Momentenlinie unter einer Streckenlast ist eine Parabel.'
    },
    {
      name: 'Halber Schnee', mode: 'tap', ...beam, supports: einfeld, loads: [{ q: [0, 2], s0: 0, s1: 2 }], dims: [0, 1, 2, 3, 4], task: tippe,
      hint: 'Rechts vom Schnee ist die Leine gerade. Am tiefsten Punkt ist Q = 0: A = 3 kN, je Meter Schnee 2 kN weniger.',
      aha: 'Am tiefsten hängt die Leine bei 1,5 m, weder in der Mitte des Schnees noch in der Mitte der Leine: Dort ist Q = 3 − 2 · 1,5 = 0. Rechts vom Schnee hängt sie gerade.'
    },
    {
      name: 'Schnee und Gewicht', mode: 'draw', ...beam, supports: einfeld, loads: [{ q: [0, 1], s0: 0, s1: 4 }, { s: 3, f: [0, 2] }],
      dims: [0, 3, 4], task: zeichne,
      hint: 'Parabel unter dem Schnee, dazu ein Knick unter dem Gewicht.',
      aha: 'Parabel mit Knick: Am Gewicht ändert sich die Steigung sprunghaft, wie Q in Station 2. Am tiefsten hängt die Leine bei 2,5 m, wo Q null wird.'
    },
    {
      name: 'Überstand', mode: 'draw', ...beam, supports: [{ kind: 'fest', s: 0, name: 'A' }, { kind: 'los', s: 3, name: 'B' }],
      loads: [{ s: 1.5, f: [0, 3], name: 'F1' }, { s: 4, f: [0, 1.5], name: 'F2' }], dims: [0, 1.5, 3, 4],
      task: 'Das Lager B drückt den Träger hoch, an der Leine ist es ein Haken, der nach oben zieht. Am freien Ende ist M = 0, dort steht ein Pfosten. Zeichnen Sie die Leine, dann loslassen.',
      hint: 'Am Haken muss die Leine nach oben, über die Pfosten hinaus.',
      aha: 'Über dem Lager B ist das Moment negativ, der Träger hat dort oben Zug. Die Leine steigt über die Pfosten, im Diagramm nach oben. Hier stößt das Bild der Leine an seine Grenze, die Momentenlinie geht weiter.'
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEINE; else root.LEINE = LEINE;
})(this);
