import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

test('en verifikation delas upp i debet- och kreditsida, samma konto slås ihop', () => {
  const v = { nr: 4, datum: '2031-01-12', text: 'Utlägg', rader: [
    { konto: '1930', belopp: kr(-300) }, { konto: '4000', belopp: kr(120) }, { konto: '5810', belopp: kr(100) }, { konto: '4000', belopp: kr(80) }] };
  assert.deepEqual(json(K.grundbokSidor(v)), {
    debet: [{ konto: '4000', belopp: kr(200) }, { konto: '5810', belopp: kr(100) }],
    kredit: [{ konto: '1930', belopp: kr(300) }] });
  assert.deepEqual(json(K.grundbokSidor({ rader: [{ konto: '1930', belopp: 0 }] })), { debet: [], kredit: [] });
});

test('grundboken sorteras på datum och sedan nummer, och kan vändas', () => {
  const l = [{ nr: 1, datum: '2031-01-08' }, { nr: 2, datum: '2031-01-01' }, { nr: 3, datum: '2031-01-01' }, { nr: 4, datum: '2031-02-01' }];
  assert.deepEqual(K.grundbokOrdning(l).map((v) => v.nr), [2, 3, 1, 4]);
  assert.deepEqual(K.grundbokOrdning(l, true).map((v) => v.nr), [4, 1, 3, 2]);
  assert.deepEqual(l.map((v) => v.nr), [1, 2, 3, 4], 'listan ändras inte');
});
