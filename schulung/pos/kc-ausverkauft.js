// KC Sync – Ausverkauft-Funktion. Ein Artikel kann während des laufenden Betriebs als
// ausverkauft markiert werden - blockiert dann JEDEN Verkaufsweg (direkter Klick, Pakete mit
// diesem Artikel als Zutat, Happy Hour, Favoriten, Suche), weil all diese Wege über dieselbe
// zentrale Funktion (addConfiguredProduct) laufen, die hier einmalig "umschlossen" wird - kein
// einziger Verkaufsweg musste dafür einzeln geändert werden.
//
// Verteilung an andere Kassen: über denselben schnellen "sofort senden"-Kanal wie eine Buchung,
// nicht über den langsameren Stammdaten-Weg. Auf der EIGENEN Kasse wirkt es sofort, bei den
// ANDEREN Kassen dauert es bis zu ihrem nächsten regulären Kontakt (ca. 15 Sekunden) - bewusst
// so gewählt, keine dauerhafte Verbindung nötig.
(function (global) {
  'use strict';
  const SPEICHER_SCHLUESSEL = 'kc_ausverkauft_v1';
  const URL_MELDEN = (global.KCSyncConnection?.buildUrl('/kc-sync-sold-out-melden')) || 'http://127.0.0.1:47391/kc-sync-sold-out-melden';
  const URL_ABRUFEN = (global.KCSyncConnection?.buildUrl('/kc-sync-sold-out-status')) || 'http://127.0.0.1:47391/kc-sync-sold-out-status';

  let ausverkauftIds = new Set();
  try { ausverkauftIds = new Set(JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL) || '[]')); } catch (e) { /* leer starten */ }

  function istAusverkauft(p) {
    if (!p) return false;
    if (ausverkauftIds.has(p.id)) return true;
    // Pakete: ausverkauft, wenn IRGENDEINE Zutat ausverkauft ist - man kann das Paket sonst
    // nicht mehr vollständig zusammenstellen.
    if (Array.isArray(p.componentIds)) return p.componentIds.some((id) => ausverkauftIds.has(id));
    return false;
  }

  function speichern() {
    try { localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify([...ausverkauftIds])); } catch (e) { /* Speicher evtl. voll */ }
  }

  async function meldeAenderung(articleId, soldOut) {
    try {
      await fetch(URL_MELDEN, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, soldOut, registerId: global.KCSyncConnection?.config?.registerId || null }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) { /* Companion gerade nicht erreichbar (z.B. Kasse läuft komplett autark ohne Netzwerk) - lokal ist es trotzdem schon gesetzt, nächster Sync gleicht ab sobald wieder verbunden */ }
  }

  async function setzeStatus(articleId, soldOut) {
    if (soldOut) ausverkauftIds.add(articleId); else ausverkauftIds.delete(articleId);
    speichern();
    if (typeof global.renderProducts === 'function') global.renderProducts();
    await meldeAenderung(articleId, soldOut);
  }

  // Regelmäßig beim lokalen Companion nachfragen, was ANDERE Kassen inzwischen gemeldet haben.
  async function gleicheAb() {
    try {
      const antwort = await fetch(URL_ABRUFEN, { signal: AbortSignal.timeout(2000) });
      if (!antwort.ok) return;
      const daten = await antwort.json();
      const neueListe = new Set(daten.ausverkauft || []);
      const neuHinzugekommen = [...neueListe].filter((id) => !ausverkauftIds.has(id));
      const neuEntfernt = [...ausverkauftIds].filter((id) => !neueListe.has(id));
      const geaendert = neuHinzugekommen.length || neuEntfernt.length;
      ausverkauftIds = neueListe;
      speichern();
      if (geaendert && typeof global.renderProducts === 'function') global.renderProducts();
      // Meldung in der Statuszeile - eine ANDERE Kasse (oder der Manager) hat hier etwas
      // geändert, das soll aktiv auffallen, nicht nur still im roten Kreuz sichtbar sein.
      if (typeof global.notify === 'function' && typeof global.productsForSale === 'function') {
        const alleArtikel = global.productsForSale();
        neuHinzugekommen.forEach((id) => {
          const p = alleArtikel.find((x) => x.id === id);
          if (p) global.notify('warning', `🚫 ${p.name} wurde ausverkauft gemeldet.`, 'ausverkauft-empfangen');
        });
        neuEntfernt.forEach((id) => {
          const p = alleArtikel.find((x) => x.id === id);
          if (p) global.notify('info', `✅ ${p.name} ist wieder verfügbar.`, 'ausverkauft-empfangen');
        });
      }
    } catch (e) { /* Companion gerade nicht erreichbar - beim nächsten Versuch erneut */ }
  }
  setInterval(gleicheAb, 15000);
  if (document.readyState !== 'loading') gleicheAb(); else document.addEventListener('DOMContentLoaded', gleicheAb);

  // addConfiguredProduct einmalig "umschließen" - EIN Ort blockiert JEDEN Verkaufsweg.
  function verdrahteSperre() {
    if (typeof global.addConfiguredProduct !== 'function' || global.addConfiguredProduct.__kcAusverkauftUmschlossen) {
      if (!global.addConfiguredProduct) setTimeout(verdrahteSperre, 200);
      return;
    }
    const original = global.addConfiguredProduct;
    const gesperrt = function (p, option) {
      if (istAusverkauft(p)) {
        if (typeof global.notify === 'function') global.notify('error', `${p.name} ist ausverkauft.`, 'ausverkauft');
        return;
      }
      return original(p, option);
    };
    gesperrt.__kcAusverkauftUmschlossen = true;
    global.addConfiguredProduct = gesperrt;
  }
  verdrahteSperre();

  // Rotes Kreuz auf ausverkauften Kacheln - läuft NACH jedem renderProducts() (Kacheln werden
  // dort komplett neu gezeichnet), daher hier ebenfalls "umschlossen" statt einmalig eingefügt.
  function verdrahteAnzeige() {
    if (typeof global.renderProducts !== 'function' || global.renderProducts.__kcAusverkauftUmschlossen) {
      if (!global.renderProducts) setTimeout(verdrahteAnzeige, 200);
      return;
    }
    const original = global.renderProducts;
    const mitMarkierung = function (...args) {
      const ergebnis = original.apply(this, args);
      document.querySelectorAll('.product-tile[data-id]').forEach((tile) => {
        const p = (global.productsForSale ? global.productsForSale() : []).find((x) => x.id === tile.dataset.id);
        const wrap = tile.closest('.product-tile-wrap');
        if (!wrap) return;
        wrap.classList.toggle('kc-ausverkauft-markiert', istAusverkauft(p));
        let marker = wrap.querySelector('.kc-ausverkauft-kreuz');
        if (istAusverkauft(p)) {
          if (!marker) { marker = document.createElement('span'); marker.className = 'kc-ausverkauft-kreuz';
            marker.innerHTML = '<span class="kc-ausverkauft-text">AUSVERKAUFT</span>';
            marker.setAttribute('aria-label', 'ausverkauft'); wrap.appendChild(marker); }
        } else if (marker) marker.remove();
      });
      return ergebnis;
    };
    mitMarkierung.__kcAusverkauftUmschlossen = true;
    global.renderProducts = mitMarkierung;
    // Einmal sofort nachzeichnen: die erste Zeichnung der Kacheln lief bereits, bevor diese
    // Umschliessung ueberhaupt greifen konnte (dieses Modul wird VOR app.js geladen). Ohne
    // diesen Aufruf fehlt das rote Kreuz nach jedem Neuladen/Neustart der Kasse, obwohl der
    // Artikel gesperrt ist - er sieht dann normal aus und laesst sich trotzdem nicht buchen.
    try { mitMarkierung(); } catch (e) { /* Kacheln noch nicht da - naechste Zeichnung holt es nach */ }
  }
  verdrahteAnzeige();

  // openProductInfo umschließen, um uns selbst zu merken, welcher Artikel gerade im Info-
  // Fenster offen ist - global.currentInfoProduct funktioniert NICHT (app.js deklariert es mit
  // "let", das hängt nicht an window, anders als die mit "function" deklarierten Funktionen).
  let geoeffneterArtikel = null;
  function verdrahteInfoOeffnen() {
    if (typeof global.openProductInfo !== 'function' || global.openProductInfo.__kcAusverkauftUmschlossen) {
      if (!global.openProductInfo) setTimeout(verdrahteInfoOeffnen, 200);
      return;
    }
    const original = global.openProductInfo;
    const mitMerken = function (id) {
      geoeffneterArtikel = (global.productsForSale ? global.productsForSale() : []).find((x) => x.id === id) || null;
      const ergebnis = original(id);
      const btn = document.getElementById('productInfoAusverkauftBtn');
      if (btn && geoeffneterArtikel) {
        btn.textContent = ausverkauftIds.has(geoeffneterArtikel.id) ? '✅ Wieder verfügbar machen' : '🚫 Als ausverkauft markieren';
      }
      return ergebnis;
    };
    mitMerken.__kcAusverkauftUmschlossen = true;
    global.openProductInfo = mitMerken;
  }
  verdrahteInfoOeffnen();

  // ---------------------------------------------------------------------------------------
  // Sammel-Sperre: "Mettwurst ist aus" soll nicht heissen, dass man jedes Mettwurst-Gericht
  // einzeln in jeder Warengruppe suchen muss. Beim Markieren wird deshalb ein Fenster gezeigt,
  // das alle passenden Artikel schon angehakt auflistet - bestaetigen genuegt.
  //
  // Bewusst OHNE Zutaten-Stammdaten (Entscheidung des Betreibers): gesucht wird im Artikel-
  // NAMEN. Der Vorgabe-Suchbegriff ist immer der VOLLE Artikelname, damit "Gluehwein rot"
  // eben nur den roten trifft und nicht auch den weissen. Wer breiter sperren will, tippt
  // oben auf ein einzelnes Wort ("Mettwurst", "Kartoffeln") - dann erweitert sich die Liste.
  // Weil vor dem Bestaetigen sichtbar dasteht, was gesperrt wird, muss die Namenssuche nicht
  // perfekt sein: was nicht passt, wird abgehakt.
  // ---------------------------------------------------------------------------------------

  const STOPPWOERTER = new Set(['mit', 'und', 'ohne', 'der', 'die', 'das', 'ein', 'eine', 'vom', 'von', 'zum', 'aus', 'auf', 'fuer', 'für']);

  function verkaufsartikel() {
    // Pakete bleiben aussen vor: sie sperren sich automatisch ueber ihre Bestandteile.
    return (global.productsForSale ? global.productsForSale() : []).filter((p) => p && !Array.isArray(p.componentIds));
  }

  function suchWoerter(name) {
    const teile = String(name || '').split(/[^0-9A-Za-zÄÖÜäöüß]+/).filter(Boolean);
    const einzeln = [];
    teile.forEach((wort) => {
      if (wort.length < 4) return;
      if (STOPPWOERTER.has(wort.toLowerCase())) return;
      if (!einzeln.some((x) => x.toLowerCase() === wort.toLowerCase())) einzeln.push(wort);
    });
    // Voller Name zuerst (Vorgabe), danach die Einzelwoerter als breitere Alternativen.
    const voll = String(name || '').trim();
    return [voll, ...einzeln.filter((w) => w.toLowerCase() !== voll.toLowerCase())];
  }

  function treffer(begriff, nurBereitsGesperrte) {
    const b = String(begriff || '').trim().toLowerCase();
    if (!b) return [];
    return verkaufsartikel().filter((p) => {
      if (!String(p.name || '').toLowerCase().includes(b)) return false;
      return nurBereitsGesperrte ? ausverkauftIds.has(p.id) : !ausverkauftIds.has(p.id);
    });
  }

  async function setzeStatusMehrere(ids, soldOut) {
    ids.forEach((id) => { if (soldOut) ausverkauftIds.add(id); else ausverkauftIds.delete(id); });
    speichern();
    if (typeof global.renderProducts === 'function') global.renderProducts();
    // Jede Aenderung einzeln melden - die andere Kasse und der Manager sehen dadurch genau,
    // welcher Artikel betroffen ist (und nicht nur "irgendwas hat sich geaendert").
    for (const id of ids) await meldeAenderung(id, soldOut);
  }

  function sammelFensterAufbauen() {
    let dlg = document.getElementById('kcAusverkauftSammelDialog');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'kcAusverkauftSammelDialog';
    dlg.innerHTML = `
      <form method="dialog" class="dialog-card kc-sammel-karte">
        <h2 id="kcSammelTitel">Als ausverkauft markieren</h2>
        <p class="kc-sammel-hinweis" id="kcSammelHinweis"></p>
        <div class="kc-sammel-woerter" id="kcSammelWoerter"></div>
        <div class="kc-sammel-liste" id="kcSammelListe"></div>
        <p class="kc-sammel-zaehler" id="kcSammelZaehler"></p>
        <div class="dialog-actions">
          <button type="button" id="kcSammelAbbrechen">Abbrechen</button>
          <button type="button" id="kcSammelBestaetigen" class="primary">Bestätigen</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    return dlg;
  }

  function zeigeSammelFenster(artikel, freigeben) {
    const dlg = sammelFensterAufbauen();
    const woerter = suchWoerter(artikel.name);
    let gewaehltesWort = woerter[0];
    let angehakt = new Set();

    const titel = dlg.querySelector('#kcSammelTitel');
    const hinweis = dlg.querySelector('#kcSammelHinweis');
    const wortLeiste = dlg.querySelector('#kcSammelWoerter');
    const liste = dlg.querySelector('#kcSammelListe');
    const zaehler = dlg.querySelector('#kcSammelZaehler');
    const okBtn = dlg.querySelector('#kcSammelBestaetigen');

    titel.textContent = freigeben ? 'Wieder verfügbar machen' : 'Als ausverkauft markieren';
    hinweis.textContent = freigeben
      ? 'Diese Artikel werden wieder zum Verkauf freigegeben. Was nicht freigegeben werden soll, abhaken.'
      : 'Diese Artikel werden gesperrt und können danach nirgends mehr verkauft werden – auch nicht in Paketen, Favoriten oder zur Happy Hour. Was nicht gesperrt werden soll, abhaken.';

    function zeichneListe() {
      const gefunden = treffer(gewaehltesWort, freigeben);
      // Der ausloesende Artikel ist immer dabei, auch wenn die Namenssuche ihn nicht faende.
      if (!gefunden.some((p) => p.id === artikel.id)) gefunden.unshift(artikel);
      angehakt = new Set(gefunden.map((p) => p.id));
      liste.innerHTML = gefunden.map((p) => `
        <label class="kc-sammel-zeile">
          <input type="checkbox" data-artikel-id="${p.id}" checked>
          <span>${p.name}</span>
        </label>`).join('') || '<p class="kc-sammel-leer">Kein passender Artikel gefunden.</p>';
      liste.querySelectorAll('input[data-artikel-id]').forEach((box) => {
        box.addEventListener('change', () => {
          if (box.checked) angehakt.add(box.dataset.artikelId); else angehakt.delete(box.dataset.artikelId);
          aktualisiereZaehler();
        });
      });
      aktualisiereZaehler();
    }

    function aktualisiereZaehler() {
      const n = angehakt.size;
      zaehler.textContent = freigeben
        ? `${n} ${n === 1 ? 'Artikel wird' : 'Artikel werden'} wieder freigegeben.`
        : `${n} ${n === 1 ? 'Artikel wird' : 'Artikel werden'} gesperrt.`;
      okBtn.disabled = n === 0;
      okBtn.textContent = freigeben ? `Alle freigeben (${n})` : `Alle sperren (${n})`;
    }

    wortLeiste.innerHTML = '<span class="kc-sammel-frage">Wonach suchen?</span>' + woerter.map((wort, i) => `
      <button type="button" class="kc-sammel-wort${i === 0 ? ' aktiv' : ''}" data-wort="${wort.replace(/"/g, '&quot;')}">${wort}</button>`).join('');
    wortLeiste.querySelectorAll('.kc-sammel-wort').forEach((btn) => {
      btn.addEventListener('click', () => {
        gewaehltesWort = btn.dataset.wort;
        wortLeiste.querySelectorAll('.kc-sammel-wort').forEach((x) => x.classList.toggle('aktiv', x === btn));
        zeichneListe();
      });
    });

    zeichneListe();

    return new Promise((fertig) => {
      const abbrechen = () => { dlg.close(); fertig(null); };
      const bestaetigen = () => { const ids = [...angehakt]; dlg.close(); fertig(ids); };
      dlg.querySelector('#kcSammelAbbrechen').onclick = abbrechen;
      okBtn.onclick = bestaetigen;
      dlg.oncancel = abbrechen;
      dlg.showModal();
    });
  }
  global.KCAusverkauftSammel = { suchWoerter, treffer, zeigeSammelFenster, setzeStatusMehrere,
                                 istAusverkauft, aktuelleListe: () => [...ausverkauftIds] };

  // Schalter im Info-Fenster verdrahten.
  function verdrahteInfoSchalter() {
    const btn = document.getElementById('productInfoAusverkauftBtn');
    if (!btn) { setTimeout(verdrahteInfoSchalter, 300); return; }
    btn.addEventListener('click', async () => {
      const p = geoeffneterArtikel;
      if (!p) return;
      const bereitsAusverkauft = ausverkauftIds.has(p.id);
      document.getElementById('productInfoDialog')?.close();
      // Sammel-Fenster statt einfacher Rueckfrage: zeigt vor dem Bestaetigen genau, welche
      // Artikel betroffen sind, und laesst breiter suchen (z.B. alles mit "Mettwurst").
      const ids = await zeigeSammelFenster(p, bereitsAusverkauft);
      if (!ids || !ids.length) return;
      await setzeStatusMehrere(ids, !bereitsAusverkauft);
      if (typeof global.notify === 'function') {
        global.notify(bereitsAusverkauft ? 'info' : 'warning',
          bereitsAusverkauft
            ? `✅ ${ids.length} ${ids.length === 1 ? 'Artikel' : 'Artikel'} wieder freigegeben.`
            : `🚫 ${ids.length} ${ids.length === 1 ? 'Artikel' : 'Artikel'} als ausverkauft gesperrt.`,
          'ausverkauft-sammel');
      }
    });
  }
  verdrahteInfoSchalter();
})(window);
