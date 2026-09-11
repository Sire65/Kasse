// Wie oft welche Folie drankommt - je Folie einstellbar.
//
// ANLASS: Der Bildschirm lief stur von Folie 1 bis 28 und wieder von vorn. Bei 28 Folien
// dauert ein Durchgang rund fünf Minuten - die Preisliste sah ein Gast also frühestens alle
// fünf Minuten, und dazwischen liefen 18 Mitgliedsgesichter am Stück. Für einen Verkaufsstand
// ist das die falsche Gewichtung.
//
// JETZT: Für jede Folie lässt sich festlegen, in welchem Durchgang sie erscheint - in jedem,
// in jedem zweiten, dritten oder vierten. Die Preislisten laufen dadurch häufig, Rezept und
// Vereinsgeschichten seltener.
//
// DER VERSATZ ist der Teil, an den man leicht nicht denkt: Zwei Folien mit "jeder zweite"
// würden sonst immer im selben Durchgang zusammen erscheinen und im nächsten beide fehlen.
// Deshalb wird er beim Setzen automatisch verteilt.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const TAKTE = [
    {wert: 1, text: 'in jedem Durchgang'},
    {wert: 2, text: 'in jedem 2. Durchgang'},
    {wert: 3, text: 'in jedem 3. Durchgang'},
    {wert: 4, text: 'in jedem 4. Durchgang'},
  ];

  const praesentation = () => global.KCGetTVPresentation?.() || global.tvPresentation || null;

  // Versatz gleichmäßig verteilen: die dritte Folie mit "jeder zweite" bekommt wieder
  // Versatz 0, die vierte Versatz 1 und so weiter.
  function verteileVersatz(folien) {
    const zaehler = new Map();
    folien.forEach((s) => {
      const jeder = Math.max(1, Number(s.rotation?.every) || 1);
      if (jeder === 1) { if (s.rotation) s.rotation.offset = 0; return; }
      const n = zaehler.get(jeder) || 0;
      zaehler.set(jeder, n + 1);
      s.rotation = s.rotation || {};
      s.rotation.every = jeder;
      s.rotation.offset = n % jeder;
    });
  }

  function hochrechnung(folien) {
    // Wie lange dauert ein Durchgang im Schnitt, und wie oft sieht ein Gast eine Folie?
    let sekunden = 0;
    folien.forEach((s) => {
      const jeder = Math.max(1, Number(s.rotation?.every) || 1);
      sekunden += (Math.max(3, Number(s.duration) || 8)) / jeder;
    });
    return sekunden;
  }

  function zeichne() {
    const ziel = el('tvFolienTakt');
    if (!ziel) return;
    const p = praesentation();
    if (!p?.slides?.length) {
      ziel.innerHTML = '<p class="hint">Noch keine Präsentation geladen.</p>';
      return;
    }
    const dauer = hochrechnung(p.slides);
    const minuten = Math.round(dauer / 6) / 10;
    ziel.innerHTML = `
      <p class="hint">Ein Durchgang dauert im Schnitt <b>${minuten} Minuten</b>.
         Eine Folie „in jedem 2. Durchgang" sieht ein Gast also etwa alle
         ${Math.round(minuten * 2)} Minuten.</p>
      <table class="kcbs-tabelle"><thead><tr>
        <th>Folie</th><th>Wie lange</th><th>Wie oft</th></tr></thead><tbody>
      ${p.slides.map((s, i) => `<tr>
        <td>${i + 1}. ${esc(s.title || '(ohne Titel)')}</td>
        <td><input type="number" min="3" max="120" step="1" data-folien-dauer="${i}"
              value="${Math.max(3, Number(s.duration) || 8)}" style="width:74px"> s</td>
        <td><select data-folien-takt="${i}">
          ${TAKTE.map((t) => `<option value="${t.wert}" ${
            (Number(s.rotation?.every) || 1) === t.wert ? 'selected' : ''}>${t.text}</option>`).join('')}
        </select></td></tr>`).join('')}
      </tbody></table>`;

    // Anzeigedauer - dieselbe Einstellung wie im Eigenschaftenbereich der Folie, nur auch
    // hier erreichbar. Sie steht bewusst neben der Häufigkeit: beides zusammen ergibt erst,
    // wie oft ein Gast eine Folie tatsächlich sieht.
    ziel.querySelectorAll('[data-folien-dauer]').forEach((feld) => {
      feld.addEventListener('change', () => {
        const p2 = praesentation();
        if (!p2) return;
        const folie = p2.slides[Number(feld.dataset.folienDauer)];
        // Grenzen wie im Eigenschaftenbereich: unter 3 Sekunden kann niemand lesen, über
        // 120 steht der Bildschirm gefühlt still.
        folie.duration = Math.min(120, Math.max(3, Number(feld.value) || 8));
        global.saveTvPresentation?.();
        zeichne();
      });
    });

    ziel.querySelectorAll('[data-folien-takt]').forEach((auswahl) => {
      auswahl.addEventListener('change', () => {
        const p2 = praesentation();
        if (!p2) return;
        const folie = p2.slides[Number(auswahl.dataset.folienTakt)];
        folie.rotation = folie.rotation || {};
        folie.rotation.every = Math.max(1, Number(auswahl.value) || 1);
        verteileVersatz(p2.slides);
        global.saveTvPresentation?.();
        zeichne();
      });
    });
  }

  // Schnellwahl: die typischen Fälle mit einem Klick, damit niemand 28 Felder einzeln stellen muss.
  function schnellwahl(art) {
    const p = praesentation();
    if (!p?.slides?.length) return;
    p.slides.forEach((s) => {
      const titel = String(s.title || '');
      const istPreis = /Preisliste/i.test(titel);
      const istMitglied = s.type === 'member';
      let jeder = 1;
      if (art === 'verkauf') {
        // Preise häufig, Mitglieder selten - für den laufenden Verkauf am Stand.
        jeder = istPreis ? 1 : istMitglied ? 4 : 2;
      } else if (art === 'verein') {
        // Verein im Vordergrund - für ruhigere Zeiten oder Vereinsanlässe.
        jeder = istMitglied ? 1 : istPreis ? 2 : 1;
      }
      s.rotation = {every: jeder, offset: 0};
    });
    verteileVersatz(p.slides);
    global.saveTvPresentation?.();
    zeichne();
  }

  function haengeEin() {
    if (el('tvFolienTaktBlock')) return;
    const bereich = document.querySelector('[data-view-panel="tvscreen"]');
    if (!bereich) return;
    const block = document.createElement('article');
    block.id = 'tvFolienTaktBlock';
    block.className = 'secure-card';
    block.innerHTML = `<h3>Wie oft welche Folie kommt</h3>
      <p class="hint">Der Bildschirm läuft in Durchgängen. Hier legst du fest, in welchem
         Durchgang eine Folie erscheint.<br>
         <b>Für die Vorführung</b> sollen alle Folien nacheinander laufen – die Mitglieder
         wollen sich schließlich sehen. <b>Am Markttag</b> ist das falsch: kein Besucher schaut
         sich 18 Mitgliedsfolien am Stück an. Dort laufen die Preise häufig und die Mitglieder
         reihum, damit trotzdem jeder einmal drankommt.</p>
      <div class="seccard-knoepfe" style="margin-bottom:10px">
        <button type="button" id="tvTaktAlle" class="primary">Vorführung: alle Folien nacheinander</button>
        <button type="button" id="tvTaktVerkauf">Markttag: Preise häufig, Mitglieder selten</button>
        <button type="button" id="tvTaktVerein">Verein im Vordergrund</button>
      </div>
      <div id="tvFolienTakt"></div>`;
    bereich.appendChild(block);
    el('tvTaktVerkauf').onclick = () => schnellwahl('verkauf');
    el('tvTaktVerein').onclick = () => schnellwahl('verein');
    el('tvTaktAlle').onclick = () => schnellwahl('gleich');
    document.querySelectorAll('[data-view="tvscreen"]').forEach((k) =>
      k.addEventListener('click', () => setTimeout(zeichne, 250)));
    zeichne();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', haengeEin);
  else haengeEin();
  new MutationObserver(haengeEin).observe(document.body, {childList: true, subtree: true});
  global.KCFolienTakt = {zeichne, schnellwahl, verteileVersatz, hochrechnung};
})(window);
