(function(global){
  "use strict";
  const VERSION="0.1.0",PARAM=new URLSearchParams(location.search);
  if(PARAM.get("kcSimulation")!=="repair55")return;
  const RESULT="../simulation-results/repair55/manager-test-import.json",BACKUP="kc_repair55_manager_backup";
  async function install(){
    if(!PARAM.has("loaded")){
      const keys=["kcm_sales","kcm_articles","kcm_manager_stock_v1","kcm_manager_stock_ledger_v1"],backup={};
      keys.forEach(key=>backup[key]=localStorage.getItem(key));sessionStorage.setItem(BACKUP,JSON.stringify(backup));
      const payload=await fetch(RESULT,{cache:"no-store"}).then(response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json()});
      if(payload.format!=="KC_MANAGER_SIMULATION_IMPORT_V1"||payload.testOnly!==true)throw Error("Keine isolierte Testdatei");
      localStorage.setItem("kcm_sales",global.KCSalesImportCore?.stringifyStorage?.(payload.transactions)||JSON.stringify(payload.transactions));localStorage.setItem("kcm_articles",JSON.stringify(payload.articles));localStorage.setItem("kcm_manager_stock_v1",JSON.stringify(payload.stock));localStorage.setItem("kcm_manager_stock_ledger_v1",JSON.stringify(payload.ledger));
      location.replace(`${location.pathname}?kcSimulation=repair55&loaded=1`);return;
    }
    document.body.classList.remove("manager-locked");const authDialog=document.getElementById("authDialog");if(authDialog?.open)authDialog.close();
    const banner=document.createElement("aside");banner.id="kcSimulationBanner";banner.style.cssText="position:fixed;z-index:20000;left:12px;right:12px;top:8px;padding:10px 16px;background:#fff3b0;border:2px solid #b77900;border-radius:10px;font-weight:800";banner.textContent="TESTVERSION Repair 55 · künstliche Weihnachtsmarkt-Buchungen · keine Echtdaten";document.body.append(banner);
    setTimeout(()=>{
      global.KCManagerSalesInventoryDashboard?.renderAnalysis?.();global.KCManagerSalesInventoryDashboard?.renderInventory?.();
      const expected=(global.KCSalesImportCore?.parseStorage?.(localStorage.getItem("kcm_sales"))||[]).length,status=document.createElement("div");status.id="kcSimulationStatus";status.textContent=`${expected} Testvorgänge im PC-Manager geladen · Grafiken und Bestand neu berechnet.`;status.style.cssText="position:fixed;z-index:20000;right:18px;bottom:18px;padding:12px;background:#d8f7df;border:2px solid #16803a;border-radius:10px;font-weight:800";document.body.append(status);
    },900);
  }
  install().catch(error=>{const node=document.createElement("pre");node.id="kcSimulationError";node.textContent=`Simulation konnte nicht geladen werden: ${error.message}`;document.body.append(node)});
  global.KCManagerEventSimulation={version:VERSION};
})(window);
