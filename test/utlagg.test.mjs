import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat: personer, belopp, datum och varor.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function arMedKvitton() {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(10000), 2067: kr(-10000) } });
  const kvitto = (id, datum, belopp, konto, beskrivning) => ({ id, datum, motpart: 'Butik ' + id, belopp: kr(belopp), riktning: 'utgift', foreslagetKonto: konto, beskrivning, filnamn: id + '.jpg' });
  [kvitto('a', '2030-08-01', 113.4, '5810', 'Resa'), kvitto('b', '2030-10-01', 512.3, '4000', 'Fika'), kvitto('c', '2030-10-02', 217.8, '5400', 'Material'),
    kvitto('d', '2030-10-03', 1000, '5400', 'Utrustning'), kvitto('e', '2030-11-01', 251.15, '4000', 'Fika'), kvitto('f', '2030-11-02', 36.55, '4000', 'Fika'),
    kvitto('g', '2030-11-03', 268.8, '6110', 'Papper'), kvitto('x', '2031-01-02', 700, '6990', 'Annat')].forEach((k) => { ar = K.laggTillUnderlag(ar, k); });
  return ar;
}
function utlagg(ar) {
  return K.skapaUtlagg(ar, { person: 'Exempel', text: 'Hösten 2030', poster: [
    { underlagId: 'a' }, { underlagId: 'b', belopp: kr(412.3), privat: 'Privat vara 100' }, { underlagId: 'c' },
    { underlagId: 'd', belopp: kr(800), privat: 'Privat vara 200', beskrivning: 'Utrustning till föreningen' }, { underlagId: 'e' }, { underlagId: 'f' }, { underlagId: 'g' }] });
}
const bankrad = (ar, datum, belopp, text) => K.importeraBankrader(ar, [{ datum, text, referens: '', belopp: kr(belopp), saldo: null }]).ar;

test('en utläggsredovisning sparar den ersättningsbara delen och det privata', () => {
  const r = utlagg(arMedKvitton());
  const s = K.utlaggStatus(r.ar, r.utlagg.id);
  assert.equal(s.summa, kr(2100));
  assert.equal(s.kvittosumma, kr(2400));
  assert.equal(s.kvar, kr(2100));
  const b = r.ar.underlag.find((u) => u.id === 'b');
  assert.deepEqual([b.belopp, b.kvittobelopp, b.privat, b.utlaggPerson], [kr(412.3), kr(512.3), 'Privat vara 100', 'Exempel']);
  assert.equal(r.ar.underlag.find((u) => u.id === 'd').beskrivning, 'Utrustning till föreningen');
  assert.throws(() => K.skapaUtlagg(r.ar, { person: 'Y', poster: [{ underlagId: 'a' }] }), /redan i en utläggsredovisning/);
  assert.throws(() => K.skapaUtlagg(r.ar, { person: 'Y', poster: [{ underlagId: 'x', belopp: kr(800) }] }), /större än kvittot/);
  assert.throws(() => K.skapaUtlagg(r.ar, { person: '', poster: [{ underlagId: 'x' }] }), /vem/);
  assert.throws(() => K.taBortUnderlag(r.ar, 'a'), /utläggsredovisning/);
});

test('utbetalningar i delar matchar kvittona, även månader efteråt', () => {
  let ar = utlagg(arMedKvitton()).ar;
  ar = bankrad(ar, '2031-01-10', -700, 'Exempel ers fika');
  ar = bankrad(ar, '2031-01-15', -800, 'Ersattning');
  ar = bankrad(ar, '2031-01-20', -600, 'Exempel ers ovrigt');
  const rad = (d) => ar.bankrader.find((r) => r.datum === d);
  assert.deepEqual(json(K.matchaUnderlag(ar, rad('2031-01-10')).sort()), ['b', 'e', 'f']);
  const f = K.forslagForBankrad(ar, rad('2031-01-20'), []);
  assert.deepEqual(json(f.underlagIds.sort()), ['a', 'c', 'g'], 'resan från augusti matchas fast den är äldre än 60 dagar');
  assert.equal(f.komplett, true);
  assert.deepEqual(json(f.rader.slice(1).map((r) => r.konto).sort()), ['5400', '5810', '6110']);
  assert.match(f.text, /^Utlägg Exempel: /);
  for (const d of ['2031-01-10', '2031-01-15', '2031-01-20']) {
    const ff = K.forslagForBankrad(ar, rad(d), []);
    ar = K.bokforKopplat(ar, { datum: ff.datum, text: ff.text, rader: ff.rader }, { bankradId: ff.bankradId, underlagIds: ff.underlagIds }).ar;
  }
  const s = K.utlaggStatus(ar, ar.utlagg[0].id);
  assert.equal(s.klar, true);
  assert.equal(s.verifikationer.length, 3);
  assert.throws(() => K.taBortUtlagg(ar, ar.utlagg[0].id), /utbetalt/);
});

test('hela redovisningen i en utbetalning, och borttagning ger tillbaka kvittobeloppen', () => {
  let ar = utlagg(arMedKvitton()).ar;
  ar = bankrad(ar, '2031-02-01', -2100, 'Exempel');
  assert.equal(K.matchaUnderlag(ar, ar.bankrader[0]).length, 7, 'alla sju kvitton, fler än fyra');
  ar = K.taBortUtlagg(ar, ar.utlagg[0].id);
  assert.equal(ar.utlagg.length, 0);
  const b = ar.underlag.find((u) => u.id === 'b');
  assert.deepEqual([b.belopp, b.utlagg, b.kvittobelopp], [kr(512.3), undefined, undefined]);
});

test('vid lika många kvitton väljs de som ligger närmast varandra i tid', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  [['p', '2030-06-01', 100], ['q', '2030-09-01', 50], ['r', '2030-09-03', 100], ['s', '2030-09-04', 50]].forEach(([id, datum, b]) => {
    ar = K.laggTillUnderlag(ar, { id, datum, motpart: 'Butik', belopp: kr(b), riktning: 'utgift', filnamn: id });
  });
  ar = K.skapaUtlagg(ar, { person: 'Exempel', poster: ['p', 'q', 'r', 's'].map((underlagId) => ({ underlagId })) }).ar;
  ar = bankrad(ar, '2031-01-05', -150, 'Exempel');
  assert.deepEqual(json(K.matchaUnderlag(ar, ar.bankrader[0]).sort()), ['r', 's']);
});
