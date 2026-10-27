'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ShoppingError,normalizeStore,normalizeResult,validateQuery,searchShopping,authorized}=require('../lib/shopping.cjs');
const sample={shopping_results:[
 {product_id:'123',title:'Brand Oats 1 kg',source:'NTUC FairPrice',extracted_price:5.95,price:'S$5.95',old_price:'S$7.00',extracted_old_price:7,product_link:'https://www.google.com/shopping/product/123?gl=sg'},
 {product_id:'124',title:'Brand Oats 1 kg',source:'Shopee Singapore',extracted_price:4.5,price:'S$4.50',product_link:'https://shopee.sg/item/123'},
 {product_id:'125',title:'Other oats 500 g',source:'Marketplace',price:'SGD 3.00',product_link:'https://example.com/p'},
 {product_id:'error',title:'No listing',source:'Shop',price:'USD 34.50',product_link:'https://example.com/p'},
 {product_id:'no-url',title:'Oats no URL',source:'Store',price:'S$2',product_link:'javascript:alert(1)'}
]};
const mock=async(url)=>({ok:true,status:200,json:async()=>sample});
test('validates query and blocks age-restricted products',()=>{assert.equal(validateQuery(' rolled   oats 1kg '),'rolled oats 1kg');assert.throws(()=>validateQuery(''),e=>e.status===400);assert.throws(()=>validateQuery('vape'),e=>e.status===400)});
test('token code constant-time verification logic',()=>{assert.equal(authorized('abcd','abcd'),true);assert.equal(authorized('abcd','oops'),false);assert.equal(authorized('abcd','abcde'),false)});
test('retailer classification',()=>{assert.equal(normalizeStore('NTUC FairPrice'),'FairPrice');assert.equal(normalizeStore('Shopee Singapore'),'Shopee')});
test('normalizes prices safely and computes only actual markdowns',()=>{const s=normalizeResult(sample.shopping_results[0],0);assert.equal(s.discount,15);assert.equal(s.price,5.95);assert.equal(s.merchant,'FairPrice');assert.equal(normalizeResult(sample.shopping_results[4],4),null)});
test('missing key is honest error, not fake data',async()=>{await assert.rejects(()=>searchShopping('oats',{},mock),e=>e.status===503&&e.message.includes('SERPAPI_KEY'))});
test('search maps real sourced data and deduplicates',async()=>{const data=await searchShopping('rolled oats 1kg',{SERPAPI_KEY:'test-not-a-real-key'},mock);assert.equal(data.query,'rolled oats 1kg');assert.equal(data.products.length,3);assert.equal(data.products[0].price,3);assert.equal(data.products.find(x=>x.merchant==='FairPrice').price,5.95);assert.equal(data.stores.find(x=>x.name==='Shopee').results,1);assert.equal(data.cached,false);const r=await searchShopping('rolled oats 1kg',{SERPAPI_KEY:'test-not-a-real-key'},()=>{throw Error('must use cache')});assert.equal(r.cached,true)});
test('upstream auth and usage error are readable',async()=>{const bad=async()=>({status:429,ok:false});await assert.rejects(()=>searchShopping('milk',{SERPAPI_KEY:'x'},bad),e=>e.status===429)});
