const enc=new TextEncoder();
const dec=new TextDecoder();
const FORMAT='KC_SECURE_VAULT_V2';
const KDF='PBKDF2-SHA256-600K';
const KDF_ITERATIONS=600000;
const KEY_BYTES=32;
const IV_BYTES=12;
const SALT_BYTES=32;

export function b64url(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
export function fromB64url(value){const n=String(value).replace(/-/g,'+').replace(/_/g,'/');const p=n+'='.repeat((4-(n.length%4||4))%4);const bin=atob(p);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
export function randomBytes(n){return crypto.getRandomValues(new Uint8Array(n));}
export function newKeyId(){return `kc-key-${crypto.randomUUID()}`;}

async function importDataKey(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function deriveRecoveryKey(passphrase,salt){
  if(typeof passphrase!=='string'||passphrase.length<16)throw new Error('RECOVERY_PASSPHRASE_TOO_SHORT');
  const base=await crypto.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:KDF_ITERATIONS},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function aad(namespace,keyId,recordId){return enc.encode(`${FORMAT}\n${namespace}\n${keyId}\n${recordId}`);}
function recoveryAad(keyId){return enc.encode(`${FORMAT}\nRECOVERY\n${keyId}\n${KDF}`);}

export async function createVaultKey(recoveryPassphrase,{keyId=newKeyId()}={}){
  const raw=randomBytes(KEY_BYTES);
  const dataKey=await importDataKey(raw);
  const salt=randomBytes(SALT_BYTES);
  const iv=randomBytes(IV_BYTES);
  const recoveryKey=await deriveRecoveryKey(recoveryPassphrase,salt);
  const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:recoveryAad(keyId),tagLength:128},recoveryKey,raw);
  raw.fill(0);
  return {
    dataKey,
    recoveryPackage:{format:FORMAT,keyId,kdf:KDF,iterations:KDF_ITERATIONS,salt:b64url(salt),iv:b64url(iv),wrappedKey:b64url(wrapped),createdAt:new Date().toISOString()}
  };
}

export async function recoverVaultKey(recoveryPassphrase,pkg){
  validateRecoveryPackage(pkg);
  const salt=fromB64url(pkg.salt),iv=fromB64url(pkg.iv),wrapped=fromB64url(pkg.wrappedKey);
  const recoveryKey=await deriveRecoveryKey(recoveryPassphrase,salt);
  let raw;
  try{raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:recoveryAad(pkg.keyId),tagLength:128},recoveryKey,wrapped));}
  catch{throw new Error('RECOVERY_AUTHENTICATION_FAILED');}
  if(raw.length!==KEY_BYTES){raw.fill(0);throw new Error('RECOVERY_KEY_LENGTH_INVALID');}
  const dataKey=await importDataKey(raw);raw.fill(0);return dataKey;
}

export function validateRecoveryPackage(pkg){
  if(!pkg||pkg.format!==FORMAT)throw new Error('RECOVERY_FORMAT_INVALID');
  if(pkg.kdf!==KDF||Number(pkg.iterations)!==KDF_ITERATIONS)throw new Error('RECOVERY_KDF_INVALID');
  if(!/^kc-key-[0-9a-f-]{36}$/i.test(String(pkg.keyId||'')))throw new Error('RECOVERY_KEY_ID_INVALID');
  let salt,iv,wrapped;try{salt=fromB64url(pkg.salt);iv=fromB64url(pkg.iv);wrapped=fromB64url(pkg.wrappedKey);}catch{throw new Error('RECOVERY_ENCODING_INVALID');}
  if(salt.length!==SALT_BYTES||iv.length!==IV_BYTES||wrapped.length<KEY_BYTES+16)throw new Error('RECOVERY_PACKAGE_LENGTH_INVALID');
  return true;
}

export async function encryptRecord(dataKey,value,{namespace='transactions',keyId,recordId}={}){
  if(!dataKey||dataKey.algorithm?.name!=='AES-GCM'||dataKey.extractable)throw new Error('VAULT_KEY_INVALID');
  if(!keyId||!recordId)throw new Error('VAULT_CONTEXT_REQUIRED');
  const iv=randomBytes(IV_BYTES);const plaintext=enc.encode(JSON.stringify(value));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(namespace,keyId,recordId),tagLength:128},dataKey,plaintext);
  return {format:FORMAT,keyId,namespace,recordId,iv:b64url(iv),ciphertext:b64url(cipher)};
}

export async function decryptRecord(dataKey,envelope){
  if(!dataKey||dataKey.algorithm?.name!=='AES-GCM')throw new Error('VAULT_KEY_INVALID');
  if(!envelope||envelope.format!==FORMAT)throw new Error('VAULT_FORMAT_INVALID');
  const iv=fromB64url(envelope.iv),cipher=fromB64url(envelope.ciphertext);
  if(iv.length!==IV_BYTES||cipher.length<17)throw new Error('VAULT_ENVELOPE_INVALID');
  try{
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(envelope.namespace,envelope.keyId,envelope.recordId),tagLength:128},dataKey,cipher);
    return JSON.parse(dec.decode(plain));
  }catch{throw new Error('VAULT_AUTHENTICATION_FAILED');}
}

export async function fingerprintRecoveryPackage(pkg){
  validateRecoveryPackage(pkg);
  const canonical=JSON.stringify({format:pkg.format,keyId:pkg.keyId,kdf:pkg.kdf,iterations:pkg.iterations,salt:pkg.salt,iv:pkg.iv,wrappedKey:pkg.wrappedKey});
  return b64url(await crypto.subtle.digest('SHA-256',enc.encode(canonical)));
}

export const VAULT_CONSTANTS=Object.freeze({FORMAT,KDF,KDF_ITERATIONS,KEY_BYTES,IV_BYTES,SALT_BYTES});
