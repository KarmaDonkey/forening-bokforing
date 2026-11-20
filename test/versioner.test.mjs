import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const kontext = vm.createContext({});
vm.runInContext(html.match(/<script id="versioner">([\s\S]*?)<\/script>/)[1], kontext);
const versioner = vm.runInContext('VERSIONER', kontext);

const delar = (v) => v.split('.').map(Number);
const storre = (a, b) => { const [x, y] = [delar(a), delar(b)]; return x[0] > y[0] || (x[0] === y[0] && x[1] > y[1]); };

test('versionerna står med den nyaste först och har datum och nyheter', () => {
  assert.ok(versioner.length > 0);
  versioner.forEach((v, i) => {
    assert.match(v.version, /^\d+\.\d+$/);
    assert.match(v.datum, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(v.nyheter.length > 0, 'version ' + v.version + ' saknar nyheter');
    if (i > 0) {
      assert.ok(storre(versioner[i - 1].version, v.version), versioner[i - 1].version + ' ska vara större än ' + v.version);
      assert.ok(versioner[i - 1].datum >= v.datum);
    }
  });
});
