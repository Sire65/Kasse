/* PC-Manager an der direkten Leitung (KC-RT-PROGRAMME, 11.10.2026)                     Build 1.1.0
 *
 * Signale (nur Art, nie Inhalt) und was der Manager daraufhin SOFORT tut – jeweils über den bisherigen Weg:
 *   geld, zaehlung  → Money-Butler-Übergaben/Zählungen aus der Cloud abholen (KCMoneyButlerCloudIntake.poll)
 *                     und die Eingangsliste im Bereich Money Butler neu laden (KCFinanceUebergaben.listeLaden)
 *   einstellungen   → gemeinsame Messwerte-Einstellungen holen (KCCashMeasureCentralSync.pull)
 *   dienstplan      → veröffentlichten Sollplan aus dp2 holen (KCDienstplanManager.holeUndVeroeffentliche)
 * Steht die Leitung, fragt die Geld-Abholung nur noch jede Minute zur Sicherheit nach statt alle 15 s
 * (siehe kc-money-butler-cloud-intake.js). Ohne Supabase-Anmeldung baut der Manager keine Leitung auf und
 * arbeitet wie bisher. Die Kassen sind davon nicht betroffen (sie sprechen nur mit dem Kassen-Dienst).
 */
(function (global) {
  'use strict';
  if (!global.KCDirekteLeitung) return;
  const warte = {};
  // mehrere Signale kurz hintereinander (z. B. Übergabe + Statuswechsel) → einmal ausführen
  function einmal(schluessel, fn, ms = 800) {
    clearTimeout(warte[schluessel]);
    warte[schluessel] = setTimeout(() => { Promise.resolve().then(fn).catch(() => { /* nächster Takt versucht es erneut */ }); }, ms);
  }
  // Cloud-Abholung und (falls sichtbar/geladen) die Eingangsliste der Geldübergaben im Bereich Money Butler
  const geldHolen = () => Promise.all([global.KCMoneyButlerCloudIntake?.poll?.(), global.KCFinanceUebergaben?.listeLaden?.(false)]);
  const einstellungenHolen = () => global.KCCashMeasureCentralSync?.pull?.({ publish: true });
  const dienstplanHolen = () => global.KCDienstplanManager?.holeUndVeroeffentliche?.();
  function zeigeStatus(z) {
    // kleiner Hinweis an der Supabase-LED (Tooltip), ohne die vorhandene LED-Logik anzufassen
    const led = document.querySelector('.supabase-led-group');
    if (!led) return;
    led.dataset.direkteLeitung = z.steht ? 'steht' : 'aus';
    const basis = (led.getAttribute('title') || '').replace(/\s*·\s*Direkte Leitung:.*$/, '');
    led.setAttribute('title', `${basis}${basis ? ' · ' : ''}Direkte Leitung: ${z.steht ? 'steht (Neues kommt sofort)' : 'aus (Manager fragt selbst nach)'}`);
  }
  const leitung = global.KCDirekteLeitung.starte({
    name: 'pc-manager',
    async kanalHolen() {
      if (!global.KCSupabase?.istAngemeldet?.()) return null;
      const k = await global.KCSupabase.rufeFunktionAuf('kc_rt_programm_kanal', { p_bereich: 'manager' });
      return typeof k === 'string' ? k : null;
    },
    beiSignal(art) {
      if (art === 'geld' || art === 'zaehlung') einmal('geld', geldHolen);
      else if (art === 'einstellungen') einmal('einstellungen', einstellungenHolen);
      else if (art === 'dienstplan') einmal('dienstplan', dienstplanHolen, 1500);
    },
    nachholen() { einmal('geld', geldHolen, 300); einmal('dienstplan', dienstplanHolen, 2000); },
    beiStatus: zeigeStatus,
  });
  global.KCDirekteLeitungManager = { version: '1.1.0', steht: leitung.steht, zustand: leitung.zustand, neuVerbinden: leitung.neuVerbinden };
})(window);
