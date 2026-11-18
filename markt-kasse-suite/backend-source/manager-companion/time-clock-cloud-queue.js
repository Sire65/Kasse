'use strict';
const crypto = require('node:crypto');

// Rohbuchungen bleiben in SQLite. Eine Quittung gilt nur für genau diesen Inhalt.
class TimeClockCloudQueue {
  constructor({db, send, people, readState = null, onStatus = () => {}}) {
    this.db = db;
    if(!db.prepare('PRAGMA table_info(time_clock_events)').all().some(c=>c.name==='member_no'))db.exec('ALTER TABLE time_clock_events ADD COLUMN member_no TEXT');
    this.send = send;
    this.people = people;
    this.readState = readState;
    db.exec("CREATE TABLE IF NOT EXISTS time_clock_shared_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)");
    this.onStatus = onStatus;
    this.busy = null;
    this.lastError = null;
    db.exec('CREATE TABLE IF NOT EXISTS time_clock_cloud_receipts (event_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, acknowledged_at TEXT NOT NULL)');
  }
  pending() {
    const persons = this.people();
    const receipts = new Map(this.db.prepare('SELECT event_id, fingerprint FROM time_clock_cloud_receipts').all().map(r => [r.event_id, r.fingerprint]));
    return this.db.prepare('SELECT * FROM time_clock_events ORDER BY effective_at, event_id').all().map(r => {
      const matches = persons.filter(p => p.id === r.person_id || String(p.credential).toUpperCase() === String(r.person_id).toUpperCase());
      const credential = r.member_no || (matches.length === 1 ? matches[0].credential : null);
      const event = {id:r.event_id, personId:r.person_id, credential, kind:r.kind, recordedAt:r.recorded_at,
        effectiveAt:r.effective_at, registerId:r.register_id, eventId:r.event_name,
        correctionReason:r.correction_reason, shiftReason:r.shift_reason, voidedAt:r.voided_at};
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
      return {event, fingerprint};
    }).filter(r => receipts.get(r.event.id) !== r.fingerprint);
  }
  status() { return {pending:this.pending().length, sending:!!this.busy, error:this.lastError}; }
  async stop() { this.stopping=true; await this.busy; }
  flush(options = null) {
    if(this.stopping)return Promise.resolve({ok:false,acknowledged:0,error:'Der Manager-Dienst wird beendet. Buchungen bleiben gespeichert.'});
    if (this.busy) return options ? this.busy.then(() => this.flush(options)) : this.busy;
    this.busy = this.drain(options?.send || this.send, options?.readState || this.readState).finally(() => {this.busy = null; this.onStatus(this.status());});
    return this.busy;
  }
  async drain(send, readState) {
    this.lastError = null;
    let acknowledged = 0;
    try {
      for (const row of this.pending().slice(0,100)) {
        if(this.stopping)break;
        if (!row.event.credential) {
          this.lastError='Mitgliedsnummer fehlt. Bitte die Stechuhr-Zugänge im PC-Manager aktualisieren.';
          continue;
        }
        let response;
        try { response=await send([row.event]); }
        catch(error){
          if(error.eventRejected){this.lastError=error.message;continue;}
          throw error;
        }
        if (response?.ok !== true || response.contract !== 'KC_DP_STEMPEL_KASSE_V1' ||
            !Array.isArray(response.accepted) || !response.accepted.includes(row.event.id)) {
          throw new Error('Die zentrale Bestätigung fehlt. Die Buchung bleibt für den nächsten Versuch gespeichert.');
        }
        this.db.prepare('INSERT INTO time_clock_cloud_receipts(event_id, fingerprint, acknowledged_at) VALUES (?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET fingerprint=excluded.fingerprint, acknowledged_at=excluded.acknowledged_at')
          .run(row.event.id, row.fingerprint, new Date().toISOString());
        acknowledged++;
      }
      if (readState && !this.stopping) {
        const response=await readState();
        if(response?.contract!=='KC_DP_STEMPEL_KASSE_V1'||!Array.isArray(response.events))throw Error('Gemeinsamer Anmeldestand nicht bestätigt.');
        const payload=JSON.stringify(response.events);
        const previous=this.db.prepare('SELECT payload FROM time_clock_shared_state WHERE id=1').get();
        if(previous?.payload!==payload){
          this.db.prepare('INSERT INTO time_clock_shared_state(id,payload) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(payload);
          this.db.prepare('UPDATE master_data SET revision=revision+1 WHERE id=1').run();
        }
      }
      return {ok:!this.lastError, acknowledged, ...(this.lastError?{error:this.lastError}:{})};
    } catch (error) {
      this.lastError = error.message;
      return {ok:false, acknowledged, error:this.lastError};
    }
  }
}
module.exports = {TimeClockCloudQueue};
