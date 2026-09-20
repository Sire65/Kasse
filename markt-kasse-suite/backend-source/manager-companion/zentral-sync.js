// Anbindung an die zentrale KC-Datenhaltung (Supabase).
//
// WARUM HIER UND NICHT IM BROWSER: Zum Schreiben braucht es den Dienstschlüssel. Der darf
// niemals in eine Webseite - jeder, der die Seite öffnet, könnte ihn auslesen. Der Companion
// läuft auf dem Rechner des Kassenwarts und hält den Schlüssel örtlich.
// Deshalb auch: die KASSE spricht nie mit der Cloud, nur der Manager.
//
// ZUSTÄNDIGKEIT laut Datenvertrag (kc_core_data_contract):
//   Personen   gehören der Mitgliederverwaltung -> hier NUR LESEN
//   Pseudonyme gehören dem Manager              -> lesen und schreiben
//   Kommen/Gehen gehört dem Manager             -> schreiben
'use strict';
const fs = require('fs');
const path = require('path');

const KONFIG_DATEI = path.join(__dirname, '..', 'zentral-zugang.json');

function ladeKonfig() {
  try {
    const k = JSON.parse(fs.readFileSync(KONFIG_DATEI, 'utf8'));
    if (!k.url || !k.zugangswort) return null;
    return k;
  } catch (e) { return null; }
}

// Alle Vorgänge laufen über die Vermittlungsstelle in der Zentrale, nicht direkt auf die
// Tabellen. Vorteil: der Dienstschlüssel bleibt dort, auf diesem Rechner liegt nur ein
// Zugangswort - das lässt sich jederzeit austauschen, ohne irgendwo einen Schlüssel zu ändern.
// Und die Stelle kann genau vier Dinge, nicht alles.
async function vorgang(name, zusatz = {}) {
  const k = ladeKonfig();
  if (!k) throw new Error('Zentrale Datenhaltung ist nicht eingerichtet (zentral-zugang.json fehlt).');
  const antwort = await fetch(`${k.url}/functions/v1/kc-zentrale`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-kc-zugang': k.zugangswort},
    body: JSON.stringify({vorgang: name, orgId: k.orgId || 'KC_WERNE', ...zusatz}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await antwort.text();
  let daten; try { daten = JSON.parse(text); } catch (e) { daten = {}; }
  if (!antwort.ok) throw new Error(daten.fehler || `Zentrale antwortet ${antwort.status}`);
  return daten;
}

// --- Personen abholen -------------------------------------------------------------------
// Liest die gemeinsame Sicht. Die Anschrift ist dort bewusst nicht enthalten - der Manager
// braucht sie im Betrieb nicht, und was nicht übertragen wird, kann auch nicht verloren gehen.
async function personenHolen(orgId) {
  const antwort = await vorgang('personen', {orgId});
  return antwort.personen || [];
}

// --- Zeiten hochmelden ------------------------------------------------------------------
// Die Rohbuchung bleibt unverändert; dieselbe Buchung darf beliebig oft gemeldet werden.
// Der Schlüssel ist die Ereigniskennung, deshalb entstehen keine Doppelbuchungen.
async function zeitenMelden(orgId, ereignisse) {
  if (!ereignisse.length) return {gemeldet: 0, uebersprungen: 0};
  return vorgang('zeiten', {orgId, ereignisse});
}

// --- Pseudonyme hochschreiben (gehören dem Manager) --------------------------------------
async function pseudonymeSchreiben(orgId, zuordnung) {
  return vorgang('pseudonyme', {orgId, pseudonyme: zuordnung || {}});
}

async function zustand(orgId) {
  const k = ladeKonfig();
  if (!k) return {eingerichtet: false};
  const z = await vorgang('zustand', {orgId});
  return {eingerichtet: true, url: k.url, personen: z.personen, zeiten: z.zeiten};
}

module.exports = { ladeKonfig, personenHolen, zeitenMelden, pseudonymeSchreiben, zustand, KONFIG_DATEI };
