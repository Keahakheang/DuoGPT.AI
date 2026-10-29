'use strict';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>'S$'+Number(value||0).toFixed(2);
const readSaved=()=>{try{return JSON.parse(localStorage.getItem('shopwise-live-v1')||'{}')}catch{return {}}};
const previous=readSaved();
const retailers=[
 {name:'Fairprice',link:q=>'https://www.fairprice.com.sg/search?query='+encodeURIComponent(q),color:'#137947'},
 {name:'Shopee',link:q=>'https://shopee.sg/search?keyword='+encodeURIComponent(q),color:'#ee7745'},
 {name:'Lazada',link:q=>'https://www.lazada.sg/catalog/?q='+encodeURIComponent(q),color:'#7058a5'},
 {name:'Amazon SG',link:q=>'https://www.amazon.sg/s?k='+encodeURIComponent(q),color:'#e4a837'},
 {name:'Cold Storage',link:()=> 'https://coldstorage.com.sg/',color:'#c84946'},
 {name:'RedMart',link:q=>'https://www.lazada.sg/catalog/?q='+encodeURIComponent(q),color:'#ce4545'}
];
const state={
 page:'compare',
 query:'',
 aiConfigured:false,
 aiProvider:'',
 requiresChatCode:false,
 chatCode:sessionStorage.getItem('sw-chat-code')||'',
 chats:[{role:'assistant',text:'Hello! I can answer general questions and help compare shopping listings you provide. I do not have live web access or current retailer prices.'}],
 chatPending:false,
 saved:Array.isArray(previous.saved)?previous.saved:[],
 cart:Array.isArray(previous.cart)?previous.cart:[]
};

function save(){
 try{localStorage.setItem('shopwise-live-v1',JSON.stringify({saved:state.saved.slice(-100),cart:state.cart.slice(-100)}))}
 catch{toast('Could not save your list in this browser.')}
}
function toast(message){
 const el=$('toast');
 el.textContent=message;
 el.classList.add('show');
 clearTimeout(toast.timer);
 toast.timer=setTimeout(()=>el.classList.remove('show'),3400);
}
function retailerLinks(){
 const query=state.query||'groceries';
 return retailers.map(store=>`<div class="store-quick"><span class="store-dot" style="background:${store.color}"></span><span style="font-size:11px;font-weight:800">${esc(store.name)}</span><a target="_blank" rel="noopener noreferrer" href="${esc(store.link(query))}">Search store ↗</a></div>`).join('');
}
function navigation(){
 const items=[['compare','Compare prices','compare'],['saved','Saved notes','note'],['cart','Shopping list','cart'],['accounts','Store links','store']];
 const paths={
  compare:'<path d="M4 7h16M4 12h16M4 17h16"/><path d="M7 4v6M17 9v6M11 14v6"/>',
  note:'<path d="M6 3h12a2 2 0 0 1 2 2v16l-8-5-8 5V5a2 2 0 0 1 2-2z"/>',
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.5 14h13L23 6H6"/>',
  store:'<rect x="4" y="7" width="16" height="14" rx="1"/><path d="M2 7l3-5h14l3 5"/>'
 };
 $('navigation').innerHTML=`<div class="logo"><div class="logo-mark">✦</div><div class="logo-name">Shop<span>wise.</span></div></div><div class="nav-label">WORKSPACE</div>${items.map(([id,label,icon])=>`<button class="nav-btn ${state.page===id?'active':''}" data-action="page" data-id="${id}" title="${label}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon]}</svg><span class="label">${label}</span>${id==='cart'&&state.cart.length?`<span class="nav-count">${state.cart.length}</span>`:''}</button>`).join('')}<div class="nav-bottom"><div class="privacy-note"><strong>🔒 Private by default</strong> Notes and shopping list stay on this device. No retailer credentials are collected.</div><div class="nav-foot">Shopwise · No live retailer prices</div></div>`;
}
function header(){
 const titles={compare:'Your shopping dashboard',saved:'Your saved notes',cart:'Your shopping list',accounts:'Retailer links'};
 $('page-title').textContent=titles[state.page];
 $('page-sub').textContent=state.page==='compare'?'Ask the AI assistant and search retailers directly.':state.page==='cart'?'Your shortlist is saved on this device, not at a retailer.':'Shopwise does not connect to retailer accounts.';
 $('ai-banner').textContent=state.aiConfigured?'AI READY':'AI SETUP NEEDED';
}
function renderPromos(){
 $('promos').innerHTML=`<section class="surface promos-panel"><div class="surface-heading"><h3>🏷️ Price information</h3></div><p class="tip">Shopwise does not fetch live prices, discounts, stock, or vouchers. Check the retailer's site for current details.</p></section><section class="surface promos-panel"><div class="surface-heading"><h3>🏬 Search retailers</h3></div>${retailerLinks()}<p class="fine-print">Retailer links open their websites directly. Shopwise does not verify results or checkout totals.</p></section>`;
}
function renderCompare(){
 $('center').innerHTML=`<section class="surface compare-panel"><div class="section-head"><div><h3>Search retailer websites</h3><p>No live price search is connected to Shopwise.</p></div></div><form class="search-section" id="center-search"><label class="sr-only" for="center-query">Product name</label><input id="center-query" maxlength="90" type="search" value="${esc(state.query)}" placeholder="Try: oats 1 kg, UHT milk, headphones"><button class="action-btn" type="submit">Show retailer links</button></form>${state.query?`<div class="query-box">Search <b>${esc(state.query)}</b> directly on a retailer's website. Shopwise does not receive or compare those results. <button data-action="reset-search">Clear</button></div>`:'<div class="empty">Enter a product to get retailer search links. For a comparison, paste the listing details into the AI chat; it cannot verify current prices.</div>'}<div class="store-links">${retailerLinks()}</div><p class="fine-print">Product matches, price, shipping, availability, and promotions are provided by the retailer and are not verified here.</p></section>`;
}
function safeLink(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
}
function mini(item,action){
 const link=safeLink(item.url);
 return `<div class="note-card"><div class="utility-row" style="margin-bottom:5px"><span class="store-chip">${esc(item.merchant||'Retailer')}</span>${Number.isFinite(Number(item.price))?`<b style="color:#116d5b">${money(item.price)}</b>`:''}</div><h4>${esc(item.title||'Saved listing')}</h4><p>Saved snapshot only. Verify current details with the retailer.</p><div class="note-actions">${link?`<a class="inline-action" target="_blank" rel="noopener noreferrer" href="${esc(link)}">Open saved link ↗</a>`:''}<button class="inline-action" data-action="${action}" data-url="${esc(item.url||'')}">Remove</button></div></div>`;
}
function renderSaved(){
 $('center').innerHTML=`<section class="surface page-body"><h3>Saved shopping notes</h3><p class="intro">Saved on this device; details may be out of date.</p>${state.saved.length?`<div class="note-grid">${state.saved.map(item=>mini(item,'save-remove')).join('')}</div>`:'<div class="empty">No saved listings yet. Save a link from a retailer website in your browser and add details here later.</div>'}</section>`;
}
function renderCart(){
 $('center').innerHTML=`<section class="surface page-body"><h3>Your shopping list</h3><p class="intro">This list is stored only in this browser. It is not a retailer cart and prices are not refreshed.</p>${state.cart.length?`<div class="note-grid">${state.cart.map(item=>mini(item,'cart-remove')).join('')}</div>`:'<div class="empty">Your shopping list is empty. Shop directly on the retailer websites.</div>'}</section>`;
}
function renderAccounts(){
 $('center').innerHTML=`<section class="surface page-body"><h3>Retailer websites</h3><p class="intro">These shortcuts open retailer websites. Shopwise does not connect to accounts or access retailer search results.</p>${retailerLinks()}<div class="alert">Never share retailer passwords, payment details, or API keys in chat.</div></section>`;
}
function renderChatInline(text){
 const pattern=/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;
 let html='',last=0,match;
 while((match=pattern.exec(String(text)))){
  html+=esc(text.slice(last,match.index));
  const url=safeLink(match[2]);
  html+=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(match[1])}</a>`:esc(match[0]);
  last=pattern.lastIndex;
 }
 return html+esc(String(text).slice(last));
}
function renderChatText(text){
 const lines=String(text).split('\n');
 let html='',index=0;
 while(index<lines.length){
  if(lines[index].trim().startsWith('|')&&index+1<lines.length&&/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(lines[index+1])){
   const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
   const headings=cells(lines[index]);
   index+=2;
   let rows='';
   while(index<lines.length&&lines[index].trim().startsWith('|')){
    rows+=`<tr>${cells(lines[index]).map(cell=>`<td>${renderChatInline(cell)}</td>`).join('')}</tr>`;
    index++;
   }
   html+=`<div class="chat-table-scroll"><table class="chat-table"><thead><tr>${headings.map(cell=>`<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
   continue;
  }
  html+=renderChatInline(lines[index])+(index<lines.length-1?'\n':'');
  index++;
 }
 return html;
}
function renderRight(){
 const messages=state.chats.map(item=>`<div class="chat-line ${item.role==='user'?'user':''} ${item.error?'error':''}">${item.role==='assistant'?'<span class="bot-icon" style="width:26px;height:26px;font-size:13px">✦</span>':''}<div class="chat-bubble">${renderChatText(item.text)}</div></div>`).join('');
 $('right').innerHTML=`<section class="surface assistant-panel"><div class="chat-head"><span class="bot-icon">✦</span><div style="flex:1"><div class="chat-title">Shopwise assistant</div><div class="chat-sub">${state.aiConfigured?`AI model: ${esc(state.aiProvider)}`:'AI provider not configured'}</div></div><span class="${state.aiConfigured?'live-pill':'status-pill'}">${state.aiConfigured?'AI READY':'SETUP NEEDED'}</span></div><div class="chat-box" id="chat-scroll">${messages}${state.chatPending?'<div class="chat-line"><div class="chat-bubble">Thinking…</div></div>':''}</div><div class="quick-actions"><button data-action="chat-prompt" data-id="What can you help me with?">💬 What can you do?</button><button data-action="chat-prompt" data-id="What information should I compare between two product listings?">📊 Compare listings</button></div><form class="chat-input" id="chat-form"><label class="sr-only" for="chat-text">Ask Shopwise</label><input type="text" id="chat-text" maxlength="2000" placeholder="Ask a question..." ${state.chatPending?'disabled':''}/><button class="chat-send" type="submit" aria-label="Send message" ${state.chatPending?'disabled':''}>➤</button></form><div class="chat-privacy">${state.aiConfigured?'AI replies are generated by your configured provider; answers are not live web searches.':'Set AI_API_KEY on the server to enable AI chat.'} Never share passwords or payment details.</div></section><section class="surface cart-panel"><div class="surface-heading"><h3>🛒 Your shopping list</h3><span class="tiny-pill">${state.cart.length} ITEMS</span></div><div class="small-note">${state.cart.length?esc(state.cart.slice(-3).map(item=>item.title).join(' · ')):'Saved only on this device; not a retailer cart.'}</div><button class="promo-action" data-action="page" data-id="cart">View list →</button></section>`;
 const scroll=$('chat-scroll');
 scroll.scrollTop=scroll.scrollHeight;
}
function render(){
 navigation();
 header();
 renderPromos();
 if(state.page==='compare')renderCompare();
 else if(state.page==='saved')renderSaved();
 else if(state.page==='cart')renderCart();
 else renderAccounts();
 renderRight();
}
function addChat(role,text,error=false){
 if(role==='assistant'&&!String(text).startsWith('Hello!'))text=`Hello! ${text}`;
 state.chats.push({role,text,error});
 state.chats=state.chats.slice(-30);
 renderRight();
}
async function checkStatus(){
 try{
  const response=await fetch('/api/status',{cache:'no-store'});
  if(!response.ok)throw new Error(`Status request failed (${response.status}).`);
  const status=await response.json();
  state.aiConfigured=!!status.aiConfigured;
  state.aiProvider=String(status.aiProvider||'');
  state.requiresChatCode=!!status.requiresCode;
 }catch{
  state.aiConfigured=false;
  state.aiProvider='';
 }
 render();
}
function accessCode(){
 if(!state.requiresChatCode||state.chatCode)return true;
 const code=window.prompt('Enter the private Shopwise chat access code:');
 if(!code?.trim())return false;
 state.chatCode=code.trim();
 sessionStorage.setItem('sw-chat-code',state.chatCode);
 return true;
}
function search(query){
 state.query=String(query||'').trim().slice(0,90);
 state.page='compare';
 render();
}
async function chat(message){
 message=String(message||'').trim();
 if(!message||state.chatPending)return;
 addChat('user',message);
 if(!state.aiConfigured){
  addChat('assistant','AI chat is not connected yet. The site owner needs to set AI_API_KEY on the server.',true);
  return;
 }
 if(!accessCode())return;
 state.chatPending=true;
 renderRight();
 try{
  const history=state.chats.slice(-11,-1).filter(item=>!item.error).map(item=>({role:item.role,text:item.text}));
  const headers={'Content-Type':'application/json'};
  if(state.chatCode)headers['X-Shopwise-Code']=state.chatCode;
  const response=await fetch('/api/chat',{method:'POST',headers,body:JSON.stringify({message,history}),signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok){
   if(response.status===401){state.chatCode='';sessionStorage.removeItem('sw-chat-code');}
   throw new Error(data.error||'AI request failed.');
  }
  addChat('assistant',String(data.reply||'The AI returned an empty response.'));
 }catch(error){
  addChat('assistant',error.name==='TimeoutError'?'The AI request timed out. Please try again.':error.message||'AI request failed.',true);
 }finally{
  state.chatPending=false;
  renderRight();
 }
}
document.addEventListener('submit',event=>{
 if(event.target.id==='top-search'){event.preventDefault();search($('top-query').value);}
 else if(event.target.id==='center-search'){event.preventDefault();search($('center-query').value);}
 else if(event.target.id==='chat-form'){event.preventDefault();const input=$('chat-text');const message=input.value;input.value='';chat(message);}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');
 if(!button)return;
 const action=button.dataset.action;
 if(action==='page'){state.page=button.dataset.id;render();}
 else if(action==='chat-prompt')chat(button.dataset.id);
 else if(action==='reset-search'){state.query='';render();}
 else if(action==='save-remove'||action==='cart-remove'){
  const field=action==='save-remove'?'saved':'cart';
  state[field]=state[field].filter(item=>item.url!==button.dataset.url);
  save();
  render();
 }
});
checkStatus();
