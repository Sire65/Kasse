(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NotificationCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='0.1.0';
  const PROFILE={beginner:{success:true,info:true,warning:true,error:true},standard:{success:true,info:false,warning:true,error:true},expert:{success:false,info:false,warning:true,error:true}};
  class Controller{
    constructor(node,{profile='standard'}={}){this.node=node;this.profile=PROFILE[profile]?profile:'standard';this.timer=null;this.lastKey='';this.count=0;}
    setProfile(profile){if(PROFILE[profile])this.profile=profile;}
    show({type='info',message='',key='',duration}={}){if(!this.node||!PROFILE[this.profile][type])return false;clearTimeout(this.timer);if(key&&key===this.lastKey)this.count++;else{this.lastKey=key;this.count=1}this.node.className=`notification-bar ${type} visible`;this.node.textContent=message;this.node.setAttribute('role',type==='error'?'alert':'status');const ms=duration??(type==='success'?1400:type==='info'?1800:type==='warning'?3500:0);if(ms>0)this.timer=setTimeout(()=>this.clear(),ms);return true;}
    clear(){if(!this.node)return;this.node.classList.remove('visible');this.node.textContent='';this.lastKey='';this.count=0;}
  }
  return Object.freeze({VERSION,PROFILE,Controller});
});
