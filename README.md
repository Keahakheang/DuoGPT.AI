# Shopwise — AI web search shopping assistant

Shopwise uses an OpenAI-compatible provider's **Responses API web search tool** for live product searches and AI answers. The provider and selected model must have web search enabled. Product titles and listed prices are extracted from cited web results; coverage and price accuracy vary, and users should verify the exact item and final checkout total with the retailer. Shopwise does not connect to retailer accounts or add items to retailer carts.

Saved notes and the shopping list stay in the local browser. From a note, users can ask Shopwise to search current Singapore product listings and estimate a budget using cited SGD prices; unverified items are excluded from the estimate.

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

## Chrome and Edge side-panel extension

The extension reuses the Shopwise frontend and your deployed API. Build it with `npm run build:extension`; the unpacked extension files are written to `extension/dist`.

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge, then enable **Developer mode**.
2. Choose **Load unpacked** and select the `extension/dist` folder.
3. Open the Shopwise extension settings and enter your deployed Shopwise website's HTTPS origin, then approve access to that site.
4. Click the extension icon to open Shopwise in the browser side panel.

For local development, run `npm start` and use `http://localhost:3000` as the server URL. The extension stores its notes and saved promo codes in extension-local browser storage, separately from the website. Extension API access is limited to the configured site; CORS responses allow only Chrome extension origins. AI provider credentials remain server-side.

## Notes

- Search results request up to 16 distinct products across Singapore retailers and are returned only when the AI response includes a cited HTTPS product URL and an explicit SGD price. Shopping searches use the provider's low-latency search context; actual coverage depends on the provider and may return fewer results. Prices can be stale or incorrect. Product images appear only when a direct image URL is found on the cited retailer listing.
- Retailer shortcuts open retailer websites directly.
- Browser storage contains local notes and a shortlist, not an account or price-alert service.
- A shared access code is only a basic guard. Public deployments should also use durable rate limiting and usage controls.
- Never collect retailer passwords or payment details.
