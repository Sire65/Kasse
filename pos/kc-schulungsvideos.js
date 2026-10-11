// KC Schulungsvideos – kleine Erklär-Videos mit Ton direkt in der Kasse       KC-KASSE-SCHULUNGSVIDEOS 0.1.0 · 11.10.2026
//
// ANLASS (Betreiber 11.10.2026): "Video-Schulung für die Kasse wie das Muster der Club-App – kleine Videos,
// immer ein Thema. Auf der Schulungskasse immer, an der echten Kasse nur im Trainingsmodus, unter MEHR →
// Schulungsvideos, Kacheln für die Bereiche. Marc und Laura dazu und den Finger. Bewertung zentral."
//
// GRUNDREGELN
// * Sichtbar und startbar NUR im Trainingsmodus (body.training-mode). Die Schulungskasse hat ihn fest an
//   (kc-schulung.js). Wird der Trainingsmodus waehrend eines Videos abgeschaltet, stoppt das Video sofort.
// * Liegt ein offener Bon im Warenkorb, startet kein Video (nichts wird ueberschrieben).
// * Ein Video SPEICHERT NIE: der Finger tippt nur bis kurz vor "Speichern"/"BAR". Am Ende gehen alle
//   Fenster zu, der Warenkorb ist leer wie vorher.
// * Der Finger und der Lichtkegel kommen aus dem vorhandenen training-demo-bridge.js (window.KCLiveDemo) –
//   kein zweiter Vorfuehr-Kern. Laura und Marc sind die Figuren aus avatar-core, wie in der Schulung.
// * Ton ueber die Sprachausgabe des Geraets (kostenlos, offline). Ohne Sprachausgabe laeuft das Video
//   mit Lesezeit weiter.
//
// AUFBAU wie in der Club-App: Registry VIDEOS (ein Eintrag = ein kleines Video), Registry THEMEN (Kacheln).
// Station: { wer: 'laura'|'marc', x: gesprochener Text, tafel?: Bild-Tafel (HTML), tun?: async F => Vorfuehrung,
//            ende?: () => Aufraeumen }. Neue Videos = neuer Eintrag; Fassung "stand" hochzaehlen, wenn ein Video
// ueberarbeitet wird (die Bewertung zaehlt dann neu).
//
// BEWERTUNG: am Ende 👍/👎 "Gefallen?" und "Hilft es?". Gespeichert in einer Warteschlange auf dem Geraet
// (kc_schulungsvideo_bewertung_v1) – die zentrale Uebertragung zum Server folgt als eigener Schritt
// (Edge Function + Tabelle kc_kasse_video_bewertung); bis dahin bleibt jede Bewertung hier erhalten.
(function (global) {
  'use strict';
  const VERSION = '0.1.0';
  const el = id => document.getElementById(id);
  const warte = ms => new Promise(r => setTimeout(r, ms));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const BEWERTUNG = 'kc_schulungsvideo_bewertung_v1';
  const GESEHEN = 'kc_schulungsvideo_gesehen_v1';
  // Die Schulungskasse liegt eine Ebene tiefer (schulung/pos/) – die Figuren liegen im gemeinsamen avatar-core.
  const AVATAR = (/\/schulung\/pos\//.test(location.pathname) ? '../../' : '../') + 'avatar-core/assets/chef/';
  const FIGUR = {
    laura: {name: 'Laura', bild: AVATAR + 'chef_female_neutral_armless_v0257.webp', art: 'w'},
    marc: {name: 'Marc', bild: AVATAR + 'chef_male_neutral_armless_v0257.webp', art: 'm'}
  };

  // ---------- Registry THEMEN: Kacheln unter MEHR → Schulungsvideos ----------
  const THEMEN = [
    {id: 'oberflaeche', sym: '🖥️', t: 'Oberfläche'},
    {id: 'verkaufen', sym: '🛒', t: 'Verkaufen'},
    {id: 'rueckgeld', sym: '💶', t: 'Rückgeld & Bezahlen'},
    {id: 'entnahmen', sym: '💸', t: 'Entnahmen'}
  ];

  // ---------- Hilfen fuer die Stationen ----------
  const tafel = (art, titel, zeilen, fuss) => `<div class="kc-sv-tafel kc-sv-${art}"><b>${titel}</b><ol>${zeilen.map(z => `<li>${z}</li>`).join('')}</ol>${fuss ? `<p>${fuss}</p>` : ''}</div>`;
  function alleFensterZu() { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) { /* egal */ } }); }

  // ---------- Registry VIDEOS ----------
  const VIDEOS = [
    {id: 'entnahme-zeitpunkt', stand: '1', thema: 'entnahmen', sym: '🛒', t: 'Erst einkaufen, dann entnehmen',
      u: 'Warum die Entnahme erst nach dem Einkauf gebucht wird (ca. 1½ Min.)', uebung: 'Aufgabe 56 und 57',
      st: [
        {wer: 'laura', tafel: tafel('frage', '🛒 Schnell etwas einkaufen', ['Jemand vom Team fährt in den Supermarkt.', 'Das Geld kommt aus der Kasse.', 'Wie buchst du das richtig?']),
          x: 'Hallo, ich bin Laura. Zusammen mit Marc zeige ich dir die Kasse in kleinen Videos. Heute geht es um die Entnahme. Jemand vom Team soll schnell im Supermarkt einkaufen, und das Geld kommt aus der Kasse. Wie buchst du das richtig?'},
        {wer: 'marc', tafel: tafel('falsch', '❌ So bitte nicht', ['50 € aus der Kasse nehmen und <b>sofort</b> 50 € Entnahme buchen', 'Der Einkauf kostet aber nur 38,40 €', '11,60 € Rückgeld kommen zurück', '→ eine <b>zweite Buchung</b> wird nötig']),
          x: 'Viele machen es so: Sie nehmen fünfzig Euro aus der Kasse und buchen sofort eine Entnahme über fünfzig Euro. Der Einkauf kostet dann aber nur achtunddreißig Euro vierzig. Elf Euro sechzig Rückgeld kommen zurück, und schon brauchst du eine zweite Buchung. Das macht den Abschluss unübersichtlich.'},
        {wer: 'laura', tafel: tafel('richtig', '✅ So ist es richtig', ['Geld mitgeben – <b>noch nichts buchen</b>', 'Einkauf kommt zurück: Bon und Rückgeld', 'Rückgeld zurück in die Kasse', '<b>Einmal</b> den echten Betrag vom Bon buchen']),
          x: 'Deshalb gilt: Erst einkaufen. Du gibst das Geld mit, buchst aber noch nichts. Wenn der Einkauf zurück ist, mit Bon und Rückgeld, legst du das Rückgeld in die Kasse und buchst einmal den echten Betrag vom Bon.'},
        {wer: 'marc', x: 'So geht es an der Kasse: Tippe unten auf Mehr und dann auf Entnahme.',
          tun: async F => { await F.click('#moreBtn', {after: 900}); await F.click('#moreDialog [data-action="withdraw"]', {after: 1100}); }},
        {wer: 'laura', x: 'Wähle zuerst den Grund. Hier ist es Einkauf Lebensmittel.',
          tun: async F => { await F.click('[data-withdraw-reason="Einkauf Lebensmittel"]', {after: 900}); }},
        {wer: 'marc', x: 'Dann kommt der Betrag, genau wie auf dem Bon. Achtunddreißig Euro vierzig ist ein krummer Betrag. Also tippst du auf Anderer Betrag, dann drei, acht, Komma, vier, null und OK.',
          tun: async F => {
            await F.click('[data-geld-anders]', {after: 700});
            for (const z of ['3', '8', ',', '4', '0']) await F.click(`[data-ziffer="${z}"]`, {after: 380});
            await F.click('[data-ziffern-ok]', {after: 900});
          }},
        {wer: 'laura', x: 'Schreib kurz dazu, wo eingekauft wurde. Der Bon ist da: Bon oder Quittung vorhanden muss angehakt sein. Fehlt der Haken, tippst du darauf. Den Bon legst du zur Kasse.',
          tun: async F => {
            const notiz = el('withdrawNote');
            if (notiz) { await F.move('#withdrawNote', 900); notiz.value = 'Supermarkt'; notiz.dispatchEvent(new Event('input', {bubbles: true})); await warte(600); }
            // Je nach Kassenstand setzt ein Einkaufs-Grund den Haken schon selbst – dann nur zeigen, nicht wegtippen
            if (el('withdrawReceiptToggle')?.getAttribute('aria-pressed') === 'true') await F.focus('#withdrawReceiptToggle', 1800);
            else await F.click('#withdrawReceiptToggle', {after: 1000});
          }},
        {wer: 'marc', x: 'Zum Schluss tippst du auf Entnahme speichern. Fertig: eine einzige Buchung, und der Kassenstand stimmt. Hier im Video speichere ich natürlich nichts.',
          tun: async F => { await F.move('#saveWithdrawal', 1000); await F.focus('#saveWithdrawal', 2600); }},
        {wer: 'laura', tafel: tafel('merke', '💡 Merke', ['Erst einkaufen.', 'Dann <b>einmal</b> den echten Betrag vom Bon als Entnahme buchen.'], 'Üben: Übungsliste Aufgabe 56 und 57'),
          x: 'Merke: Erst einkaufen, dann einmal den echten Betrag vom Bon als Entnahme buchen. Üben kannst du das mit den Aufgaben sechsundfünfzig und siebenundfünfzig auf der Übungsliste.',
          vor: () => alleFensterZu()}
      ]}
  ];

  // ---------- Zustand ----------
  const SV = {an: false, lauf: 0, video: null, i: 0, ton: 'speechSynthesis' in global, wahl: new Set(), reihe: []};
  // Trainingsmodus: massgeblich ist der Kassenzustand (state.master.trainingMode). Die Klasse am body kommt
  // in app.js erst beim naechsten Neuzeichnen; die Schulungskasse setzt den Modus fest (KCSchulung).
  function training() {
    try { const s = global.KCSchulung && global.KCSchulung.stand(); if (s && s.aktiv) return true; } catch (e) { /* egal */ }
    try { if (typeof state !== 'undefined' && state && state.master) return state.master.trainingMode === true; } catch (e) { /* egal */ }
    return document.body.classList.contains('training-mode');
  }
  const lesen = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const schreiben = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll */ } };
  const gesehen = id => Number(lesen(GESEHEN, {})[id] || 0);
  function person() {
    try { const s = JSON.parse(localStorage.getItem('kc.schulung.v1') || 'null'); if (s && s.aktiv) return s.kennung + (s.name ? ' · ' + s.name : ''); } catch (e) { /* egal */ }
    try { return (typeof state !== 'undefined' && state.master && state.master.operatorName) || 'Team'; } catch (e) { return 'Team'; }
  }
  function warenkorbLeer() { try { const s = global.KCTrainingAPI && global.KCTrainingAPI.getCartSnapshot(); return !s || !s.items || !s.items.length; } catch (e) { return true; } }

  // ---------- Gestaltung (bringt die Datei selbst mit – Programm und Aussehen aus einem Stand) ----------
  const STIL = `
#moreDialog .more-grid > .kc-sv-mehr { order: 51; grid-column: 1 / -1; background: #10243a !important; color: #fff !important; border: 0 !important; min-height: 60px !important; font-size: 18px !important; }
#moreDialog .more-grid > .kc-sv-mehr[hidden], #moreDialog .more-grid > .kc-sv-titel[hidden] { display: none !important; }
#moreDialog .more-grid > .kc-sv-titel { order: 50; }
#kcSvLage { position: fixed; top: 0; right: 0; bottom: 0; left: 0; inset: 0; z-index: 2147483600; pointer-events: none; font-family: Arial, sans-serif; }
#kcSvLage .kc-sv-coach { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(860px, calc(100vw - 24px)); display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: end; pointer-events: auto; transition: top .35s, bottom .35s; }
#kcSvLage.oben .kc-sv-coach { bottom: auto; top: 14px; }
#kcSvLage .kc-sv-figur { width: 96px; height: 120px; object-fit: contain; object-position: bottom; filter: drop-shadow(0 4px 6px rgba(0,0,0,.45)); }
#kcSvLage .kc-sv-blase { background: #fff; color: #10243a; border: 3px solid #f3b63f; border-radius: 18px; padding: 12px 16px; box-shadow: 0 6px 22px rgba(0,0,0,.35); }
#kcSvLage .kc-sv-kopf { display: flex; align-items: center; gap: 10px; font: 800 13px/1.2 Arial, sans-serif; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
#kcSvLage .kc-sv-kopf .kc-sv-wer { color: #b45309; }
#kcSvLage .kc-sv-kopf .kc-sv-punkte { margin-left: auto; display: flex; gap: 4px; }
#kcSvLage .kc-sv-punkte i { width: 9px; height: 9px; border-radius: 5px; background: #d1d5db; }
#kcSvLage .kc-sv-punkte i.an { background: #f3b63f; }
#kcSvLage .kc-sv-text { margin: 6px 0 8px; font: 600 18px/1.4 Arial, sans-serif; }
#kcSvLage .kc-sv-knoepfe { display: flex; gap: 8px; justify-content: flex-end; }
#kcSvLage .kc-sv-knoepfe button { min-height: 42px; padding: 0 14px; border-radius: 10px; border: 0; font: 800 15px Arial, sans-serif; background: #eef0f3; color: #111827; }
#kcSvLage .kc-sv-knoepfe .kc-sv-stop { background: #fee2e2; color: #991b1b; }
#kcSvLage .kc-sv-buehne { position: fixed; left: 50%; top: 42%; transform: translate(-50%, -50%); width: min(620px, calc(100vw - 32px)); pointer-events: none; }
#kcSvLage .kc-sv-buehne:empty { display: none; }
.kc-sv-tafel { background: #fff; border-radius: 20px; padding: 20px 24px; box-shadow: 0 10px 40px rgba(0,0,0,.45); border-top: 10px solid #64748b; animation: kcSvRein .45s ease; color: #10243a; }
.kc-sv-tafel b { display: block; font: 900 26px/1.2 Arial, sans-serif; margin-bottom: 10px; }
.kc-sv-tafel ol { margin: 0; padding-left: 26px; font: 600 19px/1.5 Arial, sans-serif; }
.kc-sv-tafel ol b { display: inline; font: inherit; font-weight: 900; margin: 0; }
.kc-sv-tafel p { margin: 12px 0 0; padding: 8px 12px; border-radius: 10px; background: #f1f5f9; font: 700 15px Arial, sans-serif; }
.kc-sv-falsch { border-top-color: #dc2626; } .kc-sv-falsch b:first-child { color: #b91c1c; }
.kc-sv-richtig { border-top-color: #16a34a; } .kc-sv-richtig b:first-child { color: #15803d; }
.kc-sv-merke { border-top-color: #f3b63f; }
.kc-sv-frage { border-top-color: #1565c0; }
#kcSvLage .kc-live-demo-pointer { font-size: 44px; transform: none; -webkit-text-stroke: 0; margin-left: -22px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
#kcSvLage .kc-live-demo-cursor.click .kc-live-demo-pointer { animation: kcSvDruck .42s ease; }
@keyframes kcSvDruck { 50% { transform: translateY(6px) scale(.82); } }
@keyframes kcSvRein { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
#kcSvLage .kc-sv-schleier { position: fixed; top: 0; right: 0; bottom: 0; left: 0; inset: 0; background: rgba(3, 18, 32, .55); pointer-events: none; }
#kcSvLage .kc-sv-schleier[hidden] { display: none; }
#kcSvFenster { width: min(900px, calc(100vw - 32px)); }
#kcSvFenster .dialog-card { background: #fff; }
#kcSvFenster h2 { margin: 0 0 4px; }
#kcSvFenster .kc-sv-unter { margin: 0 0 14px; color: #475569; }
#kcSvFenster .kc-sv-kacheln { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
#kcSvFenster .kc-sv-kachel { display: grid; grid-template-columns: 54px 1fr; gap: 4px 12px; align-items: center; text-align: left; min-height: 92px; padding: 12px 14px; border-radius: 14px; border: 2px solid #dbe2ea; background: linear-gradient(#fff, #f1f5f9); }
#kcSvFenster .kc-sv-kachel .kc-sv-ksym { grid-row: span 2; font-size: 36px; text-align: center; }
#kcSvFenster .kc-sv-kachel b { font: 900 19px Arial, sans-serif; color: #10243a; }
#kcSvFenster .kc-sv-kachel small { font: 700 13px Arial, sans-serif; color: #64748b; }
#kcSvFenster .kc-sv-kachel:disabled { opacity: .5; }
#kcSvFenster .kc-sv-liste { display: grid; gap: 10px; }
#kcSvFenster .kc-sv-zeile { display: grid; grid-template-columns: 34px 44px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border: 2px solid #e2e8f0; border-radius: 12px; }
#kcSvFenster .kc-sv-zeile input { width: 26px; height: 26px; }
#kcSvFenster .kc-sv-zeile .kc-sv-ksym { font-size: 30px; text-align: center; }
#kcSvFenster .kc-sv-zeile b { display: block; font: 900 17px Arial, sans-serif; }
#kcSvFenster .kc-sv-zeile small { color: #64748b; font-weight: 700; }
#kcSvFenster .kc-sv-play { min-height: 48px; min-width: 64px; border-radius: 12px; border: 0; background: #16a34a; color: #fff; font: 900 18px Arial, sans-serif; }
#kcSvFenster .kc-sv-fuss { display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-between; margin-top: 14px; }
#kcSvFenster .kc-sv-fuss button { min-height: 50px; padding: 0 16px; border-radius: 12px; font: 800 16px Arial, sans-serif; }
#kcSvFenster .kc-sv-hinweis { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: #fff7ed; color: #9a3412; font: 700 14px/1.35 Arial, sans-serif; }
#kcSvBewertung .dialog-card { background: #fff; text-align: center; }
#kcSvBewertung .kc-sv-frage-zeile { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 12px 0; font: 800 18px Arial, sans-serif; }
#kcSvBewertung .kc-sv-frage-zeile button { width: 70px; height: 60px; font-size: 30px; border-radius: 14px; border: 2px solid #cbd5e1; background: #f8fafc; }
#kcSvBewertung .kc-sv-frage-zeile button.aktiv { border-color: #10243a; background: #10243a; }
@media (max-width: 700px) { #kcSvFenster .kc-sv-kacheln { grid-template-columns: 1fr; } #kcSvLage .kc-sv-coach { grid-template-columns: 64px 1fr; } #kcSvLage .kc-sv-figur { width: 64px; height: 84px; } #kcSvLage .kc-sv-text { font-size: 16px; } }
`;
  function stilEinbauen() {
    if (el('kcSvStil')) return;
    const st = document.createElement('style'); st.id = 'kcSvStil'; st.textContent = STIL;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------- MEHR → 🎬 Schulungsvideos (nur im Trainingsmodus) ----------
  function mehrKnopf() {
    const raster = document.querySelector('#moreDialog .more-grid');
    if (!raster || el('kcSvMehrBtn')) return;
    const t = document.createElement('div'); t.className = 'kc-mg-titel kc-sv-titel'; t.id = 'kcSvMehrTitel'; t.textContent = '🎓 Schulung';
    const b = document.createElement('button'); b.type = 'button'; b.id = 'kcSvMehrBtn'; b.className = 'kc-sv-mehr'; b.textContent = '🎬 Schulungsvideos';
    b.addEventListener('click', () => { el('moreDialog')?.close(); setTimeout(() => uebersicht(null), 20); });
    raster.appendChild(t); raster.appendChild(b);
    sichtbarkeit();
  }
  function sichtbarkeit() {
    const an = training();
    ['kcSvMehrBtn', 'kcSvMehrTitel'].forEach(id => { const n = el(id); if (n) n.hidden = !an; });
    if (!an && SV.an) stopp('Der Trainingsmodus wurde abgeschaltet – das Video ist beendet.');
  }

  // ---------- Übersicht: Themen-Kacheln und Videoliste ----------
  function fenster() {
    let d = el('kcSvFenster');
    if (d) return d;
    d = document.createElement('dialog'); d.id = 'kcSvFenster';
    d.innerHTML = '<form method="dialog" class="dialog-card"><button type="button" class="dialog-close-x" aria-label="Schulungsvideos schließen" title="Schließen">×</button><div id="kcSvInhalt"></div></form>';
    d.querySelector('.dialog-close-x').onclick = () => d.close();
    document.body.appendChild(d);
    return d;
  }
  function videosVon(thema) { return VIDEOS.filter(v => v.thema === thema); }
  function uebersicht(thema) {
    if (!training()) return;
    const d = fenster(), inhalt = el('kcSvInhalt');
    if (!thema) {
      inhalt.innerHTML = `<h2>🎬 Schulungsvideos</h2><p class="kc-sv-unter">Kleine Videos mit Ton – Laura und Marc zeigen dir jede Sache an der echten Kasse. Es wird nichts gebucht.</p>
        <div class="kc-sv-kacheln">${THEMEN.map(t => {
          const liste = videosVon(t.id), schon = liste.filter(v => gesehen(v.id)).length;
          const info = liste.length ? `${liste.length} ${liste.length === 1 ? 'Video' : 'Videos'}${schon ? ` · ✓ ${schon} von ${liste.length} angesehen` : ''}` : 'Videos in Vorbereitung';
          return `<button type="button" class="kc-sv-kachel" data-sv-thema="${t.id}"${liste.length ? '' : ' disabled'}><span class="kc-sv-ksym" aria-hidden="true">${t.sym}</span><b>${esc(t.t)}</b><small>${info}</small></button>`;
        }).join('')}</div>${SV.ton ? '' : '<p class="kc-sv-hinweis">Dieses Gerät kann nicht vorlesen – die Videos laufen mit Text zum Mitlesen.</p>'}
        <div class="kc-sv-fuss"><span></span><button value="close">Schließen</button></div>`;
      inhalt.querySelectorAll('[data-sv-thema]').forEach(b => b.onclick = () => uebersicht(b.dataset.svThema));
    } else {
      const t = THEMEN.find(x => x.id === thema), liste = videosVon(thema);
      SV.wahl = new Set(liste.map(v => v.id));
      inhalt.innerHTML = `<button type="button" class="kc-sv-zurueck">‹ Alle Themen</button><h2>${t.sym} ${esc(t.t)}</h2><p class="kc-sv-unter">${liste.length} ${liste.length === 1 ? 'Video' : 'Videos'} · anhaken und nacheinander abspielen oder einzeln mit ▶</p>
        <div class="kc-sv-liste">${liste.map(v => `<label class="kc-sv-zeile"><input type="checkbox" data-sv-wahl="${v.id}" checked><span class="kc-sv-ksym" aria-hidden="true">${v.sym}</span><span><b>${esc(v.t)}</b><small>${esc(v.u)}${gesehen(v.id) ? ` · 👁 ${gesehen(v.id)} ✅` : ''}</small></span><button type="button" class="kc-sv-play" data-sv-start="${v.id}" aria-label="${esc(v.t)} abspielen">▶</button></label>`).join('')}</div>
        <div class="kc-sv-fuss"><button value="close">Schließen</button><button type="button" class="primary-action" data-sv-reihe="1">▶ Angehakte nacheinander</button></div>`;
      inhalt.querySelector('.kc-sv-zurueck').onclick = () => uebersicht(null);
      inhalt.querySelectorAll('[data-sv-wahl]').forEach(c => c.onchange = () => { c.checked ? SV.wahl.add(c.dataset.svWahl) : SV.wahl.delete(c.dataset.svWahl); });
      inhalt.querySelectorAll('[data-sv-start]').forEach(b => b.onclick = e => { e.preventDefault(); d.close(); start([b.dataset.svStart]); });
      inhalt.querySelector('[data-sv-reihe]').onclick = () => { const ids = liste.map(v => v.id).filter(id => SV.wahl.has(id)); if (!ids.length) return; d.close(); start(ids); };
    }
    if (!d.open) d.showModal();
  }

  // ---------- Sprechen (Laura weiblich, Marc maennlich – wie in der Schulung) ----------
  function stimme(art) {
    try {
      const de = speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang));
      const muster = art === 'm' ? /conrad|stefan|thomas|markus|martin|klaus|hans|daniel|yannick|male|mann/i : /katja|anna|petra|hedda|heda|vicki|amala|sabina|helena|marlene|female|frau/i;
      const gut = /microsoft|google|natural|online|premium|enhanced/i;
      const passend = de.filter(v => muster.test(v.name)).sort((a, b) => Number(gut.test(b.name)) - Number(gut.test(a.name)));
      return passend[0] || null;
    } catch (e) { return null; }
  }
  function sprich(text, art, lauf) {
    const lesezeit = Math.max(2500, String(text).split(/\s+/).length * 380);
    return new Promise(fertig => {
      let erledigt = false; const ende = () => { if (!erledigt) { erledigt = true; fertig(); } };
      if (!SV.ton) return setTimeout(ende, lesezeit);
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text), v = stimme(art);
        u.lang = 'de-DE'; u.rate = 0.98;
        if (v) { u.voice = v; u.lang = v.lang; } else u.pitch = art === 'm' ? 0.8 : 1.15; // keine passende Stimme: Tonhoehe unterscheidet die beiden
        u.onend = ende; u.onerror = ende;
        speechSynthesis.speak(u);
        setTimeout(ende, lesezeit * 2.5 + 4000); // Notausgang, falls die Sprachausgabe haengt
      } catch (e) { setTimeout(ende, lesezeit); }
    }).then(() => { if (lauf !== SV.lauf) throw new Error('abbruch'); });
  }

  // ---------- Bühne: Laura/Marc mit Sprechblase, Tafel, Finger ----------
  function lage() {
    let l = el('kcSvLage');
    if (!l) {
      l = document.createElement('div'); l.id = 'kcSvLage';
      l.innerHTML = `<div class="kc-sv-schleier" hidden></div><div class="kc-sv-buehne"></div>
        <div class="kc-sv-coach"><img class="kc-sv-figur" alt=""><div class="kc-sv-blase"><div class="kc-sv-kopf"><span class="kc-sv-wer"></span><span class="kc-sv-titel-v"></span><span class="kc-sv-punkte"></span></div>
        <p class="kc-sv-text" aria-live="polite"></p><div class="kc-sv-knoepfe"><button type="button" class="kc-sv-stop">✕ Beenden</button></div></div></div>`;
      l.querySelector('.kc-sv-stop').onclick = () => stopp();
    }
    // Ein offenes Fenster (showModal) liegt in der obersten Ebene des Browsers – darueber kommt nur, was IN
    // diesem Fenster steckt. Deshalb wandern Buehne und Finger immer in das oberste offene Fenster.
    const offen = [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'kcSvFenster' && d.id !== 'kcSvBewertung').pop();
    const ziel = offen || document.body;
    if (l.parentNode !== ziel) ziel.appendChild(l);
    const finger = document.querySelector('.kc-live-demo-cursor');
    if (finger && finger.parentNode !== l) {
      l.appendChild(finger);
      const spitze = finger.querySelector('.kc-live-demo-pointer'); if (spitze) spitze.textContent = '👆'; // Zeigefinger wie in der Club-App
    }
    return l;
  }
  // Sprechblase weicht nach oben aus, wenn sie das gezeigte Element verdecken wuerde (wie in der Club-App)
  function ausweichen(ziel) {
    const l = lage(); l.classList.remove('oben');
    const n = typeof ziel === 'string' ? document.querySelector(ziel) : ziel;
    if (!n) return;
    const r = n.getBoundingClientRect(), c = l.querySelector('.kc-sv-coach').getBoundingClientRect();
    if (r.bottom > c.top - 8 && r.top < c.bottom) l.classList.add('oben');
  }
  function finger() {
    const F = global.KCLiveDemo, lauf = SV.lauf;
    const pruef = () => { if (lauf !== SV.lauf) throw new Error('abbruch'); };
    const mitLage = fn => async (ziel, ...rest) => { pruef(); ausweichen(ziel); const r = await fn(ziel, ...rest); lage(); pruef(); return r; };
    return {
      move: mitLage((z, ms) => F.move(z, ms)),
      click: mitLage((z, o) => F.click(z, o)),
      focus: mitLage((z, ms) => F.focus(z, ms))
    };
  }
  function zeige(v, s, n) {
    const l = lage(), f = FIGUR[s.wer] || FIGUR.laura;
    l.querySelector('.kc-sv-figur').src = f.bild;
    l.querySelector('.kc-sv-wer').textContent = f.name;
    l.querySelector('.kc-sv-titel-v').textContent = `${v.sym} ${v.t}`;
    l.querySelector('.kc-sv-punkte').innerHTML = v.st.map((_, i) => `<i class="${i <= n ? 'an' : ''}"></i>`).join('');
    l.querySelector('.kc-sv-text').textContent = s.x;
    l.querySelector('.kc-sv-buehne').innerHTML = s.tafel || '';
    l.querySelector('.kc-sv-schleier').hidden = !s.tafel;
    l.classList.remove('oben');
  }

  // ---------- Ablauf ----------
  async function start(ids) {
    if (!training()) return;
    if (!warenkorbLeer()) {
      try { global.showMessage ? global.showMessage('Erst den Bon abschließen', '', 'Im Warenkorb liegt noch ein Bon. Bitte erst abschließen oder verwerfen, dann das Video starten.') : alert('Im Warenkorb liegt noch ein Bon. Bitte erst abschließen oder verwerfen.'); } catch (e) { /* egal */ }
      return;
    }
    if (!global.KCLiveDemo) { console.warn('KC Schulungsvideos: training-demo-bridge.js fehlt'); return; }
    SV.reihe = ids.slice();
    stilEinbauen();
    while (SV.reihe.length) {
      const v = VIDEOS.find(x => x.id === SV.reihe.shift());
      if (!v) continue;
      const ok = await abspielen(v);
      if (!ok) break;
      const weiter = await bewerten(v, SV.reihe[0] && VIDEOS.find(x => x.id === SV.reihe[0]));
      if (!weiter) break;
    }
    SV.reihe = [];
  }
  async function abspielen(v) {
    SV.an = true; SV.video = v; const lauf = ++SV.lauf;
    document.body.classList.add('kc-sv-laeuft');
    alleFensterZu();
    // Fenster gehen waehrend der Vorfuehrung auf und zu – Buehne und Finger bleiben immer obenauf
    clearInterval(SV.oben); SV.oben = setInterval(() => { if (SV.an) lage(); }, 120);
    const F = finger();
    try {
      for (let n = 0; n < v.st.length; n++) {
        const s = v.st[n];
        if (s.vor) s.vor();
        zeige(v, s, n);
        const reden = sprich(s.x, (FIGUR[s.wer] || FIGUR.laura).art, lauf);
        const zeigen = s.tun ? warte(500).then(() => s.tun(F)) : Promise.resolve();
        await Promise.all([reden, zeigen]);
        if (lauf !== SV.lauf) throw new Error('abbruch');
        await warte(700);
      }
      const z = lesen(GESEHEN, {}); z[v.id] = (z[v.id] || 0) + 1; schreiben(GESEHEN, z);
      aufraeumen();
      return true;
    } catch (e) {
      if (e && e.message !== 'abbruch' && e.message !== 'cancelled') console.warn('KC Schulungsvideos:', e);
      aufraeumen();
      return false;
    }
  }
  function aufraeumen() {
    SV.an = false; clearInterval(SV.oben);
    try { speechSynthesis.cancel(); } catch (e) { /* egal */ }
    try { global.KCLiveDemo && global.KCLiveDemo.reset(); } catch (e) { /* egal */ }
    alleFensterZu();
    try { global.KCTrainingAPI && global.KCTrainingAPI.clearCart(); } catch (e) { /* egal */ }
    el('kcSvLage')?.remove();
    document.body.classList.remove('kc-sv-laeuft');
  }
  function stopp(grund) {
    SV.lauf++; SV.reihe = [];
    aufraeumen();
    if (grund) { try { global.showMessage && global.showMessage('Schulungsvideo beendet', '', grund); } catch (e) { /* egal */ } }
  }

  // ---------- Bewertung 👍/👎 ----------
  function bewerten(v, naechstes) {
    return new Promise(fertig => {
      let d = el('kcSvBewertung');
      if (!d) { d = document.createElement('dialog'); d.id = 'kcSvBewertung'; document.body.appendChild(d); }
      const wahl = {gefallen: null, hilft: null};
      d.innerHTML = `<form method="dialog" class="dialog-card"><h2>${v.sym} ${esc(v.t)}</h2>
        <div class="kc-sv-frage-zeile" data-frage="gefallen"><span>Hat dir das Video gefallen?</span><button type="button" data-w="1" aria-label="Ja">👍</button><button type="button" data-w="0" aria-label="Nein">👎</button></div>
        <div class="kc-sv-frage-zeile" data-frage="hilft"><span>Hilft es dir weiter?</span><button type="button" data-w="1" aria-label="Ja">👍</button><button type="button" data-w="0" aria-label="Nein">👎</button></div>
        ${v.uebung ? `<p class="kc-sv-unter">Üben: Übungsliste ${esc(v.uebung)}</p>` : ''}
        <div class="dialog-actions"><button type="button" data-sv-ende="0">${naechstes ? 'Reihe beenden' : 'Überspringen'}</button><button type="button" class="primary-action" data-sv-ende="1">${naechstes ? `Abschicken · weiter: ${esc(naechstes.t)}` : 'Abschicken'}</button></div></form>`;
      d.querySelectorAll('.kc-sv-frage-zeile').forEach(z => z.querySelectorAll('button').forEach(b => b.onclick = () => {
        wahl[z.dataset.frage] = b.dataset.w === '1';
        z.querySelectorAll('button').forEach(x => x.classList.toggle('aktiv', x === b));
      }));
      d.querySelectorAll('[data-sv-ende]').forEach(b => b.onclick = () => {
        const senden = b.dataset.svEnde === '1';
        if (senden && (wahl.gefallen !== null || wahl.hilft !== null)) {
          const q = lesen(BEWERTUNG, []);
          q.push({video: v.id, stand: v.stand, person: person(), kasse: (typeof state !== 'undefined' && state.master && state.master.registerId) || '', gefallen: wahl.gefallen, hilft: wahl.hilft, zeit: new Date().toISOString(), gesendet: false});
          schreiben(BEWERTUNG, q.slice(-500));
        }
        d.close(); fertig(senden || !naechstes);
      });
      d.showModal();
      if (SV.ton) sprich('Hat dir das Video gefallen? Und hilft es dir weiter? Tippe auf Daumen hoch oder Daumen runter.', 'w', SV.lauf).catch(() => {});
    });
  }

  // ---------- Start ----------
  function los() {
    stilEinbauen(); mehrKnopf();
    new MutationObserver(sichtbarkeit).observe(document.body, {attributes: true, attributeFilter: ['class']});
    // Beim Oeffnen von MEHR immer frisch pruefen (der Modus kann ohne Neuzeichnen umgestellt worden sein)
    const mehr = el('moreDialog'); if (mehr) new MutationObserver(sichtbarkeit).observe(mehr, {attributes: true, attributeFilter: ['open']});
    try { speechSynthesis.getVoices(); } catch (e) { /* egal */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();

  global.KCSchulungsvideos = {VERSION, VIDEOS, THEMEN, start, stopp, uebersicht, bewertungen: () => lesen(BEWERTUNG, [])};
})(window);
