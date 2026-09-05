# Prüfbericht Repair 58

## Begrenzter Änderungsumfang

- TV-Textobjekte: transparent, Glasrückwand oder farbig ausgefüllt; Farbe, Deckkraft und Glas-Weichzeichnung einstellbar.
- Die gleiche Flächendarstellung wird im USB-/TV-Player ausgewertet.
- Folientypen im TV-Dashboard werden über den zentralen deutschen Typkatalog beschriftet.
- Warengruppen-Formular und Tabelle erhalten kollisionssichere Mindestbreiten.
- Fehlende vorläufige Artikelfotos werden für bekannte Verkaufsartikel wieder ergänzt.
- Das Warengruppen-Kreisdiagramm besitzt eine farbige Legende.
- TV-Exportknöpfe sind kontrastreich blau statt weiß.
- Die Bestandsliste ergänzt fehlende Standardartikel, kann ausdrücklich gespeichert und nach Sicherheitsabfrage geleert werden. Beim Leeren bleibt der Artikelkatalog bestehen.

## Governance

- `tvContentObjectCore 0.29.58`, `salesInventoryAnalysisCore 0.1.1` und `managerSalesInventoryDashboard 0.1.1` sind im zentralen Manifest eingetragen.
- `tvContentObjectCore` ist zusätzlich in der Studio-/TÜV-Komponentenregistrierung und Laufzeitprüfung angemeldet.
- Status bleibt Candidate bis zur praktischen Sichtprüfung von Glaswirkung, Managerbreite und TV-Player.

## Verifikation

- JavaScript-Syntax aller geänderten Dateien: PASS.
- Automatisierte Tests: 37/37 PASS.
- Eigener Repair-58-Vertragstest prüft sämtliche beauftragten Punkte.
