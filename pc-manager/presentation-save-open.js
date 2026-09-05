/* KC Präsentation Speichern-unter / Öffnen V1.0 – ergänzt echte Dateisystem-Dialoge
   (Ordner-/Dateiauswahl) für die TV-Präsentation, zusätzlich zum bisherigen automatischen
   Download. Nutzt die File System Access API, sofern der Browser sie unterstützt; sonst
   sauberer Rückfall auf den bekannten Download- bzw. Datei-Auswahl-Dialog. */
(function (global) {
  'use strict';
  function status(text) { const el = document.getElementById('tvPreviewStatus'); if (el) el.textContent = text; }

  async function saveAs() {
    if (typeof readTvEditor === 'function') readTvEditor();
    const payload = JSON.stringify(tvPresentation, null, 2);
    const suggestedName = `${tvPresentation?.profile?.name || 'KC_Praesentation'}.kctv`.replace(/[\\/:*?"<>|]/g, '_');
    if (global.showSaveFilePicker) {
      try {
        const handle = await global.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'KC TV-Präsentation', accept: { 'application/json': ['.kctv'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();
        status(`Gespeichert unter: ${handle.name}`);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // Nutzer hat den Dialog abgebrochen
        console.error('Speichern unter fehlgeschlagen, Rückfall auf Download:', err);
      }
    }
    // Rückfall: bekannter Download-Mechanismus, falls die Datei-API nicht verfügbar ist
    global.download?.(suggestedName, payload);
    status('Datei wurde heruntergeladen (Speichern-unter-Dialog nicht verfügbar).');
  }

  function applyOpenedPresentation(data) {
    if (!data || !Array.isArray(data.slides)) throw new Error('Datei enthält keine gültige Präsentation.');
    tvPresentation = data;
    tvSlideIndex = 0;
    global.saveTvPresentation?.();
    global.renderTvSlideList?.();
    global.loadTvEditor?.();
    global.renderTvPreview?.();
    status('Präsentation wurde geöffnet.');
  }

  async function openFile() {
    if (global.showOpenFilePicker) {
      try {
        const [handle] = await global.showOpenFilePicker({
          types: [{ description: 'KC TV-Präsentation', accept: { 'application/json': ['.kctv', '.json'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const data = JSON.parse(await file.text());
        applyOpenedPresentation(data);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('Öffnen fehlgeschlagen, Rückfall auf Datei-Auswahl:', err);
      }
    }
    document.getElementById('tvOpenFileInput')?.click();
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    document.getElementById('tvSaveAs')?.addEventListener('click', saveAs);
    document.getElementById('tvOpenFile')?.addEventListener('click', openFile);
    document.getElementById('tvOpenFileInput')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      try { applyOpenedPresentation(JSON.parse(await file.text())); }
      catch (err) { alert('Datei konnte nicht gelesen werden: ' + err.message); }
      event.target.value = '';
    });
  }, 300));
})(window);
