# Prüfbericht zum Freitags-Stand

**Geprüft am:** Mittwoch, 02.09.2026
**Vorführung:** Freitag, 04.09.2026
**Stand:** KC MarktKasse Suite, Arbeitsversion für Freitag

---

## Ergebnis in einem Satz

Alles, was sich hier prüfen lässt, ist grün: **48 Prüfläufe mit 352 Einzelpunkten** in der
Regression, **270 Einzelpunkte** im TÜV, kein einziger Fehlschlag. Was noch offen ist, sind
drei Dinge, die **nur am echten Gerät** erledigt werden können — sie stehen unten und sind
kein Mangel am Programm.

---

## 1 · Regression — 48 Läufe, 352 Punkte, 0 Fehler

Alle Prüfläufe der Kassenoberfläche, des PC-Managers und des Backends. Darunter die
Neuzugänge dieser Woche:

| Prüflauf | Punkte | Was er absichert |
|---|---|---|
| `halbe-portion` | 53/53 | ½-Portionen; Pfand wird **nie** halbiert |
| `scan-wege` | 34/34 | die vier Scanner-Wege an der Kasse |
| `verbindungsdiagnose` | 29/29 | das Prüffenster hinter den LEDs |
| `artikelnummern-und-qr` | 28/28 | fünfstellige Artikelnummern und ihre QR-Codes |
| `personenart-uebergabe` | 24/24 | Übergabeprotokoll |
| `kombi-warengruppe` | 23/23 | geteilte Kombi-Kacheln, Preis = Summe |
| `testblatt-codes` | 20/20 | jeder Code vom Testblatt wird an der Kasse erkannt |
| `betriebsart` | 18/18 | lokal oder Fernbetrieb, Wahl wird immer genannt |
| `kasse-ueber-wlan` | 17/17 | die Kasse über die WLAN-Adresse, nicht nur über 127.0.0.1 |
| `scanner-tastaturlayout` | 15/15 | Kasse arbeitet auch bei falsch eingestelltem Scanner |
| `pin-sperre-tablet` | 14/14 | PIN-Sperre mit eigenem Zahlenfeld am Tablet |
| `praesentation-schutz` | 13/13 | Schutz der Vorführung |
| `manager-led-verbindung` | 12/12 | grüne LED heißt Verbindung, nicht Verkauf |
| `bilder-zwischenspeicher` | 9/9 | neue Bilder kommen an, auch unter altem Dateinamen |
| `supabase-uebersicht-meldung` | 7/7 | keine Datenbanksprache auf dem Bildschirm |
| `live-monitor-reihenfolge` | 6/6 | Ereignisliste immer neueste zuerst |
| `vorpruefungen` (Backend) | 30/30 | Startprüfungen und Lebenszeichen der Tablets |
| `stage1-integration` (Backend) | 78 | Kopplung, Sync, Datenbank |
| … sowie 30 weitere Läufe | alle grün | Manager-Ansichten, Studio, TV, Rezepte, Zeiterfassung |

## 2 · TÜV — 8 Reihen, 270 Punkte, 0 Fehler

Die TÜV-Reihen bedienen das Programm **von außen wie ein Mensch**: echter Browser, echte
Klicks, echtes QR-Lesegerät. Geprüft wird nicht der Quelltext, sondern was am Bildschirm
steht und was in der Datenbank landet.

| Reihe | Punkte | Inhalt |
|---|---|---|
| Bedienung und Robustheit | 59/59 | Modusanzeige, zehn Bildschirmgrößen, Storno, Neustart mitten im Bon |
| Geldarithmetik | 39/39 | Summen, Pfand, Rückgeld, Unterdeckung, 50-Positionen-Bons |
| Bereitschaft | 39/39 | Bereitschaftspunkte für den Markttag |
| PC-Manager und Money Butler | 33/33 | jede Manager-Ansicht geöffnet, Geldkassette, Zeiterfassung |
| Backend und ganze Kette | 33/33 | Dienst wirklich gestartet, Migrationen, Fälschungsversuche |
| Generalprobe | 25/25 | der **Ablaufplan der Freitags-Vorführung**, Schritt für Schritt |
| QR-Codes wirklich einlesen | 21/21 | jeder Code wird zurückgelesen und verglichen |
| Härtetests an der Kasse | 21/21 | beschädigte Codes, 40 Bons hintereinander, Tagesabschluss |

Die **Generalprobe** ist die wichtigste davon: sie geht genau die Reihenfolge, die Freitag
gegangen wird, und prüft bei jedem Schritt, ob herauskommt, was dem Raum angekündigt wird.
Belegfotos liegen in `tests/tuev/generalprobe-bilder`.

---

## 3 · Was die Prüfung NICHT abdeckt

Ehrlichkeitshalber, damit aus 622 grünen Punkten keine falsche Sicherheit wird:

- **Der Vorführrechner selbst.** Alle Läufe hier liefen in einem Rechenzentrum, nicht auf dem
  Gerät am Beamer. Genau dafür gibt es die praktische Sichtprüfung (siehe unten).
- **Das WLAN am Stand.** Reichweite und Störungen lassen sich nur vor Ort messen.
- **Der Scanner.** Ob sein Tastaturlayout richtig steht, zeigt erst das Testblatt am Gerät.
  Die Kasse arbeitet seit dieser Woche zwar auch bei falscher Einstellung weiter — das ist
  ein Fangnetz, kein Ersatz.

---

## 4 · Offene Punkte — alle am Gerät, keiner im Programm

1. **Praktische Sichtprüfung bestätigen** (Freitags-Checkliste, Schritt 10).
   Solange sie fehlt, steht oben in der Kopfzeile auf **jeder** Seite „· Prüfhinweise".
   Das ist kein Fehler: das Programm verlangt ausdrücklich, dass jemand es an dem Bildschirm
   gesehen hat, an dem es später läuft. Ein Klick auf den Hinweis führt direkt zum Knopf.
   **Das ist der sichtbarste Punkt — vor der Vorführung erledigen.**
2. **Master-PIN setzen.** Ohne sie liegt ein Weichzeichner über der Oberfläche.
3. **½-Portionen freigeben**, sonst ist der ½-Knopf an jedem Artikel grau.
4. **Scanner auf German Keyboard stellen** (Heft, Seite 12) und mit dem Testblatt prüfen.
5. **Tablets einmal hart neu laden**, damit die neuen Bilder aus dem Zwischenspeicher fallen.

## 5 · Zwei Versionsangaben, die auseinanderlaufen

Beides ohne Auswirkung auf den Betrieb, aber vor dem Festzurren genannt statt verschwiegen:

- `latest-release-manifest.js` (**Repair 63**) ist die Quelle, die der Manager lädt und die
  sich selbst als `sourceOfTruth` bezeichnet. Daneben liegt `latest-release-manifest.json`
  mit **Repair 76** — ein Überbleibsel aus einer Lieferung, die bewusst nicht übernommen
  wurde. Gelesen wird sie nur vom Schulungsvideo, und auch dort nur, wenn kein
  Manager-Manifest im Speicher liegt. **Nichts an der Vorführung hängt daran.**
- Die Kasse zeigt `V0.31.3.6 R12`, der Manager `V0.31.3.6 Repair 63`. Zwei getrennte Zähler
  für zwei Programmteile — technisch richtig, nebeneinander auf der Leinwand aber eine
  Frage, die jemand stellen könnte. Eine Antwort parat zu haben genügt.

---

*Erstellt am 02.09.2026. Die Zahlen stammen aus vollständigen Läufen an diesem Tag, nicht
aus einer Zusammenfassung früherer Läufe.*
