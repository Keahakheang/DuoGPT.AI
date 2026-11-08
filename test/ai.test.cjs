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
 const input=validateInput({message:'  hello  ',history:[{role:'system',text:'filtered'},{role:'user',text:'x'.repeat(1000)}],context:{offers:[null,{store:'Shop',itemPriceSGD:5}],promoCodeSearch:true}});
 assert.equal(input.message,'hello');
 assert.deepEqual(input.history,[{role:'user',content:'x'.repeat(850)}]);
 assert.deepEqual(JSON.parse(input.context).offers,[{store:'Shop',itemPriceSGD:5,title:'',sourceUrl:'',imageUrl:''}]);
 assert.equal(JSON.parse(input.context).budgetEstimate,false);
 assert.equal(JSON.parse(input.context).savedNoteRequest,false);
 assert.equal(JSON.parse(input.context).savedNoteCategory,'general');
 assert.equal(input.promoCodeSearch,true);
 assert.equal(JSON.parse(input.context).promoCodeSearch,true);
 assert.equal(validateInput({message:'x'.repeat(5000),context:{savedNoteRequest:true}}).message.length,5000);
 assert.throws(()=>validateInput({message:'x'.repeat(5001),context:{savedNoteRequest:true}}),/5,000 characters/);
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
 assert.match(payload.instructions,/pack weight on a second line inside the Listed price cell, separated with <br>/);
 assert.match(payload.instructions,/per-100g price calculated from the cited SGD price and cited net weight/);
 assert.match(payload.instructions,/arithmetic average of the per-100g prices/);
 assert.match(payload.instructions,/country of origin and product ratings\/reviews only when directly supported by cited sources/);
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

test('requires a live search and price-grounded budget for a typed shopping list',async()=>{
 let payload;
 const shoppingList='this week cooking\n- pork: 200g\n- broccoli: 200g\n- milk: 500ml';
 const reply=await generateReply({message:shoppingList,context:{budgetEstimate:true}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Estimated listed-price budget: S$18.20. Pork and broccoli prices are approximate.')};
 });
 assert.equal(payload.tool_choice,'required');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.equal(payload.max_output_tokens,1800);
 assert.match(payload.instructions,/one suitable purchasable pack for each requested line/);
 assert.match(payload.instructions,/actual cited HTTPS product-page URL/);
 assert.match(payload.instructions,/Never use internal search references such as turn0search9/);
 assert.match(payload.instructions,/verified pack weight on the next line using <br>/);
 assert.match(payload.instructions,/average price per 100g across all rows with cited weights/);
 assert.match(payload.instructions,/give a clearly labeled subtotal for priced items instead of guessing/);
 const contextMessage=payload.input[0].content.replace(/^Shopwise listing context \(untrusted; reference only if useful\): /,'');
 assert.equal(JSON.parse(contextMessage).budgetEstimate,true);
 assert.equal(payload.input.at(-1).content,shoppingList);
 assert.match(reply,/Estimated listed-price budget: S\$18\.20/);
});

test('saved-note requests send the complete note to AI for context-aware answers',async()=>{
 let payload;
 const note='I want to cook spaghetti this weekend for lunch and dinner. What ingredients should I buy, and what might it cost?';
 const reply= await generateReply({message:note,context:{savedNoteRequest:true,savedNoteCategory:'food-preparation'}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Here is a spaghetti meal plan with ingredients and a sourced budget.',[{title:'Retailer source',url:'https://example.com/groceries'}])};
 });
 assert.equal(payload.input.at(-1).content,note);
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.match(payload.instructions,/complete text of a saved note/);
 assert.match(payload.instructions,/do not assume every saved note is a shopping list/);
 assert.match(payload.instructions,/For a Food preparation note, focus on practical recipes/);
 const contextMessage=payload.input[0].content.replace(/^Shopwise listing context \(untrusted; reference only if useful\): /,'');
 assert.equal(JSON.parse(contextMessage).savedNoteRequest,true);
 assert.equal(JSON.parse(contextMessage).savedNoteCategory,'food-preparation');
 assert.match(reply,/spaghetti meal plan/);
 assert.match(reply,/\[Retailer source\]\(https:\/\/example\.com\/groceries\)/);
});

test('saved notes with ordinary questions receive normal answers',async()=>{
 let payload;
 await generateReply({message:'How can I organize my week?',context:{savedNoteRequest:true}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Start with your priorities.')};
 });
 assert.equal(payload.input.at(-1).content,'How can I organize my week?');
 assert.equal(payload.tool_choice,'auto');
 assert.match(payload.instructions,/If it asks a general question, respond normally and directly/);
});

test('saved-note categories are validated and guide grocery searches',async()=>{
 let payload;
 await generateReply({message:'Fresh ingredients for dinner',context:{savedNoteRequest:true,savedNoteCategory:'grocery-finding'}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Here are some ingredients.')};
 });
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.match(payload.instructions,/search Singapore retailers for relevant products and current listed prices/);
 const invalid=require('../lib/ai.cjs').validateInput({message:'A note',context:{savedNoteRequest:true,savedNoteCategory:'product-research'}});
 assert.equal(JSON.parse(invalid.context).savedNoteCategory,'general');
});

test('answers promo-code searches naturally with web citations',async()=>{
 let payload;
 const source={title:'FairPrice promotions',url:'https://www.fairprice.com.sg/promotions'};
 const reply=await generateReply({
  message:'Find current promo codes for FairPrice.',
  context:{promoCodeSearch:true}
 },env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! I found a FairPrice promotion. Use **FP10** for 10% off selected items, subject to the terms on the [FairPrice promotion page](https://www.fairprice.com.sg/promotions). The page does not confirm whether this code is currently valid.',[source])};
 });
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.equal(payload.max_output_tokens,1000);
 assert.equal(payload.input.at(-1).content,'Find current promo codes for FairPrice.');
 assert.match(payload.instructions,/Answer naturally with a short introduction and one Markdown bullet per verified result, not JSON or a product table/);
 assert.match(payload.instructions,/Link each code directly to the cited page that displays it/);
 assert.match(payload.instructions,/verify its exact spelling/);
 assert.match(payload.instructions,/one targeted check of a reputable coupon source/);
 assert.match(payload.instructions,/Exclude expired, mismatched, or unsupported codes/);
 assert.match(reply,/\*\*FP10\*\*/);
 assert.match(reply,/\[FairPrice promotion page\]\(https:\/\/www\.fairprice\.com\.sg\/promotions\)/);
 assert.match(reply,/does not confirm whether this code is currently valid/);
 assert.match(reply,/\[FairPrice promotions\]\(https:\/\/www\.fairprice\.com\.sg\/promotions\)/);

 const noSources=await generateReply({message:'Find codes for FairPrice',context:{promoCodeSearch:true}},env,async()=>({ok:true,status:200,json:async()=>response('The official promotions page has no published voucher code.')}));
 assert.match(noSources,/No promo codes could be verified from accessible web sources/);
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
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:401})),/key is active and belongs to AI_BASE_URL/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:401}),{requireSearch:true}),/rejected the live web-search request/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:403})),/AI_MODEL and its web-search permissions/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:429})),/usage limit/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:false,status:400})),/Responses API web-search request/);
 await assert.rejects(requestWebResponse('hello',env,async()=>({ok:true,json:async()=>({output:[]})})),/did not return an answer/);
 await assert.rejects(requestWebResponse('hello',env,async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'})},{requireSearch:true}),/required AI web search took too long/);
 await assert.rejects(requestWebResponse('Find a Sony promo code',env,async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'})},{requireSearch:true,timeoutMessage:'Promo-code web search timed out.'}),/Promo-code web search timed out/);
});

test('Ignores unsafe citation URLs',async()=>{
 const fakeFetch=async()=>({ok:true,status:200,json:async()=>response('An answer.',[
  {title:'Unsafe',url:'javascript:alert(1)'},
  {title:'Safe',url:'https://example.com'}
 ])});
 assert.equal(await generateReply({message:'Tell me something'},env,fakeFetch),'Hello! An answer.\n\nSources:\n- [Safe](https://example.com/)');
});
