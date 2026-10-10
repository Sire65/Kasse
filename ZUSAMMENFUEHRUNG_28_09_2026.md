# Zusammenführung 28.09.2026 – Änderungen 26.09. + TSE-Relay (Entwicklung)

Dieser Stand gilt für Live (`pos/`, `pc-manager/`) **und** Schulung (`schulung/pos/`, `schulung/pc-manager/`).
Die Build-Kennung ist in beiden gleich: `app.js?build=0.31.3.6-r37`, `kc-ausverkauft.js?build=1.0.2`
und im PC-Manager `app.js?build=bilder-v5`.

## Enthalten
1. **Änderungen vom 26.09.2026** (siehe `CHANGELOG_CLAUDE_26-09-2026.txt`):
   * neuer Rabatt-Dialog mit Rundung auf 20 Cent
   * digitaler Bon (Standard AUS)
   * Knopf „Verkaufszeiten“ im Info-Dialog
   * neue Pfandbilder
   * App-Höhe und Layout-Core in ES5
   * Ausverkauft-Verknüpfung Glühwein rot → Feuerzangenbowle
2. **TSE-Relay (Entwicklung, Standard AUS)** – siehe `TSE_RELAY_KASSE_ENTWICKLUNG.md`.

## Vorgehen
Das ZIP vom 26.09. basierte auf dem GitHub-Stand vom 23.09. (Commit `80935e4`). Es fehlten ihm also
die Funktionen vom 23./24.09.:

* X-Bericht
* Helfer-Verpflegung
* Trinkgeld-Zahlenfeld
* Bediener auf dem Bon
* Grünkohl-Kombis
* Verkaufskurve

Deshalb wurde **drei-Wege-zusammengeführt** (Basis `80935e4`) statt überschrieben. Alle neueren
Funktionen sind erhalten, `tests/aenderungen-26-09.test.cjs` prüft das.

## Bewusste Abweichungen vom ZIP
* `AdaptiveLayoutCore.init()` bleibt aufgerufen. Das ZIP hatte den Aufruf entfernt, der Kommentar dort
  nahm aber an, er habe nie existiert. Auf GitHub ist er seit 05.09. drin.
* `pos/service-worker.js` aus dem ZIP wurde **nicht** übernommen, weil es veraltete Build-Kennungen
  enthielt (z. B. `kc-oberflaechen-anwenden.css?build=0.9.2` statt `0.9.15`). Stattdessen wurden nur
  die drei neuen Bilder in die aktuelle Liste eingetragen.
* Der digitale Bon wird in `completeSale()` per try/catch abgesichert. Ein QR-Fehler darf einen bereits
  gespeicherten Verkauf nicht als fehlgeschlagen melden.
* Schulung: Die dortigen Eigenheiten (Warengruppen-Reihenfolge, Becher-Bild, eigene Offline-Liste)
  bleiben erhalten. Übertragen wurden nur die neuen Inhalte.

## Offene Hinweise
* Das QR-Fenster des digitalen Bons liegt links unten und verdeckt für bis zu 20 s den RÜCKGELD-Knopf.
  Solange der Schalter aus ist (Standard), betrifft das niemanden.
* „MARKTBESCHICKER“ ist im Rabatt-Dialog knapp abgeschnitten.
* Die Signaturliste des TSE-Relays liegt im localStorage. Vor dem Echtbetrieb sollte sie in die
  IndexedDB umziehen.
* In der Schulung sollte der TSE-Schalter aus bleiben, damit keine Übungsbons an eine echte TSE gehen.

## Prüfung
* Komplette Test-Suite (74 Tests) vorher/nachher: keine Abweichung bei Exit-Codes und Fehlerbildern.
  Die schon vorher roten Tests sind unverändert rot.
* Neu: `tests/tse-relay.test.cjs` (39 Prüfpunkte) und `tests/aenderungen-26-09.test.cjs` (Live + Schulung).

## Nachtrag: Prüfkette nach Neustart behoben (28.09.2026)
**Befund:** IndexedDB liefert `getAll()` sortiert nach Schlüssel, hier der zufälligen `transactionId`.
Bei jedem Neustart der Kasse waren die Bons deshalb durcheinander. Das hatte zwei Folgen:

* Die Ledger-Prüfung meldete „Prüfkette ist unterbrochen“.
* Der nächste Verkauf hängte sich per `previousHash` an einen zufälligen Bon, die Kette bekam echte
  Abzweigungen.

Im alten Stand passierte das in 6 von 6 Versuchen.

**Behebung** in `pos/kc-transaction-store.js` (gleich in `schulung/pos/`, Build 0.1.1): Beim Laden wird die
Buchungsreihenfolge wiederhergestellt. Ist die Kette intakt, wird exakt entlang der Kette sortiert. Ist
sie schon beschädigt, wird nach Buchungszeit sortiert. Datensätze werden dabei nicht verändert.

**Altbestand:** Tablets, die mit dem Fehler neu gestartet und danach weiter kassiert haben, tragen
bereits Abzweigungen in ihren gespeicherten Bons. Die Prüfung meldet das weiterhin ehrlich, denn diese
Bons wurden tatsächlich falsch verkettet. Ab dem nächsten Marktstart-Reset ist die Kette sauber.

**Test:** `tests/pruefkette-neustart.test.cjs`, Live und Schulung, je 3 Durchläufe mit zwei Neustarts.
Die Gegenprobe mit dem alten Code wird rot.

## Nachtrag: Einstellungen – System-Bereich nur noch im eigenen Tab (28.09.2026)
**Befund:** Die Regel `body.role-superadmin .superadmin-only{display:inline-block}` ist für kleine
Admin-Knöpfe gedacht. Sie traf aber auch ganze Einstellungsbereiche und hebelte `.settings-panel{display:none}`
aus. Für Service-Admins stand „System“ deshalb unter jedem Tab.

**Behebung** in `pos/styles.css` und `schulung/pos/styles.css`: Einstellungsbereiche mit `superadmin-only`
folgen wieder nur ihrem Tab. Die Build-Kennung von `app.js` ist auf r38 hochgezählt, damit die Tablets
den Offline-Speicher erneuern.

**Test:** `tests/einstellungen-bereiche.test.cjs` prüft Live und Schulung, jeden Tab einzeln, als
Service-Admin und als normale Kasse. Die Gegenprobe mit dem alten Stand ergibt 18 Fehler.

## Nachtrag: rote Tests abgearbeitet (28.09.2026)
Alle 20 zuvor roten Tests wurden einzeln untersucht und nach ihrer Ursache eingeordnet.
Danach laufen alle 79 Tests grün.

**Echte Fehler im Code – behoben (Live und Schulung):**
1. **Artikelnummern:** Schuss Rum (01007) und Schuss Amaretto (01008) waren seit 19.09. verkaufbar,
   hatten aber keine Nummer und waren damit nicht scannbar. Freie Zahlung bekommt 04003 (Betreiber-Entscheid):
   Der Scan öffnet die Betragseingabe und bucht nichts selbst. `kc-artikelnummern-core.js` 1.0.1, Build 1.0.2.
2. **Freigabe-Manifest:** Es verlangte für den Verkaufs-Import noch 0.2.0, der Core ist seit 24.09. 0.3.0.
   Der Manager-Release-Gate stand dadurch auf BLOCKED.
3. **Supabase-Übersicht im Manager:** Der Satz „Kassieren und Abschlüsse laufen ohne sie“ war am 11.09.
   beim Umbau verloren gegangen.
4. **Warengruppen-Farbrand:** Er ist wieder auf den Bildkacheln (Betreiber-Entscheid, `images-v3.css` Build 6).
5. **Neues Kassenlayout:** Die zweite Reihe der Bildkacheln lag unsichtbar unter der Artikelfläche, obwohl
   „Seite 1/1“ angezeigt wurde. Die Kacheln passen sich jetzt dem Raster an, alle Artikel sind sichtbar,
   Info-, Stern- und „+“-Knöpfe sitzen weiter auf dem Bild.
6. **Geldweg Money Butler → PC-Manager → Kasse:** Keiner der Wege funktionierte.
   * Die Übergaben gingen an den HTTPS-Kanal 8543 und wurden dort immer abgelehnt: ohne `apiVersion` mit 400,
     und im normalen Browser ohnehin wegen des selbstsignierten Zertifikats.
   * „An Kasse freigeben“ traf auf 47392 eine fehlende Route (404).
   * Behebung: Beide Ablagen laufen jetzt über den nur lokal erreichbaren Kanal 47392, wie Stammdaten,
     Dienstplan und Fernbefehle. Dazu kommt die Route im Manager-Dienst (`markt-kasse-suite/backend-source`).
   * **Der Manager-Dienst auf dem PC muss dafür einmal neu gestartet werden** (KC_Manager_Start.cmd).
   * Test: `tests/geldweg-manager-kasse.test.cjs` nutzt den echten Dienst, die echte Manager-Seite und eine
     echt gekoppelte Kasse. Die Gegenprobe mit dem alten Code ergibt 5 Fehler.

**Bewusst NICHT geändert:** Der Uhrknopf ist ab Werk sichtbar. Seit 21.09. sind die 18 Stammpersonen
vorbelegt, damit Ausweise an der Stechuhr auch ohne PC-Manager erkannt werden, und gestempelt wird nur über
diesen Knopf. Der Test prüft jetzt dieses Soll. Der ½-Knopf im KC-Aufbau bleibt klein (Betreiber-Entscheid).

**Veraltete Tests an bewusste Änderungen angepasst.** Jede Anpassung trägt im Test einen Kommentar mit Commit.
Keine Prüfung wurde gestrichen.
* KC-Aufbau als Start auf frischen Geräten (19.09.)
* Bilderversion 3
* Stoßzeiten-Bombe
* Import-Format 0.3.0
* Datenbank-Schema 25–27
* Money-Butler-Anmeldung: Der Test meldet sich über das echte Formular an, Supabase wird im Test simuliert.
* Schulung als eigenständige Kopie
* Import-Archiv `markt-kasse-suite/money-butler`

**Umgebung:** Folgende Tests melden jetzt ehrlich „übersprungen“ mit Hinweis statt FEHLER:
* Tests, die Dateien vom Rechner einer früheren Sitzung brauchen (`/home/claude/...`)
* Tests mit externem Konverter
* TV-Musik: Die beiden Weihnachts-MP3 sind wegen der Größe nicht im Repo. Sie gehören nach
  `media/audio/music/`, bis dahin läuft die TV-Vorführung stumm.

Der Live-Monitor-Test läuft jetzt echt. Er braucht dafür einmal `npm install` in `markt-kasse-suite/backend-source`.

## Nachtrag: Digitaler Bon und Rabatt-Knöpfe (28.09.2026)
* **Digitaler Bon (QR):**
  * Das Fenster lag links unten und verdeckte bis zu 20 s den RÜCKGELD-Knopf. Es steht jetzt mittig über
    dem nach dem Verkauf leeren Warenkorb.
  * Es geht von selbst zu, sobald der nächste Artikel gebucht wird.
  * Der Test prüft, dass kein Bedienknopf der Zahlfläche verdeckt ist.
* **Rabatt-Dialog:** „MARKTBESCHICKER“ und „REKLAMATION“ waren abgeschnitten. Sie brechen jetzt an einer
  festen Stelle auf zwei Zeilen um (MARKT-BESCHICKER, REKLA-MATION). Der gespeicherte Grund bleibt
  unverändert. Der Test prüft, dass kein Grund-Knopf abgeschnitten ist.
* Build: `app.js` r40 (Live und Schulung).

## Nachtrag: Bildkacheln auf alten Browsern (30.09.2026)
**Befund** (Betreiber-Foto, Samsung-Tablet SM-T535 mit Samsung-Browser): Die Bildkacheln der Bilderversion 3
fielen zu dünnen farbigen Strichen zusammen, nur die Kachel ohne Bild war normal. Ursache: Ihre Höhe entsteht
allein aus `aspect-ratio:1`, und das kennt der alte Browser nicht. Übrig blieb nur der Rand (8 px hoch, Bild 0 px).

**Behebung** in `images-v3.js` und `images-v3.css` (Live und Schulung):
* Beim Start prüft die Kasse einmal per `CSS.supports`, ob der Browser `aspect-ratio` kann.
* Kann er es nicht, wird `<html class="kc-ohne-seitenverhaeltnis">` gesetzt, und die Kacheln werden über
  `padding-top:100%` quadratisch gehalten.
* Im neuen Kassenlayout füllen sie stattdessen die Rasterzelle.
* Moderne Browser bekommen die Kennzeichnung nicht, dort ändert sich nichts.
* Builds: `images-v3.js` 4-alt, `images-v3.css` 7, `app.js` r41.

**Test:** `tests/alter-browser-kacheln.test.cjs` simuliert den alten Browser in Live und Schulung
(KC-Aufbau und neues Layout). Die Gegenprobe mit dem alten Code ergibt 8 Fehler (206×8 px, Bild 0 px),
genau wie auf dem Foto. Komplette Suite: 80/80 grün.

## Nachtrag: altes Samsung-Tablet vollständig lauffähig (30.09.2026)
**Befund** (Betreiber-Fotos SM-T535, Samsung-Browser): Nach dem aspect-ratio-Fix hatten die Kacheln die
richtige Größe, aber kein Bild. „Seite 2“ und das Parken-Fenster gingen nicht, und in Chrome ging gar nichts.
Das habe ich mit einem **echten Chromium 83** nachgestellt, dem Stand des Samsung-Browsers auf Android 5.
Die Ergebnisse entsprachen 1:1 den Fotos.

**Ursachen**
* **CSS `inset`** (erst ab Chrome 87): Alle Ebenen, die damit ihre Größe bekommen, blieben im alten Browser
  ohne Größe. Betroffen waren:
  * das Bild in der Kachel (lag 210 px unterhalb, also außerhalb der Kachel)
  * das Parken-Fenster (unsichtbar)
  * das Startfenster „Kasse im Vollbild starten“ (lag außerhalb des Bildschirms)
  * die Ebenen von PIN-Sperre, Security Card, Startprüfung, Geldübergabe und Fernbefehl
* **JavaScript:** `.at()` (Chrome 92), `replaceAll` (85), `AbortSignal.timeout` (103), `Object.hasOwn`,
  `structuredClone`, `replaceChildren`.

**Behebung** (Live und Schulung)
* Vor jeder `inset:`-Angabe steht jetzt die ausgeschriebene Form `top/right/bottom/left`, maschinell,
  70 Stellen in CSS und in JS-Styles. Neue Browser: identisches Ergebnis.
* `pos/kc-altbrowser.js` wird als erstes Skript geladen und ergänzt die fehlenden JS-Funktionen **nur**, wenn
  sie fehlen. Auf aktuellen Geräten tut die Datei nichts.
* Startfenster: Auf alten Browsern verschwindet es nach „KASSE STARTEN“ auch dann, wenn der Vollbildmodus
  nicht startet, damit es die Kasse nie blockieren kann. Andere Geräte: unverändert.
* Neue Seite `kasse-aktualisieren.html` im Hauptordner: entfernt die im Browser gespeicherte Programmkopie
  von Kasse, Schulung und alter Startseite. Verkäufe, Bons und Einstellungen bleiben erhalten.
  Für Geräte, die an einer alten Version hängen.
* Die Kasse fragt bei jedem Start ausdrücklich am Server nach Updates (`updateViaCache:"none"` + `update()`).
* Build: `app.js` r43.

**Tests:**
* `tests/altbrowser-regeln.test.cjs`: inset-Regel, Ladereihenfolge, Nachrüstung. Die Gegenprobe mit dem
  alten Stand schlägt an.
* `tests/kasse-aktualisieren.test.cjs`: Update-Seite mit aktivem Offline-Speicher und echtem Bon.

Nachweis im Chromium 83, alter gegen neuen Stand (Startfenster, Bilder, „mehr“, Parken-Fenster):
alt 3 von 4 kaputt, neu 4 von 4 ok. Komplette Suite 82/82 grün.

## Nachtrag: altes Tablet – Bilder schneller, Symbole wieder da (30.09.2026)

Betreiber: „läuft jetzt, aber sehr sehr langsam bauen sich die Bilder … einige Icons sind weg: der Warenkorb,
der Drucker in der Drucktaste, Mülleimer usw.“

**Ursachen**
* Die Artikelbilder `assets/*_version_3.png` sind je 1,4–2 MB groß (zusammen ca. 30 MB). Ein Tablet von 2014
  braucht zum Entpacken so großer Bilder sehr lange.
* Die Symbole sind Emoji-Zeichen (🛒 🖨 🗑 🧾 …). Android 5 kennt nur ältere Emoji und zeigt neuere gar nicht an.

**Behebung** (Live und Schulung, nur auf alten Browsern – erkannt wie bisher am fehlenden `aspect-ratio`)
* 17 kleine Kopien der Artikelbilder in `assets/klein/` (640 px, webp, zusammen ca. 0,7 MB statt 30 MB).
  `kc-altbrowser.js` tauscht jedes große Bild schon im HTML-Text gegen die kleine Kopie, bevor der Browser es
  anfordert (nur `<img src>`, nie gespeicherte Daten oder Eingabefelder). Fehlt eine kleine Kopie, kommt das
  große Bild automatisch zurück. Nachweis im Chromium 83: vorher 14 Abrufe großer PNGs, jetzt 0.
* Ersatzschrift `assets/kc-emoji-ersatz.woff2` (Ausschnitt aus Noto Emoji, 23 Zeichen, 17,5 KB, freie Lizenz
  SIL OFL, Lizenztext liegt daneben). Wird nur auf alten Browsern als letzte Schrift eingehängt, und der
  Browser lädt sie nur, wenn eines dieser Zeichen tatsächlich fehlt.
* Startfenster: verschwindet auf alten Browsern jetzt sofort beim Tippen auf „KASSE STARTEN“ (vorher erst,
  wenn der Browser den Vollbildwunsch beantwortet hatte – das bleibt auf manchen Geräten ganz aus).
* iPad / neuer Chrome: keine Änderung (im Test geprüft).
* Builds: `app.js` r44, `kc-altbrowser.js` 1.0.1, `kc-legacy-fallback.css` 1.0.1.

**Tests:** `tests/altbrowser-regeln.test.cjs` erweitert: jede große Artikelgrafik hat eine kleine, offline
gespeicherte Kopie unter 150 KB; Tausch nur in `<img>`; Rückfall bei fehlender Kopie ohne Endlosschleife;
aktueller Browser unverändert; Ersatzschrift vorhanden und offline gespeichert.

## 30.09.2026 – Oberfläche ohne Menü-Knopf sperrt das Tablet nicht mehr ein

**Fund (Betreiber, Schulungs-iPad):** „Habe eine Kassen-Oberfläche eingestellt und kann sie nicht ändern, weil
nirgendwo ein Button ist.“ Gewählt war KC015 „Kassierer-Ansicht mit Bontabelle“ (für den PC-Manager gedacht).
Sie legt weder MENÜ noch MEHR ins Raster – die Oberflächen-Wahl im Mehr-Fenster war damit unerreichbar.

* `kc-oberflaechen-anwenden.js` 0.9.10: Liegt nach dem Umbau kein sichtbarer MENÜ-/MEHR-Knopf im Raster,
  erscheint oben links ein kleiner schwebender ☰-Knopf, der das Mehr-Fenster (mit „Oberfläche“) öffnet.
  Oberflächen mit eigenem Menü-Knopf und die Standardansicht bleiben unverändert.
* Notausgang per Adresse: `…/pos/index.html?oberflaeche=standard` setzt auf die Standardansicht zurück.
* CSS 0.9.16. Live und Schulung gleich.

**Tests:** `tests/oberflaeche-notausgang.test.cjs` (neu). Browserprüfung: KC015 → ☰ sichtbar → Mehr-Fenster
mit Oberflächen-Wahl öffnet → Standard blendet ☰ aus; Köcheclub-Aufbau mit eigenem Menü zeigt kein ☰;
`?oberflaeche=standard` setzt zurück. kassenbaukasten, schulung-versionsabgleich, pin-sperre-tablet,
halbe-portion, kombi-warengruppe grün.

## Nachtrag: Entnahme übersichtlicher, 0,50 € wählbar (30.09.2026)

Betreiber: „Die Entnahme ist zu unübersichtlich mit den vielen Zahlen. Wenn in das Feld Betrag geklickt wird,
muss sich ein Ziffernfeld öffnen, recht klein. Die vorgefertigten Beträge besser anordnen. 0,50 muss bei
Toilettengeld auch wählbar sein.“

* Der große Ziffernblock ist nicht mehr dauernd offen. Tippen ins Betragsfeld öffnet ein kleines Ziffernfeld
  (240 px) rechts unter dem Feld, am Bildschirm ausgerichtet, damit es nie abgeschnitten wird. OK, ein
  Schnellbetrag oder Tippen daneben schließt es. Die Tablet-Tastatur klappt nicht zusätzlich auf; am PC kann
  weiter direkt ins Feld getippt werden.
* Schnellbeträge in einer Reihe, von klein nach groß: 0,50 · 1 · 2 · 5 · 10 · 20 · 50 · 100 €.
* Gefundener Altfehler in der Schulung: Der Betrag aus dem Ziffernblock kam dort nicht bei der Buchung an,
  „Entnahme speichern“ blieb gesperrt, eine Entnahme war in der Schulung nicht möglich. Behoben in
  `kc-erfassung-getrennt.js` (meldet den Betrag an die vorhandene Schulungsfunktion). Kasse: unverändert.
* Buchung, Gründe, Beleg, Abschluss und Auswertung: unverändert.
* Builds: `kc-erfassung-getrennt.js` 0.1.1, `kc-oberflaechen-anwenden.css` 0.9.17.
* Test: `tests/entnahme-ziffernfeld.test.cjs` (Kasse und Schulung, 1280×800 und 1024×768, echte
  WC-Geld-Entnahme über 0,50 €).

## Nachtrag: Pfand-Plus-Kacheln unter „Sonstiges“ (30.09.2026)

Betreiber: „Pack die beiden Plus-Positionen in der Pfandgruppe unter Sonstiges, sonst vertut man sich zu schnell.“

* Glaspfand (+2 €) und Feuerzangenpfand (+2 €) stehen nicht mehr neben den Rückgaben (−2 €), sondern unter
  „Sonstiges“. Die Pfand-Gruppe zeigt nur noch Glas-Rückgabe, Feuerzange-Rückgabe und Glas + Feuerzange Rückgabe.
* **Nur die Anzeige ist verschoben.** Die Warengruppe bleibt „Pfand“: Pfandzählung im Kassenabschluss,
  „kein Rabatt auf Pfand“, Auswertung und Artikelnummern laufen wie bisher. Die „+“-Taste an den Getränken
  bucht das Pfand weiter automatisch.
* Umsetzung über Artikeldaten statt fester Programmierung: neues Artikelfeld `hideInOwnCategory` zusammen mit
  dem vorhandenen `displayCategories` (wie beim Außer-Haus-Becher). Laufende Geräte werden einmalig umgestellt
  (Merker `kc_pfand_plus_unter_sonstiges_v1`), eine spätere eigene Einstellung wird nicht überschrieben.
* Builds: `app.js` r45, `kc-oberflaechen-anwenden.js` 0.9.11.
* Test: `tests/pfand-plus-unter-sonstiges.test.cjs` (Kasse und Schulung, frisches und bestehendes Gerät).

## Nachtrag: Entnahme wie Money Butler (02.10.2026)

Betreiber: „Wie z. B. Money Butler die Münzen und Scheine anzeigen, ordentlich aufgereiht, dann einen gewissen
Abstand und die Gründe als Buttons farbig zur schnelleren Unterscheidung. Den Button ausgegraut, bis Sachen
gewählt wurden, und Bon/Quittung vorhanden etwas größer. Wenn ins Schreibfeld geklickt wird, Tastatur
einblenden.“ – „0,50 reicht, aber die echten Bilder der Münzen und Scheine wie in Money Butler.“ (Entwurf vorab
als Bild abgestimmt.)

* Betrag: echte Bilder aus `assets/` (dieselben wie im Money Butler) – Münzen 0,50 €, 1 €, 2 €, Scheine 5–100 €
  in einer Reihe. Jedes Antippen zählt dazu, ein Zähler zeigt „2×“. Große Summenanzeige mit Aufstellung
  („2× 5 € · 1× 0,50 €“), „↶ Letzte zurück“, „🗑 Leeren“; krumme Beträge über „⌨ Anderer Betrag“ (das
  bisherige kleine Ziffernfeld, die erste Ziffer ersetzt den Betrag). Die Schnellbetrags-Reihe vom 30.09. ist
  dadurch ersetzt.
* Gründe als große farbige Knöpfe (Lebensmittel grün, Reinigungsmittel türkis, Essen orange, Getränke lila,
  WC-Geld blau, Sonstiges grau); der gewählte Grund mit Rahmen und ✓, die anderen blass.
* „Entnahme speichern“ ist grau, bis Betrag **und** Grund gewählt sind; darüber ein Hinweis („Bitte zuerst
  Betrag und Grund wählen“ bzw. „✓ 6,00 € · WC-Geld · mit Bon – bereit zum Speichern“).
* „Bon / Quittung vorhanden“ als großer Knopf (62 px), grün mit Haken, wenn gewählt.
* Notiz: Bildschirmtastatur (inputmode text), das Feld rutscht beim Tippen in die Bildmitte.
* **Buchung unverändert:** gebucht wird wie bisher über das (jetzt versteckt geführte) Betragsfeld und
  `app.js` – Betrag, Cent, Grund, Notiz, Bon, Protokoll, Abschluss und Auswertung wie bisher. Reklamation
  unverändert (keine Münzen, Speichern nicht gesperrt). Schulung behält ihre Reihenfolge (Grund vor Betrag).
* Builds: `kc-erfassung-getrennt.js` 0.2.0, `kc-oberflaechen-anwenden.css` 0.9.18 (Kasse und Schulung,
  Service-Worker-Liste nachgezogen; Bilder waren dort schon enthalten).
* Test: `tests/entnahme-ziffernfeld.test.cjs` neu (Kasse und Schulung, 1280×800 und 1024×768: Bilder geladen,
  eine Reihe, Zähler, Zurück/Leeren, Ziffernfeld, Sperre bis Betrag + Grund, Farben, Tastatur, Bon-Größe,
  echte Buchung 6,00 € WC-Geld mit Bon und Notiz, neu geöffnet wieder leer).

## Nachtrag: Helfer-Gruppe „Küche DO“ (02.10.2026)

Betreiber: „Nimm in Helferseite noch einen Button Küche DO auf als Helfer.“

* Neue Standard-Helfergruppe „Küche DO“ (achter Knopf im Helfer-Fenster, Kasse und Schulung).
* Buchung wie alle Helfergruppen: Typ „helfer“, kein Bargeld, kein Pfand, `helperGroup: "Küche DO"`; erscheint
  im Kassenabschluss unter „Helfer-Verpflegung“ mit eigener Zeile.
* Build: `app.js` r46 (Kasse und Schulung, Service-Worker-Liste nachgezogen).

## Nachtrag: Entnahme auf dem iPad – Münzen untereinander (02.10.2026)

Betreiber: „Auf einem größeren iPad war heute die neue Seite Entnahme falsch, die Münzen waren untereinander.“

* Ursache gefunden und nachgestellt (Safari-Engine WebKit, iPad-Größen): Das iPad hatte das neue Programm
  (`kc-erfassung-getrennt.js` 0.2.0), aber noch die **alte Stildatei** (0.9.17). Dort sind alle Knöpfe im
  Betragsbereich 100 % breit – Münzen und Scheine standen untereinander. Möglich war dieser Mischstand,
  weil der Offline-Speicher (Service Worker) bei fehlender neuer Fassung stillschweigend die alte Fassung
  derselben Datei auslieferte (Rückfall „ignoreSearch“), auch wenn Netz da war.
* Behoben an zwei Stellen:
  1. `kc-erfassung-getrennt.js` 0.2.1 bringt die Gestaltung der Entnahme selbst mit (`<style id="kcGeldStil">`);
     die Regeln stehen nicht mehr in `kc-oberflaechen-anwenden.css` (0.9.19). Programm und Aussehen können
     nicht mehr auseinanderlaufen.
  2. Service Worker (Kasse und Schulung): Die alte Fassung einer Datei wird nur noch genommen, wenn das
     Laden aus dem Netz scheitert (offline). Mit Netz wird die richtige neue Fassung geladen.
* Geprüft in WebKit (Safari) auf iPad (5./6./7./11. Gen., Mini, Pro 11, Pro 12,9 – hoch und quer) und in
  Chrome; Mischstand (neues Programm + alte Stildatei) zeigt jetzt ebenfalls eine Reihe. Echte Buchungen
  (7,20 € Einkauf Lebensmittel; 6,00 € WC-Geld mit Bon) korrekt. Update-, WLAN- und Offline-Tests grün.
* Test `tests/entnahme-ziffernfeld.test.cjs` um die Mischstand-Prüfung ergänzt.

## Nachtrag: Helfer-Knöpfe bunt (02.10.2026)

Betreiber: „Mache die Buttons in Helfer auch bunt zur besseren Unterscheidung.“

* Jede Helfergruppe hat eine eigene Farbe: Bauhof orange, Stadtmarketing lila, Feuerwehr rot, Wachpersonal
  dunkelgrau, Bühnenpersonal türkis, Künstler pink, Artisten grün, Küche DO braun. Eigene Gruppen aus dem
  Manager bekommen der Reihe nach eine Farbe aus derselben Palette.
* Nur Aussehen, Buchung unverändert. `kc-oberflaechen-anwenden.css` 0.9.20 (Kasse und Schulung,
  Service-Worker-Liste nachgezogen). Geprüft in Chrome und WebKit (iPad), Helfer-Buchung „Küche DO“ korrekt.

## Nachtrag: Weitere Funktionen, Rabatt, Gutschein, Bargeldeinzahlung bedienerfreundlich (02.10.2026)

Betreiber: „Sind damit alle Übersichten bedienerfreundlich aufgebaut?“ → Entwürfe → „Ja, alles so bauen.“

Neues Modul `kc-bedienung-farbig.js` 0.1.0 (Kasse und Schulung, im Ladeplan nach `kc-gutschein.js`,
Service-Worker-Liste nachgezogen). Es bringt seine Gestaltung selbst mit (`<style id="kcFarbStil">`), damit
kein Mischstand mit einer alten Stildatei entstehen kann. Es ändert nur Aussehen und Führung – alle
Buchungen laufen über die vorhandenen, unveränderten Funktionen.

* **Weitere Funktionen**: Knöpfe in Gruppen mit Überschrift (💶 Geld · ↩ Rückgabe · 🗄 Kasse ·
  🧾 Bon und Übersicht), jede Funktion mit eigener Farbe. Leere Gruppen werden ausgeblendet; „Ansicht“
  steht unten im Raster neben Umschalter und Schließen.
* **Rabatt**: Gründe farbig mit Symbol und „Vorschlag x %“; nach der Wahl werden die anderen Gründe
  blass, darunter steht z. B. „✓ STAMMGAST · 10 % · −0,30 €“. „Übernehmen“ bleibt grau bis ein Grund
  gewählt ist (vorhandene Logik).
* **Gutschein**: Beträge als echte Scheinbilder, große Betragsanzeige, „Anderer Betrag“ öffnet erst
  dann das Ziffernfeld. „Drucken“ grau ohne Betrag oder über 500 €; „gültig bis“ wird angezeigt.
* **Bargeldeinzahlung**: Titel „Bargeld vom Kassenwart übernehmen“, großes Scanfeld, Vorschau vor dem
  Übernehmen (Art, Betrag, Kasse, Datum, Kassenwart); „Übernehmen“ grau, bis der Code gültig ist.
  Kurzcode in vier Kästchen mit Prüfziffer-Kontrolle (gleiches Verfahren wie die Kasse); bei falscher
  Prüfziffer gesperrt mit Hinweis.
* Geprüft in Chrome (1280×800, 1024×768) und WebKit/Safari (iPad 1180×820, 1366×1024), Kasse und
  Schulung, mit echten Buchungen: Rabatt Stammgast, Gutschein 35 €, Anfangsbestand 150 € per Code,
  Nachfüllung 600 € per Kurzcode. Neuer Test `tests/bedienung-farbig.test.cjs`; Bedienung-, Entnahme-,
  Update-, WLAN-, Notausgang-, Ansichten- und Altbrowser-Tests grün.

## Nachtrag: Gutschein-Fenster mit weißem Hintergrund, Kurzanleitung Version 4 (02.10.2026)

* Beim Erstellen der Kurzanleitung Version 4 fiel auf: Das Gutschein-Fenster hatte keinen eigenen Hintergrund,
  die Kasse schimmerte durch (schon vor dem 02.10. so, auch im Bild der Version 3). `kc-bedienung-farbig.js`
  0.1.1 gibt dem Fenster einen weißen Hintergrund (Kasse und Schulung, Ladeplan und Service-Worker-Liste
  nachgezogen). Nur Aussehen, keine Änderung an Ausstellen/Einlösen.
* Kurzanleitung Bilderrechner Version 4 (28 Seiten) liegt in der Club-App unter `dokumente/`: neue Seiten zu
  Rabatt, Weitere Funktionen, Bargeldentnahme, Gutschein, Helfer und „Bargeld vom Kassenwart übernehmen“;
  Knöpfe einzeln ausgeschnitten. Der Geheimweg zu den Kassenfunktionen wird darin bewusst nicht beschrieben.

## Nachtrag: Bon ansehen – Knopf „Zurück zur Kasse“ (02.10.2026)

Betreiber: „Wenn ich bei Bondruck einen Bon ansehe, öffnet der sich. Oben rechts ist ein Druckbutton, aber dort
muss es auch einen Zurück-Button geben, sonst komme ich aus dem Bild nicht mehr raus.“

* Das Bon-Fenster (Ansehen und Drucken) hat oben links den Knopf **„← Zurück zur Kasse“**. Er schließt das
  Fenster, die Kasse ist wieder da. Klappt das Schließen auf einem Gerät nicht, erscheint der Hinweis „Bitte dieses
  Fenster schließen (oben ✕)“ statt einer Sackgasse. Beim Ausdruck ist der Knopf unsichtbar; der Bon rückt am
  Bildschirm etwas nach unten, damit die Knöpfe nichts verdecken. Bon-Inhalt und Druck unverändert.
* `app.js` r47 (Kasse und Schulung, Ladeplan und Service-Worker-Liste nachgezogen). Neuer Test
  `tests/bon-ansehen-zurueck.test.cjs`, geprüft in Chrome und WebKit (iPad); übrige Kassentests grün.

## Nachtrag: Alle Mülleimer rot (03.10.2026)

Betreiber: „Mache alle Mülleimer im Programm rot, besonders im Warenkorb.“

* Das Mülleimer-Zeichen 🗑 ist auf dem iPad ein graues Farb-Emoji und ignoriert die Textfarbe. Es wird jetzt über
  `color: transparent` + `text-shadow` eingefärbt (wirkt auch in Safari): rot im Warenkorb (Artikel stornieren),
  bei geparkten Bons (verwerfen), bei „Leeren“ in der Entnahme und bei „Löschen“ (Pakete/Angebote); auf dem roten
  BON-verwerfen-Knopf weiß, damit er sichtbar bleibt. Nur Aussehen, keine Funktion geändert.
* `kc-bedienung-farbig.js` 0.1.2, `kc-erfassung-getrennt.js` 0.2.2 (Kasse und Schulung, Ladeplan und
  Service-Worker-Liste nachgezogen). Geprüft in Chrome und WebKit; Kassentests grün.
* Nebenbefund (unverändert, schon vorher so): Bei Bildschirmbreiten über 1050 px ist der gelbe %-Knopf in der
  Warenkorbzeile leer (`font-size:0` ohne das „%“-Zeichen, das nur bis 1050 px gesetzt wird).

## Nachtrag: %-Knopf im Warenkorb wieder mit Zeichen (03.10.2026)

* Ursache: `kc-oberflaechen-anwenden.css` versteckt in der Tabellen-/Kompaktansicht (KC003 u. a.) die Schrift des
  Positionsrabatt-Knopfes und verließ sich darauf, dass das „%“ aus `styles.css` kommt – das gibt es dort aber nur bis
  1200 px Breite. Darüber war der gelbe Knopf leer. Jetzt setzt die Regel das „%“ selbst (0.9.21, Kasse und Schulung,
  Ladeplan und Service-Worker-Liste nachgezogen). Geprüft 800–1920 px in Chrome und WebKit.
* Unverändert (schon vorher so): In „Standard (wie bisher)“ bei 1024 bzw. 800 px Breite steht im 44 px schmalen Knopf
  „%“ und zusätzlich „POS. RABATT“, der Text läuft über.

## Nachtrag: Schulung zeigt immer die aktuellen V3-Bilder (06.10.2026)

* Anlass: Auf dem Notebook zeigte die Schulung alte Echtfotos. Ursache: Die Artikel im Gerätespeicher stammen aus
  einem Konfig-Import „mit Bildern“ und tragen ein `embeddedImage`; `images-v3.js` übersprang solche Artikel und
  `sanitizeProduct` bevorzugt `embeddedImage` vor `image`.
* Betreiber-Entscheidung „Weg 2“ – die Schulung ist reine Vorführung: In `schulung/pos/` zeigen die 20 bekannten
  Standardartikel jetzt immer das V3-Bild (`images-v3.js` build 5-schulung, `app.js` build 0.31.3.6-r48 (Kasse und Schulung gleiche Buildkennung laut Vertragstest; in `pos/app.js` keine Codeänderung), Ladeplan
  und Service-Worker-Liste nachgezogen). `embeddedImage` bleibt im Speicher erhalten (kein Datenverlust), eigene
  Artikel mit eigenem Foto bleiben unverändert.
* Echte Kasse `pos/` unverändert: Dort gewinnt weiterhin das eingebettete Foto, auch wenn auf demselben Gerät die
  Schulung lief. `tests/product-images-v3.test.cjs` prüft beides getrennt.

## Nachtrag: Entnahme – Grund oben, großes Bon-Kästchen, grüner Knopf prüft sich nach jedem Tipp (06.10.2026)

* Betreiber: „Zuerst oben den Grund wählen, dann den Betrag … dann Bon vorhanden, das Klickkästchen etwas größer,
  dann den grünen Knopf – der muss vorher inaktiv sein … heute wurde der grüne Button nicht aktiv.“
* `kc-erfassung-getrennt.js` 0.2.3 (Kasse und Schulung identisch, Ladeplan und Service-Worker-Liste nachgezogen):
  * Entnahme: Grund steht jetzt auch in der Kasse oben, darunter der Betrag (Schulung hatte das schon). Im
    Reklamationsmodus bleibt die bisherige Reihenfolge. Hinweis lautet „Bitte zuerst Grund und Betrag wählen“.
  * Bon-Knopf 72 px hoch, das Kästchen ☐/☑ 40 px groß (angehakt grün).
  * „Entnahme speichern“ wird nach jedem Tipp im Fenster und bei jeder Betragsänderung neu geprüft – egal über
    welchen Weg der Betrag kam. Grau, solange Grund oder Betrag fehlt; „Bon vorhanden“ ist freiwillig und ändert
    an der Freigabe nichts. Buchungslogik in `app.js` unverändert.
* Den Fehler „grün wurde nicht aktiv“ konnte ich mit dem aktuellen Stand nicht nachstellen. Geprüft in Chrome:
  Kasse und Schulung, KC003 und Standard, 1280×800 und 800×1280, Münzen, Ziffernfeld, Betrag zuerst, mit Bon und
  Bon-Foto, zweite Entnahme direkt nach dem Speichern – immer grün. Mögliche Ursache war ein älterer
  zwischengespeicherter Stand auf dem Gerät. Safari/WebKit war in dieser Prüfumgebung nicht verfügbar.

## Nachtrag: Dienstplan – Schließkreuz verdeckt nicht mehr den Weiter-Pfeil (06.10.2026)

* Betreiber: „Dort verdeckt das Schließkreuz den Weiter-blättern-Button.“ Ursache: Das automatisch eingebaute
  Kreuz oben rechts (`kc-oberflaechen-anwenden.js`, `.kc-dialog-x`) lag genau über dem Pfeil ›.
* `kc-dienstplan-kasse.css` 0.2.1 (Kasse und Schulung, Ladeplan und Service-Worker-Liste nachgezogen): Ist das
  Kreuz da, bekommt die Kopfzeile rechts 50 px Platz, der Pfeil sitzt links daneben. Ohne Kreuz unverändert.
  Geprüft 1280×800, 1024×768, 800×1280 – keine Überlappung mehr.

## Nachtrag: Pfand-Rückgaben auch unter Getränke, Apfelpunsch mit „+“ (07.10.2026)

* Betreiber: „Baue mir noch die 3 Pfandartikel Glas, Zange, beides kombiniert in die Gruppe Getränke unten drunter.
  Den Rest so lassen, und bei Apfelpunsch muss noch ein Pluszeichen wegen Amaretto und Rum dazu.“
* `app.js` (Kasse und Schulung, Build 0.31.3.6-r49, Ladeplan und Service-Worker-Liste nachgezogen):
  * Glasrückgabe, Feuerzange Rückgabe und Glas + Feuerzange Rückgabe erscheinen zusätzlich unter „Getränke“, ganz
    unten nach Schuss Rum/Amaretto (`displayCategories`, Reihenfolge 9100–9102). In „Pfand“ bleiben sie unverändert,
    Warengruppe bleibt „Pfand“ (Pfandzählung, Rabattsperre, Auswertung wie bisher). Einmalig per Merker
    `kc_pfand_rueckgabe_unter_getraenke_v1`, spätere eigene Einstellungen im Artikelstamm werden nicht überschrieben.
  * Apfelpunsch bekommt die Schuss-Auswahl (`optionGroup:"shot"`: ohne / Rum / Amaretto je 1,00 €) wie Glühwein und
    Roter Feger.
* Geprüft in Chrome: Kasse und Schulung, KC003 und Standard, frisches Gerät und Gerät mit gespeichertem Altbestand.
  In KC003 liegen die drei Rückgaben in der vierten Reihe der Getränke (über „▼ mehr“ erreichbar).

## Nachtrag: PC-Manager pflegt Pfand-Anzeige und Apfelpunsch-Schuss, Warengruppen-Reihenfolge, Dreier-Kombi (07.10.2026)

* Betreiber: „Das Ganze muss auch in den PC-Manager, weil der maßgeblich die Kassen steuert. Die Reihenfolge der
  Warengruppen muss sein: Getränke, Essen, Pfand, Favoriten, Kombinationen, Sonstiges. Stelle noch eine Kombi her
  aus Eierpunsch / Grünkohl / Wurst, die Wurst besser in den Vordergrund.“ (Rückfrage: Dreier-Kombi.)
* **Befund:** „Stammdaten senden“ im PC-Manager ersetzt auf jeder Kasse die komplette Artikelliste. Was der Manager
  nicht kannte (Glas-/Zangenpfand nur unter Sonstiges, Rückgaben auch unter Getränke), wäre nach dem nächsten Senden
  weg gewesen. Außerdem baute „Artikel speichern“ im Manager das Artikelobjekt aus dem Formular neu – diese Angaben
  gingen dabei verloren.
* **PC-Manager** (`pc-manager/` und `schulung/pc-manager/` identisch, Build `bilder-v7`):
  * Einmalig (`kcm_artikel_anzeige_v1`): Rückgaben zusätzlich unter Getränke (Reihenfolge 9100–9102),
    Glas-/Zangenpfand nur unter Sonstiges, Apfelpunsch Schuss-Auswahl. Warengruppe bleibt „Pfand“.
  * Neues Feld am Artikel „Zusätzlich an der Kasse anzeigen in Warengruppe“ (Auswahl je Gruppe, eigene Gruppe
    gesperrt) und „Nur dort zeigen, nicht in der eigenen Warengruppe“. Speichern behält die Einstellung.
  * Standard-Reihenfolge Getränke, Speisen, Pfand, Favoriten, Kombi, Sonstiges, danach alle weiteren; einmalig
    übernommen (`kcm_warengruppen_reihenfolge_v1`), danach im Manager frei änderbar und wird mitgesendet.
* **Kasse und Schulung** (`app.js` 0.31.3.6-r50):
  * Reihenfolge der Warengruppen wie oben, wenn keine eigene gesendet wurde; eine bisher gespeicherte Reihenfolge
    wird einmalig verworfen (`kc_warengruppen_reihenfolge_v1`). Fehlt in der gesendeten Reihenfolge eine
    Standardgruppe (der Manager kennt „Kombi“ nicht), steht sie hinter ihrem Vorgänger statt am Ende.
    Angebote/Happy Hour wie bisher.
  * Neue Kombi „Eierlikörpunsch + Grünkohl + Mettwurst“ (11,50 € = Summe der Teile, Pfand extra über den Punsch),
    einmalig ergänzt (`kc_kombi_ei_gk_mw_ergaenzt_v1`). Kachel: Punsch oben, Grünkohl unten, Mettwurst als runder
    Ausschnitt groß in der Mitte vorne (`vorneProductId`). Die vier bisherigen Kombis bleiben.
  * Kombi-Formular der Kasse (nur zwei Felder): bei einer Dreier-Kombi bleibt das dritte Teil erhalten, solange die
    ersten beiden unverändert sind.
* **Nachtrag gleicher Tag** (Betreiber: „Dann mache noch Kombis mit Glühwein und Grünkohl mit Wurst, ohne Wurst. Und bau
  das so, dass wenn die Kasse was schickt, nicht automatisch der PC-Manager überschrieben wird oder umgekehrt.
  Normalerweise bestückt nur der Manager die Kassen.“):
  * Kombi „Glühwein rot + Grünkohl + Mettwurst“ (10,50 €, Wurst vorne). „Grünkohl + Glühwein rot“ (ohne Wurst) gab es
    schon; damit hat Glühwein rot dieselben Kombis wie Eierlikörpunsch.
  * **Kasse → Manager:** Laufen beide im selben Browser, las der Manager beim Start die Kassenartikel ein, und deren
    Werte gewannen (ein im Manager geänderter Preis kam beim nächsten Start zurück). Jetzt gewinnt der Manager; aus
    Kasse/Katalog kommen nur Artikel und Gruppen dazu, die er noch nicht kennt. Nur beim allerersten Start (noch
    nichts im Manager gespeichert) wird der Kassenstand wie bisher übernommen.
  * **Manager → Kasse:** Kombis schickt der Manager nicht (leere Liste wird ignoriert) – die in der Kasse
    eingetragenen Kombis bleiben. Ein vor dem 07.10. gesendeter Manager-Stand kennt die Anzeige-Angabe noch nicht;
    fehlt sie am Artikel ganz, setzt die Kasse ihre Vorgabe (Plus-Pfand unter Sonstiges, Rückgaben auch unter
    Getränke). Eine bewusste Einstellung aus dem neuen Manager – auch „keine Zusatzgruppe“ – bleibt unangetastet.
  * **Befund aus dem Kettentest (Manager → Kasse), behoben:** Die Kasse setzte bei JEDEM Start die Preise von
    Glühwein rot/weiß, Eierlikörpunsch, Apfelpunsch, Hering und Kartoffelcreme fest (Korrektur vom 03.09.). Ein im
    PC-Manager geänderter Preis dieser Artikel kam dadurch nie an der Kasse an (gemessen: Manager 3,70 €, Kasse
    3,50 €). Jetzt wird nur noch der alte falsche Preis mit eingerechnetem Glaspfand korrigiert (5,50/6,50/4,50 €);
    Hering/Kartoffelcreme einmalig je Gerät (`kc_preis_hering_creme_v1`). Die Schuss-Auswahl an Rotem Feger und
    Apfelpunsch setzt die Kasse nur, wenn die Angabe ganz fehlt – „Keine“ aus dem Manager bleibt.
  * Neuer Test `tests/manager-an-kasse-kette.test.cjs`: echtes Paket aus „Stammdaten senden“ im PC-Manager → Kasse
    startet mit genau diesem Abgleich (Reihenfolge, Pfand-Anzeige, Apfelpunsch „+“, 6 Kombis, Preisänderung), dazu
    ein alter Manager-Stand (falscher Preis mit Pfand, „keine Schuss-Auswahl“). Die beiden Dienste reichen die
    Stammdaten unverändert als JSON durch (`articles_json`), `categoryOrder` ist nicht gesperrt.
* Offen: Kombis werden weiterhin in der Kasse gepflegt; der PC-Manager sendet keine Kombis mit (leere Liste wird
  von der Kasse ignoriert). Eine Kombi-Verwaltung im PC-Manager wäre ein eigener Ausbauschritt.
* Test: `tests/warengruppen-reihenfolge-dreier-kombi.test.cjs`.

## Nachtrag: Allergene im Info-Fenster wieder lesbar (07.10.2026)

* Gefunden beim Durchspielen der Übungsliste („Ein Kunde fragt, ob im Glühwein Allergene drin sind“): Im
  Info-Fenster stand bei jedem Artikel „Allergene [object Object]“ und „Produktinformation nicht vollständig
  geprüft“. Ursache: `sanitizeProduct` machte aus den strukturierten Artikelinformationen Text – das Allergen-Objekt
  (z. B. `{sulphites:"contained"}`) wurde zu „[object Object]“, Freigabestatus, Kurzbeschreibung und Nährwerte gingen
  verloren und wurden so gespeichert.
* `app.js` (Kasse und Schulung, Build 0.31.3.6-r51): neue `sanitizeProductInfo` behält die Angaben (Text bereinigt,
  Zahlen geprüft); Artikel mit Allergenen als Text bleiben wie bisher. Bereits verdorbene Angaben werden aus den
  eingebauten Standardangaben wiederhergestellt; der nächste Stammdaten-Abgleich vom PC-Manager liefert sie
  ohnehin vollständig. Glühwein rot zeigt jetzt „Schwefeldioxid / Sulfite: Enthalten“.
* Offen (Daten, nicht Programm): Beim Eierlikörpunsch und weiteren Artikeln sind im Artikelstamm keine Allergene
  hinterlegt – bitte im PC-Manager eintragen.
* Test: `tests/artikelinfo-allergene.test.cjs` (ohne Reparatur 8 Fehler).

## Nachtrag: Übungsliste Kassen-Training (07.10.2026)

* Betreiber: Liste zum Üben zu zweit – einer bedient, einer ist Kunde mit der Liste („Kunde sagt“, Lösungsschritte,
  Ankreuzen „Gewusst ja/nein“), Schwierigkeit langsam steigend.
* `schulung/uebungsliste/index.html` (Webseite zum Ankreuzen am Handy/Tablet, Stand bleibt im Gerät gespeichert,
  „Neu beginnen“, druckt wie das PDF) und `schulung/uebungsliste/Kassen-Training_Uebungsliste.pdf` (A4, 7 Seiten).
  46 Aufgaben in 8 Stufen, jede am 07.10.2026 in der Kasse (Oberfläche KC003) durchgespielt, Beträge nachgerechnet.
* Gestaltung wie die Unterlagen in der Club-App (Kurzanleitung Bilderrechner, Club-App-Anleitung): Titelblatt mit
  Kochmütze, Kopfzeile „Köcheclub Werne“ mit Logo, Inhalt, grüne Überschriften und Nummernfelder, grüne Hinweiskästen,
  „Seite X von Y“, Schrift Carlito; PDF 9 Seiten.
* Zweite Fassung zum Alleine-Üben (Betreiber: „Fragen auf die Vorderseite, Antworten auf die Rückseite … gewusste auf
  einen Stapel, nicht gewusste auf einen anderen“): `schulung/uebungsliste/Kassen-Training_Karteikarten.pdf` – 46 Karten
  95 × 130 mm, 4 je A4-Blatt mit Schnittmarken, beidseitig „an der langen Kante wenden“ (Rückseiten gespiegelt
  angeordnet), Anleitungsseite mit Stapel-Methode und Druckhinweisen. Erzeugt mit `werkzeuge/uebungsliste/karten.cjs`.
* 08.10.2026 (Betreiber: „manchmal gibt es mehrere Wege … den einfachsten als erstes und dann noch alternative Wege“):
  22 Aufgaben zeigen unter der Lösung „Andere Wege“ (z. B. Schuss als eigene Kachel, Menge per mehrmals tippen / + /
  Mengenknopf / „…“, Stimmt so statt Aufrunden, Reklamation/Entnahme/Trinkgeld auch über MEHR bzw. Menü ☰). Jeder Weg
  in der Kasse durchgespielt, Beträge gleich. Liste jetzt 10 Seiten, Karteikarten weiter 26 Seiten.
* 08.10.2026 (Betreiber: „Karten kleiner, mehr nebeneinander/untereinander, damit ich Papier spare“): Karteikarten jetzt
  3 × 3 = 9 je Blatt (62 × 91 mm, Lösungsschrift 9,2 pt, 7 Blätter statt 13) als Standard und Sparversion
  `Kassen-Training_Karteikarten_klein.pdf` 3 × 4 = 12 je Blatt (62 × 67 mm, lange Lösungen bis 6,8 pt, 5 Blätter).
* 08.10.2026 (Betreiber: „Unterscheidung einfach, mittel, schwer … Ampelsystem … hinten anklickbar, ob der User es
  wusste … die ganz kleine Größe ist nicht so gut … zwei oder mehr Geparkte zusammenführen muss mit rein“):
  - Jede Aufgabe hat eine Ampel-Stufe (14 einfach / 22 mittel / 13 schwer): Karteikarten oben ein farbiges Band mit
    Ampel (grün/gelb/rot) vorne und hinten, Übungsliste farbiges Nummernfeld mit „einfach/mittel/schwer“.
  - Karteikarten-Rückseite: Kästchen ✓ / ✗ für drei Durchgänge.
  - Neu `schulung/uebungsliste/karten.html` („Karten online“): eine Karte nach der anderen, „Lösung zeigen“, dann
    „✓ Gewusst“ / „✗ Nicht gewusst“; Filter einfach/mittel/schwer, „Noch offen“, „Stapel Üben“, Mischen. Ergebnisse im
    selben Gerätespeicher wie die Übungsliste (`kc.uebungsliste.v1`).
  - Sparversion 3 × 4 (`Kassen-Training_Karteikarten_klein.pdf`) entfernt, nur noch 3 × 3 = 9 je Blatt.
  - Neue Aufgaben: geparkte Bons verbinden + ALLE HOLEN (23,00 €), Verbindung lösen, ½-Portion auflösen per 🗑
    (Stand app.js r53) – in der Kasse durchgespielt. Jetzt 49 Aufgaben, Liste 12 Seiten, Karten 14 Seiten.
* 08.10.2026 Version 2 (Betreiber: „prüfe, ob alle möglichen Sachen an der Kasse abgedeckt sind, außer Tagesabschluss“):
  Alle Knöpfe der Oberfläche KC003, MEHR und Zahlen-Seite durchgesehen; 12 neue Aufgaben, jede in der Schulungs-Kasse
  durchgespielt: Außer-Haus-Becher, 12 Stück über „… → Andere Menge“ (↶ zurück), zu wenig Geld („NOCH … FEHLEN“),
  Gutschein verkaufen und einlösen, altes Glas zurück + neues Getränk,
  Kontostände, Währungsrechner, Bildschirm sperren, Kommen & Gehen, Dienstplan, Stoßzeiten. Zusätzlicher Weg bei
  „Glühwein weiß“ (Favoriten). Jetzt 61 Aufgaben (18 einfach / 29 mittel / 14 schwer), Liste 14 Seiten, Karten 16 Seiten.
  Nicht aufgenommen: Wertmarke (in der Kasse „noch nicht freigeschaltet“), Happy Hour (kein Angebot eingerichtet).
  Befund für den Betreiber: Gutschein-Teilzahlung fehlt – deckt das Guthaben den Bon nicht, meldet die Kasse
  „Teilzahlung ist noch nicht eingebaut“.
* Quelle: `werkzeuge/uebungsliste/daten.js` (Aufgaben) und `bauen.cjs` (erzeugt Webseite und PDF). Nach Änderungen an
  der Bedienung die betroffenen Schritte erneut durchspielen.

## Nachtrag 07.10.2026 – geparkte Bons verbinden (Kasse und Schulung)

Wunsch Betreiber: eine Gruppe trinkt, holt die nächste Runde, zum Schluss wird alles zusammen
gezählt. In der Liste „Geparkte Bons" (blaues/rotes P) jetzt:

- Bons **antippen = markieren** (☑). Unten eine Leiste mit **🔗 VERBINDEN** (ab 2 markierten)
  und **✂ LÖSEN** (wenn ein markierter Bon verbunden ist).
- Verbundene Bons stehen in einem braunen Rahmen „🔗 Verbunden 1 · 3 Bons · zusammen 12,50 €".
  **⬇ ALLE HOLEN** legt alles in EINEN Warenkorb (bei vollem Korb **＋ ALLE ANHÄNGEN**).
- Gleiche Positionen werden zusammengezählt (2× Rum + 1× Rum = 3× Rum). Halbe Portionen und
  Positionen mit eigenem Rabatt bleiben eigene Zeilen. Hatten die Bons verschiedene Bon-Rabatte,
  wird kein Rabatt übernommen und die Kasse meldet „bitte Rabatt neu setzen".
- Verbindung überlebt Neuladen (gleicher Speicher wie das Parken). Einzelnen Bon löschen oder
  einzeln holen: der Rest bleibt verbunden; bleibt nur einer übrig, ist es keine Gruppe mehr.

- **Gesamtzeile unten** (Wunsch Betreiber): Bons · Positionen · Stück · davon Pfand · **Gesamt** –
  für die markierten Bons, ohne Markierung für alle verbundenen. Gleiche Artikel zählen als eine Position;
  Pfand = Pfand je Artikel (automatisch/enthalten) plus Pfand-Artikel, Rückgaben negativ.

Dateien: `kc-oberflaechen-anwenden.js` 0.9.13, `kc-oberflaechen-anwenden.css` 0.9.23 (pos und
schulung/pos), Buildnummern in index.html und service-worker.js. Test: `tests/park-verbinden.test.cjs`.

## Nachtrag 07.10.2026 – halbe Portionen fest (Kasse und Schulung, app.js r53)

Wunsch Betreiber: „3 Glühwein, 2 wollen einen halben: oben zweimal ½ – dann stehen zwei eigene Zeilen mit 0,5.
Dort sind Plus/Minus gesperrt. Will der Kunde doch einen ganzen, geht das über den Mülleimer.“

- ½-Zeilen stehen fest auf 0,5: **+ / −** in der Zeile, die Mengenknöpfe unten und „andere Menge“ sind gesperrt
  (Hinweis: „½ Portion steht fest auf 0,5 – für eine ganze Portion den Mülleimer 🗑 antippen“).
- **🗑 auf einer ½-Zeile** fragt „½ Portion auflösen“ und legt den halben wieder zur ganzen Zeile zurück
  (z. B. 1× ganz + 2× ½ → 2× ganz + 1× ½). Gibt es keine ganze Zeile, wird die Zeile selbst wieder ganz.
  Soll der Artikel ganz weg: danach bei der ganzen Zeile −.
- **½ nochmal** auf einer ½-Zeile wirkt genauso (auflösen statt einer zweiten ganzen Zeile).
- Test: `tests/halbe-portion-sperre.test.cjs`. Für Übungsliste/Karteikarten: Aufgaben mit halber Portion prüfen.

## Nachtrag 08.10.2026 – Gutschein-Teilzahlung (Kasse und Schulung, app.js r54, kc-gutschein.js 0.2.0)

Wunsch Betreiber: „Dann baue Teilzahlung mit ein.“ Bisher meldete die Kasse bei zu kleinem Guthaben
„Teilzahlung ist noch nicht eingebaut“.

- **Gutschein prüfen** zeigt bei zu kleinem Guthaben jetzt **„3,50 € anrechnen – Rest 14,50 € kassieren“**.
  Das Guthaben kommt als feste Minus-Zeile „Gutschein GS-…“ in den Warenkorb (Muster wie die
  Reklamationszeilen: + / − / Mengenknöpfe / „…“ gesperrt, 🗑 löscht sie). Der Rest wird ganz normal
  kassiert (BAR, Rückgeld, KONTO, auch ein zweiter Gutschein).
- Abgezogen wird das Guthaben **erst beim Abschluss** des Bons (`completeSale`), nachdem der Bon
  gespeichert ist. Zeile gelöscht oder Bon verworfen → Gutschein unverändert. Trainingsbons verbrauchen
  kein Guthaben.
- Vor dem Abschluss wird geprüft: Gutschein vorhanden, nicht abgelaufen, Guthaben reicht noch; Bon nicht
  negativ (Gutschein höher als Bon → „Gutschein-Zeile löschen und neu einlösen“); kein Personal/Helfer.
  Derselbe Gutschein kann auf einem Bon nicht zweimal angerechnet werden.
- Buchung: `due` = kassierter Rest (Bargeld stimmt im Kassensturz), neues Feld `voucherPayments`
  [{code, amount}] am Bon; im Abschluss/X-Bericht zählt der Gutschein-Anteil zum **Umsatz** (Einlösen =
  Umsatz, siehe kc-gutschein.js), aber nicht zum Bargeld.
- Im Browser durchgespielt: 18,00 € Bon + 3,50 € Gutschein → 14,50 € bar, Rückgeld 5,50 €, Guthaben 0,
  Umsatz 18,00 €, Bargeld 14,50 €; zwei Gutscheine à 10 € auf 16,50 € → Bon fertig, Restguthaben 3,50 €.
- Offen (wie bisher auch beim vollen Einlösen): Storno eines Bons gibt das Gutschein-Guthaben nicht
  automatisch zurück; der PC-Manager wertet `voucherPayments` noch nicht gesondert aus.
- Test: `tests/gutschein-teilzahlung.test.cjs`; `tests/halbe-portion-sperre.test.cjs` prüft jetzt „r53 oder neuer“.
- Übungsliste/Karteikarten Version 2 (63 Aufgaben): neue Karte Gutschein-Teilzahlung, Zeiterfassung aufgeteilt
  in „mit Ausweis“ und „Ausweis vergessen“ (Geburtstag TTMMJJ – mit eingetragener Test-Person durchgespielt).

## Nachtrag 08.10.2026 – Gesamtprüfung der Kasse (app.js r56, Kasse und Schulung)

Auftrag Betreiber: „Check nochmals die komplette Kasse durch auf Logik, bedienerfreundlich, TÜV, Geschwindigkeit,
Sicherheit, Lücken.“ Drei Prüfrichtungen (Geldlogik, Sicherheit, Tempo/Robustheit) plus Bedien-/TÜV-Prüfung im Browser.
Behoben wurde nur, was im Browser nachgestellt und danach erneut durchgespielt wurde:

- **Datenverlust (schwerwiegend):** War die Startkarten-Verschlüsselung aktiv, galten nach einem Neustart alle älteren
  Bons als unlesbar (Umsätze werden VOR dem Kartenmodul geladen), und der nächste Verkauf schrieb den Bestand „neu“ –
  20 Bons → 1. Jetzt (kc-transaction-store.js 0.2.0): nie mehr `clear()`, normales Speichern hängt nur an, unlesbare
  Bons bleiben unangetastet und werden nach Freigabe des Schlüssels nachgeladen (kc-security-card-pos.js 0.1.1, dort
  auch die nach Neuladen fehlende Ausgabenummer ergänzt). Löschen nur noch beim ausdrücklichen Ersetzen (Backup,
  Vorführdaten). Nachgestellt: 20 Bons, Neustart, 1 Verkauf → 21 Bons, alle lesbar.
- **Tempo:** Speichern schreibt nur noch neue Bons und fasst Rückstau zusammen (50 Verkäufe bei 3000 Bons: Rückstand
  0,3 s statt 157 s); Auto-Favoriten werden nur nach neuem Bon neu gezählt (Antippen 15 ms statt 67 ms bei 3000 Bons).
- **Reklamation „Auszahlung“ (3-Schritt-Weg):** zog das Geld doppelt vom erwarteten Kassenbestand ab (−7,00 statt
  −3,50 €). Das Protokoll hat jetzt Betrag 0 und `erstattungImBon`; das Geld läuft nur über die Minus-Zeile im Bon.
- **Gutschein:** Vollzahlung buchte bei Doppeltipp/Abbruch ab ohne Bon und im Training echtes Guthaben; Storno gibt
  Guthaben jetzt zurück (Teil- und Vollzahlung) und dreht den Umsatz-Anteil zurück (kc-gutschein.js 0.2.1).
- **Personal/Helfer:** Bon mit Gutschein-Zeile gesperrt; bricht der Abschluss ab, kommt das Pfand zurück in den Bon.
  Storno eines Personal-/Helferbons senkt den Umsatz nicht mehr (`originalType`).
- **Konto:** Doppeltipp auf „AUF KONTO BUCHEN“ stürzt nicht mehr ab.
- Test: `tests/kasse-pruefung-08-10.test.cjs`.

Nicht geändert, Entscheidung des Betreibers nötig (siehe Bericht im Chat): Entwicklerzugang zum Adminbereich ist
eingeschaltet (`shared/runtime-flags.js` candidateTestAccess), Kassen-Tokens liegen öffentlich in
`pc-manager/kassen-verbindungen.json`, Trainingsmodus für jeden Bediener umschaltbar, Fernbefehle/Manager-Kanal ohne
Absicherung gegen fremde Webseiten, Service-Worker-Update nicht atomar, große PNG-Bilder (34 MB Vorabspeicher),
Gutschein-Verkauf nicht im Kassenbestand, Gutschein nur an der ausstellenden Kasse einlösbar.

### Zweite Runde 08./09.10.2026 (app.js r57) – Betreiber: „erst mal nur Abstürze, falsche Berechnungen, Fehlbedienung; an Zugang usw. noch nichts ändern“

- **Abschluss abgesichert:** Nach dem Speichern eines Bons ist jeder Folgeschritt (Gutschein, Meldung an den Manager,
  Ton, Bonnummer speichern, Anzeige) einzeln abgesichert – ein Fehler dort ließ den Warenkorb voll (Doppelbuchung möglich).
  Nachgestellt: Ton wirft einen Fehler → 1 Bon, Warenkorb leer.
- **Konto/Gutschein-Bon:** zeigte vorher angetippte Scheine als „Gegeben/Rückgeld“ – jetzt 0.
- **PERSONAL bei Minus-Bon (Pfandrückgabe):** buchte ohne Rückfrage eine Spende – jetzt Rückfrage „Pfand als Spende buchen?“.
- **Geparkten Bon anhängen:** Rabatt des geparkten Bons ging verloren bzw. ein Bon-Rabatt galt auch für fremde Zeilen –
  jetzt gilt jeder Rabatt nur für seine Zeilen; zwei verschiedene Rabatte → Hinweis (kc-oberflaechen-anwenden.js 0.9.14).
  Nachgestellt: 8,00 € (20 %) + 5,50 € = 13,50 € (vorher 15,50 €).
- **Gutschein-Verkauf** zählt jetzt zum erwarteten Bargeldbestand (Anzahlung, kein Umsatz); X-Bericht mit „Gutscheine
  verkauft“ und „Mit Gutschein bezahlt“; Gültigkeit bis 31.12. des dritten Folgejahres (kc-gutschein.js 0.2.2).
- **Zeiterfassung:** Minutenrad rundete 14:58 auf 14:00 statt 15:00 (time-clock-pos.js 0.1.2).
- **Netz:** Abfragen ohne Zeitlimit (Team-Status, Bargeldübergabe) brechen nach 4 s ab; die Nachmelde-Warteschlange
  an den Manager verwirft nicht mehr still, sondern meldet es sichtbar (kc-sync-live-event.js 0.1.1).
- Zusätzlich gemeldet, nicht geändert: Wird der Schulungs-Link auf einem echten Kassen-Tablet geöffnet, bleibt dieses
  Gerät im Schulungsmodus (Band „SCHULUNG … kein Umsatz“), bis `?schulung=0` aufgerufen wird.

## Nachtrag 09.10.2026 – Reklamation mit Bildern und Anzahl (kc-reklamation.js 0.2.0, app.js r58, Kasse und Schulung)

Wunsch Betreiber: „Unter Reklamation die Warengruppen wie auf der Kassenseite anzeigen und darunter jeweils die Bilder
der Artikel mit einer Anzahl – z. B. 3 kalte Glühwein, die zusammen bestellt wurden. Auf die Bildgröße achten, dass
alles sauber drauf passt und gut zu erkennen ist. Schuss Rum und Amaretto muss berücksichtigt werden.“

- Schritt 1: Warengruppen oben, darunter Bildkacheln (Bild quadratisch, ganz sichtbar; Name und Preis darunter).
  Jedes Antippen zählt 1 Stück, rote Zahl auf der Kachel. Bei Artikeln mit Schuss darunter „+ Rum“ / „+ Amaretto“.
  Rechts „Reklamiert“ mit − / +, Stückzahl, Summe und „Weiter → Grund“. Mehrere Artikel in einem Vorgang.
  Pfand, Pfand-Rückgaben, Wertmarke und freie Beträge erscheinen nicht.
- Schritt 2 (Grund) und 3 (Ersatz / Auszahlung / Nichts) wie bisher, mit Liste und Summe. Auszahlung = je Posten eine
  feste Minus-Zeile mit Menge (z. B. „Reklamation · Glühwein rot ×2 −7,00 €“, „… + Schuss Rum ×1 −4,50 €“), dann BAR;
  Ersatz = ein 0-€-Bon mit allen Posten; Protokoll mit allen Artikeln (Bargeldbetrag 0, siehe Nachtrag 08.10.).
- Geprüft bei 1280×800, 1024×768 und 800×1280 (Bilder 160 / 144 / 127 px, keine abgeschnittenen Namen,
  deutsche Silbentrennung). Buchung `kcReklamationBuchenPosten()` in app.js; der bisherige `kcReklamationBuchen()`
  bleibt unverändert erhalten. Test: `tests/reklamation-mehrere-artikel.test.cjs`.
- Übungsliste/Karten (64 Aufgaben): Reklamations-Aufgaben auf den neuen Ablauf umgestellt, neue Aufgabe
  „3 kalte Glühwein, einer mit Rum“ (11,50 €), im Browser durchgespielt.
- Beobachtung (nicht geändert): Die Schulungs-Kasse zeigt nach einer Auszahlung kein Fenster „Auszahlung … Fertig“,
  sondern nur einen grünen Hinweis – anders als die echte Kasse.

## Nachtrag 09.10.2026 – Handbuch 4.2 und Lernmaterial Version 3

Betreiber: „Passe das Handbuch an und die Karteikarten zum Lernen.“
- **Kurzanleitung Bilderrechner Version 4.2** (33 Seiten) in der Club-App unter Meine Dokumente (kc-clubapp 2.154.1,
  Datei `dokumente/Kurzanleitung_Bilderrechner_V4.2.pdf`, Version 4.1 bleibt erhalten). Teil 7 neu: Reklamation mit
  Bildkacheln und Anzahl, Pfand als Spende mit Rückfrage, Personalverbrauch/Konto/Menge mit aktuellen Bildern.
  Neuer Teil 8: geparkte Bons verbinden, halbe Portion fest auf 0,5, Gutschein-Teilzahlung. Gutschein-Gültigkeit
  „bis 31.12. des dritten Jahres“. Alle Bilder neu aus der laufenden Kasse (Tablet 1024×768).
- **Übungsliste und Karteikarten Version 3** (64 Aufgaben): Hinweis, dass die Schulungs-Kasse nach einer Auszahlung
  nur einen grünen Hinweis statt des Fensters zeigt; Verweis auf die Kurzanleitung 4.2; Reklamation mit Bildern.

## Nachtrag 09.10.2026 – Schulungs-Kasse zeigt dieselben Fenster wie die echte Kasse (schulung/pos/app.js r59)

Betreiber: „Ja, passe beide Kassen an.“ Die Schulungs-Kasse hatte nach dem Abschluss noch einen älteren Zwischenstand
(Meldungszeile, die von allein verschwindet) statt der Fenster der echten Kasse. Jetzt identisch: Auszahlung
(„Betrag an den Kunden auszahlen“), Personalverbrauch, Helfer-Verpflegung, „Verkauf abgeschlossen“ mit Rückgeld –
jeweils mit „Fertig“; normaler Verkauf ohne Rückgeld wie bisher ohne Fenster. Im Browser verglichen (fünf Fälle, beide
Kassen gleich). Echte Kasse unverändert (Build r59 nur zur gemeinsamen Kennung). Hinweise dazu in Übungsliste und
Karteikarten entfernt.

## Nachtrag 09.10.2026 – Meldungen schließen von allein (app.js r60, Kasse und Schulung)

Betreiber: „Bau ein in beide“ (Meldungen nach der Buchung sollen von allein weggehen, Wunsch vom 10.09.).
- `showMessageAuto()`: Fenster wie bisher, darunter eine grüne Leiste, die in 4 Sekunden abläuft; dann schließt es
  sich. „Fertig“ schließt sofort. Gilt für Verkauf mit Rückgeld, Personalverbrauch, Helfer-Verpflegung und Konto.
- **Auszahlung bleibt stehen**, bis „Fertig“ getippt ist (sonst wird leicht vergessen auszuzahlen). Eine normale
  Meldung beendet einen laufenden Zeitgeber, damit nie ein Auszahlungsfenster versehentlich zugeht.
- Schulungs-Kasse zeigt jetzt auch bei Konto dasselbe Fenster. Im Browser in beiden Kassen geprüft.
- Übungsliste/Karteikarten angepasst. Test: `tests/meldung-schliesst-selbst.test.cjs`.

## Nachtrag 10.10.2026 – Kleine Artikelbilder auf allen Geräten, Zeitgrenze für Supabase-Meldungen

Betreiber: „Ja umbauen, aber die alten Bilder noch nicht löschen. Wenn es nicht gut aussieht, kannst du evtl. die
alten wieder laden.“
- **Artikelbilder** (Kasse und Schulung, `kc-altbrowser.js` Build 1.1.0): Die Kacheln, das Reklamationsfenster und
  die Kombi-Bilder zeigen jetzt die vorhandenen kleinen Kopien `assets/klein/*_version_3.webp` (640 px) statt der
  großen PNGs (1254 px). Vorher galt das nur für alte Browser. Geladen werden statt 27,6 MB nur noch 0,7 MB; im
  Browser bei doppelter Bildschirmschärfe nebeneinander verglichen, sichtbar gleich.
- **Die großen PNGs bleiben im Ordner `assets/`.** Sie werden nur nicht mehr vorab offline gespeichert
  (Service Worker; `werkzeuge/offline-liste.py` lässt PNGs mit kleiner Kopie weg). Rückweg: in `kc-altbrowser.js`
  `KLEINE_BILDER = false` setzen (neue Buildkennung, PNGs wieder in die Offline-Liste), oder für ein einzelnes Gerät
  `localStorage["kc.bilder"] = "gross"`. Fehlt eine kleine Kopie, kommt automatisch das große Bild.
- **PC-Manager Datenfluss-Melder** (`kc-datenfluss-melder.js` Build 1.0.1, Manager und Schulungs-Manager): Meldung
  und Lebenszeichen an Supabase brechen nach 8 s ab und werden als Fehler vermerkt, statt bei hängender Verbindung
  offen zu bleiben. Kassenverkäufe laufen nicht über diese Datei.
- Tests: `tests/altbrowser-regeln.test.cjs` (erweitert), `tests/datenfluss-zeitlimit.test.cjs` (neu).

## Nachtrag 10.10.2026 – Übungsliste und Karteikarten Version 3.1 (68 Aufgaben)

Betreiber: „Prüfe nochmal, ob jetzt alle Geschäftsfälle abgedeckt sind und logisch und alle alternativen Wege
aufgebaut sind.“ Alle Knöpfe der Kasse (Hauptseite, Warenkorb, MEHR/☰) mit den Aufgaben abgeglichen; neue und
geänderte Wege in Kasse und Schulungs-Kasse im Browser nachgespielt.
- **Rechenfehler behoben (Aufgabe 50, drei kalte Glühwein):** Die Reklamation erstattet nur das Getränk. Gibt der
  Kunde die Gläser mit ab, gehören 3× Glasrückgabe dazu – 17,50 € statt 11,50 € (in der Kasse geprüft).
- **Neu:** Gutschein-Restwert abfragen (Nr. 29) · zu viel berechnet, Bon schon bezahlt → Reklamation „Falscher
  Artikel“ + Glasrückgabe, 5,50 € (Nr. 51) · Wechselgeld vom Kassenwart über Bargeldübergabe/Kurzcode (Nr. 67) ·
  WLAN weg, weiter kassieren (Nr. 68, Verkauf ohne Netz geprüft).
- **Korrigiert:** Aufgabe 17 „Unten …“ → „Oben im Warenkorb …“.
- **Weitere Wege ergänzt:** Mengenknopf zweimal kurz hintereinander zählt zusammen (6 + 6 = 12) · MEHR →
  Pfandrückgabe · Reklamation „NICHTS“ bzw. Auszahlung statt Ersatz · MEHR → Letzten Bon / Bonnummer suchen ·
  MEHR → Bediener wechseln · MEHR → Stoßbetrieb.
- Bewusst ohne Aufgabe: Tagesabschluss (Betreiber), Wertmarke (noch nicht freigeschaltet), Training/Vorführdaten/
  Servicefreigabe (geschützter Bereich, Zugang bleibt unverändert).
- Kleinste Lösungsschrift auf den Karten 8,1 pt; Aufgaben 1–18 unverändert (Probedruck bleibt gültig).

## Nachtrag 10.10.2026 – Karteikarten Version 4 (Druck auf 200 g, weniger Schneiden)

Betreiber nach Probedruck: Schrift zu klein, vorne viel Platz, Karten dürfen größer werden, nur ein Schnitt zwischen
den Karten, mehrere Kästchen nebeneinander, Nummer immer auf gleicher Höhe, „ZUSÄTZLICH“ unklar.
- Karten 64,7 × 93,7 mm ohne Zwischenraum, 8 mm Blattrand, Schnittmarken nur am Rand: 8 durchgehende Schnitte je
  Blatt statt 12. In jeder Karte 3 mm Sicherheitsrand. `VX`/`VY` verschieben bei Bedarf nur die Rückseiten.
- Schrift füllt die Karte (Halbierungssuche): Kundensatz 14,7–22 pt, Lösung 8,5–13 pt gedruckt. Nummer und Thema fest
  unter der Kopfzeile. Rückseite: zwei Reihen mit je 5 Kästchen „✓ Gewusst“ / „✗ Nicht gewusst“, darunter
  „← Stapel ‚Kann ich‘ · Stapel ‚Üben‘ →“.
- Letztes Blatt aufgefüllt: Stapelkarten „Kann ich“ und „Üben“, zwei leere Karten „Eigene Aufgabe“.
- Markierung „ZUSÄTZLICH“ (nur intern: nachträglich ergänzte Aufgaben) aus Karten, Liste und Online-Karten entfernt.
- Texte der Karten 17, 29, 33, 51, 54, 67 gekürzt (Inhalt unverändert), Kundensatz 51 umformuliert.
