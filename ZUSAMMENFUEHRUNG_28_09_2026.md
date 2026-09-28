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
