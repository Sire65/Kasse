// Exaktes A4 fuer Chromium-PDFs (Karteikarten 4.4, Betreiber 26.10.2026: Drucker meldet "Papier zu lang fuer Duplexdruck"
// und gibt Einzelseiten aus). Chromium rastet die Seitengroesse auf ganze Bildpunkte ein: aus 210 x 297 mm wird
// 595,92 x 841,92 pt, aus format:'A4' sogar 595,92 x 842,88 pt - also etwas groesser als A4 (595,28 x 841,89 pt).
// Manche Druckertreiber halten das fuer ein eigenes Papierformat und drucken dann nicht beidseitig.
// Abhilfe ohne Zusatzpaket: jede /MediaBox im fertigen PDF wird auf genau A4 gesetzt. Der neue Eintrag wird mit
// Leerzeichen auf die alte Laenge aufgefuellt, damit die Byte-Positionen der Querverweistabelle stimmen.
// Inhalt wird nicht skaliert: rechts fallen 0,2 mm weg, oben 0,01 mm (Karten) bzw. 0,35 mm (Uebungsliste) - dort ist nur Leerraum.
// Danach Pruefung: weicht eine Seite ab oder gibt es abweichende Crop/Bleed/Trim/ArtBox, bricht der Bau ab.
const fs=require('fs');
const A4='0 0 595.28 841.89';
const BOX=/\/(MediaBox|CropBox|BleedBox|TrimBox|ArtBox)\s*\[([^\]]*)\]/g;
module.exports=function exaktA4(datei){
 const s=fs.readFileSync(datei,'latin1');
 const neu=s.replace(BOX,(alt,name,werte)=>{
  if(name!=='MediaBox')return alt;
  const ersatz=`/MediaBox [${A4}]`;
  if(ersatz.length>alt.length)throw new Error('A4: MediaBox-Eintrag zu kurz zum Ersetzen: '+alt);
  return `/MediaBox [${A4}${' '.repeat(alt.length-ersatz.length)}]`});
 fs.writeFileSync(datei,neu,'latin1');
 const boxen=[...neu.matchAll(BOX)];
 const seiten=(neu.match(/\/Type\s*\/Page(?![s\w])/g)||[]).length;
 const media=boxen.filter(b=>b[1]==='MediaBox');
 const falsch=boxen.filter(b=>b[2].trim().split(/\s+/).join(' ')!==A4);
 if(!seiten||media.length!==seiten||falsch.length)throw new Error(`A4-Pruefung fehlgeschlagen (${datei}): ${seiten} Seiten, ${media.length} MediaBox, abweichend: ${falsch.map(b=>b[0]).join(', ')||'-'}`);
 return seiten};
