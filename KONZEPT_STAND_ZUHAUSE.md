# Konzept: Stand und Zuhause über Supabase (KS-04 „Stand-Brücke“)

**Stand: 13.11.2026**

## Das Bild in einem Satz

> Was zwischen den Kassen passiert, bleibt am Stand auf dem Mini-PC. Was zwischen Stand und
> Zuhause passiert, geht über Supabase – in beide Richtungen. Der PC zu Hause muss nicht laufen.

```
 Tablet 1 ┐                         ┌─────────── Supabase ───────────┐
 Tablet 2 ├─ WLAN ─ Mini-PC am Stand ┤  Briefkasten Stand → Zuhause   ├─ PC-Manager zu Hause
 Tablet 3 ┘         (Zentrale)       │  Briefkasten Zuhause → Stand   │  (wann man will)
                    + Fernseher      └────────────────────────────────┘
```

## Grundsätze

1. **Kassieren hängt nie am Internet.** Alles zwischen Tablets und Mini-PC läuft lokal weiter
   (Buchen, Ausverkauft zwischen den Kassen, Stempeln, Stammdaten an die Kassen).
2. **Der Mini-PC ist die einzige Stelle, die mit Supabase spricht** – nicht die Tablets. Das
   übernimmt ein neuer Teil des Manager-Dienstes, die **Stand-Brücke**. Sie braucht keinen
   geöffneten Browser (wichtig, weil der Bildschirm der Fernseher ist).
3. **Nichts geht verloren.** Was nicht hochgeladen werden konnte, wird nachgereicht (Merkstelle
   auf dem Mini-PC). Aufträge von zu Hause warten in Supabase, bis der Stand sie abholt.
4. **Veraltetes wird angezeigt.** Zu Hause steht immer „Stand zuletzt gemeldet vor …“; ab
   2 Minuten rot „VERALTET“. Nie „alles grün“, wenn man es nicht weiß.
5. **Keine Personendaten in der Brücke.** Kassen kennen nur Pseudonyme; die Brücke überträgt
   nur, was der PC-Manager heute schon lokal sieht. Mitglieder-Nachrichten/Chats gibt es dort nicht.
6. **Keine Kosten:** Supabase (vorhandenes Projekt), keine weiteren Dienste.

## Wie es technisch funktioniert (einmal, für alle Daten)

Der PC-Manager spricht heute mit dem Manager-Dienst über `http://127.0.0.1:47392`. Genau
dieser Kanal wird über die Cloud verlängert:

* **Lesen (Stand → Zuhause):** Die Stand-Brücke lädt
  * jedes Live-Ereignis (Verkauf, Storno, Ausverkauft, Abschluss, Stempeln, Kassenstart …)
    fortlaufend hoch, und
  * alle 30 s den aktuellen Stand der Übersichten, die der PC-Manager liest („Spiegel“).
* **Schreiben (Zuhause → Stand):** Schickt der PC-Manager zu Hause etwas „an die Kassen“, wird
  daraus ein **Auftrag** in Supabase. Die Stand-Brücke holt ihn (alle 5 s), führt ihn am Stand
  genau so aus, als käme er vom PC-Manager vor Ort, und meldet das Ergebnis zurück.
* **Zu Hause** erkennt der PC-Manager, dass kein Manager-Dienst auf dem eigenen PC läuft, und
  schaltet in den **Fernmodus**: dieselben Seiten, dieselben Knöpfe, Daten aus Supabase.

## Vollständige Liste aller Datenwege

| Datenweg | Richtung | Am Stand (lokal) | Von zu Hause (Fernmodus) |
|---|---|---|---|
| Live-Monitor (Verkäufe, Stornos, Bon-Verlauf) | Stand → Zuhause | WebSocket `live-monitor`, `live-event-log` | Ereignisse aus Supabase, alle 4 s |
| Kassen-LEDs / gekoppelt / zuletzt gesehen | Stand → Zuhause | `kassen-verbindungen` | Spiegel + Alter |
| Ausverkauft-Übersicht | Stand → Zuhause | `sold-out-status-alle` | Spiegel |
| Ausverkauft setzen (Admin-Center) | Zuhause → Stand | `sold-out-status/setzen` | Auftrag |
| Stammdaten / Preise „an alle Kassen senden“ | Zuhause → Stand | `master-data/push` | Auftrag |
| Dienstplan an die Kassen (aus dp2) | Zuhause → Stand | `dienstplan/push` | Auftrag |
| Dienstzeiten (Kommen/Gehen) ansehen | Stand → Zuhause | `zeiterfassung/liste` | Spiegel |
| Kassenabschlüsse ansehen | Stand → Zuhause | `abschluesse/liste` | Spiegel |
| Fernbefehle (z. B. Abschluss anfordern, Gerät verloren/Löschen) | Zuhause → Stand | `remote-command/queue` | Auftrag |
| Gerät verloren: Kopplung widerrufen | Zuhause → Stand | `kassen/kopplung-widerrufen` | Auftrag |
| Geld-Übergabe / Finance-Übergabe an eine Kasse | Zuhause → Stand | `api/v1/cash-transfer/queue`, `finance-transfer/queue` | Auftrag |
| Bestätigungen der Kassen zu Geld-Übergaben | Stand → Zuhause | `cash-transfer-confirmations`, `gelduebergaben-bestaetigungen-abholen` | Spiegel |
| Gutscheine im Umlauf | Stand → Zuhause | `gutscheine/liste` | Spiegel |
| Bargeld-Protokolle / Übergaben | Stand → Zuhause | `bargeld/protokolle`, `bargeld/uebergaben` | Spiegel |
| Bargeld-Übergabe / Protokoll erfassen | Zuhause → Stand | `bargeld/uebergabe`, `bargeld/protokoll` | Auftrag |
| Verbindungsqualität (Fernverkehr-Dashboard) | Stand → Zuhause | `verbindungsqualitaet` | Spiegel |
| Startprotokoll der Kassen | Stand → Zuhause | `kassen/startprotokoll` | Spiegel |
| Verbindungsprüfung / Diagnose | – | lokal | zeigt „Fernmodus“ statt falscher Fehler |
| **Datenschlüssel der Kassen** (`kassen/datenschluessel`) | – | lokal | **bewusst NICHT** – nur am Stand |
| Zentrale Personen/Pseudonyme (`zentral/*`) | – | lokal | nicht nötig – der PC-Manager zu Hause ist selbst angemeldet |

Schon heute direkt mit Supabase (unverändert): Tagesabschluss-Upload, Money-Butler-Eingang,
Bargeld-Einstellungen, Dienstplan aus dp2, Zeiterfassungs-Zugänge, Etiketten/Artikelinfos.
Diese laufen in dem PC-Manager, der gerade geöffnet ist – im Fernmodus also zu Hause, und ihre
Ergebnisse gehen über die Aufträge zum Stand.

## Was man wissen muss (ehrlich)

* **Money Butler → Kasse** läuft weiterhin über einen geöffneten PC-Manager (zu Hause oder am
  Stand). Ist nirgends einer offen, wartet die Übergabe in Supabase – sie geht nicht verloren.
* **Stammdaten werden zu Hause gepflegt.** Wer am Stand-PC zusätzlich Artikel ändert, erzeugt
  zwei Stände; maßgeblich ist, was zuletzt „an alle Kassen gesendet“ wurde.
* Aufträge von zu Hause kommen an, sobald der Stand online ist – meist nach wenigen Sekunden.
  Ist der Stand offline, sagt der PC-Manager das („unterwegs zum Stand“) statt „erledigt“.

## Zwei Startdateien – mehr muss man nicht wissen

| Wo | Startdatei | Was läuft |
|---|---|---|
| **Am Stand (Mini-PC)** | `KC_Manager_Start.cmd` | Manager-Dienst, 3 Tablet-Kassen, Webserver, Stand-Brücke |
| **Zu Hause** | `KC_Zuhause_Start.cmd` | nur der PC-Manager – liest den Stand über Supabase (Fernmodus) |

Zu Hause darf **nicht** `KC_Manager_Start.cmd` benutzt werden: das würde einen zweiten, leeren
Manager mit eigenen Kassen starten.

## Einrichtung (einmalig)

1. Supabase: Migration `supabase/migrations/20261113_kc_stand_bruecke.sql` einspielen.
2. Am Mini-PC: PC-Manager öffnen, oben bei Supabase anmelden (Admin-Konto), unter
   „Verbindung prüfen“ → **„🌐 Diesen PC als Stand anmelden“**, Namen eingeben. Fertig – die
   Stand-Brücke speichert ihren Zugang im Datenordner und meldet sich ab dann bei jedem Start
   selbst. Im schwarzen Fenster steht „Verbindung nach Hause (Supabase): eingerichtet …“.
3. Zu Hause: `KC_Zuhause_Start.cmd` starten, im PC-Manager bei Supabase anmelden. Gibt es nur
   einen Stand, wird er automatisch gewählt. Unten rechts steht „Fernmodus · Stand … ·
   zuletzt gemeldet vor … s“.

## Geprüft (Tests)

* `tests/stand-bruecke-supabase.test.cjs` – SQL-Funktionen echt in PostgreSQL: Rechte, Geheimnis,
  erlaubte Pfade, doppelte Ereignisse, Aufträge, Abmelden (29/29).
* `tests/stand-zuhause-ende-zu-ende.test.cjs` – ganze Strecke mit Stand-Start, Zuhause-Start,
  zwei PC-Managern, Tablets: Live-Monitor, Übersichten, Ausverkauft und Stammdaten von zu Hause,
  Internetausfall am Stand mit Nachreichen, nichts doppelt (30/30).
* Beide brauchen eine Test-Datenbank (`KC_TEST_PG`, Grundlage `tests/supabase-nachbau/grundlage.sql`
  + Migration) und das npm-Paket `pg`; ohne werden sie übersprungen.

## Sicherheit

* Die Stand-Brücke hat ein eigenes **Stand-Geheimnis** (nur als Hash in Supabase), kein
  Benutzerkonto, keinen Dienstschlüssel. Sie kann nur: eigene Ereignisse/Spiegel melden, eigene
  Aufträge abholen und quittieren.
* Lesen und Aufträge anlegen dürfen nur angemeldete **Admins des eigenen Vereins**
  (`kc_manager_memberships`, wie bei den Zeiterfassungs-Zugängen).
* Aufträge sind auf eine feste Liste von Pfaden beschränkt; alles andere lehnt Supabase UND der
  Stand ab.
* Ein Stand kann im PC-Manager abgemeldet werden (Geheimnis sofort ungültig).
