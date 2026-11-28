import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const personer = [{ epost: 'anna@exempel.se', namn: 'Anna Exempelsson' }, { epost: 'bo@exempel.se', namn: 'Bo Test' }, { epost: 'bo2@exempel.se', namn: 'Bo Prov' }, { epost: 'asa@exempel.se', namn: 'Åsa Lund' }];

test('@ hittar personen på förnamn eller hela namnet', () => {
  assert.deepEqual(json(K.hittaOmnamnanden('Boka lokal @Anna', personer).map((x) => x.epost)), ['anna@exempel.se']);
  assert.deepEqual(json(K.hittaOmnamnanden('@Bo Prov ringer kommunen', personer).map((x) => x.epost)), ['bo2@exempel.se']);
  assert.deepEqual(json(K.hittaOmnamnanden('@Bo ringer', personer)), [], 'två heter Bo');
  assert.deepEqual(json(K.hittaOmnamnanden('@asa fixar', personer).map((x) => x.epost)), ['asa@exempel.se'], 'utan prickar');
  assert.deepEqual(json(K.hittaOmnamnanden('mejla info@exempel.se', personer)), []);
});

test('uppgift ur text: personen blir ansvarig och @ tas bort', () => {
  assert.deepEqual(json(K.uppgiftFranText('Boka lokal till vårterminen @Anna', personer)),
    { text: 'Boka lokal till vårterminen Anna', ansvarig: 'Anna Exempelsson', ansvarigEpost: 'anna@exempel.se' });
  assert.equal(K.uppgiftFranText('Ingen nämnd', personer), null);
});

test('datum i texten', () => {
  assert.equal(K.datumIText('klart 2026-12-01', '2026-11-12'), '2026-12-01');
  assert.equal(K.datumIText('kollar lokal till 1 dec', '2026-11-12'), '2026-12-01');
  assert.equal(K.datumIText('senast 15 januari', '2026-11-12'), '2027-01-15', 'passerad dag blir nästa år');
  assert.equal(K.datumIText('snart', '2026-11-12'), '');
});

test('uppgifter ur protokollet', () => {
  const mote = { datum: '2026-11-12', paragrafer: [{ rubrik: 'Lokal', text: 'Lokalen diskuterades. @Anna kollar ny lokal till 1 dec. Inget mer.' }, { rubrik: 'Övrigt', text: '' }],
    beslut: [{ text: 'att köpa mattor, @Åsa beställer' }] };
  assert.deepEqual(json(K.uppgifterIProtokoll(mote, personer)), [
    { text: 'Anna kollar ny lokal till 1 dec.', ansvarig: 'Anna Exempelsson', ansvarigEpost: 'anna@exempel.se', datum: '2026-12-01' },
    { text: 'att köpa mattor, Åsa beställer', ansvarig: 'Åsa Lund', ansvarigEpost: 'asa@exempel.se', datum: '' }]);
});

test('ansvarig och tilldelad av sparas, och filtren Mina och Tilldelade av mig', () => {
  let s = K.tomStyrelse();
  s = K.laggTillUppgift(s, { text: 'A', ansvarig: 'Anna Exempelsson', ansvarigEpost: 'Anna@Exempel.se', tilldeladAv: 'bo@exempel.se' });
  s = K.laggTillUppgift(s, { text: 'B', ansvarig: 'Bo Test', ansvarigEpost: 'bo@exempel.se', tilldeladAv: 'bo@exempel.se' });
  s = K.laggTillUppgift(s, { text: 'C', ansvarig: 'Någon' });
  assert.equal(s.uppgifter[0].ansvarigEpost, 'anna@exempel.se');
  assert.deepEqual(json(K.filtreraUppgifter(s.uppgifter, 'bo@exempel.se', 'mina').map((u) => u.text)), ['B']);
  assert.deepEqual(json(K.filtreraUppgifter(s.uppgifter, 'bo@exempel.se', 'av-mig').map((u) => u.text)), ['A'], 'egna uppgifter räknas inte som tilldelade');
  assert.equal(K.filtreraUppgifter(s.uppgifter, 'bo@exempel.se', 'alla').length, 3);
  const v = K.vantarPaMig(Object.assign(s, { moten: [] }), 'anna@exempel.se', { namn: 'Bo Test', idag: '2026-11-28' });
  assert.deepEqual(json(v.uppgifter.map((u) => u.text)), ['A'], 'e-posten går före namnet');
});

test('mejl om en uppgift', () => {
  const m = K.uppgiftsmejl({ text: 'Boka lokal', ansvarig: 'Anna Exempelsson', ansvarigEpost: 'anna@exempel.se', datum: '2026-12-01' }, { forening: 'Testföreningen', fran: 'Bo Test', lank: 'https://exempel.se/app' });
  assert.equal(m.till, 'anna@exempel.se');
  assert.equal(m.amne, 'Uppgift: Boka lokal');
  assert.match(m.text, /^Hej Anna!/);
  assert.match(m.text, /Senast: 2026-12-01/);
  assert.match(K.mailtoLank(m), /^mailto:anna%40exempel\.se\?subject=Uppgift%3A%20Boka%20lokal&body=Hej%20Anna/);
  const g = K.grafMejl(m);
  assert.equal(g.message.toRecipients[0].emailAddress.address, 'anna@exempel.se');
  assert.equal(g.saveToSentItems, true);
});
