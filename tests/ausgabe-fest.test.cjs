// KC-AUSGABE-FEST (26.11.2026, Wunsch Hansi): feste Ausgabegefäße – der PC-Manager holt nach dem Abgleich den festen Stand zurück
// und setzt keine zweite Serviette in die Rezeptkalkulation.
const fs = require('fs');
const assert = require('assert');
const sb = fs.readFileSync('pc-manager/recipe-serving-materials-supabase.js', 'utf8');
const rm = fs.readFileSync('pc-manager/recipe-serving-materials.js', 'utf8');
const push = sb.slice(sb.indexOf('async function push()'), sb.indexOf('async function pushPending()'));
assert.ok(/await pull\(\);\s*global\.dispatchEvent\(new CustomEvent\('kc-serving-materials-synced',\{detail:\{direction:'push'\}\}\)\)/.test(push), 'nach push den festen Stand holen');
assert.ok(rm.includes("'knirpsecreme','mettwurst'"), 'Mettendchen ist eine Speise (Einwegschale)');
assert.ok(rm.includes("hatServiette") && rm.includes("/^servietten?$/i"), 'keine doppelte Serviette');
assert.ok(fs.readFileSync('pc-manager/release-manifest-integration.js', 'utf8').includes('recipe-serving-materials.js?v=0.5.1'), 'neue Fassung wird geladen');
console.log('ausgabe-fest: ok');
