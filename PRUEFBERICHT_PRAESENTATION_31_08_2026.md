# Prüfbericht — Vorbereitung der Mitglieder-Präsentation

**31.08.2026 · KC MarktKasse Suite · V0.31.3.6**

Auftrag: konsolidieren, Tiefencheck, TÜV, Studio, Vorgaben und Regeln, und prüfen, ob für
Freitag alles Wichtige vorbereitet ist — ob Daten in Kasse und PC-Manager stecken, damit die
Auswertungen aussagekräftig sind.

Weil am Freitag die Mitglieder entscheiden, war das Prüfziel diesmal ein anderes als sonst:
nicht nur *rechnet es richtig*, sondern **sieht irgendeine Ansicht vor Publikum schlecht aus**.
Dafür wurde jede der 38 Ansichten einzeln geöffnet, fotografiert und maschinell durchsucht —
auf abgeschnittenen Text, Überlauf über den Rand, rote Meldungen, Platzhalter und
Fachjargon. Zusätzlich die volle Regression.

---

## Endstand

| | |
|---|---|
| Prüfläufe Kassensuite | **30 / 30 grün** |
| Generalprobe des Ablaufplans | **25 / 25 Schritte** wie angekündigt |
| Bereitschaftsprüfung (01.09.) | **39 / 39 Punkte** bestätigt |
| TÜV-Reihen | **206 / 206 grün** (Geld 39, Bedienung 59, Härte 21, Kette 33, Manager 33, QR 21) |
| Hintergrunddienst | **78 / 78 grün** |
| Ansichten sichtgeprüft | **38** |
| Offene Punkte für Freitag | **2** — beide in der Checkliste, beide sind Inhalt, nicht Technik |

---

## Was gefunden und behoben wurde

### A · Was die Vorführung selbst kaputtgemacht hätte

**1. Der Knopf „Vorführdaten" in der Kasse war kaputt — und hat es verschwiegen.**
Er meldete „1682 Vorführbuchungen geladen", danach standen in der Kasse **0 Buchungen** und
der Tagesabschluss zeigte 0,00 €. Zwei Fehler übereinander: geschrieben wurde nach
`localStorage`, gelesen wird seit der Umstellung aus IndexedDB — und `saveTransactions()`
speichert im Hintergrund, das direkt folgende `location.reload()` riss den Schreibvorgang ab.
Behoben: es wird über denselben Weg geschrieben wie bei einem echten Verkauf, und auf das
Ende des Schreibvorgangs wird gewartet.

**2. Ein Klick in die TV-Vorschau hat die Präsentation verändert.**
Der „Professional Guard" hing am Loslassen der Maus und rückte danach Objekte zurecht — und
speicherte. Es genügte also, **hineinzuklicken**. Nachgemessen an der ausgelieferten
Präsentation: die Laufschrift wanderte von y 94 auf 91 und von w 92 auf 90, die Symbole von
x 90 auf 89 — auf allen 28 Folien, zusammen **56 Objekte**. Zweitens wurden dabei auch
Platzhalter verschoben, die auf der Folie gar nicht eingeschaltet sind.
Behoben: korrigiert wird nur nach einer echten Bewegung (mehr als 3 Punkte) und nur an
Objekten, die auf dieser Folie wirklich zu sehen sind. Neuer Dauertest
`tests/praesentation-schutz.test.cjs` (13 Prüfungen) hält beides fest.

**3. Der TV-Bildschirm war leer.** „Folien: 0", weil das mitgelieferte Designer-Projekt nie
geladen wurde. Jetzt holt der Manager es nach, wenn nichts eingerichtet ist: **46 Folien,
8:01 Min.**

### B · Zahlen, die nicht zusammengepasst hätten

**4. Bonsummen und Positionssummen gingen um 24.418 € auseinander.**
Die Kasse rechnet den Pfand automatisch auf den Bon; die Vorführdaten hatten den Aufschlag in
`total` übernommen, aber **keine Pfandzeile** dafür geschrieben. Die Auswertungen rechnen mit
Positionen, der Kassenabschluss mit Bonsummen — beides stand also unterschiedlich im Raum.

```
vorher    Kasse:   Bons 28.375,00 €   Positionen 21.905,00 €   Lücke  6.470,00 €
          Manager: Bons 107.750,00 €  Positionen  83.332,00 €   Lücke 24.418,00 €
nachher   beide Datensätze: Bonsummen = Positionssummen, 0 ungeklärte Bons
```
Nachgetragen wurden 8.466 Pfandzeilen nach genau der Regel, die die Kasse selbst anwendet
(2,00 € Glaspfand je Getränk im Glas, zusätzlich 2,00 € Feuerzangenpfand). Werkzeug:
`pc-manager/vorfuehrung/erzeuge-pfandzeilen.cjs`, mit Selbstprobe.

**5. „Pfandrückgaben" zählte ausgegebene Gläser statt zurückgenommener.**
Gezählt wurde jede Zeile mit „Pfand" *oder* „Rückgabe" im Namen — also auch der berechnete
Pfand. Mit den vollständigen Daten hätte dort **6.708** gestanden, obwohl kein einziges Glas
zurückkam. Jetzt zählen nur noch Auszahlungen (negativer Betrag).

**6. „Glaspfand" stand als Top-Artikel Nummer eins** mit 19.996 € über allen Speisen und
Getränken. Richtig gerechnet, als Aussage falsch: verkauft wurde Glühwein, das Glas ist
geliehen. Pfand zählt jetzt nicht mehr als Artikel-Umsatz. Neue Spitze: Eierlikörpunsch.

**7. Der grösste Balken war der einzige unlesbare.** Der Betrag wurde starr hinter das
Balkenende geschrieben; beim längsten Balken lief er über den Rand („65.746,!"). Jetzt passt
er sich an.

**8. Die Vorführdaten lagen nur auf einer Kasse**, ohne Trinkgeld, ohne Tagesabschlüsse — im
Kopf stand „Kassen: 2", in der Auswertung „aktive Kassen: 1". Nachgerüstet, alle Summen aus
den Bons gerechnet: 6.395 Bons auf 2 Kassen, 12 Markttage, 815 Trinkgelder (382,60 €),
24 Tagesabschlüsse, 24 Bargeldbewegungen.

### C · Was schlicht schlecht ausgesehen hätte

**9. Das Vereinswappen war ein weisser Kasten.** In der Kopfzeile der Kasse lag
`filter:brightness(0) invert(1)` auf dem Logo — ein Kniff, der nur bei durchsichtigem
Hintergrund funktioniert. Das Wappen ist ein volles Rechteck: brightness(0) macht alles
schwarz, invert(1) macht daraus weiss. Übrig blieb ein weisses Feld an der Stelle, die man
zuerst ansieht.

**10. Im Menü stand ein Block unlesbarer Buchstaben.** Ein „Schnellzugriff" beschriftete
15 Knöpfe mit dem *ersten Buchstaben* des Menüpunkts: `▦ W A H A / K M K G S / T B P V G` —
mehrdeutig (drei K, zwei A, zwei G) und ohne Nutzen, weil dieselben Ziele direkt darunter
ausgeschrieben stehen. Entfernt.

**11. Auf dem Artikel-Etikett stand „Allergene: [object Object]".** Das Feld gibt es in zwei
Formen — als Text („Enthält Sulfite") und als Aufstellung der 14 Pflichtallergene. Das
Informationsfenster der Kasse konnte beide, Etikett und Artikelliste nicht. Auf einem
gedruckten Etikett ist das nicht nur peinlich, es ist eine fehlende Pflichtangabe. Eine
gemeinsame Stelle für Kasse und Manager: `shared/kc-allergene.js`.

**12. Drei leere Kästen mit „Platzhalterbild – Originalfoto folgt".** Die Bilder für
Feuerzange und Komplettrückgabe fehlten im Manager ganz und zeigten in der Kasse einen
gestrichelten Kasten mit „FOTO FEUERZANGE FOLGT". Ersetzt durch fertige Zeichnungen. Der
Artikel **Wertmarke (5,00 €)** benutzte dabei das Bild der Pfandrückgabe — mit dem Preis
**4,00 € fest im Bild**. Er hat jetzt ein eigenes.

**13. Artikelnamen liefen über die Nachbarspalte**: „FeuerzangenbowleGetränke",
„Glas + FeuerzangePfRückgabe". Ursache war nicht die Breite: das Modul, das Tabellen mit
Sortierknöpfen nachrüstet, setzt `table-layout:fixed` — dabei wird die Mindestbreite
ignoriert, der Kopftext bekommt neben zwei Knöpfen 36 px („Art…", „Gr…"), und die Zellen
malen ihren Text über den Nachbarn. Für die Artikelliste aufgehoben, plus Sicherheitsnetz
für alle nachgerüsteten Tabellen.

**14. „zzgl. Pfand automatis"** — mitten im Wort abgeschnitten. Kurzform auf der Kachel, der
volle Text als Tooltip.

**15. Im Kopf des Managers stand „BLOCKED"**, ein verirrtes TÜV-Abzeichen mitten in der
Ansicht, und fünf Knöpfe waren weiss auf weiss. Alle drei behoben.

**16. Zwei Fehlalarme im TÜV.** „Keine aktive Masterfolie" wurde **zweimal und ohne
Bedingung** gemeldet, also auch bei aktivem Master; „Zielauflösung fehlt" erschien, obwohl
1920×1080 eingestellt war (geprüft wurde nur eine von drei möglichen Schreibweisen).
Ausserdem prüfte der TÜV **ein anderes Projekt als der TV-Bereich zeigt** — auf einem
Rechner, auf dem das Studio noch nie geöffnet wurde, meldete er „Keine Folien" und stand auf
*nicht freigabefähig*. Genau der wahrscheinliche Zustand des Vorführrechners.

### D · Das Studio

**17. Fremder Produktname.** Oben links stand „Framework Studio 3.x · Visual Designer V0.28.2
Candidate". Wer in der Vorführung „Präsentation bearbeiten" anklickt, landet in einem fremd
benannten Programm. Jetzt: **KC MarktKasse · TV-Studio**.

**18. Die Folie passte nicht ins Bild.** Die Arbeitsfläche startete auf 100 % Zoom bei einer
Folie von 1920×1080 in einem 1100 px breiten Bereich — sichtbar war „Herzlich willkom". Jetzt
wird beim Öffnen eingepasst, und es gibt dafür einen Knopf **Einpassen**.

### E · Abgleich mit den Pflichtenheften

**19. Der Rezeptur-Editor löschte Daten beim Tippen.** Jede Zutatenzeile wurde aus nur sieben
Feldern **neu** aufgebaut — Einkaufspreis, Lieferant, Artikelbezug, Allergene und Notizen
fielen dabei weg. Und weil das am `input`-Ereignis hängt, passierte es bei **jedem
Tastendruck**, lautlos. Nachgestellt: `unitCost 7,50 → null`, `supplierId "L-1" → ""`,
Notiz → leer, Allergene → leer.

**20. Die Uhrtaste war immer sichtbar**, auch auf einer Kasse ohne jede Zeiterfassungs-
Konfiguration — und öffnete ein Fenster ohne eine einzige hinterlegte Person. Ursache: neben
der Freigabe aus dem Manager liess die Bedingung auch das Erprobungskennzeichen gelten.

**21. Die Zeiterfassung schlug eine Uhrzeit vor, die noch nicht war.** Vorgeschlagen wurde
die auf die volle halbe Stunde **gerundete** Zeit: wer um 10:50 scannte, bekam „KOMMEN um
11:00 buchen" — bis zu 15 Minuten in der Zukunft. Wer die Uhr im Raum sieht, merkt das sofort.
Jetzt die erfasste Uhrzeit; verstellen bleibt möglich.

**22. Die Grenze zum Dienstplan kannte das neue Exportformat nicht.** Sie rechnete mit
`actual.hours`; der Export liefert seit der Erweiterung `date/start/end/breakMinutes/status`.
Ergebnis wäre **NaN** in der Abweichungsspalte gewesen. Jetzt werden die Stunden aus Kommen
und Gehen gerechnet (inklusive Tageswechsel nach Mitternacht und Pausenabzug), und
unvollständige Buchungen bekommen **keine** erfundene Abweichung, sondern die Kennzeichnung
„nachzuarbeiten" — genau dafür sind sie im Export.

---

---

## Nachtrag: die Generalprobe (danach gefunden)

Zum Schluss wurde der Ablaufplan aus der Checkliste **Schritt für Schritt mit echten Klicks
durchgespielt** — nicht „funktioniert die Funktion", sondern: kommt bei jedem Schritt auch das
heraus, was Hans dem Raum ankündigt? `tests/tuev/generalprobe.cjs`, 25 Prüfpunkte, jeder mit
Foto. Dabei fielen drei Dinge auf, die keine der vorherigen Prüfungen gefunden hatte — weil
sie erst in dieser Reihenfolge sichtbar werden.

**23. Der Trainingsmodus sah eine Weile aus wie der Normalbetrieb.**
`body.training-mode` wurde ausschliesslich in `renderWorkspaceModePanel()` gesetzt, und diese
Funktion läuft nur aus `renderDiscountSummary()` heraus — also erst beim nächsten Neuzeichnen
des Bons. Wer den Trainingsmodus bei **leerem Bon** einschaltete (und genau so macht man es
in einer Vorführung), bekam nicht die andersfarbige Kopfzeile und nicht die blaue
Arbeitsfläche. Die Signale kamen erst, sobald jemand einen Artikel antippte. Am Stand ist das
die falsche Reihenfolge: erst sieht man es, dann bucht man. Jetzt setzt `applyModes()` die
Anzeige sofort.

**24. Und danach war die Kopfzeile im Trainingsmodus unlesbar.**
Erst nachdem 23 behoben war, wurde sichtbar, was dahinter lag: `body.training-mode .app-header`
stand auf `background:inherit`. Die Kopfzeile hat aber **weisse** Schrift — „inherit" holte den
hellen Seitenhintergrund herauf, und damit standen Vereinsname, Kassenname, Version, Uhrzeit
und Kassenstatus weiss auf fast weiss. Praktisch unsichtbar, ausgerechnet in dem Modus, in dem
geübt wird. Jetzt ein eigener dunkler Braunton: lesbar, und auf den ersten Blick als „nicht
Normalbetrieb" erkennbar.

**25. Die Ansicht „Kassenabschluss" war immer leer.**
`renderClosings()` wurde **nur** aufgerufen, wenn gerade ein Code eingelesen wurde — nicht beim
Programmstart und nicht beim Öffnen der Ansicht. Gemessen: 24 Tagesabschlüsse im Speicher,
0 Zeilen in der Tabelle, nicht einmal der Hinweis „Keine offenen Abschlüsse". Wer am Morgen
nach dem Markttag nachsehen wollte, sah eine leere Seite. Das betrifft nicht nur die
Vorführdaten, sondern jeden echten Abschluss. Jetzt zeigt die Ansicht alle 24 Abschlüsse mit
Soll-Bestand je Tag und Kasse.

**Ausserdem:** die Freigabe stand auf *nicht freigabefähig*, weil meine eigenen zwei
Versionssprünge (TV-Layout-Guard 1.3.0, Dienstplan-Schnittstelle 0.2.0) nicht im Manifest
nachgezogen waren — derselbe Fehler wie schon einmal in diesem Projekt. Nachgezogen.

**Der Hinweis „· Prüfhinweise" in der Kopfzeile hat jetzt einen Weg.**
Er kommt von der Freigabebedingung „praktische Sichtprüfung am Zielgerät" — und die kann ich
nicht abhaken: mein Browser läuft in einem Rechenzentrum, nicht an dem Beamer, der Freitag im
Raum steht. Ihn einfach auf „bestanden" zu setzen wäre wieder eine Statusanzeige, die etwas
behauptet, das niemand geprüft hat. Stattdessen gibt es unter *Vorführdaten* eine Karte mit
den vier Schritten des Rundlaufs und einen Knopf, der ihn mit Namen, Datum und
Bildschirmgrösse festhält. Danach steht in der Kopfzeile nur noch
„KC MarktKasse · V0.31.3.6 Repair 63". Ein Klick auf den Hinweis führt direkt zu der Karte.

---

## Nachtrag 2 (01.09.2026): die vier Punkte einzeln nachgemessen

Auf die Frage „ist jetzt alles bereit?" wurde jede der vier Behauptungen einzeln geprüft
statt bestätigt — `tests/tuev/bereitschaft.cjs`, 39 Messpunkte:
Grafiken, alle 36 Ansichten, Money Butler im Manager **und** als eigenständiges Programm,
und **beide** Kassen (KASSE-01 und KASSE-02, jeweils Warengruppen, Artikel, Preise, Bilder,
und ein echter Verkauf). Money Butler: sauber, rechnet, keine Skriptfehler, nichts läuft über
den Rand. Beide Kassen: 6 Kacheln, jede mit Preis, kein fehlendes Bild, Verkauf landet mit
7,50 € im Bon. Dabei kamen noch vier Dinge heraus:

**26. Dieselbe Grafik zeigte auf zwei Reitern verschiedene Zahlen.**
„Umsatzanteil Warengruppen" stand auf der *Übersicht* mit **Pfand 23 % / Sonstiges 3 %**, auf
dem Reiter *Umsatz- und Kundenanalyse* mit **Sonstiges 26 %** — der Pfand fehlte dort ganz.
Ursache: der PC-Manager sucht den Artikel über Nummer **oder** Name, der Auswertungskern nur
über die Nummer. Die Pfandartikel heissen `glasplus`/`zangeplus`, meine nachgetragenen Zeilen
trugen `glaspfand`/`feuerzangenpfand` — der Kern fand sie nicht und buchte alles unter
„Sonstiges". Beides behoben: der Kern sucht jetzt wie der Manager, und die Vorführdaten tragen
die echten Artikelnummern. Beide Reiter zeigen jetzt **Getränke 50 % · Speisen 24 % ·
Pfand 23 % · Sonstiges 3 %**.

**27. „Glaspfand" war auch auf dem zweiten Reiter der Top-Artikel.** Dieselbe Korrektur wie auf
der Übersicht — Pfand ist kein Verkauf. Neue Spitze auch dort: Eierlikörpunsch, 13.910,00 €.
Und derselbe abgeschnittene Balkenwert („19.996,00" ohne Euro-Zeichen) wie zuvor.

**28. Drei Stellen nannten das Programm „Testphase".**
Money Butler, PC-Manager und Kasse trugen jeweils einen Hinweis, der mit **„Testphase:"**
begann. Der Inhalt ist nützlich (welches Werkzeug wofür), das Wort nicht: die Mitglieder
entscheiden gerade, ob sie das Programm einsetzen, und es bezeichnet sich selbst als
unfertig. Jetzt „So ist es gedacht:", Inhalt unverändert.

**29. In der Fensterleiste stand Entwicklersprache.**
Der Titel der Kasse lautete „KC Bildrechner V0.31.3.6 Repair 12 – POS-UI Candidate", der des
Managers wurde zur Laufzeit auf „… Repair 63 · Symbol- und Aktivierungscode-Parität
Candidate" gesetzt. Das steht die ganze Vorführung lang in der Browserleiste auf der Leinwand.
Jetzt: **KC MarktKasse · Kasse**, **KC MarktKasse · PC-Manager · V0.31.3.6 Repair 63**,
**KC MarktKasse · Money Butler**.

---

## Bewusst nicht geändert

**„♻ PFANDRÜCKGABE" steht eng an beiden Rändern.** Der Text braucht 143 px in einem 140 px
breiten Feld. Durchgerechnet: Innenrand auf 0 reicht nicht; die Spalte verbreitern hiesse,
BAR KASSIEREN schmaler machen und brächte nur 145 px; die Schrift müsste auf 11,9 px herunter,
das ist am Stand zu klein; die Beschriftung kürzen ginge, ändert aber einen eingeführten
Begriff. Auf dem Bild ist **nichts abgeschnitten** — die fehlenden 3 px sind der Nachraum
hinter dem letzten Buchstaben. Eine Änderung wäre hier schlechter als der Zustand.

## Was offen bleibt und in der Checkliste steht

1. **Folie 2 der TV-Präsentation** heisst „Öffnungszeiten (Platzhalter – Termine 2026 folgen)".
   Die echten Termine kenne ich nicht — deshalb steht dort nichts Erfundenes. Vor Freitag
   eintragen oder die Folie ausblenden.
2. **Die zwei Release-Manifeste widersprechen sich** (27 gegen 63 Komponenten). Technisch
   stabil, keine Sperre, aber die Zusage „eine Versionsquelle" trägt so nicht. Reine
   Aufräumarbeit — nach Freitag.
