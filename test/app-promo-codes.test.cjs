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
  const codes=request.message.includes('headphones')
   ?['Hello! Current codes:','- **Shopee — `AUDIO10`** — 10% off.']
   :['Hello! Current Singapore-relevant codes found:','- **JBL — `JBL15`** — 15% off storewide; validity not confirmed.','- **iShopChangi — `MOCT10`** — S$10 off with minimum spend; expires today.','','Sources:','- [Retailer promotions](https://retailer.example/promotions)'];
  return {ok:true,json:async()=>({reply:codes.join('\n')})};
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
 assert.match(getElementById('center').innerHTML,/class="promo-result-list"/);
 assert.match(getElementById('center').innerHTML,/<li><strong>JBL — <code class="promo-code-token">JBL15<\/code><\/strong> — 15% off storewide; validity not confirmed\.<\/li>/);
 assert.match(getElementById('center').innerHTML,/<li><strong>iShopChangi — <code class="promo-code-token">MOCT10<\/code><\/strong> — S\$10 off with minimum spend; expires today\.<\/li>/);
 assert.match(getElementById('center').innerHTML,/<a href="https:\/\/retailer\.example\/promotions"/);
 handlers.click({target:{closest:()=>({dataset:{action:'promo-save'}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos.length,1);
 assert.match(getElementById('center').innerHTML,/Saved promo codes/);
 assert.match(getElementById('center').innerHTML,/data-action="promo-remove"/);

 getElementById('promo-query').value='wireless headphones';
 handlers.submit({target:{id:'promo-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 const updatedPage=getElementById('center').innerHTML;
 assert.match(updatedPage,/AUDIO10/);
 assert.match(updatedPage,/JBL15/);
 assert.match(updatedPage,/MOCT10/);
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos[0].query,'FairPrice groceries');
});

test('Promo answer renderer separates inline retailer-code entries into list items',()=>{
 const elements=new Map();
 const makeElement=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},scrollTop:0});
 const getElementById=id=>{
  if(!elements.has(id))elements.set(id,makeElement());
  return elements.get(id);
 };
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const document={body:{classList:{toggle(){}}},getElementById,addEventListener(){}};
 const context=vm.createContext({document,localStorage:storage,sessionStorage:storage,fetch:async()=>({ok:true,json:async()=>({})}),setTimeout:()=>1,clearTimeout(){},AbortSignal,URL});
 vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
 const rendered=vm.runInContext(`renderPromoAnswer("Hello! Codes found: - **JBL — \`JBL15\`** — 15% off - **iShopChangi — \`MOCT10\`** — S$10 off")`,context);
 assert.equal((rendered.match(/<li>/g)||[]).length,2);
 assert.match(rendered,/<code class="promo-code-token">JBL15<\/code>/);
 assert.match(rendered,/<code class="promo-code-token">MOCT10<\/code>/);
});
