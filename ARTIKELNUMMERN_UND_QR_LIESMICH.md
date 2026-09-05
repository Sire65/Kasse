# Artikelnummern und QR-Etiketten

Stand 01.09.2026. Betrifft Kasse, PC-Manager und den Etikettendruck.

## Was gebaut wurde

Jeder Artikel hat jetzt eine **fünfstellige Artikelnummer aus reinen Ziffern**. Sie steht im
bereits vorhandenen Feld **Barcode** im Artikelstamm — die Artikel-ID („grot", „gruenkohlmett")
bleibt unverändert. Das war die entscheidende Frage: **es war kein Umbau nötig.** Die ID hängt
in Bons, Auswertungen, Bildpfaden und Packages; hätte man sie durch eine Zahl ersetzt, wäre
jede alte Auswertung fehlgeschlagen. Das Feld für die Nummer war schon da, es war nur leer.

### Aufbau der Nummer

```
   01001
   ││└┴┴── laufende Nummer in der Warengruppe (001–099)
   └┴───── Warengruppe
```

| Vorsatz | Warengruppe |
|---|---|
| 01 | Getränke |
| 02 | Speisen |
| 03 | Pfand |
| 04 | Sonstiges |
| 05 | Packages |
| 09 | Happy Hour |

Innerhalb der Warengruppe **Pfand** trennt der Bereich die Richtung:
**03001–03099 = Ausgabe**, **03101–03199 = Rückgabe**. Wer am Stand versehentlich die
Ausgabenummer scannt statt der Rückgabe, sieht sofort das falsche Vorzeichen.

**Warum nur Ziffern und keine Buchstaben:** der Zahlenblock der Kasse sucht über
`replace(/\D/g,"")` — eine Nummer mit Buchstaben ließe sich dort gar nicht eingeben. So
funktioniert dieselbe Nummer auf **allen drei Wegen**: QR scannen, Zahlenblock, Suchfeld.

## Die Nummern

| Nr. | Artikel | Preis |
|---|---|---|
| **01001** | Glühwein rot | 5,50 € |
| **01002** | Glühwein weiß | 5,50 € |
| **01003** | Feuerzangenbowle | 5,00 € |
| **01004** | Apfelpunsch | 4,50 € |
| **01005** | Roter Feger | 2,50 € |
| **01006** | Eierlikörpunsch | 6,50 € |
| **02001** | Sauerkrauteintopf | 5,50 € |
| **02002** | Sauerkrauteintopf + Mettwurst | 7,00 € |
| **02003** | Grünkohl | 5,50 € |
| **02004** | Grünkohl + Mettwurst | 7,00 € |
| **02005** | Mettwurst | 1,50 € |
| **02006** | Kartoffel mit Hering | 4,50 € |
| **02007** | Kartoffel mit Kartoffelcreme | 3,50 € |
| 02008 | Kartoffelknirpse | *stillgelegt* |
| 02009 | Knirpse mit Heringsstipp | *stillgelegt* |
| **03001** | Glaspfand | 2,00 € |
| **03002** | Feuerzangenpfand | 2,00 € |
| **03101** | Glasrückgabe | −2,00 € |
| **03102** | Feuerzange Rückgabe | −2,00 € |
| **03103** | Glas + Feuerzange Rückgabe | −4,00 € |
| **04001** | Wertmarke | 5,00 € |
| **04002** | Außer-Haus-Becher | 1,00 € |
| **05001** | Grünkohl + Glühwein rot (Package) | 10,50 € |
| **05002** | Grünkohl + Eierlikörpunsch (Package) | 11,50 € |
| **09001** | Happy Hour Glühwein rot | 4,95 € |
| **09002** | Happy Hour Glühwein weiß | 4,95 € |

Die täglich automatisch erzeugten Packages bekommen Nummern aus dem reservierten Bereich
**05901–05999**. Diese Nummern gelten nur einen Tag und **gehören nicht auf ein gedrucktes
Etikett**.

Eine vergebene Nummer wird **nie wiederverwendet**, auch nicht nach dem Löschen eines Artikels.
Sonst zeigte ein altes Etikett später auf einen fremden Artikel — deshalb behalten die beiden
stillgelegten Knirpse-Gerichte ihre 02008 und 02009.

## Wo die Tabelle steht

`shared/kc-artikelnummern-core.js` — **eine** Datei, die Kasse und Manager beim Start lesen.
Vorher hätte die Nummer an drei Stellen gepflegt werden müssen: Artikelstamm der Kasse,
Artikelstamm des Managers, gedrucktes Etikett. Drei Stellen heißt früher oder später drei
verschiedene Nummern — und dann liegt am Stand ein Etikett, das die Kasse nicht kennt.

Eine im Manager **von Hand abweichend eingetragene** Nummer wird nicht überschrieben; sie wird
nur in der Entwicklerkonsole gemeldet. Der Verein behält also das letzte Wort.

## Etikett drucken

PC-Manager → **Etiketten**. Artikel wählen, Größe wählen, Codeart **QR-Code**, dann
**Etikett drucken** (im Druckdialog „Als PDF sichern" für den Etikettendrucker).

Das Etikett trägt Vereinsname, Bild, Artikelname, Preis, Pfand, Allergene, Zutaten,
die Artikelnummer und den QR-Code. Der QR enthält **genau die Artikelnummer**, sonst nichts —
kein Link, kein Text. Das ist Absicht: der Scanner tippt seinen Inhalt wie eine Tastatur, und
was er tippt, muss die Kasse direkt verstehen.

Unter „Art.-Nr." steht jetzt die **Artikelnummer**. Vorher stand dort die technische ID
(„grot"), die auf keinem der drei Wege eingebbar war.

### Zwei weitere Befunde am Etikett, beim Prüfen aufgefallen

**Das Pfand fehlte auf jedem Etikett.** Das Etikett las nur das Feld `depositGroupIds`. Die
Artikel der Kasse führen ihr Pfand aber in `depositComponents` — Glühwein rot: Glaspfand 2 €,
Feuerzangenbowle zusätzlich Feuerzangenpfand 2 €. Auf dem gedruckten Etikett stand deshalb
**kein Pfand**, ausgerechnet die Angabe, nach der am Stand am häufigsten gefragt wird.
Jetzt wird auf die Pfandbestandteile zurückgegriffen, wenn keine Pfandgruppe gesetzt ist.

**Die Allergene fehlten, sobald sie als Freitext vorlagen.** Gelesen wurde nur die
Big-14-Tabelle. Steht die Angabe als Text da („Enthält Sulfite"), druckte das Etikett
**stillschweigend gar keine Allergenzeile**. Bei einem Lebensmitteletikett ist das die Zeile,
die am wenigsten fehlen darf. Jetzt greift der Freitext als Rückfall.

**Zum Drucken muss der Manager entsperrt sein.** Solange die Master-PIN nicht eingegeben ist,
liegt über der gesamten Oberfläche eine Unschärfe (`filter:blur(5px)`) — sie schützt die Daten
auf einem unbeaufsichtigten Rechner. Ein in diesem Zustand gedrucktes Etikett wäre unscharf und
der QR-Code nicht lesbar. In der Praxis fällt das nicht auf, weil man ohne Entsperren gar nicht
bis zur Etikettenansicht klicken kann — es ist nur der Grund, warum die Master-PIN vor dem
ersten Etikettendruck gesetzt sein muss.

## Die drei Wege zum Artikel

| Weg | Was zu tun ist | Wo im Code |
|---|---|---|
| **QR scannen** | Scanner koppeln, Cursor irgendwo auf der Kassenoberfläche, Etikett scannen | `pos/app.js`, Tastaturüberwachung am Dateiende |
| **Suchfeld** | Nummer ins Suchfeld tippen — oder hineinscannen, wenn der Cursor dort steht | `pos/app.js`, `allProductsForCategory()` |
| **Zahlenblock** | Zahlenblock → **ART** → Nummer → Enter | `pos/app.js`, `keypadMode==="article"` |

**Befund, der dabei aufgefallen ist:** die Kasse kannte bisher nur fünf fest verdrahtete
Demo-Codes (`ART0001`, `ART1001`, `ART1002`, `ART1003`, `DEP0001`). Ein echtes Etikett wurde
vom Scanner zwar gelesen, aber von der Kasse **ohne jede Meldung ignoriert**. Jetzt wird der
Artikelstamm durchsucht, die alten Demo-Codes bleiben als Rückfall erhalten, und ein
unbekannter Code sagt das auch: „Zu der gescannten Nummer … gibt es keinen Artikel."

Zahlenblock und Scanner benutzen jetzt **dieselbe Suchfunktion**. Vorher waren es zwei
getrennte Wege — eine Nummer hätte auf dem einen gefunden werden können und auf dem anderen
nicht.

## Offener Punkt zur Entscheidung

**Mettwurst steht zweimal im PC-Manager:**

| ID | Name | Preis | Herkunft |
|---|---|---|---|
| `mettwurst` | Mettwurst | 1,50 € | aus der Kasse, mit Bild, als Beilage |
| `mett` | Mettwurst | 3,50 € | alte Vorgabedaten des Managers, ohne Bild |

Beide stehen in der Preisliste — **derselbe Name, zwei verschiedene Preise**. Das ist keine
Folge dieser Arbeit, es fiel nur dabei auf. `mett` hat bewusst **keine Artikelnummer** bekommen,
damit ihn niemand versehentlich bedruckt.

Stammdaten ändert der Verein, nicht ich — deshalb steht der Artikel unverändert da.
Der Vorschlag wäre, `mett` auf **inaktiv** zu setzen (nicht löschen, damit alte Auswertungen
lesbar bleiben). Das ist ein Haken im Manager unter Artikel → Mettwurst (3,50 €) → „Aktiv"
abwählen → speichern.

## Prüfung

```
node tests/artikelnummern-und-qr.test.cjs
```

28 von 28 bestanden. Geprüft werden: Eindeutigkeit der Nummern, Warengruppen-Vorsatz,
alle drei Wege zum Artikel, ein unbekannter Code, ein Code mit Vorsatz `KCA:`, gleicher
Stand in Kasse und Manager, ein echter QR-Code auf dem Etikett sowie Pfand- und
Allergenzeile.

Die vollständige Testreihe der Kassensuite (33 Prüfläufe) ist danach unverändert grün.

Zwei Bilder zum Ansehen: `tests/etikett-qr-gluehwein.png` (fertiges Etikett) und
`tests/kasse-suche-artikelnummer.png` (Suche über die Nummer 02003 in der Kasse).
