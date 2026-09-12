/* PC Manager – brauner Thermo-/Suppenbecher als zusätzliches Ausgabegefäß.
   Keine automatische Rezeptzuordnung: Auswahl erfolgt bewusst je Rezept im PC Manager. */
(function(global){
  'use strict';
  const VERSION='0.1.1';
  const STORE='kcm_consumables_v1';
  const ID='CONSUMABLE-SOUP-CUP-PAPER-PE-750-WM';
  const ITEM={
    id:ID,
    name:'Suppenbecher mit Deckel, Pappe/PE, 750 ml',
    type:'Verbrauchsmaterial',
    usageType:'Ausgabegefäß / Mitnahmegefäß',
    kind:'Thermo-/Suppenbecher',
    material:'Pappe / PE',
    capacityMl:750,
    packSize:50,
    packPriceGross:12.28,
    packPriceNet:10.32,
    unitCostGross:12.28/50,
    displayedUnitPriceGross:0.25,
    currency:'EUR',
    taxIncluded:true,
    disposable:true,
    reusable:false,
    depositGross:0,
    color:'braun',
    lidIncluded:true,
    image:'assets/suppenbecher_pappe_pe_750ml.jpg',
    sourceNote:'Betreiber-Screenshot vom 12.09.2026: Suppenbecher mit Deckel Pappe PE, 750 ml, 50 Stück; 10,32 € netto / 12,28 € brutto; Shopanzeige 0,25 € je Stück.'
  };
  function read(){try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
  function seed(){
    const list=read(),i=list.findIndex(x=>x.id===ID),old=i>=0?list[i]:{};
    const next={...ITEM,...old,id:ID,packSize:50,packPriceGross:12.28,packPriceNet:10.32,unitCostGross:12.28/50};
    if(i>=0)list[i]=next;else list.push(next);
    localStorage.setItem(STORE,JSON.stringify(list));
    return next;
  }
  const item=seed();
  global.KCThermoCup750=Object.freeze({VERSION,ID,ITEM:item,seed});
})(window);

/* Zentrale Stammdaten/Zuordnungen aus Supabase laden und Änderungen zurückschreiben. */
(function(){
  if(window.KCServingMaterialsSupabase||document.querySelector('script[data-kc-serving-supabase="1"]'))return;
  const s=document.createElement('script');
  s.src='recipe-serving-materials-supabase.js?v=1.0.0';
  s.async=false;
  s.dataset.kcServingSupabase='1';
  document.head.appendChild(s);
})();
