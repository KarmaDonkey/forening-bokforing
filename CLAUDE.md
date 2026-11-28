# Projektregler

- Repot är publikt. Lägg aldrig in bokföringsdata, medlemsnamn, fakturor, kvitton, kontoutdrag eller föreningsspecifika uppgifter (org.nr, bankkonto) här, inte heller som testdata. Testdata ska vara påhittad.
- Riktig data finns bara i föreningens OneDrive. Analys av historiken görs där filerna finns och resultatet sammanfattas utan personuppgifter.
- Appen är en enda HTML-fil utan byggsteg, i samma stil som KarmaDonkey/Ledger (Microsoft Graph för OneDrive).
- Beräkningslogiken (verifikationer, saldon, rapporter, bokslut) ska ha automatiska tester.
- Belopp lagras som heltal i ören, aldrig som flyttal.
- Text i gränssnittet och dokumentation skrivs på svenska.
- Projektplanen finns i docs/PROJEKTPLAN.md och hålls uppdaterad när faser blir klara.
- Kör `npm test` före varje commit. All logik i `<script id="karna">` ska ha tester i `tester/`. Testerna läser `test/index.html`.
- Fråga alltid användaren innan du ändrar något i appen, även små rättelser av fel. Beskriv först vad du tänker göra och vänta på ett ja.
- Appen finns i två kanaler på samma webbplats:
  - `test/index.html` är testversionen (…/forening-bokforing/test/). Alla ändringar görs där, och bara där.
  - `index.html` i roten är huvudversionen som alla använder. Den ändras bara när användaren säger att en version ska släppas till alla.
- Varje ändring får en testversion: lägg till en post överst i `VERSIONER` i `test/index.html` med versionsnummer som `1.88-test.1`, `1.88-test.2` …, datum och en kort beskrivning på svenska av vad som är nytt.
- Släpp till alla (bara när användaren ber om det):
  1. Lägg till en post för den släppta versionen (till exempel `1.88`) överst i `VERSIONER`, som sammanfattar testversionerna sedan förra släppet för användaren.
  2. Lägg till de största nyheterna i nyhetslistan, så att de syns i kortet "Nytt sedan du var här sist".
  3. Kopiera `test/index.html` till `index.html` och uppdatera projektplanen.
- Huvudversionen visar bara släppta versioner. Testversionerna syns bara i testversionen.
- Versioner före 1.0 är under uppbyggnad; 1.0 är den första som sparar i OneDrive.
