# KC Security Architecture

## Non-negotiable rules

1. No production secret, database password, service-role key, recovery key or device private key may be committed to Git.
2. POS clients receive least privilege only. Superadmin credentials never ship to a tablet.
3. Production transaction data must be protected in transit with TLS and at rest with authenticated encryption where application-controlled storage is used.
4. Device compromise must be containable by revoking one device without rotating every other device.
5. Every encrypted artifact carries a key ID/version so historical backups remain recoverable after rotation.
6. Every write is idempotent and bound to a transaction ID; conflicts are never silently overwritten.
7. Restore and reconciliation operations require stronger authorization than ordinary health checks.
8. Replay protection is mandatory for authenticated write requests: timestamp + nonce/request ID + bounded validity window.
9. Superadmin recovery is a break-glass path, not a normal runtime credential.
10. There is no hidden backdoor. Recovery works only with explicitly escrowed recovery material.

## Cryptographic baseline

- Data encryption: AES-256-GCM with a fresh random 96-bit nonce per encryption.
- Password/passphrase derivation: Argon2id where the runtime supports a vetted implementation; PBKDF2-SHA-256 is compatibility-only and must use a high work factor and random salt.
- Request authentication: per-device asymmetric signing or a per-device high-entropy MAC key. Never one shared key embedded in public JavaScript.
- Integrity: AEAD authentication plus immutable transaction IDs. A recordHash is supplemental and not a substitute for authentication.
- Transport: HTTPS/TLS only. Database connections require TLS with certificate/hostname verification where supported.

## Key hierarchy

Superadmin Recovery Key (offline only)
  -> wraps Key Encryption Keys (KEKs)
      -> wraps per-device/per-dataset Data Encryption Keys (DEKs)

A stolen tablet must not contain the Superadmin Recovery Key or unwrapped keys for other devices.

## Superadmin control / break glass

The Superadmin must be able to:

- revoke a stolen/lost device;
- authorize a replacement device;
- recover encrypted historical backups by key version;
- rotate a compromised device key without rotating all devices;
- rotate KEKs/DEKs while retaining explicitly archived old recovery material;
- inspect an audit trail of security-sensitive recovery operations.

Recovery material must have at least two encrypted offline copies stored separately. The unlock secret must not be stored with the encrypted recovery package.

## Production release gates

A release is not security-green unless both suites pass:

- SUPER-GAU availability/resilience suite;
- SECURITY abuse/compromise suite.

Security suite coverage includes unauthorized sync/restore, forged device ID, replay, stale timestamp, duplicate nonce, payload tampering, cross-register restore, oversized requests, rate abuse, stolen-device revocation, key rotation, old-backup recovery, corrupted ciphertext, wrong key, dependency/static analysis, secret scanning, and fail-closed behavior.

## Current migration rule

Existing plaintext localStorage transaction/outbox formats are legacy. They must not be deleted or irreversibly migrated until encrypted storage has passed compatibility, restore, offline, reconciliation and rollback tests. Migration must be transactional and preserve a tested recovery path.
