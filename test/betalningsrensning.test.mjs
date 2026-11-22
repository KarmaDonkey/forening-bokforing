import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat: namn, nummer, belopp och datum.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function registerMedBetalningar() {
  let reg = K.tomtRegister();
  reg = K.laggTillMedlem(reg, { namn: 'Exempel Person', kategori: 'vuxen' }).reg;
  const m = reg.medlemmar[0].id;
  const b = (x) => { reg = K.registreraBetalning(reg, Object.assign({ termin: 'VT-31', poster: [{ medlem: m, typ: 'termin', belopp: x.belopp }] }, x)); };
  b({ datum: '2031-01-10', belopp: kr(500), arId: '2031', ver: 3, bankradId: 'r-gammal' }); // bankraden finns inte
  b({ datum: '2031-01-11', belopp: kr(500), arId: '2031', ver: 4, bankradId: 'r-obokford' }); // bankraden finns men är obokförd
  b({ datum: '2031-01-12', belopp: kr(500), arId: '2031', ver: 9, bankradId: 'r-annan' }); // bokförd i en annan verifikation
  b({ datum: '2031-01-13', belopp: kr(500), arId: '2031', ver: 1, bankradId: 'r-ok' }); // stämmer
  b({ datum: '2030-01-10', belopp: kr(500), termin: 'VT-30', arId: '2030', ver: 1, bankradId: 'r-arkiv' }); // år som inte finns i bokföringen
  b({ datum: '2029-01-10', belopp: kr(500), termin: 'VT-29', kalla: 'historik-1', historik: true }); // historik utan år
  return reg;
}

test('betalningar vars verifikation inte finns längre hittas och kan tas bort', () => {
  const reg = registerMedBetalningar();
  const ar = { verifikationer: [{ nr: 1 }, { nr: 2 }], bankrader: [
    { id: 'r-obokford', verifikation: null }, { id: 'r-annan', verifikation: 2 }, { id: 'r-ok', verifikation: 1 }] };
  const ids = K.foraldradeBetalningar(reg, { 2031: ar });
  const datum = (lista) => lista.map((id) => reg.betalningar.find((b) => b.id === id).datum);
  assert.deepEqual(json(datum(ids)), ['2031-01-10', '2031-01-11', '2031-01-12']);
  const ny = K.taBortBetalningar(reg, ids);
  assert.equal(ny.betalningar.length, 3);
  assert.equal(ny.medlemmar.length, 1, 'medlemmarna finns kvar');
  assert.deepEqual(json(K.foraldradeBetalningar(ny, { 2031: ar })), []);
});

test('en betalning utan bankrad räknas som gammal bara om verifikationen saknas', () => {
  let reg = K.tomtRegister();
  reg = K.laggTillMedlem(reg, { namn: 'Exempel Person', kategori: 'vuxen' }).reg;
  const m = reg.medlemmar[0].id;
  reg = K.registreraBetalning(reg, { datum: '2031-02-01', belopp: kr(300), termin: 'VT-31', arId: '2031', ver: 7, poster: [{ medlem: m, typ: 'termin', belopp: kr(300) }] });
  assert.equal(K.foraldradeBetalningar(reg, { 2031: { verifikationer: [{ nr: 7 }], bankrader: [] } }).length, 0);
  assert.equal(K.foraldradeBetalningar(reg, { 2031: { verifikationer: [], bankrader: [] } }).length, 1);
});

test('Swish från ett privat mobilnummer föreslås inte som betalning av en faktura till en organisation', () => {
  let ar = K.skapaAr({ start: '2031-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.laggTillUnderlag(ar, { id: 'f1', datum: '2031-01-16', motpart: 'Exempelkortet', belopp: kr(1300), riktning: 'intakt', fakturanummer: '4711', filnamn: 'f1.pdf' });
  ar = K.laggTillUnderlag(ar, { id: 'f2', datum: '2031-02-01', motpart: 'Exempelkortet', belopp: kr(800), riktning: 'intakt', fakturanummer: '4712', filnamn: 'f2.pdf' });
  ar = K.importeraBankrader(ar, [
    { datum: '2031-01-08', text: 'Swish +46700000001', referens: '', belopp: kr(1300), saldo: null },
    { datum: '2031-01-18', text: 'Swish +46700000002', referens: '', belopp: kr(1300), saldo: null },
    { datum: '2031-01-19', text: 'Swish +46700000003', referens: 'Faktura 4711', belopp: kr(1300), saldo: null },
    { datum: '2031-01-20', text: 'Bg-inbetalning Exempelkortet', referens: '', belopp: kr(1300), saldo: null },
    { datum: '2031-01-20', text: 'Bg-inbetalning', referens: '', belopp: kr(800), saldo: null }]).ar;
  const rad = (i) => ar.bankrader.filter((r) => r.belopp > 0)[i];
  const troliga = (r) => K.trolligaUnderlag(ar, r).map((t) => t.underlag.id);
  const r = ar.bankrader.slice().sort((a, b) => (a.datum + a.text < b.datum + b.text ? -1 : 1));
  const hitta = (text) => r.find((x) => x.text === text);
  assert.deepEqual(json(troliga(hitta('Swish +46700000001'))), [], 'före fakturadatum och från ett mobilnummer');
  assert.deepEqual(json(K.matchaUnderlag(ar, hitta('Swish +46700000002'))), [], 'mobilnummer utan fakturans namn eller nummer');
  assert.deepEqual(json(troliga(hitta('Swish +46700000002'))), []);
  assert.deepEqual(json(K.matchaUnderlag(ar, hitta('Swish +46700000003'))), ['f1'], 'fakturanumret står i referensen');
  assert.deepEqual(json(K.matchaUnderlag(ar, hitta('Bg-inbetalning Exempelkortet'))), ['f1'], 'bankgiro utan mobilnummer matchas som förut');
  const tidig = ar.bankrader.find((x) => x.belopp === kr(800));
  assert.equal(K.osannoliktUnderlag(ar.underlag.find((u) => u.id === 'f2'), tidig), true, 'tolv dagar före fakturadatum');
  assert.ok(rad(0));
});
