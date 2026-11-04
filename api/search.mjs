import shopping from '../lib/shopping.cjs';
import cors from '../lib/extension-cors.cjs';

const {searchShopping,ShoppingError,authorized}=shopping;
const {extensionCorsHeaders}=cors;

function headersFor(request) {
  return {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    ...extensionCorsHeaders(request.headers.get('origin'))
  };
}

export function OPTIONS(request) {
  return new Response(null,{status:204,headers:headersFor(request)});
}

export async function GET(request) {
  const headers=headersFor(request);
  const json=(data,status=200)=>Response.json(data,{status,headers});
  if(!authorized(process.env.SEARCH_ACCESS_CODE,request.headers.get('x-shopwise-search-code'))) {
    return json({error:'Enter the search access code configured by the site owner.',code:'ACCESS_CODE_REQUIRED'},401);
  }
  try {
    const {searchParams}=new URL(request.url);
    return json(await searchShopping(
      searchParams.get('q'),
      process.env,
      fetch,
      {requireSearch:searchParams.get('requireSearch')==='1'}
    ));
  } catch(error) {
    return json({error:error instanceof ShoppingError?error.message:'Shopping search failed.'},error.status||500);
  }
}
