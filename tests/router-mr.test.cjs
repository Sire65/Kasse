// Router-Auslesen (TP-Link MR, verschlüsselte Oberfläche) gegen einen nachgebauten Router.
// Prüft den Ablauf getParm -> login -> Token -> cgi_gdpr -> logout und die Verschlüsselung.
// Ob die echte Firmware genau so antwortet, prüft erst KC_Router_Pruefen.cmd am Mini-PC.
const http = require('http'), crypto = require('crypto'), path = require('path');
const { TpLinkMr } = require(path.join(__dirname, '../markt-kasse-suite/backend-source/router-mr.js'));
let fehler = 0; const ok = (b, t, z = '') => { console.log(`${b ? 'OK    ' : 'FEHLER'} ${t}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 512 });
const jwk = publicKey.export({ format: 'jwk' });
const hex = (b64u) => Buffer.from(b64u, 'base64url').toString('hex');
const NN = hex(jwk.n), EE = hex(jwk.e).replace(/^0+/, '') || '1', SEQ = '458712345', PASS = 'Geheim-123';
let sitzung = null; const angefragt = [];
function rsaAuf(signHex) {
  const block = NN.length; let t = '';
  for (let i = 0; i < signHex.length; i += block) t += crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(signHex.slice(i, i + block), 'hex')).toString('utf8');
  return Object.fromEntries(new URLSearchParams(t));
}
const aes = (k, iv, b64) => { const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(k), Buffer.from(iv)); return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8'); };
const aesZu = (k, iv, t) => { const c = crypto.createCipheriv('aes-128-cbc', Buffer.from(k), Buffer.from(iv)); return Buffer.concat([c.update(t), c.final()]).toString('base64'); };
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

const server = http.createServer((req, res) => {
  const teile = []; req.on('data', (c) => teile.push(c)); req.on('end', () => {
    const url = new URL(req.url, 'http://x'); const body = Buffer.concat(teile).toString();
    angefragt.push(url.pathname);
    if (url.pathname === '/cgi/getParm') return res.end(`var ee="${EE}";\nvar nn="${NN}";\nvar seq="${SEQ}";\n$.ret=0;`);
    if (url.pathname === '/cgi/login') {
      const s = rsaAuf(url.searchParams.get('sign')); const daten = url.searchParams.get('data');
      const klar = aes(s.k, s.iv || s.i, daten);
      const [benutzer, pw] = klar.split('\n');
      const pruef = s.h === md5(benutzer + pw) && Number(s.s) === Number(SEQ) + daten.length;
      if (!pruef || pw !== PASS) return res.end('$.ret=71233;');
      sitzung = { k: s.k, iv: s.i, hash: s.h, id: 'abc' }; res.setHeader('Set-Cookie', 'JSESSIONID=abc; Path=/'); return res.end('$.ret=0;');
    }
    if (url.pathname === '/') return res.end(sitzung ? '<script>var token="tok-42";</script>' : '');
    if (url.pathname === '/cgi_gdpr') {
      if (!sitzung || req.headers.tokenid !== 'tok-42' || !/JSESSIONID=abc/.test(req.headers.cookie || '')) { res.statusCode = 403; return res.end('nein'); }
      const sign = (body.match(/sign=([0-9a-f]+)/) || [])[1], data = (body.match(/data=([^\r\n]+)/) || [])[1];
      const s = rsaAuf(sign); if (s.h !== sitzung.hash || Number(s.s) !== Number(SEQ) + data.length) { res.statusCode = 403; return res.end('sign'); }
      const anfrage = aes(sitzung.k, sitzung.iv, data);
      let antwort; const sk = sitzung;
      if (anfrage.includes('/cgi/logout')) { sitzung = null; antwort = '[cgi]0\r\n[error]0\r\n'; }
      else antwort = '[2,0,0,0,0,0]0\r\ndataLimit=0\r\nenablePaymentDay=0\r\ncurStatistics=1004000000\r\ntotalStatistics=1997000000\r\nenableDataLimit=1\r\nlimitation=100000000000\r\n[2,1,0,0,0,0]1\r\nsigLevel=3\r\n[2,1,0,0,0,0]2\r\nispName=o2 - de\r\n[error]0\r\n';
      return res.end(aesZu(sk.k, sk.iv, antwort));
    }
    res.statusCode = 404; res.end();
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  // Port über eigene Anfrage-Funktion einspeisen (Produktivcode nutzt Port 80)
  const neu = (pw) => { const r = new TpLinkMr({ adresse: '127.0.0.1', passwort: pw });
    const echt = r._anfrage.bind(r);
    r._anfrage = (m, p, x) => { const h = http.request; http.request = (opt, cb) => h({ ...opt, port }, cb); try { return echt(m, p, x); } finally { http.request = h; } };
    return r; };
  const r = neu(PASS);
  await r.anmelden();
  ok(r.token === 'tok-42', 'Anmeldung: Token gelesen');
  const d = await r.datenverbrauch();
  ok(d.gesamtBytes === 1997000000, 'Gesamtverbrauch gelesen', d.gesamtBytes);
  ok(d.limitAktiv && d.limitBytes === 100000000000, 'Datenlimit gelesen');
  ok(d.anbieter === 'o2 - de' && d.signal === 3, 'Anbieter/Signal gelesen');
  await r.abmelden();
  ok(sitzung === null, 'Abgemeldet (Router für den Browser wieder frei)');
  let falsch = null; try { await neu('falsch').anmelden(); } catch (e) { falsch = e.message; }
  ok(/Passwort falsch/.test(falsch || ''), 'Falsches Passwort: klare Meldung', falsch);
  ok(!JSON.stringify(angefragt).includes(PASS), 'Passwort nie im Klartext in Adressen');
  server.close();
  console.log(fehler ? `\n${fehler} FEHLER` : '\nRouter-Auslesen (nachgebaut): alles bestanden');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
