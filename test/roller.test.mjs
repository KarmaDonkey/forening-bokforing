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
  f = K.sattRoller(f, ADMIN, STY, ['styrelse']);
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
  eq(K.behorighet(['bokforare']), { data: 'write', reg: 'write' });
  eq(K.behorighet(['revisor']), { data: 'read', reg: null });
  eq(K.behorighet(['styrelse']), { data: 'read', reg: 'read' });
  eq(K.behorighet(['revisor', 'styrelse']), { data: 'read', reg: 'read' });
  eq(K.behorighet([]), { data: null, reg: null });
  assert.equal(K.kanFaSkrivratt(f, BOK), true);
  assert.equal(K.kanTaSkrivratt(f, BOK), false);
  assert.equal(K.kanFaSkrivratt(f, STY), false);
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
