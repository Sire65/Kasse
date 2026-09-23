// KC Sync Baustufe 2.4 – Kassen-seitige SQLite-Outbox (A-06).
// Befund M-02 (Fünfter Nachprüfbericht): siehe manager-companion/db.js - dieselbe versionierte,
// als Ganzes transaktionale Migration auch für die Kassen-Datenbank.
'use strict';
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_VERSION = 11;

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

const MIGRATIONS = [
  // Version 1: Grundschema.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS device_identity (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        device_instance_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL DEFAULT 0,
        pinned_manager_id TEXT,
        pinned_fingerprint TEXT,
        credential_id TEXT
      );
      CREATE TABLE IF NOT EXISTS outbox (
        event_id TEXT PRIMARY KEY,
        sequence_number INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at_device TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0
      );
    `);
  },
  // Version 2: Baustufe 2.1/2.2 - Ausweich-Adresse, Ablehnungsgrund je Ereignis.
  (db) => {
    for (const [name, def] of Object.entries({
      static_fallback_host: 'TEXT',
      static_fallback_port: 'INTEGER',
      pending_rotation_nonce: 'TEXT',
    })) {
      if (!hasColumn(db, 'device_identity', name)) db.exec(`ALTER TABLE device_identity ADD COLUMN ${name} ${def}`);
    }
    if (!hasColumn(db, 'outbox', 'last_error')) db.exec("ALTER TABLE outbox ADD COLUMN last_error TEXT");
  },
  // Version 3: Baustufe 2.4 Gate A - Befund H-01 (Sechster Nachprüfbericht): separat
  // gespeicherter Wiederherstellungsnachweis, siehe manager-companion/db.js.
  (db) => {
    if (!hasColumn(db, 'device_identity', 'resume_key')) db.exec('ALTER TABLE device_identity ADD COLUMN resume_key TEXT');
  },
  // Version 4: Baustufe 3 "Betriebsfestigkeit" - Zustandsfelder für die Ampel-/Aktivitäts-
  // Anzeige. Werden persistiert (nicht nur im Arbeitsspeicher gehalten), damit die Oberfläche
  // auch direkt nach einem Neustart der Kasse den zuletzt bekannten, echten Zustand zeigt statt
  // fälschlich "unbekannt".
  (db) => {
    for (const [name, def] of Object.entries({
      last_sync_attempt_at: 'TEXT',
      last_sync_success_at: 'TEXT',
      last_sync_error: 'TEXT',
    })) {
      if (!hasColumn(db, 'device_identity', name)) db.exec(`ALTER TABLE device_identity ADD COLUMN ${name} ${def}`);
    }
  },
  // Version 5: Mehrgeräte-Betrieb am Marktstand - der lokale Status-/Ereignis-Server wird jetzt
  // auch aus dem WLAN erreichbar gemacht (nicht mehr nur vom selben Rechner), damit ein Tablet
  // als eigenständige Kasse funktioniert. Ein Zugangs-Schlüssel ersetzt dafür "läuft auf
  // demselben Rechner" als bisherige Vertrauensgrenze - Loopback-Zugriffe bleiben weiterhin ohne
  // Schlüssel möglich (Rückwärtskompatibilität), Zugriffe aus dem Netzwerk brauchen ihn.
  (db) => {
    if (!hasColumn(db, 'device_identity', 'kasse_access_token')) db.exec('ALTER TABLE device_identity ADD COLUMN kasse_access_token TEXT');
  },
  // Version 6: Zentrale Stammdaten (Warengruppen/Artikel/Pakete) vom Manager - jede Kasse holt
  // sich beim normalen Sync den aktuellen Stand ab und hält ihn hier lokal vor, damit die Kasse
  // auch offline (ohne gerade erreichbaren Manager) mit dem zuletzt bekannten Stand weiterarbeiten
  // kann, statt auf ihre alten, fest einprogrammierten Artikel zurückzufallen.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS master_data_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        groups_json TEXT NOT NULL DEFAULT '[]',
        articles_json TEXT NOT NULL DEFAULT '[]',
        packages_json TEXT NOT NULL DEFAULT '[]',
        revision INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );
    `);
  },
  // Version 7: Ablage für den Datenschlüssel dieser Kasse (Security Card).
  //
  // Der Schlüssel kommt vom Manager und liegt hier, damit die Kasse ihn morgens ohne jede
  // Eingabe bekommt. Er liegt bewusst BEIM COMPANION und nicht im Browser: wer nur das Tablet
  // hat, aber nicht das eingerichtete Programm dahinter, kommt damit nicht weiter.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS local_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  },
  // Version 8: Darstellungseinstellungen kommen jetzt mit den Stammdaten mit.
  (db) => {
    db.exec("ALTER TABLE master_data_cache ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'");
  },
  // Version 9: Vorrat an signierten Gutscheinnummern.
  //
  // Der Vorrat liegt hier im Companion und nicht im Browser: er ueberlebt damit ein Neuladen
  // der Kasse, das Leeren des Browserspeichers und den Fernbefehl "Datenbank leeren". Vor
  // allem aber laesst er sich hier auffuellen, waehrend die Verbindung steht - und am
  // Markttag zieht die Kasse offline daraus.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS voucher_number_stock (
        code TEXT PRIMARY KEY,
        qr TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );
    `);
  },
// Version 10 (20.09.2026): Konten aus dem Manager im lokalen Stammdaten-Cache halten.
  (db) => {
    if (!hasColumn(db, 'master_data_cache', 'accounts_json')) {
      db.exec("ALTER TABLE master_data_cache ADD COLUMN accounts_json TEXT NOT NULL DEFAULT '[]'");
    }
  },

  // Version 11 (23.09.2026): Dienstplan lokal persistent puffern.
  // Nach einem Neustart des Tablet-Companions bleibt der zuletzt erfolgreich vom Manager
  // geladene Plan verfügbar, auch wenn das WLAN oder der Manager gerade nicht erreichbar ist.
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS dienstplan_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schichten_json TEXT NOT NULL DEFAULT '[]',
        revision INTEGER NOT NULL DEFAULT 0,
        event_id TEXT,
        source_updated_at TEXT,
        manager_updated_at TEXT,
        cached_at TEXT
      );
    `);
  },

];

function openDeviceDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  const currentVersion = db.prepare('PRAGMA user_version').get().user_version;

  // Befund M-02 (Sechster Nachprüfbericht): siehe manager-companion/db.js.
  if (currentVersion > SCHEMA_VERSION) {
    db.close();
    throw new Error(`Datenbankversion ${currentVersion} ist neuer als die von diesem Programm unterstützte Version ${SCHEMA_VERSION} - Start abgebrochen, kein automatisches Downgrade.`);
  }

  if (currentVersion < SCHEMA_VERSION) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (let v = currentVersion; v < SCHEMA_VERSION; v++) MIGRATIONS[v](db);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Datenbankmigration fehlgeschlagen (von Version ${currentVersion} auf ${SCHEMA_VERSION}), Änderungen wurden vollständig zurückgenommen: ${err.message}`);
    }
  }

  return db;
}

module.exports = { openDeviceDb, SCHEMA_VERSION };
