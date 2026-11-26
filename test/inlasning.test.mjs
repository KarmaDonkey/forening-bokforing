import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

// Format som liknar en svensk banks CSV-export: förrad, rubriker, nyast först.
const BANKFIL = [
  '* Transaktioner Period 2030-01-01 - 2030-03-31 Skapad 2030-04-01',
  'Radnummer,Clearingnummer,Kontonummer,Produkt,Valuta,Bokföringsdag,Transaktionsdag,Valutadag,Referens,Beskrivning,Belopp,Bokfört saldo',
  '5,1234,1111111,Företagskonto,SEK,2030-03-02,2030-03-02,2030-03-02,"","Pris kontopaket",-150.00,13550.00',
  '4,1234,1111111,Företagskonto,SEK,2030-02-28,2030-02-28,2030-02-28,"1321890030065563","STOCKHOLMS STAD",-1200.00,13700.00',
  '3,1234,1111111,Företagskonto,SEK,2030-02-10,2030-02-10,2030-02-10,"","Swish från 46701234567 ANNA",500.00,14900.00',
  '2,1234,1111111,Företagskonto,SEK,2030-01-20,2030-01-20,2030-01-20,"","Swish från 46709876543 BERTIL",500.00,14400.00',
  '1,1234,1111111,Företagskonto,SEK,2030-01-05,2030-01-05,2030-01-05,"","Utlägg resa och material",-1100.00,13900.00'
].join('\r\n');

function ar2030() {
  return K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(15000), '2067': kr(-15000) } });
}

describe('tolka bankfiler', () => {
  test('banksformat med förrad och rubriker, nyast först', () => {
    const { rader, varningar } = K.parseBankfil(BANKFIL);
    eq(varningar, []);
    eq(rader.map((r) => [r.datum, r.text, r.referens, r.belopp, r.saldo]), [
      ['2030-01-05', 'Utlägg resa och material', '', kr(-1100), kr(13900)],
      ['2030-01-20', 'Swish från 46709876543 BERTIL', '', kr(500), kr(14400)],
      ['2030-02-10', 'Swish från 46701234567 ANNA', '', kr(500), kr(14900)],
      ['2030-02-28', 'STOCKHOLMS STAD', '1321890030065563', kr(-1200), kr(13700)],
      ['2030-03-02', 'Pris kontopaket', '', kr(-150), kr(13550)]
    ]);
  });
  test('semikolon, svenska decimaler och tusentalsavgränsare', () => {
    const txt = 'Datum;Text;Belopp;Saldo\n2030-01-02;Hyra;-1 200,50;8 799,50\n2030-01-03;Bidrag;"2.500,00";11 299,50\n';
    eq(K.parseBankfil(txt).rader.map((r) => [r.belopp, r.saldo]), [[kr(-1200.5), kr(8799.5)], [kr(2500), kr(11299.5)]]);
  });
  test('inklistrade rader från Excel utan rubriker', () => {
    const txt = '2030-01-02\tSwish Anna\t500,00\t10 500,00\n2030-01-05\tHyra\t-1 000,00\t9 500,00';
    const { rader, varningar } = K.parseBankfil(txt);
    eq(varningar, []);
    eq(rader.map((r) => [r.datum, r.text, r.belopp, r.saldo]), [
      ['2030-01-02', 'Swish Anna', kr(500), kr(10500)],
      ['2030-01-05', 'Hyra', kr(-1000), kr(9500)]
    ]);
  });
  test('separata kolumner för insättning och uttag', () => {
    const txt = 'Bokföringsdatum;Text;Insättning;Uttag;Saldo\n2030-01-02;Swish;500,00;;500,00\n2030-01-03;Hyra;;1 000,00;-500,00\n';
    eq(K.parseBankfil(txt).rader.map((r) => r.belopp), [kr(500), kr(-1000)]);
  });
  test('varnar när saldot inte går ihop och för rader som inte kan tolkas', () => {
    const txt = 'Datum;Text;Belopp;Saldo\n2030-01-02;A;-100,00;900,00\n2030-01-03;B;-100,00;850,00\nhej;;;\n';
    const { rader, varningar } = K.parseBankfil(txt);
    assert.equal(rader.length, 2);
    assert.equal(varningar.length, 2);
    assert.match(varningar.join(' '), /kunde inte tolkas/);
    assert.match(varningar.join(' '), /Saldot stämmer inte 2030-01-03/);
  });
  test('datum och belopp i olika format', () => {
    assert.equal(K.tolkaDatum('20300102'), '2030-01-02');
    assert.equal(K.tolkaDatum('30-01-02'), '2030-01-02');
    assert.equal(K.tolkaDatum('2030-01-02 12:00'), '2030-01-02');
    assert.equal(K.tolkaDatum('2030-02-30'), null);
    assert.equal(K.tolkaBankbelopp('1,200.50'), kr(1200.5));
    assert.equal(K.tolkaBankbelopp('-50 kr'), kr(-50));
    assert.equal(K.tolkaBankbelopp('abc'), null);
  });
});

describe('importera bankrader', () => {
  test('lägger till rader, hoppar över dubbletter och rader utanför året', () => {
    const { rader } = K.parseBankfil(BANKFIL);
    const andraAr = { datum: '2031-01-02', text: 'Nästa år', referens: '', belopp: 100, saldo: null };
    let r = K.importeraBankrader(ar2030(), rader.concat([andraAr]));
    assert.equal(r.nya, 5);
    assert.equal(r.utanfor, 1);
    const igen = K.importeraBankrader(r.ar, rader);
    assert.equal(igen.nya, 0);
    assert.equal(igen.dubbletter, 5);
    assert.equal(igen.ar.bankrader.length, 5);
  });
  test('två likadana rader utan saldo samma dag räknas som två', () => {
    const rad = { datum: '2030-01-02', text: 'Swish', referens: '', belopp: 500, saldo: null };
    const r = K.importeraBankrader(ar2030(), [rad, rad]);
    assert.equal(r.nya, 2);
    assert.equal(K.importeraBankrader(r.ar, [rad, rad]).nya, 0);
    assert.equal(K.importeraBankrader(r.ar, [rad, rad, rad]).nya, 1);
  });
  test('okänt bankkonto avvisas', () => {
    assert.throws(() => K.importeraBankrader(ar2030(), [], { konto: '1999' }), /finns inte/);
  });
});

describe('regler', () => {
  test('lär sig och hittar konto på text och riktning', () => {
    let regler = K.larRegel([], 'Swish från 46709876543 BERTIL', 500, '3100');
    regler = K.larRegel(regler, 'Pris kontopaket', -150, '6570');
    eq(regler, [{ monster: 'swish från bertil', riktning: 'in', konto: '3100' }, { monster: 'pris kontopaket', riktning: 'ut', konto: '6570' }]);
    assert.equal(K.hittaRegel(regler, 'Swish från 46700000000 BERTIL', 300).konto, '3100');
    assert.equal(K.hittaRegel(regler, 'Swish från 46700000000 BERTIL', -300), null);
    assert.equal(K.hittaRegel(regler, 'Pris kontopaket 2030', -150).konto, '6570');
  });
  test('längsta mönstret vinner och en ny kontering skriver över', () => {
    // "Swish" ensamt är för allmänt för en regel (från 1.56); "Swish Anna" lärs in.
    let regler = K.larRegel([], 'Swish', 500, '3990');
    assert.equal(regler.length, 0);
    regler = K.larRegel(regler, 'Swish Anna', 500, '3100');
    assert.equal(K.hittaRegel(regler, 'SWISH ANNA 123', 500).konto, '3100');
    assert.equal(K.hittaRegel(regler, 'Swish Cecilia', 500), null);
    regler = K.larRegel(regler, 'Swish Anna', 500, '3980');
    assert.equal(regler.length, 1);
    assert.equal(K.hittaRegel(regler, 'Swish Anna', 500).konto, '3980');
  });
  test('hela ord krävs', () => {
    const regler = K.larRegel([], 'hyra', -1, '5010');
    assert.equal(K.hittaRegel(regler, 'lokalhyra', -1), null);
  });
});

describe('underlag och matchning', () => {
  const faktura = { id: 'f1', filnamn: 'faktura.pdf', dokumenttyp: 'faktura', motpart: 'Stockholms stad', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1200), riktning: 'utgift', beskrivning: 'Lokalhyra februari', ocr: '1321890030065563', foreslagetKonto: '5010' };
  const kvitto1 = { id: 'k1', filnamn: 'kvitto-tag.jpg', dokumenttyp: 'kvitto', motpart: 'Tågbolaget', datum: '2029-12-28', belopp: kr(800), riktning: 'utgift', beskrivning: 'Tåg till workshop', foreslagetKonto: '5800' };
  const kvitto2 = { id: 'k2', filnamn: 'kvitto-material.jpg', dokumenttyp: 'kvitto', motpart: 'Byggvaruhuset', datum: '2029-12-30', belopp: kr(300), riktning: 'utgift', beskrivning: 'Material', foreslagetKonto: '5400' };
  const annanFaktura = { id: 'f2', filnamn: 'annan.pdf', dokumenttyp: 'faktura', motpart: 'Stockholms stad', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1200), riktning: 'utgift', beskrivning: 'Hyra annan hall', ocr: '999', foreslagetKonto: '5010' };

  function medData() {
    let ar = K.importeraBankrader(ar2030(), K.parseBankfil(BANKFIL).rader).ar;
    for (const u of [faktura, kvitto1, kvitto2, annanFaktura]) ar = K.laggTillUnderlag(ar, u);
    return ar;
  }
  const rad = (ar, text) => ar.bankrader.find((r) => r.text.startsWith(text));

  test('exakt belopp, och OCR i banktexten avgör mellan två lika fakturor', () => {
    const ar = medData();
    eq(K.matchaUnderlag(ar, rad(ar, 'STOCKHOLMS')), ['f1']);
  });
  test('flera kvitton som tillsammans blir beloppet', () => {
    const ar = medData();
    eq(K.matchaUnderlag(ar, rad(ar, 'Utlägg')).sort(), ['k1', 'k2']);
  });
  test('ingen träff när beloppet inte går att förklara', () => {
    const ar = medData();
    eq(K.matchaUnderlag(ar, rad(ar, 'Pris')), []);
  });
  test('underlag utanför tidsfönstret matchas inte', () => {
    let ar = K.importeraBankrader(ar2030(), [{ datum: '2030-09-01', text: 'Hyra', referens: '', belopp: kr(-1200), saldo: null }]).ar;
    ar = K.laggTillUnderlag(ar, annanFaktura);
    eq(K.matchaUnderlag(ar, ar.bankrader[0]), []);
  });

  test('förslag från underlag med en rad per kostnadskonto', () => {
    const ar = medData();
    const f = K.forslagForBankrad(ar, rad(ar, 'Utlägg'), []);
    assert.equal(f.kalla, 'underlag');
    assert.ok(f.komplett);
    eq(f.rader[0], { konto: '1930', belopp: kr(-1100) });
    eq(f.rader.slice(1).sort((a, b) => a.konto.localeCompare(b.konto)), [{ konto: '5400', belopp: kr(300) }, { konto: '5800', belopp: kr(800) }]);
    const g = K.forslagForBankrad(ar, rad(ar, 'STOCKHOLMS'), []);
    assert.equal(g.text, 'Stockholms stad: Lokalhyra februari');
    eq(g.underlagIds, ['f1']);
  });
  test('förslag från regel, och tomt konto när inget är känt', () => {
    const ar = medData();
    const regler = K.larRegel([], 'Swish från ANNA', 500, '3100');
    const f = K.forslagForBankrad(ar, rad(ar, 'Swish från 46701234567 ANNA'), regler);
    assert.equal(f.kalla, 'regel');
    assert.equal(f.underlagKommentar, 'Bankutdrag');
    eq(f.rader, [{ konto: '1930', belopp: kr(500) }, { konto: '3100', belopp: kr(-500) }]);
    const g = K.forslagForBankrad(ar, rad(ar, 'Swish från 46709876543 BERTIL'), regler);
    assert.equal(g.kalla, null);
    assert.ok(!g.komplett);
  });
  test('valda underlag kan anges för hand', () => {
    const ar = medData();
    const f = K.forslagForBankrad(ar, rad(ar, 'STOCKHOLMS'), [], { underlagIds: ['f2'] });
    eq(f.underlagIds, ['f2']);
  });

  test('kopplad bokföring markerar bankrad och underlag och namnger filerna', () => {
    const ar = medData();
    const f = K.forslagForBankrad(ar, rad(ar, 'Utlägg'), []);
    const { ar: ny, verifikation } = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds });
    assert.equal(verifikation.nr, 1);
    eq([...verifikation.underlag].sort(), ['V001_kvitto-material.jpg', 'V001_kvitto-tag.jpg']);
    assert.equal(rad(ny, 'Utlägg').verifikation, 1);
    eq(K.oppnaUnderlag(ny).map((u) => u.id), ['f1', 'f2']);
    assert.equal(K.oppnaBankrader(ny).length, 4);
    assert.throws(() => K.bokforKopplat(ny, { datum: f.datum, text: 'x', rader: f.rader }, { bankradId: f.bankradId }), /redan bokförd/);
    assert.throws(() => K.bokforKopplat(ny, { datum: f.datum, text: 'x', rader: f.rader }, { underlagIds: ['k1'] }), /hör redan till/);
  });
  test('bankbeloppet måste stämma', () => {
    const ar = medData();
    const b = rad(ar, 'Pris');
    assert.throws(() => K.bokforKopplat(ar, { datum: b.datum, text: 'x', rader: [{ konto: '6570', belopp: 100 }, { konto: '1930', belopp: -100 }] }, { bankradId: b.id }), /stämma med banken/);
  });
  test('rättelse släpper bankrad och underlag så att de kan bokföras igen', () => {
    let ar = medData();
    const f = K.forslagForBankrad(ar, rad(ar, 'STOCKHOLMS'), []);
    ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
    ar = K.rattelse(ar, 1, { datum: '2030-03-05' }).ar;
    assert.equal(rad(ar, 'STOCKHOLMS').verifikation, null);
    assert.ok(K.oppnaUnderlag(ar).some((u) => u.id === 'f1'));
    assert.equal(ar.underlag.find((u) => u.id === 'f1').arkivnamn, undefined);
  });
  test('underlag kan tas bort bara om det inte är bokfört', () => {
    let ar = medData();
    ar = K.taBortUnderlag(ar, 'f2');
    assert.equal(ar.underlag.length, 3);
    const f = K.forslagForBankrad(ar, rad(ar, 'STOCKHOLMS'), []);
    ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
    assert.throws(() => K.taBortUnderlag(ar, 'f1'), /hör till verifikation 1/);
  });
  test('obetalda underlag följer med till nästa år', () => {
    const nytt = K.nastaAr(medData());
    eq(nytt.underlag.map((u) => u.id), ['f1', 'k1', 'k2', 'f2']);
    eq(nytt.bankrader, []);
  });
});

describe('bankavstämning', () => {
  test('stämmer när allt är bokfört', () => {
    let ar = K.importeraBankrader(ar2030(), K.parseBankfil(BANKFIL).rader).ar;
    const konton = { 'Utlägg': '6990', 'Swish från 46709876543': '3100', 'Swish från 46701234567': '3100', 'STOCKHOLMS': '5010', 'Pris': '6570' };
    for (const r of ar.bankrader) {
      const motkonto = Object.entries(konton).find(([t]) => r.text.startsWith(t))[1];
      ar = K.bokforKopplat(ar, { datum: r.datum, text: r.text, underlagKommentar: 'test', rader: [{ konto: '1930', belopp: r.belopp }, { konto: motkonto, belopp: -r.belopp }] }, { bankradId: r.id }).ar;
    }
    const a = K.bankavstamning(ar);
    eq(a, { konto: '1930', datum: '2030-03-02', bankSaldo: kr(13550), bokfortSaldo: kr(13550), skillnad: 0, ingaendeEnligtBank: kr(15000), ingaendeBokfort: kr(15000), obokforda: 0 });
    eq(K.kontroller(ar).filter((w) => w.typ !== 'saknarUnderlag'), []);
  });
  test('skillnad mot banken syns i kontrollerna', () => {
    let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { '1930': kr(100), '2067': kr(-100) } });
    ar = K.importeraBankrader(ar, [{ datum: '2030-01-02', text: 'Avgift', referens: '', belopp: kr(-10), saldo: kr(80) }]).ar;
    const r = ar.bankrader[0];
    ar = K.bokforKopplat(ar, { datum: r.datum, text: 'Avgift', underlagKommentar: 'test', rader: [{ konto: '1930', belopp: r.belopp }, { konto: '6570', belopp: -r.belopp }] }, { bankradId: r.id }).ar;
    assert.equal(K.bankavstamning(ar).skillnad, kr(10));
    assert.ok(K.kontroller(ar).some((w) => w.typ === 'bankdifferens'));
  });
  test('obokförda bankrader syns i kontrollerna och ingen avstämning utan saldon', () => {
    const ar = K.importeraBankrader(ar2030(), [{ datum: '2030-01-02', text: 'X', referens: '', belopp: 1, saldo: null }]).ar;
    assert.equal(K.bankavstamning(ar), null);
    assert.ok(K.kontroller(ar).some((w) => w.typ === 'obokfordaBankrader'));
  });
});

describe('tolkning med Claude', () => {
  const ar = ar2030();
  const bas = { dokumenttyp: 'faktura', motpart: 'Stockholms stad', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: '1200.00', valuta: 'SEK', belopp_sek: '', moms: '', fakturanummer: '8900300655', ocr: '1321 8900 3006 5563', beskrivning: 'Lokalhyra februari', riktning: 'utgift', foreslaget_konto: '5010', stalld_till_foreningen: 'ja', osakerhet: '', transaktioner: [] };

  test('faktura blir ett underlag i ören', () => {
    const n = K.normaliseraTolkning(bas, { id: 'u1', filnamn: 'f.pdf' });
    eq(n.varningar, []);
    assert.equal(n.bankrader, null);
    eq(n.underlag, { id: 'u1', filnamn: 'f.pdf', dokumenttyp: 'faktura', motpart: 'Stockholms stad', datum: '2030-02-01', forfallodatum: '2030-03-01', belopp: kr(1200), riktning: 'utgift', beskrivning: 'Lokalhyra februari', fakturanummer: '8900300655', ocr: '1321890030065563', foreslagetKonto: '5010', kontoKalla: 'claude' });
  });
  test('utländsk valuta använder SEK-beloppet eller varnar', () => {
    const eur = K.normaliseraTolkning({ ...bas, valuta: 'EUR', belopp: '135.50', belopp_sek: '' }, { id: 'u2', filnamn: 'flyg.pdf' });
    assert.equal(eur.underlag.belopp, 0);
    assert.equal(eur.underlag.originalbelopp, kr(135.5));
    assert.match(eur.varningar.join(' '), /EUR/);
    const sek = K.normaliseraTolkning({ ...bas, valuta: 'eur', belopp: '135.50', belopp_sek: '1510.00' }, { id: 'u3', filnamn: 'flyg.pdf' });
    assert.equal(sek.underlag.belopp, kr(1510));
    eq(sek.varningar, []);
  });
  test('osäkerhet och fel mottagare blir varningar, ogiltigt konto tas bort', () => {
    const n = K.normaliseraTolkning({ ...bas, osakerhet: 'Datumet är svårläst', stalld_till_foreningen: 'nej', foreslaget_konto: 'hyra' }, { id: 'u4', filnamn: 'x.pdf' });
    assert.equal(n.varningar.length, 2);
    assert.equal(n.underlag.foreslagetKonto, '');
  });
  test('kontoutdrag blir bankrader i tidsordning', () => {
    const n = K.normaliseraTolkning({ ...bas, dokumenttyp: 'kontoutdrag', transaktioner: [
      { datum: '2030-01-20', text: 'Swish', belopp: '500.00', saldo: '1500.00' },
      { datum: '2030-01-05', text: 'Hyra', belopp: '-1000.00', saldo: '1000.00' },
      { datum: 'okänt', text: 'Trasig', belopp: 'x', saldo: '' }
    ] }, { id: 'u5', filnamn: 'utdrag.pdf' });
    eq(n.bankrader.map((r) => [r.datum, r.belopp, r.saldo]), [['2030-01-05', kr(-1000), kr(1000)], ['2030-01-20', kr(500), kr(1500)]]);
    eq(n.varningar, []);
    assert.equal(n.underlag.dokumenttyp, 'kontoutdrag');
  });
  test('instruktionen innehåller kontoplanen men inga balanskonton', () => {
    const t = K.tolkningsInstruktion(ar, { namn: 'Påhittade föreningen' });
    assert.match(t, /5010 Lokalhyra/);
    assert.match(t, /Påhittade föreningen/);
    assert.doesNotMatch(t, /1930/);
  });
  test('schemat följer reglerna för strukturerade svar', () => {
    const kolla = (s) => {
      if (s.type === 'object') {
        assert.equal(s.additionalProperties, false);
        assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
        Object.values(s.properties).forEach(kolla);
      }
      if (s.type === 'array') kolla(s.items);
    };
    kolla(K.TOLKNING_SCHEMA);
  });
});

describe('ingående balans från banken', () => {
  test('banken visar saldot före första transaktionen och det kan sättas', () => {
    let ar = K.importeraBankrader(K.skapaAr({ start: '2030-01-01' }), K.parseBankfil(BANKFIL).rader).ar;
    const a = K.bankavstamning(ar);
    assert.equal(a.ingaendeEnligtBank, kr(15000));
    assert.equal(a.ingaendeBokfort, 0);
    ar = K.sattIngaendeSaldo(ar, '1930', kr(15000));
    eq(ar.ingaendeBalans, { '1930': kr(15000), '2067': kr(-15000) });
    ar = K.sattIngaendeSaldo(ar, '1930', kr(14000));
    eq(ar.ingaendeBalans, { '1930': kr(14000), '2067': kr(-14000) });
  });
  test('inte i ett låst år och inte på resultatkonton', () => {
    const ar = K.skapaAr({ start: '2030-01-01' });
    assert.throws(() => K.sattIngaendeSaldo(K.lasPeriod(ar, '2030-01-31'), '1930', 100), /låst/);
    assert.throws(() => K.sattIngaendeSaldo(ar, '3100', 100), /Ogiltigt/);
  });
});

describe('inlärning av konton per motpart', () => {
  test('lär sig och hittar motpart, exakt träff går före delvis', () => {
    let r = K.larMotpart([], 'Stockholms stad, Idrottsförvaltningen', '5010');
    r = K.larMotpart(r, 'Stockholms stad', '6990');
    assert.equal(K.hittaMotpartsregel(r, 'STOCKHOLMS STAD IDROTTSFÖRVALTNINGEN').konto, '5010');
    assert.equal(K.hittaMotpartsregel(r, 'Stockholms stad').konto, '6990');
    assert.equal(K.hittaMotpartsregel(r, 'Stockholms stad, Utbildningsförvaltningen').konto, '6990');
    assert.equal(K.hittaMotpartsregel(r, 'Tågbolaget'), null);
    assert.equal(K.hittaMotpartsregel(r, ''), null);
    r = K.larMotpart(r, 'Stockholms stad', '5010');
    assert.equal(r.length, 2);
    assert.equal(K.hittaMotpartsregel(r, 'Stockholms stad').konto, '5010');
    eq(K.larMotpart(r, 'X', 'abc'), r);
  });
  test('kontot att lära är det enda som inte är ett betalkonto', () => {
    assert.equal(K.kontoAttLara([{ konto: '5010', belopp: 100 }, { konto: '1930', belopp: -100 }]), '5010');
    assert.equal(K.kontoAttLara([{ konto: '5800', belopp: 100 }, { konto: '2890', belopp: -100 }]), '5800');
    assert.equal(K.kontoAttLara([{ konto: '5800', belopp: 50 }, { konto: '5400', belopp: 50 }, { konto: '1930', belopp: -100 }]), null);
  });
  test('väntande underlag får inlärt konto, men inte där användaren valt själv', () => {
    let ar = ar2030();
    ar = K.laggTillUnderlag(ar, { id: 'a', filnamn: 'a.pdf', dokumenttyp: 'faktura', motpart: 'Stockholms stad', belopp: 100, riktning: 'utgift', foreslagetKonto: '6990', kontoKalla: 'claude' });
    ar = K.laggTillUnderlag(ar, { id: 'b', filnamn: 'b.pdf', dokumenttyp: 'faktura', motpart: 'Stockholms stad', belopp: 200, riktning: 'utgift', foreslagetKonto: '5000', kontoKalla: 'manuell' });
    ar = K.laggTillUnderlag(ar, { id: 'c', filnamn: 'c.pdf', dokumenttyp: 'faktura', motpart: 'Annan', belopp: 300, riktning: 'utgift', foreslagetKonto: '', });
    const ny = K.tillampaMotpartsregler(ar, K.larMotpart([], 'Stockholms stad', '5010'));
    eq(ny.underlag.map((u) => [u.id, u.foreslagetKonto, u.kontoKalla || '']), [['a', '5010', 'inlart'], ['b', '5000', 'manuell'], ['c', '', '']]);
  });
  test('regler med konton som inte finns i kontoplanen används inte', () => {
    let ar = K.laggTillUnderlag(ar2030(), { id: 'a', filnamn: 'a.pdf', dokumenttyp: 'faktura', motpart: 'X', belopp: 100, riktning: 'utgift', foreslagetKonto: '' });
    ar = K.tillampaMotpartsregler(ar, K.larMotpart([], 'X', '5999'));
    assert.equal(ar.underlag[0].foreslagetKonto, '');
  });
  test('kontonummer med namn efter godtas från Claude', () => {
    const bas = { dokumenttyp: 'faktura', motpart: 'X', datum: '2030-01-01', forfallodatum: '', belopp: '10.00', valuta: 'SEK', belopp_sek: '', moms: '', fakturanummer: '', ocr: '', beskrivning: '', riktning: 'utgift', stalld_till_foreningen: 'ja', osakerhet: '', transaktioner: [] };
    assert.equal(K.normaliseraTolkning({ ...bas, foreslaget_konto: '5010 Lokalhyra' }, { id: 'a', filnamn: 'a' }).underlag.foreslagetKonto, '5010');
    assert.equal(K.normaliseraTolkning({ ...bas, foreslaget_konto: 'Konto 5800 (Resekostnader)' }, { id: 'a', filnamn: 'a' }).underlag.foreslagetKonto, '5800');
    assert.equal(K.normaliseraTolkning({ ...bas, foreslaget_konto: '50100' }, { id: 'a', filnamn: 'a' }).underlag.foreslagetKonto, '');
    assert.equal(K.normaliseraTolkning({ ...bas, foreslaget_konto: '' }, { id: 'a', filnamn: 'a' }).underlag.kontoKalla, undefined);
  });
  test('instruktionen till Claude innehåller tidigare bokföringar', () => {
    const r = K.larMotpart(K.larMotpart([], 'Stockholms stad, Idrottsförvaltningen', '5010'), 'Okänd', '5999');
    const t = K.tolkningsInstruktion(ar2030(), {}, r);
    assert.match(t, /Stockholms stad, Idrottsförvaltningen → 5010 Lokalhyra/);
    assert.doesNotMatch(t, /5999/);
    assert.doesNotMatch(K.tolkningsInstruktion(ar2030(), {}, []), /tidigare/);
  });
});

describe('koppla bankrader till redan bokförda verifikationer', () => {
  function medFaktura() {
    let ar = ar2030();
    ar = K.bokfor(ar, { datum: '2030-02-01', text: 'Hyra feb', underlag: ['f.pdf'], rader: [{ konto: '5010', belopp: kr(1200) }, { konto: '1930', belopp: kr(-1200) }] }).ar;
    ar = K.bokfor(ar, { datum: '2030-02-01', text: 'Hyra feb hall 2', underlag: ['g.pdf'], rader: [{ konto: '5010', belopp: kr(1200) }, { konto: '1930', belopp: kr(-1200) }] }).ar;
    return ar;
  }
  test('bankraden kopplas till verifikationen i stället för att bokföras igen', () => {
    let ar = K.importeraBankrader(medFaktura(), [
      { datum: '2030-02-28', text: 'STOCKHOLMS STAD', referens: '', belopp: kr(-1200), saldo: null },
      { datum: '2030-03-01', text: 'STOCKHOLMS STAD', referens: '', belopp: kr(-1200), saldo: null },
      { datum: '2030-03-02', text: 'Annat', referens: '', belopp: kr(-50), saldo: null }
    ]).ar;
    const res = K.kopplaBokforda(ar);
    eq(res.kopplade.map((k) => k.nr), [1, 2]);
    eq(K.oppnaBankrader(res.ar).map((r) => r.text), ['Annat']);
    assert.equal(res.ar.bankrader[0].kopplad, 'efterhand');
    eq(K.kopplaBokforda(res.ar).kopplade, []);
  });
  test('för långt ifrån i tid, rättade verifikationer och fel belopp kopplas inte', () => {
    let ar = K.rattelse(medFaktura(), 2, { datum: '2030-02-02' }).ar;
    ar = K.importeraBankrader(ar, [
      { datum: '2030-06-01', text: 'Sent', referens: '', belopp: kr(-1200), saldo: null },
      { datum: '2030-02-20', text: 'Fel belopp', referens: '', belopp: kr(-1100), saldo: null },
      { datum: '2030-02-21', text: 'Rätt', referens: '', belopp: kr(-1200), saldo: null }
    ]).ar;
    const res = K.kopplaBokforda(ar);
    eq(res.kopplade.map((k) => k.nr), [1]);
    eq(K.oppnaBankrader(res.ar).map((r) => r.text).sort(), ['Fel belopp', 'Sent']);
  });
});

describe('utländsk valuta', () => {
  test('ett kvitto i euro utan kronbelopp väntar, och bankens belopp blir kronbeloppet', () => {
    let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { 1930: kr(5000), 2067: kr(-5000) } });
    ar = K.laggTillUnderlag(ar, { id: 'eur', filnamn: 'flyg.pdf', dokumenttyp: 'kvitto', motpart: 'Flygbolaget', datum: '2030-07-06', belopp: 0, valuta: 'EUR', originalbelopp: kr(100), riktning: 'utgift', beskrivning: 'Flyg', foreslagetKonto: '5810' });
    assert.equal(K.oppnaUnderlag(ar).length, 1, 'syns bland väntande underlag');
    assert.equal(K.valutaText(ar.underlag[0]), '100,00 EUR');
    ar = K.importeraBankrader(ar, [{ datum: '2030-11-16', text: 'Ers utlägg flyg', referens: '', belopp: kr(-1110), saldo: null }]).ar;
    const f = K.forslagForBankrad(ar, ar.bankrader[0], [], { underlagIds: ['eur'], ungefar: true });
    assert.deepEqual(json(f.rader), [{ konto: '1930', belopp: kr(-1110) }, { konto: '5810', belopp: kr(1110) }]);
    assert.match(f.text, /100,00 EUR, kurs 11,10/);
    ar = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader, underlagKommentar: '' }, { bankradId: f.bankradId, underlagIds: f.underlagIds }).ar;
    const u = ar.underlag[0];
    assert.deepEqual([u.belopp, u.verifikation != null], [kr(1110), true]);
    assert.equal(K.oppnaUnderlag(ar).length, 0);
  });
});
