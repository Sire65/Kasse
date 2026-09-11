# Bedrohungsmodell – KC Sync (Baustufe 0)

**Status:** Architektur-Entwurf zur Prüfung. Keine TÜV-/TSE-/BSI-/fiskalische Aussage.

## Schutzziele
1. Keine Kasse darf Belege bei einem falschen/fremden Manager einspeisen (Vertraulichkeit +
   Integrität der Marktstand-Zuordnung)
2. Kein Beleg darf durch Übertragungswiederholung doppelt gezählt werden (Integrität der Umsätze)
3. Ausfall der Verbindung darf nie die Kassenbedienung blockieren (Verfügbarkeit)
4. Ein kompromittiertes/gestohlenes Kopplungs-Token darf nicht dauerhaft nutzbar bleiben
   (Widerrufbarkeit)
5. Mithören im lokalen Netz darf keine verwertbaren Belegdaten liefern (Vertraulichkeit der
   Übertragung)

## Akteure
- **Legitime Kasse** – gekoppeltes Gerät mit gültigem, aktuellem Credential
- **Legitimer Manager** – das Gerät, mit dem die Kasse gekoppelt wurde
- **Fremder Manager** – ein anderer Marktstand im selben Netz, kein böser Wille unterstellt, aber
  Verwechslung muss technisch ausgeschlossen sein
- **Netzteilnehmer ohne Bezug** – anderes Gerät im selben WLAN (Gast, Angreifer), ohne Kopplung

## Angriffs-/Fehlerflächen und Gegenmaßnahmen (Bezug zu A-01 bis A-10 aus dem Prüfvermerk)

| Punkt | Fläche | Gegenmaßnahme |
|---|---|---|
| A-01 | Browser-Netzwerkscan als Berechtigungs-Umgehung, zudem durch Chromes Local-Network-Access-Berechtigung ohnehin technisch nicht mehr zuverlässig nutzbar | Kein Scan aus der PWA; Discovery über lokalen nativen Companion-Dienst mit mDNS/DNS-SD, QR-Kopplung als garantierter Fallback, optional feste Adresse/`managername.local` |
| A-02 | Dauerhaft mitgesendetes Kopplungs-Token wäre bei Kompromittierung unbegrenzt nutzbar | Einmaltoken autorisiert nur den Schlüsseltausch; danach eigene widerrufbare Geräteidentität mit rotierbarem Credential (mTLS oder signierte Challenge/Response) |
| A-03 | Eine passende `/health`-Antwort beweist nicht, dass es der richtige Manager ist – nachbildbar | Manager-ID + Public-Key-Fingerprint werden bei der Kopplung gepinnt; ein Adresswechsel ist nur gültig, wenn derselbe Schlüssel nachgewiesen wird |
| A-04 | Bei Netzabbruch nach Server-Speicherung aber vor Antwort müsste die Kasse denselben Vorgang erneut senden können, ohne Doppelzählung | Zustellung als "mindestens einmal"; unveränderliche `eventId`, eindeutiger DB-Index beim Manager, idempotenter Endpunkt, Queue-Eintrag erst nach bestätigtem Commit entfernt |
| A-05 | `registerId + laufende Nummer` kollidiert nach Restore/Zurücksetzen/fehlerhafter Klonung (bestätigt: `registerId` ist ein vom Personal frei änderbares Textfeld, z. B. `"KASSE-01"`) | Nicht klonbare `deviceInstanceId`, UUIDv7-artige `eventId`, zusätzliche monotone Sequenznummer je Kasse; Manager erkennt Lücken/Duplikate; Kassenzeit ist Metadatum, nicht alleinige Ordnung |
| A-06 | `localStorage` ist nicht transaktional, größenbegrenzt, vom Nutzer/Browser löschbar | IndexedDB mit atomarem Outbox-Muster (PWA-Anteil), bevorzugt SQLite mit WAL im Companion-Dienst; Beleg und Outbox-Eintrag atomar gemeinsam gespeichert |
| A-07 | Ein einzelner Ampel-Status verdeckt, welcher Teil betroffen ist – Manager-Ausfall ist nicht gleich TSE-Ausfall | Getrennte Zustandsmaschinen für Manager-Sync, TSE, Terminal/Kartenzahlung, Drucker, Speicher, Uhr; keine gemeinsame Ampel, die fiskalische Blocker verdeckt |
| A-08 | Klartext im WLAN wäre mithörbar, "optionale Verschlüsselung" ist für Umsatzdaten zu wenig | Transportverschlüsselung und gegenseitige Authentisierung verpflichtend; nur etablierte AEAD-Verfahren bei Nutzlastverschlüsselung, Nonce-/Replay-Schutz, Rotation, Widerruf, keine Eigenbau-Kryptografie |
| A-09 | Fehlende Versionierung führt dazu, dass alte Clients Daten stillschweigend falsch interpretieren | Versionierter API-Vertrag für `/health`, Pairing, Upload, ACK, Status, Widerruf; inkompatible Versionen liefern maschinenlesbare Fehler |
| A-10 | Betrieb ohne Datenschutz-/Audit-/Rate-Limit-Konzept | Datenminimierung, Aufbewahrungs-/Löschkonzept, Rollen, Auditprotokoll, Rate-Limits, Brute-Force-Schutz, signierte Updates, Verfahrensdokumentation |
| — | Autorisierungsgrenze von Claude | Kein Netzwerkscan gegen fremde Geräte ohne Auftrag, keine Sicherheits-Umgehung, keine Behauptung einer Zertifizierung – Architektur/Tests/Prototyp ja, Freigabe nein |

## Bewusst außerhalb dieser Baustufe
- Konkrete TSE-Anbindung (das System läuft aktuell laut Bestandsdokumentation ohne TSE)
- Tatsächliche BSI-/fiskalische Zertifizierung
- Produktiv-Schlüsselverwaltung/-Verteilung (Baustufe 0 legt nur das Verfahren fest, nicht den
  Betrieb eines echten Schlüsselservers)
