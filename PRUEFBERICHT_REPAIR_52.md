# Prüfbericht Repair 52

## Umgesetzte Stufen

### Stufe 1 – deutsche Bezeichnungen und Kundenanalyse

- Folientypen werden im Dashboard ausschließlich deutsch bezeichnet.
- Kunden werden als eindeutige, nicht als Training markierte Bons gezählt.
- Vergleich nach Kalendertag, Wochentag und Stundenbereich.
- Filter für Zeitraum, Wochentag, Uhrzeit, Artikel, Warengruppe, Kasse und Bediener.
- Umsatz, Kunden, Menge und Durchschnittsbon.
- Balken- und Kreisdiagramme sowie eine Bon-Detailtabelle.

### Stufe 2 – zentrale Bestandsführung

- Ausschließlich im PC-Manager; keine Inventurpflicht an Kassen oder im Stand.
- Anfangsbestand direkt in der Bestandsliste.
- Nachkäufe, Korrekturen, Schwund und Bruch als protokollierte Buchungen.
- Nach jedem Kassenimport wird der bestätigte Verbrauch neu berechnet.

### Stufe 3 – Verbrauchsartikel

- Sprühsahne, Senf, Würfelzucker, Servietten, Außer-Haus-Gefäße,
  In-Haus-Gefäße, Spekulatius, Kakaopulver, Amaretto, Rum 42 % und Rum 54 %.
- Drei Würfelzucker je Feuerzangenbowle sind als bestätigte Regel hinterlegt.
- Unbekannte Mengen werden nicht erfunden und erscheinen grau als
  „Messung erforderlich“.

### Stufe 4 – Ampel und Nachkaufliste

- Grün: rechnerisch ausreichend.
- Gelb: Reserve knapp.
- Rot: Mindestbestand oder prognostizierter Bedarf überschritten.
- Grau: Verbrauchswert muss zuerst gemessen werden.
- Prognosen verändern niemals selbstständig einen Bestand.

## Abgrenzung

Keine Änderung an Kassenverkauf, POS-Oberfläche, TV-Präsentation, Navigation,
Zeiterfassung oder Rezepturpflege. Eine optionale reine Bestandsanzeige an der
Kasse ist ausdrücklich eine spätere Erweiterung und keine Voraussetzung.

## Verifikation

- JavaScript-Syntaxprüfung bestanden.
- 30 von 30 automatisierten Tests bestanden.
- Studio-Katalog, TÜV-Regeln, Komponentenregister und Release-Manifest ergänzt.
- Praktischer Browser- und Echtdaten-Rundlauf bleibt für Gold offen.
