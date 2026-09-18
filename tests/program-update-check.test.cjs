const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const m=JSON.parse(fs.readFileSync(path.join(root,'latest-release-manifest.json'),'utf8'));
assert.equal(m.product,'KC MarktKasse');assert.equal(m.components.recipeManager.requiredVersion,'0.2.1');assert.ok(Number(m.update.buildId)>=2026091803);
const u=fs.readFileSync(path.join(root,'pc-manager/update-check.js'),'utf8');
assert.match(u,/raw\.githubusercontent\.com\/Sire65\/Kasse\/main\/latest-release-manifest\.json/);
assert.doesNotMatch(u,/supabase|localStorage\.setItem|indexedDB\.open/i);
const h=fs.readFileSync(path.join(root,'pc-manager/index.html'),'utf8');assert.match(h,/update-check\.js\?build=2026091803/);
console.log('KC MarktKasse Updatecheck: read-only, GitHub-main, Buildvergleich aktiv.');