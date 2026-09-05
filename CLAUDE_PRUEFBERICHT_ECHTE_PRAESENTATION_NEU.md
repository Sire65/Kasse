# Prüfbericht – Echte Präsentation komplett neu aufgebaut
**Basis:** V0.31.3.6 Repair 70 "Mitglieder-Rotation Candidate"
**Ergebnis:** V0.31.3.6 Repair 71 "Echte Präsentation neu aufgebaut"
**Tests:** 46/46 PASS (Rotationstest an das neue Modell angepasst)

## Neue Reihenfolge (23 Folien, 1 automatisch ergänzt)
1. Begrüßung
2. Öffnungszeiten (Platzhalter, 10 Tage nach dem Muster von 2025)
3–5. Preislisten Alkohol / alkoholfrei / Speisen (Speisen jetzt mit "Außer-Haus-Becher 1,00 €")
6. *(automatisch ergänzt: Rezept "Eierlikörpunsch à la Köcheclub" – bereits vorher im System hinterlegt)*
7. Küchenchef-Tipp: eigene Gefäße mitbringen
8. Mitglied (fester Platz A – rotiert automatisch)
9–10. Bühnenprogramm heute / morgen (**live berechnet**, aktuell mit Rückfalltag auf die 2025er-Platzhalterdaten)
11–13. Gesamtprogramm in 3 Teilen (Platzhalter aus dem 2025er-Prospekt)
14–15. Wetter heute/morgen, Wetter alle Tage (kompakt)
16. Mitglied (fester Platz B – rotiert automatisch)
17. Gruppenfoto / Vereinsvorstellung
18. Laufende Projekte 2026 (Wünsche-Wagen, Marga-Spiegel-Schule, 1 Platzhalter)
19–20. Projekte vergangener Jahre (6 genannte + 1 Platzhalter-Folie für weitere)
21. QR-Code zur offiziellen Programmseite der Stadt Werne
22. "Lust, dabei zu sein?"
23. Mitmachen + QR-Code zu zander.klaus@web.de

## Wichtigster technischer Umbau: Mitglieder-Rotation neu konzipiert
Die Rotation aus Repair 70 ging noch von 18 einzelnen, filterbaren Folien aus. Für die jetzt
gewünschte Platzierung ("zwei feste Stellen, nicht als Block") war das nicht passend. Neu gebaut:
genau zwei feste Folien-Plätze im Ablauf, deren Inhalt (Name, Zitat, Foto) automatisch alle 3
Minuten (einstellbar) aus dem Pool aller 18 Mitglieder befüllt wird – Positionen bleiben fest,
nur der Inhalt wechselt. Gilt jetzt sowohl im TV-Player als auch live in der Manager-Vorschau.

## Programm heute/morgen – echte Automatik
Liest jetzt tatsächlich das Kalenderdatum aus und zeigt die passenden Programmpunkte. Da aktuell
nur 2025er-Platzhalterdaten vorliegen (kein Datum trifft das echte "heute"), greift automatisch
ein Rückfalltag (erster bzw. zweiter verfügbarer Tag) – live bestätigt: zeigt korrekt "Freitag,
05.12." und "Samstag, 06.12." mit den jeweiligen Programmpunkten. Sobald die echten 2026-Daten
eingespielt werden, greift automatisch das echte Datum, ohne Codeänderung.

## Wetterabhängige Effekte – live bestätigt
Die Wetter-Folien wählen jetzt automatisch einen passenden Partikeleffekt anhand der echten
Vorhersage (Schnee → leichter Schneefall, Regen → Regen, klar → Sterne, bewölkt → Lichtpunkte,
sonst dezentes Glitzern). Ein Test deckt gezielt einen Grenzfall ab ("Schneeschauer" enthält auch
das Wort "schauer" – Schnee-Erkennung hat bewusst Vorrang vor Regen-Erkennung).

## Bereits vorhandene Bausteine wiederverwendet, nichts doppelt gebaut
- Preislisten-Tabellen: bestehender `tableObject`-Mechanismus wiederverwendet, auch für die neue
  Öffnungszeiten-Tabelle
- Programm-2025-Archiv: bereits vorhandenes, vollständiges Datenmodul (`werne-program-archive`)
  wiederverwendet, exakt gegen dein PDF geprüft (40 Programmpunkte, 10 Tage, stimmt überein)
- QR-Codes: mit der bereits im Projekt vorhandenen Bibliothek erzeugt (Stadt-Werne-Programmseite
  und Kontakt-E-Mail zander.klaus@web.de)

## Bewusst nicht behandelt (nächste Nachträge)
- Mitglied 18, echte Öffnungszeiten 2026, echtes Programm 2026, 3. Projekt 2026, weitere Projekte
  vergangener Jahre – wie besprochen als Platzhalter markiert, wird nachgetragen sobald du die
  Daten lieferst
- Küchenchef-Foto – noch offen, wartet auf deine Entscheidung (echtes Foto vs. reine Grafik)

## Prüfung
46 Tests grün. Zusätzlich live im echten Manager geladen und alle 23 Folien einzeln als
Bildschirmfoto geprüft (liegen bei), keine Konsolenfehler.
