import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));

test('kontakter läggs till, ändras och tas bort', () => {
  let s = K.tomStyrelse();
  s = K.laggTillStyrKontakt(s, { namn: ' Kim Exempel ', organisation: 'Exempelförbundet', grupp: 'forbund', epost: 'Kim@Exempel.se', webb: 'exempel.se', telefon: '08-123 45 67' });
  s = K.laggTillStyrKontakt(s, { organisation: 'Banken i Exempelstad', grupp: 'okand' });
  assert.equal(s.kontakter.length, 2);
  const k = s.kontakter[0];
  assert.equal(k.namn, 'Kim Exempel');
  assert.equal(k.epost, 'kim@exempel.se');
  assert.equal(k.webb, 'https://exempel.se');
  assert.equal(s.kontakter[1].grupp, 'ovrigt', 'okänd grupp blir Övrigt');
  s = K.andraStyrKontakt(s, k.id, Object.assign({}, k, { roll: 'Föreningsstöd' }));
  assert.equal(s.kontakter[0].roll, 'Föreningsstöd');
  assert.equal(s.kontakter[0].id, k.id);
  s = K.taBortStyrKontakt(s, k.id);
  assert.deepEqual(json(s.kontakter.map((x) => x.organisation)), ['Banken i Exempelstad']);
});

test('kontakt utan namn eller med felaktig e-post godtas inte', () => {
  assert.throws(() => K.laggTillStyrKontakt(K.tomStyrelse(), { telefon: '123' }), /namn eller en organisation/);
  assert.throws(() => K.laggTillStyrKontakt(K.tomStyrelse(), { namn: 'A', epost: 'inte-en-adress' }), /E-postadressen/);
});

test('sökning utan prickar, filter på grupp och sortering', () => {
  let s = K.tomStyrelse();
  s = K.laggTillStyrKontakt(s, { namn: 'Åsa Prov', organisation: 'Stadsdelen', grupp: 'kommun', roll: 'Föreningsstöd' });
  s = K.laggTillStyrKontakt(s, { namn: 'Bo Test', organisation: 'Exempelförbundet', grupp: 'forbund' });
  s = K.laggTillStyrKontakt(s, { namn: 'Cia Test', organisation: 'Ab Förbund', grupp: 'forbund' });
  assert.deepEqual(json(K.sokStyrKontakter(s.kontakter, '').map((k) => k.namn)), ['Cia Test', 'Bo Test', 'Åsa Prov'], 'förbund först, sedan efter organisation');
  assert.deepEqual(json(K.sokStyrKontakter(s.kontakter, 'asa foreningsstod').map((k) => k.namn)), ['Åsa Prov']);
  assert.deepEqual(json(K.sokStyrKontakter(s.kontakter, '', 'kommun').map((k) => k.namn)), ['Åsa Prov']);
  assert.equal(K.normaliseraStyrelse({ kontakter: [{ id: 'k1' }] }).kontakter.length, 1);
});

test('RF:s kravlista bygger på RF:s stadgar 2025', () => {
  const l = K.kravlista('rf');
  assert.ok(l.kallor[0].includes('rf.se'));
  assert.ok(l.krav.some((k) => k[0] === 'uteslutning' && /14 dagar/.test(k[2])));
  assert.match(l.not, /RF-stämman 2025/);
});
