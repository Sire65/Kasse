// Bargeld-Statistik im PC-Manager.
//
// Die Auswertung selbst steckt im gemeinsamen Modul shared/kc-bargeld-statistik.js - hier
// steht nur die Bedienung: Filter, Nachladen, und das Melden der im Manager erzeugten
// Übergaben. Damit zeigen Manager und eigenständige Money-Butler-App garantiert dieselben
// Zahlen; zwei getrennte Auswertungen wären früher oder später auseinandergelaufen.
(function (global) {
  'use strict';
  const stat = global.KCBargeldStatistik;
  if (!stat) return;
  const el = (id) => document.getElementById(id);

  let geladen = false;

  async function zeichne() {
    const ziel = el('mgrStatistik');
    if (!ziel) return;
    ziel.innerHTML = '<p class="kcbs-leer">Wird geladen …</p>';
    const {liste, quelle} = await stat.laden();
    fuelleKassenauswahl(liste);
    const daten = stat.auswerten(liste, {
      typ: el('mgrStatTyp')?.value,
      kasse: el('mgrStatKasse')?.value,
      von: el('mgrStatVon')?.value,
      bis: el('mgrStatBis')?.value,
    });
    stat.zeichne(ziel, daten, quelle);
    geladen = true;
  }

  // Die Kassenliste ergibt sich aus den vorhandenen Übergaben - so stehen dort nur Kassen,
  // für die es überhaupt etwas zu zeigen gibt, und die Auswahl bleibt richtig, wenn später
  // eine Kasse dazukommt.
  function fuelleKassenauswahl(liste) {
    const auswahl = el('mgrStatKasse');
    if (!auswahl) return;
    const vorhanden = [...new Set((liste || []).map((u) => u.registerId).filter(Boolean))].sort();
    const gewaehlt = auswahl.value || 'alle';
    const soll = ['alle', ...vorhanden].join('|');
    if (auswahl.dataset.stand === soll) return;      // unveraendert - nicht neu aufbauen
    // Eine Geldkassette gehoert keiner einzelnen Kasse - sie wird unter einem eigenen,
    // lesbaren Eintrag gefuehrt, damit sie beim Filtern nicht unsichtbar wird.
    const beschriftung = (k) => (k === 'KASSETTE' ? 'Geldkassette (beide Kassen)' : k);
    auswahl.innerHTML = '<option value="alle">Alle Kassen</option>'
      + vorhanden.map((k) => `<option value="${k}">${beschriftung(k)}</option>`).join('');
    auswahl.dataset.stand = soll;
    auswahl.value = vorhanden.includes(gewaehlt) || gewaehlt === 'alle' ? gewaehlt : 'alle';
  }

  function bind() {
    el('mgrStatAktualisieren')?.addEventListener('click', zeichne);
    ['mgrStatTyp', 'mgrStatKasse', 'mgrStatVon', 'mgrStatBis']
      .forEach((id) => el(id)?.addEventListener('change', zeichne));
    // Beim ersten Öffnen des Money-Butler-Bereichs laden, nicht schon beim Start des Managers.
    document.querySelectorAll('[data-view="cashprep"]').forEach((knopf) =>
      knopf.addEventListener('click', () => { if (!geladen) setTimeout(zeichne, 200); }));
  }

  // Die per QR erzeugten Übergaben melden.
  //
  // NUR der QR-Weg. Der WLAN-Weg wird bereits im Manager-Dienst selbst mitgeschrieben, wenn
  // die Übergabe dort eingereiht wird - und er füllt das Textfeld unten gar nicht, sondern
  // baut seinen Datensatz getrennt. Würde ich ihn hier mit anhängen, würde entweder nichts
  // oder ein alter Stand aus dem Textfeld gemeldet.
  function haengeMeldungAn() {
    el('generateCashQr')?.addEventListener('click', () => setTimeout(() => {
      // Gemeldet wird genau der Datensatz aus dem Textfeld - also das, was auch wirklich an
      // die Kasse geht, statt ihn hier ein zweites Mal zusammenzubauen.
      const roh = el('cashQrPayload')?.value || '';
      if (!roh.startsWith('KCASH1:')) return;
      try {
        const uebergabe = JSON.parse(decodeURIComponent(escape(atob(roh.slice(7)))));
        stat.melden(uebergabe, 'qr');
        if (geladen) zeichne();
      } catch (e) { /* Statistik ist nachrangig, die Übergabe selbst läuft weiter */ }
    }, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); haengeMeldungAn(); });
  } else { bind(); haengeMeldungAn(); }
  global.KCBargeldStatistikManager = {zeichne};
})(window);
