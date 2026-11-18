// Läser in kärnan (<script id="karna"> i index.html) i en isolerad miljö för testerna.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const match = html.match(/<script id="karna">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Hittar inte <script id="karna"> i index.html');

const kontext = vm.createContext({ Uint8Array });
vm.runInContext(match[1], kontext, { filename: 'index.html#karna' });
export const K = kontext.Karna;
