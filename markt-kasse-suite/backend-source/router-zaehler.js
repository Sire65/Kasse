'use strict';
// 4G-Datenverbrauch am Stand: liest alle 15 Minuten den Zähler des TP-Link-Routers (Archer MR200)
// und stellt ihn der Stand-Brücke zur Verfügung - zu Hause erscheint er dann im PC-Manager.
//
// Einrichtung EINMAL im PC-Manager am Mini-PC („Verbindung prüfen“ → Router-Passwort → Speichern
// und testen). Das Passwort liegt nur hier im Datenordner (router-zugang.json, Benutzerprofil des
// Kassen-PCs) - nicht im Programmordner, nicht auf GitHub, nicht in Supabase, nie im Protokoll.
const fs = require('fs');
const path = require('path');
const { TpLinkMr } = require('./router-mr');

const TAKT_MS = 15 * 60 * 1000;
const ERSTER_VERSUCH_MS = 20 * 1000;

class RouterZaehler {
  constructor({ datenOrdner, log = console.log, Router = TpLinkMr, takt = TAKT_MS } = {}) {
    this.datei = path.join(datenOrdner, 'router-zugang.json');
    this.log = log; this.Router = Router; this.takt = takt;
    this.letzter = null;   // { gesamtBytes, aktuellBytes, limitBytes, limitAktiv, signal, anbieter, zeit }
    this.fehler = null;    // { text, zeit }
    this._timer = null; this._laeuft = false;
  }

  _zugang() { try { return JSON.parse(fs.readFileSync(this.datei, 'utf8')); } catch (e) { return null; } }
  eingerichtet() { const z = this._zugang(); return !!(z && z.passwort); }

  async _lesen(zugang) {
    const r = new this.Router({ adresse: zugang.adresse || '192.168.1.1', benutzer: zugang.benutzer || 'admin', passwort: zugang.passwort });
    try {
      await r.anmelden();
      const d = await r.datenverbrauch();
      if (!Number.isFinite(d.gesamtBytes)) throw new Error('Router meldet keinen Datenzähler (Feld „totalStatistics“ fehlt).');
      const { roh, ...ohneRoh } = d;
      return { ...ohneRoh, zeit: new Date().toISOString() };
    } finally { try { await r.abmelden(); } catch (e) { /* */ } }
  }

  async jetztLesen() {
    const z = this._zugang();
    if (!z || !z.passwort || this._laeuft) return this.status();
    this._laeuft = true;
    try {
      this.letzter = await this._lesen(z);
      this.fehler = null;
    } catch (e) {
      this.fehler = { text: String(e && e.message || e), zeit: new Date().toISOString() };
      this.log(`[Router] Datenzähler nicht lesbar: ${this.fehler.text}`);
    } finally { this._laeuft = false; }
    return this.status();
  }

  // Aus dem PC-Manager: erst testen, nur bei Erfolg speichern.
  async einrichten({ adresse, passwort, volumenGB } = {}) {
    if (!passwort || typeof passwort !== 'string' || passwort.length > 128) throw new Error('Bitte das Router-Admin-Passwort eingeben.');
    const ziel = String(adresse || '192.168.1.1').trim();
    if (!/^[0-9a-z.-]{3,64}$/i.test(ziel)) throw new Error('Router-Adresse ungültig.');
    const gb = Number(volumenGB) > 0 && Number(volumenGB) < 100000 ? Number(volumenGB) : null;
    const zugang = { adresse: ziel, benutzer: 'admin', passwort, volumenGB: gb, eingerichtetAm: new Date().toISOString() };
    const ergebnis = await this._lesen(zugang);   // wirft bei falschem Passwort usw.
    fs.mkdirSync(path.dirname(this.datei), { recursive: true });
    fs.writeFileSync(this.datei, JSON.stringify(zugang, null, 2), { mode: 0o600 });
    this.letzter = ergebnis; this.fehler = null;
    this.start();
    return this.status();
  }

  volumenSetzen(volumenGB) {
    const z = this._zugang(); if (!z) throw new Error('Router noch nicht eingerichtet.');
    z.volumenGB = Number(volumenGB) > 0 ? Number(volumenGB) : null;
    fs.writeFileSync(this.datei, JSON.stringify(z, null, 2), { mode: 0o600 });
    return this.status();
  }

  entfernen() {
    try { fs.unlinkSync(this.datei); } catch (e) { /* schon weg */ }
    this.letzter = null; this.fehler = null; this.stop();
    return this.status();
  }

  // Für PC-Manager und Stand-Brücke - NIE das Passwort.
  status() {
    const z = this._zugang();
    return { eingerichtet: !!(z && z.passwort), adresse: z ? z.adresse : null, volumenGB: z ? z.volumenGB || null : null,
      letzter: this.letzter, fehler: this.fehler };
  }
  kurz() {
    const s = this.status();
    if (!s.eingerichtet) return null;
    const l = s.letzter || {};
    return { gesamtBytes: l.gesamtBytes ?? null, aktuellBytes: l.aktuellBytes ?? null, volumenGB: s.volumenGB,
      limitBytes: l.limitAktiv ? l.limitBytes : null, signal: l.signal ?? null, anbieter: l.anbieter || null,
      zeit: l.zeit || null, fehler: s.fehler ? s.fehler.text : null };
  }

  start() {
    if (this._timer || !this.eingerichtet()) return;
    const erst = setTimeout(() => this.jetztLesen(), ERSTER_VERSUCH_MS); if (erst.unref) erst.unref();
    this._timer = setInterval(() => this.jetztLesen(), this.takt); if (this._timer.unref) this._timer.unref();
  }
  stop() { if (this._timer) clearInterval(this._timer); this._timer = null; }
}

module.exports = { RouterZaehler };
