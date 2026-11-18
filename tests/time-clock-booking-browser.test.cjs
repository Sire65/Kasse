'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/clock.css"><header class="header-status"><button id="menuBtn">Menü</button></header><script>window.KCMeldeweg={melde:async()=>({ok:false})};</script><script src="/core.js"></script><script src="/pos.js"></script>';
(async()=>{
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html');
  res.end(req.url==='/clock.css'?fs.readFileSync('pos/time-clock-pos.css'):req.url==='/core.js'?fs.readFileSync('cores/time-clock-core/time-clock-core.js'):req.url==='/pos.js'?fs.readFileSync('pos/time-clock-pos.js'):fixture);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('kc_time_clock_config_v1',JSON.stringify({enabled:true,eventId:'WM-2026',allowBirthCode:true}));
   localStorage.setItem('kc_time_clock_people_v1',JSON.stringify([{id:'P-TEST',credential:'KC-9999',displayName:'Test-Pseudonym',birthCode:'010180',active:true,type:'member'}]));
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.click('#timeClockBtn');await page.fill('#tcPosCredential','010180');await page.click('#tcPosIdentify');
  assert.match(await page.textContent('#tcPosRichtung'),/kommt/);
  assert((await page.locator('#tcPosCommit').boundingBox()).height>=44,'booking button must be reachable by finger');
  await page.click('#tcPosCommit');
  assert.equal(await page.evaluate(()=>KCTimeClockPOS.ereignisse().length),1);
  assert.equal(await page.evaluate(()=>KCTimeClockPOS.ereignisse()[0].credential),'KC-9999');
  await page.reload();await page.click('#timeClockBtn');await page.fill('#tcPosCredential','KNG|TEST|KC-9999');await page.click('#tcPosIdentify');
  assert.match(await page.textContent('#tcPosRichtung'),/geht/);
  await page.click('#tcPosCommit');assert.equal(await page.evaluate(()=>KCTimeClockPOS.ereignisse().length),2);
  await page.reload();
  await page.evaluate(()=>KCTimeClockPOS.zugaengeAnwenden({schema:'KC_TIME_CLOCK_CONFIG_V1',people:[{id:'P-TEST',credential:'KC-9999',displayName:'Test-Pseudonym',birthCode:'010180',active:true}],config:{enabled:true,eventId:'WM-2026',allowBirthCode:true},sharedState:[{member_no:'KC-9999',event_id:'KC-WM-2026',id:'app-test',art:'in',zeit:new Date(Date.now()+1000).toISOString(),erfasst_am:new Date().toISOString(),quelle:'app'}]}));
  await page.click('#timeClockBtn');await page.fill('#tcPosCredential','010180');await page.click('#tcPosIdentify');assert.match(await page.textContent('#tcPosRichtung'),/geht/);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Speicher voll')};});
  await page.click('#tcPosCommit');assert.equal(await page.evaluate(()=>KCTimeClockPOS.ereignisse().length),2,'storage failure never creates a phantom event');
  assert.equal(await page.isDisabled('#tcPosCommit'),false);
  assert.deepEqual(errors,[]);
  console.log('PASS 390px: Geburtstag -> Kommen, QR -> Gehen, Neustart/offline, App-Stand -> Gehen, Speicherfehler ohne falsche Buchung.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
