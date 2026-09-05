# Konzept zur Prüfung: Online/Offline-Hybridbetrieb, Mehrkassen-Fähigkeit

**Status: Konzept zur Prüfung – noch keine Umsetzung.** Gedacht zur Vorlage bei eurem
Framework Studio / TÜV, bevor irgendein Code entsteht.

---

## 1. Der vollständige Automatik-Ablauf, Schritt für Schritt

### Schritt 1 – Kasse startet
Die Kasse liest ihre eigene, fest gespeicherte Kassen-ID (`registerId`, existiert bereits).
Sie prüft: gibt es eine zuvor gemerkte Manager-Adresse (von einem früheren erfolgreichen
Verbindungsaufbau)?

- **Ja, Adresse vorhanden** → weiter mit Schritt 2 (Schnellverbindung)
- **Nein, keine Adresse gemerkt** (erster Start / nach Zurücksetzen) → weiter mit Schritt 3
  (Erstkopplung)

### Schritt 2 – Schnellverbindung (gemerkte Adresse)
Kasse fragt direkt bei der gemerkten Adresse an (`/health`, kurzes Zeitlimit, z. B. 2 Sekunden).

- **Antwortet korrekt** → Ampel grün, weiter im Normalbetrieb (Schritt 5)
- **Antwortet nicht / falsch** → die gemerkte Adresse gilt als ungültig (z. B. weil sich die
  IP-Adresse durch den Router über Nacht geändert hat – siehe Abschnitt 4). Automatischer
  Rückfall auf Schritt 3.

### Schritt 3 – Automatische Suche im lokalen Netz
Kasse ermittelt ihren eigenen IP-Adressbereich (z. B. 192.168.1.x) und fragt parallel bei allen
Adressen in diesem Bereich denselben `/health`-Pfad an, kurzes Zeitlimit je Anfrage.

- **Genau ein Gerät antwortet korrekt als Manager** → Adresse wird gemerkt, Ampel grün, weiter
  Normalbetrieb
- **Kein Gerät antwortet** → Ampel rot, Kasse arbeitet komplett offline weiter (Schritt 6),
  Suche wird in regelmäßigen Abständen im Hintergrund wiederholt (siehe Abschnitt 3)
- **Mehrere Geräte antworten als Manager** (z. B. zwei Marktstände mit jeweils eigenem Manager
  im selben WLAN) → **kein automatisches Raten.** Die Kasse zeigt eine Auswahl/Warnung und
  verlangt die Bestätigung per QR-Kopplung (Schritt 4). Sicherheitsgrund: eine Kasse darf nicht
  versehentlich Belege beim Manager eines anderen Standes einspeisen.

### Schritt 4 – QR-Kopplung (Erstkopplung oder bei Mehrdeutigkeit)
Der Manager zeigt einen QR-Code mit: seiner aktuellen Adresse, einem einmaligen Kopplungs-Token
und einem Ablaufzeitpunkt (z. B. 10 Minuten gültig). Die Kasse scannt ihn einmal.

- Danach ist die Kasse fest mit **diesem konkreten Manager** gekoppelt (nicht nur mit einer
  IP-Adresse, sondern mit einer beständigen Kennung des Managers – wichtig, falls sich die
  IP-Adresse später ändert, siehe Abschnitt 4)
- Dieses Token dient gleichzeitig als Sicherheitsschlüssel für alle künftigen Übertragungen
  (Abschnitt 7)

### Schritt 5 – Normalbetrieb (verbunden)
Ampel grün. Jeder Beleg wird wie bisher sofort lokal gespeichert und zusätzlich in die lokale
Warteschlange gelegt. Ein Hintergrundprozess sendet die Warteschlange laufend an den Manager.
Parallel läuft weiterhin regelmäßig ein leichter Verbindungstest (Abschnitt 3), auch während des
Betriebs – nicht nur beim Start.

### Schritt 6 – Offline-Betrieb
Ampel rot. Kasse funktioniert für das Personal identisch wie im heutigen reinen Offline-Modus –
kein Unterschied in der Bedienung, nichts blockiert. Verbindungsversuche laufen unauffällig im
Hintergrund weiter (Abschnitt 3).

### Schritt 7 – Wiederverbindung während des Betriebs
Sobald ein Hintergrund-Verbindungstest wieder erfolgreich ist: Ampel gelb, automatischer Abgleich
der gesamten Warteschlange beginnt, Ampel wird grün sobald die Warteschlange leer ist.

---

## 2. Was bei Problemen beim Hochfahren passiert – im Einzelnen

| Situation | Verhalten |
|---|---|
| Manager-PC ist noch gar nicht eingeschaltet | Schritt 3 findet nichts → Ampel rot, Kasse startet trotzdem normal und sofort bedienbar, keine Wartezeit für das Personal |
| Manager läuft, aber mit falscher/alter Software-Version | `/health`-Antwort enthält eine Versionskennung; bei Unverträglichkeit meldet die Kasse das explizit als eigenen Ampel-Zustand (nicht einfach "rot", sondern eine erkennbare Meldung "Version passt nicht") statt stillschweigend zu scheitern |
| WLAN ist grundsätzlich da, aber ohne Manager im Netz (z. B. Gäste-WLAN ohne Marktstand-Geräte) | Wie "kein Gerät antwortet", Ampel rot, kein Unterschied für das Personal spürbar |
| Kassen-Uhrzeit weicht stark von der Manager-Uhrzeit ab | Wird beim Verbindungstest mit erkannt (Manager sendet seine Uhrzeit mit); bei größerer Abweichung eigene Warnung, weil das später bei der Reihenfolge der Belege Probleme machen kann – **wird nicht automatisch "repariert"**, sondern nur angezeigt, da eine automatische Zeitumstellung auf einem Kassensystem riskant wäre |
| Kasse hat noch nie eine Verbindung gehabt und es gibt kein Netz überhaupt (kein Router an) | Automatische Suche läuft ins Leere, keine Fehlermeldung, die den Betrieb stört – Ampel bleibt einfach rot, Kasse ist normal nutzbar |
| Zwei Kassen kommen gleichzeitig hoch und suchen gleichzeitig | Kein Problem, da jede für sich sucht und sich unabhängig koppelt; keine gegenseitige Blockade vorgesehen |

**Grundprinzip, das sich durch alle Fälle zieht: Ein Verbindungsproblem darf niemals die
Bedienbarkeit der Kasse einschränken.** Die Ampel ist reine Information, nie eine Blockade.

---

## 3. Die Ampel als genaue Zustandsmaschine

Damit sie nicht bei jeder kurzen Netz-Ruckelei hektisch hin- und herspringt ("flackert"), mit
fester Logik statt Momentaufnahme:

- **Rot → Gelb**: sobald ein einzelner Verbindungstest erfolgreich war
- **Gelb → Grün**: erst wenn die Warteschlange leer UND der letzte Verbindungstest schnell war
  (unter einem festen Schwellwert, z. B. 500 ms)
- **Grün → Gelb**: wenn ein Verbindungstest langsam war (über dem Schwellwert) ODER ein
  Übertragungsversuch fehlgeschlagen ist ODER neue Warteschlangen-Einträge länger als eine
  gewisse Zeit nicht gesendet werden konnten
- **Gelb/Grün → Rot**: erst nach **mehreren** aufeinanderfolgenden fehlgeschlagenen
  Verbindungstests (nicht schon beim ersten Ausbleiben einer Antwort) – verhindert, dass eine
  einzelne verlorene Anfrage die Ampel unnötig auf Rot springen lässt
- Verbindungstest-Intervall im Normalbetrieb: alle 15–30 Sekunden; nach einem Fehlschlag kürzere
  Abstände für schnellere Erkennung der Wiederverbindung

---

## 4. Mehrere Kassen & Datenintegrität

- Jeder Beleg bekommt eine **eindeutige, aus Kassen-ID + laufender Nummer zusammengesetzte
  Kennung**, bevor er überhaupt in die Warteschlange kommt. Dadurch ist ein Beleg auch dann
  eindeutig identifizierbar, wenn er wegen einer abgebrochenen Übertragung versehentlich zweimal
  gesendet wird – der Manager erkennt Duplikate zuverlässig und verwirft sie, statt Umsätze
  doppelt zu zählen.
- **IP-Adress-Wechsel während des Marktbetriebs** (z. B. der Router vergibt nach einem Neustart
  eine andere Adresse): die Kopplung aus Schritt 4 hängt an einer beständigen Kennung des
  Managers, nicht an der IP-Adresse selbst. Ändert sich die IP-Adresse, erkennt die Kasse beim
  nächsten fehlgeschlagenen Schnellverbindungsversuch automatisch, dass sie neu suchen muss
  (zurück zu Schritt 3), **ohne dass die Kopplung selbst verloren geht.**
- **Manager fällt während des Tages komplett aus** (Absturz, versehentlich beendet): Kassen
  wechseln automatisch auf Rot und offline, sammeln weiter. Sobald der Manager wieder läuft,
  erkennt ihn die Kasse beim nächsten Hintergrund-Verbindungstest von selbst wieder – keine
  manuelle Handlung nötig.
- **Reihenfolge bei gleichzeitigem Abgleich mehrerer Kassen**: Der Manager verarbeitet
  eingehende Belege pro Kassen-ID getrennt; es gibt keine Reihenfolge-Abhängigkeit zwischen
  verschiedenen Kassen, die beachtet werden müsste.

---

## 5. Sicherheit auch im lokalen Netz

Auch wenn kein Internet beteiligt ist, sollte nicht jedes beliebige Gerät im selben WLAN Belege
einspeisen können. Deshalb:

- Das Kopplungs-Token aus Schritt 4 wird bei **jeder** Übertragung mitgeschickt und vom Manager
  geprüft – ohne gültiges Token wird nichts angenommen
- Die bereits vorhandene optionale Verschlüsselung der Nutzlast (im Manager schon eingebaut)
  kann für diesen Kanal ebenfalls verwendet werden

---

## 6. Grenzen dieses Konzepts (bewusst, nicht "vergessen")

- Findet die Kasse **mehrere** mögliche Manager im Netz, wird **nicht automatisch geraten** –
  das erfordert eine bewusste Bestätigung durch das Personal (Sicherheitsgrund, siehe Schritt 3)
- Eine zu stark abweichende Kassen-Uhrzeit wird gemeldet, aber nicht automatisch korrigiert
- Ein völlig fremdes Netz ohne jeden Manager erzeugt bewusst keine störende Fehlermeldung,
  sondern bleibt einfach im Hintergrund "rot" – die Kasse soll niemals aufdringlich wirken

---

## 7. Was zur Prüfung ansteht, bevor gebaut wird

Dieses Dokument beschreibt das Verhalten vollständig, aber absichtlich noch ohne Festlegung auf
konkrete Technik-Details (Programmiersprache des lokalen Server-Teils, genaue
Datenbankstruktur), da das eher etwas für eure technische Prüfung ist als für die
Konzeptebene. Wenn vom TÜV/Framework Studio freigegeben, baue ich entlang der 5 Baustufen aus
dem vorherigen Konzeptpapier, beginnend mit dem lokalen Server-Teil im Manager.
