# Prüfbericht Repair 48

## Mitglieder und Sprüche

Die Weihnachtsmarkt-Präsentation enthält 18 Mitgliedsfolien. Thomas Hess und
Christina Brösel wurden ergänzt. Für zwei noch nicht belegte Namen sowie Ruths
Nachnamen bleiben sichtbare redaktionelle Platzhalter erhalten; es wurden keine
Personendaten erfunden.

Im PC Manager steht eine zentrale Tabelle mit allen 18 Namen und Aussagen zur
Verfügung. Namen sind direkt änderbar. Ein Spruch kann über eine Auswahlliste
oder mit den Pfeiltasten einer anderen Person zugeordnet werden. Bereits
verwendete Aussagen werden dabei getauscht, sodass jede Aussage genau einmal
vorkommt.

## Preislisten und Rezept

Die Vorlage wurde auf 28 Folien erweitert:

- Preisliste alkoholische Getränke
- Preisliste alkoholfreie Getränke
- Preisliste Speisen
- Rezeptkarte Eierlikörpunsch

Name, Kurzbeschreibung und Verkaufspreis der Preislisten werden beim Rendern
aus den aktuellen Artikelstammdaten des PC Managers übernommen. Vorlagenwerte
dienen nur als Rückfall, wenn ein Artikel noch nicht angelegt ist. Pfand wird
nicht in den Getränkepreis eingerechnet und steht separat in der Fußnote.

## Daten- und Migrationsschutz

Die Mitglieder- und Preislistenmigrationen sind getrennt versioniert. Vor der
ersten Inhaltsmigration wird jeweils eine Sicherung im lokalen Speicher
angelegt. Andere Folien bleiben bei einer gezielten Aktualisierung erhalten.
Die zentrale Präsentationsquelle, die bearbeitbare KCTV-Datei und die
Prüfseitenquelle verwenden denselben Vorlagenstand `1.1.0`.

## Verifikation

- 26 automatisierte Tests erfolgreich
- JavaScript-Syntaxprüfung für alle Paketdateien erfolgreich
- zentrale JSON-Dateien syntaktisch geprüft
- praktische Sicht- und Bedienprüfung bleibt Freigabeschritt des Candidates

Status: Candidate bis zur praktischen Sicht- und Bedienprüfung.
