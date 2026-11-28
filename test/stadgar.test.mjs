import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat. Stadgarna nedan är exempel, inte en riktig förenings.
const json = (x) => JSON.parse(JSON.stringify(x));
const svarStruktur = { titel: 'Stadgar för Testföreningen', andringsregel: 'Två tredjedels majoritet på ett årsmöte.', paragrafer: [
  { nr: '§ 1', rubrik: 'Ändamål', text: 'Föreningen ska bedriva idrott för barn och unga.' },
  { nr: '2', rubrik: 'Säte', text: 'Föreningen har sitt säte i Stockholms kommun.' },
  { nr: '3', rubrik: 'Firmatecknare', text: 'Firman tecknas av 19800101-1234 och kassören.' },
  { nr: '4', rubrik: '', text: '' }] };

test('stadgarna delas upp i paragrafer, personnummer tas bort', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1', filnamn: 'stadgar.docx', inlast: '2026-11-28' });
  assert.equal(st.titel, 'Stadgar för Testföreningen');
  assert.deepEqual(json(st.paragrafer.map((p) => p.nr)), ['1', '2', '3'], 'tomma paragrafer tas bort och § skalas av');
  assert.equal(st.paragrafer[2].text, 'Firman tecknas av … och kassören.');
  assert.equal(st.andringsregel, 'Två tredjedels majoritet på ett årsmöte.');
  assert.match(K.stadgarSomText(st), /^§ 1 Ändamål\nFöreningen ska bedriva idrott/);
  assert.throws(() => K.normaliseraStadgar({ paragrafer: [] }), /Inga paragrafer/);
});

test('uppdraget för inläsning ber om ordagrann text', () => {
  const u = K.stadgeStrukturUppdrag('§1 Ändamål. Pnr 19800101-1234');
  assert.match(u.system, /ordagrant/);
  assert.doesNotMatch(u.text, /1234/);
  assert.equal(K.stadgeStrukturUppdrag('', { type: 'document' }).block.type, 'document');
});

test('kravlistorna finns med källor', () => {
  assert.ok(K.kravlista('stockholm').krav.some((k) => k[0] === 'sate'));
  assert.ok(K.kravlista('skatteverket').kallor[0].startsWith('https://skatteverket.se/'));
  assert.equal(K.kravlista('okand'), null);
  for (const l of K.KRAVLISTOR) assert.ok(l.krav.length && l.kontrollerad, l.id);
});

test('granskningen: ett resultat per krav, okänd status blir oklart, citat kontrolleras', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  const lista = K.kravlista('stockholm');
  const u = K.granskningsUppdrag(st, lista);
  assert.match(u.text, /- sate: Säte i Stockholm/);
  assert.match(u.text, /§ 2 Säte/);
  const g = K.normaliseraGranskning({ sammanfattning: 'Mest bra.', resultat: [
    { krav: 'sate', status: 'uppfylls', paragraf: '§ 2', citat: 'Föreningen har sitt säte i  Stockholms kommun.', kommentar: 'OK', forslag: 'ska inte med' },
    { krav: 'barnkonventionen', status: 'saknas', paragraf: '', citat: '', kommentar: 'Nämns inte.', forslag: 'Föreningen arbetar utifrån barnkonventionen.' },
    { krav: 'oppen', status: 'kanske', paragraf: '1', citat: 'Alla får vara med.', kommentar: '', forslag: '' }] }, lista, st);
  assert.deepEqual(json(g.resultat.map((r) => r.krav)), json(lista.krav.map((k) => k[0])));
  const r = Object.fromEntries(g.resultat.map((x) => [x.krav, x]));
  assert.equal(r.sate.status, 'uppfylls');
  assert.equal(r.sate.paragraf, '2');
  assert.equal(r.sate.forslag, '', 'inget förslag när kravet uppfylls');
  assert.equal(r.sate.citatOsakert, false, 'citatet finns i stadgarna (mellanslag spelar ingen roll)');
  assert.equal(r.oppen.status, 'oklart');
  assert.equal(r.oppen.citatOsakert, true, 'citatet finns inte i stadgarna');
  assert.equal(r.barnkonventionen.forslag, 'Föreningen arbetar utifrån barnkonventionen.');
  assert.equal(r.ideell.status, 'oklart');
  assert.match(r.ideell.kommentar, /ingen bedömning/);
});

test('ärendetext med nuvarande och föreslagen lydelse', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  const t = K.stadgearendeText({ rubrik: 'Säte i Stockholm', paragraf: '2', forslag: 'Föreningen har sitt säte i Stockholm.' }, st);
  assert.match(t, /Nuvarande lydelse \(§ 2 Säte\):\nFöreningen har sitt säte i Stockholms kommun\./);
  assert.match(t, /Föreslagen lydelse:\nFöreningen har sitt säte i Stockholm\./);
  assert.match(t, /Enligt stadgarna: Två tredjedels majoritet/);
  assert.match(K.stadgearendeText({ rubrik: 'Barnkonventionen', paragraf: '', forslag: 'Ny text.' }, st), /saknas i stadgarna/);
});

test('styrelsens data har en lista för stadgar', () => {
  assert.deepEqual(json(K.tomStyrelse().stadgar), []);
  assert.equal(K.normaliseraStyrelse({ stadgar: [{ id: 'st1' }] }).stadgar.length, 1);
});

test('utkast och ändringar jämfört med gällande stadgar', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  const u = K.nyttStadgeutkast(st);
  assert.equal(u.utkast, true);
  assert.equal(u.baseradPa, 'st1');
  assert.deepEqual(json(K.stadgeandringar(st, u)), [], 'ett nytt utkast har inga ändringar');
  u.paragrafer[1].text = 'Föreningen har sitt säte i Stockholm.';
  u.paragrafer.splice(2, 1);
  u.paragrafer.push({ nr: '3', rubrik: 'Barnkonventionen', text: 'Föreningen arbetar utifrån barnkonventionen.', ursprung: null });
  const a = K.stadgeandringar(st, u);
  assert.deepEqual(json(a.map((x) => x.typ + ' ' + x.nr)), ['andrad 2', 'ny 3', 'borttagen 3']);
  assert.equal(a[0].fore, 'Föreningen har sitt säte i Stockholms kommun.');
  const t = K.stadgeandringarText(a, st);
  assert.match(t, /3 ändringar/);
  assert.match(t, /§ 2 Säte\nNuvarande lydelse:\nFöreningen har sitt säte i Stockholms kommun\.\nFöreslagen lydelse:\nFöreningen har sitt säte i Stockholm\./);
  assert.match(t, /Ny paragraf § 3 Barnkonventionen/);
  assert.match(t, /Paragraf § 3 Firmatecknare tas bort/);
});

test('Word-dokumenten är giltig XML med texten, och specialtecken skyddas', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  const x = K.stadgarWordXml(Object.assign({}, st, { titel: 'Stadgar för A & B <test>' }), 'Antagna 2027');
  assert.match(x, /^<\?xml/);
  assert.match(x, /Stadgar för A &amp; B &lt;test&gt;/);
  assert.match(x, /§ 2 Säte/);
  assert.match(x, /<w:sectPr>/);
  assert.equal((x.match(/<w:p>/g) || []).length, (x.match(/<\/w:p>/g) || []).length);
  const u = K.nyttStadgeutkast(st); u.paragrafer[0].text = 'Ny text.';
  const j = K.jamforelseWordXml(K.stadgeandringar(st, u), st);
  assert.match(j, /w:orient="landscape"/);
  assert.match(j, /Nuvarande lydelse/);
  assert.match(j, /Ny text\./);
  assert.match(K.WORD_DELAR['[Content_Types].xml'], /word\/document\.xml/);
});

test('frågan till stadgarna innehåller stadgarna och frågan', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  const u = K.stadgeFragaUppdrag(st, 'Var har föreningen sitt säte?');
  assert.match(u.text, /§ 2 Säte/);
  assert.match(u.text, /Fråga: Var har föreningen sitt säte\?/);
  assert.deepEqual(json(u.schema.required), ['svar', 'paragrafer']);
});

test('granskningen ber om hela paragrafens nya lydelse', () => {
  const st = K.normaliseraStadgar(svarStruktur, { id: 'st1' });
  assert.match(K.granskningsUppdrag(st, K.kravlista('grund')).system, /hela paragrafens nya text/);
});
