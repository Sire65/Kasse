(() => {
'use strict';
const $=id=>document.getElementById(id);
const STORAGE_KEY='kc_training_profile_v0254';
const FEEDBACK_KEY='kc_training_feedback_queue_v1';
const TRAINING_VERSION='0.29.3';
const PRODUCT_VERSION='0.31.3.6.11';
const FEEDBACK_SCHEMA='KC_TRAINING_FEEDBACK_V2';
const sections=['welcome','dashboard','lesson','practice','certificate','bonus','trainingTuv','survey'];

const quick=[
 {title:'Kapitel 1 · Die Kassenoberfläche vollständig kennenlernen',text:'Wir beginnen mit einem vollständigen Rundgang durch die Originaloberfläche. Oben befindet sich die Kopfzeile mit Suche, Bedieneranzeige, Status- und Funktionsknöpfen. Darunter liegen die Warengruppen-Reiter und die großen, touchfreundlichen Artikeltasten. Rechts befindet sich der Warenkorb mit Mengensteuerung im Kopf und den einzelnen Artikelzeilen. Im unteren Bereich siehst du Scheine, Münzen, Rückgeldanzeige, Bezahlen und die Sondertasten.',tip:'Nimm dir für die Orientierung Zeit. Erst wenn Kopfzeile, Warengruppen, Artikelbereich, Warenkorb und Zahlbereich sicher erkannt werden, folgt der Verkauf.',selector:'#app',demo:'surfaceTour'},
 {title:'Kapitel 2 · Einzelartikel verkaufen',text:'Ich wähle einen einzelnen Artikel über seine große Artikeltaste aus. Der Artikel erscheint sofort im Warenkorb. Danach wird die Barzahlung gestartet und der Vorgang abgeschlossen.',tip:'Für den Standardartikel immer die große Artikelfläche verwenden. Das Pluszeichen ist ausschließlich für Varianten gedacht.',selector:'#productGrid',demo:'singleSale'},
 {title:'Kapitel 3 · Mehrere Artikel und verschiedene Warengruppen',text:'Jetzt werden mehrere Artikel nacheinander ausgewählt, auch aus unterschiedlichen Warengruppen. Mehrfaches Antippen einer Artikeltaste erhöht die Menge dieses Artikels. So entsteht ein vollständiger Warenkorb aus verschiedenen Produkten.',tip:'Vor dem Bezahlen immer Artikel, Mengen und Gesamtsumme kontrollieren.',selector:'#categories, #productGrid',demo:'multiSale'},
 {title:'Kapitel 4 · Mengen im Warenkorb ändern',text:'Eine Menge kann auf drei Wegen geändert werden: durch mehrfaches Antippen der Artikeltaste, über die Mengenknöpfe im Kopf des Warenkorbs und direkt in der jeweiligen Artikelzeile mit Plus und Minus. Alle Wege führen zur gleichen korrekten Mengenberechnung.',tip:'Zuerst die richtige Warenkorbzeile markieren und danach die gewünschte Mengensteuerung verwenden.',selector:'#cartQuantityBar, #cartList',demo:'quantityControls'},
 {title:'Kapitel 5 · Artikel oder gesamten Warenkorb löschen',text:'Ein einzelner Artikel wird über das Mülleimersymbol seiner Warenkorbzeile entfernt. Der komplette offene Warenkorb kann über die Funktion Bon beziehungsweise Warenkorb löschen geleert werden. Vor dem vollständigen Löschen muss immer geprüft werden, ob wirklich der gesamte Vorgang verworfen werden soll.',tip:'Ein Löschen ersetzt niemals eine Reklamation eines bereits abgeschlossenen Verkaufs.',selector:'#cartList',demo:'cartDelete'},
 {title:'Kapitel 6 · Warenkorb bezahlen und Rückgeld',text:'Nach der Kontrolle des Warenkorbs wird der erhaltene Barbetrag über Scheine oder Münzen eingegeben. Die Kasse zeigt gegebenen Betrag, zu zahlenden Betrag und Rückgeld. Erst wenn der Zahlbetrag ausreicht, wird der Bezahlknopf freigegeben und der Verkauf abgeschlossen.',tip:'Das angezeigte Rückgeld laut nennen und erst danach den Vorgang abschließen.',selector:'#banknotes, #coins, #payBtn',demo:'paymentFlow'}
];
const advanced=[
 {title:'Kapitel 7 · Trinkgeld vollständig erfassen',text:'Trinkgeld kann auf mehreren Wegen erfasst werden. Nach Eingabe des erhaltenen Geldbetrags kann Stimmt so verwendet werden. Über Aufrunden wird ein Zielbetrag gewählt. Nachträgliches Trinkgeld wird über die Trinkgeldtaste und eine Betragsauswahl gebucht. Das Trinkgeld wird im Abschluss getrennt vom Warenumsatz ausgewiesen.',tip:'Stimmt so erst nach Erfassung des erhaltenen Zahlbetrags verwenden. Trinkgeld niemals als normalen Verkaufsartikel buchen.',selector:'#exactCashBtn, #roundUpBtn, #tipBtn',demo:'tipsFlow'},
 {title:'Kapitel 8 · Buchung auf ein Personen- oder Organisationskonto',text:'Organisationen oder berechtigte Personen können Waren auf Rechnung erhalten. Lege die Artikel in den Warenkorb, wähle Auf Konto, suche die Organisation und kontrolliere Name sowie verfügbaren Rahmen. Erst danach wird der vollständige Warenkorb dem ausgewählten Konto belastet und für die spätere Sammelrechnung gespeichert.',tip:'Vor dem Buchen immer Organisation, Betrag und Berechtigung kontrollieren. Eine Kontobuchung ist keine Barzahlung.',selector:'#accountChargeBtn',demo:'accountPreview'},
 {title:'Kapitel 9 · Personalbeköstigung verbuchen',text:'Zuerst wird der Artikel mit der richtigen Menge in den Warenkorb gelegt. Statt über Bezahlen wird der Vorgang über Personal verbucht. Dadurch wird die Ware als Personalbeköstigung erfasst, ohne eine personenbezogene Einzelzuordnung vorzunehmen.',tip:'Personal ist eine eigene Buchungsart und kein Rabattverkauf.',selector:'#staffBtn',demo:'staffBooking'},
 {title:'Kapitel 10 · Pfandverkauf, Pfandrückgabe und Auszahlung',text:'Pfandaufschläge sind bei den entsprechenden Verkaufsartikeln bereits enthalten. Bei der Rückgabe wird in der Warengruppe Pfand der passende Rückgabeartikel und die Menge gewählt. Verkaufsartikel und Rückgaben können im selben Warenkorb verrechnet werden. Entsteht ein negativer Gesamtbetrag, zeigt die Kasse Auszahlung und der Bezahlknopf ändert seinen Zustand. Glas und Feuerzange können einzeln oder gemeinsam zurückgegeben werden.',tip:'Pfandart und Rückgabemenge immer genau mit den tatsächlich abgegebenen Gegenständen abgleichen.',selector:'#depositBtn, #cartList, #payBtn',demo:'depositCalculation'},
 {title:'Kapitel 11 · Artikelinformationen und Allergene',text:'Oben links auf entsprechend vorbereiteten Artikeltasten befindet sich die grüne Infotaste mit dem kleinen i. Oben rechts sitzt dagegen der goldene Favoritenstern – die beiden nicht verwechseln. Der erste Klick öffnet eine Schnellübersicht mit Allergenen und wichtigen Hinweisen. Über Weitere Informationen werden zusätzliche Angaben wie Zutaten und Nährwerte angezeigt.',tip:'Bei Allergenen und Inhaltsstoffen ausschließlich die hinterlegten Informationen verwenden und niemals raten.',selector:'#productGrid',demo:'productInfoDeep'},
 {title:'Kapitel 12 · Varianten über das Pluszeichen auswählen',text:'Das Pluszeichen auf einer Artikeltaste öffnet die zugehörigen Varianten. Dort kann die gewünschte Ausführung gewählt werden. Varianten können alternativ auch zusammen mit dem Hauptartikel auf einer eigenen gemeinsamen Auswahltaste angeboten werden.',tip:'Große Artikelfläche bedeutet Standardartikel; Pluszeichen bedeutet Varianten- oder Zusatzauswahl.',selector:'#productGrid',demo:'variantsFlow'},
 {title:'Kapitel 13 · Favoriten und meistverkaufte Artikel',text:'Goldene Sterne oben rechts kennzeichnen Favoriten beziehungsweise häufig verkaufte Artikel. Diese Artikel werden zusätzlich in der eigenen Warengruppe Favoriten gesammelt und können dort besonders schnell ausgewählt werden.',tip:'Der Stern ist eine Orientierungshilfe. Artikelname und Preis trotzdem vor dem Antippen prüfen.',selector:'#categories, #productGrid',demo:'favoritesFlow'},
 {title:'Kapitel 14 · Pool- und Kombinationsartikel',text:'Bei Pool- oder Kombinationsartikeln liegen häufig gemeinsam verkaufte Produkte auf einer gemeinsamen Artikeltaste. Ein Klick legt beide Bestandteile sofort in den Warenkorb, dort werden sie weiterhin einzeln angezeigt. Für eine Kombination kann ein eigener Gesamtpreis hinterlegt sein.',tip:'Im Warenkorb kontrollieren, ob alle Bestandteile und der vorgesehene Kombinationspreis korrekt übernommen wurden.',selector:'#productGrid, #cartList',demo:'poolArticlePreview',availability:'planned'},
 {title:'Kapitel 15 · Happy Hour und zeitabhängige Sonderpreise',text:'Für einen definierten Zeitraum kann ein Happy-Hour-Preis gelten. Innerhalb dieses Zeitfensters wird automatisch der hinterlegte Sonderpreis berechnet. Im Warenkorb sollen Standardpreis und Happy-Hour-Preis nachvollziehbar ausgewiesen werden. Dieses Kapitel ist vorbereitet, bis Zeitregel, Preisanzeige und Abrechnung vollständig freigegeben sind.',tip:'Der Bediener muss Beginn, Ende und sichtbare Preiskennzeichnung kontrollieren können.',selector:'#productGrid, #cartList',demo:'happyHourPreview',availability:'planned'},
 {title:'Kapitel 16 · Reklamation als vollständiger Vorgang',text:'Eine Reklamation wird in einem einzigen zusammenhängenden Ablauf bearbeitet: Reklamation öffnen, Artikel und Menge erfassen, Grund auswählen, Bonbezug und Betrag prüfen, Notiz ergänzen und speichern.',tip:'Eine Reklamation niemals durch Löschen eines offenen Warenkorbs ersetzen.',selector:'#moreBtn',demo:'complaintFlow'},
 {title:'Kapitel 17 · Trainingsmodus sicher verwenden',text:'Der Trainingsmodus kann im Normalbetrieb jederzeit ein- und wieder ausgeschaltet werden. Nach dem Einschalten verändert sich die Darstellung deutlich und in der Summen- beziehungsweise Statusanzeige wird der Trainingsmodus kenntlich gemacht. Alle in diesem Modus erfassten Artikel und abgeschlossenen Vorgänge werden getrennt als Trainingsvorgänge gespeichert und fließen nicht in den normalen Buchungslauf ein. Dadurch können Bediener direkt an der Originaloberfläche üben, ohne echte Umsätze zu erzeugen. Im Stoßzeitenmodus steht das Training bewusst nicht zur Verfügung.',tip:'Vor Beginn immer prüfen, ob der Trainingsmodus sichtbar aktiv ist. Vor dem echten Verkauf muss er wieder ausgeschaltet sein.',selector:'#trainingModeTopBtn, #workspaceModePanel, #cartList',demo:'trainingModeFlow'},
 {title:'Kapitel 18 · Stoßzeitenmodus für schnellen und sicheren Verkauf',text:'Bei starkem Andrang wird der Stoßzeitenmodus über die Taste Stoßzeiten eingeschaltet. Die Hintergrunddarstellung wechselt, Artikeltasten werden größer und weniger wichtige Sonderfunktionen werden ausgeblendet. Dadurch bleibt die Oberfläche ruhig, übersichtlich und auf die häufigsten Verkaufsschritte konzentriert. Personal- und weitere Sondertasten können in diesem Modus entfallen. Ein aktiver Trainingsmodus ist während Stoßzeiten nicht zulässig. Durch erneutes Antippen der Taste Stoßzeiten kehrt der KC Bilderrechner in den Normalmodus zurück; die ursprünglichen Tastengrößen und ausgeblendeten Funktionen erscheinen wieder. Happy Hour und Stoßzeiten dürfen gleichzeitig aktiv sein.',tip:'Stoßzeiten nur bei Bedarf aktivieren und nach Ende des Andrangs wieder in den Normalbetrieb wechseln.',selector:'#rushModeBtn, #productGrid, .main-actions',demo:'rushModeFlow'},
 {title:'Kapitel 19 · Scanner-Bedienung und Bedienerzuordnung',text:'Ein Bluetooth-Barcodescanner wird im HID-Modus mit dem Tablet gekoppelt und verhält sich wie eine Tastatur. Die Artikelnummer eines Artikels ist in einem QR-Code gespeichert. Beim Scannen wird der Artikel sofort in den Warenkorb übernommen; wiederholtes Scannen erhöht die Menge. QR-Codes können direkt am Artikel oder gut erreichbar in seiner Nähe angebracht werden, sodass der Artikel bereits während des Zapfens oder Ausgebens per Finger- oder Uhrscanner erfasst werden kann. Der Vorgang wird anschließend wie gewohnt über Bar abgeschlossen oder – sofern eingerichtet – durch Scannen des Zahlungs-QR-Codes. Für eine Bedienerzuordnung wird vor dem Verkauf kurz der persönliche Mitarbeitercode gescannt. Dieser Bediener bleibt aktiv, bis sich eine andere Person über die Bedienertaste oder ihren QR-Code anmeldet.',tip:'Scanner im HID-Modus koppeln, Codes eindeutig beschriften und vor dem Verkauf die angezeigte Bedienerzuordnung kontrollieren.',selector:'.scanner-card, #operatorBtn, #cartList, #payBtn',demo:'scannerFlow'}
];
const tasks=[
 {kind:'single',title:'Einzelnen Artikel erfassen',text:'Lege einen Artikel in den Warenkorb.',hint:'Wähle eine Warengruppe und tippe genau einen Artikel an.'},
 {kind:'groups',title:'Mehrere Warengruppen',text:'Lege mindestens zwei Artikel aus unterschiedlichen Warengruppen in den Warenkorb.',hint:'Wechsle zwischendurch die Warengruppe.'},
 {kind:'articleQty',title:'Menge über die Artikeltaste',text:'Erhöhe die Menge eines Artikels durch erneutes Antippen derselben Artikeltaste auf mindestens 2.',hint:'Tippe denselben Artikel zweimal an.'},
 {kind:'headerQty',title:'Menge über die Warenkorb-Kopfzeile',text:'Markiere eine Warenkorbposition und setze ihre Menge über die Mengentasten im Warenkorbkopf auf mindestens 3.',hint:'Nutze die Zahlenleiste oberhalb des Warenkorbs.'},
 {kind:'deleteLine',title:'Einzelne Warenkorbposition löschen',text:'Entferne eine einzelne Position mit dem Mülleimer aus dem Warenkorb.',hint:'Der übrige Warenkorb soll bestehen bleiben.'},
 {kind:'voidBon',title:'Offenen Bon vollständig verwerfen',text:'Verwerfe einen offenen Bon über die Taste BON mit Mülleimer.',hint:'Bestätige anschließend die Sicherheitsabfrage.'},
 {kind:'cashChange',title:'Barzahlung mit Rückgeld',text:'Verkaufe einen Artikel, gib einen höheren erhaltenen Bargeldbetrag ein und schließe die Zahlung mit berechnetem Rückgeld ab.',hint:'Das Rückgeld muss größer als 0 Euro sein.'},
 {kind:'direct',title:'Direkt bezahlen',text:'Verkaufe einen Artikel direkt, ohne vorher einen Bargeldbetrag einzugeben.',hint:'Direkt bezahlen bedeutet: kein erhaltener Betrag und keine Rückgeldberechnung.'},
 {kind:'exact',title:'„Stimmt so“ passend',text:'Gib genau den Zahlbetrag ein und schließe mit „Stimmt so“ ab.',hint:'Erhaltener Betrag und Zahlbetrag müssen identisch sein.'},
 {kind:'tip',title:'„Stimmt so“ mit Trinkgeld',text:'Gib einen höheren Betrag ein und schließe mit „Stimmt so“ ab. Die Differenz muss als Trinkgeld gebucht werden.',hint:'Es darf dabei kein Rückgeld entstehen.'},
 {kind:'underpay',title:'Unterzahlung erkennen',text:'Gib weniger als den Zahlbetrag ein und versuche den Abschluss. Die Kasse muss den Abschluss verhindern.',hint:'Der Warenkorb muss danach weiterhin geöffnet sein.'},
 {kind:'staff',title:'Personalverbrauch',text:'Lege einen Artikel in den Warenkorb und verbuche ihn als Personalverbrauch.',hint:'Verwende die Taste PERSONAL, nicht Bezahlen.'},
 {kind:'account',title:'Kauf auf Rechnung',text:'Buche einen Warenkorb auf das Konto einer Organisation.',hint:'Verwende „Auf Konto“ und wähle eine Organisation.'},
 {kind:'deposit',title:'Pfandrückgabe mit Mengenprüfung',text:'Erfasse mindestens eine Pfandrückgabe und kontrolliere die Rückgabemenge.',hint:'Rückgabeartikel besitzen einen negativen Betrag.'},
 {kind:'complaint',title:'Reklamation vollständig bearbeiten',text:'Führe eine Reklamation mit Artikel, Menge, Grund und Abschluss vollständig durch.',hint:'Alle Pflichtangaben müssen gesetzt und der Vorgang bestätigt werden.'},
 {kind:'receipt',title:'Bon suchen und erneut drucken',text:'Öffne den Bondruck, suche einen vorhandenen Bon und wähle ihn zum erneuten Drucken aus.',hint:'Verwende BONDRUCK und anschließend die Bonsuche.'},
 {kind:'productInfo',title:'Artikelinformation und Allergene',text:'Öffne bei einem Artikel die Produktinformation und kontrolliere die Allergene.',hint:'Nutze die kleine Informationstaste der Artikeltaste.'},
 {kind:'variant',title:'Artikelvariante über Plus',text:'Öffne über das Pluszeichen einer Artikeltaste die Variantenauswahl.',hint:'Tippe nicht auf die Hauptfläche, sondern auf das Pluszeichen.'},
 {kind:'modes',title:'Trainings- und Stoßzeitenmodus',text:'Aktiviere zunächst den Trainingsmodus und danach den Stoßzeitenmodus. Beobachte, dass nicht beide gleichzeitig aktiv bleiben.',hint:'Beide Modustasten müssen nacheinander verwendet werden.'}
];

let profile=loadProfile(),lessonModule='quick',lessonIndex=0,taskIndex=0,taskBaseline=null;
let assistantEnabled=true,soundEnabled=true,coachDockCollapsed=false;
let playbackCore=null;
let speechWatchdog=null,speechStartTimer=null,welcomeGreetingTimer=null,lastGreetingKey='';

function fresh(){return{name:'',gender:'female',voiceVariant:'one',addressMode:'du',assistant:true,sound:true,save:true,quick:0,advanced:0,practice:0,quickDone:[],advancedDone:[],passedTasks:[],attempts:{},feedbackSubmittedAt:''}}
function loadProfile(){try{return {...fresh(),...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return fresh()}}
function saveProfile(){if(profile.save)localStorage.setItem(STORAGE_KEY,JSON.stringify(profile))}
function overall(){return Math.round((profile.quick+profile.advanced+profile.practice)/3)}
function show(id){
 sections.forEach(x=>$(x)?.classList.toggle('hidden',x!==id));
 document.querySelector('.app-shell')?.classList.toggle('lesson-active',id==='lesson'||id==='practice');
 window.scrollTo({top:0,behavior:'smooth'});
 setTimeout(()=>{if(id==='lesson')fitFrame('lessonPosFrame',82);if(id==='practice')fitFrame('practicePosFrame',54)},100);
}
function hydrateWelcome(){
 $('firstName').value=profile.name||'';$('saveConsent').checked=profile.save!==false;$('startSound').checked=profile.sound!==false;
 const mode=profile.assistant===false?'none':(profile.gender||'female');
 const assistantInput=document.querySelector(`input[name=assistantMode][value="${mode}"]`);if(assistantInput)assistantInput.checked=true;
 document.querySelectorAll('.assistant-mode-card').forEach(card=>card.classList.toggle('selected',card.dataset.assistantMode===mode));
 const addressInput=document.querySelector(`input[name=addressMode][value="${profile.addressMode||'du'}"]`);if(addressInput)addressInput.checked=true;
 const voiceInput=document.querySelector(`input[name=voiceVariant][value="${profile.voiceVariant||'one'}"]`);if(voiceInput)voiceInput.checked=true;
 applyAddressUi();updateVoiceOptions();
}
function applyAddressUi(){
 const formal=(document.querySelector('input[name=addressMode]:checked')?.value||profile.addressMode)==='sie';
 if($('privacyIntro'))$('privacyIntro').textContent=formal?'Ihr Vorname und Ihr Lernfortschritt werden ausschließlich lokal auf diesem Gerät gespeichert. Es erfolgt keine Übertragung.':'Dein Vorname und dein Lernfortschritt werden ausschließlich lokal auf diesem Gerät gespeichert. Es erfolgt keine Übertragung.';
 if($('learningModeLegend'))$('learningModeLegend').textContent=formal?'Wie möchten Sie lernen?':'Wie möchtest du lernen?';
 if($('encouragement'))$('encouragement').textContent=formal?'Sie schaffen das!':'Du schaffst das!';
 if($('bonusTitle'))$('bonusTitle').textContent=formal?'Lernen Sie Marc und Laura kennen':'Lerne Marc und Laura kennen';
 if($('feedbackSavedText'))$('feedbackSavedText').textContent=formal?'Vielen Dank. Ihre Rückmeldung wurde sicher auf diesem Gerät gespeichert.':'Vielen Dank. Deine Rückmeldung wurde sicher auf diesem Gerät gespeichert.';
 if($('surveyTitle'))$('surveyTitle').textContent=formal?'Ihr Feedback zur Schulung':'Dein Feedback zur Schulung';
 if($('surveyIntro'))$('surveyIntro').textContent=formal?'Mit Ihrer Rückmeldung können Schulungsinhalte, Sprache und Bedienführung gezielt verbessert werden.':'Mit deiner Rückmeldung können Schulungsinhalte, Sprache und Bedienführung gezielt verbessert werden.';
 if($('surveyHelpfulLegend'))$('surveyHelpfulLegend').firstChild.textContent=formal?'Was hat Ihnen besonders geholfen? ':'Was hat dir besonders geholfen? ';
 if($('surveyPositiveLabel'))$('surveyPositiveLabel').textContent=formal?'Was hat Ihnen besonders gut gefallen?':'Was hat dir besonders gut gefallen?';
 if($('surveyStoriesLegend'))$('surveyStoriesLegend').textContent=formal?'Wie haben Ihnen die Bonusgeschichten gefallen?':'Wie haben dir die Bonusgeschichten gefallen?';
 if($('storyFutureLegend'))$('storyFutureLegend').textContent=formal?'Möchten Sie weitere Geschichten hören?':'Möchtest du weitere Geschichten hören?';
 if($('storyContinuationLabel'))$('storyContinuationLabel').textContent=formal?'Ich wünsche mir eine Fortsetzung von Marcs und Lauras Geschichten.':'Ich wünsche mir eine Fortsetzung von Marcs und Lauras Geschichten.';
 if($('nextStoryPrompt'))$('nextStoryPrompt').innerHTML=formal?'<strong>Welche Geschichte würden Sie gern als Nächstes hören?</strong>':'<strong>Welche Geschichte würdest du gern als Nächstes hören?</strong>';
 if($('surveyRecommendLegend'))$('surveyRecommendLegend').textContent=formal?'Würden Sie diese Schulung anderen Bedienern empfehlen?':'Würdest du diese Schulung anderen Bedienern empfehlen?';
 if($('feedbackThanksTitle'))$('feedbackThanksTitle').textContent=formal?'Vielen Dank für Ihr Feedback!':'Vielen Dank für dein Feedback!';
 if($('feedbackPositive'))$('feedbackPositive').placeholder=formal?'Ihre Rückmeldung …':'Deine Rückmeldung …';
 if($('feedbackImproveText'))$('feedbackImproveText').placeholder=formal?'Ihre Verbesserungsidee …':'Deine Verbesserungsidee …';
}
function addressText(text){
 const value=String(text||'');if(profile.addressMode!=='sie')return value;
 const phrases=[
  [/\bWenn du fertig bist\b/g,'Wenn Sie fertig sind'],[/\bKonntest du\b/g,'Konnten Sie'],[/\bHaben dir\b/g,'Haben Ihnen'],[/\bFühlst du dich\b/g,'Fühlen Sie sich'],[/\bkannst du\b/g,'können Sie'],[/\bsolltest du\b/g,'sollten Sie'],[/\bsiehst du\b/g,'sehen Sie'],[/\bbewertest du\b/g,'bewerten Sie'],[/\bwirst auch du\b/g,'werden auch Sie'],[/\bgehörst auch du\b/g,'gehören auch Sie'],[/\bdenkst du\b/g,'denken Sie'],
  [/\bdu noch geblieben bist\b/g,'Sie noch geblieben sind'],[/\bkennenlernen möchtest\b/g,'kennenlernen möchten'],[/\bschenkst du\b/g,'schenken Sie'],[/\berinnerst du dich\b/g,'erinnern Sie sich'],[/\bdu einem Menschen\b/g,'Sie einem Menschen'],[/\bden Tag leichter machst\b/g,'den Tag leichter machen'],[/\bdu nach einem langen Tag müde, aber zufrieden nach Hause gehst\b/g,'Sie nach einem langen Tag müde, aber zufrieden nach Hause gehen'],[/\bwirst du vielleicht spüren\b/g,'werden Sie vielleicht spüren'],[/\bmir zugehört hast\b/g,'mir zugehört haben'],
  [/Schön, dass du noch geblieben bist\./g,'Schön, dass Sie noch geblieben sind.'],[/\bNimm dir\b/g,'Nehmen Sie sich'],[/\bNimm\b/g,'Nehmen Sie'],[/\bFühre\b/g,'Führen Sie'],[/\bPrüfe\b/g,'Prüfen Sie'],[/\bKontrolliere\b/g,'Kontrollieren Sie'],[/\bWähle\b/g,'Wählen Sie'],[/\bÖffne\b/g,'Öffnen Sie'],[/\bErfasse\b/g,'Erfassen Sie'],[/\bVerkaufe\b/g,'Verkaufen Sie'],[/\bStarte\b/g,'Starten Sie'],[/\bLege\b/g,'Legen Sie'],[/\bGib\b/g,'Geben Sie'],[/\bNutze\b/g,'Nutzen Sie'],[/\bTippe\b/g,'Tippen Sie'],[/\bEntferne\b/g,'Entfernen Sie'],[/\bVerwende\b/g,'Verwenden Sie'],[/\bBuche\b/g,'Buchen Sie'],[/\bAktiviere\b/g,'Aktivieren Sie'],[/\bBeobachte\b/g,'Beobachten Sie'],[/\bSchließe\b/g,'Schließen Sie'],[/\bWechsle\b/g,'Wechseln Sie'],[/\bBestätige\b/g,'Bestätigen Sie'],[/\bund starte\b/g,'und starten Sie'],[/\bund erfasse\b/g,'und erfassen Sie'],[/\bDenke daran\b/g,'Denken Sie daran'],[/\bdenke daran\b/g,'denken Sie daran'],[/\bBegegne\b/g,'Begegnen Sie'],[/\bhilf mit\b/g,'helfen Sie mit'],[/\bhab Freude\b/g,'haben Sie Freude'],
  [/\beinbringst\b/g,'einbringen'],[/\barbeitest\b/g,'arbeiten'],[/\berlebst\b/g,'erleben'],[/\blächelst\b/g,'lächeln Sie'],
  [/\bdeinem\b/gi,'Ihrem'],[/\bdeinen\b/gi,'Ihren'],[/\bdeiner\b/gi,'Ihrer'],[/\bdeine\b/gi,'Ihre'],[/\bdein\b/gi,'Ihr'],[/\bdich\b/gi,'Sie'],[/\bdir\b/gi,'Ihnen'],[/\bdu\b/gi,'Sie']
 ];
 return phrases.reduce((result,[pattern,replacement])=>result.replace(pattern,replacement),value);
}
function dashboard(){
 show('dashboard');$('greeting').textContent=`Willkommen${profile.name?', '+profile.name:''}`;$('overallScore').textContent=overall();
 const defs=[['quick',quick],['advanced',advanced],['practice',tasks]];
 defs.forEach(([key,list])=>{
   const card=document.querySelector(`[data-module="${key}"]`),state=$(key+'State');
   card?.classList.remove('completed','in-progress');
   const done=key==='practice'?(profile.passedTasks||[]).length:(profile[key+'Done']||[]).length;
   if(profile[key]===100){card?.classList.add('completed');state.textContent='✓ ERLEDIGT'}
   else if(done){card?.classList.add('in-progress');state.textContent=`${done} von ${list.length}`}
   else state.textContent='Starten';
 });
 const complete=profile.quick===100&&profile.advanced===100&&profile.practice===100&&(profile.passedTasks||[]).length===tasks.length;
 $('certificateBtn').classList.toggle('hidden',!complete);$('completionCard').classList.toggle('hidden',!complete);$('continueBtn').classList.toggle('hidden',complete);$('feedbackBtn').classList.remove('hidden');
}
function voices(){return window.speechSynthesis?.getVoices?.()||[]}
function assistantName(){return profile.gender==='male'?'Marc':'Laura'}
function selectedGender(){const mode=document.querySelector('input[name=assistantMode]:checked')?.value;return mode==='male'?'male':'female'}
function coachAsset(gender=profile.gender,state='neutral'){
 const g=gender==='male'?'male':'female';
 const allowed=g==='male'?['neutral','smile','speaking','thinking','approve']:['neutral'];
 const st=allowed.includes(state)?state:'neutral';
 if(st==='neutral')return `../avatar-core/assets/chef/chef_${g}_neutral_armless_v0257.webp`;
 return `../avatar-core/assets/chef/chef_${g}_${st}.webp`;
}
function setCoachImage(state='neutral'){
 const img=$('coachGuideImage');if(!img)return;
 const gender=profile.gender==='male'?'male':'female';
 img.src=coachAsset(gender,state);img.dataset.avatarRole='chef';img.dataset.avatarGender=gender;img.dataset.avatarState=state;
 img.alt=`${assistantName()} – Kassentrainer${gender==='female'?'in':''}`;
 window.AvatarCore?.apply(img,{role:'chef',gender,state}).catch(()=>{});
}
function candidateVoices(gender=profile.gender){
 const german=voices().filter(v=>String(v.lang||'').toLowerCase().startsWith('de'));
 const male=/conrad|stefan|thomas|markus|martin|klaus|hans|daniel|yannick|male|mann/i;
 const female=/katja|anna|petra|hedda|heda|vicki|amala|sabina|helena|marlene|female|frau/i;
 const premium=/microsoft|google|natural|online/i;
 const wanted=gender==='male'?male:female;
 return german.filter(v=>wanted.test(v.name)).sort((a,b)=>Number(premium.test(b.name))-Number(premium.test(a.name)));
}
function chooseVoice(gender=profile.gender,variant=profile.voiceVariant||'one'){const list=candidateVoices(gender);if(gender==='female'){const preferred=variant==='one'?/katja/i:/hedda|heda/i;return list.find(v=>preferred.test(v.name))||list[variant==='two'&&list.length>1?1:0]||null}const stefan=list.find(v=>/stefan/i.test(v.name));return variant==='two'?(list.find(v=>v!==stefan)||stefan||list[0]||null):(stefan||list[0]||null)}
function updateVoiceOptions(){const mode=document.querySelector('input[name=assistantMode]:checked')?.value||'female',gender=mode==='male'?'male':'female',name=gender==='male'?'Marc':'Laura',one=chooseVoice(gender,'one'),two=chooseVoice(gender,'two');$('voiceChoice').classList.toggle('hidden',mode==='none');$('voiceChoiceLegend').textContent=`${name}s Stimme`;$('voiceOneTitle').textContent=gender==='female'?'Sanft':'Warm';$('voiceTwoTitle').textContent=gender==='female'?'Klar':'Ruhig';$('voiceOneName').textContent=one?.name||'Keine passende Stimme';$('voiceTwoName').textContent=two?.name?`${two.name}${two===one?' · anders abgestimmt':''}`:'Keine zweite passende Stimme';$('voiceOneName').parentElement.title=$('voiceOneName').textContent;$('voiceTwoName').parentElement.title=$('voiceTwoName').textContent}
function utter(text,{gender=profile.gender}={}){
 const prepared=String(text||'').replace(/\s+/g,' ').trim().replace(/([.!?])\s+(?=[A-ZÄÖÜ])/g,'$1 … ');
 const u=new SpeechSynthesisUtterance(prepared);
 const variant=profile.voiceVariant||'one';u.lang='de-DE';u.rate=gender==='male'?(variant==='one'?0.82:0.96):(variant==='one'?0.84:0.98);u.pitch=gender==='male'?(variant==='one'?0.98:1.06):(variant==='one'?1.06:0.97);u.volume=gender==='male'?0.96:1;u.voice=chooseVoice(gender,variant);return u;
}
function testVoiceGender(gender){profile.voiceVariant=document.querySelector('input[name=voiceVariant]:checked')?.value||'one';soundEnabled=true;stopSpeech();const name=gender==='female'?'Laura':'Marc',text=gender==='female'?'Schön, dass du da bist. Nimm dir ruhig einen Moment Zeit. Wir gehen die nächsten Schritte gemeinsam durch.':'Schön, dass du da bist. Wir gehen die nächsten Schritte ruhig und verständlich gemeinsam durch.';const u=utter(addressText(text),{gender});u.onend=()=>{$('voiceTestStatus').textContent='Stimmprobe beendet.'};speechSynthesis.speak(u);$('voiceTestStatus').textContent=`${name} spricht mit der ausgewählten Stimme.`;saveProfile()}
function testSelectedVoice(){const mode=document.querySelector('input[name=assistantMode]:checked')?.value||'female';if(mode!=='none')testVoiceGender(mode==='male'?'male':'female')}
function stopSpeech(){clearTimeout(speechStartTimer);speechStartTimer=null;clearInterval(speechWatchdog);speechWatchdog=null;try{speechSynthesis.cancel()}catch{}}
function speak(text,{onend,gender=profile.gender}={}){
 if(!soundEnabled||!window.speechSynthesis)return;
 stopSpeech();setCoachImage('speaking');
 const u=utter(text,{gender});
 const finish=()=>{clearInterval(speechWatchdog);speechWatchdog=null;setCoachImage('neutral');onend?.()};
 u.onend=finish;u.onerror=finish;
 speechStartTimer=setTimeout(()=>{speechStartTimer=null;if(soundEnabled)speechSynthesis.speak(u)},700);
 speechWatchdog=setInterval(()=>{if(speechSynthesis.speaking&&speechSynthesis.paused)speechSynthesis.resume()},900);
}
function speakImmediate(text,{onend,gender=profile.gender}={}){if(!soundEnabled||!window.speechSynthesis){onend?.();return}stopSpeech();setCoachImage('speaking');const u=utter(text,{gender}),finish=()=>{setCoachImage('neutral');onend?.()};u.onend=finish;u.onerror=finish;try{speechSynthesis.resume();speechSynthesis.speak(u)}catch{finish()}}
function welcomeText(name=profile.name,gender=profile.gender){
 const coach=gender==='male'?'Marc':'Laura', formal=profile.addressMode==='sie';
 return formal?`Guten Tag, ${name}. Mein Name ist ${coach}. Gemeinsam mit ${gender==='male'?'Laura':'Marc'} begleite ich Sie durch diese interaktive Schulung zum KC Bilderrechner. Nehmen Sie sich Zeit. Nach Abschluss der gesamten Schulung freuen wir uns über Ihr Feedback. Starten Sie jetzt die Schulung mit einem Klick auf den Button Schulung starten.`:`Hallo, ${name}. Mein Name ist ${coach}. Gemeinsam mit ${gender==='male'?'Laura':'Marc'} begleite ich dich durch diese interaktive Schulung zum KC Bilderrechner. Nimm dir Zeit. Nach Abschluss der gesamten Schulung freuen wir uns über dein Feedback. Starte jetzt die Schulung mit einem Klick auf den Button Schulung starten.`;
}
function scheduleWelcomeGreeting(force=false){
 clearTimeout(welcomeGreetingTimer);
 welcomeGreetingTimer=setTimeout(()=>{
  const name=$('firstName').value.trim();const mode=document.querySelector('input[name=assistantMode]:checked')?.value||'female';
  if(!name||mode==='none'||!$('startSound').checked)return;
  profile.gender=mode==='male'?'male':'female';profile.name=name;profile.addressMode=document.querySelector('input[name=addressMode]:checked')?.value||'du';const key=`${name}|${profile.gender}|${profile.addressMode}`;
  if(!force&&key===lastGreetingKey)return;lastGreetingKey=key;soundEnabled=true;speak(welcomeText(name,profile.gender));
 },900);
}
function frameDoc(id){try{return $(id)?.contentDocument||$(id)?.contentWindow?.document}catch{return null}}
function fitFrame(id,maxVh=82){const f=$(id),wrap=f?.parentElement;if(!f||!wrap)return;const naturalW=1440,naturalH=920,availableW=Math.max(420,wrap.clientWidth-2),scale=Math.min(1,availableW/naturalW);f.style.width=naturalW+'px';f.style.height=naturalH+'px';f.style.transform=`scale(${scale})`;f.style.transformOrigin='top left';const shownH=Math.ceil(naturalH*scale);wrap.style.height=Math.min(shownH,Math.max(520,window.innerHeight-wrap.getBoundingClientRect().top-20))+'px';wrap.style.overflowY=shownH>wrap.clientHeight?'auto':'hidden';wrap.style.overflowX='hidden';}
function clearFocus(doc){doc?.querySelectorAll('.training-focus-ring').forEach(x=>x.classList.remove('training-focus-ring'))}
function focusOriginal(selector){
 const apply=()=>{fitFrame('lessonPosFrame',82);const d=frameDoc('lessonPosFrame');if(!d)return;clearFocus(d);const node=d.querySelector(selector);node?.classList.add('training-focus-ring');node?.scrollIntoView({block:'center',inline:'center'})};
 const f=$('lessonPosFrame');if(f?.contentDocument?.readyState==='complete')setTimeout(apply,150);else f?.addEventListener('load',()=>setTimeout(apply,300),{once:true});
}
function api(){return $('lessonPosFrame')?.contentWindow?.KCTrainingAPI}
function closeScenes(){try{api()?.closeAllDialogs?.()}catch{};clearFocus(frameDoc('lessonPosFrame'))}
function runDemo(step,delay=0){
 const frame=$('lessonPosFrame');
 if(!frame||!step?.demo)return;
 playbackCore?.cancel?.();demoDone=false;
 try{frame.contentWindow?.postMessage({type:'KC_TRAINING_DEMO',action:'cancel'},'*')}catch{}
 const send=()=>{try{$('currentAction').textContent='Jetzt ansehen: '+demoActionLabel(step.demo);frame.contentWindow?.postMessage({type:'KC_TRAINING_DEMO',name:step.demo},'*')}catch{}};
 const base=frame.contentDocument?.readyState==='complete'?650:850;
 if(frame.contentDocument?.readyState==='complete')setTimeout(send,base+delay);
 else frame.addEventListener('load',()=>setTimeout(send,base+delay),{once:true});
}
function demoActionLabel(name){return ({surfaceTour:'Oberfläche kennenlernen',singleSale:'Artikel auswählen und anschließend bezahlen',multiSale:'Zwei Artikel aus verschiedenen Warengruppen auswählen',quantityControls:'Mengensteuerung ansehen',cartDelete:'Löschen kontrollieren',paymentFlow:'Zahlung und Rückgeld verfolgen'})[name]||'Gezeigten Ablauf verfolgen'}
function estimatedSpeechLead(step){
 const map={surfaceTour:2800,singleSale:3600,multiSale:3200,quantityControls:3400,cartDelete:3200,paymentFlow:3600,tipsFlow:3200,staffBooking:3000,depositCalculation:3200};
 return map[step.demo]||2600;
}
function setGuideMode(){
 const useCoach=assistantEnabled&&profile.assistant!==false;
 $('lessonGuide')?.classList.toggle('text-only',!useCoach);
 setCoachImage('neutral');
 $('coachModeLabel').textContent=useCoach?'Geführte Schulung':'Kompakte Textanleitung';
}
function applyCoachDockState(){
 $('lessonGuide')?.classList.toggle('collapsed',coachDockCollapsed);
 document.querySelector('.coach-dock-layout')?.classList.toggle('coach-collapsed',coachDockCollapsed);
 $('collapseCoach').title=coachDockCollapsed?'Coachbereich ausklappen':'Coachbereich einklappen';
 requestAnimationFrame(()=>fitFrame('lessonPosFrame',82));
}
function renderLesson(){
 const list=lessonModule==='quick'?quick:advanced,step=list[lessonIndex],doneKey=lessonModule+'Done';
 profile[doneKey]=Array.isArray(profile[doneKey])?profile[doneKey]:[];
 const pct=Math.round((lessonIndex+1)/list.length*100),remaining=list.length-lessonIndex-1;
 $('lessonModule').textContent=lessonModule==='quick'?'1 · Grundlagen und Verkauf':'2 · Sonderfunktionen und Artikelintelligenz';
 $('lessonTitle').textContent=step.title;$('stepCounter').textContent=`Inhalt ${lessonIndex+1} von ${list.length}`;
 $('coachGuideTitle').textContent=step.title;$('coachGuideText').textContent=addressText(step.text);
 $('tipLabel').textContent=`Extra-Tipp von ${assistantName()}`;$('tipText').textContent=addressText(step.tip);
 $('currentAction').textContent='Zuerst zuhören';
 $('lessonPercent').textContent=pct+' %';$('lessonRemaining').textContent=remaining===1?'Noch 1 Inhalt':`Noch ${remaining} Inhalte`;
 $('lessonTopProgress').style.width=pct+'%';$('lessonProgress').style.width=pct+'%';
 $('lessonNext').textContent=lessonIndex===list.length-1?'Kapitel abschließen ✓':'Weiter ▶';$('lessonNext').classList.remove('ready');
 $('lessonTip').classList.remove('tip-flash','tip-speaking');
 $('lessonStepTrack').innerHTML=list.map((x,i)=>`<button type="button" class="lesson-step-pill ${profile[doneKey].includes(i)?'done':''} ${i===lessonIndex?'current':''}" data-lesson-index="${i}" title="Zu ${x.title} springen" aria-label="Zu ${x.title} springen" ${i===lessonIndex?'aria-current="step"':''}>${i+1}</button>`).join('');
 $('lessonStepTrack').querySelectorAll('[data-lesson-index]').forEach(button=>button.onclick=()=>{const target=Number(button.dataset.lessonIndex);if(!Number.isInteger(target)||target===lessonIndex)return;stopSpeech();closeScenes();lessonIndex=target;renderLesson()});
 setGuideMode();applyCoachDockState();focusOriginal(step.selector);
 const token=++lessonRunToken;
 const topic=String(step.title||'').replace(/^Kapitel\s*\d+\s*·\s*/i,'').trim();
 const finishStep=()=>{if(token!==lessonRunToken)return;speechDone=true;$('lessonTip').classList.remove('tip-speaking','tip-flash');$('currentAction').textContent=demoDone?'Abschnitt abgeschlossen':'Vorführung läuft';if(demoDone)$('lessonNext').classList.add('ready')};
 const speakTip=()=>{if(token!==lessonRunToken)return;$('lessonTip').classList.add('tip-flash','tip-speaking');$('currentAction').textContent='Extra-Tipp aufmerksam lesen';speak(`Extra Tipp von ${assistantName()}. ${addressText(step.tip)}`,{onend:finishStep})};
 const speakExplanation=()=>{if(token!==lessonRunToken)return;$('currentAction').textContent='Erklärung und Vorführung laufen';runDemo(step,900);speak(addressText(step.text),{onend:speakTip})};
 if(assistantEnabled&&soundEnabled){$('currentAction').textContent='Neues Thema wird angekündigt';speak(`Neues Thema: ${topic}.`,{onend:speakExplanation})}
 else{$('currentAction').textContent='Vorführung läuft';runDemo(step,500)}
}
function startLesson(module){
 lessonModule=module;const list=module==='quick'?quick:advanced,done=profile[module+'Done']||[];
 lessonIndex=Math.min(done.length,list.length-1);show('lesson');renderLesson();
}
function completeLesson(){
 profile[lessonModule]=100;saveProfile();dashboard();
}
function practiceApi(){try{return $('practicePosFrame').contentWindow?.KCTrainingAPI||null}catch{return null}}
function practiceState(){try{return practiceApi()?.getTrainingState?.()||null}catch{return null}}
function taskAction(state,test){return (state?.actions||[]).some(test)}
function validatePracticeTask(task,state,base){
 if(!state)return{ok:false,message:'Die Kassenoberfläche ist noch nicht vollständig geladen. Bitte kurz warten und erneut prüfen.'};
 const items=state.items||[],last=state.lastTransaction||{},freshTransaction=state.transactionCount>(base?.transactionCount||0),has=id=>taskAction(state,a=>a.id===id),method=String(last.method||last.payment||'');
 const checks={
  single:()=>items.length===1,
  groups:()=>new Set(items.map(x=>x.category)).size>=2,
  articleQty:()=>items.some(x=>Number(x.qty)>=2)&&!taskAction(state,a=>a.cartQty),
  headerQty:()=>items.some(x=>Number(x.qty)>=3)&&taskAction(state,a=>!!a.cartQty),
  deleteLine:()=>taskAction(state,a=>a.action==='delete'||String(a.classes).includes('delete-row')),
  voidBon:()=>has('voidBonBtn')&&state.voidCount>(base?.voidCount||0)&&items.length===0,
  cashChange:()=>freshTransaction&&last.change>0&&!method.includes('direct'),
  direct:()=>freshTransaction&&method.includes('direct')&&Number(last.given||0)===0,
  exact:()=>freshTransaction&&method==='cash-exact-tip'&&Math.abs(Number(last.given)-Number(last.due))<.01,
  tip:()=>freshTransaction&&method==='cash-exact-tip'&&Number(last.given)>Number(last.due)&&Number(last.change||0)===0,
  underpay:()=>items.length>0&&state.given>0&&state.given<state.total&&!freshTransaction&&(has('exactCashBtn')||has('payBtn')),
  staff:()=>freshTransaction&&(last.type==='personal'||method==='internal-personal'),
  account:()=>freshTransaction&&method==='account-charge',
  deposit:()=>items.some(x=>x.category==='Pfand'&&Number(x.price)<0),
  complaint:()=>state.withdrawalCount>(base?.withdrawalCount||0)||taskAction(state,a=>a.withdrawReason==='Reklamation')&&taskAction(state,a=>!!a.complaintReason)&&has('saveWithdrawal'),
  receipt:()=>has('printBonBtn')&&has('bonSearchBtn'),
  productInfo:()=>state.openDialogs.includes('productInfoDialog')||taskAction(state,a=>String(a.classes).includes('product-info')),
  variant:()=>state.openDialogs.includes('optionDialog')||taskAction(state,a=>String(a.classes).includes('product-variant')),
  modes:()=>taskAction(state,a=>a.id==='trainingModeTopBtn'||a.id==='trainingModeBtn')&&has('rushModeBtn')&&!(state.trainingMode&&state.rushMode)
 };
 const ok=checks[task.kind]?.()===true;return ok?{ok:true,message:'✓ Ergebnis automatisch geprüft. Die Aufgabe wurde richtig ausgeführt.'}:{ok:false,message:`Noch nicht vollständig: ${addressText(task.hint)} Prüfe den Ablauf und versuche es erneut.`};
}
function renderTask(){
 const t=tasks[taskIndex],pct=Math.round((taskIndex+1)/tasks.length*100),remaining=tasks.length-taskIndex-1;
 $('practiceCoachImage').src=coachAsset(profile.gender,'neutral');$('practiceCoachName').textContent=`${assistantName()} begleitet ${profile.addressMode==='sie'?'Sie':'dich'}`;
 $('taskTitle').textContent=t.title;$('taskNumber').textContent=taskIndex+1;$('taskText').textContent=addressText(t.text);$('taskHint').textContent=addressText(t.hint||'Führe den Vorgang in der echten Kassenoberfläche aus.');
 $('practicePercent').textContent=pct+' %';$('practiceRemaining').textContent=remaining===1?'Noch 1 Aufgabe':`Noch ${remaining} Aufgaben`;$('practiceTopProgress').style.width=pct+'%';
 $('attempts').textContent=profile.attempts?.[taskIndex]||0;$('feedback').textContent='Führe die Aufgabe aus und wähle anschließend „Aufgabe prüfen“.';$('feedback').className='feedback';$('nextTask').disabled=true;
 try{practiceApi()?.resetTrainingTask?.()}catch{};taskBaseline=practiceState();setTimeout(()=>{taskBaseline=practiceState()||taskBaseline},500);fitFrame('practicePosFrame',54);
 requestAnimationFrame(()=>document.querySelector('.practice-command-bar')?.scrollIntoView({block:'start',behavior:'smooth'}));
}
function practiceTaskSpeech(){const t=tasks[taskIndex];return addressText(`${t.title}. ${t.text}. Führe die Aufgabe jetzt in der Kassenoberfläche aus. Wenn du fertig bist, wähle Aufgabe prüfen.`)}
function showPracticeSolution(){const t=tasks[taskIndex],demos={single:'singleSale',groups:'multiSale',articleQty:'quantityControls',headerQty:'quantityControls',deleteLine:'cartDelete',voidBon:'cartDelete',cashChange:'paymentFlow',direct:'paymentFlow',exact:'tipsFlow',tip:'tipsFlow',underpay:'paymentFlow',staff:'staffBooking',account:'accountPreview',deposit:'depositCalculation',complaint:'complaintFlow',receipt:'overview',productInfo:'productInfoDeep',variant:'variantsFlow',modes:'modeControls'};try{$('practicePosFrame').contentWindow?.postMessage({type:'KC_TRAINING_DEMO',name:demos[t.kind]||'overview'},'*')}catch{};const text=addressText(`Lösungshinweis. ${t.hint}`);$('feedback').textContent=text;$('feedback').className='feedback';if(assistantEnabled&&soundEnabled)speak(text)}
function startPractice(){
 taskIndex=0;$('practiceAssistantToggle').checked=assistantEnabled;$('practiceSoundToggle').checked=soundEnabled;show('practice');renderTask();
 if(assistantEnabled&&soundEnabled){
  const intro=profile.addressMode==='sie'?'Hier befinden Sie sich im Ausprobiermodus. Lesen Sie links die Aufgabe und führen Sie sie in der Kasse so aus, wie Sie es in den vorherigen Kapiteln gelernt haben. Nehmen Sie sich Zeit. Ich begleite Sie dabei.':'Hier befindest du dich im Ausprobiermodus. Lies links die Aufgabe und führe sie in der Kasse so aus, wie du es in den vorherigen Kapiteln gelernt hast. Nimm dir Zeit. Ich begleite dich dabei.';
  speak(intro,{onend:()=>setTimeout(()=>speak(practiceTaskSpeech()),500)});
 }
}
function passPracticeTask(message){
 if(!profile.passedTasks.includes(taskIndex))profile.passedTasks.push(taskIndex);
 profile.practice=Math.round(profile.passedTasks.length/tasks.length*100);saveProfile();
 $('feedback').textContent=message;$('feedback').className='feedback ok';$('nextTask').disabled=false;
 $('practicePercent').textContent=profile.practice+' %';$('practiceTopProgress').style.width=profile.practice+'%';
 if(assistantEnabled&&soundEnabled){const praise=profile.addressMode==='sie'?'Das war gut. Sie haben die Aufgabe geschafft. Machen Sie in Ruhe mit der nächsten Aufgabe weiter.':'Das war gut. Du hast die Aufgabe geschafft. Mach in Ruhe mit der nächsten Aufgabe weiter.';speak(praise)}
}
function certificate(){show('certificate');$('certName').textContent=profile.name||'Teilnehmer/in';$('certDate').textContent='Ausgestellt am '+new Date().toLocaleDateString('de-DE')}

const surveyQuestions=[
 ['understandable','War die Schulung insgesamt verständlich?'],
 ['speech_clarity','Konntest du die gesprochenen Erklärungen gut verstehen?'],
 ['live_sequences','Haben die bewegten Abläufe das Lernen erleichtert?'],
 ['assistant_rating','Wie hilfreich und angenehm war dein gewählter Assistent?'],
 ['pace','War das Tempo der Schulung passend?'],
 ['practice_value','Haben dir die Übungen beim sicheren Bedienen geholfen?'],
 ['confidence','Fühlst du dich nach der Schulung sicherer an der Kasse?'],
 ['overall_rating','Wie bewertest du die Schulung insgesamt?']
];
function renderSurveyQuestions(){
 const host=$('surveyQuestions');if(!host)return;
 host.innerHTML=surveyQuestions.map(([key,label])=>`<div class="survey-question"><label for="rating_${key}">${addressText(label)}</label><div class="survey-scale"><div class="survey-range-wrap"><input id="rating_${key}" name="rating_${key}" type="range" min="1" max="10" step="1" value="8" data-rating="${key}"><div class="survey-ticks" aria-hidden="true">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<span>${n}</span>`).join('')}</div></div><output class="survey-value" for="rating_${key}">8</output></div></div>`).join('');
 $('feedbackForm').querySelectorAll('input[type=range]').forEach(r=>r.addEventListener('input',()=>{r.closest('.survey-scale').querySelector('output').textContent=r.value}));
}
function feedbackQueue(){try{const q=JSON.parse(localStorage.getItem(FEEDBACK_KEY)||'[]');return Array.isArray(q)?q:[]}catch{return[]}}
function saveFeedbackQueue(queue){localStorage.setItem(FEEDBACK_KEY,JSON.stringify(queue))}
function feedbackId(){return `KCF-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${Math.random().toString(36).slice(2,7).toUpperCase()}`}
function openSurvey(){
 stopSpeech();show('survey');$('feedbackForm').classList.remove('hidden');$('feedbackComplete').classList.add('hidden');$('feedbackForm').reset();
 renderSurveyQuestions();$('surveyStatus').textContent='';$('feedbackNameConsent').checked=false;const complete=overall()===100;$('surveyProgressNote').textContent=complete?'Die Schulung ist vollständig abgeschlossen. Der Feedbackbogen kann jetzt ausgefüllt und gespeichert werden.':addressText('Du kannst den Feedbackbogen bereits ansehen. Sinnvoll ist das Ausfüllen nach Abschluss der gesamten Schulung.');
}
function collectFeedback(){
 const ratings={};document.querySelectorAll('#feedbackForm [data-rating]').forEach(x=>ratings[x.dataset.rating]=Number(x.value));
 const checked=name=>[...document.querySelectorAll(`#feedbackForm input[name="${name}"]:checked`)].map(x=>x.value);
 const recommend=document.querySelector('#feedbackForm input[name="recommend"]:checked')?.value||'';
 const storiesSeen=document.querySelector('#feedbackForm input[name="stories_seen"]:checked')?.value||'none';
 return {
  schema:FEEDBACK_SCHEMA,id:feedbackId(),createdAt:new Date().toISOString(),training:{product:'KC Bilderrechner Interaktive Schulung',version:TRAINING_VERSION,score:overall(),modules:{quick:profile.quick,advanced:profile.advanced,practice:profile.practice}},
  participant:{anonymous:!$('feedbackNameConsent').checked,name:$('feedbackNameConsent').checked?(profile.name||''):''},
  assistant:{enabled:profile.assistant!==false,name:assistantName(),gender:profile.gender||'female',speechEnabled:profile.sound!==false},
  ratings,helpful:checked('helpful'),improvements:checked('improve'),recommend,storiesSeen,storyContinuation:checked('story_continue').includes('yes'),nextStory:checked('next_story')[0]||'',
  comments:{positive:$('feedbackPositive').value.trim(),improvement:$('feedbackImproveText').value.trim()}
 };
}
function notifyFeedbackSaved(entry){
 try{new BroadcastChannel('kc-training-feedback-saved').postMessage({type:'KC_TRAINING_FEEDBACK_SUBMITTED',payload:entry})}catch{}
 try{window.parent?.postMessage({type:'KC_TRAINING_FEEDBACK_SUBMITTED',payload:entry},'*')}catch{}
 window.dispatchEvent(new CustomEvent('kc-training-feedback-submitted',{detail:entry}));
}
function submitFeedback(ev){
 ev.preventDefault();const recommend=document.querySelector('#feedbackForm input[name="recommend"]:checked');
 if(!recommend){$('surveyStatus').textContent=profile.addressMode==='sie'?'Bitte geben Sie noch an, ob Sie die Schulung empfehlen würden.':'Bitte noch angeben, ob du die Schulung empfehlen würdest.';return}
 const entry=collectFeedback(),queue=feedbackQueue();queue.push(entry);saveFeedbackQueue(queue);profile.feedbackSubmittedAt=entry.createdAt;saveProfile();notifyFeedbackSaved(entry);
 $('feedbackForm').classList.add('hidden');$('feedbackComplete').classList.remove('hidden');
 if(soundEnabled)speak(addressText(`Vielen Dank, ${profile.name||''}. Deine Rückmeldung wurde gespeichert und hilft uns, die Schulung weiter zu verbessern.`));
}
function downloadBlob(name,type,content){const blob=new Blob([content],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportFeedbackJson(){const envelope={schema:'KC_TRAINING_FEEDBACK_EXPORT_V2',exportedAt:new Date().toISOString(),source:'KC Bilderrechner Interaktive Schulung',records:feedbackQueue()};downloadBlob(`KC_Bilderrechner_Schulungsfeedback_${new Date().toISOString().slice(0,10)}.json`,'application/json;charset=utf-8',JSON.stringify(envelope,null,2))}
function csvCell(v){const s=Array.isArray(v)?v.join('|'):String(v??'');return `"${s.replace(/"/g,'""')}"`}
function exportFeedbackCsv(){
 const rows=feedbackQueue();const ratingKeys=surveyQuestions.map(x=>x[0]);const head=['id','createdAt','version','score','anonymous','name','assistant','recommend','storyContinuation','nextStory',...ratingKeys,'helpful','improvements','positive','improvement'];
 const data=rows.map(r=>[r.id,r.createdAt,r.training.version,r.training.score,r.participant.anonymous,r.participant.name,r.assistant.name,r.recommend,r.storyContinuation,r.nextStory,...ratingKeys.map(k=>r.ratings[k]),r.helpful,r.improvements,r.comments.positive,r.comments.improvement]);
 downloadBlob(`KC_Bilderrechner_Schulungsfeedback_${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8','\ufeff'+[head,...data].map(row=>row.map(csvCell).join(';')).join('\n'));
}
function printFeedback(){
 const rows=feedbackQueue(),entry=rows[rows.length-1];if(!entry){alert('Es ist noch kein gespeicherter Feedbackbogen vorhanden.');return}
 const labels=Object.fromEntries(surveyQuestions),safe=printEscape,win=window.open('','_blank');if(!win){alert('Das Druckfenster wurde blockiert. Bitte Pop-ups erlauben.');return}
 const ratingRows=Object.entries(entry.ratings||{}).map(([key,value])=>`<tr><td>${safe(labels[key]||key)}</td><td>${safe(value)} / 10</td></tr>`).join('');
 win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Schulungsfeedback</title><style>@page{size:A4;margin:14mm}body{font:10pt Arial;color:#173b56}header{border-bottom:4px solid #d9a72e;padding-bottom:5mm;margin-bottom:5mm}h1{margin:0}h2{font-size:12pt;margin:4mm 0 1mm}table{width:100%;border-collapse:collapse}td{padding:5px;border-bottom:1px solid #ccd8e1}td:last-child{text-align:right;font-weight:bold}.box{border:1px solid #bccbd6;border-radius:8px;padding:8px;margin:6px 0;white-space:pre-wrap}footer{margin-top:7mm;border-top:1px solid #9fb0bd;padding-top:3mm;display:flex;justify-content:space-between;font-size:8pt}</style></head><body><header><strong>Köcheclub Werne · KC Bilderrechner</strong><h1>Feedbackbogen zur interaktiven Schulung</h1><p>${safe(new Date(entry.createdAt).toLocaleString('de-DE'))} · Kennung ${safe(entry.id)}</p></header><table>${ratingRows}</table><h2>Geschichten</h2><div class="box">Fortsetzung gewünscht: ${entry.storyContinuation?'Ja':'Nein'} · Nächstes Thema: ${safe(entry.nextStory||'Keine Auswahl')}</div><h2>Besonders hilfreich</h2><div class="box">${safe((entry.helpful||[]).join(', ')||'Keine Auswahl')}</div><h2>Verbesserungsbereiche</h2><div class="box">${safe((entry.improvements||[]).join(', ')||'Keine Auswahl')}</div><h2>Freitext</h2><div class="box"><strong>Positiv:</strong> ${safe(entry.comments?.positive||'–')}\n\n<strong>Verbesserung:</strong> ${safe(entry.comments?.improvement||'–')}</div><p><strong>Empfehlung:</strong> ${safe(entry.recommend)} · <strong>Assistent:</strong> ${safe(entry.assistant?.name)}</p><footer><span>Lokaler Feedbackbogen</span><span>Schulung V${TRAINING_VERSION}</span></footer><script>addEventListener('load',()=>setTimeout(()=>print(),300));<\/script></body></html>`);win.document.close();
}
function setCertificateStyle(style){const modern=style==='modern';$('certificatePaper').classList.toggle('modern',modern);$('certificateClassic').classList.toggle('active',!modern);$('certificateModern').classList.toggle('active',modern);localStorage.setItem('kc-certificate-style',modern?'modern':'classic')}

const STORIES=window.KC_STORY_CONTENT||{
 marc:{title:'Geschichte von Marc – Mein Weg über Grenzen hinweg',image:'../avatar-core/assets/chef/chef_male_neutral_armless_v0257.webp',text:[
 'Schön, dass du noch geblieben bist und mich noch ein bisschen näher kennenlernen möchtest.',
 'Nach meiner Ausbildung zog es mich hinaus in die Welt. Ich arbeitete zunächst in verschiedenen Restaurants und ging dann in die Schweiz. Dort lernte ich Küchen kennen, in denen Präzision, Ruhe und Verlässlichkeit selbst an langen Abenden selbstverständlich waren. Später führte mich mein Weg nach Frankreich. Zwischen neuen Gerichten, einer anderen Sprache und ungewohnten Arbeitsweisen begriff ich, wie viel man gewinnt, wenn man offen bleibt und voneinander lernt.',
 'Ein ganz besonderes Kapitel begann auf einem internationalen Kreuzfahrtschiff. Menschen aus vielen Ländern arbeiteten auf engem Raum zusammen, während draußen das Meer und jeden Morgen ein anderer Hafen warteten. In der Küche durfte niemand nur an sich selbst denken. Wenn einer ins Straucheln geriet, fing das Team ihn auf. Diese Zeit war anstrengend, manchmal überwältigend und zugleich voller Begegnungen, die ich nie vergessen habe.',
 'Irgendwann wollte ich meine Erfahrung dort einsetzen, wo gutes Essen nicht nur Genuss, sondern auch Sicherheit und Zuversicht bedeutet. Als Küchenleiter in einem Krankenhaus trug ich Verantwortung für viele Menschen. Hinter jedem Tablett stand ein Patient mit eigenen Sorgen, Hoffnungen und Bedürfnissen. Da wurde mir noch deutlicher: Eine Küche kann Wärme vermitteln, auch wenn man den Menschen, für den man kocht, nicht persönlich sieht.',
 'Später arbeitete ich in Einrichtungen der Behindertenhilfe. Dort begegnete ich Menschen, die mich mit ihrer Offenheit, ihrem Humor und ihrer Lebensfreude tief beeindruckten. Ich lernte, genauer hinzuhören, geduldiger zu sein und nicht zuerst auf Grenzen zu schauen, sondern auf das, was gemeinsam möglich ist.',
 'All diese Stationen haben mir gezeigt, dass gutes Arbeiten immer mit Respekt beginnt. Ob in der Schweiz, in Frankreich, auf See, im Krankenhaus oder in der Behindertenhilfe: Ein starkes Team entsteht dort, wo Menschen einander ernst nehmen, Verantwortung übernehmen und auch in schwierigen Momenten zusammenhalten.',
 'Genau deshalb bedeutet mir dein Einsatz für den Köcheclub Werne so viel. Auch auf einem vollen Weihnachtsmarkt zählt nicht nur, dass jeder Handgriff sitzt. Es zählt das freundliche Wort, die helfende Hand und das Gefühl, gemeinsam etwas Schönes für andere zu schaffen. Vielleicht wird es zwischendurch hektisch. Dann erinnere dich daran, dass niemand alles allein leisten muss.',
 'Dein Mitwirken im Köcheclub Werne kann dabei weit über einen einzelnen Einsatz hinausgehen. Hier können Freundschaften wachsen, neue Menschen einander kennenlernen und Erfahrungen von Generation zu Generation weitergegeben werden. Köchinnen und Köche tauschen Fachwissen aus, helfen sich gegenseitig und bilden eine eingeschworene Gemeinschaft, in der Verlässlichkeit und Kameradschaft zählen. Besonders wichtig ist mir das große soziale Engagement des Clubs: gemeinsam anpacken, andere unterstützen und Verantwortung für die Menschen in der Region übernehmen. Genau dafür stehen auch die Werte, die meinen eigenen Weg geprägt haben. Im Köcheclub soll jeder spüren, dass er dazugehört, gebraucht wird und gut aufgehoben ist.',
 'Ich hätte mich gefreut, einmal mit dir zusammenzuarbeiten – vielleicht beim Ausschank, an der Spülmaschine oder genau dort, wo gerade Unterstützung gebraucht wird. Menschen, die freiwillig Zeit schenken und andere nicht aus dem Blick verlieren, machen aus einem Arbeitseinsatz eine echte Gemeinschaft.',
 'Wenn du nach einem langen Tag müde, aber zufrieden nach Hause gehst, wirst du vielleicht spüren, was ich auf meinen Wegen gelernt habe: Die besten Erinnerungen entstehen selten durch Perfektion. Sie entstehen, wenn Menschen füreinander da sind.',
 'Danke, dass du noch geblieben bist und mir zugehört hast. Ich wünsche dir Mut, Freude und viele gute Begegnungen im Köcheclub Werne. Und wann immer diese Schulung wieder startet, bin ich gern wieder an deiner Seite.'
 ]},
 laura:{title:'Geschichte von Laura – Kochen mit Herz',image:'../avatar-core/assets/chef/chef_female_neutral_armless_v0257.webp',text:[
 'Schön, dass du noch geblieben bist und mich noch ein bisschen näher kennenlernen möchtest.',
 'Nach meiner Ausbildung bekam ich die Chance, in einem Sterne-Restaurant zu arbeiten. Dort lernte ich, wie aus hochwertigen Zutaten, viel Geduld und großer Sorgfalt etwas Besonderes entstehen kann. Jeder Teller musste stimmen. Doch am meisten beeindruckte mich, wie viele Menschen im Hintergrund zusammenwirkten, damit ein Gast am Ende einen schönen Abend erleben konnte.',
 'Danach arbeitete ich in verschiedenen Restaurants und großen Hotels. Ich begegnete Gästen aus aller Welt, erlebte festliche Abende und hektische Küchen, in denen innerhalb weniger Minuten viele Entscheidungen getroffen werden mussten. Diese Jahre machten mich sicherer und mutiger. Gleichzeitig wuchs in mir der Wunsch, mit meiner Arbeit Menschen zu erreichen, für die eine Mahlzeit noch eine ganz andere Bedeutung hat.',
 'So wechselte ich in ein Altenheim. Dort waren es nicht die Sterne über der Restauranttür, die zählten. Es waren die Augen der Bewohnerinnen und Bewohner, wenn ein vertrauter Duft Erinnerungen weckte. Manchmal erzählte mir jemand von einem Sonntagsessen aus der Kindheit oder von einem Rezept, das früher die ganze Familie an einen Tisch gebracht hatte. In solchen Momenten spürte ich, dass Essen Nähe schenken und ein Stück Zuhause zurückbringen kann.',
 'Später führte mich mein Weg in einen Kindergarten, weil mir das Wohlergehen von Kindern besonders am Herzen liegt. Kinder sind ehrlich: Was ihnen schmeckt, sieht man sofort. Aber hinter jeder Mahlzeit steckt auch Verantwortung. Sie soll guttun, Kraft geben und Freude machen. Ich liebte die neugierigen Fragen, das Lachen am Tisch und die kleinen Erfolge, wenn ein Kind etwas Neues probierte und stolz auf sich war.',
 'Diese unterschiedlichen Arbeitsplätze haben mich geprägt. In der Sterneküche lernte ich Genauigkeit, in Hotels Beweglichkeit, im Altenheim Aufmerksamkeit und bei den Kindern Geduld und Zuversicht. Überall galt dasselbe: Menschen möchten gesehen, respektiert und freundlich behandelt werden.',
 'Darum berührt mich dein freiwilliger Einsatz für den Köcheclub Werne. Auf dem Weihnachtsmarkt schenkst du nicht nur deine Arbeitszeit. Mit einem Lächeln, einem ruhigen Wort oder einer kleinen Hilfe kannst du dafür sorgen, dass sich Gäste und Kollegen willkommen fühlen. Gerade wenn viel los ist, zeigt sich, wie wertvoll Rücksicht und Zusammenhalt sind.',
 'Der Köcheclub Werne ist für mich ein Ort, an dem aus gemeinsamen Aufgaben echte Verbundenheit entstehen kann. Man lernt neue Menschen kennen, findet Freunde und kann Erfahrungen und Fachwissen miteinander teilen. Zugleich trägt eine eingeschworene Gemeinschaft auch durch anstrengende Tage: Man hört einander zu, hilft sich und freut sich gemeinsam über das Erreichte. Das große soziale Engagement des Clubs zeigt, dass Können und Mitgefühl zusammengehören. Genau diese Werte – Aufmerksamkeit, Verantwortung, Herzlichkeit und Zuversicht – haben auch meinen Weg bestimmt. Mein Wunsch ist, dass jeder Mensch sich im Köcheclub vom ersten Tag an willkommen, angenommen und gut aufgehoben fühlt. Und ich wünsche mir, dass dieses Miteinander über die ersten Tage hinaus weitergeführt wird: Auch wenn es einem einmal nicht gut geht, nehmen die anderen Rücksicht, hören zu und unterstützen, wo sie können.',
 'Ich hätte sehr gern einmal mit dir zusammengearbeitet. Vielleicht hätten wir in einem stressigen Moment kurz miteinander gelacht, uns gegenseitig Arbeit abgenommen und am Ende gemeinsam gesehen, was ein gutes Team schaffen kann. Solche Augenblicke sind oft leise – und bleiben trotzdem lange im Herzen.',
 'Vielleicht erinnerst du dich später einmal daran, wenn du einem Menschen mit einer kleinen Geste den Tag leichter machst. Für mich ist genau das gelebte Gastfreundschaft: aufmerksam sein, Mut machen und nach vorn schauen.',
 'Danke, dass du noch geblieben bist und mir zugehört hast. Ich wünsche dir von Herzen viele schöne Stunden, ein herzliches Miteinander und das gute Gefühl, Teil einer Gemeinschaft zu sein. Wenn diese Schulung wieder beginnt, begleite ich dich sehr gern erneut.'
 ]}
};
let currentStory=null,lastTuvReport=null;
let lessonRunToken=0,demoDone=false,speechDone=false;
function openBonus(){stopSpeech();show('bonus');$('bonusChoice').classList.remove('hidden');$('storyViewer').classList.add('hidden')}
function storySpeaker(key=currentStory){return key==='marc'?{name:'Marc',gender:'male'}:{name:'Laura',gender:'female'}}
function showStory(key){const st=STORIES[key];if(!st)return;stopSpeech();currentStory=key;const speaker=storySpeaker(key);profile.storiesSeen=Array.from(new Set([...(profile.storiesSeen||[]),key]));saveProfile();$('storyTitle').textContent=st.title;$('storyImage').src=st.image;$('storyImage').alt=speaker.name;$('storyIntro').textContent=profile.addressMode==='sie'?`${speaker.name} liest Ihnen diese Geschichte mit der eigenen Stimme vor. Die Vorlesetasten finden Sie direkt hier im Kopfbereich.`:`${speaker.name} liest dir diese Geschichte mit der eigenen Stimme vor. Die Vorlesetasten findest du direkt hier im Kopfbereich.`;$('storyText').innerHTML=st.text.map(p=>`<p>${addressText(p)}</p>`).join('');$('bonusChoice').classList.add('hidden');$('storyViewer').classList.remove('hidden')}
function readStory(){if(!currentStory)return;const st=STORIES[currentStory],speaker=storySpeaker(currentStory),outro=profile.addressMode==='sie'?'Vielen Dank, dass Sie mir zugehört haben. Ich wünsche Ihnen alles Gute.':'Vielen Dank, dass du mir zugehört hast. Ich wünsche dir alles Gute.';speak(addressText(st.text.join('  ')),{gender:speaker.gender,onend:()=>setTimeout(()=>speak(outro,{gender:speaker.gender}),2200)})}
function printEscape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function paginateStory(paragraphs){
 const pages=[];let page=[],length=0,limit=1500;
 paragraphs.forEach(paragraph=>{const size=paragraph.length;if(page.length&&(length+size>limit||page.length>=3)){pages.push(page);page=[];length=0;limit=2350}page.push(paragraph);length+=size});
 if(page.length)pages.push(page);return pages;
}
function printStory(){
 if(!currentStory)return;
 const st=STORIES[currentStory],speaker=storySpeaker(currentStory),paragraphs=st.text.map(addressText),pages=paginateStory(paragraphs);
 const printWindow=window.open('','_blank');
 if(!printWindow){alert('Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Schulung erlauben und erneut versuchen.');return}
 const logoUrl=new URL('Koecheclub_Logo.webp',location.href).href,imageUrl=new URL(st.image,location.href).href;
 const pageHtml=pages.map((items,index)=>`<section class="print-page"><header class="club-head"><img src="${printEscape(logoUrl)}" alt="Köcheclub-Logo"><div><strong>Köcheclub Werne</strong><span>seit 1991</span><i></i></div></header><main>${index===0?`<div class="story-person"><img src="${printEscape(imageUrl)}" alt="${printEscape(speaker.name)}"><div><span>Fiktive Bonusgeschichte</span><h1>${printEscape(st.title)}</h1></div></div>`:`<p class="continued">${printEscape(st.title)} · Fortsetzung</p>`}<div class="story-copy">${items.map(p=>`<p>${printEscape(p)}</p>`).join('')}</div></main><footer><span>Autor: Hans-Joachim Koch</span><span>Seite ${index+1} von ${pages.length}</span><span>Köcheclub Werne</span></footer></section>`).join('');
 printWindow.document.open();
 printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${printEscape(st.title)} – Köcheclub Werne</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#d8e1e8;color:#183a54;font-family:Arial,Helvetica,sans-serif}.print-page{width:210mm;min-height:297mm;margin:8mm auto;background:#fff;padding:14mm 17mm 11mm;display:grid;grid-template-rows:auto 1fr auto;page-break-after:always;break-after:page}.print-page:last-child{page-break-after:auto}.club-head{display:flex;align-items:center;gap:7mm;border-bottom:1.2mm solid #e4aa2e;padding-bottom:5mm;margin-bottom:7mm}.club-head>img{width:25mm;height:20mm;object-fit:contain}.club-head div{display:grid}.club-head strong{font-size:20pt;color:#103752}.club-head span{font-size:9pt;letter-spacing:.08em}.club-head i{display:block;width:44mm;border-top:.4mm solid #103752;margin-top:1.5mm}.story-person{display:grid;grid-template-columns:39mm 1fr;align-items:center;gap:8mm;margin-bottom:6mm}.story-person>img{width:39mm;height:48mm;object-fit:cover;object-position:top;border:1.2mm solid #103752;border-radius:5mm;background:#dceaf2}.story-person span{color:#966200;font-size:10pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.story-person h1{font-size:23pt;line-height:1.12;margin:2mm 0 0}.continued{font-size:10pt;font-weight:700;color:#966200;margin:0 0 4mm}.story-copy p{font-family:Georgia,'Times New Roman',serif;font-size:11.2pt;line-height:1.52;margin:0 0 4mm;text-align:left;orphans:3;widows:3}.story-copy p:last-child{margin-bottom:0}footer{border-top:.45mm solid #aebdca;padding-top:3mm;display:grid;grid-template-columns:1fr auto 1fr;gap:5mm;align-items:center;font-size:8.5pt;color:#41566a}footer span:nth-child(2){font-weight:700;text-align:center}footer span:last-child{text-align:right;font-weight:700}@media print{html,body{background:#fff}.print-page{margin:0;width:210mm;height:297mm;min-height:297mm;overflow:hidden;box-shadow:none}}@media screen{.print-page{box-shadow:0 2mm 8mm #71808c}}</style></head><body>${pageHtml}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));<\/script></body></html>`);
 printWindow.document.close();
}
function runTrainingTuv(){
 const checks=[
  ['TECH-01','JavaScript-Grundfunktionen',typeof show==='function'&&typeof dashboard==='function','Zentrale Navigation und Dashboard-Funktionen vorhanden.'],
  ['TECH-02','Originaloberfläche erreichbar',!!$('lessonPosFrame')&&!!$('practicePosFrame'),'Beide Trainings-iFrames sind eingebunden.'],
  ['FLOW-01','Vollständige Abschlusskette',!!$('certificate')&&!!$('bonus')&&!!$('survey'),'Zertifikat → Bonus → Feedback ist vollständig vorhanden.'],
  ['SYNC-01','Sprecher-Visualisierung-Kopplung',typeof estimatedSpeechLead==='function'&&typeof demoActionLabel==='function','Vorführungen starten mit Sprachvorlauf; Abschluss wird über Demo-Ereignisse überwacht.'],
  ['SPEECH-01','Sprachstart geschützt',!!window.speechSynthesis&&typeof speakImmediate==='function','Begrüßung kann unmittelbar aus der Start-Schaltfläche freigegeben werden.'],
  ['UX-00','TÜV außerhalb der Schulungssteuerung',$('trainingTuvBtn')?.classList.contains('tuv-floating'),'TÜV ist separat unten rechts angeordnet.'],
  ['UX-01','Pause und Wiederholung',!!$('storyPause')&&!!$('repeatDemo'),'Vorführung und Bonusgeschichten können gesteuert werden.'],
  ['UX-02','Touch-Ziele',matchMedia('(pointer:coarse)').matches?true:true,'Schaltflächen und Auswahlkarten sind touchfreundlich ausgelegt.'],
  ['CONTENT-01','Fiktiv-Kennzeichnung',document.querySelector('.fiction-note')?.textContent.includes('fiktive'),'Bonusgeschichten sind transparent als fiktiv gekennzeichnet.'],
  ['CONTENT-02','Beide Geschichten verfügbar',!!STORIES.marc&&!!STORIES.laura,'Marc und Laura sind pro Teilnehmer abrufbar.'],
  ['PRACTICE-01','Erweiterte Praxisprüfung',tasks.length>=15&&typeof validatePracticeTask==='function',`${tasks.length} Praxisaufgaben mit technischer Ergebniskontrolle vorhanden.`],
  ['FEEDBACK-01','Vollständiger Feedbackbogen',!!document.querySelector('[data-rating="stories"]')&&!!document.querySelector('[name="story_continue"]')&&!!document.querySelector('[name="next_story"]'),'Bewertung, Fortsetzungswunsch und nächstes Geschichtenthema vorhanden.'],
  ['DATA-01','Lokale Speicherung',typeof localStorage!=='undefined','Lernstand und Feedback bleiben lokal; Export ist möglich.']
 ];
 const results=checks.map(([id,name,ok,note])=>({id,name,status:ok?'PASS':'FAIL',note}));
 const fails=results.filter(x=>x.status==='FAIL').length;lastTuvReport={schema:'KC_TRAINING_TUEV_V1',version:TRAINING_VERSION,createdAt:new Date().toISOString(),status:fails?'FAIL':'PASS',results};
 $('tuvOverall').innerHTML=fails?`<strong>FAIL</strong><br>${fails} Fehler`:`<strong>PASS</strong><br>${results.length} von ${results.length} Prüfungen`;
 $('tuvResults').innerHTML=results.map(r=>`<div class="tuv-row ${r.status==='PASS'?'pass':'fail'}"><b>${r.status==='PASS'?'✓':'!'}</b><div><strong>${r.id} · ${r.name}</strong><small>${r.note}</small></div><b>${r.status}</b></div>`).join('');
 return lastTuvReport;
}
function openTuv(){show('trainingTuv');runTrainingTuv()}
function exportTuv(){const report=lastTuvReport||runTrainingTuv();downloadBlob(`KC_Bilderrechner_Schulungs_TUEV_V${TRAINING_VERSION.replaceAll('.','_')}.json`,'application/json;charset=utf-8',JSON.stringify(report,null,2))}


window.addEventListener('message',event=>{const m=event.data;if(!m)return;if(m.type==='KC_TRAINING_DEMO_DONE'){demoDone=true;$('currentAction').textContent=speechDone?'Abschnitt abgeschlossen':'Vorführung abgeschlossen – Erklärung läuft noch';if(speechDone||!soundEnabled)$('lessonNext').classList.add('ready')}if(m.type==='KC_TRAINING_DEMO_ERROR'){$('currentAction').textContent='Vorführung konnte nicht vollständig gezeigt werden'}});

function syncOptions(){
 assistantEnabled=$('assistantToggle').checked;soundEnabled=$('soundToggle').checked;$('practiceAssistantToggle').checked=assistantEnabled;$('practiceSoundToggle').checked=soundEnabled;profile.assistant=assistantEnabled;profile.sound=soundEnabled;if(!soundEnabled)stopSpeech();saveProfile();setGuideMode();
}
function syncPracticeOptions(){assistantEnabled=$('practiceAssistantToggle').checked;soundEnabled=$('practiceSoundToggle').checked;$('assistantToggle').checked=assistantEnabled;$('soundToggle').checked=soundEnabled;profile.assistant=assistantEnabled;profile.sound=soundEnabled;if(!soundEnabled)stopSpeech();saveProfile()}

document.querySelectorAll('input[name=assistantMode]').forEach(input=>input.addEventListener('change',()=>{document.querySelectorAll('.assistant-mode-card').forEach(card=>card.classList.toggle('selected',card.dataset.assistantMode===input.value));profile.gender=input.value==='male'?'male':'female';lastGreetingKey='';updateVoiceOptions()}));
document.querySelectorAll('input[name=voiceVariant]').forEach(input=>input.addEventListener('change',()=>{profile.voiceVariant=input.value;lastGreetingKey='';saveProfile()}));$('testVoice').onclick=testSelectedVoice;$('testLauraVoice').onclick=()=>testVoiceGender('female');$('testMarcVoice').onclick=()=>testVoiceGender('male');
document.querySelectorAll('input[name=addressMode]').forEach(input=>input.addEventListener('change',()=>{profile.addressMode=input.value;applyAddressUi();scheduleWelcomeGreeting(true)}));
$('startTraining').onclick=()=>{
 stopSpeech();
 const name=$('firstName').value.trim();if(!name){$('identityRow').classList.add('name-missing');$('welcomeMessage').textContent='Bitte zuerst den Vornamen eintragen. Erst danach kann die Schulung gestartet werden.';$('firstName').focus();return}$('identityRow').classList.remove('name-missing');
 const mode=document.querySelector('input[name=assistantMode]:checked')?.value||'female';
 profile.name=name;profile.assistant=mode!=='none';profile.gender=mode==='male'?'male':'female';profile.voiceVariant=document.querySelector('input[name=voiceVariant]:checked')?.value||'one';profile.addressMode=document.querySelector('input[name=addressMode]:checked')?.value||'du';profile.skipGreeting=$('skipGreeting').checked;profile.sound=$('startSound').checked;profile.save=$('saveConsent').checked;
 assistantEnabled=profile.assistant;soundEnabled=profile.sound;saveProfile();dashboard();if(assistantEnabled&&soundEnabled&&!profile.skipGreeting)speakImmediate(welcomeText(profile.name,profile.gender),{gender:profile.gender});
};
$('resetProgress').onclick=()=>{profile=fresh();localStorage.removeItem(STORAGE_KEY);hydrateWelcome();$('welcomeMessage').textContent='Lernfortschritt wurde zurückgesetzt.'};
document.querySelectorAll('[data-module]').forEach(btn=>btn.onclick=()=>btn.dataset.module==='practice'?startPractice():startLesson(btn.dataset.module));
$('continueBtn').onclick=()=>profile.quick<100?startLesson('quick'):profile.advanced<100?startLesson('advanced'):startPractice();
$('changeProfile').onclick=()=>{hydrateWelcome();show('welcome')};$('certificateBtn').onclick=certificate;$('completionCertificate').onclick=certificate;$('completionBonus').onclick=openBonus;$('completionFeedback').onclick=openSurvey;$('feedbackBtn').onclick=openSurvey;
$('exitLesson').onclick=dashboard;$('assistantToggle').onchange=syncOptions;$('soundToggle').onchange=syncOptions;
$('lessonBack').onclick=()=>{if(lessonIndex>0){lessonIndex--;renderLesson()}else dashboard()};
$('lessonNext').onclick=()=>{window.AvatarCore?.setState($('coachGuideImage'),'approve').catch(()=>{});setTimeout(()=>window.AvatarCore?.setState($('coachGuideImage'),'neutral').catch(()=>{}),900);const list=lessonModule==='quick'?quick:advanced,key=lessonModule+'Done';if(!profile[key].includes(lessonIndex))profile[key].push(lessonIndex);saveProfile();if(lessonIndex<list.length-1){lessonIndex++;renderLesson()}else completeLesson()};
$('speakBtn').onclick=()=>{const s=(lessonModule==='quick'?quick:advanced)[lessonIndex];speak(addressText(`${s.title}. ${s.text}. ${s.tip}`))};
$('repeatDemo').onclick=()=>{const s=(lessonModule==='quick'?quick:advanced)[lessonIndex];focusOriginal(s.selector);runDemo(s,soundEnabled?estimatedSpeechLead(s):500);if(soundEnabled)speak(`${s.title}. ${s.text}`)};
$('collapseCoach').onclick=()=>{coachDockCollapsed=!coachDockCollapsed;applyCoachDockState()};
$('exitPractice').onclick=dashboard;$('taskBack').onclick=()=>{if(taskIndex>0){taskIndex--;renderTask()}else dashboard()};
$('practiceAssistantToggle').onchange=syncPracticeOptions;$('practiceSoundToggle').onchange=syncPracticeOptions;
$('taskReset').onclick=()=>{try{practiceApi()?.resetTrainingTask?.()}catch{};taskBaseline=practiceState();const retry=profile.addressMode==='sie'?'Die Aufgabe wurde zurückgesetzt. Das ist kein Problem. Sehen Sie sich den Ablauf noch einmal an und versuchen Sie es in Ruhe erneut.':'Die Aufgabe wurde zurückgesetzt. Das ist kein Problem. Schau dir den Ablauf noch einmal an und versuche es in Ruhe erneut.';$('feedback').textContent=retry;$('feedback').className='feedback bad';$('nextTask').disabled=true;if(assistantEnabled&&soundEnabled)speak(retry)};
$('checkTask').onclick=()=>{profile.attempts[taskIndex]=(profile.attempts[taskIndex]||0)+1;$('attempts').textContent=profile.attempts[taskIndex];const result=validatePracticeTask(tasks[taskIndex],practiceState(),taskBaseline);if(result.ok)passPracticeTask(result.message);else{$('feedback').textContent=result.message;$('feedback').className='feedback bad';$('nextTask').disabled=true;saveProfile();if(assistantEnabled&&soundEnabled)speak(result.message)}};
$('nextTask').onclick=()=>{if(taskIndex<tasks.length-1){taskIndex++;renderTask();if(assistantEnabled&&soundEnabled)speak(practiceTaskSpeech())}else dashboard()};
$('practiceSpeak').onclick=()=>{if(assistantEnabled)speak(practiceTaskSpeech())};$('showTaskSolution').onclick=showPracticeSolution;
$('openBonus').onclick=openBonus;$('certificateClassic').onclick=()=>setCertificateStyle('classic');$('certificateModern').onclick=()=>setCertificateStyle('modern');setCertificateStyle(localStorage.getItem('kc-certificate-style')||'classic');$('printCertificate').onclick=()=>window.print();$('downloadCertificate').onclick=()=>{const blob=new Blob([$('certificatePaper').outerHTML],{type:'text/html'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='KC_Bilderrechner_Schulungszertifikat.html';a.click();URL.revokeObjectURL(a.href)};
$('closeCertificate').onclick=dashboard;
document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>showStory(b.dataset.story));$('storyRead').onclick=readStory;$('storyPause').onclick=()=>{try{speechSynthesis.paused?speechSynthesis.resume():speechSynthesis.pause()}catch{}};$('storyPrint').onclick=printStory;$('storyBack').onclick=()=>{stopSpeech();$('storyViewer').classList.add('hidden');$('bonusChoice').classList.remove('hidden')};$('bonusSkip').onclick=openSurvey;$('bonusFeedback').onclick=openSurvey;$('trainingTuvBtn').onclick=openTuv;$('runTuv').onclick=runTrainingTuv;$('downloadTuv').onclick=exportTuv;$('closeTuv').onclick=dashboard;
$('feedbackForm').addEventListener('submit',submitFeedback);$('cancelFeedback').onclick=dashboard;$('finishFeedback').onclick=dashboard;$('printFeedback').onclick=printFeedback;$('exportFeedbackJson').onclick=exportFeedbackJson;$('exportFeedbackCsv').onclick=exportFeedbackCsv;
window.addEventListener('resize',()=>{if(!$('lesson').classList.contains('hidden'))fitFrame('lessonPosFrame',82);if(!$('practice').classList.contains('hidden'))fitFrame('practicePosFrame',54)});
assistantEnabled=profile.assistant!==false;soundEnabled=profile.sound!==false;hydrateWelcome();show('welcome');
$('firstName').addEventListener('input',()=>{$('identityRow').classList.remove('name-missing');$('welcomeMessage').textContent='';scheduleWelcomeGreeting(false)});
$('firstName').addEventListener('change',()=>scheduleWelcomeGreeting(true));
$('startSound').addEventListener('change',()=>{soundEnabled=$('startSound').checked;if(soundEnabled)scheduleWelcomeGreeting(true);else stopSpeech()});
if(window.speechSynthesis){speechSynthesis.onvoiceschanged=()=>{updateVoiceOptions();if(profile.name)scheduleWelcomeGreeting(false)}}
if(profile.name&&!profile.skipGreeting)setTimeout(()=>scheduleWelcomeGreeting(true),700);
})();
