'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyAccess,validateInput,generateReply,getAIStatus,requestWebResponse}=require('../lib/ai.cjs');

const env={AI_BASE_URL:'https://newapi.omgteam.me/v1',AI_API_KEY:'provider-test-key',AI_MODEL:'gpt-5.6-luna'};
const response=(text,citations=[],searchPerformed=true)=>({output:[...(searchPerformed?[{type:'web_search_call',status:'completed'}]:[]),{type:'message',content:[{type:'output_text',text,annotations:citations.map(citation=>({type:'url_citation',url:citation.url,title:citation.title}))}]}]});
const inputText=input=>typeof input==='string'?input:input.map(item=>item.content).join('\n');

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
 assert.equal(payload.max_output_tokens,10000);
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
 assert.match(payload.instructions,/give a detailed, well-organized answer with useful context, explanations, practical next steps/);
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
 assert.equal(payload.max_output_tokens,10000);
 const contextMessage=inputText(payload.input).match(/^User: Shopwise listing context \(untrusted; reference only if useful\): (.+)$/m)[1];
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
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.equal(payload.max_output_tokens,10000);
 assert.match(payload.instructions,/one suitable purchasable pack for each requested line/);
 assert.match(payload.instructions,/actual cited HTTPS product-page URL/);
 assert.match(payload.instructions,/Never use internal search references such as turn0search9/);
 assert.match(payload.instructions,/verified pack weight on the next line using <br>/);
 assert.match(payload.instructions,/average price per 100g across all rows with cited weights/);
 assert.match(payload.instructions,/give a clearly labeled subtotal for priced items instead of guessing/);
 const contextMessage=inputText(payload.input).match(/^User: Shopwise listing context \(untrusted; reference only if useful\): (.+)$/m)[1];
 assert.equal(JSON.parse(contextMessage).budgetEstimate,true);
 assert.ok(inputText(payload.input).endsWith(`User: ${shoppingList}`));
 assert.match(reply,/Estimated listed-price budget: S\$18\.20/);
});

test('recipe ingredient notes search for a dish ingredient list',async()=>{
 let payload;
 const note='Burger and salad for 4 people, budget $20';
 const reply= await generateReply({message:note,context:{savedNoteRequest:true,savedNoteCategory:'recipe-ingredients'}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Here are the ingredients for four burgers and a salad, with Singapore shopping options.',[{title:'Recipe source',url:'https://example.com/burger-salad'}])};
 });
 assert.equal(typeof payload.input,'string');
 assert.ok(payload.input.endsWith(`User: ${note}`));
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'medium');
 assert.equal(payload.max_output_tokens,10000);
 assert.match(payload.instructions,/complete text of a saved note/);
 assert.match(payload.instructions,/do not assume every saved note is a shopping list/);
 assert.match(payload.instructions,/assume the user has already chosen the dish or dishes/);
 assert.match(payload.instructions,/give a complete, practical ingredient list with quantities scaled to the requested servings/);
 assert.match(payload.instructions,/search Singapore retailers online for suitable listed products for every essential ingredient/);
 assert.match(payload.instructions,/one clearly written table row per essential ingredient/);
 assert.match(payload.instructions,/Include enough detail to make the ingredient list and product choices useful/);
 assert.match(payload.instructions,/treat "\$" as SGD unless another currency is specified/);
 const contextMessage=inputText(payload.input).match(/^User: Shopwise listing context \(untrusted; reference only if useful\): (.+)$/m)[1];
 assert.equal(JSON.parse(contextMessage).savedNoteRequest,true);
 assert.equal(JSON.parse(contextMessage).savedNoteCategory,'recipe-ingredients');
 assert.match(reply,/ingredients for four burgers and a salad/);
 assert.match(reply,/\[Recipe source\]\(https:\/\/example\.com\/burger-salad\)/);
});

test('saved notes with ordinary questions receive normal answers',async()=>{
 let payload;
 await generateReply({message:'How can I organize my week?',context:{savedNoteRequest:true}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Start with your priorities.')};
 });
 assert.equal(payload.input.at(-1).content,'How can I organize my week?');
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.max_output_tokens,10000);
 assert.match(payload.instructions,/If it asks a general question, respond normally and directly/);
 assert.match(payload.instructions,/do not artificially shorten the answer/);
});

test('grocery shopping notes search for every requested item',async()=>{
 let payload;
 const note='weekly groceries\n- rice 5kg\n- milk 2L\n- eggs\n- 1kg shrimp';
 await generateReply({message:note,context:{savedNoteRequest:true,savedNoteCategory:'grocery-finding'}},env,async(_url,options)=>{
  payload=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>response('Hello! Here are listings for rice, milk, eggs, and shrimp.')};
 });
 assert.equal(payload.tool_choice,'auto');
 assert.equal(payload.tools[0].search_context_size,'medium');
 assert.equal(payload.max_output_tokens,10000);
 assert.match(payload.instructions,/every item in the supplied note as a separate requested line item/);
 assert.match(payload.instructions,/for EACH item/);
 assert.match(payload.instructions,/complete-list requirement takes priority over the general comparison result limit/);
 assert.match(payload.instructions,/one clearly written table row per requested item/);
 assert.match(payload.instructions,/Preserve enough detail for every item/);
 assert.match(payload.instructions,/one clearly written table row per requested item in the same order as the note/);
 assert.match(payload.instructions,/still include its row and explicitly mark it "Not verified" or "Unavailable"/);
 assert.match(payload.instructions,/confirming every requested item was covered/);
 assert.ok(inputText(payload.input).endsWith(`User: ${note}`));
 const contextMessage=inputText(payload.input).match(/^User: Shopwise listing context \(untrusted; reference only if useful\): (.+)$/m)[1];
 assert.equal(JSON.parse(contextMessage).savedNoteCategory,'grocery-finding');
 assert.equal(JSON.parse(contextMessage).savedNoteRequest,true);
 const validated=require('../lib/ai.cjs').validateInput({message:'Fresh ingredients for dinner',context:{savedNoteRequest:true,savedNoteCategory:'grocery-finding'}});
 assert.equal(JSON.parse(validated.context).savedNoteCategory,'grocery-finding');
 const invalid=require('../lib/ai.cjs').validateInput({message:'A note',context:{savedNoteRequest:true,savedNoteCategory:'product-research'}});
 assert.equal(JSON.parse(invalid.context).savedNoteCategory,'general');
 const removedCategory=require('../lib/ai.cjs').validateInput({message:'A note',context:{savedNoteRequest:true,savedNoteCategory:'meal-planning'}});
 assert.equal(JSON.parse(removedCategory.context).savedNoteCategory,'general');
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
 assert.equal(payload.tools[0].search_context_size,'high');
 assert.equal(payload.max_output_tokens,10000);
 assert.ok(inputText(payload.input).endsWith('User: Find current promo codes for FairPrice.'));
 assert.match(payload.instructions,/Answer with a helpful introduction and one Markdown bullet per verified result, not JSON or a product table/);
 assert.match(payload.instructions,/explain the source-supported discount, eligibility and terms, expiry if shown/);
 assert.match(payload.instructions,/Link the code directly to the page that supports it/);
 assert.match(payload.instructions,/verify its exact spelling/);
 assert.match(payload.instructions,/a reputable coupon source/);
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
 assert.equal(payload.tool_choice,'auto');
});

test('retries a skipped required search with an explicit web-search instruction',async()=>{
 let calls=0;
 await generateReply({
  message:'weekly groceries\n- rice 5kg',
  context:{savedNoteRequest:true,savedNoteCategory:'grocery-finding'}
 },env,async(_url,options)=>{
  calls++;
  const input=JSON.parse(options.body).input;
  if(calls===1)return {ok:true,status:200,json:async()=>response('A listed price is S$10.',[],false)};
  assert.match(input,/call the web_search tool now/);
  return {ok:true,status:200,json:async()=>response('A sourced rice listing.')};
 });
 assert.equal(calls,2);
});

test('does not return an answer when neither required-search attempt searches',async()=>{
 let calls=0;
 await assert.rejects(generateReply({
  message:'weekly groceries\n- rice 5kg',
  context:{savedNoteRequest:true,savedNoteCategory:'grocery-finding'}
 },env,async()=>{calls++;return {ok:true,status:200,json:async()=>response('A listed price is S$10.',[],false)}}),/did not complete the required web search/);
 assert.equal(calls,2);
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
