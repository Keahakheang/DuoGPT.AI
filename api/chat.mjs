import core from '../lib/ai.cjs';
import http from '../lib/vercel-http.cjs';

const {generateReply,verifyAccess,AppError}=core;
const {sendJson,readJson}=http;

export default async function handler(request,response) {
  if(request.method==='OPTIONS')return sendJson(response,204,null,request);
  if(request.method!=='POST')return sendJson(response,405,{error:'Use POST.'},request);
  if(!verifyAccess(process.env.CHAT_ACCESS_CODE,request.headers['x-shopwise-code'])) {
    return sendJson(response,401,{error:'Enter the Shopwise chat access code to continue.'},request);
  }
  try {
    return sendJson(response,200,{reply:await generateReply(await readJson(request))},request);
  } catch(error) {
    const status=error instanceof AppError?error.status:Number.isInteger(error&&error.status)?error.status:500;
    return sendJson(response,status,{error:error instanceof Error?error.message:'Unexpected AI service error.'},request);
  }
}
