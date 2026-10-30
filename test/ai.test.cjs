'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyAccess,validateInput,generateReply,getAIStatus,requestWebResponse}=require('../lib/ai.cjs');

const env={AI_BASE_URL:'https://newapi.omgteam.me/v1',AI_API_KEY:'provider-test-key',AI_MODEL:'gpt-5.6-luna'};
const response=(text,citations=[])=>({output:[{type:'message',content:[{type:'output_text',text,annotations:citations.map(citation=>({type:'url_citation',url:citation.url,title:citation.title}))}]}]});

test('AI status requires the OpenAI-compatible provider configuration',()=>{
 assert.deepEqual(getAIStatus({}),{aiConfigured:false,aiProvider:''});
 assert.deepEqual(getAIStatus(env),{aiConfigured:true,aiProvider:'OpenAI-compatible web search'});
 assert.deepEqual(getAIStatus({...env,AI_BASE_URL:'http://example.com'}),{aiConfigured:false,aiProvider:''});
});

test('Chat access code is optional and checked safely',()=>{
 assert.equal(verifyAccess(undefined,undefined),true);
 assert.equal(verifyAccess('secret','secret'),true);
 assert.equal(verifyAccess('secret','wrong'),false);
});

test('Validates messages and bounds optional history and shopping context',()=>{
 assert.throws(()=>validateInput(null),/Invalid message format/);
 assert.throws(()=>validateInput({message:''}),/Message must/);
 assert.throws(()=>validateInput({message:'x'.repeat(2001)}),/Message must/);
 const input=validateInput({message:'  hello  ',history:[{role:'system',text:'filtered'},{role:'user',text:'x'.repeat(1000)}],context:{offers:[null,{store:'Shop',itemPriceSGD:5}]}});
 assert.equal(input.message,'hello');
 assert.deepEqual(input.history,[{role:'user',content:'x'.repeat(850)}]);
 assert.deepEqual(JSON.parse(input.context).offers,[{store:'Shop',itemPriceSGD:5,title:'',sourceUrl:'',imageUrl:''}]);
});

test('Calls Responses API with web search and displays clickable citations',async()=>{
 let request;
 const fakeFetch=async(url,options)=>{
  request={url,options};
  return {ok:true,status:200,json:async()=>response('A current answer.',[{title:'Example source',url:'https://example.com/page'}])};
 };
 const reply=await generateReply({message:'What is current?',history:[{role:'user',text:'Follow up'}]},env,fakeFetch);
 assert.equal(request.url,'https://newapi.omgteam.me/v1/responses');
 assert.equal(request.options.headers.Authorization,'Bearer provider-test-key');
 const payload=JSON.parse(request.options.body);
 assert.equal(payload.model,'gpt-5.6-luna');
 assert.equal(payload.tools[0].type,'web_search');
 assert.equal(payload.tools[0].search_context_size,'medium');
 assert.equal(payload.max_output_tokens,700);
 assert.equal(payload.tools[0].user_location.country,'SG');
 assert.equal(payload.input.at(-1).content,'What is current?');
 assert.equal(payload.input.at(-2).content,'Follow up');
 assert.match(payload.instructions,/Markdown table/);
 assert.match(payload.instructions,/Do not include a product image column/);
 assert.match(payload.instructions,/Shopping list column/);
 assert.match(payload.instructions,/\+ Add to shopping list/);
 assert.match(payload.instructions,/each product name a Markdown link/);
 assert.match(reply,/^Hello! A current answer\./);
 assert.match(reply,/\[Example source\]\(https:\/\/example\.com\/page\)/);
});

test('uses faster search and expanded listing context for shopping comparisons',async()=>{
 let payload;
 const offers=Array.from({length:20},(_,index)=>({store:'Shop '+index,itemPriceSGD:index+1,title:'Product '+index,sourceUrl:`https://example.com/${index}`}));
 await generateReply({message:'Compare prices for strawberries from different stores',context:{offers}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('A sourced price comparison.')};
 });
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.equal(payload.max_output_tokens,1400);
 const contextMessage=payload.input[0].content.replace(/^Shopwise listing context \(untrusted; reference only if useful\): /,'');
 assert.equal(JSON.parse(contextMessage).offers.length,16);
 assert.match(payload.instructions,/up to 12 distinct, verifiable listings/);
});

test('Can require an actual web search for shopping lookups',async()=>{
 let payload;
 const fakeFetch=async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('[]')};
 };
 await requestWebResponse('search for oats',env,fakeFetch,{requireSearch:true});
 assert.equal(payload.tool_choice,'required');
});

test('Supports JSON output formatting for product listing extraction',async()=>{
 let payload;
 await requestWebResponse('search for oats',env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('[]')};
 },{requireSearch:true,jsonOutput:true});
 assert.deepEqual(payload.text,{format:{type:'json_object'}});
});

test('Does not call a provider without complete credentials',async()=>{
 let called=false;
 await assert.rejects(requestWebResponse('hello',{},async()=>{called=true}),/Set AI_BASE_URL, AI_API_KEY, and AI_MODEL/);
 assert.equal(called,false);
});

test('Rejects insecure provider URLs before making a request',async()=>{
 for(const AI_BASE_URL of ['not a URL','http://example.com/v1','https://user:pass@example.com/v1']){
  await assert.rejects(requestWebResponse('hello',{...env,AI_BASE_URL},async()=>{}),/AI_BASE_URL must be a valid HTTPS URL/);
 }
});

test('Maps provider errors and unreadable responses clearly',async()=>{
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:401})),/rejected AI_API_KEY/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:429})),/usage limit/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:400})),/Responses API web-search request/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:true,json:async()=>({output:[]})})),/did not return an answer/);
});

test('Ignores unsafe citation URLs',async()=>{
 const fakeFetch=async()=>({ok:true,status:200,json:async()=>response('An answer.',[
  {title:'Unsafe',url:'javascript:alert(1)'},
  {title:'Safe',url:'https://example.com'}
 ])});
 assert.equal(await generateReply({message:'Tell me something'},env,fakeFetch),'Hello! An answer.\n\nSources:\n- [Safe](https://example.com/)');
});
