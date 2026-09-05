# TÜV-Durchgang KC MarktKasse Suite — 31.08.2026

Konsolidierung, Regression und 60 Prüfreihen mit externen Werkzeugen.

**Werkzeuge:** Playwright (echter Browser, echte Klicks), jsQR (echtes QR-Lesegerät),
node:sqlite (echte Datenbank), der echte Manager-Dienst, der echte DP3-Importer.
Es wurde nichts nachgebaut oder simuliert.

---

## Ergebnis in einem Satz

**317 Prüfungen, alle bestanden.** Fünf echte Fehler gefunden und behoben, davon einer mit
Geldbezug. Die Frontend-Suite ist erstmals vollständig grün.

| Bereich | Vorher | Nachher |
|---|---|---|
| Frontend-Suite | 26 grün / 29 rot | **28 grün / 0 rot** |
| Backend-Suite | 78 + 4 grün | **78 + 5 grün** |
| TÜV-Prüfreihen | — | **206 Prüfungen, alle grün** |

---

## Die fünf Befunde

### 1. Das Belegarchiv war fälschbar — der einzige Befund mit Geldbezug

**Gefunden:** Dem Manager-Dienst wurde ein Übergabebeleg untergeschoben, bei dem nur die
Summe von 300 € auf 3.000 € geändert war. Der Dienst nahm ihn an (`ok:true`) und
**überschrieb damit den echten Eintrag im Archiv**. Danach stand dort 3.000 €.

**Ursache:** Jeder Beleg trägt eine Prüfsumme, die genau das verhindern soll. Der Dienst hat
sie nie nachgerechnet — er prüfte nur, ob „KC_UEBERGABE_PROTOKOLL" draufsteht und eine
Belegnummer da ist. Über `ON CONFLICT ... DO UPDATE` wurde der vorhandene Eintrag ersetzt.

**Warum das zählt:** Das Archiv ist der Nachweis darüber, wer wann wieviel Geld übergeben hat.

**Behoben** in `manager-companion/index.js`: ohne gültige Prüfsumme kommt nichts ins Archiv,
und ein abgelegter Beleg lässt sich nicht durch einen inhaltlich anderen mit derselben
Belegnummer ersetzen. Dieselbe Meldung zweimal bleibt erlaubt — Money Butler und das
Nachtragen vom Papier melden ja denselben Beleg.

**Nachweis:** `tests/uebergabeprotokoll.test.cjs` (neuer Fall) und `reihe-kette`, Reihe 38b.
Der alte Test arbeitete mit `pruef: 'egal-hier'` — einer Fantasie-Prüfsumme, die nur
durchging, weil niemand sie prüfte. Er ist nachgezogen.

### 2. Artikelkacheln überlappten sich — man tippt auf einen Artikel und verkauft einen anderen

**Gemessen bei 1280×800:** Rasterzeilen 78 px, Kacheln 126 px. Die zweite Reihe lag **38 px
über** der ersten. Hochkant (800×1280) dasselbe mit 15 px.

**Bei 1024×600 zusätzlich:** keine einzige Kachel passte noch ganz ins Bild (Fläche 80 px),
die Blätterleiste lag über den Kacheln, und die rechte Knopfspalte (Pfandrückgabe, Trinkgeld,
Reklamation, Auf Konto, Mehr) stand **56 px über den Bildschirmrand hinaus** — die Knöpfe
waren nur zum Teil erreichbar.

**Ursache:** dieselbe wie schon bei den Stoßzeiten — feste Größen im Kassenlayout. Die Kachel
konnte nicht mitschrumpfen, wenn ihre Zeile kleiner wurde.

**Behoben** in `pos/styles.css`. Gegengeprüft auf **zehn Bildschirmgrößen** (1920×1080 bis
800×1280 hochkant) in **beiden Ansichten**: keine Überlappung, keine Kachel außerhalb der
Fläche, kein waagerechtes Scrollen.

Ein erster Lösungsversuch (`minmax(min-content,1fr)`) ist im CSS dokumentiert und **verworfen**:
er beseitigte die Überlappung, machte aber auf 1920×1080 die Kacheln riesig und schob die
letzte aus dem Bild — eine Verschlechterung genau für die Größe am Stand.

Als Nebenwirkung deckte der Test auf, dass der 50 px große Varianten-Knopf „+" auf
verkleinerten Kacheln fast die Mitte abdeckte. Er schrumpft jetzt mit.

### 3. QR-Codes mit Umlauten waren unlesbar

**Gemessen mit jsQR:** „Köcheclub" als QR-Code erzeugt, zurückgelesen — **leerer Text**.

**Ursache:** Die QR-Bibliothek schneidet jedes Zeichen auf ein Byte zurück (`c & 0xff`). Ein
„ö" landet als Byte 0xF6 im Code; das ist kein gültiges UTF-8, und jedes Lesegerät scheitert
daran. Der Code sah dabei tadellos aus.

**Betroffen** war jeder Code mit deutschem Klartext. Die Geld- und Belegcodes selbst sind
Base64 und damit umlautfrei — sie waren nie betroffen.

**Behoben** in `shared/kc-qr.js`: der Text wird vorher in einzelne UTF-8-Bytes zerlegt.

### 4. Die Modusanzeige in der Kopfzeile war eine tote Beschriftung

`#modeStatus` stand als fester Text „Normalbetrieb" im HTML und wurde von **keiner Codestelle
je geändert**. Auch im Trainingsmodus und in Stoßzeiten stand dort weiter „Normalbetrieb".

Im Trainingsmodus zählt kein echter Umsatz. Wer im Betrieb kurz auf die Kopfzeile schaut,
bekam also die falsche Auskunft darüber, ob gerade echt gebucht wird.

**Behoben** in `pos/app.js` (`applyModes`): die Anzeige nennt jetzt „Trainingsmodus aktiv"
bzw. „Stoßzeiten aktiv", ist im Trainingsmodus gelb hinterlegt und erklärt sich im Tooltip.

### 5. Eine Zeile im PC-Manager lief über den Bildschirmrand

Die Bearbeitungszeile unter „Kassenoberfläche" hat neun feste Mindestbreiten (zusammen
1.222 px). Die Umbruchregel hing an der **Fenster**breite — die Fläche ist wegen des Menüs
links aber rund 250 px schmaler. Schon bei 1600 px Fensterbreite standen die rechten Knöpfe
17 px über den Rand hinaus.

**Behoben** in `pc-manager/styles.css`: die Zeile richtet sich nach dem Platz, den sie
wirklich hat, und bricht selbst um.

---

## Konsolidierung

### Ein QR-Zeichner statt drei

Kasse, PC-Manager und Money Butler hatten je eine eigene, fast gleiche Zeichenfunktion. Genau
darin steckte derselbe Rundungsfehler dreimal, musste dreimal einzeln repariert werden — und
die drei Fassungen waren danach schon wieder unterschiedlich (feste Breiten 116, 300 und 360 px).

Neu: **`shared/kc-qr.js`**, von allen dreien benutzt. Die Modulzahl bestimmt die Bildgröße,
jedes Modul ist ganzzahlig und mindestens 4 px breit.

Dabei entfernt: eine Ersatzfunktion in der Kasse, die bei fehlender QR-Bibliothek ein
**zufälliges Muster** malte, das wie ein QR-Code aussah, aber keiner war. Am Stand hätte man
das erst beim Einlesen gemerkt. Jetzt steht dort ein rot umrandeter, beschrifteter Hinweis.

### Die 29 dauerhaft roten Tests sind aufgeklärt

Jeder einzeln nachgeprüft: **keiner meldet einen echten Fehler.** Alle 29 gehören zum alten
TV-Editor, der bewusst in `pc-manager/kc-object-studio.js` und `pc-manager/tv-designer/`
zusammengeführt wurde. 26 scheitern beim Öffnen an gelöschten Moduldateien, 3 an alten
Element-Kennungen.

Sie liegen jetzt mit vollständiger Begründung in `tests/altlast-tv-designer/`. An ihre Stelle
tritt `tests/tv-designer-konsolidierung.test.cjs`, der den heutigen Zustand prüft — unter
anderem, dass **jeder Verweis in jeder Seite auf eine vorhandene Datei zeigt** (186 Verweise
in 13 Seiten). Genau dieser Fehler hatte die 29 Alttests überhaupt erst entstehen lassen.

Dauerhaft rote Tests sind gefährlich: man gewöhnt sich an sie und übersieht darin einen echten
neuen Fehler. Ab jetzt gilt: **rot bedeutet wieder rot.**

### Neuer Dauerschutz gegen das wiederkehrende Muster

`tests/ansichten-gleichstand.test.cjs` misst dieselben Eigenschaften in **beiden**
Kassenansichten und schlägt aus, sobald eine zurückfällt. Mehrfach war eine Verbesserung nur
in einer Ansicht gebaut worden — und zwar jedes Mal nicht in der, die am Stand läuft.

---

## Zwei Dinge zum Entscheiden (keine Fehler)

**Happy Hour läuft ab Werk mit.** In den Stammdaten steht eine Beispielaktion: täglich
17–18 Uhr, 10 % auf Glühwein rot und weiß. Sie startet von allein. Am Markttag ist das genau
die anlaufende Stoßzeit. Gemessen: 5,50 € werden zu 4,95 €.

**Untergrenze der Bildschirmgröße.** Ab 1280×800 sitzt alles sauber. Bei 1024×600 ist es nach
der Korrektur bedienbar, aber eng — eine Kachelreihe statt drei.

---

## Was wo geprüft wurde

| Reihe | Prüfungen | Inhalt |
|---|---|---|
| Geldarithmetik | 39 | Summen, Pfand, Rückgeld, Auszahlungen, Unterdeckung, 50er-Bons |
| Bedienung und Robustheit | 59 | Modusanzeige, Stoßzeiten, 10 Bildschirmgrößen, Storno, Neustart, Doppelklick |
| PC-Manager und Money Butler | 33 | alle 35 Ansichten, Demodaten, Geldkassette, Zeiterfassung |
| QR-Codes | 21 | jeder Code mit jsQR zurückgelesen, Umlaute, Überlänge, fehlende Bibliothek |
| Härtetests | 21 | beschädigte Codes, Zeitzonen, 40 Bons, Neustart, Tagesabschluss |
| Backend und Kette | 33 | Dienst, Migrationen, Archiv, Fälschungsversuche, Neustart, Zugriff von außen |
| **Summe** | **206** | dazu 28 Suite-Tests und 83 Backend-Tests = **317** |

Die Reihen liegen in `tests/tuev/` und lassen sich jederzeit wiederholen — siehe
`tests/tuev/LIESMICH.md`.

---

## Was die Geldrechnung angeht

Die wichtigste Nachricht dieses Durchgangs: **an der Geldarithmetik war nichts zu beanstanden.**
Summen, Rückgeld, Pfand, 50-Positionen-Bons und Auszahlungen sind cent-genau. Auszahlungen bei
Pfandrückgabe sind sogar besonders sauber gelöst: die Kasse zeigt den Betrag positiv, wechselt
die Beschriftung auf „AUSZAHLUNG" und der Knopf sagt „BAR KASSIEREN … AN KUNDEN". Bei
Unterdeckung meldet sie „NOCH x,xx € FEHLEN" gleich dreifach und blendet den Rückgeldknopf aus.

---

## Zwei eigene Fehler, offen benannt

**Zwei ältere Tests waren zeitabhängig.** `warengruppen-knoepfe` und `kasse-bedienung` wurden
zwischen 17 und 18 Uhr rot, obwohl das Programm richtig arbeitete — die Happy-Hour-Aktion
verändert dann Preise und Warengruppen. Beide schalten die Aktionen jetzt vor dem Lauf ab.

**Die Prüfung der Kette lief anfangs nicht isoliert.** Der Manager-Dienst legt seine Datenbank
standardmäßig im Arbeitsverzeichnis an; die Prüfläufe fanden dadurch Reste des vorherigen
Laufs vor. Jetzt bekommt jeder Lauf über `KC_SYNC_MANAGER_DB_PATH` eine eigene Datenbank unter
`/tmp` und räumt sie wieder weg.
