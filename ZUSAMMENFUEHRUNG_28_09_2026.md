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
