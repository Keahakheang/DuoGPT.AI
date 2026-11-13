# BudgetBuddy — AI web search shopping assistant

BudgetBuddy uses an OpenAI-compatible provider's **Responses API web search tool** for live product searches and AI answers. The provider and selected model must have web search enabled. Product titles and listed prices are extracted from cited web results; coverage and price accuracy vary, and users should verify the exact item and final checkout total with the retailer. BudgetBuddy does not connect to retailer accounts or add items to retailer carts.

Saved notes and the shopping list stay in the local browser. Notes can be marked **General**, **Groceries shopping** (find and compare products you want to buy), or **Recipe ingredients** (for a dish you already chose, get serving-sized ingredients and sourced Singapore shopping options). Grocery shopping and recipe ingredient requests require live web search. Grocery answers cover every requested item in order, and mark items unavailable rather than silently skipping or guessing; recipe requests include the full serving-sized ingredient list. If a budget is included, the assistant compares listed pack prices against it without leaving out essential ingredients. **Get AI help with this note** sends the complete note to the assistant; its response appears below the saved note and is stored with that note on this device.

## Configure the provider

Set these as server-side environment variables:

- `AI_BASE_URL` — API base URL, for example `https://newapi.omgteam.me/v1`
- `AI_API_KEY` — private provider key
- `AI_MODEL` — model that supports the provider's Responses API web search tool, for example `gpt-5.6-luna`
- `SEARCH_ACCESS_CODE` — optional shared code to limit public search usage
- `CHAT_ACCESS_CODE` — optional shared code to limit AI chat

Keys are sent only from the server. Never put them in browser code or commit them to GitHub. On Netlify, set the variables in **Project configuration → Environment variables** and redeploy.

Check `/api/status` for `shoppingConfigured:true`, then search a product. The status endpoint confirms only that required settings are present; it does not verify the provider's key, model, or web-search access. If the provider rejects the Responses API or `web_search` tool, check its documentation and model permissions.

AI chat web searches can take up to two minutes before timing out. Saved-note requests use the same AI and web-search path as ordinary chat, but their responses are kept with the saved note instead of being added to the conversation.

## Local development

Node.js 20.12+ is required. There are no npm dependencies. The local server loads optional `.env.dev` (ignored by Git). Copy `.env.example` to `.env.dev` and add your private settings, or use PowerShell:

```powershell
$env:AI_BASE_URL="https://newapi.omgteam.me/v1"
$env:AI_API_KEY="your_private_key"
$env:AI_MODEL="gpt-5.6-luna"
npm start
```

Open http://localhost:3000. Run `npm test` for the test suite.

## Chrome and Edge side-panel extension

The extension reuses the BudgetBuddy frontend and your deployed API. Build it with `npm run build:extension`; the unpacked extension files are written to `extension/dist`.

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge, then enable **Developer mode**.
2. Choose **Load unpacked** and select the `extension/dist` folder.
3. Open the BudgetBuddy extension settings and enter your deployed BudgetBuddy website's HTTPS origin, then approve access to that site.
4. Click the extension icon to open BudgetBuddy in the browser side panel.

For local development, run `npm start` and use `http://localhost:3000` as the server URL. The extension stores its notes and saved promo codes in extension-local browser storage, separately from the website. Extension API access is limited to the configured site; CORS responses allow only Chrome extension origins. AI provider credentials remain server-side.

## Notes

- Search results request up to 16 distinct products across Singapore retailers and are returned only when the AI response includes a cited HTTPS product URL and an explicit SGD price. Shopping searches use the provider's low-latency search context; actual coverage depends on the provider and may return fewer results. Prices can be stale or incorrect. Product images appear only when a direct image URL is found on the cited retailer listing.
- Promo-code searches show only exact codes tied to a cited HTTPS source link. Codes are marked confirmed only when the cited source explicitly says they are currently valid; checkout success is never guaranteed.
- Retailer shortcuts open retailer websites directly.
- Browser storage contains local notes and a shortlist, not an account or price-alert service.
- A shared access code is only a basic guard. Public deployments should also use durable rate limiting and usage controls.
- Never collect retailer passwords or payment details.
