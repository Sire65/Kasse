// Mitgliederdaten für den Ausweisdruck.
//
// BEWUSST IN EINER EIGENEN DATEI, nicht im Programmcode: Hier stehen Anschriften und
// Telefonnummern von 18 Personen. Wer das Programm weitergibt, gibt diese Datei mit weiter -
// deshalb liegt sie sichtbar getrennt und lässt sich in einem Griff entfernen oder ersetzen.
//
// HERKUNFT: zentrale Mitgliederverwaltung (kc_core_people + kc_core_club_memberships),
// abgerufen am 30.08.2026. Sie ist hier hinterlegt, damit der Ausweisdruck auch ohne
// Verbindung funktioniert. Ändert sich eine Anschrift, gehört sie zuerst in die Verwaltung
// und dann hierher - nicht umgekehrt.
window.KCMitgliedsdaten = {
  'KC-0001': {name: 'Marianne Bierkämper', strasse: 'Sanddornweg 78', plz: '59192', ort: 'Bergkamen', telefon: '+49 173 2807779', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0002': {name: 'Reinhilde Eggenstein', strasse: 'Ondrup Nordicker Str. 5', plz: '59387', ort: 'Ascheberg', telefon: '+49 157 72676880', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0003': {name: 'Frank Brösel', strasse: 'Stettiner Straße 22', plz: '59174', ort: 'Kamen', telefon: '+49 173 22226286', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0004': {name: 'Friedbert Köhling', strasse: 'Kappellenstr. 5', plz: '52152', ort: 'Simmerath', telefon: '+49 172 5301062', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0005': {name: 'Andrea Spahn', strasse: 'Aruper Riege 6', plz: '59387', ort: 'Ascheberg', telefon: '+49 174 4784300', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0006': {name: 'Wilfried Wittwer', strasse: 'Horster Straße 190', plz: '59075', ort: 'Hamm', telefon: '+49 1590 4512935', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0007': {name: 'Anne Reinkober', strasse: 'Grevinghof 71', plz: '59368', ort: 'Werne', telefon: '+49 173 9195090', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0008': {name: 'Dieter Zander', strasse: 'An den 12 Bäumen 5', plz: '59368', ort: 'Werne', telefon: '+49 172 5344980', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0009': {name: 'Klaus Zander', strasse: 'An den 12 Bäumen 5', plz: '59368', ort: 'Werne', telefon: '+49 173 9703349', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0010': {name: 'Hans-Joachim Koch', strasse: 'Friedensstr. 6', plz: '59368', ort: 'Werne', telefon: '+49 160 8572989', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0011': {name: 'Manfred Schoppmann', strasse: 'Butenlandwehr 30', plz: '59368', ort: 'Werne', telefon: '+49 1573 4213122', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0012': {name: 'Thomas Hess', strasse: 'Ardennenstr. 4', plz: '59075', ort: 'Hamm', telefon: '+49 171 1738486', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0013': {name: 'Steven Linley', strasse: 'Unnaer Straße 5', plz: '59069', ort: 'Hamm', telefon: '+49 163 8740643', funktion: 'Mitglied', status: 'Aktiv'},
  // Bei diesen fünf ist in der Verwaltung keine Anschrift hinterlegt - die Felder bleiben
  // auf dem Ausweis leer, statt etwas zu erfinden.
  'KC-0014': {name: 'Christina Scharnetzki', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0015': {name: 'Karla Kazik', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0016': {name: 'Ruth Kazik', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0017': {name: 'Peter Wördemann', funktion: 'Mitglied', status: 'Aktiv'},
  'KC-0018': {name: 'Leon Wördemann', funktion: 'Mitglied', status: 'Aktiv'},
};
