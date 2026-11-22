import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Påhittade kontonummer.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);
const BANK = [{ konto: '1930', nummer: '000 000 001-2' }, { konto: '1940', nummer: '0034' }];

test('kontoutdraget känns igen på kontonumret', () => {
  const huvud = 'Radnummer,Clearingnummer,Kontonummer,Produkt\n1,1234-5,"000 000 001-2",Konto,2026-01-02,-500,00\n2,1234-5,"000 000 001-2",Konto,"Överföring 1234-5,000 000 003-4",-1000,00';
  assert.equal(K.kontoForUtdrag(BANK, huvud, 'Transaktioner.csv'), '1930', 'flest träffar vinner, även om det andra numret står i en text');
  assert.equal(K.kontoForUtdrag(BANK, '1,1234-5,"000 000 003-4",Konto,2026-01-02,1000,00', ''), '1940');
  assert.equal(K.kontoForUtdrag(BANK, 'Datum;Text;Belopp\n2026-01-02;Hyra;-12,00', ''), null, 'ett belopp räknas inte som kontonummer');
  assert.equal(K.kontoForUtdrag([{ konto: '1930', nummer: '' }], 'x 12345678', ''), null);
});

function arMedTvaKonton() {
  let ar = K.skapaAr({ start: '2026-01-01', ingaendeBalans: { 1930: kr(2000), 2067: kr(-2000) } });
  ar = K.importeraBankrader(ar, [{ datum: '2026-02-01', text: 'Överföring', referens: '', belopp: kr(-1000), saldo: kr(1000) }], { konto: '1930' }).ar;
  return ar;
}

test('överföring mellan egna konton bokförs en gång och kopplas till båda kontoutdragen', () => {
  let ar = arMedTvaKonton();
  // Bara företagskontots utdrag: inget förslag på överföring ännu.
  assert.notEqual(K.forslagForBankrad(ar, ar.bankrader[0], []).kalla, 'overforing');
  ar = K.importeraBankrader(ar, [{ datum: '2026-02-02', text: 'Insättning', referens: '', belopp: kr(1000), saldo: kr(1000) }], { konto: '1940' }).ar;
  assert.deepEqual(json(K.bankkontonIAr(ar)), ['1930', '1940']);
  const f = K.forslagForBankrad(ar, ar.bankrader.find((r) => r.konto === '1930'), []);
  assert.equal(f.kalla, 'overforing');
  assert.deepEqual(json(f.rader), [{ konto: '1930', belopp: kr(-1000) }, { konto: '1940', belopp: kr(1000) }]);
  assert.equal(f.text, 'Överföring till 1940');
  assert.equal(f.komplett, true);
  const res = K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader, underlagKommentar: f.underlagKommentar }, { bankradId: f.bankradId });
  const k = K.kopplaBokforda(res.ar);
  assert.equal(k.kopplade.length, 1, 'raden på placeringskontot kopplas till samma verifikation');
  assert.ok(k.ar.bankrader.every((r) => r.verifikation === res.verifikation.nr));
  assert.equal(K.oppnaBankrader(k.ar).length, 0);
  assert.deepEqual([K.bankavstamning(k.ar, '1930').skillnad, K.bankavstamning(k.ar, '1940').skillnad], [0, 0]);
  const s = K.samladAvstamning(k.ar);
  assert.equal(s.skillnad, 0);
  assert.equal(s.konton.length, 2);
  assert.ok(K.bokslutsKontroller(k.ar).find((x) => x.id === 'avstamning').klar);
});

test('överföringen bokförd innan det andra utdraget lästs in kopplas i efterhand', () => {
  let ar = arMedTvaKonton();
  const res = K.bokforKopplat(ar, { datum: '2026-02-01', text: 'Till placeringskontot', rader: [{ konto: '1930', belopp: kr(-1000) }, { konto: '1940', belopp: kr(1000) }] }, { bankradId: ar.bankrader[0].id });
  ar = K.importeraBankrader(res.ar, [{ datum: '2026-02-01', text: 'Insättning', referens: '', belopp: kr(1000), saldo: kr(1000) }], { konto: '1940' }).ar;
  const k = K.kopplaBokforda(ar);
  assert.equal(k.kopplade.length, 1);
  assert.equal(K.oppnaBankrader(k.ar).length, 0);
});

test('differens på ett av kontona syns i bokslutet och ekonomitexten summerar kontona', () => {
  let ar = arMedTvaKonton();
  ar = K.importeraBankrader(ar, [{ datum: '2026-02-02', text: 'Insättning', referens: '', belopp: kr(1000), saldo: kr(1200) }], { konto: '1940' }).ar;
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  ar = K.kopplaBokforda(K.bokforKopplat(ar, { datum: f.datum, text: f.text, rader: f.rader }, { bankradId: f.bankradId }).ar).ar;
  const kontroll = K.bokslutsKontroller(ar).find((x) => x.id === 'avstamning');
  assert.equal(kontroll.klar, false);
  assert.match(kontroll.text, /1940 .200,00 kr/);
  assert.match(K.kontroller(ar).map((w) => w.meddelande).join(' '), /1940/);
  assert.match(K.ekonomitext(ar, { bankkonton: ['1930', '1940'] }), /bankkonton vid årets slut var 2.000,00 kr/);
  assert.match(K.ekonomitext(ar), /konto vid årets slut var 1.000,00 kr/);
});

test('kontonumret känns igen i en CSV som liknar bankens export, men inte i datum', () => {
  const rad = (nr, konto, datum, belopp, saldo) => [nr, '1234-5', konto, 'Konto', 'SEK', datum, datum, datum, '""', '"Text"', belopp, saldo].join(',');
  const fil = ['* Transaktioner Period 2026-01-01 - 2026-03-31', 'Radnummer,Clearingnummer,Kontonummer,Produkt,Valuta,Bokföringsdag,Transaktionsdag,Valutadag,Referens,Beskrivning,Belopp,Bokfört saldo',
    rad(2, '000 000 001-2', '2026-02-02', '-150.00', '13550.00'), rad(1, '000 000 001-2', '2026-01-05', '-1100.00', '13900.00')].join('\r\n');
  assert.equal(K.kontoForUtdrag([{ konto: '1930', nummer: '0012' }, { konto: '1940', nummer: '0034' }], fil, ''), '1930');
  assert.equal(K.kontoForUtdrag([{ konto: '1930', nummer: '1234-5, 000 000 001-2' }], fil, ''), '1930', 'hela numret med clearingnummer går också');
  assert.equal(K.kontoForUtdrag([{ konto: '1930', nummer: '0105' }], fil, ''), null, 'datumet 2026-01-05 räknas inte');
});
