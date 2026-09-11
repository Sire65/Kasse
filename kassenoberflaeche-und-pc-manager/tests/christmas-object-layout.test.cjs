const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('tv-content/weihnachtsmarkt-2026/presentation.js','utf8');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
const content=sandbox.window.KC_WEIHNACHTSMARKT_PRESENTATION,presentation=content.create();
assert.equal(content.VERSION,'1.3.0');assert.equal(content.TV_VERSION,'0.29.40');assert.equal(presentation.slides.length,28);
assert.equal(presentation.slides[1].media.dataUrl,'../tv-content/weihnachtsmarkt-2026/members/gruppenfoto-koecheclub.jpg');
// Auch hier: Namen aus den Mitgliedsdaten statt aus einer zweiten, handgepflegten Liste.
const expectedMembers=[...fs.readFileSync('pc-manager/kc-mitgliedsdaten.js','utf8').matchAll(/name:\s*'([^']+)'/g)].map(m=>m[1]);
// Verglichen wird die MENGE, nicht die Reihenfolge: In welcher Reihenfolge die Mitglieder
// gezeigt werden, ist eine Frage der Gestaltung; WER gezeigt wird, ist eine Frage der Daten.
const gezeigt=presentation.slides.slice(2,20).map(slide=>slide.title);
assert.deepEqual([...gezeigt].sort(),[...expectedMembers].sort());
assert.equal(new Set(gezeigt).size,18,'jedes Mitglied genau einmal');
for(let i=0;i<10;i++){
  const number=String(i+1).padStart(2,'0');
  assert.equal(presentation.slides[i+2].media.dataUrl,`../tv-content/weihnachtsmarkt-2026/members/mitglied-${number}.jpg`);
  assert.equal(presentation.slides[i+2].media.type,'image/jpeg');
}
assert.equal(presentation.slides[12].media.dataUrl,'../avatar-core/assets/chef/chef_female_neutral.webp');
assert.equal(new Set(presentation.slides.slice(2,20).map(slide=>slide.text)).size,18);
assert.deepEqual(presentation.slides.slice(24,28).map(slide=>slide.contentKey),['prices-alcoholic','prices-non-alcoholic','prices-food','recipe-eggnog-punch']);
assert.equal(presentation.slides[24].tableObject.rows[0][2],'Preis');
assert.match(presentation.slides[24].text,/ohne Pfand/);
assert.match(presentation.slides[27].text,/1 Teil Eierlikör/);
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2))*Math.max(0,Math.min(a.y+a.h/2,b.y+b.h/2)-Math.max(a.y-a.h/2,b.y-b.h/2));
for(const [index,slide] of presentation.slides.entries()){
  for(const key of ['title','text','price','symbols','ticker','weather','image'])assert(slide.layout[key],`Folie ${index+1}: Layout ${key} fehlt`);
  const visible=[];if(slide.title)visible.push('title');if(slide.text)visible.push('text');if(slide.price)visible.push('price');if(slide.decorations?.length)visible.push('symbols');if(slide.ticker)visible.push('ticker');if(slide.type==='weather')visible.push('weather');if(slide.media?.dataUrl)visible.push('image');
  for(let a=0;a<visible.length;a++)for(let b=a+1;b<visible.length;b++){const ka=visible[a],kb=visible[b],pa=slide.layout[ka],pb=slide.layout[kb],area=overlap(pa,pb),limit=Math.min(pa.w*pa.h,pb.w*pb.h)*.18;assert(area<=limit,`Folie ${index+1}: ${ka}/${kb} überlappen (${area.toFixed(1)}>${limit.toFixed(1)})`)}
}
console.log('PASS christmas-object-layout: 28 Folien, 18 Mitglieder, vier neue Inhaltsseiten und kollisionsarme Startlayouts');
