import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

test('månader läggs till och dras ifrån', () => {
  assert.equal(K.laggTillManader('2031-03-31', -1), '2031-02-28');
  assert.equal(K.laggTillManader('2031-01-15', -1), '2030-12-15');
  assert.equal(K.laggTillManader('2031-11-30', 3), '2032-02-29');
});

test('tidslinjen före och efter årsmötet', () => {
  const t = K.arsmotesTidslinje('2031-03-29');
  eq(t.map((x) => x.datum), ['2031-02-28', '2031-03-01', '2031-03-15', '2031-03-15', '2031-03-22', '2031-03-29', '2031-05-10']);
  assert.ok(t.find((x) => x.mote));
  assert.match(t.at(-1).text, /Stockholms stad/);
  assert.equal(K.senastApril('2031-04-30'), true);
  assert.equal(K.senastApril('2031-05-02'), false);
  eq(K.arsmotesTidslinje(''), []);
  assert.equal(K.DAGORDNING.length, 13);
});

function registret() {
  let reg = K.tomtRegister();
  for (const [namn, kategori] of [['Vuxen Betalt', 'vuxen'], ['Barn Betalt', 'barn'], ['Vuxen Obetalt', 'vuxen'], ['Vuxen Förra året', 'student'], ['Familj Termin', 'familj']]) reg = K.laggTillMedlem(reg, { namn, kategori }).reg;
  const b = (datum, poster) => { reg = K.registreraBetalning(reg, { datum, termin: K.terminForDatum(datum), belopp: poster.reduce((s, p) => s + p.belopp, 0), poster }); };
  b('2031-02-01', [{ medlem: 'm1', typ: 'arsavgift', belopp: kr(500) }, { medlem: 'm1', typ: 'termin', belopp: kr(2700) }]);
  b('2031-02-02', [{ medlem: 'm2', typ: 'arsavgift', belopp: kr(500) }, { medlem: 'm2', typ: 'termin', belopp: kr(1300) }]);
  b('2030-09-01', [{ medlem: 'm4', typ: 'arsavgift', belopp: kr(500) }]);
  b('2031-02-05', [{ medlem: 'm5', typ: 'termin', belopp: kr(3300) }]);
  return reg;
}

test('röstlängd: betald medlemsavgift och inte barn, med justering för hand', () => {
  const r = K.rostlangd(registret(), '2031-03-29');
  eq(r.filter((x) => x.rost).map((x) => x.namn), ['Vuxen Betalt', 'Vuxen Förra året']);
  eq(r.find((x) => x.namn === 'Barn Betalt').skal, 'barn (under 18)');
  eq(r.find((x) => x.namn === 'Vuxen Obetalt').skal, 'ingen medlemsavgift 2030 eller 2031');
  const andrad = K.rostlangd(registret(), '2031-03-29', null, { m2: true, m4: false });
  eq(andrad.filter((x) => x.rost).map((x) => x.namn), ['Barn Betalt', 'Vuxen Betalt']);
});

test('kontroll mot stadens villkor för året', () => {
  eq(K.stadensKontroll(registret(), '2031'), { antal: 3, barn: 1, utanArsavgift: ['Familj Termin'] });
  eq(K.stadensKontroll(registret(), '2030'), { antal: 1, barn: 0, utanArsavgift: [] });
});

test('röstlängd med åldersgränsen 12 enligt stadens villkor', () => {
  const r = K.rostlangd(registret(), '2031-03-29', null, {}, 12);
  assert.equal(r.find((x) => x.namn === 'Barn Betalt').skal, 'barn: kryssa i om hen fyller minst 12 i år');
  assert.equal(r.find((x) => x.namn === 'Barn Betalt').rost, false);
});

function aret() {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.laggTillKonto(ar, '3010', 'Medlemsavgifter');
  ar = K.laggTillKonto(ar, '3020', 'Terminsavgifter');
  ar = K.bokfor(ar, { datum: '2031-02-01', text: 'Avgifter', rader: [{ konto: '1930', belopp: kr(3200) }, { konto: '3010', belopp: kr(-500) }, { konto: '3020', belopp: kr(-2700) }] }).ar;
  ar = K.bokfor(ar, { datum: '2031-03-01', text: 'LOK-stöd RF', rader: [{ konto: '1930', belopp: kr(800) }, { konto: '3980', belopp: kr(-800) }] }).ar;
  ar = K.bokfor(ar, { datum: '2031-09-01', text: 'LOK-stöd RF', rader: [{ konto: '1930', belopp: kr(700) }, { konto: '3980', belopp: kr(-700) }] }).ar;
  ar = K.bokfor(ar, { datum: '2031-05-01', text: 'Stadsdelsbidrag', rader: [{ konto: '1930', belopp: kr(2000) }, { konto: '3980', belopp: kr(-2000) }] }).ar;
  ar = K.bokfor(ar, { datum: '2031-06-01', text: 'Lokalhyra', rader: [{ konto: '5010', belopp: kr(4000) }, { konto: '1930', belopp: kr(-4000) }] }).ar;
  return ar;
}

test('intäkter, kostnader och ekonomitext till verksamhetsberättelsen', () => {
  const ar = aret();
  eq(K.intakterKostnader(ar), { intakter: kr(6700), kostnader: kr(4000), resultat: kr(2700) });
  const t = K.ekonomitext(ar, { medlemsavgifter: kr(500), medlemmar: 12 });
  assert.match(t, /totala intäkter var 6.700,00 kr och de totala kostnaderna 4.000,00 kr/);
  assert.match(t, /ett överskott på 2.700,00 kr/);
  assert.match(t, /Behållningen .* 3.700,00 kr/);
  assert.match(t, /medlemsavgifter på 500,00 kr/);
  assert.match(t, /12 medlemmar/);
});

test('bidrag per bidragsgivare och medlemsavgifter skilda från andra avgifter', () => {
  const ar = aret();
  eq(K.bidragPerGivare(ar), [{ givare: 'LOK-stöd RF', belopp: kr(1500) }, { givare: 'Stadsdelsbidrag', belopp: kr(2000) }]);
  eq(K.medlemsavgifterForAr(ar, null, '3010'), { belopp: kr(500), kalla: 'konto', konto: '3010' });
  // Utan eget konto: från registret
  let reg = K.tomtRegister();
  reg = K.laggTillMedlem(reg, { namn: 'Påhittad', kategori: 'vuxen' }).reg;
  reg = K.registreraBetalning(reg, { datum: '2031-02-01', termin: 'VT-31', belopp: kr(900), poster: [{ medlem: 'm1', typ: 'arsavgift', belopp: kr(500) }, { medlem: 'm1', typ: 'termin', belopp: kr(400) }] });
  eq(K.medlemsavgifterForAr(K.skapaAr({ start: '2031-01-01' }), reg, '3010'), { belopp: kr(500), kalla: 'register' });
  assert.equal(K.medlemsavgifterForAr(K.skapaAr({ start: '2031-01-01' }), K.tomtRegister(), ''), null);
});

test('kontroll mot stadens krav från exporten ur RF:s medlemssystem', () => {
  const rubrik = ['Typ', 'Ålder', 'Förnamn', 'Alt. förnamn', 'Efternamn', 'IdrottsID', 'Födelsedat.', 'Folkbokföring - Gatuadress', 'Folkbokföring - Postnummer', 'Folkbokföring - Postort', 'Folkbokföring - Land', 'Folkbokföring - Kommunkod', 'Folkbokföring - Kommun'];
  const rad = (typ, fodd, kod, kommun, i) => [typ, '', 'Påhittad', '', 'Person' + i, '', fodd, 'Gata 1', '11111', 'Ort', 'Sverige', kod, kommun];
  const aktiva = [rubrik];
  for (let i = 0; i < 22; i++) aktiva.push(rad('Aktiv', '2015-05-0' + (i % 9 + 1), i < 15 ? '0180' : '0126', i < 15 ? 'Stockholm' : 'Huddinge', i));
  for (let i = 0; i < 5; i++) aktiva.push(rad('Aktiv', '1990-01-01', '0180', 'Stockholm', 100 + i));
  const bok = { flikar: { 'Aktiva medlemmar': aktiva, Stödmedlemmar: [rubrik, rad('Stöd', '1980-01-01', '0180', 'Stockholm', 200)] } };
  const k = K.rfMedlemskontroll(bok, '2031');
  eq([k.aktiva, k.stockholm, k.unga, k.ungaStockholm, k.subventionerad, k.nolltaxa], [27, 20, 22, 15, true, true]);
  eq(k.flikar, ['Aktiva medlemmar']);
  const lite = K.rfMedlemskontroll({ flikar: { Blad1: [rubrik, rad('Aktiv', '2010-01-01', '0126', 'Huddinge', 1)] } }, '2031');
  eq([lite.aktiva, lite.subventionerad, lite.nolltaxa], [1, false, false]);
});
