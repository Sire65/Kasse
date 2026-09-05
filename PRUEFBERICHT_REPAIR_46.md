# Prüfbericht Repair 46 – Laufzeitkonsolidierung

## Nachgewiesene Ursachen

1. Mehrere ältere Erweiterungen bearbeiten dieselbe Renderfunktion nacheinander.
   Die abschließende Schrift- und Skalierungsregel war dadurch nicht verbindlich.
2. Der Präsentations-TÜV wurde nach jedem Speichern und zusätzlich alle 15 Sekunden
   vollständig ausgeführt. Bei Texteingabe führte das zu spürbaren Blockaden.
3. Die alte Effektoberfläche wurde mit den Legacy-Editoren deaktiviert. Der bereits
   vorhandene stabile Ersatz war in `index.html` nicht geladen.
4. MessageCore und NotificationCore waren vorhanden, im PC-Manager jedoch nicht
   als durchgängige Benutzerrückmeldung integriert.

## Konsolidierung

- Eine letzte, registrierte Renderinstanz setzt für Bau- und Präsentationsmonitor
  verbindlich dieselbe Folienbreite, `cqw`-Typografie und `--tv-scale:1`.
- Der TÜV läuft manuell, nach Sichtbarkeitswechseln und entprellt 2,5 Sekunden nach
  dem letzten Speichern. Die periodische 15-Sekunden-Vollprüfung wurde entfernt.
- Sondereffekte sind im Folieninspektor wieder verfügbar: Schnee, Glitzer,
  Goldstaub, Sternenregen, fallende Sterne, Lichtpunkte, Glitzerwelle und
  Sternschnuppen; Tempo, Dichte, Größe und Deckkraft sind steuerbar.
- Das zentrale Manager-Meldungswesen zeigt Erfolg, Information, Warnung und Fehler
  ohne blockierende Alert-Fenster. Löschaktionen verlangen eine Bestätigung.
- Neue Laufzeitkomponenten sind im zentralen Manifest, Studio-/TÜV-Register und
  Release-Relay eingetragen.

## Status

Candidate. Automatische Prüfungen bestanden; praktische Bedien- und TV-Sichtprüfung
bleibt vor Gold verpflichtend.
