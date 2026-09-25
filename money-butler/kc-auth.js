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
  async function checkAccess(){
    const token=await accessToken();
    if(!token)return null;
    const user=await getUser(token);
    const links=await rows('kc_core_user_links',{
      select:'org_id,person_id,core_role,active',
      user_id:'eq.'+user.id,
      org_id:'eq.'+ORG_ID,
      active:'eq.true',
      limit:'1'
    },token);
    const link=links[0];
    if(!link)throw new Error('Dieses Benutzerkonto ist dem Köcheclub Werne nicht zugeordnet.');
    const accessRows=await rows('kc_core_app_access',{
      select:'org_id,person_id,app_id,access_role,active',
      org_id:'eq.'+ORG_ID,
      person_id:'eq.'+link.person_id,
      app_id:'eq.'+APP_ID,
      limit:'1'
    },token);
    const access=accessRows[0]||null;
    if(!access||access.active!==true||!ALLOWED_ROLES.has(String(access.access_role))){
      const err=new Error('Der Money-Butler-Zugang ist derzeit nicht freigeschaltet.');
      err.code='ACCESS_DISABLED';
      throw err;
    }
    let displayName=user.email||'KC Benutzer';
    try{
      const people=await rows('kc_core_people',{select:'display_name',person_id:'eq.'+link.person_id,limit:'1'},token);
      if(people[0]?.display_name)displayName=people[0].display_name;
    }catch{}
    current={user,link,access,displayName,role:String(access.access_role),roleLabel:ROLE_LABELS[String(access.access_role)]||String(access.access_role)};
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
    signOut
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(window);
