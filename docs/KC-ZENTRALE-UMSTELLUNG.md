# KC-SEC-ZENTRALE-TRANSITION – Vorbereitung, Version 1.0 RC

Auftrag 13.10.2026: Kassen nicht unterbrechen; erst vorbereiten, dann die zentral angebundenen PCs einzeln umstellen. Dieser Zweig aktiviert nichts auf Supabase und ändert keine produktiven Zugangsdaten.

## Was vorbereitet ist

- Server akzeptiert während eines ausdrücklich aktivierten Übergangs primary/new und legacy. Beide kommen ausschließlich aus Function-Secrets und werden über SHA-256 mit konstantem Vergleich geprüft. Kein eingebauter alter Wert, keine automatische Abschaltung nach Datum.
- Bestehende Manager-ID aus dem Companion wird wiederverwendet, keine neue Geräteidentität. Der Companion sendet sie beim Abgleich mit.
- Neue RLS-geschützte Status-Tabelle enthält ausschließlich Gerätekennung, Rechnername, Generation und letzten Nachweis. Direkter Zugriff ist nur service_role erlaubt. `KC-ZENTRALE-TRANSITION-CONTRACT.sql` ist ein ungeprüfter Migrationsentwurf, nicht eingespielt.
- Die PC-Manager-Ansicht „Zentrale Datenhaltung“ erhält „PC-Übersicht prüfen“. Fehlende oder unbestätigte Angaben werden als unbekannt/offen gezeigt. Leere PC-Liste ist nie fertig; nicht zugeordnete alte Clients blockieren den Abschluss, bis alle geplanten PCs danach wieder einen neuen Nachweis liefern.
- Auswahlwerkzeug: `tools/Zentralzugang-umstellen.ps1`. Es öffnet einen Dateiauswahldialog. Das Node-Werkzeug prüft Ziel/Organisation/Manager-ID und den neuen Zugang vor jeder Änderung. Alte Konfiguration bleibt als lokal geschützte Sicherung erhalten. Nach erfolgreichem lokalen Speichern erfolgt die zentrale Quittung. Ein unklarer ACK führt nicht zum Zurücksetzen auf alt, sondern zur wiederholbaren Prüfung.

## Vor dem Clubabend – durch die Administration

1. Alle tatsächlich zentral angebundenen PCs erfassen. Der aktuelle Datenweg läuft über den Manager-Companion, nicht unmittelbar von jeder Kasse zur Cloud. Seine Kennung ist im lokalen `/health`-Status sichtbar. Auch Ersatz-/Vertretungs-PCs aufnehmen.
2. Ein starkes neues Zugangswort sicher erzeugen und als geschützte Datei bereitstellen. Kein Wort in Chat, Repository, Befehlszeile oder Protokoll. Die Datei hat `schema: KC_ZENTRALE_ACCESS_FILE_V1`, dieselbe `url` und `orgId` wie die bestehende Einrichtung sowie `zugangswort`. Es gibt bewusst keine ausgefüllte Beispiel-Zugangsdatei im Repository.
3. Den SQL-Entwurf fachlich prüfen und als reguläre Migration einspielen; Backup/Recovery vorher festhalten. Erwartete Manager-IDs in `KC_ZENTRALE_EXPECTED_DEVICE_IDS` hinterlegen.
4. Function-Secrets vorbereiten: `KC_ZENTRALE_ACCESS_WORD` = neu, `KC_ZENTRALE_ACCESS_WORD_LEGACY` = bisheriger Zugang, `KC_ZENTRALE_LEGACY_ENABLED` = true, `KC_ZENTRALE_ALLOWED_ORGS` = freigegebene Organisation(en). Werte ausschließlich über geschützte Secret-Verwaltung setzen.
5. Erst danach den vorbereiteten Server deployen. Ohne neue primary-Konfiguration ist er absichtlich geschlossen. Vor PC-Änderungen sicher prüfen: alt funktioniert weiter, neu ist `generation:new`, falsch wird 401, normale bestehende Synchronisation funktioniert. Noch keinen alten Schlüssel abschalten.

## An jedem PC – ohne Zugangswort einzutippen

1. Den aktualisierten Manager-Companion samt vorhandener Node-Laufzeit bereitstellen. Eine ruhige Minute für seinen Neustart wählen; lokale Kassen-/Buchungsdaten werden nicht verändert.
2. `tools/Zentralzugang-umstellen.ps1` starten und die geschützte Zugangsdatei auswählen. Kein Kopieren des Worts in Browser/Chat.
3. Die Meldung prüfen. Bei gescheitertem Vorabtest bleibt die alte Datei. Bei „zentrale Bestätigung noch offen“ erneut ausführen; kein eigener Rückwechsel auf alt.
4. Companion neu starten, „Zentrale Datenhaltung“ öffnen und einen normalen Abgleich prüfen. Auf der PC-Übersicht muss der Rechner als „Neuer Zugang zentral bestätigt“ erscheinen. Die lokale `.receipt.json` enthält keine Schlüssel.
5. Dasselbe am nächsten PC durchführen. Nicht nur den Haupt-PC prüfen; die tatsächliche Geräteliste vollständig abarbeiten.

## Erst nach allen PCs

Alle geplanten PCs müssen mit neuem Zugang bestätigt sein, normal synchronisieren und keine unbekannten alten Clients offen sein. Danach entscheidet Hansi ausdrücklich über das Abschalten. `KC_ZENTRALE_LEGACY_ENABLED` auf false setzen und kontrollieren: alt gibt 401, neu funktioniert weiter, Kassen synchronisieren. Erst dann ist der alte Zugang ungültig. Lokale Alt-Sicherungen später bewusst entfernen. Dieses Werkzeug schaltet nichts automatisch ab.

## Tests

`node tests/zentrale-transition.cjs`: beide Generationen, kein automatischer Stichtag, fehlende Zuordnung, Org-Injection, Alt-Abschaltung 401, gescheiterter Vorabtest, unklarer ACK und Wiederholung. `node tools/run-event-simulation.cjs <Ziel>` benötigt `KC_SIMULATION_PASSWORD`; 8.200 synthetische Transaktionen bestanden mit zufälligem nur im Prozess gehaltenem Testpasswort. Ohne Variable wird abgebrochen; kein Passwort im Bericht.

PC-Manager Quellversion V0.31.2.7, Übergangsbaustein 1.0.0 RC. Nicht produktiv ausgerollt.

## Offene Prüfung vor Rollout

Der vorhandene HTTP-Companion behandelt `/zentral/` ohne eine eigene Loopback-/Origin-Prüfung und spiegelt den Origin im CORS-Header. Vor dem Rollout müssen Bind-Adresse, vorgeschaltete Zugriffsprüfung und die erlaubten Browser-Herkünfte nachgewiesen bzw. abgesichert werden. Eine pauschale neue Sperre wurde hier nicht eingebaut, weil die tatsächlich verwendeten App-Herkünfte zuerst erfasst werden müssen. Die Schlüsselrotation allein behebt diesen bisherigen lokalen Zugriffspfad nicht.

Zusätzlich geprüft: `node tests/zentrale-transition-browser.cjs` prüft die Übersicht bei 320 Pixel Breite, fehlende PC-Liste, Textdarstellung von Rechnernamen und unbekannten Status bei Fehlern.
