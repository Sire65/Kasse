// Dienstplan-Bruecke: holt den von KC DP2 veroeffentlichten Sollplan aus Supabase,
// uebersetzt person_id -> Pseudonym und legt ausschliesslich den aktuellen Veranstaltungsplan
// beim lokalen Manager-Companion ab. Klarnamen werden auf diesem Weg nie an die Kasse gegeben.
(function (global) {
  'use strict';
  const ORG_ID = 'KC_WERNE';
  const EVENT_ID = global.KC_DIENSTPLAN_EVENT_ID || 'KC-WM-2026';
  const PUSH_URL = 'http://127.0.0.1:47392/dienstplan/push';
  const AUTO_MINUTEN = 5;
  const state = { eventId: EVENT_ID, lastSuccessAt: null, lastError: null, lastCount: null };

  async function holeUndVeroeffentliche() {
    if (!global.KCSupabase?.istAngemeldet?.()) {
      state.lastError = 'nicht_angemeldet';
      return { ok: false, grund: 'nicht_angemeldet' };
    }
    try {
      const [plan, aliase] = await Promise.all([
        global.KCSupabase.rufeTabelleAuf(
          `kc_dp_plan_published?select=person_id,work_date,start_time,end_time,break_minutes,zone,area&status=eq.published&org_id=eq.${ORG_ID}&event_id=eq.${encodeURIComponent(EVENT_ID)}&order=work_date.asc,start_time.asc,person_id.asc`
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
        // Ohne bekanntes Pseudonym (z.B. eine Aushilfe ohne Kassen-Zugang) nicht an die Kasse
        // weitergeben. So bleibt die Kassenansicht konsequent pseudonymisiert.
        .filter((z) => z.pseudonym)
        .sort((a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.start).localeCompare(String(b.start)) ||
          String(a.pseudonym).localeCompare(String(b.pseudonym))
        );

      const antwort = await fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: EVENT_ID, schichten }),
      });
      if (!antwort.ok) throw new Error(`Weitergabe an den Manager fehlgeschlagen (${antwort.status})`);

      state.lastSuccessAt = new Date().toISOString();
      state.lastError = null;
      state.lastCount = schichten.length;
      return { ok: true, anzahl: schichten.length, eventId: EVENT_ID };
    } catch (e) {
      state.lastError = e?.message || String(e);
      throw e;
    }
  }

  let timer = null;
  function starteAutoAbgleich(minuten = AUTO_MINUTEN) {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      holeUndVeroeffentliche().catch(() => {
        /* naechster Takt versucht es erneut; state.lastError bleibt fuer Diagnose erhalten */
      });
    }, Math.max(1, minuten) * 60000);
  }

  global.KCDienstplanManager = { holeUndVeroeffentliche, starteAutoAbgleich, state, eventId: EVENT_ID };

  const start = () => {
    starteAutoAbgleich();
    setTimeout(() => holeUndVeroeffentliche().catch(() => {}), 4000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
