# Die vier Scanner-Wege an der Kasse

Stand 01.09.2026. Geprüft mit echten Tastendrücken — ein Bluetooth-Scanner meldet sich als
Tastatur an, tippt den Code Zeichen für Zeichen und schließt mit **Enter** ab. Genau so läuft
der Test, nicht über Funktionsaufrufe.

`node tests/scan-wege.test.cjs` — **28 von 28 bestanden.**

---

## Weg 1 · Mitarbeiterausweis → Bediener oben links

**Funktioniert.** Zwei Ausweisarten werden erkannt:

| Ausweis | Code auf dem QR | Herkunft |
|---|---|---|
| Bedienerausweis | `KCOPE1:kc-0003` | PC-Manager |
| Mitgliedsausweis | `KNG\|Köcheclub Werne\|KC-0005\|m_kc_0005` | KC Verwaltung |

Beide melden denselben Bediener an — ein Ausweis, der an einem Gerät geht und am anderen
nicht, wäre am Stand nicht erklärbar.

Der Bediener **bleibt**, bis sich ein anderer anmeldet. Zwischendurch gescannte Artikel,
Verkäufe und Abschlüsse ändern daran nichts. Der Verkauf wird nachweislich unter seinem
Namen gebucht (im Test: Bon mit `operator: "Bibi"`).

### Befund 1 — behoben: der Bediener überlebte den Neustart

Der Bediener wurde dauerhaft gespeichert. Nach einem Neustart — auch nach einem
versehentlichen Neuladen oder am nächsten Markttag — stand oben links **noch der Bediener
vom Vorabend**, und jeder Verkauf lief unter *seinem* Namen, bis es jemand bemerkte.

Jetzt: nach dem Start steht immer **Team**, bis sich jemand ausdrücklich anmeldet. Der
Ausweis selbst gilt unbegrenzt weiter — nur über den Neustart wird er nicht mitgenommen.

### Befund 2 — behoben: Scan bei geöffneter Bedienerliste

Wer erst oben links auf die Bedienertaste drückt und *dann* scannt — also genau so, wie es
naheliegt —, wechselte den Bediener im Hintergrund, während das Fenster offen blieb und
weiter den **alten** Namen mit Haken zeigte. Wer dann noch tippte, meldete den Vorgänger
wieder an. Jetzt schließt sich die Liste beim Scan von selbst.

---

## Weg 2 · Artikel-Barcode → sofort in den Warenkorb

**Funktioniert.** Der gescannte Artikel liegt sofort im Bon, nicht nur markiert:

* zweimal derselbe Code → **Menge 2** in einer Zeile, keine zweite Zeile
* ein zweiter Artikel → eigene Zeile
* das **Pfand hängt mit dran**, genau wie beim Antippen der Kachel (Glühwein rot:
  Glaspfand 2,00 € extra)

Die Nummern stehen in `ARTIKELNUMMERN_UND_QR_LIESMICH.md`.

---

## Weg 3 · Bezahlcode auf der grünen Taste → Verkauf abgeschlossen

**Funktioniert.** Der QR-Code sitzt direkt auf dem grünen Zahlknopf und enthält
`CMD-CHECKOUT`. Gemessen: 2 Posten → 0, Bonnummer 123 → 124, Gesamtanzeige zurück auf
0,00 €, gebucht als `cash-qr-direct` unter dem angemeldeten Bediener.

Bei **leerem** Warenkorb bucht der Code keinen Leerbon.

---

## Weg 4 · Uhrknopf, dann Mitarbeitercode → Kommen/Gehen

**Funktioniert** — mit einer Voraussetzung.

Uhrknopf drücken → das Zeiterfassungsfenster öffnet sich → der Cursor steht **im
Ausweisfeld**, der Scanner tippt also direkt dorthin → Enter → das Fenster springt auf
Schritt 2 mit Name und Richtung („Bibi · kommt"). Wer kommt, verkauft ab dann unter seinem
Pseudonym; wer geht, gibt an *Team* zurück.

**Voraussetzung:** Solange der PC-Manager keine Personen an die Kasse gesendet hat, ist der
Uhrknopf **bewusst ausgeblendet** — das ist richtig so, ein Knopf, der ein leeres Fenster
öffnet, ist am Stand schlimmer als kein Knopf. Vor Freitag also: PC-Manager →
*Zeiterfassung* → einschalten, Personen anlegen, an die Kassen senden. Oder die
Zeiterfassung Freitag ganz weglassen.

---

## Befund 3 — der schwerste: **jede** Scanner-Meldung war unsichtbar

Der Scanner schickt hinter dem Code ein Enter. **Dieselbe Enter-Taste hat den Hinweis, den
sie gerade ausgelöst hatte, im selben Moment wieder weggeklickt** — die Meldefenster tragen
`<form method="dialog">` mit einem Standardknopf, den Enter auslöst.

Betroffen war alles, was aus einem Scan kommt:

* unbekannter Bedienerausweis
* unbekannte Artikelnummer
* abgelehnter Geld-QR

Der Text wurde jedes Mal korrekt gesetzt — das Fenster war nur schon wieder zu, bevor
jemand es sehen konnte. Am Stand sah es aus, als sei der Scan gar nicht angekommen, und man
scannt dann noch einmal und noch einmal.

Behoben: der Scan-Enter wird abgefangen (`e.preventDefault()`), sobald ein Code erkannt
wurde. Der Test prüft ausdrücklich, dass die Meldung danach **wirklich offen steht**.

Bei der Gelegenheit zwei Meldungstexte in Vereinsdeutsch gebracht: aus „Dieser Bediener ist
nicht in der aktuellen Konfigurationspaket enthalten" wurde „Dieser Bedienerausweis steht
nicht in der Bedienerliste dieser Kasse. Der PC-Manager muss die Bediener einmal an die
Kassen senden."

---

## Was nachweislich geprüft ist

| Weg | Prüfungen |
|---|---|
| Bedienerausweis | 9 |
| Artikel-Barcode | 5 |
| Bezahlcode | 4 |
| Zeiterfassung | 6 |
| Neustart und Skriptfehler | 4 |

Die vollständige Testreihe der Suite (34 Prüfläufe) ist danach unverändert grün.
