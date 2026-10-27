# Shopwise — actual Singapore shopping listings (v4)

**What is real:** When `SERPAPI_KEY` is set, Search requests Singapore-localized Google Shopping listings through SerpApi. Product titles, listed prices, merchants, source links, old prices (if present) and retrieval timestamps come from the response. The app does not contain fictional product offers or fake vouchers.

**What this does not claim:** Shopwise does not have official account integrations with FairPrice, Shopee, Lazada, Amazon SG, Cold Storage or RedMart. Google Shopping indexing is incomplete and results may mix pack sizes. Listed item prices can be stale; no guaranteed final delivery, taxes, checkout price, stock, coupon eligibility, or accurate seller matching. Search shortcuts link out to each real store. Saved shopping list is *not* a retailer checkout/cart.

## Publish on your existing Netlify project

This archive contains a folder **`shopwise_demo 2`**, matching your GitHub repository folder. Replace that folder's existing code, keeping the same path. Do not nest another `shopwise_demo 2` inside it.

Your Netlify GitHub repo is `prajwaljha2007/shopwise_demo`. For this structure set:

- **Base directory**: `shopwise_demo 2`
- **Publish directory**: `public` (relative to Base)
- **Functions directory**: `netlify/functions` (relative to Base)
- **Build command**: blank

`netlify.toml` also declares publish, functions and redirects. Netlify can read it from the base directory.

### Get your search API key

1. Open https://serpapi.com/ and create an account, if eligible.
2. Find your private API key in your SerpApi account dashboard. Check https://serpapi.com/pricing for current free availability and limits. As checked 2026-10-21, the Free plan lists 250 searches/month and 50 searches/hour; this may change.
3. In **Netlify → Project configuration → Environment variables**, add a secret **`SERPAPI_KEY`** with your private key. Mark as a secret, and keep it out of GitHub.
4. **Strongly recommended for a public website:** add **`SEARCH_ACCESS_CODE`** as a separate secret (pick a private shared code, not a shopping password). Shopwise will prompt visitors for it before price searches. Without it, anyone can spend your API quota.
5. Trigger a fresh deploy from the latest GitHub commit. Open Shopwise and test `rolled oats 1kg`.

Keep `HF_TOKEN` if you want to keep trying Hugging Face's AI service; real price search does NOT require it. `CHAT_ACCESS_CODE` is optional and independent of the search code. If Hugging Face credits are exhausted, live shopping search should still work, while open-ended AI questions will not.

### Verify backend

Open `https://YOUR-SITE.netlify.app/api/status` to check for `shoppingConfigured:true`. This only confirms your private key is **present** on the server, not that the provider accepts it.

Search through the website and look for real listing links. A missing FairPrice or Shopee result means Google Shopping did not return one; it does **not** mean the store has no product.

If there is a problem, go to **Netlify → Logs → Functions** and inspect the function named `search`. Do not show logs containing secrets publicly.

## Local development

Node.js 20+ required, no npm dependencies. In your terminal:

```sh
cd "shopwise_demo 2"
export SERPAPI_KEY="your_secret_key"
# optional: export SEARCH_ACCESS_CODE="your_secret_code"
npm start
```

Open http://localhost:3000. Run automated tests with `npm test`.

## Security / scalability notes

- Third-party API keys are used **server-side only**; never embed them into `app.js` or `index.html`.
- Published product links are checked to be HTTPS; externally sourced text is escaped before display.
- Client storage contains notes and shortlist; it is local to the browser, not a synced user account.
- Five-minute in-memory cache helps local throughput, but serverless instances may not share cache. Google/SerpApi may also apply their own caching.
- A shared access code is only a basic guard. A public production service needs persistent per-user rate limiting, authentication, usage caps, logging and vendor terms compliance. Consider Netlify platform controls and a durable database before scaling.
- Never collect store usernames/passwords, payment card data, or secretly access retailer accounts. Real retailer cart or voucher support requires an approved integration and the user's consent.
- Review search shortcuts open YouTube / Google results; reviews are **not** automatically analyzed.

## Sources

- SerpApi: https://serpapi.com/google-shopping-api and https://serpapi.com/pricing
- Netlify: https://docs.netlify.com/build/functions/overview/
- Google Merchant API handles a merchant's own catalog; it does not offer an unrestricted cross-retailer inventory API: https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.products/list
