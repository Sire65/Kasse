/* Weihnachtsmarkt Werne 2026 – Öffnungszeiten und Bühnenprogramm (eine Quelle für TV-Präsentation, PC-Manager, DP2).
 * Stand: Rohprogramm vom Betreiber, 18.11.2026 („noch nicht der Flyer“). „Musik vom Band“ wird nicht ausgewiesen.
 * Ändert sich das Programm, NUR hier ändern und danach:
 *   - TV-Präsentation neu bauen (tools/tv-endversion-bauen.cjs, tools/tv-version-a-uebernehmen.cjs)
 *   - PC-Manager: Merkzeichen PROGRAMM_STAND erhöhen (dann übernimmt jeder PC-Manager den neuen Stand einmal)
 *   - DP2: im PC-Manager „Für DP2 freigeben“ (Programm → Tagesprogramm)
 * Unsicher abgelesen (kleine Schrift im Rohprogramm): „Querwind in der Kirche“ (13.12.).
 */
(function (global) {
  'use strict';
  const PROGRAMM_STAND = '2026-11-18-roh';
  const OEFFNUNG = [
    { tage: 'Montag – Donnerstag', kurz: 'Mo.–Do.', wochentage: [1, 2, 3, 4], von: '15:00', bis: '21:00' },
    { tage: 'Freitag', kurz: 'Fr.', wochentage: [5], von: '15:00', bis: '22:30' },
    { tage: 'Samstag', kurz: 'Sa.', wochentage: [6], von: '12:00', bis: '22:30' },
    { tage: 'Sonntag', kurz: 'So.', wochentage: [0], von: '12:00', bis: '20:00' },
  ];
  const ZEITRAUM = { von: '2026-12-04', bis: '2026-12-13', text: '4. bis 13. Dezember 2026' };
  const K = 'Kirche', B = 'Bühne';
  // [Datum, Beginn, Ende, Programmpunkt, Ort]
  const ROH = [
    ['2026-12-04', '16:00', '18:00', 'Eröffnung + Bläsercorps', B],
    ['2026-12-04', '20:00', '22:30', 'Motherfunkers', B],
    ['2026-12-05', '12:30', '13:30', 'Trompetenkinder', B],
    ['2026-12-05', '14:30', '15:30', '2you', B],
    ['2026-12-05', '17:00', '18:00', 'Herr H.', B],
    ['2026-12-05', '19:30', '22:30', 'Mucky Feet', B],
    ['2026-12-06', '12:30', '14:00', 'Nordkirchener Dorfgebläse', B],
    ['2026-12-06', '15:00', '16:30', 'Chillin con Cover', B],
    ['2026-12-06', '17:00', '18:30', 'Orgelkonzert in der Kirche', K],
    ['2026-12-06', '18:30', '20:00', 'Big Band Ascheberg', B],
    ['2026-12-07', '16:30', '18:00', 'Tanz Sport Club Werne', B],
    ['2026-12-07', '19:00', '20:30', 'Badhavior', B],
    ['2026-12-08', '16:30', '18:00', 'Musikklassen MSS', B],
    ['2026-12-08', '19:30', '21:00', 'HeiLights', B],
    ['2026-12-09', '16:30', '18:00', 'Simon Gerundt', B],
    ['2026-12-09', '19:00', '21:00', 'Smooth Invaders', B],
    ['2026-12-10', '16:30', '18:00', 'Shanty Chor', B],
    ['2026-12-10', '19:00', '21:00', 'Fragile Matt', B],
    ['2026-12-11', '16:30', '18:00', 'Peter Weisheit & Dixie Band', B],
    ['2026-12-11', '19:00', '22:30', 'Jo Marie Dominiak', B],
    ['2026-12-12', '12:30', '14:00', 'Nilsen', B],
    ['2026-12-12', '15:00', '16:00', 'AFGSC Big Band', B],
    ['2026-12-12', '17:00', '18:00', 'Marie Sterner', B],
    ['2026-12-12', '20:00', '22:30', 'ReConnected', B],
    ['2026-12-13', '13:00', '14:30', 'Good Vibes', B],
    ['2026-12-13', '15:30', '17:00', 'Felice', B],
    ['2026-12-13', '17:00', '18:30', 'Querwind in der Kirche', K],
    ['2026-12-13', '18:30', '20:00', 'Weihnachtsquiz & Wunderkerzenabbrennen', B],
  ];
  const PROGRAMM = ROH.map(([datum, von, bis, titel, ort]) => ({ id: `wm2026-${datum.slice(5).replace('-', '')}-${von.replace(':', '')}`, datum, von, bis, titel, ort }));
  const daten = Object.freeze({ PROGRAMM_STAND, OEFFNUNG, ZEITRAUM, PROGRAMM, quelle: 'Rohprogramm Weihnachtsmarkt Werne 2026 (Betreiber, 18.11.2026)' });
  if (typeof module === 'object' && module.exports) module.exports = daten;
  if (global) global.KC_WM2026_PROGRAMM = daten;
})(typeof window !== 'undefined' ? window : null);
