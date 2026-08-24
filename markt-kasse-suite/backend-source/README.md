# Baustufe 1 + 2 – echter Companion-Prototyp mit Credential-Rotation

**Status:** Entwicklungsprototyp im Testnetz (laut Freigabematrix des Prüfvermerks erlaubt).
Keine TÜV-/TSE-/BSI-/fiskalische Aussage, keine produktive Inbetriebnahme, keine echten
Umsatzdaten, kein Feldversuch, keine Verbindung zu den echten Programmen `pos/`/`pc-manager/` -
bewusst als eigener, isolierter Ordner gehalten, bis eine weitere Freigabe vorliegt.

## Baustufe 2 (neu): Credential-Rotation

Schließt die in den Security-Reviews benannte Lücke für die Pflicht-Negativtests 10/12: eine
bereits gekoppelte Kasse kann ihr Credential jetzt erneuern (`POST /api/v1/credential/rotate`),
ohne erneut den vollen QR-Kopplungsweg zu gehen. Das alte Credential wird im selben Schritt
ungültig - bewusst ohne Überlappungsfenster (Details in `docs/API_CONTRACT.md`).

Neuer Test deckt außerdem den "Restore-Fall" ab: ein aus einer alten Datensicherung
wiederhergestelltes Gerät mit einem längst rotierten, veralteten Credential wird zuverlässig
zurückgewiesen statt versehentlich noch zu funktionieren.

## Unterschied zu Baustufe 0

Baustufe 0 war ein In-Memory-Simulator zum Prüfen der Zustellungs-Logik. Baustufe 1 ist die
**echte** Umsetzung: echtes HTTPS mit echtem (selbstsigniertem) Zertifikat, echte
mDNS/DNS-SD-Ankündigung und -Suche, echte SQLite-Datenbanken mit WAL-Modus, echte
Zertifikats-Fingerprint-Prüfung auf Transportebene.

## Manager-Companion (`manager-companion/`)

- `identity.js` – erzeugt einmalig ein selbstsigniertes TLS-Zertifikat, Fingerprint bleibt über
  Neustarts hinweg stabil (SQLite-Ablage)
- `db.js` – SQLite-Schema (Identität, Kopplungstoken, Credentials, empfangene Ereignisse)
- `index.js` – HTTPS-Server + echte mDNS-Ankündigung (`bonjour-service`) + der API-Vertrag aus
  Baustufe 0, jetzt gegen die persistente Datenbank statt in-memory

## Kassen-Companion (`device-companion/`)

- `db.js` – SQLite-Outbox (Beleg + Outbox-Eintrag atomar)
- `index.js` – persistente Geräte-Identität, **echte** mDNS-Suche gefiltert auf die gepinnte
  Manager-ID (kein Adressbereich-Scan, löst A-01), **echte** TLS-Zertifikats-Fingerprint-Prüfung
  auf Transportebene (nicht nur ein Feld in der Antwort) vor jeder Synchronisation

## Ein während des Baus selbst gefundener und behobener Schwachpunkt

Der erste Entwurf verglich den Fingerprint nur als Textfeld in der JSON-Antwort – das hätte eine
Gegenstelle, die die Verbindung übernimmt, beliebig fälschen können. Jetzt wird der tatsächlich
vom TLS-Handshake präsentierte Zertifikats-Fingerprint geprüft (`res.socket.getPeerCertificate()`),
bevor die Antwort überhaupt gelesen wird – erst dann ist es echtes Certificate Pinning.

## Automatisierte Tests (`tests/stage1-integration.test.cjs`) – 68/68 bestanden

Nach zwei Security-Review-Korrekturrunden (siehe `docs/SECURITY_REVIEW_FIXES.md` für alle
Einzelheiten). Installation reproduzierbar aus `package-lock.json` geprüft (`npm ci && npm test`
in frisch aufgesetztem Verzeichnis).

## Was für einen echten Feldversuch noch fehlt

- Verpackung als eigenständiges, startbares Programm (aktuell: Node-Module, noch kein
  Installer/Autostart)
- Rate-Limits, Brute-Force-Schutz auf `/api/v1/pair` (A-10)
- Auditprotokoll für Kopplung/Widerruf (A-10)
- Lasttest mit vielen gleichzeitigen Kassen und großen Ereignis-Mengen (Prüfvermerk-Test 2 mit
  echten 10.000 Wiederholungen, Test 12 gleichzeitige Wiederverbindung)
- Uhrabweichungs-/Sommerzeit-Test (Prüfvermerk-Test 11)
- Security-Review der TLS-/Pinning-Umsetzung durch Dritte, wie in der Freigabematrix vorgesehen
