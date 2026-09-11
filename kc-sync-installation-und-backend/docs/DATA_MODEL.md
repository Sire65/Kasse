# Datenmodell – KC Sync (Baustufe 0)

**Status:** Architektur-Entwurf zur Prüfung. Keine TÜV-/TSE-/BSI-/fiskalische Aussage.

## Identität (löst A-05)

`registerId` bleibt wie bisher die vom Personal änderbare, menschenlesbare Bezeichnung
(z. B. `"Kasse 1"`). Sie ist **nicht** die Identität im Sync-Sinn.

Neu:

```
deviceInstanceId   – einmalig bei der Ersteinrichtung erzeugt (UUIDv4), lokal gespeichert,
                      NICHT im UI editierbar, überlebt keinen "Auf Werkseinstellungen
                      zurücksetzen"-Vorgang (bewusst: nach Zurücksetzen entsteht eine neue
                      Identität und muss neu gekoppelt werden, siehe A-03)
sequenceNumber     – je deviceInstanceId streng monoton steigender Zähler, nur lokal erhöht,
                      nie zurückgesetzt außer bei echtem Zurücksetzen der Kasse
```

## Ereignis (SyncEvent) – löst A-04, A-05

Jeder zu übertragende Vorgang (Verkauf, Stornierung, Kassenschluss-Aktion) wird zu genau einem
SyncEvent, bevor er in die Outbox kommt:

```
eventId              – UUIDv7 (zeitlich sortierbar, global eindeutig), unveränderlich
deviceInstanceId      – siehe oben
sequenceNumber        – siehe oben, zum Zeitpunkt der Erzeugung vergeben
registerId            – nur informativ/menschenlesbar, keine Identitätsfunktion
type                  – "sale" | "void" | "closing" | ...
payload               – der eigentliche Vorgang (unverändert zum bisherigen Belegformat)
createdAtDeviceTime   – Kassenzeit, NUR Metadatum (siehe A-05: keine alleinige Ordnungsgrundlage)
```

Ordnung der Ereignisse wird ausschließlich über (deviceInstanceId, sequenceNumber) hergestellt,
nicht über Zeitstempel.

## Outbox – löst A-06

Kein localStorage. Zwei Ausbaustufen, gleiches Schema:

- PWA-Anteil: IndexedDB, ein Object Store "outbox", Primärschlüssel eventId
- Companion-Dienst (bevorzugt für den produktiven Betrieb): SQLite mit WAL-Modus

```
CREATE TABLE outbox (
  event_id            TEXT PRIMARY KEY,
  device_instance_id  TEXT NOT NULL,
  sequence_number     INTEGER NOT NULL,
  type                TEXT NOT NULL,
  payload             TEXT NOT NULL,        -- JSON
  created_at_device   TEXT NOT NULL,
  status              TEXT NOT NULL,        -- 'pending' | 'sent' | 'acked'
  attempts            INTEGER NOT NULL DEFAULT 0,
  next_attempt_at     TEXT,
  UNIQUE (device_instance_id, sequence_number)
);
```

Wichtig (A-04, A-06): Der eigentliche Beleg und sein Outbox-Eintrag werden in derselben
lokalen Transaktion geschrieben. Es darf nie einen Beleg ohne zugehörigen Outbox-Eintrag geben
(sonst Datenverlust) und nie einen Outbox-Eintrag ohne Beleg (sonst Phantombuchung).

Ein Eintrag wird erst auf "acked" gesetzt und später gelöscht, nachdem der Manager die
Verarbeitung bestätigt hat – nicht schon beim Absenden.

## Manager-seitige Deduplizierung – löst A-04

```
CREATE TABLE received_events (
  event_id  TEXT PRIMARY KEY,   -- gleicher Wert wie SyncEvent.eventId
  device_instance_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  applied     INTEGER NOT NULL  -- 1 = bereits in die Umsatzdaten übernommen
);
```

Der event_id-Primärschlüssel erzwingt Eindeutigkeit auf Datenbankebene – ein doppelt
gesendetes Ereignis wird beim zweiten Versuch erkannt und nur bestätigt, nicht erneut verbucht.

## Gerätekopplung (DevicePairing) – löst A-02, A-03

```
deviceInstanceId
managerId                     – stabile Kennung des Managers (nicht die IP-Adresse)
managerPublicKeyFingerprint   – bei der Kopplung gepinnt, spätere Verbindungen müssen denselben
                                 Schlüssel nachweisen
credentialId                  – aktuell gültiges, rotierbares Sitzungs-Credential
credentialIssuedAt
credentialExpiresAt
revoked                       – bool, vom Manager aus jederzeit auf true setzbar
```

Das ursprüngliche QR-Einmaltoken wird nach erfolgreichem Austausch gegen credentialId
gelöscht und nie wieder verwendet (A-02).

## Getrennte Betriebszustände statt einer Ampel – löst A-07

```
ManagerSyncStatus   – "verbunden" | "getrennt" | "wird geprüft"
TseStatus           – eigenständig, unabhängig vom Netz
TerminalStatus       – Kartenzahlung, eigenständig
PrinterStatus        – eigenständig
StorageStatus        – lokaler Speicherstand (Outbox-Füllstand, freier Platz)
ClockStatus          – Abweichung zur Manager-Zeit als Hinweis, keine automatische Korrektur
```

Jeder Status wird einzeln angezeigt. Es gibt bewusst keine einzelne "Ampel", die diese
Zustände zusammenfasst und dabei einen fiskalisch relevanten Fehler verdecken könnte.
