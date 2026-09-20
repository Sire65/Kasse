// KC Sync Baustufe 2.4 – Manager-seitige SQLite-Persistenz (A-06).
// Befund M-02 (Fünfter Nachprüfbericht): die vorherige Migration (PRAGMA table_info + ALTER
// TABLE) beseitigte zwar "no such column"-Fehler, bildete aber keinen nachvollziehbaren
// Versionsstand ab und lief nicht als Ganzes in einer gemeinsamen Transaktion. Jetzt echte,
// nummerierte Migrationsschritte über PRAGMA user_version, alle zusammen in EINER Transaktion -
// bei einem Fehler (z. B. Stromausfall mitten in der Migration) bleibt die Datenbank auf dem
// alten, konsistenten Stand stehen, statt in einem halb migrierten Zwischenzustand hängen zu
// bleiben.
'use strict';
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_VERSION = 25;

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

// Jeder Schritt ist idempotent und geht von genau dem Stand aus, den der vorherige Schritt
// hinterlässt - so lässt sich die Kette bei Bedarf um weitere Versionen fortsetzen, ohne
// frühere Schritte anfassen zu müssen.
const MIGRATIONS = [
  // Version 1: Grundschema (deckt eine komplett neue Datenbank vollständig ab).
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS identity (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        manager_id TEXT NOT NULL,
        tls_cert TEXT NOT NULL,
        tls_key_fallback TEXT,
        fingerprint TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pairing_tokens (
        token TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credentials (
        credential_id TEXT PRIMARY KEY,
        device_instance_id TEXT NOT NULL,
        register_label TEXT,
        revoked INTEGER NOT NULL DEFAULT 0,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS received_events (
        event_id TEXT PRIMARY KEY,
        device_instance_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        UNIQUE (device_instance_id, sequence_number)
      );
      CREATE TABLE IF NOT EXISTS last_acked_sequence (
        device_instance_id TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS sequence_anomalies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_instance_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        expected_sequence INTEGER NOT NULL,
        kind TEXT NOT NULL,
        detected_at TEXT NOT NULL
      );
    `);
  },
  // Version 2: Baustufe 2.1/2.2 - Admin-Audit, Rotation/Hash-Grundlage, Sequenz-Aufteilung.
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_device_instance_id TEXT,
      remote_address TEXT,
      result TEXT NOT NULL,
      at TEXT NOT NULL
    );`);
    const hadOldSequenceColumn = hasColumn(db, 'last_acked_sequence', 'sequence_number');
    if (!hasColumn(db, 'last_acked_sequence', 'highest_seen')) {
      db.exec('ALTER TABLE last_acked_sequence ADD COLUMN highest_seen INTEGER NOT NULL DEFAULT 0');
    }
    if (!hasColumn(db, 'last_acked_sequence', 'highest_contiguous')) {
      db.exec('ALTER TABLE last_acked_sequence ADD COLUMN highest_contiguous INTEGER NOT NULL DEFAULT 0');
    }
    if (hadOldSequenceColumn) {
      // Alter Sequenzstand wird als sicherer Ausgangspunkt für BEIDE neuen Spalten übernommen
      // (konservative Annahme: die alte Version kannte keine Lücken, also gilt der bisherige
      // Stand als lückenlos bestätigt).
      db.exec('UPDATE last_acked_sequence SET highest_seen = sequence_number, highest_contiguous = sequence_number WHERE highest_seen = 0');
    }
    for (const [name, def] of Object.entries({
      secret_hash: "TEXT NOT NULL DEFAULT ''",
      superseded_by: 'TEXT',
      superseded_at: 'TEXT',
      rotation_nonce: 'TEXT',
    })) {
      if (!hasColumn(db, 'credentials', name)) db.exec(`ALTER TABLE credentials ADD COLUMN ${name} ${def}`);
    }
  },
  // Version 3: Baustufe 2.4 - Befund H-01, "unbeanspruchtes" Nachfolge-Geheimnis statt
  // Überschreiben bei Wiederholung.
  (db) => {
    for (const [name, def] of Object.entries({
      pending_secret: 'TEXT',
      claimed: 'INTEGER NOT NULL DEFAULT 1',
    })) {
      if (!hasColumn(db, 'credentials', name)) db.exec(`ALTER TABLE credentials ADD COLUMN ${name} ${def}`);
    }
  },
  // Version 4: Baustufe 2.4 Gate A - Befund H-01 (Sechster Nachprüfbericht): das bloße
  // Vorweisen des ALTEN Credentials genügte bisher, um das Nachfolge-Geheimnis VOR dessen
  // erster Nutzung zu erhalten - das kann ein Angreifer, der nur dieses eine (kompromittierte)
  // Geheimnis kennt, genauso wie die echte Kasse. Ein zusätzlicher, bei Kopplung/Rotation
  // separat ausgegebener Wiederherstellungsnachweis wird jetzt zusätzlich verlangt (nur sein
  // Hash liegt in der Datenbank) - ein Angreifer, dem ausschließlich das Bearer-Credential
  // zugespielt wurde, besitzt diesen zweiten, unabhängig übertragenen Nachweis nicht.
  (db) => {
    if (!hasColumn(db, 'credentials', 'resume_key_hash')) db.exec('ALTER TABLE credentials ADD COLUMN resume_key_hash TEXT');
  },
  // Version 5: Gate-A-Abnahmebericht - Befunde G-01 und G-02: beide bisherigen
  // "unbeanspruchten"-Mechanismen (H-01 für Rotation, M-01 für Legacy-Aufwertung) hielten zwar
  // das GEHEIMNIS selbst für Wiederholungsversuche bereit, aber nicht den bei DERSELBEN
  // Ausstellung gehörenden neuen Wiederherstellungsnachweis - eine Wiederholung bekam
  // fälschlich den Nachweis des VORHERIGEN (alten) Credentials zurück, der zum neuen Geheimnis
  // gar nicht passt. Getrennte "pending"-Spalten lösen das nach demselben, bereits bewährten
  // Muster wie pending_secret/claimed.
  (db) => {
    for (const [name, def] of Object.entries({
      pending_resume_key: 'TEXT', // gehört zum NACHFOLGER einer Rotation, siehe G-01
      legacy_upgrade_secret: 'TEXT', // gehört zur Legacy-Aufwertung DESSELBEN Credentials, siehe G-02
      legacy_upgrade_resume_key: 'TEXT',
    })) {
      if (!hasColumn(db, 'credentials', name)) db.exec(`ALTER TABLE credentials ADD COLUMN ${name} ${def}`);
    }
  },
  // Version 6: Baustufe 3 "Betriebsfestigkeit".
  (db) => {
    // Manipulationsgeschützteres Auditprotokoll: jeder Eintrag verkettet einen Hash über seinen
    // eigenen Inhalt UND den Hash des VORHERIGEN Eintrags (wie eine einfache Blockchain) - eine
    // nachträgliche Änderung oder Löschung eines Eintrags in der Mitte macht die Kette ab dieser
    // Stelle nachweisbar ungültig, ohne dass ein externes System nötig ist.
    if (!hasColumn(db, 'admin_audit_log', 'entry_hash')) db.exec('ALTER TABLE admin_audit_log ADD COLUMN entry_hash TEXT');
    if (!hasColumn(db, 'admin_audit_log', 'prev_hash')) db.exec('ALTER TABLE admin_audit_log ADD COLUMN prev_hash TEXT');

    // Zertifikatserneuerung ohne neue Kopplung: eine Historie der bisherigen Zertifikate (nicht
    // der Schlüssel selbst - der bleibt über eine Erneuerung hinweg unverändert, siehe C-01/
    // SPKI-Pinning) für Nachvollziehbarkeit.
    db.exec(`CREATE TABLE IF NOT EXISTS certificate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tls_cert TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      renewed_at TEXT NOT NULL
    );`);

    // Dead-Letter-Bearbeitung: kontrollierter Bearbeitungsstatus statt nur "abgelehnt".
    db.exec(`CREATE TABLE IF NOT EXISTS dead_letter_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_instance_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_note TEXT,
      at TEXT NOT NULL
    );`);
  },
  // Version 7: Betriebs-Gate B - Befund B3-M02: "retry"/"discard" waren bisher reine
  // Protokolleinträge ohne tatsächliche Wirkung auf der Kasse. Die "applied"-Spalte
  // unterscheidet jetzt zwischen "vom Betreiber gewünscht" und "der Kasse tatsächlich
  // zugestellt und von ihr bestätigt".
  (db) => {
    if (!hasColumn(db, 'dead_letter_actions', 'applied')) db.exec('ALTER TABLE dead_letter_actions ADD COLUMN applied INTEGER NOT NULL DEFAULT 0');
  },
];

// Version 8: Bargeldübergabe-Warteschlange (Manager→Kasse) - Money Butler legt hier eine
// Übergabe für eine bestimmte Kasse ab, die Kasse holt sie über ihre eigene, gepaarte
// Kennung wieder ab. Nach erfolgreicher Übernahme markiert die Kasse den Eintrag als
// zugestellt, damit er nicht erneut ausgeliefert wird.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_transfer_queue (
      transfer_id TEXT PRIMARY KEY,
      register_label TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      delivered_at TEXT
    );
  `);
});

// Version 9: Dauerhafte Aufzeichnung der Live-Monitor-Ereignisse (User-Wunsch: "Verkäufe
// sollen im Live-Monitor UND darüber hinaus dauerhaft nachvollziehbar sein"). WICHTIG: dies
// ist bewusst eine eigene, separate Aufzeichnung "was live gesehen wurde" - NICHT die
// eigentliche, maßgebliche Buchung (die bleibt allein received_events, mit Wiederholung/
// Dopplungsschutz/Sequenzprüfung). Geht ein einzelnes Live-Ereignis ausnahmsweise verloren
// (der Live-Kanal ist weiterhin bewusst "fire and forget"), fehlt es hier - die echte Buchung
// ist davon unberührt. Reine Diagnose-/Verlaufsdaten, daher auch in die bestehende
// pruneOperationalData()-Aufräumroutine aufgenommen (siehe index.js), nicht unbegrenzt.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      register_id TEXT,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_live_event_log_received_at ON live_event_log (received_at);
  `);
});

function openManagerDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  const currentVersion = db.prepare('PRAGMA user_version').get().user_version;

  // Befund M-02 (Sechster Nachprüfbericht): eine Datenbank mit einer NEUEREN, diesem Programm
  // unbekannten Version wurde bisher stillschweigend geöffnet - eine ältere Programmversion
  // hätte so auf einem Schema weitergearbeitet, das sie gar nicht vollständig versteht. Jetzt
  // fail-closed: eine unbekannte zukünftige Version bricht den Start kontrolliert ab.
  if (currentVersion > SCHEMA_VERSION) {
    db.close();
    throw new Error(`Datenbankversion ${currentVersion} ist neuer als die von diesem Programm unterstützte Version ${SCHEMA_VERSION} - Start abgebrochen, kein automatisches Downgrade.`);
  }

  if (currentVersion < SCHEMA_VERSION) {
    // Befund M-02: die GESAMTE Migration (alle noch ausstehenden Schritte) läuft als EINE
    // Transaktion - bricht ein Schritt ab (z. B. durch einen Stromausfall mitten in der
    // Migration), bleibt die Datenbank vollständig auf dem alten Stand, nie in einem halb
    // migrierten Zwischenzustand.
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

// Version 10: Zentrale Stammdaten (Warengruppen/Artikel/Pakete) - PC-Manager bleibt die einzige
// Pflegestelle und schreibt hier (über eine reine Loopback-Route, siehe index.js) den
// jeweils aktuellen Stand hinein. Jede Kasse holt sich diesen Stand über den bestehenden,
// bewährten Sync-Kanal ab - dieselbe Technik wie Buchungen, nur in umgekehrter Richtung.
// Eine einzelne Zeile (id=1) statt einer normalisierten Tabellenstruktur, weil Warengruppen,
// Artikel und Pakete ohnehin immer als vollständiges, in sich konsistentes Gesamtpaket
// ausgetauscht werden (kein sinnvoller Teilzustand denkbar).
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS master_data (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      groups_json TEXT NOT NULL DEFAULT '[]',
      articles_json TEXT NOT NULL DEFAULT '[]',
      packages_json TEXT NOT NULL DEFAULT '[]',
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);
});

// Version 11: Verlauf der gemessenen Antwortzeit je Kasse (Fernstrecke Kasse-Companion↔Manager) -
// Grundlage für das Fernverkehr-Dashboard mit Grafiken. Reine Verlaufs-/Diagnosedaten, daher
// ebenfalls in die bestehende Aufräumroutine aufgenommen (siehe index.js).
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_quality_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id TEXT NOT NULL,
      lag_ms INTEGER,
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connection_quality_log_recorded_at ON connection_quality_log (recorded_at);
  `);
});

// Version 12: Fernbefehl-Warteschlange - PC-Manager legt hier einen Befehl für eine bestimmte
// Kasse ab (z.B. "Stammdaten sofort neu laden"), die Kasse holt ihn beim nächsten regulären
// Sync-Kontakt automatisch ab. Kein direkter Fernzugriff auf die Kasse nötig - derselbe Aufbau
// wie die bereits bewährte Bargeldübergabe-Warteschlange.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS remote_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id TEXT NOT NULL,
      command TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      delivered_at TEXT
    );
  `);
});

// Version 13: Ausverkauft-Status je Artikel - EIN aktueller Stand pro Artikel (keine Historie
// nötig), wird bei jeder Änderung komplett überschrieben. Jede Kasse gleicht dies bei ihrem
// eigenen regulären Sync-Rhythmus (alle 15s) ab - schnell genug für "während des laufenden
// Marktbetriebs kurzfristig ausverkauft", ohne eine dauerhafte Verbindung aufbauen zu müssen.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sold_out_status (
      article_id TEXT PRIMARY KEY,
      sold_out INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by_register TEXT
    );
  `);
});

// Arbeitszeiten (Kommen/Gehen) aus der Stechuhr der Kassen.
//
// GRUNDSATZ: Stunden duerfen nicht verloren gehen. Bisher lagen sie ausschliesslich lokal auf
// dem Tablet und mussten von Hand als Datei exportiert und im Manager eingelesen werden -
// vergisst das jemand am Markttag, sind die Stunden weg. Die Kassen melden sie deshalb jetzt
// laufend hierher.
//
// Die Kasse loescht ihre eigenen Buchungen NICHT nach dem Melden. Sie merkt sich nur, welche
// bereits bestaetigt wurden. Damit liegen die Zeiten immer an zwei Stellen, und ein Ausfall
// auf einer Seite kostet keine Stunden.
//
// event_id ist der Schluessel: dieselbe Buchung kann beliebig oft gemeldet werden (z.B. weil
// eine Bestaetigung unterwegs verloren ging) und landet trotzdem nur einmal in der Tabelle.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_clock_events (
      event_id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      person_type TEXT,
      kind TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      effective_at TEXT NOT NULL,
      register_id TEXT,
      event_name TEXT,
      source TEXT,
      correction_reason TEXT,
      shift_reason TEXT,
      voided_at TEXT,
      received_at TEXT NOT NULL,
      forwarded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_time_clock_effective ON time_clock_events (effective_at);
    CREATE INDEX IF NOT EXISTS idx_time_clock_person ON time_clock_events (person_id);
  `);
});

// Gutscheine (und Wertmarken - technisch dasselbe: vorab bezahltes Guthaben).
//
// Der Verein SCHULDET das offene Guthaben noch als Ware. Deshalb gehoert es nicht nur auf die
// Kasse, die es ausgegeben hat, sondern zentral hierher: nur so ist jederzeit einsehbar,
// welche Gutscheine im Umlauf sind und welcher Restwert noch aussteht.
//
// Der Schluessel ist der Gutscheincode: dieselbe Meldung darf beliebig oft kommen und landet
// trotzdem nur einmal. Der Restwert wird bei jeder Meldung fortgeschrieben.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'gutschein',
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      issued_by_register TEXT,
      redemptions TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vouchers_balance ON vouchers (balance);
    CREATE INDEX IF NOT EXISTS idx_vouchers_expires ON vouchers (expires_at);
  `);
});

// Version 16: Verlauf der Bargeldübergaben MIT Stückelung.
//
// Zweck ist die Planung: vor dem naechsten Weihnachtsmarkt soll nachlesbar sein, wie viel
// Wechselgeld in welcher Stueckelung tatsaechlich gebraucht wurde - wie viele 2-Euro-Rollen,
// wie viele 10er-Scheine. Bisher war die Stueckelung nur im Uebergabe-Datensatz enthalten und
// verschwand mit ihm; gespeichert wurde nur die Summe.
//
// Der Schluessel ist die Uebergabe-Kennung: dieselbe Uebergabe darf mehrfach gemeldet werden
// (QR-Weg und WLAN-Weg koennen beide melden) und steht trotzdem nur einmal in der Tabelle.
// breakdown/coin_rolls liegen als JSON, weil sich die moeglichen Stueckelungen aendern koennen
// (2ct/1ct kamen spaeter dazu) - eine feste Spalte je Wert waere bei jeder Aenderung eine
// Schemaaenderung.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_transfer_log (
      transfer_id TEXT PRIMARY KEY,
      register_id TEXT,
      type TEXT,
      effective_date TEXT,
      created_at TEXT NOT NULL,
      source TEXT,
      total REAL NOT NULL DEFAULT 0,
      loose_total REAL NOT NULL DEFAULT 0,
      roll_total REAL NOT NULL DEFAULT 0,
      breakdown TEXT,
      loose_breakdown TEXT,
      coin_rolls TEXT,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cash_transfer_log_datum ON cash_transfer_log (effective_date);
    CREATE INDEX IF NOT EXISTS idx_cash_transfer_log_kasse ON cash_transfer_log (register_id);
  `);
});

// Version 17: Gemeldete Tagesabschluesse der Kassen.
//
// Bisher blieb der Abschluss auf der Kasse liegen; er wurde nur als QR-Code, Datei oder
// Ausdruck ausgegeben und musste am Stand eingesammelt werden. Jetzt meldet ihn die Kasse
// selbst - aber AUSDRUECKLICH ERST, wenn er fertig ist (Moment der Codeerzeugung, mit
// eingefrorenem Stand). Ein halb fertiger Abschluss darf nie hier landen: die Zahlen wuerden
// sonst nach dem naechsten Verkauf nicht mehr stimmen, ohne dass es jemand merkt.
//
// Schluessel ist die Abschluss-Kennung: dieselbe Meldung darf beliebig oft kommen (die Kasse
// meldet auf Anfrage erneut) und steht trotzdem nur einmal in der Tabelle.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS closings (
      closing_id TEXT PRIMARY KEY,
      register_id TEXT,
      register_name TEXT,
      created_at TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      status TEXT NOT NULL DEFAULT 'fertig',
      cash_in REAL, cash_sales REAL, cash_tips REAL, cash_out REAL, expected_cash REAL,
      staff_total REAL, staff_count INTEGER, transaction_count INTEGER,
      note TEXT, payload TEXT, received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_closings_kasse ON closings (register_id);
    CREATE INDEX IF NOT EXISTS idx_closings_zeit ON closings (created_at);
  `);
});

// Version 18: Datenschluessel je Kasse (Security Card).
//
// Der Schluessel verschluesselt die Verkaufsablage auf dem Tablet. Er wird ZUFAELLIG erzeugt
// und nie von einem Menschen getippt - genau daran scheiterte der bisherige Ansatz: einen
// 16-stelligen Schluessel, den sich jemand merken muss, vergisst irgendwann jemand, und dann
// sind die Daten unwiederbringlich weg.
//
// Hier liegt die Zweitschrift, damit das nicht passieren kann: das Tablet bekommt den
// Schluessel morgens automatisch, und ohne Netz oeffnet die gedruckte Karte. Beides kann
// verlorengehen, ohne dass die Daten verloren sind.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS register_data_keys (
      register_id TEXT PRIMARY KEY,
      data_key TEXT NOT NULL,
      card_key TEXT NOT NULL,
      ausgabe INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
});

// Version 19: Darstellungseinstellungen reisen mit den Stammdaten.
//
// BEFUND: Der Manager konnte Knopfgroessen, Farben, Bild-oder-Text, sichtbare Sondertasten und
// die Bedienerliste zwar verwalten - gesendet wurden aber nur Warengruppen und Artikel. Alles
// Uebrige musste als Kassenpaket von Hand auf jedes Tablet getragen werden. Genau der
// Handbetrieb, den die Fernpflege eigentlich abloesen sollte.
MIGRATIONS.push((db) => {
  db.exec("ALTER TABLE master_data ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'");
});


// Version 20: Uebergabeprotokolle der Geldkassette.
//
// BEFUND: Der Beleg-QR auf dem gedruckten Protokoll trug zwar den vollstaendigen Inhalt -
// gelesen hat ihn aber nichts. Ein Code, den niemand einliest, ist Zierde: das Papier kann
// verlorengehen, und dann gibt es keine Zweitschrift der Uebergabe.
//
// Der Schluessel ist die Belegnummer: derselbe Beleg darf mehrfach ankommen (der Money Butler
// meldet ihn beim Erzeugen, spaeter traegt ihn vielleicht noch jemand per QR nach) und steht
// trotzdem nur einmal in der Tabelle. Der vollstaendige Beleg liegt zusaetzlich als JSON, damit
// spaetere Erweiterungen des Belegs keine Schemaaenderung brauchen.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_protocol_log (
      beleg_id TEXT PRIMARY KEY,
      transfer_id TEXT,
      art TEXT,
      typ TEXT,
      effective_date TEXT,
      created_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      source TEXT,
      registers TEXT,
      total REAL NOT NULL DEFAULT 0,
      note TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cash_protocol_datum ON cash_protocol_log (effective_date);
    CREATE INDEX IF NOT EXISTS idx_cash_protocol_zeit ON cash_protocol_log (created_at);
  `);
});

// Version 21: Gutscheinnummern werden zentral vergeben und signiert.
//
// Bisher zaehlte jede Kasse ihre laufende Nummer selbst aus dem localStorage hoch - zwei
// Kassen am selben Stand vergeben so zwangslaeufig dieselbe Nummer, und beim Leeren der Kasse
// beginnt die Zaehlung wieder bei 1. Der Zaehler gehoert deshalb hierher.
//
// voucher_secrets haelt das Geheimnis fuer die Prüfsignatur. Es liegt bewusst IN der
// Datenbank und nicht in einer eigenen Datei: so wandert es mit der bestehenden Sicherung mit.
// Ohne dieses Geheimnis waeren alle noch gueltigen Gutscheine nicht mehr pruefbar.
// Mehrere Generationen nebeneinander, damit ein Schluesselwechsel die drei Jahre gueltigen
// Gutscheine aus der Zeit davor nicht entwertet.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voucher_secrets (
      generation TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS voucher_numbers (
      code TEXT PRIMARY KEY,
      generation TEXT NOT NULL,
      issued_to_register TEXT,
      issued_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_voucher_numbers_used ON voucher_numbers (used);
  `);
  // Wurde die Signatur einer gemeldeten Gutscheinnummer geprueft, und mit welchem Ergebnis?
  // Bewusst als Merkmal am Gutschein und nicht als Ablehnung: eine Meldung wird NIE verworfen,
  // sonst ginge ein echter Restwert verloren, weil z.B. eine alte Kasse noch das alte
  // Nummernformat meldet. Auffaellige Faelle sollen sichtbar sein, nicht verschwinden.
  if (!hasColumn(db, 'vouchers', 'signature_ok')) {
    db.exec("ALTER TABLE vouchers ADD COLUMN signature_ok INTEGER");
  }
});

// Version 22 (08.09.2026, Betreiber): Kontoumsatz im Tagesabschluss. Kontobuchungen zaehlen am
// Verkaufstag als Umsatz, sind aber kein Bargeld - bisher tauchten sie in keinem Abschluss auf.
// Jetzt: Kontoumsatz, Gesamtumsatz und die Aufteilung je Konto (JSON) am Abschluss.
MIGRATIONS.push((db) => {
  if (!hasColumn(db, 'closings', 'account_sales')) db.exec('ALTER TABLE closings ADD COLUMN account_sales REAL');
  if (!hasColumn(db, 'closings', 'total_sales')) db.exec('ALTER TABLE closings ADD COLUMN total_sales REAL');
  if (!hasColumn(db, 'closings', 'account_breakdown')) db.exec('ALTER TABLE closings ADD COLUMN account_breakdown TEXT');
});

// Version 23 (10.09.2026, Betreiber: "vollstaendiger Gelduebergabe-Weg Money Butler -> PC
// Manager -> Kasse"): eigene, bewusst GETRENNTE Warteschlange fuer Uebergaben, die vom
// Manager aus der zentralen Finance Bridge (Money Butler zuhause, kein gemeinsames Netz mit
// dem Marktstand) freigegeben werden. NICHT dieselbe Tabelle wie cash_transfer_queue
// (Version 8) - die bestehende Funktion dort uebernimmt automatisch, ohne Rueckfrage, fuer
// den Fall "Money Butler direkt am Stand im selben WLAN". Die Kassenwartin/der Kassenwart
// wollte hier ausdruecklich eine BEWUSSTE Bestaetigung an der Kasse (Betrag/Datum sehen,
// "Uebernehmen" oder "Spaeter"), nicht automatisch geschehen - eine eigene, kleine Tabelle
// haelt das sauber getrennt von der bestehenden, weiterhin unveraendert laufenden Funktion.
MIGRATIONS.push((db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_bridge_transfers (
      transfer_id TEXT PRIMARY KEY,
      register_label TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      delivered_at TEXT
    );
  `);
});

// Version 24 (20.09.2026): Konten reisen als echte Manager-Stammdaten mit.
// Bestehende Datenbanken werden nur um eine additive JSON-Spalte erweitert.
MIGRATIONS.push((db) => {
  if (!hasColumn(db, 'master_data', 'accounts_json')) {
    db.exec("ALTER TABLE master_data ADD COLUMN accounts_json TEXT NOT NULL DEFAULT '[]'");
  }
});


// Version 25 (20.09.2026): optionale Ist-Erfassung direkt beim Tagesabschluss.
// Die Zählung bleibt fachlich getrennt vom Soll-Abschluss und reist nur als eigener JSON-Block mit.
MIGRATIONS.push((db) => {
  if (!hasColumn(db, 'closings', 'cash_count_json')) db.exec('ALTER TABLE closings ADD COLUMN cash_count_json TEXT');
});

module.exports = { openManagerDb, SCHEMA_VERSION };
