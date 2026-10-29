import core from '../../lib/ai.cjs';
const {getAIStatus}=core;
export default async function handler(request){
 if(request.method!=='GET')return Response.json({error:'Use GET.'},{status:405});
 const aiStatus=getAIStatus();
 return Response.json({...aiStatus,requiresCode:!!process.env.CHAT_ACCESS_CODE,provider:aiStatus.aiProvider||'Not configured',shoppingConfigured:aiStatus.aiConfigured,shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,shoppingSource:'AI web search',liveRetailersConnected:false},{headers:{'Cache-Control':'no-store'}});
}
