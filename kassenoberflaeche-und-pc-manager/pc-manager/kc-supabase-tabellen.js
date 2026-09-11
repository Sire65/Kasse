// KC Datenbank-Ansicht - einfache, deutsche Tabellen-Uebersicht fuer Supabase.
//
// ANLASS (Betreiber): "In Supabase ist alles auf Englisch und die Oberflaeche ist kompliziert.
// Mein Freund hat mir die Oberflaeche fuer MariaDB gezeigt, das sah aufgeraeumt aus." Supabase
// Studio kann sehr viel (Schema aendern, RLS-Regeln, Funktionen, SQL) - genau das macht es
// unuebersichtlich, wenn man nur mal schnell eine Tabelle ansehen oder eine Zeile korrigieren
// will. Diese Seite kann bewusst NUR das Eine: Tabelle waehlen, Zeilen sehen, Werte aendern,
// Zeilen loeschen. Kein Schema-Editor, keine SQL-Konsole, keine Funktionsverwaltung - das bleibt
// Supabase Studio vorbehalten, falls doch einmal noetig.
//
// WICHTIG ZUR SICHERHEIT: diese Seite umgeht keine Rechte. Sie nutzt dieselbe Anmeldung wie der
// Rest des Managers (KCSupabase) - wer sich hier nicht anmeldet oder keine Rechte auf eine
// Tabelle hat, sieht sie erst gar nicht in der Auswahl (Supabase liefert die Tabellenliste
// bereits nach den Rechten der angemeldeten Person gefiltert).
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let aktuelleTabelle = null;
  let aktuelleZeilen = [];
  let ladenGerade = false;

  function api() { return global.KCSupabase; }

  async function tabellenListeLaden() {
    const auswahl = el('dbTabelle');
    if (!auswahl) return;
    if (!api()?.istAngemeldet?.()) {
      auswahl.innerHTML = '<option value="">Erst bei Supabase anmelden …</option>';
      return;
    }
    auswahl.innerHTML = '<option value="">Tabellen werden geladen …</option>';
    try {
      const tabellen = await api().listeTabellen();
      auswahl.innerHTML = '<option value="">– Tabelle wählen –</option>'
        + tabellen.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    } catch (fehler) {
      auswahl.innerHTML = '<option value="">Fehler beim Laden</option>';
      meldung(`Tabellenliste konnte nicht geladen werden: ${fehler.message}`, 'fehler');
    }
  }

  function meldung(text, art = 'info') {
    const feld = el('dbMeldung');
    if (!feld) return;
    feld.textContent = text;
    feld.className = `db-meldung db-${art}`;
  }

  // Baut aus den URSPRUeNGLICHEN Werten einer Zeile einen Filter, der genau diese Zeile trifft -
  // unabhaengig davon, wie die Tabelle ihre Schluesselspalte nennt (id, event_id, uuid, ...).
  // Nur einfache Werte (Text/Zahl/Wahrheitswert) eignen sich dafuer; JSON-Spalten oder leere
  // Werte werden ausgelassen, weil sie sich nicht zuverlaessig in die Web-Adresse packen lassen.
  function zeilenFilter(zeile) {
    return Object.entries(zeile)
      .filter(([, wert]) => wert !== null && typeof wert !== 'object')
      .map(([spalte, wert]) => `${encodeURIComponent(spalte)}=eq.${encodeURIComponent(wert)}`)
      .join('&');
  }

  async function zeilenLaden() {
    const tabelle = el('dbTabelle')?.value;
    if (!tabelle) return meldung('Bitte zuerst eine Tabelle wählen.', 'warnung');
    if (ladenGerade) return;
    ladenGerade = true;
    aktuelleTabelle = tabelle;
    meldung('Wird geladen …');
    el('dbErgebnis').innerHTML = '';
    try {
      const zeilen = await api().rufeTabelleAuf(`${tabelle}?select=*&limit=100&order=1.desc`).catch(() =>
        // Nicht jede Tabelle hat eine sortierbare erste Spalte in dieser Form - im Zweifel
        // einfach ohne Sortierung laden, lieber unsortiert zeigen als gar nichts.
        api().rufeTabelleAuf(`${tabelle}?select=*&limit=100`));
      aktuelleZeilen = Array.isArray(zeilen) ? zeilen : [];
      zeichnen();
      meldung(aktuelleZeilen.length ? `${aktuelleZeilen.length} Zeile(n) geladen (höchstens 100 auf einmal).` : 'Tabelle ist leer.', 'ok');
    } catch (fehler) {
      meldung(`Konnte nicht geladen werden: ${fehler.message}`, 'fehler');
    } finally {
      ladenGerade = false;
    }
  }

  function zeichnen() {
    const ziel = el('dbErgebnis');
    if (!aktuelleZeilen.length) { ziel.innerHTML = ''; return; }
    const spalten = Object.keys(aktuelleZeilen[0]);
    ziel.innerHTML = `<div class="table-card db-tabelle-wrap"><table><thead><tr>${
      spalten.map((s) => `<th>${esc(s)}</th>`).join('')
    }<th></th></tr></thead><tbody>${
      aktuelleZeilen.map((zeile, i) => `<tr data-db-row="${i}">${
        spalten.map((s) => `<td><input type="text" data-db-col="${esc(s)}" value="${esc(typeof zeile[s] === 'object' && zeile[s] !== null ? JSON.stringify(zeile[s]) : zeile[s])}"></td>`).join('')
      }<td class="db-aktionen"><button type="button" data-db-save="${i}" title="Diese Zeile speichern">💾</button><button type="button" data-db-delete="${i}" title="Diese Zeile löschen">🗑</button></td></tr>`).join('')
    }</tbody></table></div>`;

    ziel.querySelectorAll('[data-db-save]').forEach((btn) => btn.addEventListener('click', () => zeileSpeichern(Number(btn.dataset.dbSave))));
    ziel.querySelectorAll('[data-db-delete]').forEach((btn) => btn.addEventListener('click', () => zeileLoeschen(Number(btn.dataset.dbDelete))));
  }

  async function zeileSpeichern(index) {
    const original = aktuelleZeilen[index];
    const zeile = el('dbErgebnis').querySelector(`tr[data-db-row="${index}"]`);
    const geaendert = {};
    zeile.querySelectorAll('[data-db-col]').forEach((feld) => {
      const spalte = feld.dataset.dbCol, neu = feld.value, alt = original[spalte];
      const altAlsText = typeof alt === 'object' && alt !== null ? JSON.stringify(alt) : String(alt ?? '');
      if (neu !== altAlsText) geaendert[spalte] = neu;
    });
    if (!Object.keys(geaendert).length) return meldung('Nichts geändert an dieser Zeile.', 'warnung');
    const filter = zeilenFilter(original);
    if (!filter) return meldung('Diese Zeile lässt sich nicht eindeutig identifizieren (keine einfachen Werte darin) - keine Änderung möglich.', 'fehler');
    try {
      const antwort = await api().rufeTabelleAuf(`${aktuelleTabelle}?${filter}`, 'PATCH', geaendert);
      if (Array.isArray(antwort) && antwort[0]) aktuelleZeilen[index] = antwort[0];
      meldung('Zeile gespeichert.', 'ok');
      zeichnen();
    } catch (fehler) {
      // Haeufigster Grund: die Zeilensicherheit (RLS) der Tabelle erlaubt der angemeldeten
      // Person kein Aendern - dann bewusst als verstaendliche Meldung zeigen, nicht als
      // technischen Fehlercode.
      meldung(`Konnte nicht gespeichert werden: ${fehler.message}. Häufigster Grund: die angemeldete Person darf diese Tabelle nicht ändern (Zeilensicherheit/RLS).`, 'fehler');
    }
  }

  async function zeileLoeschen(index) {
    const original = aktuelleZeilen[index];
    if (!global.confirm('Diese Zeile wirklich unwiderruflich löschen?')) return;
    const filter = zeilenFilter(original);
    if (!filter) return meldung('Diese Zeile lässt sich nicht eindeutig identifizieren - kein Löschen möglich.', 'fehler');
    try {
      await api().rufeTabelleAuf(`${aktuelleTabelle}?${filter}`, 'DELETE');
      aktuelleZeilen.splice(index, 1);
      zeichnen();
      meldung('Zeile gelöscht.', 'ok');
    } catch (fehler) {
      meldung(`Konnte nicht gelöscht werden: ${fehler.message}. Häufigster Grund: die angemeldete Person darf in dieser Tabelle nichts löschen (Zeilensicherheit/RLS).`, 'fehler');
    }
  }

  function starten() {
    if (!el('dbTabelle')) return;
    el('dbTabelle').addEventListener('focus', () => { if (!el('dbTabelle').dataset.geladen) { el('dbTabelle').dataset.geladen = '1'; tabellenListeLaden(); } }, { once: true });
    el('dbLaden')?.addEventListener('click', zeilenLaden);
    document.querySelectorAll('[data-view="datenbank"]').forEach((b) => b.addEventListener('click', () => setTimeout(tabellenListeLaden, 80)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
  global.KCSupabaseTabellen = { zeilenLaden, tabellenListeLaden };
})(window);
