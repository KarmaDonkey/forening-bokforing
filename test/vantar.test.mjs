import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const jag = 'anna@exempel.se';

function styr() {
  const und = (alla, klara) => ({ metod: 'e', undertecknare: alla.map((epost) => ({ epost })), signaturer: klara.map((epost) => ({ epost })) });
  return {
    moten: [
      { id: 'm1', typ: 'styrelse', datum: '2031-11-12', status: 'last', underskrift: und([jag, 'bo@exempel.se'], ['bo@exempel.se']) },
      { id: 'm2', typ: 'styrelse', datum: '2031-10-01', status: 'last', underskrift: und([jag, 'bo@exempel.se'], [jag]) },
      { id: 'm3', typ: 'arsmote', datum: '2031-09-01', status: 'last', underskrift: { metod: 'papper', undertecknare: [{ epost: jag }], signaturer: [] } },
      { id: 'm4', typ: 'styrelse', datum: '2031-12-09', tid: '18:30', status: 'utkast' },
      { id: 'm5', typ: 'styrelse', datum: '2032-01-15', status: 'utkast' },
      { id: 'm6', typ: 'styrelse', datum: '2031-11-01', status: 'utkast' }
    ],
    rapporter: [
      { id: 'r1', titel: 'Årsrapport 2030', ersatt: false, undertecknare: [{ epost: jag }, { epost: 'bo@exempel.se' }], signaturer: [] },
      { id: 'r0', titel: 'Årsrapport 2030', ersatt: true, undertecknare: [{ epost: jag }], signaturer: [] }
    ],
    uppgifter: [
      { id: 'u1', text: 'Boka lokal', ansvarig: 'Anna', datum: '2031-11-20', klar: false },
      { id: 'u2', text: 'Beställ dräkter', ansvarig: 'Åsa', datum: '', klar: false },
      { id: 'u3', text: 'Skriv verksamhetsberättelse', ansvarig: 'anna exempelsson', datum: '2032-01-10', klar: false },
      { id: 'u4', text: 'Klar sak', ansvarig: 'Anna', datum: '', klar: true },
      { id: 'u5', text: 'Kontakta kommunen', ansvarig: 'Anna B', datum: '', klar: false },
      { id: 'u6', text: 'Utan ansvarig', ansvarig: '', datum: '', klar: false }
    ]
  };
}

test('protokoll och årsrapporter som väntar på min underskrift', () => {
  const v = K.vantarPaMig(styr(), 'Anna@Exempel.se', { namn: 'Anna Exempelsson', idag: '2031-11-28' });
  assert.deepEqual(json(v.protokoll), [{ id: 'm1', typ: 'styrelse', datum: '2031-11-12', signerade: 1, antal: 2 }]);
  assert.deepEqual(json(v.arsrapporter), [{ id: 'r1', titel: 'Årsrapport 2030', signerade: 0, antal: 2 }]);
});

test('mina uppgifter efter namn, sena först markerade', () => {
  const v = K.vantarPaMig(styr(), jag, { namn: 'Anna Exempelsson', idag: '2031-11-28' });
  assert.deepEqual(json(v.uppgifter.map((u) => [u.id, u.sen])), [['u1', true], ['u3', false]]);
  const b = K.vantarPaMig(styr(), 'bo@exempel.se', { namn: 'Bo Exempelsson', idag: '2031-11-28' });
  assert.deepEqual(json(b.uppgifter), []);
  assert.deepEqual(json(b.protokoll.map((x) => x.id)), ['m2'], 'Bo har skrivit under m1 men inte m2');
});

test('nästa möte är det första planerade från och med idag', () => {
  const v = K.vantarPaMig(styr(), jag, { namn: 'Anna', idag: '2031-11-28' });
  assert.deepEqual(json(v.nastaMote), { id: 'm4', typ: 'styrelse', datum: '2031-12-09', tid: '18:30', plats: '' });
  assert.equal(K.vantarPaMig(styr(), jag, { idag: '2032-02-01' }).nastaMote, null);
});

test('tom styrelse och okänd person', () => {
  const tom = K.vantarPaMig({ moten: [], uppgifter: [] }, jag, {});
  assert.deepEqual(json(tom), { protokoll: [], arsrapporter: [], uppgifter: [], nastaMote: null });
  assert.deepEqual(json(K.vantarPaMig(styr(), '', { idag: '2031-11-28' }).uppgifter), []);
});
