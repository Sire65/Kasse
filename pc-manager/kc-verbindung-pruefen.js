// Verbindung pruefen - Klartext statt LED-Raten.
//
// ANLASS: Ein Abend ging dafuer drauf, aus LED-Farben zu schliessen, was klemmt. Die Kasse
// zeigte gruen, der Manager "Noch nie verbunden" - und die Ursache (Manager ueber die
// WLAN-Adresse geoeffnet statt ueber 127.0.0.1) war an keiner Anzeige ablesbar.
// Diese Seite prueft der Reihe nach jeden Schritt der Kette und sagt bei jedem Problem, was
// zu tun ist. Sie raet nicht - sie fragt die Stellen ab und meldet, was zurueckkommt.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const DIENST_PORT = 47392;   // Live-Kanal des Managers

  async function hole(url, ms = 3500) {
    const antwort = await fetch(url, {signal: AbortSignal.timeout(ms), cache: 'no-store'});
    if (!antwort.ok) throw new Error(`Antwort ${antwort.status}`);
    return antwort.json();
  }

  // Jede Pruefung liefert: ok (gut/warnung/fehler), Text und - wenn noetig - was zu tun ist.
  async function pruefungen() {
    const ergebnisse = [];
    const wieGeoeffnet = location.hostname;
    const lokal = ['127.0.0.1', 'localhost'].includes(wieGeoeffnet);

    // 1) Wurde der Manager richtig geoeffnet? Das war die eigentliche Ursache des Problems.
    ergebnisse.push(lokal
      ? {stufe: 'gut', titel: 'Manager richtig ge\u00f6ffnet', text: `Adresse: ${wieGeoeffnet}`}
      : {stufe: 'fehler', titel: 'Manager \u00fcber die falsche Adresse ge\u00f6ffnet',
         text: `Der Manager l\u00e4uft unter ${wieGeoeffnet}. Sein Dienst ist aber nur \u00fcber 127.0.0.1 erreichbar, und der Browser verbietet den Sprung dorthin. Deshalb bleiben die Kassen-Anzeigen leer, obwohl alles l\u00e4uft.`,
         tun: `Diese Seite stattdessen \u00f6ffnen: http://127.0.0.1:${location.port || 8090}/pc-manager/index.html`});

    // 2) Laeuft der Dienst ueberhaupt?
    let ereignisse = null;
    try {
      ereignisse = await hole(`http://127.0.0.1:${DIENST_PORT}/live-event-log?limit=200`);
      ergebnisse.push({stufe: 'gut', titel: 'Manager-Dienst l\u00e4uft',
        text: `${(ereignisse.events || []).length} Ereignis(se) bekannt.`});
    } catch (fehler) {
      ergebnisse.push({stufe: 'fehler', titel: 'Manager-Dienst nicht erreichbar',
        text: `Der Dienst auf Port ${DIENST_PORT} antwortet nicht (${fehler.message}).`,
        tun: 'Ist das schwarze Fenster (KC_Markttag_Start) noch offen? Falls nicht: neu starten und warten, bis "ALLES BEREIT" erscheint.'});
      return ergebnisse;   // ohne Dienst hat weiteres Pruefen keinen Sinn
    }

    // 3) Welche Kassen haben sich gemeldet? Die Kasse sendet alle 15s ein Lebenszeichen -
    //    ein Verkauf ist dafuer ausdruecklich NICHT noetig.
    const jetzt = Date.now();
    const proKasse = new Map();
    (ereignisse.events || []).forEach((e) => {
      const id = e.payload?.registerId;
      if (!id) return;
      const zeit = new Date(e.receivedAt || e.payload?.at || 0).getTime();
      const vorhanden = proKasse.get(id) || {zuletzt: 0, verkaeufe: 0};
      vorhanden.zuletzt = Math.max(vorhanden.zuletzt, zeit);
      if (e.type === 'sale') vorhanden.verkaeufe++;
      proKasse.set(id, vorhanden);
    });

    const bekannte = (global.registers || []).filter((r) => r.active !== false);
    (bekannte.length ? bekannte : [...proKasse.keys()].map((id) => ({id, name: id}))).forEach((r) => {
      const eintrag = proKasse.get(r.id);
      if (!eintrag) {
        ergebnisse.push({stufe: 'warnung', titel: `${r.name || r.id}: noch nicht gemeldet`,
          text: 'Von dieser Kasse ist beim Manager noch nichts angekommen.',
          tun: 'Kasse in einem eigenen Browser-Tab \u00f6ffnen \u2013 mit der vollst\u00e4ndigen Adresse aus der Liste unten. Danach h\u00f6chstens 15 Sekunden warten.'});
        return;
      }
      const sekunden = Math.round((jetzt - eintrag.zuletzt) / 1000);
      if (sekunden <= 45) {
        ergebnisse.push({stufe: 'gut', titel: `${r.name || r.id}: verbunden`,
          text: `Zuletzt geh\u00f6rt vor ${sekunden} Sekunde(n)` + (eintrag.verkaeufe ? `, ${eintrag.verkaeufe} Verkauf/Verk\u00e4ufe erfasst.` : '. Noch keine Verk\u00e4ufe \u2013 das ist f\u00fcr die Verbindung ohne Bedeutung.')});
      } else {
        ergebnisse.push({stufe: 'warnung', titel: `${r.name || r.id}: Verbindung abgerissen`,
          text: `Zuletzt geh\u00f6rt vor ${Math.round(sekunden / 60)} Minute(n).`,
          tun: 'Ist der Tab mit dieser Kasse noch offen? Ein geschlossener oder neu geladener Tab meldet sich erst wieder, wenn die Kasse l\u00e4uft. Sonst: Tab neu laden.'});
      }
    });

    // 4) Kann der Manager auch schreiben? (Der Weg, den Ausverkauft-Meldungen nehmen.)
    try {
      await hole(`http://127.0.0.1:${DIENST_PORT}/sold-out-status-alle`);
      ergebnisse.push({stufe: 'gut', titel: 'Steuerkanal zum Manager offen',
        text: 'Ausverkauft-Meldungen und Stammdaten k\u00f6nnen \u00fcbertragen werden.'});
    } catch (fehler) {
      ergebnisse.push({stufe: 'warnung', titel: 'Steuerkanal antwortet nicht',
        text: fehler.message, tun: 'Meist eine Folge eines Neustarts \u2013 Seite neu laden.'});
    }
    return ergebnisse;
  }

  function zeichne(liste) {
    const ziel = el('vbErgebnis');
    if (!ziel) return;
    const zeichen = {gut: '\u2713', warnung: '!', fehler: '\u2715'};
    ziel.innerHTML = liste.map((p) => `
      <div class="vb-zeile vb-${p.stufe}">
        <span class="vb-marke">${zeichen[p.stufe]}</span>
        <div>
          <strong>${esc(p.titel)}</strong>
          <p>${esc(p.text)}</p>
          ${p.tun ? `<p class="vb-tun"><strong>Zu tun:</strong> ${esc(p.tun)}</p>` : ''}
        </div>
      </div>`).join('');
    const schlimm = liste.some((p) => p.stufe === 'fehler') ? 'fehler'
      : liste.some((p) => p.stufe === 'warnung') ? 'warnung' : 'gut';
    el('vbStand').textContent = schlimm === 'gut' ? 'Alles in Ordnung.'
      : schlimm === 'warnung' ? 'Teilweise in Ordnung \u2013 siehe unten.' : 'Es gibt ein Problem \u2013 siehe unten.';
    el('vbStand').className = `vb-stand vb-stand-${schlimm}`;
  }

  // Die Kassenadressen stammen aus der Markttag-Einrichtung. Sie werden hier angezeigt, damit
  // niemand eine alte, gemerkte Adresse verwendet - Schluessel und Ports wechseln bei jedem Start.
  async function zeigeAdressen() {
    const ziel = el('vbAdressen');
    if (!ziel) return;
    try {
      const daten = await hole('kassen-verbindungen.json');
      const kassen = daten.kassen || daten || [];
      ziel.innerHTML = kassen.length ? kassen.map((k) => {
        const adresse = `http://127.0.0.1:${location.port || 8090}/pos/index.html?kcPort=${k.port}&kcToken=${k.token}&kcRegisterId=${k.id}`;
        return `<div class="vb-adresse"><strong>${esc(k.name || k.id)}</strong>
          <input type="text" readonly value="${esc(adresse)}" onclick="this.select()">
          <button type="button" onclick="navigator.clipboard?.writeText(this.previousElementSibling.value)">Kopieren</button>
          <a href="${esc(adresse)}" target="_blank">\u00d6ffnen</a></div>`;
      }).join('') : '<p class="vb-hinweis">Keine Kassendaten gefunden.</p>';
    } catch (e) {
      ziel.innerHTML = `<p class="vb-hinweis">Die Kassenadressen konnten nicht gelesen werden.
        Sie stehen auf der \u00dcbersichtsseite, die beim Start erzeugt wird
        (Ordner <code>kc-sync-installation-und-backend/markttag-daten</code>).
        Dort die WLAN-Adresse durch <code>127.0.0.1</code> ersetzen, wenn die Kasse auf diesem Rechner laufen soll.</p>`;
    }
  }

  let zeitgeber = null;
  async function pruefen() {
    el('vbStand').textContent = 'Pr\u00fcfe \u2026';
    try { zeichne(await pruefungen()); }
    catch (fehler) { zeichne([{stufe: 'fehler', titel: 'Pr\u00fcfung fehlgeschlagen', text: fehler.message}]); }
  }

  function starten() {
    if (!el('vbErgebnis')) return;
    el('vbPruefen')?.addEventListener('click', pruefen);
    el('vbAuto')?.addEventListener('change', (e) => {
      clearInterval(zeitgeber);
      if (e.target.checked) zeitgeber = setInterval(pruefen, 10000);
    });
    if (el('vbAuto')?.checked) zeitgeber = setInterval(pruefen, 10000);
    pruefen();
    zeigeAdressen();
  }

  document.querySelectorAll('[data-view="verbindung"]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(starten, 80)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
  global.KCVerbindungPruefen = {pruefen, pruefungen};
})(window);
