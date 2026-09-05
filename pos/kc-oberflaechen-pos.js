/* KC Oberflächen in der Kasse — mehrere hinterlegen und umschalten.   03.09.2026
 *
 * ANLASS (Betreiber): "Dann können wir auf unserer Kasse mehrere hinterlegen, die man per
 * Umschalten auswählen kann. ... so flexibel, dass jederzeit weitere dazukommen können."
 *
 * ACHTUNG — WAS DIESE DATEI HEUTE TUT UND WAS NICHT
 * Sie nimmt die Sammlung des Baukastens an, prüft sie, hält sie vor, listet sie auf und merkt
 * sich, welche Oberfläche gewählt ist. Sie BAUT DIE KASSE NOCH NICHT UM. Der Umbau ist der
 * nächste Schritt und der größere; er gehört in die Kasse selbst.
 * Damit diese Lücke nicht als stiller Rest verschwindet, sagt `bericht()` bei jeder Oberfläche
 * ausdrücklich, wie viele ihrer Bausteine die Kasse heute schon einem echten Bereich zuordnen
 * kann und welche nicht. Eine Lücke, die man sieht, ist eine Aufgabe.
 *
 * DIESE DATEI IST IM FREITAGSSTAND NICHT EINGEBUNDEN. Sie liegt in der Arbeitskopie und wird
 * erst nach der Vorführung eingehängt.
 */
'use strict';
(function (global) {
  const VERSION = '0.1.0';
  const LAGER = 'kc.kassenoberflaechen.v1';       // dieselbe Ablage, die der Baukasten füllt
  const GEWAEHLT = 'kc.kassenoberflaeche.gewaehlt.v1';

  /* Welcher Baustein entspricht welchem Bereich der heutigen Kasse?
     Bewusst kurz und ausdrücklich: Hier stehen nur Zuordnungen, die an der laufenden Kasse
     am 03.09.2026 nachgemessen wurden. Alles andere gilt als "noch nicht zuordenbar" und
     wird gemeldet, statt so zu tun, als wäre es schon da. */
  const BEREICHE = {
    'kc-kopf-voll': 'header', 'kc-kopf-kompakt': 'header',
    'kc-gruppen-leiste': '.category-tabs', 'kc-gruppen-spalte': '.category-tabs',
    'kc-gruppen-raster': '.category-tabs',
    'kc-artikel-gross': '.product-grid', 'kc-artikel-mittel': '.product-grid',
    'kc-artikel-klein': '.product-grid', 'kc-artikel-bild': '.product-grid',
    'kc-artikel-farbe': '.product-grid', 'kc-artikel-info': '.product-grid',
    'kc-artikel-nurtext': '.product-grid',
    'kc-bon-ausfuehrlich': '.cart-area', 'kc-bon-kompakt': '.cart-area',
    'kc-bon-tabelle': '.cart-area', 'kc-bon-dunkel': '.cart-area',
    'kc-zahlen-block': '.keypad', 'kc-zahlen-scheine': '.banknote-button',
    'kc-zahlen-fest': '.main-actions', 'kc-sonder-leiste': '.main-actions',
    'kc-sonder-spalte': '.main-actions',
  };

  const F = () => global.KCOberflaechenFormat;

  function sammlung() {
    if (!F()) return { format: 'kc-kassenoberflaechen', version: 1, oberflaechen: [] };
    try {
      const roh = localStorage.getItem(LAGER);
      if (!roh) return F().leereSammlung();
      const { sammlung: s, maengel } = F().pruefeSammlung(roh);
      if (!s) { console.warn('KC Oberflächen: Sammlung unbrauchbar', maengel); return F().leereSammlung(); }
      return s;
    } catch (e) { return F().leereSammlung(); }
  }

  /* Eine Sammlung von außen übernehmen - aus einer Datei, vom Manager, egal woher.
     Sie wird geprüft, BEVOR sie die vorhandene ersetzt. Kommt etwas Unsauberes an, bleibt die
     alte Sammlung stehen und der Aufrufer bekommt die Mängel zu sehen. */
  function uebernehmen(roh, ersetzen) {
    if (!F()) return { ok: false, maengel: ['Das Format-Modul fehlt.'] };
    const { sammlung: neu, maengel } = F().pruefeSammlung(roh);
    if (!neu) return { ok: false, maengel };
    let s = ersetzen ? F().leereSammlung() : sammlung();
    neu.oberflaechen.forEach((o) => { s = F().einsortieren(s, o); });
    try { localStorage.setItem(LAGER, JSON.stringify(s)); } catch (e) {
      return { ok: false, maengel: ['Die Sammlung konnte nicht gespeichert werden.'] };
    }
    return { ok: true, maengel, anzahl: s.oberflaechen.length };
  }

  const liste = () => sammlung().oberflaechen.map((o) => ({
    id: o.id, name: o.name, geraet: o.geraet, klasse: o.klasse,
    felder: (o.seiten || []).reduce((n, se) => n + (se.bausteine || []).length, 0),
    seiten: (o.seiten || []).length,
  }));

  const gewaehlteId = () => { try { return localStorage.getItem(GEWAEHLT) || ''; } catch (e) { return ''; } };
  const gewaehlte = () => sammlung().oberflaechen.find((o) => o.id === gewaehlteId()) || null;

  function waehlen(id) {
    const o = sammlung().oberflaechen.find((x) => x.id === id);
    if (!o) return { ok: false, grund: 'Diese Oberfläche liegt nicht in der Sammlung.' };
    try { localStorage.setItem(GEWAEHLT, id); } catch (e) { return { ok: false, grund: 'Die Wahl konnte nicht gemerkt werden.' }; }
    /* Der Umbau der Kasse hängt hier ein, sobald er gebaut ist. Bis dahin wird die Wahl nur
       gemerkt - und das wird auch so gesagt, statt einen Erfolg zu behaupten. */
    (global.KCOberflaechen.beiWahl || []).forEach((f) => { try { f(o); } catch (e) {} });
    return { ok: true, oberflaeche: o, umgebaut: false };
  }

  /* Was kann die Kasse von einer Oberfläche heute schon? */
  function bericht(id) {
    const o = id ? sammlung().oberflaechen.find((x) => x.id === id) : gewaehlte();
    if (!o) return null;
    const zuordenbar = [], offen = [];
    (o.seiten || []).forEach((se) => (se.bausteine || []).forEach((b) => {
      const bereich = BEREICHE[b.typ];
      const da = bereich && document.querySelector(bereich);
      (da ? zuordenbar : offen).push({ typ: b.typ, seite: se.art, bereich: bereich || null });
    }));
    return {
      id: o.id, name: o.name, geraet: o.geraet,
      gesamt: zuordenbar.length + offen.length,
      zuordenbar: zuordenbar.length,
      offen: [...new Set(offen.map((x) => x.typ))],
      umbauMoeglich: false,      // ehrlich: der Umbau ist noch nicht gebaut
    };
  }

  global.KCOberflaechen = {
    version: VERSION, LAGER, GEWAEHLT, BEREICHE,
    sammlung, liste, uebernehmen, waehlen, gewaehlte, gewaehlteId, bericht,
    beiWahl: [],
  };
  console.info(`KC Oberflächen (${VERSION}) bereit – ${liste().length} hinterlegt, gewählt: ${gewaehlteId() || 'keine'}.`);
})(typeof window !== 'undefined' ? window : globalThis);
