// KC Kasse – Bildschirm reinigen (Putz-Sperre).                                                    Build 1.0.0
// 27.11.2026 (Betreiber: „Ab und an ist der Bildschirm schmutzig von der Bedienung. Kann man den Bildschirm kurz
// ausschalten, um ihn zu reinigen? Z. B. den Button mit dem Schloss, darauf einen weiteren Button etwas größer
// ‚Bildschirm reinigen‘. Wenn der gedrückt wird, soll sich der Touch einen Moment ausschalten.“)
//
// Den Touchscreen selbst kann eine Web-Seite nicht abschalten. Stattdessen legt sich eine schwarze Fläche über
// alles und fängt JEDE Berührung, jeden Klick und jede Taste ab, bevor die Kasse sie sieht:
//   🔒 (Kopfzeile) → Sperrbildschirm → großer Knopf „🧽 BILDSCHIRM REINIGEN“
//   → 20 s schwarz, nichts reagiert → danach von selbst zurück zur Kasse (offener Bon bleibt unverändert).
//   Früher fertig: „Fertig“ 3 s gedrückt halten. Länger putzen: „+20 s“ 3 s gedrückt halten.
//   Wischen über die Knöpfe löst nichts aus (Finger muss ruhig liegen bleiben).
// Liegt am Ende noch ein Finger/Tuch auf dem Glas, wartet die Sperre, bis 1 s lang nichts mehr berührt wird.
(function (global) {
  'use strict';
  if (global.KCBildschirmReinigen) return;
  const DAUER_MS = 20000, HALTEN_MS = 3000, RUHE_MS = 1000, NACHLAUF_MS = 500, WACKEL_PX = 24;
  const EREIGNISSE = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchend', 'touchmove', 'touchcancel',
    'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'keyup', 'keypress'];
  let aktiv = false, ende = 0, nachlaufBis = 0, takt = null, halten = null;
  const beruehrt = new Map();   // pointerId -> letzte Zeit
  const doc = global.document;

  const STIL = `
#kcReinigenKnopf{display:block;margin:22px auto 0;min-width:300px;min-height:84px;padding:14px 26px;border:3px solid #7dd3fc;border-radius:18px;
  background:#0c4a6e;color:#fff;font:900 24px/1.2 system-ui,Segoe UI,Arial,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.45)}
#kcReinigenKnopf small{display:block;font-size:14px;font-weight:600;color:#bae6fd;margin-top:4px}
#kcReinigen{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;background:#000;color:#6b7280;touch-action:none;
  -webkit-user-select:none;user-select:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font:600 18px/1.4 system-ui,Segoe UI,Arial,sans-serif}
#kcReinigen .kc-rn-text{text-align:center}
#kcReinigen .kc-rn-text b{display:block;font-size:22px;color:#9ca3af}
#kcReinigen .kc-rn-zeit{font-size:64px;font-weight:900;color:#4b5563;margin:6px 0}
#kcReinigen .kc-rn-knoepfe{position:absolute;left:0;right:0;bottom:24px;display:flex;justify-content:center;gap:24px}
#kcReinigen .kc-rn-halten{position:relative;overflow:hidden;min-width:210px;min-height:64px;padding:10px 18px;border:2px solid #374151;border-radius:14px;
  background:#111827;color:#9ca3af;font:800 17px/1.2 system-ui,Segoe UI,Arial,sans-serif;text-align:center}
#kcReinigen .kc-rn-halten small{display:block;font-size:12px;font-weight:600;color:#6b7280}
#kcReinigen .kc-rn-halten i{position:absolute;left:0;bottom:0;height:5px;width:0;background:#22c55e}
`;

  function stil() {
    if (doc.getElementById('kcReinigenStil')) return;
    const s = doc.createElement('style'); s.id = 'kcReinigenStil'; s.textContent = STIL;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ---- Knopf auf dem Sperrbildschirm --------------------------------------------------------------------------
  function knopfEinbauen() {
    const inhalt = doc.querySelector('#screenSaver .screen-saver-content');
    if (!inhalt || doc.getElementById('kcReinigenKnopf')) return !!inhalt;
    stil();
    const k = doc.createElement('button');
    k.type = 'button'; k.id = 'kcReinigenKnopf';
    k.innerHTML = '🧽 BILDSCHIRM REINIGEN<small>Touch 20 Sekunden aus</small>';
    inhalt.appendChild(k);
    return true;
  }
  // Der Sperrbildschirm wacht bei jeder Berührung auf (app.js, Erfassung am document). Darum fängt dieser Knopf
  // seine Berührung schon am window ab – sonst würde der Sperrbildschirm verschwinden statt die Putz-Sperre starten.
  function knopfTreffer(e) { const t = e.target; return !!(t && t.closest && t.closest('#kcReinigenKnopf')); }
  function abfangen(e) {
    if (e.cancelable) e.preventDefault();
    e.stopImmediatePropagation(); e.stopPropagation();
  }

  // ---- Putz-Sperre --------------------------------------------------------------------------------------------
  function zeichnen() {
    const w = doc.getElementById('kcReinigen'); if (!w) return;
    const rest = Math.max(0, Math.ceil((ende - Date.now()) / 1000));
    const z = w.querySelector('.kc-rn-zeit'); if (z) z.textContent = rest > 0 ? `${rest} s` : '…';
  }
  function start(dauer) {
    stil();
    if (aktiv) { ende = Math.max(ende, Date.now()) + (dauer || DAUER_MS); zeichnen(); return; }
    aktiv = true; beruehrt.clear(); halten = null;
    ende = Date.now() + (dauer || DAUER_MS);
    const w = doc.createElement('div');
    w.id = 'kcReinigen'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    w.setAttribute('aria-label', 'Bildschirm reinigen – Berührungen sind ausgeschaltet');
    w.innerHTML = '<div class="kc-rn-text"><b>🧽 Bildschirm reinigen</b><div class="kc-rn-zeit"></div>Berührungen sind ausgeschaltet.<br>Danach geht es von selbst zurück zur Kasse.</div>'
      + '<div class="kc-rn-knoepfe"><div class="kc-rn-halten" data-rn="mehr">+20 s<small>3 s gedrückt halten</small><i></i></div>'
      + '<div class="kc-rn-halten" data-rn="fertig">Fertig<small>3 s gedrückt halten</small><i></i></div></div>';
    doc.body.appendChild(w);
    try { doc.activeElement && doc.activeElement.blur && doc.activeElement.blur(); } catch (e) { /* */ }
    zeichnen();
    clearInterval(takt); takt = setInterval(tick, 200);
  }
  function tick() {
    if (!aktiv) return;
    const jetzt = Date.now();
    if (halten) {
      const anteil = Math.min(1, (jetzt - halten.seit) / HALTEN_MS);
      const balken = halten.knopf.querySelector('i'); if (balken) balken.style.width = `${Math.round(anteil * 100)}%`;
      if (anteil >= 1) {
        const art = halten.knopf.dataset.rn; haltenAus();
        if (art === 'mehr') { ende = Math.max(ende, jetzt) + DAUER_MS; zeichnen(); return; }
        beenden(); return;
      }
    }
    zeichnen();
    if (jetzt < ende) return;
    // Zeit um – liegt noch etwas auf dem Glas, warten, bis 1 s lang Ruhe ist.
    let zuletzt = 0; beruehrt.forEach((t) => { if (t > zuletzt) zuletzt = t; });
    if (beruehrt.size && jetzt - zuletzt < 10000) return;
    if (zuletzt && jetzt - zuletzt < RUHE_MS) return;
    beenden();
  }
  function haltenAus() {
    if (halten) { const b = halten.knopf.querySelector('i'); if (b) b.style.width = '0'; }
    halten = null;
  }
  function beenden() {
    if (!aktiv) return;
    aktiv = false; haltenAus(); beruehrt.clear(); clearInterval(takt); takt = null;
    nachlaufBis = Date.now() + NACHLAUF_MS;     // letzte Wischbewegung nicht an die Kasse durchreichen
    doc.getElementById('kcReinigen')?.remove();
    try { if (typeof global.hideScreenSaver === 'function') global.hideScreenSaver(); else { const s = doc.getElementById('screenSaver'); if (s) s.hidden = true; } } catch (e) { /* */ }
  }

  function punkt(e) {
    const t = e.changedTouches && e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY, id: 't' + t.identifier } : { x: e.clientX, y: e.clientY, id: 'p' + (e.pointerId == null ? 0 : e.pointerId) };
  }
  function waehrendPutzen(e) {
    abfangen(e);
    // Verfolgt wird nur EINE Ereignisart (Pointer, auf alten Browsern Touch) – sonst zählt ein Finger doppelt.
    if (global.PointerEvent ? !/^pointer/.test(e.type) : !/^touch/.test(e.type)) return;
    const typ = e.type, p = punkt(e);
    if (/^(pointerdown|touchstart)$/.test(typ)) {
      beruehrt.set(p.id, Date.now());
      const knopf = e.target && e.target.closest && e.target.closest('#kcReinigen .kc-rn-halten');
      if (knopf && !halten) halten = { knopf, seit: Date.now(), x: p.x, y: p.y, id: p.id };
      else if (halten && beruehrt.size > 1) haltenAus();      // zweiter Finger/Tuch = Wischen, nicht Halten
    } else if (/^(pointermove|touchmove)$/.test(typ)) {
      beruehrt.set(p.id, Date.now());
      if (halten && halten.id === p.id && Math.hypot(p.x - halten.x, p.y - halten.y) > WACKEL_PX) haltenAus();
    } else if (/^(pointerup|pointercancel|touchend|touchcancel)$/.test(typ)) {
      if (halten && halten.id === p.id) haltenAus();
      beruehrt.delete(p.id);
    }
  }

  function wache(e) {
    if (aktiv) return waehrendPutzen(e);
    if (Date.now() < nachlaufBis) { abfangen(e); return; }
    if (knopfTreffer(e)) {
      abfangen(e);
      if (/^(pointerdown|touchstart|mousedown|click)$/.test(e.type) || (e.type === 'keydown' && (e.key === 'Enter' || e.key === ' '))) start();
    }
  }
  EREIGNISSE.forEach((t) => global.addEventListener(t, wache, { capture: true, passive: false }));

  function los() {
    if (!knopfEinbauen()) { let n = 0; const id = setInterval(() => { if (knopfEinbauen() || ++n > 60) clearInterval(id); }, 500); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', los); else los();
  global.KCBildschirmReinigen = { start, beenden, aktiv: () => aktiv, restMs: () => Math.max(0, ende - Date.now()), version: '1.0.0' };
})(window);
