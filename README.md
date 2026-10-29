# Shopwise

Shopwise is a shopping assistant powered by one OpenAI-compatible chat provider. It does not use a search API or fetch live retailer listings. Product searches open the retailer's own website; the assistant can help compare listing details that you provide, but cannot verify current prices, availability, promotions, or checkout totals.

The saved notes and shopping list are local browser snapshots, not a synced account or retailer cart. Shopwise does not connect to retailer accounts or collect retailer credentials.

## Configure the AI provider

Set these server-side environment variables:

- `AI_API_KEY` — your private provider key
- `AI_BASE_URL` — optional; defaults to `https://newapi.omgteam.me/v1`
- `AI_MODEL` — optional; defaults to `gpt-5.6-luna`
- `CHAT_ACCESS_CODE` — optional shared passcode for the chat

Never put the API key in browser code or commit it to GitHub. On Netlify, set the variables in **Project configuration → Environment variables**, then redeploy.

## Local development

Node.js 20.12+ is required. There are no npm dependencies. Copy `.env.example` to `.env.dev` and add your private key, or set environment variables in your terminal. `.env.dev` is ignored by Git.

```powershell
$env:AI_API_KEY="your_private_key"
$env:AI_BASE_URL="https://newapi.omgteam.me/v1"
$env:AI_MODEL="gpt-5.6-luna"
npm start
```

Open http://localhost:3000. Use `npm test` to run the test suite.

The status endpoint `/api/status` reports whether AI chat is configured; it does not validate the provider key. API keys are sent only from the server to the configured provider.
