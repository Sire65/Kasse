# Stillgelegte Tests des alten TV-Editors

Diese 29 Tests waren dauerhaft rot. Beim TÜV-Durchgang am 31.08.2026 wurde jeder einzeln
nachgeprüft. Ergebnis: **keiner davon meldet einen echten Fehler.** Alle prüfen einen
Programmstand, den es nicht mehr gibt.

## Was war passiert

Der frühere TV-Editor bestand aus vielen einzelnen Modulen, die direkt im PC-Manager lagen
(`tv-weihnachtsmarkt-presentation.js`, `tv-unified-editor.js`, `tv-shared-renderer-v02946.js`
und weitere). Diese wurden bewusst zusammengeführt:

* in **`pc-manager/kc-object-studio.js`** – im Kopf dieser Datei steht ausdrücklich, welche
  Module sie ersetzt,
* und in den eigenen Ordner **`pc-manager/tv-designer/`**.

Die alten Dateien wurden dabei gelöscht. Die Tests dazu blieben liegen.

## Warum sie rot waren

* **26 Tests** scheitern schon beim Öffnen: sie lesen mit `fs.readFileSync` eine Moduldatei
  ein, die es nicht mehr gibt (`ENOENT`).
* **3 Tests** (`deep-consolidation`, `presentation-save-open`, `tv-draw-textbox`) kommen weiter
  und scheitern erst an einer Zusicherung – sie suchen alte Dateinamen oder Element-Kennungen
  in `pc-manager/index.html`, die dort seit der Zusammenführung nicht mehr vorkommen.

Beispiel: `tv-draw-textbox` verlangt, dass `tv-custom-text-editor-v02954.js` eingebunden ist.
Diese Datei existiert nicht mehr; ihre Aufgabe erfüllt heute `kc-object-studio.js`
(neun Fundstellen zu `customTextObjects` / `createCustomText`).

## Warum sie nicht einfach gelöscht wurden

Sie halten fest, was der alte Editor können musste. Wer den TV-Bereich später wieder anfasst,
findet hier die frühere Anforderungslage. Zum Nachlesen taugen sie – zum Ausführen nicht.

## Was an ihre Stelle tritt

`tests/tv-designer-konsolidierung.test.cjs` prüft den heutigen Zustand:
die alten Module sind wirklich verschwunden, es verweist nichts mehr auf sie,
und die Nachfolger sind da und eingebunden.

## Wichtig

Dauerhaft rote Tests sind gefährlich: man gewöhnt sich an sie und übersieht darin einen
echten neuen Fehler. Deshalb gilt für diese Suite: **rot bedeutet wieder rot.**
