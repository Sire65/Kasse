# TV-Präsentation Weihnachtsmarkt 2026 – Speisenfolien und vier weitere Mitglieder (25.11.2026)

Gebaut mit `tools/tv-endversion-bauen.cjs` → `tv-player/weihnachtsmarkt-2026-version-a.html` (über
`tools/tv-version-a-uebernehmen.cjs`) und `index.html` in Sire65/WM-Pr-s.

## Neue Speisenfolien (`tools/tv-speisenfolien.cjs`)

| Folie | links (mit) | rechts (ohne) | steht hinter |
|---|---|---|---|
| Lust auf Grünkohl? | Grünkohl mit Mettendchen 7,00 € | Grünkohl 5,50 € | Preisliste Speisen · Teil 1 |
| Lust auf Sauerkraut? | Sauerkrauteintopf mit Mettendchen 7,00 € | Sauerkrauteintopf 5,50 € | Lust auf Grünkohl? |
| Lust auf Kartoffeln? | Kartoffeln mit Heringsstipp 4,50 € | Kartoffeln mit Kartoffelcreme 3,50 € | Preisliste Speisen · Teil 2 |

- Die Preise kommen aus der Kasse (`pos/app.js`, Artikel `gruenkohlmett`, `gruenkohl`, `sauerkrautmett`, `sauerkraut`, `hering`,
  `knirpsecreme`). Wenn sich ein Kassenpreis ändert, reicht ein Neubau der Präsentation.
- Unter jedem Foto stehen Name und Preis, unten rechts steht der Hinweis „Serviervorschlag“. Jede Folie läuft 10 Sekunden.
- Die Fotos sind Freisteller aus den aktuellen Kassenfotos (`pos/assets/*_version_3.png`, Hintergrund durchsichtig, ohne
  Info-Symbol und Namensbalken), erzeugt mit `tools/tv-speisenfotos-freistellen.py` und abgelegt unter `media/speisen/`.

### Fotos

- **Kartoffeln mit Heringsstipp:** neues Foto vom Betreiber (25.11.2026, dritte Fassung: Schüssel mit kleinen Kartoffeln), Heringsstipp
  über den Kartoffeln, kein ganzer Fisch. Das Original liegt unter `media/speisen/quelle/kartoffeln-heringsstipp.png`, freigestellt mit
  `python3 tools/tv-speisenfotos-freistellen.py media/speisen/quelle/kartoffeln-heringsstipp.png media/speisen/kartoffeln-heringsstipp.webp --ohne-kassenrahmen --schale --glatt`
  (`--schale` nimmt die graue Außenwand der Schüssel mit; `--teller` ist für flache Teller auf hellem Grund).
- **Grünkohl und Sauerkraut mit Mettendchen:** Hier bleiben die Kassenfotos mit ganzer Mettwurst (Betreiber 25.11.2026).
- Ein Foto tauschst du aus, indem du es unter dem gleichen Namen in `media/speisen/` ablegst (`.webp` oder `.png` mit
  durchsichtigem Hintergrund; ein `.jpg` wird mit Goldrahmen gezeigt) und die Präsentation neu baust.

## Mitglieder

Seit dem 25.11.2026 sind auch Klaus (hat zugestimmt), Reinhilde, Marianne und Karla zu sehen: nur Vorname und Spruch, ohne
Foto, wie bei allen anderen. Die Sprüche hat der Betreiber zuordnen lassen, jeweils ein in der Spruch-Auswahl noch freier
Spruch (Nr. 4, 6, 11, 1). In Supabase (`kc_wm_spruch_zuordnung`) wurde dafür nichts geändert.

| Mitglied | Spruch |
|---|---|
| Klaus | „Beim Köcheclub bin ich dabei, weil aus guten Ideen immer wieder tolle Aktionen entstehen.“ |
| Reinhilde | „Unsere Treffen sind für mich eine gute Mischung aus Fachgesprächen, Freundschaft und Geselligkeit.“ |
| Marianne | „Mir gefallen die freundschaftliche Atmosphäre und der offene Austausch innerhalb des Clubs.“ |
| Karla | „Ich mache gerne mit, weil wir gemeinsam viel bewegen und dabei immer Spaß haben.“ |

## Nachgezogen

Die Änderungen vom 20.11.2026 standen bis jetzt nur in der fertigen Datei `tv-player/weihnachtsmarkt-2026-version-a.html`,
nicht im Bauwerkzeug. Jetzt sind sie im Bauwerkzeug: Annes Spruch, „Öffnungszeiten Weihnachtsmarkt“ und der eigene
Laufschrift-Block „Öffnungszeiten Köcheclub“. Dieser Block steht jetzt auch im durchgehenden Laufband; vorher war er nur in
den ausgeblendeten Laufschriften der einzelnen Folien enthalten.

## Neu bauen

```
git -C <WM-Pr-s.> show umfrage-2026-09:index.html > original.html
node tools/tv-endversion-bauen.cjs original.html media/backgrounds/rathaus-werne-weihnachtsmarkt-v2.jpg ende.html
node tools/tv-version-a-uebernehmen.cjs ende.html        # → tv-player/weihnachtsmarkt-2026-version-a.html
cp ende.html <WM-Pr-s.>/index.html                         # GitHub-Pages-Fassung
```

## Prüfung

- `tests/fernseher.test.cjs` 48/48: neue Prüfungen zu den 13 sichtbaren Mitgliedern, „jeder Spruch nur einmal“ und den
  Speisenfolien (zwei Fotos, Kassenpreise, links mit / rechts ohne, „Serviervorschlag“)
- `tests/praesentation-schutz.test.cjs` 13/13, `tv-hintergrund` 11/11, `rahmenprogramm-2026` alles OK,
  `tv-designer-konsolidierung` grün, `tv-musik` ohne Beanstandung
- `tests/allergene-weihnachtsmarkt-2026.test.cjs`: 4 Fehler (Info-Fenster Grünkohl in der Kasse), laut Commit vom 20.11.2026 schon vorher vorhanden,
  unabhängig von dieser Änderung

## Laufschrift höher (25.11.2026)

Die Laufschrift saß bei y=665 und war 48 px hoch. Damit endete sie nur 7 px über dem unteren Bildrand. Jetzt sitzt sie
auf allen Folien bei y=652 und ist 40 px hoch, das lässt 28 px bis zum unteren Rand. Inhalte, die bis in diesen Bereich
reichten (Preistafeln, Programmtafeln, Bildunterschriften, Wetterhinweis, QR-Fußzeilen, „Auf Wiedersehen 2027“), werden
im Bauwerkzeug automatisch angepasst (`laufschriftHoeher`). Große Flächen werden dabei unten gekürzt, kleine Felder etwas
niedriger gesetzt und nach oben gerückt. Ein Test prüft, dass nichts mehr in die Laufschrift ragt.

## Fotos gleich groß, Rand geglättet (25.11.2026)

- Auf jeder Speisenfolie erscheinen beide Fotos gleich breit, unten auf einer Linie und je Spalte mittig. Die Bildgröße
  liest `tools/tv-speisenfolien.cjs` aus dem Dateikopf (WebP, PNG, JPEG).
- Kartoffeln mit Kartoffelcreme neu freigestellt mit `--schale --glatt`. Die Schüssel hat jetzt einen vollständigen,
  runden Boden statt einer Ecke unten links. `--glatt` rundet die Ecken des Umrisses ab.
- Kartoffeln mit Heringsstipp: Die Schüssel ragt im Original unten aus dem Bild. `--schale` ergänzt bei neu gelieferten
  Fotos die fehlende Unterkante als Bogen durch die sichtbaren Kantenpunkte (Bild unten um 60 px fortgesetzt), `--glatt`
  rundet den Umriss ab. Die Kassenfotos werden weiter unverändert erzeugt.

## Schüsselböden vollständig (25.11.2026)

Bei den Kassenfotos liegt der Schüsselboden zum Teil tiefer als y=1010, bisher wurde dort abgeschnitten. Deshalb war
z. B. die Kartoffelcreme-Schüssel unten gerade abgeschnitten. Mit `--bis-balken` wird jetzt erst direkt über dem
braunen Namensbalken abgeschnitten (dessen Lage wird je Foto erkannt). Alle Freisteller entstehen mit
`bash tools/tv-speisenfotos-alle.sh`. Das Skript enthält die geprüften Einstellungen je Foto; beim Sauerkraut ohne Wurst
reicht `--schale --glatt`, mit `--bis-balken` entstünde dort ein grauer Keil aus dem Schatten.

## Durchgänge (25.11.2026)

Festgelegt im Bauwerkzeug (`durchgaengeFestlegen`):

- In jedem Durchgang läuft genau eine Speisenfolie: Durchgang 1 Grünkohl, 2 Sauerkraut, 3 Kartoffeln, dann wieder von vorn.
- „Wetteraussichten“ läuft nur in jedem zweiten Durchgang (1, 3, 5 …).
- Mitglieder: 2 je Durchgang, der Reihe nach (vorher liefen alle 13 in jedem Durchgang).
- Nach 78 Durchgängen beginnt die Präsentation von vorn. 78 ist das kleinste gemeinsame Vielfache der Takte (Speisen 3,
  Wetter 2, Mitglieder 13), daher bricht beim Neustart kein Takt und jedes Mitglied kommt im Umlauf gleich oft (12-mal).
  Vorher waren es 9 Durchgänge; dabei liefen die Wetteraussichten in Durchgang 9 und gleich wieder in Durchgang 1.

Ein Test prüft das mit der Auswahllogik der Präsentation selbst über einen ganzen Umlauf.

## Wechselnde Sprüche (25.11.2026)

Entscheidung des Betreibers: Alle 13 Mitglieder zeigen bei jedem Auftritt einen anderen Spruch, auch die 9, die ihren
Spruch im September selbst gewählt haben. Im Topf sind alle 20 Sprüche der Spruch-Auswahl (Nr. 18 in Annes Fassung).

- Erster Auftritt im Umlauf: der bisherige Spruch des Mitglieds, danach der Reihe nach weiter durch den Topf.
- Im Umlauf (78 Durchgänge, je Mitglied 12 Auftritte) zeigt niemand denselben Spruch zweimal.
- Die zwei Mitglieder eines Durchgangs haben nie denselben Spruch.

Das Bauwerkzeug legt den Plan fest (`spruchPlan` → `kcSpruchPlan` in den Präsentationsdaten). Die Präsentation setzt den
Spruch beim Laden eines Durchgangs ein, bevor die Folie gezeichnet wird; die Schriftgröße passt sich also wie gewohnt an.
Tests prüfen den Plan über den ganzen Umlauf. Im Browser habe ich die Durchgänge 1–9 durchgeklickt: Alle angezeigten
Sprüche entsprechen dem Plan.

## Keine Sonne vor dem Abend-Rathaus (25.11.2026)

Der Rathaus-Hintergrund zeigt den Weihnachtsmarkt am Abend. Bei klarem Wetter erschien bisher oben rechts eine Sonne als
Wettereffekt; die gibt es jetzt nicht mehr. Über den Folien erscheinen nur noch Schnee oder Regen (nach dem echten Wetter
in Werne), die Schlussfolie behält Feuerwerk. Die Wetterkacheln (heute, morgen, Aussichten) zeigen weiter die
Tagesvorhersage, also auch eine Sonne.
