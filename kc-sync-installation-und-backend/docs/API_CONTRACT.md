# API-Vertrag – KC Sync V1 (Baustufe 0)

**Status:** Architektur-Entwurf zur Prüfung. Keine TÜV-/TSE-/BSI-/fiskalische Aussage.
Löst A-09 (Versionierung) und liefert die Schnittstellen für A-01 bis A-08.

Alle Endpunkte unter `/api/v1/...`. Transportverschlüsselung verpflichtend (A-08) – in
Baustufe 0 im Simulator noch ohne echtes TLS (lokal, zu Testzwecken), im Prototyp verpflichtend
mit gepinntem Zertifikat.

Jede Antwort enthält `apiVersion`. Ein Client mit inkompatibler Version bekommt einen
maschinenlesbaren Fehler (`error: "version_unsupported"`) statt einer stillschweigend falsch
interpretierten Antwort.

## GET /api/v1/health

Unauthentifiziert, dient sowohl der Erreichbarkeitsprüfung als auch der Manager-Identifikation.

**Antwort:**
```json
{
  "apiVersion": "1.0",
  "managerId": "mgr_7f3a...",
  "publicKeyFingerprint": "sha256:ab12...",
  "serverTime": "2026-07-25T10:00:00Z",
  "status": "ok"
}
```

## POST /api/v1/pair

Nimmt das QR-Einmaltoken entgegen, gibt bei Erfolg ein neues Credential zurück. Das Token ist
nach diesem Aufruf **verbraucht** (A-02), unabhängig vom Ergebnis.

**Anfrage:**
```json
{ "pairingToken": "...", "deviceInstanceId": "...", "registerLabel": "Kasse 1" }
```

**Antwort (Erfolg):**
```json
{
  "apiVersion": "1.0",
  "managerId": "mgr_7f3a...",
  "publicKeyFingerprint": "sha256:ab12...",
  "credentialId": "cred_9c21...",
  "credentialExpiresAt": "2026-08-01T00:00:00Z"
}
```

**Antwort (Token ungültig/abgelaufen/bereits verwendet):** `410 Gone`,
`{ "error": "pairing_token_invalid" }`

## POST /api/v1/sync/push

Erfordert gültiges `credentialId` (Header `X-KC-Credential`). Nimmt eine Liste von `SyncEvent`
entgegen, verarbeitet **idempotent** (A-04): bereits bekannte `eventId` werden nur bestätigt,
nicht erneut verbucht.

**Anfrage:**
```json
{ "deviceInstanceId": "...", "events": [ { "eventId": "...", "sequenceNumber": 42, "type": "sale", "payload": {"...":"..."}, "createdAtDeviceTime": "..." } ] }
```

**Antwort:**
```json
{
  "apiVersion": "1.0",
  "acknowledged": ["eventId1", "eventId2"],
  "duplicates": ["eventId3"],
  "rejected": []
}
```

Ein `eventId` gilt erst als endgültig zugestellt, wenn es in `acknowledged` **oder**
`duplicates` erscheint (beides ist für die Kasse gleichbedeutend: Eintrag darf aus der Outbox
entfernt werden). `rejected` (z. B. bei fehlerhaftem Payload) verbleibt in der Outbox und wird
protokolliert, nicht automatisch verworfen.

## GET /api/v1/sync/status?deviceInstanceId=...

Erfordert gültiges Credential. Liefert getrennte Zustände statt einer Ampel (A-07):

```json
{
  "apiVersion": "1.0",
  "managerSync": "verbunden",
  "lastAckedSequence": 41,
  "serverTime": "2026-07-25T10:00:05Z"
}
```

TSE-/Terminal-/Drucker-/Speicherstatus werden **nicht** vom Manager geliefert – das sind
lokale, geräteeigene Zustände (siehe DATA_MODEL.md), die unabhängig vom Netz ermittelt werden.

## POST /api/v1/credential/revoke

Vom Manager aus bedienbar (nicht von der Kasse selbst aufrufbar), z. B. bei Verlust eines
Geräts. Setzt `revoked = true` für die angegebene `deviceInstanceId`. Alle folgenden
`sync/push`-Aufrufe mit dem widerrufenen Credential liefern `401 Unauthorized`,
`{ "error": "credential_revoked" }`.

## POST /api/v1/credential/rotate

Erfordert gültiges, noch nicht widerrufenes Credential (Header `X-KC-Credential`). Erneuert das
Credential einer bereits gekoppelten Kasse, ohne dass ein neuer QR-Kopplungsvorgang nötig ist.
Das alte Credential wird im selben Schritt ungültig – bewusst ohne Überlappungsfenster, ein
zufällig gleichzeitig laufender Sync mit dem alten Wert schlägt fehl und wird beim nächsten
Versuch mit dem neuen Credential automatisch nachgeholt (mindestens-einmal-Zustellung, A-04).
*(Ergänzt in Baustufe 2.)*

**Antwort:**
```json
{ "apiVersion": "1.0", "credentialId": "cred_...", "credentialExpiresAt": "2026-08-24T00:00:00Z" }
```

## Fehlerformat (einheitlich)

```json
{ "apiVersion": "1.0", "error": "<maschinenlesbarer_code>", "message": "<für Menschen>" }
```

Definierte Codes für Baustufe 0: `version_unsupported`, `pairing_token_invalid`,
`credential_revoked`, `credential_invalid`, `manager_identity_mismatch`, `payload_invalid`.
