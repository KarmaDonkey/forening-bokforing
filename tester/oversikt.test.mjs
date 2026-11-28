import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function testar() {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  const v = (datum, rader) => { ar = K.bokfor(ar, { datum, text: 'Exempel', rader, underlagKommentar: 'Bankutdrag' }).ar; };
  v('2031-01-08', [{ konto: '1930', belopp: kr(1100) }, { konto: '3100', belopp: kr(-800) }, { konto: '3990', belopp: kr(-300) }]);
  v('2031-01-20', [{ konto: '5010', belopp: kr(400) }, { konto: '1930', belopp: kr(-400) }]);
  v('2031-03-02', [{ konto: '6570', belopp: kr(50) }, { konto: '1930', belopp: kr(-50) }]);
  v('2031-03-15', [{ konto: '1910', belopp: kr(200) }, { konto: '3100', belopp: kr(-200) }]);
  return ar;
}

test('likvida medel, intäkter, kostnader och resultat', () => {
  const t = K.oversiktstal(testar());
  assert.deepEqual(json(t.likvida.map((x) => [x.nr, x.saldo])), [['1910', kr(200)], ['1930', kr(1650)]]);
  assert.equal(t.likvidaSumma, kr(1850));
  assert.equal(t.intakter, kr(1300));
  assert.equal(t.kostnader, kr(450));
  assert.equal(t.resultat, kr(850));
  assert.equal(t.resultat, K.aretsResultat(testar()), 'samma som årets resultat');
});

test('per månad från årets början till och med datumet', () => {
  const t = K.oversiktstal(testar(), { tom: '2031-03-10' });
  assert.deepEqual(json(t.perManad), [
    { manad: '2031-01', intakter: kr(1100), kostnader: kr(400) },
    { manad: '2031-02', intakter: 0, kostnader: 0 },
    { manad: '2031-03', intakter: 0, kostnader: kr(50) }]);
  assert.equal(t.intakter, kr(1100), 'verifikationen 15 mars räknas inte');
  assert.equal(K.oversiktstal(testar()).perManad.length, 12, 'utan datum hela året');
});

test('räkenskapsår över årsskiftet och bankkonto utan saldo', () => {
  let ar = K.skapaAr({ start: '2031-07-01' });
  ar = Object.assign({}, ar, { bankrader: [{ id: 'b1', konto: '1930', datum: '2031-07-02', belopp: 0 }] });
  const t = K.oversiktstal(ar, { tom: '2032-02-15' });
  assert.deepEqual(json(t.perManad.map((x) => x.manad)), ['2031-07', '2031-08', '2031-09', '2031-10', '2031-11', '2031-12', '2032-01', '2032-02']);
  assert.deepEqual(json(t.likvida.map((x) => [x.nr, x.saldo])), [['1930', 0]]);
  assert.equal(t.resultat, 0);
});
