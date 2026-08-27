import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const outRoot=path.join(here,'restored');
const supportDir=path.join(outRoot,'support');
const coreOut=path.join(outRoot,'pc-manager-core.html');
const supportArchive=path.join(outRoot,'pc-manager-support.tar.gz');
const reportFile=path.join(outRoot,'RESTORE-REPORT.json');

const coreParts=Array.from({length:9},(_,i)=>`core.part${String(i+1).padStart(3,'0')}.b64`);
const supportParts=['core.part010.b64','core.part011.b64','support.tail.b64'];
const expectedSupport=[
  'audio-presentation-integration.js','design-core-presentation-integration.js','dev-quick-access.css','dev-quick-access.js',
  'dynamic-content-resolver.js','event-program-export-v010.css','kc-admin-center.js','kc-fernverkehr-dashboard.js',
  'kc-live-monitor.css','kc-live-monitor.js','kc-manager-supabase-status.js','kc-supabase-dashboard.js',
  'manager-event-simulation-adapter.js','manager-import-progress-core.css','manager-import-progress-core.js',
  'manager-masterdata-health-v02949.js','manager-message-integration-v010.js','manager-navigation-adapter-v010.css',
  'manager-navigation-adapter-v010.js','manager-navigation-extras-v011.css','manager-navigation-extras-v011.js',
  'manager-sales-inventory-dashboard.css','manager-sales-inventory-dashboard.js','manager-select-health-v02946.js',
  'manager-table-core.css','manager-table-core.js','member-rotation-settings.js','mobile-job-activation-fix-v02963.js',
  'pos-ui-profile-details-v012.css','pos-ui-profile-manager.css','pos-ui-profile-manager.js','presentation-professional-guard.js',
  'presentation-save-open.js','presentation-tuv-integration.js','program-import-core-v010.css','recipe-manager.css',
  'recipe-manager.js','release-manifest-integration.js','time-clock-manager.css','time-clock-manager.js',
  'tv-dashboard-live.js','tv-designer-launcher.js','weather-mobile-exchange-integration.css','weather-mobile-exchange-integration.js'
];

async function readConcat(files){
  let combined='';
  for(const name of files){
    const p=path.join(here,name);
    const text=await fs.readFile(p,'utf8');
    combined+=text.replace(/\s+/g,'');
  }
  return combined;
}

async function run(cmd,args,cwd){
  await new Promise((resolve,reject)=>{
    const child=spawn(cmd,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} exited with ${code}`)));
  });
}

async function walk(dir,base=dir,acc=[]){
  for(const ent of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,ent.name);
    if(ent.isDirectory())await walk(full,base,acc); else acc.push(path.relative(base,full).replaceAll('\\','/'));
  }
  return acc;
}

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function main(){
  await fs.rm(outRoot,{recursive:true,force:true});
  await fs.mkdir(supportDir,{recursive:true});

  // Core wurde beim Import gzip-komprimiert und danach in Base64-Teile zerlegt.
  // Nur Base64 zu dekodieren erzeugt deshalb KEIN gültiges HTML.
  const coreB64=await readConcat(coreParts);
  const coreGzip=Buffer.from(coreB64,'base64');
  if(coreGzip[0]!==0x1f||coreGzip[1]!==0x8b)throw new Error('PC-Manager-Core: gzip magic fehlt');
  const coreBytes=gunzipSync(coreGzip);
  const coreText=coreBytes.toString('utf8');
  const htmlStart=coreText.slice(0,2048).toLowerCase();
  if(!htmlStart.includes('<html')&&!htmlStart.includes('<!doctype'))throw new Error('PC-Manager-Core: nach gunzip kein HTML erkannt');
  await fs.writeFile(coreOut,coreBytes);

  const supportB64=await readConcat(supportParts);
  const supportBytes=Buffer.from(supportB64,'base64');
  if(supportBytes[0]!==0x1f||supportBytes[1]!==0x8b)throw new Error('PC-Manager-Support: gzip magic fehlt');
  await fs.writeFile(supportArchive,supportBytes);
  await run('tar',['-xzf',supportArchive,'-C',supportDir],here);

  const files=await walk(supportDir);
  const basenames=new Set(files.map(x=>path.basename(x)));
  const missing=expectedSupport.filter(x=>!basenames.has(x));
  const report={
    schema:'KC_PC_MANAGER_RESTORE_REPORT_V2',
    restoredAt:new Date().toISOString(),
    source:'KC_MarktKasse_MoneyButler_Farben.zip · Import 24.08.2026',
    productionRootTouched:false,
    core:{
      parts:coreParts,
      compressedBytes:coreGzip.length,
      compressedSha256:sha256(coreGzip),
      htmlBytes:coreBytes.length,
      htmlSha256:sha256(coreBytes),
      htmlValidated:true,
      output:path.relative(here,coreOut).replaceAll('\\','/')
    },
    support:{
      parts:supportParts,
      archiveBytes:supportBytes.length,
      archiveSha256:sha256(supportBytes),
      fileCount:files.length,
      files,
      missingExpected:missing
    },
    status:missing.length?'INCOMPLETE':'RESTORED_VERIFIED'
  };
  await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n','utf8');
  if(missing.length){
    console.error('Restore incomplete. Missing:',missing.join(', '));
    process.exitCode=2;
  }else{
    console.log(`PC-Manager restore verified: HTML ${coreBytes.length} bytes, ${files.length} support files.`);
  }
}

main().catch(err=>{console.error(err);process.exitCode=1;});
