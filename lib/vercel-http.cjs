'use strict';

const {extensionCorsHeaders}=require('./extension-cors.cjs');

function headersFor(request,extra={}) {
  return {
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    ...extensionCorsHeaders(request.headers.origin),
    ...extra
  };
}

function sendJson(response,status,data,request) {
  const headers=headersFor(request);
  for(const [name,value] of Object.entries(headers))response.setHeader(name,value);
  response.statusCode=status;
  response.end(status===204?'':JSON.stringify(data));
}

function readJson(request) {
  if(request.body!==undefined){
    const raw=Buffer.isBuffer(request.body)?request.body.toString('utf8'):typeof request.body==='string'?request.body:JSON.stringify(request.body);
    if(raw.length>22000)throw Object.assign(new Error('Request is too large.'),{status:413});
    try{return Promise.resolve(typeof request.body==='object'&&!Buffer.isBuffer(request.body)?request.body:JSON.parse(raw))}
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

module.exports={headersFor,sendJson,readJson};
