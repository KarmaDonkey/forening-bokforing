import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Alla namn och e-postadresser är påhittade.
const json = (x) => JSON.parse(JSON.stringify(x));

test('initialer från apelido, namn eller e-post', () => {
  assert.equal(K.initialer('Soba'), 'So');
  assert.equal(K.initialer('Anna Påhittad'), 'AP');
  assert.equal(K.initialer('Anna Maria Påhittad'), 'AP');
  assert.equal(K.initialer('kim.kassor@example.se'), 'KK');
  assert.equal(K.initialer('revisor@example.se'), 'Re');
  assert.equal(K.initialer('ö'), 'Ö');
  assert.equal(K.initialer(''), '?');
});

test('samma person får alltid samma färg', () => {
  const a = K.narvaroFarg('anna@example.se');
  assert.equal(a, K.narvaroFarg('ANNA@example.se'));
  assert.ok(a >= 0 && a < 360);
  assert.notEqual(a, K.narvaroFarg('bo@example.se'));
});

test('närvaro från bokföringens och styrelsens filer slås ihop', () => {
  const data = { 'a@x.se': { tid: '2030-01-01T10:00:00Z', skrivratt: true, bild: 'data:A' }, 'b@x.se': { tid: '2030-01-01T09:00:00Z' } };
  const styr = { 'a@x.se': { tid: '2030-01-01T10:05:00Z', skrivratt: true }, 'c@x.se': { tid: '2030-01-01T10:03:00Z', bild: 'data:C' }, 'd@x.se': null };
  const n = K.slaIhopNarvaro([data, styr]);
  assert.equal(n['a@x.se'].tid, '2030-01-01T10:05:00Z');
  assert.equal(n['a@x.se'].bild, 'data:A', 'bilden finns kvar från den äldre uppgiften');
  assert.deepEqual(Object.keys(n).sort(), ['a@x.se', 'b@x.se', 'c@x.se']);
  const nu = Date.parse('2030-01-01T10:06:00Z');
  const aktiva = K.aktivaNu(n, 'C@x.se', nu);
  assert.deepEqual(json(aktiva.map((x) => [x.vem, x.minuter, x.skrivratt])), [['a@x.se', 1, true]]);
  assert.equal(K.aktivaNu(n, 'z@x.se', nu, 10).length, 2);
});
