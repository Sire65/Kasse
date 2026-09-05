# Changelog – Repair 15 flüssige Texteingabe

- Texteingaben im rechten Eigenschaftenbereich werden während des Tippens nur im aktuellen Folienobjekt und im Arbeitsspeicher aktualisiert.
- Vollständiges Speichern und Neuaufbau der Miniaturansichten erfolgen nicht mehr nach jedem Buchstaben.
- Automatisches Speichern erfolgt 450 Millisekunden nach der letzten Eingabe.
- Beim Verlassen des Textfeldes wird sofort gespeichert und genau eine Miniaturansicht aktualisiert.
- `Strg+S` beziehungsweise `Cmd+S` speichert den aktuellen Textentwurf sofort.
- Nicht gespeicherte Texte werden vor dem Schließen des Fensters abschließend übernommen.
- Die vorhandenen Resize-Griffe bleiben beim Tippen erhalten; der Textknoten wird aktualisiert, ohne das Objekt neu aufzubauen.
- Die schwere Verlaufserfassung wird während der einzelnen Tastendrücke nicht mehr ausgelöst.
