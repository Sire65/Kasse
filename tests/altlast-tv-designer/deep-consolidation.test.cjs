const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'latest-release-manifest.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'cores', 'STUDIO_TUV_COMPONENT_REGISTRY_V1.json'), 'utf8'));
const integration = fs.readFileSync(path.join(root, 'pc-manager', 'release-manifest-integration.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'pc-manager', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'pc-manager', 'styles.css'), 'utf8');

const required = Object.entries(manifest.components)
  .filter(([, value]) => value.runtimeRequired !== false)
  .map(([id]) => id)
  .sort();
const external = Object.entries(manifest.components)
  .filter(([, value]) => value.runtimeRequired === false)
  .map(([id]) => id)
  .sort();

assert.deepEqual([...registry.managerRuntimeComponents].sort(), required, 'Studio/TÜV registry must cover every manager runtime component');
assert.deepEqual([...registry.externalConsumerComponents].sort(), external, 'External consumers must be explicitly catalogued');
required.forEach(id => assert.match(integration, new RegExp(`\\b${id}\\s*:`), `release relay must register ${id}`));

const scripts = [...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(scripts).size, scripts.length, 'Every PC-Manager script must be loaded once');
assert.ok(scripts.indexOf('../latest-release-manifest.js') < scripts.indexOf('app.js'), 'Runtime flags and manifest must load before app.js');
assert.ok(scripts.indexOf('tv-shared-renderer-v02946.js') > scripts.indexOf('tv-weihnachtsmarkt-presentation.js'), 'Shared renderer must be the final presentation renderer layer');

assert.match(css, /#tvSlideList \.tv-slide-item\{padding-left:8px!important\}/, 'Slide card must retain its readable content width');
assert.match(css, /left:0!important;top:0!important;transform:translate\(-50%,-50%\)!important/, 'Slide number must be centered exactly on the upper-left frame corner');
assert.match(css, /#tvSlideList \.tv-slide-item\.active \.kc-slide-number/, 'Active slide number needs a separate color');

console.log('Deep consolidation registry, release relay, load order and slide-number gutter: OK');
