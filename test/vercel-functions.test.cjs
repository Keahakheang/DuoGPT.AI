'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

const load=path=>import(path);
const request=(url,method='GET',headers={},body='')=>new Request(url,{method,headers,body:method==='GET'||method==='HEAD'?undefined:body});

test('Vercel status route reports configuration without exposing credentials',async()=>{
 const {GET,OPTIONS}=await load('../api/status.mjs');
 const response=await GET(request('https://shopwise.example/api/status'));
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(typeof body.aiConfigured,'boolean');
 assert.equal(body.shoppingSource,'AI web search');
 assert.equal(body.liveRetailersConnected,false);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await OPTIONS(request('https://shopwise.example/api/status','OPTIONS'))).status,204);
});

test('Vercel routes handle preflight and invalid chat input',async()=>{
 const [{GET:status},{GET:search,OPTIONS:searchOptions},{POST:chat}]=await Promise.all([
  load('../api/status.mjs'),
  load('../api/search.mjs'),
  load('../api/chat.mjs')
 ]);
 assert.equal((await status(request('https://shopwise.example/api/status'))).status,200);
 assert.equal((await searchOptions(request('https://shopwise.example/api/search','OPTIONS'))).status,204);
 const previous=process.env.CHAT_ACCESS_CODE;
 delete process.env.CHAT_ACCESS_CODE;
 try {
  const invalid=await chat(request('https://shopwise.example/api/chat','POST',{'Content-Type':'application/json'},'{'));
  assert.equal(invalid.status,400);
  assert.deepEqual(await invalid.json(),{error:'Invalid JSON.'});
 } finally {
  if(previous!==undefined)process.env.CHAT_ACCESS_CODE=previous;
 }
});

test('Vercel search route checks its configured access code',async()=>{
 const {GET:handler}=await load('../api/search.mjs');
 const previous=process.env.SEARCH_ACCESS_CODE;
 process.env.SEARCH_ACCESS_CODE='vercel-test-code';
 try {
  const response=await handler(request('https://shopwise.example/api/search?q=oats'));
  assert.equal(response.status,401);
  assert.equal((await response.json()).code,'ACCESS_CODE_REQUIRED');
 } finally {
  if(previous===undefined)delete process.env.SEARCH_ACCESS_CODE;
  else process.env.SEARCH_ACCESS_CODE=previous;
 }
});

test('Vercel saved-note search requires live web search and AI summary skips a second search',async()=>{
 const [{GET:search},{POST:chat}]=await Promise.all([
  load('../api/search.mjs'),
  load('../api/chat.mjs')
 ]);
 const envNames=['AI_BASE_URL','AI_API_KEY','AI_MODEL','SEARCH_ACCESS_CODE','CHAT_ACCESS_CODE'];
 const previousEnv=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
 const previousFetch=global.fetch;
 const toolChoices=[];
 process.env.AI_BASE_URL='https://provider.example/v1';
 process.env.AI_API_KEY='vercel-test-token';
 process.env.AI_MODEL='test-model';
 delete process.env.SEARCH_ACCESS_CODE;
 delete process.env.CHAT_ACCESS_CODE;
 global.fetch=async(_url,options)=>{
  const payload=JSON.parse(options.body);
  toolChoices.push(payload.tool_choice);
  return new Response(JSON.stringify({output:[{type:'message',content:[{
   type:'output_text',
   text:payload.tools.length
    ?JSON.stringify({products:[{title:'Rice 5kg',merchant:'FairPrice',priceSGD:5,url:'https://fairprice.example/rice',imageUrl:null}]})
    :'Hello! Rice 5kg is listed at S$5.',
   annotations:payload.tools.length?[{type:'url_citation',url:'https://fairprice.example/rice',title:'Rice'}]:[]
  }]}]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try {
  const searchResponse=await search(request('https://shopwise.example/api/search?q=rice%205kg&requireSearch=1'));
  assert.equal(searchResponse.status,200);
  assert.deepEqual((await searchResponse.json()).products.map(product=>product.title),['Rice 5kg']);
  const chatResponse=await chat(request('https://shopwise.example/api/chat','POST',{'Content-Type':'application/json'},JSON.stringify({
   message:'Summarize searched note items.',
   context:{budgetEstimateFromSearch:true,requestedItems:['rice 5kg'],subtotalSGD:5,offers:[{
    requestedItem:'rice 5kg',title:'Rice 5kg',store:'FairPrice',itemPriceSGD:5,sourceUrl:'https://fairprice.example/rice'
   }]}
  })));
  assert.equal(chatResponse.status,200);
  assert.match((await chatResponse.json()).reply,/Rice 5kg is listed/);
  assert.deepEqual(toolChoices,['required','none']);
 } finally {
  global.fetch=previousFetch;
  for(const name of envNames) {
   if(previousEnv[name]===undefined)delete process.env[name];
   else process.env[name]=previousEnv[name];
  }
 }
});
