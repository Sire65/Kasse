(function(global){
  'use strict';
  const KEY='kc_cash_measure_settings_v1';
  const DEFAULTS={
    version:1,
    coins:[
      {value:2,grams:8.50,image:'assets/muenze_2.webp'},
      {value:1,grams:7.50,image:'assets/muenze_1.webp'},
      {value:.5,grams:7.80,image:'assets/muenze_0.5.webp'},
      {value:.2,grams:5.74,image:'assets/muenze_0.2.webp'},
      {value:.1,grams:4.10,image:'assets/muenze_0.1.webp'},
      {value:.05,grams:3.92,image:'assets/muenze_0.05.webp'},
      {value:.02,grams:3.06,image:'assets/muenze_0.02.webp'},
      {value:.01,grams:2.30,image:'assets/muenze_0.01.webp'}
    ],
    rolls:[
      {value:2,coins:25,grams:null,referenceGrams:212.5,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:1,coins:25,grams:null,referenceGrams:187.5,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.5,coins:40,grams:null,referenceGrams:312.0,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.2,coins:40,grams:null,referenceGrams:229.6,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.1,coins:40,grams:null,referenceGrams:164.0,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.05,coins:50,grams:null,referenceGrams:196.0,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.02,coins:50,grams:null,referenceGrams:153.0,referenceBasis:'Münzinhalt ohne Rollenpapier'},
      {value:.01,coins:50,grams:null,referenceGrams:115.0,referenceBasis:'Münzinhalt ohne Rollenpapier'}
    ],
    notes:[
      {value:100,grams:null,referenceGrams:1.02,referenceBasis:'Banknoten-Referenz; Serie/Zustand kann abweichen',image:'assets/schein_100.jpg'},
      {value:50,grams:null,referenceGrams:.92,referenceBasis:'Banknoten-Referenz; Serie/Zustand kann abweichen',image:'assets/schein_50.jpg'},
      {value:20,grams:null,referenceGrams:.81,referenceBasis:'Banknoten-Referenz; Serie/Zustand kann abweichen',image:'assets/schein_20.jpg'},
      {value:10,grams:null,referenceGrams:.72,referenceBasis:'Banknoten-Referenz; Serie/Zustand kann abweichen',image:'assets/schein_10.jpg'},
      {value:5,grams:null,referenceGrams:.71,referenceBasis:'Banknoten-Referenz; Serie/Zustand kann abweichen',image:'assets/schein_5.jpg'}
    ]
  };
  const clone=v=>JSON.parse(JSON.stringify(v));
  function read(){
    try{
      const s=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!s||typeof s!=='object')return clone(DEFAULTS);
      return {
        version:1,
        coins:Array.isArray(s.coins)?s.coins:clone(DEFAULTS.coins),
        rolls:Array.isArray(s.rolls)?s.rolls:clone(DEFAULTS.rolls),
        notes:Array.isArray(s.notes)?s.notes:clone(DEFAULTS.notes)
      };
    }catch{return clone(DEFAULTS)}
  }
  function save(v){localStorage.setItem(KEY,JSON.stringify(v));return read()}
  function reset(){localStorage.removeItem(KEY);return read()}
  function coinWeight(value){return Number(read().coins.find(x=>Number(x.value)===Number(value))?.grams)||0}
  function rollCoins(value){return Number(read().rolls.find(x=>Number(x.value)===Number(value))?.coins)||0}
  function noteWeight(value){const n=read().notes.find(x=>Number(x.value)===Number(value))?.grams;return n==null?null:Number(n)}
  function piecesFromWeight(value,grams,type='coin'){
    const g=type==='note'?noteWeight(value):coinWeight(value);
    if(!g||!Number.isFinite(Number(grams)))return null;
    return Math.max(0,Math.round(Number(grams)/g));
  }
  global.KCCashMeasureSettings={KEY,DEFAULTS,read,save,reset,coinWeight,rollCoins,noteWeight,piecesFromWeight};
})(typeof window!=='undefined'?window:globalThis);
