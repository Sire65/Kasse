// Dienstplan-Bruecke: holt den von dp2 veroeffentlichten Sollplan (Tabelle
// kc_dp_plan_published, siehe Datenbank-Migration) ueber die bereits bestehende
// Supabase-Anmeldung des PC-Managers (kc-manager-supabase-status.js), uebersetzt
// person_id -> Pseudonym (Tabelle kc_core_pos_aliases, ebenfalls bereits vorhanden -
// KEIN Klarname wird an dieser Stelle je angefasst) und legt das Ergebnis beim
// Manager-Companion ab (loopback, dieselbe Route/derselbe Port wie /master-data/push).
// Jede Kasse holt sich den Stand danach wie gewohnt ueber ihren Companion ab.
(function (global) {
  'use strict';
  const ORG_ID = 'KC_WERNE';
  const PUSH_URL = 'http://127.0.0.1:47392/dienstplan/push';
  const AUTO_MINUTEN = 5;
  const EVENT_ID = 'KC_DP';

  async function holeUndVeroeffentliche() {
    if (!global.KCSupabase?.istAngemeldet?.()) return { ok: false, grund: 'nicht_angemeldet' };
    const [plan, aliase] = await Promise.all([
      global.KCSupabase.rufeTabelleAuf(
        `kc_dp_plan_published?select=person_id,work_date,start_time,end_time,break_minutes,zone,area,event_id,published_at,updated_at&status=eq.published&org_id=eq.${ORG_ID}&event_id=eq.${EVENT_ID}&order=work_date.asc`
      ),
      global.KCSupabase.rufeTabelleAuf(
        `kc_core_pos_aliases?select=person_id,alias_name&org_id=eq.${ORG_ID}&active=is.true`
      ),
    ]);
    const pseudonymFuer = new Map((Array.isArray(aliase) ? aliase : []).map((a) => [a.person_id, a.alias_name]));
    const schichten = (Array.isArray(plan) ? plan : [])
      .map((z) => ({
        pseudonym: pseudonymFuer.get(z.person_id) || null,
        date: z.work_date,
        start: String(z.start_time || '').slice(0, 5),
        end: String(z.end_time || '').slice(0, 5),
        breakMinutes: z.break_minutes || 0,
        zone: z.zone || null,
        area: z.area || null,
      }))
      // Ohne bekanntes Pseudonym (z.B. eine dp2-Aushilfe ohne eigenen Kassen-Zugang) NICHT an
      // die Kasse weitergeben - sonst muesste dort eine leere/anonyme Zeile erscheinen.
      .filter((z) => z.pseudonym);
    const serverStand = (Array.isArray(plan) ? plan : [])
      .map((z) => z.updated_at || z.published_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    const antwort = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schichten, eventId: EVENT_ID, sourceUpdatedAt: serverStand }),
    });
    if (!antwort.ok) throw new Error(`Weitergabe an den Manager fehlgeschlagen (${antwort.status})`);
    return { ok: true, anzahl: schichten.length };
  }

  let timer = null;
  function starteAutoAbgleich(minuten = AUTO_MINUTEN) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      holeUndVeroeffentliche().catch(() => {
        /* naechster Takt versucht es erneut - kein Popup fuer einen einzelnen verpassten Takt */
      });
    }, Math.max(1, minuten) * 60000);
  }

  global.KCDienstplanManager = { holeUndVeroeffentliche, starteAutoAbgleich };

  const start = () => {
    starteAutoAbgleich();
    // Einmal gleich beim Laden versuchen, nicht erst nach 5 Minuten warten.
    setTimeout(() => holeUndVeroeffentliche().catch(() => {}), 4000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
