import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// All testdata är påhittad.
const json = (x) => JSON.parse(JSON.stringify(x));
let n = 0;
const id = () => 'id' + (++n);

const fil = {
  format: 'foreningsbokforing-forening',
  forening: { namn: 'Påhittade föreningen', orgnr: '000000-0000', bankgiro: '000-0000', webb: 'example.se', epost: 'info@example.se', swish: '1230000000' },
  adresser: [{ etikett: 'Kassören', text: 'C/o Kassör\nGatan 1\n111 11 Staden' }],
  kontakter: [{ namn: 'Kim Kassör', epost: 'kim@example.se', mobil: '070-000 00 00' }],
  artiklar: [{ beskrivning: 'Terminsavgift vuxna', pris: 270000, konto: '3100' }, { beskrivning: 'Terminsavgift barn', pris: 130000, konto: '3100' }]
};

test('fyller i en tom förening', () => {
  n = 0;
  const r = K.slaIhopForening({ forening: {} }, fil, id);
  assert.deepEqual(json(r.antal), { uppgifter: 6, adresser: 1, kontakter: 1, artiklar: 2 });
  assert.equal(r.data.forening.bankgiro, '000-0000');
  assert.deepEqual(json(r.data.artiklar[1]), { id: 'id4', beskrivning: 'Terminsavgift barn', pris: 130000, konto: '3100' });
});

test('behåller det som redan finns och lägger inte till dubbletter', () => {
  const befintligt = {
    forening: { namn: 'Eget namn', bankgiro: '' },
    adresser: [{ id: 'a', etikett: '', text: 'c/o kassör\ngatan 1\n111 11 staden' }],
    kontakter: [{ id: 'k', namn: 'KIM KASSÖR', epost: '', mobil: '' }],
    artiklar: [{ id: 'x', beskrivning: 'Terminsavgift vuxna', pris: 250000, konto: '3100' }]
  };
  const r = K.slaIhopForening(befintligt, fil, id);
  assert.equal(r.data.forening.namn, 'Eget namn');
  assert.equal(r.data.forening.bankgiro, '000-0000');
  assert.deepEqual(json(r.antal), { uppgifter: 5, adresser: 0, kontakter: 0, artiklar: 1 });
  assert.equal(r.data.artiklar.find((a) => a.id === 'x').pris, 250000);
  assert.equal(befintligt.artiklar.length, 1);
});

test('avvisar fel filer och ogiltiga artiklar', () => {
  assert.throws(() => K.slaIhopForening({ forening: {} }, { format: 'annat' }, id), /inga föreningsuppgifter/);
  assert.throws(() => K.slaIhopForening({ forening: {} }, { format: 'foreningsbokforing-forening', artiklar: [{ beskrivning: 'X', pris: 1.5 }] }, id), /Artikel 1/);
  assert.throws(() => K.slaIhopForening({ forening: {} }, { format: 'foreningsbokforing-forening', artiklar: [{ beskrivning: 'X', pris: 100, konto: 'abc' }] }, id), /konto/);
});

test('AI-hjälpen är på om föreningen inte stängt av den', () => {
  assert.equal(K.aiHjalpPa(undefined), true);
  assert.equal(K.aiHjalpPa({ namn: 'Testföreningen' }), true, 'äldre föreningar utan inställning');
  assert.equal(K.aiHjalpPa({ aiHjalp: true }), true);
  assert.equal(K.aiHjalpPa({ aiHjalp: false }), false);
});
