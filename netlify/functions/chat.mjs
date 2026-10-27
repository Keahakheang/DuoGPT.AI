import core from '../../lib/ai.cjs';
const {generateReply,verifyAccess,AppError} = core;
export default async function handler(request) {
  const headers = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
  const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  if(!verifyAccess(process.env.CHAT_ACCESS_CODE,request.headers.get('x-shopwise-code')))return json({error:'Enter the Shopwise chat access code to continue.'},401);
  let input;
  try {
    const raw = await request.text();
    if(raw.length>22000)return json({error:'Request is too large.'},413);
    input=JSON.parse(raw);
  } catch (_) {return json({error:'Invalid JSON.'},400)}
  try{return json({reply:await generateReply(input)})}
  catch(err){return json({error:err instanceof AppError?err.message:'Unexpected AI service error.'},err.status||500)}
}
