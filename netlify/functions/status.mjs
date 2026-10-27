export default async function handler(request){
 if(request.method!=='GET')return Response.json({error:'Use GET.'},{status:405});
 return Response.json({aiConfigured:!!process.env.HF_TOKEN,requiresCode:!!process.env.CHAT_ACCESS_CODE,provider:'Hugging Face Inference Providers',shoppingConfigured:!!process.env.SERPAPI_KEY,shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,shoppingSource:'Google Shopping via SerpApi',liveRetailersConnected:false},{headers:{'Cache-Control':'no-store'}});
}
