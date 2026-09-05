// Mitgliedsausweise - Foto, Name, Mitgliedsnummer und QR-Code, druckbar im Scheckkartenformat.
//
// ANLASS: Die Ausweise sollten aus der KC-Verwaltung kommen, die aber nicht lauffähig
// vorliegt. Alles Nötige steht bereits hier: der Bedienerstamm mit Namen, Mitgliedsnummern
// und QR-Codes wird im Manager ohnehin geführt, und die Kasse liest diese Codes bereits beim
// Anmelden. Es fehlte nur das Foto und ein Ausweis-Layout.
//
// DIE FOTOS liegen im Gerät, nicht in der Datenbank: ein Ausweisfoto ist ein persönliches
// Bild, und der Manager läuft ohnehin nur auf einem Rechner. Sie werden verkleinert
// gespeichert, damit der Browserspeicher bei 18 Mitgliedern nicht überläuft.
(function (global) {
  'use strict';
  const SPEICHER = 'kcm_ausweis_fotos_v1';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // Mitgeliefertes Ausweisfoto: liegt als Datei bei und gilt, solange niemand ein eigenes
  // hochgeladen hat. So ist ein Ausweis sofort einsatzbereit, ohne dass jemand erst ein Bild
  // heraussuchen muss. Ein hochgeladenes Foto hat immer Vorrang.
  const MITGELIEFERT = {'kc-0010': 'assets/ausweisfotos/kc-0010.jpg'};

  // Klarnamen zur Mitgliedsnummer. Auf einem AUSWEIS steht der bürgerliche Name - das
  // Pseudonym ist für den Betrieb an der Kasse gedacht (es steht auf Bons und Anzeigen,
  // damit Gäste keine Namen mitlesen). Ein Ausweis mit "Pumuckl" wäre kein Ausweis.
  //
  // Die Zuordnung stammt aus der zentralen Mitgliederverwaltung (kc_core_pos_aliases +
  // kc_core_club_memberships) und ist hier hinterlegt, damit der Ausweisdruck auch ohne
  // Verbindung funktioniert.
  const daten = (p) => (global.KCMitgliedsdaten || {})[String(p.memberNo || '').trim()] || {};
  const klarname = (p) => daten(p).name || '';
  const fotoVon = (id, fotos) => fotos[id] || MITGELIEFERT[id] || '';

  const liesFotos = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '{}'); } catch (e) { return {}; } };
  const schreibFotos = (f) => { try { localStorage.setItem(SPEICHER, JSON.stringify(f)); return true; } catch (e) { return false; } };

  function profile() {
    try { return global.normalizeManagerOperatorProfiles?.() || []; } catch (e) { return []; }
  }

  // Foto verkleinern und mittig auf Ausweisformat beschneiden. 300x400 reicht für einen
  // gedruckten Ausweis vollkommen; ein Handyfoto mit 4000 Pixeln würde den Speicher sprengen.
  function verkleinere(datei) {
    return new Promise((fertig, fehler) => {
      const leser = new FileReader();
      leser.onload = () => {
        const bild = new Image();
        bild.onload = () => {
          const B = 300, H = 400;
          const flaeche = document.createElement('canvas');
          flaeche.width = B; flaeche.height = H;
          const stift = flaeche.getContext('2d');
          const v = bild.width / bild.height, z = B / H;
          let sx = 0, sy = 0, sb = bild.width, sh = bild.height;
          if (v > z) { sb = bild.height * z; sx = (bild.width - sb) / 2; }
          else { sh = bild.width / z; sy = (bild.height - sh) * 0.25; }  // Kopf sitzt oben
          stift.drawImage(bild, sx, sy, sb, sh, 0, 0, B, H);
          fertig(flaeche.toDataURL('image/jpeg', 0.82));
        };
        bild.onerror = () => fehler(new Error('Bild konnte nicht gelesen werden'));
        bild.src = leser.result;
      };
      leser.onerror = () => fehler(new Error('Datei konnte nicht gelesen werden'));
      leser.readAsDataURL(datei);
    });
  }

  function qrBild(text, groesse) {
    const qr = global.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createImgTag(Math.max(2, Math.round(groesse / qr.getModuleCount())), 0);
  }

  // Im Druckfenster gibt es keine eigene Adresse - relative Pfade muessen deshalb
  // vollstaendig gemacht werden, sonst bleibt das Foto dort leer.
  const absolut = (pfad) => (!pfad || pfad.startsWith('data:')) ? pfad : new URL(pfad, location.href).href;

  function ausweisHtml(p, foto, fuerDruck) {
    const d = daten(p);
    const bild = foto ? `<img src="${foto}" alt="">`
      : '<div class="ausweis-kein-foto">Foto<br>fehlt</div>';
    const anschrift = [d.strasse, [d.plz, d.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const zeile = (k, v) => v ? `<div class="ausweis-zeile"><b>${k}</b> ${esc(v)}</div>` : '';
    const kopf = (seite) => `<div class="ausweis-kopf">
        <img class="ausweis-logo" src="${absolut('assets/kc-kochmuetze-weiss.png')}" alt="">
        <div class="ausweis-titel">
          <span class="ausweis-verein">${esc(global.settings?.clubName || 'Köcheclub Werne')}</span>
          <span class="ausweis-art">Mitgliedsausweis · ${seite}</span>
        </div>
        <div class="ausweis-kopf-qr">${qrBild(p.code, fuerDruck ? 70 : 52)}</div>
      </div>`;

    // VORDERSEITE: Name groß, darunter die Angaben, rechts das Foto.
    const vorne = `<div class="kc-ausweis">
      ${kopf('Vorderseite')}
      <div class="ausweis-koerper">
        <div class="ausweis-daten">
          <div class="ausweis-name">${esc(d.name || '—')}</div>
          ${zeile('Mitglieds-Nr.:', p.memberNo)}
          ${zeile('Adresse:', anschrift)}
          ${zeile('Mitgliedsart:', d.status)}
          ${zeile('Funktion:', d.funktion)}
        </div>
        <div class="ausweis-foto">${bild}</div>
      </div>
      <div class="ausweis-fuss">Erstellt am ${new Date().toLocaleDateString('de-DE')}</div>
    </div>`;

    // RÜCKSEITE: Angaben zur Person und der Hinweis bei Verlust, QR-Code groß daneben.
    const hinten = `<div class="kc-ausweis">
      ${kopf('Rückseite')}
      <div class="ausweis-koerper">
        <div class="ausweis-daten">
          ${zeile('Name:', d.name)}
          ${zeile('Mitglieds-Nr.:', p.memberNo)}
          ${zeile('Ort:', [d.plz, d.ort].filter(Boolean).join(' '))}
          ${zeile('Kontakt:', d.telefon)}
          <div class="ausweis-hinweis">Dieser Ausweis dient der internen Identifikation im
            Verein. Bei Verlust bitte den Vorstand informieren.</div>
        </div>
        <div class="ausweis-qr-gross">${qrBild(p.code, fuerDruck ? 150 : 96)}</div>
      </div>
      <div class="ausweis-fuss">Interner Vereinsausweis</div>
    </div>`;
    return vorne + hinten;
  }

  function zeichne() {
    const ziel = el('kcAusweisListe');
    if (!ziel) return;
    const fotos = liesFotos();
    const alle = profile().filter((p) => p.id !== 'team');
    if (!alle.length) { ziel.innerHTML = '<p class="hint">Keine Mitglieder hinterlegt.</p>'; return; }
    const ohneFoto = alle.filter((p) => !fotoVon(p.id, fotos)).length;
    const ohneName = alle.filter((p) => !klarname(p)).length;
    ziel.innerHTML = `
      <p class="hint">${alle.length} Ausweise · ${ohneFoto ? `<b>${ohneFoto} ohne Foto</b>` : 'alle mit Foto'}${
        ohneName ? ` · <b>${ohneName} ohne Klarnamen</b>` : ''}</p>
      <div class="ausweis-grid">
        ${alle.map((p) => `<div class="ausweis-eintrag">
          ${ausweisHtml(p, fotoVon(p.id, fotos), false)}
          <div class="ausweis-knoepfe">
            <label class="ausweis-foto-knopf">Foto wählen
              <input type="file" accept="image/*" data-ausweis-foto="${esc(p.id)}" hidden></label>
            <button type="button" data-ausweis-druck="${esc(p.id)}">Drucken</button>
          </div>
        </div>`).join('')}
      </div>`;

    ziel.querySelectorAll('[data-ausweis-foto]').forEach((feld) => {
      feld.addEventListener('change', async () => {
        const datei = feld.files?.[0];
        if (!datei) return;
        try {
          const klein = await verkleinere(datei);
          const fotos2 = liesFotos();
          fotos2[feld.dataset.ausweisFoto] = klein;
          if (!schreibFotos(fotos2)) {
            global.KCManagerMessages?.warning?.('Der Speicher ist voll – bitte ein Foto entfernen.');
            return;
          }
          zeichne();
        } catch (e) {
          global.KCManagerMessages?.warning?.('Das Bild konnte nicht gelesen werden.');
        }
      });
    });
    ziel.querySelectorAll('[data-ausweis-druck]').forEach((knopf) => {
      knopf.addEventListener('click', () => drucke([knopf.dataset.ausweisDruck]));
    });
  }

  // Druck im Scheckkartenformat, wie die Security Card. Mehrere Ausweise landen
  // nacheinander - so kann man alle 18 in einem Rutsch drucken.
  function drucke(ids) {
    const fotos = liesFotos();
    const alle = profile().filter((p) => p.id !== 'team' && (!ids || ids.includes(p.id)));
    if (!alle.length) return;
    const fenster = global.open('', '_blank', 'width=560,height=460');
    if (!fenster) { global.KCManagerMessages?.warning?.('Das Druckfenster wurde blockiert. Bitte Pop-ups erlauben.'); return; }
    fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Mitgliedsausweise</title>
      <style>
        @page{size:85.6mm 54mm;margin:0}
        html,body{margin:0;padding:0;font-family:system-ui,sans-serif}
        .kc-ausweis{width:85.6mm;height:54mm;box-sizing:border-box;page-break-after:always;
          display:flex;flex-direction:column;border:.3mm solid #c9a227;overflow:hidden}
        .ausweis-kopf{background:#7a1d1d;color:#fff;padding:1.4mm 3mm;display:flex;
          align-items:center;gap:2.5mm}
        .ausweis-logo{height:7mm;width:auto;display:block;flex:0 0 auto}
        .ausweis-titel{display:flex;flex-direction:column;line-height:1.15}
        .ausweis-verein{font-weight:800;font-size:9pt;letter-spacing:.02em}
        .ausweis-art{font-size:6.5pt;text-transform:uppercase;letter-spacing:.07em;opacity:.92}
        .ausweis-kopf-qr{margin-left:auto}
        .ausweis-kopf-qr img{width:10mm;height:10mm;display:block;image-rendering:pixelated;
          background:#fff;padding:.4mm}
        .ausweis-koerper{flex:1;display:flex;gap:3mm;padding:2.2mm 3mm;min-height:0}
        .ausweis-daten{flex:1;min-width:0}
        .ausweis-name{font-size:12pt;font-weight:800;line-height:1.1;color:#1d5136;margin-bottom:1mm}
        .ausweis-zeile{font-size:7.2pt;line-height:1.5}
        .ausweis-zeile b{font-weight:700}
        .ausweis-hinweis{font-size:6pt;line-height:1.35;color:#7a1d1d;margin-top:1.4mm}
        .ausweis-foto{width:20mm;height:26mm;border:.2mm solid #ddd;overflow:hidden;
          flex:0 0 20mm;align-self:center}
        .ausweis-foto img{width:100%;height:100%;object-fit:cover;display:block}
        .ausweis-kein-foto{width:100%;height:100%;display:flex;align-items:center;
          justify-content:center;color:#999;font-size:6pt;text-align:center;background:#f4f4f4}
        .ausweis-qr-gross{flex:0 0 auto;align-self:center}
        .ausweis-qr-gross img{width:21mm;height:21mm;display:block;image-rendering:pixelated}
        .ausweis-fuss{font-size:5.6pt;color:#888;padding:0 3mm 1.4mm}
      </style></head><body>
      ${alle.map((p) => ausweisHtml(p, absolut(fotoVon(p.id, fotos)), true)).join('')}
      <script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    fenster.document.close();
  }

  function haengeEin() {
    if (el('kcAusweisBlock')) return;
    const bereich = document.querySelector('[data-view-panel="settings"]');
    if (!bereich) return;
    const block = document.createElement('article');
    block.id = 'kcAusweisBlock';
    block.className = 'panel';
    block.innerHTML = `<h3>Mitgliedsausweise</h3>
      <p class="hint">Ausweis mit Foto, Name, Mitgliedsnummer und QR-Code. Der QR-Code ist
         derselbe, mit dem sich das Mitglied an der Kasse anmeldet. Gedruckt wird im
         Scheckkartenformat.</p>
      <div class="seccard-knoepfe" style="margin-bottom:10px">
        <button type="button" id="kcAusweisAlleDrucken" class="primary">Alle Ausweise drucken</button>
      </div>
      <div id="kcAusweisListe"></div>`;
    bereich.appendChild(block);
    el('kcAusweisAlleDrucken').onclick = () => drucke(null);
    document.querySelectorAll('[data-view="settings"]').forEach((k) =>
      k.addEventListener('click', () => setTimeout(zeichne, 250)));
    zeichne();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', haengeEin);
  else haengeEin();
  new MutationObserver(haengeEin).observe(document.body, {childList: true, subtree: true});
  global.KCAusweise = {zeichne, drucke, liesFotos, verkleinere};
})(window);
