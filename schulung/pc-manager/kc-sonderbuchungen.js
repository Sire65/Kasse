/* KC Sonderbuchungen - Auswertung "ohne Umsatz" im PC-Manager (23.09.2026)
   Betreiber: "Im PC-Manager muss eine Anzeige sein, was alles auf Helfer gebucht wurde - also
   Auswertung wie Spenden, Trinkgeld, Personal usw."
   Zeigt unter "Auswertungen" alles, was bewusst NICHT als Umsatz zaehlt: Helfer-Verpflegung je
   Gruppe, Personalverbrauch je Bediener (Pseudonym), Trinkgeld nach Herkunft, Spenden, auf Konto
   Gebuchtes und die Leihglaeser (Pfand, das bei Personal/Helfer nicht berechnet wurde).
   Folgt denselben Filtern wie die Auswertung (Kasse, Datum von/bis, Bediener). Liest nur - aendert
   keine Daten. */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const geld = (n) => { try { return money(n); } catch (e) { return (Number(n) || 0).toFixed(2) + ' €'; } };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIP_HERKUNFT = {
    'manual': 'Trinkgeld-Taste', 'manual-direct': 'Direkt eingetippt', 'aufrunden': 'Aufrunden',
    'stimmt-so': 'Stimmt so', 'wechselgeld-behalten': 'Wechselgeld behalten', 'pfand-behalten': 'Pfand behalten'
  };

  function filter() {
    return {
      rid: ($('rRegister') || {}).value || '',
      von: ($('rFrom') || {}).value || '',
      bis: ($('rTo') || {}).value || '',
      bediener: (($('rOperator') || {}).value || '').trim().toLowerCase()
    };
  }
  function passt(f, x) {
    const tag = String(x.time || '').slice(0, 10);
    return !x.training && (!f.rid || x.registerId === f.rid) && (!f.von || tag >= f.von) && (!f.bis || tag <= f.bis)
      && (!f.bediener || String(x.operator || '').toLowerCase().includes(f.bediener));
  }
  const alleVorgaenge = () => { try { return Array.isArray(sales) ? sales : []; } catch (e) { return []; } };
  const alleTipps = () => { try { return Array.isArray(managerTips) ? managerTips : []; } catch (e) { return []; } };
  const alleEntnahmen = () => { try { return Array.isArray(cashWithdrawals) ? cashWithdrawals : []; } catch (e) { return []; } };
  const wert = (t) => Math.abs(Number(t.total ?? t.due ?? 0));
  const stueck = (t) => (t.items || []).reduce((n, i) => n + Math.max(0, Number(i.qty || 0)), 0);
  const leih = (t) => (t.items || []).reduce((n, i) => n + Math.max(0, Number(i.qty || 0)) * Number(i.leih || 0), 0);

  function gruppiere(liste, schluessel) {
    const m = new Map();
    liste.forEach((t) => {
      const k = schluessel(t);
      const g = m.get(k) || { name: k, vorgaenge: 0, stueck: 0, wert: 0, leih: 0, artikel: {} };
      g.vorgaenge++; g.stueck += stueck(t); g.wert += wert(t); g.leih += leih(t);
      (t.items || []).forEach((i) => { g.artikel[i.name] = (g.artikel[i.name] || 0) + Number(i.qty || 0); });
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.wert - a.wert);
  }
  const top = (artikel) => Object.entries(artikel).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, q]) => `${q}× ${esc(n)}`).join(', ');

  function daten() {
    const f = filter();
    const tx = alleVorgaenge().filter((t) => passt(f, t));
    const helfer = tx.filter((t) => t.type === 'helfer');
    const personal = tx.filter((t) => t.type === 'personal');
    const spenden = tx.filter((t) => String(t.method || '') === 'pfand-spende');
    const konto = tx.filter((t) => t.type !== 'personal' && t.type !== 'helfer' && String(t.method || '') === 'account-charge');
    const tipps = alleTipps().filter((t) => passt(f, t));
    const entnahmenPersonal = alleEntnahmen().filter((w) => passt(f, w) && /personal/i.test(String(w.reason || '')));
    const summe = (l, fn) => l.reduce((s, x) => s + fn(x), 0);
    return {
      helfer, personal, spenden, konto, tipps, entnahmenPersonal,
      helferWert: summe(helfer, wert), personalWert: summe(personal, wert),
      spendenWert: summe(spenden, wert), kontoWert: summe(konto, wert),
      tippWert: summe(tipps, (t) => Number(t.amount || 0)),
      entnahmenWert: summe(entnahmenPersonal, (w) => Number(w.amount || 0)),
      leihglaeser: summe(helfer, leih) + summe(personal, leih)
    };
  }

  function zeichnen() {
    const ziel = $('kcSonderbuchungen'); if (!ziel) return;
    const d = daten();
    const kachel = (titel, betrag, zusatz, art) => `<article class="kc-sonder-kachel ${art}"><span>${titel}</span><strong>${betrag}</strong><small>${zusatz}</small></article>`;
    const vorg = (n) => `${n} ${n === 1 ? 'Vorgang' : 'Vorgänge'}`;
    const helferZeilen = gruppiere(d.helfer, (t) => t.helperGroup || 'ohne Gruppe');
    const personalZeilen = gruppiere(d.personal, (t) => t.operator || 'Team');
    const tippZeilen = (() => {
      const m = {};
      d.tipps.forEach((t) => {
        const quelle = String(t.source || 'manual'), k = TIP_HERKUNFT[quelle] || (quelle.startsWith('pfand-behalten') ? TIP_HERKUNFT['pfand-behalten'] : quelle);
        m[k] = m[k] || { anzahl: 0, betrag: 0 }; m[k].anzahl++; m[k].betrag += Number(t.amount || 0);
      });
      return Object.entries(m).sort((a, b) => b[1].betrag - a[1].betrag);
    })();
    const tabelle = (kopf, zeilen, leer) => `<table class="kc-sonder-tabelle"><thead><tr>${kopf.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${zeilen.length ? zeilen.join('') : `<tr><td colspan="${kopf.length}" class="kc-sonder-leer">${leer}</td></tr>`}</tbody></table>`;

    ziel.innerHTML = `
      <div class="kc-sonder-kopf"><h2>Ohne Umsatz gebucht</h2><p>Helfer, Personal, Trinkgeld, Spenden und Konto – zählt nicht als Verkauf. Folgt den Filtern oben.</p></div>
      <div class="kc-sonder-kacheln">
        ${kachel('🤝 Helfer-Verpflegung', geld(d.helferWert), vorg(d.helfer.length), 'helfer')}
        ${kachel('👥 Personalverbrauch', geld(d.personalWert), vorg(d.personal.length), 'personal')}
        ${kachel('💝 Trinkgeld', geld(d.tippWert), vorg(d.tipps.length), 'trinkgeld')}
        ${kachel('♥ Spenden', geld(d.spendenWert), vorg(d.spenden.length), 'spende')}
        ${kachel('📄 Auf Konto', geld(d.kontoWert), vorg(d.konto.length), 'konto')}
        ${kachel('🍷 Leihgläser', `${d.leihglaeser} Stk.`, 'Personal + Helfer, ohne Pfand', 'leih')}
      </div>
      <div class="kc-sonder-raster">
        <section class="kc-sonder-block"><h3>🤝 Helfer je Gruppe</h3>
          ${tabelle(['Gruppe', 'Vorgänge', 'Artikel', 'Wert', 'Meist gebucht'], helferZeilen.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td>${g.vorgaenge}</td><td>${g.stueck}</td><td class="betrag">${geld(g.wert)}</td><td class="klein">${top(g.artikel)}</td></tr>`), 'Noch nichts auf Helfer gebucht.')}
        </section>
        <section class="kc-sonder-block"><h3>👥 Personal je Bediener</h3>
          ${tabelle(['Bediener', 'Vorgänge', 'Artikel', 'Wert', 'Meist gebucht'], personalZeilen.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td>${g.vorgaenge}</td><td>${g.stueck}</td><td class="betrag">${geld(g.wert)}</td><td class="klein">${top(g.artikel)}</td></tr>`), 'Noch kein Personalverbrauch.')}
          ${d.entnahmenPersonal.length ? `<p class="kc-sonder-hinweis">Dazu bar aus der Kasse entnommen für Essen/Getränke Personal: <b>${geld(d.entnahmenWert)}</b> (${vorg(d.entnahmenPersonal.length)})</p>` : ''}
        </section>
        <section class="kc-sonder-block"><h3>💝 Trinkgeld nach Herkunft</h3>
          ${tabelle(['Herkunft', 'Anzahl', 'Betrag'], tippZeilen.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.anzahl}</td><td class="betrag">${geld(v.betrag)}</td></tr>`), 'Noch kein Trinkgeld.')}
          ${d.spenden.length ? `<p class="kc-sonder-hinweis">Spenden (Pfand als Spende): <b>${geld(d.spendenWert)}</b> (${vorg(d.spenden.length)})</p>` : ''}
        </section>
      </div>`;
  }

  /* Einzelliste in der Auswertungstabelle (Datentyp "Helfer-Buchungen einzeln" / "Personal-Buchungen einzeln").
     Gibt true zurueck, wenn der Datentyp hier behandelt wurde. */
  function tabelle(typ, body) {
    if (typ !== 'helfer' && typ !== 'personal') return false;
    const f = filter();
    const rows = alleVorgaenge().filter((t) => passt(f, t) && t.type === typ);
    const zeilen = [];
    rows.forEach((t) => (t.items || []).forEach((i) => {
      const wer = typ === 'helfer' ? (t.helperGroup || 'ohne Gruppe') : (t.operator || 'Team');
      zeilen.push(`<tr><td>${esc(t.registerName || t.registerId)}</td><td>${esc(String(t.time || '').slice(0, 10))}</td><td>${esc(t.bon || '')}</td><td>${esc(wer)} · ${esc(i.name)}${i.leih ? ' · Leihglas' : ''}</td><td>${Number(i.qty || 0)}</td><td>${geld(Number(i.price || 0) * Number(i.qty || 0))}</td></tr>`);
    }));
    body.innerHTML = zeilen.join('') || `<tr><td colspan="6">Keine ${typ === 'helfer' ? 'Helfer' : 'Personal'}-Buchungen im gewählten Zeitraum.</td></tr>`;
    return true;
  }

  global.KCSonderbuchungen = { zeichnen, tabelle, daten };
  document.addEventListener('DOMContentLoaded', () => { try { zeichnen(); } catch (e) { /* app.js noch nicht bereit */ } });
})(window);
