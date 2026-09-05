/* DesignCore Presentation Extension V0.1.0 */
(function(g){
 const palettes={
  club:{name:'Köcheclub Blau',bg:'#071c39',bg2:'#124d83',text:'#ffffff',accent:'#f6c453',muted:'#d8e7f5'},
  warm:{name:'Weihnachtsmarkt Warm',bg:'#35140f',bg2:'#7b2517',text:'#fff8e7',accent:'#f4c96b',muted:'#ead7bd'},
  gold:{name:'Festlich Gold',bg:'#17120b',bg2:'#5a4315',text:'#fff8dc',accent:'#ffd76a',muted:'#dccb9f'},
  forest:{name:'Winterwald',bg:'#071f18',bg2:'#174b36',text:'#f2fff9',accent:'#f0d58c',muted:'#c4ded2'},
  winter:{name:'Winter Silber',bg:'#10233e',bg2:'#557590',text:'#ffffff',accent:'#dcecff',muted:'#d6e0e8'},
  modern:{name:'Modern',bg:'#111827',bg2:'#293548',text:'#ffffff',accent:'#5eead4',muted:'#cbd5e1'},
  light:{name:'Hell',bg:'#eef4fa',bg2:'#ffffff',text:'#10233e',accent:'#1b6ea8',muted:'#536b7d'},
  dark:{name:'Dunkel',bg:'#060b12',bg2:'#18202c',text:'#ffffff',accent:'#69c9ff',muted:'#c4ced8'}
 };
 const transitions={fade:'Überblenden',slide:'Weich schieben',zoom:'Sanfter Zoom',wipe:'Wischen',flip:'Flip',light:'Lichtblende',star:'Sternenblende',snow:'Schneeblende',none:'Keiner'};
 const banners={none:'Kein Banner',gold:'Goldbanner',ribbon:'Banderole',wood:'Holzschild',ice:'Eisschild',flag:'Fahne'};
 const shapes={none:'Keine Form',star:'Stern',arrow:'Pfeil',badge:'Siegel',circle:'Kreis',label:'Etikett',speech:'Sprechblase'};
 function defaults(){return {palette:'warm',background:{type:'gradient',color1:'',color2:'',image:'',opacity:1,blur:0,vignette:0},typography:{titleColor:'',textColor:'',priceColor:'',titleSize:1,textSize:1,priceSize:1,titleWeight:800,shadow:true},banner:{type:'none',text:''},shape:{type:'none',text:'',position:'top-right'},transition:{type:'fade',duration:800},master:{useLogo:true,useSafeArea:true,footer:''},layers:[]}}
 function normalize(slide){slide.presentationDesign=Object.assign(defaults(),slide.presentationDesign||{});const d=slide.presentationDesign;d.background=Object.assign(defaults().background,d.background||{});d.typography=Object.assign(defaults().typography,d.typography||{});d.banner=Object.assign(defaults().banner,d.banner||{});d.shape=Object.assign(defaults().shape,d.shape||{});d.transition=Object.assign(defaults().transition,d.transition||{});d.master=Object.assign(defaults().master,d.master||{});return d}
 function cssVars(slide){const d=normalize(slide),p=palettes[d.palette]||palettes.warm;return {'--dc-bg1':d.background.color1||p.bg,'--dc-bg2':d.background.color2||p.bg2,'--dc-text':d.typography.textColor||p.text,'--dc-title':d.typography.titleColor||p.text,'--dc-price':d.typography.priceColor||p.accent,'--dc-accent':p.accent,'--dc-muted':p.muted,'--dc-bg-opacity':String(d.background.opacity??1),'--dc-bg-blur':`${d.background.blur||0}px`,'--dc-vignette':String((d.background.vignette||0)/100),'--dc-title-scale':String(d.typography.titleSize||1),'--dc-text-scale':String(d.typography.textSize||1),'--dc-price-scale':String(d.typography.priceSize||1)} }
 function apply(screen,slide){if(!screen||!slide)return;const d=normalize(slide);screen.classList.add('dc-presentation-slide',`dc-transition-${d.transition.type}`,`dc-banner-${d.banner.type}`,`dc-shape-${d.shape.type}`);Object.entries(cssVars(slide)).forEach(([k,v])=>screen.style.setProperty(k,v));if(d.background.image){screen.style.setProperty('--dc-bg-image',`url("${String(d.background.image).replace(/"/g,'')}")`);screen.classList.add('dc-has-bg-image')}else screen.classList.remove('dc-has-bg-image');screen.querySelectorAll('.dc-overlay').forEach(x=>x.remove());const overlay=document.createElement('div');overlay.className='dc-overlay';overlay.innerHTML=`${d.banner.type!=='none'?`<div class="dc-banner">${esc(d.banner.text||slide.title||'')}</div>`:''}${d.shape.type!=='none'?`<div class="dc-shape dc-pos-${d.shape.position}"><i></i><span>${esc(d.shape.text||'')}</span></div>`:''}${d.master.footer?`<div class="dc-footer">${esc(d.master.footer)}</div>`:''}`;screen.appendChild(overlay);if(d.master.useSafeArea)screen.classList.add('dc-safe-area');else screen.classList.remove('dc-safe-area')}
 function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
 function validate(slide){const d=normalize(slide),issues=[];if((d.typography.titleSize||1)<.8)issues.push('Überschrift zu klein');if((d.typography.textSize||1)<.8)issues.push('Text zu klein');if(d.transition.duration>1800)issues.push('Übergang zu langsam');if((slide.decorations||[]).length>5)issues.push('Zu viele Dekorationen');if(slide.animation!=='none'&&d.transition.type!=='fade'&&d.transition.type!=='none')issues.push('Viele Bewegungen gleichzeitig');return issues}
 g.KCDesignCorePresentation={version:'0.1.0',palettes,transitions,banners,shapes,defaults,normalize,apply,validate};
})(window);


/* DesignCore Presentation Extension V0.2.0 – professional typography, effects and transitions */
(function(g){
 const dc=g.KCDesignCorePresentation;if(!dc)return;
 Object.assign(dc.transitions,{dissolve:'Weiches Auflösen',slideLeft:'Schieben nach links',slideRight:'Schieben nach rechts',slideUp:'Schieben nach oben',curtain:'Vorhang',iris:'Irisblende',blur:'Fokusblende',pan:'Sanfte Kamerafahrt',crosszoom:'Kreuzzoom'});
 dc.fonts={system:'System / besonders lesbar',serif:'Klassische Serifenschrift',humanist:'Humanistische Sans',rounded:'Rund und freundlich',condensed:'Schmal / Plakat',monospace:'Technisch'};
 const old=dc.defaults;dc.defaults=function(){const d=old();d.typography=Object.assign(d.typography,{fontFamily:'system',titleBold:true,titleItalic:false,titleUppercase:false,textBold:false,textItalic:false,priceBold:true,priceItalic:false,letterSpacing:0,lineHeight:1.15,textAlign:'center',outline:false});d.effects={speed:1,density:2,size:1,opacity:.78,direction:'down'};return d};
 const norm=dc.normalize;dc.normalize=function(slide){const d=norm(slide),base=dc.defaults();d.typography=Object.assign(base.typography,d.typography||{});d.effects=Object.assign(base.effects,d.effects||{});return d};
 dc.version='0.2.0';
})(window);
