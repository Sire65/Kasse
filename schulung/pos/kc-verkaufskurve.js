/* KC Verkaufskurve (24.09.2026)
   Betreiber: "In der Kasse auf den Favoriten-Stern klicken und uhrzeitbezogen die Verkaeufe sehen
   wie eine Kurve - dazu ein Pfeil nach oben fuer steigende Nachfrage oder nach unten, und den
   Anteil prozentual am taeglichen Verkauf. An Tabletgroesse denken, dass das gut erkennbar ist."
   Ersetzt den Inhalt des bisherigen Fensters "Verkaufszeiten heute" (reine Textliste):
   - Heute verkauft (Stueck + Betrag)
   - Nachfrage-Pfeil: letzte 60 Minuten gegen die 60 Minuten davor (> +15 % hoch, < -15 % runter)
   - Anteil am Tagesverkauf nach Stueck (ohne Pfand, ohne Rabattzeilen)
   - Kurve je Stunde, dazu gestrichelt der letzte Markttag zur gleichen Uhrzeit
   Rein lesend - aendert keine Buchung. Kombis, die den Artikel enthalten, zaehlen mit. */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const geld = (n) => { try { return money(n); } catch (e) { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' €'; } };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tagVon = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const SCHWELLE = 0.15;

  function vorgaenge() { try { return (readTransactions() || []).filter((t) => !t.training); } catch (e) { return []; } }
  /* Stueck dieses Artikels in einer Bonzeile - auch als Teil einer Kombi */
  function stueckIn(item, productId) {
    const q = Number(item.qty || 0);
    if (item.id === productId) return q;
    if (item.isPackage && Array.isArray(item.components)) return item.components.filter((c) => c.id === productId).length * q;
    return 0;
  }
  const zaehltFuerAnteil = (item) => !item.discountLine && item.category !== 'Pfand';

  function daten(productId) {
    const alle = vorgaenge();
    const heute = (() => { try { return localBusinessDate(); } catch (e) { return tagVon(new Date()); } })();
    const jetzt = Date.now();
    const jeStunde = {}, vergleich = {};
    let stueck = 0, betrag = 0, tagesStueck = 0, letzte60 = 0, davor60 = 0;
    const fruehereTage = new Set();
    alle.forEach((t) => {
      const zeit = t.time || t.endTime; const tag = tagVon(zeit);
      if (tag && tag < heute) fruehereTage.add(tag);
      if (tag !== heute) return;
      const ms = new Date(zeit).getTime(), stunde = new Date(zeit).getHours();
      (t.items || []).forEach((i) => {
        if (zaehltFuerAnteil(i)) tagesStueck += Number(i.qty || 0);
        const n = stueckIn(i, productId); if (!n) return;
        stueck += n;
        if (i.id === productId) betrag += (Number(i.price || 0) + Number(i.option?.price || 0)) * Number(i.portionFactor || 1) * Number(i.qty || 0);
        jeStunde[stunde] = (jeStunde[stunde] || 0) + n;
        if (ms > jetzt - 3600e3) letzte60 += n; else if (ms > jetzt - 7200e3) davor60 += n;
      });
    });
    const letzterTag = [...fruehereTage].sort().pop() || null;
    if (letzterTag) alle.forEach((t) => {
      const zeit = t.time || t.endTime; if (tagVon(zeit) !== letzterTag) return;
      const stunde = new Date(zeit).getHours();
      (t.items || []).forEach((i) => { const n = stueckIn(i, productId); if (n) vergleich[stunde] = (vergleich[stunde] || 0) + n; });
    });
    let trend = 'gleich', prozent = 0;
    if (davor60 > 0) { prozent = (letzte60 - davor60) / davor60; trend = prozent > SCHWELLE ? 'hoch' : prozent < -SCHWELLE ? 'runter' : 'gleich'; }
    else if (letzte60 > 0) trend = 'neu';
    return { heute, letzterTag, jeStunde, vergleich, stueck, betrag, tagesStueck, letzte60, davor60, trend, prozent,
      anteil: tagesStueck > 0 ? Math.max(0, stueck) / tagesStueck : 0 };
  }

  function trendHtml(d) {
    const p = Math.round(Math.abs(d.prozent) * 100);
    const zeile = `${d.letzte60}× statt ${d.davor60}× in der Stunde davor`;
    if (d.trend === 'hoch') return `<div class="kc-kurve-pfeil hoch">▲</div><div><strong class="hoch">+${p} %</strong><em>${zeile}</em></div>`;
    if (d.trend === 'runter') return `<div class="kc-kurve-pfeil runter">▼</div><div><strong class="runter">−${p} %</strong><em>${zeile}</em></div>`;
    if (d.trend === 'neu') return `<div class="kc-kurve-pfeil hoch">▲</div><div><strong class="hoch">neu</strong><em>${d.letzte60}× in der letzten Stunde</em></div>`;
    if (!d.letzte60 && !d.davor60) return `<div class="kc-kurve-pfeil gleich">►</div><div><strong>ruhig</strong><em>keine Verkäufe in den letzten 2 Stunden</em></div>`;
    return `<div class="kc-kurve-pfeil gleich">►</div><div><strong>gleich</strong><em>${zeile}</em></div>`;
  }

  function kurveSvg(d, breite, hoehe) {
    const stundenMit = [...Object.keys(d.jeStunde), ...Object.keys(d.vergleich)].map(Number);
    const jetztStunde = new Date().getHours();
    const von = Math.min(10, ...stundenMit), bis = Math.max(von + 6, jetztStunde + 1, ...stundenMit.map((h) => h + 1));
    const werte = [...Object.values(d.jeStunde), ...Object.values(d.vergleich), 1];
    const schritt = Math.max(1, Math.ceil(Math.max(...werte) / 4));
    const max = schritt * 4;
    const L = 46, R = 34, T = 16, B = 38;
    const x = (h) => L + (h - von) / (bis - von) * (breite - L - R);
    const y = (v) => T + (1 - v / max) * (hoehe - T - B);
    let s = '';
    for (let v = 0; v <= max; v += schritt) s += `<line x1="${L}" x2="${breite - R}" y1="${y(v)}" y2="${y(v)}" class="gitter"/><text x="${L - 10}" y="${y(v) + 6}" class="achse" text-anchor="end">${v}</text>`;
    const beschriftungAlle = (bis - von) > 12 ? 2 : 1;
    for (let h = von; h <= bis; h++) if ((h - von) % beschriftungAlle === 0) s += `<text x="${x(h)}" y="${hoehe - 10}" class="achse" text-anchor="middle">${h}:00</text>`;
    // Vergleich letzter Markttag (Punkte je Stundenbeginn, luecken = 0)
    if (d.letzterTag && Object.keys(d.vergleich).length) {
      const pkt = []; for (let h = von; h < bis; h++) pkt.push(`${x(h)},${y(d.vergleich[h] || 0)}`);
      s += `<polyline points="${pkt.join(' ')}" class="vergleich"/>`;
    }
    // heute bis zur aktuellen Stunde
    const heuteBis = Math.min(bis - 1, jetztStunde);
    const pkt = [];
    for (let h = von; h <= heuteBis; h++) pkt.push([h, d.jeStunde[h] || 0]);
    if (pkt.length) {
      s += `<path d="M${x(pkt[0][0])},${y(0)} ${pkt.map(([h, v]) => `L${x(h)},${y(v)}`).join(' ')} L${x(pkt[pkt.length - 1][0])},${y(0)} Z" class="flaeche"/>`;
      s += `<polyline points="${pkt.map(([h, v]) => `${x(h)},${y(v)}`).join(' ')}" class="linie"/>`;
      const spitze = Math.max(...pkt.map(([, v]) => v));
      pkt.forEach(([h, v]) => {
        s += `<circle cx="${x(h)}" cy="${y(v)}" r="${v && v === spitze ? 8 : 5.5}" class="punkt"/>`;
        s += `<circle cx="${x(h)}" cy="${y(v)}" r="24" class="treffer" data-stunde="${h}" data-menge="${v}" data-vergleich="${d.vergleich[h] || 0}"/>`;
      });
    }
    const jetztX = x(Math.min(bis, jetztStunde + new Date().getMinutes() / 60));
    s += `<line x1="${jetztX}" x2="${jetztX}" y1="${T}" y2="${hoehe - B}" class="jetzt"/><text x="${jetztX + 5}" y="${T + 14}" class="jetzt-text">jetzt</text>`;
    return `<svg class="kc-kurve-svg" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}">${s}</svg>`;
  }

  function oeffnen(productId) {
    const dlg = $('salesTimeDialog'); if (!dlg) return false;
    let p = null; try { p = (typeof productsForSale === 'function' ? productsForSale() : []).find((x) => x.id === productId) || PRODUCTS.find((x) => x.id === productId); } catch (e) { /* egal */ }
    const d = daten(productId);
    dlg.classList.add('kc-kurve-modus');
    const kicker = dlg.querySelector('.info-kicker'); if (kicker) kicker.textContent = 'VERKÄUFE HEUTE';
    $('salesTimeTitle').textContent = `★ ${p ? p.name : 'Artikel'}`;
    const stand = new Date();
    $('salesTimeSubtitle').textContent = `${stand.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })} · Stand ${stand.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
    const liste = $('salesTimeList');
    liste.className = 'kc-kurve';
    liste.innerHTML = `
      <div class="kc-kurve-kacheln">
        <div class="kc-kurve-kachel"><span>Heute verkauft</span><div class="wert"><strong>${d.stueck}×</strong>${d.betrag > 0 ? `<em>${geld(d.betrag)}</em>` : ''}</div></div>
        <div class="kc-kurve-kachel"><span>Nachfrage letzte Stunde</span><div class="kc-kurve-trend">${trendHtml(d)}</div></div>
        <div class="kc-kurve-kachel"><span>Anteil am Tagesverkauf</span><div class="wert"><strong>${Math.round(d.anteil * 100)} %</strong><em>von ${d.tagesStueck} Artikeln</em></div><div class="kc-kurve-balken"><i style="width:${Math.min(100, Math.round(d.anteil * 100))}%"></i></div></div>
      </div>
      <div class="kc-kurve-flaeche"><div class="kc-kurve-tip" hidden></div></div>
      <div class="kc-kurve-legende"><span><b class="l-heute"></b>heute</span>${d.letzterTag ? `<span><b class="l-vergleich"></b>letzter Markttag (${esc(new Date(d.letzterTag + 'T12:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }))}), gleiche Uhrzeit</span>` : ''}<span class="kc-kurve-hilfe">Punkt antippen = Stunde genau</span></div>`;
    dlg.showModal();
    // Groesse erst nach dem Oeffnen messen - die Kurve bekommt echte Pixel, damit die Schrift auf
    // jedem Tablet gleich gross bleibt (kein Mitschrumpfen wie bei einer skalierten Grafik).
    const flaeche = liste.querySelector('.kc-kurve-flaeche');
    const zeichnen = () => {
      const breite = Math.max(320, Math.floor(flaeche.clientWidth));
      const frei = window.innerHeight - flaeche.getBoundingClientRect().top - 90;
      const hoehe = Math.max(200, Math.min(380, Math.floor(frei)));
      flaeche.querySelector('svg')?.remove();
      flaeche.insertAdjacentHTML('afterbegin', kurveSvg(d, breite, hoehe));
    };
    requestAnimationFrame(zeichnen);
    const tip = flaeche.querySelector('.kc-kurve-tip');
    flaeche.onclick = (ev) => {
      const t = ev.target.closest('.treffer'); if (!t) { tip.hidden = true; return; }
      const h = Number(t.dataset.stunde), v = Number(t.dataset.menge), vg = Number(t.dataset.vergleich);
      tip.innerHTML = `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00 · <b>${v}×</b>${d.letzterTag ? ` · letzter Markttag ${vg}×` : ''}`;
      tip.hidden = false;
      const r = flaeche.getBoundingClientRect(), c = t.getBoundingClientRect();
      /* Platz: ueber dem Punkt; ist oben kein Platz, seitlich daneben (links, sonst rechts) - der
         Hinweis verdeckt so weder den Punkt noch seine Nachbarn. */
      const mx = c.left - r.left + c.width / 2, my = c.top - r.top + c.height / 2;
      const oben = my - tip.offsetHeight - 14;
      if (oben >= 0) { tip.style.top = oben + 'px'; tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, mx - tip.offsetWidth / 2)) + 'px'; }
      else { tip.style.top = Math.max(0, my - tip.offsetHeight / 2) + 'px'; const links = mx - tip.offsetWidth - 16; tip.style.left = (links >= 0 ? links : mx + 16) + 'px'; }
    };
    return true;
  }
  global.KCVerkaufskurve = { oeffnen, daten };
})(window);
