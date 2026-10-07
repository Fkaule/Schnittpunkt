# Schnittpunkt

Lernspiel zu Schnittgrößen für Technische Mechanik 1, als Lernpfad aus Stationen. Vorstufe davor: [Drehpunkt](https://fkaule.github.io/Drehpunkt/)
(Kräfte, Momente und Lager freischneiden und halten, gleiche Mechanik wie Station 1, nur am Lager statt im Träger).

- **Station 1 „Festhalten“** (`index.html`): Ein Träger wird durchgesägt, die Zeit steht still, und das abgeschnittene Stück muss
  mit den richtigen Kräften an der Schnittstelle gehalten werden. Wer loslässt, sieht, ob es hält. Danach folgen die Vorzeichen nach dem Schnittufer.
- **Station 2 „Säge-Spur“** (`spur.html`): Die Säge wandert am Träger entlang. Erst hält sie an einzelnen Stellen, und man stellt Q ein,
  mit dem man das linke Stück hält. Dann zeichnet man den ganzen Querkraftverlauf, und die Säge deckt ihn auf.
- **Station 3 „Wäscheleine“** (`leine.html`): Eine Leine zwischen zwei Pfosten trägt dieselben Lasten wie der Träger und hängt genau wie
  seine Momentenlinie (Seillinie = M geteilt durch den Horizontalzug). Gewichte setzen, den tiefsten Punkt antippen oder die Leine
  vorher zeichnen, dann loslassen.

## Spielen

```
python3 -m http.server 8915
```

Dann http://localhost:8915 öffnen. Keine Installation, kein Build.

## Level

Station 1:

1. Hängender Stab: nur N (Zug)
2. Kragarm: Q und M, Hebel 1 m
3. Kragarm, weiter innen: gleiche Last, Hebel 3 m
4. Einfeldträger, linkes Stück: Lagerkraft A gehört zum Stück
5. Einfeldträger, rechtes Stück: dieselben Werte, Pfeile andersherum
6. Streckenlast: Resultierende
7. Schräge Last: N, Q und M zusammen

Sterne: hält; beim ersten Loslassen ohne Live-Hilfe; alle Vorzeichen richtig.

Station 2 (Halte, dann ganze Spur):

1. Einfeldträger: Sprung an der Last
2. Zwei Lasten: jede Kraft ein Sprung, dazwischen konstant
3. Kragarm mit Einspannung rechts: Q negativ
4. Streckenlast: Q ändert sich gleichmäßig
5. Spur Einfeldträger
6. Spur Streckenlast: Nulldurchgang in der Mitte
7. Spur Kragende: Lagerkraft nach unten

Sterne bei den Halten: alle richtig drei, einer daneben zwei, sonst einer. Bei der Spur ab 70, 85 und 95 % Treffer
(höchstens 0,3 kN daneben, direkt an den Sprüngen wird nicht gewertet).

Station 3:

1. Ein Gewicht: so hängen, dass die Leine bei 1 m am tiefsten ist (Knick unter der Last)
2. Zwei Gewichte: dazwischen waagerecht (Vierpunktbiegung, Q = 0)
3. Ungleiche Gewichte: tiefsten Punkt antippen (wo Q das Vorzeichen wechselt)
4. Schnee: Leine zeichnen (Parabel, q L² / 8)
5. Halber Schnee: tiefsten Punkt antippen (1,5 m)
6. Schnee und Gewicht: Leine zeichnen (Parabel mit Knick)
7. Überstand: Leine zeichnen, das Lager B zieht als Haken nach oben (negatives Moment)

Sterne beim Verschieben: im ersten Versuch drei, im zweiten zwei, danach einer. Beim Antippen bis 0,25 m daneben drei,
bis 0,5 m zwei. Beim Zeichnen ab 70, 85 und 95 % Treffer (0,4 kNm Spielraum).

## Wie gerechnet wird

- Koordinaten wie in der TM1-Vorlesung: x nach rechts, z nach unten, y zum Betrachter; M_y positiv gegen den Uhrzeigersinn
- Lagerkräfte aus dem Gleichgewicht am ganzen Stab (statisch bestimmt, drei Unbekannte)
- Am gehaltenen Stück wirken seine Lasten und Lagerkräfte; Haltekraft F und Haltemoment M (um den Schnittpunkt) bringen es ins Gleichgewicht
- Schnittgrößen: am positiven Schnittufer (n zeigt in +x) N = F·ex, Q = F·ez, M = M; am negativen mit umgekehrtem Vorzeichen
- Querkraftverlauf: Q am linken Stück für jede Lage der Säge, senkrechte Sprünge an Einzelkräften und Lagern, dazwischen gerade.
  Im Diagramm wie in der Vorlesung positive Werte nach unten
- Momentenverlauf und Leine: M am linken Stück für jede Stelle; eine Leine mit Horizontalzug H unter denselben senkrechten Lasten
  hängt um M / H durch. Lager zwischen den Enden ziehen die Leine als Haken nach oben, an den Enden ist M = 0 (Pfosten)
- Loslassen: Restkraft und Restmoment ergeben Beschleunigung und Drehung um den Schnittpunkt (gedeckelt, nur zur Anschauung)

Prüfung gegen Handrechnungen, auch vom jeweils anderen Stück aus, mit Gleichgewicht am ganzen Stab und für die Verläufe von Station 2 und 3:

```
node test/mech.test.js
```

## Dateien

- `src/mech.js`: Statik (Lagerkräfte, Schnitt, Schnittgrößen, Querkraft- und Momentenverlauf)
- `src/draw.js`: Zeichenbaukasten für alle Stationen (Maßstab, Pfeile, Beschriftungen mit Platzwahl, Lager, Lasten, Säge)
- `style.css`: gemeinsames Design
- `src/levels.js`, `src/game.js`: Station 1
- `src/spur-levels.js`, `src/spur.js`: Station 2
- `src/leine-levels.js`, `src/leine.js`: Station 3
