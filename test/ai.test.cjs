const test = require('node:test');
const assert = require('node:assert/strict');
const {verifyAccess, validateInput, generateReply, DEFAULT_MODEL, PROVIDER_URL} = require('../lib/ai.cjs');

test('Access code validation', () => {
  assert.equal(verifyAccess(undefined, undefined), true);
  assert.equal(verifyAccess('supersecret', 'supersecret'), true);
  assert.equal(verifyAccess('supersecret', 'wrong'), false);
});
test('Reject empty message and invalid input', () => {
  assert.throws(() => validateInput({message: ''}), /Message must/);
  assert.throws(() => validateInput(null), /format/);
  assert.throws(() => validateInput({message:'x'.repeat(2001)}), /Message must/);
});
test('Hugging Face request supports open-ended conversation with real shopping context, no browser token', async () => {
  let outgoing;
  const fakeFetch = async (url, options) => {
    assert.equal(url, PROVIDER_URL);
    assert.equal(options.headers.Authorization, 'Bearer hf-test-only');
    outgoing = JSON.parse(options.body);
    return {ok: true, json: async () => ({choices: [{message: {content: '7'}}]})};
  };
  const result = await generateReply({message:'What is 3 + 4?',history:[{role:'user',text:'Help with math'}],context:{selectedProduct:'oats',offers:[{store:'FairPrice',itemPriceSGD:5.95,title:'Rolled oats 1kg',sourceUrl:'https://example.com/oats'}],isSearchData:true}},{HF_TOKEN:'hf-test-only'},fakeFetch);
  assert.equal(result, '7');
  assert.equal(outgoing.model, DEFAULT_MODEL);
  assert.equal(outgoing.messages.at(-1).content, 'What is 3 + 4?');
  assert.equal(outgoing.messages[2].content, 'Help with math');
  assert.match(outgoing.messages[1].content,/third-party listings/);
  assert.equal(outgoing.stream, false);
});
test('Missing token returns a friendly error', async () => {
  await assert.rejects(generateReply({message: 'Hello'}, {}, ()=>{}), /HF_TOKEN/);
});
test('No credits / authorization errors are friendly and do not expose upstream body', async () => {
  await assert.rejects(generateReply({message:'Hi'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:402})), /credits may be exhausted/);
  await assert.rejects(generateReply({message:'Hi'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:403})), /token is not authorized/);
});
test('Rate limiting and bad API tokens return useful errors', async () => {
  await assert.rejects(generateReply({message:'Hi'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:429})), /limit reached/);
  await assert.rejects(generateReply({message:'Hi'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:401})), /token was rejected/);
});
test('Different model can be configured without changing the HTML', async () => {
  const fakeFetch = async (_url,opts) => {
    assert.equal(JSON.parse(opts.body).model,'openai/gpt-oss-20b:cheapest');
    return {ok:true,json:async()=>({choices:[{message:{content:'Hello!'}}]})};
  };
  assert.equal(await generateReply({message:'Hi'}, {HF_TOKEN:'hf-x',HF_MODEL:'openai/gpt-oss-20b:cheapest'},fakeFetch),'Hello!');
});
