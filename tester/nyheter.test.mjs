import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = x => JSON.parse(JSON.stringify(x));

test('versioner jämförs som tal, och en släppt version kommer efter sina testversioner', () => {
  assert.equal(K.jamforVersion('1.10', '1.9'), 1);
  assert.equal(K.jamforVersion('1.88', '1.88-test.3'), 1);
  assert.equal(K.jamforVersion('1.88-test.2', '1.88-test.10'), -1);
  assert.equal(K.jamforVersion('1.87', '1.88-test.1'), -1);
  assert.equal(K.jamforVersion('1.84', '1.84'), 0);
});

test('nyheter sedan senaste besöket, efter roll, nyaste först och högst fem', () => {
  const N = [
    { version: '1.80', rubrik: 'A' }, { version: '1.81', rubrik: 'B', roller: ['kassor'] }, { version: '1.82', rubrik: 'C', roller: ['sekreterare'] },
    { version: '1.83', rubrik: 'D' }, { version: '1.84', rubrik: 'E' }, { version: '1.85', rubrik: 'F' }, { version: '1.86', rubrik: 'G' }, { version: '1.87', rubrik: 'H' }
  ];
  assert.deepEqual(json(K.nyheterSedan(N, '1.83', ['kassor'])).visa.map(n => n.rubrik), ['H', 'G', 'F', 'E']);
  const kassor = json(K.nyheterSedan(N, '1.79', ['kassor']));
  assert.deepEqual(kassor.visa.map(n => n.rubrik), ['H', 'G', 'F', 'E', 'D']);
  assert.equal(kassor.fler, 2, 'B och A, men inte C som gäller sekreteraren');
  assert.equal(json(K.nyheterSedan(N, '1.79', [])).fler, 3, 'utan roller visas allt');
  assert.deepEqual(json(K.nyheterSedan(N, '1.87', ['kassor'])), { visa: [], fler: 0 });
});

test('nyhetslistan: rubrik, text, version och en vy som finns', () => {
  const html = readFileSync(fileURLToPath(new URL('../test/index.html', import.meta.url)), 'utf8');
  const k = vm.createContext({});
  vm.runInContext(html.match(/<script id="versioner">([\s\S]*?)<\/script>/)[1], k);
  const nyheter = vm.runInContext('NYHETER', k);
  assert.ok(nyheter.length > 0);
  for (const n of nyheter) {
    assert.match(n.version, /^\d+\.\d+$/, n.rubrik);
    assert.ok(n.rubrik && n.text, n.version);
    assert.ok(n.vy || n.handling, n.rubrik + ' saknar Visa');
    if (n.vy) assert.ok(html.includes("['" + n.vy + "', "), n.rubrik + ': vyn ' + n.vy + ' finns inte');
  }
});
