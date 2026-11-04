import core from '../lib/ai.cjs';
import cors from '../lib/extension-cors.cjs';

const {generateReply,verifyAccess,AppError}=core;
const {extensionCorsHeaders}=cors;

function headersFor(request) {
  return {
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    ...extensionCorsHeaders(request.headers.get('origin'))
  };
}

export function OPTIONS(request) {
  return new Response(null,{status:204,headers:headersFor(request)});
}

export async function POST(request) {
  const headers=headersFor(request);
  const json=(data,status=200)=>Response.json(data,{status,headers});
  if(!verifyAccess(process.env.CHAT_ACCESS_CODE,request.headers.get('x-shopwise-code'))) {
    return json({error:'Enter the Shopwise chat access code to continue.'},401);
  }
  let input;
  try {
    const raw=await request.text();
    if(raw.length>22000)return json({error:'Request is too large.'},413);
    input=JSON.parse(raw);
  } catch {
    return json({error:'Invalid JSON.'},400);
  }
  try {
    return json({reply:await generateReply(input)});
  } catch(error) {
    return json({error:error instanceof AppError?error.message:'Unexpected AI service error.'},error.status||500);
  }
}
