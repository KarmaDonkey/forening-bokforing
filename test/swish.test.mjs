import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat: namn, nummer och belopp.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);
const RAPPORT = [
  'Swish-rapport;;;;;;;;;',
  'Avser 2030-01-01 - 2030-12-31;;;;;;;;;',
  'Bokföringsdatum;Transaktionsdatum;Valutadatum;Mottagarnummer;Mottagarnamn;Avsändarnummer;Avsändarnamn;Meddelande;Orderreferens;Belopp',
  '2030-01-08;2030-01-08;2030-01-09;1230000000;FÖRENINGEN EXEMPEL;+46700000001;EXEMPELSSON, FÖRÄLDER;Capoeira, Barn Exempelsson;;1 300,00',
  '2030-01-20;2030-01-20;2030-01-21;1230000000;FÖRENINGEN EXEMPEL;+46700000002;ANNAN FÖRÄLDER;Terminsavgift Mestrinho 20190721-1234;;2 700,00',
  '2030-01-22;2030-01-22;2030-01-23;1230000000;FÖRENINGEN EXEMPEL;+46700000003;TREDJE PERSON;;;-50,00'
].join('\n');

test('Swish-rapporten känns igen och skiljs från kontoutdrag', () => {
  assert.equal(K.arSwishrapport(RAPPORT), true);
  assert.equal(K.arSwishrapport('Bokföringsdag;Beskrivning;Belopp;Saldo\n2030-01-08;Swish +46700000001;1300,00;5000,00'), false);
});

test('raderna läses med avsändare och meddelande, utan personnummer', () => {
  const r = K.parseSwishrapport(RAPPORT);
  assert.equal(r.rader.length, 2, 'utbetalningar tas inte med');
  assert.deepEqual(json(r.rader[0]), { datum: '2030-01-08', nummer: '+46700000001', namn: 'EXEMPELSSON, FÖRÄLDER', meddelande: 'Capoeira, Barn Exempelsson', belopp: kr(1300) });
  assert.equal(r.rader[1].meddelande, 'Terminsavgift Mestrinho', 'personnumret tas bort');
});

test('raderna sparas utan dubbletter och kopplas till bankraden', () => {
  const r = K.parseSwishrapport(RAPPORT);
  let reg = K.laggTillSwish(K.tomtRegister(), r.rader, '2030-02-01').reg;
  assert.equal(K.laggTillSwish(reg, r.rader, '2030-02-01').nya, 0);
  assert.equal(K.laggTillSwish(reg, [], '2033-01-01').reg.swish.length, 0, 'rader äldre än två år tas bort');
  const rad = { datum: '2030-01-09', text: 'Swish +46700000001', referens: '', belopp: kr(1300) };
  assert.equal(K.swishForRad(reg, rad).meddelande, 'Capoeira, Barn Exempelsson');
  assert.equal(K.swishForRad(reg, Object.assign({}, rad, { belopp: kr(1200) })), null, 'annat belopp');
  assert.equal(K.swishForRad(reg, Object.assign({}, rad, { datum: '2030-01-20' })), null, 'för långt ifrån');
});

test('meddelandet pekar ut barnet, även via apelido', () => {
  let reg = K.tomtRegister();
  reg = K.laggTillMedlem(reg, { namn: 'Barn Exempelsson', kategori: 'barn' }).reg;
  reg = K.laggTillMedlem(reg, { namn: 'Påhittad Person', apelido: 'Mestrinho', kategori: 'vuxen' }).reg;
  assert.equal(K.hittaMedlemPaNamn(reg, K.namnUrText('Capoeira, Barn Exempelsson')), reg.medlemmar[0].id);
  assert.deepEqual(json(K.kandidaterPaNamn(reg, 'Terminsavgift Mestrinho')), { medlemmar: [reg.medlemmar[1].id], via: 'apelido' });
});
