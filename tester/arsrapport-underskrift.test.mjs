import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat: personer, adresser och belopp.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const personer = [{ epost: 'Ordf@example.com', namn: 'Ordförande Exempel', roll: 'Ordförande' }, { epost: 'kassor@example.com', namn: 'Kassör Exempel', roll: 'Kassör' }];
const skicka = (styr, extra) => K.skickaArsrapport(styr, Object.assign({ id: 'r1', arId: '2031', fil: { namn: '2032-02-01 Årsrapport 2031.pdf' }, kontrollsumma: A, bokforingSumma: B, undertecknare: personer, tid: '2032-02-01T10:00:00Z' }, extra));

test('årsrapporten skickas för underskrift och skrivs under av alla', () => {
  let s = skicka(K.tomStyrelse());
  assert.equal(s.rapporter.length, 1);
  assert.equal(s.rapporter[0].undertecknare[0].epost, 'ordf@example.com', 'e-post sparas med små bokstäver');
  assert.throws(() => K.signeraArsrapport(s, 'r1', 'ordf@example.com', 'X', C), /ändrats sedan/);
  assert.throws(() => K.signeraArsrapport(s, 'r1', 'annan@example.com', 'X', A), /inte bland/);
  s = K.signeraArsrapport(s, 'r1', 'ORDF@example.com', 'Ordförande Exempel', A, '2032-02-02T09:00:00Z');
  assert.throws(() => K.signeraArsrapport(s, 'r1', 'ordf@example.com', 'X', A), /redan skrivit under/);
  let st = K.arsrapportUnderskrifter(s.rapporter[0], B);
  assert.deepEqual([st.klar, st.kvar.length, st.andrad], [false, 1, false]);
  s = K.papperArsrapport(s, 'r1', 'kassor@example.com', '2032-02-03T09:00:00Z');
  st = K.arsrapportUnderskrifter(s.rapporter[0], C);
  assert.deepEqual([st.klar, st.andrad], [true, true], 'bokföringen ändrad efter att rapporten skickades');
  assert.deepEqual(json(st.signerade.map((x) => x.metod)), ['e', 'papper']);
  assert.throws(() => K.taBortArsrapportUnderskrift(s, 'r1'), /redan skrivit under/);
});

test('en ny version ersätter en osignerad och markerar en påbörjad som ersatt', () => {
  let s = skicka(K.tomStyrelse());
  s = skicka(s, { id: 'r2' });
  assert.deepEqual(json(s.rapporter.map((r) => r.id)), ['r2'], 'den osignerade togs bort');
  s = K.signeraArsrapport(s, 'r2', 'kassor@example.com', 'Kassör Exempel', A);
  s = skicka(s, { id: 'r3', kontrollsumma: C });
  assert.deepEqual(json(s.rapporter.map((r) => [r.id, r.ersatt])), [['r2', true], ['r3', false]]);
  assert.throws(() => K.signeraArsrapport(s, 'r2', 'ordf@example.com', 'X', A), /nyare version/);
  assert.throws(() => skicka(s, { undertecknare: [] }), /Välj vilka/);
  s = K.taBortArsrapportUnderskrift(s, 'r3');
  assert.deepEqual(json(s.rapporter.map((r) => r.id)), ['r2']);
});

test('rapporterna sparas med styrelsens material', () => {
  const s = K.normaliseraStyrelse({ moten: [], rapporter: [{ id: 'r1' }] });
  assert.equal(s.rapporter.length, 1);
  assert.deepEqual(json(K.normaliseraStyrelse({}).rapporter), []);
});

test('kontrolltexten ändras när bokföringen ändras', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.bokfor(ar, { datum: '2031-01-08', text: 'Avgift', rader: [{ konto: '1930', belopp: kr(100) }, { konto: '3100', belopp: kr(-100) }], underlagKommentar: 'Bankutdrag' }).ar;
  const t1 = K.arsrapportKontrolltext(ar);
  assert.match(t1, /1\|2031-01-08\|Avgift\|1930:10000,3100:-10000/);
  const ar2 = K.bokfor(ar, { datum: '2031-01-09', text: 'Avgift', rader: [{ konto: '1930', belopp: kr(50) }, { konto: '3100', belopp: kr(-50) }], underlagKommentar: 'Bankutdrag' }).ar;
  assert.notEqual(K.arsrapportKontrolltext(ar2), t1);
  assert.equal(K.arsrapportKontrolltext(ar), t1, 'samma bokföring ger samma text');
});
