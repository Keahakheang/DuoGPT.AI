import shopping from '../lib/shopping.cjs';
import http from '../lib/vercel-http.cjs';

const {searchShopping,ShoppingError,authorized}=shopping;
const {sendJson}=http;

export default async function handler(request,response) {
  if(request.method==='OPTIONS')return sendJson(response,204,null,request);
  if(request.method!=='GET')return sendJson(response,405,{error:'Use GET.'},request);
  if(!authorized(process.env.SEARCH_ACCESS_CODE,request.headers['x-shopwise-search-code'])) {
    return sendJson(response,401,{error:'Enter the search access code configured by the site owner.',code:'ACCESS_CODE_REQUIRED'},request);
  }
  try {
    const url=new URL(request.url,'https://shopwise.example');
    return sendJson(response,200,await searchShopping(url.searchParams.get('q')),request);
  } catch(error) {
    const status=error instanceof ShoppingError?error.status:Number.isInteger(error&&error.status)?error.status:500;
    return sendJson(response,status,{error:error instanceof ShoppingError?error.message:'Shopping search failed.'},request);
  }
}
