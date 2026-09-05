/* KC Kassenbaukasten, Teil 3: Bauteile zu Baugruppen zusammenfassen.  02.09.2026
 *
 * ANLASS (Betreiber): "Bauteile müssen sich zu Baugruppen zusammenfassen lassen, also
 * gruppieren."
 *
 * WAS DAS HEISST
 * Zwei Dinge gehören dazu, und nur zusammen ergeben sie einen Sinn:
 *   1. Mehrere Bauteile zu einer Einheit binden, die sich gemeinsam schiebt - und wieder lösen.
 *   2. So eine Einheit unter eigenem Namen in die Bibliothek legen, damit man sie beim
 *      nächsten Aufbau wieder herausziehen kann, statt sie noch einmal zu bauen. Genau dafür
 *      gibt es die mitgelieferten Baugruppen; eigene sollen daneben stehen.
 *
 * WIE GESPEICHERT WIRD
 * Eine eigene Baugruppe merkt sich RASTERVERSÄTZE, keine Pixel: "dieses Teil sitzt zwei
 * Spalten rechts und eine Zeile unter der Ecke der Baugruppe". Nur so lässt sie sich auf dem
 * großen und dem kleinen iPad gleichermaßen einsetzen. Dieselbe Entscheidung wie in Teil 1,
 * und aus demselben Grund.
 */
'use strict';
(function () {
  const VERSION = '0.3.0';
  const LAGER = 'kc.kassenbaukasten.baugruppen.v1';

  /* Merkmale, die ein Teil beim Speichern mitnimmt. Alles, was man am Einzelteil einstellen
     kann - sonst käme die eigene Baugruppe grau und unbeschriftet zurück. */
  const MERKMALE = ['text', 'bg', 'fill', 'color', 'stroke', 'strokeWidth', 'radius',
    'kcSymbol', 'klappbar', 'drehen', 'zoom'];

  const lesen = () => {
    try { return JSON.parse(localStorage.getItem(LAGER) || '[]'); } catch (e) { return []; }
  };
  const schreiben = (a) => {
    try { localStorage.setItem(LAGER, JSON.stringify(a)); return true; } catch (e) { return false; }
  };

  function bereit() {
    return window.KCKassenbaukasten && window.KCKassenteile
      && typeof MODE_TOOLS === 'object' && typeof renderModeTools === 'function'
      && document.getElementById('kcKontextMenue');
  }

  /* --------------------------------------------------------------- Auswahl und Gruppe */
  function auswahl() {
    const ids = new Set();
    if (typeof selectedIds !== 'undefined') selectedIds.forEach((x) => ids.add(x));
    if (selected) ids.add(selected);
    return (currentItems() || []).filter((i) => ids.has(i.id));
  }

  /* Die Teile, die zu einem Bauteil gehören: entweder seine Gruppe, oder die Auswahl. */
  function verbund(item) {
    if (!item) return [];
    if (item.groupId) return (currentItems() || []).filter((i) => i.groupId === item.groupId);
    const a = auswahl();
    return a.length ? a : [item];
  }

  function gruppieren() {
    const teile = auswahl();
    if (teile.length < 2) {
      melden('Zum Gruppieren mindestens zwei Bauteile auswählen – mit gedrückter Umschalt-Taste anklicken.');
      return false;
    }
    const gid = (typeof uid === 'function') ? uid('grp') : 'grp' + Date.now();
    teile.forEach((i) => { i.groupId = gid; });
    render();
    melden(`${teile.length} Bauteile zu einer Baugruppe zusammengefasst – sie schieben sich jetzt gemeinsam.`);
    return true;
  }

  function loesen() {
    const i = (currentItems() || []).find((x) => x.id === selected);
    const gids = new Set(auswahl().concat(i ? [i] : []).map((x) => x.groupId).filter(Boolean));
    if (!gids.size) { melden('Dieses Bauteil gehört zu keiner Baugruppe.'); return false; }
    let n = 0;
    (currentItems() || []).forEach((x) => { if (gids.has(x.groupId)) { delete x.groupId; n++; } });
    render();
    melden(`Baugruppe gelöst – ${n} Bauteile stehen wieder einzeln.`);
    return true;
  }

  /* ------------------------------------------------------- Eigene Baugruppe speichern */
  function alsBaugruppeSpeichern(name) {
    const i = (currentItems() || []).find((x) => x.id === selected);
    const teile = verbund(i);
    if (teile.length < 2) { melden('Erst mehrere Bauteile auswählen oder gruppieren.'); return null; }
    if (!teile.every((t) => t.kc)) { melden('Nur Bauteile mit Rasterplatz lassen sich als Baugruppe sichern.'); return null; }

    /* Die linke obere Ecke der Baugruppe ist der Bezugspunkt; alles andere wird relativ
       dazu abgelegt. Damit ist die Baugruppe überall auf der Fläche einsetzbar. */
    const sp0 = Math.min(...teile.map((t) => t.kc.spalte));
    const z0 = Math.min(...teile.map((t) => t.kc.zeile));
    const eintrag = {
      id: 'eg-' + Date.now().toString(36),
      name: String(name || '').trim() || 'Eigene Baugruppe',
      seite: currentSlide?.()?.kcSeite || 'kasse',
      felder: [
        Math.max(...teile.map((t) => t.kc.spalte + t.kc.spalten)) - sp0,
        Math.max(...teile.map((t) => t.kc.zeile + t.kc.zeilen)) - z0,
      ],
      teile: teile.map((t) => {
        const teil = { typ: t.type, sv: t.kc.spalte - sp0, zv: t.kc.zeile - z0,
          spalten: t.kc.spalten, zeilen: t.kc.zeilen };
        MERKMALE.forEach((m) => { if (t[m] !== undefined && t[m] !== null) teil[m] = t[m]; });
        return teil;
      }),
    };
    const alle = lesen();
    alle.push(eintrag);
    if (!schreiben(alle)) { melden('Die eigene Baugruppe konnte nicht gesichert werden.'); return null; }
    eigeneEintragen();
    melden(`Baugruppe „${eintrag.name}“ liegt jetzt in der Bibliothek – ${eintrag.teile.length} Bauteile.`);
    return eintrag;
  }

  function baugruppeLoeschen(id) {
    const alle = lesen().filter((b) => b.id !== id);
    schreiben(alle);
    window.KCKassenbaukasten.baugruppeVergessen(id);
    eigeneEintragen();
  }

  /* ------------------------------------------------------ In die Bibliothek einhängen */
  function eigeneEintragen() {
    const K = window.KCKassenbaukasten;
    const alle = lesen();
    alle.forEach((b) => K.baugruppeRegistrieren(b.id, {
      beschriftung: `✎ ${b.name}`, seite: b.seite, felder: b.felder,
      hinweis: `Eigene Baugruppe · ${b.teile.length} Bauteile`, eigen: true, teile: b.teile,
    }));

    const liste = MODE_TOOLS.kasse || [];
    const stelle = liste.findIndex(([t]) => /Baugruppen/.test(t));
    const eigene = alle.map((b) => [b.id, `✎ ${b.name}`]);
    const titel = `Eigene Baugruppen (${eigene.length})`;
    const vorhanden = liste.findIndex(([t]) => /^Eigene Baugruppen/.test(t));
    if (!eigene.length) {
      if (vorhanden >= 0) liste.splice(vorhanden, 1);
    } else if (vorhanden >= 0) {
      liste[vorhanden] = [titel, eigene];
    } else {
      liste.splice(stelle + 1, 0, [titel, eigene]);
    }
    if ((project.mode || '') === 'kasse') {
      renderModeTools();
      window.KCKassenbaukasten.bibliothekFiltern();
      verwaltungAnbauen();
    }
  }

  /* Eine eigene Baugruppe einsetzen. Die mitgelieferten macht Teil 1; eigene tragen
     zusätzlich das Aussehen ihrer Teile mit sich, deshalb hier ein eigener Weg. */
  /* WICHTIG: erst in starte() umschließen, nicht beim Laden der Datei.
     Teil 1 und Teil 2 umschließen addItem ebenfalls, aber verzögert aus ihrem eigenen
     starte(). Wer beim Laden umschließt, landet damit INNEN - und Teil 1 fängt die eigene
     Baugruppe vorher ab und stolpert über ihr Format ("object is not iterable"). Genau das ist
     beim ersten Lauf passiert. Innen und außen entscheidet hier der Zeitpunkt, nicht die
     Reihenfolge im HTML. */
  let echtesAddItem = null;
  function addItemUmschliessen() {
    if (echtesAddItem) return;
    echtesAddItem = addItem;
    addItem = eigeneEinsetzen;
  }
  function eigeneEinsetzen(typ, x = 40, y = 40) {
    const b = lesen().find((e) => e.id === typ);
    if (!b) return echtesAddItem.apply(this, arguments);
    const K = window.KCKassenbaukasten;
    const r = K.raster();
    const bw = project.page.width / r.spalten, bh = project.page.height / r.zeilen;
    const spalte = Math.max(0, Math.min(r.spalten - b.felder[0], Math.round(x / bw)));
    const zeile = Math.max(0, Math.min(r.zeilen - b.felder[1], Math.round(y / bh)));
    const gid = (typeof uid === 'function') ? uid('grp') : 'grp' + Date.now();
    const gesetzt = [];
    b.teile.forEach((t) => {
      const item = K.einsetzen(t.typ, spalte + t.sv, zeile + t.zv, [t.spalten, t.zeilen]);
      if (!item) return;
      MERKMALE.forEach((m) => { if (t[m] !== undefined) item[m] = t[m]; });
      item.groupId = gid;
      item.kcBaugruppe = b.id;
      gesetzt.push(item);
    });
    render();
    melden(`Eigene Baugruppe „${b.name}“ eingefügt – ${gesetzt.length} Bauteile.`);
    return gesetzt[0] || null;
  }

  /* ------------------------------------------------------------ Verwaltung der eigenen */
  function verwaltungAnbauen() {
    const gruppe = [...document.querySelectorAll('#toolbox .toolGroup')]
      .find((g) => /^Eigene Baugruppen/.test(g.querySelector('h3')?.textContent || ''));
    if (!gruppe || gruppe.querySelector('.kc-eigene-verwalten')) return;
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'kc-eigene-verwalten';
    knopf.textContent = 'Eigene Baugruppen verwalten';
    knopf.onclick = () => verwaltungZeigen();
    gruppe.appendChild(knopf);
  }

  function verwaltungZeigen() {
    let kasten = document.getElementById('kcEigeneVerwaltung');
    if (!kasten) {
      kasten = document.createElement('div');
      kasten.id = 'kcEigeneVerwaltung';
      kasten.className = 'kc-eigene-fenster';
      document.body.appendChild(kasten);
    }
    const alle = lesen();
    kasten.innerHTML = `
      <div class="kc-eigene-kopf">Eigene Baugruppen<button data-kc-zu="1">Schließen</button></div>
      ${alle.length ? alle.map((b) => `
        <div class="kc-eigene-zeile">
          <span><b>${b.name}</b><small>${b.teile.length} Bauteile · ${b.felder[0]} × ${b.felder[1]} Felder · Seite „${b.seite}“</small></span>
          <button data-kc-weg="${b.id}">Löschen</button>
        </div>`).join('')
        : '<div class="kc-eigene-zeile"><span>Noch keine eigene Baugruppe gesichert.</span></div>'}`;
    kasten.hidden = false;
    kasten.onclick = (e) => {
      if (e.target.dataset.kcZu) { kasten.hidden = true; return; }
      const weg = e.target.dataset.kcWeg;
      if (!weg) return;
      baugruppeLoeschen(weg);
      verwaltungZeigen();
    };
  }

  /* --------------------------------------------------- Die Einträge im Rechtsklick-Menü */
  function menueErweitern() {
    const menue = document.getElementById('kcKontextMenue');
    if (!menue || menue.dataset.kcGruppen) return;
    menue.dataset.kcGruppen = '1';

    /* Teil 2 baut den Inhalt des Menüs bei jedem Öffnen neu. Deshalb wird hier nicht einmalig
       etwas angehängt, sondern nach jedem Aufbau ergänzt - beobachtet mit einem
       MutationObserver. Ein zweiter Weg wäre, Teil 2 umzuschreiben; das wollte ich zwei Tage
       vor der Vorführung nicht. */
    const beobachter = new MutationObserver(() => { if (!menue.hidden) block(); });
    beobachter.observe(menue, { childList: true });
    block();
  }

  function block() {
    const menue = document.getElementById('kcKontextMenue');
    if (!menue || menue.querySelector('.kc-kontext-gruppe')) return;
    const aktionen = menue.querySelector('.kc-kontext-aktionen');
    if (!aktionen) return;
    const i = (currentItems() || []).find((x) => x.id === selected);
    const n = auswahl().length;
    const inGruppe = Boolean(i?.groupId);
    const div = document.createElement('div');
    div.className = 'kc-kontext-block kc-kontext-gruppe';
    div.innerHTML = `
      <b>Baugruppe</b>
      <div class="kc-kontext-pfeile">
        <button data-kc-gruppe="binden"${n < 2 ? ' disabled title="Mit Umschalt-Taste mehrere Bauteile anklicken"' : ''}>Gruppieren${n >= 2 ? ` (${n})` : ''}</button>
        <button data-kc-gruppe="loesen"${inGruppe ? '' : ' disabled title="Gehört zu keiner Baugruppe"'}>Gruppe lösen</button>
      </div>
      <div class="kc-eigene-sichern">
        <input type="text" data-kc-gruppe-name placeholder="Name der eigenen Baugruppe">
        <button data-kc-gruppe="sichern">In die Bibliothek</button>
      </div>`;
    aktionen.parentElement.insertBefore(div, aktionen);
    /* Das Menü ist durch diesen Block höher geworden - noch einmal ins Bild rücken, sonst
       hängen Gruppieren und Löschen unten heraus. */
    const b = menue.getBoundingClientRect();
    if (b.bottom > innerHeight - 8) menue.style.top = `${Math.max(8, innerHeight - b.height - 12)}px`;
    div.onclick = (e) => {
      const was = e.target.dataset.kcGruppe;
      if (!was) return;
      if (was === 'binden') gruppieren();
      if (was === 'loesen') loesen();
      if (was === 'sichern') alsBaugruppeSpeichern(div.querySelector('[data-kc-gruppe-name]').value);
      menue.hidden = true;
    };
  }

  const melden = (t) => { if (typeof status === 'function') status(t); };

  /* --------------------------------------------------- Gruppen dürfen sich nicht verziehen
     VORSORGE, kein behobener Fehler - das gehört dazugesagt.
     Der Designer zieht das ANGEFASSTE Objekt zusätzlich an die Kanten seiner Nachbarn
     ("Smart Guides", smartSnap, 6 px Toleranz); die mitwandernden Teile einer Baugruppe
     bekommen nur das normale Einrasten. Die Teile werden dadurch unterschiedlich weit
     versetzt. Meist fällt das beim Umrechnen ins Bereichsraster wieder weg - liegt ein Teil
     aber gerade an der Grenze zwischen zwei Feldern, kippt es eine ganze Spalte oder Zeile
     weit, und die Baugruppe verzieht sich.
     Nachgemessen: Der beobachtete Verzug hatte eine andere Ursache (das hängengebliebene
     Ziehen, siehe Teil 2), und die Prüfungen laufen auch ohne diese Zähmung grün. Sie bleibt
     trotzdem, weil im Kassenmodus das Bereichsraster die Ausrichthilfe ist - zwei Hilfen, die
     sich widersprechen, sind schlechter als eine. Für Präsentation und TV-Anzeige bleibt
     alles unverändert. */
  function smartSnapUmschliessen() {
    if (typeof smartSnap !== 'function' || smartSnap.kcGezaehmt) return;
    const echtes = smartSnap;
    smartSnap = function (item, x, y) {
      if ((project.mode || '') !== 'kasse') return echtes.apply(this, arguments);
      if (typeof hideSmartGuides === 'function') hideSmartGuides();
      return { x: Math.max(0, snap(x)), y: Math.max(0, snap(y)) };
    };
    smartSnap.kcGezaehmt = true;
  }

  function starte() {
    if (!bereit()) return false;
    addItemUmschliessen();
    smartSnapUmschliessen();
    menueErweitern();
    eigeneEintragen();
    console.info(`KC Kassenbaukasten Teil 3 (${VERSION}) bereit – Gruppieren, Lösen, eigene Baugruppen.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 140) clearInterval(wecker); }, 100);

  window.KCKassenGruppen = {
    version: VERSION, gruppieren, loesen, alsBaugruppeSpeichern, baugruppeLoeschen,
    eigene: lesen, auswahl,
  };
})();
