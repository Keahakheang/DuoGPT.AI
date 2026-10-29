'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ShoppingError,normalizeStore,normalizeResult,validateQuery,imageFromProductPage,searchShopping,authorized}=require('../lib/shopping.cjs');

const env={AI_BASE_URL:'https://newapi.omgteam.me/v1',AI_API_KEY:'provider-test-key',AI_MODEL:'gpt-5.6-luna'};
const products=[
 {title:'Brand Oats 1 kg',merchant:'FairPrice',priceSGD:5.95,url:'https://www.fairprice.com.sg/product/oats-1kg',imageUrl:'https://www.fairprice.com.sg/images/oats.jpg'},
 {title:'Brand Oats 1 kg',merchant:'Shopee Singapore',priceSGD:4.5,url:'https://shopee.sg/product/123'},
 {title:'Other oats 500 g',merchant:'Marketplace',priceSGD:3,url:'https://example.com/oats'},
 {title:'Not cited oats',merchant:'Shop',priceSGD:1,url:'https://uncited.example/product'}
];
const searchResponse={
 output:[{
  type:'message',
  content:[{
   type:'output_text',
   text:JSON.stringify({products}),
   annotations:products.slice(0,3).map((item,index)=>({type:'url_citation',title:item.merchant,url:index===0?item.url.replace('https://www.','https://'):item.url}))
  }]
 }]
};
const noImageFetcher=async()=>({ok:false,status:404});
const mock=async(url,options)=>{
 assert.equal(url,'https://newapi.omgteam.me/v1/responses');
 const payload=JSON.parse(options.body);
 assert.equal(payload.tools[0].type,'web_search');
 assert.equal(payload.tools[0].search_context_size,'low');
 assert.equal(payload.tool_choice,'auto');
 assert.match(payload.input,/Singapore/);
 assert.match(payload.instructions,/only products explicitly sold or available in Singapore/);
 assert.match(payload.instructions,/up to 8/);
 assert.equal(payload.max_output_tokens,900);
 assert.equal(options.signal.aborted,false);
 assert.equal(payload.text,undefined);
 return {ok:true,status:200,json:async()=>searchResponse};
};

test('validates product query and blocks restricted products',()=>{
 assert.equal(validateQuery(' rolled   oats 1kg '),'rolled oats 1kg');
 assert.throws(()=>validateQuery(''),error=>error.status===400);
 assert.throws(()=>validateQuery('vape'),error=>error.status===400);
});

test('access code comparison uses constant-time equality for equal lengths',()=>{
 assert.equal(authorized('abcd','abcd'),true);
 assert.equal(authorized('abcd','oops'),false);
 assert.equal(authorized('abcd','abcde'),false);
});

test('classifies retailer sources',()=>{
 assert.equal(normalizeStore('NTUC Fairprice1'),'Fairprice1');
 assert.equal(normalizeStore('Shopee Singapore'),'Shopee');
});

test('normalizes prices, retailer links, and actual markdowns safely',()=>{
 const item=normalizeResult({
  title:'Brand Oats 1 kg',
  source:'Fairprice',
  extracted_price:5.95,
  price:'S$5.95',
  old_price:'S$7.00',
  extracted_old_price:7,
  product_link:'https://www.fairprice.com.sg/product/oats-1kg'
 },0);
 assert.equal(item.discount,15);
 assert.equal(item.price,5.95);
 assert.equal(item.merchant,'Fairprice1');
 assert.equal(normalizeResult({
  title:'Unsafe image',
  source:'Fairprice',
  extracted_price:5,
  price:'S$5.00',
  link:'https://www.fairprice.com.sg/product/oats',
  imageUrl:'javascript:alert(1)'
 },0).image,null);
 assert.equal(normalizeResult({title:'Invalid URL',price:'S$2',product_link:'javascript:alert(1)'},0),null);
});

test('extracts actual product photos from retailer metadata or Product JSON-LD',()=>{
 const page='https://www.fairprice.com.sg/product/bread';
 assert.equal(imageFromProductPage('<meta property="og:image" content="https://cdn.fairprice.com.sg/bread.jpg?x=1&amp;y=2">',page),'https://cdn.fairprice.com.sg/bread.jpg?x=1&y=2');
 assert.equal(imageFromProductPage('<script type="application/ld+json">{"@type":"Product","image":["https://cdn.fairprice.com.sg/bread-front.jpg"]}</script>',page),'https://cdn.fairprice.com.sg/bread-front.jpg');
 assert.equal(imageFromProductPage('<meta property="og:image" content="javascript:alert(1)">',page),null);
});

test('requires AI credentials instead of returning fabricated listings',async()=>{
 await assert.rejects(()=>searchShopping('oats',{},mock),error=>error.status===503&&error.message.includes('AI_API_KEY'));
});

test('uses compatible live web search and only returns listings with cited HTTPS product URLs and SGD prices',async()=>{
 const data=await searchShopping('rolled oats 1kg',env,mock,noImageFetcher);
 assert.equal(data.query,'rolled oats 1kg');
 assert.equal(data.source,'AI web search');
 assert.equal(data.products.length,3);
 assert.equal(data.products[0].price,3);
 assert.equal(data.products.find(item=>item.merchant==='Fairprice1').price,5.95);
 assert.equal(data.products.find(item=>item.merchant==='Fairprice1').image,'https://www.fairprice.com.sg/images/oats.jpg');
 assert.equal(data.stores.find(item=>item.name==='Shopee').results,1);
 assert.equal(data.cached,false);
 const cached=await searchShopping('rolled oats 1kg',env,async()=>{throw new Error('must use cache')});
 assert.equal(cached.cached,true);
});

test('caps results at 8 and keeps verified product images',async()=>{
 const listings=Array.from({length:12},(_,index)=>({
  title:`Singapore oats ${index+1}`,
  merchant:'FairPrice',
  priceSGD:index+1,
  url:`https://www.fairprice.com.sg/product/oats-${index+1}`,
  imageUrl:`https://www.fairprice.com.sg/images/oats-${index+1}.jpg`
 }));
 const data=await searchShopping('oats many results '+Date.now(),env,async(_url,options)=>{
  const payload=JSON.parse(options.body);
  assert.match(payload.instructions,/direct HTTPS image URL/);
  assert.equal(payload.tools[0].search_context_size,'low');
  return {ok:true,status:200,json:async()=>({output:[{type:'message',content:[{
   type:'output_text',
   text:JSON.stringify({products:listings}),
   annotations:listings.map(item=>({type:'url_citation',url:item.url}))
  }]}]})};
 },noImageFetcher);
 assert.equal(data.products.length,8);
 assert.equal(data.products[0].image,'https://www.fairprice.com.sg/images/oats-1.jpg');
});

test('fetches a missing product image from the cited Singapore retailer page',async()=>{
 const result=await searchShopping('bread image '+Date.now(),env,async()=>({
  ok:true,status:200,json:async()=>({output:[{type:'message',content:[{
   type:'output_text',
   text:JSON.stringify({products:[{title:'FairPrice White Bread',merchant:'FairPrice',priceSGD:1.25,url:'https://www.fairprice.com.sg/product/bread',imageUrl:null}]}),
   annotations:[{type:'url_citation',url:'https://www.fairprice.com.sg/product/bread'}]
  }]}]})
 }),async(url,options)=>{
  assert.equal(url,'https://www.fairprice.com.sg/product/bread');
  assert.equal(options.redirect,'manual');
  return {ok:true,status:200,headers:{get:()=> 'text/html'},text:async()=>'<meta property="og:image" content="https://cdn.fairprice.com.sg/white-bread.jpg">'};
 });
 assert.equal(result.products[0].image,'https://cdn.fairprice.com.sg/white-bread.jpg');
});

test('ignores uncited pages, missing price data, and malformed JSON',async()=>{
 const text=JSON.stringify({products:[
  ...products.slice(0,3),
  {title:'No price',merchant:'Shop',priceSGD:null,url:'https://example.com/no-price'}
 ]});
 const data=await searchShopping('fresh query '+Date.now(),env,async()=>({
  ok:true,status:200,json:async()=>({output:[{type:'message',content:[{type:'output_text',text,annotations:products.slice(0,3).map(item=>({type:'url_citation',url:item.url}))}]}]})
 }),noImageFetcher);
 assert.equal(data.products.length,3);
 await assert.rejects(()=>searchShopping('invalid json '+Date.now(),env,async()=>({
  ok:true,status:200,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'not JSON',annotations:[]}]}]})
 })),error=>error.status===502&&error.message.includes('unreadable format'));
});

test('surfaces provider rate limits',async()=>{
 await assert.rejects(()=>searchShopping('milk '+Date.now(),env,async()=>({ok:false,status:429})),error=>error.status===429);
});
