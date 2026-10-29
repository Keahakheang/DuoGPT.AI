import shopping from '../../lib/shopping.cjs';
const {searchShopping,ShoppingError,authorized}=shopping;
export default async function handler(request){
 const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(request.method!=='GET')return json({error:'Use GET.'},405);
 if(!authorized(process.env.SEARCH_ACCESS_CODE,request.headers.get('x-shopwise-search-code')))return json({error:'Enter the search access code configured by the site owner.',code:'ACCESS_CODE_REQUIRED'},401);
 try{const {searchParams}=new URL(request.url);return json(await searchShopping(searchParams.get('q')))}
 catch(err){return json({error:err instanceof ShoppingError?err.message:'Shopping search failed.'},err.status||500)}
}
