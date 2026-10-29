# Shopwise — AI web search shopping assistant

Shopwise uses an OpenAI-compatible provider's **Responses API web search tool** for live product searches and AI answers. The provider and selected model must have web search enabled. Product titles and listed prices are extracted from cited web results; coverage and price accuracy vary, and users should verify the exact item and final checkout total with the retailer. Shopwise does not connect to retailer accounts or add items to retailer carts.

The saved shopping list is a local browser shortlist, not a checkout cart.

## Configure the provider

Set these as server-side environment variables:

- `AI_BASE_URL` — API base URL, for example `https://newapi.omgteam.me/v1`
- `AI_API_KEY` — private provider key
- `AI_MODEL` — model that supports the provider's Responses API web search tool, for example `gpt-5.6-luna`
- `SEARCH_ACCESS_CODE` — optional shared code to limit public search usage
- `CHAT_ACCESS_CODE` — optional shared code to limit AI chat

Keys are sent only from the server. Never put them in browser code or commit them to GitHub. On Netlify, set the variables in **Project configuration → Environment variables** and redeploy.

Check `/api/status` for `shoppingConfigured:true`, then search a product. The status endpoint confirms only that required settings are present; it does not verify the provider's key, model, or web-search access. If the provider rejects the Responses API or `web_search` tool, check its documentation and model permissions.

## Local development

Node.js 20.12+ is required. There are no npm dependencies. The local server loads optional `.env.dev` (ignored by Git). Copy `.env.example` to `.env.dev` and add your private settings, or use PowerShell:

```powershell
$env:AI_BASE_URL="https://newapi.omgteam.me/v1"
$env:AI_API_KEY="your_private_key"
$env:AI_MODEL="gpt-5.6-luna"
npm start
```

Open http://localhost:3000. Run `npm test` for the test suite.

## Notes

- Search results are returned only when the AI response includes a cited HTTPS URL and an explicit SGD price. The model may miss listings, and prices can still be stale or incorrect.
- Retailer shortcuts open retailer websites directly.
- Browser storage contains local notes and a shortlist, not an account or price-alert service.
- A shared access code is only a basic guard. Public deployments should also use durable rate limiting and usage controls.
- Never collect retailer passwords or payment details.
