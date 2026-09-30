/* KC Altbrowser-Nachruestung                                                      30.09.2026
 *
 * ANLASS (Betreiber-Fotos vom Samsung-Tablet SM-T535, Android 5, Samsung-Browser): leere Kacheln,
 * "mehr" blaettert nicht, Parken-Fenster geht nicht auf. Nachgestellt mit einem echten Chromium 83
 * (Stand des Samsung-Browsers auf Android 5). Die CSS-Seite ist direkt in den Stylesheets behoben
 * (inset -> top/right/bottom/left, aspect-ratio-Rueckfall in images-v3). Diese Datei ergaenzt die
 * JavaScript-Funktionen, die die Kasse benutzt, die es in so alten Browsern aber noch nicht gibt.
 *
 * Grundregel: Es wird NUR ergaenzt, was fehlt. Auf aktuellen Geraeten (iPad, neuer Chrome) tut
 * diese Datei nichts. Bewusst altes, einfaches JavaScript, damit sie selbst ueberall laeuft.
 * Muss VOR allen anderen Skripten der Kasse geladen werden.
 */
(function () {
  'use strict';
  var nachgeruestet = [];
  function ergaenze(ziel, name, fn) {
    if (ziel && typeof ziel[name] !== 'function') {
      nachgeruestet.push(name);
      try { Object.defineProperty(ziel, name, { value: fn, writable: true, configurable: true }); } catch (e) { ziel[name] = fn; }
    }
  }
  // Array/String.prototype.at (Chrome 92): letztes Element per .at(-1)
  function at(n) {
    n = Math.trunc(n) || 0; if (n < 0) n += this.length;
    return n < 0 || n >= this.length ? undefined : this[n];
  }
  ergaenze(Array.prototype, 'at', at);
  ergaenze(String.prototype, 'at', at);
  // String.prototype.replaceAll (Chrome 85)
  ergaenze(String.prototype, 'replaceAll', function (suche, ersatz) {
    if (suche instanceof RegExp) {
      if (!suche.global) throw new TypeError('replaceAll braucht einen globalen regulaeren Ausdruck');
      return this.replace(suche, ersatz);
    }
    return this.split(String(suche)).join(typeof ersatz === 'function' ? ersatz(String(suche)) : String(ersatz));
  });
  // Object.hasOwn (Chrome 93)
  ergaenze(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  // AbortSignal.timeout (Chrome 103): wird fuer Zeitlimits bei Netzabfragen benutzt
  if (typeof AbortSignal !== 'undefined' && typeof AbortController !== 'undefined') {
    ergaenze(AbortSignal, 'timeout', function (ms) {
      var c = new AbortController();
      setTimeout(function () { try { c.abort(); } catch (e) { /* egal */ } }, ms);
      return c.signal;
    });
  }
  // structuredClone (Chrome 98): einfacher Rueckfall fuer reine Daten
  if (typeof window.structuredClone !== 'function') {
    nachgeruestet.push('structuredClone');
    window.structuredClone = function (wert) { return wert === undefined ? undefined : JSON.parse(JSON.stringify(wert)); };
  }
  // Element.replaceChildren (Chrome 86)
  if (typeof Element !== 'undefined') {
    ergaenze(Element.prototype, 'replaceChildren', function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i = 0; i < arguments.length; i++) {
        var k = arguments[i]; this.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
      }
    });
  }
  // Kleine Artikelbilder (Betreiber 30.09.2026: "sehr sehr langsam bauen sich die Bilder"):
  // Die Artikelbilder assets/*_version_3.png sind je 1,4-2 MB gross. Ein altes Tablet braucht zum
  // Laden und Entpacken so grosser Bilder sehr lange. Auf alten Browsern (erkennbar wie in
  // images-v3.js am fehlenden aspect-ratio) wird jedes solche Bild gegen die kleine Kopie in
  // assets/klein/ (640 px, webp) getauscht - schon im HTML-Text, bevor der Browser es anfordert.
  // Nur <img src>, nie gespeicherte Daten oder Eingabefelder. Fehlt eine kleine Kopie, kommt
  // automatisch das grosse Bild zurueck. Aktuelle Geraete (iPad, neuer Chrome): keine Aenderung.
  var html = typeof document !== 'undefined' && document.documentElement;
  var ohneSeitenverhaeltnis = false;
  try { ohneSeitenverhaeltnis = !(window.CSS && CSS.supports && CSS.supports('aspect-ratio', '1 / 1')); } catch (e) { ohneSeitenverhaeltnis = true; }
  var GROSS = /(^|\/)assets\/([\w-]+_version_3)\.png(?=$|\?)/;
  var KLEIN = /(^|\/)assets\/klein\/([\w-]+_version_3)\.webp(?=$|\?)/;
  var IMG_IM_TEXT = /(<img\b[^>]*?\ssrc\s*=\s*["'])([^"']*)/gi;
  var ohneKlein = {};
  function kleinerPfad(src) {
    var m = typeof src === 'string' && src.match(GROSS);
    return m && !ohneKlein[m[2]] ? src.replace(GROSS, '$1assets/klein/$2.webp') : src;
  }
  function kleinerText(text) {
    return typeof text === 'string' && text.indexOf('_version_3.png') >= 0
      ? text.replace(IMG_IM_TEXT, function (x, anfang, src) { return anfang + kleinerPfad(src); }) : text;
  }
  function kleinesBild(img) {
    var src = img.getAttribute && img.getAttribute('src');
    var klein = kleinerPfad(src);
    if (klein !== src) img.setAttribute('src', klein);
  }
  function durchsuche(knoten) {
    if (!knoten || knoten.nodeType !== 1) return;
    if (knoten.tagName === 'IMG') kleinesBild(knoten);
    else if (knoten.getElementsByTagName) { var bilder = knoten.getElementsByTagName('img'); for (var i = 0; i < bilder.length; i++) kleinesBild(bilder[i]); }
  }
  function umhuelle(proto, name, tausch) {
    var d = proto && Object.getOwnPropertyDescriptor(proto, name);
    if (!d || !d.set || !d.configurable) return;
    Object.defineProperty(proto, name, { configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (wert) { d.set.call(this, tausch.call(this, wert)); } });
  }
  if (html && ohneSeitenverhaeltnis && typeof MutationObserver === 'function') {
    nachgeruestet.push('kleineBilder');
    try {
      umhuelle(Element.prototype, 'innerHTML', kleinerText);
      umhuelle(HTMLImageElement.prototype, 'src', kleinerPfad);
      var einfuegen = Element.prototype.insertAdjacentHTML;
      if (einfuegen) Element.prototype.insertAdjacentHTML = function (wo, text) { return einfuegen.call(this, wo, kleinerText(text)); };
    } catch (e) { /* dann greift nur die Beobachtung unten */ }
    // Sicherheitsnetz fuer alles andere (setAttribute, Seiten-HTML): beim Einfuegen tauschen.
    new MutationObserver(function (aenderungen) {
      for (var i = 0; i < aenderungen.length; i++) {
        var a = aenderungen[i];
        if (a.type === 'attributes') kleinesBild(a.target);
        else for (var j = 0; j < a.addedNodes.length; j++) durchsuche(a.addedNodes[j]);
      }
    }).observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    durchsuche(html);
    // Kleine Kopie fehlt -> grosses Bild zurueck (und fuer dieses Bild nicht mehr tauschen).
    document.addEventListener('error', function (ev) {
      var img = ev.target, src = img && img.tagName === 'IMG' && img.getAttribute('src');
      var m = src && src.match(KLEIN);
      if (!m) return;
      ohneKlein[m[2]] = true;
      img.setAttribute('src', src.replace(KLEIN, '$1assets/$2.png'));
    }, true);
  }

  // Fuer die Diagnose: was musste nachgeruestet werden? (leer = aktueller Browser)
  window.KC_ALTBROWSER_NACHGERUESTET = nachgeruestet;
})();
