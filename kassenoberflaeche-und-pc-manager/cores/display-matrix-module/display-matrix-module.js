(function(global){
  "use strict";
  const VERSION="0.2.3";
  const DIRECTIONS={left:"Links",right:"Rechts",up:"Oben",down:"Unten",static:"Statisch"};
  const MOTION_EFFECTS={
    scroll:"Scroll",softScroll:"Soft Scroll",pendulum:"Pendel",centerOut:"Mitte nach aussen",outsideIn:"Aussen zur Mitte",
    letterStep:"Einzelbuchstaben",chase:"Lauflicht",blink:"Blinken",pulse:"Puls",typewriter:"Schreibmaschine",
    scramble:"Buchstabensalat",matrixReveal:"Matrix Reveal",flipboard:"Flipboard",bounce:"Huepfen",wave:"Welle",
    scanner:"Scannerlicht",sparkle:"Funkeln",wipe:"Wischen",pixelBuild:"Pixelaufbau",pixelDissolve:"Pixelaufloesung"
  };
  const EFFECT_CATALOG={
    scroll:{label:"Scroll",status:"implemented",category:"ticker"},
    softScroll:{label:"Soft Scroll",status:"implemented",category:"ticker"},
    pendulum:{label:"Pendel",status:"implemented",category:"ticker"},
    centerOut:{label:"Mitte nach aussen",status:"implemented",category:"reveal"},
    outsideIn:{label:"Aussen zur Mitte",status:"implemented",category:"reveal"},
    letterStep:{label:"Einzelbuchstaben",status:"implemented",category:"letters"},
    chase:{label:"Lauflicht",status:"implemented",category:"led"},
    blink:{label:"Blinken",status:"implemented",category:"led"},
    pulse:{label:"Puls",status:"implemented",category:"led"},
    typewriter:{label:"Schreiben",status:"implemented",category:"letters"},
    scramble:{label:"Buchstabensalat",status:"implemented",category:"letters"},
    matrixReveal:{label:"Matrix Reveal",status:"implemented",category:"letters"},
    flipboard:{label:"Flipboard",status:"implemented",category:"mechanical"},
    bounce:{label:"Huepfen",status:"implemented",category:"motion"},
    wave:{label:"Welle",status:"implemented",category:"motion"},
    scanner:{label:"Scannerlicht",status:"implemented",category:"light"},
    sparkle:{label:"Funkeln",status:"implemented",category:"light"},
    wipe:{label:"Wischen",status:"implemented",category:"reveal"},
    pixelBuild:{label:"Pixelaufbau",status:"implemented",category:"pixel"},
    pixelDissolve:{label:"Pixelaufloesung",status:"implemented",category:"pixel"}
  };
  const PRIORITIES={low:1,normal:2,high:3,critical:4};
  const DISPLAY_MODES={ticker:"Laufband",fullscreen:"Vollbild",static:"Standbild"};
  const SURFACES={led:"LED",lcd:"LCD"};
  const PALETTES={
    signal:{foreground:"#7cff7c",background:"#07120b",accent:"#f2c94c"},
    network:{foreground:"#7cc7ff",background:"#07111d",accent:"#32b45f"},
    alarm:{foreground:"#ff6b6b",background:"#170707",accent:"#f2c94c"},
    quiet:{foreground:"#d8e1e5",background:"#121820",accent:"#8ab4f8"},
    lcd:{foreground:"#18212a",background:"#b9d2a6",accent:"#3d6f4b"},
    kioskRed:{foreground:"#ff2b1f",background:"#080101",accent:"#ff7a45"}
  };
  const FONTS={
    matrix:"ui-monospace, SFMono-Regular, Consolas, monospace",
    system:"system-ui, Segoe UI, Arial, sans-serif",
    condensed:"Arial Narrow, Impact, system-ui, sans-serif",
    mono:"Consolas, Monaco, monospace"
  };
  const FONT_PROFILES={
    "5x7":{id:"5x7",label:"Matrix 5x7",cellWidth:5,cellHeight:7,spacing:1,renderer:"pixel"},
    "8x8":{id:"8x8",label:"Matrix 8x8",cellWidth:8,cellHeight:8,spacing:1,renderer:"pixel"},
    "16x16":{id:"16x16",label:"Matrix 16x16",cellWidth:16,cellHeight:16,spacing:2,renderer:"text"},
    vector:{id:"vector",label:"Vector/Text",cellWidth:8,cellHeight:10,spacing:1,renderer:"text"}
  };
  const SYMBOLS={
    heart:{label:"Herz",char:"\u2665",aliases:["herz","love","health"]},
    stop:{label:"Stop",char:"\u25a0",aliases:["halt","stopp","error"]},
    clover:{label:"Kleeblatt",char:"\u2618",aliases:["klee","glueck","success"]},
    check:{label:"OK",char:"\u2713",aliases:["ok","done","pass"]},
    warning:{label:"Warnung",char:"!",aliases:["warn","achtung","gelb"]},
    alarm:{label:"Alarm",char:"\u25b2",aliases:["critical","rot"]},
    info:{label:"Info",char:"i",aliases:["hinweis","status"]},
    wifi:{label:"WLAN",char:"\u224b",aliases:["wlan","wireless"]},
    router:{label:"Router",char:"\u2302",aliases:["netz","network"]},
    lock:{label:"Schloss",char:"\u25c6",aliases:["secure","security"]},
    lightning:{label:"Blitz",char:"\u26a1",aliases:["strom","power","speed"]},
    play:{label:"Start",char:"\u25b6",aliases:["start","run"]},
    pause:{label:"Pause",char:"\u2161",aliases:["hold","wait"]},
    arrowLeft:{label:"Pfeil links",char:"\u2190",aliases:["left"]},
    arrowRight:{label:"Pfeil rechts",char:"\u2192",aliases:["right"]},
    arrowUp:{label:"Pfeil oben",char:"\u2191",aliases:["up"]},
    arrowDown:{label:"Pfeil unten",char:"\u2193",aliases:["down"]},
    rainCloud:{label:"Regenwolke",char:"\u2602",aliases:["regen","rain","raincloud","weather-rain"]},
    cloud:{label:"Wolke",char:"\u2601",aliases:["wolke","weather-cloud"]},
    sun:{label:"Sonne",char:"\u2600",aliases:["sonne","weather-sun"]},
    plant:{label:"Pflanze",char:"\u273F",aliases:["pflanze","flower","blume"]},
    waterDrop:{label:"Wassertropfen",char:"\u25ca",aliases:["wasser","water","drop"]},
    thermometer:{label:"Temperatur",char:"\u25d0",aliases:["temp","temperatur"]},
    calendar:{label:"Kalender",char:"\u25a3",aliases:["datum","date"]},
    leaf:{label:"Blatt",char:"\u2663",aliases:["blatt","leaf"]}
  };
  const PROGRAM_PROFILES={
    leitstand:{label:"Netzwerk-Leitstand",defaultPriority:"high",defaultPalette:"alarm",symbols:["alarm","warning","wifi","router","lock","lightning","stop"]},
    pflanzen:{label:"PflanzenPflege",defaultPriority:"normal",defaultPalette:"signal",symbols:["plant","rainCloud","cloud","sun","waterDrop","thermometer","calendar","leaf"]},
    generic:{label:"Generic Host",defaultPriority:"normal",defaultPalette:"network",symbols:["info","check","warning","heart","stop","clover"]}
  };
  const PRESETS={
    tickerSmall:{label:"Ticker klein",settings:{displayMode:"ticker",motionEffect:"scroll",surface:"led",columns:32,rows:8,pixelSize:8,gap:2,speed:48,fontProfile:"5x7",renderer:"auto"}},
    leitstandTopLine:{label:"Leitstand Topzeile",settings:{displayMode:"ticker",surface:"led",columns:96,rows:7,pixelSize:5,gap:1,speed:42,fontProfile:"5x7",renderer:"auto",showMeta:false}},
    dashboardWide:{label:"Dashboard breit",settings:{displayMode:"ticker",surface:"led",columns:64,rows:12,pixelSize:7,gap:1,speed:36,fontProfile:"8x8",renderer:"auto"}},
    alarmFullscreen:{label:"Alarm Vollbild",settings:{displayMode:"fullscreen",surface:"led",columns:48,rows:16,pixelSize:9,gap:2,brightness:1.2,glow:1,fontProfile:"16x16",renderer:"text"},palette:"alarm"},
    lcdInfo:{label:"LCD Info",settings:{displayMode:"static",surface:"lcd",columns:40,rows:10,pixelSize:9,gap:1,brightness:.9,glow:0,fontProfile:"vector",renderer:"text"},palette:"lcd"},
    screensaverMatrix:{label:"Matrix Bildschirmschoner",settings:{displayMode:"ticker",surface:"led",columns:120,rows:28,pixelSize:7,gap:1,speed:26,brightness:.9,glow:.9,fontProfile:"8x8",renderer:"auto",showMeta:false}},
    symbolShowcase:{label:"Symbol gross",settings:{displayMode:"static",surface:"led",columns:42,rows:14,pixelSize:10,gap:2,brightness:1.1,glow:.85,fontProfile:"vector",fontFamily:FONTS.system,textScale:1.05,renderer:"text"}},
    symbolTicker:{label:"Symbol Laufband",settings:{displayMode:"ticker",surface:"led",columns:48,rows:14,pixelSize:10,gap:2,speed:34,brightness:1.1,glow:.85,fontProfile:"vector",fontFamily:FONTS.system,textScale:1.05,renderer:"text"}},
    kioskRedDots:{label:"Kiosk rote Dots",settings:{displayMode:"ticker",motionEffect:"scroll",surface:"led",columns:96,rows:9,pixelSize:7,gap:2,speed:42,brightness:1.25,contrast:1.6,glow:1.2,fontProfile:"5x7",renderer:"pixel",activeDotShape:"round",showMeta:false},palette:"kioskRed"}
  };
  const GLYPHS_5X7={
    " ":["00000","00000","00000","00000","00000","00000","00000"],
    "0":["01110","10001","10011","10101","11001","10001","01110"],
    "1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","10001","00001","00010","00100","01000","11111"],
    "3":["11110","00001","00001","01110","00001","00001","11110"],
    "4":["00010","00110","01010","10010","11111","00010","00010"],
    "5":["11111","10000","11110","00001","00001","10001","01110"],
    "6":["00110","01000","10000","11110","10001","10001","01110"],
    "7":["11111","00001","00010","00100","01000","01000","01000"],
    "8":["01110","10001","10001","01110","10001","10001","01110"],
    "9":["01110","10001","10001","01111","00001","00010","01100"],
    "A":["01110","10001","10001","11111","10001","10001","10001"],
    "B":["11110","10001","10001","11110","10001","10001","11110"],
    "C":["01111","10000","10000","10000","10000","10000","01111"],
    "D":["11110","10001","10001","10001","10001","10001","11110"],
    "E":["11111","10000","10000","11110","10000","10000","11111"],
    "F":["11111","10000","10000","11110","10000","10000","10000"],
    "G":["01111","10000","10000","10011","10001","10001","01111"],
    "H":["10001","10001","10001","11111","10001","10001","10001"],
    "I":["01110","00100","00100","00100","00100","00100","01110"],
    "J":["00111","00010","00010","00010","00010","10010","01100"],
    "K":["10001","10010","10100","11000","10100","10010","10001"],
    "L":["10000","10000","10000","10000","10000","10000","11111"],
    "M":["10001","11011","10101","10101","10001","10001","10001"],
    "N":["10001","11001","10101","10011","10001","10001","10001"],
    "O":["01110","10001","10001","10001","10001","10001","01110"],
    "P":["11110","10001","10001","11110","10000","10000","10000"],
    "Q":["01110","10001","10001","10001","10101","10010","01101"],
    "R":["11110","10001","10001","11110","10100","10010","10001"],
    "S":["01111","10000","10000","01110","00001","00001","11110"],
    "T":["11111","00100","00100","00100","00100","00100","00100"],
    "U":["10001","10001","10001","10001","10001","10001","01110"],
    "V":["10001","10001","10001","10001","10001","01010","00100"],
    "W":["10001","10001","10001","10101","10101","10101","01010"],
    "X":["10001","10001","01010","00100","01010","10001","10001"],
    "Y":["10001","10001","01010","00100","00100","00100","00100"],
    "Z":["11111","00001","00010","00100","01000","10000","11111"],
    "!":["00100","00100","00100","00100","00100","00000","00100"],
    ".":["00000","00000","00000","00000","00000","01100","01100"],
    "-":["00000","00000","00000","11111","00000","00000","00000"],
    ":":["00000","01100","01100","00000","01100","01100","00000"],
    "\u2665":["01010","11111","11111","11111","01110","00100","00000"],
    "\u25a0":["00000","11111","11111","11111","11111","11111","00000"],
    "\u2618":["00100","01110","10101","01110","10101","00100","01110"],
    "\u2713":["00000","00001","00010","10100","01000","00000","00000"],
    "\u25b2":["00100","01110","11111","11111","00000","00000","00000"],
    "\u224b":["00000","01010","10101","00000","01010","10101","00000"],
    "\u2302":["00100","01010","10001","11111","10001","10001","11111"],
    "\u25c6":["00100","01110","11111","11111","01110","00100","00000"],
    "\u26a1":["00010","00100","01110","00010","00100","01000","10000"],
    "\u25b6":["10000","11000","11100","11110","11100","11000","10000"],
    "\u2161":["10001","10001","10001","10001","10001","10001","10001"],
    "\u2190":["00000","00100","01000","11111","01000","00100","00000"],
    "\u2192":["00000","00100","00010","11111","00010","00100","00000"],
    "\u2191":["00100","01110","10101","00100","00100","00100","00000"],
    "\u2193":["00100","00100","00100","00100","10101","01110","00100"],
    "\u2602":["01110","11111","00100","10101","00100","01010","10001"],
    "\u2601":["00000","01100","10010","10001","11111","00000","00000"],
    "\u2600":["10101","01110","11111","11111","01110","10101","00000"],
    "\u273F":["00100","10101","01110","11111","01110","10101","00100"],
    "\u25ca":["00100","01010","10001","10001","10001","01010","00100"],
    "\u25d0":["01110","10001","10101","10101","10101","10001","01110"],
    "\u25a3":["11111","10001","11111","10001","10001","10001","11111"],
    "\u2663":["00100","01110","00100","11111","11111","00100","01110"]
  };
  const DEFAULTS={
    columns:32,rows:8,pixelSize:10,gap:2,speed:48,direction:"left",displayMode:"ticker",surface:"led",
    foreground:"#7cff7c",background:"#07120b",accent:"#f2c94c",brightness:1,contrast:1,glow:.65,textScale:.78,
    fontFamily:FONTS.matrix,fontProfile:"5x7",fontWeight:700,renderer:"auto",align:"center",padding:2,
    maxMessages:24,animation:true,loop:true,showMeta:true,motionEffect:"scroll",effectPhase:0,activeDotShape:"round"
  };
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||min));
  const esc=v=>String(v??"");
  const pick=(catalog,value,fallback)=>catalog[value]?value:fallback;
  function normalizePriority(value){return typeof value==="number"?clamp(value,1,4):PRIORITIES[value]||PRIORITIES.normal;}
  function normalizeAlign(value,fallback){return ["left","center","right"].includes(value)?value:fallback;}
  function hexToRgb(hex){
    const value=String(hex||"").replace("#","");
    if(value.length!==3&&value.length!==6)return {r:255,g:255,b:255};
    const full=value.length===3?value.split("").map(x=>x+x).join(""):value;
    return {r:parseInt(full.slice(0,2),16),g:parseInt(full.slice(2,4),16),b:parseInt(full.slice(4,6),16)};
  }
  function rgba(hex,alpha){const c=hexToRgb(hex);return `rgba(${c.r},${c.g},${c.b},${clamp(alpha,0,1)})`;}
  function nowIso(){return new Date().toISOString();}
  function symbolFor(name){
    const key=String(name||"").trim();
    if(!key)return "";
    if(SYMBOLS[key])return SYMBOLS[key].char;
    const found=Object.values(SYMBOLS).find(symbol=>symbol.aliases.includes(key.toLowerCase()));
    return found?found.char:key;
  }
  function normalizeSymbolDef(key,value){
    if(typeof value==="string")return {label:key,char:value,aliases:[]};
    return Object.assign({label:key,char:key,aliases:[]},value||{});
  }
  function registerSymbol(name,definition){
    const key=String(name||"").trim();
    if(!key)return null;
    SYMBOLS[key]=normalizeSymbolDef(key,definition);
    return SYMBOLS[key];
  }
  function registerSymbolPack(packName,symbols={}){
    const registered={};
    Object.keys(symbols||{}).forEach(key=>{registered[key]=registerSymbol(key,symbols[key]);});
    return {packName,registered};
  }
  function expandSymbols(text){return esc(text).replace(/\{symbol:([a-zA-Z0-9_-]+)\}/g,(_,name)=>symbolFor(name));}
  function createFontManager(customProfiles={}){
    const profiles=Object.assign({},FONT_PROFILES,customProfiles);
    return {
      profiles,
      listProfiles(){return Object.values(profiles).map(profile=>Object.assign({},profile));},
      getProfile(id="5x7"){return profiles[id]||profiles["5x7"];},
      registerProfile(id,profile){profiles[id]=Object.assign({id},profile);return profiles[id];},
      glyphFor(char,profileId="5x7"){
        const value=String(char||" ").toUpperCase();
        const profile=this.getProfile(profileId);
        return profile.renderer==="pixel"?(GLYPHS_5X7[value]||GLYPHS_5X7[" "]):null;
      },
      measureText(text,profileId="5x7"){
        const profile=this.getProfile(profileId);
        return {columns:String(text||"").length*(profile.cellWidth+profile.spacing),rows:profile.cellHeight,profile:Object.assign({},profile)};
      }
    };
  }
  function createRendererFactory(fontManager){
    const renderers={
      text(ctx,state){drawTextRenderer(ctx,state);},
      pixel(ctx,state){drawPixelRenderer(ctx,state,fontManager);}
    };
    return {
      renderers,
      listRenderers(){return Object.keys(renderers);},
      registerRenderer(name,renderer){renderers[name]=renderer;return renderer;},
      resolve(name,profileId){
        if(name&&name!=="auto"&&renderers[name])return renderers[name];
        return renderers[fontManager.getProfile(profileId).renderer]||renderers.text;
      },
      draw(ctx,state){this.resolve(state.settings.renderer,state.message?.fontProfile||state.settings.fontProfile)(ctx,state);}
    };
  }
  function createMessage(input={},settings=DEFAULTS){
    const symbolChar=input.symbol?symbolFor(input.symbol):"";
    const symbolPrefix=symbolChar?`${symbolChar} `:"";
    const priority=normalizePriority(input.priority);
    const rawText=input.symbolOnly&&symbolChar?symbolChar:symbolPrefix+esc(input.text||input.label||"");
    return {
      id:input.id||`dm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text:expandSymbols(rawText).slice(0,240),
      symbol:input.symbol||"",
      symbolOnly:Boolean(input.symbolOnly),
      direction:pick(DIRECTIONS,input.direction,settings.direction),
      motionEffect:pick(MOTION_EFFECTS,input.motionEffect,settings.motionEffect),
      displayMode:pick(DISPLAY_MODES,input.displayMode||input.mode,settings.displayMode),
      speed:clamp(input.speed||settings.speed,8,240),
      foreground:input.foreground||input.color||settings.foreground,
      background:input.background||settings.background,
      accent:input.accent||settings.accent,
      brightness:clamp(input.brightness||settings.brightness,0.05,1.6),
      fontFamily:input.fontFamily||(input.symbolOnly?FONTS.system:settings.fontFamily),
      fontProfile:input.symbolOnly?pick(FONT_PROFILES,input.fontProfile,"vector"):pick(FONT_PROFILES,input.fontProfile,settings.fontProfile),
      fontWeight:clamp(input.fontWeight||settings.fontWeight,300,900),
      textScale:clamp(input.fontSize||input.textScale||(input.symbolOnly?1.05:settings.textScale),0.25,2.4),
      align:normalizeAlign(input.align,settings.align),
      priority,
      priorityLabel:Object.keys(PRIORITIES).find(k=>PRIORITIES[k]===priority)||"normal",
      source:input.source||"manual",
      program:input.program||input.source||"manual",
      channel:input.channel||"default",
      timestamp:input.timestamp||nowIso(),
      ttlMs:Math.max(0,Number(input.ttlMs)||0),
      meta:input.meta||{}
    };
  }
  function createEngine(options={}){
    const settings=Object.assign({},DEFAULTS,options.settings||{});
    settings.columns=clamp(settings.columns,8,160);settings.rows=clamp(settings.rows,5,48);
    settings.pixelSize=clamp(settings.pixelSize,4,28);settings.gap=clamp(settings.gap,0,8);
    settings.speed=clamp(settings.speed,8,240);settings.direction=pick(DIRECTIONS,settings.direction,"left");
    settings.motionEffect=pick(MOTION_EFFECTS,settings.motionEffect,"scroll");
    settings.displayMode=pick(DISPLAY_MODES,settings.displayMode,"ticker");settings.surface=pick(SURFACES,settings.surface,"led");
    settings.brightness=clamp(settings.brightness,0.05,1.6);settings.contrast=clamp(settings.contrast,0.2,2);
    settings.glow=clamp(settings.glow,0,2);settings.textScale=clamp(settings.textScale,0.25,2.4);
    settings.fontProfile=pick(FONT_PROFILES,settings.fontProfile,"5x7");settings.renderer=["auto","text","pixel"].includes(settings.renderer)?settings.renderer:"auto";
    settings.fontWeight=clamp(settings.fontWeight,300,900);settings.align=normalizeAlign(settings.align,"center");settings.padding=clamp(settings.padding,0,16);
    settings.activeDotShape=["round","square"].includes(settings.activeDotShape)?settings.activeDotShape:"round";
    const messages=Array.isArray(options.messages)?options.messages.map(m=>createMessage(m,settings)):[];
    const fontManager=createFontManager(options.fontProfiles);
    const rendererFactory=createRendererFactory(fontManager);
    let activeId=options.activeId||null,running=Boolean(options.running),offset=0,lastFrame=0;
    const listeners=new Set();
    function emit(type,detail){
      listeners.forEach(fn=>{try{fn({type,detail});}catch(_){}});
      try{global.dispatchEvent(new CustomEvent(`display-matrix.${type}`,{detail}));}catch(_){}
    }
    function pruneExpired(){
      const now=Date.now();
      for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.ttlMs>0&&Date.parse(m.timestamp)+m.ttlMs<now)messages.splice(i,1);}
    }
    function activeMessage(){
      pruneExpired();
      if(activeId){const found=messages.find(m=>m.id===activeId);if(found)return found;}
      return messages.slice().sort((a,b)=>b.priority-a.priority||Date.parse(a.timestamp)-Date.parse(b.timestamp))[0]||null;
    }
    function statistics(){
      const active=activeMessage(),byPriority={low:0,normal:0,high:0,critical:0};
      messages.forEach(m=>{byPriority[m.priorityLabel]=(byPriority[m.priorityLabel]||0)+1;});
      return {version:VERSION,running,total:messages.length,active,offset,settings:Object.assign({},settings),byPriority};
    }
    function resetMotion(){offset=0;lastFrame=0;}
    const api={
      version:VERSION,directions:DIRECTIONS,motionEffects:MOTION_EFFECTS,effectCatalog:EFFECT_CATALOG,priorities:PRIORITIES,palettes:PALETTES,displayModes:DISPLAY_MODES,surfaces:SURFACES,
      fonts:FONTS,fontProfiles:FONT_PROFILES,symbols:SYMBOLS,programProfiles:PROGRAM_PROFILES,presets:PRESETS,fontManager,rendererFactory,settings,
      addMessage(input){
        const message=createMessage(input,settings);
        messages.push(message);messages.sort((a,b)=>b.priority-a.priority||Date.parse(a.timestamp)-Date.parse(b.timestamp));
        if(messages.length>settings.maxMessages)messages.splice(settings.maxMessages);
        if(input?.activate===true||!activeId||message.priority>=((activeMessage()||{}).priority||0)){activeId=message.id;resetMotion();}
        emit("message",message);emit("statistics",statistics());return message;
      },
      addSymbol(symbol,options={}){return this.addMessage(Object.assign({},options,{symbol,text:options.text||SYMBOLS[symbol]?.label||symbol}));},
      symbolFor,expandSymbols,registerSymbol,registerSymbolPack,
      submitProgramMessage(program,input={},options={}){
        const profile=PROGRAM_PROFILES[program]||PROGRAM_PROFILES.generic;
        const palette=PALETTES[input.palette]||PALETTES[profile.defaultPalette]||{};
        const message=this.addMessage(Object.assign({},palette,input,{program,source:program,priority:input.priority||profile.defaultPriority,activate:options.activate!==false}));
        emit("program-message",{program,message,profile});
        return message;
      },
      setText(text,options={}){this.clear();return this.addMessage(Object.assign({},options,{text}));},
      setActive(id){activeId=messages.some(m=>m.id===id)?id:null;resetMotion();emit("active",statistics());return activeMessage();},
      next(){if(!messages.length)return null;const index=Math.max(0,messages.findIndex(m=>m.id===(activeMessage()||{}).id));activeId=messages[(index+1)%messages.length].id;resetMotion();emit("active",statistics());return activeMessage();},
      clear(){messages.splice(0);activeId=null;resetMotion();emit("clear",statistics());},
      start(){running=true;emit("cycle",{running});},
      stop(){running=false;emit("cycle",{running});},
      step(deltaMs=16){
        const message=activeMessage();if(!message)return statistics();
        settings.effectPhase=(settings.effectPhase||0)+deltaMs;
        if(message.displayMode==="fullscreen"||message.displayMode==="static"){offset=0;emit("frame",statistics());return statistics();}
        if(!["scroll","softScroll","chase"].includes(effectOf(message,settings))){offset=0;emit("frame",statistics());return statistics();}
        const delta=Math.max(0,Number(deltaMs)||16),distance=message.speed*delta/1000;
        if(message.direction==="right"||message.direction==="down")offset+=distance;
        if(message.direction==="left"||message.direction==="up")offset-=distance;
        if(message.direction==="static")offset=0;
        const span=(settings.columns+message.text.length*6)*(settings.pixelSize+settings.gap);
        if(Math.abs(offset)>span){if(settings.loop)offset=message.direction==="right"||message.direction==="down"?-settings.columns:settings.columns;else this.next();emit("loop",statistics());}
        emit("frame",statistics());return statistics();
      },
      tick(timeMs){const t=Number(timeMs)||Date.now(),delta=lastFrame?Math.min(64,t-lastFrame):16;lastFrame=t;return this.step(delta);},
      setDisplayMode(mode){settings.displayMode=pick(DISPLAY_MODES,mode,settings.displayMode);const m=activeMessage();if(m)m.displayMode=settings.displayMode;resetMotion();emit("settings",Object.assign({},settings));},
      setSurface(surface){settings.surface=pick(SURFACES,surface,settings.surface);emit("settings",Object.assign({},settings));},
      setDirection(direction){settings.direction=pick(DIRECTIONS,direction,settings.direction);const m=activeMessage();if(m)m.direction=settings.direction;resetMotion();emit("settings",Object.assign({},settings));},
      setMotionEffect(effect){settings.motionEffect=pick(MOTION_EFFECTS,effect,settings.motionEffect);const m=activeMessage();if(m)m.motionEffect=settings.motionEffect;resetMotion();emit("settings",Object.assign({},settings));},
      setSpeed(speed){settings.speed=clamp(speed,8,240);const m=activeMessage();if(m)m.speed=settings.speed;emit("settings",Object.assign({},settings));},
      setBrightness(value){settings.brightness=clamp(value,0.05,1.6);const m=activeMessage();if(m)m.brightness=settings.brightness;emit("settings",Object.assign({},settings));},
      setGlow(value){settings.glow=clamp(value,0,2);emit("settings",Object.assign({},settings));},
      setContrast(value){settings.contrast=clamp(value,0.2,2);emit("settings",Object.assign({},settings));},
      setFont(options={}){
        if(options.family)settings.fontFamily=FONTS[options.family]||options.family;
        if(options.profile)settings.fontProfile=pick(FONT_PROFILES,options.profile,settings.fontProfile);
        if(options.weight)settings.fontWeight=clamp(options.weight,300,900);
        if(options.scale)settings.textScale=clamp(options.scale,0.25,2.4);
        if(options.size)settings.textScale=clamp(options.size,0.25,2.4);
        if(options.align)settings.align=normalizeAlign(options.align,settings.align);
        const m=activeMessage();if(m){m.fontFamily=settings.fontFamily;m.fontProfile=settings.fontProfile;m.fontWeight=settings.fontWeight;m.textScale=settings.textScale;m.align=settings.align;}
        emit("settings",Object.assign({},settings));
      },
      setFontSize(size){this.setFont({size});return Object.assign({},settings);},
      setRenderer(renderer){settings.renderer=["auto","text","pixel"].includes(renderer)?renderer:settings.renderer;emit("settings",Object.assign({},settings));},
      setActiveDotShape(shape){settings.activeDotShape=["round","square"].includes(shape)?shape:settings.activeDotShape;emit("settings",Object.assign({},settings));},
      setColors(colors={}){
        settings.foreground=colors.foreground||colors.color||settings.foreground;settings.background=colors.background||settings.background;settings.accent=colors.accent||settings.accent;
        const m=activeMessage();if(m){m.foreground=settings.foreground;m.background=settings.background;m.accent=settings.accent;}
        emit("settings",Object.assign({},settings));
      },
      setPalette(nameOrPalette){const p=typeof nameOrPalette==="string"?PALETTES[nameOrPalette]:nameOrPalette;if(!p)return;this.setColors(p);},
      setPixelSize(v){settings.pixelSize=clamp(v,4,28);emit("settings",Object.assign({},settings));},
      setMatrixSize(columns,rows){settings.columns=clamp(columns,8,160);settings.rows=clamp(rows,5,48);resetMotion();emit("settings",Object.assign({},settings));},
      setAnimation(v){settings.animation=Boolean(v);emit("settings",Object.assign({},settings));},
      applyPreset(name){const preset=PRESETS[name];if(!preset)return null;Object.assign(settings,preset.settings||{});if(preset.palette)this.setPalette(preset.palette);resetMotion();emit("preset",{name,preset,settings:Object.assign({},settings)});return Object.assign({},settings);},
      applyDesignTokens(tokens={}){
        const colors=tokens.colors||tokens.color||tokens,typography=tokens.typography||tokens.fonts||{};
        this.setColors({foreground:colors.displayMatrixForeground||colors.foreground||colors.text,background:colors.displayMatrixBackground||colors.background||colors.surface,accent:colors.displayMatrixAccent||colors.accent||colors.primary});
        this.setFont({family:typography.displayMatrixFamily||typography.monoFamily||typography.family,profile:typography.displayMatrixProfile,weight:typography.displayMatrixWeight||typography.weight,scale:typography.displayMatrixScale||typography.displayMatrixSize});
        if(tokens.motion?.reduced===true)this.setAnimation(false);emit("design-tokens",Object.assign({},settings));
      },
      createHostAdapter(hostName="generic"){return {moduleId:"shared.display-matrix",version:VERSION,hostName,capabilities:["ticker","top-line","screensaver","fullscreen","colors","brightness","font-size","kiosk-effects","font-manager","renderer-factory","priority","symbols","symbol-packs","program-messages","presets"],mountMode:"script-or-custom-element",api:this};},
      getMessages(){pruneExpired();return messages.slice();},
      getActiveMessage:activeMessage,
      exportStatistics:statistics,
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      toJSON(){return {version:VERSION,running,activeId,offset,settings:Object.assign({},settings),messages:this.getMessages()};}
    };
    if(options.text)api.addMessage({text:options.text});
    return api;
  }
  function effectOf(message,settings){return message.motionEffect||settings.motionEffect||"scroll";}
  function effectProgress(settings,speed=48){
    const phase=Number(settings.effectPhase)||0;
    return Math.max(0,Math.floor(phase/Math.max(80,900-(Number(speed)||48)*3)));
  }
  function effectCycle(settings,length,speed=48,hold=3){
    const total=Math.max(1,length+hold);
    return effectProgress(settings,speed)%total;
  }
  function seededIndex(text,index,phase,mod){
    let seed=2166136261;
    const value=`${text}:${index}:${Math.floor(phase/90)}`;
    for(let i=0;i<value.length;i++)seed=(seed^value.charCodeAt(i))*16777619;
    return Math.abs(seed)%Math.max(1,mod);
  }
  function revealCount(text,settings,message,hold=5){
    const chars=Array.from(text||"");
    return Math.min(chars.length,effectCycle(settings,chars.length,message.speed,hold)+1);
  }
  function randomishChar(text,index,settings,alphabet){
    return alphabet[seededIndex(text,index,settings.effectPhase||0,alphabet.length)]||" ";
  }
  function effectText(text,effect,settings,message){
    const chars=Array.from(text||"");
    if(effect==="typewriter")return chars.slice(0,Math.min(chars.length,effectCycle(settings,chars.length,message.speed,5)+1)).join("");
    if(effect==="letterStep")return chars.length?chars[effectProgress(settings,message.speed)%chars.length]:"";
    if(effect==="blink"&&Math.floor((settings.effectPhase||0)/420)%2)return "";
    if(effect==="scramble"){
      const shown=revealCount(text,settings,message,6),alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?-*";
      return chars.map((char,index)=>char===" "?" ":(index<shown?char:randomishChar(text,index,settings,alphabet))).join("");
    }
    if(effect==="matrixReveal"){
      const shown=revealCount(text,settings,message,5),alphabet="01░▒▓";
      return chars.map((char,index)=>char===" "?" ":(index<shown?char:randomishChar(text,index,settings,alphabet))).join("");
    }
    if(effect==="flipboard"){
      const shown=revealCount(text,settings,message,4),alphabet="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return chars.map((char,index)=>char===" "?" ":(index<shown?char:alphabet[(alphabet.indexOf(char.toUpperCase())+effectProgress(settings,message.speed)+index)%alphabet.length])).join("");
    }
    if(effect==="wipe")return chars.slice(0,revealCount(text,settings,message,6)).join("");
    if(effect==="pixelBuild")return chars.slice(0,revealCount(text,settings,message,6)).join("");
    if(effect==="pixelDissolve")return chars.slice(Math.min(chars.length,effectCycle(settings,chars.length,message.speed,6))).join("");
    return text;
  }
  function centeredEffectText(text,motion,settings,message){
    const chars=Array.from(text||""),step=Math.min(chars.length,effectCycle(settings,chars.length,message.speed,4)+1);
    if(motion==="centerOut"){
      const middle=(chars.length-1)/2,start=Math.max(0,Math.floor(middle-(step-1)/2)),end=Math.min(chars.length,Math.ceil(middle+(step+1)/2));
      return chars.slice(start,end).join("");
    }
    if(motion==="outsideIn"){
      const left=chars.slice(0,Math.ceil(step/2)).join(""),right=chars.slice(Math.max(Math.ceil(step/2),chars.length-Math.floor(step/2))).join("");
      return left+(chars.length>step?"   ":"")+right;
    }
    return text;
  }
  function drawTextRenderer(ctx,state){
    const {engine,settings,message,width,height,pitch,fontSize}=state,stats=engine.exportStatistics(),motion=effectOf(message,settings),mode=message.displayMode||settings.displayMode;
    const text=effectText(message.text||"",motion,settings,message);
    if(!text)return;
    const pulseScale=motion==="pulse"?1+Math.sin((settings.effectPhase||0)/180)*.1:1;
    if(pulseScale!==1){ctx.save();ctx.translate(width/2,height/2);ctx.scale(pulseScale,pulseScale);ctx.translate(-width/2,-height/2);}
    const textWidth=ctx.measureText(text).width;
    if(mode==="fullscreen"){
      const lines=(text.split(/\n+/).filter(Boolean).length?text.split(/\n+/).filter(Boolean):[text]),lineHeight=fontSize*1.08,totalHeight=lineHeight*lines.length;
      lines.forEach((line,index)=>{const w=ctx.measureText(line).width,align=message.align||settings.align;let x=(width-w)/2;if(align==="left")x=settings.padding*pitch;if(align==="right")x=width-w-settings.padding*pitch;ctx.fillText(line,x,height/2-totalHeight/2+lineHeight*(index+.5));});
      if(pulseScale!==1)ctx.restore();
      return;
    }
    if(motion==="centerOut"||motion==="outsideIn"){
      const visible=centeredEffectText(text,motion,settings,message);
      const w=ctx.measureText(visible).width;
      ctx.fillText(visible,(width-w)/2,height/2);
      if(pulseScale!==1)ctx.restore();
      return;
    }
    if(motion==="chase"){
      const gap=Math.max(24,width*.18),base=settings.gap+stats.offset;
      for(let i=0;i<4;i++)ctx.fillText(text,base+i*(textWidth+gap),height/2);
      if(pulseScale!==1)ctx.restore();
      return;
    }
    if(motion==="bounce"||motion==="wave"){
      const chars=Array.from(text),baseX=Math.max(settings.gap,(width-textWidth)/2);
      let advance=0;
      chars.forEach((char,index)=>{
        const charWidth=ctx.measureText(char).width;
        const lift=motion==="bounce"?Math.abs(Math.sin((settings.effectPhase||0)/170+index*.7))*fontSize*.22:Math.sin((settings.effectPhase||0)/180+index*.55)*fontSize*.18;
        ctx.fillText(char,baseX+advance,height/2-lift);
        advance+=charWidth;
      });
      if(pulseScale!==1)ctx.restore();
      return;
    }
    if(motion==="pendulum"){
      const travel=Math.max(0,width-textWidth-settings.gap*2),s=(Math.sin((settings.effectPhase||0)/900)+1)/2;
      ctx.fillText(text,settings.gap+travel*s,height/2);
      if(pulseScale!==1)ctx.restore();
      return;
    }
    let x=settings.gap+stats.offset,y=height/2;
    if(message.direction==="right")x=-textWidth+stats.offset;
    if(message.direction==="static"||mode==="static")x=Math.max(settings.gap,(width-textWidth)/2);
    if(message.direction==="up"||message.direction==="down"){x=Math.max(settings.gap,(width-textWidth)/2);y=message.direction==="up"?height+stats.offset:-fontSize+stats.offset;}
    ctx.fillText(text,x,y);
    if(pulseScale!==1)ctx.restore();
  }
  function drawPixelRenderer(ctx,state,fontManager){
    const {engine,settings,message,width,height}=state,stats=engine.exportStatistics(),motion=effectOf(message,settings),mode=message.displayMode||settings.displayMode;
    const rawText=String(effectText(message.text||"",motion,settings,message)).toUpperCase();
    const text=String(motion==="centerOut"||motion==="outsideIn"?centeredEffectText(rawText,motion,settings,message):rawText).toUpperCase();
    if(!text)return;
    const profile=fontManager.getProfile(message.fontProfile||settings.fontProfile),fontScale=Math.max(.45,Math.min(2.4,message.textScale||settings.textScale||1));
    const dotSize=Math.max(2,settings.pixelSize*fontScale),dotStep=(settings.pixelSize+settings.gap)*fontScale,glyphGap=Math.max(dotStep,profile.spacing*dotStep);
    const textWidth=Array.from(text).length*(profile.cellWidth*dotStep+glyphGap),textHeight=profile.cellHeight*dotStep;
    const pulseScale=motion==="pulse"?1+Math.sin((settings.effectPhase||0)/180)*.14:1;
    let x=settings.gap+stats.offset,y=Math.max(settings.gap,(height-textHeight)/2);
    if(["centerOut","outsideIn","letterStep","typewriter","blink","pulse","scramble","matrixReveal","flipboard","bounce","wave","scanner","sparkle","wipe","pixelBuild","pixelDissolve"].includes(motion))x=Math.max(settings.gap,(width-textWidth)/2);
    if(message.direction==="right")x=-textWidth+stats.offset;
    if(message.direction==="static"||mode==="static"||mode==="fullscreen")x=Math.max(settings.gap,(width-textWidth)/2);
    if(message.direction==="up"||message.direction==="down"){x=Math.max(settings.gap,(width-textWidth)/2);y=message.direction==="up"?height+stats.offset:-textHeight+stats.offset;}
    if(motion==="pendulum"){
      const travel=Math.max(0,width-textWidth-settings.gap*2),s=(Math.sin((settings.effectPhase||0)/900)+1)/2;
      x=settings.gap+travel*s;
    }
    if(pulseScale!==1){ctx.save();ctx.translate(width/2,height/2);ctx.scale(pulseScale,pulseScale);ctx.translate(-width/2,-height/2);}
    const visibleDots=Math.max(1,Math.floor((settings.effectPhase||0)/Math.max(20,220-(message.speed||settings.speed))));
    Array.from(text).forEach((char,index)=>{
      const glyph=fontManager.glyphFor(char,profile.id)||fontManager.glyphFor(char,"5x7"),gx=x+index*(profile.cellWidth*dotStep+glyphGap);
      if(!glyph)return;
      glyph.forEach((row,rowIndex)=>Array.from(row).forEach((bit,colIndex)=>{
        if(bit!=="1")return;
        const dotOrder=index*profile.cellWidth*profile.cellHeight+rowIndex*profile.cellWidth+colIndex;
        if(motion==="pixelBuild"&&dotOrder>visibleDots%(Math.max(1,Array.from(text).length*profile.cellWidth*profile.cellHeight+18)))return;
        if(motion==="pixelDissolve"&&dotOrder<visibleDots%(Math.max(1,Array.from(text).length*profile.cellWidth*profile.cellHeight+18)))return;
        if(motion==="sparkle"&&seededIndex(text,dotOrder,settings.effectPhase||0,9)===0){ctx.save();ctx.globalAlpha=.45;}
        const lift=motion==="bounce"?Math.abs(Math.sin((settings.effectPhase||0)/170+index*.7))*dotStep*1.4:motion==="wave"?Math.sin((settings.effectPhase||0)/180+index*.55)*dotStep*1.1:0;
        const px=gx+colIndex*dotStep,py=y+rowIndex*dotStep-lift;
        if(settings.activeDotShape==="square")ctx.fillRect(px,py,dotSize,dotSize);
        else{ctx.beginPath();ctx.arc(px+dotSize/2,py+dotSize/2,Math.max(1,dotSize*.48),0,Math.PI*2);ctx.fill();}
        if(motion==="sparkle"&&seededIndex(text,dotOrder,settings.effectPhase||0,9)===0)ctx.restore();
      }));
    });
    if(pulseScale!==1)ctx.restore();
  }
  function draw(canvas,engine){
    if(!canvas||!engine)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const settings=engine.settings,pitch=settings.pixelSize+settings.gap,width=settings.columns*pitch+settings.gap,height=settings.rows*pitch+settings.gap,dpr=global.devicePixelRatio||1,message=engine.getActiveMessage();
    canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+"px";canvas.style.height=height+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=message?.background||settings.background;ctx.fillRect(0,0,width,height);
    ctx.fillStyle=rgba(message?.foreground||settings.foreground,settings.surface==="lcd"?.08:.07*settings.contrast);
    for(let y=0;y<settings.rows;y++)for(let x=0;x<settings.columns;x++){const px=settings.gap+x*pitch,py=settings.gap+y*pitch;if(settings.surface==="led"){ctx.beginPath();ctx.arc(px+settings.pixelSize/2,py+settings.pixelSize/2,settings.pixelSize/2,0,Math.PI*2);ctx.fill();}else ctx.fillRect(px,py,settings.pixelSize,settings.pixelSize);}
    if(!message)return;
    const fontSize=Math.max(8,settings.rows*pitch*(message.textScale||settings.textScale));
    ctx.font=`${message.fontWeight||settings.fontWeight} ${fontSize}px ${message.fontFamily||settings.fontFamily}`;
    ctx.textBaseline="middle";ctx.fillStyle=rgba(message.foreground||settings.foreground,message.brightness||settings.brightness);ctx.shadowColor=message.accent||settings.accent;ctx.shadowBlur=Math.max(0,settings.pixelSize*settings.glow*(message.brightness||settings.brightness));
    engine.rendererFactory.draw(ctx,{engine,settings,message,width,height,pitch,fontSize});
    ctx.shadowBlur=0;
    const motion=effectOf(message,settings);
    if(motion==="scanner"){
      const beamWidth=Math.max(settings.pixelSize*2,width*.035),x=((settings.effectPhase||0)/5)%(width+beamWidth)-beamWidth;
      const gradient=ctx.createLinearGradient(x,0,x+beamWidth,0);
      gradient.addColorStop(0,rgba(message.accent||settings.accent,0));
      gradient.addColorStop(.5,rgba(message.accent||settings.accent,.72));
      gradient.addColorStop(1,rgba(message.accent||settings.accent,0));
      ctx.fillStyle=gradient;ctx.fillRect(x,0,beamWidth,height);
    }
    if(motion==="sparkle"){
      ctx.fillStyle=rgba(message.accent||settings.accent,.65);
      for(let i=0;i<Math.max(8,settings.columns/5);i++){
        const sx=seededIndex(message.text,i,settings.effectPhase||0,settings.columns),sy=seededIndex(message.text,i+200,settings.effectPhase||0,settings.rows);
        ctx.beginPath();ctx.arc(settings.gap+sx*pitch+settings.pixelSize/2,settings.gap+sy*pitch+settings.pixelSize/2,Math.max(1,settings.pixelSize*.28),0,Math.PI*2);ctx.fill();
      }
    }
    if(message.priority>=PRIORITIES.high){ctx.fillStyle=message.accent||settings.accent;ctx.fillRect(0,0,width,Math.max(2,settings.gap+1));}
  }
  class DisplayMatrixElement extends HTMLElement{
    constructor(){
      super();this.attachShadow({mode:"open"});
      this.shadowRoot.innerHTML=`<style>:host{display:grid;width:100%;height:100%;place-items:center;overflow:hidden}.wrap{display:grid;width:100%;height:100%;place-items:center;overflow:hidden}.meta{display:none;font:12px system-ui;color:#526673;text-align:center}canvas{display:block;max-width:100%;max-height:100%}</style><div class="wrap"><canvas></canvas><div class="meta"></div></div>`;
      this._canvas=this.shadowRoot.querySelector("canvas");this._meta=this.shadowRoot.querySelector(".meta");
      this.engine=createEngine({settings:{columns:Number(this.getAttribute("columns"))||DEFAULTS.columns,rows:Number(this.getAttribute("rows"))||DEFAULTS.rows,displayMode:this.getAttribute("mode")||DEFAULTS.displayMode,surface:this.getAttribute("surface")||DEFAULTS.surface,speed:Number(this.getAttribute("speed"))||DEFAULTS.speed,brightness:Number(this.getAttribute("brightness"))||DEFAULTS.brightness,fontProfile:this.getAttribute("font-profile")||DEFAULTS.fontProfile,renderer:this.getAttribute("renderer")||DEFAULTS.renderer}});
      this._raf=0;this._unsub=this.engine.subscribe(()=>this.render());
    }
    connectedCallback(){const text=this.getAttribute("text");if(text&&!this.engine.getMessages().length)this.engine.setText(text,{priority:this.getAttribute("priority")||"normal"});this.engine.start();this.render();this.loop();}
    disconnectedCallback(){this._unsub?.();if(this._raf)global.cancelAnimationFrame(this._raf);}
    addMessage(input){return this.engine.addMessage(input);} addSymbol(symbol,options){return this.engine.addSymbol(symbol,options);} setText(text,options){return this.engine.setText(text,options);}
    submitProgramMessage(program,input,options){return this.engine.submitProgramMessage(program,input,options);}
    setDirection(direction){return this.engine.setDirection(direction);} setMotionEffect(effect){return this.engine.setMotionEffect(effect);} setSpeed(speed){return this.engine.setSpeed(speed);} setDisplayMode(mode){return this.engine.setDisplayMode(mode);}
    setBrightness(value){return this.engine.setBrightness(value);} setFont(options){return this.engine.setFont(options);} setFontSize(size){return this.engine.setFontSize(size);} setRenderer(renderer){return this.engine.setRenderer(renderer);}
    setColors(colors){return this.engine.setColors(colors);} applyDesignTokens(tokens){return this.engine.applyDesignTokens(tokens);} applyPreset(name){return this.engine.applyPreset(name);}
    setPalette(palette){return this.engine.setPalette(palette);} exportStatistics(){return this.engine.exportStatistics();}
    loop(){if(!this.isConnected)return;if(this.engine.settings.animation)this.engine.tick(performance.now());this._raf=global.requestAnimationFrame(()=>this.loop());}
    render(){draw(this._canvas,this.engine);const stats=this.engine.exportStatistics(),show=!!(stats.active&&this.engine.settings.showMeta);this._meta.style.display=show?"block":"none";this._meta.textContent=show?`${stats.active.priorityLabel} - ${stats.active.displayMode} - ${stats.active.direction} - ${stats.active.speed} px/s`:"";}
  }
  if(global.customElements&&!global.customElements.get("display-matrix-module"))global.customElements.define("display-matrix-module",DisplayMatrixElement);
  global.FrameworkDisplayMatrixModule=Object.freeze({version:VERSION,createEngine,draw,createFontManager,createRendererFactory,directions:DIRECTIONS,motionEffects:MOTION_EFFECTS,effectCatalog:EFFECT_CATALOG,priorities:PRIORITIES,palettes:PALETTES,displayModes:DISPLAY_MODES,surfaces:SURFACES,fonts:FONTS,fontProfiles:FONT_PROFILES,symbols:SYMBOLS,programProfiles:PROGRAM_PROFILES,presets:PRESETS,symbolFor,expandSymbols,registerSymbol,registerSymbolPack});
})(window);
