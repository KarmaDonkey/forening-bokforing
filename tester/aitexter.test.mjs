import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const mote = { typ: 'styrelse', datum: '2031-11-12', paragrafer: [
  { rubrik: 'Mötets öppnande', text: 'Ordföranden öppnade mötet.' },
  { rubrik: 'Ekonomi', text: '' },
  { rubrik: 'Övriga frågor', text: '' }] };

test('protokolluppdraget innehåller paragraferna och anteckningarna, men inga personnummer', () => {
  const u = K.protokollUppdrag(mote, 'Kassören redovisade. Firmatecknare 19800101-1234 kvar.');
  assert.match(u.text, /1\. Mötets öppnande: Ordföranden öppnade mötet\./);
  assert.match(u.text, /2\. Ekonomi/);
  assert.match(u.text, /Kassören redovisade/);
  assert.doesNotMatch(u.text, /1234/);
  assert.match(u.system, /Hitta aldrig på/);
  assert.deepEqual(json(u.schema.required), ['paragrafer', 'beslut', 'uppgifter']);
});

test('utkastet behåller mötets paragrafer och tolkar beslut och uppgifter', () => {
  const svar = {
    paragrafer: [{ rubrik: 'Ekonomi', text: 'Kassören redovisade läget. Saldot är god.' }, { rubrik: 'Ny paragraf', text: 'Ska inte med' }],
    beslut: [{ text: 'att höja terminsavgiften', belopp: '1 400 kr' }, { text: 'att köpa matta', belopp: '' }, { text: '', belopp: '5' }],
    uppgifter: [{ text: 'Kolla lokal', ansvarig: 'Anna', datum: '2031-12-01' }, { text: 'Ring kommunen', ansvarig: 'Bo', datum: 'nästa vecka' }]
  };
  const u = K.normaliseraProtokollutkast(svar, mote);
  assert.deepEqual(json(u.paragrafer.map((p) => p.rubrik)), ['Mötets öppnande', 'Ekonomi', 'Övriga frågor']);
  assert.equal(u.paragrafer[0].text, 'Ordföranden öppnade mötet.', 'befintlig text behålls');
  assert.equal(u.paragrafer[1].text, 'Kassören redovisade läget. Saldot är god.');
  assert.deepEqual(json(u.beslut), [{ text: 'att höja terminsavgiften', belopp: 140000, verifikation: null }, { text: 'att köpa matta', belopp: 0, verifikation: null }]);
  assert.deepEqual(json(u.uppgifter), [{ text: 'Kolla lokal', ansvarig: 'Anna', datum: '2031-12-01' }, { text: 'Ring kommunen', ansvarig: 'Bo', datum: '' }]);
});

test('ett trasigt svar ger mötets egna paragrafer och inga beslut', () => {
  const u = K.normaliseraProtokollutkast(null, mote);
  assert.deepEqual(json(u.paragrafer), json(mote.paragrafer));
  assert.deepEqual(json(u.beslut), []);
  assert.deepEqual(json(u.uppgifter), []);
  const p = K.normaliseraProtokollutkast({ paragrafer: [{ rubrik: 'Ekonomi', text: 'Nr 19800101-1234' }] }, mote);
  assert.equal(p.paragrafer[1].text, 'Nr …', 'personnummer tas bort även i svaret');
});

test('fakta till verksamhetsberättelsen och uppdragen', () => {
  const f = K.verksamhetsfakta({ forening: 'Testföreningen', ar: '2031', moten: [{ typ: 'styrelse' }, { typ: 'styrelse' }, { typ: 'arsmote' }],
    beslut: [{ datum: '2031-03-01', text: 'att höja avgiften' }], medlemmar: [{ termin: 'VT-31', antal: 14 }, { termin: 'HT-31', antal: 16 }],
    ekonomitext: 'Intäkterna var 86 200 kr.' });
  assert.match(f, /Möten under året: 2 styrelse, 1 arsmote/);
  assert.match(f, /2031-03-01: att höja avgiften/);
  assert.match(f, /VT-31 14, HT-31 16/);
  assert.match(f, /Intäkterna var 86 200 kr\./);
  assert.equal(K.verksamhetsberattelseUppdrag(f).text, f);
  const k = K.kallelseUppdrag({ forening: 'Testföreningen', datum: '2032-03-15', dagordning: '1. Mötets öppnande' });
  assert.match(k.text, /Tid: \[tid\]/);
  assert.match(k.text, /1\. Mötets öppnande/);
});

test('tal i texten som inte finns i underlaget hittas', () => {
  const fakta = 'Intäkterna var 86 200 kr och kostnaderna 73 750 kr. 16 medlemmar.';
  assert.deepEqual(json(K.siffrorUtanforFakta('Intäkterna var 86 200 kr, kostnaderna 73 750 kr. 16 medlemmar under 2031.', fakta)), []);
  assert.deepEqual(json(K.siffrorUtanforFakta('Resultatet blev 12 450 kr och 86 200 kr i intäkter.', fakta)), ['12450']);
  assert.deepEqual(json(K.siffrorUtanforFakta('Vi fick 86 200,00 kr.', fakta)), []);
});
