(function (global) {
  'use strict';
  const VERSION = '0.29.49';
  const $ = id => document.getElementById(id);
  function fillLabels() {
    const select = $('labelArticle'), list = global.articles || [];
    if (!select) return;
    const selected = select.value;
    select.innerHTML = list.map((article,index) => `<option value="${index}">${String(article.name||article.id||`Artikel ${index+1}`).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</option>`).join('');
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    select.disabled = !list.length; global.renderLabelPreview?.();
  }
  function colorPreview() {
    const input = $('gColor'), form = $('groupForm'); if (!input || !form) return;
    let card = form.querySelector('.kc-group-color-preview');
    if (!card) { card=document.createElement('div');card.className='kc-group-color-preview wide';card.innerHTML='<span></span><strong>Warengruppenfarbe</strong><button type="button">Farbe übernehmen</button>';input.closest('label')?.after(card);card.querySelector('button').onclick=()=>$('groupToolbar')?.querySelector('[data-cmd="save"]')?.click(); }
    const paint = () => { const color=input.value||'#173765',name=$('gName')?.value||'Warengruppe';card.style.setProperty('--group-live-color',color);card.querySelector('strong').textContent=name;const id=$('gId')?.value;document.querySelectorAll('#groupBody tr').forEach(row=>{if(row.cells[0]?.textContent===id)row.querySelector('td:nth-child(4) span')?.style.setProperty('background',color)}); };
    input.addEventListener('input',paint); $('gName')?.addEventListener('input',paint); paint();
  }
  function importFile(kind) {
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
    input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());if(!Array.isArray(data))throw Error('Erwartet wird eine JSON-Liste.');if(kind==='group'){const target=global.groups;target.splice(0,target.length,...data);global.saveAll?.();global.renderGroups?.();global.fillCategories?.();colorPreview()}else{const target=global.articles;target.splice(0,target.length,...data);global.saveAll?.();global.renderArticles?.();fillLabels()}alert(`${data.length} ${kind==='group'?'Warengruppen':'Artikel'} übernommen.`)}catch(error){alert(`Import nicht möglich: ${error.message}`)}finally{input.remove()}};input.click();
  }
  function bindToolbar() {
    document.addEventListener('click',event=>{const command=event.target.closest('#groupToolbar [data-cmd="import"],#articleToolbar [data-cmd="import"]');if(command){event.preventDefault();event.stopImmediatePropagation();importFile(command.closest('#groupToolbar')?'group':'article');return}if(event.target.closest('#groupToolbar [data-cmd="new"]'))setTimeout(()=>{$('gColor').value='#173765';$('gSort').value=10;colorPreview()},0);if(event.target.closest('#groupToolbar [data-cmd="save"],#articleToolbar [data-cmd="save"],#articleToolbar [data-cmd="delete"]'))setTimeout(fillLabels,0)},true);
  }
  function audit() {
    const expected={groupToolbar:['new','save','delete','import','export','print'],articleToolbar:['new','save','delete','image','import','export','print']};
    const missing=[];Object.entries(expected).forEach(([id,commands])=>commands.forEach(command=>{if(!document.querySelector(`#${id} [data-cmd="${command}"]`))missing.push(`${id}:${command}`)}));
    global.KCMasterdataButtonAudit={version:VERSION,status:missing.length?'BLOCKED':'PASS',missing};return global.KCMasterdataButtonAudit;
  }
  function init() { colorPreview(); fillLabels(); bindToolbar(); audit(); document.querySelector('[data-view="labels"]')?.addEventListener('click',()=>setTimeout(fillLabels,0)); }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(init,250)):setTimeout(init,50);
  global.KCManagerMasterdataHealth=Object.freeze({version:VERSION,fillLabels,audit});global.KCReleaseManifest?.register?.('managerMasterdataHealth',VERSION);
})(window);
