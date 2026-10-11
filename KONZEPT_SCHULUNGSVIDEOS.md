# Schulungsvideos für die Kasse (KC-KASSE-SCHULUNGSVIDEOS)

Stand 11.10.2026 · Abspieler `pos/kc-schulungsvideos.js` 0.3.0 · Inhalte `pos/kc-schulungsvideos-inhalt.js` 0.3.0 (Kasse und Schulung gleich)

## Wunsch Betreiber
* Video-Schulung nach dem Muster der Club-App: **kleine Videos, immer ein Thema** (30–90 Sekunden).
* **Schulungskasse:** immer. **Echte Kasse:** nur im **Trainingsmodus**.
* Aufruf unter **MEHR → 🎬 Schulungsvideos**, dort **Kacheln für die Bereiche**.
* **Laura und Marc** erklären, ein **Finger** zeigt jede Aktion live an der echten Oberfläche.
* **Bewertung 👍/👎 zentral auf dem Server.**
* Wichtig bei Entnahmen: **erst einkaufen, dann entnehmen.** Nicht vorher Geld nehmen und sofort buchen, denn es kommt
  Rückgeld zurück, und dann wären mehrere Buchungen nötig.

## Regeln (im Modul umgesetzt, Test `tests/schulungsvideos.test.cjs`)
1. Knopf, Übersicht und Start gibt es nur im Trainingsmodus (Schulungskasse: fest an).
2. Wird der Trainingsmodus während eines Videos abgeschaltet, stoppt das Video sofort.
3. Liegt ein offener Bon im Warenkorb, startet kein Video.
4. Ein Video **speichert nie**. Der Finger tippt bis kurz vor „Speichern“/„BAR“. Am Ende sind alle Fenster zu
   und der Warenkorb ist leer.
5. Der Finger und der Lichtkegel kommen aus dem vorhandenen `training-demo-bridge.js` (`window.KCLiveDemo`).
   Die eingebettete Schulung (`?embeddedTraining=1`) bleibt unverändert.
6. Laura und Marc sind die Figuren aus `avatar-core`. Der Ton kommt aus der Sprachausgabe des Geräts
   (kostenlos, offline). Ohne Sprachausgabe läuft das Video mit Lesezeit.
7. Die Sprechblase weicht nach oben aus, wenn sie das gezeigte Element verdecken würde.

## 0.2.0 – so klar wie die Club-App
Betreiber: „Die Videos in der Club-App gefallen mir besser – klare Stimme, und der Finger zeigt es.“
* **Eine klare Stimme:** die beste deutsche Stimme des Geräts, mit derselben Rangfolge wie in der Club-App
  (Premium/Natural vor bekannten guten Stimmen, keine Spaßstimmen). Marc bekommt nur dann eine Männerstimme, wenn
  eine gute vorhanden ist. Die Tonhöhe wird nie mehr verstellt.
* **Satzweise vorlesen** in ruhigem Tempo. Lange Texte brechen sonst auf manchen Tablets ab.
* **Ein Gedanke je Schritt:** ein kurzer Satz, und genau dabei tippt der Finger (`tipp`). Das Ziel leuchtet auf,
  während der Finger hinfährt. Erwähnte Knöpfe pulsieren (`zeig`).
* **⏸ Pause / ▶ Weiter** und Fortschritt „3 / 15“ mit Balken. Größere Schrift in der Sprechblase.
* Die Sprechblase springt sofort mit, wenn ein Fenster auf- oder zugeht.

## 0.3.0 – 22 Videos und Stimmen je Gerät
Betreiber: „Mach die nächsten Videos wie geplant. Bau das so flexibel, dass die Stimmen je nach Gerät ausgetauscht werden können.“
* **Inhalte getrennt vom Abspieler:** `kc-schulungsvideos-inhalt.js` enthält nur Themen, Texte und Fingerwege.
  Ein neues Video ist ein neuer Eintrag dort.
* **22 kleine Videos:** Oberfläche 6, Verkaufen 7, Rückgeld & Bezahlen 5, Entnahmen 4. Jedes verweist auf die passende
  Aufgabe der Übungsliste.
* **🔊 Stimmen je Gerät** (Video-Übersicht → 🔊 Stimmen): Stimme für Laura und Marc wählen oder „Automatisch – beste
  Stimme“, Tempo Langsam/Normal/Schnell, ▶ Probe hören, Hilfe zum Einrichten besserer Stimmen (iPad, Android, Windows).
  Gespeichert nur auf diesem Gerät (`kc_schulungsvideo_stimmen_v1`). Fehlt die gewählte Stimme, spricht automatisch die
  beste vorhandene.
* **Stimm-Quellen als Adapter** (`STIMM_QUELLEN`): heute die Sprachausgabe des Geräts. Eine weitere Quelle, z. B. vorab
  aufgenommene Tondateien für überall gleichen Klang, ist ein neuer Eintrag mit `stimmen()` und `sprich()`. Die
  Auswahl „Quelle“ erscheint, sobald es mehr als eine gibt.
* **Nie buchen:** BAR, STIMMT SO, Speichern und das Bestätigen beim Bon-Verwerfen werden nur gezeigt. Das Verwerfen
  würde einen Storno protokollieren, deshalb tippt das Video dort auf Abbrechen. Eine einzelne Zeile zu löschen
  protokolliert nichts und wird vorgeführt.
* **Prüfmodus** (`KCSchulungsvideos.pruefung({streng, tempo})`): Der Test spielt alle Videos in Kasse und Schulung ab.
  Jeder Knopf, den der Finger antippt oder der pulsiert, muss vorhanden sein. Gebucht werden darf nichts.
* Behoben: Mit mehreren Videos in einer Reihe wurde die Reihe beim Suchen geleert (Fehler seit 0.1.0, fiel mit nur
  einem Video nicht auf).

## Aufbau (wie in der Club-App)
* `THEMEN`: die Kacheln. `VIDEOS`: ein Eintrag ist ein kleines Video mit `id`, `stand` (Fassung), `thema`, Stationen.
* Station: `wer` (laura/marc), `x` (gesprochener Text), optional `tafel` (Bild-Tafel), `tun` (Finger-Vorführung),
  `vor` (vorbereiten).
* Eine Überarbeitung zählt `stand` hoch, dann zählt die Bewertung neu.
* Kachel zeigt „✓ x von y angesehen“, die Liste zeigt 👁 Anzahl und ✅. Videos lassen sich anhaken und
  nacheinander abspielen.

## Videokatalog (geplant, rund 54 kleine Videos)
| Kachel | Kleine Videos |
|---|---|
| 🖥️ Oberfläche | Kopfzeile und Lampen · Warengruppen · Artikelkacheln · Warenkorb · BAR und RÜCKGELD · MEHR und Menü **(fertig)** |
| 🛒 Verkaufen | Ein Artikel · Getränk und Essen · Menge · ½ Portion · Variante über ＋ · Kombi und Favoriten · Löschen **(fertig)** |
| 💶 Rückgeld & Bezahlen | BAR passend · RÜCKGELD mit Schein · „Stimmt so“ und Aufrunden · Zu wenig gegeben · Vertippt? Korrigieren **(fertig)** |
| 🍷 Pfand | Pfand kommt von selbst · Glas zurück · Mehrere Gläser · Pfand als Spende oder Trinkgeld |
| ↩ Reklamationen | Geld zurück · Ersatz · Falsch berechnet |
| 💸 Entnahmen | Erst einkaufen, dann entnehmen · Mit Bon · Ohne Bon · Betrag korrigieren **(fertig)** |
| 🍽️ Personal & Helfer | Personalverpflegung · Feierabend-Essen · Helfer-Verpflegung |
| ⭐ Sonderfälle | Gäste/Spendieren · Konto · Rabatt/Stammgast · Gutschein · Wertmarke · Happy Hour · Ausverkauft · Allergene |
| 👤 Schicht & Team | Schicht beginnen · Ausweis vergessen · Bediener wechseln · Kasse sperren · Schichtwechsel |
| ⚡ Störungen | Stoßbetrieb · WLAN weg · Neustart · Kunde holt Geld (Bon parken) |
| 🗂️ Kassenwart | Eröffnung · Übergabecode · Bargeldübergabe · X-Bericht · Tagesabschluss |

## Etappen
1. **Erledigt (0.1.0, 0.2.0):** Knopf unter MEHR, Themen-Kacheln, Player mit Laura, Marc, Finger und Ton, Bewertung auf dem
   Gerät, erstes Video „Erst einkaufen, dann entnehmen“.
2. **Erledigt (0.3.0):** Oberfläche, Verkaufen, Rückgeld & Bezahlen, restliche Entnahmen; Stimmen je Gerät.
3. Pfand, Reklamationen, Personal & Helfer.
4. Sonderfälle, Schicht & Team, Störungen.
5. Kassenwart-Videos. Zentrale Bewertung: Tabelle `kc_kasse_video_bewertung` in Supabase-Core, Schreiben nur über
   eine Edge Function (kein Schlüssel im Browser), Spiegel- und Backup-Regel. Admin-Auswertung nur mit Zahlen:
   🟢 ab 80 % 👍, 🟡 beobachten, 🔴 unter 60 %, ⚪ unter 3 Stimmen.

## Offen
* **Zentrale Bewertung:** Bis die Server-Funktion steht, sammelt die Kasse die Bewertungen in
  `kc_schulungsvideo_bewertung_v1` (Feld `gesendet:false`). Danach werden sie nachgeschickt.
* **Schulungskasse:** Hier setzt ein Einkaufs-Grund den Haken „Bon / Quittung vorhanden“ schon selbst, auf der
  echten Kasse nicht. Das Video prüft deshalb erst und tippt nur, wenn der Haken fehlt.
