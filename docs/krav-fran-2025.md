# Krav från genomgången av bokslutet 2025

Sammanfattning av vad som tog tid när 2025 års bokföring gicks igenom och underlagen kopplades till verifikationer (ca 100 banktransaktioner, ca 75 underlagsfiler). Det manuella arbetet är just det appen ska göra lätt. Namn, belopp och föreningsuppgifter är borttagna; originalet finns i föreningens OneDrive.

## Så fungerar det i dag

- En Excel-arbetsbok (`.xlsm`) per år. Bankutdraget klistras in i en flik för bankkontot.
- Kommentar och motpart slås upp i två tabeller: bankreferens → kommentar och Swish-telefonnummer → namn.
- Konton skrivs in för hand i en grundboksflik, med en debet- och en kreditrad per verifikation. Verifikationsnumret är bankens transaktionsnummer + 1.
- Ett VBA-makro bygger ett mellanlager som pivottabeller för huvudbok, resultaträkning och balansräkning läser från.
- Underlag (PDF, foton, skärmbilder, Excel-sammanställningar, mejl) läggs i en mapp för osorterat och kopplas till verifikationer först i efterhand.

## Det som var svårt och som appen ska lösa

### 1. Koppla underlag till transaktioner
- Matchning på belopp och datum räcker för nästan allt. Ofta betalas flera fakturor från staden samma dag med olika belopp.
- Kända format kan tolkas automatiskt:
  - Stockholms stad (Idrottsförvaltningen): fakturanummer, OCR, belopp och förfallodag står i inbetalningsraden.
  - Webbhotell, bankens årsavgift, förbundets medlemsavgift, RF:s insättningsuppgifter (bidrag och LOK-stöd) och kassakvitton från större butiker.
- Bilder och skannade PDF:er saknar text och kräver OCR eller tolkning med Claude (foto av kvitto, skärmbild från chatt).
- Ett underlag kan höra till flera transaktioner, till exempel en delbetald faktura eller en påminnelse och faktura.
- Flera underlag kan höra till samma transaktion, till exempel en utläggsredovisning med sammanställning och många kvittofoton.
- Samma underlag kan finnas i två kopior. Dubbletter ska upptäckas.
- En rad utan underlag ska synas tydligt.
- Swish-inbetalningar och bankavgifter behöver inget separat underlag, eftersom bankutdraget räcker.

### 2. Utlägg och ersättningar
- Medlemmar och tränare lägger ut pengar och får tillbaka dem. Appen behöver en utläggsredovisning: kvitton, sammanställning, vem som ska få betalt och attest. Redovisningen blir sedan en verifikation.
- Utlägg i utländsk valuta (t.ex. flyg i EUR) räknas om till SEK, och omräkningen sparas som en del av underlaget.
- Ersättning för utlägg och arvode ska hållas isär, eftersom arvode påverkar kontrolluppgift (KU10) och arbetsgivaravgift.
- Utlägg som görs ett år men betalas ut nästa: användaren ska kunna välja vilket år de bokförs.

### 3. Konton och kontroller
- Bidrag (RF, LOK-stöd, kommunala bidrag) bokförs på 3980 Erhållna bidrag, inte bland avgiftsintäkterna. Konteringen styrs av regler (motpart eller referens → konto).
- Konteringen ska spegla vad underlaget visar, inte bara texten i banken. Ett exempel från 2025: en bankrad som hette "instrument" var i själva verket en flygbiljett.
- Automatiska kontroller som hade hittat felen 2025:
  - ingående balans med fel datum (föregående år)
  - datum sparade som text
  - verifikation utan datum (årets resultat)
  - bankrad utan saldo
  - samma belopp betalt två gånger nära i tid till samma mottagare
  - faktura ställd till en privatperson i stället för föreningen

### 4. Rapporter
- Pivottabellerna är sköra: en ny kontorad fick resultaträkningen att skriva över formlerna under sig. Appen ska räkna fram resultat- och balansräkning direkt från verifikationerna.
- Medlemsavgifter (antal betalande × avgift) ska kunna redovisas i en not.

## Namngivning av underlag från och med 2025

Underlagen ligger i `<år>/Bokföringsunderlag/Verifikationer/V<vernr>_<originalnamn>`. En logg i `<år>/Bokföringsunderlag/underlag_koppling_<år>.csv` visar verifikation, belopp, kommentar och gammal och ny sökväg. Ett underlag som hör till flera verifikationer får ett intervall i prefixet, t.ex. `V091-096_`.

Appen ska kunna läsa in den här strukturen vid historikimporten.

## Svar på frågor i projektplanen

- Banken är Swedbank. Bankutdraget kan exporteras och klistras in.
- Intäkterna är medlems- och träningsavgifter, oftast via Swish, samt bidrag (LOK-stöd via RF och kommunala bidrag).
- Kostnaderna är främst lokalhyra till Stockholms stad, resor och workshops, utrustning, förbundsavgift, webbhotell och bankavgifter.

## Kvar att analysera

Genomgången gällde bara 2025. Arbetsböckerna för 2012–2024 behöver gås igenom för att se om strukturen och kontoplanen har ändrats över åren, innan historikimporten (fas 3) planeras i detalj.
