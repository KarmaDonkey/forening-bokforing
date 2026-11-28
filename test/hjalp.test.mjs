import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const personer = [{ epost: 'anna@exempel.se', namn: 'Anna Exempelsson' }, { epost: 'bo@exempel.se', namn: 'Bo Test' }, { epost: 'bo2@exempel.se', namn: 'Bo Prov' }, { epost: 'asa@exempel.se', namn: 'Åsa Lund' }];

test('listan vid @ visar personer som passar det man skriver', () => {
  const t = 'Boka lokal @an';
  const f = K.atForslag(t, t.length, personer);
  assert.equal(f.start, 11);
  assert.deepEqual(json(f.forslag.map((x) => x.infoga)), ['@Anna ']);
  assert.equal(K.atForslag('@', 1, personer).forslag.length, 4, 'bara @ visar alla');
  assert.deepEqual(json(K.atForslag('@bo', 3, personer).forslag.map((x) => x.infoga)), ['@Bo Test ', '@Bo Prov '], 'två Bo får hela namnet');
  assert.deepEqual(json(K.atForslag('@as', 3, personer).forslag.map((x) => x.namn)), ['Åsa Lund'], 'utan prickar');
  assert.deepEqual(json(K.atForslag('@lund', 5, personer).forslag.map((x) => x.namn)), ['Åsa Lund'], 'även efternamn');
  assert.equal(K.atForslag('mejla info@ex', 13, personer), null, 'e-postadresser räknas inte');
  assert.equal(K.atForslag('@anna och mer', 13, personer), null, 'inte när markören står efter ordet');
});

test('kunskapen för Fråga Plätt innehåller sidor, hjälptexter och versioner', () => {
  const k = K.hjalpKunskap([{ version: '1.2', nyheter: ['Kvitton kan skrivas ut.'] }],
    { kvitto: { rubrik: 'Kvitton', vad: 'Ett kvitto till en medlem.', varfor: 'Medlemmen vill ha det.', gor: 'Välj Nytt kvitto.' } },
    [{ id: 'dokument', namn: 'Fakturor och kvitton', grupp: 'Bokföring' }]);
  assert.match(k, /- dokument: Fakturor och kvitton \(under Bokföring\)/);
  assert.match(k, /### Kvitton\nEtt kvitto till en medlem\./);
  assert.match(k, /1\.2: Kvitton kan skrivas ut\./);
});

test('uppdraget och svaret', () => {
  const u = K.hjalpUppdrag('Hur skriver jag ut kvitto? Pnr 19800101-1234', [{ fran: 'du', text: 'Hej' }, { fran: 'platt', text: 'Hej!' }], 'KUNSKAP', 'Sida: Översikt');
  assert.match(u.system, /KUNSKAP$/);
  assert.match(u.text, /## Läget just nu\nSida: Översikt/);
  assert.match(u.text, /Användaren: Hej\nPlätt: Hej!/);
  assert.doesNotMatch(u.text, /1234/);
  assert.deepEqual(json(K.normaliseraHjalpsvar({ svar: ' Gör så här. ', vy: 'dokument', knapptext: '' }, ['dokument'])), { svar: 'Gör så här.', vy: 'dokument', knapptext: 'Gå dit' });
  assert.equal(K.normaliseraHjalpsvar({ svar: 'x', vy: 'hittepa' }, ['dokument']).vy, '', 'okänd sida ignoreras');
  assert.match(K.normaliseraHjalpsvar(null, []).svar, /inget svar/);
});
