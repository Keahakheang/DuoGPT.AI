const test = require('node:test');
const assert = require('node:assert/strict');
const {verifyAccess, validateInput, generateReply, getAIStatus, DEFAULT_MODEL, PROVIDER_URL} = require('../lib/ai.cjs');

test('AI status follows provider priority and recognizes incomplete compatible-provider setup', () => {
  assert.deepEqual(getAIStatus({
    AI_API_KEY:'provider-test-key',
    AI_BASE_URL:'https://example.com/v1',
    AI_MODEL:'gpt-5.6-luna',
    SERPAPI_KEY:'serpapi-test'
  }), {aiConfigured:true,aiProvider:'OpenAI-compatible provider'});
  assert.deepEqual(getAIStatus({AI_API_KEY:'provider-test-key',SERPAPI_KEY:'serpapi-test'}), {
    aiConfigured:false,
    aiProvider:'OpenAI-compatible provider'
  });
  assert.deepEqual(getAIStatus({SERPAPI_KEY:'serpapi-test',HF_TOKEN:'hf-test'}), {
    aiConfigured:true,
    aiProvider:'SerpApi Google AI Overview'
  });
  assert.deepEqual(getAIStatus({HF_TOKEN:'hf-test'}), {aiConfigured:true,aiProvider:'Hugging Face'});
});

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
test('Ignores malformed shopping offers in optional chat context', () => {
  const result = validateInput({message:'Compare these',context:{offers:[null,[],{store:'Shop',itemPriceSGD:5}]}});
  assert.deepEqual(JSON.parse(result.context).offers,[{store:'Shop',itemPriceSGD:5,title:'',sourceUrl:''}]);
});
test('Hugging Face request supports open-ended conversation with real shopping context, no browser token', async () => {
  let outgoing;
  const fakeFetch = async (url, options) => {
    assert.equal(url, PROVIDER_URL);
    assert.equal(options.headers.Authorization, 'Bearer hf-test-only');
    outgoing = JSON.parse(options.body);
    return {ok: true, json: async () => ({choices: [{message: {content: '7'}}]})};
  };
  const result = await generateReply({message:'What is 3 + 4?',history:[{role:'user',text:'Help with math'}],context:{selectedProduct:'oats',offers:[{store:'Fairprice1',itemPriceSGD:5.95,title:'Rolled oats 1kg',sourceUrl:'https://example.com/oats'}],isSearchData:true}},{HF_TOKEN:'hf-test-only'},fakeFetch);
  assert.equal(result, 'Hello! 7');
  assert.equal(outgoing.model, DEFAULT_MODEL);
  assert.equal(outgoing.messages.at(-1).content, 'What is 3 + 4?');
  assert.equal(outgoing.messages[2].content, 'Help with math');
  assert.match(outgoing.messages[1].content,/third-party listings/);
  assert.equal(outgoing.stream, false);
});
test('Missing token returns a friendly error', async () => {
  await assert.rejects(generateReply({message: 'What is Singapore?'}, {}, ()=>{}), /AI_API_KEY, SERPAPI_KEY, or HF_TOKEN/);
});
test('No credits / authorization errors are friendly and do not expose upstream body', async () => {
  await assert.rejects(generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:402})), /credits may be exhausted/);
  await assert.rejects(generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:403})), /token is not authorized/);
});
test('Rate limiting and bad API tokens return useful errors', async () => {
  await assert.rejects(generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:429})), /limit reached/);
  await assert.rejects(generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-secret'},async()=>({ok:false,status:401})), /token was rejected/);
});
test('Different model can be configured without changing the HTML', async () => {
  const fakeFetch = async (_url,opts) => {
    assert.equal(JSON.parse(opts.body).model,'openai/gpt-oss-20b:cheapest');
    return {ok:true,json:async()=>({choices:[{message:{content:'Hello!'}}]})};
  };
  assert.equal(await generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-x',HF_MODEL:'openai/gpt-oss-20b:cheapest'},fakeFetch),'Hello!');
});
test('OpenAI-compatible provider uses the configured endpoint, key, and model', async () => {
  let request;
  const fakeFetch = async (url, options) => {
    request = {url, options};
    return {ok:true,json:async()=>({choices:[{message:{content:'A useful answer.'}}]})};
  };
  const reply = await generateReply({message:'What is Singapore?'}, {
    AI_BASE_URL:'https://newapi.omgteam.me/v1/',
    AI_API_KEY:'provider-test-key',
    AI_MODEL:'provider-model'
  },fakeFetch);
  assert.equal(reply,'Hello! A useful answer.');
  assert.equal(request.url,'https://newapi.omgteam.me/v1/chat/completions');
  assert.equal(request.options.headers.Authorization,'Bearer provider-test-key');
  assert.equal(JSON.parse(request.options.body).model,'provider-model');
});
test('OpenAI-compatible provider requires base URL and model', async () => {
  await assert.rejects(generateReply({message:'What is Singapore?'}, {AI_API_KEY:'provider-test'},()=>{}), /Set AI_BASE_URL and AI_MODEL/);
});
test('AI replies always start with Hello! without duplicating an existing greeting', async () => {
  const replyWith = content => generateReply({message:'What is Singapore?'}, {HF_TOKEN:'hf-test'}, async () => ({
    ok:true,json:async()=>({choices:[{message:{content}}]})
  }));
  assert.equal(await replyWith('How can I help?'),'Hello! How can I help?');
  assert.equal(await replyWith('Hello! How can I help?'),'Hello! How can I help?');
});
test('SerpApi powers source-backed chat answers when Hugging Face is not configured', async () => {
  const calls = [];
  const fakeFetch = async url => {
    const requestUrl = new URL(url);
    calls.push(requestUrl);
    if (requestUrl.searchParams.get('engine') === 'google') {
      return {ok:true,status:200,json:async()=>({ai_overview:{page_token:'overview-token'}})};
    }
    return {
      ok:true,status:200,json:async()=>({
        ai_overview:{
          text_blocks:[{type:'paragraph',snippet:'Singapore is a sovereign city-state in Southeast Asia.'}],
          references:[{title:'Singapore overview',link:'https://example.com/singapore'}]
        }
      })
    };
  };
  const reply=await generateReply({message:'What is Singapore?',history:[],context:{}},{SERPAPI_KEY:'serpapi-test',HF_TOKEN:'hf-test'},fakeFetch);
  assert.match(reply,/^Hello! Singapore is a sovereign city-state in Southeast Asia\./);
  assert.match(reply,/\[Singapore overview\]\(https:\/\/example\.com\/singapore\)/);
  assert.equal(calls[0].searchParams.get('engine'),'google');
  assert.equal(calls[0].searchParams.get('gl'),'sg');
  assert.equal(calls[0].searchParams.get('location'),'Singapore');
  assert.equal(calls[1].searchParams.get('engine'),'google_ai_overview');
  assert.equal(calls[1].searchParams.get('page_token'),'overview-token');
});
test('SerpApi chat explains when it can only provide search snippets', async () => {
  const fakeFetch=async()=>({ok:true,status:200,json:async()=>({
    organic_results:[{title:'Example result',snippet:'A sourced result summary.',link:'https://example.com/result'}]
  })});
  const reply=await generateReply({message:'Tell me something',history:[],context:{}},{SERPAPI_KEY:'serpapi-test'},fakeFetch);
  assert.match(reply,/^Hello! I couldn't find a Google AI Overview/);
  assert.match(reply,/A sourced result summary/);
  assert.match(reply,/https:\/\/example\.com\/result/);
});
test('greetings and everyday chat get natural replies without searching', async () => {
  const unexpectedFetch=async()=>{throw new Error('Casual conversation should not trigger a search')};
  const env={SERPAPI_KEY:'serpapi-test'};
  assert.equal(await generateReply({message:'Hello',history:[],context:{}},env,unexpectedFetch),'Hello! How can I help you today? You can ask me a general question or ask about the shopping results.');
  assert.match(await generateReply({message:'Hi, how are you?',history:[],context:{}},env,unexpectedFetch),/^Hello! I'm doing well/);
  assert.match(await generateReply({message:'How are you?',history:[],context:{}},env,unexpectedFetch),/^Hello! I'm doing well/);
  assert.match(await generateReply({message:'Thanks!',history:[],context:{}},env,unexpectedFetch),/^Hello! You're welcome/);
  assert.match(await generateReply({message:'What can you do?',history:[],context:{}},env,unexpectedFetch),/answer general questions/);
  assert.match(await generateReply({message:'Hi',history:[],context:{}},{},unexpectedFetch),/^Hello! How can I help/);
});
test('a greeting attached to a real question still searches for an answer', async () => {
  let fetched=false;
  const fakeFetch=async url=>{
    fetched=true;
    const requestUrl=new URL(url);
    assert.match(requestUrl.searchParams.get('q'),/Hi, what is Singapore\?/i);
    return {ok:true,status:200,json:async()=>({
      answer_box:{answer:'Singapore is a city-state in Southeast Asia.',link:'https://example.com/singapore'},
      organic_results:[]
    })};
  };
  const reply=await generateReply({message:'Hi, what is Singapore?',history:[],context:{}},{SERPAPI_KEY:'serpapi-test'},fakeFetch);
  assert.equal(fetched,true);
  assert.match(reply,/Singapore is a city-state/);
});
