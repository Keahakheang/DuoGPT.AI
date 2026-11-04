'use strict';

const {extensionCorsHeaders}=require('./extension-cors.cjs');

function sendJson(response,status,data,request) {
  const headers={
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    ...extensionCorsHeaders(request.headers.origin)
  };
  for(const [name,value] of Object.entries(headers))response.setHeader(name,value);
  response.statusCode=status;
  response.end(status===204?'':JSON.stringify(data));
}

function readJson(request) {
  if(request.body!==undefined){
    const parsedBody=request.body&&typeof request.body==='object'&&!Buffer.isBuffer(request.body);
    const raw=Buffer.isBuffer(request.body)?request.body.toString('utf8'):parsedBody?JSON.stringify(request.body):String(request.body);
    if(raw.length>22000)return Promise.reject(Object.assign(new Error('Request is too large.'),{status:413}));
    if(parsedBody)return Promise.resolve(request.body);
    try{return Promise.resolve(JSON.parse(raw))}
    catch{return Promise.reject(Object.assign(new Error('Invalid JSON.'),{status:400}))}
  }
  return new Promise((resolve,reject)=>{
    let raw='';
    request.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>22000)reject(Object.assign(new Error('Request is too large.'),{status:413}));
    });
    request.on('end',()=>{
      try{resolve(JSON.parse(raw))}
      catch{reject(Object.assign(new Error('Invalid JSON.'),{status:400}))}
    });
    request.on('error',reject);
  });
}

module.exports={sendJson,readJson};
