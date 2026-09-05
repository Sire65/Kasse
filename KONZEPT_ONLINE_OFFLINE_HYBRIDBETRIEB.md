# Konzept: Online/Offline-Hybridbetrieb für KC MarktKasse

## Ausgangslage – was bereits da ist

Eine wichtige Erkenntnis vorweg, die das Konzept einfacher macht als gedacht: **Der Manager hat
bereits ein fast vollständiges Sync-Grundgerüst** (`pc-manager/app.js`), aktuell für den
Abgleich mit einem Cloud-Backend (Supabase) gedacht:

- `syncQueue` – eine Warteschlange aller lokalen Änderungen mit Status (`pending`/`sent`),
  Versuchszähler und nächstem Versuchszeitpunkt
- `queueSync(entity, operation, payload)` – jede relevante Änderung wird hier eingereiht
- `BackendAdapter` / `RestBackendAdapter` / `SupabaseBackendAdapter` / `MockBackendAdapter` –
  austauschbare Andockstellen, jede mit `test()` (Erreichbarkeits-Check), `push()`, `pull()`
- `testConnection()` – genau die Art Gesundheits-Check, die für eine Ampel-Anzeige gebraucht wird
- `runSync()` – sendet ausstehende Änderungen, sobald online
- optionale Ende-zu-Ende-Verschlüsselung der Nutzlast (`syncSettings.encryption`)

Was **fehlt**: Die Kasse (`pos/`) hat aktuell **keinerlei** Netzwerk-Code für Verkaufsdaten (nur
einen einmaligen Kursabruf für Fremdwährungen). Sie ist komplett auf lokale Speicherung und den
abendlichen Dateiaustausch ausgelegt. Und: einen echten Server, der die Anfragen von mehreren
Kassen gleichzeitig entgegennimmt, gibt es nirgends – `backend/` ist im Projekt leer.

## Zielbild

Drei Betriebsarten, ineinander übergehend, ohne dass am Kassenpersonal etwas Besonderes zu tun ist:

1. **Offline** (wie heute) – Kasse arbeitet komplett lokal, Abgleich abends per Datei
2. **Lokales Weihnachtsmarkt-Netz** – Kassen sprechen direkt mit dem PC Manager über WLAN/LAN vor
   Ort, kein Internet nötig
3. **Online** – zusätzlich Internetzugang vorhanden, z. B. für Fernabgleich, Cloud-Sicherung,
   Fremdwährungskurse

Die Kasse soll das selbst erkennen und sich entsprechend verhalten – ohne manuelles Umschalten.

## Die Ampel

Rot / Gelb / Grün im Hamburger-Menü, mit klarer, einfacher Bedeutung:

| Farbe | Bedeutung | Auslöser |
|---|---|---|
| Rot | Offline | Kein Manager im Netz erreichbar (Verbindungstest schlägt fehl oder Zeitüberschreitung) |
| Gelb | Verbindung vorhanden, aber gestört | Manager erreichbar, aber langsam (Antwortzeit über Schwellwert), oder Abgleich hat gerade Fehler/Wiederholungen |
| Grün | Alles in Ordnung | Manager erreichbar, Antwortzeit gut, Warteschlange leer oder wird gerade sauber abgearbeitet |

Technisch: ein wiederkehrender, leichter Verbindungstest (angelehnt an das vorhandene
`testConnection()`/`BackendAdapter.test()`-Muster), der Erreichbarkeit **und** Antwortzeit misst.
Läuft beim Hochfahren der Kasse einmal sofort, danach in einem Intervall im Hintergrund weiter
(z. B. alle 15–30 Sekunden), damit ein Ausfall während des Betriebs zeitnah bemerkt wird.

## Der Automatik-Ablauf

1. **Hochfahren der Kasse**: Verbindungstest gegen den Manager im lokalen Netz (feste Adresse
   oder automatisches Auffinden, siehe unten). Ergebnis setzt sofort die Ampel.
2. **Während des Verkaufs**: Jeder Beleg wird wie bisher sofort lokal gespeichert (Kasse bleibt
   immer bedienbar, unabhängig vom Netz) und zusätzlich in eine lokale Warteschlange gelegt
   (gleiches Prinzip wie die bestehende `syncQueue` im Manager, nur jetzt auch in der Kasse).
3. **Ist die Ampel grün**: Warteschlange wird laufend im Hintergrund an den Manager übertragen,
   ohne dass das Personal etwas merkt.
4. **Fällt die Verbindung während des Betriebs weg**: Ampel springt auf Rot, Kasse arbeitet
   ungestört lokal weiter, nichts geht verloren, die Warteschlange wächst einfach weiter.
5. **Verbindung kommt zurück**: Ampel springt auf Gelb (Abgleich läuft) und automatisch auf Grün,
   sobald die Warteschlange leer ist – kompletter Abgleich ohne Zutun.
6. **Abends**: Der bestehende Datei-Export bleibt als zusätzliche, unabhängige Sicherung
   bestehen – er wird durch den Online-Betrieb nicht überflüssig, sondern ist die Rückfallebene,
   falls an einem Tag gar keine Verbindung zustande kam.

## Was in der Kasse (`pos/`) neu gebaut werden muss

- Lokale Sync-Warteschlange nach dem Vorbild der Manager-`syncQueue` – jeder Verkauf/jede
  Stornierung/jede Kassenschluss-Aktion wird zusätzlich zur bestehenden lokalen Speicherung dort
  eingereiht
- Verbindungstest gegen den Manager (Adressermittlung siehe unten), inklusive Zeitmessung für
  die Gelb/Grün-Unterscheidung
- Automatischer Hintergrund-Abgleich, der die Warteschlange abarbeitet, sobald grün
- Die Ampel selbst im Hamburger-Menü (kleines, unaufdringliches UI-Element)
- Empfangsseite für Daten, die umgekehrt vom Manager kommen könnten (z. B. Preisänderungen live
  statt erst beim nächsten Dateiaustausch) – optional, nicht zwingend für die erste Stufe

## Was im Manager (`pc-manager/`) angepasst werden muss

- Der vorhandene `BackendAdapter`/`RestBackendAdapter` bekommt eine dritte Variante neben
  Mock/REST/Supabase: einen lokalen Modus, der Anfragen von Kassen im selben Netz entgegennimmt,
  statt selbst als Client zu einem Cloud-Server zu sprechen – der Manager wird also für die
  Kassen zum Server, während er für ein optionales Cloud-Backup weiterhin Client bleiben kann
- Ein leichter lokaler Web-Server-Anteil muss ergänzt werden, der /health, /sync/push,
  /sync/pull beantwortet – bisher gibt es nur den Client-Teil dafür, keinen Server
- Verarbeitung eingehender Kassenbelege: prüfen, in die Tagesdaten einsortieren, Rückmeldung an
  die jeweilige Kasse
- Die Ampel-Logik in der Kasse braucht eine Gegenstelle, die verlässlich schnell antwortet, damit
  Gelb/Grün sauber unterschieden werden kann

## Der fehlende dritte Baustein: eine kleine lokale Server-Komponente

Das ist der eigentlich neue Teil, den es noch gar nicht gibt. Zwei Wege:

**A) Der Manager-PC selbst wird zum Server** – der Manager läuft ohnehin auf einem PC vor Ort;
er bekommt einen kleinen, eingebetteten lokalen Server-Teil, den die Kassen im selben WLAN
direkt ansprechen. Kein zusätzliches Gerät nötig, einfachste Lösung für den "kleinen
Weihnachtsmarkt-Netz"-Fall. Nachteil: Manager-PC muss durchgehend laufen und im Netz erreichbar
sein.

**B) Ein separater kleiner Vermittlungsdienst** – ein eigenständiger, schlanker Server (könnte
auch auf einem Raspberry Pi o. Ä. laufen), an den sowohl Kassen als auch Manager andocken.
Aufwendiger, aber unabhängiger vom Manager-PC.

**Meine Empfehlung für den Start: Variante A.** Einfacher, nutzt die vorhandene
Adapter-Architektur direkt, und passt zum "kleines Netz vor Ort"-Szenario. Variante B ließe sich
später ergänzen, ohne das Grundprinzip zu ändern (der Adapter kennt ja schon eine austauschbare
Server-Adresse).

## Adressermittlung: wie findet die Kasse den Manager?

Zwei Stufen, robust kombiniert:
1. Feste, einmal eingetragene Adresse (einfachste, zuverlässigste Lösung für ein festes
   Marktstand-Setup: Manager-PC hat eine feste lokale Adresse, einmal in der Kasse hinterlegt)
2. Automatisches Suchen im lokalen Netz als Komfort-Ergänzung (die Kasse fragt beim Hochfahren
   automatisch im WLAN nach einem antwortenden Manager) – schöner, aber nicht zwingend für die
   erste Stufe

## Vorschlag für die Reihenfolge des Umbaus

1. Lokale Server-Komponente im Manager (Variante A) – Grundvoraussetzung für alles Weitere
2. Sync-Warteschlange + Verbindungstest in der Kasse, noch ohne UI – erst technisch zum Laufen
   bringen und mit echten Testdaten prüfen
3. Ampel-Anzeige im Hamburger-Menü der Kasse
4. Automatischer Hintergrund-Abgleich bei wiederhergestellter Verbindung
5. Optionaler Cloud-Anteil (echtes Internet, Supabase) obendrauf – nutzt exakt die schon
   vorhandene Manager-Infrastruktur, kommt zum Schluss

Jede Stufe für sich einzeln testbar und lauffähig, bevor die nächste beginnt – gleiches Prinzip
wie bei den bisherigen Baustufen des Objekt-Studios.

## Offene Fragen an dich, bevor ich zu bauen anfange

1. Sollen mehrere Kassen gleichzeitig unterstützt werden (mehrere Verkaufsstände parallel), oder
   reicht erstmal eine Kasse zu einem Manager?
2. Soll die feste Adresse des Manager-PCs einmal fest eingetragen werden, oder ist dir die
   automatische Netzwerksuche wichtig genug, um sie gleich mit in Stufe 1 zu nehmen?
3. Für den optionalen echten Internetbetrieb: ist ein Supabase-Konto/Server bereits vorhanden,
   oder ist das komplett noch offen (dann würde ich das ans Ende der Roadmap stellen)?
