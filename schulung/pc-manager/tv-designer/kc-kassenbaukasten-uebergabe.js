/* KC Kassenbaukasten, Teil 8: Die Übergabe an die Kasse.   03.09.2026
 *
 * ANLASS (Betreiber): "Dann können wir auf unserer Kasse mehrere hinterlegen, die man per
 * Umschalten auswählen kann. ... Die Übergabe an das Kassensystem muss gebaut werden, und so
 * flexibel, dass jederzeit weitere dazukommen können."
 *
 * WIE DIE ÜBERGABE GEDACHT IST
 * Der Baukasten legt den fertigen Aufbau in eine SAMMLUNG. Eine Sammlung trägt beliebig viele
 * Oberflächen - eine je Gerät, oder mehrere fürs selbe Gerät zum Vergleichen. Neue kommen
 * dazu, ohne dass etwas umgebaut wird; eine überarbeitete ersetzt ihre eigene alte Fassung
 * anhand der Kennung.
 * Zwei Wege hinaus, beide mit derselben Datei:
 *   1. In den Speicher (localStorage) - die Kasse liegt auf demselben Rechner und liest dort.
 *   2. Als Datei zum Mitnehmen auf ein anderes Gerät.
 * Und ein Weg herein: eine vorhandene Sammlung einlesen und weiterbauen.
 *
 * WAS DIESE ÜBERGABE HEUTE NOCH NICHT KANN - und das gehört gesagt:
 * Sie bringt die BESCHREIBUNG zur Kasse, und die Kasse kann sie lesen, prüfen, auflisten und
 * umschalten. Dass die Kassenoberfläche sich daraufhin auch wirklich UMBAUT, ist der nächste
 * Schritt und liegt in der Kasse, nicht hier. Die Prüfung "abgleichen" sagt bei jeder
 * Oberfläche, wie viele ihrer Bausteine die Kasse schon darstellen kann - damit dieser Rest
 * sichtbar bleibt statt sich als stille Lücke zu verstecken.
 */
'use strict';
(function () {
  const VERSION = '0.8.0';
  const LAGER = 'kc.kassenoberflaechen.v1';

  const F = () => window.KCOberflaechenFormat;
  const K = () => window.KCKassenbaukasten;
  const melden = (t) => { if (typeof status === 'function') status(t); };

  const sammlungLesen = () => {
    try {
      const roh = localStorage.getItem(LAGER);
      if (!roh) return F().leereSammlung();
      const { sammlung, maengel } = F().pruefeSammlung(roh);
      if (!sammlung) { console.warn('KC Oberflächen: gespeicherte Sammlung unbrauchbar', maengel); return F().leereSammlung(); }
      return sammlung;
    } catch (e) { return F().leereSammlung(); }
  };
  const sammlungSchreiben = (s) => {
    try { localStorage.setItem(LAGER, JSON.stringify(s)); return true; } catch (e) { return false; }
  };

  /* Die aktuelle Arbeit als Oberfläche beschreiben. */
  function aktuelleOberflaeche(name, id) {
    const geraet = K().GERAETE.find((g) => g.id === project.kasse?.geraet);
    return F().ausProjekt(project, {
      id, name: name || vorschlagsName(geraet), geraet, raster: K().raster(),
    });
  }
  const vorschlagsName = (g) => `${g ? g.name : 'Oberfläche'} · ${new Date().toLocaleDateString('de-DE')}`;

  function uebergeben() {
    const geraet = K().GERAETE.find((g) => g.id === project.kasse?.geraet);
    const name = prompt('Name dieser Oberfläche für die Kasse:', vorschlagsName(geraet));
    if (name === null) return null;
    const of = aktuelleOberflaeche(name, project.kasse?.oberflaecheId);
    /* Die Kennung bleibt am Projekt hängen: Wer denselben Aufbau später noch einmal übergibt,
       ersetzt seine eigene Fassung, statt eine zweite daneben zu legen. */
    project.kasse = project.kasse || {};
    project.kasse.oberflaecheId = of.id;

    const { maengel } = F().pruefeSammlung({ format: F().FORMAT, version: F().VERSION, oberflaechen: [of] });
    if (maengel.length) {
      alert('Diese Oberfläche ist noch nicht übergabereif:\n\n• ' + maengel.slice(0, 6).join('\n• '));
      return null;
    }
    const s = F().einsortieren(sammlungLesen(), of);
    if (!sammlungSchreiben(s)) { alert('Die Sammlung konnte nicht gespeichert werden.'); return null; }
    listeZeichnen();
    melden(`„${of.name}“ an die Kasse übergeben – die Sammlung enthält jetzt ${s.oberflaechen.length} Oberflächen.`);
    return of;
  }

  function alsDatei() {
    const s = sammlungLesen();
    if (!s.oberflaechen.length) { alert('Es ist noch keine Oberfläche übergeben worden.'); return; }
    const text = JSON.stringify(s, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `kc-kassenoberflaechen-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    melden(`${s.oberflaechen.length} Oberflächen als Datei ausgegeben.`);
  }

  function ausDatei(datei) {
    const leser = new FileReader();
    leser.onload = () => {
      const { sammlung, maengel } = F().pruefeSammlung(String(leser.result));
      if (!sammlung) { alert('Diese Datei enthält keine Oberflächen:\n\n• ' + maengel.join('\n• ')); return; }
      if (maengel.length) {
        if (!confirm(`Die Datei hat ${maengel.length} Beanstandungen:\n\n• ${maengel.slice(0, 6).join('\n• ')}\n\nTrotzdem übernehmen?`)) return;
      }
      let s = sammlungLesen();
      sammlung.oberflaechen.forEach((o) => { s = F().einsortieren(s, o); });
      sammlungSchreiben(s);
      listeZeichnen();
      melden(`${sammlung.oberflaechen.length} Oberflächen eingelesen – die Sammlung enthält jetzt ${s.oberflaechen.length}.`);
    };
    leser.readAsText(datei);
  }

  /* Eine übergebene Oberfläche zurück auf die Baufläche holen - zum Weiterbauen. */
  function zurueckholen(id) {
    const of = sammlungLesen().oberflaechen.find((o) => o.id === id);
    if (!of) return;
    if (!confirm(`„${of.name}“ zum Weiterbauen öffnen?\n\nDie jetzigen Seiten werden ersetzt.`)) return;
    project.slides = of.seiten.map((se) => ({
      id: (typeof uid === 'function') ? uid('slide') : 'slide-' + se.art,
      name: se.name || se.art, kcSeite: se.art, items: [], bg: '#f3f6f9', duration: 8, transition: 'none',
    }));
    activeSlideId = project.slides[0].id;
    project.kasse = { geraet: of.geraet, oberflaecheId: of.id };
    K().geraetSetzen(of.geraet, true);
    const vorher = activeSlideId;
    try {
      of.seiten.forEach((se, n) => {
        activeSlideId = project.slides[n].id;
        se.bausteine.forEach((b) => {
          const item = K().einsetzen(b.typ, b.spalte, b.zeile, [b.spalten, b.zeilen]);
          if (!item) return;
          F().MERKMALE.forEach(([ziel, quelle]) => { if (b[quelle] !== undefined) item[ziel] = b[quelle]; });
          if (b.gruppe) item.groupId = b.gruppe;
        });
      });
    } finally { activeSlideId = vorher; }
    activeSlideId = project.slides[0].id;
    if (typeof renderSlides === 'function') renderSlides();
    render();
    K().bibliothekFiltern();
    melden(`„${of.name}“ geöffnet – ${of.seiten.reduce((n, se) => n + se.bausteine.length, 0)} Bausteine.`);
  }

  function loeschen(id) {
    const s = sammlungLesen();
    const of = s.oberflaechen.find((o) => o.id === id);
    if (!of || !confirm(`„${of.name}“ aus der Sammlung entfernen?`)) return;
    s.oberflaechen = s.oberflaechen.filter((o) => o.id !== id);
    sammlungSchreiben(s);
    listeZeichnen();
  }

  /* ------------------------------------------------------------------------- Die Anzeige */
  function regalBauen() {
    if (document.getElementById('kcUebergabe')) return true;
    const vor = document.getElementById('kcVorlagenRegal');
    if (!vor || !vor.parentElement) return false;
    const kasten = document.createElement('section');
    kasten.id = 'kcUebergabe';
    kasten.className = 'kc-uebergabe';
    kasten.innerHTML = `
      <h3>Übergabe an die Kasse</h3>
      <p class="kc-uebergabe-hinweis">Mehrere Oberflächen sammeln – die Kasse schaltet zwischen ihnen um.</p>
      <div class="kc-uebergabe-knoepfe">
        <button type="button" data-kc-ueb="geben">Diese Oberfläche übergeben</button>
        <button type="button" data-kc-ueb="datei">Als Datei</button>
        <label class="kc-uebergabe-einlesen">Einlesen<input type="file" accept=".json,application/json" hidden></label>
      </div>
      <div class="kc-uebergabe-liste"></div>`;
    vor.parentElement.insertBefore(kasten, vor.nextSibling);
    kasten.addEventListener('click', (e) => {
      const was = e.target.dataset.kcUeb;
      if (was === 'geben') uebergeben();
      if (was === 'datei') alsDatei();
      const holen = e.target.dataset.kcHolen; if (holen) zurueckholen(holen);
      const weg = e.target.dataset.kcWeg; if (weg) loeschen(weg);
    });
    kasten.querySelector('input[type="file"]').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) ausDatei(e.target.files[0]);
      e.target.value = '';
    });
    listeZeichnen();
    return true;
  }

  function listeZeichnen() {
    const box = document.querySelector('#kcUebergabe .kc-uebergabe-liste');
    if (!box) return;
    const s = sammlungLesen();
    const bekannt = [...K().bausteinListe().keys()];
    if (!s.oberflaechen.length) {
      box.innerHTML = '<p class="kc-uebergabe-leer">Noch keine Oberfläche übergeben.</p>';
      return;
    }
    box.innerHTML = s.oberflaechen.map((o) => {
      const a = F().abgleichen(o, bekannt);
      const felder = o.seiten.reduce((n, se) => n + se.bausteine.length, 0);
      /* Der Abgleich steht bewusst an jeder Zeile: Er sagt, wie viel von dieser Oberfläche
         die Kasse heute schon darstellen kann. Eine Lücke, die man sieht, ist eine Aufgabe;
         eine, die man nicht sieht, ist ein Fehler. */
      return `<div class="kc-uebergabe-zeile">
        <span><b>${o.name}</b><small>${o.geraet} · ${o.raster.spalten} × ${o.raster.zeilen} Felder · ${felder} Bausteine · ${o.seiten.length} Seiten</small>
        <em class="${a.vollstaendig ? 'gut' : 'luecke'}">${a.vollstaendig ? 'vollständig bekannt' : `${a.darstellbar} von ${a.gesamt} bekannt – fehlt: ${a.unbekannt.map((u) => u.typ).join(', ')}`}</em></span>
        <span class="kc-uebergabe-tun">
          <button type="button" data-kc-holen="${o.id}">Öffnen</button>
          <button type="button" data-kc-weg="${o.id}" class="rot">Entfernen</button>
        </span></div>`;
    }).join('');
  }

  function sichtbarkeit() {
    const k = document.getElementById('kcUebergabe');
    if (k) k.hidden = (project.mode || '') !== 'kasse';
  }

  function bereit() {
    return window.KCOberflaechenFormat && window.KCKassenVorlagen && window.KCKassenbaukasten
      && document.getElementById('kcVorlagenRegal') && typeof render === 'function';
  }

  function starte() {
    if (!bereit()) return false;
    if (!regalBauen()) return false;
    const echtesRender = render;
    render = function () { echtesRender.apply(this, arguments); sichtbarkeit(); };
    sichtbarkeit();
    console.info(`KC Kassenbaukasten Teil 8 (${VERSION}) bereit – Übergabe an die Kasse.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 240) clearInterval(wecker); }, 100);

  window.KCKassenUebergabe = {
    version: VERSION, LAGER, uebergeben, zurueckholen, loeschen, alsDatei,
    sammlung: sammlungLesen, aktuelleOberflaeche, listeZeichnen,
  };
})();
