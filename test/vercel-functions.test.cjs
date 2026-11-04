'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

function responseRecorder(){
 return {
  headers:{},
  statusCode:0,
  body:'',
  setHeader(name,value){this.headers[name]=value},
  end(body=''){this.body=body}
 };
}

function request(method,{url='/',headers={},body}={}){
 return {method,url,headers,body};
}

test('Vercel API handlers use the Node request/response interface',async()=>{
 const previousChatCode=process.env.CHAT_ACCESS_CODE;
 const previousSearchCode=process.env.SEARCH_ACCESS_CODE;
 const previousAIBaseUrl=process.env.AI_BASE_URL;
 const previousAIKey=process.env.AI_API_KEY;
 const previousAIModel=process.env.AI_MODEL;
 const previousFetch=globalThis.fetch;
 delete process.env.CHAT_ACCESS_CODE;
 delete process.env.SEARCH_ACCESS_CODE;
 try{
  const statusHandler=(await import('../api/status.mjs')).default;
  const chatHandler=(await import('../api/chat.mjs')).default;
  const searchHandler=(await import('../api/search.mjs')).default;

  const statusResponse=responseRecorder();
  await statusHandler(request('GET'),statusResponse);
  assert.equal(statusResponse.statusCode,200);
  assert.equal(JSON.parse(statusResponse.body).shoppingSource,'AI web search');

  const optionsResponse=responseRecorder();
  await chatHandler(request('OPTIONS'),optionsResponse);
  assert.equal(optionsResponse.statusCode,204);
  assert.equal(optionsResponse.body,'');

  const methodResponse=responseRecorder();
  await chatHandler(request('GET'),methodResponse);
  assert.equal(methodResponse.statusCode,405);

  process.env.CHAT_ACCESS_CODE='test-chat-code';
  const invalidMessageResponse=responseRecorder();
  await chatHandler(request('POST',{
   headers:{'x-shopwise-code':'test-chat-code'},
   body:{message:''}
  }),invalidMessageResponse);
  assert.equal(invalidMessageResponse.statusCode,400);
  assert.match(JSON.parse(invalidMessageResponse.body).error,/Message must/);

  process.env.AI_BASE_URL='https://provider.example/v1';
  process.env.AI_API_KEY='test-provider-key';
  process.env.AI_MODEL='test-model';
  let providerRequest;
  globalThis.fetch=async(url,options)=>{
   providerRequest={url,body:JSON.parse(options.body)};
   return {
    ok:true,
    status:200,
    json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Hello! I found a shopping plan.',annotations:[]}]}]})
   };
  };
  const note='I want to prepare spaghetti this weekend. What groceries should I buy?';
  const noteResponse=responseRecorder();
  await chatHandler(request('POST',{
   headers:{'x-shopwise-code':'test-chat-code'},
   body:{message:note,context:{savedNoteRequest:true}}
  }),noteResponse);
  assert.equal(noteResponse.statusCode,200);
  assert.equal(JSON.parse(noteResponse.body).reply,'Hello! I found a shopping plan.');
  assert.equal(providerRequest.body.input.at(-1).content,note);
  assert.equal(JSON.parse(providerRequest.body.input[0].content.split(': ').slice(1).join(': ')).savedNoteRequest,true);
  assert.equal(providerRequest.body.tool_choice,'required');

  process.env.SEARCH_ACCESS_CODE='test-search-code';
  const unauthorizedSearchResponse=responseRecorder();
  await searchHandler(request('GET',{url:'/api/search?q=milk'}),unauthorizedSearchResponse);
  assert.equal(unauthorizedSearchResponse.statusCode,401);
 }finally{
  if(previousChatCode===undefined)delete process.env.CHAT_ACCESS_CODE;
  else process.env.CHAT_ACCESS_CODE=previousChatCode;
  if(previousSearchCode===undefined)delete process.env.SEARCH_ACCESS_CODE;
  else process.env.SEARCH_ACCESS_CODE=previousSearchCode;
  if(previousAIBaseUrl===undefined)delete process.env.AI_BASE_URL;
  else process.env.AI_BASE_URL=previousAIBaseUrl;
  if(previousAIKey===undefined)delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY=previousAIKey;
  if(previousAIModel===undefined)delete process.env.AI_MODEL;
  else process.env.AI_MODEL=previousAIModel;
  globalThis.fetch=previousFetch;
 }
});
