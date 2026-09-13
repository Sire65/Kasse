(() => {
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('embeddedTraining')!=='1')return;
let token=0,cursor=null;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function inject(){
 if(document.getElementById('kc-live-demo-style'))return;
 const s=document.createElement('style');s.id='kc-live-demo-style';s.textContent=`
 .kc-live-demo-cursor{position:fixed;left:0;top:0;z-index:2147483646;width:46px;height:46px;pointer-events:none;opacity:0;transform:translate(-80px,-80px);transition:transform var(--move,1100ms) cubic-bezier(.2,.8,.25,1),opacity .2s;filter:drop-shadow(0 5px 4px #0009)}
 .kc-live-demo-cursor.show{opacity:1}.kc-live-demo-pointer{display:block;font-size:39px;line-height:1;color:#fff;-webkit-text-stroke:2px #09223c;transform:rotate(-27deg)}
 .kc-live-demo-wave{position:absolute;left:5px;top:5px;width:32px;height:32px;border:4px solid #ffb52e;border-radius:50%;opacity:0}
 .kc-live-demo-cursor.click .kc-live-demo-pointer{animation:kcDemoPress .42s ease}.kc-live-demo-cursor.click .kc-live-demo-wave{animation:kcDemoWave .75s ease-out}
 .kc-demo-focus{position:relative;z-index:2147483000!important;outline:5px solid #ffb52e!important;outline-offset:4px!important;box-shadow:0 0 0 9999px rgba(3,18,32,.48),0 0 22px 8px rgba(255,181,46,.85)!important;transition:outline .2s,box-shadow .2s!important}
 @keyframes kcDemoPress{50%{transform:rotate(-27deg) scale(.68)}}@keyframes kcDemoWave{0%{opacity:1;transform:scale(.2)}100%{opacity:0;transform:scale(2.5)}}`;
 document.head.appendChild(s);
}
 function ensureCursor(){inject();if(cursor?.isConnected)return cursor;cursor=document.createElement('div');cursor.className='kc-live-demo-cursor';cursor.innerHTML='<span class="kc-live-demo-pointer">➤</span><span class="kc-live-demo-wave"></span>';document.body.appendChild(cursor);return cursor}
function clearFocus(){document.querySelectorAll('.kc-demo-focus,.training-focus-ring').forEach(n=>n.classList.remove('kc-demo-focus','training-focus-ring'))}
function find(target){if(typeof target==='function')return target();return document.querySelector(target)}
function tile(name){const wanted=name.toLowerCase();return [...document.querySelectorAll('.product-tile')].find(n=>String(n.getAttribute('aria-label')||n.textContent||'').toLowerCase().includes(wanted))}
function plus(name){return tile(name)?.querySelector('.product-variant-button, .product-plus, [data-product-plus], button[aria-label*=\"Variante\"], button[title*=\"Variante\"]')||null}
async function move(target,duration=1100){const n=find(target);if(!n)return null;n.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});await wait(500);const r=n.getBoundingClientRect(),c=ensureCursor();c.style.setProperty('--move',duration+'ms');c.style.transform=`translate(${Math.round(r.left+r.width*.52)}px,${Math.round(r.top+r.height*.48)}px)`;c.classList.add('show');await wait(duration);return n}
async function click(target,{perform=true,after=850}={}){const n=await move(target);if(!n)return false;const c=ensureCursor();c.classList.remove('click');void c.offsetWidth;c.classList.add('click');await wait(260);if(perform)n.click();await wait(after);return true}
async function focus(target,ms=1200){clearFocus();const n=find(target);if(!n)return;n.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});n.classList.add('kc-demo-focus');await wait(ms);n.classList.remove('kc-demo-focus')}
function reset(){token++;clearFocus();cursor?.remove();cursor=null;try{window.KCTrainingAPI?.closeAllDialogs?.()}catch{}}
async function demo(name){
 reset();const my=token;const alive=()=>my===token;const api=window.KCTrainingAPI;if(!api)return;
 const step=async fn=>{if(!alive())throw new Error('cancelled');return fn()};
 try{

  if(name==='surfaceTour'){await step(()=>move('.app-header',850));await step(()=>focus('.app-header',1000));await step(()=>move('#categories',900));await step(()=>focus('#categories',900));await step(()=>move('#productGrid',900));await step(()=>focus('#productGrid',1000));await step(()=>move('#cartQuantityBar',900));await step(()=>focus('#cartQuantityBar',900));await step(()=>move('#cartList',900));await step(()=>focus('#cartList',900));await step(()=>move('#banknotes',900));await step(()=>focus('#banknotes, #coins',900));await step(()=>move('.main-actions',900));await step(()=>focus('.main-actions',1000));
  } else if(name==='singleSale'){api.clearCart?.();await wait(900);await step(()=>move(()=>tile('Glühwein rot'),1250));await step(()=>click(()=>tile('Glühwein rot'),{perform:true,after:900}));await step(()=>focus('#cartList',1700));await wait(900);await step(()=>move('#banknotes button[data-value="10"]',1100));await step(()=>click('#banknotes button[data-value="10"]',{after:1200}));await step(()=>focus('#changeDisplay, #givenDisplay, #dueDisplay',1600));await wait(900);await step(()=>click('#payBtn',{after:1600}));
  } else if(name==='multiSale'){api.clearCart?.();await wait(700);await step(()=>move(()=>tile('Glühwein rot'),1150));await step(()=>click(()=>tile('Glühwein rot'),{perform:true,after:900}));const foodTab=[...document.querySelectorAll('#categories button,.category-tabs button')].find(x=>/essen|speisen|grill/i.test(x.textContent));if(foodTab)await step(()=>click(()=>foodTab,{after:1200}));await step(()=>move(()=>tile('Bratwurst'),1150));await step(()=>click(()=>tile('Bratwurst'),{perform:true,after:900}));await step(()=>focus('#cartList',1900));
  } else if(name==='quantityControls'){api.clearCart?.();api.addStandardProduct?.('Glühwein rot');await wait(1200);await step(()=>move('.cart-row button[data-a="plus"]',950));await step(()=>click('.cart-row button[data-a="plus"]',{after:900}));await step(()=>focus('#cartQuantityBar, #cartList',1400));
  } else if(name==='cartDelete'){api.clearCart?.();api.addStandardProduct?.('Glühwein rot');await wait(700);api.addStandardProduct?.('Bratwurst');await wait(1000);await step(()=>move('.cart-row .delete-row',950));await step(()=>click('.cart-row .delete-row',{after:900}));await step(()=>focus('#cartList',1600));
  } else if(name==='paymentFlow'){api.clearCart?.();api.addStandardProduct?.('Glühwein rot');await wait(1800);await step(()=>focus('#cartList',1500));await wait(700);await step(()=>move('#banknotes button[data-value="10"]',1100));await step(()=>click('#banknotes button[data-value="10"]',{after:1300}));await step(()=>focus('#changeDisplay, #givenDisplay, #dueDisplay',1700));await wait(1000);await step(()=>click('#payBtn',{after:1700}));
  } else if(name==='tipsFlow'){await step(()=>move('#exactCashBtn',850));await step(()=>focus('#exactCashBtn',800));await step(()=>move('#roundUpBtn',850));await step(()=>focus('#roundUpBtn',800));await step(()=>click('#tipBtn',{after:800}));await step(()=>focus('#tipDialog',1300));
  } else if(name==='accountPreview'){await step(()=>move('#moreBtn',900));await step(()=>focus('#moreBtn',1000));
  } else if(name==='staffBooking'){api.clearCart?.();api.addStandardProduct?.('Bratwurst');await wait(1200);await step(()=>click('#staffBtn',{after:1000}));await step(()=>focus('#staffBtn, #cartList',1100));
  } else if(name==='depositCalculation'){api.clearCart?.();api.addStandardProduct?.('Glühwein rot');await wait(900);api.addDepositReturn?.('Glasrückgabe');await wait(1100);await step(()=>focus('#cartList',1400));await step(()=>focus('#payBtn, #grandTotal',1100));
  } else if(name==='productInfoDeep'){api.openProductInfo?.('Glühwein rot');await wait(800);await step(()=>focus('#productInfoDialog',1100));await step(()=>move('#productInfoDetailsBtn',850));await step(()=>focus('#productInfoDetailsBtn',900));
  } else if(name==='variantsFlow'){api.clearCart?.();await step(()=>click(()=>plus('Glühwein rot')||tile('Glühwein rot'),{perform:true,after:800}));await step(()=>focus('dialog[open], .variant-dialog, .product-variants',1300));
  } else if(name==='favoritesFlow'){await step(()=>move('#categories',900));await step(()=>focus('#categories',800));const fav=[...document.querySelectorAll('#categories button, .category-tabs button')].find(x=>x.textContent.includes('Favoriten'));if(fav)await step(()=>click(()=>fav,{after:900}));await step(()=>focus('#productGrid',1300));
  } else if(name==='poolArticlePreview'){await step(()=>focus('#productGrid',1200));await step(()=>focus('#cartList',1000));
  } else if(name==='happyHourPreview'){await step(()=>focus('#productGrid',1000));await step(()=>focus('#cartList, #grandTotal',1200));
  } else if(name==='trainingModeFlow'){
   if(document.body.classList.contains('rush-mode'))await step(()=>click('#rushModeBtn',{after:900}));
   if(document.body.classList.contains('training-mode'))await step(()=>click('#trainingModeTopBtn',{after:700}));
   await step(()=>move('#trainingModeTopBtn',1000));await step(()=>click('#trainingModeTopBtn',{after:1200}));await step(()=>focus('#workspaceModePanel, #trainingBanner',1500));
   api.clearCart?.();api.addStandardProduct?.('Glühwein rot');await wait(900);await step(()=>focus('#cartList, #grandTotal',1300));await step(()=>click('#trainingModeTopBtn',{after:1000}));
  } else if(name==='rushModeFlow'){
   if(document.body.classList.contains('training-mode'))await step(()=>click('#trainingModeTopBtn',{after:800}));
   if(document.body.classList.contains('rush-mode'))await step(()=>click('#rushModeBtn',{after:700}));
   await step(()=>move('#rushModeBtn',1000));await step(()=>click('#rushModeBtn',{after:1400}));await step(()=>focus('#productGrid',1400));await step(()=>focus('.main-actions, #categories',1200));await step(()=>click('#rushModeBtn',{after:1100}));
  } else if(name==='scannerFlow'){
   api.clearCart?.();await step(()=>move('.scanner-card',1000));await step(()=>focus('.scanner-card',1200));await step(()=>move('#operatorBtn',900));await step(()=>focus('#operatorBtn',1000));
   api.addStandardProduct?.('Glühwein rot');await wait(850);api.addStandardProduct?.('Glühwein rot');await wait(900);await step(()=>focus('#cartList',1400));await step(()=>move('#payBtn',1000));await step(()=>focus('#payBtn',1000));
  } else if(name==='overview'){await step(()=>move('#categoryTabs, .category-tabs',900));await step(()=>focus('#categoryTabs, .category-tabs',900));await step(()=>move('#productGrid',1000));await step(()=>focus('#productGrid',900));await step(()=>move('#cartList, .cart-area',1000));await step(()=>focus('#cartList, .cart-area',900));await step(()=>move('#payBtn',1000));await step(()=>focus('#payBtn',1000));
  } else if(name==='standardArticle'){
   api.clearCart?.();await wait(700);await step(()=>move(()=>tile('Glühwein rot'),1250));await step(()=>click(()=>tile('Glühwein rot'),{perform:true,after:900}));await step(()=>focus('#cartList, .cart-area',1600));
  } else if(name==='variants'){api.clearCart?.();await wait(600);await step(()=>move(()=>plus('Glühwein rot')||tile('Glühwein rot'),1100));await step(()=>click(()=>plus('Glühwein rot')||tile('Glühwein rot'),{perform:true,after:900}));await step(()=>focus('dialog[open], .variant-dialog, .product-variants',1500));
  } else if(name==='fullSale'){
   api.clearCart?.();await wait(650);await step(()=>move(()=>tile('Glühwein rot'),1250));await step(()=>click(()=>tile('Glühwein rot'),{perform:true,after:900}));await step(()=>focus('#cartList, .cart-area',1300));await step(()=>click('#banknotes button[data-value="10"]',{after:1200}));await step(()=>focus('#changeDisplay, #givenDisplay, #dueDisplay',1500));await step(()=>click('#payBtn',{after:1700}));
  } else if(name==='modeControls'){await step(()=>move('.mode-quick-switches, #screenLockBtn',1200));await step(()=>focus('.mode-quick-switches, #screenLockBtn',1600));
  } else if(name==='productInfo'){api.openProductInfo?.('Glühwein rot');await wait(700);await step(()=>move('dialog[open]',900));await step(()=>focus('dialog[open]',1700));
  } else if(name==='complaintFlow'){
   await step(()=>click('#moreBtn',{after:700}));await step(()=>move('[data-action="withdraw"]',900));await step(()=>click('[data-action="withdraw"]',{after:900}));
   api.openComplaint?.('reason-mode');await wait(600);await step(()=>move('[data-withdraw-reason="Reklamation"]',900));await step(()=>click('[data-withdraw-reason="Reklamation"]',{perform:false,after:450}));
   api.openComplaint?.('article');await wait(650);await step(()=>focus('#complaintArticleList',1200));
   api.openComplaint?.('specific-reason');await wait(650);await step(()=>move('[data-complaint-reason="Kalt ausgegeben"]',900));await step(()=>focus('[data-complaint-reason="Kalt ausgegeben"]',1100));
   api.openComplaint?.('review');await wait(650);await step(()=>focus('#withdrawAmount, #complaintBonReference, #withdrawNote',1600));
  } else if(name==='depositFlow'){
   api.clearCart?.();await step(()=>click('#depositBtn',{after:900}));await step(()=>move(()=>tile('Glasrückgabe'),1000));await step(()=>click(()=>tile('Glasrückgabe'),{perform:false,after:300}));api.addDepositReturn?.('Glasrückgabe');await wait(900);await step(()=>focus('#cartList, .cart-area',1600));
  } else if(name==='complaintOpen'){await step(()=>click('#moreBtn',{after:800}));await step(()=>move('[data-action="withdraw"]',900));await step(()=>focus('[data-action="withdraw"]',1500));
  } else if(name==='complaintReasonMode'){api.openComplaint?.('reason-mode');await wait(700);await step(()=>move('[data-withdraw-reason="Reklamation"]',900));await step(()=>focus('[data-withdraw-reason="Reklamation"]',1500));
  } else if(name==='complaintArticle'){api.openComplaint?.('article');await wait(800);await step(()=>focus('#complaintArticleList',1600));
  } else if(name==='complaintSpecificReason'){api.openComplaint?.('specific-reason');await wait(800);await step(()=>move('[data-complaint-reason="Kalt ausgegeben"]',900));await step(()=>focus('[data-complaint-reason="Kalt ausgegeben"]',1500));
  } else if(name==='complaintReview'){api.openComplaint?.('review');await wait(900);await step(()=>focus('#withdrawAmount, #complaintBonReference, #withdrawNote',1800));
  } else if(name==='depositOpen'){await step(()=>click('#depositBtn',{after:1000}));await step(()=>focus('#productGrid',1400));
  } else if(name==='depositSelect'){api.openDeposit?.();await wait(700);await step(()=>move(()=>tile('Glasrückgabe'),1100));await step(()=>focus(()=>tile('Glasrückgabe'),1500));
  } else if(name==='depositCart'){api.clearCart?.();api.addDepositReturn?.('Glasrückgabe');await wait(1000);await step(()=>focus('#cartList, .cart-area',1700));
  } else if(name==='staffMode'){await step(()=>click('#staffBtn',{after:900}));await step(()=>focus('#staffBtn, .staff-active',1500));
  } else if(name==='closingOpen'){await step(()=>click('#moreBtn',{after:700}));await step(()=>move('[data-action="closing"]',900));await step(()=>click('[data-action="closing"]',{after:900}));await step(()=>focus('dialog[open]',1600));
  }
  parent.postMessage({type:'KC_TRAINING_DEMO_DONE',name},'*');
 }catch(e){if(e.message!=='cancelled')parent.postMessage({type:'KC_TRAINING_DEMO_ERROR',name,message:e.message},'*')}
}
window.addEventListener('message',e=>{const m=e.data;if(!m||m.type!=='KC_TRAINING_DEMO')return;if(m.action==='cancel')reset();else demo(m.name)});
window.addEventListener('load',()=>{inject();parent.postMessage({type:'KC_TRAINING_DEMO_READY'},'*')});
})();
