# Projektregler

- Repot är publikt. Lägg aldrig in bokföringsdata, medlemsnamn, fakturor, kvitton, kontoutdrag eller föreningsspecifika uppgifter (org.nr, bankkonto) här, inte heller som testdata. Testdata ska vara påhittad.
- Riktig data finns bara i föreningens OneDrive. Analys av historiken görs där filerna finns och resultatet sammanfattas utan personuppgifter.
- Appen är en enda HTML-fil utan byggsteg, i samma stil som KarmaDonkey/Ledger (Microsoft Graph för OneDrive).
- Beräkningslogiken (verifikationer, saldon, rapporter, bokslut) ska ha automatiska tester.
- Belopp lagras som heltal i ören, aldrig som flyttal.
- Text i gränssnittet och dokumentation skrivs på svenska.
- Projektplanen finns i docs/PROJEKTPLAN.md och hålls uppdaterad när faser blir klara.
