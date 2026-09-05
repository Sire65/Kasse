# Tablet und PC-Manager zusammenschalten

Es gibt dafür einen fertigen Ein-Klick-Weg. Er startet den Manager, die Kassen **und** den
Webserver zusammen und zeigt am Ende eine Seite mit einem QR-Code pro Kasse.

*Am 01.09.2026 hier einmal komplett durchlaufen lassen und geprüft — Manager läuft, beide
Kassen gekoppelt, Webserver läuft, Übersichtsseite mit QR-Codes erzeugt, Kasse über die
Adresse geöffnet und LED auf „Online und synchronisiert".*

---

## Einmalig auf dem PC

**Node.js installieren** von https://nodejs.org — die Version **LTS**. Danach den Rechner
einmal neu starten.

Dann die ZIP auf den PC kopieren und **entpacken** (nicht im ZIP arbeiten).

---

## Jedes Mal: ein Doppelklick

Im Ordner `kc-sync-installation-und-backend`:

**`KC_Markttag_Start.cmd` doppelklicken.**

Ein schwarzes Fenster geht auf. **Das bleibt offen** — es ist kein Ladefenster, das ist der
laufende Betrieb. Zumachen beendet alles.

Nach ein paar Sekunden steht dort:

```
[Marktag-Start] Manager läuft (https://127.0.0.1:8543).
[Marktag-Start] KASSE-01: gekoppelt.
[Marktag-Start] KASSE-02: gekoppelt.
[Webserver] KC Sync Webserver läuft auf Port 8090
[Marktag-Start] ALLES BEREIT
```

und es öffnet sich von selbst eine Seite **„Alles bereit für den Markttag"** mit einem
QR-Code je Kasse.

> **Beim allerersten Start fragt die Windows-Firewall**, ob Node.js ins Netzwerk darf.
> **Zulassen** — und zwar für **private Netzwerke**. Wird das weggeklickt, kommt das Tablet
> nicht an den PC heran, und man sucht den Fehler an der völlig falschen Stelle.

---

## Auf dem iPad

**Den QR-Code „KASSE-01" mit der Kamera-App scannen.** Safari öffnet die Kasse — fertig
verbunden, fertig gekoppelt. Kein Tippen, keine Adresse eingeben.

Was in dem QR-Code steckt, ist die Adresse des PCs plus Kassennummer, Port und ein
Zugangsschlüssel:

```
http://192.168.x.x:8090/pos/index.html?kcPort=47500&kcToken=…&kcRegisterId=KASSE-01
```

Das Tablet **merkt sich das**. Beim nächsten Mal reicht das Lesezeichen, der QR-Code wird nur
beim ersten Mal gebraucht.

**iPad und PC müssen im selben WLAN sein.** Sonst geht es nicht — die Adresse ist eine
Adresse im Heimnetz, kein Internetlink.

**Tipp:** in Safari über *Teilen → Zum Home-Bildschirm* ablegen. Dann startet die Kasse als
eigenes Symbol im Vollbild, ohne Safari-Leiste — sieht Freitag deutlich besser aus.

---

## Den PC-Manager öffnen

Der Link steht auf derselben Übersichtsseite:

```
http://127.0.0.1:8090/pc-manager/index.html
```

**Den Manager nur auf dem PC selbst öffnen, über `127.0.0.1`** — nicht über die WLAN-Adresse.
Die Seite sagt das selbst: sonst bleiben die Kassen-Anzeigen im Manager leer.

---

## Der eigentliche Abgleich: „an alle Kassen senden"

Verbunden heißt noch nicht abgeglichen. Die Stammdaten schickt der Manager auf Knopfdruck:

**PC-Manager → Artikel →** oben der Knopf
**„📤 Artikel, Warengruppen und Darstellung an alle Kassen senden"**

Damit gehen an jedes Tablet:

* Warengruppen und Artikel mit Preisen, Bildern, Pfand, Allergenen
* die **Artikelnummern** (01001, 02003 …) — ohne diesen Schritt kennt das Tablet sie nicht,
  und der Scanner findet nichts
* die **½-Portions-Freigaben**
* die Kombinationen
* Darstellung: Knopfgrößen, Farben, Vereinsname, Bedienerliste

**Was ausdrücklich NICHT mitgeht** (und das ist Absicht): die Kassennummer und der
Kassenname — sonst meldete sich das Tablet plötzlich als eine andere Kasse. Und die
Layout-Wahl des Bedieners, denn die gilt für seine Schicht.

Die Zeiterfassungs-Personen gehen einen eigenen Weg: **PC-Manager → Zeiterfassung →**
einschalten, Personen anlegen, an die Kassen senden. Ohne das ist der Uhrknopf an der Kasse
gar nicht erst da.

---

## Die Reihenfolge für Freitag

1. `KC_Markttag_Start.cmd` doppelklicken, Fenster offen lassen.
2. Am PC den **PC-Manager** über den Link auf der Übersichtsseite öffnen, Master-PIN eingeben.
3. Im Manager: **½-Portionen freigeben**, dann **„an alle Kassen senden"**.
4. Am iPad den **QR-Code KASSE-01** scannen.
5. Am iPad prüfen: oben rechts muss die LED **grün** sein („Online und synchronisiert").
6. Scanner-Test mit `werkzeuge/Scanner-Testblatt.pdf`.

---

## Mehr als eine Kasse

In `markttag-kassen.json` steht einfach:

```json
["KASSE-01", "KASSE-02"]
```

Für eine dritte `"KASSE-03"` ergänzen und neu starten. Jede bekommt ihren eigenen QR-Code und
ihren eigenen Zugangsschlüssel.

---

## Wenn etwas nicht geht

| Symptom | Ursache |
|---|---|
| Tablet lädt die Adresse nicht | Nicht im selben WLAN, oder die Firewall-Frage wurde weggeklickt |
| Kasse öffnet, aber LED bleibt rot | Das schwarze Fenster wurde geschlossen |
| Kasse zeigt alte Artikel | „An alle Kassen senden" fehlt |
| Manager zeigt keine Kassen | Manager über die WLAN-Adresse statt über 127.0.0.1 geöffnet |
| „Node.js wurde nicht gefunden" | Node.js fehlt, siehe oben |
| Beide Tablets zeigen dieselbe Kassennummer | Beide haben denselben QR-Code gescannt |

Am Ende des Tages: **das schwarze Fenster schließen.** Das beendet alles sauber zusammen.
