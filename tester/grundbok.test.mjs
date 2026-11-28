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

test('grundbokens summa för debet och kredit', () => {
  const ar = { verifikationer: [
    { nr: 1, datum: '2031-01-01', rader: [{ konto: '2067', belopp: kr(100) }, { konto: '2019', belopp: kr(-100) }] },
    { nr: 2, datum: '2031-01-08', rader: [{ konto: '1930', belopp: kr(1100) }, { konto: '3100', belopp: kr(-800) }, { konto: '3110', belopp: kr(-300) }] }] };
  assert.deepEqual(json(K.grundbokSummor(ar)), { debet: kr(1200), kredit: kr(1200) });
  assert.deepEqual(json(K.grundbokSummor({ verifikationer: [] })), { debet: 0, kredit: 0 });
});

test('årsrapportens innehåll, status och konton för huvudboken', () => {
  const ar = { start: '2031-01-01', slut: '2031-12-31', lastTom: null, ingaendeBalans: { 1930: kr(100), 2067: kr(-100), 1940: 0 },
    bankrader: [], verifikationer: [{ nr: 1, datum: '2031-01-08', rader: [{ konto: '1930', belopp: kr(50) }, { konto: '3100', belopp: kr(-50) }] }] };
  assert.deepEqual(json(K.arsrapportInnehall(ar).map((d) => d.typ)), ['rr', 'br', 'sb', 'gb'], 'sidan för papper bara när året är låst');
  assert.deepEqual(json(K.arsrapportInnehall(Object.assign({}, ar, { lastTom: '2031-12-31' })).map((d) => d.typ)), ['rr', 'br', 'sb', 'gb', 'underskrifter']);
  assert.deepEqual(json(K.arsrapportInnehall(ar, { underskrifter: true, elektroniska: true }).map((d) => d.typ)), ['rr', 'br', 'sb', 'gb', 'underskrifter', 'esign']);
  assert.deepEqual(json(K.arsrapportInnehall(Object.assign({}, ar, { lastTom: '2031-12-31' }), { underskrifter: false }).map((d) => d.typ)), ['rr', 'br', 'sb', 'gb']);
  assert.deepEqual(json(K.arsrapportInnehall(Object.assign({}, ar, { bankrader: [{ id: 'x' }] }), { huvudbok: true }).map((d) => d.typ)),
    ['rr', 'br', 'sb', 'bank', 'gb', 'hball']);
  assert.equal(K.arsrapportStatus(ar), 'Preliminär');
  assert.equal(K.arsrapportStatus(Object.assign({}, ar, { lastTom: '2031-12-31' })), 'Bokslut');
  assert.equal(K.arsrapportStatus(Object.assign({}, ar, { grovkopia: {} })), 'Arkivkopia från Excel');
  assert.deepEqual(json(K.kontonMedRorelse(ar)), ['1930', '2067', '3100'], 'konton utan saldo och rörelse tas inte med');
});
