const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=file=>fs.readFileSync(file,"utf8");

const html=read("pc-manager/index.html");
const app=read("pc-manager/app.js");
const messages=read("pc-manager/manager-message-integration-v010.js");
const editor=read("pc-manager/tv-unified-editor.js");
const matrix=read("pc-manager/tv-display-matrix-adapter.js");
const css=read("pc-manager/styles.css");
const manifest=read("latest-release-manifest.json");

assert.match(html,/id="deleteRegister"/);
assert.match(app,/Kasse „\$\{target\.name\}“.*wirklich löschen/);
assert.match(app,/queueSync\("register","delete",target\)/);
assert.match(messages,/VERSION='0\.2\.0'/);
assert.match(editor,/data-transition="type"/);
assert.match(editor,/data-test-transition/);
assert.match(matrix,/data-matrix-layout/);
assert.match(css,/kc-matrix-only>\.kc-property-section/);
assert.match(manifest,/"autoContrast"[\s\S]*"0\.29\.30"/);

console.log("PASS Repair 51: Kassenlöschung, Meldungen, Übergänge und ein konsolidierter Laufschriftbereich");
