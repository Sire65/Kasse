const assert=require("node:assert/strict");
const fs=require("node:fs");

const app=fs.readFileSync("pc-manager/app.js","utf8");
const html=fs.readFileSync("pc-manager/index.html","utf8");
const integration=fs.readFileSync("pc-manager/tv-weihnachtsmarkt-presentation.js","utf8");
const content=fs.readFileSync("tv-content/weihnachtsmarkt-2026/presentation.js","utf8");

assert.match(html,/id="aPriceListVisible"/);
assert.match(html,/<th[^>]*>PL<\/th>/);
assert.match(app,/priceListVisible:article\?\.priceListVisible!==false/);
assert.match(app,/data-article-pl=/);
assert.match(integration,/article\?\.priceListVisible===false/);
assert.match(content,/Steven Linley/);
assert.match(content,/› Regelmäßige Treffen/);
assert.match(content,/fontSize:16/);

console.log("PASS article-pricelist-flag: PL-Pflege, Filter, Listenformat und kompakte Preislisten vorhanden");
