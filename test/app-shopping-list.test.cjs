'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('shopping list buttons, saved text notes, and note-to-chat search work',async()=>{
 const handlers={};
 const elements=new Map();
 const makeElement=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},scrollTop:0});
 for(const id of ['toast','navigation','page-title','page-sub','workspace','promos','center','right','chat-scroll','note-title','note-text'])elements.set(id,makeElement());
 const stored={};
 const storage={getItem:key=>stored[key]||null,setItem:(key,value)=>stored[key]=value,removeItem:key=>delete stored[key]};
 const document={body:{classList:{toggle(){}}},getElementById:id=>elements.get(id)||makeElement(),addEventListener:(name,handler)=>handlers[name]=handler};
 let chatRequest;
 const fetch=async(url,options)=>{
  if(url==='/api/chat'){chatRequest=JSON.parse(options.body);return {ok:true,json:async()=>({reply:'Hello! Estimated listed-price budget: S$18.20.'})}}
  return {ok:true,json:async()=>({aiConfigured:true,aiProvider:'Test provider'})};
 };
 const fixtureText=[
  '| Product | Retailer | Listed price (SGD) | Relevant details | Shopping list |',
  '| --- | --- | ---: | --- | --- |',
  '| [Australia Strawberries 250g](https://www.fairprice.com.sg/product/strawberries) | FairPrice | S$4.95 | Fresh strawberries | + Add to shopping list |',
  '| [Australia Strawberries 250G](https://www.lazada.sg/products/strawberries) | RedMart | S$5.45 | Sold by RedMart | + Add to shopping list |',
  '| [Strawberries 250G+](https://shopee.sg/product/strawberries) | Shopee Singapore | S$5.90 | Approx. 250g | + Add to shopping list |'
 ].join('\n');
 const context=vm.createContext({document,localStorage:storage,sessionStorage:storage,fetch,setTimeout:()=>1,clearTimeout(){},AbortSignal,URL});
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
 assert.match(elements.get('center').innerHTML,/id="note-title"/);
 assert.match(elements.get('center').innerHTML,/id="note-text"/);
 elements.get('note-title').value='Weekly groceries';
 elements.get('note-text').value='this week cooking\n- pork: 200g\n- broccoli: 200g\n- milk: 500ml';
 handlers.submit({target:{id:'note-form'},preventDefault(){}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).notes[0].text,elements.get('note-text').value);
 assert.equal(JSON.parse(stored['shopwise-live-v1']).notes[0].title,'Weekly groceries');
 assert.ok(elements.get('center').innerHTML.includes('<h4 class="personal-note-title">Weekly groceries</h4>'));
 assert.match(elements.get('center').innerHTML,/aria-label="Note actions"/);
 assert.match(elements.get('center').innerHTML,/data-action="note-products" data-id=/);
 assert.ok(!elements.get('center').innerHTML.includes('Find products &amp; estimate budget</button></div></div></form>'));
 const noteId=JSON.parse(stored['shopwise-live-v1']).notes[0].id;
 vm.runInContext('state.aiConfigured=true',context);
 handlers.click({target:{closest:()=>({dataset:{action:'note-products',id:noteId},closest:()=>({removeAttribute(){}})})}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(chatRequest.message,JSON.parse(stored['shopwise-live-v1']).notes[0].text);
 assert.equal(chatRequest.context.budgetEstimate,true);
 assert.deepEqual(chatRequest.context.offers,[]);
 assert.ok(elements.get('right').innerHTML.includes('this week cooking'));
 assert.ok(elements.get('right').innerHTML.includes('Estimated listed-price budget: S$18.20.'));
 context.budgetReply=[
  'Hello!',
  '',
  '| Product | Retailer | Listed price (SGD) | Relevant details | Shopping list |',
  '| --- | --- | ---: | --- | --- |',
  '| [Pasar Fresh Malaysia Lean Minced Pork 300g](turn0search9) | NTUC FairPrice | S$5.80 | Pack contains 300g | + Add to shopping list |',
  '',
  'Estimated listed-price budget: S$5.80.'
 ].join('\n');
 vm.runInContext("state.chats=[{role:'assistant',text:budgetReply}];renderRight()",context);
 const budgetHtml=elements.get('right').innerHTML;
 assert.match(budgetHtml,/<a href="https:\/\/www\.fairprice\.com\.sg\/search\?query=/);
 assert.ok(budgetHtml.includes('>Pasar Fresh Malaysia Lean Minced Pork 300g</a>'));
 assert.ok(!budgetHtml.includes('turn0search9'));
 handlers.click({target:{closest:()=>({dataset:{action:'note-remove',id:noteId}})}});
 assert.equal(JSON.parse(stored['shopwise-live-v1']).notes.length,0);
 assert.ok(!elements.get('center').innerHTML.includes('this week cooking'));
});
