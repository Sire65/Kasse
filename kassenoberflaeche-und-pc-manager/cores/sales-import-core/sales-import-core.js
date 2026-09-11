(function(global){
  "use strict";
  const VERSION="0.2.0",text=(value,max=120)=>String(value??"").slice(0,max),num=value=>Number(value)||0;
  function item(row,index=0){return{id:text(row?.id||`ITEM-${index+1}`,80),name:text(row?.name,100),qty:num(row?.qty),price:num(row?.price)}}
  function transaction(row,source={}){
    return{transactionId:text(row?.transactionId||row?.id||`${source.registerId||row?.registerId||"UNKNOWN"}-${row?.bon||row?.bonNumber||row?.time}`,100),bon:text(row?.bon||row?.bonNumber,40),time:row?.time||row?.endTime||row?.startTime,registerId:text(source.registerId||row?.registerId||"UNKNOWN",80),registerName:text(source.registerName||row?.registerName,80),operator:text(row?.operator,80),type:text(row?.type||"sale",30),training:!!row?.training,method:text(row?.method||row?.payment,40),total:num(row?.total??row?.due),items:Array.isArray(row?.items)?row.items.map(item):[]}
  }
  function merge(existing,incoming,source={}){
    const output=[],seen=new Set(),duplicates=[];
    for(const row of [...(existing||[]),...(incoming||[]).map(value=>transaction(value,source))]){
      const clean=row?.items&&row?.transactionId?row:transaction(row,source),key=clean.transactionId||`${clean.registerId}-${clean.bon}-${clean.time}`;
      if(seen.has(key)){duplicates.push(key);continue}seen.add(key);output.push(clean)
    }
    return{transactions:output,duplicates,added:Math.max(0,output.length-(existing||[]).length)}
  }
  function pack(rows){
    const articles=[],articleMap=new Map(),registers=[],registerMap=new Map(),operators=[],operatorMap=new Map(),methods=[],methodMap=new Map(),types=[],typeMap=new Map();
    const dict=(map,list,value)=>{const key=String(value??"");if(!map.has(key)){map.set(key,list.length);list.push(key)}return map.get(key)};
    const articleIndex=row=>{const id=text(row?.id,80),name=text(row?.name,100),key=`${id}\u0000${name}`;if(!articleMap.has(key)){articleMap.set(key,articles.length);articles.push([id,name])}return articleMap.get(key)};
    const packed=(rows||[]).map(raw=>{const row=transaction(raw),registerKey=`${row.registerId}\u0000${row.registerName}`;if(!registerMap.has(registerKey)){registerMap.set(registerKey,registers.length);registers.push([row.registerId,row.registerName])}
      return[row.transactionId,row.bon,row.time,registerMap.get(registerKey),dict(operatorMap,operators,row.operator),dict(typeMap,types,row.type),row.training?1:0,dict(methodMap,methods,row.method),row.total,row.items.map(entry=>[articleIndex(entry),entry.qty,entry.price])];
    });
    return{format:"KC_SALES_COMPACT_V1",a:articles,r:registers,o:operators,m:methods,y:types,d:packed};
  }
  function unpack(value){
    if(Array.isArray(value))return value.map(row=>transaction(row));
    if(!value||value.format!=="KC_SALES_COMPACT_V1"||!Array.isArray(value.d))return[];
    return value.d.map(row=>{const register=value.r?.[row[3]]||["",""],items=(row[9]||[]).map(entry=>{const article=value.a?.[entry[0]]||["",""];return{id:article[0],name:article[1],qty:num(entry[1]),price:num(entry[2])}});
      return{transactionId:text(row[0],100),bon:text(row[1],40),time:row[2],registerId:register[0],registerName:register[1],operator:value.o?.[row[4]]||"",type:value.y?.[row[5]]||"sale",training:!!row[6],method:value.m?.[row[7]]||"",total:num(row[8]),items};
    });
  }
  function parseStorage(serialized){if(!serialized)return[];try{return unpack(JSON.parse(serialized))}catch{return[]}}
  function stringifyStorage(rows){return JSON.stringify(pack(rows))}
  const api={VERSION,item,transaction,merge,pack,unpack,parseStorage,stringifyStorage};global.KCSalesImportCore=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
  global.KCReleaseManifest?.register?.("salesImportCore",VERSION);
})(typeof window!=="undefined"?window:globalThis);
