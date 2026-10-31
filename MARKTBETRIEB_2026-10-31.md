# Einsatzprüfung Bilderrechner und Schulung – 31.10.2026

Ausgangspunkt: GitHub main `62b0a56` einschließlich Händlerausweis-Erweiterung #20.
Frontend-Build: `0.31.3.6-r68-marktbetrieb`.

## Für die Bedienung

- Start-PIN einmal pro Markttag und Browser-Tab. Neuladen im selben Tab erhält die
  Freigabe. Ein neuer Tab, ein anderer Tag oder eine geänderte PIN fragt erneut.
  Keine Inaktivitätssperre mit erneuter PIN. Die PIN selbst wird nicht gespeichert.
- Normale leere Kasse dunkelt nach fünf Minuten ab. Antippen weckt sie ohne PIN;
  der Aufweck-Tipp darf keinen dahinterliegenden Bezahlknopf auslösen.
- Offene Bons, laufende Buchungen, vorgemerkte Händlerausweise und offene Dialoge
  werden nicht automatisch verdeckt.
- Stoßzeitenmodus verhindert jede kasseneigene Abdunklung, auch per Dunkeltaste.
  Auf unterstützten sichtbaren HTTPS-Seiten fordert die Kasse zusätzlich eine
  Bildschirmsperre gegen Geräteschlaf an. Browser, Betriebssystem und Energiesparmodus
  können diese Anfrage ablehnen; eine OS-Sperre ist damit nicht für jedes Tablet garantiert.
- Erfolgreiche Verkäufe, Personal-, Helfer- und Kontobuchungen zeigen eine kurze
  Statuszeile statt eines vier Sekunden blockierenden Fensters. Notwendige Fehler,
  Auszahlungshinweise und bewusste Storno-/Spendenentscheidungen bleiben sichtbar.
- Nicht funktionsfähiger EC-Platzhalter ausgeblendet. Keine optionale Bon-Rückfrage
  in Stoßzeiten; eine ausdrücklich eingestellte automatische Druckausgabe bleibt erhalten.
- Gesunde Startprüfung verschwindet nach kurzer Anzeige. Bei fehlender Speicherung
  steht „Erneut prüfen“ statt eines wirkungslosen „Trotzdem fortfahren“.
- Normale Stammdaten-Neustarts warten bei offenen Bons und in Stoßzeiten.
  Explizite Fernsperren für verlorene Geräte bleiben unverändert wirksam.

## Speicherung

Ein Verkauf wird erst freigegeben, wenn sein lokaler IndexedDB-Schreibvorgang
bestätigt wurde. Auf das Netzwerk wird dabei nicht gewartet. Ein verbindlicher
Verkaufsschreibvorgang wird nicht von einem Hintergrundauftrag übersprungen.
Bei Speicherfehler bleibt der Warenkorb erhalten, ohne fälschlich als gebucht zu gelten.
Doppelte BAR-Tipps sowie weitere Artikel während des Schreibens sind gesperrt.
Nach einem Neustart wird ein veralteter Bonzähler aus den vorhandenen Bons korrigiert.

## Nachweise

- `tests/marktbetrieb.test.cjs`: 37 Prüfungen, einschließlich echter PIN-Oberfläche,
  simulierten fünf/zehn Minuten Ruhezeit, Tageswechsel, Fernneustart, Speicherfehler,
  Doppeltipp, Hintergrund-Schreibkonflikt und Wiederanlauf. Beide Kassenoberflächen.
- Je 50 aufeinanderfolgende Verkäufe zusätzlich zu Fehler-/Wiederholungsfällen:
  alle 53 Bons danach in Arbeitsspeicher und IndexedDB, auch nach Neuladen.
  Lokaler Chrome-Lauf: etwa 3,5–3,8 Sekunden für 50 Verkäufe. Keine Aussage über
  die Geschwindigkeit eines anderen Tablets oder über Netzwerkverfügbarkeit.
- Händlerausweis-Regression: 61 Prüfungen erfolgreich.
- Bisherige Scanner-Wege: 35 Prüfungen erfolgreich.
- PIN-Bedienung mit Tablet-Abmessungen: 14 Prüfungen erfolgreich.
- WLAN-Test: 16 Prüfungen im ungesicherten HTTP-Kontext einschließlich SHA-256-Rückfall und tatsächlicher Buchung.
- GitHub-Workflow `Kassen-Marktbetrieb` führt die zentralen Prüfungen künftig automatisch aus.

Die Tests ersetzen Antworten der Cloud und prüfen lokal gespeicherte Bons. Sie schreiben
keine echten Umsätze in die Vereinsdatenbank. Ein Probelauf mit dem tatsächlichen Tablet,
Scanner, WLAN und Drucker am Stand bleibt Teil der Abnahme. Die bestehende Offline-Startkarte
für eingerichtete verschlüsselte Geräte und geschützte Verwaltungsfunktionen bleiben bestehen.

Technische Grundlage zur optionalen Geräte-Wachhaltung:
https://www.w3.org/TR/screen-wake-lock/
