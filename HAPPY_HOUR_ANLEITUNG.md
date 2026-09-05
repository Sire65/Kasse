# Happy Hour — Anleitung und Aufbau

Die Happy Hour wird ab jetzt **im PC-Manager** gesteuert. Die Kasse holt sie sich beim
Stammdaten-Abgleich und braucht selbst keine Einstellung mehr.

---

## In drei Schritten eingerichtet

**1. Preise setzen — Artikelseite, Reiter „Verkauf"**

Bei jedem Artikel, der mitmachen soll: Häkchen **„Happy Hour · nimmt teil"** setzen und
darunter den **Happy-Hour-Preis** eintragen. Unter dem Feld steht sofort, was das bedeutet:

> Während der Happy Hour 5,00 € statt 5,50 € – das sind 0,50 € weniger.

Ein fester Preis statt eines Prozentsatzes, und zwar mit Absicht: 10 % auf 5,50 € sind
4,95 €. Am Stand zählt jemand Wechselgeld ab — da will man 5,00 €.

In der Artikelliste rechts zeigt die neue Spalte **HH** auf einen Blick, wer dabei ist.

**2. Zeiten festlegen — Menüpunkt „Happy Hour"**

* Schalter **„Happy Hour einschalten"** — solange er aus ist, verkauft jede Kasse durchgehend
  zum normalen Preis, egal was eingetragen ist.
* **Zeitraum des Weihnachtsmarkts** (von / bis).
* **Standardzeiten** — bis zu **drei Zeitbereiche am Tag**, die an *jedem* Markttag gelten.
  Nicht benötigte Bereiche bleiben leer.
* **Einzelne Tage abweichend** — für einen Tag entweder *keine Happy Hour* oder eigene
  Uhrzeiten, die die Standardzeiten an diesem einen Tag ersetzen.

Oben steht immer, was gerade gilt: „Die Happy Hour läuft gerade – bis 18:00 Uhr" oder
„Heute gilt: 17:00–18:00 und 20:00–21:00".

**3. An die Kassen senden**

Artikelseite, Knopf **„Artikel, Warengruppen und Darstellung an alle Kassen senden"**.
Der Zeitplan fährt dort mit. Jede Kasse übernimmt ihn beim nächsten Abgleich.

---

## Was die Kasse damit macht

Die Kasse übersetzt den Zeitplan in ihre eigenen Angebote — je teilnehmendem Artikel und
Zeitbereich eines, mit festem Preis und gültig nur an dem einen Tag. Das ist der Grund,
warum an der bewährten Preis-, Bon- und Abschlusslogik **keine Zeile** geändert werden
musste.

Sie prüft alle 30 Sekunden nach. Damit greift der Wechsel um 18:00 Uhr von selbst, ebenso
der Tageswechsel um Mitternacht und ein frisch eingetroffener Abgleich.

### Der Punkt, auf den es ankommt

**Ein Artikel, der schon im Bon liegt, behält seinen Happy-Hour-Preis** — auch wenn die
Happy Hour eine Sekunde später ausläuft. Der Preis wird in dem Moment eingefroren, in dem
der Artikel angetippt wird. Der nächste Artikel bekommt wieder den regulären Preis.

Gemessen, nicht angenommen:

```
Während der Happy Hour angetippt:   5,00 €/Stk   Bonsumme 7,00 €
Happy Hour ausgelaufen:             5,00 €/Stk   Bonsumme 7,00 €   ← bleibt
Danach neu angetippt:               5,50 €/Stk
```

Beide Preise stehen dann sauber nebeneinander im selben Bon.

---

## Was sich sonst geändert hat

**Die alte Beispielaktion läuft nicht mehr von selbst.** Ab Werk war eine Happy Hour
eingetragen, die *täglich von 17 bis 18 Uhr* 10 % auf Glühwein gab — also genau zur
anlaufenden Stoßzeit, ohne dass jemand sie gestartet hätte. Sie ist jetzt ausgeschaltet und
bleibt nur als Vorlage stehen. Sobald ein Zeitplan aus dem Manager vorliegt, ist dieser die
alleinige Quelle; eine alte, von Hand angelegte Happy-Hour-Aktion würde sonst daneben
weiterlaufen und niemand wüsste, welcher Preis gilt.

---

## Sperren, die absichtlich eingebaut sind

| Fall | Was passiert |
|---|---|
| Häkchen gesetzt, kein Preis | Wird **nicht** gespeichert. Klartext-Meldung, Häkchen springt zurück. |
| Happy-Hour-Preis ≥ Normalpreis | Wird abgelehnt — eine Happy Hour, die nichts spart, verwirrt am Stand nur. |
| Zwei Zeitbereiche überschneiden sich | Der Zeitplan wird nicht gespeichert und die Überschneidung benannt. |
| Ende liegt vor dem Anfang | Ebenso. |
| Mehr als drei Zeitbereiche | Werden nicht übernommen. |
| Ausnahmetag außerhalb des Marktzeitraums | Gilt trotzdem (er wurde ja ausdrücklich eingetragen), aber mit sichtbarem Hinweis, falls es ein Tippfehler war. |
| Kein Zeitplan hinterlegt | Die Kasse ändert nichts an ihren Angeboten — eine Kasse, die noch nie einen Abgleich gesehen hat, verhält sich unverändert. |

---

## Wo es im Programm steht

| Datei | Aufgabe |
|---|---|
| `shared/kc-happyhour.js` | Rechnet: welche Zeitfenster gelten an welchem Tag, wer nimmt teil, welche Angebote folgen daraus. **Manager und Kasse fragen dieselbe Stelle** — sonst könnten beide auseinanderlaufen. |
| `pc-manager/kc-happyhour-manager.js` | Die Bedienung: Felder am Artikel, Spalte in der Liste, Ansicht mit dem Zeitplan. |
| `pos/kc-happyhour-pos.js` | Übersetzt den Zeitplan an der Kasse in Angebote, alle 30 Sekunden nachgeprüft. |
| `tests/happyhour.test.cjs` | 26 Prüfungen über die ganze Kette, mit echten Klicks. |

Der Zeitplan liegt in den Einstellungen (`settings.happyHour`). Dadurch fährt er beim
normalen Abgleich mit, ohne dass am Manager-Dienst oder an der Datenbank etwas geändert
werden musste.
