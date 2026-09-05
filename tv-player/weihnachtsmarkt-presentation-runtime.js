(function (global) {
  "use strict";
  const CONTENT = global.KC_WEIHNACHTSMARKT_PRESENTATION, screen = document.getElementById("screen");
  if (!CONTENT || !screen) return;
  function isChristmas(slide) { return slide?.presentationKind === "weihnachtsmarkt-2026"; }
  function backgroundValue(slide) {
    const item = CONTENT.BACKGROUNDS[slide.backgroundPreset] || CONTENT.BACKGROUNDS["market-photo"];
    if (item.kind === "custom") { const custom = slide.backgroundDataUrl || (typeof data !== "undefined" ? data.backgroundAssets?.custom : ""); return custom ? `url("${String(custom).replace(/"/g, "")}")` : `url("${CONTENT.BACKGROUNDS["market-photo"].value}")`; }
    return item.kind === "image" ? `url("${item.value}")` : item.value;
  }
  function layout(node, state) {
    if (!node || !state) return;
    Object.assign(node.style, { position:"absolute", left:`${state.x}%`, top:`${state.y}%`, width:`${state.w}%`, height:`${state.h}%`, transform:`translate(-50%,-50%) scale(${state.scale || 1}) rotate(${state.rotation || 0}deg)`, opacity:String(state.opacity ?? 1), zIndex:String(state.z || 10), boxSizing:"border-box" });
  }
  function decorate() {
    const slide = global.currentTvSlideData;
    if (!isChristmas(slide)) return;
    const signature = `${slide.id}|${slide.backgroundPreset}|${slide.backgroundDataUrl?.length || 0}|${slide.media?.dataUrl || ""}`;
    if (screen.dataset.wmSignature === signature && screen.querySelector(":scope>.kc-wm-background")) return;
    screen.dataset.wmSignature = signature;
    screen.classList.add("kc-wm-stage", `kc-wm-${slide.renderMode || "editable"}`); screen.classList.toggle("kc-wm-light", slide.backgroundPreset === "cream");
    const bg = document.createElement("div"); bg.className = "kc-wm-background"; bg.style.background = backgroundValue(slide); bg.style.opacity = String(slide.backgroundOpacity ?? 1); screen.prepend(bg);
    const body = screen.querySelector(":scope>div:not(.tv-effect):not(.ticker):not(.kc-wm-background):not(.dc-overlay)");
    const title = body?.querySelector("h1"), text = body?.querySelector("p"), price = body?.querySelector(".price");
    if (title) title.dataset.wmObject = "title"; if (text) text.dataset.wmObject = "text"; if (price) price.dataset.wmObject = "price";
    layout(title, slide.layout?.title); layout(text, slide.layout?.text); layout(price, slide.layout?.price);
    if (slide.media?.dataUrl && ["member-showcase", "group-showcase"].includes(slide.renderMode)) {
      const frame = document.createElement("div"); frame.className = `kc-wm-photo-object ${slide.renderMode === "group-showcase" ? "kc-wm-group-photo" : "kc-wm-member-photo"}`;
      const image = document.createElement("img"); image.src = slide.media.dataUrl; image.alt = slide.media.name || slide.title || "Foto"; frame.appendChild(image); screen.appendChild(frame); layout(frame, slide.layout?.image);
    }
    if ((slide.decorations || []).length) {
      const objects = slide.decorationObjects?.length ? slide.decorationObjects : slide.decorations.slice(0, 5).map((symbol, index) => ({ symbol, x:76 + index * 7, y:16, scale:1 }));
      objects.forEach((item, index) => {
        const symbol = document.createElement("div");
        symbol.className = "kc-wm-symbols kc-tv-symbol-object";
        symbol.dataset.symbolIndex = String(index);
        symbol.dataset.symbolKind = item.symbol === "🕯️" ? "candle" : item.symbol === "🏮" ? "lantern" : "standard";
        symbol.textContent = item.symbol;
        screen.appendChild(symbol);
        layout(symbol, { x:item.x, y:item.y, w:item.w || 8, h:item.h || 10, scale:item.scale || 1, rotation:item.rotation || 0, opacity:item.opacity ?? 1, z:item.z || 34 });
      });
    }
    layout(screen.querySelector(":scope>.ticker"), slide.layout?.ticker);
  }
  new MutationObserver(() => queueMicrotask(decorate)).observe(screen, { childList:true });
  const control = document.getElementById("control");
  if (control && !document.getElementById("loadChristmasPresentation")) {
    const button = document.createElement("button"); button.id = "loadChristmasPresentation"; button.type = "button"; button.textContent = "Weihnachtsmarkt · 18 Mitglieder";
    button.onclick = () => { data = CONTENT.create(); localStorage.setItem("kc_tv_player_package", JSON.stringify(data)); i = 0; const state = document.getElementById("state"); if (state) state.textContent = "Paket übernommen: Weihnachtsmarkt Werne 2026"; show(); };
    control.insertBefore(button, document.getElementById("fullscreen"));
  }
  queueMicrotask(decorate);
})(window);
