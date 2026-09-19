/* Freigegebene Bilderversion 3: nur Bildfelder bekannter Standardartikel migrieren. */
(function(g){'use strict';
const entries={"glasplus":{"image":"assets/pfand_aufschlag_version_3.png","legacy":["pfandglas_auth.webp","pfandglas_bv2.webp","pfandglas_geben_bv2.webp","pfandglas_geben_12-09.webp"]},"glasminus":{"image":"assets/pfandrueckgabe_version_3.png","legacy":["pfandglas_auth.webp","pfandglas_bv2.webp","pfandglas_rueckgabe_bv2.webp","pfandglas_rueckgabe_12-09.webp"]},
  "eier": {
    "image": "assets/eierpunsch_version_3.png",
    "legacy": [
      "eierlikoerpunsch_auth.webp",
      "eierlikoerpunsch_bv2.webp"
    ]
  },
  "grot": {
    "image": "assets/gluehwein_version_3.png",
    "legacy": [
      "gluehwein_rot_auth.webp",
      "gluehwein_rot_bv2.webp",
      "gluehwein_rot.webp",
      "gluehwein_rot_11-09.webp"
    ]
  },
  "gweiss": {
    "image": "assets/gluehwein_weiss_version_3.png",
    "legacy": [
      "gluehwein_weiss_auth.webp",
      "gluehwein_weiss_bv2.webp",
      "gluehwein_weiss.webp"
    ]
  },
  "feuer": {
    "image": "assets/feuerzangenbowle_version_3.png",
    "legacy": [
      "feuerzangenbowle_auth.webp",
      "feuerzangenbowle_bv2.webp"
    ]
  },
  "apfel": {
    "image": "assets/apfelpunsch_version_3.png",
    "legacy": [
      "apfelpunsch_auth.webp",
      "apfelpunsch_bv2.webp"
    ]
  },
  "roterfeger": {
    "image": "assets/roter_feger_version_3.png",
    "legacy": [
      "roter_feger.webp",
      "roter_feger_bv2.webp"
    ]
  },
  "schussrum": {
    "image": "assets/rum_version_3.png",
    "legacy": [
      "rum_flasche_bv2.webp",
      "rum_flasche_11-09.webp"
    ]
  },
  "schussamaretto": {
    "image": "assets/amaretto_version_3.png",
    "legacy": [
      "amaretto_flasche_bv2.webp",
      "amaretto_flasche_11-09.webp",
      "amaretto_auth.webp"
    ]
  },
  "sauerkraut": {
    "image": "assets/sauerkraut_version_3.png",
    "legacy": [
      "sauerkraut_auth.webp",
      "sauerkraut_bv2.webp"
    ]
  },
  "sauerkrautmett": {
    "image": "assets/sauerkraut_wurst_version_3.png",
    "legacy": [
      "sauerkraut_mettwurst_auth.webp",
      "sauerkraut_mettwurst_bv2.webp"
    ]
  },
  "gruenkohl": {
    "image": "assets/gruenkohl_version_3.png",
    "legacy": [
      "gruenkohl_auth.webp",
      "gruenkohl_bv2.webp"
    ]
  },
  "gruenkohlmett": {
    "image": "assets/gruenkohl_wurst_version_3.png",
    "legacy": [
      "gruenkohl_mettwurst_auth.webp",
      "gruenkohl_mettwurst_bv2.webp"
    ]
  },
  "mettwurst": {
    "image": "assets/mettwurst_version_3.png",
    "legacy": [
      "mettwurst_auth.webp",
      "mettwurst_bv2.webp"
    ]
  },
  "hering": {
    "image": "assets/hering_kartoffeln_version_3.png",
    "legacy": [
      "hering_kartoffeln_auth.webp",
      "hering_kartoffeln_bv2.webp"
    ]
  },
  "knirpsecreme": {
    "image": "assets/creme_kartoffeln_version_3.png",
    "legacy": [
      "kartoffelcreme_auth.webp",
      "kartoffelcreme_bv2.webp"
    ]
  }
};
function migrate(p){if(!p)return p;(p.depositComponents||[]).forEach(d=>{if(d.id==='glass'&&(!d.image||entries.glasplus.legacy.includes(String(d.image).split('/').pop())))d.image=entries.glasplus.image});if(p.embeddedImage)return p;const e=entries[p.id];if(!e)return p;const current=String(p.image||'');const file=current.split('/').pop();if(!current||e.legacy.includes(file)||current===e.image)p.image=e.image;return p}
function apply(items){(items||[]).forEach(migrate);return items}
function isV3(p){return !p.isPackage&&/_version_3\.png$/.test(p.image||'')}
g.KCImagesV3={entries,migrate,apply,isV3};
})(window);
