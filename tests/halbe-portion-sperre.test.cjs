// 07.10.2026 (Betreiber): ½-Zeilen sind immer 1×, + / − / Mengenknöpfe gesperrt; 🗑 oder ½ nochmal löst den halben wieder auf
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('function istHalbeZeile(x){return Number(x?.portionFactor||1)===0.5}'), pfad + ': istHalbeZeile fehlt (als Funktion, wegen Laden-Reihenfolge)');
  assert(s.includes('function halbeAufloesen(i){'), pfad + ': halbeAufloesen fehlt');
  assert(s.includes('${x.lockedQuantity||istHalbeZeile(x)?"disabled":""}>−</button>') && s.includes('${x.lockedQuantity||istHalbeZeile(x)?"disabled":""}>+</button>'), pfad + ': +/− in ½-Zeilen nicht gesperrt');
  assert(s.includes('if((a==="plus"||a==="minus")&&istHalbeZeile(item))return setSystemHint(HALB_GESPERRT,"warn");'), pfad + ': cartAction sperrt +/− nicht');
  assert(/if\(a==="delete"&&istHalbeZeile\(item\)\)\{askConfirm\("½ Portion auflösen"/.test(s), pfad + ': 🗑 auf ½ löst nicht auf');
  assert(s.includes('}else if(isHalf){\n    return halbeAufloesen(state.cart.indexOf(item));'), pfad + ': ½ nochmal löst nicht auf');
  for (const f of ['function applyQuickQuantity(q){', 'function applyQuantity(q){']) { const i = s.indexOf(f); assert(i > 0 && s.slice(i, i + 160).includes('istHalbeZeile(item)'), pfad + ': ' + f + ' nicht gesperrt'); }
  assert(/function openSelectedQuantity\(\)\{[^\n]*if\(istHalbeZeile\(item\)\)return/.test(s), pfad + ': Menge-Fenster nicht gesperrt');
}
for (const pfad of ['pos/index.html', 'schulung/pos/index.html', 'pos/service-worker.js', 'schulung/pos/service-worker.js'])
  assert(fs.readFileSync(pfad, 'utf8').includes('app.js?build=0.31.3.6-r53'), pfad + ': Build r53 fehlt');
console.log('halbe-portion-sperre: ok');
