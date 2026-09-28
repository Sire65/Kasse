# TSE-Relay – Kassenseite (Entwicklung / experimentell)

Stand: 28.09.2026 · Modul `pos/kc-tse-relay.js` (auch `schulung/pos/`) Version 0.1.0 · Status: **DEV, nicht für den Echtbetrieb freigegeben**

## Zweck
Die Kasse schickt nach jedem abgeschlossenen Vorgang eine Signieranfrage an den TSE-Dienst auf dem
Mini-PC am Stand (Swissbit-TSE). Der Dienst selbst ist **nicht** Teil dieses Repos.

## Grundregel (Betreiber)
„Es darf unsere jetzige Kasse in keiner Weise unbrauchbar machen.“

* Schalter `tseEntwicklungAktiv` steht standardmäßig auf **aus**. Dann gilt: keine Netzabfrage, kein
  Zeitgeber, kein Hinweis und keine neuen localStorage-Einträge. Die Kasse verhält sich exakt wie vorher.
* Eingeschaltet wartet der Verkauf nie auf den Mini-PC. Die Anfrage startet erst **nach** dem
  vollständigen Abschluss (Bon gespeichert, Warenkorb leer, Meldung da), wird nicht abgewartet
  und bricht nach 2 Sekunden ab.

## Einstellungen
Einstellungen → Tab **🧪 TSE (Entwicklung)** (nur nach Service-Anmeldung sichtbar):

| Feld | Speicherort | Standard |
|---|---|---|
| TSE-Relay (Entwicklung) aktiv | `state.master.tseEntwicklungAktiv` | `false` |
| Adresse des Mini-PC-Dienstes | `state.master.tseRelayAdresse` | leer |
| Passwort Mini-PC (Token) | `localStorage.kc_tse_relay_token_v1` (bewusst **nicht** in `state.master`, damit es nicht in Exporte, Sync oder Backups wandert) | leer |

Zusätzlich gibt es die Knöpfe „Verbindung testen“ (`/health`, nimmt auch die noch nicht gespeicherte
Adresse) und „Offene jetzt nachtragen“.

## Ablauf
1. `completeSale()` → am Ende (nur ohne Training und nur bei eingeschaltetem Schalter)
   `KCTseRelay.signiereVorgang(rec)`.
2. `POST /signieren` mit `{transaktionId, kasseId, vorgangsart:"Kassenbeleg-V1", startzeit, endzeit, betragCent}`
   und `Authorization: Bearer <token>`. Dabei gilt: `transaktionId` = `rec.transactionId`,
   `betragCent` = `rec.dueCents` (bei Auszahlungen negativ), `startzeit`/`endzeit` = `rec.startTime`/`rec.endTime`.
3. Bei Erfolg wird die Signatur in `kc_tse_signaturen_v1[transactionId]` abgelegt.
4. Bei Fehler, 503 oder Timeout wird der Vorgang als `status:"ausstehend"` markiert und in
   `kc_tse_offen_v1` aufgenommen. Diese Liste übersteht einen Neustart.
5. Alle 30 s (und 1,5 s nach dem Start) läuft das Nachtragen, solange etwas offen ist:
   `GET /health` → `POST /warteschlange/verarbeiten` → `GET /warteschlange` → `POST /signieren` für jeden
   lokal offenen Vorgang, den der Dienst nicht mehr selbst als offen führt. Pro Runde werden höchstens 20 Vorgänge bearbeitet.
6. Solange etwas offen ist, zeigt der Kopfbereich einen kleinen Hinweis „TSE ⏳ n“.

## Warum die Signatur nicht am Bon steht
Jeder Bon trägt eine Prüfsumme über den ganzen Datensatz (`canonicalTransaction` → `recordHash`).
Ein nachträglich angehängtes `rec.tse` würde die Ledger-Prüfung als Manipulation melden. Deshalb
gibt es eine eigene Liste, zugeordnet über die `transactionId` (mit dem Betreiber abgestimmt).

## Anforderungen an den Mini-PC-Dienst (bitte an den anderen Auftrag weitergeben)
* **CORS**: Die Kasse läuft im Browser. Der Dienst muss `OPTIONS`-Preflight beantworten und
  `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization, Content-Type` sowie
  `Access-Control-Allow-Methods: GET, POST, OPTIONS` senden. Sonst blockt der Browser jede Anfrage.
  Je nach Chrome-Version kann zusätzlich `Access-Control-Allow-Private-Network: true` nötig sein.
* **Idempotenz**: `/signieren` mit einer bereits signierten `transaktionId` muss die **vorhandene**
  Signatur zurückgeben und darf nicht neu signieren. Die Kasse wiederholt Anfragen, bis sie eine
  Signatur hat. `/warteschlange/verarbeiten` liefert keine Signaturen, darum holt die Kasse sie danach
  per `/signieren` ab.
* **http vs. https**: Wird die Kasse über `https://` geladen (z. B. GitHub Pages), blockt der Browser
  Aufrufe an `http://192.168…`. Das funktioniert nur, wenn die Kasse selbst über `http://` im WLAN
  geladen wird (Markttag-Start) oder wenn der Dienst https anbietet.

## Bekannte Grenzen
* Die Signaturliste liegt im localStorage (~250 Byte pro Vorgang). Das reicht für die Entwicklung.
  Vor einem Echtbetrieb sollte sie in die IndexedDB wandern (localStorage ≈ 5 MB pro Gerät).
* Storno (`requestCompletedReversal`) und Reklamation laufen nicht über `completeSale()` und werden
  deshalb (noch) nicht signiert.

## Tests
`tests/tse-relay.test.cjs` (mit Nachbau des Dienstes: `tests/tse-relay-mock.cjs`), 39 Prüfpunkte, echt im
Browser. Abgedeckt sind:

* Schalter aus = keine Anfrage
* Body und Token exakt nach Schnittstelle
* Signatur wird gespeichert, Bon-Prüfsummen bleiben gültig
* hängender Mini-PC: Verkauf bleibt sofort (< 700 ms, gemessen 9–24 ms)
* 503 mit Warteschlange
* Neustart
* automatisches Nachtragen
* 30-s-Takt
* Training
* Einstellungen, Passwort nicht im Master

Aufruf: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/tse-relay.test.cjs`.
Screenshots: zusätzlich `KC_TSE_SCREENSHOTS=<ordner>` setzen.
Mock einzeln starten: `node tests/tse-relay-mock.cjs 8765` (Token `geheim-123`).
