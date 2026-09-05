# Zentrale POS-Oberflächenprofile – Technical Preview

Stand: V0.31.3.6 Repair 12, 21.07.2026

## Ergebnis

Die Profilsteuerung ist additiv in den bestehenden PC-Manager eingebaut. Es gibt keinen zweiten Manager. Die Kasse besitzt bei aktivem zentralen Profil keinen dauerhaften lokalen Gestaltungsweg mehr. Verkaufs-, Zahl-, Pfand-, Bon- und Abschlusslogik wurden nicht ersetzt.

## Enthalten

- Profilkern mit Schema, Migration, Pflichtschutz, Kontrast- und Touch-Prüfung
- Workflow Entwurf → Prüfung → Freigabe → Veröffentlichung
- Manager-PIN-Schutz für schreibende Profilaktionen
- Kassen-/Gerätezuweisung und Transport im bestehenden verschlüsselten `.kcpos`-Paket
- Integritätsprüfung vor Aktivierung
- Last-known-good und Rollback auf der Kasse
- Profilbestand, Zuordnungen und Historie im Vollbackup
- zentrale Versionsregistrierung; Entwicklerzugang der Kasse deaktiviert

## Automatisch geprüft

- JavaScript-Syntax der geänderten Laufzeitdateien
- Migration eines Bestandsprofils
- Pflichtfunktionen können nicht aus dem Profil entfernt werden
- Mindestkontrast und Mindest-Touchgröße
- Manipulationssperre des Profilumschlags
- Aktivierung, last-known-good und Rollback
- Importbrücke zum bestehenden `.kcpos`-Verfahren

## Offene Freigabepunkte

Der Stand ist absichtlich **kein Candidate**. Noch erforderlich sind praktische Tests im PC-Manager und auf der vorgesehenen Touch-Hardware: alle Ansichten, Hoch-/Querformat, Offline-Neustart, Bedienbarkeit mit Handschuhen sowie ein kompletter Verkaufs-, Zahlungs-, Storno-, Pfand-, Bon- und Abschlussdurchlauf. Bis dahin nicht produktiv einsetzen.

## Rollback

1. In der Profilverwaltung eine frühere veröffentlichte Version als Rollback-Entwurf erzeugen.
2. Prüfen, freigeben und veröffentlichen.
3. Eine neue verschlüsselte Kassenkonfiguration für das Zielgerät exportieren und dort importieren.
4. Falls die neue Aktivierung auf der Kasse scheitert, bleibt das aktive Profil unverändert; über `KCPOSUIProfileConsumer.rollback()` steht zusätzlich die letzte bekannte funktionsfähige Version bereit.

## Testbefehle

```text
node tests/pos-ui-profile-core.test.cjs
node tests/pos-ui-consumer.test.cjs
```
