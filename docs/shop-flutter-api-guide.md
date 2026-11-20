# take.health Shop — API & Integration Guide for the Flutter App

**For:** Flutter developer building the in-app shop
**Backend status:** Catalog, cart, checkout (Fastrr), orders, Shopify order creation, shipping updates, order cancel and refunds are all built. The full COD journey (checkout → Fastrr page → order placed → Shopify order → cancel) was **tested end-to-end on production on 20 Nov 2026**. Returns / exchanges are not built yet (see §12).
**Last updated:** 20 Nov 2026 (replaces the 15 Nov PDF)

All response examples below are **real responses** from the production backend. The only change is that the shipping address in the order examples is replaced with sample data.

---

## What changed since the 15 Nov PDF

- **Checkout is live on production.** Fastrr production keys are working. Test checkout on the **production** base URL (see §1). The testing server still has no Fastrr keys.
- **Cancel order is now available.** New API `POST /orders/:orderId/cancel` (§4.8). Order detail has 3 new fields: `canCancel`, `cancelledAt`, `refund` (§4.7).
- **New pushes:** `refund_initiated` and `refunded` (§10).
- **New error codes:** `CANCEL_NOT_ALLOWED`, `CANCEL_IN_PROGRESS`, `CANCEL_DISABLED`, `SHOPIFY_CANCEL_FAILED` (§9).
- **New statuses** are now reachable: `cancelled`, `refund_initiated`, `refunded` (§8).
- **Real examples** replace the old sample ones. Note: real variant option names come from Shopify as-is, e.g. `"Packs"` and `"subscription"` (not `"Pack"` / `"Purchase"`). Read option names from the response; never hard-code them.
- **Rate limits:** a 429 on a read (GET) request has no `code` field. Handle any HTTP 429 as "rate limited" (§1).
- **`STOCK_UNAVAILABLE`** now also returns `variantId` and `availableQty` (§9).
- **COD orders currently show `shipping: 0` and `codCharges: 0`.** COD fee and shipping charges are not set yet. The app must still show whatever comes back in `pricing`.
- **Shop screen 7 (Order detail)** now has a **Cancel order** button (§2).

---

## Contents

1. Basics (base URL, auth, money, errors)
2. Screens to build
3. Amish's journey — every API call in order
4. API reference
5. Idempotency-Key — who creates it and how it works
6. Payment WebView — exactly what the app must do
7. After payment — polling the order
8. Order statuses (what to show)
9. Error codes — what the app should do
10. Push notifications
11. Flutter checklist
12. Not available yet

---

## 1. Basics

| Item | Details |
|---|---|
| **Base URL (production)** | `https://www.take.health/api/shop` |
| **Base URL (testing)** | `https://ai-healthcare-1-0i51.onrender.com/api/shop` runs the `Staging` branch. Catalog, cart and orders work. **Checkout does not work here** (Fastrr gave production keys only). To test checkout and payment, use the production URL. Until launch, orders from the app are marked as **test orders** in Shopify and are not shipped. Tell the backend team before placing a test order. |
| **Auth** | Same as the rest of the app: `Authorization: Bearer <accessToken>`. Catalog APIs are public. Cart, checkout and orders need login. |
| **Content type** | `application/json` |
| **Dates** | ISO 8601, UTC (`"2026-11-20T12:48:30.383Z"`) |
| **IDs** | All ids are **strings** (`"57199514222897"`). Never parse them as numbers. |

### Money

Every amount is an object:

```json
{ "paise": 149900, "rupees": 1499 }
```

- Use **`paise` (integer)** for any logic or comparison.
- Use **`rupees`** only for display, e.g. `₹1,499` or `₹1,499.00`.
- The app **never sends a price** to the backend. The backend always uses its own price.

### Errors

Every shop error has the same shape (HTTP status 4xx/5xx):

```json
{ "code": "INSUFFICIENT_STOCK", "message": "Only 1 left in stock", "availableQty": 1 }
```

- Switch on **`code`**, not on `message`.
- `message` is user-readable. Show it as-is if you have nothing better.
- Some errors carry extra fields (`availableQty`, `maxQty`, `cart`, `orderId`, `retryAfterMs`, …). They are listed in §9.
- Exception: **401** comes from the app's normal auth middleware: `{ "message": "Not authorized, no token" }`. Handle it like every other 401 in the app (refresh token / login).

### Rate limits (per user)

| Requests | Limit | 429 body |
|---|---|---|
| Cart writes (POST / PATCH / DELETE) | 60 per minute | `{ "code": "RATE_LIMITED", "message": "Too many requests. Please slow down." }` |
| `POST /checkout` | 20 per minute | `{ "code": "RATE_LIMITED", "message": "Too many requests. Please slow down." }` |
| Reads (GET) | 200 per minute | `{ "success": false, "message": "Too many requests. Please slow down." }` (no `code`) |

Handle **any HTTP 429** as "rate limited": wait a few seconds, then retry. A normal user never hits these limits. They protect against retry loops.

---

## 2. Screens to build

**6 designed screens + 1 WebView container** + 2 app-level handlers.

> **The checkout / payment page itself is NOT built in Flutter.** Address form, phone OTP, coupon, payment-method choice and payment all happen on **Fastrr's page**. Flutter only builds screen 4 as a thin **WebView container**: a top bar with ✕, open `checkoutPageUrl`, open UPI apps, close when payment finishes (§6). No checkout UI design is needed.

| # | Screen | APIs used |
|---|---|---|
| 1 | **Shop home**: sections (Featured etc.), product grid, search | `GET /collections`, `GET /products?collection=…`, `GET /products?q=…` |
| 2 | **Product detail**: images, variant picker, price + MRP, stock, description, qty, "Add to cart" | `GET /products/:handle`, `POST /cart/items` |
| 3 | **Cart**: lines, qty stepper, remove, problem banners, subtotal, "Checkout" | `GET /cart`, `PATCH /cart/items/:variantId`, `DELETE /cart/items/:variantId`, `POST /checkout` |
| 4 | **Payment (WebView container only)**: shows Fastrr's own checkout page. Flutter adds only the top bar + ✕ and the URL handling | opens `checkoutPageUrl` (§6) |
| 5 | **Order result**: "Checking payment…" → success / failed / expired | `GET /orders/:orderId` (polling, §7) |
| 6 | **My Orders**: list of placed orders | `GET /orders` |
| 7 | **Order detail**: items, price breakdown, address, status, tracking, refund info, **Cancel order** button (only when `canCancel` is true) | `GET /orders/:orderId`, `POST /orders/:orderId/cancel` |

App-level:
- **Cart badge** (icon in app bar) = `summary.itemCount` from any cart response.
- **Deep link + push handling** for `takehealth://shop/order/{orderId}` and `type: shop_order` pushes (§6, §10).

**Not in the app:** address form, payment method screen, coupon screen. All of these are on Fastrr's page inside the WebView.

---

## 3. Amish's journey — every API call in order

Amish opens the shop, buys Liposomal Berberine HCL (1 pack × 1) with COD, and later cancels it.

| Step | Amish does | App calls | Result |
|---|---|---|---|
| 1 | Opens Shop tab | `GET /collections` + `GET /products?collection=frontpage` + `GET /products` | Sections + grid |
| 2 | Searches "berb" | `GET /products?q=berb` | Liposomal Berberine HCL |
| 3 | Taps the product | `GET /products/liposomal-berberine-hcl-capsules` | Detail with 3 variants (1, 2, 3 pack) |
| 4 | Picks "1 pack", qty 1, "Add to cart" | `POST /cart/items` `{ "variantId": "57199514222897", "quantity": 1 }` | Full cart, badge = 1 |
| 5 | Opens cart | `GET /cart` | Lines + subtotal ₹1,499, `checkoutAllowed: true` |
| 6 | Changes qty / removes an item | `PATCH /cart/items/:variantId` / `DELETE /cart/items/:variantId` | Full cart |
| 7 | Taps **Checkout** | App creates an Idempotency-Key (§5) → `POST /checkout` | `orderId`, `checkoutPageUrl` |
| 8 | Payment page opens | WebView loads `checkoutPageUrl` | Fastrr page: Amish enters phone (OTP) and address, picks COD |
| 9 | Fastrr finishes | WebView navigates to `…/checkout/{orderId}/return` → `takehealth://shop/order/{orderId}?status=…` | App closes the WebView and opens the Order result screen |
| 10 | "Checking payment…" | `GET /orders/:orderId` every 3 s until status ≠ `awaiting_payment` | `confirmed` → success screen. The backend has already emptied the cart |
| 11 | Push: "Order confirmed" | (FCM) | Tap → Order detail |
| 12 | Opens My Orders | `GET /orders` | His order, `confirmed` |
| 13 | Taps **Cancel order** | `POST /orders/:orderId/cancel` | `cancelled` (COD: nothing to refund) |
| 14 | Push: "Order cancelled" | (FCM) | Order detail shows `cancelled` |

If he had not cancelled: push "Your order is on the way" → Order detail shows `shipped` + tracking → push "Order delivered" → status `delivered`.

---

## 4. API reference

### 4.1 `GET /products` — product list (public)

Query params (all optional):

| Param | Meaning |
|---|---|
| `limit` | 1–50, default 20 |
| `cursor` | `nextCursor` from the previous page |
| `q` | Search by title (max 100 chars) |
| `collection` | Collection `handle` (e.g. `frontpage`) or id |

Response `200` (real, production):

```json
{
  "items": [
    {
      "id": "10790037291313",
      "handle": "liposomal-berberine-hcl-capsules",
      "title": "Liposomal Berberine HCL",
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210",
      "minPrice": { "paise": 149900, "rupees": 1499 },
      "inStock": true
    }
  ],
  "nextCursor": null
}
```

- **Pagination:** if `nextCursor` is not null, call again with `?cursor=<nextCursor>` and keep the same `q` / `collection`. `null` = last page.
- `minPrice` → show "From ₹1,499". It can be `null` if nothing is sellable (show "Unavailable").
- `imageUrl` can be `null` → show a placeholder.
- Unknown collection or no search match → `200` with `"items": []`.
- Errors: `400 INVALID_CURSOR` → `{ "code": "INVALID_CURSOR", "message": "Invalid cursor" }`.

### 4.2 `GET /products/:handle` — product detail (public)

`:handle` is the product's `handle` (or its `id`).

Response `200` (real, production; description and image list shortened):

```json
{
  "id": "10790037291313",
  "handle": "liposomal-berberine-hcl-capsules",
  "title": "Liposomal Berberine HCL",
  "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210",
  "minPrice": { "paise": 149900, "rupees": 1499 },
  "inStock": true,
  "descriptionHtml": "<h3>A Clinically Studied Compound for Metabolic Health</h3><p>Take Berberine Capsules bring together …</p>",
  "vendor": "Take Limited",
  "productType": "Nutraceuticals",
  "tags": ["capsules"],
  "images": [
    { "url": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210", "alt": "TAKE Liposomal Berberine HCl 1000 mg capsule bottle …" },
    { "url": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/berberine_pdp_6.webp?v=1794546264", "alt": "TAKE Liposomal Berberine HCl bottle beside berberine fruit …" }
  ],
  "collections": [
    { "id": "535322886449", "handle": "frontpage", "title": "Home page" },
    { "id": "537252692273", "handle": "all-take-products", "title": "all take products" }
  ],
  "variants": [
    {
      "id": "57199514222897",
      "title": "1 pack / One-Time Purchase",
      "sku": "LBHCLOT1",
      "price": { "paise": 149900, "rupees": 1499 },
      "compareAtPrice": { "paise": 189900, "rupees": 1899 },
      "inStock": true,
      "options": [
        { "name": "Packs", "value": "1 pack" },
        { "name": "subscription", "value": "One-Time Purchase" }
      ],
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210"
    },
    {
      "id": "57199514255665",
      "title": "2 pack / One-Time Purchase",
      "sku": "LBHCLOT2",
      "price": { "paise": 299800, "rupees": 2998 },
      "compareAtPrice": { "paise": 379800, "rupees": 3798 },
      "inStock": true,
      "options": [
        { "name": "Packs", "value": "2 pack" },
        { "name": "subscription", "value": "One-Time Purchase" }
      ],
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210"
    },
    {
      "id": "57199514288433",
      "title": "3 pack / One-Time Purchase",
      "sku": "LBHCLOT3",
      "price": { "paise": 449700, "rupees": 4497 },
      "compareAtPrice": { "paise": 569700, "rupees": 5697 },
      "inStock": true,
      "options": [
        { "name": "Packs", "value": "3 pack" },
        { "name": "subscription", "value": "One-Time Purchase" }
      ],
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210"
    }
  ]
}
```

- **Variant picker:** build option chips from `variants[].options`, grouped by `name`. The selected combination = one variant. Its `id` goes into the cart.
- Option names come from Shopify as-is (`"Packs"`, `"subscription"`). Show them as they come, or hide an option group when it has only one value (here `subscription` is always "One-Time Purchase").
- `compareAtPrice` (MRP): show a strike-through only when it is not `null`.
- `inStock: false` → disable "Add to cart" for that variant.
- `descriptionHtml` is HTML → render it with an HTML widget. It can be empty.
- "Subscribe" variants are hidden by the backend. The app needs no special handling.
- Errors: `404 PRODUCT_NOT_FOUND` → `{ "code": "PRODUCT_NOT_FOUND", "message": "Product not found" }` (deleted / draft product, e.g. from an old shared link).

### 4.3 `GET /collections` — home sections (public)

Response `200` (real, production; descriptions shortened):

```json
{
  "items": [
    { "id": "535322886449", "handle": "frontpage", "title": "Home page", "descriptionHtml": "<p>Take Health supplements are made to fit into a daily routine …</p>", "imageUrl": null },
    { "id": "537252692273", "handle": "all-take-products", "title": "all take products", "descriptionHtml": "<p>Browse the full Take Health supplement range in one place …</p>", "imageUrl": null }
  ]
}
```

- `frontpage` = Shopify's "Home page" collection → use it for the **Featured** section.
- For each section: `GET /products?collection=<handle>&limit=10`.
- `descriptionHtml` is HTML and can be long. Show it only if the design has a place for it.
- The store team manages collections in Shopify. New sections appear without an app update.

### 4.4 Cart (login required)

**Every cart call (GET / POST / PATCH / DELETE) returns the full cart** in this shape. Re-render the screen from the response.

```json
{
  "lines": [
    {
      "variantId": "57199514222897",
      "productId": "10790037291313",
      "handle": "liposomal-berberine-hcl-capsules",
      "title": "Liposomal Berberine HCL",
      "variantTitle": "1 pack / One-Time Purchase",
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210",
      "quantity": 1,
      "unitPrice": { "paise": 149900, "rupees": 1499 },
      "lineTotal": { "paise": 149900, "rupees": 1499 },
      "priceChanged": false,
      "previousPrice": null,
      "availableQty": 20,
      "issue": null
    }
  ],
  "summary": {
    "itemCount": 1,
    "subtotal": { "paise": 149900, "rupees": 1499 },
    "hasIssues": false,
    "checkoutAllowed": true
  }
}
```

| Field | What the app does |
|---|---|
| `variantTitle` | Show under the product title. If it is `"Default Title"`, hide it. |
| `priceChanged: true` + `previousPrice` | Show a banner on that line: "Price changed from ₹1,499 to ₹1,599". It is reported **once**; the next GET returns `false`. |
| `availableQty` | Max for the qty stepper (also cap at 10). `null` = no stock limit. |
| `issue` | `null` = OK. `"OUT_OF_STOCK"`, `"INSUFFICIENT_STOCK"` (only `availableQty` left), `"UNAVAILABLE"` (product removed) → show a red message on the line and ask the user to fix it. |
| `summary.subtotal` | Before shipping, discounts and COD charge. Those are added on Fastrr's page. |
| `summary.checkoutAllowed` | Enable the **Checkout** button only when `true`. |
| `summary.itemCount` | Cart badge. |

Example — price changed:

```json
{
  "lines": [{
    "variantId": "57199514222897", "title": "Liposomal Berberine HCL", "variantTitle": "1 pack / One-Time Purchase", "quantity": 2,
    "unitPrice": { "paise": 159900, "rupees": 1599 },
    "lineTotal": { "paise": 319800, "rupees": 3198 },
    "priceChanged": true,
    "previousPrice": { "paise": 149900, "rupees": 1499 },
    "availableQty": 20, "issue": null
  }],
  "summary": { "itemCount": 2, "subtotal": { "paise": 319800, "rupees": 3198 }, "hasIssues": false, "checkoutAllowed": true }
}
```

| Call | Body | Notes |
|---|---|---|
| `GET /cart` | — | Empty cart → `lines: []`, `checkoutAllowed: false` |
| `POST /cart/items` | `{ "variantId": "57199514222897", "quantity": 1 }` | Adds to an existing line (2 + 1 = 3). `quantity` 1–10, default 1. |
| `PATCH /cart/items/:variantId` | `{ "quantity": 3 }` | Sets the quantity. `0` removes the line. |
| `DELETE /cart/items/:variantId` | — | Removes the line. Safe to call twice (still `200`). |
| `DELETE /cart` | — | Empties the cart. |

Cart errors:

| HTTP | `code` | When | Extra fields |
|---|---|---|---|
| 400 | `INVALID_QUANTITY` | qty not an integer / out of range | `maxQty` |
| 400 | `VARIANT_REQUIRED` | `variantId` missing | |
| 404 | `PRODUCT_UNAVAILABLE` | variant removed / hidden / draft | |
| 404 | `ITEM_NOT_IN_CART` | PATCH on a line that isn't in the cart | |
| 409 | `MAX_QTY_REACHED` | line would go above 10 | `maxQty` |
| 409 | `OUT_OF_STOCK` | nothing left | |
| 409 | `INSUFFICIENT_STOCK` | fewer left than asked | `availableQty` |
| 409 | `CART_FULL` | more than 30 different items | `maxLines` |

### 4.5 `POST /checkout` — start payment (login required)

**Headers:** `Authorization: Bearer …` and **`Idempotency-Key: <uuid>`** (see §5).
**Body:** none. The backend checks out the user's server cart. The app does not send items or prices.

Response `200` (real, production, 20 Nov):

```json
{
  "orderId": "TH-261120-ZWE98AT1",
  "status": "awaiting_payment",
  "amount": { "paise": 149900, "rupees": 1499 },
  "itemCount": 1,
  "checkoutPageUrl": "https://www.take.health/api/shop/checkout/TH-261120-ZWE98AT1/page?exp=1795186112&sig=KFz4hckTd_r2ajwa-TTEAqK7MnT7RFY0t-PCINE2zkM",
  "expiresAt": "2026-11-20T13:13:32.303Z"
}
```

- Open `checkoutPageUrl` **as-is** in the WebView (§6). Don't modify it; it is signed.
- `orderId`: keep it. You need it after payment.
- `amount` is the subtotal. The final total (shipping, COD charge, coupons) is decided on Fastrr's page and comes back in the order (§4.7).
- `expiresAt` is when this payment session ends (about 25 minutes). The page link itself stays valid for 2 hours and starts a fresh session by itself.

Checkout errors → see §9 (`CART_EMPTY`, `CART_HAS_ISSUES`, `PRICE_CHANGED`, `STOCK_UNAVAILABLE`, `IDEMPOTENCY_KEY_*`, `ORDER_ALREADY_PLACED`, `CHECKOUT_CLOSED`, `CHECKOUT_IN_PROGRESS`, `CHECKOUT_PROVIDER_ERROR`, `CHECKOUT_UNAVAILABLE`).

### 4.6 `GET /orders` — My Orders (login required)

Query: `limit` (1–50, default 20), `cursor`.
Only **placed** orders are listed (paid or COD, and later states). Unpaid, failed and expired checkouts are not shown.

```json
{
  "items": [
    {
      "orderId": "TH-261120-ZWE98AT1",
      "status": "confirmed",
      "paymentMethod": "cod",
      "total": { "paise": 149900, "rupees": 1499 },
      "itemCount": 1,
      "firstItem": {
        "title": "Liposomal Berberine HCL",
        "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210"
      },
      "createdAt": "2026-11-20T12:48:30.383Z",
      "placedAt": "2026-11-20T12:51:02.319Z"
    }
  ],
  "nextCursor": null
}
```

List tile: `firstItem.imageUrl`, `firstItem.title`, "`itemCount` items", `total.rupees`, status chip (§8), `placedAt` date. Tap → Order detail.

### 4.7 `GET /orders/:orderId` — order detail / payment polling (login required)

COD order after it was placed (real, production, 20 Nov; address replaced with sample data):

```json
{
  "orderId": "TH-261120-ZWE98AT1",
  "status": "confirmed",
  "paymentMethod": "cod",
  "total": { "paise": 149900, "rupees": 1499 },
  "itemCount": 1,
  "firstItem": {
    "title": "Liposomal Berberine HCL",
    "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210"
  },
  "createdAt": "2026-11-20T12:48:30.383Z",
  "placedAt": "2026-11-20T12:51:02.319Z",
  "canCancel": true,
  "cancelledAt": null,
  "refund": null,
  "paymentStatus": "cod_pending",
  "fulfillmentStatus": "unfulfilled",
  "items": [
    {
      "variantId": "57199514222897",
      "productId": "10790037291313",
      "title": "Liposomal Berberine HCL",
      "variantTitle": "1 pack / One-Time Purchase",
      "imageUrl": "https://cdn.shopify.com/s/files/1/0999/4240/0305/files/Beyond_Ordinary_Berberine_pdp-1.webp?v=1794547210",
      "quantity": 1,
      "unitPrice": { "paise": 149900, "rupees": 1499 },
      "lineTotal": { "paise": 149900, "rupees": 1499 }
    }
  ],
  "pricing": {
    "subtotal": { "paise": 149900, "rupees": 1499 },
    "discount": { "paise": 0, "rupees": 0 },
    "shipping": { "paise": 0, "rupees": 0 },
    "codCharges": { "paise": 0, "rupees": 0 },
    "total": { "paise": 149900, "rupees": 1499 },
    "couponCodes": []
  },
  "shippingAddress": {
    "name": "Asha K",
    "phone": "9876543210",
    "line1": "Flat 1, Tower A",
    "line2": "MG Road",
    "landmark": null,
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001",
    "country": "India"
  },
  "tracking": null,
  "expectedDelivery": "2026-11-25",
  "deliveredAt": null
}
```

A **prepaid** order looks the same, except `"paymentMethod": "prepaid"` and `"paymentStatus": "paid"`.

After the warehouse ships (`status: "shipped"`), `tracking` is filled:

```json
"tracking": { "number": "AWB123", "url": "https://track/AWB123", "courier": "Delhivery" }
```

→ show courier + AWB and a **Track** button that opens `tracking.url` in the browser. `url` or `courier` can be `null`. After delivery: `"status": "delivered"`, `"deliveredAt": "2026-11-25T10:00:00.000Z"`.

| Field | Notes |
|---|---|
| `status` | **The only field the UI needs for state** (§8). `paymentStatus` / `fulfillmentStatus` are raw details. Don't build UI logic on them. |
| `paymentMethod` | `prepaid` or `cod`. For COD show "Pay ₹`total.rupees` on delivery". |
| `pricing` | Price breakdown. Hide rows that are 0 (discount, shipping, COD). `couponCodes` → "Coupon SAVE100 applied". |
| `shippingAddress` | `null` until the order is placed (the address is entered on Fastrr's page). |
| `expectedDelivery` | `YYYY-MM-DD` or `null`. |
| `tracking` | `null` until shipped. |
| `canCancel` | `true` → show the **Cancel order** button (placed and not shipped yet). |
| `cancelledAt` | When it was cancelled, or `null`. |
| `refund` | `null`, or an object: `status` (`in_progress` or `completed`), `amount` (money), `completedAt`. Show "Refund of ₹X initiated — reaches your account in 5–7 working days" or "₹X refunded on <date>". |

Example of a cancelled **prepaid** order (refund started):

```json
{
  "orderId": "TH-261116-27QE52FB",
  "status": "refund_initiated",
  "canCancel": false,
  "cancelledAt": "2026-11-16T09:12:40.118Z",
  "refund": { "status": "in_progress", "amount": { "paise": 299800, "rupees": 2998 }, "completedAt": null },
  "paymentStatus": "refund_pending",
  "fulfillmentStatus": "cancelled"
}
```

Errors: `404 ORDER_NOT_FOUND` (wrong id, or another user's order).

### 4.8 `POST /orders/:orderId/cancel` — cancel an order (login required)

Show the button only when the order has `canCancel: true`. Ask for confirmation first ("Cancel this order?" and, for prepaid, "Your refund will be started.").

**Body (optional):**

```json
{ "reason": "Ordered by mistake" }
```

**Response `200`:** the full updated order, same shape as §4.7. Real COD example (production, 20 Nov; only the changed fields shown):

```json
{
  "orderId": "TH-261120-ZWE98AT1",
  "status": "cancelled",
  "paymentMethod": "cod",
  "canCancel": false,
  "cancelledAt": "2026-11-20T12:55:30.035Z",
  "refund": null,
  "paymentStatus": "cancelled",
  "fulfillmentStatus": "cancelled"
}
```

- **COD** → `status: "cancelled"`. Nothing to refund.
- **Prepaid** → `status: "refund_initiated"` with a `refund` object. The team may need to approve the refund before the money moves. The app just shows "refund initiated".

What happens: the order is cancelled with the warehouse (Shopify) first, and the stock goes back. Only if that works is our order cancelled. Pushes: `cancelled`, and for prepaid also `refund_initiated` and later `refunded` (§10).

| HTTP | `code` | Meaning → what to show |
|---|---|---|
| 409 | `CANCEL_NOT_ALLOWED` | Already shipped or already cancelled → "This order can't be cancelled any more" + refresh the order |
| 409 | `CANCEL_IN_PROGRESS` | The order is being sent to the warehouse right now → "Please try again in a minute" (`retryAfterMs`: 60000) |
| 403 | `CANCEL_DISABLED` | Cancelling from the app is switched off → "Please contact support" |
| 502 | `SHOPIFY_CANCEL_FAILED` | Couldn't cancel with the warehouse → "Couldn't cancel right now, please try again or contact support" (nothing was changed) |
| 404 | `ORDER_NOT_FOUND` | Wrong id, or not this user's order |

---

## 5. Idempotency-Key

**The Flutter app creates it. The backend only checks it.**

### Why

Taps get doubled, networks drop, the app retries. Without a key, every retry could create a new order and a new payment page. With the key, the backend knows "this is the same checkout attempt" and returns **the same order**, so a double tap never creates two orders.

### Rules

- Format: 8–128 chars, letters / digits / `. _ : -`. **Use a UUID v4** (package `uuid`: `const Uuid().v4()`).
- Send it as the header `Idempotency-Key`.
- **One key = one checkout attempt.**

| Situation | Key to send |
|---|---|
| User taps **Checkout** (fresh attempt) | **New** key |
| Double tap / same request retried (timeout, no network, app killed mid-request) | **Same** key |
| `502 CHECKOUT_PROVIDER_ERROR` → "Try again" | **Same** key |
| `409 CHECKOUT_IN_PROGRESS` → wait `retryAfterMs`, retry | **Same** key |
| User changed the cart, or got `PRICE_CHANGED` / `CART_HAS_ISSUES` / `STOCK_UNAVAILABLE` and reviewed the cart | **New** key |
| `409 CHECKOUT_CLOSED` (expired / payment failed) and user taps "Try again" | **New** key |
| `409 IDEMPOTENCY_KEY_REUSED` | **New** key, then retry once |
| Order placed (success) | Forget the key |

What the backend does with the same key:
- same user + same key + same cart → returns the **same** `orderId` and a valid `checkoutPageUrl` (no new order);
- same key but the cart changed → `409 IDEMPOTENCY_KEY_REUSED`;
- same key after that order was placed → `409 ORDER_ALREADY_PLACED` with `orderId` → go to Order detail.

### Flow

```
Cart screen: user taps "Checkout"
   │
   ├─ checkoutKey ??= Uuid().v4()           // create only if we don't have one
   │
   ├─ POST /checkout  (Idempotency-Key: checkoutKey)
   │     ├─ 200 ─────────────────────────► open WebView(checkoutPageUrl), remember orderId
   │     ├─ timeout / network error ─────► retry with SAME key
   │     ├─ 409 CHECKOUT_IN_PROGRESS ────► wait retryAfterMs, retry with SAME key
   │     ├─ 502 CHECKOUT_PROVIDER_ERROR ─► show "Try again" (SAME key)
   │     ├─ 409 PRICE_CHANGED / CART_HAS_ISSUES / STOCK_UNAVAILABLE
   │     │                              ─► checkoutKey = null; show err.cart
   │     ├─ 409 ORDER_ALREADY_PLACED ────► checkoutKey = null; open Order detail(err.orderId)
   │     ├─ 409 CHECKOUT_CLOSED ─────────► checkoutKey = null; user can tap Checkout again
   │     └─ 409 IDEMPOTENCY_KEY_REUSED ──► checkoutKey = Uuid().v4(); retry once
   │
   └─ any cart change (add / qty / remove) ► checkoutKey = null
```

Dart sketch:

```dart
String? _checkoutKey;

void onCartChanged() => _checkoutKey = null;

Future<CheckoutResult> startCheckout() async {
  _checkoutKey ??= const Uuid().v4();
  try {
    final res = await api.post('/shop/checkout', headers: {'Idempotency-Key': _checkoutKey!});
    return CheckoutResult.fromJson(res.data); // orderId, checkoutPageUrl
  } on ShopApiError catch (e) {
    switch (e.code) {
      case 'CHECKOUT_IN_PROGRESS':
        await Future.delayed(Duration(milliseconds: e.extra['retryAfterMs'] ?? 2000));
        return startCheckout(); // same key
      case 'IDEMPOTENCY_KEY_REUSED':
        _checkoutKey = const Uuid().v4();
        return startCheckout();
      case 'PRICE_CHANGED':
      case 'CART_HAS_ISSUES':
      case 'STOCK_UNAVAILABLE':
      case 'CHECKOUT_CLOSED':
      case 'ORDER_ALREADY_PLACED':
        _checkoutKey = null;
        rethrow; // UI handles (§9)
      default:
        rethrow; // keep the key: a retry is the same attempt
    }
  }
}
```

Keep the key in memory for the checkout session. Optionally persist it until the order outcome is known, so a retry after an app restart reuses it.

---

## 6. Payment WebView

`checkoutPageUrl` is a page on **our** backend that loads Fastrr's checkout. The user enters phone (OTP), address and coupon, and pays (UPI / card / COD). All of it happens on Fastrr's page.

### WebView setup

- Package: `webview_flutter` (or `flutter_inappwebview`).
- JavaScript **enabled**, DOM storage **enabled**.
- Android: allow third-party cookies (payment gateways need them).
- Show the app's own top bar with a close (✕) button.

### UPI apps (important)

When the user picks UPI, the payment page tries to open a UPI app via links like `upi://pay?…`, `intent://…`, `phonepe://…`, `tez://…`, `paytmmp://…`. A WebView cannot open these by itself.

In `onNavigationRequest` / `shouldOverrideUrlLoading`: **if the scheme is not `http`/`https`**, open it with `url_launcher` (`launchUrl(uri, mode: LaunchMode.externalApplication)`) and **prevent** the WebView navigation. For `intent://` on Android, use the `browser_fallback_url` / package handling or `flutter_inappwebview`'s intent support.
iOS: add the UPI app schemes to `LSApplicationQueriesSchemes` in `Info.plist` (e.g. `phonepe`, `tez`, `paytmmp`, `gpay`, `upi`).

UPI has **not** been tested inside the app yet (COD was tested in a browser). Test UPI on a real Android phone and a real iPhone.

### Detecting "payment finished"

When Fastrr is done, it redirects to our return page:

```
https://www.take.health/api/shop/checkout/{orderId}/return?oid=…&ost=…
```

which then redirects to the app deep link:

```
takehealth://shop/order/{orderId}?status={status}
```

**Intercept either one** in the WebView's navigation handler:

```dart
NavigationDecision onNav(NavigationRequest req) {
  final uri = Uri.parse(req.url);
  final isReturn = uri.path.contains('/api/shop/checkout/') && uri.path.endsWith('/return');
  final isDeepLink = uri.scheme == 'takehealth' && uri.host == 'shop';
  if (isReturn || isDeepLink) {
    final orderId = isReturn ? uri.pathSegments[uri.pathSegments.length - 2] : uri.pathSegments.last;
    closeWebViewAndOpenOrderResult(orderId);
    return NavigationDecision.prevent;
  }
  if (uri.scheme != 'http' && uri.scheme != 'https') {
    launchUrl(uri, mode: LaunchMode.externalApplication); // UPI apps
    return NavigationDecision.prevent;
  }
  return NavigationDecision.navigate;
}
```

- Don't treat `ost` / `status` in the URL as final. Always confirm with `GET /orders/:orderId` (§7).
- **Deep link:** `takehealth://shop/order/{orderId}?status={status}`. The `takehealth://` scheme is **already registered in the app** (wearables OAuth returns to `takehealth://wearables?provider=…`). No new Android/iOS scheme setup is needed. Just add a handler for host **`shop`**, path `/order/{orderId}` → open Order result / Order detail. It is also the fallback if the WebView is not in control.

### User closes the WebView (✕ / back) before paying

Ask "Cancel payment?". If yes → close and open the **Order result** screen anyway (§7). If they had actually paid, polling shows it. If not, it stays `awaiting_payment` → show "Payment not completed" with a **Try again** button.

Try again = re-open the **same** `checkoutPageUrl` while the order is still `awaiting_payment`. The page gets a fresh Fastrr session by itself if the old one timed out. If the order has become `expired`, or the page says "Link expired", go back to the cart and start a new checkout with a new key.

### Page errors

The page handles these itself: it shows "Opening secure checkout…", a "Continue" button if the payment UI doesn't open automatically, and "Try again" if it fails to load. A link older than 2 hours shows "Link expired" → the user must start checkout again from the cart.

---

## 7. After payment — polling the order

Fastrr confirms the payment to our backend in the background. Right after the WebView closes, the order may still be `awaiting_payment` for a few seconds. (In the 20 Nov test, the COD order was confirmed within 3 seconds.)

**Order result screen:**

```
show "Checking your payment…"
repeat every 3 seconds, max 60 seconds:
    GET /orders/{orderId}
    if status != "awaiting_payment": stop
```

| Final `status` | Show |
|---|---|
| `confirmed` | ✅ "Order placed!" + order id, total, "View order" (prepaid) / "Pay ₹X on delivery" (COD) |
| `payment_failed` | ❌ "Payment failed. No money was taken." + **Try again** (new checkout, new key) |
| `expired` | "Checkout expired." + back to cart |
| still `awaiting_payment` after 60 s | "We're confirming your payment. We'll notify you." → go to My Orders / home. A push "Order confirmed" comes if it succeeds. |

Polling is cheap: the backend checks with Fastrr at most once every 10 s per order, no matter how often the app polls.

After `confirmed`, the backend has already **removed the purchased items from the cart** → refresh the cart badge (`GET /cart`).

---

## 8. Order statuses

Use only `status` for the UI.

| `status` | Meaning | Chip text (suggestion) | Colour |
|---|---|---|---|
| `awaiting_payment` | Checkout started, not paid yet | Payment pending | Grey |
| `payment_failed` | Payment failed | Payment failed | Red |
| `expired` | Checkout abandoned / timed out | Expired | Grey |
| `confirmed` | Paid (or COD placed), not shipped yet | Confirmed | Blue |
| `shipped` | Handed to courier (tracking available) | Shipped | Orange |
| `delivered` | Delivered | Delivered | Green |
| `returned` | Returned to origin by courier | Returned | Grey |
| `cancelled` | Cancelled (COD, or nothing to refund) | Cancelled | Red |
| `refund_initiated` | Cancelled, refund started | Refund initiated | Purple |
| `partially_refunded` | Part refunded | Partially refunded | Purple |
| `refunded` | Refunded | Refunded | Purple |

My Orders shows only `confirmed` and later. Map unknown future values to a neutral chip; don't crash.

---

## 9. Error codes

| HTTP | `code` | Where | What the app should do |
|---|---|---|---|
| 400 | `INVALID_CURSOR` | lists | Reload the list from the first page |
| 404 | `PRODUCT_NOT_FOUND` | product detail | "This product is no longer available" → back |
| 400 | `INVALID_QUANTITY` | cart | Clamp the stepper (1…`maxQty`) |
| 400 | `VARIANT_REQUIRED` | cart | App bug: make sure a variant is selected |
| 404 | `PRODUCT_UNAVAILABLE` | cart | "This product is not available" |
| 404 | `ITEM_NOT_IN_CART` | cart | Reload the cart |
| 409 | `MAX_QTY_REACHED` | cart | "You can add up to `maxQty`" |
| 409 | `OUT_OF_STOCK` | cart | "Out of stock" |
| 409 | `INSUFFICIENT_STOCK` | cart | "Only `availableQty` left" |
| 409 | `CART_FULL` | cart | "Your cart can hold up to `maxLines` items" |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | checkout | App bug: always send the header |
| 400 | `CART_EMPTY` | checkout | Back to cart |
| 409 | `CART_HAS_ISSUES` | checkout | Response has `cart` (same shape as §4.4) → re-render the cart showing each line's `issue`; new key |
| 409 | `PRICE_CHANGED` | checkout | Response has `cart` → show "Prices changed, please review" + updated cart; new key on next Checkout |
| 409 | `STOCK_UNAVAILABLE` | checkout | Someone else is paying for the last units. Response has `variantId`, `availableQty`. Show the `message` ("Only N available right now" or "being bought by someone else, try again in a few minutes"); new key |
| 409 | `IDEMPOTENCY_KEY_REUSED` | checkout | New key, retry once (§5) |
| 409 | `ORDER_ALREADY_PLACED` | checkout | Open Order detail with `orderId` |
| 409 | `CHECKOUT_CLOSED` | checkout | Response has `orderId`, `status`; new key, user can check out again |
| 409 | `CHECKOUT_IN_PROGRESS` | checkout | Wait `retryAfterMs` (2000), retry with the same key |
| 502 | `CHECKOUT_PROVIDER_ERROR` | checkout | "Couldn't start checkout. Try again." (`retryable: true`, same key) |
| 503 | `CHECKOUT_UNAVAILABLE` | checkout | "Checkout is temporarily unavailable"; hide or disable Checkout |
| 404 | `ORDER_NOT_FOUND` | orders, cancel | "Order not found" |
| 409 | `CANCEL_NOT_ALLOWED` | cancel | Already shipped / cancelled; refresh the order |
| 409 | `CANCEL_IN_PROGRESS` | cancel | Retry after `retryAfterMs` (60000) |
| 403 | `CANCEL_DISABLED` | cancel | "Please contact support" |
| 502 | `SHOPIFY_CANCEL_FAILED` | cancel | "Try again or contact support" (nothing changed) |
| 429 | `RATE_LIMITED` (or no code on GET) | any | Back off a few seconds (§1) |
| 500 | `INTERNAL_ERROR` | any | Generic "Something went wrong" |
| 401 | (no `code`) | protected APIs | Normal app auth handling |

---

## 10. Push notifications

Sent through the app's existing FCM setup (the app already registers its FCM token).

`data` payload:

```json
{ "type": "shop_order", "event": "shipped", "orderId": "TH-261120-ZWE98AT1", "click_action": "FLUTTER_NOTIFICATION_CLICK" }
```

| `event` | Title — body (from the backend) |
|---|---|
| `confirmed` | "Order confirmed" — "Your order TH-… is confirmed. We'll let you know when it ships." |
| `shipped` | "Your order is on the way" — "TH-… has shipped with Delhivery." |
| `delivered` | "Order delivered" — "Your order TH-… has been delivered." |
| `cancelled` | "Order cancelled" — "Your order TH-… has been cancelled." |
| `refund_initiated` | "Refund initiated" — "Refund of ₹X for TH-… has started. It usually reaches your account in 5–7 working days." |
| `refunded` | "Refund completed" — "₹X for TH-… has been refunded." |

On tap (and on receive while the app is open): if `type == "shop_order"` → open **Order detail** for `orderId`, and refresh it if it's already open. Each event is sent once per order.

---

## 11. Flutter checklist

**Setup**
- [ ] API client for `/api/shop` with Bearer token + common error parsing (`code`, `message`, extra fields)
- [ ] `Money` model (`paise` int, `rupees` num) + ₹ formatter
- [ ] String ids everywhere
- [ ] Deep link handler for `takehealth://shop/order/{orderId}` (scheme already registered for wearables; add the `shop` route)
- [ ] `uuid`, `webview_flutter` (or `flutter_inappwebview`), `url_launcher`, an HTML renderer for `descriptionHtml`

**Screens**
- [ ] Shop home: sections from `/collections` (Featured = `frontpage`), product grid, search, infinite scroll (`nextCursor`)
- [ ] Product detail: images, variant chips from `options` (names as they come from Shopify), price + MRP, stock, description, qty, Add to cart
- [ ] Cart: lines, stepper (max = min(10, `availableQty`)), remove, `issue` + `priceChanged` banners, subtotal, Checkout enabled by `checkoutAllowed`
- [ ] Payment WebView: UPI intent handling, return/deep-link interception, close confirmation
- [ ] Order result: polling (3 s, max 60 s) + success / failed / expired / still-checking states
- [ ] My Orders: list + pagination
- [ ] Order detail: items, price breakdown, address, status chip, tracking + Track button, refund info, **Cancel order** (only if `canCancel`, with confirmation) → `POST /orders/:orderId/cancel`
- [ ] Cart badge from `summary.itemCount`

**Logic**
- [ ] Idempotency-Key exactly as §5
- [ ] Error handling as §9 (including any HTTP 429)
- [ ] Push `type: shop_order` → Order detail
- [ ] Refresh the cart after a confirmed order

**Test together with the backend team (on the production URL, test orders)**
- [ ] COD order from the app (already passed in a browser on 20 Nov)
- [ ] UPI on Android (GPay / PhonePe / Paytm) and iOS
- [ ] Card payment
- [ ] Payment failed → retry
- [ ] Close the WebView mid-payment
- [ ] Double tap on Checkout (must open one order)
- [ ] Kill the app during payment, reopen → order shows correctly
- [ ] Cancel a COD order and a prepaid order

---

## 12. Not available yet

Don't build UI for these yet (backend work or policy pending):

- Return / exchange after delivery (policy pending)
- Invoice download (invoices come from the store's Shopify / warehouse system)
- Saved addresses in the app (Fastrr's page remembers addresses by phone number — to be confirmed)
- Coupons in the app (applied on Fastrr's page)
- Abandoned-cart reminders, wishlist, reviews

Questions → backend team.
