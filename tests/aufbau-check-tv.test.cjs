// KC-CLUB-AUFBAU-CHECK (26.11.2026): Mini-PC merkt sich, wann der Fernseher die Präsentation abgefragt hat, und meldet es in info.tv.
const fs = require('fs');
const assert = require('assert');
const sf = fs.readFileSync('markt-kasse-suite/backend-source/serve-frontend.js', 'utf8');
const sb = fs.readFileSync('markt-kasse-suite/backend-source/stand-bruecke.js', 'utf8');
const tv = sf.slice(sf.indexOf('function behandleTvPaket('));
assert.ok(/if \(req\.method === 'GET'\) \{\n    tvAbrufMerken\(\);/.test(tv), 'jeder GET des Fernsehers wird gemerkt');
assert.ok(/tvAbrufGemerkt < 300000\) return;/.test(sf) && /'tv-abruf\.json'/.test(sf) && /catch \(e\) \{ \/\* nie den Fernseher stören \*\/ \}/.test(sf), 'höchstens alle 5 Min., Fehler stören nie');
assert.ok(/path\.join\(this\.datenOrdner, 'tv-abruf\.json'\)/.test(sb) && /\.\.\.\(tv \? \{ tv \} : \{\}\)/.test(sb), 'Stand-Brücke meldet info.tv');
console.log('aufbau-check-tv: ok');
