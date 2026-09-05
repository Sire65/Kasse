# Prüfbericht Repair 44 – Editor-Laufzeit und Testzugang

## Behobene Ursachen

1. Die aktuelle Mini-Folienliste besaß keine Drag-and-drop-Sortierung mehr.
2. Zwei ältere Del-Handler reagierten gleichzeitig und verwendeten verschiedene
   Löschmodelle.
3. Der Unified Editor durfte den Objektinspektor während aktiver Texteingabe neu
   aufbauen; zusätzlich wurden Vorschaubilder zu häufig aktualisiert.
4. Der Siebenfachklick führte zwar zum Servicedialog, der dortige
   Candidate-Entwicklerzugang war jedoch hart deaktiviert.
5. Für eine lokale Zeiterfassungsprobe existierte noch keine Testperson.

## Reparatur

- Folienkarten sind wieder per Maus-Drag sortierbar; eine grüne Einfügelinie zeigt
  die Zielposition. Die aktive Folie und Nummerierung folgen der neuen Reihenfolge.
- Ein früher, zentraler Del-Handler entfernt das aktuell markierte Objekt über den
  bestehenden Objekt-Kontextkern und stoppt konkurrierende Alt-Handler.
- Eingabefokus sperrt einen Neuaufbau des Objektinspektors. Miniaturansichten werden
  erst beim Abschluss von Ziehen oder Textbearbeitung erneuert.
- Sieben Klicks sind innerhalb von vier Sekunden möglich und aktivieren ausschließlich
  im Candidate den deutlich protokollierten Entwicklerzugang.
- Die Uhrtaste ist im Candidate sichtbar. Wenn noch niemand übertragen wurde, kann
  lokal ein Testname mit einem selbst gewählten TTMMJJ-Testcode angelegt werden.

## Sicherheitsgrenze

`candidateTestAccess` ist ein expliziter Runtime-Schalter. Vor Leading/Gold muss er
auf `false` gesetzt und der Testzugang erneut geprüft werden. Produktive Mitglieder
kommen weiterhin nur über das Manager-Kassenpaket.
