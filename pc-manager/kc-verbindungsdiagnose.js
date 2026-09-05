// KC Verbindungsdiagnose – das Fenster hinter den LEDs.
//
// WARUM ES DAS GIBT
// Eine LED sagt "rot". Sie sagt nicht, WAS rot ist und was man dagegen tut. Am 01.09.2026 hat
// genau das einen Abend gekostet: der Manager meldete "nicht verbunden", während alles lief -
// und es gab keine Stelle, an der man nachsehen konnte, woran es hängt.
//
// Dieses Fenster misst und benennt. Grundsätze, die es von einer üblichen Diagnoseseite
// unterscheiden:
//   1. NICHTS WIRD BEHAUPTET, WAS NICHT GEMESSEN WURDE. Was hier nicht geprüft werden kann,
//      steht als "nicht messbar" da - nicht als Fehler und nicht als grün.
//   2. KEINE KRYPTISCHEN MELDUNGEN. Jede rote Zeile nennt in einem Satz, was los ist, und in
//      einem zweiten, was zu tun ist. "Failed to fetch" ist keine Auskunft.
//   3. FARBE TRÄGT NIE ALLEIN DIE BEDEUTUNG. Jeder Zustand hat ein Zeichen und ein Wort -
//      wichtig für die etwa 8 % der Männer mit einer Rot-Grün-Schwäche, und für den Ausdruck.
//
// ZUR DARSTELLUNG DER GESCHWINDIGKEIT
// Gewählt sind Balken-Instrumente, keine Rundskalen. Eine Antwortzeit ist ein Wert gegen eine
// Grenze; fünf Balken untereinander lassen sich auf einen Blick vergleichen ("die Datenbank ist
// deutlich langsamer als die Kasse"), fünf Rundskalen nicht - dort muss man jede einzeln lesen.
// Das Rundinstrument auf der Live-Monitor-Seite bleibt, es zeigt etwas anderes: Durchsatz.
(function (global) {
  'use strict';
  const DIENST_PORT = 47392;
  const DIENST = `http://127.0.0.1:${DIENST_PORT}`;

  // Zustandsfarben bewusst getrennt von den Reihenfarben der Auswertungen, damit ein Zustand
  // nie wie eine Datenreihe aussieht. Jede kommt mit Zeichen UND Wort.
  const ZUSTAND = {
    gut:     { farbe: '#0ca30c', zeichen: '✓', wort: 'in Ordnung' },
    warnung: { farbe: '#fab219', zeichen: '!', wort: 'langsam' },
    schlimm: { farbe: '#d03b3b', zeichen: '✕', wort: 'gestört' },
    unklar:  { farbe: '#667085', zeichen: '–', wort: 'nicht messbar' },
  };

  // Grenzen je Art der Verbindung. Ein Wert im eigenen Rechner darf nicht an derselben Latte
  // gemessen werden wie einer über das Internet.
  const GRENZEN = {
    lokal:    { gut: 50,  warnung: 250,  ende: 500,   einheit: 'ms' },
    wlan:     { gut: 150, warnung: 600,  ende: 1200,  einheit: 'ms' },
    internet: { gut: 400, warnung: 1500, ende: 3000,  einheit: 'ms' },
    speicher: { gut: 30,  warnung: 150,  ende: 300,   einheit: 'ms' },
  };

  function bewerte(ms, art) {
    const g = GRENZEN[art] || GRENZEN.lokal;
    if (ms === null || ms === undefined) return 'unklar';
    if (ms <= g.gut) return 'gut';
    if (ms <= g.warnung) return 'warnung';
    return 'schlimm';
  }

  // Ein Balken-Instrument: gefüllter Teil trägt den Zustand, die Bahn dahinter ist eine hellere
  // Stufe derselben Farbe, damit der Zustand über den ganzen Balken lesbar bleibt.
  function balken(ms, art) {
    const g = GRENZEN[art] || GRENZEN.lokal;
    const z = ZUSTAND[bewerte(ms, art)];
    const anteil = ms === null ? 0 : Math.max(3, Math.min(100, (ms / g.ende) * 100));
    return `
      <div class="kcdiag-messwert">
        <div class="kcdiag-bahn" role="img" aria-label="${ms === null ? 'nicht gemessen' : ms + ' Millisekunden von ' + g.ende}">
          <div class="kcdiag-fuellung" style="width:${anteil}%;background:${z.farbe}"></div>
          <div class="kcdiag-marke" style="left:${(g.gut / g.ende) * 100}%" title="bis hier: flott"></div>
          <div class="kcdiag-marke" style="left:${(g.warnung / g.ende) * 100}%" title="ab hier: zu langsam"></div>
        </div>
        <div class="kcdiag-zahl">${ms === null ? '– –' : ms + ' ms'}</div>
      </div>`;
  }

  // Eine Messung: Dauer in Millisekunden, oder ein Befund in Klartext.
  async function miss(name, fn) {
    const start = performance.now();
    try {
      const zusatz = await fn();
      return { ms: Math.round(performance.now() - start), zusatz: zusatz || null, fehler: null };
    } catch (e) {
      return { ms: null, zusatz: null, fehler: uebersetzeFehler(e) };
    }
  }

  // KEINE KRYPTISCHEN MELDUNGEN. Browser sagen "Failed to fetch" - damit kann am Marktmorgen
  // niemand etwas anfangen. Hier wird übersetzt, und zwar ehrlich: wo mehrere Ursachen infrage
  // kommen, werden sie genannt, statt eine zu erfinden.
  function uebersetzeFehler(e) {
    const roh = String(e && e.message ? e.message : e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(roh)) {
      return { text: 'Es kam keine Antwort.',
        tun: 'Das ist fast immer eines von zweien: das schwarze Fenster (KC_Markttag_Start) läuft nicht mehr, '
           + 'oder es wurde zwischendurch ein zweites gestartet. Alle schwarzen Fenster schließen, kurz warten, '
           + 'eines neu starten und abwarten, bis "ALLES BEREIT" dasteht.', roh };
    }
    if (/abgebrochen|abort|timeout|zeit/i.test(roh)) {
      return { text: 'Die Antwort hat zu lange gedauert und wurde abgebrochen.',
        tun: 'Meist ist der Rechner gerade stark beschäftigt. Noch einmal prüfen. Bleibt es dabei: '
           + 'andere Programme schließen und das WLAN-Signal am Stand ansehen.', roh };
    }
    if (/HTTP 4\d\d/.test(roh)) {
      return { text: 'Der Dienst hat die Anfrage abgelehnt (' + roh + ').',
        tun: 'Meist ist die Kopplung nicht mehr gültig. Im PC-Manager unter Kassen die Kopplung erneuern.', roh };
    }
    if (/HTTP 5\d\d/.test(roh)) {
      return { text: 'Der Dienst antwortet, meldet aber einen eigenen Fehler (' + roh + ').',
        tun: 'Die Meldungen im schwarzen Fenster ansehen - dort steht der Grund im Klartext.', roh };
    }
    return { text: 'Unerwartete Antwort.', tun: 'Die Meldungen im schwarzen Fenster ansehen.', roh };
  }

  // Der Kassendienst meldet seinen Zustand in Kurzworten ("rueckstau", "status_veraltet").
  // Die gehoeren nicht auf den Bildschirm - hier stehen ganze Saetze.
  function uebersetzeKassenzustand(v) {
    if (!v) return 'Der Kassendienst hat keinen Zustand gemeldet.';
    const anzahl = v.count || 0;
    switch (v.reason) {
      case 'online_synchronisiert':
        return 'Kassendienst: alles übertragen, nichts steht aus.';
      case 'noch_kein_sync_versuch':
        return 'Kassendienst: heute noch nichts übertragen — normal, solange nichts verkauft wurde.';
      case 'status_veraltet':
        return 'Kassendienst: die letzte erfolgreiche Übertragung ist länger her'
          + (v.ageMs ? ` (${Math.round(v.ageMs / 60000)} Minuten)` : '')
          + '. Am Marktstand ohne Internet ist das normal.';
      case 'rueckstau':
        return `Kassendienst: ${anzahl} Buchungen warten auf die Übertragung ins Internet. `
          + 'Die Verkäufe sind gespeichert — sie gehen raus, sobald wieder Internet da ist.';
      case 'dead_letter_ereignisse_vorhanden':
        return `Kassendienst: ${anzahl} Buchung(en) ließen sich mehrfach nicht übertragen. `
          + 'Nach dem Markttag im Manager unter Abschlüsse nachsehen — verloren ist nichts.';
      case 'offline':
        return 'Kassendienst: kein Internet. Kassieren, Bons und Abschlüsse laufen trotzdem.';
      default:
        return `Kassendienst meldet: ${v.reason || v.color || 'unbekannt'}.`;
    }
  }

  // ------------------------------------------------------------------ die einzelnen Prüfungen

  async function pruefeManagerDienst(kassenDatei) {
    const r = await miss('manager', async () => {
      const a = await fetch(`${DIENST}/kassen-verbindungen`, { cache: 'no-store' });
      if (!a.ok) throw new Error('HTTP ' + a.status);
      return await a.json();
    });
    // HAEUFIGE FALLE, die ohne diesen Satz stundenlang kostet: der Manager wurde vom Tablet oder
    // ueber die WLAN-Adresse geoeffnet. Der Live-Kanal lauscht aber nur auf dem PC selbst - dort
    // heisst "127.0.0.1" dann das Tablet, und es kann gar nichts kommen. Der Rechner laeuft
    // trotzdem einwandfrei; falsch ist nur, von wo aus man hinsieht.
    const wirt = (global.location && global.location.hostname) || '';
    const aufDemPc = wirt === '127.0.0.1' || wirt === 'localhost' || wirt === '';
    // Ein Browser kann "niemand da" nicht von "abgewiesen" unterscheiden - er sagt zu allem
    // "Failed to fetch". Das schwarze Fenster WEISS es und schreibt es beim Start mit. Wenn
    // dieser Befund vorliegt, wird er genommen: gemessen schlaegt geraten.
    const kanal = kassenDatei && kassenDatei.liveKanal;
    if (r.fehler && aufDemPc && kanal && kanal.laeuft === false) {
      r.fehler = { ...r.fehler,
        text: 'Der Live-Kanal ist beim Start des schwarzen Fensters gar nicht hochgekommen.'
            + (kanal.fehler ? '' : ' Ein Grund wurde nicht mitgeschrieben.'),
        tun: (/in_use|belegt/i.test(String(kanal.fehler || ''))
              ? 'Port 47392 war belegt - fast immer von einem noch laufenden älteren Fenster. '
                + 'Alle schwarzen Fenster schließen; hilft das nicht, im Task-Manager '
                + '(Strg+Umschalt+Esc) unter "Details" alle "node.exe" beenden. Dann EIN Fenster neu starten.'
              : 'Alle schwarzen Fenster schließen, kurz warten, EINES neu starten und abwarten, '
                + 'bis "ALLES BEREIT" dasteht. Kommt die Meldung "OHNE Live-Kanal", steht der Grund dort.'),
        roh: kanal.fehler || r.fehler.roh };
    } else if (r.fehler && !aufDemPc) {
      r.fehler = { ...r.fehler,
        text: `Der Live-Kanal ist von hier aus nicht erreichbar. Diese Seite wurde über „${wirt}" geöffnet.`,
        tun: 'Den PC-Manager auf dem PC selbst öffnen: http://127.0.0.1:8090/pc-manager/index.html — '
           + 'der Live-Kanal ist bewusst nur dort erreichbar. Am Tablet gehört die Kasse hin, nicht der Manager.' };
    }
    return {
      titel: 'Manager-Dienst',
      erklaerung: `Der Kanal, über den der Manager die Kassen sieht (Port ${DIENST_PORT} auf diesem Rechner).`,
      art: 'lokal', ...r,
      zusatzzeilen: [
        ...(r.zusatz ? [`${(r.zusatz.kassen || []).length} Kasse(n) gekoppelt`] : []),
        ...(kanal && kanal.gestartetUm
          ? [`Schwarzes Fenster zuletzt gestartet: ${new Date(kanal.gestartetUm).toLocaleString('de-DE')}`]
          : []),
      ],
    };
  }

  async function pruefeWebserver() {
    // Bewusst eine Datei, die neben dieser hier liegt und garantiert vorhanden ist - eine
    // Pruefung, die an einem fehlenden Manifest scheitert, misst den Webserver nicht, sondern
    // das Manifest.
    const r = await miss('web', async () => {
      const a = await fetch(`kc-live-monitor.css?t=${Date.now()}`, { cache: 'no-store' });
      if (!a.ok) throw new Error('HTTP ' + a.status);
      return null;
    });
    return {
      titel: 'Webserver dieses Rechners',
      erklaerung: `Liefert Kasse und Manager aus (${global.location ? global.location.host : ''}). `
        + 'Ist er langsam, ruckelt die Bedienung überall.',
      art: 'lokal', ...r,
    };
  }

  async function pruefeKasse(register, verbindung, adresse, dienstErreichbar) {
    // Die Kasse selbst lässt sich nur messen, wenn ihre Adresse bekannt ist. Ist sie es nicht,
    // wird das gesagt - nicht geraten und nicht als Fehler gezeigt.
    let messung = { ms: null, zusatz: null, fehler: null };
    if (adresse) {
      messung = await miss('kasse', async () => {
        // BEWUSST OHNE sessionId: der Kassendienst wertet eine fremde Sitzungs-ID als zweites
        // Geraet an derselben Kasse und warnt die Kasse. Eine Messung darf nie eine Warnung
        // ausloesen, die es ohne sie nicht gaebe.
        const a = await fetch(adresse, { cache: 'no-store' });
        if (!a.ok) throw new Error('HTTP ' + a.status);
        return await a.json();
      });
    }
    // WICHTIG: der Gesamtzustand dieser Zeile darf sich NICHT allein aus der Antwortzeit
    // ergeben. Eine Kasse, die in 5 ms antwortet, aber nicht gekoppelt ist, ist nicht
    // "in Ordnung" - genau diese Art Anzeige war der Ausgangsfehler.
    let ueberschrieben = null;
    const zeilen = [];
    if (messung.zusatz && messung.zusatz.connection) {
      zeilen.push(uebersetzeKassenzustand(messung.zusatz.connection));
      if (messung.zusatz.multiDeviceConflict) {
        zeilen.push('ACHTUNG: zwei Geräte arbeiten gerade auf dieser Kasse. Auf einem davon die Kasse schließen.');
      }
    }
    if (verbindung) {
      zeilen.push(verbindung.gekoppelt ? 'Mit dem Manager gekoppelt' : 'NICHT gekoppelt');
      if (!verbindung.gekoppelt) ueberschrieben = { schluessel: 'schlimm', wort: 'nicht gekoppelt' };
      if (verbindung.gekoppeltSeit) zeilen.push(`Gekoppelt seit ${new Date(verbindung.gekoppeltSeit).toLocaleString('de-DE')}`);
      zeilen.push(verbindung.zuletztGemeldetVorSek === null || verbindung.zuletztGemeldetVorSek === undefined
        ? 'Noch keine Meldung von dieser Kasse'
        : `Letzte Meldung vor ${verbindung.zuletztGemeldetVorSek} s`);
    } else if (dienstErreichbar === false) {
      ueberschrieben = { schluessel: 'unklar', wort: 'Kopplung unbekannt' };
      // WICHTIG: "steht nicht in der Liste" waere hier gelogen - es gibt gerade gar keine Liste.
      // Genau solche Saetze schicken einen am Marktmorgen an die falsche Stelle.
      zeilen.push('Kopplung unbekannt — der Manager-Dienst antwortet nicht, also gibt es gerade keine Kopplungsliste. Zuerst die Zeile "Manager-Dienst" oben klären.');
    } else {
      zeilen.push('Diese Kasse steht nicht in der Kopplungsliste des Managers');
      ueberschrieben = { schluessel: 'schlimm', wort: 'nicht gekoppelt' };
    }
    return {
      titel: register.name || register.id,
      erklaerung: adresse ? 'Antwortzeit des Kassen-Dienstes auf diesem Rechner.'
        : 'Adresse der Kasse hier nicht bekannt - gemessen wird nur die Kopplung.',
      art: 'lokal', ...messung, zusatzzeilen: zeilen,
      nichtMessbar: !adresse,
      ueberschrieben,
    };
  }

  async function pruefeZentraleDatenbank() {
    const url = global.KC_SUPABASE_URL || 'https://ptblnpiroqftcvlsrhac.supabase.co';
    const key = global.KC_SUPABASE_ANON_KEY || 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
    const r = await miss('db', async () => {
      const a = await fetch(`${url}/rest/v1/?t=${Date.now()}`, { headers: { apikey: key }, cache: 'no-store' });
      if (!a.ok && a.status >= 500) throw new Error('HTTP ' + a.status);
      return null;
    });
    // Die pauschale "schwarzes Fenster"-Empfehlung waere hier schlicht falsch: mit dem Fenster
    // hat die Internet-Datenbank nichts zu tun. Am Marktstand ist sie ohnehin entbehrlich.
    if (r.fehler) {
      r.fehler = { ...r.fehler,
        text: 'Die zentrale Datenbank ist gerade nicht erreichbar.',
        tun: 'Am Marktstand ist das kein Problem und meist sogar der Normalfall — Kassieren, Bons '
           + 'und Abschlüsse brauchen kein Internet. Die Buchungen werden gespeichert und gehen '
           + 'später von selbst raus. Nur wenn Sie am Bürorechner sitzen und trotzdem nichts geht: '
           + 'Internetverbindung dieses Rechners prüfen.' };
    }
    return {
      titel: 'Zentrale Datenbank',
      erklaerung: 'Der gemeinsame Datenbestand im Internet. Am Marktstand ist sie NICHT nötig - '
        + 'Kassieren, Bons und Abschlüsse laufen ohne sie.',
      art: 'internet', ...r,
      harmlosWennWeg: true,
    };
  }

  async function pruefeOertlicherSpeicher() {
    const r = await miss('speicher', async () => {
      const probe = 'x'.repeat(50000);
      const schluessel = '__kc_diag_probe';
      localStorage.setItem(schluessel, probe);
      const zurueck = localStorage.getItem(schluessel);
      localStorage.removeItem(schluessel);
      if (zurueck !== probe) throw new Error('Zurückgelesen kam etwas anderes an');
      return null;
    });
    return {
      titel: 'Speicher dieses Browsers',
      erklaerung: 'Hier liegen Artikel, Einstellungen und die Vorführdaten des Managers.',
      art: 'speicher', ...r,
    };
  }

  // ------------------------------------------------------------------ Fenster

  // Die Kassenliste des Managers. window.registers ist der uebliche Weg; wird der Manager
  // einmal ohne app.js geoeffnet (oder aendert sich dort etwas), wird dieselbe Liste aus dem
  // Speicher gelesen, statt hier eine zweite, eigene Geraeteliste zu erfinden.
  function leseKassen() {
    if (Array.isArray(global.registers) && global.registers.length) return global.registers;
    try {
      const roh = JSON.parse(localStorage.getItem('kcm_registers') || 'null');
      if (Array.isArray(roh)) return roh;
    } catch (e) { /* unbrauchbarer Eintrag - dann eben ohne Kassenzeilen */ }
    return [];
  }

  let letzterBericht = [];

  async function pruefeAlles(nurZeile) {
    const bereich = document.getElementById('kcdiagListe');
    if (!bereich) return;
    if (!nurZeile) bereich.innerHTML = '<div class="kcdiag-laeuft">Wird gemessen …</div>';

    // Kopplungsliste einmal holen - sie speist die Kassenzeilen.
    let kopplung = null;
    try {
      const a = await fetch(`${DIENST}/kassen-verbindungen`, { cache: 'no-store' });
      if (a.ok) kopplung = await a.json();
    } catch (e) { /* die Manager-Zeile meldet es gleich selbst */ }
    const nachName = new Map(((kopplung && kopplung.kassen) || []).map((k) => [String(k.kasse).toLowerCase(), k]));

    // Adressen der Kassen, falls der Markttag-Start sie hinterlegt hat. Aufbau der Datei:
    // { erzeugtAm, webserverPort, lanAdresse, kassen:[{id, name, port, token}] }
    // Ports und Schluessel wechseln bei JEDEM Start - deshalb wird die Datei bei jeder Messung
    // frisch gelesen und nichts davon gemerkt.
    let kassenDatei = null;
    try {
      const a = await fetch(`kassen-verbindungen.json?t=${Date.now()}`, { cache: 'no-store' });
      if (a.ok) kassenDatei = await a.json();
    } catch (e) { /* ohne Adressen wird nur die Kopplung geprüft */ }
    const adressen = new Map(((kassenDatei && kassenDatei.kassen) || []).map((k) => [String(k.id), k]));

    const zeilen = [];
    zeilen.push(await pruefeManagerDienst(kassenDatei));
    zeilen.push(await pruefeWebserver());
    for (const r of leseKassen().filter((x) => x.active !== false)) {
      const eintrag = adressen.get(String(r.id));
      let statusAdresse = null;
      if (eintrag && eintrag.port) {
        // Derselbe Rechnername, ueber den auch diese Seite geladen wurde. Der Kassendienst
        // lauscht auf allen Adressen; "127.0.0.1" fest einzutragen waere falsch, sobald der
        // Manager vom Tablet aus geoeffnet wird - dort ist 127.0.0.1 das Tablet selbst.
        const host = (global.location && global.location.hostname) || '127.0.0.1';
        statusAdresse = `http://${host}:${eintrag.port}/kc-sync-status`
          + (eintrag.token ? `?token=${encodeURIComponent(eintrag.token)}` : '');
      }
      zeilen.push(await pruefeKasse(r, nachName.get(String(r.id).toLowerCase()), statusAdresse, kopplung !== null));
    }
    zeilen.push(await pruefeOertlicherSpeicher());
    zeilen.push(await pruefeZentraleDatenbank());

    letzterBericht = zeilen;
    zeichne(zeilen);
  }

  function zeichne(zeilen) {
    const bereich = document.getElementById('kcdiagListe');
    if (!bereich) return;
    bereich.innerHTML = zeilen.map((z) => {
      let schluessel = z.fehler ? 'schlimm' : (z.nichtMessbar ? 'unklar' : bewerte(z.ms, z.art));
      if (z.fehler && z.harmlosWennWeg) schluessel = 'warnung';
      let wort = z.fehler ? (z.harmlosWennWeg ? 'nicht erreichbar' : 'gestört')
        : (z.nichtMessbar ? 'nicht messbar' : ZUSTAND[schluessel].wort);
      // Eine Kopplungsauskunft schlaegt die reine Antwortzeit - siehe pruefeKasse.
      if (z.ueberschrieben && !z.fehler) { schluessel = z.ueberschrieben.schluessel; wort = z.ueberschrieben.wort; }
      const zu = ZUSTAND[schluessel];
      return `
        <div class="kcdiag-zeile">
          <div class="kcdiag-kopf">
            <span class="kcdiag-zeichen" style="background:${zu.farbe}" aria-hidden="true">${zu.zeichen}</span>
            <b>${escape(z.titel)}</b>
            <span class="kcdiag-wort" style="color:${zu.farbe}">${wort}</span>
          </div>
          <div class="kcdiag-erklaerung">${escape(z.erklaerung)}</div>
          ${z.nichtMessbar ? '' : balken(z.ms, z.art)}
          ${(z.zusatzzeilen || []).map((t) => `<div class="kcdiag-zusatz">${escape(t)}</div>`).join('')}
          ${z.fehler ? `<div class="kcdiag-fehler"><div>${escape(z.fehler.text)}</div>
             <div class="kcdiag-tun">→ ${escape(z.fehler.tun)}</div>
             <details><summary>Wortlaut für die Fehlersuche</summary><code>${escape(z.fehler.roh)}</code></details></div>` : ''}
        </div>`;
    }).join('');
  }

  function escape(s) { return String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

  function berichtAlsText() {
    const kopf = [`KC MarktKasse - Verbindungsbericht`, new Date().toLocaleString('de-DE'), ''];
    const zeilen = letzterBericht.map((z) => {
      const teile = [`${z.titel}: ${z.fehler ? 'GESTOERT' : (z.nichtMessbar ? 'nicht messbar' : (z.ms + ' ms'))}`];
      (z.zusatzzeilen || []).forEach((t) => teile.push('  ' + t));
      if (z.fehler) { teile.push('  ' + z.fehler.text); teile.push('  -> ' + z.fehler.tun); teile.push('  (' + z.fehler.roh + ')'); }
      return teile.join('\n');
    });
    return kopf.concat(zeilen).join('\n');
  }

  function baueFenster() {
    if (document.getElementById('kcdiagDialog')) return;
    const stil = document.createElement('style');
    stil.textContent = `
      #kcdiagDialog{border:none;border-radius:14px;padding:0;max-width:820px;width:92vw;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      #kcdiagDialog::backdrop{background:rgba(8,15,26,.55)}
      .kcdiag-rahmen{font-family:"Segoe UI",Arial,sans-serif;color:#172033;background:#fff}
      .kcdiag-titel{padding:18px 22px 12px;border-bottom:1px solid #e3e8ee}
      .kcdiag-titel h2{margin:0 0 4px;font-size:1.25rem}
      .kcdiag-titel p{margin:0;color:#5b6572;font-size:.88rem;line-height:1.45}
      .kcdiag-knopfleiste{display:flex;gap:10px;flex-wrap:wrap;padding:14px 22px;background:#f6f8fa;border-bottom:1px solid #e3e8ee}
      .kcdiag-knopfleiste button{padding:10px 16px;border-radius:8px;border:1px solid #c9d2dc;background:#fff;font-weight:700;font-size:.9rem}
      .kcdiag-knopfleiste button.haupt{background:#166534;color:#fff;border-color:#166534}
      #kcdiagListe{padding:6px 22px 18px;max-height:56vh;overflow:auto}
      .kcdiag-laeuft{padding:24px 0;color:#5b6572}
      .kcdiag-zeile{padding:14px 0;border-bottom:1px solid #eef2f6}
      .kcdiag-zeile:last-child{border-bottom:none}
      .kcdiag-kopf{display:flex;align-items:center;gap:9px;margin-bottom:3px}
      .kcdiag-zeichen{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;color:#fff;font-weight:900;font-size:.8rem;flex:none}
      .kcdiag-wort{margin-left:auto;font-weight:800;font-size:.84rem}
      .kcdiag-erklaerung{color:#5b6572;font-size:.85rem;line-height:1.45;margin-bottom:8px}
      .kcdiag-messwert{display:flex;align-items:center;gap:10px}
      .kcdiag-bahn{position:relative;flex:1;height:12px;border-radius:6px;background:#eef2f6;overflow:hidden}
      .kcdiag-fuellung{height:100%;border-radius:6px 0 0 6px}
      .kcdiag-marke{position:absolute;top:0;bottom:0;width:1px;background:rgba(23,32,51,.22)}
      .kcdiag-zahl{min-width:66px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;font-size:.86rem}
      .kcdiag-zusatz{color:#5b6572;font-size:.82rem;margin-top:5px}
      .kcdiag-fehler{margin-top:9px;padding:10px 12px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;font-size:.86rem;line-height:1.5}
      .kcdiag-tun{margin-top:5px;font-weight:700;color:#7c2d12}
      .kcdiag-fehler details{margin-top:6px}
      .kcdiag-fehler summary{cursor:pointer;color:#7c2d12;font-size:.8rem}
      .kcdiag-fehler code{display:block;margin-top:4px;font-size:.78rem;color:#5b6572;word-break:break-all}
      .kcdiag-fuss{padding:12px 22px;border-top:1px solid #e3e8ee;display:flex;gap:10px;align-items:center}
      .kcdiag-fuss small{color:#5b6572}
      .kcdiag-fuss button{margin-left:auto;padding:10px 20px;border-radius:8px;border:none;background:#166534;color:#fff;font-weight:800}
    `;
    document.head.appendChild(stil);

    const d = document.createElement('dialog');
    d.id = 'kcdiagDialog';
    d.innerHTML = `
      <div class="kcdiag-rahmen">
        <div class="kcdiag-titel">
          <h2>Verbindungen prüfen</h2>
          <p>Gemessen, nicht geraten. Was hier nicht geprüft werden kann, steht als „nicht messbar" da —
             und nicht als Fehler. Jede Störung sagt, was zu tun ist.</p>
        </div>
        <div class="kcdiag-knopfleiste">
          <button type="button" id="kcdiagAlles" class="haupt">Alles neu messen</button>
          <button type="button" id="kcdiagBericht">Bericht kopieren</button>
          <button type="button" id="kcdiagDauer">Alle 10 Sekunden wiederholen</button>
        </div>
        <div id="kcdiagListe"></div>
        <div class="kcdiag-fuss">
          <small>Grün heißt: gemessen und schnell. Die Striche im Balken sind die Grenzen „flott" und „zu langsam".</small>
          <button type="button" id="kcdiagZu">Schließen</button>
        </div>
      </div>`;
    document.body.appendChild(d);

    let takt = null;
    d.querySelector('#kcdiagAlles').onclick = () => pruefeAlles();
    d.querySelector('#kcdiagZu').onclick = () => { if (takt) { clearInterval(takt); takt = null; } d.close(); };
    d.querySelector('#kcdiagDauer').onclick = (e) => {
      if (takt) { clearInterval(takt); takt = null; e.target.textContent = 'Alle 10 Sekunden wiederholen'; return; }
      takt = setInterval(() => pruefeAlles(), 10000);
      e.target.textContent = 'Wiederholung anhalten';
    };
    d.querySelector('#kcdiagBericht').onclick = async (e) => {
      const text = berichtAlsText();
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Bericht kopiert ✓'; }
      catch (err) {
        // Ohne Zwischenablage-Recht: den Bericht sichtbar machen, statt nur zu scheitern.
        const feld = document.createElement('textarea');
        feld.value = text; feld.style.cssText = 'width:100%;height:180px;margin-top:10px;font-family:monospace;font-size:.78rem';
        document.getElementById('kcdiagListe').prepend(feld); feld.select();
        e.target.textContent = 'Bericht steht oben - von Hand kopieren';
      }
      setTimeout(() => { e.target.textContent = 'Bericht kopieren'; }, 4000);
    };
  }

  function oeffne() {
    baueFenster();
    const d = document.getElementById('kcdiagDialog');
    if (!d) return;
    if (!d.open) d.showModal();
    pruefeAlles();
  }
  global.KCVerbindungsdiagnose = { oeffne, pruefeAlles, berichtAlsText, _bewerte: bewerte, _uebersetzeFehler: uebersetzeFehler };

  // Die LEDs in der Kopfzeile sind der natürliche Weg hierher: wer eine rote LED sieht, tippt
  // darauf. Der Live-Monitor bekommt zusätzlich einen ausdrücklichen Knopf.
  function haengeAnLeds() {
    document.querySelectorAll('.kc-live-led-group').forEach((g) => {
      if (g.dataset.kcdiag) return;
      g.dataset.kcdiag = '1';
      g.style.cursor = 'pointer';
      g.title = (g.title ? g.title + ' · ' : '') + 'Klicken für Einzelheiten und Prüfungen';
      g.addEventListener('click', (e) => { e.stopPropagation(); oeffne(); }, true);
    });
    const kopf = document.getElementById('kcLiveLedGroups');
    if (kopf && !document.getElementById('kcdiagOeffnen')) {
      const b = document.createElement('button');
      b.id = 'kcdiagOeffnen'; b.type = 'button'; b.textContent = 'Verbindungen prüfen';
      b.style.cssText = 'margin-left:10px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.25);'
        + 'background:rgba(255,255,255,.10);color:#fff;font-weight:700;font-size:.8rem;cursor:pointer';
      b.onclick = oeffne;
      kopf.appendChild(b);
    }
  }
  setInterval(haengeAnLeds, 2500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', haengeAnLeds);
  else haengeAnLeds();
})(window);
