import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
test('otillåtna tecken byts ut', () => {
  assert.equal(K.sakertNamn('Faktura 2026-11:01.html'), 'Faktura 2026-11_01.html');
  assert.equal(K.sakertNamn('a/b\\c?*"<>|#%.pdf'), 'a_b_c________.pdf');
  assert.equal(K.sakertNamn('namn. '), 'namn');
  assert.equal(K.sakertNamn(''), 'fil');
});

test('årsmapp för kalenderår och brutet år', () => {
  assert.equal(K.arMapp('2026'), '2026');
  assert.equal(K.arMapp('2025/26'), '2025-26');
});

test('underlag hamnar i rätt mapp beroende på status', () => {
  const u = { filnamn: 'hyra.pdf', dokumenttyp: 'faktura', verifikation: null };
  assert.equal(K.underlagSokvag('2026', u), '2026/Bokföringsunderlag/Osorterat/hyra.pdf');
  assert.equal(K.underlagSokvag('2026', { ...u, verifikation: 12, arkivnamn: 'V012_hyra.pdf' }), '2026/Bokföringsunderlag/Verifikationer/V012_hyra.pdf');
  assert.equal(K.underlagSokvag('2026', { filnamn: 'utdrag.pdf', dokumenttyp: 'kontoutdrag' }), '2026/Bokföringsunderlag/Kontoutdrag/utdrag.pdf');
  assert.equal(K.underlagSokvag('2026', { filnamn: 'Faktura 2026-11_01.html', dokumenttyp: 'utgaende_faktura', verifikation: null }), '2026/Fakturor och kvitton/Faktura 2026-11_01.html');
  assert.equal(K.underlagSokvag('2026', { filnamn: 'Faktura 2026-11_01.html', dokumenttyp: 'utgaende_faktura', verifikation: 3, arkivnamn: 'V003_Faktura 2026-11_01.html' }), '2026/Bokföringsunderlag/Verifikationer/V003_Faktura 2026-11_01.html');
});

test('kvitton sparas under året de skrevs', () => {
  assert.equal(K.kvittoSokvag({ datum: '2026-11-20', nummer: 'K2026-001' }), '2026/Fakturor och kvitton/Kvitto K2026-001.pdf');
});
