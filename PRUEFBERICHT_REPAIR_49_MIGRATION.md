# Prüfbericht Repair 49 – kontrollierte Migration

## Quelle

Migriert wurde der fachliche Inhalt aus
`KC_MarktKasse_V0_31_3_6_Repair_48_TV_Mitglieder_Preislisten_Candidate.zip`.
Die fremde ZIP wurde nicht als Gesamtversion übernommen.

## Übernommen

- 18 Mitgliedsfolien mit zentral bearbeitbaren Namen und Aussagen,
- Spruchauswahl und Tausch zwischen Mitgliedern,
- getrennte Sicherung vor Mitgliederaktualisierung,
- Preislisten für alkoholische Getränke, alkoholfreie Getränke und Speisen,
- getrennte Eierlikörpunsch-Rezeptfolie,
- getrennte Sicherung vor Preislisten-/Rezeptmigration,
- Darstellung der aktuellen Artikelbezeichnungen, Kurzbeschreibungen und Preise,
- synchronisierte Präsentationsquelle, KCTV-Datei und GitHub-Prüfseitenquelle,
- zugehörige Manager- und Player-Darstellungsregeln.

## Zusätzlich korrigiert

Der fremde Stand griff ausschließlich auf `window.articles` zu. Der reale
PC-Manager führt seine Artikelliste jedoch als globale `let articles`. Dadurch
hätten die Preislisten im Echtbetrieb nur die Rückfallpreise gezeigt, obwohl der
mitgelieferte Test grün war. Die Anbindung verwendet nun zuerst die echte
Manager-Artikelliste und fällt nur ersatzweise auf `window.articles` zurück.
Der Test bildet diese reale Variablenform jetzt nach.

## Nicht überschrieben

- TableCore V1.1.0 und Manager-TableCore-Adapter,
- Framework-Release-Monitor,
- NavigationCore und WindowCore,
- gemeinsame TV-Renderer-/Editor-Konsolidierung,
- Wetter, Zeiterfassung, Meldungswesen und Combobox-Stabilisierung,
- Kassen- und Rezepturfachlogik außerhalb der neuen TV-Inhaltsseiten.

## Versionskette

- Gesamtstand: `V0.31.3.6 Repair 49`
- TV-Präsentationsruntime: `0.29.40`
- Weihnachtsmarkt-Vorlage: `1.1.0`
- TableCore: `1.1.0`
- Manager-TableCore-Adapter: `0.1.0`
- Folienumfang der Vorlage: 28

## Automatische Prüfung

- JavaScript-Syntax aller nicht vendorisierten Dateien: bestanden,
- JSON-Syntax: bestanden,
- Gesamtsuite: 27 von 27 Testdateien bestanden,
- neue Katalog-/Mitgliederprüfung: bestanden,
- TableCore-Regression: bestanden,
- bestehende TV-, Navigation-, Kassen-, Rezept- und Zeiterfassungstests: bestanden.

## Freigabestatus

Candidate/Gelb. Praktische Sichtprüfung der 28 Folien im Manager und auf
TV/Vollbild sowie Desktop-, Tablet- und Mobilprüfung bleiben offen.
