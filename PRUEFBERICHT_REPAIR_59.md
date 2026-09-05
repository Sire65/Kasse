# Prüfbericht Repair 59

- Neue Textflächen werden jetzt unmittelbar in `slide.objectStyles` angelegt und dadurch dauerhaft gespeichert.
- Der gemeinsame Renderer wendet Glas- und Vollfarbflächen selbst an; ein nachgelagerter Renderer kann die Fläche nicht mehr wieder auf transparent setzen.
- Das Kreisdiagramm auf der Registerkarte „Übersicht“ zeichnet vor jedem Legendentext ein gleichfarbiges Quadrat.
- Beim DisplayMatrix-/Laufschrift-Editor werden konkurrierende alte Eigenschaftsblöcke aus dem aktiven Inspector entfernt. Eigentümer bleibt ausschließlich `display-matrix-core`.
- JavaScript-Syntax: PASS.
- Automatisierte Tests: 37/37 PASS.
- Status: Candidate bis zur praktischen Bedienprüfung.
