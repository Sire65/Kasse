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
  // Fuer die Diagnose: was musste nachgeruestet werden? (leer = aktueller Browser)
  window.KC_ALTBROWSER_NACHGERUESTET = nachgeruestet;
})();
