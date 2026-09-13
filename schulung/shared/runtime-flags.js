/* Zentraler Umschalter für Hinweise, die nur während der Erprobung sichtbar sein dürfen. */
window.KC_RUNTIME_FLAGS=Object.freeze({
  testPhaseToolGuidance:true,
  candidateTestAccess:true,
  /* Uebergabeprotokoll fuer die Geldkassette (Bringen/Abholen, zwei Unterschriftszeilen,
     QR-Code mit dem vollstaendigen Belegdaten). EINGESCHALTET - zum Abschalten auf false. */
  uebergabeProtokoll:true
});
