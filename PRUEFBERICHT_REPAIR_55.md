# Prüfbericht Repair 55: Echtbetriebssimulation

## Umfang

- Vier simulierte Kassen über vier Weihnachtsmarkttage.
- 8.200 Bons mit 18.270 Positionen und 21.182 verkauften Einheiten.
- Verkäufe, Pfand, Pfandrückgaben, Zusatzartikel und Nachkauf.
- Verschlüsselte Kassenübergaben, Managerimport, Dashboard und Bestandsrechnung.

## Ergebnis

- Alle vier Kassen-Hashketten sind vollständig und ohne Bruch.
- Jede Kasse benötigt rund 2,16 MB beziehungsweise höchstens 41,3 % des angenommenen 5-MB-Speichers.
- Der kompakte Managerbestand benötigt 3,09 MB beziehungsweise 59,0 %.
- Ein erneuter Import derselben 8.200 Vorgänge fügt keinen Vorgang doppelt ein.
- Die Detailtabelle zeigt höchstens 500 Zeilen; Kennzahlen, Filter und Diagramme rechnen weiterhin alle 8.200 Vorgänge.

## Sichtprüfung

Im Kassenbrowser wurden 21 reale Bedienvorgänge über Artikelwahl und Zahlabschluss durchgeführt. Der letzte Bon war anschließend in der Bonanzeige vorhanden. Im PC-Manager wurden folgende Sollwerte sichtbar bestätigt:

- Kunden/Bons: 8.200
- Umsatz: 85.266,00 €
- Menge: 21.182
- Durchschnitt: 10,40 €
- Bestände und Nachkauf: Würfelzucker, Servietten, Spekulatius, Rum 42 %, Amaretto und Rum 54 % korrekt.

## Architektur

- `EventSimulationCore` ist ein test-only Studio-Baustein und läuft nicht im Normalbetrieb.
- `SalesImportCore` ist die zentrale Runtime für kompakte, duplikatsichere Umsatzübernahmen.
- Testdaten werden nur mit `?kcSimulation=repair55` geladen und vorherige Managerdaten in der Sitzung gesichert.
- Studio-Katalog, TÜV-Regeln, Zentralmanifest und Release Monitor sind registriert.

## Bewertung

Technischer Status: **GREEN / Candidate**. Der Test belegt ausreichende Kapazität für das geprüfte Volumen von 8.200 Bons. Für den realen Weihnachtsmarkt bleiben Tagesexporte und externe Sicherung weiterhin Pflicht.
