import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// En påhittad årsarbetsbok med samma flikar och kolumner som föreningens Excel. Alla namn och nummer är påhittade.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

function arbetsbok() {
  const tom = (n) => Array.from({ length: n }, () => []);
  return {
    flikar: {
      Kontoplan_lookup: [[], [], [null, null, '1 TILLGÅNGAR', '1 TILLGÅNGAR'],
        [null, null, 'Tillgångar', 1930, 'Företagskonto', 'BR'], [null, null, 'Eget kapital', 2010, 'Eget kapital', 'BR'],
        [null, null, 'Intäkter', 3000, 'Träningsavgifter', 'RR'], [null, null, 'Kostnader', 5010, 'Lokalhyra', 'RR']],
      Grundbok: tom(6).concat([
        [null, null, 'Verifikationsnummer', 'Registreringsdatum', 'KontoTrans#', 'Beskrivning', 'Debet Konto', 'Debet Konto-nr', 'Debet belopp', 'Kredit Konto', 'Kredit Konto-nr', 'Kredit Belopp'],
        [null, null, 1, '2030-02-01', 11, 'Terminsavgift VT2030 - PÅHITTAD, ETT', 'Företagskonto', 1930, 1300, 'Träningsavgifter', 3000, 1300],
        [null, null, 2, '2030-03-05', 12, 'Lokalhyra mars', 'Lokalhyra', 5010, 800.5, 'Företagskonto', 1930, 800.5],
        [null, null, 3, '2030-04-01', 13, 'Delad', 'Lokalhyra', 5010, 100, null, null, null],
        [null, null, 3, null, 13, null, null, null, null, 'Företagskonto', 1930, 90],
        [null, null, 4, null, 14, 'Utan datum', 'Okänt', 4999, 10, 'Företagskonto', 1930, 10]
      ]),
      IngåendeBalanser: tom(6).concat([
        [null, null, 'Verifikationsnummer', 'Registreringsdatum', 'KontoTrans#', 'Beskrivning', 'Konto', 'Konto-nr', 'Amount', 'Type'],
        [null, null, 0, '2030-01-01', null, 'IB', 'Företagskonto', '1930', 5000, 'Debet'],
        [null, null, 0, '2030-01-01', null, 'IB', 'Eget kapital', '2010', 5000, 'Kredit']
      ]),
      Swish: [[], [], [], [null, null, null, null, null, null, null, null, 'Swish', 'Namn'],
        [null, null, null, null, null, null, null, null, 'Swish +46701112233', 'PÅHITTAD, ETT'],
        [null, null, null, null, null, null, null, null, 'Swish +46702223344', 'Förälder Exempel']],
      Bankkonto: tom(6).concat([
        [null, null, 'KontoTrans#', 'Bokf dag', 'Transdag', 'Valutadag', 'Transaktionstyp', 'Referens', 'Belopp', 'Saldo', 'Kommentar', 'Motpart'],
        [null, null, 11, '2030-02-01', '2030-02-01', '2030-02-01', 'Swish +46701112233', '1230000000', 1300, 6300, 'Terminsavgift VT2030 - PÅHITTAD, ETT', 'PÅHITTAD, ETT'],
        [null, null, 12, '2030-03-05', null, null, 'Pg-bet. via internet', 'X', -800.5, 5499.5, 'Lokalhyra mars', 'Staden'],
        [null, null, 15, '2030-08-20', null, null, 'Swish +46702223344', '1230000000', 1300, 6799.5, 'Terminsavgift HT30 - Ett Påhittad', 'Förälder Exempel'],
        [null, null, 16, '2030-09-01', null, null, 'Bankgiro inbetalning', '5550001', 2000, 8799.5, 'Terminsavgift HT2030 - Vuxen Exempel', 'Vuxen Exempel'],
        [null, null, 17, '2030-10-01', null, null, 'Pg-bet. via internet', 'Y', -500, 8299.5, 'Medlemsavg B&K', 'Förbundet']
      ])
    }
  };
}

test('namn jämförs oberoende av ordning och versaler', () => {
  assert.equal(K.namnNyckel('PÅHITTAD, ETT'), K.namnNyckel('Ett Påhittad'));
  assert.equal(K.visningsnamn('PÅHITTAD, ETT'), 'Ett Påhittad');
  assert.equal(K.visningsnamn('Anna-Lena Exempel'), 'Anna-Lena Exempel');
  assert.equal(K.terminIText(' VT2026 - x'), 'VT-26');
  assert.equal(K.terminIText(' HT22 - x'), 'HT-22');
  assert.equal(K.avgiftstextUtanNamn('Terminsavgift VT2026 - PÅHITTAD, ETT'), 'Terminsavgift VT2026');
  assert.equal(K.avgiftstextUtanNamn('Terminsavg HT 20 PÅHITTAD ETT'), 'Terminsavg HT 20');
  assert.equal(K.avgiftstextUtanNamn('Lokalhyra mars'), 'Lokalhyra mars');
});

test('arbetsboken tolkas: kontoplan, ingående balans, verifikationer och avvikelser', () => {
  const t = K.tolkaArsbok(arbetsbok(), '2030_Bokföring.xlsm');
  assert.equal(t.ar, '2030');
  eq(t.saknas, []);
  eq(t.ingaendeBalans, { 1930: kr(5000), 2010: kr(-5000) });
  eq(t.verifikationer.map((v) => [v.nr, v.datum, v.text, v.rader]), [
    [1, '2030-02-01', 'Terminsavgift VT2030', [{ konto: '1930', belopp: kr(1300) }, { konto: '3000', belopp: kr(-1300) }]],
    [2, '2030-03-05', 'Lokalhyra mars', [{ konto: '5010', belopp: kr(800.5) }, { konto: '1930', belopp: kr(-800.5) }]],
    [3, '2030-04-01', 'Delad', [{ konto: '5010', belopp: kr(100) }, { konto: '1930', belopp: kr(-90) }]],
    [4, '2030-12-31', 'Utan datum', [{ konto: '4999', belopp: kr(10) }, { konto: '1930', belopp: kr(-10) }]]
  ]);
  assert.ok(t.avvikelser.some((a) => /Verifikation 3 går inte ihop/.test(a)));
  assert.ok(t.avvikelser.some((a) => /Verifikation 4 saknar datum/.test(a)));
  eq(t.kontoplan.map((k) => k.nr + ' ' + k.namn), ['1930 Företagskonto', '2010 Eget kapital', '3000 Träningsavgifter', '4999 Okänt', '5010 Lokalhyra']);
  assert.ok(!/PÅHITTAD/.test(JSON.stringify(t.verifikationer)), 'inga namn i verifikationerna');
});

test('avgifterna och Swish-listan i arbetsboken', () => {
  const t = K.tolkaArsbok(arbetsbok(), 'x.xlsm');
  eq(t.swish, [{ nyckel: '+46701112233', namn: 'PÅHITTAD, ETT' }, { nyckel: '+46702223344', namn: 'Förälder Exempel' }]);
  eq(t.avgifter.map((a) => [a.datum, a.belopp, a.termin, a.typ, a.namn, a.nyckel, a.kalla]), [
    ['2030-02-01', kr(1300), 'VT-30', 'termin', 'PÅHITTAD, ETT', '+46701112233', 'excel:2030:11'],
    ['2030-08-20', kr(1300), 'HT-30', 'termin', 'Ett Påhittad', '+46702223344', 'excel:2030:15'],
    ['2030-09-01', kr(2000), 'HT-30', 'termin', 'Vuxen Exempel', 'ref:5550001', 'excel:2030:16']
  ]);
});

test('grovkopian är ett låst år som får avvika', () => {
  const t = K.tolkaArsbok(arbetsbok(), '2030.xlsm');
  const ar = K.grovkopiaAr(t, { inlast: '2031-01-05' });
  eq(K.valideraAr(ar), []);
  assert.equal(ar.lastTom, '2030-12-31');
  assert.equal(ar.grovkopia.fil, '2030.xlsm');
  assert.throws(() => K.lasUpp(ar), /grovkopia/);
  assert.throws(() => K.bokfor(ar, { datum: '2030-05-01', text: 'x', rader: [{ konto: '1930', belopp: 100 }, { konto: '3000', belopp: -100 }] }), /låst/);
  const rr = K.resultatrakning(ar);
  assert.ok(rr.grupper.length > 0);
  const nasta = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(5399.5), 2067: kr(-5399.5) } });
  eq(K.ubMotIb(ar, nasta).map((x) => x.konto), ['2010', '2067']);
});

test('historiken läses in i medlemsregistret, en gång', () => {
  let reg = K.tomtRegister();
  reg = K.sattTermin(reg, 'VT-30', { barn: kr(1300), vuxen: kr(2000) });
  const t = K.tolkaArsbok(arbetsbok(), 'x.xlsm');
  const f = K.historikForslag(reg, t);
  eq(f.nyaMedlemmar.map((n) => [n.namn, n.antal, n.kategori]), [['Ett Påhittad', 2, 'barn'], ['Vuxen Exempel', 1, 'vuxen']]);
  assert.equal(f.nyaBetalare, 2);
  const res = K.lasInHistorik(reg, t, {});
  reg = res.reg;
  eq(res.antal, { betalningar: 3, medlemmar: 2, betalare: 3, redan: 0 });
  eq(reg.medlemmar.map((m) => [m.namn, m.kategori, m.tillagd]), [['Ett Påhittad', 'barn', '2030-01-01'], ['Vuxen Exempel', 'vuxen', '2030-01-01']]);
  eq(reg.betalare.map((b) => [b.nyckel, b.medlemmar, b.namn]), [['+46701112233', ['m1'], 'Ett Påhittad'], ['+46702223344', ['m1'], 'Förälder Exempel'], ['ref:5550001', ['m2'], '']]);
  const s = K.terminsstatistik(reg, 'HT-30');
  assert.equal(s.totalt.antal, 2);
  // Inläst igen: inget dubbelt.
  const igen = K.lasInHistorik(reg, t, {});
  eq(igen.antal, { betalningar: 0, medlemmar: 0, betalare: 0, redan: 3 });
  // Historiken räknas som medlemskap det året vid avförande.
  eq(K.attAvfora(reg, '2032-01-10').map((x) => x.namn), []);
  eq(K.attAvfora(reg, '2033-01-10').map((x) => x.namn).sort(), ['Ett Påhittad', 'Vuxen Exempel']);
});

test('arbetsbok utan de flikar som behövs', () => {
  const t = K.tolkaArsbok({ flikar: { Blad1: [['x']] } }, '2019.xlsx');
  eq(t.saknas, ['Kontoplan_lookup', 'Grundbok', 'IngåendeBalanser', 'Bankkonto']);
  assert.equal(t.ar, '2019');
});
