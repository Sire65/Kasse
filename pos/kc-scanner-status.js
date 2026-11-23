/* KC Kasse – Scanner-Anzeige oben links neben der Kochmütze (Wunsch Betreiber 23.11.2026).       Build 1.1.0
 *
 * Eine Webseite darf unter Android nicht abfragen, ob ein Bluetooth-Scanner gekoppelt ist. Darum erkennt die
 * Anzeige echte Scans an der Geschwindigkeit: ein Scanner „tippt“ den ganzen Code in wenigen Millisekunden und
 * schickt Enter hinterher – ein Mensch ist viel langsamer.
 *
 *   🟢 Scanner bereit        Scan in den letzten 30 Min. (so lange schläft der HW0010 nicht ein) und die Kasse nimmt Scans an
 *   🟡 Scanner: Feld aktiv   ein Eingabefeld ist offen – der Scan landet dort, nicht im Bon
 *   🟡 Kasse antippen        die Seite hat gerade keinen Fokus (z. B. anderes Fenster) – Scans kommen nicht an
 *   ⚪ blass                 seit 30 Min. kein Scan – Scanner aus oder eingeschlafen (Wunsch Betreiber: „blass, wenn aus;
 *                           grün und hell leuchtend, wenn bereit“)
 * Antippen öffnet den Test: „Jetzt einen beliebigen Code scannen“. Der Test-Scan wird abgefangen – es landet
 * kein Artikel im Bon. Kassieren wird nie blockiert.
 */
(function (global) {
  'use strict';
  if (global.KCScannerStatus) return;
  const MERK = 'kc_scanner_letzter_scan_v1';
  const SCHLAF_MS = 30 * 60 * 1000;     // Sleep Time laut SCANNER_EINRICHTUNG.md (30 min)
  const MAX_ABSTAND_MS = 45;            // Abstand zwischen zwei Zeichen eines Scans
  const MIN_ZEICHEN = 4;
  let letzterScan = 0, test = null;
  try { letzterScan = Number(localStorage.getItem(MERK) || 0) || 0; } catch (e) { /* */ }
  let puffer = 0, letzteTaste = 0, erste = 0;

  const stil = document.createElement('style');
  stil.textContent = `
#kcScanner{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:46px;height:46px;margin:0 8px 0 0;border-radius:12px;
  border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;font-size:22px;line-height:1;position:relative;cursor:pointer;touch-action:manipulation}
#kcScanner::after{content:"";position:absolute;right:-3px;top:-3px;width:14px;height:14px;border-radius:50%;border:2px solid #0c1726;background:#8a94a6}
#kcScanner[data-zustand="unbekannt"]{opacity:.35;filter:grayscale(1);border-style:dashed}
#kcScanner[data-zustand="bereit"]{opacity:1;border-color:#3ee08a;background:#169c55;box-shadow:0 0 10px 2px rgba(62,224,138,.85),inset 0 0 6px rgba(255,255,255,.35)}
#kcScanner[data-zustand="bereit"]::after{background:#7dffb6;box-shadow:0 0 10px #3ee08a}
#kcScanner[data-zustand="feld"],#kcScanner[data-zustand="fokus"]{border-color:#f5b400;background:rgba(245,180,0,.16)}
#kcScanner[data-zustand="feld"]::after,#kcScanner[data-zustand="fokus"]::after{background:#f5b400}
#kcScanner.kc-scan-blitz{animation:kcScanBlitz .6s ease-out}
@keyframes kcScanBlitz{0%{box-shadow:0 0 0 0 rgba(47,191,113,.9)}100%{box-shadow:0 0 0 14px rgba(47,191,113,0)}}
#kcScanner.kc-scanner-feld{width:40px;height:40px;margin:0 6px 0 4px;font-size:20px;align-self:center}
@media (prefers-reduced-motion: reduce){#kcScanner.kc-scan-blitz{animation:none}}
#kcScannerTest{position:fixed;inset:0;z-index:99990;background:rgba(7,17,31,.55);display:flex;align-items:center;justify-content:center;padding:16px}
#kcScannerTest .kst-karte{background:#fff;color:#172338;border-radius:16px;max-width:460px;width:100%;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:16px/1.45 system-ui,Segoe UI,Arial,sans-serif}
#kcScannerTest h3{margin:0 0 10px;font-size:1.25rem}
#kcScannerTest .kst-gross{font-size:1.15rem;font-weight:700;padding:12px;border-radius:10px;background:#eef3f7;margin:10px 0}
#kcScannerTest .kst-gross.gut{background:#e7f6ec;color:#166534}
#kcScannerTest ol{margin:6px 0 0 20px;padding:0}
#kcScannerTest button{font:inherit;font-weight:700;padding:10px 18px;border-radius:10px;border:0;background:#172338;color:#fff;margin-top:12px;min-height:44px}`;
  document.head.appendChild(stil);

  function feldAktiv() {
    const a = document.activeElement;
    return !!(a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || a.isContentEditable));
  }
  function zustand() {
    if (!document.hasFocus()) return 'fokus';
    if (feldAktiv()) return 'feld';
    if (letzterScan && Date.now() - letzterScan < SCHLAF_MS) return 'bereit';
    return 'unbekannt';
  }
  const TEXT = {
    bereit: 'Scanner bereit – Scans gehen in den Bon',
    feld: 'Scanner: ein Eingabefeld ist offen – der Scan landet im Feld',
    fokus: 'Kasse antippen – sonst kommen Scans nicht an',
    unbekannt: 'Scanner: noch kein Scan erkannt – antippen zum Testen',
  };
  function zeichnen() {
    const k = document.getElementById('kcScanner'); if (!k) return;
    platzieren();
    const z = zustand();
    if (k.dataset.zustand !== z) { k.dataset.zustand = z; k.title = TEXT[z]; k.setAttribute('aria-label', TEXT[z]); }
  }
  function blitz() {
    const k = document.getElementById('kcScanner'); if (!k) return;
    k.classList.remove('kc-scan-blitz'); void k.offsetWidth; k.classList.add('kc-scan-blitz');
  }

  // Scans erkennen (nur beobachten - der normale Ablauf der Kasse bleibt unberührt, außer im Test)
  document.addEventListener('keydown', (e) => {
    const t = e.timeStamp || performance.now();
    if (e.key === 'Enter') {
      const schnell = puffer >= MIN_ZEICHEN && t - letzteTaste <= 120 && (t - erste) / Math.max(1, puffer - 1) <= MAX_ABSTAND_MS;
      if (schnell) {
        letzterScan = Date.now();
        try { localStorage.setItem(MERK, String(letzterScan)); } catch (x) { /* */ }
        blitz(); zeichnen();
        if (test) { testErfolg(puffer, Math.round(t - erste)); }
      }
      if (test) { e.preventDefault(); e.stopImmediatePropagation(); }
      puffer = 0; return;
    }
    if (e.key && e.key.length === 1) {
      if (!puffer || t - letzteTaste > 300) { puffer = 0; erste = t; }
      puffer++; letzteTaste = t;
      if (test) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }, true);

  function testOeffnen() {
    testSchliessen();
    if (feldAktiv()) try { document.activeElement.blur(); } catch (e) { /* */ }
    const w = document.createElement('div');
    w.id = 'kcScannerTest'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    w.innerHTML = `<div class="kst-karte"><h3>📷 Scanner testen</h3>
      <div class="kst-gross" id="kstStatus">Jetzt einen <b>beliebigen Code</b> scannen (Artikel-Zettel oder Ausweis).<br><small>Der Test-Scan kommt nicht in den Bon.</small></div>
      <div id="kstHilfe" style="font-size:.95rem"></div>
      <div style="text-align:right"><button type="button" id="kstZu">Schließen</button></div></div>`;
    w.addEventListener('click', (e) => { if (e.target === w || e.target.id === 'kstZu') testSchliessen(); });
    document.body.appendChild(w);
    test = { start: Date.now(), hilfe: setTimeout(() => {
      const h = document.getElementById('kstHilfe');
      if (h) h.innerHTML = '<b>Kommt nichts an?</b><ol><li>Scanner-Taste einmal drücken – er schläft nach 30 Minuten ein.</li>'
        + '<li>Tablet: Einstellungen → Verbindungen → <b>Bluetooth an</b>, Scanner als „Verbunden“?</li>'
        + '<li>Piept der Scanner, aber hier passiert nichts: Scanner neu koppeln (Anleitung SCANNER_EINRICHTUNG, Schritt 4).</li>'
        + '<li>Akku des Scanners laden.</li></ol>';
    }, 8000) };
  }
  function testErfolg(zeichen, ms) {
    const s = document.getElementById('kstStatus');
    if (s) { s.className = 'kst-gross gut'; s.innerHTML = `✓ Scanner funktioniert – Code mit ${zeichen} Zeichen in ${ms} ms erkannt.<br><small>Die Kasse ist bereit.</small>`; }
    const h = document.getElementById('kstHilfe'); if (h) h.innerHTML = '';
    if (test) clearTimeout(test.hilfe);
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) { /* */ }
    setTimeout(testSchliessen, 2500);
  }
  function testSchliessen() {
    if (test) clearTimeout(test.hilfe);
    test = null;
    const w = document.getElementById('kcScannerTest'); if (w) w.remove();
    zeichnen();
  }

  function einbauen() {
    const marke = document.getElementById('secretTrigger');
    if (!marke || document.getElementById('kcScanner')) return;
    // Im Kochmützen-Feld ganz links (kein eigenes Kopf-Feld - das Raster des Kopfs bleibt in allen Ansichten gleich).
    // Eigene Ereignisse stoppen, damit das Gedrückthalten der Kochmütze (Service) nicht mit ausgelöst wird.
    const k = document.createElement('span');
    k.id = 'kcScanner'; k.setAttribute('role', 'button'); k.textContent = '📷';
    for (const art of ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'contextmenu']) k.addEventListener(art, (e) => e.stopPropagation());
    k.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); testOeffnen(); });
    marke.insertBefore(k, marke.firstChild);
    platzieren(); zeichnen();
  }
  // Kassen-Aufbau (Kopf als Zeile, wird erst nach dem Laden umgebaut): eigenes Feld links neben der Kochmütze.
  // Altes Raster-Layout: im Kochmützen-Feld ganz links. Wird bei jedem Zeichnen geprüft (Ansicht kann wechseln).
  function platzieren() {
    const k = document.getElementById('kcScanner'), marke = document.getElementById('secretTrigger');
    if (!k || !marke || !marke.parentElement) return;
    const kopf = marke.parentElement, zeile = getComputedStyle(kopf).display.includes('flex');
    if (zeile && k.parentElement !== kopf) { k.classList.add('kc-scanner-feld'); kopf.insertBefore(k, marke); }
    if (zeile) { const o = (parseInt(getComputedStyle(marke).order, 10) || 0) - 1; if (k.style.order !== String(o)) k.style.order = String(o); } // Aufbau ordnet per CSS „order“
    else if (k.style.order) k.style.order = '';
    else if (!zeile && k.parentElement !== marke) { k.classList.remove('kc-scanner-feld'); marke.insertBefore(k, marke.firstChild); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einbauen); else einbauen();
  global.addEventListener('load', () => { zeichnen(); setTimeout(zeichnen, 1500); });
  try { new MutationObserver(() => zeichnen()).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* */ }
  global.addEventListener('focus', zeichnen); global.addEventListener('blur', zeichnen);
  document.addEventListener('focusin', zeichnen); document.addEventListener('focusout', () => setTimeout(zeichnen, 0));
  setInterval(zeichnen, 5000);
  global.KCScannerStatus = { zustand, testOeffnen, testSchliessen, version: '1.1.0' };
})(window);
