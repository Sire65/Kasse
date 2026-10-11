# Schulungsvideos für die Kasse (KC-KASSE-SCHULUNGSVIDEOS)

Stand 11.10.2026 · Modul `pos/kc-schulungsvideos.js` 0.1.0 (Kasse und Schulung gleich)

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
| 🖥️ Oberfläche | Kopfzeile und Lampen · Warengruppen · Artikelkacheln · Warenkorb · BAR und RÜCKGELD · MEHR und ☰ |
| 🛒 Verkaufen | Ein Artikel · Mehrere Warengruppen · Menge · ½ Portion · Variante über ＋ · Kombi und Favoriten · Löschen |
| 💶 Rückgeld & Bezahlen | BAR passend · RÜCKGELD mit Schein · „Stimmt so“ und Trinkgeld · Zu wenig gegeben · Bons verbinden und trennen |
| 🍷 Pfand | Pfand kommt von selbst · Glas zurück · Mehrere Gläser · Pfand als Spende oder Trinkgeld |
| ↩ Reklamationen | Geld zurück · Ersatz · Falsch berechnet |
| 💸 Entnahmen | **Erst einkaufen, dann entnehmen (fertig)** · Mit Bon · Ohne Bon · Rückgeld richtig behandeln |
| 🍽️ Personal & Helfer | Personalverpflegung · Feierabend-Essen · Helfer-Verpflegung |
| ⭐ Sonderfälle | Gäste/Spendieren · Konto · Rabatt/Stammgast · Gutschein · Wertmarke · Happy Hour · Ausverkauft · Allergene |
| 👤 Schicht & Team | Schicht beginnen · Ausweis vergessen · Bediener wechseln · Kasse sperren · Schichtwechsel |
| ⚡ Störungen | Stoßbetrieb · WLAN weg · Neustart · Kunde holt Geld (Bon parken) |
| 🗂️ Kassenwart | Eröffnung · Übergabecode · Bargeldübergabe · X-Bericht · Tagesabschluss |

## Etappen
1. **Erledigt (0.1.0):** Knopf unter MEHR, Themen-Kacheln, Player mit Laura, Marc, Finger und Ton, Bewertung auf dem
   Gerät, erstes Video „Erst einkaufen, dann entnehmen“.
2. Oberfläche, Verkaufen, Rückgeld & Bezahlen, restliche Entnahmen.
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
