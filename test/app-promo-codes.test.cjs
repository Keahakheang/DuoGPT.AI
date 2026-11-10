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
 let headphoneSearches=0;
 const fetch=async(url,options)=>{
  if(url==='/api/status')return {ok:true,json:async()=>({aiConfigured:true,aiProvider:'Test provider'})};
  request=JSON.parse(options.body);
  let codes;
  if(request.message.includes('headphones')){const headphoneCode=headphoneSearches++?'audio10':'AUDIO10';codes=['Hello! Current codes:',`- **Shopee — \`${headphoneCode}\`** — 10% off. [View source](https://shopee.example/promotions)`]}
  else codes=['Hello! Current Singapore-relevant codes found:','- **Sony Singapore — `SONY10`** — 10% off selected products; Not confirmed by source. [View source](https://sony.example/promotions)','- **Another store — `SAVE20`** — S$20 off. [View source](https://another.example/promotions)','','Sources:','- [Sony Singapore promotions](https://sony.example/promotions)'];
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

 getElementById('promo-query').value='Sony promocode';
 handlers.submit({target:{id:'promo-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(request.context.promoCodeSearch,true);
 assert.match(request.message,/Sony promocode/);
 assert.match(getElementById('center').innerHTML,/class="promo-result-list"/);
 assert.doesNotMatch(getElementById('center').innerHTML,/ai-response-disclosure|Show promo search response/);
 assert.ok(getElementById('center').innerHTML.includes('Current Singapore-relevant codes found:'));
 assert.match(getElementById('center').innerHTML,/<li><strong>Sony Singapore — <code class="promo-code-token">SONY10<\/code><\/strong> — 10% off selected products; Not confirmed by source\. <a href="https:\/\/sony\.example\/promotions" target="_blank" rel="noopener noreferrer">View source<\/a> <button type="button" class="sm-btn promo-code-save" data-action="promo-save-code" data-index="0">Save code<\/button><\/li>/);
 assert.match(getElementById('center').innerHTML,/data-index="1">Save code/);
 assert.match(getElementById('center').innerHTML,/<a href="https:\/\/sony\.example\/promotions" target="_blank" rel="noopener noreferrer">Sony Singapore promotions<\/a>/);
 handlers.click({target:{closest:()=>({dataset:{action:'promo-save-code',index:'0'}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos.length,1);
 assert.match(JSON.parse(stored['shopwise-live-v1']).savedPromos[0].answer,/SONY10/);
 assert.doesNotMatch(JSON.parse(stored['shopwise-live-v1']).savedPromos[0].answer,/SAVE20/);
 assert.match(getElementById('center').innerHTML,/Saved promo codes/);
 assert.match(getElementById('center').innerHTML,/data-action="promo-remove"/);
 assert.doesNotMatch(getElementById('center').innerHTML,/ai-response-disclosure|Show saved promo response/);
 assert.match(getElementById('center').innerHTML,/data-action="promo-save-code" data-index="0" disabled>Saved<\/button>/);
 handlers.click({target:{closest:()=>({dataset:{action:'promo-save-code',index:'0'}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos.length,1);

 getElementById('promo-query').value='wireless headphones';
 handlers.submit({target:{id:'promo-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 const updatedPage=getElementById('center').innerHTML;
 assert.match(updatedPage,/AUDIO10/);
 assert.match(updatedPage,/SONY10/);
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos[0].query,'Sony promocode');
 handlers.click({target:{closest:()=>({dataset:{action:'promo-save-code',index:'0'}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos.length,2);
 getElementById('promo-query').value='headphones again';
 handlers.submit({target:{id:'promo-form'},preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(getElementById('center').innerHTML,/data-index="0" disabled>Saved<\/button>/);
 handlers.click({target:{closest:()=>({dataset:{action:'promo-save-code',index:'0'}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).savedPromos.length,2);
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
 const rendered=vm.runInContext(`renderPromoAnswer("Hello! Codes found: - **JBL — \`JBL15\`** — 15% off [View source](https://example.com/promo) - **iShopChangi — \`MOCT10\`** — S$10 off")`,context);
 assert.equal((rendered.match(/<li>/g)||[]).length,2);
 assert.match(rendered,/<code class="promo-code-token">JBL15<\/code>/);
 assert.match(rendered,/<code class="promo-code-token">MOCT10<\/code>/);
 assert.match(rendered,/<a href="https:\/\/example\.com\/promo"/);
});

test('Promo answer renderer shows Save code for bold-formatted promo codes',()=>{
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
 const rendered=vm.runInContext(`renderPromoAnswer("- **PAYLATERIT8** — S$8 off with a minimum spend. [Sony Store](https://store.sony.com.sg)",true)`,context);
 assert.match(rendered,/<code class="promo-code-token">PAYLATERIT8<\/code>/);
 assert.match(rendered,/data-action="promo-save-code" data-index="0">Save code<\/button>/);
});

test('Promo answer renderer shows Save code when a bold code follows a bullet marker',()=>{
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
 const rendered=vm.runInContext(`renderPromoAnswer("- **784497** — Large pizza deal from Domino's Singapore. [Source](https://dominos.com.sg/promo)",true)`,context);
 assert.match(rendered,/<code class="promo-code-token">784497<\/code>/);
 assert.match(rendered,/data-action="promo-save-code" data-index="0">Save code<\/button>/);
});

test('Promo answer renderer shows Save code for a linked promo code',()=>{
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
 const rendered=vm.runInContext(`renderPromoAnswer("- [OTTY28](https://store.sony.com.sg) — **S$28 off S$200 minimum spend** at Sony Store Online Singapore.",true)`,context);
 assert.match(rendered,/<a href="https:\/\/store\.sony\.com\.sg\/"/);
 assert.match(rendered,/data-action="promo-save-code" data-index="0">Save code<\/button>/);
});
