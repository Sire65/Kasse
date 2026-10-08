// 08.10.2026 Gesamtpruefung der Kasse (Betreiber: "Check nochmals die komplette Kasse"): behobene Geldfehler.
// Jeder Fall wurde vorher im Browser nachgestellt und nach der Korrektur erneut durchgespielt (Kasse und Schulung).
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  // Reklamation "Auszahlung": Geld geht ueber die Minus-Zeile im Bon raus, das Protokoll darf es nicht nochmal abziehen (vorher 7,00 statt 3,50 €)
  assert(s.includes('amount:0,amountCents:0,erstattungImBon:+betrag.toFixed(2),reason:"Reklamation"'), pfad + ': Reklamation zieht Bargeld doppelt ab');
  // Personal/Helfer: Bon mit Gutschein-Zeile vorher sperren; bricht der Abschluss ab, kommt das Pfand zurueck
  assert(s.includes('if(gutscheinZeile(item)){if(!namen.includes(item.name))namen.push(item.name);return}'), pfad + ': Personal mit Gutschein nicht gesperrt');
  assert(s.includes('function internPfandZurueck(){') && (s.match(/\.then\(r=>\{if\(!r\)internPfandZurueck\(\)\}\)/g) || []).length === 2, pfad + ': Pfand wird bei Abbruch nicht zurueckgegeben');
  // Konto: Doppeltipp darf nicht abstuerzen
  assert(/const rec=await completeSale\("account-charge",\{silent:true\}\);\n  if\(!rec\)return;/.test(s), pfad + ': Konto-Doppeltipp ungeschuetzt');
  // Storno: Gutschein-Anteil gegenbuchen und Guthaben zurueck; Storno von Personal/Helfer senkt den Umsatz nicht
  assert(s.includes('rec.voucherPayments=original.voucherPayments.map(v=>({code:v.code,amount:-Math.abs(Number(v.amount||0))}))'), pfad + ': Storno ohne Gutschein-Gegenbuchung');
  assert(s.includes('window.KCGutschein.gutschreibenFuerBon(ob,{bon:rec.bon})'), pfad + ': Storno einer Gutschein-Vollzahlung gibt Guthaben nicht zurueck');
  assert(s.includes('&&t.originalType!=="personal"&&t.originalType!=="helfer"'), pfad + ': Storno Personal/Helfer verfaelscht Umsatz');
}
for (const pfad of ['pos/kc-gutschein.js', 'schulung/pos/kc-gutschein.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes("if (!beleg) { if (knopf) knopf.disabled = false; return; }"), pfad + ': Abbuchung ohne gespeicherten Bon');
  assert(s.includes('if (beleg.training)'), pfad + ': Training verbraucht Guthaben');
  assert(s.includes('function gutschreiben(code, betrag, angaben)') && s.includes('function gutschreibenFuerBon(bon, angaben)'), pfad + ': Gutschrift fehlt');
}
console.log('kasse-pruefung-08-10: ok');
// Speicherschicht (nachgestellt: verschluesselte Bons + Neustart -> naechster Verkauf loeschte den ganzen Bestand)
for (const pfad of ['pos/kc-transaction-store.js', 'schulung/pos/kc-transaction-store.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  const f = s.slice(s.indexOf('async function performReplaceAll'), s.indexOf('const writeQueues'));
  assert(!f.includes('store.clear()'), pfad + ': Speichern loescht wieder den ganzen Bestand');
  assert(f.includes('if (loeschen)') && f.includes('!zu.has(k)'), pfad + ': Loeschen nur ausdruecklich und nie gesperrte Zeilen');
  assert(s.includes('if (roh?.transactionId) zu.add(roh.transactionId);'), pfad + ': unlesbare Zeile bricht das Laden ab');
  assert(s.includes('if (neuesterAuftrag.get(storeName) !== nummer) return undefined;'), pfad + ': Rueckstau wird nicht zusammengefasst');
}
for (const pfad of ['pos/kc-security-card-pos.js', 'schulung/pos/kc-security-card-pos.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes("aktuelleAusgabe = Number(localStorage.getItem(AUSGABE_KEY) || 0) || null;"), pfad + ': Ausgabenummer nach Neuladen fehlt');
  assert((s.match(/nachladen\(\);/g) || []).length === 2, pfad + ': gesperrte Bons werden nach Freigabe nicht nachgeladen');
}
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('saveTransactions(pendingBackupImport.transactions||[],false,{loeschen:true});'), pfad + ': Backup ersetzt nicht mehr');
  assert(s.includes('let _autoFavMerker='), pfad + ': Auto-Favoriten werden wieder bei jedem Tipp neu gezaehlt');
  for (const d of ['pos/index.html', 'pos/service-worker.js']) assert(fs.readFileSync(pfad.replace('app.js', d.split('/')[1]), 'utf8').includes('kc-transaction-store.js?build=0.2.0'), pfad + ': Build Speicher fehlt');
}
console.log('kasse-pruefung-08-10 (Speicher): ok');
