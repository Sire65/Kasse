# KC MarktKasse – Golden-Master-Regeln

Stand: 19.09.2026

## Verbindliche Quelle

**Einzige Entwicklungs- und Release-Quelle ist `Sire65/Kasse` mit Zielbranch `main`.**

Der PC-Manager ist Bestandteil dieses Repositories. Kopien in ZIP-Dateien, Archiv-Repositories, Schulungspaketen oder anderen Repositories sind **keine Entwicklungsquelle**.

## Rollen der Ablagen

- `Kasse/main`: Golden Master / einzige Quelle für den aktuellen freigegebenen Entwicklungsstand.
- Feature-/Fix-Branches: kurzlebige Arbeitsstände. Änderungen kommen ausschließlich per geprüftem Merge nach `main`.
- `Kasse-Archiv`: unveränderliches Versionsarchiv freigegebener Komplettstände; keine Weiterentwicklung.
- `KC-Bilderrechner`: Schulungs-/Laufzeitpaket. Eingebettete Kassen-/Managerteile werden aus einem eindeutig bezeichneten Kasse-Commit abgeleitet; keine unabhängige Manager-Weiterentwicklung.
- ZIP-Pakete: erzeugte Release-Artefakte. Ein ZIP ist niemals die Quelle für spätere Entwicklung.

## Release-Identität

Jeder neue Release muss mindestens festhalten:

1. Release-/Build-Version,
2. Erstellungsdatum,
3. exakten Git-Commit aus `Kasse/main`,
4. Status (Candidate/Released),
5. Versionen der gekoppelten Komponenten,
6. Ergebnis der Regression/TÜV-Prüfung.

Eine ZIP-Datei ohne zuordenbaren Commit gilt nur als historisches Artefakt.

## Änderungsweg

1. Aktuelles `main` als Basis.
2. Eigener Feature-/Fix-Branch.
3. Nur gezielte Änderung.
4. Automatische Tests und relevante Regression.
5. Praktische Sichtprüfung, wenn UI betroffen ist.
6. Pull Request.
7. Erst nach erfolgreicher Prüfung Merge nach `main`.
8. Erst aus diesem Merge-Commit Release/ZIP/Archiv ableiten.

Direkte Entwicklung in Archivkopien oder aus entpackten ZIPs ist untersagt.

## PC-Manager-Mindestbestand des Golden Masters

Bei Konsolidierung und Release müssen insbesondere erhalten bleiben:

- Rezepturpflege einschließlich Grünkohl/Sauerkraut,
- Einkaufs-/Rezeptbezüge,
- Bagasse-Ausgabeschale 500 ml,
- Mehrwegglas 0,2 l,
- Thermo-/Suppen-/Transportbecher 750 ml,
- aktuelle Supabase-Integration,
- Cloud-first/Pending-/Backup-Schutz,
- reale Datenfluss-Telemetrie,
- aktuelle Kassen-, Schulungs- und TV-Integrationen.

## Alte Branches

Alte Branches werden nicht als Quelle verwendet. Sie dürfen erst gelöscht/archiviert werden, nachdem bestätigt ist, dass keine benötigte Funktion ausschließlich dort existiert.

Die Konsolidierungsprüfung vom 19.09.2026 hat für die untersuchten relevanten PC-Manager-Stände keine Datei ergeben, die in `main` fehlt.

## Grundregel

**Es gibt genau eine Wahrheit: `Kasse/main`. Alles andere muss auf einen konkreten Commit dieser Quelle zurückführbar sein.**
