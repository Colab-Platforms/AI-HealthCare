# Headless Shop (Shopify + Fastrr) — Master Plan & Status

> **Single source of truth for the in-app shop.** Kisi bhi laptop se kaam shuru karo toh pehle ye file padho.
> Purani files `fastrr-shiprocket-checkout-integration-plan.md` aur `fastrr-integration-reference-and-test-plan.md` OUTDATED hain (wo purane `fastrrRoutes.js` ke liye thi, jo delete ho chuka hai).
>
> Last updated: 2026-11-14 · Branch: `Staging`

---

## 0. Naye laptop pe kaise resume karein

1. `git pull` (Staging branch) — M1 code + ye doc aa jayega.
2. `cd server && npm install`
3. `server/.env` git mein NAHI hota. Office laptop se ye values copy karo (password manager / secure chat se, public jagah nahi):
   `MONGODB_URI`, `MONGODB_URI_STAGING`, `JWT_SECRET`, `SHOPIFY_ADMIN_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_CLIENT_SECRET` / `SHOPIFY_WEBHOOK_SECRET`, Redis, QStash (`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`), aur baaki jo office `.env` mein hai.
4. Check: `node scripts/shopCatalogSync.js --preview` (sirf read, DB nahi chhoota) aur `node --test tests/shopCatalog.test.js tests/shopCartAndOrder.test.js`.
5. Claude ko bolo: **"docs/shop-headless-plan.md padho aur wahan se continue karo"**. Claude ki memory laptop-specific hai, isliye saara context isi file mein hai.

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
| Subscribe variants | **Pending decision** — recommendation (a): app mein chhupao + checkout pe reject (env flag `SHOP_HIDE_SUBSCRIBE_VARIANTS`). Dekho §8 |

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
| **M2** | Fastrr checkout: client, checkout start, WebView page, webhook + fetch-back, order status API, reconciliation cron, catalog push | ⏳ Next. 80% bina Fastrr keys ke ban sakta hai |
| **M3** | Shopify order create (QStash, idempotent via tag lookup), fulfilment/refund/paid webhooks, My Orders APIs, FCM notifications | ⏳ Needs Shopify token with `write_orders` + protected customer data access |
| **M4** | Refunds (Fastrr Refund API + Refund Report cron), admin view, alerts | ⏳ |

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
| `registerShopifyWebhooks.js --url=https://www.take.health [--dry-run]` | Shopify webhooks register (order + catalog topics) | **Prod deploy ke baad**, sirf ek URL |
| `registerShopCatalogSchedule.js https://www.take.health` | QStash daily 03:30 IST full sync | **Prod deploy ke baad** |

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
| 1 | **Code commit/push nahi hua tha** (2026-11-14 tak) | Commit + push (see §12) |
| 2 | Prod deploy + prod sync + webhooks register + QStash schedule | Deploy ke baad scripts (§4 Scripts) |
| 3 | **Subscribe variants** filter (decision pending) | §8 — decision ke baad `SHOP_HIDE_SUBSCRIBE_VARIANTS` flag: list/detail/cart/checkout/Fastrr feed se hatao, `minPrice` recalc |
| 4 | **Product weight 0** saare variants pe → Fastrr shipping galat | Shopify dev weights daale |
| 5 | **`descriptionHtml` khaali** | Shopify dev se poochho description kahan hai (metafields/theme) → query mein add |
| 6 | **HSN code / GST rate** product pe nahi hai (Order items mein field hai, source nahi) | Shopify metafield ya config map decide karo — invoice/M3 se pehle |
| 7 | `.env.example` mein Fastrr block ka comment purana (`/shiprocket/products`, `/api/checkout/start`) | M2 mein update |
| 8 | Fastrr collections/collection-products, price-change, out-of-stock paths E2E test nahi | M2 testing ke saath |
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
2. **Flutter deep link** (payment ke baad app pe wapas) — e.g. `takehealth://shop/order/:id`. Env placeholder rakhenge.
3. **Management (END mein poochna):**
   - App orders pe card-offer 30-day trial trigger ho ya `take-app` tag wale orders exclude?
   - COD max limit + COD fee
   - Refund/return policy

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

Jo cheezein Fastrr ke jawab pe depend hain (token validity, `fallbackUrl`, own order id, webhook signing/IP) → env/config mein rakhni hain taaki jawab aane pe sirf value badle.

**Known risk:** Fastrr ka `fallbackUrl` "native checkout" (Shopify website) ho sakta hai → no-redirect rule se conflict. Fastrr se confirm karna hai.

---

## 10. M3 / M4 (outline)
- **M3:** QStash job → Shopify `orderCreate` (tags `take-app`, `TH-xxx`; pehle tag se search karke duplicate avoid), retry + `needs_attention`. Webhooks `orders/fulfilled`, `fulfillments/*`, `orders/cancelled`, `refunds/create` → fulfillmentStatus/tracking. My Orders APIs. FCM push. Token scopes: `write_orders`, protected customer data.
  - **Check:** Fastrr ka Shopify app agar store pe installed hai toh wo khud order bana sakta hai → duplicate. Fastrr call Q2.
- **M4:** Fastrr Refund Initiate API + Refund Report cron → `refunds[]`, admin view, alerts (sync failed, stuck pending).

---

## 11. Fastrr — docs facts + kya lena hai

**Docs:** Postman "SRC Custom Integration" — https://documenter.getpostman.com/view/25617008/2sB34bL3ig
- Staging base: `fastrr-api-dev.pickrr.com` · Prod: `checkout-api.shiprocket.com`
- Catalog pull APIs (humne banaye) + catalog push webhooks (`/wh/v1/custom/product`, `/collection`)
- Access token API supports `catalog_data` (price override), `cart_discount`, `mobile_app`
- Order webhook unsigned, fields: `order_id`=`platform_order_id`, `fastrr_order_id`, `payment_type`, `payment_status`, `rto_prediction`, `total_amount_payable`, `subtotal_price`, `cod_charges`
- Order Details / Order List / Refund Initiate / Refund Report APIs
- Pricing public nahi (~2%/order third-party claim, unverified; fixed plan ₹699 se mention)

**Hum unhe denge:**
- Catalog: `https://www.take.health/api/shop/fastrr/products`, `/fastrr/collections`, `/fastrr/collection-products?collection_id={id}`
- Webhook (M2): `https://www.take.health/api/shop/fastrr/webhook`
- Domain whitelist: `www.take.health`

**Unse lena (top priority):** staging key+secret, `fallbackUrl` off ho sakta hai?, paisa kiske account + settlement, auto Shiprocket shipment / Shopify order create (double shipment/order risk), apna order id bhej sakte hain?
Poori WhatsApp list (29 Qs with "Why") + call list (17 Qs) chat mein di gayi thi — inke **jawab yahan section 13 mein paste karo**.

---

## 12. Env vars (shop)
| Var | Where | Note |
|---|---|---|
| `SHOPIFY_ADMIN_STORE_DOMAIN` | Vercel + Render + local | `2jfdfm-vp.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | same | scopes: `read_products`, `read_inventory`, `read_orders` (+ M3: `write_orders`) |
| `SHOPIFY_API_VERSION` | optional | default `2026-10` |
| `SHOPIFY_CLIENT_SECRET` / `SHOPIFY_WEBHOOK_SECRET` | same | webhook HMAC |
| `SHOP_MAX_QTY_PER_ITEM`, `SHOP_MAX_CART_LINES` | optional | 10 / 30 |
| `FASTRR_BASE_URL`, `FASTRR_API_KEY`, `FASTRR_API_SECRET` | M2 | from Fastrr |
| `QSTASH_*` | already set | catalog schedule + crons |
| (M2) `SHOP_APP_DEEP_LINK`, `SHOP_HIDE_SUBSCRIBE_VARIANTS` | M2 | planned |

---

## 13. Fastrr / Shopify dev ke jawab (yahan paste karo)

_(empty)_
