/* PRODUKTIVER SOURCE-OF-TRUTH: money-butler/ – Auth- und Rollenlogik nicht aus Schulungs-/Suite-Kopien zurückkopieren. */
(function(global){
  'use strict';

  const BASE_URL='https://ptblnpiroqftcvlsrhac.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const ORG_ID='KC_WERNE';
  const APP_ID='KC_MONEY_BUTLER';
  const SESSION_KEY='kc_money_butler_auth_session_v1';
  const ROLE_LABELS={admin:'Admin',manager:'Kassenwart',operator:'Vertretung'};
  const ALLOWED_ROLES=new Set(Object.keys(ROLE_LABELS));
  let current=null;
  let readyResolve;
  const ready=new Promise(resolve=>{readyResolve=resolve});

  const el=id=>document.getElementById(id);
  const jsonHeaders=()=>({'Content-Type':'application/json','apikey':PUBLISHABLE_KEY});
  const authHeaders=token=>({'apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+token});
  const safeJson=async response=>{try{return await response.json()}catch{return {}}};

  function readStored(){
    for(const storage of [localStorage,sessionStorage]){
      try{
        const value=JSON.parse(storage.getItem(SESSION_KEY)||'null');
        if(value?.access_token&&value?.refresh_token)return {...value,_storage:storage===localStorage?'local':'session'};
      }catch{}
    }
    return null;
  }
  function clearStored(){
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
  function normalizeSession(data,remember){
    const expiresAt=Number(data?.expires_at)||Math.floor(Date.now()/1000)+Math.max(60,Number(data?.expires_in)||3600);
    return {
      access_token:String(data?.access_token||''),
      refresh_token:String(data?.refresh_token||''),
      token_type:String(data?.token_type||'bearer'),
      expires_at:expiresAt,
      user:data?.user||null,
      remember:remember!==false
    };
  }
  function store(session){
    if(!session)return;
    const target=session.remember===false?sessionStorage:localStorage;
    const other=session.remember===false?localStorage:sessionStorage;
    other.removeItem(SESSION_KEY);
    target.setItem(SESSION_KEY,JSON.stringify(session));
  }
  async function authRequest(path,body){
    const response=await fetch(BASE_URL+path,{method:'POST',headers:jsonHeaders(),body:JSON.stringify(body||{})});
    const data=await safeJson(response);
    if(!response.ok)throw new Error(data?.msg||data?.error_description||data?.error||('Anmeldung fehlgeschlagen (HTTP '+response.status+')'));
    return data;
  }
  async function refresh(session){
    if(!session?.refresh_token)throw new Error('Keine gespeicherte Sitzung.');
    const data=await authRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    const next=normalizeSession(data,session.remember!==false);
    store(next);
    return next;
  }
  async function accessToken(){
    let session=readStored();
    if(!session)return null;
    const expiresAt=Number(session.expires_at||0)*1000;
    if(!expiresAt||expiresAt-Date.now()<90000){
      try{session=await refresh(session)}
      catch{clearStored();current=null;return null}
    }
    return session.access_token||null;
  }
  async function getUser(token){
    const response=await fetch(BASE_URL+'/auth/v1/user',{headers:authHeaders(token)});
    const data=await safeJson(response);
    if(!response.ok||!data?.id)throw new Error('Die gespeicherte Anmeldung ist nicht mehr gültig.');
    return data;
  }
  async function rows(table,params,token){
    const qs=new URLSearchParams(params);
    const response=await fetch(BASE_URL+'/rest/v1/'+table+'?'+qs.toString(),{headers:{...authHeaders(token),'Accept':'application/json'}});
    const data=await safeJson(response);
    if(!response.ok)throw new Error(data?.message||('Berechtigungsprüfung fehlgeschlagen (HTTP '+response.status+')'));
    return Array.isArray(data)?data:[];
  }
  async function bootstrapAccess(token){
    const response=await fetch(BASE_URL+'/functions/v1/kc-money-butler-account-bootstrap',{
      method:'POST',
      headers:{...authHeaders(token),'Content-Type':'application/json'},
      body:'{}'
    });
    const data=await safeJson(response);
    if(!response.ok){
      const map={
        NO_ELIGIBLE_KC_PERSON:'Diese E-Mail ist keinem freigegebenen KC-Mitglied zugeordnet.',
        MONEY_BUTLER_NOT_ENABLED:'Für dieses Mitglied ist Money Butler nicht freigeschaltet.',
        PERSON_ALREADY_LINKED:'Dieses KC-Mitglied ist bereits mit einem anderen Benutzerkonto verknüpft.',
        AMBIGUOUS_EMAIL_MATCH:'Die E-Mail ist im Mitgliederbestand nicht eindeutig.'
      };
      const err=new Error(map[data?.error]||data?.error||('Zugangsprüfung fehlgeschlagen (HTTP '+response.status+')'));
      err.code=data?.error||'BOOTSTRAP_FAILED';
      throw err;
    }
    return data;
  }
  async function checkAccess(){
    const token=await accessToken();
    if(!token)return null;
    const user=await getUser(token);
    const result=await bootstrapAccess(token);
    const resolvedRole=['admin','superadmin'].includes(String(result?.coreRole||''))?'admin':String(result?.accessRole||'');
    if(!ALLOWED_ROLES.has(resolvedRole)){
      const err=new Error('Der Money-Butler-Zugang ist derzeit nicht freigeschaltet.');
      err.code='ACCESS_DISABLED';
      throw err;
    }
    current={
      user,
      link:{org_id:result.orgId,person_id:result.personId,core_role:result.coreRole,active:true},
      access:{app_id:result.appId,access_role:result.accessRole,active:true},
      displayName:result.displayName||user.email||'KC Benutzer',
      role:resolvedRole,
      roleLabel:ROLE_LABELS[resolvedRole]||resolvedRole
    };
    return current;
  }
  function showGate(message='',keepEmail=true){
    document.body.classList.add('mb-auth-locked');
    document.body.classList.remove('mb-auth-pending');
    const gate=el('mbAuthGate');
    if(gate)gate.hidden=false;
    if(message)el('mbAuthMessage').textContent=message;
    if(!keepEmail&&el('mbAuthEmail'))el('mbAuthEmail').value='';
    el('mbAuthPassword')?.focus();
  }
  function showApp(){
    document.body.classList.remove('mb-auth-locked','mb-auth-pending');
    const gate=el('mbAuthGate');
    if(gate)gate.hidden=true;
    const status=el('mbAuthUserStatus');
    if(status&&current)status.textContent=current.displayName+' · '+current.roleLabel;
    const logout=el('mbAuthLogout');
    if(logout)logout.hidden=false;
    global.dispatchEvent(new CustomEvent('kc-money-butler-auth-changed',{detail:current}));
  }
  async function signIn(email,password,remember=true){
    const data=await authRequest('/auth/v1/token?grant_type=password',{email:String(email||'').trim(),password:String(password||'')});
    const session=normalizeSession(data,remember);
    clearStored();
    store(session);
    try{
      const access=await checkAccess();
      showApp();
      return access;
    }catch(err){
      if(err?.code!=='ACCESS_DISABLED')clearStored();
      throw err;
    }
  }
  async function signUp(email,password,remember=true){
    const mail=String(email||'').trim();
    const pwd=String(password||'');
    if(!mail)throw new Error('Bitte die E-Mail-Adresse eintragen.');
    if(pwd.length<8)throw new Error('Das Passwort muss mindestens 8 Zeichen haben.');
    const data=await authRequest('/auth/v1/signup',{email:mail,password:pwd});
    if(data?.access_token&&data?.refresh_token){
      const session=normalizeSession(data,remember);
      clearStored();store(session);
      const access=await checkAccess();
      showApp();
      return {confirmationRequired:false,access};
    }
    return {confirmationRequired:true,user:data?.user||null};
  }
  async function signOut(){
    const token=await accessToken();
    if(token){
      try{await fetch(BASE_URL+'/auth/v1/logout',{method:'POST',headers:{...authHeaders(token),'Content-Type':'application/json'}})}catch{}
    }
    clearStored();
    current=null;
    const status=el('mbAuthUserStatus');if(status)status.textContent='Nicht angemeldet';
    const logout=el('mbAuthLogout');if(logout)logout.hidden=true;
    showGate('Bitte mit dem persönlichen KC-Zugang anmelden.',false);
  }
  async function init(){
    const form=el('mbAuthForm');
    form?.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=el('mbAuthSubmit'),message=el('mbAuthMessage');
      button.disabled=true;button.textContent='Anmeldung läuft …';
      try{
        await signIn(el('mbAuthEmail').value,el('mbAuthPassword').value,el('mbAuthRemember').checked);
        el('mbAuthPassword').value='';
        message.textContent='Angemeldet.';
      }catch(err){
        message.textContent=err?.message||String(err);
        showGate(message.textContent,true);
      }finally{button.disabled=false;button.textContent='Anmelden'}
    });
    el('mbAuthActivateToggle')?.addEventListener('click',()=>{
      const box=el('mbAuthActivateBox');
      if(!box)return;
      box.hidden=!box.hidden;
      if(!box.hidden)el('mbAuthNewPassword')?.focus();
    });
    el('mbAuthActivate')?.addEventListener('click',async()=>{
      const message=el('mbAuthMessage'),button=el('mbAuthActivate');
      const email=el('mbAuthEmail')?.value||'';
      const p1=String(el('mbAuthNewPassword')?.value||'');
      const p2=String(el('mbAuthNewPassword2')?.value||'');
      if(p1!==p2){message.textContent='Die beiden Passwörter stimmen nicht überein.';return;}
      button.disabled=true;button.textContent='Zugang wird eingerichtet …';
      try{
        const result=await signUp(email,p1,el('mbAuthRemember')?.checked!==false);
        if(result.confirmationRequired){
          message.textContent='Bestätigungs-E-Mail wurde gesendet. Bitte den Link öffnen und danach hier mit dem neuen Passwort anmelden.';
          el('mbAuthActivateBox').hidden=true;
          el('mbAuthPassword').value='';
        }else{
          message.textContent='Zugang ist eingerichtet und angemeldet.';
          el('mbAuthActivateBox').hidden=true;
        }
      }catch(err){
        message.textContent=err?.message||String(err);
      }finally{button.disabled=false;button.textContent='Erstzugang einrichten'}
    });
    el('mbAuthRetry')?.addEventListener('click',async()=>{
      const message=el('mbAuthMessage');message.textContent='Zugang wird erneut geprüft …';
      try{await checkAccess();showApp()}catch(err){showGate(err?.message||String(err),true)}
    });
    el('mbAuthLogout')?.addEventListener('click',signOut);
    const stored=readStored();
    if(!stored){
      showGate('Bitte mit dem persönlichen KC-Zugang anmelden.',false);
      readyResolve(null);
      return;
    }
    if(el('mbAuthRemember'))el('mbAuthRemember').checked=stored.remember!==false;
    try{await checkAccess();showApp();readyResolve(current)}
    catch(err){showGate(err?.message||String(err),true);readyResolve(null)}
  }

  global.KCMoneyButlerAuth={
    BASE_URL,PUBLISHABLE_KEY,ORG_ID,APP_ID,ROLE_LABELS,
    ready,
    getAccessToken:accessToken,
    getCurrent:()=>current,
    checkAccess,
    signIn,
    signUp,
    signOut
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(window);
