const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coreSource = fs.readFileSync(
  path.join(root, "cores/table-core/table-core.js"),
  "utf8"
);
const context = { globalThis: {} };
vm.runInNewContext(coreSource, context);
const core = context.globalThis.TableCore;

assert.equal(core.version, "1.1.0");
const model = core.create(["name", "preis"]);
model.add({ __id: "2", name: "Zimt", preis: 2 });
model.add({ __id: "1", name: "Apfel", preis: 10 });
assert.equal([...model.sortBy("name")].map(row => row.name).join("|"), "Apfel|Zimt");
assert.equal([...model.sortBy("preis", "desc")].map(row => row.preis).join("|"), "10|2");
assert.equal(model.filter("name", "zim").length, 1);
assert.equal(model.filterAny("apf").length, 1);
model.select("1");
assert.equal([...model.selection()].join("|"), "1");
assert.throws(() => core.create([]), error => error.code === "COLUMNS_REQUIRED");
assert.throws(() => model.sortBy("unbekannt"), error => error.code === "UNKNOWN_COLUMN");

const adapter = fs.readFileSync(
  path.join(root, "pc-manager/manager-table-core.js"),
  "utf8"
);
[
  "applySort",
  "moveColumn",
  "autoFit",
  "pointerdown",
  "ArrowLeft",
  "ArrowRight",
  "MutationObserver",
  "localStorage",
  "#tvPreviewScreen",
  "#tvPresentationStage",
  ".qr-code"
].forEach(marker => assert.ok(adapter.includes(marker), `Adaptermarker fehlt: ${marker}`));

const index = fs.readFileSync(path.join(root, "pc-manager/index.html"), "utf8");
assert.match(index, /cores\/table-core\/table-core\.js/);
assert.match(index, /manager-table-core\.js/);
assert.match(index, /manager-table-core\.css/);
assert.ok(fs.existsSync(path.join(root, "cores/table-core/studio-catalog-entry.json")));
assert.ok(fs.existsSync(path.join(root, "cores/table-core/tuv-rules.json")));

console.log("TableCore: Kernvertrag, Manager-Anbindung und Schutzmarkierungen OK");
