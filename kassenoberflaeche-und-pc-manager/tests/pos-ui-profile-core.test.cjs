const fs=require('fs'),vm=require('vm'),assert=require('assert');
function coreContext(){const c={window:null,console,crypto:{randomUUID:()=>`id-${Math.random()}`}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('cores/pos-ui-profile-core/pos-ui-profile-core.js','utf8'),c);return c}
const c=coreContext(),api=c.KCPOSUIProfileCore;
const migrated=api.migrateLegacy({buttonMode:'image',buttonSize:'large',showPrice:true},{groupIds:['WG01'],productIds:['A1']});
assert.equal(api.validate(migrated,{groupIds:['WG01'],productIds:['A1']}).status,'PASS','Standardmigration muss PASS sein');
const missing=api.normalize(migrated);for(const list of Object.values(missing.commands.zones))for(const id of api.requiredCommands){const i=list.indexOf(id);if(i>=0)list.splice(i,1)}
const required=api.validate(missing);assert.equal(required.status,'FAIL');assert(required.issues.filter(x=>x.code==='PUI-101').length>=5,'Pflichtfunktionen müssen geschützt sein');
const lowContrast=api.normalize(migrated);lowContrast.theme.text='#777777';lowContrast.theme.surface='#888888';assert(api.validate(lowContrast).issues.some(x=>x.code==='PUI-203'));
const envelope=api.envelope({...migrated,status:'approved',version:'1.0.0'},{registerIds:['KASSE-01']});assert.equal(api.verifyEnvelope(envelope,{groupIds:['WG01'],productIds:['A1']}).status,'PASS');
const tampered=JSON.parse(JSON.stringify(envelope));tampered.profile.layout.touchSize=20;assert.equal(api.verifyEnvelope(tampered).status,'FAIL','Manipulation muss vor Profilvalidierung scheitern');
assert.throws(()=>api.transition({...migrated,status:'draft'},'published'),'Draft darf nicht direkt veröffentlicht werden');
let p=api.transition({...migrated,status:'draft'},'review');p=api.transition(p,'approved','Prüfer');p=api.transition(p,'published','Prüfer');assert.equal(p.status,'published');
console.log('PASS pos-ui-profile-core: Migration, Pflichtschutz, Kontrast, Integrität, Statusmodell');
