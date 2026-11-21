import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Alla e-postadresser är påhittade.
const json = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => assert.deepEqual(json(a), json(b));
const ADMIN = 'admin@example.se', KASSOR = 'kassor@example.se', BOK = 'bokforare@example.se', REV = 'revisor@example.se', STY = 'styrelse@example.se';

function roller() {
  let f = K.nyRollfil('Admin@Example.se');
  f = K.sattRoller(f, ADMIN, ADMIN, ['admin', 'kassor']);
  f = K.sattRoller(f, ADMIN, BOK, ['bokforare']);
  f = K.sattRoller(f, ADMIN, REV, ['revisor']);
  f = K.sattRoller(f, ADMIN, STY, ['ledamot']);
  return f;
}

test('den första inloggningen blir systemadministratör med skrivrätten', () => {
  const f = K.nyRollfil('Admin@Example.se');
  eq(f.personer, [{ epost: ADMIN, roller: ['admin'] }]);
  assert.equal(f.skrivratt, ADMIN);
});

test('roller och behörighet i OneDrive', () => {
  const f = roller();
  eq(K.rollerFor(f, ADMIN), ['admin', 'kassor']);
  eq(K.behorighet(['bokforare']), { data: 'write', reg: 'write', styr: null, uppdrag: null });
  eq(K.behorighet(['revisor']), { data: 'read', reg: null, styr: 'read', uppdrag: 'read' });
  eq(K.behorighet(['ledamot']), { data: 'read', reg: 'read', styr: 'write', uppdrag: 'write' });
  eq(K.behorighet(['revisor', 'ledamot']), { data: 'read', reg: 'read', styr: 'write', uppdrag: 'write' });
  eq(K.behorighet([]), { data: null, reg: null, styr: null, uppdrag: null });
  assert.equal(K.kanFaSkrivratt(f, BOK), true);
  assert.equal(K.kanTaSkrivratt(f, BOK), false);
  assert.equal(K.kanFaSkrivratt(f, STY), false);
});

test('styrelsens roller, valberedningen och bokföraren', () => {
  for (const r of ['ordforande', 'viceordforande', 'sekreterare', 'ledamot', 'suppleant']) {
    eq(K.behorighet([r]), { data: 'read', reg: 'read', styr: 'write', uppdrag: 'write' });
  }
  eq(K.behorighet(['kassor']), { data: 'write', reg: 'write', styr: 'write', uppdrag: 'write' });
  eq(K.behorighet(['admin']), { data: 'write', reg: 'write', styr: 'write', uppdrag: 'write' });
  // Bokföraren sköter bara bokföringen och ser inte styrelsens material.
  eq(K.behorighet(['bokforare']).styr, null);
  eq(K.behorighet(['valberedning']), { data: null, reg: null, styr: null, uppdrag: 'read' });
  eq(K.behorighet(['bokforare', 'sekreterare']), { data: 'write', reg: 'write', styr: 'write', uppdrag: 'write' });
});

test('rollen Styrelse från tidigare versioner blir Ledamot', () => {
  const gammal = { format: 'foreningsbokforing-roller', personer: [{ epost: ADMIN, roller: ['admin'] }, { epost: STY, roller: ['styrelse', 'ledamot'] }], skrivratt: ADMIN, logg: [] };
  const f = K.lasRollfil(gammal);
  eq(K.rollerFor(f, STY), ['ledamot']);
});

test('bara en systemadministratör kan ändra roller, och det finns alltid en kvar', () => {
  const f = roller();
  assert.throws(() => K.sattRoller(f, KASSOR, BOK, ['kassor']), /systemadministratör/);
  assert.throws(() => K.sattRoller(f, ADMIN, ADMIN, ['kassor']), /minst en systemadministratör/);
  assert.throws(() => K.sattRoller(f, ADMIN, 'inte en adress', ['revisor']), /giltig/);
  const utan = K.sattRoller(f, ADMIN, REV, []);
  assert.ok(!utan.personer.some((p) => p.epost === REV));
  assert.match(utan.logg.at(-1).text, /revisor@example\.se: borttagen/);
});

test('skrivrätten lämnas över, tas tillbaka och kan inte ges till den som inte får bokföra', () => {
  let f = roller();
  f = K.flyttaSkrivratt(f, ADMIN, BOK, '2030-01-01T10:00');
  assert.equal(f.skrivratt, BOK);
  assert.throws(() => K.flyttaSkrivratt(f, STY, STY), /ingen roll som får bokföra/);
  assert.throws(() => K.flyttaSkrivratt(f, REV, ADMIN), /Bara den som har skrivrätten/);
  // Bokföraren lämnar tillbaka
  assert.equal(K.flyttaSkrivratt(f, BOK, ADMIN).skrivratt, ADMIN);
  // Kassören (admin) tar tillbaka
  assert.equal(K.flyttaSkrivratt(f, ADMIN, ADMIN).skrivratt, ADMIN);
  // Tas rollen bort från den som har skrivrätten går den tillbaka till den som ändrade
  assert.equal(K.sattRoller(f, ADMIN, BOK, ['styrelse']).skrivratt, ADMIN);
});

test('rollfilen läses in och kontrolleras', () => {
  const f = K.lasRollfil(json(Object.assign(roller(), { regMapp: { driveId: 'D', id: 'R' } })));
  assert.equal(f.personer.length, 4);
  eq(f.regMapp, { driveId: 'D', id: 'R' });
  assert.throws(() => K.lasRollfil({}), /okänt format/);
});

test('apelido på personer med roller och på medlemmar', () => {
  let f = roller();
  f = K.sattApelidoRoll(f, ADMIN, KASSOR.replace('kassor', 'admin'), 'Soba');
  assert.equal(K.visaPerson(f, ADMIN), 'Soba');
  assert.equal(K.visaPerson(f, BOK), BOK);
  assert.throws(() => K.sattApelidoRoll(f, BOK, BOK, 'X'), /systemadministratör/);
  // Apelido följer med när rollerna ändras
  assert.equal(K.sattRoller(f, ADMIN, ADMIN, ['admin', 'kassor', 'styrelse']).personer.find((p) => p.epost === ADMIN).apelido, 'Soba');
  assert.equal(K.lasRollfil(json(f)).personer.find((p) => p.epost === ADMIN).apelido, 'Soba');
  let reg = K.laggTillMedlem(K.tomtRegister(), { namn: 'Påhittad Person', kategori: 'vuxen', apelido: 'Formiga' }).reg;
  assert.equal(K.visaNamn(reg.medlemmar[0]), 'Formiga – Påhittad Person');
  reg = K.andraMedlem(reg, 'm1', { apelido: '' });
  assert.equal(K.visaNamn(reg.medlemmar[0]), 'Påhittad Person');
  reg = K.andraMedlem(reg, 'm1', { apelido: 'Formiga' });
  assert.ok(!('apelido' in K.avforMedlem(reg, 'm1', '2031-01-01', 'utträde').medlemmar[0]), 'apelidot tas bort vid avförande');
});
