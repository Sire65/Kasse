(function(global){
  "use strict";
  const STORAGE_KEY="kc_sound_core_settings_v100";
  const DEFAULTS={enabled:true,volume:0.55,profile:"cash-register"};
  const SAMPLE_PATH="sounds/kassenton.mp3";
  let context=null;
  let sample=null;
  let sampleUnlocked=false;
  function read(){
    try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}}catch(_){return {...DEFAULTS}}
  }
  function write(patch){const next={...read(),...patch};try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch(_){}return next}
  function ensureContext(){
    const AudioCtx=global.AudioContext||global.webkitAudioContext;
    if(!AudioCtx)return null;
    if(!context)context=new AudioCtx({latencyHint:"interactive"});
    if(context.state==="suspended")context.resume().catch(()=>{});
    return context;
  }
  function tone(ctx,start,frequency,duration,gainValue,type="sine"){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,gainValue),start+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+duration+0.02);
  }
  function noiseClick(ctx,start,volume){
    const length=Math.max(1,Math.floor(ctx.sampleRate*0.045));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    src.buffer=buffer;filter.type="highpass";filter.frequency.value=1100;gain.gain.value=volume;
    src.connect(filter).connect(gain).connect(ctx.destination);src.start(start);
  }
  function mechanicalHit(ctx,start,duration,volume,frequency=95){
    const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type="square";osc.frequency.setValueAtTime(frequency,start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35,frequency*0.45),start+duration);
    filter.type="lowpass";filter.frequency.value=720;
    gain.gain.setValueAtTime(Math.max(0.0001,volume),start);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    osc.connect(filter).connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+duration+0.02);
  }
  function ensureSample(){
    if(sample)return sample;
    try{
      sample=new Audio(new URL(SAMPLE_PATH,document.baseURI).href);
      sample.preload="auto";
      sample.playsInline=true;
      return sample;
    }catch(_){return null}
  }
  function playSynthetic(settings){
    try{
      const ctx=ensureContext();if(!ctx)return false;
      const now=ctx.currentTime+0.012,v=Math.min(1,Math.max(0,Number(settings.volume)||0));
      // Mechanische Kassenlade: Entriegelung, Schubladenlauf, Anschlag und kurze Glocke.
      mechanicalHit(ctx,now,0.075,v*0.24,135);
      noiseClick(ctx,now+0.035,v*0.24);
      mechanicalHit(ctx,now+0.105,0.13,v*0.19,82);
      noiseClick(ctx,now+0.16,v*0.16);
      mechanicalHit(ctx,now+0.245,0.10,v*0.28,110);
      tone(ctx,now+0.255,1568,0.34,v*0.10,"sine");
      return true;
    }catch(err){console.warn("SoundCore: Ersatzton konnte nicht abgespielt werden",err);return false}
  }
  function playCashRegister(){
    const settings=read();if(!settings.enabled)return false;
    const audio=ensureSample();
    if(!audio)return playSynthetic(settings);
    try{
      audio.pause();audio.currentTime=0;audio.muted=false;
      audio.volume=Math.min(1,Math.max(0,Number(settings.volume)||0));
      const playback=audio.play();
      if(playback?.catch)playback.catch(err=>{
        console.warn("SoundCore: MP3-Kassenton nicht verfügbar, Ersatzton wird verwendet",err);
        playSynthetic(settings);
      });
      return true;
    }catch(err){
      console.warn("SoundCore: MP3-Kassenton nicht verfügbar, Ersatzton wird verwendet",err);
      return playSynthetic(settings);
    }
  }
  function setEnabled(enabled){return write({enabled:!!enabled}).enabled}
  function toggle(){return setEnabled(!read().enabled)}
  function isEnabled(){return !!read().enabled}
  function setVolume(volume){return write({volume:Math.min(1,Math.max(0,Number(volume)||0))}).volume}
  function unlock(){
    try{
      ensureContext();
      const audio=ensureSample();
      if(!audio||sampleUnlocked)return;
      audio.muted=true;audio.volume=0;
      const playback=audio.play();
      if(playback?.then)playback.then(()=>{
        audio.pause();audio.currentTime=0;audio.muted=false;audio.volume=read().volume;sampleUnlocked=true;
      }).catch(()=>{audio.muted=false});
    }catch(_){}
  }
  global.KCSoundCore=Object.freeze({version:"1.1.0",read,setEnabled,toggle,isEnabled,setVolume,playCashRegister,unlock});
})(window);
