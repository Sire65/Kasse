(function (global) {
  "use strict";

  const VERSION = "1.1.0";
  const TV_VERSION = "0.29.40";
  const BACKGROUND = "../tv-content/weihnachtsmarkt-2026/backgrounds/market-photo.webp";
  const MALE = "../avatar-core/assets/chef/chef_male_neutral.webp";
  const FEMALE = "../avatar-core/assets/chef/chef_female_neutral.webp";
  const MEMBER_ASSET_BASE = "../tv-content/weihnachtsmarkt-2026/members/";
  const GROUP = MEMBER_ASSET_BASE + "gruppenfoto-koecheclub.jpg";

  const MEMBER_QUOTES = [
    "Ich mache gerne mit, weil wir gemeinsam viel bewegen und dabei immer Spaß haben.",
    "Zu unseren Treffen komme ich gerne, weil der Austausch unter Kollegen einfach wertvoll ist.",
    "Ich bringe mich gerne ein, weil mir Gemeinschaft und soziales Engagement wichtig sind.",
    "Beim Köcheclub bin ich dabei, weil aus guten Ideen immer wieder tolle Aktionen entstehen.",
    "Ich schätze besonders den Zusammenhalt und die vielen schönen gemeinsamen Erlebnisse.",
    "Unsere Treffen sind für mich eine gute Mischung aus Fachgesprächen, Freundschaft und Geselligkeit.",
    "Ich helfe gerne mit, wenn wir gemeinsam etwas für andere Menschen erreichen können.",
    "Der Köcheclub bedeutet für mich Teamgeist, Verlässlichkeit und viel Freude an gemeinsamen Projekten.",
    "Ich bin gerne dabei, weil jeder seine Erfahrungen, Ideen und persönlichen Stärken einbringen kann.",
    "Besonders der Weihnachtsmarkt zeigt, was wir als Mannschaft gemeinsam leisten können.",
    "Mir gefallen die freundschaftliche Atmosphäre und der offene Austausch innerhalb des Clubs.",
    "Ich unterstütze den Köcheclub gerne, weil Tradition und neue Ideen hier gut zusammenpassen.",
    "Gemeinsam planen, anpacken und anschließend zusammen feiern – genau das gefällt mir.",
    "Ich komme gerne zu den Treffen, weil es immer interessante Gespräche und viel zu lachen gibt.",
    "Für mich ist der Köcheclub ein Ort, an dem aus Berufskollegen echte Freunde geworden sind.",
    "Ich engagiere mich gerne, weil unsere Arbeit nicht nur Freude macht, sondern auch einem guten Zweck dient.",
    "Im Köcheclub kann ich meine Erfahrungen weitergeben und gleichzeitig immer wieder Neues lernen.",
    "Ich helfe gerne aus beim Köcheclub Werne, denn helfende Hände werden immer gebraucht."
  ];

  const MEMBER_PROFILES = [
    { name: "Manfred Schoppmann", photo: MEMBER_ASSET_BASE + "mitglied-01.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Anne Reinkober", photo: MEMBER_ASSET_BASE + "mitglied-02.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Wilfried Wittwer", photo: MEMBER_ASSET_BASE + "mitglied-03.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Karla Kazik", photo: MEMBER_ASSET_BASE + "mitglied-04.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Klaus Zander", photo: MEMBER_ASSET_BASE + "mitglied-05.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Marianne Bierkämper", photo: MEMBER_ASSET_BASE + "mitglied-06.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Andrea Spahn", photo: MEMBER_ASSET_BASE + "mitglied-07.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Dieter Zander", photo: MEMBER_ASSET_BASE + "mitglied-08.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Hans-Joachim Koch", photo: MEMBER_ASSET_BASE + "mitglied-09.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Frank Brösel", photo: MEMBER_ASSET_BASE + "mitglied-10.jpg", mediaType: "image/jpeg", provisional: true },
    { name: "Reinhilde Eggenstein", photo: FEMALE, mediaType: "image/webp", provisional: true },
    { name: "Thomas Hess", photo: MALE, mediaType: "image/webp", provisional: true },
    { name: "Christina Scharnetzki", photo: FEMALE, mediaType: "image/webp", provisional: true },
    { name: "Steven Linley", photo: MALE, mediaType: "image/webp", provisional: true },
    { name: "Peter Wördemann", photo: MALE, mediaType: "image/webp", provisional: true },
    { name: "Ruth Kazik", photo: FEMALE, mediaType: "image/webp", provisional: true },
    { name: "Friedbert Köhling", photo: MALE, mediaType: "image/webp", provisional: true },
    { name: "Leon Wördemann", photo: MALE, mediaType: "image/webp", provisional: true }
  ];

  const BACKGROUNDS = Object.freeze({
    "market-photo": { label: "Weihnachtsmarkt · Foto", kind: "image", value: BACKGROUND },
    "market-window-lights": { label: "Rathaus Werne · Weihnachtsmarkt", kind: "image", value: "../media/backgrounds/rathaus-werne-weihnachtsmarkt-v1.png" },
    "forest-gold": { label: "Winterwald · Grün/Gold", kind: "css", value: "radial-gradient(circle at 82% 18%,rgba(250,204,21,.22),transparent 24%),linear-gradient(135deg,#061b14,#0d4933 58%,#7a5315)" },
    "burgundy": { label: "Festlich · Bordeaux", kind: "css", value: "radial-gradient(circle at 12% 18%,rgba(255,220,140,.24),transparent 25%),linear-gradient(135deg,#31080b,#741e24 55%,#1b1110)" },
    "midnight": { label: "Winternacht · Blau", kind: "css", value: "radial-gradient(circle at 76% 22%,rgba(180,220,255,.22),transparent 28%),linear-gradient(145deg,#061426,#123b5a 58%,#07131f)" },
    "cream": { label: "Hell · Creme/Gold", kind: "css", value: "radial-gradient(circle at 85% 12%,rgba(154,107,21,.22),transparent 24%),linear-gradient(140deg,#fffaf0,#e8d5ad 62%,#b98832)" },
    "custom": { label: "Eigenes Bild", kind: "custom", value: "" }
  });

  const uid = index => `wm26-${String(index + 1).padStart(3, "0")}`;
  const design = (light = false) => ({
    palette: light ? "light" : "warm",
    background: { type: "solid", color1: light ? "#fffaf0" : "#1b1815", color2: light ? "#e8d5ad" : "#3b1517", opacity: 1, blur: 0, vignette: 0, image: "" },
    typography: { fontFamily: "humanist", titleColor: light ? "#2b1a12" : "#fff8e8", textColor: light ? "#39271c" : "#fff8e8", priceColor: "#ffd56a", titleSize: 1.08, textSize: 1.02, priceSize: 1, titleBold: true, textBold: false, textAlign: "center" },
    banner: { type: "none", text: "" }, shape: { type: "none", text: "", position: "right" },
    transition: { type: "fade", duration: 800 }, master: { useSafeArea: true, footer: "Köcheclub Werne · Weihnachtsmarkt" }
  });

  const safeLayout = () => ({
    title:{x:47,y:20,w:68,h:13,scale:1,rotation:0,opacity:1,z:12}, text:{x:50,y:45,w:78,h:28,scale:1,rotation:0,opacity:1,z:11},
    price:{x:50,y:69,w:42,h:13,scale:1,rotation:0,opacity:1,z:13}, symbols:{x:90,y:9,w:12,h:8,scale:.8,rotation:0,opacity:1,color:"#ffd56a",spacing:8,z:14},
    ticker:{x:50,y:94,w:92,h:8,scale:1,rotation:0,opacity:1,z:16}, weather:{x:50,y:63,w:88,h:52,scale:1,rotation:0,opacity:1,z:10}, image:{x:24,y:53,w:34,h:62,scale:1,rotation:0,opacity:1,z:8}
  });

  function base(index, data = {}) {
    const item = Object.assign({
      id: uid(index), presentationKind: "weihnachtsmarkt-2026", renderMode: "christmas-editable",
      type: "notice", title: "", text: "", price: "", duration: 10, noTime: true,
      start: "00:00", end: "23:59", ticker: "", theme: "dark", decorations: [], animation: "none", enabled: true,
      backgroundPreset: "market-window-lights", backgroundDataUrl: "", backgroundOpacity: 1,
      presentationDesign: design(false), layout: safeLayout(),
      sourcePresentation: { name: "Weihnachtsmarkt Werne · bearbeitbare Vorlage", templateVersion: VERSION }
    }, data);
    item.layout=Object.assign(safeLayout(),data.layout||{}); item.objectLifecycleVersion=2; return item;
  }

  function member(index, memberNumber, quote) {
    const profile = MEMBER_PROFILES[memberNumber - 1] || {};
    return base(index, {
      type: "member", renderMode: "member-showcase", title: profile.name || `Name Mitglied ${String(memberNumber).padStart(2, "0")}`,
      text: quote, duration: 10, decorations: [memberNumber % 3 === 0 ? "⭐" : "👨‍🍳"],
      media: {
        name: `${profile.name || `Mitglied ${String(memberNumber).padStart(2, "0")}`} · vorläufiges Foto austauschen`,
        type: profile.mediaType || "image/webp",
        dataUrl: profile.photo || (memberNumber % 2 ? MALE : FEMALE),
        provisional: profile.provisional !== false
      },
      layout: {
        image: { x: 20, y: 51, w: 29, h: 68, scale: 1, rotation: 0, opacity: 1, z: 8 },
        title: { x: 66, y: 37, w: 56, h: 15, scale: 1, rotation: 0, opacity: 1, z: 12 },
        text: { x: 66, y: 58, w: 56, h: 28, scale: 1, rotation: 0, opacity: 1, z: 12 },
        symbols: { x: 88, y: 11, w: 16, h: 10, scale: .8, rotation: 0, opacity: 1, color: "#ffd56a", spacing: 8, z: 14 },
        ticker: { x: 50, y: 94, w: 92, h: 8, scale: 1, rotation: 0, opacity: 1, z: 16 }
      }
    });
  }

  function catalogTable(items, rows, options = {}) {
    return {
      catalogTable: {
        items: items.map(item => Object.assign({}, item)),
        priceIncludesDeposit: false,
        footnote: options.footnote || ""
      },
      tableObject: {
        id: `catalog-${options.key || "table"}`,
        source: "PC Manager · Artikelstammdaten",
        sheet: options.title || "Preisliste",
        rows,
        header: true,
        x: 50,
        y: options.y || 52,
        w: options.w || 88,
        h: options.h || 62,
        fontSize: options.fontSize || 22,
        headerBg: "#173b61",
        headerText: "#ffffff",
        bodyBg: "rgba(255,255,255,.94)",
        bodyText: "#172033",
        border: "#b8c4d2"
      }
    };
  }

  const ALCOHOLIC_ITEMS = [
    { ids:["grot"], name:"Glühwein rot", description:"Roter Winzerglühwein, heiß serviert", price:3.50 },
    { ids:["gweiss"], name:"Glühwein weiß", description:"Weißer Winzerglühwein, heiß serviert", price:3.50 },
    { ids:["feuer"], name:"Feuerzangenbowle", description:"Glühwein mit Zucker und brennendem Rum", price:5.00 },
    { ids:["eier"], name:"Eierlikörpunsch", description:"Weißwein, Eierlikör, Vanillezucker und Sahne", price:4.50 }
  ];
  const NON_ALCOHOLIC_ITEMS = [
    { ids:["roterfeger","kinder","kinderpunsch"], name:"Roter Feger", description:"Alkoholfreier roter Kinderpunsch, heiß serviert", price:2.50 },
    { ids:["apfel"], name:"Apfelpunsch", description:"Heißer alkoholfreier Apfelpunsch", price:2.50 }
  ];
  const FOOD_ITEMS = [
    { ids:["gruenkohl"], name:"Grünkohl", description:"Herzhafter Grünkohl nach Köcheclub-Art", price:5.50 },
    { ids:["gruenkohlmett"], name:"Grünkohl + Mettwurst", description:"Grünkohlgericht mit Mettwurst", price:7.00 },
    { ids:["sauerkraut"], name:"Sauerkrauteintopf", description:"Sauerkraut mit Kartoffeln, Speck und Kasseler", price:5.50 },
    { ids:["sauerkrautmett"], name:"Sauerkrauteintopf + Mettwurst", description:"Sauerkrauteintopf mit Mettwurst", price:7.00 },
    { ids:["mettwurst","mett"], name:"Mettwurst", description:"Herzhafte Mettwurst als Beilage", price:1.50 },
    { ids:["hering"], name:"Heringsstipp mit Kartoffeln", description:"Heringsstipp mit gekochten Kartoffeln", price:4.50 },
    { ids:["knirpsecreme"], name:"Kartoffel mit Kartoffelcreme", description:"Kartoffeln mit feiner Kartoffelcreme", price:3.50 }
  ];
  const tableRows = (items, first = "Artikel") => [[first, "Kurze Beschreibung", "Preis"], ...items.map(item => [item.name, item.description, `${item.price.toFixed(2).replace(".", ",")} €`])];

  function slides() {
    const list = [
      base(0, { type: "welcome", title: "Herzlich willkommen", text: "Der Köcheclub Werne begrüßt Sie auf dem Weihnachtsmarkt.", duration: 8, decorations: ["🎄", "⭐"], animation: "snow-light", ticker: "Schön, dass Sie da sind!" }),
      base(1, { type: "gallery", renderMode: "group-showcase", title: "Der Köcheclub stellt sich vor", text: "Gemeinschaft · Erfahrung · Freude am Kochen", duration: 10, media: { name: "Gruppenfoto Köcheclub · vorläufig", type: "image/jpeg", dataUrl: GROUP, provisional: true }, layout: { image: { x: 30, y: 52, w: 48, h: 68, scale: 1, rotation: 0, opacity: 1, z: 8 }, title: { x: 72, y: 38, w: 45, h: 18, scale: 1, rotation: 0, opacity: 1, z: 12 }, text: { x: 72, y: 59, w: 42, h: 20, scale: 1, rotation: 0, opacity: 1, z: 12 } } })
    ];
    MEMBER_QUOTES.forEach((quote, i) => list.push(member(i + 2, i + 1, quote)));
    list.push(
      base(20, { title: "Gemeinsam aktiv für Kochkunst und Gemeinschaft", text: "Regelmäßige Treffen · Fachlicher Austausch · Nachwuchsförderung\nAusflüge · Besichtigungen von Lebensmittelbetrieben\nSpenden und Aktionen für soziale Zwecke", duration: 14, decorations: ["👨‍🍳", "❤️"] }),
      base(21, { title: "Unsere laufenden Projekte", text: "Projekt 1 · Beschreibung ergänzen\nProjekt 2 · Beschreibung ergänzen\nProjekt 3 · Beschreibung ergänzen", duration: 12, decorations: ["❤️", "⭐"] }),
      base(22, { type: "weather", title: "Wetter heute und morgen", text: "Aktuelle Wetterdaten für Ihren Weihnachtsmarktbesuch", duration: 12, decorations: ["❄️"], layout: { title:{x:46,y:18,w:68,h:13,scale:1,rotation:0,opacity:1}, text:{x:50,y:31,w:72,h:9,scale:.8,rotation:0,opacity:1}, symbols:{x:90,y:9,w:12,h:8,scale:.75,rotation:0,opacity:1,color:"#ffffff",spacing:6,z:14}, weather:{x:50,y:63,w:88,h:50,scale:1,rotation:0,opacity:1} } }),
      base(23, { title: "Bühnenprogramm heute und morgen", text: "Heute\n00:00 Uhr · Programmpunkt ergänzen\n00:00 Uhr · Programmpunkt ergänzen\n\nMorgen\n00:00 Uhr · Programmpunkt ergänzen\n00:00 Uhr · Programmpunkt ergänzen", duration: 16, decorations: ["🎶", "⭐"] }),
      base(24, Object.assign({
        type: "price", renderMode: "catalog-price-table", contentKey: "prices-alcoholic",
        title: "Preisliste Getränke", text: "Alle Getränkepreise ohne Pfand · zzgl. 2,00 € Pfand je Glas / Feuerzange.",
        duration: 18, decorations: ["🍷"], layout: { title:{x:47,y:12,w:72,h:10,scale:1,rotation:0,opacity:1,z:12}, text:{x:50,y:91,w:88,h:7,scale:.72,rotation:0,opacity:1,z:19} }
      }, catalogTable(ALCOHOLIC_ITEMS, tableRows(ALCOHOLIC_ITEMS, "Getränk"), { key:"drinks-alcoholic", title:"Getränke", h:62 }))),
      base(25, Object.assign({
        type: "price", renderMode: "catalog-price-table", contentKey: "prices-non-alcoholic",
        title: "Preisliste alkoholfreie Getränke", text: "Alle Getränkepreise ohne Pfand · zzgl. 2,00 € Pfand je Glas.",
        duration: 15, decorations: ["☕"], layout: { title:{x:47,y:13,w:74,h:11,scale:.92,rotation:0,opacity:1,z:12}, text:{x:50,y:87,w:88,h:7,scale:.72,rotation:0,opacity:1,z:19} }
      }, catalogTable(NON_ALCOHOLIC_ITEMS, tableRows(NON_ALCOHOLIC_ITEMS, "Getränk"), { key:"drinks-non-alcoholic", title:"Alkoholfreie Getränke", h:42, y:49, fontSize:25 }))),
      base(26, Object.assign({
        type: "menu", renderMode: "catalog-price-table", contentKey: "prices-food",
        title: "Preisliste Speisen", text: "", duration: 20, decorations: ["👨‍🍳"],
        layout: { title:{x:47,y:11,w:72,h:10,scale:1,rotation:0,opacity:1,z:12} }
      }, catalogTable(FOOD_ITEMS, tableRows(FOOD_ITEMS, "Speise"), { key:"food", title:"Speisen", h:72, y:54, fontSize:19 }))),
      base(27, {
        type: "recipe", renderMode: "recipe-card", contentKey: "recipe-eggnog-punch",
        title: "Eierlikörpunsch à la Köcheclub",
        text: "Man nehme …\n\n1 Teil Eierlikör\n3 Teile Weißwein\netwas Vanillezucker\nSchlagsahne als Haube\netwas Kakaopulver zur Dekoration",
        duration: 20, decorations: ["☕", "✨"],
        layout: {
          title:{x:50,y:18,w:76,h:13,scale:1,rotation:0,opacity:1,z:12},
          text:{x:50,y:57,w:70,h:58,scale:.88,rotation:0,opacity:1,z:12},
          symbols:{x:90,y:10,w:14,h:9,scale:.8,rotation:0,opacity:1,color:"#ffd56a",spacing:8,z:14}
        }
      })
    );
    return list;
  }

  function create() {
    return {
      schema: "kcm-tv-package-v2", version: TV_VERSION,
      profile: { name: "Weihnachtsmarkt Werne 2026 · bearbeitbar", screenInch: 43, resolution: "1920x1080", viewingDistance: 4, loop: true, animationsEnabled: true },
      design: { animation: "snow-light", intensity: 1 },
      master: { enabled: true, name: "Weihnachtsmarkt Werne", footer: "Köcheclub Werne · Weihnachtsmarkt" },
      schedule: { enabled: false, week: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map(day => ({ day, enabled: true, start: "10:00", end: "22:00" })), special: [] },
      weather: { days: 2, location: "Werne", source: "online", refresh: 60, lastData: [] },
      slides: slides(), catalogSnapshot: [], backgroundAssets: {},
      source: { application: "KC MarktKasse Manager", integration: "editable Christmas market presentation", templateVersion: VERSION, memberContentVersion: VERSION, catalogContentVersion: VERSION, tvVersion: TV_VERSION, createdAt: "2026-07-24" }
    };
  }

  global.KC_WM_HAD_PRESENTATION = !!global.localStorage?.getItem?.("kcm_tv_presentation_v2");
  global.KC_WEIHNACHTSMARKT_PRESENTATION = Object.freeze({
    VERSION,
    TV_VERSION,
    BACKGROUNDS,
    MEMBER_QUOTES: MEMBER_QUOTES.slice(),
    MEMBER_PROFILES: MEMBER_PROFILES.map(profile => Object.assign({}, profile)),
    ALCOHOLIC_ITEMS: ALCOHOLIC_ITEMS.map(item => Object.assign({}, item)),
    NON_ALCOHOLIC_ITEMS: NON_ALCOHOLIC_ITEMS.map(item => Object.assign({}, item)),
    FOOD_ITEMS: FOOD_ITEMS.map(item => Object.assign({}, item)),
    create
  });
})(window);
