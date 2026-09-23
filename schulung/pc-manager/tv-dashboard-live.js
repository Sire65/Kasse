// KC PC-Manager – befüllt das TV-Bildschirm-Dashboard mit echten Werten aus dem gespeicherten
// Designer-Projekt. PC-Manager und Designer laufen auf demselben Ursprung (nur anderer Pfad),
// deshalb kann hier direkt derselbe localStorage-Schlüssel gelesen werden, den der Designer
// selbst benutzt - keine Übertragung, keine Kopie, immer der tatsächlich zuletzt gespeicherte Stand.
(function () {
  'use strict';
  const SPEICHER_SCHLUESSEL = 'fs3.visualDesigner.project';

  function ladeProjekt() {
    try {
      const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (!roh) return null;
      const projekt = JSON.parse(roh);
      return Array.isArray(projekt?.slides) ? projekt : null;
    } catch (e) { return null; }
  }

  // BEFUND vor der Mitglieder-Präsentation: auf einem Rechner, auf dem der Designer noch NIE
  // geöffnet wurde, stand hier "Status: Leer · Folien: 0 · Noch keine Folie vorhanden" - obwohl
  // die fertige Weihnachtsmarkt-Präsentation mit 46 Folien im Programm mitgeliefert wird. Sie
  // wurde bisher erst angelegt, wenn jemand den Designer einmal aufgerufen hat.
  // Wer am Freitag den TV-Bildschirm zeigen will, klickt aber genau hierauf.
  // Jetzt holt sich diese Seite die mitgelieferte Präsentation selbst, wenn noch keine da ist -
  // dieselbe Datei und derselbe Speicherplatz wie im Designer, also kein zweiter Weg.
  // Eine bereits begonnene eigene Arbeit wird nie überschrieben (nur wenn gar nichts da ist).
  async function holeMitgelieferteWennLeer() {
    if (localStorage.getItem(SPEICHER_SCHLUESSEL)) return false;
    try {
      const antwort = await fetch('tv-designer/assets/kasse-presentation/KC_Weihnachtsmarkt_2026_Designer.json', {cache: 'no-store'});
      if (!antwort.ok) return false;
      const daten = await antwort.json();
      if (!Array.isArray(daten.slides) || !daten.slides.length) return false;
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
      return true;
    } catch (e) { return false; }
  }

  function formatDauer(sekundenGesamt) {
    const min = Math.floor(sekundenGesamt / 60), sek = Math.round(sekundenGesamt % 60);
    return `${min}:${String(sek).padStart(2, '0')} Min.`;
  }

  const UEBERGANG_NAMEN = { fade: 'Überblenden', cut: 'Hart', slide: 'Schieben', zoom: 'Zoom' };
  function uebergangLabel(t) { return UEBERGANG_NAMEN[t] || t || 'Unbekannt'; }

  function elementTypLabel(t) {
    const namen = { text: 'Text', table: 'Tabelle', ticker: 'Laufschrift', image: 'Bild', button: 'Schaltfläche', input: 'Eingabefeld', weather: 'Wetter', panel: 'Bereich', rectangle: 'Rechteck', 'rounded-rectangle': 'Abgerundetes Rechteck', ellipse: 'Kreis/Ellipse', line: 'Linie', arrow: 'Pfeil', effect: 'Effektfläche' };
    return namen[t] || t;
  }

  function renderKpis(projekt) {
    const anzeigeDauerGesamt = projekt.slides.reduce((summe, s) => summe + (Number(s.duration) || 0), 0);
    const anzahlWetterFolien = projekt.slides.filter(s => s.items?.some(i => i.type === 'weather') || s.effectLayer?.weatherAuto).length;
    document.getElementById('tvMgrKpiStatus').textContent = projekt.slides.length ? 'Bereit' : 'Leer';
    document.getElementById('tvMgrKpiSlides').textContent = String(projekt.slides.length);
    document.getElementById('tvMgrKpiRuntime').textContent = formatDauer(anzeigeDauerGesamt);
    document.getElementById('tvMgrKpiSchedule').textContent = projekt.playback?.loop === false ? 'Einmalig' : `Dauerbetrieb${projekt.playback?.cycles > 1 ? ` (${projekt.playback.cycles}× je Durchlauf)` : ''}`;
    document.getElementById('tvMgrKpiScreen').textContent = projekt.tvProfile?.inches ? `${projekt.tvProfile.inches} Zoll` : 'Nicht optimiert';
    document.getElementById('tvMgrKpiWeather').textContent = anzahlWetterFolien ? `${anzahlWetterFolien} Folie${anzahlWetterFolien === 1 ? '' : 'n'}` : 'Keine';
  }

  function renderUebergangsChart(projekt) {
    const zaehlung = {};
    projekt.slides.forEach(s => { const t = s.transition || 'fade'; zaehlung[t] = (zaehlung[t] || 0) + 1; });
    const max = Math.max(1, ...Object.values(zaehlung));
    const ziel = document.getElementById('tvMgrScheduleChart');
    if (!ziel) return;
    ziel.innerHTML = Object.entries(zaehlung).map(([t, n]) =>
      `<div><span>${uebergangLabel(t)}</span><i style="--w:${Math.round(n / max * 100)}%"></i><b>${n} Folie${n === 1 ? '' : 'n'}</b></div>`
    ).join('') || '<p class="tv-live-empty">Keine Folien vorhanden.</p>';
  }

  function renderElementTypChart(projekt) {
    const zaehlung = {};
    projekt.slides.forEach(s => (s.items || []).forEach(i => { zaehlung[i.type] = (zaehlung[i.type] || 0) + 1; }));
    const ziel = document.getElementById('tvMgrTypeChart');
    if (!ziel) return;
    const sortiert = Object.entries(zaehlung).sort((a, b) => b[1] - a[1]);
    ziel.innerHTML = sortiert.map(([t, n]) => `<div><span>${elementTypLabel(t)}</span><strong>${n}</strong></div>`).join('') || '<p class="tv-live-empty">Keine Elemente vorhanden.</p>';
  }

  function bildPfadKorrigieren(pfad) {
    if (!pfad || /^(https?:|data:|blob:)/.test(pfad)) return pfad;
    return 'tv-designer/' + pfad;
  }

  // Zeigt die erste Folie maßstabsgetreu verkleinert - nutzt echte x/y/w/h-Werte der Elemente,
  // im Ganzen per CSS auf die kleine Vorschaubox herunterskaliert (kein eigener Layout-Nachbau nötig).
  function renderLiveVorschau(projekt) {
    const box = document.getElementById('tvMgrDashboardPreview');
    if (!box) return;
    const folie = projekt.slides[0];
    if (!folie) { box.innerHTML = '<p class="tv-live-empty" style="color:#fff;">Noch keine Folie vorhanden.</p>'; return; }
    const breite = projekt.page?.width || 1024, hoehe = projekt.page?.height || 700;
    const buehne = document.createElement('div');
    buehne.style.cssText = `position:absolute;top:50%;left:50%;width:${breite}px;height:${hoehe}px;background:${folie.bg || '#ffffff'};overflow:hidden;`;
    if (folie.backgroundImage) { buehne.style.backgroundImage = `url(${bildPfadKorrigieren(folie.backgroundImage)})`; buehne.style.backgroundSize = 'cover'; buehne.style.backgroundPosition = 'center'; }
    (folie.items || []).forEach(item => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;font-size:${item.font || 16}px;color:${item.color || '#000'};background:${typeof item.bg === 'string' ? item.bg : 'transparent'};display:flex;align-items:center;justify-content:${item.align === 'center' ? 'center' : item.align === 'right' ? 'flex-end' : 'flex-start'};text-align:${item.align || 'left'};overflow:hidden;font-weight:${item.bold ? '700' : '400'};border-radius:${item.radius || 0}px;`;
      if (item.type === 'image' && item.src) { el.style.backgroundImage = `url(${bildPfadKorrigieren(item.src)})`; el.style.backgroundSize = item.fit || 'cover'; el.style.backgroundPosition = 'center'; }
      else if (item.text) { el.textContent = item.text; }
      buehne.appendChild(el);
    });
    box.innerHTML = '';
    box.style.position = 'relative';
    const skaliererWrapper = document.createElement('div');
    skaliererWrapper.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
    skaliererWrapper.appendChild(buehne);
    box.appendChild(skaliererWrapper);
    // Maßstab per ResizeObserver bestimmen, damit es bei jeder Kastengröße korrekt passt.
    const setzeMassstab = () => { const s = Math.min(box.clientWidth / breite, box.clientHeight / hoehe); buehne.style.transform = `translate(-50%,-50%) scale(${s})`; };
    setzeMassstab();
    new ResizeObserver(setzeMassstab).observe(box);
  }

  function renderGesundheitsListe(projekt) {
    const ziel = document.getElementById('tvMgrHealthList');
    if (!ziel) return;
    const punkte = [
      { ok: true, text: 'Manager-Datenquelle verbunden' },
      { ok: !!projekt, text: projekt ? 'Designer-Projekt gefunden' : 'Noch kein Designer-Projekt gespeichert' },
      { ok: !!projekt?.slides?.length, text: projekt?.slides?.length ? `${projekt.slides.length} Folien vorhanden` : 'Keine Folien vorhanden' },
      { ok: !!projekt?.tvProfile?.inches, text: projekt?.tvProfile?.inches ? 'Für TV-Bildschirm optimiert' : 'Noch nicht für TV-Bildschirm optimiert' },
    ];
    ziel.innerHTML = punkte.map(p => `<div>${p.ok ? '🟢' : '🟡'} ${p.text}</div>`).join('');
  }

  function aktualisieren() {
    const projekt = ladeProjekt() || { slides: [], page: { width: 1024, height: 700 }, playback: {}, tvProfile: null };
    renderKpis(projekt);
    renderUebergangsChart(projekt);
    renderElementTypChart(projekt);
    renderLiveVorschau(projekt);
    renderGesundheitsListe(projekt);
  }

  // Beim Öffnen der Seite zuerst dafür sorgen, dass überhaupt eine Präsentation da ist,
  // und erst danach zeichnen - sonst sieht man kurz "Leer" und dann den richtigen Stand.
  async function oeffnen() {
    await holeMitgelieferteWennLeer();
    aktualisieren();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('[data-view="tvscreen"]')?.addEventListener('click', () => setTimeout(oeffnen, 50));
    if (document.querySelector('[data-view-panel="tvscreen"]')?.classList.contains('active')) oeffnen();
  });
})();
