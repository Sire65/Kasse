# KC Bildrechner POS V0.20.2

## Bedienung

Die normale Oberfläche zeigt Artikelbilder, Warenkorb, Barzahlung, Ziffernfeld, Karte, Personal, Pfandrückgabe, Trinkgeld, Bondruck und das Menü. Systemeinstellungen werden nicht frei angeboten.

- Rückgeldkarte: rot bis zum ausreichenden Zahlbetrag, danach grün.
- Rabatt: 2/3/5/10/20/50 Prozent oder freie Eingabe, optionaler Grund, kein Rabatt auf Pfand/Rückgaben.
- Reklamation: unter Entnahme mit Rückgabeartikeln, Mengen, Grundtasten, Auszahlung und negativem Reklamationsvorgang.

## Geheimer Zugang

- Köcheclub-Logo fünf Sekunden halten oder siebenmal schnell antippen.
- Persönlichen Superadmin-QR mit Enter-Abschluss scannen oder vierstellige PIN eingeben.
- QR und PIN werden im zentralen Konfigurationssystem erzeugt und anschließend per `.kcpos` übertragen.
- Nach dem Schließen der Adminfenster endet die Sitzung.

## Wichtige Daten

- Produktivvorgänge: `kc_transactions_v040`.
- Trainingsvorgänge: `kc_training_transactions_v040`.
- Entnahmen: `kc_cash_withdrawals_v018`.
- Rabatt-Audit: `kc_discount_audit_v020`.
- Abschlüsse: `kc_closings`.
- Letzter Selbsttest: `kc_tuv_last_v018`.

## Start

Über die Suite-Startseite öffnen. Für PWA-/Service-Worker-Betrieb über HTTP(S) bereitstellen; bei direktem `file:`-Start wird kein Service Worker registriert.

## Freigabestatus

Technischer Release Candidate ohne angebundene TSE. Der interne Modusschalter ist nur im Superadmin-Systemreiter sichtbar und ist keine TSE-Integration.
