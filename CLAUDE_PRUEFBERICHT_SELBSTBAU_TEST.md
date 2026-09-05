# Prüfbericht – Selbstbau-Test der Objekt-Studio-Präsentation
**Basis:** V0.31.3.6 Repair 67 "Objekt-Studio Baustufe 3 Candidate"
**Ergebnis:** V0.31.3.6 Repair 68 "Selbstbau-Test: Positionierungs-Fehler behoben"
**Methode:** 22-Folien-Testpräsentation mit jedem Baustein gebaut und im echten, laufenden
Manager per Playwright/Chromium (echter Browser, nicht nur Code-Analyse) durchgespielt,
inklusive Bildschirmfotos und echten Klick-Interaktionen.

## Der wichtigste Fund: freie Positionierung hatte nie eine sichtbare Wirkung

**Was passiert ist:** Beim Anschauen der Bildschirmfotos lagen Überschrift, Text und Preis auf
mehreren Testfolien alle eng zusammengedrängt in einer Ecke, obwohl die Positionsdaten sie klar
über die Folie verteilen sollten.

**Ursache gefunden:** Der Textbereich (`.tv-preview-content`) hatte eine CSS-Eigenschaft
(`transform:scale(var(--tv-scale,1))`), die ihn zum neuen Bezugsrahmen für alle absolut
positionierten Objekte darin macht. Diese Skalierung wurde in einer früheren Reparatur (Repair 36)
bereits fest auf den Wert 1 gesetzt und hatte damit keinen sichtbaren Nutzen mehr – löste aber
weiterhin einen CSS-Nebeneffekt aus: Ohne normale Kind-Elemente (weil alle Objekte absolut
positioniert sind) schrumpfte dieser Bezugsrahmen auf nahezu null zusammen. Alle
Prozent-Positionen (50 %, 20 % usw.) wurden dadurch relativ zu diesem winzigen, falschen Rahmen
berechnet statt zur eigentlichen Folie.

**Tragweite:** Das betraf **nicht nur** meinen neuen Werkzeugkasten – dieselbe fehlerhafte
CSS-Grundlage bestand schon **vor** Baustufe 1. Freies Verschieben/Skalieren von Überschrift,
Text, Preis, Laufschrift, Wetter, Banner und Form hatte in der Praxis vermutlich nie eine
sichtbare Wirkung, unabhängig vom Werkzeugkasten. Betroffen waren nur die editierbare Ansicht;
Miniaturansichten in der Folienliste nutzen einen anderen, einfacheren Aufbau und waren nicht
betroffen.

**Fix:** Der Textbereich füllt jetzt in der bearbeitbaren Ansicht (erkennbar am technischen
Merkmal `data-tv-object="content"`) immer die volle Folienfläche aus und hat keine eigene
Transformation mehr. Die einfache Miniaturansicht bleibt unverändert.

**Nachweis:** Nach dem Fix wurden alle Positionen exakt korrekt berechnet (z. B. Überschrift bei
50 %/20 % landete tatsächlich bei 50 %/20 % der Folienfläche, nicht mehr in einer Ecke). Auf allen
26 Testfolien danach sauber verteilt, mit Bildschirmfotos bestätigt.

## Weitere Bestätigungen (per echtem Klick im Browser getestet)

- Kontextbezogener Werkzeugkasten funktioniert korrekt (Klick auf Überschrift zeigt nur
  Überschrift-Werkzeuge, keine Hintergrund-Karte) – Repair-65-Fix bestätigt weiterhin wirksam
- Textflächen-Dropdown zeigt korrekt den gespeicherten Wert – Repair-65-Fix bestätigt
- Gestaltungs-Vorlage "Weihnacht Gold" per echtem Klick angewendet: Hintergrund und Schriftart
  wurden korrekt gemeinsam gesetzt
- Mehrfachauswahl per Umschalt+Klick öffnet zuverlässig die Mehrfachauswahl-Werkzeugleiste

## Ein weiterer, noch offener Fund: zwei konkurrierende Symbol-Systeme

`tv-editor-shell-v02935.js` (aus Baustufe 1 bewusst behalten, da es nur die Symbol-Bibliothek
zum Ziehen bereitstellte) rendert bei vorhandenen Symbolen zusätzlich ein **komplett eigenes**
System: jedes Symbol einzeln, frei verschiebbar, mit eigener Positionsliste – und blendet dabei
mein Objekt-Studio-Symbolblock aktiv aus. In der Praxis ist dadurch der "Symbole"-Bereich in
meinem Werkzeugkasten (Liste, Farbe, Abstand) unsichtbar/wirkungslos, sobald Symbole vorhanden
sind; die tatsächlich sichtbaren, einzeln verschiebbaren Symbole haben aber keine eigene
Einstellungsseite im neuen Werkzeugkasten. Das ist kein neuer Fehler durch mich, sondern ein
bereits vorher bestehender Baustellen-Konflikt, den ich in Baustufe 1 nicht als Konflikt erkannt
hatte, weil er nur die Bühne betrifft, nicht den Werkzeugkasten selbst.

**Vorschlag:** Ich löse das im nächsten Schritt auf, indem ich die einzeln-verschiebbaren Symbole
zum einzigen System mache (es ist flexibler) und dafür einen passenden Werkzeugkasten-Abschnitt
baue, statt den alten Blockmodus weiterzuführen.

## Prüfung
44 automatisierte Tests (43 bestehende + 1 neuer Test, der genau diesen Positionierungs-Fix
dauerhaft absichert), alle grün.

## Bonus: die Testpräsentation selbst
Als Nebenprodukt ist eine vollständige, thematisch stimmige 22-Folien-Weihnachtsmarkt-
Präsentation entstanden, die du dir ansehen oder als Ausgangspunkt nutzen kannst.
