const DB_NAME='kc-security-v1';
const STORE='device-keys';
const KEY_RECORD='active-signing-key';
const PENDING_KEY_RECORD='pending-signing-key';
const enc=new TextEncoder();

export function b64url(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
export function fromB64url(value){const n=String(value).replace(/-/g,'+').replace(/_/g,'/');const p=n+'='.repeat((4-(n.length%4||4))%4);const bin=atob(p);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
export async function sha256Base64Url(text){return b64url(await crypto.subtle.digest('SHA-256',enc.encode(String(text??''))));}
export async function canonicalRequest(method,url,timestamp,nonce,bodyText=''){const u=new URL(url);const bodyHash=await sha256Base64Url(bodyText);return [String(method).toUpperCase(),`${u.pathname}${u.search}`,String(timestamp),String(nonce),bodyHash].join('\n');}
export function validateDeviceId(deviceId){return /^[A-Za-z0-9._:-]{3,100}$/.test(String(deviceId||''));}
export function nextKeyVersion(current){const n=Number(current);if(!Number.isSafeInteger(n)||n<1||n>=999999999)throw new Error('INVALID_KEY_VERSION');return n+1;}
export function generateNonce(){return b64url(crypto.getRandomValues(new Uint8Array(24)));}
export async function generateSigningKeyPair(){return crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);}
export async function exportPublicJwk(publicKey){const jwk=await crypto.subtle.exportKey('jwk',publicKey);return {kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,ext:true,key_ops:['verify']};}
export async function signCanonical(privateKey,canonical){const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,enc.encode(canonical));return b64url(sig);}
export async function verifyCanonical(publicKey,canonical,signature){let sig;try{sig=fromB64url(signature)}catch{return false}return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,sig,enc.encode(canonical));}

function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('SECURITY_DB_OPEN_FAILED'));});}
async function dbGet(key){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close()}}
async function dbPut(key,value){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close()}}
async function dbDelete(key){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close()}}

export async function getOrCreateIdentity({deviceId,registerId,keyVersion=1}={}){
  if(!validateDeviceId(deviceId))throw new Error('INVALID_DEVICE_ID');
  if(!validateDeviceId(registerId))throw new Error('INVALID_REGISTER_ID');
  let record=await dbGet(KEY_RECORD);
  if(record?.deviceId===deviceId&&record?.registerId===registerId&&record?.privateKey&&record?.publicKey)return record;
  const pair=await generateSigningKeyPair();
  record={deviceId,registerId,keyVersion:Number(keyVersion)||1,createdAt:new Date().toISOString(),activatedAt:new Date().toISOString(),privateKey:pair.privateKey,publicKey:pair.publicKey};
  await dbPut(KEY_RECORD,record);return record;
}

export async function enrollmentDescriptor(identity){
  if(!identity?.publicKey||!validateDeviceId(identity.deviceId)||!validateDeviceId(identity.registerId))throw new Error('INVALID_IDENTITY');
  return {deviceId:identity.deviceId,registerId:identity.registerId,keyVersion:identity.keyVersion||1,algorithm:'ECDSA-P256-SHA256',publicJwk:await exportPublicJwk(identity.publicKey),createdAt:identity.createdAt||null};
}

export async function beginKeyRotation({expectedDeviceId,expectedRegisterId}={}){
  const active=await dbGet(KEY_RECORD);if(!active?.privateKey||!active?.publicKey)throw new Error('ACTIVE_IDENTITY_MISSING');
  if(expectedDeviceId&&active.deviceId!==expectedDeviceId)throw new Error('DEVICE_ID_MISMATCH');
  if(expectedRegisterId&&active.registerId!==expectedRegisterId)throw new Error('REGISTER_ID_MISMATCH');
  const pair=await generateSigningKeyPair();
  const pending={deviceId:active.deviceId,registerId:active.registerId,keyVersion:nextKeyVersion(active.keyVersion||1),createdAt:new Date().toISOString(),previousKeyVersion:Number(active.keyVersion||1),privateKey:pair.privateKey,publicKey:pair.publicKey};
  await dbPut(PENDING_KEY_RECORD,pending);return enrollmentDescriptor(pending);
}

export async function inspectPendingRotation(){const p=await dbGet(PENDING_KEY_RECORD);if(!p)return null;return {deviceId:p.deviceId,registerId:p.registerId,keyVersion:p.keyVersion,previousKeyVersion:p.previousKeyVersion,createdAt:p.createdAt,privateKeyExtractable:p.privateKey?.extractable===true};}
export async function activatePendingRotation({serverConfirmedKeyVersion}={}){
  const active=await dbGet(KEY_RECORD),pending=await dbGet(PENDING_KEY_RECORD);if(!active||!pending)throw new Error('PENDING_ROTATION_MISSING');
  if(active.deviceId!==pending.deviceId||active.registerId!==pending.registerId)throw new Error('ROTATION_SCOPE_MISMATCH');
  if(Number(serverConfirmedKeyVersion)!==Number(pending.keyVersion))throw new Error('ROTATION_NOT_CONFIRMED');
  pending.activatedAt=new Date().toISOString();await dbPut(KEY_RECORD,pending);await dbDelete(PENDING_KEY_RECORD);return inspectIdentity();
}
export async function cancelPendingRotation(){await dbDelete(PENDING_KEY_RECORD);return true;}

export async function signRequest(identity,{method,url,bodyText='',timestamp=Math.floor(Date.now()/1000),nonce=generateNonce()}={}){
  if(!identity?.privateKey)throw new Error('DEVICE_KEY_UNAVAILABLE');const ts=String(timestamp);const canonical=await canonicalRequest(method,url,ts,nonce,bodyText);const signature=await signCanonical(identity.privateKey,canonical);
  return {'x-kc-device-id':identity.deviceId,'x-kc-key-version':String(identity.keyVersion||1),'x-kc-timestamp':ts,'x-kc-nonce':nonce,'x-kc-signature':signature};
}

export async function revokeLocalIdentity(){await dbDelete(KEY_RECORD);await dbDelete(PENDING_KEY_RECORD);}
export async function inspectIdentity(){const r=await dbGet(KEY_RECORD);if(!r)return null;return {deviceId:r.deviceId,registerId:r.registerId,keyVersion:r.keyVersion,createdAt:r.createdAt,activatedAt:r.activatedAt||null,privateKeyExtractable:r.privateKey?.extractable===true,algorithm:r.privateKey?.algorithm?.name||null};}
export const DEVICE_AUTH=Object.freeze({DB_NAME,STORE,KEY_RECORD,PENDING_KEY_RECORD,algorithm:'ECDSA-P256-SHA256'});
