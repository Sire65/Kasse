(function(global){
  'use strict';

  class KCFinanceBridge{
    constructor(client){
      if(!client||typeof client._request!=='function') throw new Error('KCCommunicationClient fehlt');
      this.client=client;
    }

    async createCashTransfer({registerId,amount,businessDate=null,variables={},correlationId=null,orgId=null}={}){
      return this.client._request('kc-finance-bridge',{
        action:'cash_transfer_create',
        sourceProgram:'kc-money-butler',
        registerId,
        amount,
        businessDate,
        variables,
        correlationId:correlationId||`money-${crypto.randomUUID()}`,
        orgId
      });
    }

    async listCashTransfers({statuses=['pending_manager'],limit=100,orgId=null}={}){
      return this.client._request('kc-finance-bridge',{
        action:'cash_transfer_list',statuses,limit,orgId
      });
    }

    async markCashTransfer(id,status,{orgId=null}={}){
      return this.client._request('kc-finance-bridge',{
        action:'cash_transfer_mark',id,status,orgId
      });
    }

    async listClosingReports({onlyUnimported=true,limit=100,orgId=null}={}){
      return this.client._request('kc-finance-bridge',{
        action:'closing_report_list',onlyUnimported,limit,orgId
      });
    }

    async markClosingReportImported(id,{orgId=null}={}){
      return this.client._request('kc-finance-bridge',{
        action:'closing_report_mark_imported',id,orgId
      });
    }
  }

  function createKCFinanceBridge(client){return new KCFinanceBridge(client);}
  global.KCFinanceBridge=KCFinanceBridge;
  global.createKCFinanceBridge=createKCFinanceBridge;
})(typeof window!=='undefined'?window:globalThis);
