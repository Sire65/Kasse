# RecipeCalculationCore V0.1.0

Programmneutraler Rezeptur- und Skalierungskern für PC-Manager, Köcheclub-Verwaltung,
Einkauf und Bestellung.

Er rechnet Grundrezept, Fertigausbeute, Portionen, gewünschte Produktionsmenge,
vorhandene Bezugszutat, Reserve, Verluste und optionale Kosten. Die Methode
`makePublicPackage()` bildet eine harte Datenschutz-/Geschäftsgrenze: Für Kassen
werden nur Inhaltsstoffe, Allergene, Nährwerte und Hinweise ausgegeben.
