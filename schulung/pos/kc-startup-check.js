// KC Sync – Start-Prüfung: zeigt beim Hochfahren der Kasse ein Info-Fenster mit den wichtigsten
// Systemprüfungen, damit sofort klar ist, ob alles betriebsbereit ist - statt es erst beim
// Kassieren zu merken, wenn eine Buchung fehlschlägt.
(function (global) {
  'use strict';

  function erkenneBetriebssystem() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPadOS / iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(platform)) return 'macOS';
    if (/Linux/.test(platform)) return 'Linux';
    return 'Unbekannt (' + platform + ')';
  }

  async function pruefeNetzwerk() {
    // Eigene, einfache Abfrage - unabhängig vom Ampel-Modul, damit die Startprüfung auch dann
    // funktioniert, wenn dieses Modul aus irgendeinem Grund nicht geladen werden konnte.
    const statusUrl = (global.KCSyncConnection?.buildUrl('/kc-sync-status')) || 'http://127.0.0.1:47391/kc-sync-status';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(statusUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, text: 'Datensicherung antwortet nicht' };
      const data = await res.json();
      const farbe = data.connection?.color;
      if (farbe === 'gruen') return { ok: true, text: 'Verbunden' };
      if (farbe === 'gelb') return { ok: true, text: 'Verbunden, wartet auf Abgleich', warn: true };
      return { ok: false, text: 'Datensicherung nicht erreichbar (Kasse arbeitet normal weiter)' };
    } catch (e) {
      return { ok: false, text: 'Datensicherung nicht erreichbar (Kasse arbeitet normal weiter)' };
    }
  }

  async function pruefeDatenbank() {
    try {
      const ok = await (global.__kcTxHydrated || Promise.resolve(false));
      return ok !== false ? { ok: true, text: 'Speicherung auf diesem Gerät aktiv' } : { ok: false, text: 'Konnte nicht geladen werden - Kasse arbeitet vorerst nur im Arbeitsspeicher' };
    } catch (e) {
      return { ok: false, text: 'Fehler beim Laden: ' + e.message };
    }
  }

  function zeile(label, text, ok, warn) {
    const farbe = ok === null ? '#888' : warn ? '#b8860b' : ok ? '#166534' : '#b91c1c';
    const symbol = ok === null ? '…' : warn ? '⚠' : ok ? '✓' : '✗';
    return `<div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid #eee;">
      <span>${label}</span><span style="color:${farbe};font-weight:700;">${symbol} ${text}</span>
    </div>`;
  }

  async function zeigeStartpruefung() {
    // BEFUND (User am Stand): dieses Fenster legte sich auch dann sperrend ueber die ganze
    // Kasse, wenn nur die Datensicherung fehlte - und genau das ist der Normalfall, wenn das
    // Markttag-Fenster noch nicht laeuft. Die Kasse ist dabei voll einsatzfaehig.
    // REGEL JETZT: sperren darf nur, was das Kassieren wirklich verhindert. Fehlt allein die
    // Verbindung, erscheint ein kleiner Hinweis unten, der sich selbst wieder schliesst.
    const overlay = document.createElement('div');
    overlay.dataset.kcSperrend = '0';
    overlay.style.cssText = 'position:fixed;left:0;right:0;top:10px;z-index:99999;display:flex;align-items:flex-start;justify-content:center;font-family:inherit;pointer-events:none;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:18px 22px;min-width:320px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.3);pointer-events:auto;';
    // Oben statt unten: unten liegen Geldwahl, Zahlfeld und die Zahlknoepfe - dort darf nichts
    // im Weg sein. Wird nur gerufen, wenn wirklich etwas das Kassieren verhindert.
    const zuSperrfensterMachen = () => {
      overlay.dataset.kcSperrend = '1';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,17,31,.85);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:inherit;';
      box.style.padding = '24px 28px';
    };
    box.innerHTML = `
      <div style="font-size:1.3rem;font-weight:900;margin-bottom:4px;">KC MarktKasse</div>
      <div style="color:#666;margin-bottom:14px;">Version ${global.__kcVersion || '?'} · ${erkenneBetriebssystem()}</div>
      <div id="kcStartupRows">
        ${zeile('Netzwerk', 'wird geprüft …', null)}
        ${zeile('Datenbank', 'wird geprüft …', null)}
      </div>
      <div id="kcStartupSummary" style="margin-top:14px;font-weight:700;"></div>
      <button id="kcStartupOk" type="button" disabled style="margin-top:16px;width:100%;padding:12px;font-size:1.05rem;font-weight:900;border-radius:8px;border:none;background:#166534;color:#fff;cursor:pointer;opacity:.5;">OK</button>
      <button id="kcStartklarLink" type="button" style="margin-top:8px;width:100%;padding:9px;font-size:.9rem;font-weight:700;border-radius:8px;border:1px solid #cbd5e1;background:#f1f5f9;color:#172033;cursor:pointer;">Ausf\u00fchrliche Startklar-Pr\u00fcfung \u00f6ffnen</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const [netz, db] = await Promise.all([pruefeNetzwerk(), pruefeDatenbank()]);
    document.getElementById('kcStartupRows').innerHTML =
      zeile('Netzwerk', netz.text, netz.ok, netz.warn) +
      zeile('Datenbank', db.text, db.ok, db.warn);

    // Netzwerk ist bewusst NICHT zwingend fuer "betriebsbereit" - die Kasse ist als Local-First-
    // System ausdruecklich auch offline voll einsatzfaehig (siehe Grundkonzept). Nur die
    // Datenbank (lokale Speicherung) ist wirklich zwingend.
    const bereit = db.ok;
    const summary = document.getElementById('kcStartupSummary');
    summary.style.color = bereit ? '#166534' : '#b91c1c';
    summary.textContent = bereit
      ? (netz.ok ? 'Alles betriebsbereit.' : 'Betriebsbereit (offline - ohne Verbindung zum Manager).')
      : 'Achtung: Datenbank konnte nicht geladen werden - bitte Seite neu laden, bevor kassiert wird.';

    const okBtn = document.getElementById('kcStartupOk');
    okBtn.disabled = false;
    okBtn.style.opacity = '1';
    if (!bereit) {
      okBtn.style.background = '#b91c1c';
      okBtn.textContent = 'Trotzdem fortfahren';
      zuSperrfensterMachen();          // nur hier ist Sperren gerechtfertigt
    }
    okBtn.addEventListener('click', () => overlay.remove());
    // Ist die Kasse einsatzfaehig, verschwindet der Hinweis von selbst - niemand muss ihn
    // wegklicken, bevor der erste Gast bedient werden kann.
    if (bereit) setTimeout(() => overlay.remove(), 7000);
    // Vor dem Markttag will man mehr wissen als "geht/geht nicht": die ausfuehrliche Pruefung
    // nennt jeden Punkt einzeln und sagt dazu, was zu tun ist. Verbindungsangaben werden
    // mitgegeben, damit die Seite dieselbe Kasse prueft wie diese hier.
    box.querySelector('#kcStartklarLink')?.addEventListener('click', () => {
      const c = global.KCSyncConnection?.config || {};
      const p = new URLSearchParams();
      if (c.host) p.set('kcHost', c.host);
      if (c.port) p.set('kcPort', c.port);
      if (c.token) p.set('kcToken', c.token);
      if (c.registerId) p.set('kcRegisterId', c.registerId);
      location.href = 'startklar.html' + (p.toString() ? '?' + p : '');
    });
  }

  // Befund (echter Testlauf): dieses Fenster erschien bisher GLEICHZEITIG mit dem bestehenden
  // "Kasse im Vollbild starten"-Hinweis, beide mit derselben hohen Ebene übereinander - dadurch
  // blockierten sie sich gegenseitig echte Klicks auf die dahinterliegenden Kassenknöpfe, auch
  // nachdem eines der beiden weggeklickt wurde. Wartet jetzt, bis das Vollbild-Fenster
  // tatsächlich verschwunden ist (bzw. gar nicht erst erscheint), bevor die eigene Prüfung
  // gezeigt wird - beide erscheinen dadurch sauber nacheinander statt übereinander.
  function wartenAufVollbildHinweis() {
    return new Promise((resolve) => {
      const check = () => {
        const gate = document.getElementById('fullscreenGate');
        if (!gate || gate.hidden) { resolve(); return; }
        setTimeout(check, 200);
      };
      check();
    });
  }

  async function zeigeStartpruefungWennBereit() {
    await wartenAufVollbildHinweis();
    await zeigeStartpruefung();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', zeigeStartpruefungWennBereit);
  else zeigeStartpruefungWennBereit();
})(window);
