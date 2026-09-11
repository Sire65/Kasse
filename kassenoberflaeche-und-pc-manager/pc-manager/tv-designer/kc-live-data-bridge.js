// Nimmt das Programm-Datenpaket entgegen, das der PC-Manager beim Öffnen des Designers per
// postMessage schickt, und schreibt es in die tatsächlich aktive Arbeitskopie (project), nicht
// nur in die Ausgangsdatei - sonst kommt die Änderung nie auf dem Bildschirm an, da der Designer
// beim Start bereits eine eigene Kopie in "project" angelegt hat.
(function () {
  function formatProgrammText(eintraege) {
    if (!Array.isArray(eintraege) || !eintraege.length) return '';
    return eintraege
      .map(x => `${x.time || ''} ${x.title || ''}`.trim())
      .filter(Boolean)
      .join(' · ');
  }

  function heuteMorgenSpaeter(programm) {
    const heute = new Date().toISOString().slice(0, 10);
    const morgenDatum = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nach = (programm || []).filter(x => x.date && x.date > morgenDatum);
    return {
      today: formatProgrammText((programm || []).filter(x => x.date === heute)) || 'Kein Programm für heute hinterlegt.',
      tomorrow: formatProgrammText((programm || []).filter(x => x.date === morgenDatum)) || 'Kein Programm für morgen hinterlegt.',
      upcoming: formatProgrammText(nach)
    };
  }

  window.addEventListener('message', event => {
    if (event.data?.type !== 'KC_TV_ZEIGE_VORSCHAU') return;
    if (typeof buildStandaloneProgram !== 'function') return;
    try {
      const html = buildStandaloneProgram();
      document.open();
      document.write(html);
      document.close();
    } catch (e) { /* Projekt evtl. noch nicht vollständig geladen - Vorschau bleibt dann auf der Editor-Ansicht */ }
  });

  window.addEventListener('message', event => {
    if (event.data?.type !== 'KC_TV_TRIGGER_EXPORT') return;
    document.getElementById('tvExportPackage')?.click();
  });

  window.addEventListener('message', event => {
    if (event.data?.type !== 'KC_EVENT_PROGRAM_PACKAGE') return;
    const paket = event.data.payload;
    if (!paket || paket.schema !== 'KC_EVENT_PROGRAM_PACKAGE_V1') return;
    if (typeof project === 'undefined') return;
    project.pcManagerData = project.pcManagerData || {};
    project.pcManagerData.meta = { source: 'PC Manager', updated: new Date().toISOString() };
    project.pcManagerData.program = heuteMorgenSpaeter(paket.program);
    if (typeof render === 'function') render();
    else if (typeof renderSlides === 'function') renderSlides();
  });
})();
