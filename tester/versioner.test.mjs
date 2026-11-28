import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../test/index.html', import.meta.url)), 'utf8');
const kontext = vm.createContext({});
vm.runInContext(html.match(/<script id="versioner">([\s\S]*?)<\/script>/)[1], kontext);
const versioner = vm.runInContext('VERSIONER', kontext);

// 1.88-test.3 kommer före 1.88: en släppt version är större än sina testversioner.
const delar = (v) => { const m = v.match(/^(\d+)\.(\d+)(?:-test\.(\d+))?$/); return [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : Infinity]; };
const storre = (a, b) => { const [x, y] = [delar(a), delar(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

test('versionerna står med den nyaste först och har datum och nyheter', () => {
  assert.ok(versioner.length > 0);
  versioner.forEach((v, i) => {
    assert.match(v.version, /^\d+\.\d+(-test\.\d+)?$/);
    assert.match(v.datum, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(v.nyheter.length > 0, 'version ' + v.version + ' saknar nyheter');
    if (i > 0) {
      assert.ok(storre(versioner[i - 1].version, v.version), versioner[i - 1].version + ' ska vara större än ' + v.version);
      assert.ok(versioner[i - 1].datum >= v.datum);
    }
  });
});

test('huvudversionen (index.html i roten) är alltid en släppt version, aldrig en testversion', () => {
  const rot = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const k = vm.createContext({});
  vm.runInContext(rot.match(/<script id="versioner">([\s\S]*?)<\/script>/)[1], k);
  assert.doesNotMatch(vm.runInContext('VERSIONER[0].version', k), /-test/);
});
