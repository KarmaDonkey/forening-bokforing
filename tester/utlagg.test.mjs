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

test('en avrundad utbetalning för flera kvitton matchas, och skillnaden bokförs på 3740', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  assert.equal(ar.kontoplan.some((k) => k.nr === '3740'), false, 'testet förutsätter att kontot saknas');
  [['t1', '2030-12-01', 120.4, '5810'], ['t2', '2030-12-02', 75, '6110'], ['t3', '2030-12-03', 64.2, '5400']].forEach(([id, datum, b, konto]) => {
    ar = K.laggTillUnderlag(ar, { id, datum, motpart: 'Butik ' + id, belopp: kr(b), riktning: 'utgift', foreslagetKonto: konto, filnamn: id });
  });
  ar = K.skapaUtlagg(ar, { person: 'Exempel', poster: ['t1', 't2', 't3'].map((underlagId) => ({ underlagId })) }).ar;
  ar = bankrad(ar, '2031-01-08', -260, 'Exempel');
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  assert.deepEqual(json(f.underlagIds.sort()), ['t1', 't2', 't3']);
  assert.equal(f.avrundning, kr(0.4));
  assert.equal(f.komplett, true);
  assert.deepEqual(json(f.rader.map((r) => [r.konto, r.belopp]).sort()), [['1930', kr(-260)], ['3740', kr(0.4)], ['5400', kr(64.2)], ['5810', kr(120.4)], ['6110', kr(75)]]);
  assert.match(f.text, /avrundat 0.40 kr/);
  assert.equal(K.kontonamn(ar, '3740'), 'Öres- och kronutjämning', 'namnet visas innan kontot finns');
  const res = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds });
  assert.equal(res.ar.kontoplan.find((k) => k.nr === '3740').namn, 'Öres- och kronutjämning');
  assert.equal(K.utlaggStatus(res.ar, res.ar.utlagg[0].id).klar, true);
});

test('avrundning gäller bara utlägg med flera kvitton och högst 1 kr, och exakt summa går före', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  [['t1', '2030-12-01', 120.4], ['t2', '2030-12-02', 75], ['t3', '2030-12-03', 64.2], ['t4', '2030-12-04', 58.6]].forEach(([id, datum, b]) => {
    ar = K.laggTillUnderlag(ar, { id, datum, motpart: 'Butik', belopp: kr(b), riktning: 'utgift', foreslagetKonto: '5400', filnamn: id });
  });
  ar = K.laggTillUnderlag(ar, { id: 'lös', datum: '2030-12-05', motpart: 'Butik', belopp: kr(33.3), riktning: 'utgift', foreslagetKonto: '5400', filnamn: 'lös' });
  ar = K.skapaUtlagg(ar, { person: 'Exempel', poster: ['t1', 't2', 't3', 't4'].map((underlagId) => ({ underlagId })) }).ar;
  const matcha = (belopp) => { const a = bankrad(ar, '2031-01-08', belopp, 'Ersattning'); return json(K.matchaUnderlag(a, a.bankrader[0]).sort()); };
  assert.deepEqual(matcha(-195.4), ['t1', 't2'], 'exakt summa');
  assert.deepEqual(matcha(-195), ['t1', 't2'], '40 öre avrundat');
  assert.deepEqual(matcha(-199), [], 'mer än 1 kr matchas inte');
  assert.deepEqual(matcha(-33), [], 'ett kvitto utanför utlägg avrundas inte');
  assert.deepEqual(matcha(-318.2), ['t1', 't2', 't3', 't4'], 'hela redovisningen exakt');
  const a = bankrad(ar, '2031-01-08', -318, 'Ersattning');
  assert.equal(K.forslagForBankrad(a, a.bankrader[0], []).avrundning, kr(-0.2), 'utbetalt mindre ger kredit på 3740');
});

test('ett kvitto kan tas ur en redovisning som inte är utbetald', () => {
  let ar = utlagg(arMedKvitton()).ar;
  const id = ar.utlagg[0].id;
  assert.equal(K.utlaggNamn(ar, id), 'Exempel · Hösten 2030');
  assert.throws(() => K.taBortUnderlag(ar, 'b'), /Exempel · Hösten 2030.*Ta ur/);
  ar = K.taUrUtlagg(ar, id, 'b');
  const b = ar.underlag.find((u) => u.id === 'b');
  assert.deepEqual([b.belopp, b.utlagg, b.kvittobelopp, b.privat], [kr(512.3), undefined, undefined, undefined], 'kvittot får tillbaka hela beloppet');
  assert.equal(ar.utlagg[0].poster.includes('b'), false);
  assert.equal(K.utlaggStatus(ar, id).summa, kr(1687.7));
  ar = K.taBortUnderlag(ar, 'b');
  assert.equal(ar.underlag.some((u) => u.id === 'b'), false);
  assert.throws(() => K.taUrUtlagg(ar, id, 'x'), /ingår inte/);
  // Ett utbetalt kvitto kan inte tas ur; de andra kan.
  ar = bankrad(ar, '2031-01-20', -600, 'Exempel ers ovrigt');
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
  assert.throws(() => K.taUrUtlagg(ar, id, f.underlagIds[0]), /redan utbetalt/);
  ar = K.taUrUtlagg(ar, id, 'd');
  assert.equal(ar.utlagg.length, 1);
});

test('när sista kvittot tas ur försvinner redovisningen', () => {
  let ar = K.skapaUtlagg(arMedKvitton(), { person: 'Exempel', poster: [{ underlagId: 'a' }] }).ar;
  ar = K.taUrUtlagg(ar, ar.utlagg[0].id, 'a');
  assert.equal(ar.utlagg.length, 0);
  assert.equal(ar.underlag.find((u) => u.id === 'a').utlagg, undefined);
});

test('en redovisning kan ändras: nya kvitton, uttagna kvitton, belopp och text', () => {
  let ar = K.skapaUtlagg(arMedKvitton(), { person: 'Exempel', text: 'Hösten', poster: [{ underlagId: 'a' }, { underlagId: 'b', belopp: kr(412.3), privat: 'Privat vara 100' }, { underlagId: 'c' }] }).ar;
  const id = ar.utlagg[0].id;
  ar = K.andraUtlagg(ar, id, { person: 'Exempel', text: 'Hösten 2030', poster: [
    { underlagId: 'b', belopp: kr(312.3), privat: 'Privat vara 200' }, { underlagId: 'c' }, { underlagId: 'e' }] });
  const x = ar.utlagg[0];
  assert.deepEqual(json(x.poster), ['b', 'c', 'e'], 'kvar i samma ordning, nya sist');
  assert.equal(x.text, 'Hösten 2030');
  const u = (i) => ar.underlag.find((v) => v.id === i);
  assert.deepEqual([u('a').belopp, u('a').utlagg], [kr(113.4), undefined], 'uttaget kvitto är fritt igen');
  assert.deepEqual([u('b').belopp, u('b').kvittobelopp, u('b').privat], [kr(312.3), kr(512.3), 'Privat vara 200']);
  assert.deepEqual([u('e').utlagg, u('e').utlaggPerson], [id, 'Exempel']);
  assert.equal(K.utlaggStatus(ar, id).summa, kr(312.3 + 217.8 + 251.15));
  assert.throws(() => K.andraUtlagg(ar, id, { person: 'Exempel', poster: [] }), /minst ett kvitto/);
  assert.throws(() => K.andraUtlagg(ar, id, { person: 'Exempel', poster: [{ underlagId: 'b', belopp: kr(600) }] }), /större än kvittot/);
  const annan = K.skapaUtlagg(ar, { person: 'Annan', poster: [{ underlagId: 'g' }] }).ar;
  assert.throws(() => K.andraUtlagg(annan, id, { person: 'Exempel', poster: [{ underlagId: 'g' }] }), /redan i en utläggsredovisning/);
});

test('utbetalda kvitton ligger kvar när en delvis utbetald redovisning ändras', () => {
  let ar = utlagg(arMedKvitton()).ar;
  const id = ar.utlagg[0].id;
  ar = bankrad(ar, '2031-01-10', -700, 'Exempel ers fika');
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
  assert.throws(() => K.andraUtlagg(ar, id, { person: 'Någon annan', poster: [{ underlagId: 'a' }] }), /Personen kan inte ändras/);
  ar = K.andraUtlagg(ar, id, { person: 'Exempel', text: 'Hösten 2030', poster: [{ underlagId: 'a' }, { underlagId: 'x' }] });
  assert.deepEqual(json(ar.utlagg[0].poster), ['a', 'b', 'e', 'f', 'x']);
  assert.equal(ar.underlag.find((u) => u.id === 'b').belopp, kr(412.3), 'det utbetalda kvittot är orört');
  assert.equal(ar.underlag.find((u) => u.id === 'c').utlagg, undefined);
});
