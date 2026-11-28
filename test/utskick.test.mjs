import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const personer = [{ epost: 'anna@exempel.se', namn: 'Anna Exempelsson' }, { epost: 'bo@exempel.se', namn: 'Bo Test' }];

function styr() {
  let s = K.tomStyrelse();
  s = K.laggTillUppgift(s, { text: 'Boka lokal', ansvarig: 'Anna Exempelsson', ansvarigEpost: 'anna@exempel.se', datum: '2026-11-20' });
  const uid = s.uppgifter[0].id;
  s = K.laggTillKommentar(s, { typ: 'uppgift', mal: uid, text: 'Har vi fått offerten?', av: 'bo@exempel.se', avNamn: 'Bo Test', tid: '2026-11-25T10:00:00Z' }, personer);
  s = K.laggTillKommentar(s, { typ: 'mote', mal: 'm1', text: '@Anna kan du kolla § 4?', av: 'bo@exempel.se', avNamn: 'Bo Test', tid: '2026-11-26T10:00:00Z' }, personer);
  s = K.laggTillKommentar(s, { typ: 'mote', mal: 'm1', text: 'Jag fixar det', av: 'anna@exempel.se', avNamn: 'Anna Exempelsson', tid: '2026-11-27T10:00:00Z' }, personer);
  return { s, uid };
}

test('kommentarer med @ och kommentarer till en person', () => {
  const { s, uid } = styr();
  assert.deepEqual(json(s.kommentarer[1].namnda), ['anna@exempel.se']);
  assert.deepEqual(json(K.kommentarerFor(s, 'mote', 'm1').map((k) => k.text)), ['@Anna kan du kolla § 4?', 'Jag fixar det']);
  assert.deepEqual(json(K.kommentarerTill(s, 'anna@exempel.se').map((k) => k.text)), ['Har vi fått offerten?', '@Anna kan du kolla § 4?'], 'på egen uppgift och nämnd, inte egna');
  assert.deepEqual(json(K.kommentarerTill(s, 'anna@exempel.se', '2026-11-25T12:00:00Z').map((k) => k.text)), ['@Anna kan du kolla § 4?'], 'bara nya');
  assert.equal(K.kommentarerFor(s, 'uppgift', uid).length, 1);
  assert.throws(() => K.laggTillKommentar(s, { typ: 'annat', mal: 'x', text: 'a' }, personer), /Okänd typ/);
  assert.throws(() => K.laggTillKommentar(s, { typ: 'mote', mal: 'x', text: ' ' }, personer), /Skriv en kommentar/);
});

test('djuplänkar', () => {
  assert.equal(K.djuplank('https://exempel.se/app/#gammal', 'uppgift', 'up1'), 'https://exempel.se/app/#uppgift=up1');
  assert.deepEqual(json(K.tolkaDjuplank('#mote=mo%201')), { typ: 'mote', id: 'mo 1' });
  assert.equal(K.tolkaDjuplank('#annat=1'), null);
});

test('påminnelse per person, och ingen när inget väntar', () => {
  const { s } = styr();
  const p = K.paminnelseFor(s, personer[0], '', '2026-11-28');
  assert.equal(p.uppgifter.length, 1);
  assert.equal(p.kommentarer.length, 2);
  const m = K.paminnelseMejl(p, { forening: 'Testföreningen', lank: 'https://exempel.se/app/', fran: 'Bo Test' });
  assert.equal(m.till, 'anna@exempel.se');
  assert.equal(m.amne, 'Det här väntar på dig i Testföreningen');
  assert.match(m.text, /^Hej Anna!/);
  assert.match(m.text, /Bo Test: @Anna kan du kolla § 4\? https:\/\/exempel\.se\/app\/#mote=m1/);
  assert.match(m.text, /Boka lokal \(skulle vara klar 2026-11-20\) https:\/\/exempel\.se\/app\/#uppgift=/);
  assert.equal(K.paminnelseFor(s, personer[1], '', '2026-11-28'), null, 'Bo har inget som väntar');
});

test('mallar, WhatsApp och mejl till många', () => {
  const v = K.utskickMall('valkommen', { forening: 'Testföreningen', ar: '2027', personer: [{ namn: 'Anna Exempelsson', roller: 'Ordförande', mandat: 'årsmötet 2028' }], lank: 'https://exempel.se/app/', fran: 'Bo' });
  assert.equal(v.amne, 'Välkommen till styrelsen i Testföreningen');
  assert.match(v.text, /- Anna Exempelsson, Ordförande \(till årsmötet 2028\)/);
  const a = K.utskickMall('arsmote', { datum: '2027-03-15', frister: [{ datum: '2027-02-15', text: 'Kallelse skickas' }], uppgifter: [{ text: 'Boka lokal', ansvarig: 'Anna', datum: '2027-02-01' }] });
  assert.match(a.text, /- 2027-02-15: Kallelse skickas/);
  assert.match(a.text, /- Boka lokal \(Anna\), senast 2027-02-01/);
  const w = K.whatsappText(a.amne, a.text, 'https://exempel.se/app/');
  assert.match(w, /^\*Dags att förbereda årsmötet 2027-03-15\*\n/);
  assert.match(w, /Läs mer i Plätt: https:\/\/exempel\.se\/app\/$/);
  assert.doesNotMatch(w, /Hej alla/);
  assert.match(K.mailtoMangaLank(['a@x.se', 'b@x.se'], 'Ämne', 'Text'), /^mailto:\?bcc=a%40x\.se,b%40x\.se&subject=%C3%84mne&body=Text$/);
});

test('inloggning med föreningskonton', () => {
  assert.equal(K.odAuktoritet(), 'https://login.microsoftonline.com/consumers');
  assert.equal(K.odAuktoritet('privat'), 'https://login.microsoftonline.com/consumers');
  assert.equal(K.odAuktoritet('forening'), 'https://login.microsoftonline.com/organizations');
  assert.equal(K.odAuktoritet('alla'), 'https://login.microsoftonline.com/common');
  assert.match(K.AVSANDARE_OMFANG, /Mail\.Send/);
  assert.doesNotMatch(K.AVSANDARE_OMFANG, /Files/, 'avsändarkontot får inte läsa filer');
  assert.match(K.inloggningsfelText('unauthorized_client', 'AADSTS50194: Application is not configured as a multi-tenant application.', 'forening'), /Supported account types/);
  assert.match(K.inloggningsfelText('consent_required', 'AADSTS65001: The user or administrator has not consented', 'forening'), /administratör godkänner/);
  assert.match(K.inloggningsfelText('access_denied', '', 'privat'), /Försök igen/);
  assert.equal(K.inloggningsfelText('x', 'Något annat', 'privat'), 'Inloggningen avbröts: Något annat');
});
