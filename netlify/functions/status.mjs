export default async function handler(request){
 if(request.method!=='GET')return Response.json({error:'Use GET.'},{status:405});
 const aiProvider=process.env.SERPAPI_KEY?'SerpApi Google AI Overview':process.env.HF_TOKEN?'Hugging Face':'';
 return Response.json({aiConfigured:!!aiProvider,aiProvider,requiresCode:!!process.env.CHAT_ACCESS_CODE,provider:aiProvider||'Not configured',shoppingConfigured:!!process.env.SERPAPI_KEY,shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,shoppingSource:'Google Shopping via SerpApi',liveRetailersConnected:false},{headers:{'Cache-Control':'no-store'}});
}
