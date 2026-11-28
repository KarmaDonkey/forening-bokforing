import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function testar() {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(5000), 2067: kr(-5000) } });
  const v = (datum, text, rader, u) => { ar = K.bokfor(ar, { datum, text, rader, underlagKommentar: u === false ? '' : 'Bankutdrag' }).ar; };
  v('2031-01-08', 'Terminsavgift VT-31', [{ konto: '1930', belopp: kr(800) }, { konto: '3100', belopp: kr(-800) }]);
  v('2031-01-12', 'Hyra lokal', [{ konto: '5010', belopp: kr(1250.5) }, { konto: '1930', belopp: kr(-1250.5) }], false);
  v('2031-02-03', 'Café Övningen', [{ konto: '4000', belopp: kr(120) }, { konto: '1930', belopp: kr(-120) }]);
  ar = K.rattelse(ar, 2, { datum: '2031-01-12' }).ar;
  v('2031-03-01', 'Bankavgift', [{ konto: '6570', belopp: kr(50) }, { konto: '1930', belopp: kr(-50) }], false);
  return ar;
}
const nr = (l) => json(l.map((v) => v.nr));

test('antal per filter', () => {
  const ar = testar();
  const a = K.verifikationsfilterAntal(ar);
  assert.equal(a.alla, 5);
  assert.equal(a.rattade, 2, 'den rättade och rättelsen');
  assert.equal(a.utan, 1, 'en rättad verifikation behöver inget underlag');
});

test('filter: saknar underlag och rättade', () => {
  const ar = testar();
  assert.deepEqual(nr(K.filtreraVerifikationer(ar, ar.verifikationer, { filter: 'utan' })), [5]);
  assert.deepEqual(nr(K.filtreraVerifikationer(ar, ar.verifikationer, { filter: 'rattade' })), [2, 4]);
  assert.deepEqual(nr(K.filtreraVerifikationer(ar, ar.verifikationer, { filter: 'alla' })), [1, 2, 3, 4, 5]);
});

test('sökning på text utan prickar, konto, kontonamn och datum', () => {
  const ar = testar();
  const sok = (s) => nr(K.filtreraVerifikationer(ar, ar.verifikationer, { sok: s }));
  assert.deepEqual(sok('cafe ovningen'), [3]);
  assert.deepEqual(sok('5010'), [2, 4]);
  assert.deepEqual(sok('terminsavgift 3100'), [1]);
  assert.deepEqual(sok('2031-02'), [3]);
  assert.deepEqual(sok(''), [1, 2, 3, 4, 5]);
  assert.deepEqual(sok('finns inte'), []);
});

test('sökning på belopp', () => {
  const ar = testar();
  const sok = (s) => nr(K.filtreraVerifikationer(ar, ar.verifikationer, { sok: s }));
  assert.deepEqual(sok('800'), [1]);
  assert.deepEqual(sok('1 250,50'), [2, 4]);
  assert.deepEqual(sok('1250.5'), [2, 4]);
  assert.deepEqual(sok('120'), [3]);
});

test('filter och sökning tillsammans', () => {
  const ar = testar();
  assert.deepEqual(nr(K.filtreraVerifikationer(ar, ar.verifikationer, { filter: 'rattade', sok: 'hyra' })), [2, 4]);
  assert.deepEqual(nr(K.filtreraVerifikationer(ar, ar.verifikationer, { filter: 'rattade', sok: 'termin' })), []);
});
