import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = x => JSON.parse(JSON.stringify(x));

test('sekreterare blir kassör: bara bokföringens steg', () => {
  const r = json(K.nyaRollsteg(['sekreterare'], ['kassor']));
  assert.deepEqual(r.roller, ['kassor']);
  assert.deepEqual(r.steg.map(x => x[0]), ['inlasning', 'verifikationer', 'm-koppla', 'dokument', 'rapporter', 'bokslut']);
});

test('kassör blir ordförande: möten visas, bokföringen inte', () => {
  const r = json(K.nyaRollsteg(['kassor'], ['ordforande']));
  assert.ok(r.steg.some(x => x[0] === 'st-moten'));
  assert.ok(!r.steg.some(x => x[0] === 'inlasning'));
});

test('ledamot blir sekreterare: möten och uppgifter kan hen redan', () => {
  const r = json(K.nyaRollsteg(['ledamot'], ['ledamot', 'sekreterare']));
  assert.deepEqual(r.roller, ['sekreterare']);
  assert.deepEqual(r.steg.map(x => x[0]), ['st-beslut', 'st-kontakter']);
});

test('flera nya roller i en genomgång, utan dubbletter', () => {
  const r = json(K.nyaRollsteg([], ['bokforare', 'kassor']));
  assert.deepEqual(r.roller, ['bokforare', 'kassor']);
  const vyer = r.steg.map(x => x[0]);
  assert.equal(new Set(vyer).size, vyer.length);
  assert.ok(vyer.includes('bokslut') && vyer.includes('m-koppla'));
});

test('förlorad eller oförändrad roll ger inget', () => {
  assert.deepEqual(json(K.nyaRollsteg(['kassor', 'ledamot'], ['ledamot'])), { roller: [], steg: [] });
  assert.deepEqual(json(K.nyaRollsteg(['kassor'], ['kassor'])), { roller: [], steg: [] });
  assert.deepEqual(json(K.nyaRollsteg(null, ['okand'])), { roller: [], steg: [] });
});

test('alla roller har steg med vy, rubrik och text', () => {
  for (const [roll, steg] of Object.entries(K.ROLLSTEG)) {
    assert.ok(steg.length, roll);
    for (const x of steg) assert.equal(x.length, 3, roll + ' ' + x[0]);
  }
});
