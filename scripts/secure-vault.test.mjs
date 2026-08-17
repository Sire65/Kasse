import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
if(!globalThis.btoa)globalThis.btoa=s=>Buffer.from(s,'binary').toString('base64');
if(!globalThis.atob)globalThis.atob=s=>Buffer.from(s,'base64').toString('binary');

const v=await import('../shared/kc-secure-vault.mjs');
const pass='Correct-Horse-Battery-Staple-KC-2026!';
const {dataKey,recoveryPackage}=await v.createVaultKey(pass);

test('vault uses V2 format',()=>assert.equal(v.VAULT_CONSTANTS.FORMAT,'KC_SECURE_VAULT_V2'));
test('vault uses AES 256 raw key size',()=>assert.equal(v.VAULT_CONSTANTS.KEY_BYTES,32));
test('vault uses 96-bit GCM IV',()=>assert.equal(v.VAULT_CONSTANTS.IV_BYTES,12));
test('recovery salt is 256 bit',()=>assert.equal(v.VAULT_CONSTANTS.SALT_BYTES,32));
test('KDF work factor is at least 600k',()=>assert.ok(v.VAULT_CONSTANTS.KDF_ITERATIONS>=600000));
test('data key is non-extractable',()=>assert.equal(dataKey.extractable,false));
test('data key AES-GCM',()=>assert.equal(dataKey.algorithm.name,'AES-GCM'));
test('recovery package validates',()=>assert.equal(v.validateRecoveryPackage(recoveryPackage),true));
test('recovery package has no plaintext key field',()=>{for(const k of Object.keys(recoveryPackage))assert.notMatch(k,/^(?:rawKey|dataKey|plaintextKey)$/i)});
test('recovery package fingerprint stable',async()=>assert.equal(await v.fingerprintRecoveryPackage(recoveryPackage),await v.fingerprintRecoveryPackage(recoveryPackage)));

for(let i=0;i<40;i++)test(`encrypted record roundtrip ${i+1}`,async()=>{
  const value={transactionId:`tx-${i}`,total:i+0.37,nested:{operator:'Einhorn',items:[{id:'p1',qty:i+1}]}};
  const e=await v.encryptRecord(dataKey,value,{namespace:'transactions',keyId:recoveryPackage.keyId,recordId:value.transactionId});
  assert.notEqual(e.ciphertext,JSON.stringify(value));
  assert.deepEqual(await v.decryptRecord(dataKey,e),value);
});

test('same plaintext encrypts differently due random IV',async()=>{const ctx={namespace:'x',keyId:recoveryPackage.keyId,recordId:'r'};const a=await v.encryptRecord(dataKey,{a:1},ctx);const b=await v.encryptRecord(dataKey,{a:1},ctx);assert.notEqual(a.iv,b.iv);assert.notEqual(a.ciphertext,b.ciphertext)});

test('Superadmin recovery recreates usable key',async()=>{const recovered=await v.recoverVaultKey(pass,recoveryPackage);const e=await v.encryptRecord(dataKey,{secret:'ok'},{namespace:'n',keyId:recoveryPackage.keyId,recordId:'r1'});assert.deepEqual(await v.decryptRecord(recovered,e),{secret:'ok'});assert.equal(recovered.extractable,false)});
test('wrong recovery passphrase rejected',async()=>{await assert.rejects(()=>v.recoverVaultKey('Wrong-Wrong-Wrong-Wrong!',recoveryPackage),/RECOVERY_AUTHENTICATION_FAILED/)});
test('short recovery passphrase rejected',async()=>{await assert.rejects(()=>v.createVaultKey('short'),/RECOVERY_PASSPHRASE_TOO_SHORT/)});

const base=await v.encryptRecord(dataKey,{amount:12.34,operator:'Hans'},{namespace:'transactions',keyId:recoveryPackage.keyId,recordId:'tamper-1'});
const mutateChar=s=>s.slice(0,-1)+(s.endsWith('A')?'B':'A');
const envelopeTamper=[
 ['ciphertext',{...base,ciphertext:mutateChar(base.ciphertext)}],
 ['iv',{...base,iv:mutateChar(base.iv)}],
 ['namespace',{...base,namespace:'other'}],
 ['recordId',{...base,recordId:'tamper-2'}],
 ['keyId',{...base,keyId:v.newKeyId()}]
];
for(const [name,e] of envelopeTamper)test(`tampered ${name} rejected`,async()=>{await assert.rejects(()=>v.decryptRecord(dataKey,e),/VAULT_(?:AUTHENTICATION_FAILED|ENVELOPE_INVALID)/)});

const recoveryTamper=[
 ['format',{...recoveryPackage,format:'BAD'}],
 ['kdf',{...recoveryPackage,kdf:'PBKDF2-SHA1'}],
 ['iterations',{...recoveryPackage,iterations:1}],
 ['keyId',{...recoveryPackage,keyId:'bad'}],
 ['salt',{...recoveryPackage,salt:'AA'}],
 ['iv',{...recoveryPackage,iv:'AA'}],
 ['wrappedKey',{...recoveryPackage,wrappedKey:'AA'}]
];
for(const [name,pkg] of recoveryTamper)test(`invalid recovery ${name} rejected`,async()=>{await assert.rejects(async()=>v.recoverVaultKey(pass,pkg),/RECOVERY_/)});

test('tampered wrapped recovery key rejected cryptographically',async()=>{const pkg={...recoveryPackage,wrappedKey:mutateChar(recoveryPackage.wrappedKey)};await assert.rejects(()=>v.recoverVaultKey(pass,pkg),/RECOVERY_AUTHENTICATION_FAILED/)});
test('tampered recovery IV rejected cryptographically',async()=>{const raw=Buffer.from(v.fromB64url(recoveryPackage.iv));raw[0]^=1;const pkg={...recoveryPackage,iv:v.b64url(raw)};await assert.rejects(()=>v.recoverVaultKey(pass,pkg),/RECOVERY_AUTHENTICATION_FAILED/)});
test('tampered recovery salt rejected cryptographically',async()=>{const raw=Buffer.from(v.fromB64url(recoveryPackage.salt));raw[0]^=1;const pkg={...recoveryPackage,salt:v.b64url(raw)};await assert.rejects(()=>v.recoverVaultKey(pass,pkg),/RECOVERY_AUTHENTICATION_FAILED/)});

test('vault requires context',async()=>{await assert.rejects(()=>v.encryptRecord(dataKey,{a:1},{keyId:recoveryPackage.keyId}),/VAULT_CONTEXT_REQUIRED/)});
test('wrong key cannot decrypt',async()=>{const other=(await v.createVaultKey('Another-Recovery-Passphrase-2026!')).dataKey;await assert.rejects(()=>v.decryptRecord(other,base),/VAULT_AUTHENTICATION_FAILED/)});
test('fingerprint changes if wrapped package changes',async()=>{const changed={...recoveryPackage,createdAt:'2099-01-01'};assert.equal(await v.fingerprintRecoveryPackage(changed),await v.fingerprintRecoveryPackage(recoveryPackage));const raw=Buffer.from(v.fromB64url(recoveryPackage.wrappedKey));raw[0]^=1;const tam={...recoveryPackage,wrappedKey:v.b64url(raw)};assert.notEqual(await v.fingerprintRecoveryPackage(tam),await v.fingerprintRecoveryPackage(recoveryPackage))});
