// KC MarktKasse – Fehlerhilfe (KS-02 „Eindeutige Fehlermeldung mit Lösung“)
//
// Jede Meldung im schwarzen Fenster und im PC-Manager besteht aus drei Teilen:
//   WAS     – ein Satz, was nicht geht
//   URSACHE – warum, in Alltagssprache
//   LÖSUNG  – nummerierte Schritte, die ein Mitglied am Stand selbst ausführen kann
// Rohe Fehlercodes (EADDRINUSE, SQLITE_BUSY …) stehen nur noch klein als „Technik“ dabei –
// für den Betreuer, nicht als einzige Auskunft.
'use strict';

const SCHRITTE_FENSTER_NEU = [
  'Alle schwarzen Fenster schließen.',
  'Task-Manager öffnen (Strg + Umschalt + Esc) → „Details“ → alle „node.exe“ markieren → „Task beenden“.',
  'Dann EIN Fenster neu starten: KC_Manager_Start.cmd doppelklicken.',
  'Hilft das nicht: PC neu starten und nur KC_Manager_Start.cmd starten.',
];
const SCHRITT_BETREUER = 'Bleibt der Fehler: Foto von diesem Fenster machen und an den Betreuer schicken.';

function meldung(schluessel, titel, ursache, loesung, technisch = null) {
  return { schluessel, titel, ursache, loesung: Array.isArray(loesung) ? loesung : [loesung], technisch: technisch || null };
}

function nachricht(err) { return String(err && (err.message || err) || ''); }

// Übersetzt einen Fehler in eine Meldung. kontext: { was, port, pfad, kasse }
function erklaere(err, kontext = {}) {
  const text = nachricht(err);
  const code = err && err.code ? String(err.code) : '';
  const technisch = [code, text].filter(Boolean).join(' · ').slice(0, 300);
  const wer = kontext.kasse ? `${kontext.kasse}: ` : '';
  const was = kontext.was || 'Start';

  if (err && err.kcMeldung) return err.kcMeldung;

  if (code === 'EADDRINUSE' || /port_in_use|ist bereits belegt|EADDRINUSE/i.test(text)) {
    const port = kontext.port || (text.match(/Port (\d+)/i) || text.match(/:(\d{4,5})\b/) || [])[1] || '?';
    const von = err && err.belegtVon;
    if (von && von.grund === 'fremd') {
      return meldung(`port-${port}`, `${wer}Port ${port} ist belegt von „${von.programm}“ (Prozess ${von.pid}) – ${was} nicht möglich`,
        `„${von.programm}“ gehört nicht zum Kassensystem. Fremde Programme werden bewusst NICHT automatisch beendet – es könnte etwas Wichtiges sein.`,
        [`„${von.programm}“ beenden: Task-Manager (Strg + Umschalt + Esc) → „Details“ → „${von.programm}“ (PID ${von.pid}) → „Task beenden“.`,
          'Dann das schwarze Fenster schließen und neu starten.',
          `Wird „${von.programm}“ am Stand gebraucht: Betreuer anrufen – dann muss der Port des Kassensystems geändert werden.`], technisch);
    }
    if (von && von.grund === 'laesst_sich_nicht_beenden') {
      return meldung(`port-${port}`, `${wer}Port ${port}: altes Kassenfenster (Prozess ${von.pid}) lässt sich nicht beenden – ${was} nicht möglich`,
        'Ein älteres schwarzes Fenster belegt den Port und reagiert nicht auf das Beenden.',
        ['Task-Manager (Strg + Umschalt + Esc) → „Details“ → alle „node.exe“ markieren → „Task beenden“.', 'Dann EIN Fenster neu starten: KC_Manager_Start.cmd doppelklicken.', 'Hilft das nicht: PC neu starten.'], technisch);
    }
    return meldung(`port-${port}`, `${wer}Port ${port} ist belegt – ${was} nicht möglich`,
      'Ein anderes Programm benutzt diesen Anschluss. Fast immer ist es ein noch offenes zweites schwarzes Fenster oder die alte Kassenversion.',
      SCHRITTE_FENSTER_NEU, technisch);
  }
  if (code === 'EACCES' || code === 'EPERM' || /EACCES|EPERM|permission denied/i.test(text)) {
    return meldung('rechte', `${wer}Keine Schreibberechtigung – ${was} nicht möglich`,
      `Windows lässt das Programm nicht in ${kontext.pfad || 'seinen Ordner'} schreiben (z. B. Ordner unter „Programme“, schreibgeschützter USB-Stick oder Sperre durch den Virenscanner).`,
      ['Den KC-Ordner nach „Dokumente“ oder auf den Desktop entpacken und von dort starten.',
        'Meldet der Virenscanner etwas: „node.exe“ zulassen.', SCHRITT_BETREUER], technisch);
  }
  if (code === 'ENOSPC' || /ENOSPC|no space left/i.test(text)) {
    return meldung('voll', 'Festplatte ist voll', 'Auf dem PC ist kein Platz mehr frei – Buchungen können nicht gespeichert werden.',
      ['Papierkorb leeren und große, nicht benötigte Dateien (z. B. Videos, alte Downloads) löschen.', 'Dann das Fenster neu starten.', SCHRITT_BETREUER], technisch);
  }
  if (code === 'ENOTDIR' || code === 'EEXIST' || /ENOTDIR|EEXIST/.test(text)) {
    return meldung('ordner', `${wer}Ordner kann nicht angelegt werden`,
      `An der Stelle ${kontext.pfad || ''} liegt eine Datei statt eines Ordners.`,
      ['NICHTS löschen.', SCHRITT_BETREUER], technisch);
  }
  if (/database is locked|SQLITE_BUSY/i.test(text)) {
    return meldung('db-gesperrt', `${wer}Datenbank ist gerade von einem anderen Programm geöffnet`,
      'Meist läuft das schwarze Fenster ein zweites Mal.', SCHRITTE_FENSTER_NEU, technisch);
  }
  if (/malformed|not a database|SQLITE_CORRUPT|SQLITE_NOTADB/i.test(text)) {
    return meldung('db-kaputt', `${wer}Datenbank ist beschädigt`,
      'Die Datei wurde vermutlich beim Ausschalten mitten im Schreiben unterbrochen oder beim Kopieren beschädigt.',
      ['NICHTS löschen – die Buchungen sollen erhalten bleiben.', 'PC neu starten und das Fenster noch einmal starten.', SCHRITT_BETREUER], technisch);
  }
  if (/Schlüsseldatei konnte nicht nachweislich geschützt/i.test(text)) {
    return meldung('schluessel-schutz', 'Schlüsseldatei des Managers kann nicht geschützt werden',
      'Windows erlaubt dem Programm nicht, die Rechte seiner Schlüsseldatei einzuschränken – aus Sicherheitsgründen startet der Manager dann nicht.',
      ['Den KC-Ordner in den eigenen Benutzerordner („Dokumente“) entpacken, nicht auf USB-Stick oder Netzlaufwerk.', 'Dann neu starten.', SCHRITT_BETREUER], technisch);
  }
  if (/manager_identity_mismatch|pairing_token_invalid|rate_limited|expectedFingerprint_required|credential_invalid/i.test(text)) {
    return meldung(`kopplung-${kontext.kasse || ''}`, `${wer}Kopplung mit dem Manager ist fehlgeschlagen`,
      'Die Kasse und der Manager-Dienst konnten sich nicht gegenseitig ausweisen. Die anderen Kassen arbeiten weiter.',
      ['Fenster schließen und neu starten – beim Start wird die Kopplung neu versucht.', SCHRITT_BETREUER], technisch);
  }
  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|socket hang up|antwortet nach 20 s nicht|antwortet nicht/i.test(text)) {
    return meldung(`antwort-${kontext.kasse || was}`, `${wer}${was}: Dienst antwortet nicht`,
      'Der Dienst ist nicht rechtzeitig hochgekommen – meist ist der PC gerade sehr ausgelastet oder der Virenscanner prüft „node.exe“.',
      ['Eine Minute warten, dann das Fenster schließen und neu starten.', 'Meldet der Virenscanner etwas: „node.exe“ zulassen.', SCHRITT_BETREUER], technisch);
  }
  return meldung(`unbekannt-${was}`, `${wer}${was}: unerwarteter Fehler`,
    `Das Programm meldet: ${text || 'keine Angabe'}`,
    ['Foto von diesem Fenster machen.', 'Fenster schließen und neu starten.', SCHRITT_BETREUER], technisch);
}

function alsEinzeiler(m) {
  return `${m.titel}: ${m.ursache} Lösung: ${m.loesung.map((s, i) => `${i + 1}) ${s}`).join(' ')}`;
}

function alsKasten(m, art = 'FEHLER') {
  const zeilen = [];
  zeilen.push(`!! ${art}: ${m.titel}`);
  zeilen.push(`!!   Ursache: ${m.ursache}`);
  m.loesung.forEach((s, i) => zeilen.push(`!!   ${i === 0 ? 'Lösung: ' : '        '}${i + 1}) ${s}`));
  if (m.technisch) zeilen.push(`!!   (Technik für den Betreuer: ${m.technisch})`);
  return zeilen.join('\n');
}

function druckeKasten(log, meldungen, art = 'ACHTUNG') {
  if (!meldungen.length) return;
  log('');
  log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!! ${art} !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
  meldungen.forEach((m, i) => { if (i) log('!!'); log(alsKasten(m, art === 'ACHTUNG' ? 'PROBLEM' : 'FEHLER')); });
  log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  log('');
}

module.exports = { meldung, erklaere, alsEinzeiler, alsKasten, druckeKasten, SCHRITTE_FENSTER_NEU, SCHRITT_BETREUER };
