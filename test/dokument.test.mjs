import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const kr = (n) => Math.round(n * 100);

const faktura = {
  id: 'd1', typ: 'faktura', nummer: '2030-03:01', datum: '2030-03-05', forfallodatum: '2030-04-04',
  mottagare: { namn: 'Testa Testsson', foretag: 'Påhittade skolan AB', adress: 'Gatan 1\n111 11 Staden' },
  rader: [
    { antal: 1, beskrivning: 'Capoeirauppvisning', pris: kr(2500), konto: '3990' },
    { antal: 1.5, beskrivning: 'Workshop, timmar', pris: kr(800), konto: '3100' }
  ]
};

describe('dokumentnummer', () => {
  test('fakturor numreras per månad och kvitton per år', () => {
    const doks = [
      { typ: 'faktura', nummer: '2030-03:01' }, { typ: 'faktura', nummer: '2030-03:07' }, { typ: 'faktura', nummer: '2030-02:12' },
      { typ: 'kvitto', nummer: 'K2030-009' }, { typ: 'kvitto', nummer: 'K2029-050' }
    ];
    assert.equal(K.nastaDokumentnummer(doks, 'faktura', '2030-03-20'), '2030-03:08');
    assert.equal(K.nastaDokumentnummer(doks, 'faktura', '2030-04-01'), '2030-04:01');
    assert.equal(K.nastaDokumentnummer(doks, 'kvitto', '2030-12-31'), 'K2030-010');
    assert.equal(K.nastaDokumentnummer([], 'kvitto', '2031-01-01'), 'K2031-001');
  });
});

describe('summor och kontroll', () => {
  test('radtotal med decimalt antal och summa i ören', () => {
    assert.equal(K.dokumentRadTotal({ antal: 1.5, pris: kr(800) }), kr(1200));
    assert.equal(K.dokumentRadTotal({ antal: 3, pris: 33333 }), 99999);
    assert.equal(K.dokumentSumma(faktura), kr(3700));
  });
  test('en korrekt faktura godkänns', () => { eq(K.valideraDokument(faktura), []); });
  test('fel hittas', () => {
    const fel = K.valideraDokument({ typ: 'faktura', mottagare: { namn: ' ' }, datum: '2030-03-05', forfallodatum: '2030-03-01', rader: [{ antal: 0, beskrivning: '', pris: 1.5, konto: 'x' }] });
    assert.equal(fel.length, 6);
    assert.match(fel.join(' '), /namn/);
    assert.match(fel.join(' '), /Förfallodatum/);
    assert.match(fel.join(' '), /beskrivning/);
    assert.match(fel.join(' '), /antalet/);
    assert.match(fel.join(' '), /priset/);
    assert.match(fel.join(' '), /kontot/);
    assert.match(K.valideraDokument({ ...faktura, rader: [] }).join(' '), /minst en rad/);
    assert.match(K.valideraDokument({ ...faktura, rader: [{ antal: 1, beskrivning: 'Gratis', pris: 0 }] }).join(' '), /större än noll/);
  });
  test('kvitto behöver betaldatum och betalsätt men inget förfallodatum', () => {
    const kvitto = { typ: 'kvitto', mottagare: { namn: 'A' }, datum: '2030-03-05', betaldDatum: '2030-03-01', betalsatt: 'Swish', rader: [{ antal: 1, beskrivning: 'Träningsavgift', pris: kr(3000) }] };
    eq(K.valideraDokument(kvitto), []);
    const fel = K.valideraDokument({ ...kvitto, betaldDatum: '', betalsatt: '' });
    assert.equal(fel.length, 2);
    assert.match(fel.join(' '), /när beloppet betalades/);
    assert.match(fel.join(' '), /hur beloppet betalades/);
    assert.match(K.valideraDokument({ ...kvitto, betaldDatum: '2030-03-06' }).join(' '), /efter utskrivningsdatum/);
  });
});

describe('fakturan i bokföringen', () => {
  test('blir ett underlag för inbetalning med kontot med störst belopp', () => {
    eq(K.fakturaTillUnderlag(faktura, 'Faktura 2030-03_01.html'), {
      id: 'dok-d1', filnamn: 'Faktura 2030-03_01.html', dokumenttyp: 'utgaende_faktura', dokumentId: 'd1',
      motpart: 'Påhittade skolan AB', datum: '2030-03-05', forfallodatum: '2030-04-04', belopp: kr(3700), riktning: 'intakt',
      beskrivning: 'Faktura 2030-03:01: Capoeirauppvisning', fakturanummer: '2030-03:01', ocr: '', foreslagetKonto: '3990', kontoKalla: 'faktura'
    });
  });
  test('kopplas till inbetalningen på banken och bokförs som intäkt', () => {
    let ar = K.skapaAr({ start: '2030-01-01' });
    ar = K.laggTillUnderlag(ar, K.fakturaTillUnderlag(faktura, 'f.html'));
    ar = K.importeraBankrader(ar, [{ datum: '2030-04-02', text: 'BG INBET PÅHITTADE SKOLAN', referens: '2030-03:01', belopp: kr(3700), saldo: null }]).ar;
    const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
    eq(f.underlagIds, ['dok-d1']);
    eq(f.rader, [{ konto: '1930', belopp: kr(3700) }, { konto: '3990', belopp: kr(-3700) }]);
  });
});

describe('namn från banktext', () => {
  test('tar bort Swish och telefonnummer', () => {
    assert.equal(K.namnFranBanktext('Swish från 46701234567 ANNA ANDERSSON'), 'Anna Andersson');
    assert.equal(K.namnFranBanktext('SWISH +46701234567 karl-erik öberg'), 'Karl-Erik Öberg');
    assert.equal(K.namnFranBanktext(''), '');
  });
});
