// Node local preview server. Production deployment uses Netlify Functions.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {generateReply,AppError,verifyAccess}=require('./lib/ai.cjs');
const {searchShopping,ShoppingError,authorized}=require('./lib/shopping.cjs');
const PORT=Number(process.env.PORT||3000),PUBLIC=path.resolve(__dirname,'public');
function send(res,status,data,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
 res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));
}
function readJSON(req){return new Promise((resolve,reject)=>{let s='';req.on('data',chunk=>{s+=chunk;if(s.length>22000){reject(new AppError(413,'Too large'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(s))}catch{reject(new AppError(400,'Invalid JSON'))}});req.on('error',reject)})}
async function route(req,res){const u=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&u.pathname==='/api/status')return send(res,200,{shoppingConfigured:!!process.env.SERPAPI_KEY,shoppingRequiresCode:!!process.env.SEARCH_ACCESS_CODE,aiConfigured:!!process.env.HF_TOKEN,requiresCode:!!process.env.CHAT_ACCESS_CODE,liveRetailersConnected:false});
 if(req.method==='GET'&&u.pathname==='/api/search'){
  if(!authorized(process.env.SEARCH_ACCESS_CODE,req.headers['x-shopwise-search-code']))return send(res,401,{error:'Enter your search access code.'});
  try{return send(res,200,await searchShopping(u.searchParams.get('q')))}catch(err){return send(res,err.status||500,{error:err instanceof ShoppingError?err.message:'Search error'})}
 }
 if(req.method==='POST'&&u.pathname==='/api/chat'){
  if(!verifyAccess(process.env.CHAT_ACCESS_CODE,req.headers['x-shopwise-code']))return send(res,401,{error:'Enter your chat access code.'});
  try{return send(res,200,{reply:await generateReply(await readJSON(req))})}catch(err){return send(res,err.status||500,{error:err instanceof AppError?err.message:'AI error'})}
 }
 if(req.method==='GET'){
  const file={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js'}[u.pathname];
  if(file){const type=file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8';return send(res,200,await fs.promises.readFile(path.join(PUBLIC,file)),type)}
 }
 return send(res,404,{error:'Not found'});
}
http.createServer((req,res)=>route(req,res).catch(()=>send(res,500,{error:'Server error'}))).listen(PORT,()=>console.log(`Shopwise on http://localhost:${PORT}`));
