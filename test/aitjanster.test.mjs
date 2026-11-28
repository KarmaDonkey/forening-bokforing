import { test } from 'node:test';
import assert from 'node:assert/strict';
import { K } from './ladda-karna.mjs';

// Allt är påhittat.
const json = (x) => JSON.parse(JSON.stringify(x));

test('föreningens AI-tjänst, Claude om inget är valt', () => {
  assert.equal(K.aiTjanstFor(undefined), 'claude');
  assert.equal(K.aiTjanstFor({}), 'claude');
  assert.equal(K.aiTjanstFor({ aiTjanst: 'azure' }), 'azure');
  assert.equal(K.aiTjanstFor({ aiTjanst: 'okand' }), 'claude');
  assert.equal(K.aiTjanstNamn('openai'), 'ChatGPT');
  assert.equal(K.aiTjanstNamn('foundry'), 'Claude i Microsoft Foundry');
});

test('Azure-resursens namn och adresser', () => {
  assert.equal(K.azureResurs('MinResurs'), 'minresurs');
  assert.equal(K.azureResurs('https://minresurs.openai.azure.com/'), 'minresurs');
  assert.equal(K.azureResurs('https://min-resurs.services.ai.azure.com/anthropic/v1/messages'), 'min-resurs');
  assert.equal(K.azureResurs('inte ett namn!'), '');
  assert.equal(K.aiAdress('azure', 'minresurs'), 'https://minresurs.openai.azure.com/openai/v1/responses');
  assert.equal(K.aiAdress('foundry', 'https://minresurs.services.ai.azure.com'), 'https://minresurs.services.ai.azure.com/anthropic');
  assert.equal(K.aiAdress('openai'), 'https://api.openai.com/v1/responses');
  assert.equal(K.aiAdress('azure', ''), '');
});

test('uppdrag översätts till OpenAIs format, med PDF och bild', () => {
  const schema = { type: 'object', properties: { text: { type: 'string' } } };
  const pdf = K.openaiBegaran({ system: 'Instruktion', text: 'Tolka.', schema, block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } } }, 'min-modell');
  assert.equal(pdf.model, 'min-modell');
  assert.equal(pdf.instructions, 'Instruktion');
  assert.deepEqual(json(pdf.input[0].content), [{ type: 'input_file', filename: 'underlag.pdf', file_data: 'data:application/pdf;base64,QUJD' }, { type: 'input_text', text: 'Tolka.' }]);
  assert.deepEqual(json(pdf.text.format.schema), schema);
  const bild = K.openaiBegaran({ system: '', text: 'x', schema, block: { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'RA==' } } }, 'm');
  assert.deepEqual(json(bild.input[0].content[0]), { type: 'input_image', image_url: 'data:image/jpeg;base64,RA==' });
  assert.equal(K.openaiBegaran({ text: 'x', schema }, 'm').input[0].content.length, 1);
});

test('svaret från OpenAI läses, och fel blir tydliga', () => {
  const svar = { status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"text":' }, { type: 'output_text', text: '"Hej"}' }] }] };
  assert.deepEqual(json(K.openaiSvar(svar)), { text: 'Hej' });
  assert.throws(() => K.openaiSvar({ output: [{ content: [{ type: 'refusal', refusal: 'nej' }] }] }), /avböjde/);
  assert.throws(() => K.openaiSvar({ error: { message: 'Incorrect API key' } }), /Incorrect API key/);
  assert.throws(() => K.openaiSvar({ status: 'incomplete', output: [] }), /för långt/);
  assert.throws(() => K.openaiSvar({ status: 'completed', output: [] }), /inget svar/);
});
