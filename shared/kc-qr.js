// Ein QR-Zeichner für die ganze Suite - Kasse, PC-Manager und Money Butler.
//
// WARUM ES DIESE DATEI GIBT
// Bis hierher hatte JEDES der drei Programme seine eigene, fast gleiche Zeichenfunktion
// (drawRealQr, drawRealQR, drawQR). Genau darin steckte derselbe Fehler dreimal: die
// Bildfläche war fest (116 px in der Kasse, 300 im Manager, 360 im Butler) und die
// Modulbreite wurde mit floor/ceil gerundet. Sobald der Inhalt länger wurde - ein
// Tagesabschluss hat rund 600 Zeichen und damit etwa 95 Module - blieb gut ein Pixel je
// Modul übrig. Der Code SAH aus wie ein QR-Code, war aber nachweislich nicht mehr
// einlesbar. Er musste an drei Stellen einzeln repariert werden, und die drei Fassungen
// waren danach schon wieder unterschiedlich.
//
// Ab jetzt gilt: die Modulzahl bestimmt die Bildgröße, jedes Modul ist ganzzahlig breit
// und mindestens 4 Pixel groß. Wie groß der Code auf dem Bildschirm erscheint, regelt
// weiterhin das CSS (max-width:100%) - die Bilddatei darf ruhig größer sein als die
// Anzeige, nur kleiner darf sie nie werden.
(function (global) {
  'use strict';

  const MINDESTZELLE = 4;   // Pixel je Modul - darunter wird kein Scanner mehr fündig
  const RUHEZONE = 4;       // Module Rand, wie es die QR-Norm verlangt

  // Text in eine Zeichenkette umwandeln, in der JEDES Zeichen genau einem UTF-8-Byte
  // entspricht. Nur so legt die QR-Bibliothek Umlaute richtig ab (siehe zeichne()).
  function alsUtf8Bytes(text) {
    if (typeof TextEncoder === 'function') {
      const bytes = new TextEncoder().encode(text);
      let ergebnis = '';
      for (let i = 0; i < bytes.length; i++) ergebnis += String.fromCharCode(bytes[i]);
      return ergebnis;
    }
    // Rückfall für sehr alte Umgebungen
    return unescape(encodeURIComponent(text));
  }

  // Ersatzbild, wenn die QR-Bibliothek fehlt: bewusst KEIN scheinbar gültiger Code, sondern
  // ein klar erkennbares Muster mit Hinweis. Ein hübscher, aber unlesbarer Code wäre das
  // Schlimmste - man merkt den Fehler dann erst am Stand.
  function ersatzbild(canvas, text) {
    const kante = 240;
    canvas.width = kante; canvas.height = kante;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, kante, kante);
    ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, kante - 12, kante - 12);
    ctx.fillStyle = '#b3261e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR-Code nicht verfügbar', kante / 2, kante / 2 - 18);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#333';
    ctx.fillText('Bitte den Code als Text', kante / 2, kante / 2 + 8);
    ctx.fillText('darunter verwenden.', kante / 2, kante / 2 + 26);
    if (text) {
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = '#666';
      ctx.fillText(String(text).slice(0, 22) + '…', kante / 2, kante / 2 + 52);
    }
  }

  // canvas   Zeichenfläche
  // text     Inhalt des Codes
  // wunsch   gewünschte Kantenlänge in Pixel; wird nur als UNTERgrenze verstanden.
  //          Braucht der Inhalt mehr Platz, wird das Bild größer - niemals enger.
  function zeichne(canvas, text, wunsch) {
    if (!canvas) return {ok: false, grund: 'keine Zeichenfläche'};
    const qrBibliothek = global.qrcode;
    if (typeof qrBibliothek !== 'function') {
      ersatzbild(canvas, text);
      return {ok: false, grund: 'QR-Modul nicht geladen'};
    }
    try {
      const qr = qrBibliothek(0, 'M');
      // BEFUND aus der TÜV-Prüfung: die QR-Bibliothek schneidet jedes Zeichen auf ein Byte
      // zurück (c & 0xff). Ein "ö" wurde damit als Byte 0xF6 abgelegt - das ist kein gültiges
      // UTF-8. Gegengeprüft mit einem echten Lesegerät (jsQR): "Köcheclub" kam als LEERER
      // Text zurück. Jeder Code mit Umlaut war also unbrauchbar, sah aber tadellos aus.
      // Deshalb wird der Text vorher in einzelne UTF-8-Bytes zerlegt.
      qr.addData(alsUtf8Bytes(String(text)), 'Byte');
      qr.make();
      const module = qr.getModuleCount(), gesamt = module + RUHEZONE * 2;
      // Die ursprünglich gewünschte Breite einmal merken: nach dem ersten Zeichnen steht in
      // canvas.width bereits die neue Größe - ohne diese Notiz würde der Code bei jedem
      // Aufruf ein Stück weiter wachsen.
      const gemerkt = Number(canvas.dataset ? canvas.dataset.kcQrWunsch : 0);
      const ziel = gemerkt || Number(wunsch) || Number(canvas.getAttribute('width')) || 260;
      if (canvas.dataset) canvas.dataset.kcQrWunsch = String(ziel);

      const zelle = Math.max(MINDESTZELLE, Math.ceil(ziel / gesamt));
      const kante = zelle * gesamt;
      canvas.width = kante; canvas.height = kante;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, kante, kante);
      ctx.fillStyle = '#000';
      for (let zeile = 0; zeile < module; zeile++) {
        for (let spalte = 0; spalte < module; spalte++) {
          if (qr.isDark(zeile, spalte)) {
            ctx.fillRect((spalte + RUHEZONE) * zelle, (zeile + RUHEZONE) * zelle, zelle, zelle);
          }
        }
      }
      return {ok: true, module, zelle, kante};
    } catch (fehler) {
      ersatzbild(canvas, text);
      return {ok: false, grund: fehler && fehler.message ? fehler.message : String(fehler)};
    }
  }

  global.KCQrCode = {zeichne, ersatzbild, MINDESTZELLE, RUHEZONE};
})(typeof window !== 'undefined' ? window : globalThis);
