import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat: namn, nummer och belopp.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function registret() {
  let reg = K.tomtRegister();
  reg = K.sattTermin(reg, 'HT-30', { barn: kr(1300) });
  reg.arsavgift = { vanlig: kr(500), funktionar: 0, ingar: true };
  reg.konton = { medlemsavgift: '3110', terminsavgift: '3100' };
  for (const namn of ['Exempel Barnsson', 'Påhittad Syskon Testberg', 'Annan Syskon Testberg', 'Exempel Annansson']) reg = K.laggTillMedlem(reg, { namn, kategori: 'barn' }).reg;
  return reg;
}

test('personnummer och andra siffror tas bort ur referensen', () => {
  assert.equal(K.rensaReferens('EXEMPEL BARNSSON 201907\n21-3894'), 'EXEMPEL BARNSSON');
  assert.equal(K.rensaReferens('EXEMPEL BARNSSON 20190721-3894'), 'EXEMPEL BARNSSON');
  assert.equal(K.rensaReferens('Exempel Barnsson 190721 3894'), 'Exempel Barnsson');
  assert.equal(K.rensaReferens(''), '');
});

test('insättningsuppgiften tolkas till en post per barn, utan personnummer', () => {
  const t = { dokumenttyp: 'insattningsuppgift', motpart: 'Fritidskortet', datum: '2030-10-01', forfallodatum: '', belopp: '1100.00', valuta: 'SEK', belopp_sek: '', moms: '', fakturanummer: '', ocr: '',
    beskrivning: 'Fritidskortet', riktning: 'intakt', foreslaget_konto: '3100', stalld_till_foreningen: 'ja', osakerhet: '', transaktioner: [],
    insattningar: [{ avsandare: 'Fritidskortet', referens: 'PÅHITTAD SYSKON TESTBERG', belopp: '550.00' }, { avsandare: 'Fritidskortet', referens: 'ANNAN SYSKON TESTBERG 201907 21-3894', belopp: '550.00' }] };
  const u = K.normaliseraTolkning(t, { id: 'u1', filnamn: 'f.pdf' }).underlag;
  assert.equal(u.belopp, kr(1100));
  assert.deepEqual(json(u.poster), [{ avsandare: 'Fritidskortet', namn: 'PÅHITTAD SYSKON TESTBERG', belopp: kr(550) }, { avsandare: 'Fritidskortet', namn: 'ANNAN SYSKON TESTBERG', belopp: kr(550) }]);
  assert.equal(JSON.stringify(u).includes('3894'), false, 'personnumret sparas inte');
  assert.equal(K.arFritidskort(u), true);
  assert.equal(K.arFritidskort({ motpart: 'Sveriges Riksidrottsförbund' }), false);
});

test('barnet hittas på namnet, bara när det är entydigt', () => {
  const reg = registret();
  const id = (n) => reg.medlemmar.find((m) => m.namn === n).id;
  assert.equal(K.hittaMedlemPaNamn(reg, 'EXEMPEL BARNSSON'), id('Exempel Barnsson'));
  assert.equal(K.hittaMedlemPaNamn(reg, 'PÅHITTAD SYSKON TESTBERG'), id('Påhittad Syskon Testberg'));
  assert.equal(K.hittaMedlemPaNamn(reg, 'Påhittad Testberg'), id('Påhittad Syskon Testberg'), 'mellannamn får saknas');
  assert.equal(K.hittaMedlemPaNamn(reg, 'Syskon Testberg'), null, 'två syskon: inte entydigt');
  assert.equal(K.hittaMedlemPaNamn(reg, 'EXEMPEL'), null, 'ett ord räcker inte');
  assert.equal(K.hittaMedlemPaNamn(reg, 'Okänd Person'), null);
});

test('Fritidskortets del är terminsavgift, och föräldern betalar resten med årsavgiften (fördelning B)', () => {
  let reg = registret();
  const barn = reg.medlemmar[0].id;
  const u = { motpart: 'Fritidskortet', belopp: kr(550), poster: [{ namn: 'EXEMPEL BARNSSON', belopp: kr(550) }] };
  const f = K.fritidskortForslag(reg, u, 'HT-30');
  assert.equal(f.alla, true);
  assert.deepEqual(json(f.poster), [{ medlem: barn, typ: 'termin', belopp: kr(550) }]);
  reg = K.registreraBetalning(reg, { datum: '2030-09-23', belopp: kr(550), termin: 'HT-30', nyckel: K.FRITIDSKORT.nyckel, poster: f.poster });
  // Föräldern betalar resten, 750 kr: 500 årsavgift och 250 terminsavgift.
  reg = K.kopplaBetalare(reg, { nyckel: '+46700000001' }, [barn]);
  const p = K.avgiftsforslag(reg, { datum: '2030-09-25', belopp: kr(750), nyckel: '+46700000001' });
  assert.equal(p.stammer, true);
  assert.deepEqual(json(p.poster), [{ medlem: barn, typ: 'termin', belopp: kr(250) }, { medlem: barn, typ: 'arsavgift', belopp: kr(500) }]);
});

test('betalar Fritidskortet hela avgiften delas den upp som vanligt, och okända barn markeras', () => {
  const reg = registret();
  const barn = reg.medlemmar[0].id;
  const hel = K.fritidskortForslag(reg, { motpart: 'Fritidskortet', belopp: kr(1300), poster: [{ namn: 'Exempel Barnsson', belopp: kr(1300) }] }, 'HT-30');
  assert.deepEqual(json(hel.poster), [{ medlem: barn, typ: 'termin', belopp: kr(800) }, { medlem: barn, typ: 'arsavgift', belopp: kr(500) }]);
  const okand = K.fritidskortForslag(reg, { motpart: 'Fritidskortet', belopp: kr(1100), poster: [{ namn: 'Exempel Barnsson', belopp: kr(550) }, { namn: 'Okänd Person', belopp: kr(550) }] }, 'HT-30');
  assert.equal(okand.alla, false);
  assert.deepEqual(json(okand.rader.map((r) => [r.namn, r.medlem ? 'hittad' : null])), [['Exempel Barnsson', 'hittad'], ['Okänd Person', null]]);
});

test('bokförda betalningar från Fritidskortet visas bland dem som ska kopplas', () => {
  const reg = registret();
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.laggTillUnderlag(ar, { id: 'fk', datum: '2030-09-23', motpart: 'Fritidskortet', belopp: kr(550), riktning: 'intakt', filnamn: 'fk.pdf', poster: [{ namn: 'Exempel Barnsson', belopp: kr(550) }] });
  ar = K.importeraBankrader(ar, [{ datum: '2030-09-23', text: 'Bg-inbetalning', referens: '', belopp: kr(550), saldo: null }]).ar;
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  assert.deepEqual(json(f.underlagIds), ['fk']);
  ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: [{ konto: '1930', belopp: kr(550) }, { konto: '3100', belopp: kr(-550) }] }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
  assert.equal(K.okoppladeInbetalningar(reg, ar, '2030').length, 1);
});
