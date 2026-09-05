const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(require('path').join(__dirname,'../cores/presentation-tuv-core/presentation-tuv-core.js'),'utf8');
const sandbox={window:{},document:{documentElement:{}},localStorage:{setItem(){},removeItem(){}},MediaRecorder:function(){},Blob:function(){},URL:{}};sandbox.window=sandbox;vm.runInNewContext(code,sandbox);
const slide={id:'1',enabled:true,type:'notice',title:'Test',text:'Inhalt',price:'',ticker:'',decorations:[],objectVisibility:{ticker:false},layout:{title:{x:50,y:15,w:70,h:10},text:{x:50,y:40,w:70,h:20},price:{x:50,y:40,w:70,h:20},ticker:{x:50,y:80,w:90,h:15},weather:{x:50,y:40,w:80,h:50},image:{x:50,y:40,w:80,h:50}}};
const report=sandbox.KCPresentationTUV.inspect({slides:[slide],profile:{resolution:'1920x1080'},master:{enabled:true}});
assert.equal(report.issues.filter(x=>x.code==='PRO-001').length,0,'unsichtbare Platzhalter dürfen keine Überlappungen melden');
assert.equal(sandbox.KCPresentationTUV.VERSION,'1.3.0');console.log('PASS presentation-tuv-visible-objects');
