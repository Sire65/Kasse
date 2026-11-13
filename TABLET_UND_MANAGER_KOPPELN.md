# Tablets und PC-Manager koppeln – einmal, dann nie wieder

**Stand: 13.11.2026 · KS-01 „Einmal koppeln, dauerhaft gültig“**

Jedes Tablet wird **ein einziges Mal** mit einem **gedruckten QR-Zettel** gekoppelt.
Danach wird morgens nichts mehr gescannt – auch nicht nach einer Nacht ohne Strom,
nicht nach einem Neustart des PCs und nicht nach einem Programm-Update.

Es gibt **drei Kassen**: KASSE-01, KASSE-02 und KASSE-03. Die dritte ist für den Ersatzfall:
fällt ein Tablet aus, nimmt man ein anderes, scannt den Zettel KASSE-03 und kassiert weiter.

> Früher (bis November 2026) wurden bei jedem Start neue Schlüssel vergeben – deshalb musste
> jeden Morgen jedes Tablet vom Monitor neu scannen. Das ist vorbei.

---

## A. Einmalige Einrichtung (Betreuer, ca. 30 Minuten)

### 1. Router: dem PC immer dieselbe Adresse geben – das Wichtigste

Der QR-Code enthält die Adresse des PCs im Stand-WLAN. Bekommt der PC nach einer Nacht ohne
Strom eine andere Adresse, passen die Zettel nicht mehr.

**FRITZ!Box:** Heimnetz → Netzwerk → beim Stand-PC auf den Stift → Haken bei
**„Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“** → Übernehmen.
Andere Router: das heißt meist „DHCP-Reservierung“ oder „statische Zuweisung“.

Passt die Adresse trotzdem einmal nicht, steht das **unübersehbar** im schwarzen Fenster
(„PC-ADRESSE HAT SICH GEÄNDERT …“) und im PC-Manager – man sucht den Fehler nicht am Tablet.

### 2. PC: Programm einrichten

1. ZIP vollständig entpacken (nicht im ZIP arbeiten).
2. `KC_Manager_Start.cmd` doppelklicken. Beim allerersten Start wird die Laufzeit einmalig
   eingerichtet (Internet nötig).
3. **Windows-Firewall-Frage: „Zulassen“ – für private Netzwerke.** Wird das weggeklickt,
   kommen die Tablets nicht an den PC heran.

### 3. Automatisch starten, wenn der PC angeht (empfohlen)

1. `Windows-Taste + R`, eintippen: `shell:startup`, Enter – ein Ordner öffnet sich.
2. Mit der **rechten Maustaste** `KC_Manager_Start.cmd` in diesen Ordner ziehen →
   **„Verknüpfungen hier erstellen“**.

Ab dann startet alles von selbst, sobald der PC hochgefahren ist.

### 4. QR-Zettel drucken

PC-Manager → **Verbindung prüfen** → **„QR-Zettel drucken / prüfen“**
(oder Kassen → **„🖨 Tablet-QR-Zettel“**, oder direkt
`http://127.0.0.1:8090/pc-manager/kassen-zettel.html` – **nur am PC selbst**).

**„Alle Zettel drucken“** → drei Seiten, eine pro Kasse. Danach fragt die Seite, ob die Zettel
gut lesbar gedruckt sind – mit **OK** bestätigen. Erst dann gelten sie als „gültig“.

### 5. Jedes Tablet einmal koppeln

1. Tablet ins **Stand-WLAN**.
2. **Kamera** öffnen, Zettel der Kasse scannen (KASSE-01 für Tablet 1 usw.), Link antippen.
3. **Teilen → „Zum Home-Bildschirm“** (Android: ⋮ → „Zum Startbildschirm“).
4. Tablet beschriften („KASSE-01“).

### 6. Zettel aufbewahren – nicht aushängen

Der Zettel ist der **Schlüssel** zur Kasse. Wer ihn im Stand-WLAN fotografiert, kommt an die
Kasse. In die Kassenkassette oder einen Ordner am Stand.

---

## B. Jeden Markttag (Mitglieder)

1. Router und PC einschalten. Das schwarze Fenster startet von selbst und zeigt
   **„[Marktag-Start] ALLES BEREIT“**. Fenster offen lassen.
2. Am Tablet das **Kassen-Symbol** auf dem Home-Bildschirm antippen.
3. LED oben rechts **grün** = fertig.

**Kein Scannen.**

Am Ende des Tages: schwarzes Fenster schließen (oder PC herunterfahren).

---

## C. Wenn etwas nicht stimmt

**Jede Störung meldet sich im schwarzen Fenster in einem Kasten mit Ausrufezeichen** – immer
gleich aufgebaut:

```
!! PROBLEM: KASSE-02: Port 47501 ist belegt – Kassen-Dienst starten nicht möglich
!!   Ursache: Ein anderes Programm benutzt diesen Anschluss. Fast immer ist es ein noch
!!            offenes zweites schwarzes Fenster oder die alte Kassenversion.
!!   Lösung: 1) Alle schwarzen Fenster schließen.
!!           2) Task-Manager öffnen (Strg + Umschalt + Esc) → „Details“ → alle „node.exe“ … beenden.
!!           3) Dann EIN Fenster neu starten: KC_Manager_Start.cmd doppelklicken.
!!   (Technik für den Betreuer: …)
```

Einfach die **Lösung** Schritt für Schritt abarbeiten. Dieselben Meldungen stehen im PC-Manager
auf der Seite „Tablet-QR-Zettel“. Was weiterlaufen kann, läuft weiter: Hat nur eine Kasse ein
Problem, arbeiten die anderen normal. Wird die Ursache behoben (z. B. altes Fenster geschlossen),
startet die betroffene Kasse **von selbst** innerhalb von 30 Sekunden nach – die Meldung
verschwindet dann.

**Belegte Ports räumt das Fenster selbst frei – ohne Adminrechte:** Läuft noch ein altes
schwarzes Fenster (oder ein übrig gebliebener Kassen-Dienst), wird es automatisch beendet und
der Start geht weiter („Altes Kassenfenster … beendet – Port … ist frei, Start geht weiter“).
Belegt ein **fremdes** Programm den Port, wird es bewusst **nicht** beendet; die Meldung nennt
dann den Programmnamen und die Prozessnummer, damit man genau dieses Programm im Task-Manager
schließen kann. Hinweis: Wer während des Betriebs versehentlich ein zweites Fenster startet,
löst damit eine Übergabe aus – die Tablets sind dabei wenige Sekunden offline, es geht nichts
verloren.

Endet der Start mit **„START ABGEBROCHEN“**, steht die Ursache im Kasten darüber; das Fenster
bleibt offen, bis eine Taste gedrückt wird.


| Was man sieht | Bedeutung / was tun |
|---|---|
| Tablet: „PC nicht erreichbar – sind PC und schwarzes Fenster an …“ | PC aus, Fenster zu oder Tablet nicht im Stand-WLAN. **Kassieren geht trotzdem**, die Bons werden nachgereicht. |
| Tablet: „Zugang ungültig – QR-Zettel dieser Kasse neu scannen“ | Der Schlüssel dieser Kasse wurde erneuert. Neuen Zettel scannen. |
| Schwarzes Fenster: „BEREIT MIT WARNUNGEN“ | Die Warnung darüber lesen – sie sagt genau, was los ist. |
| Warnung „PC-ADRESSE HAT SICH GEÄNDERT“ | Router-Einstellung aus A.1 fehlt. Entweder im Router die alte Adresse wieder zuweisen **oder** Zettel neu drucken und alle Tablets neu scannen. |
| Warnung „Port … ist belegt von „Programmname““ | Ein fremdes Programm belegt den Port. Genau dieses Programm im Task-Manager beenden (Name und Prozessnummer stehen in der Meldung), dann Fenster neu starten. Alte Kassenfenster räumt das Programm selbst ab. |
| Ein Tablet ist kaputt | Anderes Tablet nehmen, Zettel **KASSE-03** scannen, weiter kassieren. |
| Tablet verloren oder gestohlen | PC-Manager → Admin-Center → **„Gerät verloren“**. Innerhalb weniger Sekunden bekommt diese Kasse einen neuen Schlüssel – das verlorene Tablet ist ausgesperrt. Neuen Zettel drucken, Ersatz-Tablet damit koppeln. Die anderen Kassen merken davon nichts. |
| Zettel verloren oder fremd fotografiert | PC-Manager → QR-Zettel → bei der Kasse **„Schlüssel erneuern…“**. Der alte Zettel ist sofort ungültig; neuen drucken, nur dieses eine Tablet neu scannen. |
| Beide Tablets zeigen dieselbe Kassennummer | Beide haben denselben Zettel gescannt. Eins mit dem richtigen Zettel neu scannen. |

---

## D. Den PC-Manager öffnen

Nur **am PC selbst** über `http://127.0.0.1:8090/pc-manager/index.html`
(öffnet sich beim Start automatisch). Nicht über die WLAN-Adresse und nicht am Tablet.

## E. Stammdaten an die Kassen senden

Unverändert: **PC-Manager → Artikel → „📤 Artikel, Warengruppen und Darstellung an alle Kassen
senden“**. Verbunden heißt noch nicht abgeglichen.

Damit KASSE-03 im PC-Manager unter **Kassen** mit LED erscheint: dort einmal **„＋ Neue Kasse“**
(legt automatisch KASSE-03 an) und **Speichern**. Für den Zettel und das Kassieren ist das nicht
nötig.

---

## F. Technik (für Betreuer)

* **Kassenliste:** `markt-kasse-suite/backend-source/markttag-kassen.json` – drei Kassen. Eine
  vierte: Eintrag ergänzen, Fenster neu starten, Zettel drucken. Optional
  `{"kassen":[…], "pcAdresse":"192.168.178.20"}` erzwingt die PC-Adresse.
* **Feste Ports:** KASSE-01 = 47500, KASSE-02 = 47501, KASSE-03 = 47502. Einmal vergeben,
  bleiben sie – auch wenn die Liste umsortiert wird. Webserver 8090, Manager 8543.
* **Datenordner der Tablet-Kassen:** `%LOCALAPPDATA%\KC-MarktKasse\tablet-kassen` – außerhalb
  des Programmordners. Darum überleben Schlüssel und Zettel auch das Entpacken einer neuen ZIP.
  **Diesen Ordner nicht löschen** – sonst müssen alle Tablets neu gescannt werden.
* **Kopplung Kasse ↔ Manager** läuft nach 30 Tagen ab. Der Start erneuert sie automatisch, wenn
  weniger als 7 Tage übrig sind, und koppelt neu, wenn der Manager neu installiert wurde. Der
  Schlüssel des Tablets ist davon unabhängig – **kein Neuscannen**.
* **Wächter:** Stürzt ein Kassen-Dienst ab, startet das Fenster ihn nach wenigen Sekunden neu.
* **Sicherheit:** `pc-manager/kassen-verbindungen.json` (enthält die Schlüssel) und die
  Zettel-Aktionen sind nur vom PC selbst erreichbar, nicht über das WLAN; die Datei liegt nicht
  mehr im Repository.
* **Port-Freigabe:** `markt-kasse-suite/backend-source/port-freigabe.js` – erkennt den Besitzer eines Ports (Windows: PowerShell `Get-NetTCPConnection`/`Get-CimInstance`, Rückfall `netstat`/`tasklist`), beendet nur Prozesse mit `run-manager-service.js`, `run-device-companion.js`, `serve-frontend.js` oder `markttag-start.js` in der Befehlszeile (Windows: `taskkill /T /F`), nie den eigenen Prozess oder fremde Programme. Test: `tests/kassen-start-portfreigabe.test.cjs`.
* **Fehlermeldungen:** zentral in `markt-kasse-suite/backend-source/fehlerhilfe.js` (Was / Ursache / Lösung). Test: `tests/kassen-start-fehlermeldungen.test.cjs`.
* **Tests:** `tests/kassen-start-datenwege.test.cjs` (Stammdaten, Dienstplan, Geld-Übergabe, Ausverkauft, Verkauf/Live-Monitor, „Gerät verloren“ über den echten Start mit drei Tablets), `tests/kassen-start-dauerhaft.test.cjs` (Ende-zu-Ende: drei Starts mit Tablet,
  QR vom Ausdruck zurückgelesen, Ablauf der Kopplung, neuer Manager, Absturz, Schlüssel
  erneuern, Port belegt, Adresse geändert) und `tests/kassen-start-einheit.test.cjs`.
