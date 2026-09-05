# Ring-Scanner HW0010 einrichten — Schritt für Schritt

Gerät: Ringscanner **HW0010**, 1D/2D, Bluetooth HID / SPP / BLE / 2,4 GHz.
Die Seitenzahlen unten sind die aus dem beiliegenden Heftchen.

Eingestellt wird **durch Scannen der Codes im Heft**. Also: Heft aufschlagen, Scanner in die
Hand, und die Codes der Reihe nach abscannen. Ein `*` im Heft heißt „ist ab Werk so".

---

## Die Reihenfolge — genau diese neun Codes

| | Seite | Code | Warum |
|---|---|---|---|
| **1** | 01 | **Factory Reset** | Sauberer Ausgangspunkt. Danach ist alles auf Werkseinstellung — auch die Kopplung, die muss also **danach** gemacht werden, nicht vorher. |
| **2** | 02 | **Instant Upload Mode** | Der Code geht sofort an das Tablet. Die Alternative *Storage Mode* sammelt ihn nur im Gerät — dann passiert an der Kasse **gar nichts**. |
| **3** | 05 | **Bluetooth HID Mode** | HID heißt: der Scanner meldet sich als **Tastatur**. Nur das versteht die Kasse. |
| **4** | 05 | **Compulsory Pair with Bluetooth** | Bringt ihn in den Kopplungsmodus. Danach am Tablet unter Bluetooth verbinden. |
| **5** | 12 | **German** | **Der wichtigste Code von allen.** Siehe unten. |
| **6** | 11 | **Add Carriage Return (0x0D)** | Das Enter hinter dem Code. Ohne Enter passiert nichts. Ist ab Werk gesetzt — zur Sicherheit trotzdem scannen. |
| **7** | 13 | **No Change** (Upper/Lower Case) | Der Code wird so übertragen, wie er ist. |
| **8** | 10 | **30min** (Sleep Time) | Ab Werk schläft er nach **5 Minuten**. Am Stand ist das zu kurz — der erste Scan nach der Pause geht verloren. |
| **9** | 10 | **Vibration ON** | Auf dem Weihnachtsmarkt hörst du den Piepser nicht immer. Lautstärke steht ab Werk schon auf *High*. |

Fertig. Alles andere kann bleiben, wie es ist.

---

## Wenn du lieber den USB-Dongle nimmst

Statt Schritt 3 und 4:

| Seite | Code |
|---|---|
| 04 | **2.4G Mode** |
| 04 | **Compulsory Pair with Dongle** — dann den Dongle einstecken |

Der Dongle ist stabiler und braucht kein Koppeln. Nur: das Tablet muss einen USB-Anschluss
haben (ggf. per Adapter).

---

## Warum „German" der wichtigste Code ist

Im Heft steht es auf Seite 12 selbst: *„American English Keyboard is the default."*

Der Scanner überträgt keine Zeichen — er **drückt Tasten**. Steht er auf amerikanischer
Tastatur und das Tablet auf deutscher, drückt er die richtige Taste an der falschen Stelle.

* **Ziffern sind nicht betroffen.** Die Artikelnummern (01001, 02003 …) funktionieren auch
  falsch eingestellt.
* **Sonderzeichen schon.** Auf den Mitgliedsausweisen steht `KNG|Köcheclub Werne|KC-0005|…`
  — und der senkrechte Strich liegt auf beiden Tastaturen woanders.

Also: **Scanner auf German, Tablet auf Deutsch.** Beide.

> **Die Kasse ist zusätzlich abgesichert.** Sie sucht die Mitgliedsnummer im *ganzen*
> gescannten Text statt hinter dem dritten Trennstrich, und Groß-/Kleinschreibung ist ihr egal.
> Geprüft mit zerstörtem Trennzeichen und mit reinen Großbuchstaben — der Ausweis wird trotzdem
> erkannt. Das ist ein Fangnetz, keine Einstellung. Trotzdem German scannen.

**Für den Windows-Rechner** (PC-Manager) gäbe es auf Seite 13 noch **International keyboard** —
das überträgt jedes Zeichen unabhängig vom Windows-Layout. Auf Android und iOS funktioniert es
nicht, deshalb für das Tablet: German.

---

## Was du auf keinen Fall scannen darfst

| Seite | Code | Was dann passiert |
|---|---|---|
| 02 | **Storage Mode** | Der Scanner sammelt die Codes im Gerät. An der Kasse passiert **nichts**, und es sieht aus, als sei er kaputt. |
| 03/07 | **Bluetooth SPP Mode** / **BLE Mode** | Kein Tastaturmodus. Die Kasse bekommt nichts. Das Heft sagt selbst, das sei nur „after downloading corresponding software". |
| 11 | **Add Carriage Return + Linefeed** | Sendet **zwei** Zeilenenden. Die Kasse bekommt den Code zweimal signalisiert. |
| 13 | **All Upper Case** / **All Lower Case** / **Inverse** | Nicht nötig — die Kasse kommt zwar damit klar, aber es verschleiert Fehler. |
| 08 | **Always on / Continuous mode** | Dauerlesen. Am Stand wirft er dieselbe Nummer mehrfach in den Bon. **Button-press Mode** ist ab Werk richtig. |

---

## Zehn Sekunden Selbsttest

1. Kasse öffnen, einmal auf die Kachelfläche tippen (**nicht** ins Suchfeld).
2. Ein Artikeletikett scannen.

**Der Artikel liegt im Bon** → alles richtig.

**Fenster „Code nicht erkannt"** → darin steht die Zeile **„Gelesen wurde: …"** mit dem, was
tatsächlich angekommen ist:

* Buchstabensalat statt der Nummer → **Tastaturlayout**, Seite 12 „German" scannen.
* Die richtige Nummer, aber unbekannt → der Artikel hat diese Nummer nicht,
  siehe `ARTIKELNUMMERN_UND_QR_LIESMICH.md`.
* **Nummer unvollständig** (z. B. `0100` statt `01001`) → Übertragung zu schnell.
  Seite 07, **Medium** scannen. Die Kasse wartet bis zu 300 ms auf das nächste Zeichen und
  kommt damit auch mit der langsamsten Stufe zurecht.

---

## Wenn etwas nicht geht

| Symptom | Ursache | Seite / Lösung |
|---|---|---|
| Es passiert **gar nichts** | Storage Mode, oder SPP/BLE statt HID | 02 *Instant Upload*, 05 *Bluetooth HID Mode* |
| Der Code kommt an, aber ohne Zeilenende | Terminator auf *None* | 11 *Add Carriage Return (0x0D)* |
| Buchstabensalat | Falsches Tastaturlayout | 12 *German* |
| Zeichen fehlen | Übertragung zu schnell | 07 *Medium*, notfalls *Low* |
| Erster Scan nach einer Pause fehlt | Sleep nach 5 Minuten | 10 *30min* |
| Nummer landet **doppelt** im Bon | Dauerlesen, oder CR+LF als Terminator | 08 *Button-press Mode*, 11 nur *Carriage Return* |
| Kopplung schlägt fehl | Nicht im Kopplungsmodus | Taste **8 Sekunden** halten (Seite 05), oder *Compulsory Pair* neu scannen |
| Bildschirmtastatur des Tablets ist weg | Normal, sobald eine Hardware-Tastatur verbunden ist | Android: *Einstellungen → System → Sprachen und Eingabe → Physische Tastatur → Bildschirmtastatur anzeigen* |
| **„Ausweis nicht bekannt"** | Bediener nicht in der Liste dieser Kasse | PC-Manager → Bediener → an die Kassen senden |

---

## Der Ablauf zum Vorführen

1. **Artikeletikett** scannen → liegt sofort im Bon, mit Pfand.
2. **Mitgliedsausweis** scannen → oben links springt der Bediener um.
3. **QR auf der grünen Zahltaste** scannen → der Bon ist durch.
4. Falls die Zeiterfassung eingerichtet ist: **Uhrknopf**, dann Ausweis → Kommen/Gehen.

Der Scanner darf dabei überall hin zielen — die Kasse hört auf der ganzen Oberfläche zu.
Steht der Cursor im **Suchfeld**, landet der Code dort; das funktioniert auch, sieht nur
anders aus.
