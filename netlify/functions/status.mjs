import core from '../../lib/ai.cjs';
import cors from '../../lib/extension-cors.cjs';
const {getAIStatus}=core;
const {extensionCorsHeaders}=cors;
export default async function handler(request){
 const headers={'Cache-Control':'no-store',...extensionCorsHeaders(request.headers.get('origin'))};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='GET')return Response.json({error:'Use GET.'},{status:405,headers});
 const aiStatus=getAIStatus();
 return Response.json({...aiStatus,requiresCode:!!process.env.CHAT_ACCESS_CODE,provider:aiStatus.aiProvider||'Not configured',shoppingConfigured:aiStatus.aiConfigured,shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,shoppingSource:'AI web search',liveRetailersConnected:false},{headers});
}
