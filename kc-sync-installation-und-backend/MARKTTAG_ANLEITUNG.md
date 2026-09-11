# KC Sync – Markttag-Automatikstart

Startet mit **einem Doppelklick** alles, was für einen Marktstand-Tag gebraucht wird –
Manager, alle Kassen und den Webserver zusammen. Am Ende öffnet sich automatisch eine
Übersichtsseite mit einem QR-Code je Kasse zum Scannen.

## Voraussetzung (einmalig)

Node.js muss installiert sein: https://nodejs.org (die Version "LTS" herunterladen und
installieren, dann diesen Rechner ggf. einmal neu starten).

## Am Marktstand

1. **`KC_Markttag_Start.cmd` doppelklicken.** Ein schwarzes Fenster öffnet sich – das ist
   normal, bitte während des gesamten Marktbetriebs **geöffnet lassen** (nicht schließen).
2. Nach kurzer Zeit öffnet sich automatisch eine Seite mit einem QR-Code pro Kasse.
3. **Auf jedem Tablet** den passenden QR-Code mit der Kamera-App scannen – öffnet die Kasse
   direkt und fertig verbunden. Kein Tippen nötig.
4. PC-Manager auf dem eigenen Rechner: der Link steht ebenfalls auf der Übersichtsseite.

## Anzahl der Kassen ändern

In `markttag-kassen.json` steht eine einfache Liste, z. B.:
```json
["KASSE-01", "KASSE-02"]
```
Für eine dritte Kasse einfach `"KASSE-03"` ergänzen und speichern, dann neu starten.

## Am Ende des Markttages

Das schwarze Fenster einfach schließen (oder Strg+C drücken) – beendet alles sauber
zusammen.

## Sicherheit

Daran ändert sich nichts: der Manager läuft weiterhin über eine verschlüsselte
Verbindung (HTTPS mit echtem Zertifikat), jede Kasse hat weiterhin ihren eigenen,
automatisch erzeugten Zugangs-Schlüssel für den WLAN-Zugriff. Nur der **Startvorgang**
wurde automatisiert – an der Absicherung selbst wurde nichts verändert.

## Vorprüfungen beim Start

Vor dem eigentlichen Start prüft das Programm ein paar Dinge und schreibt das Ergebnis ganz
oben ins schwarze Fenster — zusammen mit dem **laufenden Stand** (aus der STAND.txt) und der
**WLAN-Adresse**, die verwendet wird.

Es gibt zwei Arten von Befunden:

* **ABBRUCH** — es wird nichts gestartet und nichts verändert. Kommt nur vor, wenn es sonst
  *später* still schiefginge und man den Zusammenhang dann nicht mehr erkennen könnte:
  Start aus dem ZIP heraus, kein Schreibrecht, keine WLAN-Adresse.
* **Hinweis** — der Start läuft weiter, sagt es aber deutlich: fehlende Firewall-Freigabe,
  Netzwerkprofil „Öffentlich", mehrere Netzwerkadressen, Ordner auf Netzlaufwerk oder in der
  Cloud, Energiesparmodus, falsch gehende Uhr, wenig Speicherplatz.

Kann eine Prüfung ihre Antwort nicht sicher ermitteln, **schweigt sie**. Ein Fehlalarm am
Marktmorgen ist schlimmer als gar keine Prüfung.

### „Aus dem ZIP gestartet"

Windows entpackt eine ZIP zum Anklicken in einen Wegwerf-Ordner. Der Marktstand würde laufen —
aber Datenbank, Kopplungen und Zugangsschlüssel lägen dort und wären beim nächsten Start weg.
Deshalb: ZIP mit Rechtsklick → **„Alle extrahieren"** und von dort starten.

### Firewall — ohne Alarm, aber mit Anlaufstelle

Die Firewall-Prüfung hat zweimal falsch Alarm geschlagen: beim zweiten Mal war die Freigabe von
Hand angelegt und das Tablet kassierte nachweislich über das WLAN — die Abfrage fand die Regel
trotzdem nicht. Eine Prüfung, die zweimal falsch anschlägt, ist schlechter als gar keine, also
**schweigt sie jetzt**. Am Ende der Vorprüfungen steht stattdessen nur die Anlaufstelle, an
einem echten Symptom festgemacht:

> Falls ein Tablet die Kasse **nicht** laden kann (der PC selbst aber schon):
> **`Firewall-Freigabe-einrichten.cmd`** mit Rechtsklick → **„Als Administrator ausführen"**.
> Sie legt genau eine Regel an, sagt vorher welche, und fragt nach. Sie schaltet die Firewall
> nicht ab und ändert das Netzwerkprofil nicht.

Wer die automatische Prüfung zurückhaben will, legt neben `vorpruefungen.js` eine Datei
`markttag-pruefungen.json` an mit `{"firewallPruefung": true}`.

### Mehrere Netzwerkadressen

Auf einem Rechner mit VirtualBox, Hyper-V, Docker oder VPN gibt es mehrere. Das Programm fragt
die Routing-Tabelle des Systems, statt zu raten, und nennt im Fenster, welche es genommen hat.

Festlegen kann man es mit einer Datei `markttag-adresse.json`:

```json
{ "lanAdresse": "192.168.178.79" }
```

## „Tablet verbunden ✓" — der einzige Beweis, der zählt

Auf der Übersichtsseite steht unter jedem QR-Code zuerst **„wartet auf Tablet …"**. Sobald ein
Gerät die Kasse geöffnet hat, wechselt es auf **„✓ Tablet verbunden"** mit Adresse und
Zeitpunkt. Die Anzeige frischt sich alle zwei Sekunden selbst auf.

Damit sieht man **am PC**, ob es geklappt hat, statt am Tablet zu rätseln. Jede Vorprüfung ist
nur ein Indiz — eine Firewall-Abfrage sagt bloß, ob eine *Regel existiert*; ob das Tablet
wirklich durchkommt, weiß allein das Tablet.

Meldet sich ein Gerät, hat aber keine Kasse geöffnet, steht das unten auf der Seite. Dann sind
WLAN und Firewall in Ordnung, und es wurde nur noch kein Kassen-QR-Code gescannt.

Der eigene Rechner zählt dabei **nicht** als Tablet — sonst zeigte die Seite grün, obwohl nie
ein Tablet da war.

## Falls etwas nicht klappt

**Erste Anlaufstelle: das Fenster „Verbindungen prüfen" im PC-Manager.** Ein Klick auf eine der
LED-Gruppen oben rechts (oder auf den Knopf daneben) öffnet es. Es misst den Manager-Dienst, den
Webserver, jede Kasse, den Browserspeicher und die zentrale Datenbank — und sagt zu jeder
Störung in einem Satz, was los ist, und in einem zweiten, was zu tun ist. Kein „Failed to
fetch": der technische Wortlaut steht eingeklappt darunter, für den Fall, dass man ihn
weitergeben will. Mit **„Bericht kopieren"** gibt es den ganzen Befund als Text zum Verschicken.

Zwei Dinge hält das Fenster ausdrücklich auseinander, weil beide schon Zeit gekostet haben:

* **„Manager-Dienst antwortet nicht" heißt nicht „Kasse nicht gekoppelt".** Ohne Dienst gibt es
  gar keine Kopplungsliste — die Kassenzeile sagt dann „Kopplung unbekannt" und verweist nach
  oben, statt etwas zu verneinen, das niemand geprüft hat.
* **Der PC-Manager gehört auf den PC, nicht auf das Tablet.** Wird er über die WLAN-Adresse
  geöffnet, kann der Live-Kanal gar nicht antworten — die LEDs sind dann rot, obwohl alles läuft.
  Das Fenster nennt genau diesen Fall beim Namen. Auf das Tablet gehört die **Kasse**.

Die Meldungen im schwarzen Fenster zeigen an, was gerade passiert. Bei "Node.js wurde
nicht gefunden" siehe Voraussetzung oben. Bei anderen Fehlermeldungen: das Fenster
gemeinsam mit den Meldungen als Foto/Text weitergeben, dann lässt sich die Ursache
gezielt finden.
