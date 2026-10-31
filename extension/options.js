'use strict';

const API_URL_KEY='shopwise-api-base-url';
const form=document.getElementById('settings-form');
const input=document.getElementById('api-url');
const status=document.getElementById('status');
const isAllowedLocalHost=hostname=>hostname==='localhost'||hostname==='127.0.0.1';

chrome.storage.local.get(API_URL_KEY,result=>{
  if(result[API_URL_KEY])input.value=result[API_URL_KEY];
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  status.classList.remove('error');
  let url;
  try{
    url=new URL(input.value.trim());
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/'){
      throw new Error('Enter only the website origin, without credentials, path, query, or fragment.');
    }
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&isAllowedLocalHost(url.hostname))){
      throw new Error('Use an HTTPS website URL. HTTP is allowed only for localhost development.');
    }
  }catch(error){
    status.textContent=error instanceof TypeError?'Enter a valid website URL.':error.message;
    status.classList.add('error');
    return;
  }

  const originPattern=`${url.origin}/*`;
  try{
    const granted=await chrome.permissions.request({origins:[originPattern]});
    if(!granted){
      status.textContent='Site access was not granted, so Shopwise cannot connect to this server.';
      status.classList.add('error');
      return;
    }
    await chrome.storage.local.set({[API_URL_KEY]:url.origin});
    status.textContent='Connected. Open the Shopwise side panel to start using it.';
  }catch(error){
    status.textContent=`Could not save settings: ${error.message||'extension permission request failed.'}`;
    status.classList.add('error');
  }
});
