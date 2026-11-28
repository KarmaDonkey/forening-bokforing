import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function aret() {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(1000), '2067': kr(-1000) } });
  ar = K.importeraBankrader(ar, [
    { datum: '2030-01-10', text: 'Swish A', referens: '', belopp: kr(500), saldo: kr(1500) },
    { datum: '2030-01-20', text: 'Hyra', referens: '', belopp: kr(-300), saldo: kr(1200) },
    { datum: '2030-03-05', text: 'Swish B', referens: '', belopp: kr(200), saldo: kr(1400) },
    { datum: '2030-03-06', text: 'Avgift', referens: '', belopp: kr(-50), saldo: kr(1350) }
  ]).ar;
  const r = ar.bankrader;
  ar = K.bokforKopplat(ar, { datum: r[0].datum, text: 'A', underlagKommentar: 'x', rader: [{ konto: '1930', belopp: kr(500) }, { konto: '3100', belopp: kr(-500) }] }, { bankradId: r[0].id }).ar;
  ar = K.bokforKopplat(ar, { datum: r[1].datum, text: 'Hyra', underlagKommentar: 'x', rader: [{ konto: '5010', belopp: kr(300) }, { konto: '1930', belopp: kr(-300) }] }, { bankradId: r[1].id }).ar;
  ar = K.bokforKopplat(ar, { datum: r[2].datum, text: 'B', underlagKommentar: 'x', rader: [{ konto: '1930', belopp: kr(200) }, { konto: '3100', belopp: kr(-200) }] }, { bankradId: r[2].id }).ar;
  return ar;
}

test('avstämning per månad', () => {
  const m = K.bankavstamningPerManad(aret());
  assert.equal(m.length, 12);
  eq(m[0], { manad: '2030-01', antal: 2, obokforda: 0, datum: '2030-01-20', bankSaldo: kr(1200), bokfortSaldo: kr(1200), skillnad: 0 });
  eq(m[1], { manad: '2030-02', antal: 0, obokforda: 0 });
  eq(m[2], { manad: '2030-03', antal: 2, obokforda: 1, datum: '2030-03-06', bankSaldo: kr(1350), bokfortSaldo: kr(1400), skillnad: kr(50) });
});

test('brutet räkenskapsår går över årsskiftet', () => {
  const m = K.bankavstamningPerManad(K.skapaAr({ start: '2030-07-01' }));
  eq([m[0].manad, m[5].manad, m[6].manad, m[11].manad, m.length], ['2030-07', '2030-12', '2031-01', '2031-06', 12]);
});

test('avvikelser: obokförda, bokfört utan bank och saldofel', () => {
  let ar = aret();
  ar = K.bokfor(ar, { datum: '2030-02-10', text: 'Dubbelbokad hyra', rader: [{ konto: '5010', belopp: kr(300) }, { konto: '1930', belopp: kr(-300) }] }).ar;
  ar = K.bokfor(ar, { datum: '2030-02-11', text: 'Fel', rader: [{ konto: '5010', belopp: kr(10) }, { konto: '1930', belopp: kr(-10) }] }).ar;
  ar = K.rattelse(ar, 5, { datum: '2030-02-12' }).ar;
  ar = K.bokfor(ar, { datum: '2030-12-30', text: 'Efter utdraget', rader: [{ konto: '5010', belopp: kr(1) }, { konto: '1930', belopp: kr(-1) }] }).ar;
  ar = K.bokfor(ar, { datum: '2030-02-15', text: 'Kontant', rader: [{ konto: '5400', belopp: kr(5) }, { konto: '1910', belopp: kr(-5) }] }).ar;
  const a = K.bankavvikelser(ar);
  eq(a.obokforda.map((r) => r.text), ['Avgift']);
  eq(a.utanBank, [{ nr: 4, datum: '2030-02-10', text: 'Dubbelbokad hyra', belopp: kr(-300) }]);
  eq(a.saldofel, []);
  eq(a.period, { fran: '2030-01-10', till: '2030-03-06' });
});

test('saldofel i utdraget och inget utdrag alls', () => {
  let ar = K.skapaAr({ start: '2030-01-01' });
  eq(K.bankavvikelser(ar), { obokforda: [], utanBank: [], saldofel: [], period: null });
  ar = K.importeraBankrader(ar, [
    { datum: '2030-01-10', text: 'A', referens: '', belopp: 100, saldo: 100 },
    { datum: '2030-01-11', text: 'B', referens: '', belopp: 100, saldo: 250 }
  ]).ar;
  assert.equal(K.bankavvikelser(ar).saldofel.length, 1);
});

test('en rättelse med senare datum ger ingen skillnad i månaderna däremellan', () => {
  let ar = aret();
  const v1 = ar.verifikationer.find((v) => v.text === 'A').nr;
  assert.equal(K.rattelseDatum(ar, v1, '2030-11-26'), '2030-01-10', 'förvalt: samma dag som det som rättas');
  assert.equal(K.rattelseDatum(Object.assign({}, ar, { lastTom: '2030-06-30' }), v1, '2030-11-26'), '2030-11-26', 'låst period: idag');
  // Rättelsen dateras i november, och betalningen bokförs om på rätt konto med originaldatum.
  ar = K.rattelse(ar, v1, { datum: '2030-11-26' }).ar;
  const rad = ar.bankrader.find((r) => r.text === 'Swish A');
  assert.equal(rad.verifikation, null, 'bankraden är fri igen');
  ar = K.bokforKopplat(ar, { datum: rad.datum, text: 'A rätt', underlagKommentar: 'x', rader: [{ konto: '1930', belopp: kr(500) }, { konto: '3990', belopp: kr(-500) }] }, { bankradId: rad.id }).ar;
  const m = K.bankavstamningPerManad(ar);
  assert.equal(m[0].skillnad, 0, 'januari stämmer');
});
