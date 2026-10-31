'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {extensionCorsHeaders,isShopwiseExtensionOrigin}=require('../lib/extension-cors.cjs');

test('Extension CORS allows only Chrome extension origins and required API headers',()=>{
 const origin='chrome-extension://abcdefghijklmnopabcdefghijklmnop';
 assert.equal(isShopwiseExtensionOrigin(origin),true);
 assert.equal(isShopwiseExtensionOrigin('https://example.com'),false);
 assert.equal(isShopwiseExtensionOrigin('chrome-extension://not-a-valid-id'),false);
 assert.deepEqual(extensionCorsHeaders(origin),{
  Vary:'Origin',
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, X-Shopwise-Code, X-Shopwise-Search-Code',
  'Access-Control-Max-Age':'600'
 });
 assert.deepEqual(extensionCorsHeaders('https://example.com'),{Vary:'Origin'});
});

test('Extension manifest opens the Shopwise app in a side panel with optional server access',()=>{
 const root=path.resolve(__dirname,'..');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension','manifest.json'),'utf8'));
 assert.equal(manifest.manifest_version,3);
 assert.equal(manifest.side_panel.default_path,'app/index.html');
 assert.ok(manifest.permissions.includes('sidePanel'));
 assert.ok(manifest.permissions.includes('storage'));
 assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
});
