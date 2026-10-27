'use strict';
const {timingSafeEqual} = require('node:crypto');

class ShoppingError extends Error { constructor(status,message){super(message);this.status=status;} }
const FEATURED=['FairPrice','Shopee','Lazada','Amazon SG','Cold Storage','RedMart'];
const STORES={
 'FairPrice':q=>`https://www.fairprice.com.sg/search?query=${encodeURIComponent(q)}`,
 'Shopee':q=>`https://shopee.sg/search?keyword=${encodeURIComponent(q)}`,
 'Lazada':q=>`https://www.lazada.sg/catalog/?q=${encodeURIComponent(q)}`,
 'Amazon SG':q=>`https://www.amazon.sg/s?k=${encodeURIComponent(q)}`,
 'Cold Storage':q=>'https://coldstorage.com.sg/',
 'RedMart':q=>`https://www.lazada.sg/catalog/?q=${encodeURIComponent(q)}`
};
const cache=new Map();
function authorized(secret,provided){if(!secret)return true;if(typeof provided!=='string')return false;const a=Buffer.from(secret),b=Buffer.from(provided);return a.length===b.length && timingSafeEqual(a,b);}
function normalizeStore(source){const s=String(source||'').toLowerCase();if(/fairprice|ntuc/.test(s))return 'FairPrice';if(/shopee/.test(s))return 'Shopee';if(/lazada/.test(s))return 'Lazada';if(/amazon/.test(s))return 'Amazon SG';if(/cold.storage/.test(s))return 'Cold Storage';if(/redmart/.test(s))return 'RedMart';return String(source||'Other retailer').slice(0,70);}
function safeUrl(value){try{const u=new URL(value);if(u.protocol==='https:' && !u.username && !u.password)return u.href;}catch{}return null;}
// Shopwise targets a broad audience. Do not help look up products that are age-restricted or inherently dangerous.
const blocked=/(?:\b(?:vape|vaping|cigarettes?|nicotine|tobacco|whisky|whiskey|vodka|alcohol|liquor|beer|wines?|marijuana|cannabis|thc|cbd|magic mushrooms?|cocaine|steroids|guns?|firearms?|ammunition|ammo|explosives?|fireworks|knives|switchblades?|brass knuckles|tasers?|pepper spray|adult toys?|sex toys?|porn(?:ography)?|lottery|casino|betting)\b)/i;
function validateQuery(raw){const q=String(raw||'').trim().replace(/\s+/g,' ');if(q.length<2||q.length>90)throw new ShoppingError(400,'Enter a product search between 2 and 90 characters.');if(blocked.test(q))throw new ShoppingError(400,'This product category is not supported in Shopwise.');return q;}
function parseAmount(item,key,fallback){const text=String(item[fallback]||'');if(/(?:£|€|₹|฿|\bUSD\b|US\$|\bMYR\b|\bRM\s|\bEUR\b|\bGBP\b)/i.test(text))return null;const n=Number(item[key]);if(Number.isFinite(n)&&n>0&&n<=1000000)return Math.round(n*100)/100;const match=text.match(/(?:S\$|SGD\s*|\$)\s*([\d,]+(?:\.\d{1,2})?)/i);if(!match)return null;const value=Number(match[1].replaceAll(',',''));return value>0&&value<=1000000?value:null;}
function normalizeResult(item,index){if(!item||typeof item!=='object')return null;
 const name=String(item.title||'').trim().slice(0,180);
 const source=String(item.source||'').trim();
 const price=parseAmount(item,'extracted_price','price');
 if(!name||!price)return null;
 const merchant=normalizeStore(source);
 const url=safeUrl(item.link)||safeUrl(item.product_link);
 if(!url)return null;
 const old=parseAmount(item,'extracted_old_price','old_price');
 const discount=old&&old>price?Math.round((1-price/old)*100):null;
 const thumbnail=safeUrl(item.thumbnail);
 const rating=Number(item.rating);
 return {id:String(item.product_id||`${index}-${name}`).slice(0,120),title:name,merchant,source:source.slice(0,90)||merchant,price,oldPrice:discount?old:null,discount:discount&&discount<100?discount:null,delivery:String(item.delivery||'').slice(0,120),rating:rating>=0&&rating<=5?rating:null,url,image:thumbnail,observedAt:new Date().toISOString()};
}
async function searchShopping(raw,env=process.env,fetcher=fetch){
 const q=validateQuery(raw);
 if(!env.SERPAPI_KEY)throw new ShoppingError(503,'Live prices are not connected yet. Add SERPAPI_KEY in Netlify environment variables, then redeploy.');
 const cacheKey=q.toLowerCase();const saved=cache.get(cacheKey);
 if(saved&&Date.now()<saved.expires)return {...saved.value,cached:true};
 const params=new URLSearchParams({engine:'google_shopping',q,gl:'sg',hl:'en',location:'Singapore',safe:'active',api_key:env.SERPAPI_KEY});
 let resp;
 try{resp=await fetcher(`https://serpapi.com/search.json?${params}`,{signal:AbortSignal.timeout(16000),headers:{Accept:'application/json'}})}catch(_){throw new ShoppingError(502,'Could not reach the shopping-search provider. Try again.');}
 if(resp.status===401||resp.status===403)throw new ShoppingError(502,'Shopping API key was rejected. Verify SERPAPI_KEY in Netlify.');
 if(resp.status===429)throw new ShoppingError(429,'The shopping-search limit has been reached. Try later or check SerpApi usage.');
 if(!resp.ok)throw new ShoppingError(502,'The shopping search service is temporarily unavailable.');
 let data;try{data=await resp.json()}catch(_){throw new ShoppingError(502,'The shopping provider returned invalid data.');}
 if(data.error)throw new ShoppingError(502,'Shopping provider: '+String(data.error).slice(0,170));
 const rawResults=[...(data.shopping_results||[]),...(data.inline_shopping_results||[])];
 for(const category of (data.categorized_shopping_results||[]))rawResults.push(...(category.shopping_results||[]));
 const unique=new Map();
 for(let i=0;i<rawResults.length;i++){
   const r=normalizeResult(rawResults[i],i);if(!r)continue;
   const key=`${r.merchant}|${r.title.toLowerCase()}|${r.price}`;
   if(!unique.has(key))unique.set(key,r);
 }
 const products=[...unique.values()].slice(0,60).sort((a,b)=>a.price-b.price);
 const payload={query:q,products,source:'Google Shopping via SerpApi',fetchedAt:new Date().toISOString(),cached:false,stores:FEATURED.map(name=>({name,searchUrl:STORES[name](q),results:products.filter(p=>p.merchant===name).length}))};
 if(cache.size>60){const k=cache.keys().next().value;cache.delete(k)}
 cache.set(cacheKey,{expires:Date.now()+5*60*1000,value:payload});
 return payload;
}
module.exports={ShoppingError,FEATURED,STORES,authorized,normalizeStore,normalizeResult,validateQuery,searchShopping};
