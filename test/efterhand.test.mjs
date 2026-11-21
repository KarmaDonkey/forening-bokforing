import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function medVerifikation() {
  let ar = K.skapaAr({ start: '2030-01-01' });
  ar = K.bokfor(ar, { datum: '2030-02-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(1200) }, { konto: '1930', belopp: kr(-1200) }] }).ar;
  return ar;
}

describe('underlag i efterhand', () => {
  test('ett väntande underlag kopplas till en bokförd verifikation', () => {
    let ar = K.laggTillUnderlag(medVerifikation(), { id: 'u1', filnamn: 'hyra.pdf', dokumenttyp: 'faktura', motpart: 'X', belopp: kr(1200), riktning: 'utgift' });
    assert.equal(K.kontroller(ar).filter((w) => w.typ === 'saknarUnderlag').length, 1);
    ar = K.kopplaUnderlagTillVerifikation(ar, 1, 'u1', '2030-03-01T10:00:00Z');
    const u = ar.underlag[0];
    assert.equal(u.verifikation, 1);
    assert.equal(u.arkivnamn, 'V001_hyra.pdf');
    eq(K.underlagForVerifikation(ar, 1), ['V001_hyra.pdf']);
    eq(K.kontroller(ar).filter((w) => w.typ === 'saknarUnderlag'), []);
    eq(K.oppnaUnderlag(ar), []);
    assert.throws(() => K.kopplaUnderlagTillVerifikation(ar, 1, 'u1'), /hör redan till/);
    assert.throws(() => K.kopplaUnderlagTillVerifikation(ar, 9, 'u1'), /finns inte/);
  });
  test('en ny fil bifogas i efterhand, även i en låst period', () => {
    let ar = K.lasPeriod(medVerifikation(), '2030-12-31');
    ar = K.bifogaNyttUnderlag(ar, 1, { id: 'b1', filnamn: 'kvitto.jpg', tid: '2031-01-05T09:00:00Z' });
    eq(K.underlagForVerifikation(ar, 1), ['V001_kvitto.jpg']);
    assert.equal(ar.underlag[0].dokumenttyp, 'bifogat');
    assert.equal(K.underlagSokvag('2030', ar.underlag[0]), '2030/Bokföringsunderlag/Verifikationer/V001_kvitto.jpg');
    eq(K.oppnaUnderlag(ar), []);
    assert.throws(() => K.bifogaNyttUnderlag(ar, 5, { id: 'b2', filnamn: 'x.pdf' }), /finns inte/);
  });
  test('underlag flyttas mellan år, men inte om det är bokfört', () => {
    const a2029 = K.laggTillUnderlag(K.skapaAr({ start: '2029-01-01' }), { id: 'u9', filnamn: 'dec.pdf', dokumenttyp: 'faktura', motpart: 'X', belopp: 100, riktning: 'utgift' });
    const r = K.flyttaUnderlag(a2029, K.skapaAr({ start: '2030-01-01' }), 'u9');
    assert.equal(r.fran.underlag.length, 0);
    assert.equal(r.till.underlag[0].id, 'u9');
    const bokfort = K.kopplaUnderlagTillVerifikation(K.laggTillUnderlag(medVerifikation(), { id: 'u1', filnamn: 'a.pdf', dokumenttyp: 'faktura', belopp: 1, riktning: 'utgift' }), 1, 'u1');
    assert.throws(() => K.flyttaUnderlag(bokfort, a2029, 'u1'), /bokfört/);
  });
});

describe('troliga underlag', () => {
  const bank = { id: 'b', datum: '2030-03-05', text: 'STOCKHOLMS STAD', referens: '', belopp: kr(-1200), konto: '1930' };
  function ar(underlag) { let a = K.skapaAr({ start: '2030-01-01' }); for (const u of underlag) a = K.laggTillUnderlag(a, { dokumenttyp: 'faktura', riktning: 'utgift', motpart: 'Stockholms stad', ...u }); return a; }

  test('öresavrundning och små skillnader', () => {
    const t = K.trolligaUnderlag(ar([{ id: 'a', filnamn: 'a.pdf', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1199.6) }, { id: 'c', filnamn: 'c.pdf', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(900) }]), bank);
    eq(t.map((x) => [x.underlag.id, x.skal]), [['a', ['beloppet skiljer 0,40 kr']]]);
  });
  test('rätt belopp men betald långt efter förfallodagen', () => {
    const t = K.trolligaUnderlag(ar([{ id: 'a', filnamn: 'a.pdf', datum: '2029-11-01', forfallodatum: '2029-12-01', belopp: kr(1200) }]), bank);
    eq(t.map((x) => x.skal), [['betalningen ligger 94 dagar efter förfallodagen']]);
  });
  test('exakta träffar räknas inte som troliga, och fel riktning eller för gamla utesluts', () => {
    const t = K.trolligaUnderlag(ar([
      { id: 'exakt', filnamn: 'e.pdf', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1200) },
      { id: 'intakt', filnamn: 'i.pdf', datum: '2030-02-01', belopp: kr(1200), riktning: 'intakt' },
      { id: 'gammal', filnamn: 'g.pdf', datum: '2029-01-01', forfallodatum: '2029-02-01', belopp: kr(1200) }
    ]), bank);
    eq(t, []);
  });
  test('underlag från ett annat år', () => {
    const t = K.trolligaUnderlag(ar([]), bank, [{ arId: '2029', underlag: { id: 'x', filnamn: 'x.pdf', dokumenttyp: 'faktura', riktning: 'utgift', datum: '2029-12-20', forfallodatum: '2030-01-19', belopp: kr(1200), verifikation: null } }]);
    eq(t.map((x) => [x.underlag.id, x.arId, x.skal]), [['x', '2029', ['underlaget ligger i räkenskapsåret 2029']]]);
  });
  test('förslag med ett troligt underlag använder bankens belopp och underlagets konto', () => {
    let a = ar([{ id: 'a', filnamn: 'a.pdf', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1199.6), foreslagetKonto: '5010' }]);
    a = K.importeraBankrader(a, [{ datum: bank.datum, text: bank.text, referens: '', belopp: bank.belopp, saldo: null }]).ar;
    const f = K.forslagForBankrad(a, a.bankrader[0], [], { underlagIds: ['a'], ungefar: true });
    eq(f.rader, [{ konto: '1930', belopp: kr(-1200) }, { konto: '5010', belopp: kr(1200) }]);
    assert.equal(f.kalla, 'underlag');
    eq(f.underlagIds, ['a']);
  });
});
