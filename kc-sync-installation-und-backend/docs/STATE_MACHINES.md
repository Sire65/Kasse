# Zustandsmaschinen – KC Sync (Baustufe 0)

**Status:** Architektur-Entwurf zur Prüfung. Keine TÜV-/TSE-/BSI-/fiskalische Aussage.
Löst A-07: getrennte Zustände statt einer gemeinsamen Ampel.

## 1. Manager-Sync (Discovery + Verbindung + Kopplung)

```
UNGEKOPPELT
   |  QR-Kopplung erfolgreich (pair())
   v
GEKOPPELT_GETRENNT
   |  mDNS/DNS-SD findet Manager, Fingerprint stimmt mit gepinntem Wert ueberein
   v
WIRD_GEPRUEFT  --(Health-Check schlaegt fehl)--> GEKOPPELT_GETRENNT
   |  Health-Check erfolgreich UND Fingerprint stimmt
   v
VERBUNDEN
   |  mehrere aufeinanderfolgende Health-Checks schlagen fehl (Hysterese, kein Flackern)
   v
GEKOPPELT_GETRENNT
```

Sonderfall Fremdmanager (A-03): Antwortet unter der bekannten/gefundenen Adresse ein Geraet
mit abweichendem Public-Key-Fingerprint, wird das wie "kein Manager gefunden" behandelt -
niemals wie "verbunden". Kein automatisches Neu-Pinnen ohne erneute, bewusste QR-Kopplung.

Credential widerrufen: Aus jedem verbundenen Zustand direkter Uebergang nach UNGEKOPPELT
(Server antwortet credential_revoked) - erneute QR-Kopplung erforderlich, kein automatischer
Neuversuch mit demselben Credential.

## 2. TSE (unabhaengig vom Manager-Sync, sofern/wenn ein TSE-Modul aktiv ist)

```
UNBEKANNT -> BEREIT -> GESTOERT -> BEREIT
```
Diese Zustandsmaschine ist in Baustufe 0 nur als Platzhalter definiert - das System laeuft laut
Bestandsdokumentation aktuell ohne TSE. Wichtig ist ausschliesslich die Trennung: Ein
TSE-Fehler beeinflusst niemals den Manager-Sync-Zustand und umgekehrt.

## 3. Terminal (Kartenzahlung), Drucker, Speicher

Gleiches Prinzip: jeweils eigene, unabhaengige Zustaende (BEREIT / GESTOERT / UNBEKANNT),
eigene Anzeige, kein Verschmelzen mit dem Manager-Sync-Status. Ein voller Speicher blockiert
z. B. die Warteschlange, nicht aber notwendigerweise den Verkaufsvorgang selbst - das ist eine
fachliche Entscheidung, die ausserhalb von Baustufe 0 getroffen werden muss.

## 4. Outbox-Verarbeitung (pro Ereignis)

```
PENDING
   |  erfolgreich gesendet, noch keine Bestaetigung
   v
SENT
   |  Manager bestaetigt (acknowledged ODER duplicates)
   v
ACKED  -> wird aus der Outbox geloescht
```

Bricht die Verbindung zwischen PENDING und SENT ab: Eintrag bleibt PENDING, wird beim
naechsten Verbindungsversuch erneut gesendet (A-04, "mindestens einmal"). Bricht sie zwischen
SENT und ACKED ab (Antwort ging verloren, Server hat aber gespeichert): erneuter Versuch
sendet dasselbe eventId erneut, Server antwortet mit duplicates, Eintrag wird dennoch
korrekt aus der Outbox entfernt - kein Endlos-Zustand moeglich.

## 5. Discovery (Ablauf im Companion-Dienst, nicht im Browser - A-01)

```
GESTARTET
   |  gemerkte Kopplung vorhanden?
   +- Ja  -> Verbindungsversuch direkt zur gekoppelten Manager-ID
   |          |  erfolgreich -> Manager-Sync: VERBUNDEN
   |          |  fehlgeschlagen -> mDNS/DNS-SD-Suche nach derselben Manager-ID
   +- Nein -> Warten auf QR-Kopplung (kein automatisches Raten, kein Scan)
```

mDNS/DNS-SD sucht gezielt nach der bekannten Manager-ID im Dienst-Eintrag, nicht nach
"irgendeinem" Manager - findet die Suche mehrere Geraete mit unterschiedlicher ID, wird keines
davon automatisch gewaehlt.
