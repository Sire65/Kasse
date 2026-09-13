// KC Sync – PIN-Sperre (Sicherheitsebene 3): verhindert Bedienung durch Unbefugte, falls ein
// Tablet entsperrt und unbeaufsichtigt herumliegt. Sperrt sich nach Inaktivität automatisch
// wieder.
//
// WICHTIGE LEHRE aus einem früheren, teuren Fund: dieses Fenster erscheint erst, NACHDEM die
// anderen Start-Fenster (Vollbild-Hinweis, Systemprüfung) tatsächlich verschwunden sind - sonst
// überlagern sich mehrere Fenster und blockieren echte Klicks, auch nachdem eines weggeklickt
// wurde.
(function (global) {
  'use strict';
  const PIN_HASH_KEY = 'kc_pin_lock_hash_v1';
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 Minuten Inaktivität -> erneut sperren
  let unlocked = false;
  let inactivityTimer = null;
  let encryptionKeyBytes = null; // Sicherheitsebene 1: aus der PIN abgeleiteter Schlüssel für die Datenverschlüsselung

  // BEFUND 01.09.2026 am echten iPad: hier stand crypto.subtle.digest. Das gibt es nur im
  // "sicheren Kontext" - https oder localhost. Das Tablet ruft die Kasse aber ueber die
  // WLAN-Adresse auf (http://192.168.178.79:8090), und dort ist crypto.subtle UNDEFINED.
  // Ergebnis: vier Ziffern eingeben, auf den gruenen Knopf tippen - und es passierte nichts.
  // Kein Fehler, keine Meldung, weil der Absturz in einer async-Funktion ohne catch hochkam.
  // Jetzt ueber shared/kc-krypto.js: dort wird crypto.subtle benutzt, wenn es da ist, und
  // sonst dasselbe in JavaScript gerechnet - mit identischem Ergebnis, damit eine am PC
  // gesetzte PIN auch am Tablet aufschliesst.
  async function sha256(text) { return global.KCKrypto.sha256Hex(text); }
  async function sha256Bytes(text) { return (await global.KCKrypto.sha256Bytes(text)).buffer; }

  function wartenBisWeg(getElement) {
    return new Promise((resolve) => {
      const check = () => { if (!getElement()) { resolve(); return; } setTimeout(check, 200); };
      check();
    });
  }

  function resetInactivityTimer() {
    if (!unlocked) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => { unlocked = false; zeigeSperre(); }, LOCK_TIMEOUT_MS);
  }

  function zeigeSperre() {
    if (document.getElementById('kcPinLockOverlay')) return; // schon sichtbar
    const overlay = document.createElement('div');
    overlay.id = 'kcPinLockOverlay';
    // BEFUND auf dem iPad (01.09.2026): das Fenster sass senkrecht MITTIG. Sobald die
    // Bildschirmtastatur aufging, lag sie ueber dem Eingabefeld - man tippte blind. iOS
    // verkleinert bei position:fixed die Flaeche NICHT, das Feld rutscht also nicht von selbst
    // nach oben. Deshalb sitzt das Fenster jetzt OBEN, mit etwas Abstand.
    overlay.style.cssText = 'position:fixed;inset:0;background:#07111f;z-index:99997;display:flex;'
      + 'align-items:flex-start;justify-content:center;padding:4vh 12px 12px;overflow:auto;font-family:inherit;';
    const bereitsEingerichtet = !!localStorage.getItem(PIN_HASH_KEY);
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;min-width:300px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.3);text-align:center;';
    // EIGENER ZIFFERNBLOCK statt der Bildschirmtastatur. Zwei Gruende:
    //  1. Auf einem Tablet deckt die Bildschirmtastatur das halbe Bild zu - und genau das Feld,
    //     in das man tippt. Ein eigener Block braucht sie gar nicht erst.
    //  2. Am Stand wird mit dem Daumen getippt, oft mit Handschuh. 64 Pixel hohe Tasten treffen
    //     sich, eine Tastaturtaste nicht.
    // Das Feld bleibt trotzdem beschreibbar, damit eine angeschlossene Tastatur weiter geht.
    const tasten = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    box.innerHTML = `
      <div style="font-size:1.2rem;font-weight:900;margin-bottom:12px;">${bereitsEingerichtet ? 'Kasse entsperren' : 'PIN für diese Kasse festlegen'}</div>
      <input id="kcPinInput" type="password" inputmode="none" pattern="[0-9]*" maxlength="8" autocomplete="off"
        style="font-size:1.5rem;letter-spacing:.3em;text-align:center;padding:10px;width:200px;border:2px solid #ccc;border-radius:8px;" placeholder="••••">
      <div id="kcPinError" style="color:#b91c1c;font-weight:700;margin-top:8px;min-height:1.2em;"></div>
      <div id="kcPinPad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;">
        ${tasten.map(t=>t===''
          ? '<span></span>'
          : `<button type="button" data-pin-taste="${t}" style="height:64px;font-size:1.5rem;font-weight:800;border:1px solid #c9d2dc;border-radius:10px;background:#f4f7fa;color:#172033;">${t}</button>`).join('')}
      </div>
      <button id="kcPinSubmit" type="button" style="margin-top:14px;width:100%;padding:14px;font-size:1.05rem;font-weight:900;border-radius:8px;border:none;background:#166534;color:#fff;">${bereitsEingerichtet ? 'Entsperren' : 'PIN festlegen'}</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const input = document.getElementById('kcPinInput');
    // inputmode="none" haelt die Bildschirmtastatur zu; auf einem Geraet MIT Tastatur
    // (Windows-Rechner, angeschlossene Tastatur) wird trotzdem der Fokus gesetzt, damit man
    // dort einfach lostippen kann.
    input.focus();

    async function pruefen() {
      const pin = input.value.trim();
      const errorEl = document.getElementById('kcPinError');
      if (pin.length < 4) { errorEl.textContent = 'Mindestens 4 Ziffern.'; return; }
      const hash = await sha256(pin);
      if (!bereitsEingerichtet) {
        localStorage.setItem(PIN_HASH_KEY, hash);
        encryptionKeyBytes = await sha256Bytes('kc-encryption-key:' + pin);
        unlocked = true; overlay.remove(); resetInactivityTimer();
        global.__kcRehydrate?.();
        return;
      }
      if (hash === localStorage.getItem(PIN_HASH_KEY)) {
        encryptionKeyBytes = await sha256Bytes('kc-encryption-key:' + pin);
        unlocked = true; overlay.remove(); resetInactivityTimer();
        global.__kcRehydrate?.();
      } else {
        errorEl.textContent = 'Falsche PIN.'; input.value = ''; input.focus();
      }
    }
    // Ein Knopf, der nichts tut und nichts sagt, ist das Schlimmste, was am Stand passieren
    // kann - man tippt ihn zehnmal und weiss immer noch nichts. Deshalb faengt hier ein catch
    // JEDEN Fehler ab und schreibt ihn sichtbar in die Fehlerzeile.
    const pruefenSichtbar = async () => {
      try { await pruefen(); }
      catch (err) {
        const feld = document.getElementById('kcPinError');
        if (feld) feld.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
        try { console.error('PIN-Sperre:', err); } catch (e) {}
      }
    };
    document.getElementById('kcPinSubmit').addEventListener('click', pruefenSichtbar);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefenSichtbar(); });
    box.querySelectorAll('[data-pin-taste]').forEach((knopf) => {
      knopf.addEventListener('click', () => {
        const t = knopf.getAttribute('data-pin-taste');
        if (t === '\u232B') input.value = input.value.slice(0, -1);
        else if (input.value.length < 8) input.value += t;
        document.getElementById('kcPinError').textContent = '';
      });
    });
  }

  async function starteWennBereit() {
    if (global.__kcPinLockEnabled === false) return; // in den Voreinstellungen deaktiviert
    // Wartet, bis Vollbild-Hinweis UND Start-Systemprüfung tatsächlich weg sind - verhindert
    // die Überlagerung mehrerer Fenster, die vorher echte Klicks blockiert hat.
    await wartenBisWeg(() => { const g = document.getElementById('fullscreenGate'); return g && !g.hidden; });
    await wartenBisWeg(() => document.getElementById('kcStartupOk'));
    zeigeSperre();
    ['click', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, resetInactivityTimer, { passive: true }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starteWennBereit);
  else starteWennBereit();

  global.KCPinLock = { isUnlocked: () => unlocked, getEncryptionKeyBytes: () => encryptionKeyBytes };
})(window);
