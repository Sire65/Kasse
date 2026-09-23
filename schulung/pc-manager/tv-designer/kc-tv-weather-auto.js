(()=>{'use strict';
const stage=document.getElementById('tvStage');let kind='snow';
const classify=code=>code===0?'sun':code<=3?'cloud':code<=48?'fog':code<=82?'rain':code<=86?'snow':'storm';
async function update(){try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.6645&longitude=7.6342&current=weather_code&timezone=Europe%2FBerlin');if(r.ok)kind=classify((await r.json()).current.weather_code)}catch{}mount()}
function mount(){if(!stage||stage.querySelector('.tvWeatherScene:not(.autoWeather)'))return;const old=stage.querySelector('.autoWeather');if(old&&old.classList.contains(kind))return;stage.querySelectorAll('.autoWeather').forEach(x=>x.remove());const scene=document.createElement('div');scene.className='tvWeatherScene autoWeather '+kind;scene.style.opacity='.34';scene.innerHTML=kind==='rain'?'<i></i>'.repeat(55):kind==='snow'?'<b>❄</b>'.repeat(34):kind==='sun'?'<strong>☀</strong>':kind==='storm'?'<i></i>'.repeat(70)+'<strong>ϟ</strong>':kind==='fog'?'<em></em>'.repeat(6):'<em></em>'.repeat(3);stage.appendChild(scene)}
new MutationObserver(()=>setTimeout(mount,0)).observe(stage,{childList:true});update();setInterval(update,1800000);
})();
