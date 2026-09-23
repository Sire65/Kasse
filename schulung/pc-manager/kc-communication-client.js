(function(global){
  'use strict';

  const DEFAULT_URL='https://ptblnpiroqftcvlsrhac.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY='sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';

  class KCCommunicationError extends Error{
    constructor(message,code,status,details){
      super(message); this.name='KCCommunicationError'; this.code=code||'KC_COMMUNICATION_ERROR'; this.status=status||0; this.details=details||null;
    }
  }

  class KCCommunicationClient{
    constructor(options={}){
      this.baseUrl=(options.baseUrl||DEFAULT_URL).replace(/\/$/,'');
      this.publishableKey=options.publishableKey||DEFAULT_PUBLISHABLE_KEY;
      this.sourceProgram=String(options.sourceProgram||'').trim();
      this.getAccessToken=typeof options.getAccessToken==='function'?options.getAccessToken:async()=>null;
      this.defaultTestOnly=options.defaultTestOnly!==false;
      this.timeoutMs=Math.max(2000,Number(options.timeoutMs)||12000);
      if(!this.sourceProgram) throw new KCCommunicationError('sourceProgram fehlt','SOURCE_PROGRAM_REQUIRED');
    }

    async _accessToken(){
      const token=await this.getAccessToken();
      if(!token) throw new KCCommunicationError('Keine aktive KC-Anmeldung','AUTH_REQUIRED',401);
      return token;
    }

    async _request(functionName,body={},method='POST'){
      const token=await this._accessToken();
      const ctl=new AbortController();
      const timer=setTimeout(()=>ctl.abort(),this.timeoutMs);
      let response;
      try{
        response=await fetch(`${this.baseUrl}/functions/v1/${functionName}`,{
          method,
          headers:{
            'Content-Type':'application/json',
            'apikey':this.publishableKey,
            'Authorization':`Bearer ${token}`,
            'x-client-info':'kc-communication-client/0.2.0'
          },
          body:method==='GET'?undefined:JSON.stringify(body||{}),
          signal:ctl.signal
        });
      }catch(e){
        clearTimeout(timer);
        if(e&&e.name==='AbortError') throw new KCCommunicationError('KC Communication Zeitüberschreitung','TIMEOUT',0);
        throw new KCCommunicationError('KC Communication nicht erreichbar','NETWORK_ERROR',0,{cause:String(e?.message||e)});
      }
      clearTimeout(timer);
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        throw new KCCommunicationError(data?.error||`HTTP ${response.status}`,data?.code||data?.error||'HTTP_ERROR',response.status,data);
      }
      return data;
    }

    async _requestForm(functionName,formData){
      const token=await this._accessToken();
      const ctl=new AbortController();
      const timer=setTimeout(()=>ctl.abort(),Math.max(this.timeoutMs,30000));
      let response;
      try{
        response=await fetch(`${this.baseUrl}/functions/v1/${functionName}`,{
          method:'POST',
          headers:{
            'apikey':this.publishableKey,
            'Authorization':`Bearer ${token}`,
            'x-client-info':'kc-communication-client/0.2.0'
          },
          body:formData,
          signal:ctl.signal
        });
      }catch(e){
        clearTimeout(timer);
        if(e&&e.name==='AbortError') throw new KCCommunicationError('Dateiupload Zeitüberschreitung','TIMEOUT',0);
        throw new KCCommunicationError('KC Communication Upload nicht erreichbar','NETWORK_ERROR',0,{cause:String(e?.message||e)});
      }
      clearTimeout(timer);
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        throw new KCCommunicationError(data?.error||`HTTP ${response.status}`,data?.code||data?.error||'HTTP_ERROR',response.status,data);
      }
      return data;
    }

    async health(){ return this._request('kc-communication-health',{},'POST'); }
    async checkAccess(){
      const data=await this._request('kc-communication-rules-admin',{action:'list'});
      const program=(data?.programs||[]).find(p=>p.id===this.sourceProgram)||null;
      return {ok:!!program,sourceProgram:this.sourceProgram,program,canSend:program?.status==='active'&&program?.permissions?.canSend===true,status:program?.status||'unknown'};
    }
    async uploadAttachment(file,{orgId=null,expiresInHours=168}={}){
      if(!(file instanceof Blob)) throw new KCCommunicationError('Ungültige Datei','FILE_REQUIRED',400);
      const form=new FormData(); form.append('action','upload'); form.append('sourceProgram',this.sourceProgram); if(orgId) form.append('orgId',String(orgId)); form.append('expiresInHours',String(expiresInHours));
      const name=(typeof File!=='undefined'&&file instanceof File&&file.name)?file.name:'attachment.bin'; form.append('file',file,name);
      const data=await this._requestForm('kc-communication-attachments',form); return data?.attachment||null;
    }
    async uploadAttachments(files,{orgId=null,expiresInHours=168}={}){
      const list=Array.from(files||[]); if(list.length>10) throw new KCCommunicationError('Maximal 10 Anhänge pro Nachricht','TOO_MANY_ATTACHMENTS',400);
      const out=[]; for(const file of list){const uploaded=await this.uploadAttachment(file,{orgId,expiresInHours}); if(uploaded) out.push(uploaded);} return out;
    }
    async deleteAttachment(attachmentId,{orgId=null}={}){
      if(!attachmentId) throw new KCCommunicationError('attachmentId fehlt','ATTACHMENT_ID_REQUIRED',400);
      const form=new FormData(); form.append('action','delete'); form.append('sourceProgram',this.sourceProgram); form.append('attachmentId',String(attachmentId)); if(orgId) form.append('orgId',String(orgId)); return this._requestForm('kc-communication-attachments',form);
    }
    async emitEvent(eventKey,{recipients=[],variables={},attachmentIds=[],priority='normal',testOnly=this.defaultTestOnly,correlationId=null,orgId=null}={}){
      if(!eventKey) throw new KCCommunicationError('eventKey fehlt','EVENT_KEY_REQUIRED');
      const vars=variables&&typeof variables==='object'?{...variables}:{}; const ids=[...new Set((Array.isArray(attachmentIds)?attachmentIds:[]).filter(Boolean).map(String))].slice(0,10); if(ids.length) vars.attachmentIds=ids;
      const payload={sourceProgram:this.sourceProgram,eventKey:String(eventKey),recipients:Array.isArray(recipients)?recipients:[],variables:vars,priority,testOnly:testOnly===true,correlationId:correlationId||`${this.sourceProgram}-${eventKey}-${crypto.randomUUID()}`}; if(orgId) payload.orgId=String(orgId);
      return this._request('kc-communication-router',payload,'POST');
    }
    async emitEventWithFiles(eventKey,{files=[],recipients=[],variables={},priority='normal',testOnly=this.defaultTestOnly,correlationId=null,orgId=null,expiresInHours=168}={}){
      const uploaded=await this.uploadAttachments(files,{orgId,expiresInHours}); return this.emitEvent(eventKey,{recipients,variables,attachmentIds:uploaded.map(x=>x.id),priority,testOnly,correlationId,orgId});
    }
  }
  global.KCCommunicationClient=KCCommunicationClient; global.KCCommunicationError=KCCommunicationError;
})(typeof window!=='undefined'?window:globalThis);
