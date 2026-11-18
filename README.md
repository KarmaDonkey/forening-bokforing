# Föreningsbokföring

Ett enkelt bokföringsverktyg för små ideella föreningar: läs in digitala fakturor och kvitton, få kontering föreslagen, stäm av mot banken och ta fram resultaträkning, balansräkning, årsbokslut och underlag till årsmötet.

Verktyget är en webbapp i en enda HTML-fil (`index.html`) utan byggsteg. All bokföringsdata och alla underlag ska sparas i föreningens egen OneDrive, aldrig i det här repot.

## Status

Fas 2 (kärnan) är på plats. Se [docs/PROJEKTPLAN.md](docs/PROJEKTPLAN.md) för helheten.

Det som fungerar nu:
- räkenskapsår (kalenderår eller brutet) med ingående balanser
- verifikationer med dubbel bokföring och kontroll av att debet och kredit går ihop
- rättelse genom omvänd verifikation, eftersom inget raderas
- låsning av perioder
- BAS-baserad kontoplan som går att ändra
- huvudbok, grundbok, saldobalans, resultaträkning med jämförelse mot föregående år, och balansräkning
- nästa räkenskapsår med utgående balanser som ingående
- kontroller för saknade underlag och möjliga dubbelbetalningar
- export till SIE 4 och säkerhetskopia som JSON

Data sparas tills vidare i webbläsaren. Exportera en säkerhetskopia regelbundet. OneDrive kommer i en senare fas.

## Använda

Öppna `index.html` i en webbläsare.

## Utveckla

All bokföringslogik ligger i `<script id="karna">` i `index.html` och har inga beroenden till sidan. Testerna läser in just det skriptet:

```
npm test
```

Kräver Node 22 eller senare. Inga paket behöver installeras.

Belopp är alltid heltal i ören. Positivt belopp är debet och negativt är kredit.
