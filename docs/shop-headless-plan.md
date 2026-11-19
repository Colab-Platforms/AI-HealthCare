# Headless Shop (Shopify + Fastrr) — Master Plan & Status

> **Single source of truth for the in-app shop.** Kisi bhi laptop se kaam shuru karo toh pehle ye file padho.
> Purani files `fastrr-shiprocket-checkout-integration-plan.md` aur `fastrr-integration-reference-and-test-plan.md` OUTDATED hain (wo purane `fastrrRoutes.js` ke liye thi, jo delete ho chuka hai).
>
> Last updated: 2026-11-18 (shop code **main pe merge + prod setup shuru**; neeche "PROD SETUP STATUS" padho) · Branch: `Staging`
>
> ## ▶ PROD SETUP STATUS (2026-11-18) — yahin se continue karo
>
> **Ho chuka ✅**
> - Shop ka saara code **main pe merge** ho gaya. `www.take.health/api/shop/*` live hai (Staging = main = `e05474b`, 18 Nov).
> - Fastrr dashboard mil gaya, aur `www.take.health` ki keys bhi. Render main service pe env daal diye.
> - Prod catalog sync (`shopCatalogSync.js`) chal gaya. **PRODUCTION** DB `healthcare-ai` mein 2 products aur 2 collections hain. Order ke purane indexes (`idempotencyKey_1`, `paymentStatus_1`) drop hue, ye ek baar ki migration thi.
> - QStash crons register ho gaye: `shop-catalog-daily-sync` (03:30 IST) aur `shop-order-reconciliation` (har 10 min) → `www.take.health`.
> - Prod catalog check `node scripts/shopFastrrCatalogCheck.js https://www.take.health` → **PASS** (0 errors). Staging (Render) pe bhi PASS. Ab collection image bhi aati hai (placeholder set).
> - Shopify webhooks: **15 mein se 12** register ho gaye (18 Nov, fixed script ke second run ke baad):
>   - `orders/create`, `orders/paid`, `orders/cancelled`, `refunds/create`
>   - `products/create|update|delete`
>   - `collections/create|update|delete`
>   - `orders/fulfilled`, `orders/partially_fulfilled`
>
> **Abhi atka hai ❌: 3 webhooks, Shopify token ke 3 scopes missing**
> - Ye 3 fail hue (Shopify 422, "missing access scope"): `inventory_levels/update`, `fulfillments/create`, `fulfillments/update`.
> - Token scope check (18 Nov) mein ye **teen nahi mile:** `read_inventory`, `read_locations`, `read_fulfillments`.
> - **Testing inke bina ho sakti hai** (checkout, COD/prepaid, cancel/refund, shipped status via `orders/fulfilled`). **Go-live se pehle chahiye.**
> - **Asar:**
>   - Tracking number ke updates (`fulfillments/*`) app tak nahi aayenge. Shipped/delivered status `orders/fulfilled` se aana chahiye; test mein confirm karna hai.
>   - Shopify mein stock badle toh hamara DB subah 03:30 ke sync tak purana rahega (oversell ka risk).
>   - Shayad sab variants ka `grams = 0` bhi isi wajah se hai (weight inventory item pe hota hai). Scope add karke sync dobara chala ke dekhna.
> - **Fix:**
>   1. Shopify admin → Settings → Apps → Develop apps → app → Configuration → Admin API scopes mein teeno tick karo → Save → Install/Update app.
>   2. Naya `shpat_` mile toh `.env`, Vercel aur Render teeno jagah update karo.
>   3. Scopes dobara check karo (command neeche hai).
>   4. Webhooks dobara register karo: `node scripts/registerShopifyWebhooks.js --url=https://www.take.health`. Ab script fail hone pe rukti nahi, end mein fail topics ki list deti hai.
>   5. `node scripts/shopCatalogSync.js` dobara chalao.
> - Scope check (sirf padhta hai, `server/` se):
>   `node -e "require('dotenv').config();fetch('https://'+process.env.SHOPIFY_ADMIN_STORE_DOMAIN+'/admin/oauth/access_scopes.json',{headers:{'X-Shopify-Access-Token':process.env.SHOPIFY_ADMIN_TOKEN}}).then(r=>r.json()).then(j=>console.log(j.access_scopes.map(s=>s.handle).join(', ')))"`
> - Hamare code ko sirf ye scopes chahiye: `read_products`, `read_inventory`, `read_locations`, `read_orders`, `read_all_orders`, `write_orders`, `read_fulfillments`. Token ke paas abhi bahut zyada scopes hain (`write_products`, `write_customers`, `write_script_tags`, customer erasure…). **Baad mein extra scopes hata dena** (least privilege).
>
> **Env (Vercel Production + Render dono pe; Vercel pe abhi confirm karna hai ⚠️)**
> - `www.take.health` **Vercel** se serve hota hai, aur QStash crons bhi Vercel pe jaate hain. Env sirf Render pe hua toh prod checkout 503 dega. Env daalne ke baad Vercel redeploy karna.
> - Fastrr: `FASTRR_API_KEY`, `FASTRR_API_SECRET`, aur `FASTRR_BASE_URL=https://checkout-api.shiprocket.com` (prod keys ke liye; nahi set kiya toh code staging API pe jaata hai aur 511 aata hai).
> - Shopify:
>   - `SHOPIFY_ADMIN_STORE_DOMAIN=2jfdfm-vp.myshopify.com`
>   - `SHOPIFY_ADMIN_TOKEN=shpat_…` (Admin API token)
>   - `SHOPIFY_CLIENT_SECRET=shpss_…` (app ka client secret; isi se webhook HMAC check hota hai)
> - `SHOPIFY_WEBHOOK_SECRET` **mat daalo / khaali rakho.** Ye sirf tab chahiye jab webhooks Shopify admin ke Notifications page se manually banaye hon. Hamare webhooks script (app) se bane hain, toh Shopify unhe `shpss_` se sign karta hai. Code pehle `WEBHOOK_SECRET` dekhta hai ([shopifyWebhookRoutes.js:28](../server/routes/shopifyWebhookRoutes.js)), aur galat value hui toh har webhook 401 dega. Kuch din fail hone ke baad Shopify webhook delete kar deta hai.
> - Shop: `SHOP_SHOPIFY_ORDER_SYNC=true`, `SHOP_PLACEHOLDER_IMAGE_URL=<logo URL>`, aur `SHOP_SHOPIFY_TEST_ORDERS=true` **sirf testing ke dauraan** (go-live pe `false`, warna asli orders "test" bante hain aur ship nahi hote).
>
> **Aage ka order (baaki kaam)**
> 1. 🔴 (go-live se pehle) Upar wale 3 scopes → webhooks re-register (baaki 3) → catalog sync. Testing iske bina shuru kar sakte ho.
> 2. 🔴 Vercel Production env confirm karo + redeploy.
> 3. ✅ (19 Nov) Fastrr dashboard → **Settings → Custom Endpoints** mein chaaron prod URLs set:
>    - PRODUCT FETCH (GET) → `https://www.take.health/api/shop/fastrr/products`
>    - COLLECTION FETCH (GET) → `https://www.take.health/api/shop/fastrr/collections`
>    - COLLECTION PRODUCT FETCH (GET) → `https://www.take.health/api/shop/fastrr/collection-products`
>    - ORDER WEBHOOK (POST, no headers) → `https://www.take.health/api/shop/fastrr/webhook`
>    - Pehle wahan Render staging ke URLs the; badal diye.
>    - Settings → Webhooks page (Fastrr Engage / payment webhooks) mein kuch nahi daala. Fastrr Engage OFF hai.
>    - **Baaki:**
>      - Settings → **Platform** check karo: "Custom" hona chahiye, Shopify nahi.
>      - Fastrr dashboard mein products dikh rahe hain ya nahi, check karo.
> 4. 🔴 Fastrr se **likhit mein** lo ki wo apni taraf se Shopify order nahi banayenge (warna order double banega).
> 5. 🟡 Real tests (`SHOP_SHOPIFY_TEST_ORDERS=true`):
>    - **COD:** app mein `cod_pending`, Shopify mein "Test order" (`take-app` tag), Fastrr mein bhi order.
>    - **Prepaid:** order `paid`, Shopify order, settlement sahi account mein.
>    - **Cancel + refund:** Fastrr refund, Shopify cancel.
>    - **Shopify mein fulfil karo:** app mein shipped + push notification.
>    - Har test ke baad Shopify order cancel karo (stock wapas).
> 6. 🟢 Go-live se pehle:
>    - `SHOP_SHOPIFY_TEST_ORDERS=false` (dono jagah).
>    - Shopify mein har variant ka **weight** daalo (abhi `grams = 0` → shipping charge galat).
>    - Test product **"second-product"** (bina SKU) ko draft karo.
>    - Flutter team ko handoff do (`docs/shop-flutter-api-guide.md`).
> 7. ⚪ Management se poochna (end mein): app orders pe card-offer trial? COD max limit + fee? Refund/return policy? App orders kaun ship karega? GST invoice kaun dega?
> 8. ⚠️ Webhooks register hote hi **card offer live** ho jaata hai (store buyers ko 30-day trial, rules A–D). Management se ek baar confirm kar lena.
> 9. Card-offer ke 2 tests date ki wajah se fail hote hain (prod pe asar nahi): `docs/card-offer-rahul-test-failure.md`. Ye card-offer owner ka kaam hai.
>
> **Checkout WebView (confusion clear):** custom flow mein bhi checkout app ke andar **WebView** mein hi khulta hai. `POST /api/shop/checkout` → `checkoutUrl` (`/api/shop/checkout/:orderId/page`) → us page pe Fastrr ka `HeadlessCheckout` JS. 17 Nov ko sirf Fastrr ka "Shopify one-click URL" mode hataya tha, jo Shopify se jude stores ke liye hota hai. Flutter ko kuch nahi badalna.
>
> **2026-11-17 — FINAL: custom integration hi chalega.** 16 Nov ko Fastrr team ko laga tha ki hamara app Shopify se juda hai, isliye unhone "Fastrr Shopify order banayega + Shopify WebView checkout" bola. Is galatfehmi pe kuch kaam ho gaya tha: plan update `cfbe762`, aur ghar pe WebView checkout mode + Shopify order verifier `6b1232c`. 17 Nov ko Fastrr ke saath sab clear ho gaya. Unhone confirm kiya ki Postman ka **"SRC Custom Integration"** doc hi follow karna hai, jo is plan ka original flow hai: token API → `HeadlessCheckout` JS → order webhook + Order Details fetch-back → **Shopify order hum banate hain** (M3 `orderCreate`).
> - WebView mode ka code (`SHOP_CHECKOUT_MODE`, `shopifyOrderVerify`, uske tests) **hata diya**. Link mode ab nahi banega.
> - Product/catalog APIs doc se field-by-field dobara check kiye: pehle se match karte hain (§11). Koi change nahi.
> - Go-live ke liye env (Vercel + Render dono): `FASTRR_API_KEY`, `FASTRR_API_SECRET` (Fastrr se lena hai) aur `SHOP_SHOPIFY_ORDER_SYNC=true` (Shopify token mein `write_orders` chahiye). Fastrr se ek baar likhwa lo ki wo **apni taraf se Shopify order nahi banayenge** (warna order double ban jayega).
>
> | Commit (16–17 Nov) | Kya |
> |---|---|
> | `e0ddd2b` | Shop APIs Postman doc ke format pe + checkout CSP fix (§11) |
> | `cfbe762`, `6b1232c`, `2f4d48d` | Galatfehmi wala "Fastrr Shopify order banayega" plan + WebView code — **17 Nov ko wapas liya** |
> | `f4eba54` | Rahul card-offer test note (`docs/card-offer-rahul-test-failure.md`) |
>
> **Aaj kahan tak (2026-11-16 raat):** code side sab ban gaya — catalog, cart, checkout (Fastrr), orders, Shopify order + stock hold + shipping, cancel + refunds, shop admin. **Baaki = external:** Fastrr keys se real test, Fastrr/management/Shopify dev ke jawab (§13, requirements doc), live store test, prod deploy (§14).
>
> | Commit | Kya |
> |---|---|
> | `82ebe81` | M1 catalog + cart + order model |
> | `fa374b3` | M2 Fastrr checkout, webhook, orders, reconciliation |
> | `0aa3ae9` | M3 Shopify order create, stock holds, shipping updates |
> | `6271d53` | M4 cancel + refunds |
> | `95294ef` | Shop admin APIs + `shop_events` log |
> | `c2b77bf`, `bebdb20` | Shop admin web pages (`/admin/shop`) + full-width fix |

---

## 0. Naye laptop pe kaise resume karein

1. `git pull` (Staging branch) — M1–M4 + admin code + ye doc aa jayega.
2. `cd server && npm install`
3. `server/.env` git mein NAHI hota. Office laptop se ye values copy karo (password manager / secure chat se, public jagah nahi):
   `MONGODB_URI`, `MONGODB_URI_STAGING`, `JWT_SECRET`, `SHOPIFY_ADMIN_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_CLIENT_SECRET` / `SHOPIFY_WEBHOOK_SECRET`, Redis, QStash (`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`), aur baaki jo office `.env` mein hai.
4. Check (sab `server/` se):
   - `node scripts/shopCatalogSync.js --preview` (sirf Shopify read, DB nahi chhoota)
   - `node --test tests/shop*.test.js` — 192 tests (DB / Fastrr / Shopify sab mock; kuch real nahi chhoota). Expected (17 Nov): 190 pass, 2 fail. Dono `shopifyOfferRules` ke card-offer, date-dependent tests hain (pre-existing, shop se unrelated, §14 F)
   - `node scripts/shopStagingE2E.js` — asli **staging** MongoDB pe M1–M4 flow (48 checks), Fastrr + Shopify mock; apna data (users, carts, orders, holds) khud delete karta hai. Sirf `*staging` DB pe chalta hai.
5. Claude ko bolo: **"docs/shop-headless-plan.md padho aur wahan se continue karo"**. Claude ki memory laptop-specific hai, isliye saara context isi file mein hai.

### 0a. App local pe chala ke dekhna (server + web admin)

- **Server (staging DB, background jobs OFF):** `server/` se
  `node -e "require('node-cron').schedule=()=>({start(){},stop(){},destroy(){}}); require('./server.js')"`
  Kyun: `server.js` Vercel ke bahar start hote hi crons + reminder/notification jobs chala deta hai (notification har minute) → local server staging users ko **asli push** bhej sakta hai. Ye wrapper sirf us run ke liye cron band karta hai, code nahi badalta. `.env` mein `USE_STAGING_DB=true` → staging DB. Port 5001.
- **Client:** `client/` se `npm ci` (lockfile se exact; is laptop pe `node_modules` adhoora tha — vite missing, esbuild wrong-platform) → `npx vite --host 127.0.0.1` → http://127.0.0.1:5173 (API apne aap `http://localhost:5001/api`). Build check: `npx vite build` (2026-11-16 pass).
- **Admin login (staging):** staging DB mein abhi sirf ek admin hai — "Amish" (`amish2725@gmail.com`). Password kisi ko pata nahi (bcrypt); apna account ho toh web app ka "Forgot password". Kisi aur ko admin banana ho toh **staging pe direct update karo, `scripts/promoteAdmin.js` NAHI** (§14 F).
- Login → left menu **Shop** → `/admin/shop`. Staging pe shop data khaali hai (E2E apna data delete karta hai) — sirf Products tab bhara dikhega. Demo data chahiye toh Claude se bolo (`demo` tag ke saath, ek command se hatne wala) — abhi daala nahi.

---

## 1. Goal aur final decisions

**Goal:** Take Limited ke Shopify products take.health app (Flutter) ke andar bechna — **bina Shopify website pe redirect kiye**. Checkout/payment Fastrr (Shiprocket Checkout) ka, app ke WebView mein.

| Decision | Final |
|---|---|
| Scope | **Sirf backend** (Node). Flutter app alag team bana rahi hai |
| Store | **Take Limited** `2jfdfm-vp.myshopify.com` → env `SHOPIFY_ADMIN_STORE_DOMAIN` (purana `SHOPIFY_STORE_DOMAIN` = old Fastrr test store, use NAHI karna) |
| Shopify order kaun banayega | **Hum** — payment confirm hone ke baad Admin API `orderCreate` se (M3) |
| Payment | **COD + Prepaid** dono |
| Cart | **Server cart** (DB mein) — multi-device, price/stock server-side check |
| Code location | `server/modules/shop/` (mounted at `/api/shop`) |
| Subscribe variants | **Implemented as (a)**, flag `SHOP_HIDE_SUBSCRIBE_VARIANTS` **default `true`** (chhupe hue). Management "b" chahe toh flag `false`. Dekho §8 |
| Idempotency-Key | **Flutter app banata hai** (UUID v4 per checkout attempt), backend sirf validate + unique index. Flow: Flutter guide §5 |
| Checkout UI | **Fastrr ka page** (phone OTP, address, coupon, payment). Flutter sirf WebView container banata hai — app mein phone/address fields NAHI |
| Deep link | `takehealth://shop/order/{orderId}?status={status}` — `takehealth://` scheme app mein pehle se registered hai (wearables OAuth `takehealth://wearables?provider=…`), Flutter sirf `shop` route add kare |
| GST invoice | **Apna backend invoice NAHI banayega** (do invoice series ban jaati). App orders asli Shopify orders hain → jo system website orders ka invoice banata hai (Shopify GST app / Shiprocket) wahi banayega, dispatch pe. Shopify products pe HSN + GST rate chahiye (§7 #6) |
| Address / phone | Fastrr se aata hai, per-order `orders` mein save; user profile overwrite NAHI; Shopify order + invoice + courier ke liye use |

---

## 2. Architecture (kaun kya karta hai)

```
Shopify (Take Limited)  = product master + warehouse/fulfilment
        │ webhooks + daily sync
        ▼
Our backend (Node, /api/shop)  = DB copy of catalog, server cart, orders (source of truth)
        │ token API / webhook / Order Details API
        ▼
Fastrr  = sirf checkout page + payment (WebView ke andar)
        ▲
Flutter app = sirf UI
```

### End-to-end flow (target)
1. App → `GET /api/shop/products` → product list (humare DB se, Shopify call nahi).
2. App → `POST /api/shop/cart/items` → server cart.
3. App → `POST /api/shop/checkout` (M2) → hum cart validate karte hain, Order `pending` save karte hain, phir Fastrr access-token API call (humara price `catalog_data` mein, `mobile_app: true`).
4. App WebView mein `GET /api/shop/checkout/:orderId/page` (M2) kholta hai → Fastrr JS checkout load (`HeadlessCheckout.addToCart(event, token, {fallbackUrl, isInitiatedFromApp:true})`).
5. User address + payment (UPI/card/COD) Fastrr pe karta hai.
6. Fastrr → `POST /api/shop/fastrr/webhook` (M2). Webhook **unsigned** hai → body pe trust nahi, sirf `order_id` lo aur **Order Details API se fetch-back** karo → `paid` / `cod_pending`.
7. Cart clear, Shopify sync `pending` → QStash job Shopify `orderCreate` (M3, tag `take-app` + internalOrderId).
8. Shopify fulfilment/refund webhooks → order status update → FCM push (M3).
9. App WebView band hone pe `GET /api/shop/orders/:id` poll karta hai.
10. Backup: reconciliation cron pending orders ka status Fastrr se poochta hai (M2).

### Vercel routing rule (IMPORTANT)
Sirf `/api/*` backend tak jaata hai, baaki sab SPA pe rewrite hota hai. Isliye **har shop/Fastrr URL `/api` ke andar** hona chahiye.

### Two backends
Same server Vercel + Render dono pe, **same prod DB**. Env vars **dono jagah** set karne hain. QStash crons Vercel URL pe. Shopify webhooks **sirf ek URL** (Vercel/www.take.health) pe register — warna har event do baar process hoga.

---

## 3. Milestones status

| Milestone | Kya | Status |
|---|---|---|
| **M1** | Catalog sync + catalog APIs + Fastrr catalog pull + server cart + Order model/state machine | ✅ Code done, staging pe test pass. **Prod deploy/scripts baaki**, M1 gaps §7 |
| **M2** | Fastrr checkout: client, checkout start, WebView page, webhook + fetch-back, order status API, reconciliation cron, catalog push | ✅ Code + 52 naye tests done (mock Fastrr + in-memory DB). **Baaki: Fastrr staging keys se real E2E** (§9a) |
| **M3** | Shopify order create (QStash, idempotent via tag lookup), stock reservation, fulfilment/cancel/COD-paid webhooks, FCM notifications | ✅ Code + 35 tests + staging DB E2E (Shopify mock). Flag `SHOP_SHOPIFY_ORDER_SYNC` code mein default OFF hai. **Go-live pe `true` karna hai**, kyunki 17 Nov ko confirm hua ki Shopify order hum banayenge. Live-store test baaki (§10a) |
| **M4** | Cancel (customer + admin), refunds (Fastrr Refund API + report sync), Shopify cancel + refund record, duplicate-payment / store-cancel refunds, admin refund actions | ✅ Code + 20 tests + staging DB E2E (48/48, Fastrr + Shopify mock). Auto-refund **OFF** by default. Real Fastrr refund test baaki (keys). §10 |
| **Admin** | Shop admin APIs + pages (overview, products, orders + timeline, carts, customer journey + `shop_events`, attention, refunds) in existing web admin (`client/`) | ✅ Backend APIs + 14 tests. ✅ Pages (`/admin/shop`) — `vite build` pass, local pe chala ke dekha (§0a, §10b) |

---

## 4. M1 — kya bana (detail)

### Files (`server/modules/shop/`)
| File | Kaam |
|---|---|
| `config.js` | `maxQtyPerItem()` (env `SHOP_MAX_QTY_PER_ITEM`, default 10), `maxCartLines()` (`SHOP_MAX_CART_LINES`, 30), page sizes (20/50), `fastrrMaxLimit` 250 |
| `lib/money.js` | `toPaise`, `paiseToDecimalString`, `paiseToRupees` — **saara paisa integer paise mein** |
| `lib/shopError.js` | `ShopError(status, code, message, details)` + `sendError()` → `{code, message, ...}` |
| `lib/catalogMapper.js` | Shopify GraphQL → DB doc; DB doc → app shape (`{paise, rupees}`) aur Fastrr shape (ids as Number, price `"1499.00"`, unlimited qty = 9999) |
| `lib/cartEvaluator.js` | Cart lines ka live check: `UNAVAILABLE` / `OUT_OF_STOCK` / `INSUFFICIENT_STOCK`, `priceChanged`, summary `{itemCount, subtotal, hasIssues, checkoutAllowed}` |
| `lib/orderStateMachine.js` | 3 status fields ke allowed transitions + `transition()` = conditional `findOneAndUpdate` (race-safe: webhook vs cron, sirf ek jeetega) |
| `models/Product.js` | `ShopProduct` / `shop_products` — ek doc per product, variants embedded |
| `models/Collection.js` | `ShopCollection` / `shop_collections` — collection info (products ka mapping product ke `collections[]` mein) |
| `models/Cart.js` | `ShopCart` / `shop_carts` — ek doc per user |
| `services/shopifyCatalogClient.js` | Shopify GraphQL queries (products 10/page, variants 20/product, collections 50/page — query cost ≤1000) |
| `services/catalogSyncService.js` | `refreshProduct`, `refreshCollection`, `handleWebhook`, `fullSync` — webhook pe **fetch-back** + **stale guard** (`shopifyUpdatedAt` purana ho toh write skip) |
| `services/catalogService.js` | Read side (DB only): app list (cursor pagination, search, collection filter), detail, collections, Fastrr pull |
| `services/cartService.js` | get/add/setQty/remove/clear — har write ek atomic update (qty cap, line cap, upsert race retry) |
| `controllers/*.js`, `routes.js` | Thin controllers + routes |

### APIs (`/api/shop`)
| Method + Path | Auth | Kaam |
|---|---|---|
| `GET /products?cursor=&limit=&q=&collection=` | public | List (sirf active) |
| `GET /products/:handle` | public | Detail (draft/deleted → 404) |
| `GET /collections` | public | Collections |
| `GET /fastrr/products?page=&limit=` | public | Fastrr catalog pull |
| `GET /fastrr/collections?page=&limit=` | public | Fastrr |
| `GET /fastrr/collection-products?collection_id=&page=&limit=` | public | Fastrr |
| `GET /cart` | protect | Cart + live price/stock check |
| `POST /cart/items` `{variantId, quantity}` | protect | Add (existing line pe qty add) |
| `PATCH /cart/items/:variantId` `{quantity}` | protect | Set qty (0 = remove) |
| `DELETE /cart/items/:variantId` | protect | Remove (idempotent, 200 even if missing) |
| `DELETE /cart` | protect | Clear |
| `POST /internal/catalog-sync` | QStash signature | Daily full sync (fail → 500 so QStash retries) |

Rate limits: reads `apiLimiter` (200/min/IP), cart writes `shopWriteLimiter` (60/min/user, Redis).

### Shopify webhooks → `POST /api/shopify/webhooks` (existing route)
HMAC + shop-domain check ke baad: catalog topics (`products/*`, `inventory_levels/update`, `collections/*`) → `catalogSyncService`; order topics → card offer (unchanged).

### Order model (`server/models/Order.js` — rewrite)
models/ mein hi hai kyunki privacyController ka 8-year retention isse use karta hai.
- `internalOrderId` (unique, `TH-...`), `user`, `idempotencyKey` + `cartHash`
- `items[]` with `priceSnapshot` (paise), `hsnCode`, `gstRate`
- `amount`, `pricing{subtotal, discount, shipping, codCharges, total, couponCodes}`, `gstBreakup`
- `customer`, `shippingAddress`, `billingAddress`, `paymentMethod` (prepaid/cod)
- `paymentStatus`: pending → paid / cod_pending / failed / expired; cod_pending → paid / cancelled; paid → refund_pending / partially_refunded / refunded
- `shopifySyncStatus`: not_started → pending → synced / failed / needs_attention
- `fulfillmentStatus`: unfulfilled → partial / fulfilled / cancelled; fulfilled → delivered / rto
- Fastrr: `fastrrOrderId` (= webhook `order_id` / `platform_order_id`), `fastrrNumericOrderId`, `fastrrCartId`, `fastrrToken`, `fastrrTokenExpiresAt`, `rtoPrediction`
- Shopify: `shopifyOrderId`, `shopifyOrderName`, `shopifySyncAttempts`, `shopifySyncError`
- `tracking`, `refunds[]`, `invoiceNumber`, `statusHistory[]`
- Indexes: `{user, idempotencyKey}` unique (per-user idempotency), `{user, createdAt}`, `{paymentStatus, createdAt}`, `{shopifySyncStatus, updatedAt}`
- **Rule:** status fields sirf `orderStateMachine.transition()` se badlo.

### Scripts (`server/scripts/`)
| Script | Kaam | Kab |
|---|---|---|
| `shopCatalogSync.js --preview` | Shopify se read karke print, DB nahi | Kabhi bhi (safe) |
| `shopCatalogSync.js` (+ `USE_STAGING_DB=true` for staging) | Full sync DB mein + indexes + `Order.syncIndexes()` (purana global `idempotencyKey_1` drop) | Staging ✅ done; **prod: deploy ke baad** |
| `registerShopifyWebhooks.js --url=https://www.take.health [--dry-run]` | Shopify webhooks register (order + catalog topics) | Prod: 18 Nov ko 12/15 ho gaye; `inventory_levels/update` + `fulfillments/*` scopes ke baad (upar status). Sirf ek URL |
| `registerShopCatalogSchedule.js https://www.take.health` | QStash daily 03:30 IST full sync + order reconciliation (10 min) | ✅ Prod done 18 Nov |
| `shopFastrrCatalogCheck.js <base-url>` | Fastrr catalog APIs (products, collections, products-by-collection) ko Postman doc se field-by-field check karta hai, sirf GET. PASS/FAIL deta hai | Fastrr ko URL dene se pehle / catalog change ke baad. Prod + staging PASS 18 Nov |

### Existing files jo badle
- `server/server.js` — `/` pe `fastrrRoutes` hataya, `/api/shop` mount kiya
- `server/routes/fastrrRoutes.js` — **DELETED** (3 bugs, galat store, naye Order model se incompatible). `server/utils/fastrrHmac.js` rakha hai (sahi hai, M2 mein use hoga)
- `server/routes/shopifyWebhookRoutes.js` — catalog topics dispatch
- `server/services/shopifyAdminService.js` — `graphql`, `getConfig`, `ShopifyApiError` export
- `server/scripts/registerShopifyWebhooks.js` — catalog topics add
- `server/middleware/rateLimit.js` — `shopWriteLimiter`
- `server/.env.example` — `SHOP_MAX_QTY_PER_ITEM`, `SHOP_MAX_CART_LINES`

### Tests
`server/tests/shopCatalog.test.js`, `server/tests/shopCartAndOrder.test.js` — 19 tests (money, mapping, availableQty, Fastrr format, cursor, regex escape, paging, cart evaluation, state machine). Full suite 392: 391 pass, 0 fail.

---

## 5. Verified (2026-11-14, staging)

- Preview: 2 products (Berberine active, "Second product" draft), 2 collections. Scopes `read_products` + `read_inventory` OK.
- Staging sync: 2 products, 2 collections, 0 stale, 1.2s.
- Catalog APIs: list sirf active, draft → 404, collections OK, Fastrr format OK.
- Cart E2E (local server on staging DB, test JWT): add/merge qty, set qty, qty>10 → 400, qty 0 → 400, draft/unknown variant → 404, 6 parallel +2 → cap held (9), remove, clear. Sab pass.
- **Not tested yet:** `/fastrr/collections`, `/fastrr/collection-products`, price-change flag, out-of-stock path, Shopify webhook delivery, QStash schedule (deploy ke baad).

### Real catalog data (Take Limited)
Berberine variants (price paise): 1 pack One-Time `57199514222897` ₹1499 · 1 pack Subscribe ₹1349 · 2 pack OT ₹2998 · 2 pack Sub ₹2698 · 3 pack OT ₹4497 · 3 pack Sub ₹4047. Collections: `frontpage` (Home page), `all-take-products`.

---

## 6. Patterns / non-negotiable rules
- Paisa hamesha **integer paise**.
- Webhook body pe trust nahi → **fetch-back** (Shopify product refetch; Fastrr Order Details API).
- Webhook: verify → dedupe → **200 jaldi** (Shopify ~5s timeout, baar baar fail hone pe subscription delete).
- Status change sirf **conditional findOneAndUpdate** (state machine).
- Idempotency key **per user** + `cartHash`; same key + alag cart → 409.
- **Order DB mein save PEHLE**, Fastrr call BAAD mein.
- Jobs/crons **QStash** se (Vercel serverless, BullMQ nahi).
- Shopify GraphQL query cost ≤ 1000 → chhote page sizes.
- Production quality: perf regression nahi, security default, edge cases handle.

---

## 7. M1 gaps / missing (abhi tak baaki)

| # | Gap | Owner / Action |
|---|---|---|
| 1 | ~~Code commit/push~~ ✅ M1 `82ebe81`, M2 `fa374b3`, M3 `0aa3ae9` — sab `origin/Staging` pe pushed (2026-11-15). Render (`ai-healthcare-1-0i51.onrender.com`) Staging auto-deploy karta hai — M2/M3 routes wahan live | — |
| 2 | Prod deploy + prod sync + webhooks register + QStash schedule | Deploy ke baad scripts (§4 Scripts) |
| 3 | ~~Subscribe variants filter~~ ✅ done (M2): list/detail/cart/checkout/Fastrr feed se hidden, `minPrice` visible variants se | Management confirm kare (§8) |
| 4 | **Product weight 0** saare variants pe → Fastrr shipping galat | Shopify dev weights daale |
| 5 | **`descriptionHtml` khaali** | Shopify dev se poochho description kahan hai (metafields/theme) → query mein add |
| 6 | **HSN code / GST rate** product pe nahi hai | Invoice Shopify-side banega (§1) → HSN/GST rate **Shopify products pe** set karwao + Shopify India tax settings on. Ops/Shopify dev — go-live blocker (§14) |
| 7 | ~~`.env.example` Fastrr block purana~~ ✅ updated (M2) | — |
| 8 | Price-change + out-of-stock paths ab tests mein covered. Fastrr collections/collection-products endpoints real staging pe abhi bhi untested | Staging E2E (§9a) |
| 9 | Desktop CSV (`Shop-Backend-Steps.csv`): Step 1 → Done, Step 22 se "(if Fastrr does not do it)" hatana | Excel band karke update |
| 10 | Local `exceljs` install nahi (unrelated, `/api/creator` load fail locally) | `npm install` |
| 11 | Variant > 20 per product → truncation warning (abhi max 6) | Monitor; zarurat pe `VARIANTS_PER_PRODUCT` badhao |
| 12 | Abandoned cart (cart `updatedAt` index ready) | Post-launch |

---

## 8. Pending decisions

1. **Subscribe variants** — Berberine pe "Subscribe" variant = sasta price (₹1349 vs ₹1499) but hamare checkout mein recurring payment nahi hai.
   - (a) **Recommended:** app mein chhupao + checkout pe reject. Koi nuksaan nahi, list price = actual price.
   - Nahi chhupaya → customer ₹1349 mein ek baar kharidega, next month kuch nahi aayega → ₹150 loss/order + complaints.
   - (b) Real subscription → Fastrr recurring support chahiye; bada kaam, post-launch.
2. ~~Flutter deep link~~ ✅ resolved: `takehealth://shop/order/{orderId}` (scheme pehle se registered, §1).
3. **Management (Monday, 2026-11-17):**
   - App orders pe card-offer 30-day trial? → flag `SHOP_APP_ORDERS_CARD_OFFER` (default `true` = haan)
   - COD max limit + COD fee (Fastrr dashboard pe set hota hai)
   - **Refund/return policy** (M4 isi pe depend): ship hone ke baad cancel? return kitne din? khula supplement pack wapas?
   - **COD refund kaise** (online refund possible nahi): UPI pe manual transfer / store credit?
   - Auto-refund limit (e.g. ₹2000 se upar admin approve)?
   - Policy page + privacy policy update (gateway ko URLs chahiye; address/phone Fastrr + Shopify ke saath share hota hai — likhna)

---

## 9. M2 plan — Fastrr checkout (next)

| # | Part | Detail | Fastrr keys chahiye? |
|---|---|---|---|
| 1 | `services/fastrrClient.js` | Base URL env (`FASTRR_BASE_URL`), `X-Api-Key` + `X-Api-HMAC-SHA256` (base64, `utils/fastrrHmac.js`), timeout, retry on 5xx/429 | Code no, test yes |
| 2 | `POST /api/shop/checkout` (protect, `Idempotency-Key` header) | Cart evaluate (issues → 409) → cartHash → same key+same hash → existing order return; same key+diff hash → 409 → Order `pending` save (`TH-...`, priceSnapshot) → Fastrr access-token API (`/api/v1/access-token/checkout`) with `catalog_data` (our price), `mobile_app: true`, redirect deep link → token + expiry save → return `{orderId, checkoutPageUrl}`. Token expired → same order pe naya token | No |
| 3 | `GET /api/shop/checkout/:orderId/page` | WebView bridge HTML: Fastrr JS snippet load, `HeadlessCheckout.addToCart(event, token, {fallbackUrl, isInitiatedFromApp:true})`. Redirect `?oid=&ost=SUCCESS` → deep link | No |
| 4 | `POST /api/shop/fastrr/webhook` | Unsigned + duplicate ho sakta hai → sirf `order_id` lo → **Order Details API** (`/api/v1/custom-platform-order/details`) fetch-back → order lookup by `fastrrOrderId` / `platform_order_id` → amount check vs `subtotal_price` → `payment_type` CASH_ON_DELIVERY → `cod_pending`, PREPAID+paid → `paid` → address/customer/pricing (`total_amount_payable`, `cod_charges`, discounts)/`rto_prediction` save → cart clear → `shopifySyncStatus: pending` → 200 fast | No |
| 5 | `GET /api/shop/orders/:id` (+ list) | App poll / My Orders | No |
| 6 | Reconciliation cron (QStash, har 10 min) | `pending` > 15 min → Order Details/List API → `paid` / `expired` | No |
| 7 | Catalog push | Product refresh ke baad Fastrr `https://checkout-api.shiprocket.com/wh/v1/custom/product` aur `/collection` pe signed push | No |
| 8 | Tests | Fastrr mock ke saath | No |
| — | Real E2E on staging | token, page, test payment, webhook | **Yes** |

### 9a. M2 — kya bana (2026-11-15)

**Files** (`server/modules/shop/`)
| File | Kaam |
|---|---|
| `services/fastrrClient.js` | Signed POST (`X-Api-Key` + base64 HMAC of exact raw body, fresh `timestamp`), timeout, retry on network/429/5xx. **Token create timeout pe retry NAHI** (Fastrr order ban chuka ho sakta hai). 511 = auth error. `createCheckoutToken`, `getOrderDetails`, `listOrders`, `pushProduct`, `pushCollection` |
| `services/checkoutService.js` | `startCheckout` (idempotent), `ensureToken` (token lease), `checkoutPage`, `checkoutReturn` |
| `services/fastrrOrderService.js` | **Ek hi path** Fastrr → humara Order: `syncOrder` (fetch-back + apply), `handleWebhook`, `syncPendingThrottled` (poll/return), `reconcile` (cron) |
| `services/orderService.js` | My Orders list (sirf placed orders, cursor) + detail (pending pe throttled Fastrr check) |
| `lib/checkoutLogic.js` | `TH-YYMMDD-XXXXXXXX` ids, idempotency key format, `cartHash`, Fastrr token payload, signed page links |
| `lib/fastrrOrderMapper.js` | Fastrr details → `paid`/`cod_pending`/`failed`/`pending`, address/pricing/payment mapping (paise), sanity checks |
| `lib/orderView.js` | App ke liye ek `status` + order shape (token/review/user kabhi nahi bhejte) |
| `lib/checkoutPage.js` | WebView HTML (escaped; token `<script>` se break-out nahi kar sakta) |
| `controllers/checkoutController.js` | Thin controllers; page pe `no-store`, `no-referrer` |

**APIs** (`/api/shop`)
| Method + Path | Auth | Kaam |
|---|---|---|
| `POST /checkout` header `Idempotency-Key` (8–128 chars; body `idempotencyKey` bhi chalega) | protect, 20/min/user | → `{orderId, status, amount, itemCount, checkoutPageUrl, expiresAt}` |
| `GET /checkout/:orderId/page?exp=&sig=` | signed link (HMAC, 2h) | WebView: Fastrr JS load + `HeadlessCheckout.addToCart(evt, token, {fallbackUrl, isInitiatedFromApp:true})`. Token expire → same order pe naya token |
| `GET /checkout/:orderId/return?oid=&ost=` | public | Fastrr `redirect_url`. `ost` pe trust nahi — Fastrr se check karke **humara** status deep link mein |
| `GET /orders?cursor=&limit=` | protect | My Orders (pending/failed/expired checkouts nahi dikhte) |
| `GET /orders/:orderId` | protect (owner only) | Detail; pending ho toh Fastrr check max 1 baar / 10s |
| `POST /fastrr/webhook` | public, 300/min/IP | Sirf `order_id` → fetch-back. Garbage → 400, unknown → 200, Fastrr down → 500 (retry) |
| `POST /internal/reconcile-orders` | QStash signature | Har 10 min |

**Error codes (app ke liye, `{code, message, ...}`)**: `IDEMPOTENCY_KEY_REQUIRED` 400 · `CART_EMPTY` 400 · `CART_HAS_ISSUES` 409 (+`cart`) · `PRICE_CHANGED` 409 (+`cart`; naya price dikhao, **naye key** se dobara) · `IDEMPOTENCY_KEY_REUSED` 409 · `ORDER_ALREADY_PLACED` 409 (+`orderId`) · `CHECKOUT_CLOSED` 409 (expired/failed → naye key se) · `CHECKOUT_IN_PROGRESS` 409 (+`retryAfterMs`, same key se retry) · `CHECKOUT_PROVIDER_ERROR` 502 (same key se retry) · `CHECKOUT_UNAVAILABLE` 503 · `ORDER_NOT_FOUND` 404.

**App `status` values**: `awaiting_payment`, `payment_failed`, `expired`, `confirmed`, `shipped`, `delivered`, `returned`, `cancelled`, `refund_initiated`, `partially_refunded`, `refunded`.

**Flutter flow (Flutter team ko dena)**: checkout tap pe ek UUID key banao → `POST /checkout` → `checkoutPageUrl` WebView mein kholo → WebView navigation mein `/api/shop/checkout/*/return` ya `takehealth://shop/order/...` aaye toh WebView band → `GET /orders/:orderId` har 2–3s poll jab tak `awaiting_payment` (max ~60s, phir "we'll update you"). Same key sirf retry ke liye; naya attempt = naya key.

**Design rules jo code mein enforce hain**
- Order DB mein **pehle** (`pending`, price snapshot), Fastrr call baad mein. Fastrr fail → order rehta hai, same key se retry same order use karta hai.
- **Token lease** (`tokenLeaseUntil`, 20s): ek order ke liye ek time pe ek hi request Fastrr token maangti hai → double tap = 1 order, 1 Fastrr session.
- Naya token = naya Fastrr order id → saare ids `fastrrOrderIds[]` mein, late webhook bhi match hota hai. Do Fastrr orders dono paid → pehla jeetta, doosra `review.reasons: DUPLICATE_PAYMENT:<id>` (refund karna hai).
- Purane token ka FAILED naye live token wale order ko fail nahi karta.
- Confirmed (paid/COD) pe: sirf kharide gaye cart lines hatte hain (baad mein add kiye items rehte hain), `shopifySyncStatus → pending` (M3 isse uthayega).
- Sanity check fail (subtotal ≠ humara amount, items alag, received ≠ payable) → payment record hota hai par `review.needed` + `shopifySyncStatus: needs_attention` → **Shopify order auto nahi banega**.
- Cron: `pending` > 15 min → Fastrr check; token expiry + 10 min (ya tokenless 30 min) → `expired`. Expire update ke andar hi token/lease dobara check (race-safe). `expired` 6h tak recheck (late payment rescue). 48h se purane chhod deta hai. Confirmed par Shopify sync `not_started` wale repair.
- Catalog push: Shopify product/collection webhook ke baad Fastrr ko push (3s, 1 attempt, fail → sirf log). Fastrr feed mein ab top-level `options` bhi hai.

**Order model mein naye fields**: `items[].variantTitle/imageUrl`, `pricing.prepaidDiscount`, `payment{gateway,method,txnId,pgTransactionId,amountReceived}`, `placedAt`, `edd`, `review{needed,reasons,flaggedAt}`, `fastrrOrderIds[]` (index), `paidFastrrOrderId`, `tokenLeaseUntil`, `fastrrCheckedAt`. State machine: `shopifySyncStatus not_started → needs_attention` allowed.

**Other changes**: `server.js` CORS `allowedHeaders` mein `Idempotency-Key`; `rateLimit.js` mein `shopCheckoutLimiter`, `shopWebhookLimiter`; `registerShopCatalogSchedule.js` ab dono schedules banata hai (catalog 03:30 IST + reconciliation */10).

**Tests** (`server/tests/`, sab offline):
- `shopCheckoutLogic.test.js` (17): ids, key, cartHash, payload, signed links, Fastrr status matrix, sanity checks, mapping, order view, HTML escaping, subscribe hiding, Fastrr `options`.
- `shopFastrrClient.test.js` (13): local mock Fastrr jo HMAC verify karta hai — signing, 511, 5xx/429 retry, 4xx no-retry, token-timeout no-retry, network, not-configured, catalog push.
- `shopCheckoutFlow.test.js` (39): asli services + asli `routes.js` (sirf `protect` stub), in-memory Mongo fake (`tests/helpers/fakeMongo.js`, unique indexes + Mongoose defaults) + mock Fastrr (`tests/helpers/fastrrMock.js`). Idempotency, double tap, price change, Fastrr down, token refresh, forged webhook, duplicate webhook, COD, mismatch, failed→paid, duplicate payment, stale failure, webhook+poll+cron race, reconcile (7 cases), poll throttle/ownership, list paging, page/return, catalog push, HTTP contract.
- Mutation check kiya: fetch-back hatao → 13 fail; lease hatao → double-tap fail; cron re-check hatao → 2 fail. Yaani tests asli bugs pakadte hain.
- Full suite (2026-11-15): sab shop tests pass. Pre-existing, shop se unrelated: `vault.test.js` 4 fail (M2 changes hata ke bhi same), `wearableScoreDedup.staging.test.js` staging DB connect pe hang hota hai (isliye `npm test` poora khatam nahi hota).

**Staging DB E2E (2026-11-15) — `node scripts/shopStagingE2E.js` (server/ se): 33/33 pass.** Asli staging MongoDB (`healthcare-ai-staging`), asli `protect` + JWT, asli routes, asli catalog (Liposomal Berberine HCL); Fastrr mock. Real unique index se triple-tap = 1 order, 6 parallel cart adds cap pe ruke (qty 9), paid/COD/failed→paid, duplicate webhook, cart clear, security. Script sirf `*staging` DB pe chalti hai, catalog read-only, apna throwaway user/cart/orders end mein delete karti hai (`--keep` se rakh sakte ho). Reconciliation cron staging pe nahi chalaya (doosre staging orders scan karta). `ai-healthcare-1-0i51.onrender.com` pe sirf M1 deployed hai (`/api/shop/orders` 404).
Fastrr keys aane pe: script mein mock hata ke real staging Fastrr se same flow.

**Real E2E checklist (Fastrr staging keys aane ke baad)**
1. `.env`: `FASTRR_API_KEY/SECRET`, `FASTRR_BASE_URL=https://fastrr-api-dev.pickrr.com`, `SHOP_PUBLIC_BASE_URL` = jo URL Fastrr/phone tak pahunche (local ke liye ngrok/tunnel).
2. Local server staging DB pe (`USE_STAGING_DB=true`), test user JWT → cart → `POST /checkout` → `checkoutPageUrl` phone browser mein → Fastrr test payment (prepaid + COD dono).
3. Check: webhook aaya (log `[Shop/fastrrWebhook]`), order `paid`/`cod_pending`, `pricing`/address bhare, cart clear, `shopifySyncStatus: pending`.
4. Webhook URL Fastrr ko na do → cron/poll se confirm hota hai ya nahi (`GET /orders/:id`).
5. Token ki asli validity, `fallbackUrl` behaviour, redirect `oid/ost` format note karo §13 mein.

Jo cheezein Fastrr ke jawab pe depend hain (token validity, `fallbackUrl`, own order id, webhook signing/IP) → env/config mein rakhni hain taaki jawab aane pe sirf value badle.

**Known risk:** Fastrr ka `fallbackUrl` "native checkout" (Shopify website) ho sakta hai → no-redirect rule se conflict. Fastrr se confirm karna hai.

---

## 10a. M3 — kya bana (2026-11-15, commit `0aa3ae9`, pushed)

**Flow:** payment confirm → hold 24h → `shopifySyncStatus: pending` → QStash `POST /api/shop/internal/shopify-sync` (local: inline) → claim (60s lease) → Shopify mein `TH-…` tag se search (pehle ban chuka ho toh adopt) → `orderCreate` → `synced` + `shopifyOrderId`, hold 2 min. Fail: transient → `failed`, cron 2 min baad retry (search-lag ki wajah se turant nahi); permanent (userErrors / 401 / 403) ya 5 attempts → `needs_attention` + `[ALERT]` log.

**orderCreate input (store schema se verify kiya, API 2026-10):** lineItems (variant gid + humara `priceSet`), prepaid → `transactions: [SALE/SUCCESS]`, COD → `financialStatus: PENDING`, shipping + COD charge = shippingLines, coupon = `itemFixedDiscountCode`, tags `take-app, TH-…, Prepaid|COD`, `sourceIdentifier`, `taxesIncluded: true`, phone E.164 (+91, invalid ho toh chhod ke note mein), state → provinceCode (`lib/indiaStates.js`), `options.inventoryBehaviour: DECREMENT_IGNORING_POLICY`, `sendReceipt` off, `test` flag.

**Shopify → hum** (`/api/shopify/webhooks`, HMAC): `orders/create|paid|cancelled|fulfilled|partially_fulfilled`, `fulfillments/create|update` → take-app order? → Shopify se fetch-back → shipped/delivered (+tracking), COD paid, cancelled (COD → cancelled; prepaid → review "refund due", M4). Card offer ko order topics milte rahenge jab tak `SHOP_APP_ORDERS_CARD_OFFER=true`.

**Stock reservation** (`shop_stock_reservations`, TTL): checkout pe 15 min, token ke baad token expiry + 5 min, paid → 24h, Shopify order bana → 2 min, cancel/expire → release. Insert-then-count: do log last unit ke liye kabhi dono nahi jeet sakte (worst case dono retry). Naya error `STOCK_UNAVAILABLE` 409 (+`availableQty`).

**Push** (`SHOP_ORDER_PUSH`): confirmed / shipped / delivered / cancelled, har event ek baar (`Order.notified`).

**Bugs mile + fix (tests se):** `shopifyAdminService` 401/403 pe `errors` string hota hai → pehle TypeError (card offer pe bhi galat error message) — fixed; `failed → failed` pe lease clear nahi hota tha — fixed.

**Tests:** `tests/shopShopifyOrders.test.js` (35) + `tests/helpers/shopifyMock.js` (Shopify Admin API mock: token, variant/phone/province validation, stock decrement, tag search, "created but response lost"). Mutation check: tag lookup hatao → 5 fail, reservation check hatao → 2 fail, BYPASS → 4 fail. `scripts/shopStagingE2E.js` ab M3 bhi (42/42 staging DB pe; Shopify hamesha mock, script live store ko chhoo hi nahi sakti).

**Live store test checklist (office, Fastrr confirm ke baad):**
1. Warehouse/ops ko PEHLE batao (time window, tag `take-app` + `TEST`), auto-sync (Shiprocket) pause/exclude karwao.
2. `.env`: `SHOP_SHOPIFY_ORDER_SYNC=true`, `SHOP_SHOPIFY_TEST_ORDERS=true`, `SHOP_SHOPIFY_SEND_RECEIPT=false`, apna email/phone.
3. `node scripts/registerShopifyWebhooks.js --url=https://www.take.health --dry-run` → naye topics dekho, phir apply.
4. 1 order → Shopify admin mein check (price, address, MH, phone, stock −qty) → turant cancel + restock.
5. Token scopes: `.env` token mein `write_orders` hai, `read_inventory` nahi dikha — Shopify dev se confirm.
6. Live store pe sirf "test" naam/address kaafi NAHI (automation naam nahi padhta: AWB, stock, email, invoice no., card offer trigger ho sakte hain) — ops ko **pehle** batana zaroori. Behtar: Shopify dev se development store.

**Shopify token findings (2026-11-15, store se read):** `.env` token = Take Limited (`2jfdfm-vp`, INR); has `write_orders`, `read_all_orders`, `write_customers`, `read/write_products`; **no** `read_inventory`/`write_inventory` listed. Isme risky extra scopes bhi hain (`write_script_tags`, `write_customer_data_erasure`, …). Shopify dev ki pasted list (write_themes, payments/bank read, …) **alag token** hai. Recommendation: backend ke liye alag custom app, sirf: `read_products, read_inventory, write_inventory, write_orders, read_all_orders, read_fulfillments, write_customers` + protected customer data (Level 2).

## 10. M4 — kya bana (2026-11-16)

**Files:** `services/refundService.js` (refunds), `services/cancelService.js` (cancel), `controllers/shopAdminController.js` (admin actions), `fastrrClient.initiateRefund/refundReport`, `shopifyOrderClient.cancelOrder/recordRefund` (schema store se verify kiya: `orderCancel(orderId, restock!, reason!, notifyCustomer, staffNote)` async job; `refundCreate(input{orderId, transactions[{parentId, amount, gateway, kind: REFUND}]})`).

**Customer cancel** `POST /api/shop/orders/:orderId/cancel {reason?}` — sirf paid/COD + unfulfilled. Order: (1) Shopify live re-check (ship ho gaya? → 409 + humara copy update) (2) Shopify `orderCancel` restock (refuse kare → 502 `SHOPIFY_CANCEL_FAILED`, humara kuch nahi badla) (3) fulfilment → cancelled (4) COD → payment cancelled; prepaid → refund request (5) hold release + push. Sync chal raha ho (lease) → 409 `CANCEL_IN_PROGRESS`. Shopify mein bante waqt cancel hua → bante hi Shopify cancel. Flag `SHOP_USER_CANCEL` (default on; off → 403 `CANCEL_DISABLED`). App order mein naye fields: `canCancel`, `cancelledAt`, `refund {status: in_progress|completed, amount, completedAt}`.

**Refund lifecycle** (`orders.refunds[]`): `requested → initiating → initiated → processing → completed`, ya `failed` (admin retry) / `unknown` (timeout: shayad ho gaya — **kabhi auto re-send nahi**, Fastrr report se order number + amount se match). Safety: total refunds ≤ paid (optimistic lock `refundVersion`, parallel admin clicks bhi), approve claim conditional (double click = ek Fastrr call), refund initiate single attempt. Payment status: paid → refund_pending → partially_refunded / refunded. Completed → push + Shopify `refundCreate` (bookkeeping, `SHOP_SHOPIFY_RECORD_REFUNDS`).

**Auto vs admin:** `SHOP_AUTO_REFUND` (default **false**) + `SHOP_AUTO_REFUND_MAX_RUPEES` (2000) — sirf system refunds (customer cancel, store cancel, duplicate payment) pe; admin-created / admin-cancel = approved. Baaki `requested` reh ke `[ALERT]` log (admin panel pe dikhega).

**Triggers:** customer cancel, admin cancel, Shopify `orders/cancelled` (prepaid → refund request, pehle wala "refund due" flag hata), duplicate payment (doosre Fastrr order ka refund, order `paid` hi rehta, Shopify pe record nahi, push nahi).

**Admin APIs** (`/api/shop/admin`, `protect + authorize('admin','superadmin')`): `POST /orders/:id/cancel`, `POST /orders/:id/refunds {amountPaise?, reason}` (partial allowed), `POST /orders/:id/refunds/:refundId/approve`, `/retry` (failed only), `/mark-paid {method, reference}` (requested/failed/unknown → manual complete), `POST /orders/:id/refunds/manual {amountPaise, method, reference}` (COD / out-of-band). Methods: `manual_upi | bank_transfer | store_credit | other`.

**Cron:** reconciliation (*/10) ab refund report bhi sync karta hai (sirf jab open refunds hon; pagination).

**Tests:** `tests/shopRefunds.test.js` (20) — cancel (prepaid/COD/shipped/Shopify refuse/disabled/in-progress/unsynced), approve double-click, report sync + Shopify record, auto on/off + limit, partial + parallel over-refund, timeout → unknown → adopted, failed → retry, manual COD refund, store cancel, duplicate payment, admin 403/404/503, cron. Mutation check: lock hatao / claim guard hatao / timeout = failed / Shopify refuse ignore → har ek pe test fail. Fake-Mongo bug mila + fix (positional `$` ek hi baar resolve hona chahiye — real Mongo jaisa). Staging DB E2E section 8 (real positional updates, real admin role).

**Monday ko:** Fastrr keys → real refund test (staging test payment → cancel → approve → report). Fastrr se confirm: `order_id` platform id chalta hai (abhi wahi bhejte hain), partial refund, report status values (mapping: SUCCESS/COMPLETED/REFUNDED → completed, INITIATED → initiated, FAIL* → failed, baaki → processing). Management decisions → `SHOP_USER_CANCEL`, `SHOP_AUTO_REFUND`, `SHOP_AUTO_REFUND_MAX_RUPEES`. **Return / RTO** abhi nahi (post-launch).

---

## 10b. Shop admin (2026-11-16)

**Event log `shop_events`** (TTL `SHOP_EVENTS_RETENTION_DAYS`, default 180; `SHOP_EVENTS=false` = off): search, product_view, cart_add/update/remove/clear, checkout_start/error, payment_page_open, payment_success/failed, order_cancelled/shipped/delivered, refund_requested/completed. Response ke baad likha jaata hai (fire-and-forget). Catalog routes pe `lib/optionalUser.js` — app token bheje toh event user se linked (sirf JWT verify, DB lookup nahi), warna anonymous. **Privacy policy mein likhna hai** (browsing/search activity 180 din).

**Admin APIs** (`/api/shop/admin`, admin/superadmin): `GET /overview?range=today|7d|30d|90d` (orders, gross/refunded/net revenue, AOV, prepaid/COD, abandoned checkouts, funnel, top products, daily IST, attention counts) · `GET /orders?status=&paymentMethod=&q=&from=&to=&attention=&page=&limit=` (search: TH id / phone / email / name / #TAKE…) · `GET /orders/:id` (sab + merged timeline, Shopify admin link, token kabhi nahi) · `POST /orders/:id/retry-sync` · `POST /orders/:id/review/resolve {note}` · `GET /attention` · `GET /products` (stock, held, sold 30d, hidden, weight) · `POST /products/sync` · `GET /carts?abandoned=` · `GET /customers?q=` · `GET /customers/:userId` (journey) · `GET /refunds?status=` + M4 actions.

**Web pages** (`client/src`): `pages/AdminShop.jsx` (tabs: Overview, Orders, Needs attention, Products, Carts, Customers, Refunds — `?tab=`), `pages/AdminShopOrder.jsx` (detail + actions: retry sync, resolve review, cancel, refund, approve/retry/mark-paid, manual refund + timeline), `pages/AdminShopCustomer.jsx` (cart, checkouts, journey timeline), `components/shopAdmin/ShopAdminUI.jsx`, `services/api.js → shopAdminService`, routes in `PrivateApp.jsx`, menu "Shop" in `Layout.jsx`. Revenue chart: single series, `#2563eb` validated (dataviz validator), hover tooltip + "Show as table".

**Web build:** ✅ `npx vite build` pass (2026-11-16, `npm ci` ke baad — pehle is laptop ka `client/node_modules` adhoora tha). AdminShop / AdminShopOrder / AdminShopCustomer alag lazy chunks. Local pe chala ke dekha; bug mila + fix (`bebdb20`): Layout ka `<main>` flex column hai, root div pe `w-full` nahi tha → Overview chhod ke baaki tabs content jitne narrow dikhte the. Naye admin pages pe hamesha root `w-full` rakhna.

**Tests:** `tests/shopAdmin.test.js` (14) — data real routes se (4 shoppers: delivered, COD, abandoned, cancel+refund): event log, 401/403, overview numbers, list filters/search/paging, detail timeline, attention + retry/resolve, products held/sold, carts abandoned, customers + journey, refunds. Event order tie-break (createdAt + _id) bug isi se mila.

## 11. Fastrr — docs facts + kya lena hai

**Docs:** Postman "SRC Custom Integration" — https://documenter.getpostman.com/view/25617008/2sB34bL3ig
- Staging base: `fastrr-api-dev.pickrr.com` · Prod: `checkout-api.shiprocket.com`
- Catalog pull APIs (humne banaye) + catalog push webhooks (`/wh/v1/custom/product`, `/collection`)
- Access token API supports `catalog_data` (price override), `cart_discount`, `mobile_app`
- Order webhook unsigned, fields: `order_id`=`platform_order_id`, `fastrr_order_id`, `payment_type`, `payment_status`, `rto_prediction`, `total_amount_payable`, `subtotal_price`, `cod_charges`
- Order Details / Order List / Refund Initiate / Refund Report APIs
- Pricing public nahi (~2%/order third-party claim, unverified; fixed plan ₹699 se mention)

**Doc conformance check (2026-11-16, catalog re-check 2026-11-17):** Saare APIs Postman doc se field-by-field match kiye (staging data pe).
- Catalog response doc jaisa hai: `{ data: { total, products[] } }` / `{ data: { total, collections[] } }`. Product aur variant ki `id` number (long) hai, `options[{name, values[]}]` aur `option_values{}` dono hain.
- Image hamesha object jaati hai. Order: apni image → product image → `SHOP_PLACEHOLDER_IMAGE_URL` (**ye env set karna hai**, warna collection image `null` jaayegi).
- `compare_at_price` hamesha string. MRP nahi ho, ya price se kam ho, toh price hi bhejte hain.
- Dates offset ke saath, seconds tak: `2026-08-29T13:41:51+05:30` (IST).
- Shopify collection ka `created_at` nahi deta, isliye wahan hamare DB ki date jaati hai.
- Razorpay `pg_transaction_id` `order_…` → `razorpayOrderId`. Order webhook pe galat `order_id` aaye toh bhi 200 (`received:false`).
- `weight_unit` "kg" + `grams` rakha (Shopify ki valid unit; doc ka "lb" sirf example hai).
- Fastrr se confirm: Refund Report `from`/`to` (doc text `start_date`/`end_date` bolta hai, example `from`/`to`; hum example follow karte hain), aur `fallbackUrl`.

**Staging backend (Fastrr ko pehle yahi dena):** `https://ai-healthcare-1-0i51.onrender.com`. Is pe `USE_STAGING_DB=true`, `FASTRR_BASE_URL=https://fastrr-api-dev.pickrr.com` aur staging key/secret hone chahiye.

**CSP fix (2026-11-16):** `vercel.json` ki site-wide CSP `/api/shop/checkout/*` pe bhi lag rahi thi aur Fastrr ki script (checkout-ui.shiprocket.com) block kar rahi thi. Ab ye path site CSP se bahar hai; wahan sirf `nosniff`, `X-Frame-Options: DENY`, `no-referrer` lagte hain.

**Hum unhe denge:**
- Catalog: `https://www.take.health/api/shop/fastrr/products`, `/fastrr/collections`, `/fastrr/collection-products?collection_id={id}`
- Webhook (M2): `https://www.take.health/api/shop/fastrr/webhook`
- Domain whitelist: `www.take.health`

**Unse lena (Monday 2026-11-17, top priority):**
1. Staging + prod API key/secret
2. Staging test UPI / card details (refund test ke liye bhi)
3. ~~Fastrr khud Shopify order banata hai ya nahi~~ → **Nahi, hum banayenge** (17 Nov clear hua) → `SHOP_SHOPIFY_ORDER_SYNC=true`. Bas likhit mein confirm le lo ki wo apni taraf se Shopify order nahi banayenge.
4. Refund: partial chalta hai? `order_id` = platform ya fastrr id? kitne din?
5. Webhook URL + catalog URLs + domain whitelist unke system mein
6. Phone se saved address auto-fill hota hai?
7. `fallbackUrl` off ho sakta hai?, paisa kiske account + settlement, auto Shiprocket shipment (double shipment risk)
8. UPI intent links ke exact schemes (Flutter WebView ke liye)
Poori WhatsApp list (29 Qs with "Why") + call list (17 Qs) chat mein di gayi thi — inke **jawab yahan section 13 mein paste karo**.

---

## 12. Env vars (shop)
| Var | Where | Note |
|---|---|---|
| `SHOPIFY_ADMIN_STORE_DOMAIN` | Vercel + Render + local | `2jfdfm-vp.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | same | `shpat_…`. Scopes: `read_products`, `read_inventory`, `read_locations`, `read_orders`, `read_all_orders`, `write_orders`, `read_fulfillments` |
| `SHOPIFY_API_VERSION` | optional | default `2026-10` |
| `SHOPIFY_CLIENT_SECRET` | same | `shpss_…` → webhook HMAC (webhooks script/app se bane hain) |
| `SHOPIFY_WEBHOOK_SECRET` | **mat set karo** | Sirf admin "Notifications" page se bane webhooks ke liye. Set hua toh `CLIENT_SECRET` se pehle use hota hai → galat value = har webhook 401 |
| `SHOP_MAX_QTY_PER_ITEM`, `SHOP_MAX_CART_LINES` | optional | 10 / 30 |
| `FASTRR_BASE_URL`, `FASTRR_API_KEY`, `FASTRR_API_SECRET` | M2 | from Fastrr |
| `QSTASH_*` | already set | catalog schedule + crons |
| `SHOP_PUBLIC_BASE_URL` | Vercel + Render | `https://www.take.health` — checkout page / Fastrr redirect links |
| `SHOP_APP_DEEP_LINK` | optional | default `takehealth://shop/order/{orderId}?status={status}` (Flutter team se confirm) |
| `SHOP_HIDE_SUBSCRIBE_VARIANTS` | optional | default `true` |
| `SHOP_CHECKOUT_PAGE_SECRET`, `SHOP_CHECKOUT_PAGE_TTL_MIN` | optional | default: JWT_SECRET se derive, 120 min |
| `SHOP_PLACEHOLDER_IMAGE_URL` | optional | Fastrr `catalog_data.image_url` jab item ki image na ho |
| `FASTRR_TIMEOUT_MS`, `FASTRR_CHECKOUT_UI_URL`, `FASTRR_FALLBACK_URL`, `FASTRR_CATALOG_PUSH` | optional | 10000 / auto (staging bundle for staging API) / humara return page / true |
| `SHOP_SHOPIFY_ORDER_SYNC` | Vercel + Render | default `false` (code) → **go-live pe `true` set karo** (custom flow mein Shopify order hum banate hain, 17 Nov confirm). `write_orders` scope chahiye |
| `SHOP_SHOPIFY_TEST_ORDERS`, `SHOP_SHOPIFY_SEND_RECEIPT` | optional | `false` / `false` — test orders sirf live-store testing ke waqt `true` |
| `SHOP_SHOPIFY_SYNC_MAX_ATTEMPTS` | optional | 5 |
| `SHOP_APP_ORDERS_CARD_OFFER` | optional | `true` (management decision) |
| `SHOP_ORDER_PUSH` | optional | `true` (confirmed / shipped / delivered / cancelled push) |
| `SHOP_RESERVATION_MINUTES` | optional | 15 (stock hold, phir token expiry se bandha) |
| `SHOP_USER_CANCEL` | optional | `true` — customer ship hone tak cancel kar sakta hai (MG1) |
| `SHOP_AUTO_REFUND`, `SHOP_AUTO_REFUND_MAX_RUPEES` | optional | `false` / 2000 — off = har refund admin approve kare (MG6) |
| `SHOP_SHOPIFY_RECORD_REFUNDS` | optional | `true` — completed refund Shopify order pe record |
| `SHOPIFY_ADMIN_API_BASE_URL` | **tests / local only** | Shopify mock URL. Real environments mein **kabhi set mat karna** |

---

## 13. Fastrr / Shopify dev ke jawab (yahan paste karo)

- **2026-11-17 (Fastrr call):** Postman "SRC Custom Integration" doc hi follow karna hai. Product/catalog response usi format mein chahiye. Hamare APIs pehle se match karte hain. 16 Nov wala "Fastrr Shopify order banayega / Shopify WebView checkout" galatfehmi thi.

---

## 14. Go-live plan (target: Monday 17 Nov prep → Tuesday 18 Nov main pe test + live)

**Status (2026-11-16):** M1–M4 + shop admin code done, 189 tests (188 pass, 1 = purana card-offer test), staging DB E2E 48/48, web build pass, sab pushed. **Fastrr ke saath ek bhi real test abhi tak nahi hua** — sabse bada risk. External list: **`docs/shop-launch-requirements.md`** (Word copy: Desktop `TakeHealth-Shop-Launch-Requirements.docx`) — Fastrr 12, Shopify dev 7, management 8, ops 5, Flutter 5 items; kya, kyu, kaun dega.

### A. Go-live blockers (inke bina live NAHI)
| # | Kya | Owner |
|---|---|---|
| 1 | Fastrr staging + prod keys; **real payment test** (UPI + COD) | Fastrr / aap |
| 2 | Fastrr confirm: khud Shopify order nahi banata | Fastrr |
| 3 | Fastrr ko webhook URL, catalog URLs, domain whitelist | Aap |
| 4 | **Flutter app ready** (6 screens + WebView container, UPI intents, deep link) + store review time | Flutter team |
| 5 | Shopify token: `write_orders` + protected customer data + `read_inventory` | Shopify dev |
| 6 | Refund/return policy page + privacy policy update | Management |
| 7 | GST invoice system confirm (website orders ka jo hai wahi) + Shopify products pe HSN/GST rate | Ops / Shopify dev |
| 8 | **Render kis DB pe hai** (staging ya prod?) — Render dashboard → Environment (`USE_STAGING_DB`, `MONGODB_URI*`). Flutter dev wahi URL testing ke liye use karega | Aap |

### B. Monday (code side)
- ~~M4~~ ✅ done (2026-11-16): cancel + refunds, flags safe defaults.
- ~~Shop admin~~ ✅ done (2026-11-16): APIs + `/admin/shop` pages (§10b). Launch ke din ops yahin se: refund approve, Shopify sync retry, review resolve, stuck orders.
- Management decisions aate hi sirf env: `SHOP_USER_CANCEL`, `SHOP_AUTO_REFUND`, `SHOP_AUTO_REFUND_MAX_RUPEES`, `SHOP_APP_ORDERS_CARD_OFFER`.
- Local `server/.env` mein Fastrr placeholder block add hai (`FASTRR_API_KEY=` / `FASTRR_API_SECRET=` khaali) — Monday ko staging keys wahin bharni hain + Render env.
- Fastrr keys aate hi: `scripts/shopStagingE2E.js` real Fastrr staging ke saath + phone pe UPI test.
- Launch ke pehle din refunds **manual (Fastrr dashboard)** — orders kam honge, safe.

### C. Tuesday deploy order
1. `Staging` → `main` merge + push
2. Env vars **Vercel + Render dono**: Fastrr keys, `SHOP_PUBLIC_BASE_URL=https://www.take.health`, `SHOP_SHOPIFY_ORDER_SYNC=true` (sirf agar Fastrr ne #2 confirm kiya), `SHOP_SHOPIFY_TEST_ORDERS=true` (sirf test ke liye)
3. Deploy → prod pe `node scripts/shopCatalogSync.js` (indexes **including stock-hold TTL/unique** + catalog; prod `autoIndex` off hai, isliye zaroori)
4. `node scripts/registerShopifyWebhooks.js --url=https://www.take.health --dry-run` → apply (**sirf ek URL**)
5. `node scripts/registerShopCatalogSchedule.js https://www.take.health` (catalog 03:30 IST + reconciliation */10)
6. Live test: ops ko pehle batao → 1 prepaid + 1 COD → Shopify admin check (price, address/MH, phone, stock) → cancel + restock
7. Sab theek → `SHOP_SHOPIFY_TEST_ORDERS=false` → launch

**Rollback:** `SHOP_SHOPIFY_ORDER_SYNC=false` (Shopify order banna band). Checkout band karna ho → Fastrr keys hatao → `POST /checkout` = 503 `CHECKOUT_UNAVAILABLE`; catalog + cart chalte rahenge.

### D. Post-launch (non-blocking)
Auto-refund + user cancel + returns/RTO (baaki M4), Shopify weights (shipping accuracy) + descriptions, abandoned cart, Swagger docs for shop APIs, Shopify token least-privilege app, "Download invoice" link in app.

### E. Flutter handoff
- Guide: **`docs/shop-flutter-api-guide.md`** (Word copy desktop pe `TakeHealth-Shop-API-for-Flutter.docx`). Real responses (journey test se), 6 screens + WebView container, Idempotency-Key flow, WebView/UPI/deep link, polling, statuses, 24 error codes, push.
- Testing base URL: `https://ai-healthcare-1-0i51.onrender.com/api/shop` (Staging auto-deploy; checkout = 503 jab tak Render pe Fastrr keys nahi).

### F. Known pre-existing test failures (shop se unrelated)
- `shopifyOfferRules.test.js` — card-offer, date-dependent. Ab 2 tests fail hote hain: "Rahul" (16 Nov se) aur "B, redeemed a few days after joining" (17 Nov se). 1 Dec se rule D wala bhi fail hoga. Ye card-offer owner ka kaam hai. Scenario, root cause (`isEntitled` asli ghadi use karta hai, test ka `now` nahi) aur fix: **`docs/card-offer-rahul-test-failure.md`**
- `vault.test.js` 4 fail (storage config defaults) — pre-existing
- `wearableScoreDedup.staging.test.js` staging DB connect pe hang → `npm test` poora khatam nahi hota; shop tests alag se chalao (§0)

### G. Repo risks mile (shop se unrelated, fix nahi kiye)
- **`server/scripts/promoteAdmin.js` hamesha `MONGODB_URI` (PRODUCTION) se connect karta hai** — `USE_STAGING_DB` ignore. Staging ke liye chalaya toh prod mein admin bana dega. Fix: baaki scripts jaisa `USE_STAGING_DB ? MONGODB_URI_STAGING : MONGODB_URI`.
- Local server (`node server.js`) Vercel ke bahar saare crons + har-minute notification job chalata hai → local testing pe §0a wala cron-off wrapper use karo.
