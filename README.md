# Föreningsbokföring

Ett enkelt bokföringsverktyg för små ideella föreningar: läs in digitala fakturor och kvitton, få kontering föreslagen, stäm av mot banken och ta fram resultaträkning, balansräkning, årsbokslut och underlag till årsmötet.

Verktyget är en webbapp i en enda HTML-fil (`index.html`) utan byggsteg. All bokföringsdata och alla underlag ska sparas i föreningens egen OneDrive, aldrig i det här repot.

## Status

Faserna 2, 4 och 5 har en första version. Se [docs/PROJEKTPLAN.md](docs/PROJEKTPLAN.md) för helheten.

Det som fungerar nu:
- **Läs in underlag:** dra in PDF-fakturor, kvitton (foton) och kontoutdrag. Claude tolkar motpart, datum, belopp, OCR och föreslår konto.
- **Kontoutdrag:** CSV från banken, rader inklistrade från Excel, eller kontoutdrag som PDF. Samma fil kan läsas in igen utan dubbletter. Appen varnar när saldot inte går ihop.
- **Automatisk koppling:** varje banktransaktion paras ihop med rätt underlag på belopp, datum och OCR-nummer, även när flera kvitton tillsammans blir ett utlägg.
- **Förslag som lär sig:** när du bokför en transaktion kommer appen ihåg kontot till nästa gång, t.ex. Swish från en viss medlem eller bankens avgifter.
- **Avstämning mot banken:** bokfört saldo jämförs med bankens saldo, och ingående balans kan hämtas från banken första året.
- Räkenskapsår, verifikationer med dubbel bokföring, rättelse genom omvänd verifikation, låsning av perioder, BAS-baserad kontoplan.
- Huvudbok, grundbok, saldobalans, resultaträkning med jämförelse mot föregående år, balansräkning.
- Nästa räkenskapsår med utgående balanser som ingående; obetalda fakturor följer med.
- Kontroller för saknade underlag, möjliga dubbelbetalningar och obokförda banktransaktioner.
- Export till SIE 4 och säkerhetskopia som JSON.

Data sparas tills vidare i webbläsaren (bokföringen i localStorage, filerna i IndexedDB). Exportera en säkerhetskopia regelbundet. OneDrive kommer i nästa steg.

## Claude

Tolkningen av PDF:er och bilder görs av Claude via Anthropics API, direkt från webbläsaren. Det kräver en egen API-nyckel från platform.claude.com, som läggs in under "År och arkiv". Nyckeln sparas bara i webbläsaren. Underlagen skickas till Anthropic när de läses in. Kontoutdrag som CSV och inlärda förslag fungerar utan Claude.

## Använda

Öppna `index.html` i en webbläsare.

## Utveckla

All bokföringslogik ligger i `<script id="karna">` i `index.html` och har inga beroenden till sidan. Testerna läser in just det skriptet:

```
npm test
```

Kräver Node 22 eller senare. Inga paket behöver installeras.

Belopp är alltid heltal i ören. Positivt belopp är debet och negativt är kredit.
