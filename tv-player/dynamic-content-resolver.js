/* KC Dynamische Inhalte V1.0 (TV-Player) – löst bei jedem Render-Zyklus:
   1) Mitglieder-Rotation an zwei festen Plätzen (wm26-member-slot-a/b)
   2) Bühnenprogramm heute/morgen (aus eventProgramSnapshot, mit Rückfalltag falls kein
      Datum passt - wichtig für Platzhalter-Daten aus einem anderen Jahr)
   3) Wetterabhängige Partikeleffekte (Regen/Schnee/Sterne/Lichtpunkte je nach Vorhersage)
   Rein additiv: verkettet sich an die bestehende active()-Funktion, ersetzt sie nicht. */
(function () {
  'use strict';
  if (typeof active !== 'function') return;

  const SLOT_IDS = ['wm26-member-slot-a', 'wm26-member-slot-b'];
  function pkg() { return typeof data !== 'undefined' ? data : null; }

  function applyMemberRotation() {
    const p = pkg(); const cfg = p?.profile?.memberRotation; if (!cfg?.enabled) return;
    const pool = p?.source?.memberPool || []; if (!pool.length) return;
    const minutes = Math.max(1, +cfg.minutes || 3);
    const startIndex = Math.floor(Date.now() / (minutes * 60000)) % pool.length;
    SLOT_IDS.forEach(function (slotId, i) {
      const member = pool[(startIndex + i) % pool.length];
      const target = (p.slides || []).find(function (s) { return s.id === slotId; });
      if (target && member) { target.title = member.title; target.text = member.text; target.decorations = member.decorations; target.media = member.media; }
    });
  }

  function programEntries(dateStr) {
    return ((pkg()?.eventProgramSnapshot) || []).filter(function (e) { return e.date === dateStr; }).sort(function (a, b) { return a.time.localeCompare(b.time); });
  }
  function availableDates() {
    const all = (pkg()?.eventProgramSnapshot) || [];
    return Array.from(new Set(all.map(function (e) { return e.date; }))).sort();
  }
  function formatEntries(entries) {
    return entries.map(function (e) { return e.time + '\u2013' + e.endTime + ' Uhr \u00b7 ' + e.title + (e.description ? ' (' + e.description + ')' : ''); }).join('\n');
  }
  function dayLabel(dateStr) {
    try { return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }); }
    catch (e) { return dateStr; }
  }
  function applyProgramSlides() {
    const dates = availableDates(); if (!dates.length) return;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
    (pkg().slides || []).forEach(function (s) {
      if (!s.programSlot) return;
      let target = s.programSlot === 'today' ? todayStr : tomorrowStr;
      let entries = programEntries(target);
      if (!entries.length) { target = s.programSlot === 'today' ? dates[0] : (dates[1] || dates[0]); entries = programEntries(target); }
      s.title = (s.programSlot === 'today' ? 'B\u00fchnenprogramm heute' : 'B\u00fchnenprogramm morgen') + ' \u00b7 ' + dayLabel(target);
      s.text = entries.length ? formatEntries(entries) : 'Heute keine Programmpunkte geplant.';
    });
  }

  function weatherEffect() {
    const rows = pkg()?.weather?.lastData || []; const summary = (rows[0]?.summary || '').toLowerCase();
    if (/schnee/.test(summary)) return 'snow-light';
    if (/regen|schauer/.test(summary)) return 'rain';
    if (/klar|sonnig/.test(summary)) return 'stars';
    if (/wolk|bedeckt/.test(summary)) return 'bokeh';
    return 'glitter';
  }
  function applyWeatherEffects() {
    const effect = weatherEffect();
    (pkg().slides || []).forEach(function (s) { if (s.type === 'weather') s.animation = effect; });
  }

  const originalActive = active;
  active = function () {
    try { applyMemberRotation(); applyProgramSlides(); applyWeatherEffects(); }
    catch (err) { console.error('KC Dynamische Inhalte: Fehler bei der Auflösung:', err); }
    return originalActive();
  };
})();
