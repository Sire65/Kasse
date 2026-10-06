const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const dir of ['pos','schulung/pos']){
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,dir,'images-v3.js'),'utf8'),context);
 const api=context.window.KCImagesV3;assert.equal(Object.keys(api.entries).length,20);
 for(const [id,e] of Object.entries(api.entries)){
  assert(fs.existsSync(path.join(root,dir,e.image)));
  for(const old of ['',...e.legacy.map(n=>'assets/'+n)]){const p={id,image:old,price:7,active:false};api.migrate(p);assert.equal(p.image,e.image);assert.equal(p.price,7);assert.equal(p.active,false)}
  const custom={id,image:'assets/custom.png'};api.migrate(custom);assert.equal(custom.image,'assets/custom.png');
  const embedded={id,image:e.legacy[0],embeddedImage:'data:image/png;base64,custom'};api.migrate(embedded);
  // Echte Kasse: eingebettetes Bild bleibt. Schulung (06.10.2026, Betreiber Weg 2, reine Vorfuehrung): aktuelles V3-Bild, embeddedImage bleibt erhalten.
  assert.equal(embedded.image,dir==='pos'?e.legacy[0]:e.image);assert.equal(embedded.embeddedImage,'data:image/png;base64,custom');
 }
 const drink={id:'grot',depositComponents:[{id:'glass',price:2},{id:'tong',price:2}]};api.migrate(drink);assert.equal(drink.depositComponents[0].image,api.entries.glasplus.image);assert.equal(drink.depositComponents[0].price,2);assert.equal(drink.depositComponents[1].image,undefined);
 const unrelated={id:'zangeplus',image:'assets/nicht-migriert.png'};api.migrate(unrelated);assert.equal(unrelated.image,'assets/nicht-migriert.png');
}
console.log('PASS V3 migration: legacy images, custom images, article fields and files');
