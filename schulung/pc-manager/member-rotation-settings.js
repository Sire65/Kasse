/* KC Mitglieder-Rotation – Einstellungen im Manager (Zeitsteuerung-Seite).
   Steuert, wie viele der Mitglieder-Folien pro Durchlauf auf dem TV-Bildschirm
   gezeigt werden. Die eigentliche Rotation läuft im TV-Player (member-rotation.js). */
(function (global) {
  'use strict';
  const $ = id => document.getElementById(id);
  function rotation() {
    const p = global.KCGetTVPresentation?.() || global.tvPresentation;
    if (!p) return null;
    p.profile ||= {};
    return p.profile.memberRotation ||= { enabled: false, perLoop: 2, minutes: 3 };
  }
  function render() {
    const r = rotation(); if (!r) return;
    const enabled = $('tvMemberRotationEnabled'), minutes = $('tvMemberRotationMinutes');
    if (!enabled || enabled.dataset.bound) return;
    enabled.dataset.bound = '1';
    enabled.checked = !!r.enabled; minutes.value = r.minutes || 3;
    enabled.onchange = () => { const cur = rotation(); if (cur) cur.enabled = enabled.checked; global.saveTvPresentation?.(); };
    minutes.onchange = () => { const cur = rotation(); if (cur) cur.minutes = Math.max(1, +minutes.value || 3); global.saveTvPresentation?.(); };
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 200));
  new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
})(window);
