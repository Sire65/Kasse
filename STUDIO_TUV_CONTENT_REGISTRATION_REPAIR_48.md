# Studio-/TÜV-Inhaltsregistrierung Repair 48

## Registrierter Stand

- Release: `0.31.3.6.48-tv-members-price-pages`
- TV-Präsentationsruntime: `0.29.40`
- Weihnachtsmarkt-Vorlage: `1.1.0`
- Umfang: 28 Folien

## Single Source of Truth

Verbindliche Quelle ist
`tv-content/weihnachtsmarkt-2026/presentation.js`. Daraus wird die bearbeitbare
Datei
`tv-content/weihnachtsmarkt-2026/Weihnachtsmarkt_Werne_2026_Bearbeitbar.kctv`
erzeugt. Die Prüfseitenkopie in `github-review-site/presentation-source.js`
muss inhaltlich identisch bleiben.

## Manager-Integration

`pc-manager/tv-weihnachtsmarkt-presentation.js` stellt bereit:

- sichere Aktualisierung der 18 Mitgliederfolien;
- zentrale Zuordnungstabelle für Namen und Sprüche;
- sichere Aktualisierung der drei Preislisten und der Rezeptfolie;
- Übernahme aktueller Artikelbezeichnungen, Kurzbeschreibungen und Preise aus
  dem PC Manager;
- getrennte Sicherungen vor Mitglieder- und Katalogmigration.

Die Preislisten zeigen den Artikelpreis ohne Pfand. Der Pfandhinweis bleibt ein
eigenes Textelement der jeweiligen Getränkefolie.

## Release-Gate

Der Komponentenregistereintrag
`christmasPresentationTemplate` fordert Version `1.1.0`. Die praktische
Sichtprüfung bleibt im Komponentenregister und im zentralen Release-Manifest
auf `PENDING`, bis der Candidate auf dem vorgesehenen 16:9-Anzeigegerät geprüft
wurde.
