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

test('Vercel functions serve status and chat using Node request and response objects',async()=>{
 const previousChatCode=process.env.CHAT_ACCESS_CODE;
 const previousSearchCode=process.env.SEARCH_ACCESS_CODE;
 const previousAIBaseUrl=process.env.AI_BASE_URL;
 const previousAIKey=process.env.AI_API_KEY;
 const previousAIModel=process.env.AI_MODEL;
 const previousFetch=globalThis.fetch;
 delete process.env.CHAT_ACCESS_CODE;
 delete process.env.SEARCH_ACCESS_CODE;
 try {
  const statusHandler=require('../api/status.js');
  const chatHandler=require('../api/chat.js');
  const searchHandler=require('../api/search.js');

  const statusResponse=responseRecorder();
  await statusHandler(request('GET'),statusResponse);
  assert.equal(statusResponse.statusCode,200);
  assert.equal(JSON.parse(statusResponse.body).shoppingSource,'AI web search');

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
    json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Hello! I can help with that note.',annotations:[]}]}]})
   };
  };
  const note='I want to prepare spaghetti this weekend. What groceries should I buy?';
  const noteResponse=responseRecorder();
  await chatHandler(request('POST',{
   headers:{'x-shopwise-code':'test-chat-code'},
   body:{message:note,context:{savedNoteRequest:true}}
  }),noteResponse);
  assert.equal(noteResponse.statusCode,200);
  assert.equal(JSON.parse(noteResponse.body).reply,'Hello! I can help with that note.');
  assert.equal(providerRequest.body.input.at(-1).content,note);
  assert.equal(providerRequest.body.tool_choice,'auto');

  process.env.SEARCH_ACCESS_CODE='test-search-code';
  const unauthorizedSearchResponse=responseRecorder();
  await searchHandler(request('GET',{url:'/api/search?q=milk'}),unauthorizedSearchResponse);
  assert.equal(unauthorizedSearchResponse.statusCode,401);
 } finally {
  for(const [name,value] of [
   ['CHAT_ACCESS_CODE',previousChatCode],
   ['SEARCH_ACCESS_CODE',previousSearchCode],
   ['AI_BASE_URL',previousAIBaseUrl],
   ['AI_API_KEY',previousAIKey],
   ['AI_MODEL',previousAIModel]
  ]) {
   if(value===undefined)delete process.env[name];
   else process.env[name]=value;
  }
  globalThis.fetch=previousFetch;
 }
});
