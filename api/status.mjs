import core from '../lib/ai.cjs';
import cors from '../lib/extension-cors.cjs';

const {getAIStatus}=core;
const {extensionCorsHeaders}=cors;

function headersFor(request) {
  return {
    'Cache-Control':'no-store',
    ...extensionCorsHeaders(request.headers.get('origin'))
  };
}

export function OPTIONS(request) {
  return new Response(null,{status:204,headers:headersFor(request)});
}

export async function GET(request) {
  const headers=headersFor(request);
  const aiStatus=getAIStatus();
  return Response.json({
    ...aiStatus,
    requiresCode:!!process.env.CHAT_ACCESS_CODE,
    provider:aiStatus.aiProvider||'Not configured',
    shoppingConfigured:aiStatus.aiConfigured,
    shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,
    shoppingSource:'AI web search',
    liveRetailersConnected:false
  },{headers});
}
