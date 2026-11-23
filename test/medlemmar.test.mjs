import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad: namn, nummer och avgifter.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function registret() {
  let reg = K.tomtRegister();
  reg = K.sattTermin(reg, 'VT-30', { barn: kr(1000), student: kr(1500), vuxen: kr(2000), familj: kr(2500) });
  reg.arsavgift = { vanlig: kr(400), funktionar: kr(40) };
  reg.konton = { medlemsavgift: '3010', terminsavgift: '3020' };
  let r;
  r = K.laggTillMedlem(reg, { namn: 'Påhittad Ett', kategori: 'barn' }); reg = r.reg;
  r = K.laggTillMedlem(reg, { namn: 'Påhittad Två', kategori: 'barn' }); reg = r.reg;
  r = K.laggTillMedlem(reg, { namn: 'Vuxen Exempel', kategori: 'vuxen' }); reg = r.reg;
  r = K.laggTillMedlem(reg, { namn: 'Tränare Test', kategori: 'funktionar' }); reg = r.reg;
  return reg;
}

test('mobilnummer hittas i banktext i olika format', () => {
  assert.equal(K.hittaMobilnummer('Swish +46701112233'), '+46701112233');
  assert.equal(K.hittaMobilnummer('Swish 46701112233'), '+46701112233');
  assert.equal(K.hittaMobilnummer('Från 070-111 22 33'), '+46701112233');
  assert.equal(K.hittaMobilnummer('0046 70 111 22 33'), '+46701112233');
  assert.equal(K.hittaMobilnummer('1230000000'), null, 'föreningens Swishnummer är inget mobilnummer');
  assert.equal(K.hittaMobilnummer('Bankgiro 1234567'), null);
  assert.equal(K.visaMobilnummer('+46701112233'), '070-111 22 33');
});

test('betalaren tolkas från bankraden', () => {
  eq(K.tolkaBetalare({ text: 'Swish +46701112233', referens: '1230000000' }), { nyckel: '+46701112233', visning: '070-111 22 33', typ: 'swish' });
  eq(K.tolkaBetalare({ text: 'Bankgiro inbetalning', referens: '9876543' }), { nyckel: 'ref:9876543', visning: 'Bankgiro 9876543', typ: 'referens' });
  assert.equal(K.tolkaBetalare({ text: 'Swish', referens: '' }), null);
  assert.equal(K.tolkaBetalare({ text: 'FRITIDSKORT EXEMPEL', referens: '' }).nyckel, 'text:fritidskort exempel');
});

test('terminer från datum', () => {
  assert.equal(K.terminForDatum('2030-01-15'), 'VT-30');
  assert.equal(K.terminForDatum('2030-06-30'), 'VT-30');
  assert.equal(K.terminForDatum('2030-07-01'), 'HT-30');
  assert.equal(K.foregaendeTermin('VT-30'), 'HT-29');
  assert.equal(K.foregaendeTermin('HT-30'), 'VT-30');
  assert.equal(K.nastaTermin('HT-99'), 'VT-00');
  assert.equal(K.terminNamn('HT-30'), 'Höstterminen 2030');
  assert.throws(() => K.sattTermin(K.tomtRegister(), 'Höst 30', {}), /VT-27/);
});

test('avgifterna för en termin som saknas tas från senaste tidigare termin', () => {
  const reg = registret();
  eq(K.terminsavgifter(reg, 'HT-30'), { avgifter: { barn: kr(1000), student: kr(1500), vuxen: kr(2000), familj: kr(2500) }, fran: 'VT-30' });
  eq(K.terminsavgifter(reg, 'HT-29'), { avgifter: {}, fran: null });
});

test('okänd betalare ger inget förslag', () => {
  const f = K.avgiftsforslag(registret(), { datum: '2030-02-01', belopp: kr(1400), nyckel: '+46700000000' });
  assert.equal(f.kand, false);
  assert.equal(f.stammer, false);
  eq(f.poster, []);
});

test('känd betalare: terminsavgift plus årsavgift första gången under året', () => {
  let reg = registret();
  reg = K.kopplaBetalare(reg, { nyckel: '+46701112233', visning: '070-111 22 33' }, ['m1']);
  const f = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(1400), nyckel: '+46701112233' });
  assert.equal(f.stammer, true);
  assert.equal(f.termin, 'VT-30');
  eq(f.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }]);
  eq(K.avgiftsrader(reg, f.poster, '1930', kr(1400)), [{ konto: '1930', belopp: kr(1400) }, { konto: '3020', belopp: kr(-1000) }, { konto: '3010', belopp: kr(-400) }]);
  assert.equal(K.avgiftstext(reg, f.termin, f.poster), 'Medlems- och terminsavgift VT-30, 1 medlem');
  // Hösten samma år: årsavgiften är redan betald.
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(1400), termin: 'VT-30', nyckel: '+46701112233', poster: f.poster });
  const h = K.avgiftsforslag(reg, { datum: '2030-08-20', belopp: kr(1000), nyckel: '+46701112233' });
  assert.equal(h.stammer, true);
  eq(h.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }]);
  assert.equal(K.avgiftstext(reg, h.termin, h.poster), 'Terminsavgift HT-30, 1 medlem');
});

test('två föräldrar kan betala för samma barn, och barnet räknas en gång', () => {
  let reg = registret();
  reg = K.kopplaBetalare(reg, { nyckel: '+46701111111' }, ['m1']);
  reg = K.kopplaBetalare(reg, { nyckel: '+46702222222' }, ['m1']);
  const vt = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(1400), nyckel: '+46701111111' });
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(1400), termin: vt.termin, nyckel: '+46701111111', poster: vt.poster });
  const ht = K.avgiftsforslag(reg, { datum: '2030-08-01', belopp: kr(1000), nyckel: '+46702222222' });
  assert.equal(ht.stammer, true);
  reg = K.registreraBetalning(reg, { datum: '2030-08-01', belopp: kr(1000), termin: ht.termin, nyckel: '+46702222222', poster: ht.poster });
  assert.equal(K.terminsstatistik(reg, 'VT-30').totalt.antal, 1);
  assert.equal(K.terminsstatistik(reg, 'HT-30').totalt.antal, 1);
});

test('förälder med två barn: båda, eller ett av dem', () => {
  let reg = registret();
  reg = K.kopplaBetalare(reg, { nyckel: '+46703333333' }, ['m1', 'm2']);
  const bada = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(2800), nyckel: '+46703333333' });
  assert.equal(bada.stammer, true);
  assert.equal(bada.tvetydig, false);
  assert.equal(bada.poster.length, 4);
  const ett = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(1400), nyckel: '+46703333333' });
  assert.equal(ett.stammer, true);
  assert.equal(ett.tvetydig, true, 'två barn med samma avgift: appen vet inte vilket');
  const fel = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(999), nyckel: '+46703333333' });
  assert.equal(fel.stammer, false);
  assert.equal(fel.summa, kr(2800), 'förslaget visar alla när inget stämmer');
});

test('utan årsavgift när den betalats på annat sätt', () => {
  let reg = registret();
  reg = K.kopplaBetalare(reg, { nyckel: '+46704444444' }, ['m3']);
  const f = K.avgiftsforslag(reg, { datum: '2030-09-01', belopp: kr(2000), nyckel: '+46704444444' });
  assert.equal(f.stammer, true);
  eq(f.poster, [{ medlem: 'm3', typ: 'termin', belopp: kr(2000) }]);
});

test('familjeavgiften tas en gång och funktionärer betalar bara årsavgift', () => {
  let reg = registret();
  reg = K.andraMedlem(reg, 'm1', { kategori: 'familj' });
  reg = K.andraMedlem(reg, 'm2', { kategori: 'familj' });
  reg = K.kopplaBetalare(reg, { nyckel: '+46705555555' }, ['m1', 'm2']);
  const f = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(2500 + 400), nyckel: '+46705555555' });
  assert.equal(f.stammer, true);
  eq(f.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(2500) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }, { medlem: 'm2', typ: 'termin', belopp: 0 }]);
  reg = K.kopplaBetalare(reg, { nyckel: '+46706666666' }, ['m4']);
  const t = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(40), nyckel: '+46706666666' });
  assert.equal(t.stammer, true);
  eq(t.poster, [{ medlem: 'm4', typ: 'arsavgift', belopp: kr(40) }]);
  assert.equal(K.avgiftstext(reg, t.termin, t.poster), 'Medlemsavgift 2030, 1 medlem');
});

test('registrering kontrolleras', () => {
  const reg = registret();
  assert.throws(() => K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(100), termin: 'VT-30', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(99) }] }), /stämmer inte/);
  assert.throws(() => K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(100), termin: 'VT-30', poster: [{ medlem: 'x9', typ: 'termin', belopp: kr(100) }] }), /finns inte/);
  const r2 = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(100), termin: 'VT-30', arId: '2030', bankradId: 'b1', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(100) }] });
  assert.throws(() => K.registreraBetalning(r2, { datum: '2030-02-01', belopp: kr(100), termin: 'VT-30', arId: '2030', bankradId: 'b1', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(100) }] }), /redan kopplad/);
  assert.throws(() => K.taBortMedlem(r2, 'm1'), /betalningar/);
  assert.equal(K.taBortMedlem(r2, 'm2').medlemmar.length, 3);
  assert.throws(() => K.avgiftsrader(Object.assign({}, reg, { konton: { medlemsavgift: '', terminsavgift: '' } }), [{ medlem: 'm1', typ: 'termin', belopp: kr(100) }], '1930', kr(100)), /Välj konton/);
});

test('statistik per termin: kategorier, för lite och vilka som slutat', () => {
  let reg = registret();
  reg = K.sattTermin(reg, 'HT-30', { barn: kr(1100), vuxen: kr(2000) });
  const b = (datum, termin, poster) => { reg = K.registreraBetalning(reg, { datum, termin, belopp: poster.reduce((s, p) => s + p.belopp, 0), poster }); };
  b('2030-02-01', 'VT-30', [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }]);
  b('2030-02-02', 'VT-30', [{ medlem: 'm2', typ: 'termin', belopp: kr(1000) }]);
  b('2030-02-03', 'VT-30', [{ medlem: 'm3', typ: 'termin', belopp: kr(2000) }]);
  b('2030-08-01', 'HT-30', [{ medlem: 'm1', typ: 'termin', belopp: kr(1100) }]);
  b('2030-08-02', 'HT-30', [{ medlem: 'm3', typ: 'termin', belopp: kr(1500) }]);
  const s = K.terminsstatistik(reg, 'HT-30');
  eq(s.totalt, { antal: 2, termin: kr(2600), arsavgift: 0, summa: kr(2600) });
  eq(s.perKategori.barn, { antal: 1, termin: kr(1100), arsavgift: 0 });
  eq(s.forLite.map((x) => x.namn), ['Vuxen Exempel']);
  eq(s.slutat.map((x) => x.namn), ['Påhittad Två']);
  const h = K.terminshistorik(reg);
  eq(h.map((r) => [r.termin, r.antal, r.barn, r.vuxen, r.summa]), [['VT-30', 3, 2, 1, kr(4400)], ['HT-30', 2, 1, 1, kr(2600)]]);
});

test('betalningar i rättade verifikationer räknas inte', () => {
  let ar = K.skapaAr({ start: '2030-01-01' });
  ar = K.laggTillKonto(ar, '3020', 'Terminsavgifter');
  ar = K.bokfor(ar, { datum: '2030-02-01', text: 'Terminsavgift', rader: [{ konto: '1930', belopp: kr(1000) }, { konto: '3020', belopp: kr(-1000) }] }).ar;
  let reg = K.registreraBetalning(registret(), { datum: '2030-02-01', belopp: kr(1000), termin: 'VT-30', arId: '2030', ver: 1, poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }] });
  assert.equal(K.terminsstatistik(reg, 'VT-30', { 2030: ar }).totalt.antal, 1);
  ar = K.rattelse(ar, 1, { datum: '2030-02-02' }).ar;
  assert.equal(K.terminsstatistik(reg, 'VT-30', { 2030: ar }).totalt.antal, 0);
});

test('okopplade Swish-inbetalningar', () => {
  let ar = K.skapaAr({ start: '2030-01-01' });
  ar = K.importeraBankrader(ar, [
    { datum: '2030-02-01', text: 'Swish +46701112233', referens: '', belopp: kr(1400), saldo: null },
    { datum: '2030-02-02', text: 'Hyra', referens: '', belopp: kr(-500), saldo: null },
    { datum: '2030-02-03', text: 'Swish +46702223344', referens: '', belopp: kr(1000), saldo: null }
  ]).ar;
  const r = ar.bankrader;
  ar = K.bokforKopplat(ar, { datum: r[0].datum, text: 'A', underlagKommentar: 'x', rader: [{ konto: '1930', belopp: kr(1400) }, { konto: '3100', belopp: kr(-1400) }] }, { bankradId: r[0].id }).ar;
  ar = K.bokforKopplat(ar, { datum: r[2].datum, text: 'B', underlagKommentar: 'x', rader: [{ konto: '1930', belopp: kr(1000) }, { konto: '3100', belopp: kr(-1000) }] }, { bankradId: r[2].id }).ar;
  let reg = registret();
  assert.equal(K.okoppladeInbetalningar(reg, ar, '2030').length, 2);
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(1400), termin: 'VT-30', arId: '2030', ver: 1, bankradId: r[0].id, poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(1400) }] });
  reg.ignorerade = ['2030|' + r[2].id];
  assert.equal(K.okoppladeInbetalningar(reg, ar, '2030').length, 0);
});

test('bankfil med kolumnen Transaktionstyp ger betalarens nummer', () => {
  const fil = 'Bokföringsdag;Transaktionstyp;Referens;Belopp;Saldo\n2030-01-09;Swish +46701112233;1230000000;1 400,00;5 400,00\n2030-01-14;Bankgiro inbetalning;9876543;1 000,00;6 400,00\n';
  const res = K.parseBankfil(fil);
  eq(res.rader.map((r) => [r.text, r.referens]), [['Swish +46701112233', '1230000000'], ['Bankgiro inbetalning', '9876543']]);
});

test('kontoutdrag inläst igen kompletterar rader som saknade betalarens nummer', () => {
  let ar = K.skapaAr({ start: '2030-01-01' });
  ar = K.importeraBankrader(ar, [{ datum: '2030-01-09', text: '1230000000', referens: '', belopp: kr(1400), saldo: kr(5400) }]).ar;
  const id = ar.bankrader[0].id;
  const res = K.importeraBankrader(ar, [
    { datum: '2030-01-09', text: 'Swish +46701112233', referens: '1230000000', belopp: kr(1400), saldo: kr(5400) },
    { datum: '2030-01-10', text: 'Swish +46702223344', referens: '1230000000', belopp: kr(100), saldo: kr(5500) }
  ]);
  assert.equal(res.nya, 1);
  assert.equal(res.kompletterade, 1);
  assert.equal(res.ar.bankrader.length, 2);
  eq([res.ar.bankrader[0].id, res.ar.bankrader[0].text, res.ar.bankrader[0].referens], [id, 'Swish +46701112233', '1230000000']);
});

test('kontoförslag: befintliga konton används, annars lediga nummer', () => {
  let ar = K.skapaAr({ start: '2030-01-01' });
  eq(K.foreslaAvgiftskonton(ar), { medlemsavgift: '3010', terminsavgift: '3020', finnsMedlemsavgift: false, finnsTerminsavgift: false });
  ar = K.laggTillKonto(ar, '3001', 'Medlemsavgifter');
  ar = K.laggTillKonto(ar, '3002', 'Träningsavgifter');
  eq(K.foreslaAvgiftskonton(ar), { medlemsavgift: '3001', terminsavgift: '3002', finnsMedlemsavgift: true, finnsTerminsavgift: true });
});

test('avgifter kan läsas in från fil med föreningsuppgifter', () => {
  const fil = { format: 'foreningsbokforing-forening', forening: {}, terminer: [{ id: 'HT-30', avgifter: { barn: kr(1000) } }], arsavgift: { vanlig: kr(400), funktionar: kr(40) } };
  let n = 0;
  const res = K.slaIhopForening({ forening: {}, adresser: [], kontakter: [], artiklar: [] }, fil, () => 'x' + (n++));
  eq(res.data.medlemsregister.terminer, [{ id: 'HT-30', avgifter: { barn: kr(1000) } }]);
  eq(res.data.medlemsregister.arsavgift, { vanlig: kr(400), funktionar: kr(40) });
  assert.equal(res.antal.terminer, 3);
  const igen = K.slaIhopForening({ forening: {}, medlemsregister: res.data.medlemsregister }, fil, () => 'y');
  assert.equal(igen.antal.terminer, 0);
});

test('tomt register normaliseras', () => {
  const r = K.normaliseraRegister(undefined);
  eq(Object.keys(r).sort(), ['arsavgift', 'avforEfterAr', 'betalare', 'betalningar', 'format', 'ignorerade', 'konton', 'kvitton', 'medlemmar', 'terminer']);
  assert.equal(K.registerHarData(r), false);
  assert.equal(K.normaliseraRegister({ avforEfterAr: 3 }).avforEfterAr, 3);
  assert.equal(K.normaliseraRegister({ avforEfterAr: 'x' }).avforEfterAr, 2);
  assert.equal(K.normaliseraRegister({ medlemmar: [{ id: 'm1' }] }).medlemmar.length, 1);
});

test('verifikationstexten innehåller inga namn', () => {
  const reg = registret();
  const poster = [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm2', typ: 'termin', belopp: kr(1000) }];
  const text = K.avgiftstext(reg, 'VT-30', poster);
  assert.equal(text, 'Terminsavgift VT-30, 2 medlemmar');
  assert.ok(!/Påhittad/.test(text));
});

test('avförande tar bort namn och betalarens nummer men behåller statistiken', () => {
  let reg = registret();
  reg = K.kopplaBetalare(reg, { nyckel: '+46701111111' }, ['m1']);
  reg = K.kopplaBetalare(reg, { nyckel: '+46702222222' }, ['m1', 'm2']);
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(1400), termin: 'VT-30', nyckel: '+46701111111', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }] });
  reg = K.avforMedlem(reg, 'm1', '2033-01-10', 'stadgarna');
  eq(reg.medlemmar[0], { id: 'm1', namn: 'Tidigare medlem', kategori: 'barn', avford: '2033-01-10', orsak: 'stadgarna' });
  eq(reg.betalare, [{ nyckel: '+46702222222', visning: '+46702222222', namn: '', medlemmar: ['m2'] }]);
  assert.equal(reg.betalningar[0].nyckel, '');
  assert.equal(K.terminsstatistik(reg, 'VT-30').totalt.antal, 1);
  assert.throws(() => K.avforMedlem(reg, 'm1', '2033-01-11'), /redan avförd/);
});

test('att avföra enligt stadgarna: två hela verksamhetsår utan årsavgift', () => {
  let reg = registret();
  const ars = (medlem, datum) => { reg = K.registreraBetalning(reg, { datum, termin: K.terminForDatum(datum), belopp: kr(400), poster: [{ medlem, typ: 'arsavgift', belopp: kr(400) }] }); };
  ars('m1', '2030-02-01');
  ars('m2', '2031-02-01');
  reg = K.laggTillMedlem(reg, { namn: 'Ny Medlem', kategori: 'vuxen', tillagd: '2032-05-01' }).reg;
  // Den 2033-01-15 gäller 2031 och 2032: m1 betalade senast 2030, m3 och m4 aldrig. m2 betalade 2031. m5 är för ny.
  const lista = K.attAvfora(reg, '2033-01-15');
  eq(lista.map((x) => [x.medlem, x.senastBetalt]), [['m1', '2030'], ['m4', null], ['m3', null]]);
  eq(lista[0].ar, ['2031', '2032']);
  // Betalt i år: inte aktuell, även om de två föregående åren saknas.
  ars('m4', '2033-01-12');
  eq(K.attAvfora(reg, '2033-01-15').map((x) => x.medlem), ['m1', 'm3']);
  reg.avforEfterAr = 3;
  eq(K.attAvfora(reg, '2033-01-15').map((x) => x.medlem), ['m3']);
});

test('kvitto: rader för en medlem, löpnummer och registrering', () => {
  let reg = registret();
  reg = K.andraMedlem(reg, 'm1', { kategori: 'familj' });
  reg = K.andraMedlem(reg, 'm2', { kategori: 'familj' });
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(2900), termin: 'VT-30', nyckel: '+46701111111', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(2500) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }, { medlem: 'm2', typ: 'termin', belopp: 0 }] });
  reg = K.registreraBetalning(reg, { datum: '2031-02-01', belopp: kr(2000), termin: 'VT-31', nyckel: 'ref:123', poster: [{ medlem: 'm3', typ: 'termin', belopp: kr(2000) }] });
  eq(K.kvittorader(reg, 'm1', null, '2030').map((r) => [r.text, r.belopp, r.betalsatt]), [['Medlemsavgift 2030', kr(400), 'Swish'], ['Terminsavgift VT-30', kr(2500), 'Swish']]);
  eq(K.kvittorader(reg, 'm2').map((r) => [r.text, r.belopp]), [['Terminsavgift VT-30 (ingår i familjeavgift)', 0]]);
  eq(K.kvittorader(reg, 'm3').map((r) => [r.text, r.betalsatt]), [['Terminsavgift VT-31', 'Bankgiro']]);
  eq(K.kvittorader(reg, 'm3', null, '2030'), []);
  assert.equal(K.nastaKvittonummer(reg, '2030'), 'M-2030-001');
  reg = K.registreraKvitto(reg, { nr: 'M-2030-001', datum: '2030-03-01', medlem: 'm1' });
  reg = K.registreraKvitto(reg, { nr: 'M-2030-001', datum: '2030-03-01', medlem: 'm1' });
  assert.equal(reg.kvitton.length, 1);
  assert.equal(K.nastaKvittonummer(reg, '2030'), 'M-2030-002');
  assert.equal(K.nastaKvittonummer(reg, '2031'), 'M-2031-001');
});

test('information för kvitto: högst 40 tecken per rad och 5 rader', () => {
  eq(K.kontrolleraKvittoinfo('Påhittad gatan 1\n111 11 Staden\n\n'), { text: 'Påhittad gatan 1\n111 11 Staden', fel: [] });
  assert.match(K.kontrolleraKvittoinfo('x'.repeat(41)).fel[0], /Rad 1 har 41 tecken/);
  assert.match(K.kontrolleraKvittoinfo('1\n2\n3\n4\n5\n6').fel[0], /Högst 5 rader/);
  let reg = registret();
  reg = K.andraMedlem(reg, 'm1', { info: 'anna@example.se\n070-000 00 00' });
  assert.equal(reg.medlemmar[0].info, 'anna@example.se\n070-000 00 00');
  assert.throws(() => K.andraMedlem(reg, 'm1', { info: 'x'.repeat(50) }), /50 tecken/);
  reg = K.andraMedlem(reg, 'm1', { info: '' });
  assert.ok(!('info' in reg.medlemmar[0]));
  reg = K.kopplaBetalare(reg, { nyckel: '+46701111111' }, ['m1']);
  reg = K.andraBetalare(reg, '+46701111111', { info: 'Förälder Exempel\nPåhittad väg 2' });
  assert.equal(reg.betalare[0].info, 'Förälder Exempel\nPåhittad väg 2');
  reg = K.avforMedlem(reg, 'm1', '2033-01-01', 'utträde');
  assert.ok(!('info' in reg.medlemmar[0]), 'avförd medlem har inga uppgifter kvar');
});

test('två medlemmar slås ihop: betalningar, betalare och kvitton följer med', () => {
  let reg = registret();
  reg = K.andraMedlem(reg, 'm2', { info: 'Adress 1' });
  reg = K.kopplaBetalare(reg, { nyckel: '+46701111111' }, ['m1', 'm2']);
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(2000), termin: 'VT-30', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm2', typ: 'termin', belopp: kr(1000) }] });
  reg = K.registreraBetalning(reg, { datum: '2030-08-01', belopp: kr(1000), termin: 'HT-30', meddelande: 'Terminsavgift HT30 - påhittad text', poster: [{ medlem: 'm2', typ: 'termin', belopp: kr(1000) }] });
  reg = K.registreraKvitto(reg, { nr: 'M-2030-001', datum: '2030-09-01', medlem: 'm2' });
  const r = K.slaIhopMedlemmar(reg, 'm2', 'm1');
  eq(r.medlemmar.map((m) => m.id), ['m1', 'm3', 'm4']);
  assert.equal(r.medlemmar[0].info, 'Adress 1');
  eq(r.betalningar[0].poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(2000) }]);
  eq(r.betalningar[1].poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }]);
  assert.equal(r.betalningar[1].meddelande, 'Terminsavgift HT30 - påhittad text');
  eq(r.betalare[0].medlemmar, ['m1']);
  assert.equal(r.kvitton[0].medlem, 'm1');
  assert.throws(() => K.slaIhopMedlemmar(reg, 'm1', 'm1'), /annan/);
});

test('ny fördelning av en betalning på flera medlemmar', () => {
  let reg = registret();
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(2000), termin: 'VT-30', poster: [{ medlem: 'm1', typ: 'termin', belopp: kr(2000) }] });
  const r = K.andraFordelning(reg, 'b1', [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }, { medlem: 'm2', typ: 'termin', belopp: kr(1000) }]);
  assert.equal(K.terminsstatistik(r, 'VT-30').totalt.antal, 2);
  assert.throws(() => K.andraFordelning(reg, 'b1', [{ medlem: 'm1', typ: 'termin', belopp: kr(1500) }]), /stämmer inte/);
  assert.equal(K.andraFordelning(reg, 'b1', [{ medlem: 'm1', typ: 'termin', belopp: kr(2000) }], 'HT-30').betalningar[0].termin, 'HT-30');
});

test('årsavgiften kan ingå i terminsavgiften: första betalningen under året delas upp', () => {
  let reg = registret();
  reg = K.sattTermin(reg, 'HT-30', { barn: kr(1000), vuxen: kr(2000) });
  reg.arsavgift = Object.assign({}, reg.arsavgift, { ingar: true });
  reg = K.kopplaBetalare(reg, { nyckel: '+46701112233' }, ['m1']);
  const vt = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(1000), nyckel: '+46701112233' });
  assert.equal(vt.stammer, true);
  eq(vt.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(600) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }]);
  eq(K.avgiftsrader(reg, vt.poster, '1930', kr(1000)), [{ konto: '1930', belopp: kr(1000) }, { konto: '3020', belopp: kr(-600) }, { konto: '3010', belopp: kr(-400) }]);
  reg = K.registreraBetalning(reg, { datum: '2030-02-01', belopp: kr(1000), termin: vt.termin, nyckel: '+46701112233', poster: vt.poster });
  const ht = K.avgiftsforslag(reg, { datum: '2030-08-20', belopp: kr(1000), nyckel: '+46701112233' });
  assert.equal(ht.stammer, true);
  eq(ht.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(1000) }]);
  // Ett nytt år: årsavgiften dras av igen.
  reg = K.sattTermin(reg, 'VT-31', { barn: kr(1000) });
  const vt31 = K.avgiftsforslag(reg, { datum: '2031-02-01', belopp: kr(1000), nyckel: '+46701112233' });
  eq(vt31.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(600) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) }]);
});

test('årsavgiften ingår: två barn på samma betalning, och funktionär utan terminsavgift', () => {
  let reg = registret();
  reg.arsavgift = Object.assign({}, reg.arsavgift, { ingar: true });
  reg = K.kopplaBetalare(reg, { nyckel: '+46701111111' }, ['m1', 'm2']);
  const f = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(2000), nyckel: '+46701111111' });
  assert.equal(f.stammer, true);
  eq(f.poster, [{ medlem: 'm1', typ: 'termin', belopp: kr(600) }, { medlem: 'm1', typ: 'arsavgift', belopp: kr(400) },
    { medlem: 'm2', typ: 'termin', belopp: kr(600) }, { medlem: 'm2', typ: 'arsavgift', belopp: kr(400) }]);
  reg = K.kopplaBetalare(reg, { nyckel: '+46703333333' }, ['m4']);
  const t = K.avgiftsforslag(reg, { datum: '2030-02-01', belopp: kr(40), nyckel: '+46703333333' });
  eq(t.poster, [{ medlem: 'm4', typ: 'arsavgift', belopp: kr(40) }], 'utan terminsavgift läggs årsavgiften till som vanligt');
});
