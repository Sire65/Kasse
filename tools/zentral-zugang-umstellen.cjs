'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const companion='../markt-kasse-suite/backend-source/manager-companion/';
async function umstellen(keyFile,opt={}){
 const configPath=opt.configPath||require(companion+'zentral-sync.js').KONFIG_DATEI,fetchFn=opt.fetchFn||fetch,protect=opt.protect||require(companion+'secure-file.js').protectSecretFile;
 const old=JSON.parse(fs.readFileSync(configPath,'utf8')),next=JSON.parse(fs.readFileSync(keyFile,'utf8'));
 if(next.schema!=='KC_ZENTRALE_ACCESS_FILE_V1'||typeof next.zugangswort!=='string'||next.zugangswort.length<32)throw Error('Keine gültige neue Zugangsdatei. Alter Zugang bleibt erhalten.');
 if(!old.url||next.url!==old.url||next.orgId!==old.orgId)throw Error('Ziel oder Organisation passt nicht zur bestehenden Einrichtung.');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(old.url))throw Error('Ungültiges Ziel.');
 const health=opt.deviceId?{managerId:opt.deviceId}:await (await fetchFn('http://127.0.0.1:47392/health',{signal:AbortSignal.timeout(8000)})).json();
 const deviceId=health.managerId;if(!/^mgr_[a-f0-9]{32}$/.test(deviceId||''))throw Error('Manager-Kennung nicht bestätigt. Alter Zugang bleibt erhalten.');
 const request=async action=>{const r=await fetchFn(old.url.replace(/\/$/,'')+'/functions/v1/kc-zentrale',{method:'POST',headers:{'Content-Type':'application/json','x-kc-zugang':next.zugangswort,'x-kc-device-id':deviceId,'x-kc-device-name':encodeURIComponent(os.hostname())},body:JSON.stringify({vorgang:action,orgId:old.orgId}),signal:AbortSignal.timeout(15000)});let data;try{data=await r.json()}catch{throw Error('Serverantwort nicht bestätigt.')}if(!r.ok||data.ok!==true||data.generation!=='new'||data.deviceId!==deviceId)throw Error('Neuer Zugang oder Gerätezuordnung nicht bestätigt.');return data};
 await request('migration_probe');
 const backup=configPath+'.pre-transition',temp=configPath+'.new';
 if(!fs.existsSync(backup)){fs.copyFileSync(configPath,backup);protect(backup)}
 fs.writeFileSync(temp,JSON.stringify({...old,zugangswort:next.zugangswort,deviceId},null,2),{mode:0o600});protect(temp);fs.renameSync(temp,configPath);
 let confirmed=false;try{await request('migration_ack');confirmed=true}catch{}
 // Nach unklarem ACK bleibt die bereits getestete neue Konfiguration aktiv.
 const receipt={schema:'KC_ZENTRALE_TRANSITION_RECEIPT_V1',deviceId,deviceName:os.hostname(),generation:'new',confirmed,checkedAt:new Date().toISOString()};fs.writeFileSync(configPath+'.receipt.json',JSON.stringify(receipt,null,2));return receipt;
}
module.exports={umstellen};if(require.main===module){umstellen(process.argv[2]).then(r=>console.log(r.confirmed?'Neuer Zugang gespeichert und zentral bestätigt.':'Neuer Zugang gespeichert; zentrale Bestätigung noch offen. Bitte erneut ausführen.')).catch(()=>{console.error('Umstellung nicht bestätigt. Bitte Verbindung und passende Zugangsdatei prüfen. Kein Zugangswort ausgegeben.');process.exitCode=1})}
