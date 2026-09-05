// Security-Card im PC-Manager - je Kasse eine eigene Karte.
//
// Sitzt bewusst UNTER jeder Kassenkarte in der Kassenverwaltung, dort wo auch neue Kassen
// angelegt werden - und nicht auf einer eigenen Seite. Wer eine Kasse einrichtet, macht die
// Karte im selben Arbeitsgang.
//
// AUF DER KARTE STEHT NICHTS, WAS ETWAS VERRÄT: nur der QR-Code und eine achtstellige
// Notfall-PIN. Kein Vereinsname, keine Kassennummer, kein Wort über ein Verwaltungsprogramm.
// Wer sie findet, sieht Pappe mit einem Muster.
(function (global) {
  'use strict';
  const SPEICHER = 'kcm_security_cards_v1';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const lies = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '{}'); } catch (e) { return {}; } };
  const schreib = (alle) => localStorage.setItem(SPEICHER, JSON.stringify(alle));
  const karteFuer = (registerId) => lies()[registerId] || null;

  // Kassennummer aus der Kassen-ID (KASSE-01 -> 1). Sie steht als erste Ziffer auf der Karte,
  // damit man mehrere Karten auseinanderhalten kann, ohne sie zu scannen.
  function kassenNummer(registerId) {
    return parseInt(String(registerId).replace(/\D/g, ''), 10) || 1;
  }

  async function erzeuge(registerId) {
    const bisher = lies()[registerId];
    // Neue Ausgabe zaehlt hoch, der Kartenschluessel des Geraets bleibt. Nur so bleiben die
    // Verkaeufe frueherer Ausgaben lesbar: die Kasse kann jeden frueheren Schluessel aus
    // derselben Grundlage nachrechnen.
    const karte = await global.KCSecurityCard.neueKarte(
      registerId, kassenNummer(registerId), (bisher?.ausgabe || 0) + 1, bisher?.kartenschluessel);
    const alle = lies();
    alle[registerId] = karte;
    schreib(alle);
    // Zweitschrift an den Dienst: von dort bekommt die Kasse den Schlüssel morgens automatisch,
    // ohne dass jemand etwas eingibt. Läuft der Dienst gerade nicht, bleibt die gedruckte Karte
    // der Weg - deshalb ist das hier kein Grund, die Kartenerstellung scheitern zu lassen.
    try {
      await fetch('http://127.0.0.1:47392/kassen/datenschluessel', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({registerId, dataKey: karte.datenschluessel, cardKey: karte.kartenschluessel, ausgabe: karte.ausgabe}),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) {
      global.KCManagerMessages?.warning?.('Die Karte wurde erstellt, konnte aber nicht hinterlegt '
        + 'werden – die Kassen bekommen den Schlüssel dann nur über die gedruckte Karte. '
        + 'Läuft das Markttag-Fenster?');
    }
    return karte;
  }

  // QR-Bild erzeugen. Die Bibliothek liegt bereits im Programm (Bargeldübergabe nutzt sie).
  function qrBild(text, groesse) {
    const qr = global.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createImgTag(Math.max(3, Math.round(groesse / qr.getModuleCount())), 0);
  }

  async function zeichneKarte(registerId) {
    const ziel = document.querySelector(`[data-security-card-for="${registerId}"]`);
    if (!ziel) return;
    const karte = karteFuer(registerId);
    if (!karte) {
      ziel.innerHTML = `<div class="seccard-leer">
        <span>Für diese Kasse ist noch keine Karte erstellt.</span>
        <button type="button" class="primary" data-seccard-neu="${esc(registerId)}">Karte erstellen</button></div>`;
      return;
    }
    const qrText = await global.KCSecurityCard.baueQr(karte);
    ziel.innerHTML = `
      <div class="seccard-vorschau">
        <div class="seccard" data-seccard-druck="${esc(registerId)}">
          <div class="seccard-qr">${qrBild(qrText, 150)}</div>
          <div class="seccard-pin"><span>${esc(karte.code)}</span></div>
        </div>
        <div class="seccard-neben">
          <p class="seccard-hinweis">Scheckkartengröße. Auf der Karte steht bewusst nichts weiter –
             kein Name, keine Nummer, kein Hinweis worauf sie passt.</p>
          <div class="seccard-knoepfe">
            <button type="button" data-seccard-druck-btn="${esc(registerId)}">🖨 Karte + Reserve drucken</button>
            <button type="button" data-seccard-neu="${esc(registerId)}" class="danger">Neue Karte (alte wird ungültig)</button>
          </div>
          <p class="seccard-meta">Ausgabe ${karte.ausgabe} · erstellt ${new Date(karte.erstelltAm).toLocaleDateString('de-DE')}<br>
            <b>Telefonweg:</b> Ist die Karte weg und kein Netz da, reicht es, den Code
            <b>${esc(karte.code)}</b> durchzusagen – er wird an der Kasse eingetippt.</p>
        </div>
      </div>`;
  }

  // Druck im Scheckkartenformat (85,6 x 54 mm) - passt in jede Geldbörse und in die Kassette.
  async function drucke(registerId) {
    const karte = karteFuer(registerId);
    if (!karte) return;
    const qrText = await global.KCSecurityCard.baueQr(karte);
    const fenster = window.open('', '_blank', 'width=520,height=420');
    if (!fenster) { global.KCManagerMessages?.warning?.('Das Druckfenster wurde blockiert. Bitte Pop-ups erlauben.'); return; }
    fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>&nbsp;</title>
      <style>
        @page{size:85.6mm 54mm;margin:0}
        .karte{page-break-after:always}
        html,body{margin:0;padding:0}
        .karte{width:85.6mm;height:54mm;box-sizing:border-box;padding:4mm;
               display:flex;align-items:center;gap:4mm;font-family:system-ui,sans-serif;
               border:.3mm dashed #999}
        .qr img{width:44mm;height:44mm;display:block;image-rendering:pixelated}
        .pin{font-family:ui-monospace,'Courier New',monospace;font-size:15pt;font-weight:700;
             letter-spacing:.06em}
        .rand{font-size:6pt;color:#777;margin-top:2mm}
        @media print{.karte{border:none}}
      </style></head><body>
      <div class="karte">
        <div class="qr">${qrBild(qrText, 170)}</div>
        <div><div class="pin">${esc(karte.code)}</div>
             <div class="rand">bitte aufbewahren</div></div>
      </div>
      <div class="karte">
        <div class="qr">${qrBild(qrText, 170)}</div>
        <div><div class="pin">${esc(karte.code)}</div>
             <div class="rand">Reserve · getrennt aufbewahren</div></div>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    fenster.document.close();
  }

  // Die Kartenbereiche unter die Kassenkarten hängen. renderRegisters() baut die Kacheln jedes
  // Mal neu auf, deshalb wird hier nach jedem Neuaufbau erneut eingehängt.
  function haengeEin() {
    document.querySelectorAll('#registerCards .register-card').forEach((kachel) => {
      const id = kachel.querySelector('[data-k="id"]')?.value;
      if (!id || kachel.querySelector('[data-security-card-for]')) return;
      const block = document.createElement('div');
      block.className = 'seccard-block';
      block.innerHTML = `<h4>Security Card</h4><div data-security-card-for="${esc(id)}"></div>`;
      kachel.appendChild(block);
      zeichneKarte(id);
    });
  }

  document.addEventListener('click', async (ereignis) => {
    const neu = ereignis.target.closest?.('[data-seccard-neu]');
    if (neu) {
      const id = neu.dataset.seccardNeu;
      if (karteFuer(id) && !(global.KCManagerMessages?.ask || confirm)(
        'Eine neue Karte macht die bisherige Karte dieser Kasse ungültig. Fortfahren?')) return;
      await erzeuge(id);
      await zeichneKarte(id);
      global.KCManagerMessages?.success?.('Neue Karte erstellt. Bitte ausdrucken und in die Kassette legen.');
      return;
    }
    const druck = ereignis.target.closest?.('[data-seccard-druck-btn]');
    if (druck) drucke(druck.dataset.seccardDruckBtn);
  });

  // Nach jedem Neuaufbau der Kassenliste erneut einhängen.
  const beobachter = new MutationObserver(() => haengeEin());
  function start() {
    const ziel = el('registerCards');
    if (!ziel) return;
    beobachter.observe(ziel, {childList: true});
    haengeEin();
    haengeProtokollEin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // ---- Startprotokoll ------------------------------------------------------------------
  // Der Live-Monitor zeigt den Moment; hier steht der Verlauf: welche Kasse sich wann und auf
  // welchem Weg angemeldet hat. Sitzt in der Kassenverwaltung, weil die Frage dort aufkommt.
  const WEG = {netz: 'automatisch (Netz)', karte: 'Startkarte gescannt',
               'notfall-pin': 'Zahl von der Karte eingetippt', sitzung: 'schon angemeldet'};

  async function zeichneProtokoll() {
    const ziel = el('kcStartprotokoll');
    if (!ziel) return;
    try {
      const antwort = await fetch('http://127.0.0.1:47392/kassen/startprotokoll',
        {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      if (!antwort.ok) throw new Error(String(antwort.status));
      const starts = (await antwort.json()).starts || [];
      if (!starts.length) { ziel.innerHTML = '<p class="seccard-hinweis">Noch keine Anmeldung protokolliert.</p>'; return; }
      ziel.innerHTML = `<table class="kcbs-tabelle"><thead><tr>
          <th>Zeitpunkt</th><th>Kasse</th><th>Freigabe</th><th>Gerät</th></tr></thead><tbody>
        ${starts.map((x) => `<tr>
          <td>${new Date(x.gemeldeteZeit || x.zeit).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
          <td>${esc(x.registerId || '')}</td>
          <td>${esc(WEG[x.freigabe] || x.freigabe || '')}</td>
          <td><small>${esc((x.geraet || '').slice(0, 55))}</small></td></tr>`).join('')}
        </tbody></table>`;
    } catch (e) {
      ziel.innerHTML = '<p class="seccard-hinweis">Das Protokoll ist gerade nicht abrufbar – '
        + 'läuft das Markttag-Fenster, und ist diese Seite über 127.0.0.1 geöffnet?</p>';
    }
  }

  function haengeProtokollEin() {
    if (el('kcStartprotokollBlock')) return;
    const bereich = document.querySelector('[data-view-panel="registers"]');
    if (!bereich) return;
    const block = document.createElement('article');
    block.id = 'kcStartprotokollBlock';
    block.className = 'secure-card';
    block.innerHTML = `<h3>Anmeldungen der Kassen</h3>
      <p class="seccard-hinweis">Wann sich welche Kasse gemeldet hat und wie sie freigeschaltet wurde.
         Der Schlüssel selbst wird dabei nie übertragen.</p>
      <div class="seccard-knoepfe" style="margin-bottom:8px">
        <button type="button" id="kcStartprotokollAktualisieren">Aktualisieren</button></div>
      <div id="kcStartprotokoll"><p class="seccard-hinweis">Noch nicht geladen.</p></div>`;
    bereich.appendChild(block);
    el('kcStartprotokollAktualisieren').addEventListener('click', zeichneProtokoll);
    document.querySelectorAll('[data-view="registers"]').forEach((k) =>
      k.addEventListener('click', () => setTimeout(zeichneProtokoll, 250)));
    zeichneProtokoll();
  }

  global.KCSecurityCardManager = {erzeuge, karteFuer, drucke, zeichneKarte, alle: lies, zeichneProtokoll};
})(window);
