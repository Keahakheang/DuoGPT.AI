'use strict';

const {getAIStatus}=require('../lib/ai.cjs');
const {sendJson}=require('../lib/vercel-http.cjs');

module.exports=async function handler(request,response) {
  if(request.method==='OPTIONS')return sendJson(response,204,null,request);
  if(request.method!=='GET')return sendJson(response,405,{error:'Use GET.'},request);
  const aiStatus=getAIStatus();
  return sendJson(response,200,{
    ...aiStatus,
    requiresCode:!!process.env.CHAT_ACCESS_CODE,
    shoppingConfigured:aiStatus.aiConfigured,
    shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,
    shoppingSource:'AI web search',
    liveRetailersConnected:false
  },request);
};
