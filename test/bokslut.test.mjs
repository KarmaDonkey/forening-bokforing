import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function aret() {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(10000), '2067': kr(-10000) } });
  ar = K.bokfor(ar, { datum: '2030-02-01', text: 'Avgifter', underlagKommentar: 'Swish', rader: [{ konto: '1930', belopp: kr(30000) }, { konto: '3100', belopp: kr(-30000) }] }).ar;
  ar = K.bokfor(ar, { datum: '2030-03-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(20000) }, { konto: '1930', belopp: kr(-20000) }] }).ar;
  return ar;
}

test('årets resultat bokförs mot 2069 och kan inte bokföras två gånger', () => {
  let ar = aret();
  const u = K.aretsResultatUtkast(ar);
  eq(u, { datum: '2030-12-31', text: 'Årets resultat', underlagKommentar: 'Bokslut', rader: [{ konto: '8999', belopp: kr(10000) }, { konto: '2069', belopp: kr(-10000) }] });
  ar = K.bokfor(ar, u).ar;
  assert.equal(K.aretsResultat(ar), kr(10000));
  assert.ok(K.balansrakning(ar).balanserar);
  assert.throws(() => K.aretsResultatUtkast(ar), /redan bokfört/);
  assert.equal(K.aretsResultatUtkast(K.skapaAr({ start: '2030-01-01' })), null);
});

test('underskott ger omvända tecken', () => {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(100), '2067': kr(-100) } });
  ar = K.bokfor(ar, { datum: '2030-03-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(40) }, { konto: '1930', belopp: kr(-40) }] }).ar;
  eq(K.aretsResultatUtkast(ar).rader, [{ konto: '8999', belopp: kr(-40) }, { konto: '2069', belopp: kr(40) }]);
});

test('resultatdisposition i nästa år, en gång', () => {
  let ar = aret();
  ar = K.bokfor(ar, K.aretsResultatUtkast(ar)).ar;
  let nytt = K.nastaAr(ar);
  const d = K.resultatdispositionUtkast(nytt, '2031-03-15');
  eq(d.rader, [{ konto: '2069', belopp: kr(10000) }, { konto: '2067', belopp: kr(-10000) }]);
  nytt = K.bokfor(nytt, d).ar;
  assert.equal(K.saldon(nytt)['2069'], 0);
  assert.equal(K.saldon(nytt)['2067'], kr(-20000));
  assert.equal(K.resultatdispositionUtkast(nytt, '2031-03-16'), null);
});

test('bokslutskontroller', () => {
  let ar = aret();
  const k1 = Object.fromEntries(K.bokslutsKontroller(ar).map((x) => [x.id, x.klar]));
  eq(k1, { bank: true, avstamning: false, underlag: false, balans: true, resultat: false, last: false });
  ar = K.bokfor(ar, K.aretsResultatUtkast(ar)).ar;
  ar = K.lasPeriod(ar, '2030-12-31');
  const k2 = Object.fromEntries(K.bokslutsKontroller(ar).map((x) => [x.id, x.klar]));
  assert.equal(k2.resultat, true);
  assert.equal(k2.last, true);
  assert.match(K.bokslutsKontroller(ar).find((x) => x.id === 'underlag').text, /1 verifikation saknar underlag/);
});

test('ekonomisk sammanfattning och utkast till berättelse', () => {
  const nu = K.ekonomiskSammanfattning(aret());
  eq(nu, { ar: '2030', intakter: kr(30000), kostnader: kr(20000), resultat: kr(10000), kassaBank: kr(20000), egetKapital: kr(20000) });
  const t = K.berattelseUtkast(nu, { resultat: kr(-500) });
  assert.equal(t, 'Under räkenskapsåret 2030 hade föreningen intäkter på 30\u00a0000 kr och kostnader på 20\u00a0000 kr. Årets resultat blev ett överskott på 10\u00a0000 kr (föregående år ett underskott på 500 kr). Vid årets slut hade föreningen 20\u00a0000 kr i kassa och bank, och föreningens egna kapital uppgick till 20\u00a0000 kr.');
});
