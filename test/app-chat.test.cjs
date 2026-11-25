'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('chatbox submits a message to AI and renders its response',async()=>{
 const handlers={};
 const elements=new Map();
 const makeElement=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},scrollTop:0});
 const getElementById=id=>{
  if(!elements.has(id))elements.set(id,makeElement());
  return elements.get(id);
 };
 const stored={};
 const storage={getItem:key=>stored[key]||null,setItem:(key,value)=>stored[key]=value,removeItem:key=>delete stored[key]};
 const document={body:{classList:{toggle(){}}},getElementById,addEventListener:(name,handler)=>handlers[name]=handler};
 const requests=[];
 const fetch=async(url,options)=>{
  if(url==='/api/status')return {ok:true,json:async()=>({aiConfigured:true,aiProvider:'Test provider'})};
  if(url==='/api/chat'){
   requests.push(JSON.parse(options.body));
   return {ok:true,json:async()=>({reply:'Hello! Here is a helpful answer.'})};
  }
  throw new Error(`Unexpected request: ${url}`);
 };
 const context=vm.createContext({document,localStorage:storage,sessionStorage:storage,fetch,setTimeout:()=>1,clearTimeout(){},AbortSignal,URL});
 vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));

 getElementById('chat-text').value='How can I compare grocery prices?';
 handlers.submit({target:{id:'chat-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));

 assert.equal(requests.length,1);
 assert.equal(requests[0].message,'How can I compare grocery prices?');
 assert.deepEqual(requests[0].history,[]);
 assert.equal(requests[0].context.savedNoteRequest,false);
 assert.ok(elements.get('right').innerHTML.includes('How can I compare grocery prices?'));
 assert.ok(elements.get('right').innerHTML.includes('Hello! Here is a helpful answer.'));
 assert.equal(vm.runInContext('state.chatPending',context),false);
});
