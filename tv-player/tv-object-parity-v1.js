/* KC TV-Player – Objekt-Parität V1
   Gleicht den eigenständigen Stick-Player an das an, was der Manager im
   Erstellungsmonitor zeigt: Deko-Symbole, Objekt-Rahmen/Sichtbarkeit
   ("Rahmen und Fläche"), Wetterkarten und LED-/LCD-Laufschrift (DisplayMatrix).
   Greift nach jedem show()-Aufruf zusätzlich ein, ohne app.js selbst
   umzubauen. */
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const fonts = {system:'system-ui,Arial,sans-serif',humanist:'Trebuchet MS,Arial,sans-serif',rounded:'Arial Rounded MT Bold,Arial,sans-serif',serif:'Georgia,serif',mono:'Consolas,monospace',monospace:'Consolas,monospace'};
  function place(node,p){if(!node||!p)return;node.style.position='absolute';node.style.left=`${p.x}%`;node.style.top=`${p.y}%`;node.style.width=`${p.w}%`;node.style.height=`${p.h}%`;node.style.transform=`translate(-50%,-50%) scale(${p.scale||1}) rotate(${p.rotation||0}deg)`;node.style.opacity=p.opacity??1;node.style.zIndex=p.z||10}
  function applyStageContract(screen,slide){
    screen.style.setProperty('container-type','inline-size');
    const typography=slide.design?.typography||slide.presentationDesign?.typography||{};
    [['title',4.2],['text',4],['price',6.2]].forEach(([key,base])=>{const node=screen.querySelector(`[data-tv-object="${key}"]`);place(node,slide.layout?.[key]);if(node){node.style.setProperty('font-size',`calc(${base}cqw * ${+(typography[`${key}Size`]||1)})`,'important');node.style.fontFamily=fonts[typography[`${key}FontFamily`]||typography.fontFamily]||fonts.system}});
    screen.querySelectorAll('[data-kc-custom-text]').forEach(node=>node.remove());
    (slide.customTextObjects||[]).forEach((item,index)=>{if(!item||item.hidden)return;const node=document.createElement('div'),t=item.typography||{};node.dataset.kcCustomText='true';node.dataset.tvObject=`customText:${item.id}`;node.textContent=item.text||'';node.style.display='flex';node.style.alignItems='center';node.style.justifyContent=t.align==='left'?'flex-start':t.align==='right'?'flex-end':'center';node.style.whiteSpace='pre-wrap';node.style.overflow='hidden';node.style.boxSizing='border-box';node.style.fontFamily=fonts[t.fontFamily]||fonts.system;node.style.setProperty('font-size',`calc(4cqw * ${+(t.size||1)})`,'important');node.style.color=t.color||'#fff';node.style.fontWeight=t.bold?'800':'400';node.style.fontStyle=t.italic?'italic':'normal';node.style.textDecoration=t.underline?'underline':'none';node.style.textAlign=t.align||'center';node.style.lineHeight=String(t.lineHeight||1.15);place(node,item.layout||{x:50,y:50,w:35,h:14,z:20+index});screen.append(node)});
  }

  function renderWeatherCards(days) {
    if (!days || !days.length) return '';
    return `<div class="tv-weather-cards in-slide">${days.map(d => `<div><strong>${esc(d.label)}</strong><b>${esc(d.icon)}</b><span>${esc(d.min)}° / ${esc(d.max)}°</span><small>${esc(d.summary)}</small></div>`).join('')}</div>`;
  }

  function ensureDecor(screen, slide) {
    if (slide.presentationKind === 'weihnachtsmarkt-2026') return; // eigene Positionierung, siehe weihnachtsmarkt-presentation-runtime.js
    if (!slide.decorations || !slide.decorations.length) return;
    if (screen.querySelector('[data-tv-object="symbols"]')) return;
    const node = document.createElement('div');
    node.className = 'tv-decor';
    node.dataset.tvObject = 'symbols';
    node.textContent = slide.decorations.slice(0, 4).join(' ');
    screen.appendChild(node);
  }

  function ensureWeather(screen, slide, packageData) {
    if (slide.type !== 'weather') return;
    if (screen.querySelector('[data-tv-object="weather"]')) return;
    const days = packageData?.weather?.lastData || [];
    if (!days.length) return;
    const node = document.createElement('div');
    node.dataset.tvObject = 'weather';
    node.innerHTML = renderWeatherCards(days);
    (screen.querySelector('div') || screen).appendChild(node);
  }

  function tagBaseObjects(screen) {
    const h1 = screen.querySelector('h1'); if (h1) h1.dataset.tvObject = 'title';
    const p = screen.querySelector('p'); if (p) p.dataset.tvObject = 'text';
    const price = screen.querySelector('.price'); if (price) price.dataset.tvObject = 'price';
    const ticker = screen.querySelector('.ticker'); if (ticker) ticker.dataset.tvObject = 'ticker';
  }

  function ensureMedia(screen, slide) {
    if (slide.presentationKind === 'weihnachtsmarkt-2026' && ['member-showcase', 'group-showcase'].includes(slide.renderMode)) return; // eigene Darstellung, siehe weihnachtsmarkt-presentation-runtime.js
    if (!slide.media?.dataUrl) return;
    const content = screen.querySelector('h1')?.parentElement || screen.querySelector('div') || screen;
    if (content.querySelector('.tv-slide-media')) return;
    const isVideo = String(slide.media.type || '').startsWith('video');
    const node = document.createElement(isVideo ? 'video' : 'img');
    node.className = 'tv-slide-media';
    node.src = slide.media.dataUrl;
    if (isVideo) { node.autoplay = true; node.muted = true; node.loop = true; }
    content.prepend(node);
  }

  function resolveTickerText(slide, packageData) {
    const cfg = slide.tickerSource || { mode: 'manual' };
    const weatherText = () => (packageData?.weather?.lastData || []).map(x => `${x.label}: ${x.min}°/${x.max}° ${x.summary || ''}`).join(' · ');
    const programText = () => (packageData?.eventProgramSnapshot || []).map(x => `${x.time || ''} ${x.title || ''}`.trim()).join(' · ');
    if (cfg.mode === 'weather') return weatherText();
    if (cfg.mode === 'program') return programText();
    if (cfg.mode === 'combined') return [weatherText(), programText()].filter(Boolean).join(' · ');
    return slide.ticker || '';
  }

  function applyDynamicTicker(screen, slide, packageData) {
    if (slide.objectVisibility?.ticker === false) return '';
    const text = resolveTickerText(slide, packageData);
    let ticker = screen.querySelector('[data-tv-object="ticker"]');
    if (!ticker) {
      if (!text && !slide.displayMatrix?.enabled) return text;
      ticker = document.createElement('div');
      ticker.className = 'ticker';
      ticker.dataset.tvObject = 'ticker';
      ticker.appendChild(document.createElement('span'));
      screen.appendChild(ticker);
    }
    const span = ticker.querySelector('span') || ticker;
    span.textContent = text;
    ticker.classList.toggle('kc-empty-object', !text);
    return text;
  }

  function applyObjectStyles(screen, slide) {
    const rgba = (hex, opacity) => {
      const match = String(hex || '').match(/^#([0-9a-f]{6})$/i);
      if (!match) return 'transparent';
      const value = parseInt(match[1], 16);
      return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${opacity ?? 1})`;
    };
    const visibility = slide.objectVisibility || {};
    Object.entries(visibility).forEach(([key, visible]) => {
      if (visible === false) screen.querySelector(`[data-tv-object="${CSS.escape(key)}"]`)?.remove();
    });
    Object.entries(slide.objectStyles || {}).forEach(([key, style]) => {
      const node = screen.querySelector(`[data-tv-object="${CSS.escape(key)}"]`);
      if (!node) return;
      node.style.setProperty('border', style.frame ? `${style.width || 2}px ${style.line || 'solid'} ${style.color || '#ffffff'}` : 'none', 'important');
      node.style.setProperty('border-radius', `${style.radius || 0}px`, 'important');
      node.style.setProperty('padding', `${style.padding || 0}px`, 'important');
      const mode = style.surfaceMode || 'transparent';
      const background = mode === 'solid'
        ? rgba(style.surfaceColor || '#173765', style.surfaceOpacity ?? 1)
        : mode === 'glass'
          ? rgba(style.surfaceColor || '#ffffff', style.surfaceOpacity ?? .22)
          : style.background || 'transparent';
      node.style.setProperty('background', background, 'important');
      node.style.setProperty('backdrop-filter', mode === 'glass' ? `blur(${style.surfaceBlur ?? 8}px)` : 'none', 'important');
      node.style.setProperty('-webkit-backdrop-filter', mode === 'glass' ? `blur(${style.surfaceBlur ?? 8}px)` : 'none', 'important');
    });
  }

  /* --- DisplayMatrix (LED/LCD-Laufschrift), identische Konfiguration wie im Manager --- */
  function configureMatrix(element, config, text) {
    if (config.preset) element.applyPreset?.(config.preset);
    element.setDisplayMode?.(config.displayMode || 'ticker');
    element.setDirection?.(config.direction || 'left');
    element.setMotionEffect?.(config.effect || 'softScroll');
    element.setSpeed?.(+config.speed || 48);
    const engine = element.engine;
    engine?.setSurface?.(config.surface || 'led');
    engine?.setRenderer?.(config.renderer || 'auto');
    engine?.setPalette?.(config.palette || 'kioskRed');
    engine?.setFont?.({ profile: config.fontProfile || '5x7' });
    engine?.setBrightness?.(+config.brightness || 1);
    engine?.setGlow?.(+config.glow || .8);
    engine?.setContrast?.(+config.contrast || 1.2);
    engine?.setPixelSize?.(+config.pixelSize || 7);
    engine?.setMatrixSize?.(+config.columns || 96, +config.rows || 9);
    element.setText?.((config.symbol ? `{symbol:${config.symbol}} ` : '') + text);
  }

  function applyMatrix(ticker, slide, text) {
    if (!ticker || !slide.displayMatrix?.enabled) return;
    const config = slide.displayMatrix;
    let element = ticker.querySelector('display-matrix-module');
    if (!element) { ticker.textContent = ''; element = document.createElement('display-matrix-module'); ticker.appendChild(element); }
    const resolved = text || slide.title || '';
    const signature = JSON.stringify([config, resolved]);
    if (element.dataset.matrixSignature !== signature) { configureMatrix(element, config, resolved); element.dataset.matrixSignature = signature; }
    ticker.classList.add('kc-tv-display-matrix');
  }

  function enhance() {
    const screen = document.getElementById('screen');
    const slide = window.currentTvSlideData;
    if (!screen || !slide) return;
    ensureDecor(screen, slide);
    ensureMedia(screen, slide);
    tagBaseObjects(screen);
    const tickerText = applyDynamicTicker(screen, slide, window.currentTvPackageData);
    applyStageContract(screen, slide);
    const tickerNode=screen.querySelector('[data-tv-object="ticker"]'),tickerSpan=tickerNode?.querySelector('span')||tickerNode;
    place(tickerNode,slide.layout?.ticker);
    if(tickerSpan)tickerSpan.style.setProperty('font-size',`calc(4cqw * ${+(slide.tickerDesign?.fontSize||1)})`,'important');
    ensureWeather(screen, slide, window.currentTvPackageData);
    applyObjectStyles(screen, slide);
    const ticker = screen.querySelector('[data-tv-object="ticker"]');
    if (ticker) applyMatrix(ticker, slide, tickerText);
  }

  const oldShow = window.show;
  if (typeof oldShow === 'function') {
    window.show = function () {
      oldShow.apply(this, arguments);
      enhance();
    };
  }
  // app.js kann beim Seitenstart (gespeichertes Paket in localStorage) bereits
  // vor dem Laden dieser Datei eine erste Folie gerendert haben - die wäre sonst
  // bis zum nächsten automatischen Folienwechsel ohne Medien/Wetter/Rahmen/Matrix.
  if (window.currentTvSlideData) enhance();
})();
