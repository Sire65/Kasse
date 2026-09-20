(function(global){
  'use strict';
  const settings=()=>global.KCCashMeasureSettings?.read?.();
  let mode='defer';
  const $=id=>document.getElementById(id);
  const euro=v=>Number(v)>=1?Number(v)+' €':Math.round(Number(v)*100)+' ct';
  const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);

  function noteRows(s,kind){
    return s.notes.map(x=>{
      const canWeigh=kind==='weigh'&&Number(x.grams)>0;
      return `<div class="closing-measure-row">
        <img src="${x.image||'assets/schein_'+x.value+'.jpg'}" alt="">
        <strong>${euro(x.value)}</strong>
        <label>${canWeigh?'Gewicht g':'Anzahl'}<input type="number" min="0" step="${canWeigh?'.01':'1'}" inputmode="decimal" data-closing-${canWeigh?'weight':'count'}="note" data-value="${x.value}" data-unit-grams="${x.grams||''}" value="0"></label>
        <b data-closing-line="${kind}-note-${x.value}">${money(0)}</b>
      </div>`;
    }).join('');
  }
  function coinRows(s,kind){
    return s.coins.map(x=>{
      const weigh=kind==='weigh';
      return `<div class="closing-measure-row coin">
        <img src="${x.image||'assets/muenze_'+x.value+'.webp'}" alt="">
        <strong>${euro(x.value)}</strong>
        <label>${weigh?'Gewicht g':'Anzahl'}<input type="number" min="0" step="${weigh?'.01':'1'}" inputmode="decimal" data-closing-${weigh?'weight':'count'}="coin" data-value="${x.value}" data-unit-grams="${x.grams||''}" value="0"></label>
        <b data-closing-line="${kind}-coin-${x.value}">${money(0)}</b>
      </div>`;
    }).join('');
  }
  function rollRows(s,kind){
    return s.rolls.map(x=>{
      const canWeigh=kind==='weigh'&&Number(x.grams)>0;
      return `<div class="closing-measure-row">
        <span class="closing-roll-symbol">▰</span>
        <strong>${euro(x.value)} Rolle</strong>
        <label>${canWeigh?'Gewicht g':'Rollen'}<input type="number" min="0" step="${canWeigh?'.01':'1'}" inputmode="decimal" data-closing-${canWeigh?'weight':'roll'}="roll" data-value="${x.value}" data-coins="${x.coins}" data-unit-grams="${x.grams||''}" value="0"></label>
        <b data-closing-line="${kind}-roll-${x.value}">${money(0)}</b>
      </div>`;
    }).join('');
  }
  function render(){
    const root=$('closingCountInputs'); if(!root)return;
    const s=settings(); if(!s){root.innerHTML='<p>Messvoreinstellungen nicht verfügbar.</p>';return;}
    root.innerHTML=mode==='defer'
      ?'<p class="closing-measure-hint"><strong>Später zählen.</strong> Der Soll-Abschluss wird jetzt gespeichert. Die Ist-Zählung kann anschließend im Money Butler nachgetragen werden.</p>'
      :`<p class="closing-measure-hint"><strong>${mode==='weigh'?'Wiegen':'Zählen'}:</strong> Der hier erfasste Ist-Bestand wird als separate Zählung zusammen mit dem Abschluss übertragen.</p>
        <div class="closing-measure-group"><h4>Scheine</h4>${noteRows(s,mode)}</div>
        <div class="closing-measure-group"><h4>Münzen</h4>${coinRows(s,mode)}</div>
        <div class="closing-measure-group"><h4>Rollen</h4>${rollRows(s,mode)}</div>
        <div class="closing-measure-total">Ist-Bestand <strong id="closingMeasureTotal">0,00 €</strong></div>`;
    root.querySelectorAll('input').forEach(n=>n.addEventListener('input',recalc));
    recalc();
  }
  function readLines(){
    const breakdown={},measurements=[],coinRolls={}; let total=0;
    const root=$('closingCountInputs'); if(!root||mode==='defer')return {total:0,breakdown,measurements,coinRolls};
    root.querySelectorAll('input').forEach(n=>{
      const value=Number(n.dataset.value),raw=Number(String(n.value||0).replace(',','.'))||0;
      if(raw<=0)return;
      if(n.dataset.closingCount){
        const pieces=Math.max(0,Math.round(raw));breakdown[value]=(breakdown[value]||0)+pieces;total+=pieces*value;
        measurements.push({method:'count',kind:n.dataset.closingCount,value,pieces});
      }else if(n.dataset.closingRoll){
        const rolls=Math.max(0,Math.round(raw)),coins=Number(n.dataset.coins)||0,pieces=rolls*coins;
        breakdown[value]=(breakdown[value]||0)+pieces;total+=pieces*value;coinRolls[value]={rolls,coinsPerRoll:coins,coinCount:pieces,total:+(pieces*value).toFixed(2)};
        measurements.push({method:'count',kind:'roll',value,rolls,coinsPerRoll:coins,pieces});
      }else if(n.dataset.closingWeight){
        const unit=Number(n.dataset.unitGrams)||0;if(!unit)return;
        const units=Math.max(0,Math.round(raw/unit));
        if(n.dataset.closingWeight==='roll'){
          const coins=Number(n.dataset.coins)||0,pieces=units*coins;breakdown[value]=(breakdown[value]||0)+pieces;total+=pieces*value;
          coinRolls[value]={rolls:units,coinsPerRoll:coins,coinCount:pieces,total:+(pieces*value).toFixed(2)};
          measurements.push({method:'weigh',kind:'roll',value,grams:raw,unitGrams:unit,rolls:units,coinsPerRoll:coins,pieces});
        }else{
          breakdown[value]=(breakdown[value]||0)+units;total+=units*value;
          measurements.push({method:'weigh',kind:n.dataset.closingWeight,value,grams:raw,unitGrams:unit,pieces:units});
        }
      }
    });
    return {total:+total.toFixed(2),breakdown,measurements,coinRolls};
  }
  function recalc(){
    const data=readLines();const total=$('closingMeasureTotal');if(total)total.textContent=money(data.total);
    const root=$('closingCountInputs');if(!root)return;
    root.querySelectorAll('input').forEach(n=>{
      const value=Number(n.dataset.value),raw=Number(String(n.value||0).replace(',','.'))||0;let amount=0;
      if(n.dataset.closingCount)amount=Math.round(raw)*value;
      else if(n.dataset.closingRoll)amount=Math.round(raw)*(Number(n.dataset.coins)||0)*value;
      else if(n.dataset.closingWeight&&Number(n.dataset.unitGrams)>0){
        const units=Math.round(raw/Number(n.dataset.unitGrams));
        amount=n.dataset.closingWeight==='roll'?units*(Number(n.dataset.coins)||0)*value:units*value;
      }
      const type=n.dataset.closingCount?'count':n.dataset.closingRoll?'roll':n.dataset.closingWeight;
      const line=root.querySelector(`[data-closing-line="${mode}-${type}-${value}"]`);if(line)line.textContent=money(amount);
    });
  }
  function setMode(next){
    mode=['defer','count','weigh'].includes(next)?next:'defer';
    document.querySelectorAll('[data-closing-count-mode]').forEach(b=>b.classList.toggle('active',b.dataset.closingCountMode===mode));
    render();
  }
  function buildPayload({registerId,businessDate,closingId}={}){
    if(mode==='defer')return null;
    const data=readLines();if(data.total<=0)throw new Error('Bitte den Ist-Bestand erfassen oder „Später im Money Butler“ wählen.');
    const now=new Date().toISOString();
    return {
      format:'KC_CASH_COUNT',version:4,countId:crypto.randomUUID(),transferId:crypto.randomUUID(),
      registerId,businessDate,effectiveDate:businessDate,closingId:closingId||null,
      type:'count',countKind:'same-day',countLabel:`Zählung zum Tagesabschluss vom ${businessDate}`,
      time:now,countedAt:now,inputMode:mode,total:data.total,breakdown:data.breakdown,coinRolls:data.coinRolls,
      measurements:data.measurements,measureSettingsVersion:settings()?.version||1,
      measureSettingsSnapshot:settings()
    };
  }
  function init(){
    document.querySelectorAll('[data-closing-count-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.closingCountMode)));
    setMode('defer');
  }
  global.KCClosingCountUI={init,setMode,buildPayload,read:readLines,get mode(){return mode}};
})(typeof window!=='undefined'?window:globalThis);
