import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { K } from './ladda-karna.mjs';

// Alla namn och e-postadresser är påhittade.
const json = (x) => JSON.parse(JSON.stringify(x));
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const ANNA = 'anna@example.se', BO = 'bo@example.se', CILLA = 'cilla@example.se';

function medMote(typ = 'styrelse', extra = {}) {
  const r = K.nyttMote(K.tomStyrelse(), Object.assign({ typ, datum: '2030-03-10', plats: 'Lokalen' }, extra));
  return { styr: r.styr, id: r.mote.id };
}

test('ett styrelsemöte skapas med mall och kan ändras som utkast', () => {
  let { styr, id } = medMote();
  const m = styr.moten[0];
  assert.equal(m.status, 'utkast');
  assert.equal(m.paragrafer[0].rubrik, 'Mötets öppnande');
  styr = K.andraMote(styr, id, { narvarande: 'Anna, Bo', beslut: [{ text: 'Köpa nya mattor', belopp: 250000 }], status: 'signerat' });
  assert.equal(styr.moten[0].narvarande, 'Anna, Bo');
  assert.equal(styr.moten[0].status, 'utkast', 'status kan inte ändras direkt');
  assert.throws(() => K.nyttMote(K.tomStyrelse(), { typ: 'styrelse', datum: '' }), /datum/);
  assert.throws(() => K.nyttMote(K.tomStyrelse(), { typ: 'fest', datum: '2030-01-01' }), /mötestyp/);
});

test('årsmötets protokoll får föredragningslistan och konstituerande möte firmatecknare', () => {
  const a = medMote('arsmote', { dagordning: '1. Fastställande av röstlängd\n2. Val av ordförande för mötet' }).styr.moten[0];
  assert.deepEqual(json(a.paragrafer.map((p) => p.rubrik)), ['Mötets öppnande', 'Fastställande av röstlängd', 'Val av ordförande för mötet', 'Mötets avslutande']);
  const k = medMote('konstituerande').styr.moten[0];
  assert.ok(k.paragrafer.some((p) => p.rubrik === 'Firmatecknare'));
});

test('mötets funktionärer är skilda från rollerna i appen', () => {
  // Styrelsens sekreterare (Anna) är inte mötessekreterare på årsmötet; en extern mötesordförande utan konto.
  let { styr, id } = medMote('arsmote', { funktionarer: { ordforande: { namn: 'Extern Person' }, sekreterare: { namn: 'Bo', epost: 'BO@example.se' }, justerare: [{ namn: 'Cilla', epost: CILLA }, { namn: '' }] } });
  const m = styr.moten[0];
  assert.equal(m.funktionarer.sekreterare.epost, BO);
  assert.equal(m.funktionarer.justerare.length, 1);
  assert.match(K.protokolltext(m), /Mötesordförande: Extern Person/);
  const f = K.forslagUndertecknare(m, (e) => [ANNA, BO, CILLA].includes(e));
  assert.deepEqual(json(f.undertecknare.map((x) => x.epost)), [BO, CILLA]);
  assert.deepEqual(json(f.saknas.map((x) => x.namn)), ['Extern Person']);
  assert.equal(f.metod, 'papper', 'någon saknar konto, så papper föreslås');
  // Alla har konto: elektroniskt föreslås. Samma person i två funktioner skriver under en gång.
  styr = K.andraMote(styr, id, { funktionarer: { ordforande: { namn: 'Bo', epost: BO }, sekreterare: { namn: 'Bo', epost: BO }, justerare: [{ namn: 'Cilla', epost: CILLA }] } });
  const g = K.forslagUndertecknare(styr.moten[0], () => true);
  assert.equal(g.metod, 'e');
  assert.equal(g.undertecknare.length, 2);
  assert.equal(g.undertecknare[0].roll, 'Mötesordförande och mötessekreterare');
});

test('elektronisk underskrift: låsning, signering och kontroll', () => {
  let { styr, id } = medMote();
  styr = K.andraMote(styr, id, { beslut: [{ text: 'Köpa mattor', belopp: 250000 }] });
  const text = K.protokolltext(styr.moten[0]);
  assert.match(text, /Köpa mattor \(2.500,00 kr\)/);
  const summa = sha(text);
  assert.throws(() => K.lasForUnderskrift(styr, id, 'e', [], summa), /skriva under/);
  assert.throws(() => K.lasForUnderskrift(styr, id, 'e', [{ epost: ANNA }], 'abc'), /Kontrollsumman/);
  styr = K.lasForUnderskrift(styr, id, 'e', [{ epost: ANNA, roll: 'Mötesordförande' }, { epost: 'Bo@example.se', roll: 'Justerare' }], summa, '2030-03-11T10:00');
  assert.equal(styr.moten[0].status, 'last');
  assert.throws(() => K.andraMote(styr, id, { plats: 'Annan' }), /låst/);
  assert.throws(() => K.taBortMote(styr, id), /låst/);
  assert.throws(() => K.signera(styr, id, CILLA, 'Cilla', summa), /står inte bland/);
  assert.throws(() => K.signera(styr, id, ANNA, 'Anna', sha(text + 'x')), /ändrats/);
  styr = K.signera(styr, id, ANNA, 'Anna', summa, '2030-03-11T11:00');
  assert.equal(styr.moten[0].status, 'last');
  assert.throws(() => K.signera(styr, id, ANNA, 'Anna', summa), /redan skrivit under/);
  assert.throws(() => K.lasUppProtokoll(styr, id), /redan skrivit under/);
  styr = K.signera(styr, id, BO, 'Bo', summa, '2030-03-11T12:00');
  assert.equal(styr.moten[0].status, 'signerat');
  assert.equal(K.kontrolleraUnderskrifter(styr.moten[0], summa).ok, true);
  // Någon ändrar i filen efteråt: kontrollen upptäcker det.
  const manipulerat = json(styr.moten[0]);
  manipulerat.beslut[0].text = 'Köpa en bil';
  const k = K.kontrolleraUnderskrifter(manipulerat, sha(K.protokolltext(manipulerat)));
  assert.equal(k.ok, false);
  assert.equal(k.andrad, true);
});

test('låst protokoll kan låsas upp så länge ingen har skrivit under', () => {
  let { styr, id } = medMote();
  const summa = sha(K.protokolltext(styr.moten[0]));
  styr = K.lasForUnderskrift(styr, id, 'e', [{ epost: ANNA }], summa);
  styr = K.lasUppProtokoll(styr, id);
  assert.equal(styr.moten[0].status, 'utkast');
  assert.equal(styr.moten[0].underskrift, undefined);
  assert.throws(() => K.lasForUnderskrift(styr, id, 'blyerts', [], summa), /papper/);
});

test('underskrift på papper: inskannad fil gör protokollet undertecknat', () => {
  let { styr, id } = medMote();
  const summa = sha(K.protokolltext(styr.moten[0]));
  styr = K.lasForUnderskrift(styr, id, 'papper', [], summa);
  assert.equal(K.kontrolleraUnderskrifter(styr.moten[0], summa).ok, false);
  assert.throws(() => K.signera(styr, id, ANNA, 'Anna', summa), /elektronisk/);
  assert.throws(() => K.registreraPapper(styr, id, {}), /inskannade/);
  styr = K.registreraPapper(styr, id, { namn: 'protokoll.pdf', odId: 'X1' }, '2030-03-20');
  assert.equal(styr.moten[0].status, 'signerat');
  assert.equal(K.kontrolleraUnderskrifter(styr.moten[0], summa).ok, true);
  assert.throws(() => K.lasUppProtokoll(styr, id), /redan skrivit under/);
});

test('beslutslogg över alla möten, nyast först', () => {
  let styr = K.tomStyrelse();
  let r = K.nyttMote(styr, { typ: 'styrelse', datum: '2030-01-10' }); styr = K.andraMote(r.styr, r.mote.id, { beslut: [{ text: 'A' }, { text: 'B', verifikation: 'V12' }] });
  r = K.nyttMote(styr, { typ: 'styrelse', datum: '2030-02-10' }); styr = K.andraMote(r.styr, r.mote.id, { beslut: [{ text: 'C', belopp: 100 }] });
  const logg = K.beslutslogg(styr);
  assert.deepEqual(json(logg.map((b) => b.text)), ['C', 'A', 'B']);
  assert.equal(logg[2].verifikation, 'V12');
});

test('uppgifter, årsmötets checklista och ärenden', () => {
  let styr = K.laggTillUppgift(K.tomStyrelse(), { text: 'Boka lokal', ansvarig: 'Anna', datum: '2030-02-01' });
  assert.throws(() => K.laggTillUppgift(styr, { text: ' ' }), /göras/);
  const id = styr.uppgifter[0].id;
  styr = K.andraUppgift(styr, id, { klar: true });
  assert.equal(styr.uppgifter[0].klar, true);
  styr = K.taBortUppgift(styr, id);
  assert.equal(styr.uppgifter.length, 0);
  const lista = K.arsmotesUppgifter('2030-03-15');
  assert.equal(lista.find((x) => x.text === 'Kallelsens text').datum, '2030-02-15');
  assert.equal(lista.find((x) => x.text.startsWith('Revisionsberättelse')).datum, '2030-03-01');
  assert.equal(lista.find((x) => x.text.includes('Idrottsportalen')).datum, '2030-04-26');
  styr = K.laggTillArende(styr, { text: 'Rösträtt från 12 år', typ: 'stadgar' });
  assert.equal(styr.arenden[0].status, 'forslag');
  styr = K.andraArende(styr, styr.arenden[0].id, { status: 'antaget' });
  assert.equal(styr.arenden[0].status, 'antaget');
});

test('förtroendeuppdrag och mandat som går ut', () => {
  let u = K.laggTillUppdrag(K.tomaUppdrag(), { roll: 'Ordförande', namn: 'Anna', vald: '2029-03-01', till: '2031-03-01' });
  u = K.laggTillUppdrag(u, { roll: 'Revisor', namn: 'Bo', apelido: 'Pé', vald: '2029-03-01', till: '2030-03-01' });
  assert.throws(() => K.laggTillUppdrag(u, { roll: 'Ledamot' }), /namn/);
  assert.deepEqual(json(K.uppdragSomGarUt(u, '2030-06-01').map((x) => x.namn)), ['Bo']);
  u = K.taBortUppdrag(u, u.uppdrag[1].id);
  assert.equal(u.uppdrag.length, 1);
  assert.equal(K.normaliseraUppdrag(null).uppdrag.length, 0);
  assert.deepEqual(json(K.normaliseraStyrelse({ moten: [1] }).uppgifter), []);
});

test('samtidiga ändringar slås ihop post för post, och krockar visas', () => {
  let bas = K.laggTillUppgift(K.tomStyrelse(), { text: 'A' });
  bas = K.laggTillUppgift(bas, { text: 'B' });
  bas = K.laggTillUppgift(bas, { text: 'C' });
  const [a, b, c] = bas.uppgifter.map((u) => u.id);
  // Jag: bockar av A, tar bort C och lägger till D. Någon annan: ändrar B och lägger till E.
  let mitt = K.andraUppgift(bas, a, { klar: true });
  mitt = K.taBortUppgift(mitt, c);
  mitt = K.laggTillUppgift(mitt, { text: 'D' });
  let fjarr = K.andraUppgift(bas, b, { text: 'B2' });
  fjarr = K.laggTillUppgift(fjarr, { text: 'E' });
  let r = K.slaIhopPoster(bas, mitt, fjarr, ['uppgifter']);
  assert.deepEqual(json(r.data.uppgifter.map((u) => u.text + (u.klar ? '✓' : ''))), ['A✓', 'B2', 'E', 'D']);
  assert.equal(r.krockar.length, 0);
  // Båda ändrar B: deras version gäller och min sparas som krock.
  mitt = K.andraUppgift(bas, b, { text: 'B-min' });
  r = K.slaIhopPoster(bas, mitt, fjarr, ['uppgifter']);
  assert.equal(r.data.uppgifter.find((u) => u.id === b).text, 'B2');
  assert.equal(r.krockar.length, 1);
  assert.equal(r.krockar[0].min.text, 'B-min');
  // Samma ändring på båda håll är ingen krock.
  r = K.slaIhopPoster(bas, fjarr, fjarr, ['uppgifter']);
  assert.equal(r.krockar.length, 0);
});

test('rollfilen minns styrelsens mapp och uppdragsfilen', () => {
  let f = K.nyRollfil(ANNA);
  f = Object.assign(f, { styrMapp: { driveId: 'D', id: 'S' }, uppdragFil: { driveId: 'D', id: 'U' } });
  const l = K.lasRollfil(json(f));
  assert.equal(l.styrMapp.id, 'S');
  assert.equal(l.uppdragFil.id, 'U');
});
