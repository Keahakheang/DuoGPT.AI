'use strict';

function isShopwiseExtensionOrigin(origin) {
  return typeof origin==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

function extensionCorsHeaders(origin) {
  const headers={Vary:'Origin'};
  if(isShopwiseExtensionOrigin(origin)){
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type, X-Shopwise-Code, X-Shopwise-Search-Code';
    headers['Access-Control-Max-Age']='600';
  }
  return headers;
}

module.exports={isShopwiseExtensionOrigin,extensionCorsHeaders};
