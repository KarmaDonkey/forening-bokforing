import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function bokforing() {
  let a29 = K.skapaAr({ start: '2029-01-01', ingaendeBalans: { 1930: kr(100), 2067: kr(-100) } });
  a29 = K.laggTillUnderlag(a29, { id: 'u0', filnamn: 'gammal.pdf', belopp: 100, riktning: 'utgift' });
  let a30 = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { 1930: kr(100), 2067: kr(-100) } });
  a30 = K.bokfor(a30, { datum: '2030-02-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(50) }, { konto: '1930', belopp: kr(-50) }] }).ar;
  a30 = K.laggTillUnderlag(a30, { id: 'u1', filnamn: 'hyra.pdf', belopp: kr(50), riktning: 'utgift' });
  return {
    format: 1, forening: { namn: 'Testföreningen Påhittad', orgnr: '000000-0000', hemlig: 'x' }, aktivt: '2030', ar: { 2029: a29, 2030: a30 },
    regler: [{ monster: 'x' }], dokument: [{ id: 'd1' }], mottagare: [{ namn: 'Påhittad Kund' }]
  };
}

test('revisionspaketet innehåller året, föregående år för jämförelse och vägar till underlagen', () => {
  const d = K.revisionspaketData(bokforing(), '2030', { skapad: '2031-02-01', version: '1.15' });
  assert.equal(d.format, 'foreningsbokforing-revisionspaket');
  eq(Object.keys(d.ar).sort(), ['2029', '2030']);
  eq(d.ar['2029'].underlag, []);
  eq(d.filer, { u1: 'Underlag/2030/Bokföringsunderlag/Osorterat/hyra.pdf' });
  eq(d.forening, { namn: 'Testföreningen Påhittad', orgnr: '000000-0000', bankgiro: '', swish: '', webb: '', epost: '' });
  assert.ok(!('regler' in d) && !('mottagare' in d) && !('medlemsregister' in d), 'bara det revisorn behöver');
  assert.throws(() => K.revisionspaketData(bokforing(), '2031'), /finns inte/);
});

test('revisionspaketet läses in och kontrolleras', () => {
  const d = json(K.revisionspaketData(bokforing(), '2030', { skapad: '2031-02-01' }));
  const p = K.lasRevisionspaket(d);
  assert.equal(p.aktivt, '2030');
  assert.equal(p.ar['2030'].verifikationer.length, 1);
  assert.throws(() => K.lasRevisionspaket({ format: 1 }), /inget revisionspaket/);
  d.ar['2030'].verifikationer[0].rader[0].belopp = kr(51);
  assert.throws(() => K.lasRevisionspaket(d), /skadat/);
});
