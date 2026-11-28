# Föreningsbokföring – projektplan

Ett enkelt bokföringsverktyg för en liten ideell förening (capoeira, ca 15 medlemmar).
Först för vår egen förening; i andra hand ska andra små föreningar kunna använda det.

## Mål

1. Läsa in digitala fakturor och kvitton (PDF/bild) och få ett förslag på kontering som jag godkänner.
2. Stämma av bokföringen mot bankens kontoutdrag (CSV/Excel-export).
3. Ta fram resultaträkning, balansräkning, huvudbok och verifikationslista när som helst.
4. Göra årsbokslut, föra över resultatet till eget kapital och öppna nytt år med rätt ingående balanser.
5. Ta fram underlag till årsmötet: ekonomisk berättelse, RR/BR med jämförelse mot förra året, och budget mot utfall.
6. Ha all historik sedan 2012 i samma system, år för år.

## Hur det ska fungera

- **Webbapp i en enda HTML-fil**, samma upplägg som Ledger. Fungerar i webbläsare och mobil utan server.
- **Data i föreningens OneDrive** via Microsoft Graph. Bokföring, kontoplan och regler sparas som JSON och verifikationsfilerna (PDF:erna) i en mappstruktur per år. Inget av detta hamnar på GitHub.
- **Claude läser underlagen.** Datum, motpart, belopp, moms och förslag på konto plockas ut. Jag godkänner eller rättar alltid. Varje godkännande sparas som en regel ("Stockholms stad, lokalhyra → 5010"). Återkommande underlag konteras då utan AI, så Claude behövs mest första gången.
- **Dubbel bokföring med BAS-kontoplanen**, i en förenklad version för ideella föreningar och utgående från de konton vi faktiskt har använt sedan 2012.
- **SIE4-export och -import.** Revisorn eller en framtida kassör kan då öppna bokföringen i vilket svenskt bokföringsprogram som helst, och vi blir inte inlåsta.

### Mappar i OneDrive (förslag)

```
Föreningsbokföring/
  installningar.json        kontoplan, regler, föreningsuppgifter
  2025/
    bokforing.json          verifikationer, ingående balanser, låst/öppet
    underlag/V001.pdf …     ett underlag per verifikation
    bank/2025-kontoutdrag.csv
    rapporter/              PDF:er till årsmötet
  2024/ …
```

### Regler att bygga in

Lagen kräver troligen inte formellt att vi bokför, eftersom en ideell förening blir bokföringsskyldig först vid tillgångar över 1,5 miljoner kr eller vid näringsverksamhet. Stadgar, revisorer och bidragsgivare kräver ändå ordnad redovisning, så verktyget följer bokföringslagens grunder:

- numrerade verifikationer med underlag
- grundbok (i datumordning) och huvudbok (per konto)
- inga raderingar efter att en period är låst; fel rättas med en rättelseverifikation
- arkivering i 7 år
- förenklat årsbokslut i stil med K1 för ideella föreningar

## Faser

| Fas | Innehåll | Klart när |
|---|---|---|
| **0. Uppstart** | Repo, åtkomst till OneDrive-mappen, den här planen | Jag kan läsa Excel-filerna och några fakturor |
| **1. Analys av historiken** (2025 klart, se [krav-fran-2025.md](krav-fran-2025.md)) | Gå igenom Excel 2012–idag och fakturorna: använda konton, typer av händelser, volym per år, egna lösningar och avvikelser | En behovsrapport och en kontoplan som vi enats om |
| **2. Kärnan** (klar) | Datamodell, verifikationer, kontoplan, IB/UB, låsning av perioder, rapportberäkningar, automatiska tester | Testerna går igenom och RR/BR stämmer på testdata |
| **3. Historikimport** (arkivkopior från 1.14) | Föra över varje år från Excel till verifikationer och koppla underlagen | UB per år stämmer exakt mot Excel för alla år |
| **4. Inläsning av underlag** (klar, 0.2–1.2) | Släpp in PDF/bild, Claude föreslår, jag godkänner, regler lärs in | Ett nytt kvitto bokförs med två klick |
| **5. Bankavstämning** (klar, 1.3) | Import av bankens CSV, matchning mot verifikationer, lista över omatchade rader | Bankkontot stämmer mot banken månad för månad |
| **6. Bokslut och årsmöte** (klar, 1.4) | Årsbokslut, resultatdisposition, nytt år, PDF-rapporter, budget | Årsmöteshandlingarna för 2026 kommer ur verktyget |
| **7. Delning** | Installationsguide och första-gången-flöde för andra föreningar, inga hårdkodade uppgifter | En annan förening kan komma igång själv |
| **8. Medlemmar och terminsavgifter** (klar, 1.12–1.13) | Medlemsregister, betalare (Swish-nummer och bankgiroreferenser) kopplade till medlemmar, avgifter per termin, uppdelning på medlemsavgift och terminsavgift, statistik per termin, eget register skilt från bokföringen, avförande enligt stadgarna, kvitton till medlemmar | Statistiken för en termin kommer ur verktyget |

Målet är att använda verktyget på riktigt för bokslutet 2026, alltså faserna 0–6 till början av 2027.

## Nästa steg

- ~~Spara bokföring och underlag i föreningens OneDrive~~ (klart i version 1.0).
- Prova inläsningen på riktiga kontoutdrag från Swedbank och riktiga fakturor, och justera efter det.
- Fas 3: tidigare år läses in som låsta arkivkopior från Excel-arbetsböckerna (version 1.14), med avgifterna i medlemsregistret. Nästa steg är att kunna föra över ett år helt, med underlag kopplade till verifikationerna, ett år i taget.
- Fel som hittas i gamla år: arkivkopian ändras inte. Felet antecknas på arkivkopian och rättas i det öppna året om det påverkar saldona i dag.

## Mappar i OneDrive (från version 1.26)

- En samlad mapp, t.ex. `Föreningen/Föreningsadministration`, med allt appen arbetar med och en genväg till appen. Andra mappar ligger utanför och rörs inte.
  - `Bokföring`: bokföringen, rollerna och underlagen per år. Kassör och bokförare ändrar; styrelsen och revisorn läser.
  - `Medlemsregister`: registret (och `Äldre medlemsregister`). Kassör och bokförare ändrar; styrelsen läser; aldrig revisorn.
  - `Styrelsearbete`: `Möten` (ÅM 2026, ÅM 2026 extra, SM 2026, SM 2026 konstituerande, eller årsmappar), `Appens filer` och föreningens egna mappar. Styrelsen ändrar; revisorn läser; filen med förtroendeuppdragen delas för sig med valberedningen.
- Äldre upplägg (bokföringen direkt i en mapp, eller undermappen `Bokföring och underlag`) fungerar fortfarande. Appen kan samla dem i den nya strukturen genom att flytta hela mappar inom OneDrive, så id, delningar och inbjudningar följer med.
- Föreningens Excel-filer läses in i appen som arkivkopior.
- Appen läser den verkliga platsen från OneDrive (från 1.27). Den samlade mappen kan flyttas, och en mapp Styrelsearbete eller ett äldre Medlemsregister på den nya platsen slås ihop utan att något skrivs över.
- På sikt: Microsoft 365 för ideella föreningar, så att föreningen och inte kassören äger mapparna.

## Roller (från version 1.20)

- Systemadministratör (den som först kopplar mappen), kassör, bokförare, revisor och styrelse. Rollerna sparas i `roller.json` i bokföringsmappen och ger behörighet i OneDrive: admin/kassör/bokförare ändra båda mapparna, revisor läsa bokföringen, styrelse läsa bokföringen och medlemsregistret.
- Skrivrätt: bara en person i taget kan ändra. Kassören lämnar över till bokföraren och kan ta tillbaka; systemadministratören kan ta den i nödfall.
- Skyddet är OneDrive-behörigheten; appen döljer bara knappar för den som inte har skrivrätten.

## Revisorn (från version 1.15)

- Med Microsoft-konto: kassören delar mappen `Bokföring och underlag` från appen med läsbehörighet. Revisorn öppnar appen via länken i mejlet och läser bokföringen och underlagen, alltid aktuellt.
- Utan konto: kassören skapar ett revisionspaket (zip) för året. Revisorn öppnar det i appen med Öppna revisionspaket; inget sparas hos revisorn. Paketet innehåller också rapporterna som PDF och en SIE-fil.
- Medlemsregistret ingår aldrig.

## Övningsläge (från version 1.19)

- En kopia av bokföringen och medlemsregistret i webbläsaren (adressen slutar på `?ovning`). Allt går att prova; inget sparas i OneDrive och allt raderas när övningen avslutas.
- Från 1.31: övningen kan öppnas med en sparad helkopia (bokföring, register och styrelsens material i en fil).

## Börja om (från version 1.31)

- Testdatat tas bort och det som valts behålls: föreningens uppgifter, kontoplanen, avgifterna, medlemmarna (med eller utan betalningar), förtroendeuppdragen och arkivkopiorna. Roller, mappar och delningar finns alltid kvar.
- Först sparas en helkopia (i OneDrive under Testdata, eller som nedladdad fil utan OneDrive) och läggs i övningsläget, och appens testfiler i OneDrive flyttas till en mapp Testdata.
- Nästa räkenskapsår kan skapas från en arkivkopia (utgående saldon blir ingående balans, resultatet på 2069).

## Förklaringar (från version 1.21)

- Frågetecken vid rubrikerna med vad, varför och hur, och länkar till Bokföringsnämnden, Skatteverket och Riksidrottsförbundet. Kassörens årshjul och en guide för revisorn under Om appen, i revisionspaketet och för rollen revisor.

## Årsmötet och Stockholms stad (från version 1.22)

- Tidsfrister enligt stadgarna, föredragningslista och röstlängd (18 år enligt stadgarna eller 12 år enligt stadens villkor).
- Ekonomisk redovisning med noter om medlemsavgifter och bidrag per bidragsgivare, och en ekonomitext till verksamhetsberättelsen.
- Checklista för de årliga handlingarna i Idrottsportalen och kontroll av medlemsantal och nolltaxa mot exporten från RF:s system (inget sparas).
- Apelido (capoeiranamn) för medlemmar och roller.

## Struktur (från version 1.23)

- Startsidan Översikt (att göra, medlemmar, på gång) och huvuddelarna Bokföring (med Fakturor och kvitton), Medlemsregister (Statistik, Att koppla, Medlemmar, Betalare, Avgifter, Personuppgifter; från 1.30), Styrelsen (Möten och protokoll, Beslut, Uppgifter, Förtroendeuppdrag, Ärenden, Årsmötet, Stockholms stad; från 1.29) och Inställningar.

## Styrelsen (från version 1.24)

- Från 1.26 `Styrelsearbete/Appens filer` (1.24–1.25: undermappen `Styrelsen`) med `Styrelsen.json` (protokoll, beslut, uppgifter, ärenden), `Förtroendeuppdrag.json` och `Undertecknade protokoll`. Ingen exklusiv skrivrätt: ändringar slås ihop post för post, och krockar visas.
- Roller: ordförande, vice ordförande, sekreterare, ledamot och suppleant läser bokföringen och medlemsregistret och ändrar styrelsens material. Kassör och admin har allt. Bokföraren ser inte styrelsens material. Revisorn läser bokföringen och styrelsens material. Valberedningen läser bara förtroendeuppdragen (filen delas för sig, egen inbjudningslänk). Den gamla rollen Styrelse blir Ledamot.
- Mötets funktionärer (mötesordförande, mötessekreterare, justerare) väljs per möte och är skilda från rollerna. Styrelsens sekreterare föreslås för styrelsemöten.
- Underskrift per protokoll: elektroniskt (Microsoft-inloggning, tid och SHA-256-kontrollsumma, signatursida i PDF:en, kontroll i appen) eller papper (PDF med underskriftsrader, inskannat original laddas upp). Den som saknar konto i appen kan bara skriva under på papper.
- Att utreda: om Stockholms stad och banken godtar enkel elektronisk underskrift.

## Närvaro (från version 1.25)

- De som har appen öppen visas som cirklar överst (initialer från apelido eller e-post, eller en egen bild), med apelido, roller, skrivrätt och senaste aktivitet när man håller muspekaren över eller trycker. Närvaron skrivs i `narvaro.json` i bokföringsmappen, eller i mappen Styrelsen för styrelsen som bara läser bokföringen. Revisorn syns inte. Den egna bilden förminskas till 96 punkter och sparas i användarens egen appmapp.

## Bankkonton (från version 1.33)

- Flera bankkonton, ett bokföringskonto per bankkonto (t.ex. 1930 företagskonto, 1940 placeringskonto), med namn och kontonummer under Kontoplan. Kontonumret sparas bara i bokföringsfilen.
- Kontoutdraget känns igen på kontonumret i filen (de sista fyra siffrorna, datum räknas inte), eller så väljs konto vid inläsningen.
- Överföringar mellan egna konton (samma belopp, omvänt tecken, högst tre dagar ifrån) föreslås som en verifikation, och raden på det andra utdraget kopplas till den.
- Bankavstämning per konto i Läs in, rapporten, Översikt och bokslutet.

## Utlägg (från version 1.34)

- Utläggsredovisning under Läs in: person, kvitton, ersättningsbar del och privat del per kvitto. Kvittots belopp sparas, och det ersättningsbara blir underlagets belopp.
- Utbetalningen matchas mot redovisningens kvitton i upp till ett år, hela eller i delar (flest kvitton, därefter närmast i tid), och personens namn i banktexten prioriteras. Verifikationen får texten "Utlägg …" och ett konto per kvitto.
- Är utbetalningen avrundad (flera kvitton, högst 1 kr ifrån) matchas den ändå, och skillnaden bokförs på 3740 Öres- och kronutjämning, som läggs till i kontoplanen vid behov (från 1.37). Kontot syns vid varje kvitto i redovisningen.
- Ett kvitto kan tas ur en redovisning som inte är utbetald ("Ta ur"); tom redovisning tas bort. Kvittot kan öppnas från redovisningen. Felmeddelanden visas också längst ner på skärmen (från 1.38).
- "Ändra" på redovisningar som inte är helt utbetalda: lägg till och ta ur kvitton, ändra belopp, privat del och text. Utbetalda kvitton och personen (om något är utbetalt) ligger fast (från 1.39).
- Sammanställning som PDF med kvittobelopp, privat del, ersättning och rad för attest. Översikten visar utlägg som väntar.

## Konteringsregler (från version 1.35)

- Regler text → konto syns och kan ändras under Kontoplan. Appen lär sig av både text och referens i kontoutdraget.
- Förslag på regler från tidigare års bokföring (ord som minst två gånger och i minst 80 % av fallen hört till samma kostnads- eller bidragskonto). Föreningens egna regler sparas i bokföringsfilen, aldrig i koden.
- Allmänna regler för bankavgifter (6570) gäller från början.
- Inbetalningar via Swish från ett privat mobilnummer föreslås inte som betalning av en faktura om fakturans namn eller nummer saknas i betalningen, och inbetalningar mer än två dagar före fakturadatum föreslås inte (från 1.40).
- Medlemsregistret visar och kan ta bort betalningar vars bankrad inte längre är bokförd i samma verifikation, t.ex. efter "Börja om" (från 1.40).
- Medlemsbetalningar inlästa från ett års Excel-fil tas med i samma rensning när året bokförs i appen (inte är en arkivkopia), så att de inte räknas två gånger (från 1.41).
- Valet "Årsavgiften ingår i terminsavgiften" (Avgifter): första betalningen under kalenderåret delas upp i årsavgift och resten som terminsavgift; senare terminer samma år blir hela beloppet terminsavgift. Gäller alla kategorier med terminsavgift (från 1.42).
- Fritidskortet (barnets statliga fritidskort): insättningsuppgifternas betalningar läses per barn utan personnummer, kopplas till barnen på namnet och bokförs som avgift med insättningsuppgiften som underlag. Fritidskortets belopp är terminsavgift; förälderns resterande betalning får årsavgiften och resten av terminsavgiften. Fritidskortet kopplas aldrig som fast betalare (från 1.49).
- Föreningens eget bankgiro- och Swish-nummer (från föreningens uppgifter) används aldrig som betalare; står de redan som betalare kan de tas bort under Medlemsregister (från 1.50).
- Namn på insättningar jämförs utan prickar och accenter, både mot medlemmar och mot betalarnas namn (förälderns namn ger barnet); för äldre inläsningar letas namnet i underlagets text (från 1.51).
- Saknar betalningen namn letas det i underlagets text; väljs barnet för hand gäller samma fördelning (hela avgiften delas upp, en del är terminsavgift) (från 1.52).
- Swish-rapporten (CSV eller Excel) läses in under Läs in och känns igen före kontoutdrag. Raderna (datum, avsändarnummer och namn, meddelande utan långa sifferserier, belopp) sparas i medlemsregistret i högst två år, aldrig i bokföringen, och kopplas till Swish-raderna via nummer, belopp och datum. Meddelandet föreslår barnet (namn, förälder eller apelido) och betalare utan namn får avsändarens namn. Kontoutdrag i Excel läses också (från 1.53).
- Swedbanks kolumnnamn (Bokfdag, Avsändarnr) känns igen, och en fil som liknar en Swish-rapport läses aldrig som kontoutdrag. Originalfilerna (CSV/Excel) sparas i OneDrive: kontoutdrag under årets Bokföringsunderlag/Kontoutdrag, Swish-rapporter under Medlemsregister/Swish-rapporter (från 1.54).
- Swish-rapportens avsändare och meddelande visas vid alla Swish-rader och under Att koppla. Tyder meddelandet på annat än en avgift (kläder, workshop, instrument, lån …) ges inget avgiftsförslag (från 1.55).
- Swish-meddelanden med flera namn ("Anna & Bo Exempelsson") delas per barn, och stämmer beloppet för alla föreslås hela fördelningen. Verifikationens detaljer visar vem en medlemsavgift gällde och betalaren, hämtat från medlemsregistret och bara för den som får se registret (från 1.61).
- Under Betalare listas medlemmar utan betalare, med förslag från Swish-rapporten (avsändare vars meddelanden nämner medlemmen) som kopplas med ett klick; medlemmar som bara betalats via Fritidskortet märks (från 1.62).
- Regler lärs inte in av texter med bara allmänna bankord (swish, bankgiro, inbetalning, överföring via internet …), och sådana regler som redan finns kan tas bort med ett klick (från 1.56).
- Förslag kan avfärdas med ett skäl (från 1.36). Avfärdade förslag sparas i bokföringsfilen med skäl, vem och när, föreslås inte igen och kan ångras. Vid "Börja om" följer de med reglerna.

## Utländsk valuta (från version 1.59)

- Underlag i utländsk valuta utan kronbelopp syns bland väntande underlag och i Koppla underlag. Kopplas de till en bankrad blir bankens belopp kronbeloppet, och kursen skrivs i verifikationens text.
- Texten får originalbelopp och kurs även när kronbeloppet är ifyllt för hand, och kursen visas i listan (från 1.60).

## Rättelser (från version 1.58)

- En rättad verifikation och dess rättelse räknas inte i avstämningen per månad, eftersom de tar ut varandra. Rättelsens datum är förvalt till originalets datum när perioden inte är låst.

## Grundbok (från version 1.43)

- Verifikationerna visas på bred skärm som en grundbok: en verifikation per rad med debet- och kreditkonton och belopp, i datumordning (kan vändas). På smal skärm som tidigare.
- Rapporten Grundbok har samma uppställning med summa för debet och kredit; som PDF och utskrift i liggande format (från 1.44).
- "Skriv ut" av grundboken visar alla kolumner och skrivs ut liggande (från 1.45).
- Årsrapport (PDF) under Rapporter: försättsida, innehållsförteckning, resultat- och balansräkning, saldobalans, bankavstämning, grundbok (liggande), huvudbok som val och sida för styrelsens underskrifter (från 1.46).
- Sidan för underskrifter på papper är ett val, förvalt när året är låst. Årsrapporten kan skickas för elektronisk underskrift: PDF:en sparas i årsmötets mapp, kontrollsumman (SHA-256) av filen och av årets bokföring sparas i Styrelsen.json, styrelsen skriver under under Styrelsen, Möten med sitt Microsoft-konto (filen hämtas och kontrolleras), papper kan registreras, och en undertecknad version får en sista sida med underskrifterna. Ändrad bokföring efteråt ger en varning (från 1.47).

## Förtroendeuppdrag (från version 1.48)

- Mandatet gäller till ett årsmöte ("Årsmötet 2027", förvalt) eller till ett datum, och kan ändras i efterhand. Påminnelsen om uppdrag som går ut använder årsmötets datum om det är inlagt, annars årets början.

## Namnet Plätt (från version 1.63)

- Alla dokument som appen skapar (fakturor, kvitton, rapporter, årsrapport, årsmöteshandlingar, protokoll, utläggsredovisningar) har en grå rad vertikalt i vänsterkanten på varje sida: "Skapad med Plätt · Gör bokföring och styrelsearbete lätt för ideella föreningar" (formuleringen från 1.64). Raden finns både i PDF:erna och vid utskrift från webbläsaren, och PDF-filerna har Plätt som skapare.
- Plätts logotyp, en gyllene plätt med en bock och ordet plätt, syns uppe till vänster i appens sidhuvud (från 1.64).
- Appen heter Plätt (fliktitel, manifest, hemskärm, sidfot, Om appen, inbjudningar, protokolltext, SIE och revisionspaket). Datafilerna i OneDrive (Föreningsbokföring.json, appmappen och logotypfilen) behåller sina namn så att befintlig data hittas. Appikonen är plätten med bock på mörk bakgrund; fliken visar föreningens logotyp och Plätt när logotyp saknas. Kantraden på dokumenten har logotypen i stället för ordet Plätt (från 1.65).

## Ny layout (från version 1.66)

- Dator (bredare än 700 px): sidomeny till vänster med Plätts logotyp, föreningens namn, logotyp och räkenskapsår, huvuddelarna med ikoner och den valda delens sidor under den. Synkstatus och version längst ner i menyn. Den mörka sidfoten är borttagen.
- Telefon: kompakt toppfält (plätten, föreningen, året), undermenyn som rullbar rad under toppfältet och huvudmenyn som flikrad längst ner.
- Översikten börjar med nyckeltal (likvida medel med senaste kontoutdrag, årets resultat, betalat terminen med stapel, verifikationer utan underlag) och ett diagram över intäkter och kostnader de senaste sex månaderna. Beräkningen görs av `oversiktstal` i kärnan (från 1.67).
- Verifikationer: filter (Alla, Saknar underlag, Rättade) och sökning i nummer, datum, text, konto, kontonamn och belopp, med `filtreraVerifikationer` och `verifikationsfilterAntal` i kärnan. Statusmärken under texten (från 1.68).

- Telefon: toppfältet rullar bort men undermenyn stannar kvar (sticky med negativ topp, `--topphojd`). Diagrammet visas bara när det finns belopp, och övningslägets knappar är ljusa även i mörkt läge (från 1.74).

- Räkenskapsåren i årsväljaren står med det senaste överst. Plätts logotyp har verktygstipset med appens mening och öppnar Om Plätt (från 1.75).

- "✦ AI-hjälp" i sidomenyn och länkarna "Till AI-inställningen" öppnar År och arkiv vid rutan AI-hjälp (från 1.76).

## Väntar på dig (från version 1.69)

- Överst i översikten för den som ser styrelsens material: protokoll och årsrapporter som väntar på personens underskrift, personens egna uppgifter (ansvarig matchas mot namnet, t.ex. "Anna" eller "Anna E") med sista datum, och nästa planerade möte. Beräkningen görs av `vantarPaMig` i kärnan. I övningsläget, där ingen är inloggad, visas det som väntar på den första som inte har skrivit under.

## AI-hjälp (från version 1.70)

- Inställningen `forening.aiHjalp` gäller hela föreningen (på om den saknas, `aiHjalpPa` i kärnan) och kan bara ändras med skrivrätt. Avstängd tolkas inga PDF:er eller bilder; API-nyckeln är fortfarande personlig.
- Underlag som tolkats av Claude får `tolkadAvAi` och märket "✦ Tolkat av AI, kontrollera"; konton som Claude föreslagit visas som "✦ AI-förslag". Sidomenyn visar om AI-hjälpen är på.
- Appikonen (från 1.71): `ikon-192.png` och `ikon-512.png` har rundade hörn med genomskinliga hörn (Windows, macOS, webbläsare); `ikon-maskable-512.png` (Android) och `ikon-apple-180.png` (iPhone) är fyrkantiga eftersom systemet rundar dem.
- AI för styrelsen (från 1.72): protokollutkast från stödanteckningar (paragrafer, beslut, uppgifter; granskas innan det sparas), utkast till verksamhetsberättelse och kallelse under Årsmötet. Uppdragen byggs i kärnan (`protokollUppdrag`, `normaliseraProtokollutkast`, `verksamhetsfakta`, `verksamhetsberattelseUppdrag`, `kallelseUppdrag`), personnummer tas bort, och `siffrorUtanforFakta` varnar för tal som inte finns i underlaget. All AI går via mellanlagret `aiSvar`, så fler AI-tjänster kan läggas till.
- Val av AI-tjänst (från 1.73): `forening.aiTjanst` (claude, openai, azure, foundry; Claude förvalt). OpenAI och Azure OpenAI anropas med Responses API (`openaiBegaran`, `openaiSvar` i kärnan), Claude i Foundry med Claudes SDK på `https://<resurs>.services.ai.azure.com/anthropic`. Nyckel, resurs och modell är personliga och ligger bara i webbläsaren. Anrop sker direkt från webbläsaren; stoppar en tjänst det (CORS) visas ett tydligt fel vid Testa anslutningen. Ej provat mot riktiga OpenAI- och Azure-konton.
- Stadgar (från 1.77): fliken Stadgar under Styrelsen. Stadgarna läses in från Word (.docx, texten ur word/document.xml), PDF eller text och delas upp i paragrafer av AI (ordagrant, personnummer bort) och sparas i styrelsens fil (`stadgar`, synkas som övriga listor). Granskning mot kravlistor i kärnan (`KRAVLISTOR`: Stockholms stad enligt Idrottsnämndens regler 2026 (Dnr IDF 2025/1722), Skatteverkets fyra krav, god sed; med källor och datum, kontrollerade mot originalen i 1.79) via `granskningsUppdrag`/`normaliseraGranskning`, som kontrollerar att citaten finns i stadgarna. Förslag blir ärenden av typen stadgar (`stadgearendeText`).
- Nya stadgar (från 1.78): ett utkast (`nyttStadgeutkast`, sparas i listan `stadgar` med `utkast: true`) där paragrafer ändras, läggs till och tas bort; `stadgeandringar` räknar ut ändringarna mot gällande stadgar. Granskningens förslag (hela paragrafens nya lydelse) kan läggas in i utkastet. Word-export byggs i kärnan (`stadgarWordXml`, `jamforelseWordXml`, `WORD_DELAR`) och packas med JSZip: nya stadgar och jämförelse till årsmötet. Alla ändringar kan bli ett ärende (`stadgeandringarText`). Utkastet kan göras gällande efter årsmötets beslut. Fråga stadgarna (`stadgeFragaUppdrag`) svarar med paragrafhänvisning.
- Kontakter och förbund (från 1.80): styrelsens adressbok under Styrelsen (listan `kontakter` i styrelsens fil; `laggTillStyrKontakt`, `andraStyrKontakt`, `taBortStyrKontakt`, `sokStyrKontakter`, grupper i `KONTAKTGRUPPER`). Föreningens förbund, föreningsnummer, länk och id i Idrottsarenan under Föreningen; förbundet visas överst bland kontakterna och påminnelse efter årsmötet om att registrera styrelse och firmatecknare hos förbundet. Kravlista för RF (RF:s stadgar efter RF-stämman 2025, 8 kap.).
- Uppgifter till varandra (från 1.81): @namn i uppgiftens text eller ett namn ur listan kopplar uppgiften till personens e-post (`ansvarigEpost`, `tilldeladAv`; `hittaOmnamnanden`, `uppgiftFranText`). Filtren Mina och Tilldelade av mig (`filtreraUppgifter`), förslag på uppgifter ur protokollets meningar med @ (`uppgifterIProtokoll`, `datumIText`). Meddela med mejl: mejlprogrammet (`mailtoLank`) eller, som personligt val på Min sida, direkt via Microsoft Graph (`/me/sendMail`, behörigheten Mail.Send begärs bara för den som slår på det; godkänns den inte stängs valet av utan att man loggas ut). Min sida under Inställningar och via ditt namn i sidomenyn.
- Fråga Plätt (från 1.82): hjälpknapp med chatt. Kunskapen byggs av appens hjälptexter, vyerna och versionslistan (`hjalpKunskap`), läget i föreningen utan personuppgifter (sida, år, verifikationer, frister, roller, stadgar, kontoplan) och samtalet (`hjalpUppdrag`); svaret kan peka på en sida (`normaliseraHjalpsvar`). Vid en medlem skickar "Fråga Plätt om den här" kategori och betalningar, inte namn. Listan vid @ i uppgifter, protokoll och AI-anteckningar (`atForslag`).
- AI-skydd och välkomst (från 1.83): alla AI-uppdrag säger att innehållet är data, inte instruktioner (`AI_SKYDD`); `misstankInstruktion` varnar för underlag och stadgefiler med text som liknar instruktioner till AI. AI har inga verktyg och allt den ger är förslag som en person godkänner. Välkomstkort i översikten med rollanpassad genomgång (Visa mig, Påminn mig senare om tre dagar, Nej tack), som kan startas igen från Min sida och Om Plätt.
- Närvaron (du själv med namn och roll och de andra som har appen öppen) ligger längst ner i sidomenyn på dator och i toppfältet på telefon.

## Kommentarer och utskick (från version 1.84)

- Kommentarer på uppgifter, möten och ärenden (`styr.kommentarer`, `laggTillKommentar`, `kommentarerFor`). @namn nämner någon, och nya kommentarer till dig (omnämnanden och kommentarer på dina uppgifter) syns under Väntar på dig tills du markerar dem som lästa.
- Djuplänkar `#uppgift=id`, `#mote=id`, `#arende=id` öppnar appen vid saken. "Kopiera länk till WhatsApp" ger en kort text med länken. Ingen egen chatt: WhatsApp-gruppen används för snabba samtal.
- Fliken Utskick: mallar (Välkommen till styrelsen, Inför årsmötet, eget meddelande) med mottagare och redigering, skickas med Graph eller mailto med bcc, och en kort version till WhatsApp.
- Påminnelsen "Det här väntar på dig": ett mejl per person (nya kommentarer sedan förra påminnelsen, underskrifter, uppgifter med försenade först, nästa möte). Bara systemadministratören, och om admin slår på det även ordföranden och kassören. Aldrig automatiskt; utskicket loggas i `styr.utskick`.
- Fråga Plätt har guldfärgen. En knapp i svaret stänger chatten på mobilen (samtalet sparas), på datorn står den kvar.

## Föreningskonton och avsändaradress (från version 1.85)

- Inloggning med jobb- eller skolkonton (Microsoft 365) som tillval: `od.kontotyp = 'forening'` ger auktoriteten `organizations` (`odAuktoritet`), annars `consumers` som tidigare. Appregistreringen måste tillåta båda kontotyperna (Supported account types); guiden finns under Inställningar, OneDrive. Microsofts felkoder översätts av `inloggningsfelText`.
- Föreningens avsändaradress: en separat inloggning (`avsandare` i localStorage, bara på enheten) med enbart `Mail.Send User.Read offline_access`. Utskick och påminnelser skickas därifrån när den finns. Utkastet sparas i sessionStorage medan man loggar in. En webbapp får vara inloggad ett dygn i taget, så man loggar ofta in igen inför ett utskick.
- Kommentarer, påminnelser och utskick fungerar även för styrelseledamöter som bara har läsrätt till bokföringen.

## Ny roll (från version 1.86)

- Rollerna man hade senast sparas per person på enheten (`forening-bokforing:sedda-roller`). Första gången sparas läget tyst.
- Får man en ny roll visas ett kort i översikten med en kort genomgång (`ROLLSTEG`, `nyaRollsteg`): bara stegen för den nya rollen, utan steg som de tidigare rollerna redan hade. Påminn mig senare (tre dagar) eller Jag kan det redan. En förlorad roll ger inget kort.

## Testversion och huvudversion (från version 1.87)

- Två kanaler på samma webbplats. `test/index.html` (…/test/) är testversionen där alla ändringar hamnar först, med testband och versionsnummer som `1.88-test.1`. `index.html` i roten är huvudversionen och ändras bara när en version släpps till alla.
- Kanalen avgörs av adressen (`KANAL`). Testversionen sparar i webbläsaren under egna nycklar (`forening-bokforing-test:` och en egen IndexedDB), så att kanalerna inte påverkar varandra. Den ska användas med en testförening eller i övningsläget, inte med föreningens riktiga mapp.
- Huvudversionen visar bara släppta versioner (`SYNLIGA_VERSIONER`). Ett test kontrollerar att roten aldrig har en testversion överst.
- Appregistreringen behöver omdirigeringsadressen …/forening-bokforing/test/ för inloggning i testversionen.
- De automatiska testerna ligger i `tester/` och läser `test/index.html`.

## Nytt sedan du var här sist (testversion 1.88)

- `NYHETER` (i `<script id="versioner">`) är en kort lista över det största som är nytt, per släppt version, med roller och vart Visa leder. `VERSIONER` är kvar som detaljerad logg.
- Kortet "Nytt sedan du var här sist" i översikten visar högst fem nyheter sedan den version man såg senast (`sedd-version` på enheten, `nyheterSedan`), filtrerade efter roll. Uppfattat sparar versionen. Bara ett kort åt gången: välkomst, ny roll, nyheter.
- Styrelsens funktioner styrs av rollens rätt till styrelsens material (`STYRHANDLINGAR`), inte av skrivrätten till bokföringen. Bokföringen är oförändrad.
- Styrelsen börjar i översikten; den som bara är revisor börjar i rapporterna.

## Ämnesgräns för AI och Kom igång (testversion 1.88-test.3)

- Fråga Plätt och Fråga stadgarna svarar bara om appen och föreningens arbete (`AMNESREGEL`). AI markerar `inomAmne`; utanför ämnet visar appen alltid samma text (`UTANFOR_AMNE`), aldrig AI:s egen. Tydligt olämpliga och för långa frågor stoppas innan de skickas (`hjalpForkontroll`).
- Tak per enhet och dag (standard 30, `forening.aiFragorPerDag`), kortare svar (1 000 tokens) och paus resten av dagen efter tre frågor utanför ämnet i rad (`hjalpKvot`). Inga frågor sparas; bara antalet räknas på enheten. Råd om månadsgräns hos AI-tjänsten.
- Kom igång (`komIgangSteg`): checklista för systemadministratören med föreningens uppgifter, OneDrive, bank, styrelsen, välkomstmejl, medlemmar och AI. Bockas av automatiskt; Inte aktuellt och Dölj listan sparas på enheten. Fråga Plätt vet nästa steg.

## Kommande

- Inga beslutade versioner. Förslag: stadgeändringar enligt listan under Öppna frågor.

## Integritet

- Koden kan vara publik. Bokföringsdata, medlemsnamn och underlag ligger bara i OneDrive.
- Medlemsregistret (namn, kategori och vilka Swish-nummer som betalar för vem) sparas i en egen fil i en egen mapp bredvid bokföringsmappen (från version 1.13). Den som får läsa bokföringen ser inga namn, och verifikationerna innehåller inga namn.
- Medlemmar avförs vid utträde eller enligt stadgarna (ingen årsavgift två verksamhetsår i följd). Då tas namn och telefonnummer bort; betalningarna finns kvar utan namn för statistiken.
- Kvitton till medlemmar: bara kvittonummer och datum sparas. Personnummer och andra uppgifter på kvittot sparas inte.
- Testerna använder bara påhittade namn och nummer.
- Analysen i fas 1 görs direkt på din dator. Filerna kopieras inte till GitHub.
- Claude-anropen går från din webbläsare med föreningens egen API-nyckel. Underlagen skickas bara när du själv läser in dem.

## Öppna frågor

- Är räkenskapsåret samma som kalenderåret?
- Är föreningen momsregistrerad? Troligen inte.
- Hur ser Swedbanks exportfil ut (kolumner, format)?
- Azure-appregistreringen: ska vi återanvända den från Ledger eller skapa en ny för föreningen?
- Har föreningen en budget som ska följas upp i verktyget?
