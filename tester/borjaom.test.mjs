import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));
const kr = (n) => Math.round(n * 100);

function arkiv2030() {
  let ar = K.skapaAr({ start: '2030-01-01', ingaendeBalans: { 1930: kr(1000), 2067: kr(-1000) } });
  ar = K.bokfor(ar, { datum: '2030-03-01', text: 'Terminsavgifter', rader: [{ konto: '1930', belopp: kr(500) }, { konto: '3100', belopp: kr(-500) }] }).ar;
  ar = K.bokfor(ar, { datum: '2030-04-01', text: 'Hyra', rader: [{ konto: '5010', belopp: kr(200) }, { konto: '1930', belopp: kr(-200) }] }).ar;
  return Object.assign(ar, { grovkopia: { fil: '2030.xlsm' }, lastTom: ar.slut });
}

test('nytt år efter en arkivkopia får ingående balans och årets resultat på 2069', () => {
  const ny = K.arFranArkiv(arkiv2030());
  assert.equal(ny.start, '2031-01-01');
  assert.equal(ny.slut, '2031-12-31');
  assert.deepEqual(json(ny.ingaendeBalans), { 1930: kr(1300), 2067: kr(-1000), 2069: kr(-300) });
  assert.equal(ny.verifikationer.length, 0);
  // Konton som saknas i en egen kontoplan läggs till.
  const ny2 = K.arFranArkiv(arkiv2030(), [{ nr: '1930', namn: 'Bank' }]);
  assert.deepEqual(json(ny2.kontoplan.map((k) => k.nr)), ['1930', '2067', '2069']);
});

function testdata() {
  let ar = K.skapaAr({ start: '2031-01-01', kontoplan: K.standardKontoplan().concat([{ nr: '3999', namn: 'Eget konto' }]) });
  ar.underlag = [{ id: 'u1', odId: 'OD1', filnamn: 'kvitto.pdf' }, { id: 'u2', filnamn: 'lokal.pdf' }];
  const bokforing = {
    format: 1, forening: { namn: 'Testföreningen Påhittad', orgnr: '000000-0000', logoOdId: 'L1' }, ar: { 2030: arkiv2030(), 2031: ar }, aktivt: '2031',
    regler: [{ monster: 'hyra', konto: '5010' }], motpartsregler: [{ x: 1 }], avfardadeForslag: [{ monster: 'exempelperson', riktning: 'ut', skal: 'Personnamn' }], adresser: [{ id: 'a' }], kontakter: [], artiklar: [{ id: 'art' }], mottagare: [{ id: 'm' }],
    dokument: [{ typ: 'kvitto', nummer: 3, odId: 'OD2' }], medlemsregister: { gammalt: true }, egenInstallning: 'ja'
  };
  let register = K.tomtRegister();
  register = K.laggTillMedlem(register, { namn: 'Påhittad Ett', kategori: 'barn' }).reg;
  register.betalningar = [{ id: 'b1' }]; register.kvitton = [{ nr: 1 }]; register.ignorerade = ['x']; register.betalare = [{ nyckel: '+46700000000', medlem: 'm1' }];
  register.konton = { medlemsavgift: '3010', terminsavgift: '3020' }; register.arsavgift = { vanlig: kr(100), funktionar: 0 };
  let styrelse = K.nyttMote(K.tomStyrelse(), { typ: 'styrelse', datum: '2031-02-01' }).styr;
  styrelse.moten[0].underskrift = { metod: 'papper', fil: { odId: 'OD3', namn: 'protokoll.pdf' } };
  const uppdrag = K.laggTillUppdrag(K.tomaUppdrag(), { roll: 'Ordförande', namn: 'Påhittad Två' });
  return { bokforing, register, styrelse, uppdrag };
}

const forval = { forening: true, kontoplan: true, regler: false, avgifter: true, uppdrag: true, arkivkopior: true, medlemmar: 'utan-betalningar' };

test('börja om med förvalen: föreningen, arkivkopiorna och medlemmarna finns kvar', () => {
  const r = K.borjaOm(testdata(), forval);
  assert.deepEqual(Object.keys(r.bokforing.ar), ['2030']);
  assert.equal(r.bokforing.aktivt, '2030');
  assert.equal(r.bokforing.forening.namn, 'Testföreningen Påhittad');
  assert.equal(r.bokforing.forening.logoOdId, 'L1');
  assert.equal(r.bokforing.egenInstallning, 'ja');
  assert.equal(r.bokforing.medlemsregister, undefined);
  assert.deepEqual(json([r.bokforing.regler, r.bokforing.motpartsregler, r.bokforing.avfardadeForslag, r.bokforing.dokument]), [[], [], [], []]);
  assert.equal(r.bokforing.artiklar.length, 1);
  assert.equal(r.register.medlemmar.length, 1);
  assert.deepEqual(json([r.register.betalningar, r.register.kvitton, r.register.ignorerade]), [[], [], []]);
  assert.equal(r.register.betalare.length, 1, 'kopplingen mellan betalare och medlem är riktig och behålls');
  assert.equal(r.register.konton.medlemsavgift, '3010');
  assert.equal(r.styrelse.moten.length, 0);
  assert.equal(r.uppdrag.uppdrag.length, 1);
  assert.ok(r.kontoplan.some((k) => k.nr === '3999'));
  assert.deepEqual(json(r.filer.map((f) => f.odId)), ['OD1', 'OD2', 'OD3']);
  // Nytt år 2031 från arkivkopian, med den behållna kontoplanen.
  const ny = K.arFranArkiv(r.bokforing.ar['2030'], r.kontoplan);
  assert.ok(ny.kontoplan.some((k) => k.nr === '3999'));
});

test('börja om helt från början', () => {
  const r = K.borjaOm(testdata(), { medlemmar: 'ta-bort' });
  assert.deepEqual(json(r.bokforing.ar), {});
  assert.equal(r.bokforing.aktivt, null);
  assert.equal(r.bokforing.forening.namn, '');
  assert.equal(r.bokforing.egenInstallning, undefined);
  assert.equal(r.bokforing.artiklar.length, 0);
  assert.equal(r.register.medlemmar.length, 0);
  assert.equal(r.register.konton.medlemsavgift, '');
  assert.equal(r.uppdrag.uppdrag.length, 0);
  assert.equal(r.kontoplan, null);
  assert.equal(r.filer.length, 3);
});

test('behåll medlemmar med betalningar och de inlärda förslagen', () => {
  const r = K.borjaOm(testdata(), Object.assign({}, forval, { medlemmar: 'behall', regler: true, avgifter: false }));
  assert.equal(r.register.betalningar.length, 1);
  assert.equal(r.register.konton.medlemsavgift, '');
  assert.equal(r.bokforing.regler.length, 1);
  assert.equal(r.bokforing.avfardadeForslag.length, 1, 'avfärdade förslag följer med reglerna');
});
