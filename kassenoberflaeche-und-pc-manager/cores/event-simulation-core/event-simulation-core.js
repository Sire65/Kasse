(function(global){
  "use strict";
  const VERSION="0.1.0";
  function rng(seed=20261204){let value=seed>>>0;return()=>((value=Math.imul(1664525,value)+1013904223>>>0)/4294967296)}
  function pick(random,weighted){let value=random()*weighted.reduce((sum,row)=>sum+row.weight,0);for(const row of weighted){value-=row.weight;if(value<=0)return row}return weighted[weighted.length-1]}
  function cents(value){return Math.round(Number(value||0)*100)}
  function hashText(text){let a=0x811c9dc5,b=0x9e3779b9;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),0x01000193);b=Math.imul(b^(text.charCodeAt(i)+i),0x85ebca6b)}return`${(a>>>0).toString(16).padStart(8,"0")}${(b>>>0).toString(16).padStart(8,"0")}`}
  function canonical(row){const copy=JSON.parse(JSON.stringify(row));delete copy.recordHash;return JSON.stringify(copy)}
  function transaction({register,index,time,items,method="cash",previousHash=null,type="sale"}){
    const due=items.reduce((sum,item)=>sum+Number(item.price)*Number(item.qty),0),bon=`${register.id}-${String(index).padStart(6,"0")}`;
    const row={transactionId:`SIM-${register.id}-${String(index).padStart(6,"0")}`,formatVersion:5,bon,bonNumber:bon,startTime:new Date(new Date(time).getTime()-45000).toISOString(),time,endTime:time,registerId:register.id,registerName:register.name,operator:register.operator,type,training:false,method,payment:method,grossDue:+due.toFixed(2),grossDueCents:cents(due),discount:{percent:0,amount:0,amountCents:0,globalAmount:0,positionAmount:0,base:+due.toFixed(2),reason:null,note:null,keys:[],positions:[]},due:+due.toFixed(2),total:+due.toFixed(2),dueCents:cents(due),given:+due.toFixed(2),givenCents:cents(due),settlementTarget:+due.toFixed(2),isPayout:due<0,payout:due<0?+Math.abs(due).toFixed(2):0,payoutCents:due<0?cents(Math.abs(due)):0,change:0,changeCents:0,depositRule:"manual",items:items.map(item=>({...item,unitTotal:+Number(item.price).toFixed(2),lineTotal:+(Number(item.price)*Number(item.qty)).toFixed(2)})),previousHash};
    row.recordHash=hashText(canonical(row));return row;
  }
  function timeFor(random,date,index,count){
    const peak=random()<.58,base=peak?(random()<.48?17:19):(11+Math.floor(random()*10)),minute=Math.floor(random()*60),second=(index*17)%60;
    return new Date(`${date}T${String(Math.min(21,base)).padStart(2,"0")}:${String(minute).padStart(2,"0")}:${String(second).padStart(2,"0")}+01:00`).toISOString();
  }
  function generate(config){
    const random=rng(config.seed),articles=config.articles,byId=new Map(articles.map(a=>[a.id,a])),weighted=config.weights.map(row=>({...row,article:byId.get(row.id)})),registers=config.registers,days=config.days;
    const all=[],perRegister={};registers.forEach(register=>perRegister[register.id]=[]);
    for(const day of days)for(let i=1;i<=day.bons;i++){
      const register=registers[i%registers.length],items=[],lines=1+(random()<.48?1:0)+(random()<.16?1:0);
      for(let line=0;line<lines;line++){const chosen=pick(random,weighted).article;if(!chosen)continue;const existing=items.find(x=>x.id===chosen.id),qty=random()<.18?2:1;if(existing)existing.qty+=qty;else items.push({id:chosen.id,name:chosen.name,category:chosen.category,price:chosen.price,qty})}
      if(items.some(x=>["grot","gweiss","feuer","eier","apfel"].includes(x.id))&&random()<.72){const p=byId.get("glasplus");items.push({id:p.id,name:p.name,category:p.category,price:p.price,qty:1})}
      if(random()<.19){const p=byId.get(random()<.12?"glaszangebundleminus":"glasminus");items.push({id:p.id,name:p.name,category:p.category,price:p.price,qty:1})}
      const rows=perRegister[register.id],row=transaction({register,index:rows.length+1,time:timeFor(random,day.date,i,day.bons),items,method:random()<.12?"card":"cash",previousHash:rows.at(-1)?.recordHash||null});
      rows.push(row);all.push(row);
    }
    all.sort((a,b)=>a.time.localeCompare(b.time));
    return{all,perRegister,summary:{seed:config.seed,registers:registers.length,days:days.length,transactions:all.length,items:all.reduce((n,tx)=>n+tx.items.length,0),storageBytes:Object.fromEntries(Object.entries(perRegister).map(([id,rows])=>[id,new TextEncoder().encode(JSON.stringify(rows)).length]))}};
  }
  function verifyChains(perRegister){const errors=[];for(const[id,rows]of Object.entries(perRegister))rows.forEach((row,index)=>{if(row.previousHash!==(rows[index-1]?.recordHash||null))errors.push(`${id}/${row.bon}: Hashkette`);if(row.recordHash!==hashText(canonical(row)))errors.push(`${id}/${row.bon}: Datensatzhash`)});return errors}
  const api={VERSION,rng,transaction,generate,verifyChains,hashText};
  global.KCEventSimulationCore=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
