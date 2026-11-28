import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

const json = (x) => JSON.parse(JSON.stringify(x));

test('mötets mapp följer föreningens mönster', () => {
  assert.equal(K.motesmapp('arsmote', '2027-03-15'), 'ÅM 2027');
  assert.equal(K.motesmapp('extra', '2027-09-01'), 'ÅM 2027 extra');
  assert.equal(K.motesmapp('styrelse', '2027-05-02'), 'SM 2027');
  assert.equal(K.motesmapp('konstituerande', '2027-03-15'), 'SM 2027 konstituerande');
  assert.equal(K.motesfilnamn('2027-05-02', 'Protokoll styrelsemöte'), '2027-05-02 Protokoll styrelsemöte.pdf');
  assert.equal(K.motesfilnamn('2027-05-02', 'Protokoll styrelsemöte undertecknat', '.jpg'), '2027-05-02 Protokoll styrelsemöte undertecknat.jpg');
});

test('mappnamn under Möten tolkas', () => {
  assert.deepEqual(json(K.tolkaMotesmapp('ÅM 2011 extra')), { typ: 'extra', ar: '2011', tillagg: 'extra' });
  assert.deepEqual(json(K.tolkaMotesmapp('ÅM 2012')), { typ: 'arsmote', ar: '2012', tillagg: '' });
  assert.deepEqual(json(K.tolkaMotesmapp('SM 2020 konstituerande')), { typ: 'konstituerande', ar: '2020', tillagg: 'konstituerande' });
  assert.equal(K.tolkaMotesmapp('sm 2013').typ, 'styrelse');
  assert.deepEqual(json(K.tolkaMotesmapp('2021')), { typ: 'ar', ar: '2021', tillagg: '' });
  assert.equal(K.tolkaMotesmapp('Roll-administration'), null);
  assert.equal(K.tolkaMotesmapp('ÅM'), null);
});

test('årsmötets handlingar känns igen i filnamnen och bockas av i checklistan', () => {
  const filer = ['Kallelse årsmöte 2027.pdf', 'BoR 2026.pdf', 'Revisionsberättelse 2026.pdf', 'Valberedningens förslag.docx', 'Borta.txt', '2027-03-15 Protokoll årsmöte.pdf'];
  const st = K.handlingarStatus(filer);
  const finns = Object.fromEntries(st.map((h) => [h.nyckel, h.filer]));
  assert.deepEqual(json(finns.kallelse), ['Kallelse årsmöte 2027.pdf']);
  assert.deepEqual(json(finns.ekonomi), ['BoR 2026.pdf'], 'BoR men inte Borta');
  assert.equal(finns.verksamhet.length, 0);
  assert.equal(finns.protokoll.length, 1);
  let styr = K.tomStyrelse();
  K.arsmotesUppgifter('2027-03-15').forEach((u) => { styr = K.laggTillUppgift(styr, Object.assign({ grupp: 'arsmote-2027-03-15' }, u)); });
  styr = K.laggTillUppgift(styr, { text: 'Kallelse annat år', grupp: 'arsmote-2026-03-15', handling: 'kallelse' });
  const efter = K.bockaAvHandlingar(styr, 'arsmote-2027-03-15', st);
  const klara = efter.uppgifter.filter((u) => u.klar).map((u) => u.text);
  assert.deepEqual(json(klara), ['Kallelsens text', 'Valberedningens förslag', 'Balans- och resultaträkning', 'Revisionsberättelse']);
  assert.equal(K.bockaAvHandlingar(efter, 'arsmote-2027-03-15', st), efter, 'oförändrat när inget nytt finns');
});

test('sökvägen läses ut ur svaret från OneDrive', () => {
  assert.equal(K.sokvagFranGraf('/drive/root:/Kimmy/Capoeira', 'Föreningsadministration'), 'Kimmy/Capoeira/Föreningsadministration');
  assert.equal(K.sokvagFranGraf('/drive/root:', 'Föreningsadministration'), 'Föreningsadministration');
  assert.equal(K.sokvagFranGraf('/drives/abc/root:/Kimmy/Capoeira%20Arte', ''), 'Kimmy/Capoeira Arte');
  assert.equal(K.sokvagFranGraf(undefined, 'X'), 'X');
});

test('lediga namn när mappar slås ihop', () => {
  assert.equal(K.ledigtNamn(['a.pdf'], 'b.pdf'), 'b.pdf');
  assert.equal(K.ledigtNamn(['Protokoll.pdf'], 'protokoll.pdf'), 'protokoll (2).pdf');
  assert.equal(K.ledigtNamn(['Protokoll.pdf', 'Protokoll (2).pdf'], 'Protokoll.pdf'), 'Protokoll (3).pdf');
  assert.equal(K.ledigtNamn(['ÅM 2026'], 'ÅM 2026'), 'ÅM 2026 (2)');
});
