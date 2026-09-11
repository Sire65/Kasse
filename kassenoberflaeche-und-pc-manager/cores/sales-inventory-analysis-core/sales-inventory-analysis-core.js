(function(global){
  "use strict";
  const VERSION="0.1.1";
  const DAY_NAMES=["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  const SLIDE_TYPES={welcome:"Begrüßung",price:"Preisliste",pricelist:"Preisliste",menu:"Speisekarte",weather:"Wetter",countdown:"Countdown",member:"Mitglied",members:"Mitglieder",project:"Projekt",recipe:"Rezept",sponsor:"Sponsor",qr:"QR-Code",lcd:"LED-/LCD-Laufschrift",ticker:"Laufschrift",notice:"Hinweis",thanks:"Danke",gallery:"Bildergalerie",image:"Bild",video:"Video",table:"Tabelle",program:"Bühnenprogramm",schedule:"Bühnenprogramm"};
  const DEFAULT_STOCK=[
    {id:"spruehsahne",name:"Sprühsahne",unit:"Dose",initial:0,min:5,reserve:3,perSale:{eier:0},measure:"Portionen je Dose feststellen"},
    {id:"senf",name:"Senf in Flaschen",unit:"Flasche",initial:0,min:4,reserve:2,perSale:{mett:0},measure:"Portionen je Flasche feststellen"},
    {id:"wuerfelzucker",name:"Würfelzucker",unit:"Stück",initial:0,min:100,reserve:60,perSale:{feuer:3}},
    {id:"servietten",name:"Servietten",unit:"Stück",initial:0,min:200,reserve:100,perSale:{mett:1,sauerkraut:1,gruenkohl:1,hering:1,grot:1,gweiss:1,feuer:1,eier:1}},
    {id:"ausserhaus",name:"Außer-Haus-Gefäße",unit:"Stück",initial:0,min:100,reserve:50,perSale:{},measure:"Zuordnung zur Verkaufsart noch festlegen"},
    {id:"inhaus",name:"In-Haus-Gefäße / Mehrweg",unit:"Stück",initial:0,min:30,reserve:15,perSale:{},measure:"Umlauf und Bruch getrennt festlegen"},
    {id:"spekulatius",name:"Spekulatiusgebäck",unit:"Stück",initial:0,min:150,reserve:80,perSale:{grot:1,gweiss:1,feuer:1,eier:1,roterfeger:1,apfel:1}},
    {id:"kakao",name:"Kakaopulver",unit:"g",initial:0,min:250,reserve:100,perSale:{eier:0},measure:"Gramm je Glas feststellen"},
    {id:"amaretto",name:"Amaretto",unit:"ml",initial:0,min:1000,reserve:500,perSale:{schussamaretto:0},measure:"Milliliter je Schuss festlegen"},
    {id:"rum42",name:"Rum 42 %",unit:"ml",initial:0,min:1000,reserve:500,perSale:{schussrum:0},measure:"Milliliter je Schuss festlegen"},
    {id:"rum54",name:"Rum 54 % für Feuerzangenbowle",unit:"ml",initial:0,min:1000,reserve:500,perSale:{feuer:0},measure:"Milliliter je Feuerzange festlegen"}
  ];
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  function localDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
  function transactionKey(tx,index){return String(tx.id||`${tx.registerId||"KASSE"}-${tx.bon||tx.bonNumber||tx.time||index}`)}
  function normalizeTransactions(source=[]){return source.filter(tx=>!tx.training&&tx.type!=="personal").map((tx,index)=>({...tx,_key:transactionKey(tx,index),_date:new Date(tx.time||tx.date||0)})).filter(tx=>!Number.isNaN(tx._date.getTime()))}
  function filterTransactions(source,filter={}){
    return normalizeTransactions(source).filter(tx=>{
      const iso=localDate(tx._date),hour=tx._date.getHours(),day=tx._date.getDay();
      if(filter.from&&iso<filter.from)return false;if(filter.to&&iso>filter.to)return false;
      if(filter.hourFrom!==""&&filter.hourFrom!=null&&hour<number(filter.hourFrom))return false;
      if(filter.hourTo!==""&&filter.hourTo!=null&&hour>=number(filter.hourTo))return false;
      if(filter.weekday!==""&&filter.weekday!=null&&day!==number(filter.weekday))return false;
      if(filter.register&&tx.registerId!==filter.register)return false;
      if(filter.operator&&!String(tx.operator||"").toLowerCase().includes(String(filter.operator).toLowerCase()))return false;
      const items=tx.items||[];
      if(filter.article&&!items.some(item=>item.id===filter.article||item.name===filter.article))return false;
      if(filter.group&&!items.some(item=>filter.articleGroups?.[item.id]===filter.group))return false;
      return true;
    });
  }
  /* BEFUND 01.09.2026: der Artikel wurde AUSSCHLIESSLICH ueber die Artikelnummer gesucht.
     Der PC-Manager selbst sucht an derselben Stelle ueber Nummer ODER Name. Dadurch fand
     das eine Diagramm die Pfandartikel (glasplus/"Glaspfand"), das andere nicht - und
     dieselbe Grafik zeigte auf zwei Reitern verschiedene Zahlen ("Pfand 23 %" gegen
     "Sonstiges 26 %"). Jetzt suchen beide gleich. */
  function itemRows(transactions,articles=[]){
    const byId=new Map(articles.map(a=>[a.id,a]));
    const byName=new Map(articles.map(a=>[String(a.name||"").toLowerCase(),a]));
    const finde=item=>byId.get(item.id)||byName.get(String(item.name||"").toLowerCase());
    return transactions.flatMap(tx=>(tx.items||[]).map(item=>({...item,tx,article:finde(item),revenue:number(item.qty)*number(item.price)})));
  }
  function add(map,key,value=1){map[key]=(map[key]||0)+value}
  function analyze(source,articles,filter={}){
    const transactions=filterTransactions(source,filter),rows=itemRows(transactions,articles),revenue=rows.reduce((sum,row)=>sum+row.revenue,0);
    const customers=new Set(transactions.map(tx=>tx._key)).size,byDay={},byWeekday={},byHour={},byArticleRevenue={},byArticleQuantity={},byGroup={};
    transactions.forEach(tx=>{add(byDay,localDate(tx._date));add(byWeekday,DAY_NAMES[tx._date.getDay()]);add(byHour,`${String(tx._date.getHours()).padStart(2,"0")}:00`)});
    /* BEFUND 01.09.2026: in "Umsatzstärkste Artikel" stand der Glaspfand mit 19.996 EUR
       auf Platz eins - vor jedem Getraenk und jeder Speise. Gerechnet ist das richtig,
       als Aussage aber falsch: verkauft wurde Gluehwein, das Glas ist nur geliehen und
       kommt zurueck. In den ARTIKEL-Grafiken zaehlt Pfand deshalb nicht mit.
       Bewusst NICHT geaendert: Gesamtumsatz, verkaufte Menge und der Anteil je
       Warengruppe - dort gehoert der Pfand hinein, sonst stimmt die Summe nicht mehr
       mit dem Bon und mit dem Kassenabschluss ueberein. */
    /* BEFUND 01.09.2026: die Warengruppe wurde AUSSCHLIESSLICH ueber die Artikel-Stammdaten
       bestimmt (row.article.category). Steht ein verkaufter Artikel dort nicht mehr - weil
       er geloescht wurde, umbenannt ist oder wie die Pfandzeilen gar kein eigener Artikel
       ist -, landete sein ganzer Umsatz unter "Sonstiges". Gemessen: dieselbe Grafik zeigte
       auf dem einen Reiter "Pfand 23 % / Sonstiges 3 %", auf dem anderen "Sonstiges 26 %" -
       zwei Diagramme mit demselben Titel und verschiedenen Zahlen. Die Bonzeile bringt ihre
       Warengruppe selbst mit; die gilt jetzt als Rueckfall. */
    const istPfand=row=>row?.article?.category==="Pfand"||/pfand|r[üu]ckgabe/i.test(String(row?.name||""));
    const gruppeVon=row=>row?.article?.category||row?.category||(istPfand(row)?"Pfand":"Sonstiges");
    rows.forEach(row=>{if(!istPfand(row)){add(byArticleRevenue,row.name||row.id,row.revenue);add(byArticleQuantity,row.name||row.id,number(row.qty))}add(byGroup,gruppeVon(row),row.revenue)});
    const sorted=map=>Object.entries(map).sort((a,b)=>b[1]-a[1]);
    return {transactions,rows,revenue,customers,average:customers?revenue/customers:0,quantity:rows.reduce((sum,row)=>sum+number(row.qty),0),byDay:sorted(byDay),byWeekday:sorted(byWeekday),byHour:sorted(byHour),byArticleRevenue:sorted(byArticleRevenue),byArticleQuantity:sorted(byArticleQuantity),byGroup:sorted(byGroup)};
  }
  function normalizeStock(items){return (items?.length?items:DEFAULT_STOCK).map(item=>({...item,initial:number(item.initial),min:number(item.min),reserve:number(item.reserve),perSale:{...(item.perSale||{})}}))}
  function stockStatus(item,remaining,forecast){
    const rules=Object.values(item.perSale||{});if(item.measure&&(!rules.length||rules.some(value=>number(value)===0)))return {code:"unknown",label:"Messung erforderlich"};
    if(remaining<=item.min||forecast>remaining)return {code:"red",label:"Nachkauf nötig"};
    if(remaining<=item.min+item.reserve||forecast>remaining-item.reserve)return {code:"yellow",label:"Reserve knapp"};
    return {code:"green",label:"Ausreichend"};
  }
  function calculateStock(items,ledger,transactions,forecastFactor=1){
    const sold={};itemRows(normalizeTransactions(transactions),[]).forEach(row=>add(sold,row.id,number(row.qty)));
    return normalizeStock(items).map(item=>{
      const booked=(ledger||[]).filter(row=>row.stockId===item.id).reduce((sum,row)=>sum+number(row.quantity),0);
      const used=Object.entries(item.perSale||{}).reduce((sum,[articleId,amount])=>sum+(sold[articleId]||0)*number(amount),0);
      const remaining=item.initial+booked-used,forecast=Math.max(0,used*number(forecastFactor));
      return {...item,booked,used,remaining,forecast,status:stockStatus(item,remaining,forecast)};
    });
  }
  global.KCSalesInventoryAnalysisCore={VERSION,DAY_NAMES,SLIDE_TYPES,DEFAULT_STOCK:DEFAULT_STOCK.map(x=>({...x,perSale:{...x.perSale}})),labelSlideType:type=>SLIDE_TYPES[type]||"Sonstiger Folientyp",filterTransactions,analyze,normalizeStock,calculateStock};
  global.KCReleaseManifest?.register?.("salesInventoryAnalysisCore",VERSION);
})(window);
