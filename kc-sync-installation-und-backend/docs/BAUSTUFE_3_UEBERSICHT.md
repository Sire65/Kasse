# Baustufe 3 – Betriebsfestigkeit

**Status:** konsolidierte Entwicklungsstufe, EIN Abnahmelauf steht noch aus. Weiterhin keine
Aussage „sicher“, „TÜV-geprüft“ oder „produktionsreif“, kein Feldversuch, kein Produktivnetz.

## Was neu ist (gegenüber Sicherheits-Gate A)

### 1. Last- und Dauertests
- Lasttest: 8 Kassen parallel, je 150 Ereignisse, ein gemeinsamer Sync-Lauf - alle korrekt
  angekommen, wiederholtes Senden erzeugt keine Duplikate.
- Speichergrenzen: `pruneOperationalData()` (Manager) / `pruneAcked()` (Kasse) entfernen alte
  Diagnose-/bereits-bestätigte Daten nach konfigurierbarer Frist. **Umsatzdaten
  (`received_events`) werden dabei NIE gelöscht** - eigens getestet.
- Mehrtägiger Dauerbetrieb und echte Festplattengrenzen (volle Platte) sind mit den Mitteln
  dieser Sandbox nicht simulierbar - bleibt ein ehrlich benannter, noch offener Testfall für
  eine echte Umgebung.

### 2. Ausfall und Wiederherstellung
- Manager-Neustart mitten in einer laufenden Übertragung: getestet, kein Ereignisverlust, keine
  Doppelverbuchung.
- Beschädigte Datenbankdatei: wird beim Start klar erkannt (`PRAGMA integrity_check` via
  Restore-Prüfung), kein unklares Scheitern.
- Backup/Restore: `backup.js` sichert die Datenbank (mit WAL-Checkpoint für Konsistenz) UND die
  zugehörige Schlüssel-/Admin-Token-Datei als eine Einheit - **ein eigener Test deckte auf, dass
  ein Backup ohne die Schlüsseldatei wegen des D-04-fail-closed-Schutzes nie wieder startbar
  gewesen wäre**, das wurde vor der Auslieferung korrigiert, nicht danach gemeldet bekommen.
- Netzwerkunterbrechung, Kassenabsturz: bereits aus Baustufe 2.x abgedeckt (SQLite-Transaktionen,
  idempotente Zustellung), hier nicht erneut dupliziert.

### 3. Betriebsfunktionen
- Dead-Letter-Bearbeitung: `POST /api/v1/admin/dead-letter/action` (Admin-geschützt) für
  `retry`/`discard` mit Begründung, im Auditprotokoll nachvollziehbar.
- Ampel (`connectionStatus()`): Grün (online, synchronisiert), Rot (Offlinebetrieb), Gelb
  (Problem/Rückstau > 20 offene Ereignisse ODER Dead-Letter-Ereignisse vorhanden). Zeitstempel
  werden persistiert, zeigen also auch direkt nach einem Kassen-Neustart den echten Zustand.
- Aktivitäts-LED (`activityStatus()`): getrennte Anzeige für lokale Speicherung/Netzwerkverkehr.
- **Wichtig:** dies ist die Datengrundlage für die Ampel, keine fertige Bedienoberfläche - die
  tatsächliche Anzeige in Kassen-/Manager-Oberfläche ist laut eurem Fahrplan Baustufe 4.

### 4. Zertifikate und Nachvollziehbarkeit
- Zertifikatserneuerung ohne neue Kopplung: nutzt denselben Schlüssel weiter (SPKI-Fingerprint
  bleibt nachweislich identisch), wird sofort auf den laufenden Server übernommen (kein
  Neustart, keine Downtime für verbundene Kassen).
- Manipulationsgeschützteres Auditprotokoll: Hash-Kette über alle Einträge,
  `verifyAuditChain()` erkennt jede nachträgliche Änderung.
- Zeitabweichungserkennung: `clockDrift()` vergleicht die eigene Uhr mit der des Managers,
  meldet ab 1 Minute Abweichung als auffällig - wird NICHT automatisch korrigiert.
- Diagnose-Endpunkt (`GET /api/v1/admin/diagnostics`, Admin-geschützt): Betriebszähler,
  Auditketten-Status, Zertifikats-Fingerprint - nachweislich ohne Klartext-Geheimnisse.

### 5. Installation und Betrieb
- `install/install-manager-service.ps1`: Windows-Diensteinrichtung über Bordmittel (`sc.exe`),
  automatischer Neustart bei Absturz konfiguriert. **Ehrlicher Vorbehalt: in dieser
  Linux-Sandbox nicht auf echtem Windows ausführbar/verifizierbar** - vor Praxiseinsatz auf
  einem echten System nachvollziehen.
- Kontrollierte Updates/Rollback, Logrotation als eigenständiges Betriebsthema: **noch nicht
  umgesetzt**, transparent als offen benannt statt oberflächlich behauptet.

## Migrationsstand
Manager `SCHEMA_VERSION = 6`, Kasse `SCHEMA_VERSION = 4`. Beide migrieren automatisch von jeder
vorherigen Version, unbekannte neuere Versionen werden weiterhin fail-closed abgelehnt (M-02).

## Tests
54 von 54 Tests bestehen, reproduzierbar per `npm ci && npm test` in frisch aufgesetztem
Verzeichnis nachgewiesen (~75 Sekunden Laufzeit).

## Bewusst offen gelassen (nicht vergessen, nur nicht in dieser Runde bearbeitet)
- Mehrtägiger echter Dauerbetrieb, echte Festplattengrenzen
- Kontrollierte Updates/Rollback für die Companion-Programme selbst
- Logrotation/Monitoring als eigenständige Betriebsfunktion
- Windows-Diensteinrichtung auf einem echten System noch nicht verifiziert
- Kassen-seitige Installations-/Dienst-Einrichtung noch nicht gebaut (nur Manager-Seite)

---

# Betriebs-Gate B (Baustufe-3-Gesamtabnahme, sechs gebündelte Befunde)

Auf Vorschlag des Prüfberichts als EIN gebündeltes Paket statt weiterer Mini-Baustufen bearbeitet.

## B3-K01 (HOCH) – Windows-Dienst startete nicht (MODULE_NOT_FOUND)

Der generierte Runner liegt im Unterordner `install/`, verwies aber auf `./manager-companion`
(eine Ebene zu niedrig). Korrigiert auf `../manager-companion`, unabhängig durch tatsächliches
Ausführen des generierten Runner-Inhalts verifiziert.

## B3-K02 (HOCH) – Live-Backup keine garantiert konsistente Momentaufnahme

`wal_checkpoint(TRUNCATE)` + externe Dateikopie ließ ein Zeitfenster für gleichzeitige
Schreibvorgänge offen, und das Checkpoint-Ergebnis wurde nie ausgewertet. Grundlegend umgebaut
auf `VACUUM INTO` - SQLites eigener, echter Mechanismus für eine atomare Punkt-in-Zeit-
Momentaufnahme in einem einzigen Vorgang. Getestet mit unmittelbar vorheriger aktiver
Schreiblast.

## B3-K03 (HOCH) – Restore nicht ausfallsicher, Integritätsprüfung unvollständig

`PRAGMA integrity_check` wurde nur auf eine geworfene Ausnahme geprüft, nicht auf den
tatsächlichen Rückgabewert; die Zieldatei wurde direkt überschrieben. Komplett neu gebaut:
Restore vollständig in ein temporäres Ziel, echte Prüfung auf exakt `"ok"`, Prüfsummen-Abgleich
über ein Manifest, verpflichtende Schlüsseldatei, ERST danach atomares Umbenennen an die
Zielposition. Mit Test bestätigt: ein manipuliertes/inkonsistentes Backup zerstört eine vorher
funktionierende Installation nicht.

## B3-M01 (MITTEL) – Löschen des neuesten Audit-Eintrags unentdeckt

Die Hash-Kette hatte keinen externen Anker für ihr Ende - ein sauber verkürztes Ende blieb
intern widerspruchsfrei. Ergänzt um eine externe, außerhalb der Datenbank liegende Ankerdatei,
die bei jedem Schreibvorgang fortgeschrieben wird. Mit exakt der Gegenprobe aus dem Prüfbericht
getestet (Löschen des letzten Eintrags wird jetzt als `tail_mismatch` erkannt).

## B3-M02 (MITTEL) – Dead-Letter „retry“/„discard“ nur Protokolleinträge ohne Wirkung

Der Manager schrieb den Betreiberwunsch nur ins eigene Protokoll, ohne die Kasse zu erreichen.
Jetzt: der Manager liefert offene Aktionen in der Sync-Antwort aus, die Kasse wendet sie
TATSÄCHLICH lokal an (retry = zurück auf „pending“, discard = endgültig „discarded“) und
bestätigt den Empfang, damit dieselbe Aktion nicht erneut zugestellt wird.

## B3-M03 (MITTEL) – Grün kein Nachweis für „aktuell online“

Ohne neuen Sync-Versuch blieb die Ampel unbegrenzt Grün. Jetzt gilt Grün nur noch innerhalb
einer Frischegrenze (5 Minuten); danach gilt der Status als veraltet (Gelb: „Status unbekannt“)
statt fälschlich weiter Online zu behaupten.

## Ergebnis
60 von 60 Tests bestehen (6 neue, je exakt auf einen der sechs Befunde zugeschnitten, teils mit
der Original-Gegenprobe aus dem Prüfbericht nachgestellt). Erneut reproduzierbar per
`npm ci && npm test` in einem frisch aufgesetzten Verzeichnis bestätigt. Weiterhin keine Aussage
„sicher“, „TÜV-geprüft“ oder „produktionsreif“, kein Feldversuch, kein Produktivnetz.

---

# Gate-B-Schlusskorrektur (zwei Punkte, keine neue Baustufe)

## 1. Dead-Letter-Aktionen wurden ohne neue Verkäufe nie abgeholt
Zwei getrennte Abkürzungen in `sync()` (eine vor, eine in der Batch-Bildung) verhinderten bei
leerer Outbox jeden Serverkontakt - eine Dead-Letter-Aktion konnte dadurch beliebig lange
unzugestellt bleiben, wenn zufällig keine neuen Verkäufe anfielen. Beide entfernt; ein leerer
"Check-in"-Aufruf findet jetzt immer statt.

## 2. Fehlender/beschädigter Audit-Anker war fail-open
`verifyAuditChain()` übersprang die Ankerprüfung stillschweigend, wenn die Ankerdatei fehlte -
genau der Fall, den ein Angreifer am ehesten herbeiführen würde. Jetzt fail-closed: fehlt die
Datei bei vorhandenem Audit-Log, oder ist sie nicht als gültiges JSON lesbar, meldet die Prüfung
`ok:false`. Der Anker wird außerdem jetzt bei Backup und Restore mitgesichert.

62 von 62 Tests bestehen (2 neue, exakt wie vereinbart), reproduzierbar per `npm ci && npm test`
bestätigt.

---

# Gate-B-Schlussprüfung – zwei Auditpunkte (keine neue Baustufe)

## 1. Alte Auditzeilen ohne Hash brachen den Kettenanschluss
Zwei getrennte Inkonsistenzen zwischen Schreiben und Prüfen, beide mit derselben Ursache
(Alt-Zeilen aus der Zeit vor Baustufe 3 wurden nicht überall gleich behandelt):
- Beim Schreiben wurde als Kettenvorgänger die zuletzt eingefügte Zeile unabhängig davon
  herangezogen, ob sie überhaupt einen Hash hat - folgte die erste hash-verkettete Zeile auf
  eine Alt-Zeile, wurde ihr prevHash fälschlich auf `null` statt `'GENESIS'` gesetzt.
- Der externe Anker zählte beim Schreiben ALLE Zeilen (auch hashlose Alt-Zeilen), `verifyAuditChain()`
  zählt aber konsequent nur Zeilen mit Hash.

Beide Stellen zählen jetzt konsequent nur Zeilen mit vorhandenem Hash - exakt dieselbe Regel auf
beiden Seiten. Der zweite Teilfehler (Zählung) wurde erst beim Testen der ersten Korrektur selbst
gefunden, nicht vom Prüfbericht benannt - mitbehoben, bevor ausgeliefert wurde.

## 2. Backup während eines gleichzeitigen Auditvorgangs
Der Anker wurde bisher als separate Datei von der LAUFENDEN Live-Installation kopiert - ein
Auditvorgang zwischen dem Datenbank-Snapshot (`VACUUM INTO`) und dieser Kopie konnte beide auf
unterschiedliche Zeitstände bringen. Der Anker wird jetzt NICHT mehr kopiert, sondern direkt aus
dem soeben erzeugten, bereits eingefrorenen Snapshot selbst neu berechnet - beide stammen
dadurch garantiert aus exakt derselben Quelle.

64 von 64 Tests bestehen (2 neue, exakt wie vereinbart), reproduzierbar per
`npm ci && npm test` bestätigt.

---

# Baustufe 4 (Teil 1) – sichtbare LEDs in der echten Kassenoberfläche

Zwei LEDs neben dem Hamburger-Menü in `pos/index.html`, nach der bereits bestehenden
`.mode-led`-Designkonvention gebaut (gleiche Kreisform, gleiche Größe, dieselben etablierten
Design-Tokens `--green`/`--yellow`/`--red` aus `styles.css`, keine neuen Farben erfunden).

## Architektur
Die Kasse ist eine Webseite, `device-companion` läuft als eigener lokaler Node-Prozess daneben -
beide können sich nicht direkt sehen. Neu ergänzt: `startLocalStatusServer()` im
device-companion, ein nur auf `127.0.0.1` lauschender, unauthentisierter (rein lesend, keine
Geheimnisse, kein Fernzugriff) HTTP-Endpunkt `/kc-sync-status`. Die Kassenoberfläche
(`kc-sync-status-leds.js`) fragt ihn alle 4 Sekunden ab.

## Die zwei LEDs
1. **Ampel** (`connectionStatus()`): Grün = online/synchronisiert, Rot = Offlinebetrieb,
   Gelb = Problem/Rückstau - inklusive verständlicher deutscher Beschreibung im Titel-Tooltip
   für jeden Zustand.
2. **Aktivitäts-LED** (`activityStatus()`): kurzes Aufblitzen bei lokalem Speichern oder
   Netzwerkverkehr, kein Dauerzustand.

## Bewusstes Fail-Safe-Verhalten
Ist KC Sync auf einer Kasse (noch) nicht eingerichtet oder der lokale Dienst läuft gerade nicht,
zeigen beide LEDs einen neutralen, grauen Zustand - kein Fehler, keine Beeinträchtigung der
übrigen Kassenbedienung. Mit eigenem Testdurchlauf bestätigt (keine JS-Fehler bei fehlendem
Dienst).

## Testdurchläufe (mehrfach wiederholt, wie verlangt)
Alle vier Zustände (kein Dienst / Grün / Gelb / Rot) sowie die Aktivitäts-LED über mehrere
Abfragezyklen hinweg mit echtem Playwright-Browsertest gegen die tatsächliche `index.html`
bestätigt, der komplette Vier-Szenarien-Durchlauf zusätzlich zweimal hintereinander wiederholt
zur Bestätigung der Reproduzierbarkeit. Backend-Testsuite (`kc_sync_stage1`) weiterhin 65/65
grün (1 neuer Test für den lokalen Status-Server).

## Noch offen für Baustufe 4
- Kassen-seitiger Start/Watchdog für den device-companion-Prozess selbst (bisher nur manuell
  gestartet in den Tests)
- Echter Windows-Test der gesamten Kette (Kasse + device-companion + manager-companion)
- Sichtprüfung/Feinschliff durch den Betreiber im echten Betrieb (Farbkontrast, Tooltip-Texte)

---

# Echter Windows-Test – gefundener und behobener Fehler in den Installationsskripten

Beim ersten echten Testlauf (nicht in dieser Sandbox, sondern auf einem echten Windows-Rechner
mit einem Installationspfad, der Leerzeichen enthält) zeigte sich: `sc.exe create` scheiterte
lautlos - `sc.exe` gab nur seinen eigenen Hilfetext aus (PowerShells eigene Argumentübergabe an
externe Programme zerstört die verschachtelten Anführungszeichen im `binPath`-Wert, sobald Pfade
Leerzeichen enthalten), der Dienst wurde nie tatsächlich angelegt. Das Skript meldete davon
unbeeindruckt trotzdem "eingerichtet", weil der Erfolg von `sc.exe` nie geprüft wurde - ein
"fail-open"-Fehler nach demselben Muster wie schon mehrfach zuvor in diesem Projekt gefunden.

**Korrektur in beiden Skripten** (`install-manager-service.ps1`, `install-kasse-service.ps1`):
- Der komplette `sc.exe create`-Befehl wird jetzt als eine Zeichenkette an `cmd.exe /c`
  übergeben - dessen Quoting-Verhalten ist das, was `sc.exe` (ein cmd.exe-Werkzeug) tatsächlich
  erwartet, unabhängig von Leerzeichen im Pfad.
- Nach der Erstellung wird über `Get-Service` tatsächlich geprüft, ob der Dienst existiert -
  schlägt das fehl, bricht das Skript mit einer klaren Fehlermeldung ab, statt fälschlich Erfolg
  zu behaupten.

**Ehrlicher Stand:** Dieser Fix konnte in der Linux-Sandbox nicht selbst mit echtem PowerShell
nachvollzogen werden - er beruht auf sorgfältiger Analyse der tatsächlichen Fehlerausgabe aus
dem echten Testlauf, ist aber noch nicht durch einen erneuten erfolgreichen Testlauf bestätigt.

---

# Zweiter Korrekturdurchgang – der cmd.exe-Umweg reichte nicht

Der erste Fix (sc.exe über cmd.exe statt direkt aufrufen) hat den echten Fehler nicht behoben -
im zweiten echten Testlauf trat exakt dasselbe Verhalten erneut auf (sc.exe gab wieder nur
seinen Hilfetext aus). Grund: PowerShells Kommandozeilen-Rekonstruktion für externe Programme
mit verschachtelten Anführungszeichen bricht unabhängig davon, WELCHES externe Programm
aufgerufen wird - der cmd.exe-Umweg verschob das Problem nur, statt es zu lösen.

**Echte Korrektur:** `New-Service` statt `sc.exe create` - PowerShells eingebauter Befehl zum
Anlegen eines Windows-Diensts. Da er kein externes Programm ist, gibt es keine
Kommandozeilen-Rekonstruktion und damit auch kein Anführungszeichen-Problem, unabhängig von
Leerzeichen im Pfad. `sc.exe` wird nur noch für die nicht-kritischen Zusatzeinstellungen
(Beschreibung, automatischer Neustart bei Absturz) verwendet - schlagen die fehl, bricht das
Skript nicht ab, da der Dienst zu diesem Zeitpunkt bereits existiert.

Zusätzlich behoben: eine frühere Fehlermeldung zeigte durch ein Zeichenkodierungsproblem
verstümmelte Umlaute ("PrÃ¼fen" statt "Prüfen") - alle zur Laufzeit tatsächlich angezeigten
Texte sind jetzt bewusst umlautfrei gehalten (nur Kommentare im Code, die nie angezeigt werden,
behalten die volle deutsche Schreibweise).

**Ehrlicher Stand:** Auch dieser zweite Fix konnte nicht selbst mit echtem PowerShell
nachvollzogen werden - er beruht auf der Analyse, warum der erste Versuch nachweislich nicht
funktioniert hat, und auf `New-Service` als grundsätzlich robusterem, in PowerShell nativ
eingebautem Mechanismus. Noch nicht durch einen erneuten erfolgreichen Testlauf bestätigt.

---

# Dritter Korrekturdurchgang – grundlegender Architekturfehler gefunden

Der zweite Fix (New-Service) löste das ANLEGEN des Dienstes zuverlässig. Beim tatsächlichen
STARTEN zeigte sich aber ein tieferliegendes Problem: "Der Dienst kann nicht gestartet werden."

**Ursache:** Ein normales Node.js-Programm ist technisch KEIN Windows-Dienst. Windows erwartet
von echten Diensten ein spezielles Rückmeldeprotokoll (den Dienststeuerungs-Handshake über die
Win32-Dienst-API) - ein gewöhnliches Node.js-Skript spricht dieses Protokoll nicht, egal wie
korrekt es als Dienst eingetragen wurde. Windows wartet vergeblich auf diese Rückmeldung und
bricht den Start ab. Das war ein Denkfehler von Anfang an, nicht nur ein Detail.

**Korrektur:** Statt eines echten Windows-Diensts wird jetzt eine **geplante Aufgabe** (Task
Scheduler) eingerichtet, die bei Systemstart einen ganz normalen Hintergrundprozess startet -
kein Dienststeuerungs-Handshake nötig, weiterhin ohne Fremdsoftware, weiterhin mit
Neustart-bei-Absturz-Verhalten (`RestartCount`/`RestartInterval`). `Register-ScheduledTask` ist
wie `New-Service` ein in PowerShell eingebauter Befehl, keine externe Anwendung - dieselbe
Anführungszeichen-Robustheit wie beim zweiten Fix bleibt erhalten.

**Aufräumarbeit für bereits durchgeführte Testläufe:** Ein zuvor als Windows-Dienst angelegtes
`KCSyncManager` (das nicht startete) bleibt bestehen, bis es manuell entfernt wird - das neue
Skript prüft nur auf gleichnamige GEPLANTE AUFGABEN, nicht auf alte Dienst-Einträge.

**Ehrlicher Stand:** Auch dieser dritte, diesmal architektonisch andere Ansatz konnte nicht
selbst mit echtem Windows nachvollzogen werden. Task Scheduler ist aber ein Mechanismus, der
für gewöhnliche Hintergrundprogramme (nicht service-protokoll-fähige) der technisch richtige
Weg ist - deutlich wahrscheinlicher, dass er funktioniert, als der Dienst-Ansatz es je hätte
sein können.

---

# Vierter Korrekturdurchgang – SYSTEM-Konto sieht keine Netzlaufwerke

Die geplante Aufgabe (dritter Durchgang) ließ sich anlegen und starten, der Manager-Prozess
brach aber sofort ab (`LastTaskResult: 1`). Direkter manueller Start (`node.exe run-manager-
service.js`) funktionierte hingegen sofort einwandfrei - der Unterschied: die Aufgabe lief
unter dem SYSTEM-Konto, der manuelle Test in der eigenen, angemeldeten Benutzersitzung.

**Ursache:** Der Installationsordner lag auf einem für den angemeldeten Benutzer eingerichteten
Netzlaufwerk (`L:\`). SYSTEM sieht solche benutzereigenen Laufwerkszuordnungen grundsätzlich
nicht - der Prozess brach beim Zugriff auf den eigenen Pfad sofort ab.

**Korrektur:** Die geplante Aufgabe läuft jetzt unter dem tatsächlich installierenden
Benutzerkonto (`$env:USERDOMAIN\$env:USERNAME`) und startet bei dessen Anmeldung
(`-AtLogOn`), nicht mehr unter SYSTEM bei rohem Systemstart. Dadurch sieht die Aufgabe exakt
dieselbe Umgebung (inklusive Netzlaufwerke) wie ein manueller Start in der eigenen Sitzung.
Praktische Folge: der Manager/die Kasse startet erst, sobald sich jemand anmeldet - für ein
Kassensystem, das ohnehin nur während des Betriebs gebraucht wird, sachlich passend.

---

# Fünfter Korrekturdurchgang – sichtbare Konsolenfenster beim automatischen Start

**Positiv zuerst:** Der automatische Start bei Windows-Anmeldung hat beim User tatsächlich
funktioniert - beide Aufgaben liefen morgens ohne manuelles Zutun. Das bestätigt, dass die
Korrektur des vierten Durchgangs (eigenes Benutzerkonto statt SYSTEM, `-AtLogOn`) wirksam war.

**Gefundener Mangel:** Beide Aufgaben öffneten dabei sichtbare, schwarze Konsolenfenster - für
einen im Hintergrund laufenden Dienst unerwünscht, auch wenn technisch kein Fehler.

**Korrektur:** Ein kleiner VBS-Startwrapper (`WScript.Shell.Run` mit Fenstermodus `0` =
unsichtbar) wird jetzt bei der Einrichtung automatisch erzeugt und von der geplanten Aufgabe
aufgerufen statt node.exe direkt. Das ist ein seit Jahren etabliertes, zuverlässiges
Windows-Verfahren - deutlich robuster als PowerShell-eigene Versuche, ein Konsolenfenster zu
unterdrücken, die bei node.exe als Konsolenanwendung nicht zuverlässig greifen.

Zusätzlich auf Nutzerwunsch: eine grafische Ein-Klick-Einrichtung
(`KC_Sync_Einrichtung_starten.ps1`) statt der bisherigen Kommandozeilen-Prozedur - Ordner
wählen, Start drücken, alle Schritte (inklusive automatischer Kopplung) laufen mit
Erfolgsmeldungen in einem Fenster ab. Ehrlicher Vorbehalt: konnte mangels Windows-Forms-fähiger
Testumgebung nicht selbst mit echtem Windows verifiziert werden, nur sorgfältig von Hand
geprüft.
