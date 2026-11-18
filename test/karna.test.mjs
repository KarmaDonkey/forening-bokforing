import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const kr = (n) => Math.round(n * 100);
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));

function bokforAlla(ar, lista) {
  for (const v of lista) ar = K.bokfor(ar, v).ar;
  return ar;
}

// Ett påhittat år: IB 10 000 på banken, avgifter, bidrag, hyra, resa.
function testar() {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(10000), '2067': kr(-10000) } });
  ar = bokforAlla(ar, [
    { datum: '2030-01-15', text: 'Medlemsavgifter januari', underlagKommentar: 'Swish', rader: [{ konto: '1930', belopp: kr(4000) }, { konto: '3100', belopp: kr(-4000) }] },
    { datum: '2030-02-01', text: 'Lokalhyra februari', underlag: ['faktura-1.pdf'], rader: [{ konto: '5010', belopp: kr(1200) }, { konto: '1930', belopp: kr(-1200) }] },
    { datum: '2030-03-10', text: 'Aktivitetsbidrag', underlag: ['bidrag.pdf'], rader: [{ konto: '1930', belopp: kr(2500.5) }, { konto: '3980', belopp: kr(-2500.5) }] },
    { datum: '2030-04-20', text: 'Tåg till workshop', underlag: ['biljett.pdf'], rader: [{ konto: '5800', belopp: kr(899) }, { konto: '1930', belopp: kr(-899) }] },
    { datum: '2030-12-31', text: 'Bankavgift', underlagKommentar: 'Bankutdrag', rader: [{ konto: '6570', belopp: kr(150) }, { konto: '1930', belopp: kr(-150) }] }
  ]);
  return ar;
}

describe('belopp', () => {
  test('tolkar svenska skrivsätt till ören', () => {
    assert.equal(K.parseBelopp('1 617,79'), 161779);
    assert.equal(K.parseBelopp('1617.79'), 161779);
    assert.equal(K.parseBelopp('-220'), -22000);
    assert.equal(K.parseBelopp('−220,5'), -22050);
    assert.equal(K.parseBelopp('1 200 kr'), 120000);
    assert.equal(K.parseBelopp('0,01'), 1);
  });
  test('avvisar ogiltiga belopp', () => {
    for (const s of ['', 'abc', '1,234', '1.2.3', '12,3a']) assert.throws(() => K.parseBelopp(s), /Ogiltigt belopp/);
  });
  test('formaterar ören som kronor', () => {
    assert.equal(K.formatBelopp(161779), '1 617,79');
    assert.equal(K.formatBelopp(-22000), '−220,00');
    assert.equal(K.formatBelopp(5), '0,05');
    assert.equal(K.formatBelopp(123456789), '1 234 567,89');
    assert.throws(() => K.formatBelopp(1.5));
  });
  test('summor blir exakta utan flyttalsfel', () => {
    const tio = Array.from({ length: 10 }, () => K.parseBelopp('0,10'));
    assert.equal(tio.reduce((a, b) => a + b, 0), 100);
  });
});

describe('datum', () => {
  test('känner igen giltiga datum', () => {
    assert.ok(K.arGiltigtDatum('2028-02-29'));
    assert.ok(!K.arGiltigtDatum('2029-02-29'));
    assert.ok(!K.arGiltigtDatum('2030-1-01'));
    assert.ok(!K.arGiltigtDatum(null));
  });
  test('räknar dagar och år', () => {
    assert.equal(K.laggTillDagar('2030-12-31', 1), '2031-01-01');
    assert.equal(K.laggTillAr('2028-02-29', 1), '2029-02-28');
  });
});

describe('räkenskapsår', () => {
  test('kalenderår är standard', () => {
    const ar = K.skapaAr({ start: '2030-01-01' });
    assert.equal(ar.slut, '2030-12-31');
    assert.equal(K.arNamn(ar), '2030');
    assert.ok(ar.kontoplan.some((k) => k.nr === '1930'));
  });
  test('brutet räkenskapsår', () => {
    const ar = K.skapaAr({ start: '2030-07-01' });
    assert.equal(ar.slut, '2031-06-30');
    assert.equal(K.arNamn(ar), '2030/31');
  });
  test('ingående balans måste gå ihop och bara gälla balanskonton', () => {
    assert.throws(() => K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': 100 } }), /går inte ihop/);
    assert.throws(() => K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': 100, '3100': -100 } }), /inget balanskonto/);
    assert.throws(() => K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1999': 100, '2067': -100 } }), /finns inte/);
  });
  test('för långt räkenskapsår avvisas', () => {
    assert.throws(() => K.skapaAr({ start: '2030-01-01', slut: '2031-12-31' }), /18 månader/);
  });
});

describe('verifikationer', () => {
  test('numreras i följd och ändrar inte det gamla året', () => {
    const ar0 = K.skapaAr({ start: '2030-01-01' });
    const r1 = K.bokfor(ar0, { datum: '2030-01-02', text: 'A', rader: [{ konto: '5010', belopp: 100 }, { konto: '1930', belopp: -100 }] });
    const r2 = K.bokfor(r1.ar, { datum: '2030-01-01', text: 'B', rader: [{ konto: '5010', belopp: 200 }, { konto: '1930', belopp: -200 }] });
    assert.equal(r1.verifikation.nr, 1);
    assert.equal(r2.verifikation.nr, 2);
    assert.equal(ar0.verifikationer.length, 0);
    assert.equal(r1.ar.verifikationer.length, 1);
  });
  test('obalanserad verifikation avvisas', () => {
    const ar = K.skapaAr({ start: '2030-01-01' });
    assert.throws(() => K.bokfor(ar, { datum: '2030-01-02', text: 'X', rader: [{ konto: '5010', belopp: 100 }, { konto: '1930', belopp: -99 }] }), /går inte ihop/);
  });
  test('validering hittar alla fel på en gång', () => {
    const ar = K.skapaAr({ start: '2030-01-01' });
    const fel = K.valideraVerifikation(ar, { datum: '2031-01-01', text: '', rader: [{ konto: '9999', belopp: 1.5 }] });
    assert.equal(fel.length, 5);
    assert.match(fel.join(' '), /utanför räkenskapsåret/);
    assert.match(fel.join(' '), /behöver en text/);
    assert.match(fel.join(' '), /minst två rader/);
    assert.match(fel.join(' '), /finns inte i kontoplanen/);
    assert.match(fel.join(' '), /heltal i ören/);
  });
  test('nollbelopp avvisas', () => {
    const ar = K.skapaAr({ start: '2030-01-01' });
    assert.throws(() => K.bokfor(ar, { datum: '2030-01-02', text: 'X', rader: [{ konto: '5010', belopp: 0 }, { konto: '1930', belopp: 0 }] }), /inte noll/);
  });
});

describe('rättelser och låsning', () => {
  test('rättelse bokför omvända belopp och nollställer effekten', () => {
    const ar = testar();
    const { ar: ar2, verifikation } = K.rattelse(ar, 2, { datum: '2030-05-01' });
    assert.equal(verifikation.nr, 6);
    assert.equal(verifikation.rattar, 2);
    eq(verifikation.rader, [{ konto: '5010', belopp: -120000 }, { konto: '1930', belopp: 120000 }]);
    assert.equal(K.saldon(ar2)['5010'], 0);
    assert.equal(K.rattadAv(ar2, 2).nr, 6);
  });
  test('samma verifikation kan inte rättas två gånger, och en rättelse kan inte rättas', () => {
    const ar = K.rattelse(testar(), 2, { datum: '2030-05-01' }).ar;
    assert.throws(() => K.rattelse(ar, 2, { datum: '2030-05-02' }), /redan rättad/);
    assert.throws(() => K.rattelse(ar, 6, { datum: '2030-05-02' }), /själv en rättelse/);
    assert.throws(() => K.rattelse(ar, 99, { datum: '2030-05-02' }), /finns inte/);
  });
  test('låst period tar inte emot nya verifikationer', () => {
    const ar = K.lasPeriod(testar(), '2030-06-30');
    assert.throws(() => K.bokfor(ar, { datum: '2030-06-30', text: 'Sen', rader: [{ konto: '5010', belopp: 1 }, { konto: '1930', belopp: -1 }] }), /låst/);
    assert.doesNotThrow(() => K.bokfor(ar, { datum: '2030-07-01', text: 'Ok', rader: [{ konto: '5010', belopp: 1 }, { konto: '1930', belopp: -1 }] }));
    assert.throws(() => K.lasPeriod(ar, '2030-03-31'), /redan låst/);
    assert.throws(() => K.lasPeriod(ar, '2031-01-01'), /inom räkenskapsåret/);
  });
});

describe('saldon och böcker', () => {
  test('saldon räknar in ingående balans', () => {
    const s = K.saldon(testar());
    assert.equal(s['1930'], kr(10000 + 4000 - 1200 + 2500.5 - 899 - 150));
    assert.equal(s['3100'], kr(-4000));
    assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 0);
  });
  test('saldon till och med ett datum', () => {
    assert.equal(K.saldon(testar(), { tom: '2030-02-28' })['1930'], kr(12800));
  });
  test('huvudbok ger löpande saldo i datumordning', () => {
    const hb = K.huvudbok(testar(), '1930');
    assert.equal(hb.ib, kr(10000));
    eq(hb.rader.map((r) => r.saldo), [kr(14000), kr(12800), kr(15300.5), kr(14401.5), kr(14251.5)]);
    assert.equal(hb.ub, kr(14251.5));
  });
  test('grundbok sorteras på datum och sedan nummer', () => {
    let ar = testar();
    ar = K.bokfor(ar, { datum: '2030-01-15', text: 'Samma dag', rader: [{ konto: '5010', belopp: 1 }, { konto: '1930', belopp: -1 }] }).ar;
    eq(K.grundbok(ar).map((v) => v.nr), [1, 6, 2, 3, 4, 5]);
  });
  test('saldobalans summerar till noll', () => {
    const sb = K.saldobalans(testar());
    assert.equal(sb.reduce((a, r) => a + r.ub, 0), 0);
    eq(sb.map((r) => r.nr), ['1930', '2067', '3100', '3980', '5010', '5800', '6570']);
  });
});

describe('rapporter', () => {
  test('resultaträkning grupperar och visar intäkter som plus', () => {
    const rr = K.resultatrakning(testar());
    eq(rr.grupper.map((g) => [g.namn, g.summa]), [
      ['Verksamhetens intäkter', kr(6500.5)],
      ['Övriga externa kostnader', kr(-2249)]
    ]);
    assert.equal(rr.aretsResultat, kr(4251.5));
  });
  test('balansräkning går ihop och visar obokfört resultat i eget kapital', () => {
    const br = K.balansrakning(testar());
    assert.ok(br.balanserar);
    assert.equal(br.tillgangar.summa, kr(14251.5));
    assert.equal(br.tillgangar.ingaende, kr(10000));
    const ek = br.egetKapitalOchSkulder.grupper.find((g) => g.namn === 'Eget kapital');
    eq(ek.konton.map((r) => [r.nr, r.belopp]), [['2067', kr(10000)], ['', kr(4251.5)]]);
  });
  test('när resultatet bokförts mot 2069 finns ingen extra rad', () => {
    const ar = K.bokfor(testar(), { datum: '2030-12-31', text: 'Årets resultat', underlagKommentar: 'Bokslut', rader: [{ konto: '8999', belopp: kr(4251.5) }, { konto: '2069', belopp: kr(-4251.5) }] }).ar;
    const br = K.balansrakning(ar);
    assert.ok(br.balanserar);
    const ek = br.egetKapitalOchSkulder.grupper.find((g) => g.namn === 'Eget kapital');
    eq(ek.konton.map((r) => [r.nr, r.belopp]), [['2067', kr(10000)], ['2069', kr(4251.5)]]);
    assert.equal(K.resultatrakning(ar).aretsResultat, kr(4251.5));
  });
  test('resultaträkning med jämförelse mot föregående år', () => {
    const ar1 = testar();
    let ar2 = K.nastaAr(ar1);
    ar2 = K.bokfor(ar2, { datum: '2031-02-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(1500) }, { konto: '1930', belopp: kr(-1500) }] }).ar;
    const rr = K.resultatrakning(ar2, { foregaende: ar1 });
    const extern = rr.grupper.find((g) => g.namn === 'Övriga externa kostnader');
    eq(extern.konton.find((r) => r.nr === '5010'), { nr: '5010', namn: 'Lokalhyra', belopp: kr(-1500), jamforelse: kr(-1200) });
    assert.equal(rr.jamforelseResultat, kr(4251.5));
    const intakter = rr.grupper.find((g) => g.namn === 'Verksamhetens intäkter');
    assert.equal(intakter.summa, 0);
    assert.equal(intakter.jamforelse, kr(6500.5));
  });
});

describe('årsskifte', () => {
  test('nästa år får utgående balanser och resultatet på 2069', () => {
    const nytt = K.nastaAr(testar());
    assert.equal(nytt.start, '2031-01-01');
    assert.equal(nytt.slut, '2031-12-31');
    eq(nytt.ingaendeBalans, { '1930': kr(14251.5), '2067': kr(-10000), '2069': kr(-4251.5) });
    assert.equal(nytt.verifikationer.length, 0);
  });
  test('ger samma ingående balans om resultatet redan bokförts', () => {
    const ar = K.bokfor(testar(), { datum: '2030-12-31', text: 'Årets resultat', rader: [{ konto: '8999', belopp: kr(4251.5) }, { konto: '2069', belopp: kr(-4251.5) }] }).ar;
    eq(K.nastaAr(ar).ingaendeBalans, K.nastaAr(testar()).ingaendeBalans);
  });
  test('brutet år följs av ett lika långt år', () => {
    const nytt = K.nastaAr(K.skapaAr({ start: '2030-07-01' }));
    assert.equal(nytt.start, '2031-07-01');
    assert.equal(nytt.slut, '2032-06-30');
  });
  test('kontoplanen följer med', () => {
    const ar = K.laggTillKonto(testar(), '3010', 'Träningsavgifter');
    assert.ok(K.nastaAr(ar).kontoplan.some((k) => k.nr === '3010'));
  });
});

describe('kontoplan', () => {
  test('lägga till, byta namn och ta bort', () => {
    let ar = K.skapaAr({ start: '2030-01-01' });
    ar = K.laggTillKonto(ar, '3010', 'Träningsavgifter');
    assert.equal(K.kontonamn(ar, '3010'), 'Träningsavgifter');
    ar = K.bytNamnPaKonto(ar, '3010', 'Terminsavgifter');
    assert.equal(K.kontonamn(ar, '3010'), 'Terminsavgifter');
    const i = ar.kontoplan.findIndex((k) => k.nr === '3010');
    assert.ok(ar.kontoplan[i - 1].nr < '3010' && ar.kontoplan[i + 1].nr > '3010');
    ar = K.taBortKonto(ar, '3010');
    assert.equal(K.kontonamn(ar, '3010'), '(okänt konto)');
  });
  test('ogiltiga och använda konton', () => {
    const ar = testar();
    assert.throws(() => K.laggTillKonto(ar, '930', 'X'), /fyra siffror/);
    assert.throws(() => K.laggTillKonto(ar, '9000', 'X'), /fyra siffror/);
    assert.throws(() => K.laggTillKonto(ar, '1930', 'X'), /finns redan/);
    assert.throws(() => K.taBortKonto(ar, '5010'), /används/);
    assert.throws(() => K.taBortKonto(ar, '2067'), /används/);
  });
});

describe('kontroller', () => {
  test('hittar verifikationer utan underlag', () => {
    const ar = K.bokfor(testar(), { datum: '2030-06-01', text: 'Okänt utlägg', rader: [{ konto: '6990', belopp: 100 }, { konto: '1930', belopp: -100 }] }).ar;
    eq(K.kontroller(ar).map((w) => [w.typ, w.nr]), [['saknarUnderlag', 6]]);
  });
  test('rättade verifikationer ger ingen varning', () => {
    let ar = K.bokfor(testar(), { datum: '2030-06-01', text: 'Fel', rader: [{ konto: '6990', belopp: 100 }, { konto: '1930', belopp: -100 }] }).ar;
    ar = K.rattelse(ar, 6, { datum: '2030-06-02' }).ar;
    eq(K.kontroller(ar), []);
  });
  test('hittar möjlig dubbelbetalning inom en vecka', () => {
    let ar = testar();
    ar = K.bokfor(ar, { datum: '2030-11-13', text: 'Hyra hall', underlag: ['a.pdf'], rader: [{ konto: '5010', belopp: 22000 }, { konto: '1930', belopp: -22000 }] }).ar;
    ar = K.bokfor(ar, { datum: '2030-11-13', text: 'Hyra skola', underlag: ['b.pdf'], rader: [{ konto: '5010', belopp: 22000 }, { konto: '1930', belopp: -22000 }] }).ar;
    ar = K.bokfor(ar, { datum: '2030-11-30', text: 'Hyra igen', underlag: ['c.pdf'], rader: [{ konto: '5010', belopp: 22000 }, { konto: '1930', belopp: -22000 }] }).ar;
    eq(K.kontroller(ar).map((w) => [w.typ, w.nr2, w.nr]), [['mojligDubbelbetalning', 6, 7]]);
  });
  test('valideraAr godkänner ett korrekt år och hittar manipulerade', () => {
    const ar = testar();
    eq(K.valideraAr(JSON.parse(JSON.stringify(ar))), []);
    const trasig = JSON.parse(JSON.stringify(ar));
    trasig.verifikationer[1].rader[0].belopp += 1;
    trasig.verifikationer[2].nr = 1;
    const fel = K.valideraAr(trasig);
    assert.equal(fel.length, 2);
    assert.match(fel.join(' '), /flera gånger/);
    assert.match(fel.join(' '), /Verifikation 2: Debet och kredit/);
  });
  test('valideraAr godkänner verifikationer i en senare låst period', () => {
    eq(K.valideraAr(K.lasPeriod(testar(), '2030-12-31')), []);
  });
});

describe('SIE 4', () => {
  const ar = testar();
  const sie = K.sieExport(ar, { forening: { namn: 'Påhittade föreningen', orgnr: '000000-0000' }, genererad: '2031-01-15' });
  const rader = sie.split('\r\n');
  test('har rätt huvud', () => {
    assert.equal(rader[0], '#FLAGGA 0');
    assert.ok(rader.includes('#SIETYP 4'));
    assert.ok(rader.includes('#FORMAT PC8'));
    assert.ok(rader.includes('#GEN 20310115'));
    assert.ok(rader.includes('#RAR 0 20300101 20301231'));
    assert.ok(rader.includes('#FNAMN "Påhittade föreningen"'));
  });
  test('har balanser, resultat och verifikationer', () => {
    assert.ok(rader.includes('#IB 0 1930 10000.00'));
    assert.ok(rader.includes('#UB 0 1930 14251.50'));
    assert.ok(rader.includes('#RES 0 3980 -2500.50'));
    const i = rader.indexOf('#VER "A" 3 20300310 "Aktivitetsbidrag"');
    assert.ok(i > 0);
    eq(rader.slice(i + 1, i + 5), ['{', '#TRANS 1930 {} 2500.50', '#TRANS 3980 {} -2500.50', '}']);
  });
  test('citattecken skyddas', () => {
    const a = K.bokfor(K.skapaAr({ start: '2030-01-01' }), { datum: '2030-01-01', text: 'Kurs "Bas"', rader: [{ konto: '7610', belopp: 1 }, { konto: '1930', belopp: -1 }] }).ar;
    assert.ok(K.sieExport(a).includes('#VER "A" 1 20300101 "Kurs \\"Bas\\""'));
  });
  test('kodas i CP437', () => {
    eq(Array.from(K.tillCp437('åäöÅÄÖ a€')), [0x86, 0x84, 0x94, 0x8F, 0x8E, 0x99, 0x20, 0x61, 0x3F]);
  });
});
