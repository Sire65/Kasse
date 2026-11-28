// KC Kasse – Bildschirm reinigen (Putz-Sperre).                                                    Build 1.1.0
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
// 1.1.0 (Betreiber 28.11.2026: „ein Fensterputzer mit Leiter und Lappen soll den Bildschirm putzen, schon groß, damit man
// es erkennt“): eigene, gezeichnete Figur (SVG, keine Bilddatei) – fährt mit der Leiter über den Bildschirm, steigt hoch
// und runter, wischt mit dem Lappen, Schaum und Glitzer. Nur Anzeige, fängt keine Berührung ab (das macht die Sperre).
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
#kcReinigen .kc-rn-text{position:absolute;top:14px;left:0;right:0;text-align:center;font-size:15px;z-index:2}
#kcReinigen .kc-rn-buehne{position:absolute;left:0;bottom:96px;height:66vh;width:49.5vh;pointer-events:none;-webkit-animation:kcRnFahren 16s ease-in-out infinite;animation:kcRnFahren 16s ease-in-out infinite}
#kcReinigen .kc-rn-svg{width:100%;height:100%;overflow:visible}
#kcReinigen .kc-rn-svg *{transform-box:view-box}
#kcReinigen .kc-rn-person{-webkit-animation:kcRnSteigen 7s ease-in-out infinite;animation:kcRnSteigen 7s ease-in-out infinite}
#kcReinigen .kc-rn-arm{transform-origin:252px 188px;-webkit-animation:kcRnWischen .75s ease-in-out infinite alternate;animation:kcRnWischen .75s ease-in-out infinite alternate}
#kcReinigen .kc-rn-schaum circle{-webkit-animation:kcRnSchaum 1.5s ease-in-out infinite;animation:kcRnSchaum 1.5s ease-in-out infinite}
#kcReinigen .kc-rn-schaum circle:nth-child(2n){-webkit-animation-delay:.5s;animation-delay:.5s}
#kcReinigen .kc-rn-schaum circle:nth-child(3n){-webkit-animation-delay:1s;animation-delay:1s}
#kcReinigen .kc-rn-funkeln path{fill:#fef9c3;transform-origin:center;transform-box:fill-box;-webkit-animation:kcRnFunkeln 1.6s ease-in-out infinite;animation:kcRnFunkeln 1.6s ease-in-out infinite}
#kcReinigen .kc-rn-funkeln path:nth-child(2){-webkit-animation-delay:.55s;animation-delay:.55s}
#kcReinigen .kc-rn-funkeln path:nth-child(3){-webkit-animation-delay:1.1s;animation-delay:1.1s}
#kcReinigen .kc-rn-blasen circle{-webkit-animation:kcRnBlasen 2.2s linear infinite;animation:kcRnBlasen 2.2s linear infinite}
#kcReinigen .kc-rn-blasen circle:nth-child(2){-webkit-animation-delay:.7s;animation-delay:.7s}
#kcReinigen .kc-rn-blasen circle:nth-child(3){-webkit-animation-delay:1.4s;animation-delay:1.4s}
@-webkit-keyframes kcRnFahren{0%,100%{-webkit-transform:translateX(2vw)}50%{-webkit-transform:translateX(calc(100vw - 49.5vh - 2vw))}}
@keyframes kcRnFahren{0%,100%{transform:translateX(2vw)}50%{transform:translateX(calc(100vw - 49.5vh - 2vw))}}
@keyframes kcRnSteigen{0%,100%{transform:translateY(90px)}25%{transform:translateY(90px)}50%{transform:translateY(-10px)}75%{transform:translateY(-10px)}}
@-webkit-keyframes kcRnSteigen{0%,100%{-webkit-transform:translateY(90px)}25%{-webkit-transform:translateY(90px)}50%{-webkit-transform:translateY(-10px)}75%{-webkit-transform:translateY(-10px)}}
@keyframes kcRnWischen{from{transform:rotate(-32deg)}to{transform:rotate(26deg)}}
@-webkit-keyframes kcRnWischen{from{-webkit-transform:rotate(-32deg)}to{-webkit-transform:rotate(26deg)}}
@keyframes kcRnSchaum{0%,100%{opacity:.15}50%{opacity:.85}}
@-webkit-keyframes kcRnSchaum{0%,100%{opacity:.15}50%{opacity:.85}}
@keyframes kcRnFunkeln{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.15)}}
@-webkit-keyframes kcRnFunkeln{0%,100%{opacity:0;-webkit-transform:scale(.3)}50%{opacity:1;-webkit-transform:scale(1.15)}}
@keyframes kcRnBlasen{from{opacity:.9;transform:translateY(0)}to{opacity:0;transform:translateY(-40px)}}
@-webkit-keyframes kcRnBlasen{from{opacity:.9;-webkit-transform:translateY(0)}to{opacity:0;-webkit-transform:translateY(-40px)}}
#kcReinigen .kc-rn-text b{display:block;font-size:22px;color:#9ca3af}
#kcReinigen .kc-rn-zeit{display:inline-block;font-size:34px;font-weight:900;color:#6b7280;margin:0 10px;vertical-align:middle}
#kcReinigen .kc-rn-knoepfe{position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;gap:24px;z-index:2}
#kcReinigen .kc-rn-halten{position:relative;overflow:hidden;min-width:210px;min-height:64px;padding:10px 18px;border:2px solid #374151;border-radius:14px;
  background:#111827;color:#9ca3af;font:800 17px/1.2 system-ui,Segoe UI,Arial,sans-serif;text-align:center}
#kcReinigen .kc-rn-halten small{display:block;font-size:12px;font-weight:600;color:#6b7280}
#kcReinigen .kc-rn-halten i{position:absolute;left:0;bottom:0;height:5px;width:0;background:#22c55e}
`;

  const PUTZER = `<div class="kc-rn-buehne" aria-hidden="true"><svg viewBox="0 0 360 480" class="kc-rn-svg">
  <g class="kc-rn-funkeln"><path d="M60 90l6 16 16 6-16 6-6 16-6-16-16-6 16-6z"/><path d="M110 250l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/><path d="M40 330l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>
  <g class="kc-rn-leiter" stroke="#b7791f" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M252 18 L240 476 M318 18 L330 476"/>
    <path d="M251 60h68M249 105h71M248 150h73M247 195h75M246 240h77M245 285h79M244 330h81M243 375h83M242 420h85M241 465h87" stroke-width="7"/>
  </g>
  <g class="kc-rn-eimer"><path d="M332 300h46l-6 52h-34z" fill="#94a3b8" stroke="#475569" stroke-width="4"/><path d="M334 300q21-22 42 0" fill="none" stroke="#475569" stroke-width="4"/>
    <g fill="#fff"><circle cx="344" cy="298" r="7"/><circle cx="356" cy="294" r="9"/><circle cx="368" cy="298" r="7"/></g>
    <g class="kc-rn-blasen" fill="none" stroke="#e0f2fe" stroke-width="2"><circle cx="346" cy="280" r="5"/><circle cx="362" cy="270" r="4"/><circle cx="354" cy="256" r="6"/></g></g>
  <g class="kc-rn-person">
    <g class="kc-rn-schaum" fill="#e0f2fe"><circle cx="120" cy="150" r="10"/><circle cx="104" cy="186" r="12"/><circle cx="112" cy="226" r="9"/><circle cx="96" cy="208" r="6"/><circle cx="128" cy="120" r="7"/></g>
    <path d="M258 330 l-6 -72 h18 l2 72z M282 330 l-2 -72 h18 l-4 72z" fill="#1e3a8a"/>
    <ellipse cx="258" cy="334" rx="17" ry="8" fill="#111827"/><ellipse cx="290" cy="334" rx="17" ry="8" fill="#111827"/>
    <rect x="244" y="168" width="64" height="98" rx="16" fill="#dc2626"/>
    <rect x="250" y="200" width="54" height="74" rx="10" fill="#2563eb"/><rect x="266" y="212" width="22" height="16" rx="3" fill="#1d4ed8"/>
    <path d="M254 202 L262 172 M300 202 L292 172" stroke="#2563eb" stroke-width="7" stroke-linecap="round"/>
    <path d="M300 186 q22 10 22 34" stroke="#dc2626" stroke-width="14" fill="none" stroke-linecap="round"/><circle cx="322" cy="222" r="9" fill="#f1c27d"/>
    <rect x="266" y="150" width="20" height="22" fill="#f1c27d"/>
    <circle cx="276" cy="128" r="30" fill="#f1c27d"/>
    <path d="M246 118 q30 -38 60 0 z" fill="#facc15"/><path d="M250 117 h-30 q-4 6 4 8 h30z" fill="#eab308"/>
    <circle cx="262" cy="130" r="4" fill="#111827"/><circle cx="284" cy="130" r="4" fill="#111827"/>
    <path d="M258 146 q14 12 28 0" stroke="#7c2d12" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="252" cy="140" r="5" fill="#f59e0b" opacity=".45"/><circle cx="296" cy="140" r="5" fill="#f59e0b" opacity=".45"/>
    <g class="kc-rn-arm">
      <path d="M252 188 L206 176 L168 168" stroke="#dc2626" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="164" cy="167" r="10" fill="#f1c27d"/>
      <path class="kc-rn-lappen" d="M132 136 q24 -12 40 6 q8 22 -4 44 q-22 12 -40 -4 q-10 -22 4 -46z" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <path d="M140 150 l24 4 M136 166 l26 4 M140 182 l20 2" stroke="#ca8a04" stroke-width="2"/>
    </g>
  </g>
</svg></div>`;

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
    w.innerHTML = '<div class="kc-rn-text"><b style="display:inline">🧽 Bildschirm reinigen</b><span class="kc-rn-zeit"></span><br>Berührungen sind ausgeschaltet – danach geht es von selbst zurück zur Kasse.</div>' + PUTZER
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
  global.KCBildschirmReinigen = { start, beenden, aktiv: () => aktiv, restMs: () => Math.max(0, ende - Date.now()), version: '1.1.0' };
})(window);
