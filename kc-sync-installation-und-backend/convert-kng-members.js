// Wandelt die Mitgliederliste aus dem Köcheclub-Verwaltungsprogramm (KNG) in das Format um,
// das die Kassen-Zeiterfassung erwartet (KC_TIME_CLOCK_CONFIG_V1). Ergebnis kann direkt über
// "Datei importieren" in der Kassen-Zeiterfassung eingelesen werden.
'use strict';
const fs = require('fs');
const path = require('path');

const stateModulePath = process.argv[2];
const outputPath = process.argv[3] || 'zeiterfassung_mitglieder.json';
if (!stateModulePath) { console.error('Nutzung: node convert-kng-members.js <Pfad zu extrahiertem DEFAULT_STATE> <Ausgabedatei>'); process.exit(1); }

const state = require(path.resolve(stateModulePath));

// Geburtsdatum "1953-05-23" -> Rückfall-Code "230553" (TTMMJJ), passend zum bestehenden
// Rückfallweg in der Kassen-Zeiterfassung ("Geburtstagscode").
function birthCodeFrom(birthDate) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return '';
  const [yyyy, mm, dd] = birthDate.split('-');
  return `${dd}${mm}${yyyy.slice(2)}`;
}

// Mitgliedsart der Verwaltung -> Personenart der Zeiterfassung.
// Die Zeiterfassung kennt nur zwei Arten: 'member' und 'helper' (time-clock-core.js).
// Wer kein Vereinsmitglied ist - Gast, Aushilfe - muss dort als 'helper' ankommen. Vorher
// stand hier fest 'member', damit wurde aus jedem Gast an der Kasse ein Vollmitglied.
const ART_JE_MITGLIEDSART = {
  aktiv: 'member',
  passiv: 'member',
  ehrenmitglied: 'member',
  gast: 'helper',
  aushilfe: 'helper',
};

function personenart(m) {
  const art = String(m.memberType || '').trim().toLowerCase();
  if (!art) return 'member';                    // leeres Feld: wie bisher Mitglied
  return ART_JE_MITGLIEDSART[art] || 'helper';  // unbekannter Wert: lieber Helfer als Mitglied
}

const ausgeschieden = (m) => Boolean(String(m.exitDate || '').trim() || String(m.exitReason || '').trim());

const uebersprungen = (state.members || []).filter(ausgeschieden);

const people = (state.members || [])
  .filter((m) => !ausgeschieden(m)) // ausgetretene Mitglieder nicht mit übernehmen
  .map((m) => ({
    id: m.id,
    type: personenart(m),
    displayName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.memberNo,
    credential: m.memberNo, // Kernstück der Umstellung: echte Mitgliedsnummer statt "TC-..."-Platzhalter
    birthCode: birthCodeFrom(m.birthDate),
    // Die Mitgliedsart im Klartext mitgeben. 'role' ist in time-clock-core.js ein freies
    // Textfeld und überlebt die Normalisierung - sonst ginge die Angabe unterwegs verloren.
    role: String(m.memberType || '').trim() || 'Mitglied',
    active: true,
  }));

const payload = {
  schema: 'KC_TIME_CLOCK_CONFIG_V1',
  config: { enabled: true, eventId: 'WM-2026', allowBirthCode: true, allowManualTime: true },
  people,
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
const mitglieder = people.filter((p) => p.type === 'member').length;
const helfer = people.filter((p) => p.type === 'helper').length;
console.log(`${people.length} Personen umgewandelt -> ${outputPath}`);
console.log(`  davon Mitglieder: ${mitglieder}`);
console.log(`  davon Helfer (Gast/Aushilfe): ${helfer}`);
if (uebersprungen.length) {
  console.log(`  nicht übernommen (ausgeschieden): ${uebersprungen.map((m) => m.memberNo).join(', ')}`);
}
console.log('Beispiel:', JSON.stringify(people[0], null, 2));
