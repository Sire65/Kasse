'use strict';
// Programm-Version und Update-Stand für PC-Manager, Tablets und die Stand-Brücke (Selbst-Update, 23.11.2026).
// Der Starter (starter/kc-starter.js) setzt KC_PROGRAMM_VERSION und KC_UPDATE_STAND (Datei im Datenordner).
// Läuft das Programm ohne Starter (Entwicklung, Tests), meldet es { verwaltet: false }.
const fs = require('fs');
const path = require('path');

const heuteIso = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
function lies(datei) { try { return JSON.parse(fs.readFileSync(datei, 'utf8').replace(/^﻿/, '')); } catch (e) { return null; } }
function datenOrdner() { return process.env.KC_UPDATE_STAND ? path.dirname(path.resolve(process.env.KC_UPDATE_STAND)) : null; }

function programmVersion() { return process.env.KC_PROGRAMM_VERSION || null; }

function regeln() {
  const install = process.env.KC_INSTALL_DIR;
  const standard = install ? lies(path.join(install, 'programm', 'aktuell', 'starter', 'update-standard.json')) || {} : {};
  const d = datenOrdner();
  return { ...standard, ...((d && lies(path.join(d, 'update-einstellungen.json'))) || {}) };
}

function updateInfo(jetzt = new Date()) {
  const d = datenOrdner();
  if (!d) return { verwaltet: false, version: programmVersion() };
  const st = lies(process.env.KC_UPDATE_STAND) || {};
  const r = regeln(), h = heuteIso(jetzt);
  const sperreAktiv = !!(r.marktsperreVon && r.marktsperreBis && h >= r.marktsperreVon && h <= r.marktsperreBis);
  const frei = lies(path.join(d, 'update-freigabe.json'));
  return {
    verwaltet: true, version: programmVersion(), neueVersion: st.verfuegbar ? st.fern || null : null,
    geprueft: st.geprueft || null, hinweis: st.hinweis || null,
    sperre: r.marktsperreVon ? { von: r.marktsperreVon, bis: r.marktsperreBis, aktiv: sperreAktiv } : null,
    freigabeBis: frei && frei.bis && h <= frei.bis ? frei.bis : null,
    letzterRueckfall: st.letzterRueckfall || null,
  };
}

// Freigabe gilt für heute: beim nächsten Start des Kassen-PCs wird die neue Version installiert.
function freigeben({ von = 'pc-manager' } = {}) {
  const d = datenOrdner();
  if (!d) throw new Error('Updates werden hier nicht vom Starter verwaltet.');
  const eintrag = { bis: heuteIso(), zeit: new Date().toISOString(), von: String(von).slice(0, 40) };
  fs.mkdirSync(d, { recursive: true });
  const datei = path.join(d, 'update-freigabe.json');
  fs.writeFileSync(`${datei}.tmp`, JSON.stringify(eintrag, null, 2)); fs.renameSync(`${datei}.tmp`, datei);
  return { ok: true, ...updateInfo() };
}

module.exports = { updateInfo, freigeben, programmVersion, heuteIso };
