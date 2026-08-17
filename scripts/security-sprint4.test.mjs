import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
if(!globalThis.btoa)globalThis.btoa=s=>Buffer.from(s,'binary').toString('base64');
if(!globalThis.atob)globalThis.atob=s=>Buffer.from(s,'base64').toString('binary');

const auth=await import('../shared/kc-device-auth.mjs');
const resilience=await readFile(new URL('../shared/kc-resilience.js',import.meta.url),'utf8');
const pair=await auth.generateSigningKeyPair();
const identity={deviceId:'KASSE-01-DEV-TEST',registerId:'KASSE-01',keyVersion:1,privateKey:pair.privateKey,publicKey:pair.publicKey};

const requiredPatterns=[
  "import('./kc-device-auth.mjs')",
  "x-kc-client':'KC-MarktKasse'",
  "signedHeaders('POST'",
  "signedHeaders('GET'",
  'SECURITY_ENROLLMENT_REQUIRED',
  'kc_security_device_id_v1',
  'kc_security_enrollment_v1',
  'auth.enrollmentDescriptor(identity)',
  'auth.signRequest(identity',
  'crypto.randomUUID()',
  'REGISTER_ID_REQUIRED',
  'GATEWAY_UNREACHABLE',
  "cache:'no-store'",
  'AbortController',
  'restoreRegister',
  'reconcile',
  'queueTransactions',
  'KCResilience=Object.freeze',
  'enrollment:enrollmentDescriptor',
  'deviceId:stableDeviceId'
];
for(const p of requiredPatterns)test(`resilience contains ${p}`,()=>assert.ok(resilience.includes(p)));

test('legacy unsigned direct sync POST removed',()=>assert.ok(!resilience.includes("headers:{'content-type':'application/json','x-kc-client':'KC-MarktKasse'},body")));
test('restore uses signed GET',()=>assert.ok(resilience.includes('const data=await signedGet(url.toString())')));
test('device id validates',()=>assert.equal(auth.validateDeviceId(identity.deviceId),true));
test('register id validates',()=>assert.equal(auth.validateDeviceId(identity.registerId),true));
test('private signing key non extractable',()=>assert.equal(pair.privateKey.extractable,false));
test('public key export contains no private d',async()=>assert.equal('d' in await auth.exportPublicJwk(pair.publicKey),false));

for(let i=0;i<45;i++)test(`signed request roundtrip ${i+1}`,async()=>{
  const body=JSON.stringify({transactionId:`TX-${i}`,amount:i+0.5});
  const url=`https://kc-failover-gateway.ha-joko.workers.dev/sync/batch?case=${i}`;
  const timestamp=1766090000+i;
  const nonce=auth.generateNonce();
  const headers=await auth.signRequest(identity,{method:'POST',url,bodyText:body,timestamp,nonce});
  assert.equal(headers['x-kc-device-id'],identity.deviceId);
  assert.equal(headers['x-kc-key-version'],'1');
  assert.equal(headers['x-kc-timestamp'],String(timestamp));
  assert.equal(headers['x-kc-nonce'],nonce);
  const canonical=await auth.canonicalRequest('POST',url,String(timestamp),nonce,body);
  assert.equal(await auth.verifyCanonical(pair.publicKey,canonical,headers['x-kc-signature']),true);
  const tampered=await auth.canonicalRequest('POST',url,String(timestamp),nonce,body+'x');
  assert.equal(await auth.verifyCanonical(pair.publicKey,tampered,headers['x-kc-signature']),false);
});

for(let i=0;i<10;i++)test(`nonce uniqueness ${i+1}`,()=>{
  const a=auth.generateNonce(),b=auth.generateNonce();
  assert.notEqual(a,b);assert.match(a,/^[A-Za-z0-9_-]{32}$/);assert.match(b,/^[A-Za-z0-9_-]{32}$/);
});

// TÜV trigger marker: Sprint 4 integration baseline.
