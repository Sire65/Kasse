# PC-Manager V0.31.2.6 – Personenübernahme

Unter Stammdaten steht „Änderungen aus der Club-App“. Der neue Baustein liest ausschließlich freigegebene Meldungen über `kc_core_person_aenderungen_offen`. Alte und vorgeschlagene Werte werden nebeneinander angezeigt. Exakt geforderte bisherige Werte, einschließlich null, stammen aus den zentralen Tabellen.

Die bewusste Übernahme, Ablehnung mit Grund oder der begründete Abschluss eines Hinweises erfolgt ausschließlich über `kc_core_person_aenderung_uebernehmen`, Programm `KC_MANAGER`. Eine Mitgliedschaft erfordert ausdrückliche Bestätigung; die Datenbank prüft die Admin-Rechte. Festnetz bleibt gesperrt. Konflikte, Zukunftsdatum und anderweitige Erledigung gelten nicht als eigener Erfolg.

Eine unklare Antwort behält Vorgangsnummer und ursprünglichen Auftrag in der Sitzung. „Ergebnis erneut prüfen“ wiederholt genau diesen Auftrag, auch wenn die offene Meldung schon verschwunden ist. Eine andere Entscheidung ist bis zur Klärung gesperrt. Das Journal ist nach Organisation und Supabase-Benutzer getrennt. Es übersteht das Neuladen im selben Tab; nach vollständigem Schließen besteht derzeit keine dauerhafte lokale Wiederherstellung. Die Datenbank verhindert weiterhin doppelte Ausführung und meldet fremde/ältere Erledigung nicht als eigenen Erfolg.

Wichtig: Vertrag V1 aktualisiert zentrale Personendaten. Die bisherige doppelte Mitgliederliste und das statische Datenabbild werden damit noch nicht automatisch aktualisiert. Das wird in der Oberfläche ausdrücklich angezeigt. Keine direkte Tabellen-Schreiboperation und keine alte Status-Quittierung werden verwendet.

## Prüfung und Übergabe

Bestanden: `node tests/person-change-intake.cjs`, `node tests/person-change-intake-browser.cjs` (Playwright, installierter Chrome, 390px), Syntax und `git diff --check`. Geprüft: null-Vergleich, gleiche UUID nach Netzfehler, gesperrter Entscheidungswechsel, fremde Erledigung, ungültige Antwort, Festnetz-Sperre und mobile Navigation. Alle Antworten sind simuliert, keine echten Änderungen.

Code ist zur Prüfung vorbereitet, noch nicht produktiv ausgerollt. Claude: Nach aktualisierten Verwaltungs-PCs das Speicherprotokoll prüfen; `erzwingen` und Festnetz V2 erst gesondert freigeben. DP2 liegt inzwischen separat als Build 262 RC vor; die Club-App laut Abendübergabe noch bei Build 251. Die Übernahme des neueren DP2-Stands bleibt ein eigener Schritt.
