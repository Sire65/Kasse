(function(global){
  'use strict';

  const DEFINITIONS={
    'kc-dp2':{displayName:'KC DP2',events:{shift_changed:{required:['personId','date','from','to'],recipient:'person'},replacement_requested:{required:['date','from','to','recipientPersonIds'],recipient:'people'},plan_released:{required:['orgId','periodLabel'],recipient:'all'}}},
    'kc-verwaltung':{displayName:'KC Verwaltung',events:{member_message:{required:['personId','subject'],recipient:'person'},document_available:{required:['personId','documentTitle'],recipient:'person'}}},
    'kc-academy':{displayName:'KC Academy',events:{course_available:{required:['personId','courseTitle'],recipient:'person'},exam_result:{required:['personId','examTitle','result'],recipient:'person'}}},
    'kc-money-butler':{displayName:'KC Money Butler',events:{report_available:{required:['personId','reportTitle'],recipient:'person'},cash_transfer_ready:{required:['registerId','amount'],recipient:'central'},cash_transfer_confirmed:{required:['transferId','registerId','amount'],recipient:'central'}}},
    'kc-bilderrechner':{displayName:'KC Bilderrechner',events:{export_ready:{required:['personId','exportTitle'],recipient:'person'},closing_report_ready:{required:['registerId','expectedCash'],recipient:'central'}}},
    'kc-wm':{displayName:'KC Weihnachtsmarkt',events:{presentation_ready:{required:['personId','presentationTitle'],recipient:'person'}}},
    'pc-backup-vault':{displayName:'PC Backup Vault',events:{backup_success:{required:[],recipient:'central'},backup_warning:{required:[],recipient:'central'},backup_failed:{required:[],recipient:'central'},backup_cancelled:{required:[],recipient:'central'},backup_interrupted:{required:[],recipient:'central'},backup_resumed:{required:[],recipient:'central'},verify_failed:{required:[],recipient:'central'},restore_test_failed:{required:[],recipient:'central'},tuev_failed:{required:[],recipient:'central'},storage_unreachable:{required:[],recipient:'central'},capacity_warning:{required:[],recipient:'central'},capacity_blocked:{required:[],recipient:'central'},scheduler_failed:{required:[],recipient:'central'},communication_test:{required:[],recipient:'central'}}}
  };

  class KCFachprogrammCommunicationAdapter{
    constructor(client,sourceProgram){if(!client)throw new Error('KCCommunicationClient fehlt');this.client=client;this.sourceProgram=sourceProgram||client.sourceProgram;this.definition=DEFINITIONS[this.sourceProgram]||null;if(!this.definition)throw new Error('Unbekannter KC-Communication-Adapter: '+this.sourceProgram);}
    describe(){return JSON.parse(JSON.stringify({sourceProgram:this.sourceProgram,...this.definition}));}
    validate(eventKey,data={}){const def=this.definition.events[eventKey];if(!def)return{ok:false,code:'EVENT_NOT_DEFINED',missing:[]};const missing=[];for(const k of def.required||[]){const v=data[k];if(k==='recipientPersonIds'){if(!Array.isArray(v)||v.filter(Boolean).length===0)missing.push(k);}else if(v===undefined||v===null||String(v).trim()==='')missing.push(k);}return{ok:missing.length===0,code:missing.length?'REQUIRED_DATA_MISSING':'OK',missing,recipient:def.recipient};}
    async checkAccess(){return this.client.checkAccess();}
    async uploadAttachment(file,options={}){return this.client.uploadAttachment(file,options);}
    async uploadAttachments(files,options={}){return this.client.uploadAttachments(files,options);}
    async deleteAttachment(attachmentId,options={}){return this.client.deleteAttachment(attachmentId,options);}
    async emit(eventKey,data={},options={}){const check=this.validate(eventKey,data);if(!check.ok){const err=new Error('Pflichtdaten fehlen: '+check.missing.join(', '));err.code=check.code;err.missing=check.missing;throw err;}const def=this.definition.events[eventKey];let recipients=[];const orgId=options.orgId||data.orgId||null;if(def.recipient==='person')recipients=[{personId:String(data.personId)}];if(def.recipient==='people')recipients=[...new Set((data.recipientPersonIds||[]).filter(Boolean).map(String))].map(personId=>({personId}));const variables={...data};delete variables.recipientPersonIds;const attachmentIds=[...new Set((options.attachmentIds||data.attachmentIds||[]).filter(Boolean).map(String))].slice(0,10);delete variables.attachmentIds;return this.client.emitEvent(eventKey,{recipients,variables,attachmentIds,priority:options.priority||'normal',testOnly:options.testOnly!==false,correlationId:options.correlationId||null,orgId});}
    async emitWithFiles(eventKey,data={},files=[],options={}){const check=this.validate(eventKey,data);if(!check.ok){const err=new Error('Pflichtdaten fehlen: '+check.missing.join(', '));err.code=check.code;err.missing=check.missing;throw err;}const uploaded=await this.uploadAttachments(files,{orgId:options.orgId||data.orgId||null,expiresInHours:options.expiresInHours||168});return this.emit(eventKey,data,{...options,attachmentIds:uploaded.map(x=>x.id)});}
  }
  function createKCCommunicationAdapter(client){return new KCFachprogrammCommunicationAdapter(client,client?.sourceProgram);}
  global.KCCommunicationAdapterDefinitions=DEFINITIONS;global.KCFachprogrammCommunicationAdapter=KCFachprogrammCommunicationAdapter;global.createKCCommunicationAdapter=createKCCommunicationAdapter;
})(typeof window!=='undefined'?window:globalThis);
