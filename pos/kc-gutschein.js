// Gutscheine und Wertmarken - ein gemeinsames Guthabenkonto.
//
// GRUNDGEDANKE: Beides ist vorab bezahltes Guthaben, das spaeter gegen Ware eingeloest wird.
// Die Wertmarke ist nur der Sonderfall mit festem Betrag. Deshalb EINE Mechanik statt zwei -
// sonst muessten Auswertung, Abschluss und Restwertfuehrung doppelt gepflegt werden.
//
// BUCHUNGSLOGIK (der Punkt, an dem ein Denkfehler teuer wird):
//   VERKAUF   = Geld kommt in die Kasse, es geht KEINE Ware raus -> das ist noch KEIN Umsatz,
//               sondern eine Anzahlung. Der Verein schuldet die Ware noch.
//   EINLOESEN = Ware geht raus, es kommt KEIN Geld -> JETZT entsteht der Umsatz.
// Wuerde beides als Umsatz gebucht, staende der Tag doppelt in den Zahlen. Beim Kassensturz
// faellt das nicht auf, weil das Bargeld stimmt - in der Auswertung aber sehr wohl.
// Das Einloesen laeuft deshalb ueber completeSale("account-charge"): Ware raus, kein Bargeld -
// dieselbe Mechanik wie beim Personalverbrauch.
(function (global) {
  'use strict';

  const SPEICHER = 'kc_vouchers_v1';
  const GUELTIG_JAHRE = 3;
  const BETRAEGE = [5, 10, 20, 50, 100];

  const el = (id) => document.getElementById(id);
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' \u20ac';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const datum = (iso) => iso ? new Date(iso).toLocaleDateString('de-DE') : '';

  const lies = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '[]'); } catch (e) { return []; } };
  const schreib = (liste) => { try { localStorage.setItem(SPEICHER, JSON.stringify(liste)); } catch (e) {} };

  // Gutscheinnummer: Jahr + laufende Nummer + Pruefzeichen. Lesbar genug, um sie im Notfall
  // abzutippen, wenn der QR-Code zerknittert ist.
  function neueNummer() {
    const jahr = new Date().getFullYear();
    const lfd = lies().filter((g) => g.code.startsWith(`GS-${jahr}`)).length + 1;
    const stamm = `GS-${jahr}-${String(lfd).padStart(4, '0')}`;
    let summe = 0;
    for (const z of stamm) summe += z.charCodeAt(0);
    return `${stamm}-${String(summe % 97).padStart(2, '0')}`;
  }

  const abgelaufen = (g) => new Date(g.expiresAt).getTime() < Date.now();
  const zustand = (g) => g.balance <= 0.004 ? 'eingeloest'
    : abgelaufen(g) ? 'abgelaufen'
    : g.balance < g.amount - 0.004 ? 'teilweise' : 'offen';
  const ZUSTAND_TEXT = {offen: 'Offen', teilweise: 'Teilweise eingelöst', eingeloest: 'Vollständig eingelöst', abgelaufen: 'Abgelaufen'};

  function ausstellen(betrag, art) {
    const jetzt = new Date();
    const ablauf = new Date(jetzt); ablauf.setFullYear(ablauf.getFullYear() + GUELTIG_JAHRE);
    const gutschein = {
      code: neueNummer(),
      kind: art || 'gutschein',           // 'gutschein' oder 'wertmarke'
      amount: +Number(betrag).toFixed(2),
      balance: +Number(betrag).toFixed(2),
      issuedAt: jetzt.toISOString(),
      expiresAt: ablauf.toISOString(),
      registerId: global.KCSyncConnection?.config?.registerId || '',
      redemptions: [],
    };
    const liste = lies(); liste.push(gutschein); schreib(liste);
    setTimeout(() => global.KCGutschein?.melden?.(), 200);
    return gutschein;
  }

  const finde = (code) => lies().find((g) => g.code.toUpperCase() === String(code || '').trim().toUpperCase());

  // Einloesen: zieht vom Guthaben ab und schreibt den Vorgang mit. Der Gutschein BEHAELT seine
  // Nummer und seinen Restwert - es wird bewusst kein neuer Gutschein gedruckt. Der Zettel des
  // Gastes funktioniert damit weiter, und es kann nicht passieren, dass zwei Zettel im Umlauf
  // sind und niemand weiss, welcher gilt.
  function einloesen(code, betrag, angaben) {
    const liste = lies();
    const g = liste.find((x) => x.code.toUpperCase() === String(code || '').trim().toUpperCase());
    if (!g) return {ok: false, grund: 'Gutschein nicht gefunden.'};
    if (abgelaufen(g)) return {ok: false, grund: `Gutschein war bis ${datum(g.expiresAt)} gültig.`};
    if (g.balance <= 0.004) return {ok: false, grund: 'Auf diesem Gutschein ist kein Guthaben mehr.'};
    const genutzt = Math.min(+Number(betrag).toFixed(2), g.balance);
    g.balance = +(g.balance - genutzt).toFixed(2);
    g.redemptions.push({at: new Date().toISOString(), amount: genutzt,
      registerId: global.KCSyncConnection?.config?.registerId || '', bon: angaben?.bon || ''});
    schreib(liste);
    setTimeout(() => global.KCGutschein?.melden?.(), 200);
    return {ok: true, genutzt, rest: g.balance, gutschein: g};
  }

  // Laufend an die zentrale Sicherung melden. Die Kasse BEHAELT ihre Gutscheine - gemeldet
  // wird nur zusaetzlich. Der offene Restwert ist eine Verpflichtung des Vereins und darf
  // nicht allein auf einem Tablet liegen.
  // Die Sammelstelle des Managers laeuft auf einem eigenen, festen Port (47392) - NICHT auf dem
  // Port des Kassen-Companions, den buildUrl() liefert. Der Rechner ist derselbe, nur der Port
  // unterscheidet sich. Fruehere Meldungen gingen an den Companion und liefen dort ins Leere.
  function managerUrl(pfad) {
    const host = global.KCSyncConnection?.config?.host || '127.0.0.1';
    return `http://${host}:47392${pfad}`;
  }
  const MELDE_URL = () => managerUrl('/gutscheine/melden');
  async function melden() {
    const liste = lies();
    if (!liste.length) return;
    // Gemeinsamer Meldeweg (kc-meldeweg.js): Companion zuerst, alter Weg als Rueckfall.
    // Ohne diesen Umweg kam vom Tablet aus nie etwas an, siehe Erklaerung dort.
    await global.KCMeldeweg?.melde?.('voucher', '/gutscheine/melden', {gutscheine: liste});
  }
  setInterval(melden, 60000);
  setTimeout(melden, 8000);

  global.KCGutschein = {
    ausstellen, einloesen, finde, alle: lies, zustand, ZUSTAND_TEXT, melden,
    BETRAEGE, GUELTIG_JAHRE, abgelaufen,
    // Offene Verpflichtungen: Summe aller Restwerte. Das ist KEIN Gewinn, sondern Ware, die
    // der Verein noch schuldet - fuer die Jahresauswertung der entscheidende Wert.
    offeneVerpflichtung: () => +lies().filter((g) => !abgelaufen(g))
      .reduce((s, g) => s + g.balance, 0).toFixed(2),
  };
})(window);

// ---- Bedienung -------------------------------------------------------------------------
(function (global) {
  'use strict';
  const K = global.KCGutschein;
  const el = (id) => document.getElementById(id);
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' \u20ac';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const datum = (iso) => iso ? new Date(iso).toLocaleDateString('de-DE') : '';

  let gewaehlt = null;

  function reiter(name) {
    document.querySelectorAll('[data-gs-reiter]').forEach((b) => b.classList.toggle('aktiv', b.dataset.gsReiter === name));
    document.querySelectorAll('[data-gs-bereich]').forEach((s) => { s.hidden = s.dataset.gsBereich !== name; });
    if (name === 'liste') zeichneListe();
  }

  // Ziffernblock fuer den freien Betrag.
  //
  // ANLASS: Auf dem Tablet gibt es keinen Ziffernblock, und die eingeblendete
  // Bildschirmtastatur verdeckt das halbe Fenster - man sieht dann nicht mehr, was man tut.
  // Deshalb hier ein eigener Block, wie schon bei der Entnahme.
  //
  // WICHTIG (Lehre aus der Entnahme): das Eingabefeld fuehrt die Eingabe als TEXT. Ein
  // Zahlenfeld verwirft Zwischenstaende wie "5," stillschweigend - beim Tippen von 5,50 kam
  // dort 550 heraus. Hier steht deshalb der getippte Text unveraendert im Feld, und erst beim
  // Ausstellen wird daraus eine Zahl.
  function zeichneZiffern() {
    const feld = el('gsZiffern');
    const eingabe = el('gsFreiBetrag');
    if (!feld || !eingabe || feld.dataset.fertig) return;
    feld.dataset.fertig = '1';
    feld.innerHTML = [1,2,3,4,5,6,7,8,9,0].map((z) => `<button type="button" data-z="${z}">${z}</button>`).join('')
      + '<button type="button" data-z="," class="kc-gs-komma">,</button>'
      + '<button type="button" data-loeschen="1" class="kc-gs-weg">\u232B</button>';
    feld.querySelectorAll('[data-z]').forEach((b) => {
      b.onclick = () => {
        const z = b.dataset.z;
        let t = String(eingabe.value || '');
        if (z === ',') { if (t.includes(',')) return; t = (t || '0') + ','; }
        else {
          if (t.includes(',') && t.split(',')[1].length >= 2) return;   // hoechstens zwei Nachkommastellen
          if (t === '0') t = '';                                        // fuehrende Null ersetzen
          t += z;
        }
        eingabe.value = t;
        gewaehlt = null;
        document.querySelectorAll('[data-gs-betrag]').forEach((x) => x.classList.remove('aktiv'));
      };
    });
    feld.querySelector('[data-loeschen]').onclick = () => { eingabe.value = String(eingabe.value || '').slice(0, -1); };
  }

  function zeichneBetraege() {
    const feld = el('gsBetraege');
    if (!feld) return;
    feld.innerHTML = K.BETRAEGE.map((b) => `<button type="button" data-gs-betrag="${b}">${geld(b)}</button>`).join('');
    feld.querySelectorAll('[data-gs-betrag]').forEach((b) => {
      b.onclick = () => {
        gewaehlt = Number(b.dataset.gsBetrag);
        el('gsFreiBetrag').value = '';
        feld.querySelectorAll('button').forEach((x) => x.classList.toggle('aktiv', x === b));
      };
    });
  }

  // Bon zum Einlegen in eine Karte. Bewusst schlicht: Betrag gross, Nummer gross genug zum
  // Abtippen, QR-Code zum Scannen und das Ablaufdatum - damit hinterher niemand streiten muss,
  // bis wann er galt.
  // Gutscheinbon zum Einlegen in eine Karte.
  //
  // Er ist Beleg UND Geschenk zugleich - deshalb ordentlich aufgebaut statt als nackter
  // Kassenzettel: Vereinslogo und Name im Kopf, klare Zweitüberschrift "GUTSCHEIN", der Betrag
  // gross, darunter Nummer und QR-Code zum Einlösen.
  // Wichtig sind die Angaben, die hinterher Streit vermeiden: Ausstellungsdatum, Gültigkeit,
  // ausgebende Kasse und Bediener. Wer den Gutschein in zwei Jahren vorlegt, kann damit
  // nachvollzogen werden, auch wenn sich niemand mehr erinnert.
  function bonInhalt(g) {
    // ACHTUNG: state ist in app.js mit const angelegt und haengt NICHT am Fenster - aus diesem
    // Modul ist es nicht erreichbar. Deshalb kommen die Stammdaten aus dem gespeicherten Satz;
    // beim ersten Versuch blieben Kasse und Bediener auf dem Bon sonst leer.
    let m = {};
    try { m = JSON.parse(localStorage.getItem('kc_master_v040') || '{}'); } catch (e) { m = {}; }
    const verein = m.clubName || 'Köcheclub Werne';
    const anlass = m.eventName || '';
    const kasse = document.getElementById('registerName')?.textContent.trim() || m.registerName || g.registerId || '';
    // Auf dem Gutschein steht NIE das Pseudonym des angemeldeten Bedieners. Der Gutschein geht
    // aus dem Haus - "Es bediente Sie Balu" wuerde die interne Kennung nach draussen tragen und
    // ueber die Zeit Rueckschluesse auf die Person erlauben. Deshalb fest "Team".
    // Wer den Gutschein wirklich ausgestellt hat, steht weiterhin im gespeicherten Vorgang und
    // ist im Manager auswertbar - nur eben nicht auf dem Papier beim Kunden.
    const bediener = global.KCBelegBediener || 'Team';
    const logo = document.getElementById('clubLogo')?.src || '';
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Gutschein ${esc(g.code)}</title>
      <style>
        @page{size:80mm auto;margin:4mm}
        body{font-family:system-ui,'Segoe UI',sans-serif;margin:0;padding:6px 8px;width:72mm;color:#000}
        .kopf{text-align:center;border-bottom:2px solid #000;padding-bottom:6px}
        .kopf img{max-width:46px;max-height:46px;object-fit:contain}
        .verein{font-size:1.05rem;font-weight:900;letter-spacing:.02em;margin:2px 0 0}
        .anlass{font-size:.74rem;font-style:italic}
        .zeile{display:flex;justify-content:space-between;font-size:.72rem;margin:2px 0}
        .titel{text-align:center;font-size:1.5rem;font-weight:900;letter-spacing:.22em;
               margin:10px 0 2px;padding:5px 0;border-top:2px solid #000;border-bottom:2px solid #000}
        .betrag{text-align:center;font-size:2.6rem;font-weight:900;margin:10px 0 2px;line-height:1}
        .inworten{text-align:center;font-size:.72rem;margin-bottom:8px}
        .qr{text-align:center;margin:6px 0}
        .code{text-align:center;font-family:ui-monospace,'Courier New',monospace;font-size:1.05rem;
              font-weight:900;letter-spacing:.08em;margin:4px 0 8px}
        .gueltig{text-align:center;font-size:.9rem;font-weight:900;border:2px solid #000;
                 border-radius:5px;padding:5px;margin:6px 0}
        .klein{font-size:.68rem;line-height:1.5}
        .fuss{border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center}
        .dank{text-align:center;font-size:.8rem;font-weight:700;margin-top:8px}
      </style></head><body>
      <div class="kopf">
        ${logo ? `<img src="${esc(logo)}" alt="">` : ''}
        <div class="verein">${esc(verein)}</div>
        ${anlass ? `<div class="anlass">${esc(anlass)}</div>` : ''}
      </div>

      <div class="zeile"><span>Datum</span><span>${datum(g.issuedAt)} ${new Date(g.issuedAt).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</span></div>
      ${kasse ? `<div class="zeile"><span>Kasse</span><span>${esc(kasse)}</span></div>` : ''}
      ${bediener ? `<div class="zeile"><span>Bediener</span><span>${esc(bediener)}</span></div>` : ''}

      <div class="titel">GUTSCHEIN</div>
      <div class="betrag">${geld(g.amount)}</div>
      <div class="inworten">${esc(inWorten(g.amount))}</div>

      <div class="qr"><img id="qr" alt=""></div>
      <div class="code">${esc(g.code)}</div>

      <div class="gueltig">Gültig bis ${datum(g.expiresAt)}</div>

      <div class="klein">
        Einlösbar an unserem Verkaufsstand gegen Speisen und Getränke.<br>
        Restbeträge bleiben auf diesem Gutschein – die Nummer bleibt gültig.<br>
        Keine Barauszahlung. Bitte diesen Beleg aufbewahren und beim Einlösen vorlegen.
      </div>

      <div class="dank">Viel Freude beim Genießen!</div>

      <div class="fuss klein">${esc(verein)}${kasse ? ` · ${esc(kasse)}` : ''}<br>${esc(g.code)}</div>
      </body></html>`;
  }

  // Betrag in Worten - erschwert nachträgliches Verändern des Zahlenbetrags auf dem Beleg.
  function inWorten(betrag) {
    const einer = ['null','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn',
      'elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
    const zehner = ['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];
    const wort = (n) => {
      if (n < 20) return einer[n];
      if (n < 100) { const z = Math.floor(n / 10), e = n % 10; return e ? `${einer[e]}und${zehner[z]}` : zehner[z]; }
      if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return `${h === 1 ? 'ein' : einer[h]}hundert${r ? wort(r) : ''}`; }
      return String(n);
    };
    const ganz = Math.floor(betrag), cent = Math.round((betrag - ganz) * 100);
    return `\u2013 ${wort(ganz)} Euro${cent ? ` ${wort(cent)} Cent` : ''} \u2013`;
  }

  // QR-Code für den Gutschein.
  //
  // BEFUND: Ich hatte hier QRCode.toDataURL verwendet - das gibt es in dieser Kasse gar nicht.
  // Sie nutzt qrcode(0,"M") aus qrcode-generator.js. Der Gutschein wäre also OHNE QR-Code
  // gedruckt worden, und das wäre erst am Stand aufgefallen, wenn ihn jemand einlösen will.
  // Jetzt derselbe Weg wie beim Bon-QR der Kasse: als Bildpunkte auf eine Zeichenfläche und
  // von dort als Bild in den Ausdruck.
  function qrBild(text, groesse) {
    try {
      if (typeof qrcode !== 'function') return null;
      const qr = qrcode(0, 'M');
      qr.addData(String(text));
      qr.make();
      const flaeche = document.createElement('canvas');
      flaeche.width = flaeche.height = groesse;
      const ctx = flaeche.getContext('2d');
      const felder = qr.getModuleCount(), rand = 4, zelle = groesse / (felder + rand * 2);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, groesse, groesse);
      ctx.fillStyle = '#000';
      for (let z = 0; z < felder; z++) {
        for (let sp = 0; sp < felder; sp++) {
          if (qr.isDark(z, sp)) {
            ctx.fillRect(Math.floor((sp + rand) * zelle), Math.floor((z + rand) * zelle),
                         Math.ceil(zelle), Math.ceil(zelle));
          }
        }
      }
      return flaeche.toDataURL('image/png');
    } catch (fehler) { return null; }
  }

  function druckeBon(g) {
    // QR-Code VOR dem Öffnen erzeugen: im Druckfenster gibt es die Bibliothek nicht.
    const qr = qrBild(g.code, 200);
    const fenster = global.open('', '_blank', 'width=400,height=680');
    if (!fenster) { alert('Der Druck wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.'); return; }
    let inhalt = bonInhalt(g);
    inhalt = qr
      ? inhalt.replace('<img id="qr" alt="">', `<img id="qr" src="${qr}" alt="" style="width:190px;height:190px">`)
      // Ohne QR bleibt die Nummer groß und lesbar - der Gutschein ist dann von Hand
      // einlösbar statt unbrauchbar.
      : inhalt.replace('<div class="qr"><img id="qr" alt=""></div>', '');
    fenster.document.write(inhalt);
    fenster.document.close();
    setTimeout(() => { try { fenster.print(); } catch (e) {} }, 400);
  }

  function ausstellen() {
    const frei = Number(String(el('gsFreiBetrag').value || '').replace(',', '.'));
    const betrag = frei > 0 ? frei : gewaehlt;
    if (!betrag || betrag <= 0) { melde('gsErgebnis', 'warn', 'Bitte zuerst einen Betrag wählen.'); return; }
    if (betrag > 500) { melde('gsErgebnis', 'warn', 'Höchstbetrag ist 500,00 €.'); return; }
    const g = K.ausstellen(betrag, 'gutschein');
    melde('gsErgebnis', 'gut',
      `<strong>${esc(g.code)}</strong> über ${geld(g.amount)} ausgestellt.<br>`
      + `Gültig bis ${datum(g.expiresAt)}.<br>`
      + `<em>Bitte den Betrag jetzt als Barzahlung kassieren – der Gutschein ist noch kein Umsatz, sondern eine Anzahlung.</em>`);
    druckeBon(g);
    gewaehlt = null; el('gsFreiBetrag').value = '';
    document.querySelectorAll('[data-gs-betrag]').forEach((x) => x.classList.remove('aktiv'));
  }

  function pruefen() {
    const code = el('gsCode').value.trim();
    const g = K.finde(code);
    if (!g) { melde('gsPruefErgebnis', 'warn', 'Kein Gutschein mit dieser Nummer gefunden.'); return; }
    const z = K.zustand(g);
    if (z === 'abgelaufen') { melde('gsPruefErgebnis', 'warn', `Dieser Gutschein war bis ${datum(g.expiresAt)} gültig.`); return; }
    if (z === 'eingeloest') { melde('gsPruefErgebnis', 'warn', 'Auf diesem Gutschein ist kein Guthaben mehr.'); return; }
    const offen = typeof global.total === 'function' ? +global.total().toFixed(2) : 0;
    const nutzbar = Math.min(g.balance, offen || g.balance);
    melde('gsPruefErgebnis', 'gut',
      `<strong>${esc(g.code)}</strong><br>Guthaben: <strong>${geld(g.balance)}</strong> · gültig bis ${datum(g.expiresAt)}<br>`
      + (offen > 0
        ? `Offener Bon: ${geld(offen)} \u2013 davon werden ${geld(nutzbar)} angerechnet.`
          + (offen > g.balance ? `<br><em>Rest von ${geld(offen - g.balance)} bitte bar kassieren.</em>` : '')
          + `<div class="kc-gs-aktion"><button type="button" id="gsBuchen" class="kc-gs-haupt">${geld(nutzbar)} einlösen und Bon abschließen</button></div>`
        : '<em>Zurzeit liegt kein Bon an. Bitte zuerst die Artikel erfassen.</em>'));
    el('gsBuchen')?.addEventListener('click', () => buchen(g));
  }

  // Einloesen bucht ueber denselben Weg wie der Personalverbrauch: Ware raus, kein Bargeld.
  // Damit landet der Umsatz genau einmal in den Zahlen - beim Einloesen, nicht beim Verkauf.
  async function buchen(g) {
    const offen = typeof global.total === 'function' ? +global.total().toFixed(2) : 0;
    if (offen <= 0) return;
    if (offen > g.balance) {
      melde('gsPruefErgebnis', 'warn',
        `Das Guthaben von ${geld(g.balance)} deckt den Bon über ${geld(offen)} nicht vollständig. `
        + 'Teilzahlung ist noch nicht eingebaut – bitte den Bon vorerst wie gewohnt abrechnen.');
      return;
    }
    try {
      const beleg = await global.completeSale('voucher', {silent: true});
      const ergebnis = K.einloesen(g.code, offen, {bon: beleg?.bon || ''});
      if (!ergebnis.ok) { melde('gsPruefErgebnis', 'warn', ergebnis.grund); return; }
      el('gutscheinDialog').close();
      global.showMessage?.('Mit Gutschein bezahlt', geld(ergebnis.genutzt),
        `${g.code} \u00b7 Restguthaben ${geld(ergebnis.rest)}`);
    } catch (fehler) {
      melde('gsPruefErgebnis', 'warn', `Buchung fehlgeschlagen: ${fehler.message}`);
    }
  }

  function zeichneListe() {
    const ziel = el('gsListe');
    if (!ziel) return;
    const suche = (el('gsSuche')?.value || '').trim().toUpperCase();
    const filter = el('gsFilter')?.value || 'alle';
    const alle = K.alle().slice().reverse();
    const liste = alle.filter((g) => (!suche || g.code.includes(suche))
      && (filter === 'alle' || K.zustand(g) === filter));
    ziel.innerHTML = liste.length ? liste.map((g) => {
      const z = K.zustand(g);
      return `<div class="kc-gs-zeile kc-gs-${z}">
        <span class="kc-gs-code">${esc(g.code)}</span>
        <span>${geld(g.amount)}</span>
        <span class="kc-gs-rest">${geld(g.balance)}</span>
        <span class="kc-gs-zustand">${K.ZUSTAND_TEXT[z]}</span>
        <span class="kc-gs-datum">bis ${datum(g.expiresAt)}${g.redemptions.length ? ` \u00b7 ${g.redemptions.length}\u00d7 eingelöst` : ''}</span>
      </div>`;
    }).join('') : '<p class="kc-gs-leer">Keine Gutscheine für diese Auswahl.</p>';
    el('gsSumme').textContent = `Offenes Guthaben insgesamt: ${geld(K.offeneVerpflichtung())}`;
  }

  function melde(id, art, html) {
    const feld = el(id);
    if (!feld) return;
    feld.hidden = false;
    feld.className = `kc-gs-ergebnis kc-gs-${art}`;
    feld.innerHTML = html;
  }

  function oeffne() {
    zeichneBetraege(); zeichneZiffern(); reiter('verkauf');
    el('gsErgebnis').hidden = true; el('gsPruefErgebnis').hidden = true;
    el('gsCode').value = ''; el('gsFreiBetrag').value = ''; gewaehlt = null;
    el('gutscheinDialog').showModal();
  }

  function verdrahten() {
    if (!el('gutscheinDialog')) return;
    document.querySelectorAll('[data-gs-reiter]').forEach((b) => b.onclick = () => reiter(b.dataset.gsReiter));
    el('gsAusstellen').onclick = ausstellen;
    el('gsPruefen').onclick = pruefen;
    el('gsSuche').oninput = zeichneListe;
    el('gsFilter').onchange = zeichneListe;
    document.querySelector('[data-gs-schliessen]').onclick = () => el('gutscheinDialog').close();
    document.querySelectorAll('.more-grid button[data-action="gutschein"]').forEach((b) =>
      b.addEventListener('click', () => { el('moreDialog')?.close(); setTimeout(oeffne, 120); }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
  global.KCGutscheinUI = {oeffne, zeichneListe};
})(window);
