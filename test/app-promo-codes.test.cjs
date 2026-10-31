'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Promo codes page searches online and displays the cited AI answer',async()=>{
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
 let request;
 const fetch=async(url,options)=>{
  if(url==='/api/status')return {ok:true,json:async()=>({aiConfigured:true,aiProvider:'Test provider'})};
  request=JSON.parse(options.body);
  return {ok:true,json:async()=>({reply:'Hello! No verifiable promo code was found.\\n\\nSources:\\n- [Retailer promotions](https://retailer.example/promotions)'})};
 };
 const context=vm.createContext({document,localStorage:storage,sessionStorage:storage,fetch,setTimeout:()=>1,clearTimeout(){},AbortSignal,URL});
 vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
 vm.runInContext("state.page='promos';render()",context);
 const nav=getElementById('navigation').innerHTML;
 const page=getElementById('center').innerHTML;
 assert.match(nav,/Promo codes/);
 assert.doesNotMatch(nav,/Store connections/);
 assert.match(page,/Find a promo code/);
 assert.doesNotMatch(page,/Observed reductions|Retailer connections/);

 getElementById('promo-query').value='FairPrice groceries';
 handlers.submit({target:{id:'promo-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(request.context.promoCodeSearch,true);
 assert.match(request.message,/FairPrice groceries/);
 assert.match(getElementById('center').innerHTML,/No verifiable promo code was found/);
 assert.match(getElementById('center').innerHTML,/<a href="https:\/\/retailer\.example\/promotions"/);
});
