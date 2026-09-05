// Gutschein-Übersicht im Manager.
//
// Die Kassen melden ihre Gutscheine laufend hierher. Diese Seite zeigt, welche im Umlauf sind,
// welche schon (teilweise) eingelöst wurden und welcher Restwert noch aussteht.
//
// WICHTIG fuer die Jahresauswertung: das offene Guthaben ist KEIN Gewinn. Es ist Ware, die der
// Verein noch schuldet. Deshalb steht die Summe hier als eigene Zahl und nicht bei den Umsätzen.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' \u20ac';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const datum = (iso) => iso ? new Date(iso).toLocaleDateString('de-DE') : '';
  const DIENST = 47392;

  const abgelaufen = (g) => new Date(g.expiresAt).getTime() < Date.now();
  const zustand = (g) => g.balance <= 0.004 ? 'eingeloest'
    : abgelaufen(g) ? 'abgelaufen'
    : g.balance < g.amount - 0.004 ? 'teilweise' : 'offen';
  const TEXT = {offen: 'Offen', teilweise: 'Teilweise eingelöst', eingeloest: 'Vollständig eingelöst', abgelaufen: 'Abgelaufen'};

  let daten = [];

  async function laden() {
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST}/gutscheine/liste`, {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      daten = (await antwort.json()).gutscheine || [];
      zeichne();
    } catch (fehler) {
      el('gsmListe').innerHTML = '<p class="gsm-leer">Die Gutscheine konnten nicht geladen werden. '
        + 'Läuft das Markttag-Fenster, und ist diese Seite über 127.0.0.1 geöffnet?</p>';
      el('gsmZahlen').innerHTML = '';
    }
  }

  function zeichne() {
    const suche = (el('gsmSuche')?.value || '').trim().toUpperCase();
    const filter = el('gsmFilter')?.value || 'alle';
    const liste = daten.filter((g) => (!suche || g.code.toUpperCase().includes(suche))
      && (filter === 'alle' || zustand(g) === filter));

    const offen = daten.filter((g) => !abgelaufen(g) && g.balance > 0.004);
    const summeOffen = offen.reduce((s, g) => s + g.balance, 0);
    const summeAusgegeben = daten.reduce((s, g) => s + g.amount, 0);
    const summeEingeloest = daten.reduce((s, g) => s + (g.amount - g.balance), 0);
    const verfallen = daten.filter((g) => abgelaufen(g) && g.balance > 0.004);

    el('gsmZahlen').innerHTML = `
      <div class="gsm-zahl"><span>Ausgegeben insgesamt</span><strong>${geld(summeAusgegeben)}</strong><small>${daten.length} Gutschein(e)</small></div>
      <div class="gsm-zahl"><span>Davon eingelöst</span><strong>${geld(summeEingeloest)}</strong><small>bereits als Umsatz gebucht</small></div>
      <div class="gsm-zahl gsm-schuld"><span>Offenes Guthaben</span><strong>${geld(summeOffen)}</strong><small>${offen.length} Gutschein(e) \u2013 noch geschuldete Ware</small></div>
      ${verfallen.length ? `<div class="gsm-zahl gsm-verfallen"><span>Verfallen mit Restwert</span><strong>${geld(verfallen.reduce((s, g) => s + g.balance, 0))}</strong><small>${verfallen.length} Gutschein(e) über die Gültigkeit hinaus</small></div>` : ''}`;

    el('gsmListe').innerHTML = liste.length ? `
      <table class="gsm-tabelle"><thead><tr>
        <th>Nummer</th><th>Ausgegeben</th><th>Betrag</th><th>Restwert</th><th>Zustand</th><th>Gültig bis</th><th>Einlösungen</th>
      </tr></thead><tbody>
      ${liste.map((g) => {
        const z = zustand(g);
        return `<tr class="gsm-${z}">
          <td class="gsm-code">${esc(g.code)}</td>
          <td>${datum(g.issuedAt)}${g.registerId ? `<small> \u00b7 ${esc(g.registerId)}</small>` : ''}</td>
          <td class="gsm-rechts">${geld(g.amount)}</td>
          <td class="gsm-rechts gsm-rest">${geld(g.balance)}</td>
          <td>${TEXT[z]}</td>
          <td>${datum(g.expiresAt)}</td>
          <td>${(g.redemptions || []).length
            ? (g.redemptions || []).map((r) => `${datum(r.at)}: ${geld(r.amount)}`).join('<br>')
            : '\u2014'}</td>
        </tr>`;
      }).join('')}
      </tbody></table>` : '<p class="gsm-leer">Keine Gutscheine für diese Auswahl.</p>';
  }

  function starten() {
    if (!el('gsmListe')) return;
    el('gsmAktualisieren')?.addEventListener('click', laden);
    el('gsmSuche')?.addEventListener('input', zeichne);
    el('gsmFilter')?.addEventListener('change', zeichne);
    laden();
  }
  document.querySelectorAll('[data-view="gutscheine"]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(starten, 80)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
  global.KCGutscheineManager = {laden, zeichne};
})(window);
