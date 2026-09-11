/* Grenze zwischen Ist-Zeiten (Kasse/PC-Manager) und Soll-Plan (Dienstplan DP3).
 *
 * BEFUND 31.08.2026: Der Vergleich rechnete mit actual.hours. Seit der Erweiterung des
 * Exports (KC_DUTY_ROSTER_ACTUALS_V1 0.3.0) liefert der PC-Manager aber Zeilen mit
 * date/start/end/breakMinutes/status - ein Feld "hours" gibt es dort nicht. Damit ergab
 * "actual.hours - plannedHours" durchgehend NaN, und die Abweichungsspalte hätte in der
 * Vorführung "NaN" angezeigt.
 * Zweiter Punkt: unvollständige Buchungen (nur Kommen oder nur Gehen) sind seit derselben
 * Änderung ausdrücklich Teil des Exports - sie sollen dem Planer AUFFALLEN. Für sie darf
 * gar keine Abweichung gerechnet werden; eine erfundene Zahl wäre schlimmer als keine.
 *
 * Deshalb: Stunden werden aus start/end gerechnet, wenn kein hours mitkommt; unvollständige
 * Zeilen bekommen varianceHours = null und incomplete = true; die Zuordnung läuft über
 * personId und ersatzweise über memberNo (so ordnet auch DP3 zu).
 */
(function (global) {
  'use strict';
  const VERSION = '0.2.0';

  const minuten = (uhrzeit) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(uhrzeit || ''));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  // Stunden einer Zeile: entweder mitgeliefert, oder aus Kommen/Gehen gerechnet.
  // Über Mitternacht hinaus wird der Tageswechsel berücksichtigt (Marktschluss nach 24 Uhr).
  function stunden(zeile) {
    if (Number.isFinite(Number(zeile?.hours))) return Number(zeile.hours);
    const von = minuten(zeile?.start), bis = minuten(zeile?.end);
    if (von === null || bis === null) return null;
    let dauer = bis - von;
    if (dauer < 0) dauer += 24 * 60;
    dauer -= Number(zeile?.breakMinutes || 0);
    return Math.round(Math.max(0, dauer) / 60 * 100) / 100;
  }

  const vollstaendig = (zeile) => (zeile?.status ? zeile.status === 'vollstaendig' : stunden(zeile) !== null);

  function compare(actuals = [], planned = []) {
    const nachPerson = new Map(), nachNummer = new Map();
    planned.forEach((item) => {
      if (item?.personId != null) nachPerson.set(String(item.personId), item);
      if (item?.memberNo) nachNummer.set(String(item.memberNo), item);
    });
    return (actuals || []).map((actual) => {
      const target = nachPerson.get(String(actual?.personId))
        || (actual?.memberNo ? nachNummer.get(String(actual.memberNo)) : undefined);
      const plannedHours = Number(target?.hours || 0);
      const ist = stunden(actual);
      const offen = !vollstaendig(actual) || ist === null;
      return {
        ...actual,
        actualHours: ist,
        plannedHours,
        // Bei unvollständigen Buchungen bewusst KEINE Abweichung - die Zeile muss vom
        // Planer nachgearbeitet werden, nicht überschlagen.
        varianceHours: offen ? null : Math.round((ist - plannedHours) * 100) / 100,
        incomplete: offen,
        rosterMatch: Boolean(target),
      };
    });
  }

  const modul = Object.freeze({version: VERSION, schema: 'KC_DUTY_ROSTER_ACTUALS_V1', compare, stunden});
  if (typeof module !== 'undefined' && module.exports) module.exports = modul;
  if (global) global.KCTimeClockDutyRosterAdapter = modul;
})(typeof window !== 'undefined' ? window : null);
