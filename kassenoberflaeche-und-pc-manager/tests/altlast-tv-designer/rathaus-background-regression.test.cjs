const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const content = fs.readFileSync(path.join(root, 'tv-content', 'weihnachtsmarkt-2026', 'presentation.js'), 'utf8');
const integration = fs.readFileSync(path.join(root, 'pc-manager', 'tv-weihnachtsmarkt-presentation.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'pc-manager', 'tv-editor-shell-v02935.js'), 'utf8');
const stability = fs.readFileSync(path.join(root, 'pc-manager', 'tv-manager-stability-v02936.js'), 'utf8');

assert.match(content, /"market-window-lights": \{ label: "Rathaus Werne · Weihnachtsmarkt"/);
assert.match(content, /\.\.\/media\/backgrounds\/rathaus-werne-weihnachtsmarkt-v1\.png/);
const asset = path.join(root, 'media', 'backgrounds', 'rathaus-werne-weihnachtsmarkt-v1.png');
assert.ok(fs.existsSync(asset));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex').toUpperCase(), '1AE21C9CBFDA29E9EB38D692611A1A54A3504E0F853B00DBF634E520F7D6D8AF', 'The approved light-snow Rathaus image must not be replaced');
assert.match(integration, /const selected=current\(\);[\s\S]*selected\?\.backgroundPreset/, 'Apply-all must read the currently selected slide');
assert.match(integration, /return targets\.length/, 'Background application must report its real target count');
assert.doesNotMatch(shell, /className='kc-toggle-nav'/, 'Legacy left collapse control must not be created');
assert.match(shell, /localStorage\.removeItem\('kc-nav-collapsed'\)/, 'Stale legacy collapse state must be removed');
assert.doesNotMatch(stability, /const nav=document\.querySelector/, 'Stability layer must not bind the removed legacy control');

console.log('Rathaus background, active-slide transfer and legacy navigation cleanup: OK');
