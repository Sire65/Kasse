# Repair 24 · Texteingabe, Objektmenü und Pixelanzeige

- Automatische Vollspeicherung wartet nun 2000 ms auf eine Schreibpause statt 450 ms.
- Die sichtbare Textvorschau wird über `requestAnimationFrame` gebündelt; Folienliste und Verlauf werden nicht pro Buchstabe aufgebaut.
- Beim Verlassen des Textfeldes oder mit Strg+S wird weiterhin sicher gespeichert.
- Rechtsklickmenü für auswählbare Folienobjekte: Bearbeiten, Kopieren, Einfügen/Ersetzen, nach vorne/hinten, mittig ausrichten und löschen.
- Entf-Taste und vorhandener Löschen-Knopf verwenden denselben allgemeinen Löschweg.
- `objectVisibility` wird für alle gerenderten Objektarten ausgewertet, nicht nur für die Laufschrift.
- Die Pixelanzeige der Navigation liegt jetzt außerhalb des abgeschnittenen Seitenleistencontainers und ist beim Ziehen sichtbar.
- Bestehende Folieninhalte werden nicht automatisch gelöscht oder migriert.
