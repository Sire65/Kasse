(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ProductInfoCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='0.1.0';
  const BIG14=['gluten','crustaceans','eggs','fish','peanuts','soy','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs'];
  const STATUS=['contained','traces','not-contained','not-checked'];
  const NUTRIENTS=['energyKj','energyKcal','fat','saturates','carbohydrate','sugars','protein','salt'];
  const text=(v,n=1000)=>String(v??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,n);
  function normalize(record={}){
    const allergens={}; BIG14.forEach(id=>{const val=record.allergens?.[id];allergens[id]=STATUS.includes(val)?val:'not-checked'});
    const nutrition={}; NUTRIENTS.forEach(id=>{const v=Number(record.nutrition?.[id]);nutrition[id]=Number.isFinite(v)&&v>=0?v:null});
    return {schema:'KC_PRODUCT_INFO_V1',productId:text(record.productId,80),version:text(record.version||'1.0.0',30),status:['draft','incomplete','review','approved','outdated','blocked'].includes(record.status)?record.status:'draft',shortDescription:text(record.shortDescription,300),ingredients:text(record.ingredients,5000),additives:text(record.additives,2000),important:text(record.important,1000),portionLabel:text(record.portionLabel,100),portionGrams:Number(record.portionGrams)||null,allergens,nutrition,nutritionBasis:record.nutritionBasis==='portion'?'portion':'100g',manufacturer:text(record.manufacturer,300),supplier:text(record.supplier,300),source:text(record.source,500),validAt:text(record.validAt,40),approvedBy:text(record.approvedBy,150),approvedAt:text(record.approvedAt,40)};
  }
  function validate(record){const r=normalize(record),errors=[];if(!r.productId)errors.push('productId fehlt');if(r.status==='approved'&&!r.source)errors.push('Quelle fehlt');if(r.status==='approved'&&!r.approvedAt)errors.push('Freigabedatum fehlt');return {ok:errors.length===0,errors,record:r};}
  function canPublish(record){const v=validate(record);return v.ok&&v.record.status==='approved';}
  return Object.freeze({VERSION,BIG14,STATUS,NUTRIENTS,normalize,validate,canPublish});
});
