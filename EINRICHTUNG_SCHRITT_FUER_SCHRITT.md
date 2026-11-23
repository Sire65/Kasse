# KC MarktKasse: Einrichtung Schritt für Schritt

**Stand: 16.11.2026.** Diese Anleitung führt vom ausgepackten Gerät bis zur ersten Buchung, die zu Hause ankommt.
Arbeite die Schritte **der Reihe nach** ab und hake jeden ab.
Die Einrichtung macht man **einmal**. Danach heißt es jeden Tag nur noch: einschalten (Teil H).

---

## So hängt alles zusammen

```
  Tablet KASSE-01 ─┐
                   ├─ WLAN ─► TP-Link-Router ─ LAN-Kabel ─► Mini-PC ─ HDMI ─► Fernseher (Präsentation)
  Tablet KASSE-02 ─┘           (SIM-Karte)                    │      └ VGA ─► Monitor (optional)
                                    │                          │
                                    └──── Internet (Mobilfunk) ┴──► Supabase ◄── PC-Manager zu Hause
```

- **Die Tablets kassieren.** Sie sprechen nur mit dem Mini-PC. Dafür brauchen sie **kein Internet**.
- **Der Mini-PC ist die Zentrale.** Er speichert alles, zeigt die Präsentation auf dem Fernseher
  und schickt alle Buchungen über die SIM-Karte an Supabase.
- **Zu Hause** holt sich der PC-Manager alles aus Supabase.
  Dein PC zu Hause muss also **nicht** dauerhaft laufen.
- Fällt das Internet am Stand aus, kassieren die Tablets weiter. Der Mini-PC lädt die Buchungen später nach.

---

## A. Was du brauchst

| ✔ | Teil | Hinweis |
|---|---|---|
| ☐ | 2 Samsung Galaxy Tab A11+ (WLAN) | die beiden Kassen |
| ☐ | 2 Ladegeräte (USB-C) | |
| ☐ | TP-Link Archer MR200 | Mobilfunk-Router (4G/LTE) |
| ☐ | SIM-Karte mit Daten | z. B. Telekom Prepaid M, rund 10 € für 4 Wochen, siehe Schritt B1 |
| ☐ | Mini-PC mit Windows | mit Netzteil, Maus und Tastatur |
| ☐ | LAN-Kabel | vom Router zum Mini-PC |
| ☐ | Fernseher und HDMI-Kabel | für die Präsentation |
| ☐ | Monitor und VGA-Kabel (optional) | empfohlen, dann sieht man Meldungen, ohne dass die Präsentation verschwindet |
| ☐ | Steckdosenleiste | |
| ☐ | Drucker oder USB-Stick | für die QR-Zettel; drucken geht auch zu Hause |
| ☐ | Dein Supabase-Admin-Konto | E-Mail und Passwort, mit denen du dich im PC-Manager anmeldest |

---

## B. Zu Hause vorbereiten (ca. 20 Minuten)

### B1. SIM-Karte entsperren
1. Neue SIM-Karte **in ein Handy** stecken und mit der PIN aus dem Brief entsperren.
2. Im Handy: **Einstellungen → Sicherheit → SIM-Kartensperre → „SIM-Karte sperren“ ausschalten**.
   Der Router kann keine PIN eingeben, deshalb muss die Sperre aus sein.
3. Die Karte wieder herausnehmen und als **Nano-SIM** herausbrechen.

### B2. Programm herunterladen
Nichts nötig: Mini-PC und PC zu Hause laden sich die kleine Installations-ZIP (20 KB) selbst, siehe **D3**.

---

## C. Router einrichten (ca. 15 Minuten)

### C1. Router anschließen
1. SIM-Karte in den Router stecken, den Router an den Strom anschließen und einschalten.
2. **LAN-Kabel** vom Router (ein **LAN**-Anschluss) zum Mini-PC stecken.
3. Den Mini-PC einschalten. Etwa 2 Minuten warten, bis am Router die Mobilfunk-Lampe leuchtet.

### C2. Router-Grundeinstellung
1. Am Mini-PC den Browser öffnen und **http://192.168.1.1** eingeben (oder `tplinkmodem.net`).
2. Ein Admin-Passwort festlegen und **aufschreiben** (in die Kassenkassette).
3. Der Assistent fragt nach Mobilfunk. In der Regel erkennt er alles selbst, also einfach **Weiter**.
4. **WLAN-Namen und WLAN-Passwort** notieren. Sie stehen auf dem Aufkleber unter dem Router
   oder lassen sich im Assistenten neu vergeben.
   **Das Passwort nicht an Helfer weitergeben**, sonst verbrauchen deren Handys die SIM-Daten.

### C3. Dem Mini-PC eine feste Adresse geben (wichtig!)
Die QR-Zettel enthalten die Adresse des Mini-PCs.
Ändert sie sich, passen die Zettel nicht mehr. Deshalb diese Einstellung **vor** dem Drucken der Zettel machen:

1. In der Router-Oberfläche: **Erweitert → Netzwerk → DHCP-Server**.
2. Unten bei **Adressreservierung** auf **Hinzufügen**.
3. Den **Mini-PC** auswählen (Liste „Verbundene Geräte“) und als IP-Adresse **192.168.1.20** eintragen.
4. **Speichern**. Den Mini-PC einmal **neu starten**.

---

## D. Mini-PC einrichten (ca. 30 Minuten)

### D1. Windows-Netzwerk
1. **Einstellungen → Netzwerk und Internet → Ethernet** anklicken.
2. **Netzwerkprofil: „Privat“** wählen.
   Steht hier „Öffentlich“, lässt Windows die Tablets nicht heran.
3. Etwas weiter unten **„Getaktete Verbindung“ einschalten**.
   Dann lädt Windows keine großen Updates über die SIM-Karte.

### D2. Windows Update bremsen
1. **Einstellungen → Windows Update → „Updates für 5 Wochen aussetzen“**.
2. **Erweiterte Optionen → Nutzungszeit:** 8 bis 23 Uhr.
   Dann startet Windows am Markttag nicht von selbst neu.

### D3. Programm aufspielen (installiert sich selbst nach `C:\KC-Kasse`)
1. Am Mini-PC im Browser die **kleine Installations-ZIP** laden (nur 20 KB):
   **https://sire65.github.io/Kasse/installation/KC-Kasse-Installation.zip**
   (Nicht mehr die große GitHub-ZIP mit über 200 MB – die braucht unnötig Platz.)
2. Rechtsklick auf die ZIP-Datei → **„Alle extrahieren…“** → **Extrahieren**.
   Bitte **nicht** direkt in der ZIP-Datei doppelklicken – das Programm merkt das und sagt es.
3. Auf Laufwerk C: sollten ca. 250 MB frei sein.
4. Doppelklicken auf **`KC_Manager_Start.cmd`**.
   - Das Programm **lädt sich nach `C:\KC-Kasse`** (ca. 80 MB Programm + 30 MB Node.js, nur beim
     ersten Mal, einige Minuten). Dafür braucht es Internet. Ist zu wenig Platz frei, sagt es das vorher.
   - Es legt **selbst** die Verknüpfung **„KC Kasse starten“** auf den Desktop **und in den Autostart**.
     Alte Kopien der Startdatei im Autostart räumt es dabei weg.
   - Lag schon eine alte Version direkt in `C:\KC-Kasse`: Kassen-Daten, Schlüssel und Einstellungen
     werden übernommen, das alte Programm landet in `C:\KC-Kasse\alt\` (nichts wird gelöscht).
   - **Fragt die Windows-Firewall: unbedingt „Zulassen“ klicken (private Netzwerke).**
   - Am Ende steht im schwarzen Fenster **„[Marktag-Start] ALLES BEREIT“**.
     Steht dort eine Meldung mit `!!`, die **Lösung** darin Schritt für Schritt befolgen.
5. Der **PC-Manager** öffnet sich von selbst im Browser.
   **Das schwarze Fenster offen lassen.** Es ist das Kassenprogramm.
6. Die ZIP-Datei und den entpackten Ordner danach **löschen** – sie werden nicht mehr gebraucht.
7. Einmal **`C:\KC-Kasse\KC_MiniPC_Einrichten.cmd`** doppelklicken: Bildschirm und Standby nie aus,
   keine Benachrichtigungen, kein Bildschirmschoner, Rathaus-Bild als Hintergrund.

### D4. Updates – passieren von selbst
- Bei **jedem Start** fragt der Mini-PC im Internet nach einer neuen Version und lädt **nur geänderte
  Dateien** (Node.js und die Zusatzmodule bleiben liegen). Jede Datei wird mit einer Prüfsumme geprüft.
- **Startet eine neue Version nicht**, startet automatisch die vorige wieder. Die kaputte Version wird
  übersprungen, bis eine reparierte kommt.
- **Kein Internet?** Dann startet einfach die vorhandene Version.
- Die Tablets übernehmen die neue Version von selbst in einer Ruhepause (leerer Bon, 2 Minuten niemand dran).
- **Marktsperre 04.–14.12.:** In dieser Zeit holt der Mini-PC **keine** Updates von selbst. Muss doch eine
  Korrektur drauf: PC-Manager → **Verbindung prüfen** → Karte „Verbindung nach Hause“ →
  **„⬆️ Update für heute freigeben“** (geht auch von zu Hause). Installiert wird beim nächsten Start
  (schwarzes Fenster schließen, **„KC Kasse starten“** doppelklicken).
- Die Programm-Version steht im PC-Manager unter **Verbindung prüfen**.
- Daten liegen getrennt vom Programm in `%LOCALAPPDATA%\KC-MarktKasse` (Benutzer KC-Team) – ein Update
  ändert daran nichts. Der Fernseher-Rand steht jetzt dort in `stand-einstellungen.json`.

### D5. Fernseher und Monitor
- **Nur Fernseher (HDMI):** Es ist nichts zu tun. Die Präsentation startet bei jedem Start von selbst im Vollbild.
- **Fernseher (HDMI) und Monitor (VGA):**
  1. **Windows-Taste + P** → **„Erweitern“**.
  2. **Einstellungen → System → Bildschirm** → den **Monitor** anklicken →
     **„Als Hauptanzeige verwenden“** ankreuzen.
  3. Dann zeigt der Fernseher die Präsentation und der Monitor das schwarze Fenster und den PC-Manager.

---

## E. Tablets einrichten (ca. 10 Minuten pro Tablet)

### E1. QR-Zettel drucken (am Mini-PC)
1. Im PC-Manager: **Verbindung prüfen** → **„QR-Zettel drucken / prüfen“**.
2. **„Alle Zettel drucken“**. Es kommen drei Seiten: KASSE-01, KASSE-02 und KASSE-03 als Ersatz.
   - **Ohne Drucker:** Im Druckfenster als Drucker **„Als PDF speichern“** wählen,
     die PDF auf den USB-Stick ziehen und zu Hause drucken.
3. Die Seite fragt, ob die Zettel gut lesbar gedruckt sind. Mit **OK** bestätigen.

### E2. Tablet vorbereiten
1. Tablet einschalten und die Grundeinrichtung durchklicken. Ein Google-Konto ist **nicht** nötig.
2. Mit dem **WLAN des Routers** verbinden (Name und Passwort aus C2).
3. **Einstellungen → Software-Update → „Automatisch über WLAN herunterladen“ ausschalten.**
4. **Einstellungen → Anzeige → Bildschirm-Timeout:** 10 Minuten.

### E3. Tablet koppeln (einmal, nie wieder)
1. Die **Kamera** öffnen und den Zettel **KASSE-01** scannen. Den angezeigten Link antippen.
2. Die Kasse öffnet sich im Browser.
3. Oben rechts **⋮** → **„Zum Startbildschirm hinzufügen“**.
4. Das Tablet außen mit **„KASSE-01“** beschriften.
5. Mit dem zweiten Tablet und dem Zettel **KASSE-02** genauso.

### E4. Zettel wegschließen
Die Zettel sind die **Schlüssel** zu den Kassen. Sie gehören in die **Kassenkassette**, nicht an die Wand.
KASSE-03 ist der Ersatz: Fällt ein Tablet aus, ein anderes nehmen, KASSE-03 scannen und weiter kassieren.

---

## F. Artikel auf die Kassen bringen

1. Im PC-Manager: **Artikel** → prüfen, ob Preise und Artikel stimmen.
2. **„📤 Artikel, Warengruppen und Darstellung an alle Kassen senden“**.
3. Auf den Tablets erscheinen die Artikel nach wenigen Sekunden.

Später geht das auch **von zu Hause aus** (Teil G). Wichtig: Artikel **nur an einer Stelle** pflegen,
am besten zu Hause. Es gilt immer, was zuletzt „an alle Kassen gesendet“ wurde.

---

## G. Verbindung nach Hause (ca. 10 Minuten)

### G1. Mini-PC als Stand anmelden (einmalig, am Mini-PC)
1. Im PC-Manager oben bei **Supabase** mit deinem **Admin-Konto** anmelden.
2. **Verbindung prüfen** → Karte **„Verbindung nach Hause“** → **„🌐 Diesen PC als Stand anmelden“**.
3. Einen Namen eingeben, z. B. „Weihnachtsmarkt 2026“, und bestätigen.
4. Im schwarzen Fenster steht dann **„Verbindung nach Hause (Supabase): eingerichtet“**.
5. Danach kannst du dich im PC-Manager am Mini-PC **wieder abmelden**.
   Die Verbindung nach Hause läuft mit einem eigenen Schlüssel weiter.

### G2. PC zu Hause einrichten (einmalig)
1. Die kleine Installations-ZIP (Link in D3) auch zu Hause laden und entpacken (Rechtsklick → „Alle extrahieren…“).
2. **`KC_Zuhause_Start.cmd`** doppelklicken. Es installiert sich nach `C:\KC-Kasse` und legt die
   Verknüpfung **„KC Manager zu Hause“** auf den Desktop. Ab dann nur noch diese benutzen – sie holt
   neue Versionen von selbst (zu Hause gilt keine Marktsperre).
   **Zu Hause nie „KC Kasse starten“ / `KC_Manager_Start.cmd` benutzen**, das würde zweite, leere Kassen starten.
3. Im PC-Manager bei **Supabase** mit dem Admin-Konto anmelden.
4. Unten rechts steht **„Fernmodus · Stand … · zuletzt gemeldet vor … s“**.

Ab jetzt siehst du zu Hause:
- Buchungen im **Live-Monitor**,
- Kassen, Abschlüsse, Dienstzeiten und Ausverkauft.

Von zu Hause aus kannst du:
- Artikel senden,
- Ausverkauft setzen,
- die Präsentation **„📺 An den Fernseher senden“**.

Das kommt am Stand nach wenigen Sekunden an.

---

## H. Probelauf (vor dem ersten Markttag!)

| ✔ | Prüfung | So sieht es richtig aus |
|---|---|---|
| ☐ | Mini-PC **neu starten** | Das schwarze Fenster startet von selbst und zeigt „ALLES BEREIT“; der Fernseher zeigt die Präsentation |
| ☐ | Kassen-Symbol auf beiden Tablets antippen | Die Lampe oben rechts ist **grün** |
| ☐ | Auf jedem Tablet eine Testbuchung | Sie erscheint im **Live-Monitor** am Mini-PC |
| ☐ | Zu Hause den PC-Manager öffnen | Dieselben Testbuchungen erscheinen nach wenigen Sekunden im Live-Monitor |
| ☐ | Zu Hause einen Artikel auf „Ausverkauft“ setzen | Auf den Tablets ist er nach wenigen Sekunden gesperrt; danach wieder freigeben |
| ☐ | Router kurz ausschalten und eine Buchung machen | Das Tablet kassiert weiter; nach dem Wiedereinschalten kommt die Buchung zu Hause an |
| ☐ | Testbuchungen stornieren bzw. den Testabschluss machen | wie im normalen Kassenbetrieb |

---

## I. Jeden Markttag (für alle Mitglieder)

1. **Router** einschalten, dann den **Mini-PC** einschalten.
   Falls Windows ein Kennwort verlangt, anmelden.
2. Warten, bis im schwarzen Fenster **„ALLES BEREIT“** steht. **Fenster offen lassen.**
3. Auf den Tablets das **Kassen-Symbol** antippen. Die Lampe ist grün, **kein Scannen**.
4. **Abends:** Kassenabschluss machen, dann den Mini-PC herunterfahren.

---

## J. Wenn etwas nicht klappt

| Was man sieht | Was tun |
|---|---|
| Im schwarzen Fenster ein Kasten mit `!! PROBLEM` | Die **Lösung** im Kasten Schritt für Schritt befolgen. Viele Probleme behebt das Programm selbst in 30 Sekunden. |
| Tablet: „PC nicht erreichbar“ | Ist der Mini-PC an? Ist das schwarze Fenster offen? Ist das Tablet im Router-WLAN? **Kassieren geht trotzdem**, die Buchungen werden nachgereicht. |
| Tablet: „Zugang ungültig – QR-Zettel neu scannen“ | Den Zettel dieser Kasse neu scannen. |
| Warnung „PC-ADRESSE HAT SICH GEÄNDERT“ | Schritt **C3** fehlt oder ist falsch. Feste Adresse einstellen, Mini-PC neu starten. |
| Tablet kaputt | Anderes Tablet nehmen, Zettel **KASSE-03** scannen, weiter kassieren. |
| Tablet verloren | PC-Manager → Admin-Center → **„Gerät verloren“**. Neuen Zettel drucken. |
| Zu Hause: „Stand zuletzt gemeldet vor … Minuten“ | Am Stand fehlt das Internet (SIM-Guthaben? Router an?). Die Kassen laufen trotzdem. |
| Fernseher zeigt nichts | Mini-PC neu starten oder im PC-Manager „📺 An den Fernseher senden“. |
| Schwarzes Fenster: „BITTE ZUERST ENTPACKEN“ | Es wurde direkt in der ZIP-Datei doppelgeklickt. Rechtsklick auf die ZIP → „Alle extrahieren…“, dann im entpackten Ordner starten. |
| Schwarzes Fenster: „FALSCHE DATEI IM AUTOSTART“ | `shell:startup` öffnen, die Datei vom Typ „Windows-Befehlsskript“ löschen, einmal „KC Kasse starten“ doppelklicken. |
| „NEUE VERSION STARTET NICHT“ | Nichts tun – die vorige Version läuft automatisch. Foto an den Betreuer. |

Ausführlichere Erklärungen stehen in:
- `TABLET_UND_MANAGER_KOPPELN.md` für Tablets, Fehlermeldungen und Fernseher,
- `KONZEPT_STAND_ZUHAUSE.md` für die Verbindung nach Hause.
