// Von den Kassen gemeldete Tagesabschlüsse im PC-Manager.
//
// Bisher blieb der Abschluss auf der Kasse liegen und musste als QR-Code, Datei oder Ausdruck
// am Stand eingesammelt werden. Jetzt meldet ihn die Kasse selbst, sobald er fertig ist -
// über denselben zuverlässigen Weg wie jeder Verkauf, also auch über die Fernstrecke.
//
// ZWEI GRUNDSÄTZE, die hier sichtbar werden:
// 1. Es wird nur ein FERTIGER Abschluss angezeigt. Die Kasse baut auf Anforderung keinen -
//    das bleibt eine bewusste Handlung am Stand. Gibt es noch keinen, kommt "noch nicht
//    gemacht" zurück statt einer halben Tageszahl, die wie eine fertige aussieht.
// 2. An der Kasse ist von alldem nichts zu sehen. Das Anfordern läuft still über die
//    bestehende Fernbefehl-Warteschlange.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const DIENST = 47392;
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' \u20ac';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const zeit = (iso) => iso ? new Date(iso).toLocaleString('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '';

  let geladen = false;

  function stand(text, art) {
    const feld = el('mgrAbschlussStand');
    if (!feld) return;
    feld.textContent = text;
    feld.className = 'tc-status' + (art === 'warn' ? ' warn' : art === 'ok' ? ' ok' : '');
  }

  async function laden() {
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST}/abschluesse/liste`,
        {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      if (!antwort.ok) throw new Error(String(antwort.status));
      const liste = (await antwort.json()).abschluesse || [];
      zeichne(liste);
      fuelleKassen(liste);
      stand(liste.length
        ? `${liste.length} gemeldete(r) Abschluss/Abschlüsse.`
        : 'Es wurde noch kein Abschluss gemeldet.', liste.length ? 'ok' : '');
      geladen = true;
    } catch (e) {
      stand('Der Manager-Dienst ist nicht erreichbar. Läuft das Markttag-Fenster, und ist diese '
        + 'Seite über 127.0.0.1 geöffnet? Die Kassen behalten ihre Abschlüsse so lange bei sich.', 'warn');
    }
  }

  // Die Kassenauswahl kommt aus den bereits angelegten Kassen; sind noch keine da, wird sie
  // aus den gemeldeten Abschlüssen gefüllt - anfordern kann man nur bei einer bekannten Kasse.
  function fuelleKassen(liste) {
    const auswahl = el('mgrAbschlussKasse');
    if (!auswahl) return;
    const ausManager = (global.registers || []).filter((r) => r.active).map((r) => r.id);
    const ausMeldungen = [...new Set((liste || []).map((a) => a.registerId).filter(Boolean))];
    const alle = [...new Set([...ausManager, ...ausMeldungen])].sort();
    const soll = alle.join('|');
    if (auswahl.dataset.stand === soll) return;
    const gewaehlt = auswahl.value;
    auswahl.innerHTML = alle.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')
      || '<option value="">keine Kasse bekannt</option>';
    auswahl.dataset.stand = soll;
    if (alle.includes(gewaehlt)) auswahl.value = gewaehlt;
  }

  function zeichne(liste) {
    const ziel = el('mgrAbschluesse');
    if (!ziel) return;
    if (!liste.length) { ziel.innerHTML = '<p class="kcbs-leer">Noch nichts gemeldet.</p>'; return; }
    ziel.innerHTML = `<table class="kcbs-tabelle"><thead><tr>
        <th>Zeitpunkt</th><th>Kasse</th><th>Erwartet</th><th>Barverkäufe</th>
        <th>Einlagen</th><th>Trinkgeld</th><th>Entnahmen</th><th>Bons</th></tr></thead><tbody>
      ${liste.map((a) => `<tr>
        <td>${esc(zeit(a.createdAt))}</td>
        <td>${esc(a.registerName || a.registerId || '')}</td>
        <td class="kcbs-zahl"><b>${geld(a.expectedCash)}</b></td>
        <td class="kcbs-zahl">${geld(a.cashSales)}</td>
        <td class="kcbs-zahl">${geld(a.cashIn)}</td>
        <td class="kcbs-zahl">${geld(a.cashTips)}</td>
        <td class="kcbs-zahl">${geld(a.cashOut)}</td>
        <td class="kcbs-zahl">${Number(a.transactionCount || 0)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  async function anfordern() {
    const kasse = el('mgrAbschlussKasse')?.value;
    if (!kasse) return stand('Es ist keine Kasse ausgewählt.', 'warn');
    stand(`Anfrage an ${kasse} wird eingereiht …`, '');
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST}/remote-command/queue`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({registerId: kasse, command: 'abschluss_melden'}),
        signal: AbortSignal.timeout(4000),
      });
      if (!antwort.ok) throw new Error(String(antwort.status));
      stand(`Anfrage an ${kasse} eingereiht. Die Kasse antwortet beim nächsten Abgleich – das `
        + 'dauert bis zu einer halben Minute. Gibt es dort noch keinen fertigen Abschluss, '
        + 'bleibt diese Liste unverändert.', 'ok');
      // Zweimal nachsehen: einmal nach dem üblichen Abholtakt, einmal mit Puffer.
      setTimeout(laden, 25000);
      setTimeout(laden, 45000);
    } catch (e) {
      stand('Die Anfrage konnte nicht eingereiht werden – der Manager-Dienst ist nicht erreichbar.', 'warn');
    }
  }

  function bind() {
    el('mgrAbschlussAktualisieren')?.addEventListener('click', laden);
    el('mgrAbschlussAnfordern')?.addEventListener('click', anfordern);
    document.querySelectorAll('[data-view="closing"]').forEach((knopf) =>
      knopf.addEventListener('click', () => { if (!geladen) setTimeout(laden, 200); }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  global.KCAbschluesseManager = {laden};
})(window);
