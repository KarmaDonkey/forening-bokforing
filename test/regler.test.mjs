import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

test('regeln lärs in med bankens referens, så att allmänna texter inte blandas ihop', () => {
  let regler = K.larRegel([], 'Pg-bet. via internet', kr(-1000), '5010', 'Exempelskolan');
  assert.equal(K.hittaRegel(regler, 'Pg-bet. via internet Exempelskolan', kr(-900)).konto, '5010');
  assert.equal(K.hittaRegel(regler, 'Pg-bet. via internet Elbolaget', kr(-900)), null, 'en annan mottagare får inte hyreskontot');
  regler = K.larRegel(regler, 'Pris kontopaket', kr(-150), '6570');
  assert.equal(regler[1].monster, 'pris kontopaket');
});

test('allmänna regler gäller när föreningen inte har någon egen', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.importeraBankrader(ar, [{ datum: '2031-01-20', text: 'Pris banktjänster enligt faktura', referens: '', belopp: kr(-51.5), saldo: null }]).ar;
  const f = K.forslagForBankrad(ar, ar.bankrader[0], []);
  assert.equal(f.rader[1].konto, '6570');
  assert.equal(f.kalla, 'regel');
  // Föreningens egen regel går före.
  const egen = K.forslagForBankrad(ar, ar.bankrader[0], [{ monster: 'pris banktjänster enligt faktura', riktning: 'ut', konto: '6500' }]);
  assert.equal(egen.rader[1].konto, '6500');
});

test('förslag på regler från tidigare års bokföring', () => {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { 1930: kr(50000), 2067: kr(-50000) } });
  const ver = (datum, text, konto, belopp) => { ar = K.bokfor(ar, { datum, text, rader: [{ konto, belopp: kr(belopp) }, { konto: '1930', belopp: kr(-belopp) }] }).ar; };
  ver('2030-01-10', 'Lokalhyra Exempelskolan jan', '5010', 1000);
  ver('2030-02-10', 'Lokalhyra Exempelskolan feb', '5010', 1000);
  ver('2030-03-10', 'Lokalhyra Exempelskolan mars', '5010', 1000);
  ver('2030-03-15', 'Förbundsavgift Exempelförbundet', '6980', 400);
  ver('2030-04-15', 'Förbundsavgift Exempelförbundet', '6980', 400);
  ver('2030-05-01', 'Bidrag Exempelkommunen', '3980', -2000);
  ver('2030-06-01', 'Bidrag Exempelkommunen', '3980', -2000);
  ver('2030-06-02', 'Ers utlägg material', '5400', 100);
  ver('2030-06-03', 'Ers utlägg resa', '5800', 100);
  const f = K.forslagRegler([ar], []);
  const som = (w) => f.find((x) => x.monster === w);
  assert.deepEqual(json(som('exempelskolan')), { monster: 'exempelskolan', konto: '5010', riktning: 'ut', antal: 3, totalt: 3 });
  assert.equal(som('lokalhyra').konto, '5010');
  assert.equal(som('exempelförbundet').konto, '6980');
  assert.deepEqual([som('exempelkommunen').konto, som('exempelkommunen').riktning], ['3980', 'in']);
  assert.equal(som('utlägg'), undefined, 'vanliga ord föreslås inte');
  assert.equal(som('material'), undefined, 'ett ord som bara förekommer en gång föreslås inte');
  assert.equal(K.forslagRegler([ar], [{ monster: 'exempelskolan', riktning: 'ut', konto: '5010' }]).some((x) => x.monster === 'exempelskolan'), false, 'redan inlagda regler föreslås inte');
});
