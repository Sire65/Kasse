(function (global) {
  'use strict';
  function registerRuntime() {
    const release = global.KCReleaseManifest; if (!release) return null;
    const components = {
      manager:global.KCManagerAppVersion, tvPresentation:global.KCTVPresentationVersion,
      unifiedEditor:global.KCUnifiedEditor?.version, editorWorkflow:global.KCTVEditorWorkflow?.version,
      displayMatrix:global.FrameworkDisplayMatrixModule?.version, displayMatrixAdapter:global.KCTVDisplayMatrixAdapter?.version,
      tvRepair60Consolidation:global.KCTVRepair60Consolidation?.version,
      mobileJobActivationFix:global.KCMobileJobActivationFix?.version,
      editorShell:global.KCTVEditorShell?.version, selectionCore:global.KCSelectionCore?.version,
      propertyCore:global.KCPropertyCore?.version, smartLayoutCore:global.KCSmartLayoutCore?.version,
      autoContrast:global.KCAutoContrast?.version, presentationTuv:global.KCPresentationTUV?.VERSION,
      runtimeStability:global.KCRuntimeStability?.version, professionalGuard:global.KCPresentationProfessional?.VERSION,
      posUIProfileCore:global.KCPOSUIProfileCore?.version, posUIProfileManager:global.KCPOSUIProfileManager?.version,
      tvSlideNumbers:global.KCTVSlideNumbers?.version, tvObjectLibrary:global.KCTVObjectLibrary?.version,
      tvDrawTextbox:global.KCTVDrawTextbox?.version, tvDrawTicker:global.KCTVDrawTicker?.version,
      tvCustomTextEditor:global.KCTVCustomTextEditor?.version, posCatalogRegistry:global.KCPOSCatalogRegistry?.version,
      managerSelectHealth:global.KCManagerSelectHealth?.version, managerMasterdataHealth:global.KCManagerMasterdataHealth?.version,
      tvSharedRenderer:global.KCTVSharedRenderer?.version, eventProgramExchange:global.KCEventProgramExchangeCore?.version,
      eventProgramStudioCatalog:global.KCEventProgramExchangeCore?'1.0.0':null, eventProgramTuvRules:global.KCEventProgramExchangeCore?'1.0.0':null,
      tvManagerStability:global.KCTVManagerStability?.version, tvTextInputPerformance:global.KCTVTextInputPerformance?.version,
      tvObjectContextMenu:global.KCTVObjectContextMenu?.version, contextInspectorCore:global.KCContextInspectorCore?.version, kcObjectStudio:global.KCObjectStudio?.version,
      tvContentObjectCore:global.KCTVContentObjectCore?.version,
      werneProgramArchive:global.KCWerneProgramArchive?.version, programImportCore:global.KCProgramImportCore?.version,
      navigationCore:global.NavigationCore?.version, managerNavigationAdapter:global.KCManagerNavigationAdapter?.version,
      managerNavigationExtras:global.KCManagerNavigationExtras?.version,
      christmasPresentationTemplate:global.KC_WEIHNACHTSMARKT_PRESENTATION?.VERSION,
      timeClockCore:global.KCTimeClockCore?.version,
      timeClockManager:global.KCTimeClockManager?.version,
      timeClockDutyRosterAdapter:global.KCTimeClockDutyRosterAdapter?.version,
      recipeCalculationCore:global.KCRecipeCalculationCore?.VERSION,
      recipeManager:global.KCRecipeManager?.version,
      recipeStudioCatalog:global.KCRecipeCalculationCore?'1.0.0':null,
      recipeTuvRules:global.KCRecipeCalculationCore?'1.0.0':null,
      tableCore:global.TableCore?.version,
      managerTableCore:global.KCManagerTableCore?.version,
      tvEditorRuntimeRepair:global.KCTVEditorRuntimeRepair?.version,
      managerMessageCore:global.KCManagerMessages?.version,
      tvRenderConsolidation:global.KCTVRenderConsolidation?.version,
      salesInventoryAnalysisCore:global.KCSalesInventoryAnalysisCore?.VERSION,
      managerSalesInventoryDashboard:global.KCManagerSalesInventoryDashboard?.version,
      salesImportCore:global.KCSalesImportCore?.VERSION,
      managerImportProgress:global.KCManagerImportProgress?.VERSION
    };
    Object.entries(components).forEach(([id,version])=>release.register(id,version));
    return release.validate();
  }
  function render() {
    const report=registerRuntime(),manifest=global.KCReleaseManifest?.state?.manifest,line=document.getElementById('managerVersionLine');if(!line||!report)return;
    // BEFUND vor der Mitglieder-Präsentation: in dieser Zeile stand ganz oben auf JEDER
    // Manager-Seite das Wort "BLOCKED" bzw. "PASS" - Entwicklersprache aus der internen
    // Prüfung, gut sichtbar für jeden im Raum. Der technische Zustand bleibt erhalten
    // (Datenfeld und Sprechblase, für die Entwicklung), die sichtbare Zeile spricht jetzt
    // Deutsch und schreit nicht.
    if(!manifest){line.textContent='Versionsangabe wird geladen …';line.dataset.releaseStatus='BLOCKED';
      line.title='Das zentrale Release-Manifest ist nicht verfügbar. Für den Betrieb unerheblich, für die Entwicklung ein Hinweis.';return}
    // Sichtbar bleibt nur, was auch einem Gast etwas sagt: die Versionsnummer. Der interne
    // Entwicklungsname (z. B. "Symbol- und Aktivierungscode-Parität Candidate") und der
    // Prüfstatus stehen weiterhin in der Sprechblase - fuer die Entwicklung vollständig,
    // fuer den Raum unaufdringlich.
    const inOrdnung=report.status==='PASS';
    const kurz=String(manifest.displayVersion||'').split('·')[0].trim()||manifest.displayVersion;
    line.textContent=`KC MarktKasse · ${kurz}`+(inOrdnung?'':' · Prüfhinweise');
    line.dataset.releaseStatus=report.status;
    line.dataset.releaseVoll=`${manifest.displayVersion} · ${manifest.priority?.label||'TV-Präsentation'} · ${report.status}`;
    line.title=(line.dataset.releaseVoll||'')+'\n\n'+(report.issues.length?report.issues.map(x=>`${x.code}: ${x.detail}`).join('\n'):'Zentrales Release-Manifest und geladene Manager-Komponenten stimmen überein.');
    /* Auch der Fenstertitel stand voller Entwicklersprache ("… Repair 63 · Symbol- und
    Aktivierungscode-Parität Candidate") - und der steht auf der Leinwand in der
    Browserleiste und unten in der Taskleiste, die ganze Vorführung lang. */
    document.title=`KC MarktKasse · PC-Manager · ${kurz}`;global.KCPresentationTUVRun?.();
  }
  global.addEventListener('kc-release-manifest-ready',render);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();setTimeout(render,900)});else{render();setTimeout(render,900)}
  global.KCManagerReleaseGate={refresh:render,report:registerRuntime};
})(window);
