'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyAccess,validateInput,generateReply,getAIStatus,DEFAULT_MODEL,DEFAULT_BASE_URL}=require('../lib/ai.cjs');

test('AI status requires the configured provider key',()=>{
 assert.deepEqual(getAIStatus({}),{aiConfigured:false,aiProvider:''});
 assert.deepEqual(getAIStatus({AI_API_KEY:'provider-key'}),{aiConfigured:true,aiProvider:DEFAULT_MODEL});
 assert.deepEqual(getAIStatus({AI_API_KEY:'provider-key',AI_MODEL:'custom-model'}),{aiConfigured:true,aiProvider:'custom-model'});
 assert.deepEqual(getAIStatus({AI_API_KEY:'provider-key',AI_BASE_URL:'http://example.com'}),{aiConfigured:false,aiProvider:''});
});

test('Chat access code is optional and checked safely',()=>{
 assert.equal(verifyAccess(undefined,undefined),true);
 assert.equal(verifyAccess('secret','secret'),true);
 assert.equal(verifyAccess('secret','wrong'),false);
});

test('Validates messages and keeps only bounded user and assistant history',()=>{
 assert.throws(()=>validateInput(null),/Invalid message format/);
 assert.throws(()=>validateInput({message:''}),/Message must/);
 assert.throws(()=>validateInput({message:'x'.repeat(2001)}),/Message must/);
 const input=validateInput({message:'  hello  ',history:[
  {role:'system',text:'not allowed'},
  {role:'user',text:'x'.repeat(1000)}
 ]});
 assert.equal(input.message,'hello');
 assert.deepEqual(input.history,[{role:'user',content:'x'.repeat(850)}]);
});

test('Uses only the configured OpenAI-compatible provider and keeps its key server-side',async()=>{
 let request;
 const fakeFetch=async(url,options)=>{
  request={url,options};
  return {ok:true,json:async()=>({choices:[{message:{content:'A useful answer.'}}]})};
 };
 const reply=await generateReply({message:'What is Singapore?',history:[{role:'user',text:'Tell me more'}]},{
  AI_API_KEY:'provider-test-key',
  AI_BASE_URL:'https://newapi.omgteam.me/v1/',
  AI_MODEL:'gpt-5.6-luna'
 },fakeFetch);
 assert.equal(reply,'Hello! A useful answer.');
 assert.equal(request.url,'https://newapi.omgteam.me/v1/chat/completions');
 assert.equal(request.options.headers.Authorization,'Bearer provider-test-key');
 const body=JSON.parse(request.options.body);
 assert.equal(body.model,'gpt-5.6-luna');
 assert.equal(body.messages.at(-1).content,'What is Singapore?');
 assert.equal(body.messages[1].content,'Tell me more');
 assert.match(body.messages[0].content,/do not have web browsing or live retailer data/);
 assert.equal(body.stream,false);
});

test('Uses the configured default endpoint and model',async()=>{
 const fakeFetch=async(url,options)=>{
  assert.equal(url,`${DEFAULT_BASE_URL}/chat/completions`);
  assert.equal(JSON.parse(options.body).model,DEFAULT_MODEL);
  return {ok:true,json:async()=>({choices:[{message:{content:'Hello! Ready.'}}]})};
 };
 assert.equal(await generateReply({message:'Hi there'}, {AI_API_KEY:'provider-key'}, fakeFetch),'Hello! Ready.');
});

test('Does not call any provider when the configured API key is missing',async()=>{
 let called=false;
 await assert.rejects(generateReply({message:'What is Singapore?'},{},async()=>{called=true}),/Set AI_API_KEY/);
 assert.equal(called,false);
});

test('Rejects insecure or malformed provider URLs',async()=>{
 for(const AI_BASE_URL of ['not a URL','http://example.com/v1','https://user:pass@example.com/v1']){
  await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key',AI_BASE_URL},async()=>{}),/AI_BASE_URL must be a valid HTTPS URL/);
 }
});

test('Maps provider errors without exposing response bodies',async()=>{
 await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key'},async()=>({ok:false,status:401})),/rejected AI_API_KEY/);
 await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key'},async()=>({ok:false,status:429})),/usage limit/);
 await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key'},async()=>({ok:false,status:404})),/Check AI_MODEL/);
});

test('Rejects empty or unreadable provider answers',async()=>{
 await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key'},async()=>({ok:true,json:async()=>({choices:[]})})),/did not return an answer/);
 await assert.rejects(generateReply({message:'Hello'},{AI_API_KEY:'provider-key'},async()=>({ok:true,json:async()=>{throw new Error('invalid')}})),/unreadable response/);
});
