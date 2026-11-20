'use strict';
// TP-Link Archer MR-Reihe (LTE-Router, z. B. MR200 v5+/v8): Datenzähler und Mobilfunkstatus auslesen.
//
// Die Oberfläche dieser Router ist verschlüsselt (RSA-Signatur + AES-128-CBC, Endpunkt /cgi_gdpr).
// Ablauf wie im Browser: 1) /cgi/getParm liefert RSA-Schlüssel (nn, ee) und Folgenummer (seq),
// 2) /cgi/login mit verschlüsseltem "admin\nPasswort", 3) Startseite liefert das Sitzungs-Token,
// 4) Abfragen an /cgi_gdpr, 5) Abmelden (sonst bleibt der Router für den Browser gesperrt).
// Das Passwort bleibt im Speicher dieses Programms; es wird nirgends protokolliert oder verschickt.
const http = require('http');
const crypto = require('crypto');

const GET = 1, CGI = 8;

function zufallsZiffern(n) { let s = ''; while (s.length < n) s += String(crypto.randomInt(0, 10)); return s; }
function b64url(hex) { return Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex').toString('base64url'); }

class TpLinkMr {
  constructor({ adresse = '192.168.1.1', benutzer = 'admin', passwort, protokoll = () => {}, zeitlimitMs = 8000 } = {}) {
    this.adresse = adresse; this.benutzer = benutzer; this.passwort = String(passwort || '');
    this.protokoll = protokoll; this.zeitlimitMs = zeitlimitMs;
    this.cookie = ''; this.token = ''; this.aesKey = zufallsZiffern(16); this.aesIv = zufallsZiffern(16);
    this.hash = crypto.createHash('md5').update(this.benutzer + this.passwort).digest('hex');
  }

  _anfrage(methode, pfad, { koerper = null, kopf = {} } = {}) {
    return new Promise((ok, fehler) => {
      const headers = { Referer: `http://${this.adresse}/`, ...kopf };
      if (this.cookie) headers.Cookie = this.cookie;
      if (koerper !== null) { headers['Content-Type'] = 'text/plain'; headers['Content-Length'] = Buffer.byteLength(koerper); }
      const req = http.request({ host: this.adresse, port: 80, method: methode, path: pfad, headers, timeout: this.zeitlimitMs }, (res) => {
        const teile = []; res.on('data', (c) => teile.push(c));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          if (setCookie && setCookie.length) this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
          ok({ status: res.statusCode, text: Buffer.concat(teile).toString('utf8') });
        });
      });
      req.on('timeout', () => req.destroy(new Error(`Router antwortet nicht (${this.adresse}, ${this.zeitlimitMs} ms)`)));
      req.on('error', fehler);
      if (koerper !== null) req.write(koerper);
      req.end();
    });
  }

  _aesVerschluesseln(text) {
    const c = crypto.createCipheriv('aes-128-cbc', Buffer.from(this.aesKey, 'utf8'), Buffer.from(this.aesIv, 'utf8'));
    return Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64');
  }
  _aesEntschluesseln(b64) {
    const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(this.aesKey, 'utf8'), Buffer.from(this.aesIv, 'utf8'));
    return Buffer.concat([d.update(Buffer.from(String(b64).trim(), 'base64')), d.final()]).toString('utf8');
  }
  _rsa(text) {
    const key = crypto.createPublicKey({ key: { kty: 'RSA', n: b64url(this.nn), e: b64url(this.ee) }, format: 'jwk' });
    const block = Math.floor(this.nn.length / 2) - 11;   // PKCS#1 v1.5: Schlüssellänge in Byte minus 11
    let aus = '';
    for (let i = 0; i < text.length; i += block) {
      aus += crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(text.slice(i, i + block), 'utf8')).toString('hex');
    }
    return aus;
  }
  _paket(klartext, istLogin) {
    const data = this._aesVerschluesseln(klartext);
    const s = Number(this.seq) + data.length;
    const sign = this._rsa(istLogin ? `k=${this.aesKey}&i=${this.aesIv}&h=${this.hash}&s=${s}` : `h=${this.hash}&s=${s}`);
    return { data, sign };
  }

  async anmelden() {
    const p = await this._anfrage('POST', '/cgi/getParm');
    this.protokoll(`getParm: HTTP ${p.status}, ${p.text.length} Zeichen`);
    const such = (n) => (p.text.match(new RegExp(`var ${n}\\s*=\\s*"([^"]*)"`)) || [])[1];
    this.ee = such('ee'); this.nn = such('nn'); this.seq = such('seq');
    if (!this.ee || !this.nn || !this.seq) throw new Error('Router-Schlüssel nicht gefunden (anderes Router-Modell oder andere Firmware). Antwort-Anfang: ' + p.text.slice(0, 160).replace(/\s+/g, ' '));
    this.protokoll(`RSA-Schlüssel: ${this.nn.length * 4} Bit, seq vorhanden`);
    const { data, sign } = this._paket(`${this.benutzer}\n${this.passwort}`, true);
    const l = await this._anfrage('POST', `/cgi/login?data=${encodeURIComponent(data)}&sign=${sign}&Action=1&LoginStatus=0`);
    const ret = (l.text.match(/\$\.ret\s*=\s*(-?\d+)/) || [])[1];
    this.protokoll(`login: HTTP ${l.status}, ret=${ret}`);
    if (ret === undefined) throw new Error('Anmeldung: unerwartete Antwort. Anfang: ' + l.text.slice(0, 160).replace(/\s+/g, ' '));
    if (ret !== '0') {
      const grund = { 71233: 'Passwort falsch', 71234: 'zu viele Versuche – kurz warten', 71235: 'bereits jemand anderes angemeldet (Router-Oberfläche im Browser abmelden)' }[ret] || `Fehlercode ${ret}`;
      throw new Error('Anmeldung am Router abgelehnt: ' + grund);
    }
    const start = await this._anfrage('GET', '/');
    this.token = (start.text.match(/var token\s*=\s*"([^"]+)"/) || [])[1] || '';
    this.protokoll(`Startseite: HTTP ${start.status}, Token ${this.token ? 'gefunden' : 'NICHT gefunden'}`);
    if (!this.token) throw new Error('Anmeldung ok, aber kein Sitzungs-Token auf der Startseite gefunden.');
  }

  // aktionen: [{ typ, oid, stack, pstack, attrs }]
  async abfrage(aktionen) {
    const typen = aktionen.map((a) => a.typ || GET).join('&');
    const rumpf = aktionen.map((a, i) => `[${a.oid}#${a.stack || '0,0,0,0,0,0'}#${a.pstack || '0,0,0,0,0,0'}]${i},${(a.attrs || []).length}\r\n${(a.attrs || []).map((x) => x + '\r\n').join('')}`).join('');
    const { data, sign } = this._paket(`${typen}\r\n${rumpf}`, false);
    const r = await this._anfrage('POST', '/cgi_gdpr', { koerper: `sign=${sign}\r\ndata=${data}\r\n`, kopf: { TokenID: this.token } });
    let klar;
    try { klar = this._aesEntschluesseln(r.text); } catch (e) { klar = r.text; }
    this.protokoll(`cgi_gdpr: HTTP ${r.status}, ${klar.length} Zeichen`);
    return { status: r.status, text: klar, werte: TpLinkMr.zerlege(klar) };
  }

  static zerlege(text) {
    const bloecke = []; let akt = null;
    for (const zeile of String(text).split(/\r?\n/)) {
      const kopf = zeile.match(/^\[(.*?)\](\d+)$/);
      if (kopf) { akt = { stack: kopf[1], index: Number(kopf[2]), werte: {} }; bloecke.push(akt); continue; }
      const kv = zeile.match(/^([^=]+)=(.*)$/);
      if (kv && akt) akt.werte[kv[1]] = kv[2];
    }
    return bloecke;
  }

  async abmelden() {
    try { await this.abfrage([{ typ: CGI, oid: '/cgi/logout' }]); this.protokoll('abgemeldet'); }
    catch (e) { this.protokoll('Abmelden nicht bestätigt: ' + e.message); }
  }

  // Ergebnis: { gesamtBytes, aktuellBytes, limitBytes, limitAktiv, signal, anbieter, roh }
  async datenverbrauch() {
    const r = await this.abfrage([
      { oid: 'WAN_LTE_INTF_CFG', stack: '2,0,0,0,0,0', attrs: ['dataLimit', 'enablePaymentDay', 'curStatistics', 'totalStatistics', 'enableDataLimit', 'limitation', 'curRxSpeed', 'curTxSpeed'] },
      { oid: 'LTE_NET_STATUS', stack: '2,1,0,0,0,0', attrs: ['sigLevel', 'rfInfoRsrp', 'rfInfoRsrq', 'rfInfoSnr'] },
      { oid: 'LTE_PROF_STAT', stack: '2,1,0,0,0,0', attrs: ['spn', 'ispName'] },
    ]);
    const alle = Object.assign({}, ...r.werte.map((b) => b.werte));
    const zahl = (v) => (v === undefined || v === '' ? null : Number(v));
    return {
      gesamtBytes: zahl(alle.totalStatistics), aktuellBytes: zahl(alle.curStatistics),
      limitBytes: zahl(alle.limitation), limitAktiv: alle.enableDataLimit === '1',
      signal: zahl(alle.sigLevel), anbieter: alle.ispName || alle.spn || null, roh: r.text,
    };
  }
}

module.exports = { TpLinkMr, zufallsZiffern };
