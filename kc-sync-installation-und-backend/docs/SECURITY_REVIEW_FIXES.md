# Korrekturen nach Security-Review (2026-07-25)

**Hinweis zur Zuordnung:** Ich konnte die verlinkte Datei mit den Kennungen `S-01`/`S-02`/`S-03`/
`I-01`/`I-02` nicht öffnen (lokaler Pfad auf deinem Rechner, kein Zugriff möglich). Die folgende
Zuordnung ist meine plausibelste Vermutung anhand der Beschreibung im Chat – bitte kurz
gegenprüfen, ob sie mit deiner Datei übereinstimmt.

## S-01 – Fingerprint aus ungesicherter Erst-Antwort übernommen

**Vorher:** `pair()` rief zuerst unauthentifiziert `/health` auf und übernahm den dort gemeldeten
Fingerprint blind als Vertrauensanker.

**Jetzt:** `pair()` verlangt zwingend einen `expectedFingerprint`-Parameter, der von außen kommen
muss (im echten Betrieb: aus dem QR-Code selbst, dort stünde er neben Token/Adresse). Schon der
allererste `/health`-Aufruf wird gegen diesen unabhängig bekannten Fingerprint geprüft. Ohne
`expectedFingerprint` wirft `pair()` sofort einen Fehler – kein blindes Erstvertrauen mehr möglich.

`device-companion/index.js`, Funktion `pair()`.

## S-02 – Zertifikatsprüfung erst nach dem Versand

**Vorher:** Anfragekörper (inkl. Credential) wurde sofort geschrieben; die Fingerprint-Prüfung
erfolgte erst beim Lesen der Antwort – zu spät, die Daten hatten die Gegenstelle da schon erreicht.

**Jetzt:** `_request()` sendet den Anfragekörper erst im `secureConnect`-Ereignis des TLS-Sockets,
nachdem der präsentierte Zertifikats-Fingerprint geprüft wurde. Bei Abweichung wird die Anfrage
per `req.destroy()` abgebrochen, **bevor** irgendetwas gesendet wurde.

`device-companion/index.js`, Funktion `_request()`.

## S-03 (vermutet) / I-01 – Credential nicht an Geräte-ID gebunden

**Vorher:** `_push()`/`_status()` nutzten die im Anfragekörper mitgeschickte `deviceInstanceId`
direkt, ohne zu prüfen, ob sie zu dem authentifizierten Credential passt. Ein gültiges Credential
für Gerät X konnte Ereignisse im Namen eines beliebigen anderen Geräts Y einreichen.

**Jetzt:** Nach der Authentifizierung wird `body.deviceInstanceId` zwingend mit der beim Credential
hinterlegten `device_instance_id` verglichen; bei Abweichung `403 device_identity_mismatch`. Gilt
für `_push()` und `_status()`.

`manager-companion/index.js`, Funktionen `_push()`, `_status()`.
Neuer Test: „Befund I-01: Credential ist fest an die Geräte-ID gebunden …“

## I-02 – Widerrufs-Endpunkt unauthentisiert

**Vorher:** `/api/v1/credential/revoke` prüfte gar nichts – jedes Gerät im Netz konnte jedes
andere Credential widerrufen (Denial-of-Service).

**Jetzt:** `_revoke()` prüft `req.socket.remoteAddress` und akzeptiert nur Loopback-Aufrufe
(`127.0.0.1`/`::1`). Widerruf ist eine Operator-Handlung **am Manager selbst**, keine
netzwerkweite Kassen-Schnittstelle. Alles andere liefert `403 admin_only_loopback`.

`manager-companion/index.js`, Funktion `_revoke()`.
Neuer Test: „Befund I-02: Widerruf ist nur vom Manager selbst (Loopback) aus zulässig“ (prüft die
Handler-Logik direkt mit einer simulierten Fremd-Adresse, da in einer lokalen Testumgebung jede
echte Verbindung ohnehin über 127.0.0.1 hereinkäme).

## Fehlende echte SQLite-Transaktionen

**Vorher:** Mehrschrittige Vorgänge (Beleg+Sequenznummer auf der Kasse; Token-Verbrauch+Credential
auf dem Manager; die gesamte Ereignis-Schleife eines Sync-Push) bestanden aus mehreren
unabhängigen `.run()`-Aufrufen ohne Transaktionsklammer.

**Jetzt:** Alle drei Stellen sind in echte `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`-Blöcke
gefasst (`node:sqlite` unterstützt das über `db.exec()`). Ein Absturz mitten im Vorgang hinterlässt
keinen inkonsistenten Zwischenstand mehr.

`device-companion/index.js` (`recordEvent()`), `manager-companion/index.js` (`_pair()`, `_push()`).

## Testaussage nicht reproduzierbar

**Duplikattest sendete faktisch nur einmal:** Der alte Test rief `sync()` viermal auf, aber nach
dem ersten Erfolg stand nichts mehr in der Outbox – die Wiederholungen sendeten schlicht nichts.
**Jetzt:** Der Test legt das bereits bestätigte Ereignis der Manager-API direkt erneut vor (unter
Umgehung der Outbox-Filterung), das ist der tatsächliche Test der serverseitigen Idempotenz.

**mDNS-Test:** Ich konnte in meiner Umgebung keinen Fehlschlag reproduzieren (4 von 4
Testläufen erfolgreich), mDNS/Multicast kann sich aber je nach Netzwerkumgebung/Namespace
unterschiedlich verhalten. Der Test versucht jetzt bis zu dreimal mit je 5 Sekunden Zeitlimit,
bevor er als fehlgeschlagen gilt – das macht ihn robuster gegen langsame Multicast-Antworten,
löst aber nicht jede mögliche Umgebungseinschränkung. Falls der Test in eurer Umgebung weiterhin
fehlschlägt, wäre das ein eigener, wichtiger Befund zur Netzwerkumgebung selbst.

## Ein während der Korrektur selbst gefundener und behobener Fehler

Beim Umbau der Zertifikatsprüfung auf „vor dem Senden prüfen" (S-02) traten alle Tests mit
„socket hang up" fehl – Ursache: Node wiederverwendet TLS-Verbindungen (Keep-Alive), bei einer
wiederverwendeten Verbindung feuert `secureConnect` nicht erneut, wodurch die Anfrage nie
tatsächlich abgeschickt wurde. Behoben mit `agent: false` (erzwingt eine frische Verbindung je
Anfrage) – für dieses sicherheitskritische Pinning ohnehin die richtige Wahl, nicht nur ein
Workaround.

## Ergebnis

7 von 7 Tests bestehen (5 bestehende + 2 neue für I-01/I-02), 4 von 4 Wiederholungsläufen ohne
mDNS-Fehlschlag in meiner Umgebung. Weiterhin: keine Aussage „sicher“, „TÜV-geprüft“ oder
„produktionsreif“, keine echten Umsätze, kein Feldversuch bis zum zweiten Security-Review.

---

# Zweite Korrekturrunde – vollständiger Bericht mit S-04, S-05, S-06, C-01, R-01

Der ausführlichere, vollständige Bericht traf ein, nachdem die erste Runde (oben) bereits
abgeschickt war. Bestätigt: S-01, S-02, S-03, I-01, I-02 (Atomarität) waren zu diesem Zeitpunkt
bereits behoben (u. a. erkennbar daran, dass der Bericht `simulateResponseDrop()` als "existiert,
wird aber nicht verwendet" nennt - das war die alte Version). Sechs weitere, echte Befunde kamen
neu hinzu und wurden alle geprüft und behoben:

## S-04 – Anfragekörper unbegrenzt

**Vorher:** `_handle()` sammelte den kompletten Body ohne Größenbegrenzung.
**Jetzt:** harte Obergrenze von 256 KB, Abbruch mit `413 payload_too_large` sobald überschritten,
bevor der Rest überhaupt gelesen wird. Zusätzlich `server.timeout`/`headersTimeout` gegen
hängende/langsame Verbindungen sowie ein einfaches Ratenlimit (max. 10 Versuche/Minute je
Adresse) auf `/api/v1/pair`.

## S-05 – Privater Schlüssel im Klartext in der Betriebsdatenbank

**Vorher:** TLS-Private-Key lag als Textspalte in derselben SQLite-Datei wie Kopplungen/Umsätze.
**Jetzt:** eigene Datei (`<datenbank>.key.pem`) mit `0600`-Rechten (nur Besitzer), getrennt von
den Betriebsdaten. Nur Zertifikat (öffentlich) und Fingerprint bleiben in der SQLite-Datei. Neuer
Test prüft explizit sowohl die Dateirechte als auch, dass kein Schlüsselmaterial in der
Datenbankdatei selbst steht.

## S-06 – Pairingtoken wird vor Payload-Prüfung verbraucht

**Vorher:** Token wurde als erste Aktion verbraucht, Payload-Prüfung kam danach.
**Jetzt:** Payload wird zuerst geprüft; der Token wird erst danach über ein bedingtes
`UPDATE ... WHERE used = 0` verbraucht – das schützt zusätzlich gegen gleichzeitige
Mehrfachverwendung (neuer Test: zwei parallele Kopplungsversuche mit demselben Token, nur einer
darf gewinnen).

## C-01 – Falscher Fingerprint-Begriff (ganzes Zertifikat statt Schlüssel)

**Vorher:** SHA-256 über das komplette DER-Zertifikat – jede Zertifikatserneuerung mit
unverändertem Schlüssel hätte den Pin fälschlich gebrochen.
**Jetzt:** SHA-256 über das SPKI (Subject Public Key Info), also über den öffentlichen Schlüssel
selbst – echtes Public-Key-Pinning. Musste auf **beiden** Seiten (Manager-Erzeugung und
Kassen-Prüfung) konsistent geändert werden, sonst hätten die Werte nicht mehr zusammengepasst;
das wurde direkt gegengetestet.

## I-02 (erweitert) – fehlende Feldvalidierung

**Jetzt zusätzlich geprüft:** Batch-Obergrenze (200 Ereignisse), erlaubte Ereignistypen
(`sale`/`void`/`closing`), Ganzzahligkeit und Positivität der Sequenznummer, Nutzlastgröße je
Ereignis (max. 8 KB). Ungültige Einzel-Ereignisse landen in `rejected`, ohne den Rest eines sonst
gültigen Batches zu blockieren (getestet).

## R-01 – Paket nicht release-sauber

**Gefunden und bestätigt:** ein wortwörtlich benannter Ordner `{manager-companion,device-companion,
tests,docs}` (Rest eines fehlgeschlagenen `mkdir -p {a,b,c}`-Befehls) sowie `package.json` mit
`main: index.js`, obwohl keine solche Datei existiert.
**Jetzt:** Ordner entfernt, `main` entfernt, `engines.node` ergänzt. `node_modules` wird nicht
mehr mitgeliefert – stattdessen liegt `package-lock.json` bei; `npm ci && npm test` wurde in einem
frisch aufgesetzten Verzeichnis nachweislich erfolgreich durchgeführt (reproduzierbare
Installation, nicht nur behauptet).

## T-01 – mDNS-Test schlug im Review mit Node v24.14.0 fehl

Ich habe in meiner Umgebung (Node v22.22.2) 4 von 4 Wiederholungsläufen ohne Fehlschlag. Ich kann
Node v24 hier nicht nachstellen und daher nicht ausschließen, dass `bonjour-service` sich dort
anders verhält. `engines.node` wurde auf `>=22.5.0` gesetzt (Mindestversion für `node:sqlite`),
eine Ausschlussgrenze nach oben für v24 kenne ich nicht und behaupte sie nicht. Das bleibt ein
offener Punkt, der auf einem echten Node-v24-System nachgestellt werden müsste.

## T-02 – Duplikattest weiterhin unzureichend

Bestätigt: `simulateResponseDrop()` existierte, wurde aber tatsächlich nirgends verwendet. Neuer
Test „Response-Drop nach Commit + echte Wiederholung" nutzt sie jetzt gezielt: Server committet,
Antwort wird verworfen, die Kasse merkt es nicht und sendet real erneut – genau das im Bericht
geforderte Szenario.

## Abgedeckte Pflicht-Negativtests (von 14 geforderten)

Jetzt automatisiert abgedeckt: 3 (fremde Device-ID), 4 (unautorisierter Widerruf), 5+6 (Abbruch
zwischen Teilschritten – über echte Transaktionen strukturell ausgeschlossen, nicht nur getestet),
7 (Response-Drop + echte Wiederholung), 8 (gleichzeitige Tokenverwendung), 9 (übergroße
Bodies/Batches), 11 (Sequenzvalidierung).

**Weiterhin offen** (Aufwand über das hier Leistbare hinaus): 1 (aktiver MITM-Nachweis mit
Netzwerk-Tooling), 2 (Nachweis "kein Byte gesendet" bräuchte Paket-Mitschnitt statt
Anwendungslogik), 10 (Credential-Rotation/Restore auf Zweitgerät – Rotation ist als Funktion noch
gar nicht gebaut), 12 (Zertifikatsrotation/Ablauf – ebenfalls noch keine Rotationsfunktion), 13
(reale Windows/Linux/Router-Matrix – braucht echte, unterschiedliche Netzwerke), 14 (10.000
Ereignisse + gleichzeitige Wiederverbindung vieler Kassen – Lasttest-Infrastruktur).

## Ergebnis nach beiden Runden

14 von 14 Tests bestehen, reproduzierbar per `npm ci && npm test` in einem frisch aufgesetzten
Verzeichnis nachgewiesen. Weiterhin keine Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“,
keine echten Umsätze, kein Feldversuch bis zum nächsten Review.

---

# Dritte Korrekturrunde – Nachprüfbericht Baustufe 1.2 (N-01 bis N-08)

Vollständiger Testlauf unter echtem Windows/Node v24.14.0: 13 von 16 bestanden. Alle drei
konkreten Fehlschläge sowie die priorisierten Integritätsbefunde wurden bearbeitet:

## N-01 – Verlorene Rotationsantwort sperrte dauerhaft aus

**Vorher:** Altes Credential wurde sofort widerrufen, sobald das neue erzeugt wurde. Ging die
Antwort verloren, besaß die Kasse nur noch ein bereits totes Credential - kein Weg zurück ohne
neue QR-Kopplung.
**Jetzt:** Rotation ist idempotent (Wiederholung mit dem alten Credential liefert dasselbe neue
zurück, statt ein weiteres zu erzeugen) plus eine 10-Minuten-Übergangsfrist, in der das alte
Credential noch funktioniert. Nach Ablauf der Frist strikt abgelehnt (per Test mit einer in die
Vergangenheit verschobenen Zeitmarke nachgewiesen, kein Warten auf echte 10 Minuten nötig).

## N-02 – Über 200 offene Ereignisse blockierten den gesamten Sync

**Vorher:** Client sendete immer die komplette Outbox als einen Batch; ab 201 Ereignissen
antwortete der Server dauerhaft mit `batch_too_large`.
**Jetzt:** Client bildet eigene Batches, begrenzt sowohl nach Anzahl (200) als auch nach
Byte-Größe (200 KB, Sicherheitsabstand zum 256-KB-Serverlimit) - 200 kleine Ereignisse können
zusammen trotzdem zu groß werden, das wird jetzt separat abgefangen. Mit 350 Testereignissen in
einem `sync()`-Aufruf nachgewiesen.

## N-03 – Sequenzlücken/-duplikate unerkannt

**Jetzt:** Lücken werden erkannt und protokolliert (aber akzeptiert - normal bei Batches),
Regressionen (neues Ereignis mit bereits überschrittener Sequenz) werden abgelehnt und
protokolliert. Zusätzlich als Verteidigung in der Tiefe: `UNIQUE(device_instance_id,
sequence_number)`-Constraint direkt in der Datenbank - falls die Anwendungslogik einen Fall
übersehen sollte, fängt die Datenbank ihn trotzdem ab (nur das eine Ereignis wird dann verworfen,
nicht die ganze Übertragung).

## N-04 – Loopback allein ist keine starke Admin-Authentisierung

**Jetzt:** Zusätzlich ein beim ersten Start erzeugtes, 256 Bit starkes Admin-Token in einer
eigenen, plattformgerecht geschützten Datei, zeitkonstant verglichen. Ein bewusster Vorbehalt
bleibt: jeder Prozess mit denselben Dateisystemrechten auf derselben Maschine könnte das Token
lesen - eine vollständige Lösung (Betriebssystem-IPC mit eigenen Rechten, wie im Bericht
vorgeschlagen) ist eine größere Architekturänderung und noch nicht umgesetzt.

## N-05 – Credential-/Token-Entropie zu knapp

**Vorher:** `randomBytes(8)` = 64 Bit für Kopplungstoken und Credentials.
**Jetzt:** `randomBytes(32)` = 256 Bit für alle Geheimnisse (Token, Credentials). Reine Bezeichner
(Manager-ID, die kein Geheimnis ist) unverändert.
**Offen:** Der Vorschlag "nur einen Hash des Secrets in der Datenbank speichern, IDs von Secrets
trennen" ist NICHT umgesetzt - das Credential wird weiterhin im Klartext als Primärschlüssel in
der Datenbank gehalten. Echte Priorität, aber eine größere, hier aus Zeitgründen noch nicht
umgesetzte Änderung.

## Die drei konkreten Windows/Node-v24-Testfehler

**mDNS findet den Manager nicht:** Kann ich ohne Windows-Testumgebung nicht selbst reparieren.
Stattdessen jetzt eine dokumentierte, manuell hinterlegbare Ausweich-Adresse
(`setStaticFallback(host, port)`), die genutzt wird, wenn mDNS nichts liefert - bleibt dabei
weiterhin fingerprint-geprüft (kein blindes Vertrauen in die manuelle Adresse).

**Übergroßer Body führt zu `ECONNRESET` statt lesbarer `413`:** Gefunden und behoben - der Socket
wurde bisher sofort nach `res.end()` zerstört, bevor die Antwort den Client überhaupt erreichte.
Jetzt wird auf das tatsächliche Versenden gewartet (`finish`-Ereignis, mit Zeitbegrenzung als
Rückfallebene). Dabei selbst einen neuen, eigenen Fehler gefunden und behoben: die erste Korrektur
schloss die Verbindung nur halbseitig (`socket.end()`), wodurch `manager.stop()` beim Beenden
unbegrenzt auf den vollständigen Verbindungsabschluss wartete - auf vollständiges Schließen
(`socket.destroy()`) nach dem Versand umgestellt.

**Schlüsseldatei effektiv `0666` statt `0600` unter Windows:** War zum Zeitpunkt dieses Testlaufs
noch nicht behoben (das kam erst in der vorherigen Zwischenantwort). Jetzt vorhanden:
`manager-companion/secure-file.js` nutzt unter Windows `icacls` (echte ACL-Einschränkung auf den
aktuellen Benutzer, kein bloßes Dateiattribut) statt `chmod`, das unter Windows nicht wirkt. Auch
für das neue Admin-Token übernommen. **Kann in dieser Linux-Sandbox nicht auf einem echten
Windows-System nachgewiesen werden - bleibt ein ehrlicher Vorbehalt bis zur nächsten Prüfung.**

## Bewusst nicht in dieser Runde bearbeitet

- **N-06** (abgelehnte Ereignisse werden endlos erneut gesendet, kein Dead-Letter-Zustand)
- **N-07** (API-Versionierung dokumentiert, aber nicht durchgesetzt)
- **N-08** (Zertifikatsgültigkeit wird beim SPKI-Pinning nicht geprüft)

Alle drei sind echte, im Bericht nachvollziehbar begründete Punkte - aus Zeitgründen in dieser
Runde zurückgestellt, nicht vergessen oder für unwichtig befunden.

## Ergebnis

21 von 21 Tests bestehen (inkl. 2 neuer: mDNS-Ausfallsicherung, Admin-Token-Nachweis), erneut
reproduzierbar per `npm ci && npm test` in einem frisch aufgesetzten Verzeichnis nachgewiesen.
Weiterhin keine Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze,
kein Feldversuch, kein Produktivnetz bis zur nächsten Prüfung.

---

# Vierte Korrekturrunde – Dritter Nachprüfbericht (D-01 bis D-07, T-01 bis T-04, N-06 bis N-08)

Echter Testlauf unter Windows/Node v24.14.0 ergab 17 von 21 bestandenen Tests und deckte
zusätzliche, tiefere Integritätsprobleme auf. Alle Punkte bearbeitet:

## Testfehler

- **T-01** (mDNS unter Windows unzuverlässig): die Ausweich-Adresse ist jetzt automatisch Teil
  jeder Kopplung (`pair()` hinterlegt sie selbst), nicht mehr ein separater, leicht vergessener
  manueller Schritt.
- **T-02** (weiterhin `ECONNRESET` statt `413`): der Server zerstörte den Socket bisher direkt
  nach dem `finish`-Ereignis - das bestätigt nur, dass Node die Antwort an den Kernel übergeben
  hat, nicht dass der Client sie gelesen hat. Jetzt wird die Anfrage bis zum Ende regulär
  durchgelassen (überzählige Bytes verworfen, nicht gespeichert), mit `Connection: close`
  geantwortet und Node überlässt der Verbindung den geordneten eigenen Abschluss. Ein
  15-Sekunden-Timer bleibt nur als allerletzte Notbremse.
- **T-03** (Windows-ACL sperrte den Manager selbst aus): nutzte `process.env.USERNAME`, das vom
  tatsächlichen Prozess-Konto abweichen kann (im Bericht konkret nachgewiesen: `USERNAME=Koch`,
  Prozess lief aber als anderes Konto). Jetzt wird `whoami` (das tatsächliche Prozess-Token)
  verwendet, zusätzlich eine echte Leseprobe nach dem Setzen der ACL zur Bestätigung.
- **T-04** (Testdatei prüfte weiterhin POSIX-Modus unter Windows): jetzt plattformabhängig -
  Windows prüft die ACL selbst (kein "Jeder"-Zugriff, keine Vererbung), POSIX weiterhin `0600`.

## Neue Integritätsbefunde

- **D-01 (KRITISCH)**: eine erkannte Sequenzlücke konnte nie geheilt werden (später
  eintreffendes Ereignis wurde als Regression abgelehnt). Jetzt zwei getrennte Werte: höchste
  jemals gesehene Sequenz (nur Information) und höchste **lückenlose** Sequenz (das ist die
  einzige Zahl, die als Bestätigung gilt). Ein später eintreffendes Ereignis schließt die Lücke
  jetzt korrekt.
- **D-02**: Batch-Größe wurde als Zeichen (`string.length`) statt echter UTF-8-Bytes gemessen -
  bei Umlauten/Emoji/CJK-Zeichen hätte das erneut das Serverlimit sprengen können. Jetzt
  `Buffer.byteLength(..., 'utf8')`, inklusive eines eigenen Zustands für ein einzelnes Ereignis,
  das schon allein zu groß ist (wird markiert, nicht endlos wiederholt).
- **D-03**: die Übergangsfrist bei Rotation machte Rotation ungeeignet, ein *kompromittiertes*
  Credential auszusperren (der Angreifer hätte während der Frist ebenfalls das neue Credential
  abrufen können). Routine-Rotation (Wiederaufnahme nach Netzfehler) und Sicherheitswiderruf sind
  jetzt über eine Rotations-Nonce getrennt - eine Wiederholung ohne oder mit falscher Nonce
  bekommt das neue Credential nicht.
- **D-04**: fehlgeschlagener Datei-/ACL-Schutz führte bisher nur zu einer Konsolenmeldung, der
  Manager startete trotzdem. Jetzt fail-closed: der Start bricht ab, wenn der Schutz nicht durch
  eine echte Leseprobe bestätigt werden kann.
- **D-05**: Credentials/Token liegen jetzt nur noch als Hash in der Datenbank (`secret_hash`),
  zeitkonstant verglichen, nicht mehr im Klartext als Primärschlüssel.
- **D-06**: Manager-ID von 64 auf 128 Bit angehoben.
- **D-07**: Admin-Widerruf wird jetzt in einem eigenen Audit-Protokoll festgehalten (Akteur,
  Zeitpunkt, Ergebnis).

## Bewusst zuvor zurückgestellte Punkte, jetzt nachgeholt

- **N-06**: dauerhaft ungültige Ereignisse gehen jetzt in einen sichtbaren Ruhezustand
  (`dead_letter`, einsehbar über `deadLetterEvents()`) statt endlos wiederholt zu werden.
- **N-07**: API-Version wird jetzt tatsächlich durchgesetzt (Anfrage **und** Antwort geprüft),
  nicht nur in Antworten behauptet.
- **N-08**: Zertifikatsgültigkeit (Ablauf, Gültigkeitsbeginn) wird jetzt explizit geprüft -
  `rejectUnauthorized:false` übergeht sonst auch die Standard-Ablaufprüfung, ein SPKI-Pin allein
  prüft nur den Schlüssel, nicht die zeitliche Gültigkeit.

## Ergebnis

30 von 30 Tests bestehen (9 neue: D-01 Heilung + Konfliktfall, D-03 Nonce-Schutz, D-02
Byte-Messung + Einzelereignis-Grenzfall, D-04 fail-closed, D-07 Audit, N-06, N-07, N-08).
Weiterhin keine Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze,
kein Feldversuch, kein Produktivnetz bis zur nächsten Prüfung. T-01 bis T-04 sowie D-01 bis D-07
konnten nur teilweise in dieser Linux-Sandbox nachgewiesen werden (die Windows-ACL-Logik selbst
z. B. nicht auf echtem Windows) - das bleibt ein ehrlicher Vorbehalt bis zur nächsten
Nachprüfung unter Windows/Node v24.

---

# Fünfte Korrekturrunde – Vierter Nachprüfbericht (echter Testlauf unter Windows/Node v24, 30/30 bestanden)

Fünf verbleibende Befunde, alle bearbeitet:

## 1. KRITISCH – Keine Datenbankmigration von 2.1 auf 2.2

`CREATE TABLE IF NOT EXISTS` legt nur eine komplett neue Tabelle an - fehlte einer bereits
bestehenden Tabelle aus einer älteren Version eine Spalte (z. B. `highest_seen`), blieb sie
fehlend, jeder Zugriff scheiterte mit `no such column`. Betraf sowohl Manager als auch Kasse.

**Jetzt:** Echte Spalten-Migration (`migrateColumns()`, `PRAGMA table_info` + `ALTER TABLE ADD
COLUMN`) in beiden `db.js`-Dateien. Der alte `last_acked_sequence.sequence_number`-Wert wird
beim Nachrüsten als sicherer Ausgangspunkt für **beide** neuen Spalten übernommen. Mit einer
echten, künstlich auf den alten Stand zurückgesetzten Datenbank getestet.

## 2. HOCH – Erste Rotation ungeschützt gegen gestohlenes Alt-Credential

Der Rotations-Nonce wurde beim allerersten Rotationsaufruf vom AUFRUFER selbst mitgegeben und
ungeprüft übernommen - ein Angreifer mit dem gestohlenen alten Credential hätte selbst zuerst
rotieren und dabei seinen eigenen Nonce festlegen können, wodurch die legitime Kasse bei ihrem
eigenen (späteren) Versuch ausgesperrt worden wäre.

**Beim Nachdenken über eine Korrektur wurde klar: der Nonce-Mechanismus selbst kann diese
Aufgabe grundsätzlich nicht lösen** - er kann nicht zwischen der echten Kasse und einem
Angreifer unterscheiden, die beide dasselbe (kompromittierte) Credential vorweisen. Der Nonce
wurde deshalb komplett entfernt statt nur repariert: eine Wiederholung mit demselben alten
Credential liefert jetzt einfach erneut denselben Nachfolger. Der tatsächliche Schutz bei
Verdacht auf Kompromittierung bleibt, wie schon bei D-03 korrekt benannt, ausschließlich der
administrative Widerruf plus erneute QR-Kopplung - das ist jetzt auch der einzige Test dafür.

## 3. MITTEL – Fehlende API-Version wurde weiterhin akzeptiert

`isCompatibleVersion()` behandelte eine fehlende Version bisher wie die aktuelle - das
entwertete die N-07-Durchsetzung fast vollständig. Jetzt wird eine fehlende Version genauso
abgelehnt wie eine erkennbar inkompatible (es gibt keine älteren Bestandsclients, die auf diese
Nachsicht angewiesen wären).

## 4. MITTEL – Fehlende/nicht parsebare Zertifikatsdaten wurden übersprungen

Fehlte `valid_from`/`valid_to`, wurde die Prüfung stillschweigend übersprungen (`null` gewinnt
gegen jeden Vergleich). War das Datum vorhanden, aber kaputt, ergab `new Date(...)` `NaN` -
JEDER Zahlenvergleich mit `NaN` liefert `false`, wodurch auch das nie zur Ablehnung führte.
**Jetzt fail-closed** wie schon bei D-04: fehlende oder nicht auswertbare Gültigkeitsdaten
führen zur Ablehnung (`tls_certificate_validity_unreadable`), nicht zum stillschweigenden
Durchlassen.

## 5. NIEDRIG – Irreführender Testname

Ein Test hieß „altes Credential sofort ungültig“, prüfte aber tatsächlich (bewusst, seit der
Übergangsfrist-Einführung) das Gegenteil. Umbenannt, keine Verhaltensänderung nötig.

## Ergebnis

33 von 33 Tests bestehen (3 neue: Datenbankmigration mit künstlich zurückgesetzter Datenbank,
fehlende Version wird abgelehnt, fehlende/kaputte Zertifikatsdaten fail-closed), zwei bestehende
Tests an das vereinfachte, nonce-freie Rotationsdesign angepasst. Erneut reproduzierbar per
`npm ci && npm test` in einem frisch aufgesetzten Verzeichnis nachgewiesen. Weiterhin keine
Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze, kein Feldversuch,
kein Produktivnetz, keine Updates bestehender Installationen bis zur nächsten Prüfung.

---

# Sechste Runde – Baustufe 2.4 (Konsolidierung, fünfter Nachprüfbericht)

Auf Vorschlag des Nutzers als gebündelte Konsolidierungsstufe bearbeitet statt als weitere
Einzelkorrektur, mit vorab festgelegten Abnahmekriterien (Migration, Rotation, API-Version je
mit Positiv-/Negativ-/Angriffstest) statt "flicken und wieder einschicken".

## K-01 (KRITISCH) – Bestehende 2.1-Credentials wurden durch die Migration ungültig

Die Spalten-Migration selbst funktionierte, machte aber jedes echte 2.1-Credential ungültig,
weil danach nur noch das neue `id.geheimnis`-Format akzeptiert wurde. Ein 2.1-Credential bestand
aber nur aus der reinen `credential_id` - der Besitz DIESER ID war im alten Schema bereits das
gesamte Beweismittel.

**Korrektur:** `_authenticate()` erkennt jetzt beide Formate. Eine reine ID (kein Punkt-Trenner)
wird direkt nachgeschlagen und akzeptiert, wenn die Zeile erkennbar noch unmigriert ist
(`secret_hash` leer) - exakt dieselbe Berechtigungsstärke wie im alten Schema, keine
Abschwächung. Mit dem exakten Nachweisskript des Prüfberichts unabhängig gegengetestet.

## H-01 (HOCH) – Angreifer konnte das Nachfolge-Credential nach der Rotation übernehmen

Eine Wiederholung des Rotationsaufrufs mit dem alten Credential erzeugte bisher jedes Mal ein
NEUES Geheimnis für denselben Nachfolger - wer auch immer das alte Credential zuletzt vorwies
(echte Kasse oder Angreifer), bekam das zuletzt gültige Geheimnis, alle vorherigen Ausgaben
wurden ungültig.

**Korrektur:** Ein neu ausgegebener Nachfolger merkt sich sein Klartext-Geheimnis vorübergehend
(`pending_secret`) und gilt als "unbeansprucht" (`claimed = 0`). Wiederholungen VOR der ersten
erfolgreichen Nutzung liefern weiterhin dasselbe Geheimnis zurück (Wiederaufnahme nach
verlorener Antwort bleibt möglich). Sobald das neue Credential zum ersten Mal erfolgreich
verwendet wird, gilt es als beansprucht, das Klartext-Geheimnis wird gelöscht - jeder weitere
Rotationsversuch mit dem alten Credential bekommt danach kein Geheimnis mehr. Das Angriffsfenster
ist damit auf "bis zur ersten echten Nutzung" begrenzt, nicht mehr die volle
Zehn-Minuten-Übergangsfrist. Mit dem exakten Nachweisskript des Prüfberichts unabhängig
gegengetestet (inkl. Bestätigung, dass die echte Kasse nach dem Angriffsversuch weiter
funktioniert).

## M-01 (MITTEL) – API-Version war nur serverseitig durchgesetzt

Die Kasse selbst prüfte die Version einer Antwort nur bei erkennbar falscher Version, eine
FEHLENDE Antwort-Version wurde stillschweigend durchgelassen. Jetzt symmetrisch zur Server-Seite:
eine fehlende Antwort-Version wird genauso abgelehnt wie eine inkompatible.

## M-02 (MITTEL) – Migration weder versioniert noch als Ganzes transaktional

`PRAGMA table_info` + einzelne `ALTER TABLE`-Aufrufe funktionierten, bildeten aber keinen
nachvollziehbaren Versionsstand ab und liefen nicht gemeinsam in einer Transaktion. Umgebaut auf
`PRAGMA user_version` mit nummerierten, aufeinander aufbauenden Migrationsschritten - alle noch
ausstehenden Schritte laufen als EINE Transaktion. Bricht ein Schritt ab (z. B. Stromausfall
mitten in der Migration), bleibt die Datenbank vollständig auf dem alten, konsistenten Stand
stehen.

## Ergebnis

37 von 37 Tests bestehen (4 neue, exakt auf die vier Befunde zugeschnitten). Zusätzlich zur
internen Testsuite wurden die beiden externen Nachweisskripte aus dem Prüfbericht unabhängig
nachgestellt und bestätigen beide die Korrektur. Erneut reproduzierbar per `npm ci && npm test`
in einem frisch aufgesetzten Verzeichnis nachgewiesen. Weiterhin keine Aussage „sicher“,
„TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze, kein Feldversuch, kein Produktivnetz,
weiterhin kein Update-Pfad für BELIEBIGE ältere Datenstände (nur der konkret geprüfte 2.1-Stand)
bis zur nächsten Prüfung.

---

# Siebte Runde – Sicherheits-Gate A (konsolidierter sechster Nachprüfbericht)

Alle drei geforderten Gate-A-Punkte plus den ergänzend benannten Rollback-Test bearbeitet.

## H-01 (HOCH, Kernpunkt) – Nachfolge-Credential vor der ersten Nutzung offengelegt

**Bestätigt (unabhängig mit dem Angriffsskript des Prüfers nachgestellt):** wer das alte
Bearer-Credential kannte, bekam vor dessen Nutzung durch die echte Kasse das vollständige
Nachfolge-Geheimnis - unabhängig davon, ob er es rechtmäßig besaß.

**Korrektur:** Ein bei Kopplung und bei jeder erfolgreichen Rotation zusätzlich (und separat)
ausgegebener Wiederherstellungsnachweis (`resumeKey`, nur sein Hash liegt in der Datenbank) wird
jetzt für JEDE Rotation zusätzlich zum Bearer-Credential verlangt - unabhängig davon, ob der
Nachfolger schon beansprucht wurde. Ein Angreifer, dem ausschließlich das Bearer-Credential
zugespielt wurde (z. B. aus einem Netzwerk- oder Protokoll-Leck), besitzt diesen zweiten Nachweis
nicht und scheitert jetzt schon am ersten Schritt.

**Bewusst und ehrlich benannte Grenze:** Besitzt ein Angreifer BEIDE Geheimnisse (vollständige
Gerätekompromittierung, nicht nur ein Netzwerk-Leck), kann er weiterhin wie die echte Kasse
rotieren - das ist keine neue Lücke, sondern eine grundsätzliche, durch keinen serverseitigen
Mechanismus auflösbare Grenze (zwei identische Geheimnisse lassen sich nicht durch ein drittes,
ebenfalls kopiertes Geheimnis unterscheiden). Der wirksame Schutz bleibt in diesem Fall Admin-
Widerruf - eigens dafür ein Test ergänzt, der genau das nachweist.

Unabhängig vom Angriffsskript des Prüfers nachgestellt: `PRE_CLAIM_ATTACK_STATUS` jetzt `401`
(vorher `200`), kein Nachfolge-Credential mehr erhalten.

## M-01 (MITTEL) – Legacy-Credentials blieben dauerhaft im schwachen Altformat

Ein Alt-Credential wird jetzt bei der ersten erfolgreichen Verwendung automatisch und
transparent ins neue, stärkere `id.geheimnis`-Format überführt (dieselbe `credential_id`,
inklusive eigenem Wiederherstellungsnachweis) - ohne dass ein Betreiber manuell eingreifen muss.
Die Aufwertung wird der Kasse in der jeweiligen Antwort mitgeteilt und automatisch übernommen.

## M-02 (MITTEL) – Unbekannte zukünftige Datenbankversion wurde akzeptiert

Eine Datenbank mit einer neueren, diesem Programm unbekannten Version (`user_version` größer als
die unterstützte `SCHEMA_VERSION`) wird jetzt fail-closed abgelehnt, auf beiden Seiten
(Manager und Kasse). Unabhängig nachgestellt: `FUTURE_SCHEMA_VERSION` (999) wird jetzt korrekt
verweigert.

## N-01 (NIEDRIG) – Rollback ohne Fehlerinjektionstest

Ein Test injiziert jetzt einen echten Fehler mitten in einer Migrationstransaktion und bestätigt:
`user_version` bleibt danach unverändert (kein Teilfortschritt), und eine anschließende reguläre
Migration funktioniert von diesem sauberen Ausgangspunkt aus trotzdem einwandfrei.

## Ergebnis

40 von 40 Tests bestehen (7 neue/überarbeitete: H-01 Kern, H-01 Wiederaufnahme mit gültigem
Nachweis, H-01 ehrlich benannte Grenze, M-02, N-01). Zusätzlich zur internen Suite wurde das
Angriffs-/Prüfskript des Berichts unabhängig nachgestellt und bestätigt die Korrektur. Erneut
reproduzierbar per `npm ci && npm test` in einem frisch aufgesetzten Verzeichnis nachgewiesen.
Weiterhin keine Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze,
kein Feldversuch, kein Produktivnetz, keine Aussage zu vollständiger Gerätekompromittierung
(dafür bleibt Admin-Widerruf der vorgesehene, wirksame Weg) bis zur nächsten Prüfung.

---

# Achte Runde – Gate-A-Abnahmebericht (zwei idempotente Wiederaufnahme-Fälle)

Beide vom Abnahmebericht geforderten Punkte betrafen dieselbe Wurzelursache in zwei
verschiedenen Mechanismen: ein "unbeansprucht bis zur ersten echten Nutzung"-Zustand hielt zwar
das GEHEIMNIS selbst für Wiederholungen bereit, aber nicht den bei DERSELBEN Ausstellung
gehörenden zweiten Nachweis (G-01) bzw. gab das alte Format zu früh, vor Zustellung der neuen
Information, endgültig auf (G-02).

## G-01 (HOCH) – Wiederholung nach verlorener Rotationsantwort lieferte den falschen Recovery-Key

Der Server gab beim Retry den zur AUTHENTISIERUNG dieser Anfrage präsentierten (alten) Recovery-
Key unverändert zurück, statt des tatsächlich zum neuen Nachfolger gehörenden. Eine Kasse, die
nach einer verlorenen ersten Antwort diesen (falschen) Key lokal speicherte, konnte danach keine
weitere Rotation mehr durchführen (`401 resume_key_invalid`).

**Korrektur:** Der bei einer "unbeanspruchten" Rotation neu erzeugte Recovery-Key wird jetzt
ebenfalls temporär im Klartext vorgehalten (`pending_resume_key`, gleiches Muster wie
`pending_secret`) und bei einer Wiederholung korrekt zurückgegeben - nicht der präsentierte, zum
jetzt abgelösten alten Credential gehörende.

## G-02 (HOCH) – Verlorene Legacy-Upgrade-Antwort sperrte dauerhaft aus

Die automatische Legacy-Aufwertung (M-01) schaltete `secret_hash` sofort beim ersten Kontakt
scharf - das alte Bearer-Format erlosch damit, bevor die Kasse die neue Information überhaupt
zugestellt bekommen hatte. Ging die Antwort verloren, besaß die Kasse nur noch ein ungültiges
Alt-Credential, ohne Weg zurück.

**Korrektur:** Legacy-Aufwertung folgt jetzt demselben "unbeansprucht bis zur ersten echten
Nutzung"-Muster wie die Rotation. Die vorbereitete Aufwertung liegt in eigenen Spalten
(`legacy_upgrade_secret`, `legacy_upgrade_resume_key`), das alte Bearer-Format bleibt so lange
gültig und liefert bei jeder Wiederholung dieselbe, bereits vorbereitete Aufwertung erneut -
`secret_hash` wird erst gesetzt (und das alte Format erlischt erst), wenn die Kasse die neue
Information tatsächlich zum ersten Mal erfolgreich verwendet.

## Ergebnis

42 von 42 Tests bestehen (2 neue, exakt auf die vom Abnahmebericht vorgegebenen
Wiederaufnahme-Szenarien zugeschnitten). Zusätzlich zur internen Suite wurden beide exakten
Nachweise aus dem Bericht unabhängig nachgestellt: `RETURNED_OLD_RESUME_KEY` jetzt `false`
(vorher `true`), `NEXT_ROTATION_AFTER_RECOVERY` jetzt `200` (vorher `401`),
`LEGACY_UPGRADE`-Retry jetzt `200` (vorher `credential_invalid`). Erneut reproduzierbar per
`npm ci && npm test` in frisch aufgesetztem Verzeichnis bestätigt. Weiterhin keine Aussage
„sicher“, „TÜV-geprüft“ oder „produktionsreif“, keine echten Umsätze, kein Feldversuch, kein
Produktivnetz.
