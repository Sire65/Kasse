# KC Sync – Manager zuhause, Kasse am Markt (Fernzugriff)

Voraussetzung: Portweiterleitung Port 8543 (TCP) in deiner FritzBox eingerichtet (erledigt),
MyFRITZ!-Adresse vorhanden (z. B. 5nzazpgfhlsk3oie.myfritz.net).

## Zuhause (einmalig einrichten, dann immer offen lassen)

1. Auf dem PC zuhause, im Ordner `kc-sync-installation-und-backend`, öffnen (Eingabeaufforderung):
   ```
   node run-manager-service.js --port 8543
   ```
2. Es öffnet sich ein Fenster mit `[KC Sync Manager] HTTPS-Server läuft auf https://0.0.0.0:8543`.
   Dieses Fenster bleibt während des gesamten Marktbetriebs offen.
3. Den Admin-Schlüssel einmalig ablesen: im Ordner liegt jetzt eine Datei
   `kc-sync-manager.sqlite.admin-token.txt` - den Inhalt kopieren (lange Zeichenkette).

## Am Marktstand (auf einem eigenen, zweiten PC)

1. Die komplette ZIP auf den Markt-PC kopieren, entpacken.
2. Im Ordner `kc-sync-installation-und-backend` eine neue Datei `markttag-fernzugriff.json`
   anlegen mit folgendem Inhalt (Werte anpassen):
   ```json
   {
     "managerHost": "5nzazpgfhlsk3oie.myfritz.net",
     "managerPort": 8543,
     "adminToken": "<hier den kopierten Admin-Schlüssel einfügen>"
   }
   ```
3. Dort ausführen:
   ```
   node markttag-markt-fernzugriff.js
   ```
4. Es erscheinen die fertigen Kassen-Adressen im Fenster - auf jedem Tablet öffnen.

## Wichtig

- Der Marktstand braucht dafür durchgehend Internet (der Manager wird über das Internet erreicht).
- Der Manager ist dadurch grundsätzlich aus dem ganzen Internet erreichbar - der Admin-Schlüssel
  ist der einzige Schutz dafür, wer sich koppeln darf. Diesen Schlüssel wie ein Passwort behandeln.
- Für den normalen, lokalen Markttag-Betrieb (alles an einem Ort) bleibt weiterhin
  `KC_Markttag_Start.cmd` der richtige, einfachere Weg - dieser Fernzugriffs-Weg ist nur für den
  Fall gedacht, dass Manager und Kasse an unterschiedlichen Orten laufen sollen.
