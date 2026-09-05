// Öffnet den neuen TV-Designer (Framework Studio Visual Designer) in einem eigenen Fenster.
// Baut aus den echten PC-Manager-Einstellungen (settings.eventProgram) ein Austauschpaket im
// bestehenden, bewusst eingeschränkten Format (KC_EVENT_PROGRAM_PACKAGE_V1) - dasselbe Format,
// das die Kassen-Anzeigeseite (pos/event-program-display.js) ohnehin schon liest. Dadurch bleibt
// die Kompatibilität zur Kasse automatisch erhalten, ohne dort etwas ändern zu müssen.
(function () {
  function baueAustauschpaket() {
    const programm = (typeof settings !== 'undefined' ? settings.eventProgram : []) || [];
    const daten = {
      program: programm.filter(x => x.active !== false).map(x => ({
        id: x.id || '', date: x.date || '', time: x.time || '', endTime: x.endTime || '',
        title: x.title || '', place: x.place || '', active: true,
        impact: x.impact || 'normal', weatherIndependent: !!x.weatherIndependent
      }))
    };
    if (window.EventProgramExchangeCore?.create) {
      return window.EventProgramExchangeCore.create(daten, { program: true, rating: true, weather: false, staffing: false });
    }
    return { schema: 'KC_EVENT_PROGRAM_PACKAGE_V1', version: '0.1.1', createdAt: new Date().toISOString(), ...daten };
  }

  function oeffneDesigner(alsVorschau) {
    const fenster = window.open('tv-designer/index.html', alsVorschau ? 'kcTvVorschau' : 'kcTvDesigner', 'width=1400,height=900');
    if (!fenster) { alert('Das Fenster konnte nicht geöffnet werden - bitte Popup-Blocker prüfen.'); return; }
    const paket = baueAustauschpaket();
    const versuchZuSenden = () => {
      try {
        fenster.postMessage({ type: 'KC_EVENT_PROGRAM_PACKAGE', payload: paket }, '*');
        if (alsVorschau) fenster.postMessage({ type: 'KC_TV_ZEIGE_VORSCHAU' }, '*');
      } catch (e) { /* Fenster evtl. noch nicht bereit */ }
    };
    fenster.addEventListener?.('load', versuchZuSenden);
    setTimeout(versuchZuSenden, 800);
    setTimeout(versuchZuSenden, 2000);
  }

  function loeseExportAus(fenster) {
    const versuch = () => { try { fenster.postMessage({ type: 'KC_TV_TRIGGER_EXPORT' }, '*'); } catch (e) { /* Fenster evtl. noch nicht bereit */ } };
    setTimeout(versuch, 900);
    setTimeout(versuch, 2200);
  }

  document.getElementById('tvDashEdit')?.addEventListener('click', () => oeffneDesigner(false));
  document.getElementById('tvDashTest')?.addEventListener('click', () => oeffneDesigner(true));
  document.getElementById('tvDashExport')?.addEventListener('click', () => {
    const fenster = window.open('tv-designer/index.html', 'kcTvDesigner', 'width=1400,height=900');
    if (!fenster) { alert('Das Fenster konnte nicht geöffnet werden - bitte Popup-Blocker prüfen.'); return; }
    const paket = baueAustauschpaket();
    const senden = () => { try { fenster.postMessage({ type: 'KC_EVENT_PROGRAM_PACKAGE', payload: paket }, '*'); } catch (e) { /* noch nicht bereit */ } };
    setTimeout(senden, 800);
    loeseExportAus(fenster);
  });
})();
