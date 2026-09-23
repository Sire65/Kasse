// Verbindungsprüfung im PC-Manager.
//
// WARUM ES DIESE SEITE GIBT: Am Einrichtungsabend war eine Stunde lang unklar, ob die Kasse
// verbunden ist. Die Kassen-LED im Manager wurde naemlich erst gruen, wenn eine Kasse ein
// EREIGNIS meldete - also praktisch erst nach dem ersten Verkauf. Bis dahin stand dort
// "Noch nie verbunden", obwohl alles lief. Dazu kam, dass Manager und Kasse ueber die
// WLAN-Adresse gar nicht zusammenfinden, sondern nur ueber 127.0.0.1.
//
// Diese Seite sagt im Klartext, was laeuft und was nicht - statt dass man ueber LED-Farben
// raten muss. Und sie stellt die richtigen Adressen zum Anklicken bereit, damit niemand mehr
// von Hand Zahlen in einer langen Adresse austauschen muss.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const MANAGER_PORT = 47392;

  function seiteAnlegen() {
    if (document.querySelector('[data-view-panel="verbindung"]')) return;
    const bereich = document.querySelector('[data-view-panel="closing"]')?.parentElement;
    if (!bereich) return;

    const seite = document.createElement('section');
    seite.className = 'view';
    seite.dataset.viewPanel = 'verbindung';
    seite.innerHTML = `
      <div class="page-head"><div><h1>Verbindung prüfen</h1>
        <p>Zeigt im Klartext, was läuft und was nicht – und liefert die Adressen zum Anklicken.</p></div></div>
      <article class="secure-card">
        <div class="dialog-actions" style="margin-bottom:10px">
          <button type="button" id="vpPruefen" class="primary">Jetzt prüfen</button>
          <span id="vpZeitpunkt" class="vp-zeit"></span>
        </div>
        <div id="vpErgebnis" class="vp-liste"></div>
      </article>
      <article class="secure-card" style="margin-top:14px">
        <h3>Adressen zum Öffnen</h3>
        <p class="vp-hinweis">Auf <strong>diesem</strong> Rechner immer die Adressen mit 127.0.0.1 verwenden –
           über die WLAN-Adresse findet der Manager seinen eigenen Dienst nicht.
           Für Tablets im WLAN die Adressen darunter.</p>
        <div id="vpAdressen" class="vp-adressen"></div>
      </article>`;
    bereich.appendChild(seite);

    // Navigationseintrag anlegen
    const gruppe = document.getElementById('nav-operation');
    if (gruppe && !document.querySelector('[data-view="verbindung"]')) {
      const knopf = document.createElement('button');
      knopf.className = 'nav'; knopf.type = 'button';
      knopf.dataset.view = 'verbindung';
      knopf.textContent = 'Verbindung prüfen';
      gruppe.appendChild(knopf);
      knopf.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.dataset.viewPanel === 'verbindung'));
        pruefen();
      });
    }
    el('vpPruefen')?.addEventListener('click', pruefen);
  }

  function zeile(zustand, titel, text, tipp) {
    const zeichen = zustand === 'gut' ? '✔' : zustand === 'warn' ? '!' : '✖';
    return `<div class="vp-zeile vp-${zustand}">
      <span class="vp-zeichen">${zeichen}</span>
      <div><strong>${titel}</strong><div class="vp-text">${text}</div>
      ${tipp ? `<div class="vp-tipp">${tipp}</div>` : ''}</div></div>`;
  }

  async function hole(pfad, zeit = 4000) {
    const antwort = await fetch(`http://127.0.0.1:${MANAGER_PORT}${pfad}`, {signal: AbortSignal.timeout(zeit)});
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    return antwort.json();
  }

  async function pruefen() {
    const ziel = el('vpErgebnis');
    if (!ziel) return;
    ziel.innerHTML = '<p class="vp-laeuft">Prüfe …</p>';
    const teile = [];

    // 1. Wird die Seite über die richtige Adresse aufgerufen?
    const ueberLoopback = ['127.0.0.1', 'localhost'].includes(location.hostname);
    teile.push(ueberLoopback
      ? zeile('gut', 'Aufruf des Managers', `Über <code>${location.hostname}</code> – richtig.`)
      : zeile('aus', 'Aufruf des Managers',
          `Diese Seite läuft über <code>${location.hostname}</code>.`,
          `So findet der Manager seinen eigenen Dienst nicht. Bitte stattdessen aufrufen: <a href="http://127.0.0.1:${location.port || 8090}/pc-manager/index.html">http://127.0.0.1:${location.port || 8090}/pc-manager/index.html</a>`));

    // 2. Läuft der Manager-Dienst?
    let verbindungen = null;
    try {
      verbindungen = await hole('/kassen-verbindungen');
      teile.push(zeile('gut', 'Manager-Dienst', 'Läuft und antwortet.'));
    } catch (fehler) {
      teile.push(zeile('aus', 'Manager-Dienst', `Nicht erreichbar (${fehler.message}).`,
        'Läuft das schwarze Fenster noch? Falls nicht: KC_Markttag_Start.cmd starten und warten, bis „ALLES BEREIT“ erscheint.'));
    }

    // 3. Welche Kassen sind gekoppelt?
    if (verbindungen) {
      const kassen = verbindungen.kassen || [];
      if (!kassen.length) {
        teile.push(zeile('warn', 'Kassen', 'Keine Kasse gekoppelt.',
          'Beim Start koppeln sich die Kassen automatisch. Steht im schwarzen Fenster „neu gekoppelt“ oder „bereits gekoppelt“?'));
      } else {
        kassen.forEach((k) => {
          if (k.zustand === 'aktiv') {
            teile.push(zeile('gut', k.kasse, `Verbunden – letzte Meldung vor ${k.zuletztGemeldetVorSek} Sekunden.`));
          } else if (k.zustand === 'gekoppelt_still') {
            const min = Math.round(k.zuletztGemeldetVorSek / 60);
            teile.push(zeile('warn', k.kasse, `Gekoppelt, aber seit ${min} Minute(n) keine Meldung.`,
              'Ist die Kasse noch im Browser geöffnet? Sie meldet sich nur, solange sie offen ist.'));
          } else {
            teile.push(zeile('warn', k.kasse, 'Gekoppelt, hat sich aber noch nie gemeldet.',
              'Die Kasse einmal öffnen – die Adresse steht unten. Gekoppelt heißt: der Schlüssel liegt vor, die Kasse war nur noch nicht offen.'));
          }
        });
      }
    }
    ziel.innerHTML = teile.join('');
    el('vpZeitpunkt').textContent = `Stand: ${new Date().toLocaleTimeString('de-DE')}`;
    await adressenZeigen();
  }

  // Die Adressen kommen aus der Datei, die der Markttag-Start erzeugt - dadurch stimmen Port
  // und Zugangsschlüssel immer, auch nach einem Neustart (bei dem beides neu vergeben wird).
  async function adressenZeigen() {
    const ziel = el('vpAdressen');
    if (!ziel) return;
    let daten = null;
    try {
      const antwort = await fetch('kassen-verbindungen.json', {cache: 'no-store'});
      if (antwort.ok) daten = await antwort.json();
    } catch (e) { /* Datei liegt nicht vor - dann bleibt der Hinweis unten */ }
    if (!daten) {
      ziel.innerHTML = `<p class="vp-text">Die Adressliste liegt nicht vor. Sie steht in der Übersichtsseite,
        die der Markttag-Start erzeugt: <code>kc-sync-installation-und-backend\\markttag-daten\\markttag-uebersicht.html</code></p>`;
      return;
    }
    const port = location.port || 8090;
    ziel.innerHTML = Object.entries(daten).map(([id, eintrag]) => {
      const anhang = `?kcPort=${eintrag.port}&kcToken=${eintrag.token}&kcRegisterId=${id}`;
      const lokal = `http://127.0.0.1:${port}/pos/index.html${anhang}`;
      const wlan = eintrag.host ? `http://${eintrag.host}:${port}/pos/index.html${anhang}` : null;
      return `<div class="vp-adresse"><strong>${id}</strong>
        <div><a href="${lokal}" target="_blank" rel="noopener">Auf diesem Rechner öffnen</a></div>
        ${wlan ? `<div class="vp-klein">Für Tablets im WLAN: <code>${wlan}</code></div>` : ''}</div>`;
    }).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', seiteAnlegen);
  else seiteAnlegen();
  global.KCVerbindungspruefung = {pruefen};
})(window);
