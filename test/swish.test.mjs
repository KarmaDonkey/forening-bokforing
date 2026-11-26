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

// Påhittad fil i samma format som Swedbanks Swish-rapport (CSV): en kommentarsrad, kommatecken, belopp med punkt.
const SWEDBANK = [
  '* Swish-rapport Avser 2030-01-01 - 2030-12-31 Skapad 2030-12-31 12:00 CET',
  'Radnr,Clnr,Kontonr,Bokfdag,Transdag,Valutadag,Mottagarnr,Mottagarnamn,Avsändarnr,Avsändarnamn,Meddelande,Tid,Belopp,Orderreferens',
  '1,10000,1234567890,2030-01-08,2030-01-08,2030-01-09,1230000000,FÖRENINGEN EXEMPEL,+46700000001,EXEMPELSSON- FÖRÄLDER,Capoeira- Barn Exempelsson,19:53,1300.00,',
  '2,10000,1234567890,2030-01-26,2030-01-24,2030-01-26,1230000000,FÖRENINGEN EXEMPEL,+46700000002,ANNAN FÖRÄLDER,Påhittad Barnsson 010203,17:16,750.00,',
  ''
].join('\n');

test('Swedbanks Swish-rapport känns igen och läses inte som kontoutdrag', () => {
  assert.equal(K.arSwishrapport(SWEDBANK), true);
  assert.equal(K.liknarSwishrapport(SWEDBANK), true);
  const r = K.parseSwishrapport(SWEDBANK);
  assert.deepEqual(json(r.rader.map((x) => [x.datum, x.nummer, x.namn, x.meddelande, x.belopp])), [
    ['2030-01-08', '+46700000001', 'EXEMPELSSON- FÖRÄLDER', 'Capoeira- Barn Exempelsson', kr(1300)],
    ['2030-01-26', '+46700000002', 'ANNAN FÖRÄLDER', 'Påhittad Barnsson', kr(750)]]);
  // Även med okända kolumnnamn ska filen inte bli ett kontoutdrag.
  const okand = 'Datum,Avsändare telefon,Avsändarnamn,Meddelande,Summa\n2030-01-08,+46700000001,X,Y,100.00';
  assert.equal(K.arSwishrapport(okand), false);
  assert.equal(K.liknarSwishrapport(okand), true);
  assert.equal(K.liknarSwishrapport('Bokföringsdag;Beskrivning;Referens;Belopp;Saldo\n2030-01-08;Swish;123;100,00;5000,00'), false);
});

test('meddelandets namn hittas, och kortare datumsiffror tas bort', () => {
  const r = K.parseSwishrapport(SWEDBANK);
  assert.equal(K.namnUrText(r.rader[0].meddelande), 'Barn Exempelsson');
  assert.equal(K.parseSwishrapport(SWEDBANK.replace('010203', 'Workshop 22-24 maj')).rader[1].meddelande, 'Påhittad Barnsson Workshop 22-24 maj', 'korta tal finns kvar');
});

test('dubbelnamn med bindestreck delas inte', () => {
  assert.equal(K.namnUrText('Exempel Dubbel-Påhittad'), 'Exempel Dubbel-Påhittad');
});

test('meddelanden som gäller annat än avgifter känns igen', () => {
  for (const t of ['Exempel byxor stl 14', 'Workshop maj Barn Exempelsson', 'Abadá storlek M', 'T-shirt', 'Kläder till uppvisning', 'Lån 2']) assert.equal(K.interAvgiftText(t), true, t);
  for (const t of ['Barn Exempelsson', 'Terminsavgift VT 26', 'Familj - VT -26', 'Resterande efter fritidskort', '']) assert.equal(K.interAvgiftText(t), false, t);
});

test('ett meddelande med flera barn delas upp, och ett gemensamt efternamn gäller alla', () => {
  assert.deepEqual(json(K.delaNamnlista('Anna & Bo Exempelsson')), ['Anna Exempelsson', 'Bo Exempelsson']);
  assert.deepEqual(json(K.delaNamnlista('Anna och Bo Exempelsson')), ['Anna Exempelsson', 'Bo Exempelsson']);
  assert.deepEqual(json(K.delaNamnlista('Anna + Bo Exempelsson')), ['Anna Exempelsson', 'Bo Exempelsson']);
  assert.deepEqual(json(K.delaNamnlista('Anna + Bo')), ['Anna', 'Bo']);
  assert.deepEqual(json(K.delaNamnlista('Anna Påhittad, Bo Exempelsson')), ['Anna Påhittad', 'Bo Exempelsson']);
  assert.deepEqual(json(K.delaNamnlista('Barn Exempelsson')), ['Barn Exempelsson']);
});

test('syskon i meddelandet föreslås båda, och betalningen hittas från verifikationen', () => {
  let reg = K.tomtRegister();
  reg = K.sattTermin(reg, 'HT-30', { barn: kr(1300) });
  reg.arsavgift = { vanlig: kr(500), funktionar: 0, ingar: true };
  for (const n of ['Anna Exempelsson', 'Bo Exempelsson', 'Annan Person']) reg = K.laggTillMedlem(reg, { namn: n, kategori: 'barn' }).reg;
  const [a, b] = reg.medlemmar.map((m) => m.id);
  const k = K.swishKandidater(reg, 'Anna & Bo Exempelsson');
  assert.deepEqual(json(k.kandidater), [a, b]);
  const f = K.avgiftsforslag(reg, { datum: '2030-11-02', belopp: kr(2600), medlemIds: k.kandidater });
  assert.equal(f.stammer, true);
  assert.deepEqual(json(f.poster.map((p) => [p.typ, p.belopp])), [['termin', kr(800)], ['arsavgift', kr(500)], ['termin', kr(800)], ['arsavgift', kr(500)]]);
  reg = K.registreraBetalning(reg, { datum: '2030-11-02', belopp: kr(2600), termin: 'HT-30', arId: '2030', ver: 84, nyckel: '+46700000001', poster: f.poster });
  assert.equal(K.betalningarForVerifikation(reg, '2030', 84).length, 1);
  assert.equal(K.betalningarForVerifikation(reg, '2030', 85).length, 0);
  assert.equal(K.betalningarForVerifikation(reg, '2029', 84).length, 0);
});
