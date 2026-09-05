# Prüfbericht Repair 48 – TableCore im PC-Manager

## Auftrag

Der in Framework Studio V1.38.39 registrierte TableCore V1.1.0 wurde als
zentraler, produktneutraler Kern übernommen und über einen einzigen Adapter an
die fachlichen Tabellen des PC-Managers angebunden.

## Umgesetzt

- Tabellen mit Kopf- und Datenbereich werden automatisch erkannt.
- Spalten können auf- und absteigend sortiert werden.
- Ein dritter Klick stellt die ursprüngliche Reihenfolge wieder her.
- Spalten können mit Maus oder Touch am Anfasser verschoben werden.
- `Alt` + Pfeiltaste verschiebt die fokussierte Spalte per Tastatur.
- Spaltenbreiten können gezogen werden.
- Doppelklick am Spaltenrand führt Auto-Fit aus.
- Sortierung, Reihenfolge und Breiten werden je Tabelle lokal gespeichert.
- Auch später dynamisch erzeugte Tabellen werden angebunden.
- Nach einem erneuten Befüllen wird eine gespeicherte Sortierung wieder angewandt.

## Schutz und Abgrenzung

- Fachliche Tabellenwerte werden nicht in den TableCore kopiert oder verändert.
- TV-Vorschau, Präsentationsbühne, Dashboard-Vorschau, TV-Tabellenobjekte und
  QR-Ausgaben sind ausdrücklich ausgeschlossen.
- Navigation, TV-Renderer, Folienverwaltung, Wetter, Zeiterfassung-, Rezeptur-
  und Kassenfachlogik wurden nicht verändert.

## Studio und TÜV

- Studio-Katalogeintrag für `tableCore` V1.1.0 vorhanden.
- TÜV-Regeln TC-001 bis TC-005 vorhanden.
- Zentraler Release-Manifest-Eintrag für `tableCore` und `managerTableCore`.
- Runtime-Relay und Studio-/TÜV-Komponentenregistry ergänzt.
- Überwachter Arbeitsauftrag: `WO-KC-20260724-002`.

## Automatische Verifikation

- JavaScript-Syntax: bestanden.
- JSON-Syntax: bestanden.
- Neuer TableCore-Kern-/Integrationscheck: bestanden.
- Gesamtsuite: 26 von 26 Testdateien bestanden.
- Bestehende TV-, Kassen-, Navigation-, Rezept- und Zeiterfassungstests: grün.

## Offene praktische Nachweise

Die Browser-Verbindung der Testumgebung konnte nicht gestartet werden.
Desktop-Maus, Touch/Tablet, Mobilansicht und die visuelle Kontrolle bleiben
deshalb als praktische Nachweise offen. Der Stand ist Candidate/Gelb, nicht Gold.
