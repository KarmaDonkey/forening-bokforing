# Projektregler

- Repot är publikt. Lägg aldrig in bokföringsdata, medlemsnamn, fakturor, kvitton, kontoutdrag eller föreningsspecifika uppgifter (org.nr, bankkonto) här, inte heller som testdata. Testdata ska vara påhittad.
- Riktig data finns bara i föreningens OneDrive. Analys av historiken görs där filerna finns och resultatet sammanfattas utan personuppgifter.
- Appen är en enda HTML-fil utan byggsteg, i samma stil som KarmaDonkey/Ledger (Microsoft Graph för OneDrive).
- Beräkningslogiken (verifikationer, saldon, rapporter, bokslut) ska ha automatiska tester.
- Belopp lagras som heltal i ören, aldrig som flyttal.
- Text i gränssnittet och dokumentation skrivs på svenska.
- Projektplanen finns i docs/PROJEKTPLAN.md och hålls uppdaterad när faser blir klara.
- Kör `npm test` före varje commit. All logik i `<script id="karna">` ska ha tester i `test/`.
- Fråga alltid användaren innan du ändrar något i appen, även små rättelser av fel. Beskriv först vad du tänker göra och vänta på ett ja.
- Varje ändring av appen får en ny version: lägg till en post överst i `VERSIONER` i `index.html` med versionsnummer, datum och en kort beskrivning på svenska av vad som är nytt för användaren. Versioner före 1.0 är under uppbyggnad; 1.0 är den första som sparar i OneDrive.
