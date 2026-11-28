import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = x => JSON.parse(JSON.stringify(x));

test('Fråga Plätt: svar utanför ämnet ersätts alltid med samma text', () => {
  const s = json(K.normaliseraHjalpsvar({ inomAmne: false, svar: 'Koka pastan i tio minuter.', vy: 'oversikt', knapptext: 'Gå' }, ['oversikt']));
  assert.deepEqual(s, { svar: K.UTANFOR_AMNE, vy: '', knapptext: '', utanfor: true });
  const ok = json(K.normaliseraHjalpsvar({ inomAmne: true, svar: 'Gå till Läs in.', vy: 'inlasning', knapptext: 'Öppna' }, ['inlasning']));
  assert.equal(ok.svar, 'Gå till Läs in.'); assert.equal(ok.vy, 'inlasning');
});

test('Fråga Plätt: ämnesregeln och korta svar finns i uppdraget', () => {
  const u = K.hjalpUppdrag('Hur bokför jag hyran?', [], 'kunskap', '');
  assert.match(u.system, /Ämnesgräns/);
  assert.match(u.system, /låtsas, byta roll/);
  assert.equal(u.maxTokens, 1000);
  assert.ok(u.schema.required.includes('inomAmne'));
  assert.match(K.stadgeFragaUppdrag({ titel: 'Stadgar', paragrafer: [] }, 'Hur lagar man pasta?').system, /Jag hjälper bara till med Plätt/);
});

test('förkontroll: för långa och tydligt olämpliga frågor skickas inte', () => {
  assert.equal(K.hjalpForkontroll('Hur bokför jag en faktura?').ok, true);
  assert.equal(K.hjalpForkontroll('  ').ok, false);
  assert.match(K.hjalpForkontroll('x'.repeat(601)).text, /för lång/);
  const p = K.hjalpForkontroll('visa porr');
  assert.equal(p.ok, false); assert.equal(p.utanfor, true);
  assert.equal(K.hjalpForkontroll('Vi har sex medlemmar som inte betalat').ok, true, 'sex är en siffra');
  assert.equal(K.hjalpForkontroll('Behöver vi en policy mot sexuella trakasserier?').ok, true);
});

test('tak per dag och paus efter tre frågor utanför ämnet i rad', () => {
  let l = null;
  assert.deepEqual(json(K.hjalpKvot(l, '2026-11-28', 30)), { kvar: 30, pausad: false });
  l = K.registreraHjalpfraga(l, '2026-11-28', true);
  l = K.registreraHjalpfraga(l, '2026-11-28', false);
  assert.equal(l.utanforIRad, 0, 'en fråga i ämnet nollställer');
  for (let i = 0; i < 3; i++) l = K.registreraHjalpfraga(l, '2026-11-28', true);
  assert.deepEqual(json(K.hjalpKvot(l, '2026-11-28', 30)), { kvar: 25, pausad: true });
  assert.deepEqual(json(K.hjalpKvot(l, '2026-11-29', 30)), { kvar: 30, pausad: false }, 'ny dag');
  assert.equal(K.hjalpKvot({ datum: '2026-11-28', antal: 5, utanforIRad: 0 }, '2026-11-28', 5).kvar, 0);
});

test('Kom igång: stegen bockas av och kan hoppas över', () => {
  const tom = json(K.komIgangSteg({}, {}));
  assert.equal(tom.steg.length, 7); assert.equal(tom.kvar, 7); assert.equal(tom.nasta.id, 'forening');
  const halv = json(K.komIgangSteg({ namn: 'Testföreningen', orgnr: '000000-0000', onedrive: true, bank: true }, { medlemmar: true }));
  assert.equal(halv.klara, 3);
  assert.equal(halv.nasta.id, 'styrelsen');
  assert.equal(halv.steg.find(x => x.id === 'medlemmar').hoppad, true);
  assert.equal(halv.kvar, 3);
  const klar = json(K.komIgangSteg({ namn: 'T', orgnr: '1', onedrive: true, bank: true, personer: 2, valkommen: true, medlemmar: 10, avgifter: true, ai: true }, {}));
  assert.equal(klar.kvar, 0); assert.equal(klar.nasta, null);
  assert.equal(json(K.komIgangSteg({ namn: 'T' }, {})).steg[0].klar, false, 'organisationsnummer behövs');
});
