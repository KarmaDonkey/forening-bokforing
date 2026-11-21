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
