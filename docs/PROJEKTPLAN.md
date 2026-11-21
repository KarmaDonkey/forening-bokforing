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

## Mappar i OneDrive (från version 1.14)

- Appens mapp, t.ex. `Föreningen/Föreningsbokföring`, med undermapparna `Bokföring och underlag` (bokföringen, logotypen och årsmappar med underlag; kan delas med revisorn) och `Medlemsregister` (delas inte).
- Föreningens Excel-filer ligger kvar där de är och läses in i appen som arkivkopior.

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

## Förklaringar (från version 1.21)

- Frågetecken vid rubrikerna med vad, varför och hur, och länkar till Bokföringsnämnden, Skatteverket och Riksidrottsförbundet. Kassörens årshjul och en guide för revisorn under Om appen, i revisionspaketet och för rollen revisor.

## Årsmötet och Stockholms stad (från version 1.22)

- Tidsfrister enligt stadgarna, föredragningslista och röstlängd (18 år enligt stadgarna eller 12 år enligt stadens villkor).
- Ekonomisk redovisning med noter om medlemsavgifter och bidrag per bidragsgivare, och en ekonomitext till verksamhetsberättelsen.
- Checklista för de årliga handlingarna i Idrottsportalen och kontroll av medlemsantal och nolltaxa mot exporten från RF:s system (inget sparas).
- Apelido (capoeiranamn) för medlemmar och roller.

## Struktur (från version 1.23)

- Startsidan Översikt (att göra, medlemmar, på gång, vem som är inne) och huvuddelarna Bokföring, Medlemmar, Föreningen och Inställningar.

## Kommande

- 1.24: styrelsemodul (möten och beslut, uppgifter, förtroendeuppdrag, dokument och stadgeändringar som ärenden till årsmötet).

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
