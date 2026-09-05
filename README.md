# KC MarktKasse / Präsentationsstudio V0.29.37 Weihnachtsmarkt-Editor Candidate

## V0.29.37 – bearbeitbare Weihnachtsmarkt-Präsentation

Diese Version erweitert die Repair-13-TV-Stabilitätsbasis um eine integrierte Weihnachtsmarkt-Präsentation mit 27 Folien und 18 einzelnen Mitgliedsvorstellungen. Fotos, Namen, Sprüche, Laufschrift, Symbole, Effekte und Hintergründe können im PC Manager geändert werden. Fünf Hintergründe sind enthalten; eigene Hintergrundbilder können hochgeladen und auf einzelne oder alle Folien angewendet werden. Einzelheiten stehen in `WEIHNACHTSMARKT_PRAESENTATION_V1.md`.

## V0.29.35 – konzentrierter Folienarbeitsplatz

- DisplayMatrixCore V0.2.3 zeichnet flüssiger ohne Canvas-Neuaufbau je Animationsschritt.
- Der alte Laufschrifteditor ist bei ausgewählter Laufschrift vollständig entfernt; Text und Effekte steuert der Core.
- Neue leere Vorlagen zeigen gestrichelte Platzhalterrahmen mit Inhaltszeichen.
- Neue Folie, Duplizieren und Masterfolie befinden sich als Icons im Folienkopf.
- Mini-Folien besitzen ein Kontextmenü für Folienaktionen.
- Linke Navigation und rechter Objektbereich sind einklappbar.
- Weihnachtssymbole unterstützen Drag-and-drop sowie individuelle Position und Skalierung.
- Mobile Aufträge unterscheiden leere Bearbeitung und aktuelle Präsentation im Beobachtungsmodus.

## V0.29.34 – DisplayMatrix-Konflikt behoben

- Der Core-Bereich bleibt beim Bedienen stabil bestehen und verliert den Aktivierungsschalter nicht mehr.
- Bei aktivem DisplayMatrixCore sind die widersprüchlichen alten Effektregler ausgeblendet.
- Lauftext sowie Position und Größe bleiben weiterhin im normalen Objekteditor bearbeitbar.
- Deaktivieren stellt die klassische Laufschrift wieder her.

## V0.29.33 – zentraler LED/LCD-Laufschriftkern

- DisplayMatrixModule V0.2.2 unverändert als zentrale Effektquelle eingebunden
- 20 Core-Effekte, LED/LCD, Richtungen, Presets, Farbwelten, Matrixschriften und Symbole im Kontexteditor
- TV-Adapter V0.29.33 speichert die Einstellungen je Folie
- TÜV-Release-Gate überwacht Core und Adapter verbindlich auf Fehlen und Versionsabweichung
- Startlayouts besitzen vollständige Höhenangaben und vermeiden die bisherige Erstfolien-Überlagerung

## V0.29.32 – Schnelle Objektbearbeitung

- Sichtbare Objektauswahl, Entf-Taste und Rechtsklick-Kontextmenü
- 20-stufiges Rückgängig/Wiederholen
- Erweiterter Laufschrift-Editor und größere Weihnachtsobjekt-Auswahl
- Kollisionsfreie Folienkarten und deutlich sichtbare Hauptaktionen

## V0.29.31 – Einheitliche Folienobjekt-Bearbeitung

- Ein Klick auf ein Folienobjekt öffnet ausschließlich dessen Werkzeuge im rechten Bereich.
- Text, Überschrift und Preis besitzen Inhalt, Schriftart, Größe, Farbe, Fett, Kursiv, Unterstrichen, Ausrichtung, Abstände, Drehung, Position und Größe.
- Die Laufschrift besitzt Text, Effekt, Richtung, Geschwindigkeit, vollständige Schriftgestaltung, Hintergrund, Rahmen, Pixeloptik und Position.
- Symbole, Wetterkarten, Banner und Formen besitzen eigene kontextabhängige Bereiche.
- Alte Drag-and-drop- und Eigenschaften-Observer sind deaktiviert; Rendering und Datenkompatibilität bleiben erhalten.
- Layoutberechnung und TÜV verwenden jetzt einheitlich Mittelpunktkoordinaten.

## V0.29.30 – TV-Manager-Stabilisierung

- Zentrales Release-Manifest funktioniert auch beim lokalen Start per Doppelklick.
- Der Präsentations-TÜV besitzt ein verbindliches RELEASE-Gate.
- Nur echte JavaScript-Fehler der aktuellen Sitzung sperren das SYSTEM-Gate.
- Lange Hauptthread-Aufgaben und DOM-Spitzen werden als Warnungen protokolliert.
- Die aktuelle Laufzeitdiagnose kann im TÜV gezielt zurückgesetzt werden.
- Der TV-Layout-Guard ist im Manager aktiv und korrigiert Objekte in den Sicherheitsbereich.
- Keine neuen Funktionen; Fokus bleibt die TV-Präsentation im Manager.

## V0.29.20 Performance Candidate

Performance-Optimierung und Cursor-Führung im Präsentationseditor. Siehe PERFORMANCE_CHECK_V0_29_20.md.

# KC Bilderrechner – Interaktive Schulung V0.29.3 Stand-alone

Dieses Paket enthält ausschließlich die eigenständig lauffähige Schulung und ihre notwendigen Laufzeitabhängigkeiten. Die aktuelle Original-Kassenoberfläche V0.31.3.6 Repair 11 ist vollständig eingebettet.

## Geschichten drucken oder als PDF speichern

In Lauras und Marcs Geschichte befindet sich im Kopfbereich die Schaltfläche **Drucken / als PDF**. Sie öffnet eine A4-Druckausgabe mit Köcheclub-Kopf, Personenbild, vollständiger Geschichte sowie Autor, Seitenzahl und Köcheclub Werne in der Fußzeile. Im Druckdialog kann ein Drucker oder **Als PDF speichern** gewählt werden.

## Lokal starten

1. ZIP vollständig entpacken.
2. `index.html` öffnen.
3. Die Schulung startet automatisch.

## GitHub Pages veröffentlichen

Der Unterordner `publish` ist das fertige Veröffentlichungsverzeichnis. Den **Inhalt** dieses Ordners in die Wurzel des GitHub-Repositories hochladen. Anschließend in GitHub unter **Settings → Pages** die Veröffentlichung aus dem Branch und dem Stammverzeichnis `/ (root)` aktivieren.

Nicht nur einzelne HTML-Dateien hochladen: Die Ordner `training-video`, `avatar-core`, `pos`, `cores`, `shared`, `exchange-core-v31` und `pc-manager` werden ebenfalls benötigt.

## Versionswächter

`latest-release-manifest.json`, `pos/version-manifest.json` und `training-video/training-version-manifest.json` bilden die verbindliche Versionskette. Der Wächter meldet Abweichungen zwischen freigegebener Kasse, eingebetteter Oberfläche und Schulung.


## V0.29.19 – Entwicklungs-Schnellzugang

Temporärer, nicht persistenter Schnellzugang: Im Entsperrdialog doppelt auf „Manager entsperren“ klicken. Der gespeicherte Master-PIN bleibt unverändert; nach dem Neuladen ist der Manager wieder gesperrt. Vor Produktivfreigabe entfernen.

V0.29.25 ergänzt automatische Kontextsteuerung und stabile Effektregler.


## V0.29.25 – Studio-konforme Editor-Konsolidierung
SelectionCore, PropertyCore und SmartLayoutCore bilden nun die zentrale Bearbeitungslogik im PC-Manager. Die bisherigen Einzel-Erweiterungen bleiben als Rückfall-/Migrationsnachweis im Paket, werden aber im Manager nicht mehr als konkurrierende Editorsteuerung geladen.


Siehe `WEATHER_ICONS_AUDIO_FIX_V0_29_26.md`.


## V0.29.28
Wetter-Tagesauswahl und KC-Mobil-Freigabemodi repariert.
