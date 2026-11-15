# take.health In-App Shop — Requirements Checklist for Launch

**Purpose:** everything the backend team needs from other people before the in-app shop can go live, in one place: what we need, why, who gives it, to whom, and by when.
**Target:** collect everything on **Monday 17 Nov 2026** → test on `main` and go live on **Tuesday 18 Nov 2026**.
**Backend status:** catalog, cart, checkout (Fastrr), orders, Shopify order creation, shipping updates and stock holds are built and tested. Refunds / cancel-by-user (M4) are pending and depend on the management decisions below.

**Legend:** 🔴 **Blocker** — no go-live without it · 🟡 **Needed soon** — launch possible, but required for that feature · 🟢 **Nice to have**

---

## Summary

| Team | Items | Blockers | Owner to chase |
|---|---|---|---|
| Fastrr (Shiprocket Checkout) | 12 | 6 | Backend lead |
| Shopify developer | 7 | 3 | Backend lead |
| Management | 8 | 3 | Backend lead |
| Ops / Warehouse | 5 | 2 | Backend lead |
| Flutter team | 5 | 2 | Backend lead |
| Backend team (our own tasks) | 6 | 4 | Backend team |

---

## 1. Fastrr (Shiprocket Checkout)

**Given by:** Fastrr account manager / integration team → **to:** backend team (keys go only into the server environment, shared via a secure channel — never in chat groups or email threads).

| # | What we need | Why — what it is used for | Priority |
|---|---|---|---|
| F1 | **Staging API key + secret** | Lets our backend create checkout sessions and read order status on Fastrr's test system. Without it, nothing about payment can be tested end to end. | 🔴 |
| F2 | **Production API key + secret** | Same, for real customers. Set on both servers (Vercel and Render). | 🔴 |
| F3 | **Test payment details for staging** (test UPI ID / test cards / how COD works in staging) | To run real test payments: prepaid, COD, failed payment, and later a refund — without spending real money. | 🔴 |
| F4 | **Written confirmation: does Fastrr itself create orders in our Shopify store (or Shiprocket shipments)?** | Our backend creates the Shopify order after payment. If Fastrr also does it, every order would be created twice (double shipment, wrong stock). The answer decides whether we switch on our Shopify order creation. | 🔴 |
| F5 | **Register our URLs on their side** (we give them — see "What we give" below) | Fastrr needs our webhook URL to tell us an order was placed, our catalog URLs to read products, and our domain whitelisted to load their checkout. | 🔴 |
| F6 | **UPI behaviour inside a mobile WebView** (which links/schemes their page opens: `upi://`, `intent://`, `phonepe://`, …) | The Flutter app must open UPI apps (GPay, PhonePe, Paytm) from the payment page. If it can't, UPI payments fail in the app. | 🔴 |
| F7 | **Refund API details:** partial refunds supported? which id to send (`platform_order_id` or `fastrr_order_id`)? how long until money reaches the customer? refund webhook or only the report? | Needed to build refunds (cancel / duplicate payment) correctly. | 🟡 |
| F8 | **Checkout session behaviour:** token validity, `fallbackUrl` (can it be turned off so users never land on the Shopify website?), redirect parameters (`oid`, `ost`) | Makes the in-app flow reliable and keeps users inside the app. | 🟡 |
| F9 | **Saved address by phone number** — does their page auto-fill a returning customer's address? | If yes, returning customers don't retype addresses and we don't need to build an address book. | 🟡 |
| F10 | **COD settings in their dashboard:** maximum COD order value, COD fee | Set after management decides (MG4 below). Controls who can choose COD and what it costs. | 🟡 |
| F11 | **Settlement:** which bank account receives the money, settlement cycle, fees | Finance needs this to reconcile payouts with orders. | 🟡 |
| F12 | **Webhook details:** retry policy, sender IP addresses (if fixed) | Lets us tighten security on the webhook and know how missed webhooks are retried (we also have a 10-minute backup check). | 🟢 |

### What we give to Fastrr

| Item | Value |
|---|---|
| Order webhook URL | `https://www.take.health/api/shop/fastrr/webhook` |
| Product catalog URL | `https://www.take.health/api/shop/fastrr/products` |
| Collections URL | `https://www.take.health/api/shop/fastrr/collections` |
| Products in a collection URL | `https://www.take.health/api/shop/fastrr/collection-products?collection_id={id}` |
| Domain to whitelist | `www.take.health` |

---

## 2. Shopify developer

**Given by:** Shopify developer → **to:** backend team (token and secret via a secure channel; product data entered directly in Shopify).

| # | What we need | Why — what it is used for | Priority |
|---|---|---|---|
| S1 | **An Admin API token for a dedicated "take.health backend" custom app** with only these scopes: `read_products`, `read_inventory`, `write_inventory`, `write_orders`, `read_all_orders`, `read_fulfillments`, `write_customers` | `write_orders`: create the Shopify order after payment so the warehouse ships it. `read_inventory`: keep stock in the app correct. `read_fulfillments`: show "shipped / delivered" and tracking in the app. Only these scopes, so a leaked token can't change the website, themes or read bank details (the token currently in use has many more scopes than needed). | 🔴 |
| S2 | **"Protected customer data" access (Level 2: name, email, phone, address)** enabled for that app | Without it Shopify refuses to store the customer's name/phone/address on orders we create — the warehouse couldn't ship. | 🔴 |
| S3 | **The app's client secret** (or the webhook signing secret) | Verifies that webhooks really come from Shopify (shipping updates, stock changes). | 🔴 |
| S4 | **HSN code + GST rate on every product**, and Shopify's India tax (GST) settings switched on | GST invoices are generated on the Shopify side for app orders too; they need HSN and GST rate per product. | 🟡 (blocker if invoices are generated from Shopify) |
| S5 | **Weights on all variants** (currently 0) | Fastrr calculates shipping charges from weight; with 0 the shipping charge is wrong. | 🟡 |
| S6 | **Where product descriptions live** (description field is empty for synced products — metafields / theme?) | So the app's product page can show the description. | 🟡 |
| S7 | **A Shopify development store** (copy of the products) | Safe place to test order creation without touching the live store and warehouse. | 🟢 |

---

## 3. Management

**Given by:** management / founders → **to:** backend team (decisions), website/legal team (policy pages).

| # | What we need | Why — what it is used for | Priority |
|---|---|---|---|
| MG1 | **Refund / return / cancellation policy:** can a customer cancel after the order ships? return window (days)? are opened supplement packs returnable? | The app's cancel button, refund rules and the policy page all follow this. Payment gateways also require a published refund policy. | 🔴 (policy page) |
| MG2 | **Policy pages published:** refund & return, shipping, updated privacy policy (customer phone/address is shared with Fastrr and Shopify for delivery) | Required by the payment gateway and by data-protection law before taking payments. | 🔴 |
| MG3 | **Go / no-go sign-off for Tuesday** | Someone accountable confirms the blockers are cleared. | 🔴 |
| MG4 | **COD rules:** maximum COD order value, COD fee | Configured in Fastrr (F10). Controls fraud / return-to-origin risk. | 🟡 |
| MG5 | **How COD orders are refunded** (no online payment exists): UPI transfer by the team? store credit? | COD refunds can't go through Fastrr; the process must be defined. | 🟡 |
| MG6 | **Refund approval:** fully automatic, or admin approval above an amount (e.g. ₹2,000)? | Configures the refund feature (backend module M4). Until decided, refunds are manual. | 🟡 |
| MG7 | **Card offer for app purchases:** should buying in the app also give the 30-day free trial (like website orders)? | Backend switch `SHOP_APP_ORDERS_CARD_OFFER` (currently: yes). | 🟡 |
| MG8 | **Subscription products:** confirm they stay hidden in the app (our checkout can't charge monthly) | Currently hidden, so nobody buys a ₹1,349 "subscription" that never renews. Showing them needs recurring payments (post-launch). | 🟢 |

---

## 4. Ops / Warehouse

**Given by:** operations / warehouse lead → **to:** backend team.

| # | What we need | Why — what it is used for | Priority |
|---|---|---|---|
| O1 | **How invoices are generated today for website orders** (Shopify GST app / Shiprocket / manual) | App orders are normal Shopify orders, so they get invoices the same way. We must confirm that system exists and will pick them up. Our backend deliberately does not issue invoices (two invoice number series would break GST rules). | 🔴 |
| O2 | **Is the warehouse / Shiprocket auto-synced with Shopify?** and agreement to watch the **live test window** on Tuesday (orders tagged `take-app` + `TEST` must not be shipped) | A test order on the live store could otherwise be packed, labelled and picked up automatically. | 🔴 |
| O3 | **Is tracking (courier + AWB) entered in Shopify when an order ships?** | The app shows "shipped", tracking and "delivered" only from Shopify's fulfilment data. If shipping happens outside Shopify, the app never shows it. | 🟡 |
| O4 | **Who handles app-order problems** (cancellations, manual refunds in the first days, stuck orders) and **an email address for alerts** | The backend raises alerts for orders that need a human; someone has to receive and act on them. | 🟡 |
| O5 | Go-ahead to keep Shopify's own customer emails **off** for app orders (the app sends push notifications instead) | Avoids duplicate messages to customers. | 🟢 |

---

## 5. Flutter team

**Given by:** Flutter lead → **to:** backend team. (They receive from us: `docs/shop-flutter-api-guide.md` / the Word copy.)

| # | What we need | Why — what it is used for | Priority |
|---|---|---|---|
| A1 | **Release date of the app build with the shop** (incl. Play Store / App Store review time) | Backend can be live on Tuesday, but customers can only use the shop once this app version is published. | 🔴 |
| A2 | **Joint end-to-end test slot** on Monday/Tuesday with real phones (Android + iPhone): UPI via GPay / PhonePe / Paytm, card, COD, failed payment, closing the WebView mid-payment, double tap on Checkout | Payment inside a WebView is where most real-world failures happen; only device testing proves it works. | 🔴 |
| A3 | Confirmation that the deep link `takehealth://shop/order/{orderId}` is handled (the scheme already exists for wearables) | Brings the user back from payment to the order screen. | 🟡 |
| A4 | Confirmation that push notifications with `type: shop_order` open the order screen | Shipped / delivered updates reach the customer. | 🟡 |
| A5 | Test user accounts on the testing server | To test cart and orders against the testing base URL. | 🟢 |

---

## 6. Backend team — our own tasks (no one else needed)

| # | Task | Why | Priority |
|---|---|---|---|
| B1 | **Check which database the testing server (Render) uses** (staging or production) — Render dashboard → Environment | The Flutter team will test there; test orders must not land in the production database. | 🔴 |
| B2 | Set environment variables on **both** Vercel and Render (Fastrr keys, Shopify token, `SHOP_PUBLIC_BASE_URL`, feature switches) | Both servers serve the same app; a missing value on one breaks half the traffic. | 🔴 |
| B3 | Merge `Staging` → `main`, deploy, run the production setup scripts (catalog sync + indexes, Shopify webhooks, scheduled jobs) | Production needs its catalog, database indexes and background jobs before the first order. | 🔴 |
| B4 | Live-store test on Tuesday (1 prepaid + 1 COD, then cancel + restock) with ops informed beforehand | Proves the Shopify order, stock and address are correct on the real store. | 🔴 |
| B5 | Admin tools: stuck-orders list, retry Shopify sync, alerts | So no paid order silently gets stuck on launch day. | 🟡 |
| B6 | Refunds + cancel-by-user (after MG1, MG5, MG6 and F7) | Full M4. Until then, refunds are done manually in Fastrr's dashboard. | 🟡 |

---

## Monday tracker

| Team | Contact | Sent on | All received? |
|---|---|---|---|
| Fastrr | | | ☐ |
| Shopify developer | | | ☐ |
| Management | | | ☐ |
| Ops / Warehouse | | | ☐ |
| Flutter team | | | ☐ |
