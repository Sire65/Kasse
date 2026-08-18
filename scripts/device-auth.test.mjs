import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
if(!globalThis.btoa)globalThis.btoa=s=>Buffer.from(s,'binary').toString('base64');
if(!globalThis.atob)globalThis.atob=s=>Buffer.from(s,'base64').toString('binary');

const mod=await import('../shared/kc-device-auth.mjs');
const {canonicalRequest,generateNonce,generateSigningKeyPair,signCanonical,verifyCanonical,exportPublicJwk,validateDeviceId,sha256Base64Url,fromB64url,b64url,nextKeyVersion}=mod;
const pair=await generateSigningKeyPair();

test('private key is non-extractable',()=>assert.equal(pair.privateKey.extractable,false));
test('private key uses ECDSA',()=>assert.equal(pair.privateKey.algorithm.name,'ECDSA'));
test('private key uses P-256',()=>assert.equal(pair.privateKey.algorithm.namedCurve,'P-256'));
test('public JWK exports only public coordinates',async()=>{const j=await exportPublicJwk(pair.publicKey);assert.equal(j.kty,'EC');assert.equal(j.crv,'P-256');assert.ok(j.x&&j.y);assert.equal('d' in j,false)});
test('public descriptor is verify-only',async()=>{const j=await exportPublicJwk(pair.publicKey);assert.deepEqual(j.key_ops,['verify'])});

for(const id of ['KASSE-01','KASSE-02','register-1','pos.tablet:01','abc','A.B_C-123:Z'])test(`valid device id ${id}`,()=>assert.equal(validateDeviceId(id),true));
for(const id of ['', 'a','ab','has space','<script>','äöü','a/b','a?b','a#b','x'.repeat(101)])test(`invalid device id ${JSON.stringify(id)}`,()=>assert.equal(validateDeviceId(id),false));

for(const [current,next] of [[1,2],[2,3],[9,10],[99,100],[999,1000],[999999998,999999999]])test(`key version rotates ${current} -> ${next}`,()=>assert.equal(nextKeyVersion(current),next));
for(const bad of [0,-1,1.5,NaN,Infinity,'x',999999999,1000000000])test(`invalid key version rejected ${String(bad)}`,()=>assert.throws(()=>nextKeyVersion(bad),/INVALID_KEY_VERSION/));

test('nonce has strong length',()=>assert.ok(generateNonce().length>=32));
test('nonces differ',()=>assert.notEqual(generateNonce(),generateNonce()));
for(let i=0;i<10;i++)test(`nonce ${i+1} is URL safe`,()=>assert.match(generateNonce(),/^[A-Za-z0-9_-]+$/));

test('base64url roundtrip',()=>{const x=crypto.getRandomValues(new Uint8Array(64));assert.deepEqual([...fromB64url(b64url(x))],[...x])});
test('SHA-256 changes with input',async()=>assert.notEqual(await sha256Base64Url('a'),await sha256Base64Url('b')));
test('SHA-256 deterministic',async()=>assert.equal(await sha256Base64Url('same'),await sha256Base64Url('same')));

test('valid signature verifies',async()=>{const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{"a":1}');const s=await signCanonical(pair.privateKey,c);assert.equal(await verifyCanonical(pair.publicKey,c,s),true)});

const changes=[
 ['method','GET','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{"a":1}'],
 ['path','POST','https://g.example/sync/reconcile','1787000000','abcdefghijklmnop','{"a":1}'],
 ['query','POST','https://g.example/sync/batch?x=1','1787000000','abcdefghijklmnop','{"a":1}'],
 ['timestamp','POST','https://g.example/sync/batch','1787000001','abcdefghijklmnop','{"a":1}'],
 ['nonce','POST','https://g.example/sync/batch','1787000000','abcdefghijklmnopq','{"a":1}'],
 ['body','POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{"a":2}']
];
test('baseline canonical signature setup',async()=>{const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{"a":1}');const s=await signCanonical(pair.privateKey,c);assert.ok(s.length>40)});
for(const [name,m,u,t,n,b] of changes)test(`tampered ${name} rejects signature`,async()=>{const base=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{"a":1}');const sig=await signCanonical(pair.privateKey,base);const changed=await canonicalRequest(m,u,t,n,b);assert.equal(await verifyCanonical(pair.publicKey,changed,sig),false)});

for(let i=0;i<20;i++)test(`payload forgery case ${i+1}`,async()=>{const original=JSON.stringify({transactionId:`tx-${i}`,total:i+0.5});const forged=JSON.stringify({transactionId:`tx-${i}`,total:99999});const c1=await canonicalRequest('POST','https://g.example/sync/batch','1787000000',`nonce_${String(i).padStart(16,'0')}`,original);const sig=await signCanonical(pair.privateKey,c1);const c2=await canonicalRequest('POST','https://g.example/sync/batch','1787000000',`nonce_${String(i).padStart(16,'0')}`,forged);assert.equal(await verifyCanonical(pair.publicKey,c2,sig),false)});

test('another device key cannot validate signature',async()=>{const other=await generateSigningKeyPair();const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{}');const s=await signCanonical(pair.privateKey,c);assert.equal(await verifyCanonical(other.publicKey,c,s),false)});
test('rotated key cannot validate old key signature',async()=>{const rotated=await generateSigningKeyPair();const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{}');const s=await signCanonical(pair.privateKey,c);assert.equal(await verifyCanonical(rotated.publicKey,c,s),false)});
test('old key cannot validate rotated key signature',async()=>{const rotated=await generateSigningKeyPair();const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{}');const s=await signCanonical(rotated.privateKey,c);assert.equal(await verifyCanonical(pair.publicKey,c,s),false)});
for(let i=0;i<12;i++)test(`fresh rotation key ${i+1} differs from current key`,async()=>{const rotated=await generateSigningKeyPair();const a=await exportPublicJwk(pair.publicKey),b=await exportPublicJwk(rotated.publicKey);assert.notEqual(`${a.x}.${a.y}`,`${b.x}.${b.y}`);assert.equal(rotated.privateKey.extractable,false)});
test('malformed signature returns false',async()=>{const c=await canonicalRequest('POST','https://g.example/sync/batch','1787000000','abcdefghijklmnop','{}');assert.equal(await verifyCanonical(pair.publicKey,c,'%%%'),false)});
test('canonical includes query ordering exactly',async()=>{const a=await canonicalRequest('GET','https://g.example/x?a=1&b=2','1','abcdefghijklmnop','');const b=await canonicalRequest('GET','https://g.example/x?b=2&a=1','1','abcdefghijklmnop','');assert.notEqual(a,b)});
test('canonical strips host from signed resource',async()=>{const a=await canonicalRequest('GET','https://a.example/x?a=1','1','abcdefghijklmnop','');const b=await canonicalRequest('GET','https://b.example/x?a=1','1','abcdefghijklmnop','');assert.equal(a,b)});
test('body digest is bound even for empty body',async()=>{const a=await canonicalRequest('POST','https://g.example/x','1','abcdefghijklmnop','');const b=await canonicalRequest('POST','https://g.example/x','1','abcdefghijklmnop',' ');assert.notEqual(a,b)});
