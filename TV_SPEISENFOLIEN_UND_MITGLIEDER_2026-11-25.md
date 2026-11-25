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

### Noch offen: zwei neue Fotos

Der Betreiber wünscht Mettendchen **in Scheiben obendrauf** und Heringsstipp **über den Kartoffeln** (kein ganzer Fisch).
Diese Fotos gibt es in der Kasse noch nicht. Bis sie kommen, zeigen die Folien die Kassenfotos mit ganzer Mettwurst
bzw. Heringsfilets. Zum Austauschen:

1. Neues Foto unter dem gleichen Namen in `media/speisen/` ablegen:
   `gruenkohl-mettendchen`, `sauerkraut-mettendchen`, `kartoffeln-heringsstipp`, jeweils `.webp` oder `.png` mit durchsichtigem
   Hintergrund. Ein `.jpg` geht auch, wird dann aber mit Goldrahmen gezeigt. Hat ein neues Foto einen grauen
   Studiohintergrund wie die Kassenfotos, lässt es sich mit `tools/tv-speisenfotos-freistellen.py` freistellen.
   Die alte `.webp` wird dabei ersetzt (das Werkzeug nimmt zuerst `.webp`, dann `.png`, dann `.jpg`).
2. Präsentation neu bauen (siehe unten).

## Mitglieder

Seit dem 25.11.2026 sind auch Klaus (hat zugestimmt), Reinhilde, Marianne und Karla zu sehen: nur Vorname und Spruch, ohne
Foto, wie bei allen anderen. Die Sprüche hat der Betreiber zuordnen lassen, jeweils ein in der Spruch-Auswahl noch freier
Spruch (Nr. 4, 6, 11, 13). In Supabase (`kc_wm_spruch_zuordnung`) wurde dafür nichts geändert.

| Mitglied | Spruch |
|---|---|
| Klaus | „Beim Köcheclub bin ich dabei, weil aus guten Ideen immer wieder tolle Aktionen entstehen.“ |
| Reinhilde | „Unsere Treffen sind für mich eine gute Mischung aus Fachgesprächen, Freundschaft und Geselligkeit.“ |
| Marianne | „Mir gefallen die freundschaftliche Atmosphäre und der offene Austausch innerhalb des Clubs.“ |
| Karla | „Gemeinsam planen, anpacken und anschließend zusammen feiern – genau das gefällt mir.“ |

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
