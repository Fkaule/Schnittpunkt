# Schnittpunkt

Lernspiel zu Schnittgrößen für Technische Mechanik 1. Station 1 „Festhalten“: Ein Träger wird durchgesägt, die Zeit steht still,
und das abgeschnittene Stück muss mit den richtigen Kräften an der Schnittstelle gehalten werden. Wer loslässt, sieht, ob es hält.
Danach folgen die Vorzeichen nach dem Schnittufer.

## Spielen

```
python3 -m http.server 8915
```

Dann http://localhost:8915 öffnen. Keine Installation, kein Build.

## Level

1. Hängender Stab: nur N (Zug)
2. Kragarm: Q und M, Hebel 1 m
3. Kragarm, weiter innen: gleiche Last, Hebel 3 m
4. Einfeldträger, linkes Stück: Lagerkraft A gehört zum Stück
5. Einfeldträger, rechtes Stück: dieselben Werte, Pfeile andersherum
6. Streckenlast: Resultierende
7. Schräge Last: N, Q und M zusammen

Sterne: hält; beim ersten Loslassen ohne Live-Hilfe; alle Vorzeichen richtig.

## Wie gerechnet wird

- Koordinaten wie in der TM1-Vorlesung: x nach rechts, z nach unten, y zum Betrachter; M_y positiv gegen den Uhrzeigersinn
- Lagerkräfte aus dem Gleichgewicht am ganzen Stab (statisch bestimmt, drei Unbekannte)
- Am gehaltenen Stück wirken seine Lasten und Lagerkräfte; Haltekraft F und Haltemoment M (um den Schnittpunkt) bringen es ins Gleichgewicht
- Schnittgrößen: am positiven Schnittufer (n zeigt in +x) N = F·ex, Q = F·ez, M = M; am negativen mit umgekehrtem Vorzeichen
- Loslassen: Restkraft und Restmoment ergeben Beschleunigung und Drehung um den Schnittpunkt (gedeckelt, nur zur Anschauung)

Prüfung gegen Handrechnungen, auch vom jeweils anderen Stück aus und mit Gleichgewicht am ganzen Stab:

```
node test/mech.test.js
```

## Dateien

- `src/mech.js`: Statik (Lagerkräfte, Schnitt, Schnittgrößen)
- `src/levels.js`: Level
- `src/game.js`: Zeichnung, Bedienung, Ablauf
