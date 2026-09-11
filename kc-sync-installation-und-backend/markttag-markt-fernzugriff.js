#!/usr/bin/env node
// KC Sync – Marktseite für den Fernzugriffs-Fall (Manager läuft zuhause, Kassen laufen am
// Marktstand, verbunden übers Internet über die feste MyFRITZ!-Adresse des Zuhause-Anschlusses).
//
// Läuft NUR die Kassen-Companions + den Webserver - KEIN Manager (der läuft getrennt, zuhause,
// über run-manager-service.js). Holt sich den Kopplungs-Nachweis über die neue, admin-geschützte
// Fernzugriffs-Route (/api/v1/fernzugriff/pairing-token) statt wie beim gewöhnlichen
// Marktag-Start direkt im selben Prozess.
//
// Einmalige Einrichtung nötig: markttag-fernzugriff.json mit den Zugangsdaten (siehe dort).
//
// Verwendung:  node markttag-markt-fernzugriff.js
// Beenden:     Strg+C in diesem Fenster

'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const { DeviceCompanion } = require('./device-companion');

const HIER = __dirname;
const KONFIG_DATEI = path.join(HIER, 'markttag-fernzugriff.json');
const KASSEN_DATEI = path.join(HIER, 'markttag-kassen.json');
const DATEN_ORDNER = path.join(HIER, 'markttag-fernzugriff-daten');
const WEBSERVER_PORT_WUNSCH = 8090;
const ERSTER_KASSEN_PORT_WUNSCH = 47500;

function ladeKonfiguration() {
  if (!fs.existsSync(KONFIG_DATEI)) {
    console.error(`[Fernzugriff] Fehlt: ${KONFIG_DATEI}`);
    console.error(`[Fernzugriff] Bitte diese Datei anlegen, Beispielinhalt:`);
    console.error(`{
  "managerHost": "5nzazpgfhlsk3oie.myfritz.net",
  "managerPort": 8543,
  "adminToken": "<hier den Admin-Schlüssel vom Zuhause-Manager einfügen>"
}`);
    process.exit(1);
  }
  const konfig = JSON.parse(fs.readFileSync(KONFIG_DATEI, 'utf-8'));
  if (!konfig.managerHost || !konfig.adminToken) {
    console.error('[Fernzugriff] markttag-fernzugriff.json unvollständig - managerHost und adminToken sind Pflicht.');
    process.exit(1);
  }
  konfig.managerPort = konfig.managerPort || 8543;
  return konfig;
}

function ladeKassenListe() {
  if (fs.existsSync(KASSEN_DATEI)) {
    try {
      const liste = JSON.parse(fs.readFileSync(KASSEN_DATEI, 'utf-8'));
      if (Array.isArray(liste) && liste.length) return liste;
    } catch (e) { /* Standardliste verwenden */ }
  }
  return ['KASSE-01', 'KASSE-02'];
}

function ermittleLanAdresse() {
  for (const [, liste] of Object.entries(os.networkInterfaces())) {
    for (const eintrag of liste || []) {
      if (eintrag.family === 'IPv4' && !eintrag.internal) return eintrag.address;
    }
  }
  return '127.0.0.1';
}

function portIstFrei(port) {
  return new Promise((resolve) => {
    const test = require('net').createServer();
    test.once('error', () => resolve(false));
    test.once('listening', () => { test.close(() => resolve(true)); });
    test.listen(port, '0.0.0.0');
  });
}

async function findeFreienPort(wunschPort, label) {
  for (let versuch = 0; versuch < 50; versuch++) {
    const kandidat = wunschPort + versuch;
    if (await portIstFrei(kandidat)) {
      if (versuch > 0) console.log(`[Fernzugriff] ${label}: Port ${wunschPort} war belegt, verwende stattdessen ${kandidat}.`);
      return kandidat;
    }
  }
  throw new Error(`${label}: kein freier Port gefunden.`);
}

// Holt beim entfernten Zuhause-Manager einen frischen Kopplungs-Nachweis - über HTTPS, mit dem
// Admin-Schlüssel als Nachweis (siehe neue Route in manager-companion/index.js). Das
// selbstsignierte Zertifikat wird bewusst nicht per Standard-Zertifikatskette geprüft (dafür
// gibt es keine öffentliche Ausstellungsstelle für einen Heim-PC) - die eigentliche Absicherung
// ist der Admin-Schlüssel plus die spätere Fingerabdruck-Bestätigung durch pair() selbst.
function holeKopplungsNachweisAusDerFerne(host, port, adminToken) {
  return new Promise((resolve, reject) => {
    const koerper = JSON.stringify({ apiVersion: '1.0' });
    const anfrage = https.request({
      hostname: host, port, path: '/api/v1/fernzugriff/pairing-token', method: 'POST',
      headers: { 'X-KC-Admin-Token': adminToken, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(koerper) },
      rejectUnauthorized: false,
    }, (res) => {
      let daten = '';
      res.on('data', (c) => daten += c);
      res.on('end', () => {
        try {
          const geparst = JSON.parse(daten);
          if (res.statusCode !== 200) return reject(new Error(geparst.error || `Fehler ${res.statusCode}`));
          resolve(geparst);
        } catch (e) { reject(e); }
      });
    });
    anfrage.on('error', reject);
    anfrage.write(koerper);
    anfrage.end();
  });
}

async function main() {
  const konfig = ladeKonfiguration();
  const kassenListe = ladeKassenListe();
  fs.mkdirSync(DATEN_ORDNER, { recursive: true });
  console.log(`[Fernzugriff] Zuhause-Manager: ${konfig.managerHost}:${konfig.managerPort}`);
  console.log(`[Fernzugriff] ${kassenListe.length} Kasse(n) konfiguriert: ${kassenListe.join(', ')}`);

  const kassenInfo = [];
  let naechsterKassenPort = ERSTER_KASSEN_PORT_WUNSCH;
  for (const id of kassenListe) {
    const port = await findeFreienPort(naechsterKassenPort, id);
    naechsterKassenPort = port + 1;
    const db = path.join(DATEN_ORDNER, `kasse-${id.replace(/[^A-Za-z0-9_-]+/g, '_')}.sqlite`);
    const dev = new DeviceCompanion({ dbPath: db });
    await dev.startLocalStatusServer(port, { bindAddress: '0.0.0.0' });

    if (!dev.pinned.credentialId) {
      console.log(`[Fernzugriff] ${id}: hole Kopplungs-Nachweis vom Zuhause-Manager …`);
      const { pairingToken, fingerprint } = await holeKopplungsNachweisAusDerFerne(konfig.managerHost, konfig.managerPort, konfig.adminToken);
      await dev.pair({ pairingToken, expectedFingerprint: fingerprint, host: konfig.managerHost, port: konfig.managerPort, registerLabel: id });
      console.log(`[Fernzugriff] ${id}: neu gekoppelt (mit dem Zuhause-Manager).`);
    } else {
      console.log(`[Fernzugriff] ${id}: bereits gekoppelt (von einem früheren Markttag).`);
    }

    kassenInfo.push({ id, port, dev });
    dev._syncTimer = setInterval(async () => { try { await dev.sync(); } catch (e) { /* nächster Versuch beim nächsten Zyklus */ } }, 15000);
  }
  console.log('[Fernzugriff] Alle Kassen-Companions laufen und sind mit dem Zuhause-Manager gekoppelt.');

  const wurzelOrdner = path.join(HIER, '..', 'kassenoberflaeche-und-pc-manager');
  const WEBSERVER_PORT = await findeFreienPort(WEBSERVER_PORT_WUNSCH, 'Webserver');
  const webserverProzess = spawn(process.execPath, ['serve-frontend.js', '--port', String(WEBSERVER_PORT), '--root', wurzelOrdner], { cwd: HIER, stdio: ['ignore', 'pipe', 'pipe'] });
  webserverProzess.stdout.on('data', (d) => process.stdout.write(`[Webserver] ${d}`));
  webserverProzess.stderr.on('data', (d) => process.stderr.write(`[Webserver] ${d}`));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log('[Fernzugriff] Webserver läuft.');

  const lanAdresse = ermittleLanAdresse();
  console.log('\n[Fernzugriff] ALLES BEREIT (Kassen gekoppelt mit Zuhause-Manager, Webserver läuft).');
  for (const k of kassenInfo) {
    const url = `http://${lanAdresse}:${WEBSERVER_PORT}/pos/index.html?kcPort=${k.port}&kcToken=${encodeURIComponent(k.dev.kasseAccessToken)}&kcRegisterId=${encodeURIComponent(k.id)}`;
    console.log(`[Fernzugriff] ${k.id}: ${url}`);
  }
  console.log('');

  function beenden(signal) {
    console.log(`\n[Fernzugriff] ${signal} - beende alle Programme …`);
    try { webserverProzess.kill('SIGTERM'); } catch (e) { /* bereits beendet */ }
    for (const k of kassenInfo) { try { clearInterval(k.dev._syncTimer); k.dev.stopLocalStatusServer(); } catch (e) { /* bereits beendet */ } }
    setTimeout(() => process.exit(0), 500);
  }
  process.on('SIGINT', () => beenden('SIGINT'));
  process.on('SIGTERM', () => beenden('SIGTERM'));
}

main().catch((err) => { console.error('[Fernzugriff] Fehler beim Start:', err.message); process.exit(1); });
