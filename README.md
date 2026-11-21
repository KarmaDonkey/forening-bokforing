# Föreningsbokföring

Ett enkelt bokföringsverktyg för små ideella föreningar: läs in digitala fakturor och kvitton, få kontering föreslagen, stäm av mot banken och ta fram resultaträkning, balansräkning, årsbokslut och underlag till årsmötet.

Verktyget är en webbapp i en enda HTML-fil (`index.html`) utan byggsteg. All bokföringsdata och alla underlag ska sparas i föreningens egen OneDrive, aldrig i det här repot.

## Status

Version 1.5: bokföring, underlag, fakturor och kvitton, bankavstämning och bokslut, sparat i föreningens OneDrive och anpassat för telefon och dator. Se fliken "Om appen" för vad som är nytt i varje version, och [docs/PROJEKTPLAN.md](docs/PROJEKTPLAN.md) för helheten.

Det som fungerar:
- **OneDrive:** inloggning med Microsoft-konto direkt från webbläsaren. Bokföringen sparas i `Föreningsbokföring.json` i föreningens mapp. Underlagen ligger i årsmapparna (`<år>/Bokföringsunderlag/Osorterat`, `Verifikationer`, `Kontoutdrag`) och fakturor och kvitton i `<år>/Fakturor och kvitton`. Samma bokföring kan användas på flera enheter, med krockkontroll, och en revisor kan läsa en delad mapp.
- **Läs in underlag:** PDF-fakturor, kvitton och kontoutdrag. Claude tolkar och föreslår konto, och appen lär sig konton per motpart och banktext.
- **Bank:** CSV eller inklistrade rader, automatisk koppling till underlag och avstämning av saldot.
- **Fakturor och kvitton** i föreningens stil, som PDF via utskrift. Skickade fakturor kopplas till inbetalningen.
- **Bokslut och årsmöte:** checklista, bokföring av årets resultat, låsning, nytt år, resultatdisposition och handlingar till årsmötet som PDF.
- **Bankavstämning** månad för månad med lista över avvikelser.
- **Bokföringen:** verifikationer, rättelser, låsning, kontoplan, huvudbok, grundbok, saldobalans, resultat- och balansräkning, årsskifte, kontroller och export till SIE 4.

## Använda

Appen behöver öppnas från en webbadress (t.ex. GitHub Pages) för att kunna logga in med Microsoft. Utan OneDrive fungerar den också som en lokal fil; då sparas allt i webbläsaren.

För OneDrive behövs en appregistrering i Microsoft Entra (Azure) för personliga Microsoft-konton, med plattformen *Single-page application* och appens adress som omdirigeringsadress. Klistra in dess Client ID under *År och arkiv → OneDrive*.

## Claude

Tolkningen av PDF:er och bilder görs av Claude via Anthropics API, direkt från webbläsaren. Det kräver en egen API-nyckel från platform.claude.com, som läggs in under "År och arkiv". Nyckeln sparas bara i webbläsaren. Underlagen skickas till Anthropic när de läses in. Kontoutdrag som CSV och inlärda förslag fungerar utan Claude.

## Utveckla

All bokföringslogik ligger i `<script id="karna">` i `index.html` och har inga beroenden till sidan. Testerna läser in just det skriptet:

```
npm test
```

Kräver Node 22 eller senare. Inga paket behöver installeras.

Belopp är alltid heltal i ören. Positivt belopp är debet och negativt är kredit.
