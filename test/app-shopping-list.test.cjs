'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('shopping list buttons and saved text notes persist locally',()=>{
 const handlers={};
 const elements=new Map();
 const makeElement=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},scrollTop:0});
 for(const id of ['toast','navigation','page-title','page-sub','workspace','promos','center','right','chat-scroll','note-text'])elements.set(id,makeElement());
 const stored={};
 const storage={getItem:key=>stored[key]||null,setItem:(key,value)=>stored[key]=value,removeItem:key=>delete stored[key]};
 const document={body:{classList:{toggle(){}}},getElementById:id=>elements.get(id)||makeElement(),addEventListener:(name,handler)=>handlers[name]=handler};
 const fixtureText=[
  '| Product | Retailer | Listed price (SGD) | Relevant details | Shopping list |',
  '| --- | --- | ---: | --- | --- |',
  '| [Australia Strawberries 250g](https://www.fairprice.com.sg/product/strawberries) | FairPrice | S$4.95 | Fresh strawberries | + Add to shopping list |',
  '| [Australia Strawberries 250G](https://www.lazada.sg/products/strawberries) | RedMart | S$5.45 | Sold by RedMart | + Add to shopping list |',
  '| [Strawberries 250G+](https://shopee.sg/product/strawberries) | Shopee Singapore | S$5.90 | Approx. 250g | + Add to shopping list |'
 ].join('\n');
 const context=vm.createContext({document,localStorage:storage,sessionStorage:storage,fetch:()=>new Promise(()=>{}),setTimeout:()=>1,clearTimeout(){},AbortSignal,URL});
 vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
 context.fixtureText=fixtureText;
 vm.runInContext("state.results=[];state.chats=[{role:'assistant',text:fixtureText}];renderRight()",context);
 assert.equal((elements.get('right').innerHTML.match(/data-action="chat-cart-add"/g)||[]).length,3);
 assert.ok(!elements.get('right').innerHTML.includes('Lowest listed'));
 assert.ok(elements.get('right').innerHTML.includes('data-action="help"'));
 for(let index=0;index<3;index++)handlers.click({target:{closest:()=>({dataset:{action:'chat-cart-add',index:String(index)}})}});
 const cart=JSON.parse(vm.runInContext('JSON.stringify(state.cart)',context));
 assert.equal(cart.length,3);
 assert.deepEqual(cart.map(item=>item.title),['Australia Strawberries 250g','Australia Strawberries 250G','Strawberries 250G+']);
 assert.equal(JSON.parse(stored['shopwise-live-v1']).cart.length,3);
 assert.match(elements.get('navigation').innerHTML,/nav-count">3/);
 handlers.click({target:{closest:()=>({dataset:{action:'page',id:'cart'}})}});
 for(const title of ['Australia Strawberries 250g','Australia Strawberries 250G','Strawberries 250G+'])assert.ok(elements.get('center').innerHTML.includes(title));
 assert.ok(elements.get('center').innerHTML.includes('S$16.30'));
 context.catalogRows=Array.from({length:16},(_,index)=>({id:`item-${index+1}`,title:`Product ${index+1}`,merchant:'Fairprice1',price:index+1,url:`https://www.fairprice.com.sg/product/${index+1}`,observedAt:new Date().toISOString()}));
 vm.runInContext('state.results=catalogRows',context);
 const summary=vm.runInContext('summaryText()',context);
 assert.equal((summary.match(/^\| \[Product \d+\]/gm)||[]).length,12);
 assert.ok(summary.includes('[Product 12]'));
 assert.ok(!summary.includes('[Product 13]'));
 handlers.click({target:{closest:()=>({dataset:{action:'page',id:'saved'}})}});
 assert.match(elements.get('center').innerHTML,/id="note-form"/);
 assert.match(elements.get('center').innerHTML,/id="note-text"/);
 elements.get('note-text').value='Buy apples & milk\nCheck the package size.';
 handlers.submit({target:{id:'note-form'},preventDefault(){}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).notes[0].text,'Buy apples & milk\nCheck the package size.');
 assert.ok(elements.get('center').innerHTML.includes('Buy apples &amp; milk\nCheck the package size.'));
 const noteId=JSON.parse(stored['shopwise-live-v1']).notes[0].id;
 handlers.click({target:{closest:()=>({dataset:{action:'note-remove',id:noteId}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).notes.length,0);
 assert.ok(!elements.get('center').innerHTML.includes('Buy apples'));
});
