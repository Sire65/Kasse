(() => {
'use strict';
class TrainingPlaybackCore {
  constructor(iframe){this.iframe=iframe;this.doc=null;this.cursor=null;this.running=false;this.abortToken=0;}
  async ready(){
    for(let i=0;i<30;i++){
      try{this.doc=this.iframe.contentDocument||this.iframe.contentWindow.document;if(this.doc?.body){this.injectStyles();return true}}catch{}
      await this.wait(150);
    }
    return false;
  }
  injectStyles(){if(this.doc.getElementById('kc-training-playback-style'))return;const s=this.doc.createElement('style');s.id='kc-training-playback-style';s.textContent=`.kc-training-cursor{position:absolute;left:0;top:0;z-index:2147483000;width:42px;height:42px;pointer-events:none;opacity:0;transform:translate(42px,42px);transition:transform var(--cursor-duration,850ms) cubic-bezier(.22,.8,.28,1),opacity .18s;filter:drop-shadow(0 4px 4px #0008)}.kc-training-cursor.visible{opacity:1}.kc-training-pointer{display:block;font-size:34px;line-height:1;color:#fff;-webkit-text-stroke:2px #10243a;transform:rotate(-28deg);transform-origin:center}.kc-training-click-wave{position:absolute;left:4px;top:4px;width:30px;height:30px;border:4px solid #efb13c;border-radius:50%;opacity:0}.kc-training-cursor.clicking .kc-training-pointer{animation:kcCursorPress .34s ease}.kc-training-cursor.clicking .kc-training-click-wave{animation:kcClickWave .62s ease-out}@keyframes kcCursorPress{50%{transform:rotate(-28deg) scale(.72)}}@keyframes kcClickWave{0%{opacity:.95;transform:scale(.2)}100%{opacity:0;transform:scale(2.2)}}`;this.doc.head.appendChild(s);}
  wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  cancel(){this.abortToken++;this.running=false;this.cursor?.remove();this.cursor=null;}
  ensureCursor(){
    if(this.cursor?.isConnected)return this.cursor;
    const c=this.doc.createElement('div');c.className='kc-training-cursor';c.innerHTML='<span class="kc-training-pointer">➤</span><span class="kc-training-click-wave"></span>';
    this.doc.body.appendChild(c);this.cursor=c;return c;
  }
  find(selector){
    if(!selector)return null;
    if(typeof selector==='function')return selector(this.doc);
    return this.doc.querySelector(selector);
  }
  center(node){const r=node.getBoundingClientRect();return{x:r.left+r.width/2+this.doc.defaultView.scrollX,y:r.top+r.height/2+this.doc.defaultView.scrollY};}
  async moveTo(selector,{duration=850,offsetX=0,offsetY=0}={}){
    const node=this.find(selector);if(!node)return null;
    node.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});await this.wait(380);
    const c=this.ensureCursor(),p=this.center(node);c.style.setProperty('--cursor-duration',duration+'ms');c.style.transform=`translate(${Math.round(p.x+offsetX)}px,${Math.round(p.y+offsetY)}px)`;c.classList.add('visible');
    node.classList.add('training-focus-ring');await this.wait(duration);return node;
  }
  async click(selector,opts={}){
    const node=await this.moveTo(selector,opts);if(!node)return false;
    const c=this.ensureCursor();c.classList.remove('clicking');void c.offsetWidth;c.classList.add('clicking');
    try{this.doc.defaultView.navigator.vibrate?.(35)}catch{}
    await this.wait(210);
    if(opts.perform!==false)node.click();
    await this.wait(opts.after||520);return true;
  }
  async action(fn,after=450){await fn?.();await this.wait(after);}
  async play(steps){
    this.cancel();const token=++this.abortToken;this.running=true;if(!await this.ready())return false;
    this.doc.querySelectorAll('.training-focus-ring').forEach(n=>n.classList.remove('training-focus-ring'));
    for(const step of steps){if(token!==this.abortToken)return false;
      if(step.type==='wait')await this.wait(step.ms||500);
      if(step.type==='move')await this.moveTo(step.selector,step);
      if(step.type==='click')await this.click(step.selector,step);
      if(step.type==='action')await this.action(step.run,step.after);
      if(step.type==='focus'){const n=this.find(step.selector);n?.classList.add('training-focus-ring');n?.scrollIntoView({block:'center'});await this.wait(step.ms||700);}
    }
    this.running=false;return true;
  }
}
window.TrainingPlaybackCore=TrainingPlaybackCore;
})();
