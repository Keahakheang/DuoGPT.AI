'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ShoppingError,normalizeStore,normalizeResult,validateQuery,searchShopping,authorized}=require('../lib/shopping.cjs');

const env={AI_BASE_URL:'https://newapi.omgteam.me/v1',AI_API_KEY:'provider-test-key',AI_MODEL:'gpt-5.6-luna'};
const products=[
 {title:'Brand Oats 1 kg',merchant:'FairPrice',priceSGD:5.95,url:'https://www.fairprice.com.sg/product/oats-1kg'},
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
   annotations:products.slice(0,3).map(item=>({type:'url_citation',title:item.merchant,url:item.url}))
  }]
 }]
};
const mock=async(url,options)=>{
 assert.equal(url,'https://newapi.omgteam.me/v1/responses');
 assert.equal(JSON.parse(options.body).tools[0].type,'web_search');
 assert.equal(JSON.parse(options.body).tool_choice,'required');
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
 assert.equal(normalizeResult({title:'Invalid URL',price:'S$2',product_link:'javascript:alert(1)'},0),null);
});

test('requires AI credentials instead of returning fabricated listings',async()=>{
 await assert.rejects(()=>searchShopping('oats',{},mock),error=>error.status===503&&error.message.includes('AI_API_KEY'));
});

test('uses required live web search and only returns listings with cited HTTPS product URLs and SGD prices',async()=>{
 const data=await searchShopping('rolled oats 1kg',env,mock);
 assert.equal(data.query,'rolled oats 1kg');
 assert.equal(data.source,'AI web search');
 assert.equal(data.products.length,3);
 assert.equal(data.products[0].price,3);
 assert.equal(data.products.find(item=>item.merchant==='Fairprice1').price,5.95);
 assert.equal(data.stores.find(item=>item.name==='Shopee').results,1);
 assert.equal(data.cached,false);
 const cached=await searchShopping('rolled oats 1kg',env,async()=>{throw new Error('must use cache')});
 assert.equal(cached.cached,true);
});

test('ignores uncited pages, missing price data, and malformed JSON',async()=>{
 const text=JSON.stringify({products:[
  ...products.slice(0,3),
  {title:'No price',merchant:'Shop',priceSGD:null,url:'https://example.com/no-price'}
 ]});
 const data=await searchShopping('fresh query '+Date.now(),env,async()=>({
  ok:true,status:200,json:async()=>({output:[{type:'message',content:[{type:'output_text',text,annotations:products.slice(0,3).map(item=>({type:'url_citation',url:item.url}))}]}]})
 }));
 assert.equal(data.products.length,3);
 await assert.rejects(()=>searchShopping('invalid json '+Date.now(),env,async()=>({
  ok:true,status:200,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'not JSON',annotations:[]}]}]})
 })),error=>error.status===502&&error.message.includes('unreadable format'));
});

test('surfaces provider rate limits',async()=>{
 await assert.rejects(()=>searchShopping('milk '+Date.now(),env,async()=>({ok:false,status:429})),error=>error.status===429);
});
