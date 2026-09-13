"use strict";
(function(global){
  const VERSION="1.0.0";
  const text=(v,max=200)=>String(v??"").slice(0,max);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const bool=v=>v===true;
  const arr=v=>Array.isArray(v)?v:[];
  const id=v=>text(v,120);
  const date=v=>text(v,40);
  const pick=(source,keys)=>{const out={};for(const key of keys){if(source&&source[key]!==undefined)out[key]=source[key]}return out};
  function cleanItem(row){
    const out=pick(row,["id","productId","name","receiptText","qty","price","lineTotal","category","optionId","optionName","depositType","discountType","discountValue","discountAmount","accountId"]);
    if(out.id!==undefined)out.id=id(out.id); if(out.productId!==undefined)out.productId=id(out.productId);
    if(out.name!==undefined)out.name=text(out.name,120); if(out.receiptText!==undefined)out.receiptText=text(out.receiptText,120);
    ["qty","price","lineTotal","discountValue","discountAmount"].forEach(k=>{if(out[k]!==undefined)out[k]=num(out[k])});
    return out;
  }
  function cleanTransaction(row){
    const out=pick(row,["transactionId","bon","bonNumber","startTime","endTime","time","registerId","registerName","operator","type","method","payment","due","total","given","change","training","originalTransactionId","originalBon","reason","accountId","accountName","accountEventId","invoiceId","recordHash","previousHash"]);
    ["transactionId","registerId","originalTransactionId","accountId","accountEventId","invoiceId","recordHash","previousHash"].forEach(k=>{if(out[k]!==undefined)out[k]=id(out[k])});
    ["registerName","operator","type","method","payment","reason","accountName"].forEach(k=>{if(out[k]!==undefined)out[k]=text(out[k],200)});
    ["due","total","given","change"].forEach(k=>{if(out[k]!==undefined)out[k]=num(out[k])});
    if(out.training!==undefined)out.training=bool(out.training);
    out.items=arr(row?.items).map(cleanItem);
    return out;
  }
  function cleanCashMovement(row){
    const out=pick(row,["transferId","poolId","scope","registerId","registerIds","type","effectiveDate","total","currency","breakdown","note","importedAt"]);
    ["transferId","poolId","registerId"].forEach(k=>{if(out[k]!==undefined)out[k]=id(out[k])});
    if(out.registerIds!==undefined)out.registerIds=arr(out.registerIds).map(id);
    if(out.total!==undefined)out.total=num(out.total);
    if(out.breakdown&&typeof out.breakdown==="object"&&!Array.isArray(out.breakdown)){
      const b={};for(const [k,v] of Object.entries(out.breakdown)){const n=Number(v);if(Number.isInteger(n)&&n>=0)b[String(k)]=n}out.breakdown=b;
    } else delete out.breakdown;
    if(out.note!==undefined)out.note=text(out.note,250);
    return out;
  }
  function cleanClosing(row){
    const out=pick(row,["closingId","registerId","businessDate","createdAt","cashExpected","cashCounted","difference","status"]);
    ["closingId","registerId"].forEach(k=>{if(out[k]!==undefined)out[k]=id(out[k])});
    ["cashExpected","cashCounted","difference"].forEach(k=>{if(out[k]!==undefined)out[k]=num(out[k])});
    return out;
  }
  function cleanTip(row){const out=pick(row,["id","transactionId","time","registerId","amount"]);if(out.id!==undefined)out.id=id(out.id);if(out.transactionId!==undefined)out.transactionId=id(out.transactionId);if(out.registerId!==undefined)out.registerId=id(out.registerId);if(out.amount!==undefined)out.amount=num(out.amount);return out}
  function cleanWithdrawal(row){const out=pick(row,["id","time","registerId","amount","reason","operator"]);if(out.id!==undefined)out.id=id(out.id);if(out.registerId!==undefined)out.registerId=id(out.registerId);if(out.amount!==undefined)out.amount=num(out.amount);if(out.reason!==undefined)out.reason=text(out.reason,200);if(out.operator!==undefined)out.operator=text(out.operator,100);return out}
  function cleanAudit(row){const out=pick(row,["id","time","entity","action","entityId","result"]);["id","entityId"].forEach(k=>{if(out[k]!==undefined)out[k]=id(out[k])});["entity","action","result"].forEach(k=>{if(out[k]!==undefined)out[k]=text(out[k],80)});return out}
  function buildEventPayload(source={}){
    return {
      transactions:arr(source.transactions).map(cleanTransaction),
      trainingTransactions:arr(source.trainingTransactions).map(cleanTransaction),
      tips:arr(source.tips).map(cleanTip),
      withdrawals:arr(source.withdrawals).map(cleanWithdrawal),
      cashMovements:arr(source.cashMovements).map(cleanCashMovement),
      closings:arr(source.closings).map(cleanClosing),
      discountAudit:arr(source.discountAudit).map(cleanAudit)
    };
  }
  function cleanGroup(row){const out=pick(row,["id","name","shortName","sortOrder","color","active","notes"]);out.id=id(out.id);out.name=text(out.name,100);if(out.shortName!==undefined)out.shortName=text(out.shortName,60);if(out.sortOrder!==undefined)out.sortOrder=num(out.sortOrder);if(out.active!==undefined)out.active=out.active!==false;if(out.notes!==undefined)out.notes=text(out.notes,300);return out}
  function cleanProduct(row){
    const out=pick(row,["id","name","shortName","receiptText","category","image","barcode","price","active","color","optionGroup","manualDeposit","depositComponents","info"]);
    out.id=id(out.id);out.name=text(out.name,120);if(out.shortName!==undefined)out.shortName=text(out.shortName,60);if(out.receiptText!==undefined)out.receiptText=text(out.receiptText,120);if(out.category!==undefined)out.category=text(out.category,80);if(out.image!==undefined)out.image=text(out.image,500);if(out.barcode!==undefined)out.barcode=text(out.barcode,80);out.price=num(out.price);if(out.active!==undefined)out.active=out.active!==false;
    if(out.depositComponents!==undefined)out.depositComponents=arr(out.depositComponents).map(x=>({id:id(x?.id),name:text(x?.name,100),price:num(x?.price)}));
    if(out.info&&typeof out.info==="object")out.info=pick(out.info,["status","shortDescription","ingredients","additives","allergens","important","nutrition","source","approvedAt"]);
    return out;
  }
  function cleanPackage(row){const out=pick(row,["id","name","componentIds","price","category","active","autoManaged","source","note"]);out.id=id(out.id);out.name=text(out.name,120);out.componentIds=arr(out.componentIds).map(id);out.price=num(out.price);if(out.active!==undefined)out.active=out.active!==false;if(out.note!==undefined)out.note=text(out.note,250);return out}
  function cleanOffer(row){const out=pick(row,["id","name","type","productIds","priceMode","priceValue","startTime","endTime","active","manualStart","days"]);out.id=id(out.id);out.name=text(out.name,120);out.productIds=arr(out.productIds).map(id);if(out.priceValue!==undefined)out.priceValue=num(out.priceValue);if(out.active!==undefined)out.active=out.active!==false;if(out.manualStart!==undefined)out.manualStart=bool(out.manualStart);out.days=arr(out.days).map(x=>text(x,12));return out}
  function cleanSettings(row){return pick(row,["clubName","eventName","registerName","registerId","depositRule","showProductInfo","highlightAllergens","notificationProfile","buttonSize","buttonMode","showPrice","showStaff","showTip","showDeposit","showPrint","showMore","showChange","showCard","showAccount","showDiscount","showHappyHour","showRushMode","allowTraining","requireChangeFlow","rushMode","autoFavorites","groupColorMode","receipt"])}
  function cleanConfigPayload(source={}){
    const out={};
    if(source.groups)out.groups=arr(source.groups).map(cleanGroup);
    if(source.articles||source.products)out.articles=arr(source.articles||source.products).map(cleanProduct);
    if(source.packages)out.packages=arr(source.packages).map(cleanPackage);
    if(source.offers)out.offers=arr(source.offers).map(cleanOffer);
    if(source.settings)out.settings=cleanSettings(source.settings);
    if(source.receipt)out.receipt=pick(source.receipt,["header","head1","head2","vat","foot1","autoPrint"]);
    return out;
  }
  function validateEnvelope(pkg,allowedSchemas){
    const errors=[];
    if(!pkg||typeof pkg!=="object"||Array.isArray(pkg))return ["Paket ist kein Objekt"];
    if(!allowedSchemas.includes(pkg.schema))errors.push("Schema nicht unterstützt");
    if(!id(pkg.packageId)||id(pkg.packageId).length<8)errors.push("Paket-ID fehlt oder ist zu kurz");
    if(!date(pkg.createdAt))errors.push("Erstellungszeit fehlt");
    const allowed=new Set(pkg.schema==="KCB-CONFIG-1"?["schema","packageId","createdAt","validUntil","targetId","payload","integrity"]:["schema","packageId","sourceId","createdAt","events","integrity"]);
    for(const key of Object.keys(pkg))if(!allowed.has(key))errors.push(`Nicht erlaubtes Feld: ${key}`);
    return errors;
  }
  global.KCBExchange=Object.freeze({VERSION,buildEventPayload,cleanConfigPayload,validateEnvelope,cleanCashMovement});
})(window);
