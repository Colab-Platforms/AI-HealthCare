const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { signBody } = require("../utils/fastrrHmac");
const Order = require("../models/Order");
const ProcessedWebhook = require("../models/ProcessedWebhook");

// Fastrr (Shiprocket Checkout) — Custom Platform integration.
// See docs/fastrr-shiprocket-checkout-integration-plan.md and
// docs/fastrr-integration-reference-and-test-plan.md for the full spec.
//
// /shiprocket/products and /shiprocket/collections work standalone (only
// depend on our own Shopify-sourced data). /api/checkout/start and the
// webhook receiver need FASTRR_API_KEY/SECRET to actually reach Fastrr, but
// their security logic (amount recompute, idempotency, webhook validation)
// is fully wired regardless.

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const FASTRR_BASE_URL =
  process.env.FASTRR_BASE_URL || "https://fastrr-api-dev.pickrr.com";
const FASTRR_API_KEY = process.env.FASTRR_API_KEY;
const FASTRR_API_SECRET = process.env.FASTRR_API_SECRET;

// Extracts the trailing numeric id from a Shopify GraphQL GID
// (e.g. "gid://shopify/ProductVariant/44123456789" -> 44123456789).
// Fastrr's docs require unique, long-integer ids — Shopify's GIDs already
// end in a unique numeric segment, so we reuse that directly.
function gidToLongInt(gid) {
  const match = /\/(\d+)$/.exec(gid || "");
  return match ? Number(match[1]) : null;
}

function toRupeeAmountPaise(decimalString) {
  // Shopify/Fastrr both send amounts as decimal strings/floats ("649.00").
  // Convert to integer paise immediately on receipt — never carry floats
  // through calculations/comparisons (Edge Case #15).
  return Math.round(Number(decimalString) * 100);
}

async function shopifyStorefrontQuery(query, variables = {}) {
  if (!SHOPIFY_DOMAIN || !STOREFRONT_TOKEN) {
    throw new Error("SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_TOKEN not set in server/.env");
  }
  const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Fetches a single variant's live price/title/sku/stock straight from
// Shopify by its numeric id — used to recompute amount server-side at
// checkout time rather than trusting whatever the client sends.
async function getVariantLive(variantLongId) {
  const gid = `gid://shopify/ProductVariant/${variantLongId}`;
  const query = `
    query GetVariant($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          id
          title
          sku
          price { amount }
          quantityAvailable
          product { title }
        }
      }
    }
  `;
  const data = await shopifyStorefrontQuery(query, { id: gid });
  return data.node;
}

// ── 1. Catalog APIs Fastrr will call to pull our products/collections ──────
// GET /shiprocket/products?page=1&limit=100
router.get("/shiprocket/products", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 250);
    const query = `
      query GetProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              descriptionHtml
              vendor
              productType
              handle
              createdAt
              updatedAt
              images(first: 1) { edges { node { url } } }
              variants(first: 25) {
                edges {
                  node {
                    id
                    title
                    sku
                    price { amount }
                    compareAtPrice { amount }
                    quantityAvailable
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await shopifyStorefrontQuery(query, { first: limit });

    const products = data.products.edges.map(({ node }) => ({
      id: gidToLongInt(node.id),
      title: node.title,
      body_html: node.descriptionHtml || "",
      vendor: node.vendor || "",
      product_type: node.productType || "",
      created_at: node.createdAt,
      handle: node.handle,
      updated_at: node.updatedAt,
      status: "active", // Storefront API only returns published/active products
      image: node.images.edges[0]?.node?.url ? { src: node.images.edges[0].node.url } : null,
      variants: node.variants.edges.map(({ node: v }) => ({
        id: gidToLongInt(v.id),
        title: v.title,
        price: v.price?.amount,
        compare_at_price: v.compareAtPrice?.amount || null,
        sku: v.sku || "",
        quantity: v.quantityAvailable ?? 0,
      })),
    }));

    res.json({ data: { total: products.length, products } });
  } catch (error) {
    console.error("[fastrr/shiprocket/products]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /shiprocket/collections?page=1&limit=100
router.get("/shiprocket/collections", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 250);
    const query = `
      query GetCollections($first: Int!) {
        collections(first: $first) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              updatedAt
              image { url }
            }
          }
        }
      }
    `;
    const data = await shopifyStorefrontQuery(query, { first: limit });

    const collections = data.collections.edges.map(({ node }) => ({
      id: gidToLongInt(node.id),
      title: node.title,
      handle: node.handle,
      body_html: node.descriptionHtml || "",
      updated_at: node.updatedAt,
      image: node.image?.url ? { src: node.image.url } : null,
    }));

    res.json({ data: { total: collections.length, collections } });
  } catch (error) {
    console.error("[fastrr/shiprocket/collections]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── 2. Checkout token generation ────────────────────────────────────────────
// POST /api/checkout/start
// body: { items: [{ variantId, quantity }], idempotencyKey?, redirectUrl? }
//
// Security measures wired here (work regardless of Fastrr credentials):
//  - Server recomputes amount from live Shopify prices — client-sent price
//    is never trusted (Edge Case #8).
//  - idempotencyKey reuse returns the existing pending order/token instead
//    of calling Fastrr again — prevents double-click double-orders
//    (Edge Case #5).
router.post("/api/checkout/start", async (req, res) => {
  try {
    const { items, redirectUrl } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items[] is required" });
    }

    // Client may supply an idempotencyKey (generated once per checkout
    // attempt and reused on retry); otherwise we mint one per request.
    const idempotencyKey = req.body.idempotencyKey || crypto.randomUUID();

    const existing = await Order.findOne({ idempotencyKey });
    if (existing && existing.fastrrToken && existing.paymentStatus === "pending") {
      const stillValid =
        existing.fastrrTokenExpiresAt && existing.fastrrTokenExpiresAt > new Date();
      if (stillValid) {
        return res.json({
          token: existing.fastrrToken,
          expiresAt: existing.fastrrTokenExpiresAt,
          fastrrOrderId: existing.fastrrOrderId,
          internalOrderId: existing.internalOrderId,
          reused: true,
        });
      }
    }

    // Recompute amount + snapshot each line item from live Shopify data —
    // never trust a client-supplied price/quantity-availability.
    let amount = 0;
    const resolvedItems = [];
    for (const item of items) {
      const variant = await getVariantLive(item.variantId);
      if (!variant) {
        return res.status(400).json({ error: `Variant ${item.variantId} not found` });
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (variant.quantityAvailable !== null && variant.quantityAvailable < qty) {
        return res.status(409).json({
          error: `Insufficient stock for ${variant.product?.title || variant.title}`,
        });
      }
      const priceSnapshot = toRupeeAmountPaise(variant.price.amount);
      amount += priceSnapshot * qty;
      resolvedItems.push({
        variantId: item.variantId,
        title: `${variant.product?.title || ""} - ${variant.title}`,
        sku: variant.sku || "",
        quantity: qty,
        priceSnapshot,
      });
    }

    const internalOrderId = `TH-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    if (!FASTRR_API_KEY || !FASTRR_API_SECRET) {
      return res.status(503).json({
        error:
          "Fastrr credentials not configured yet (FASTRR_API_KEY / FASTRR_API_SECRET missing in .env). " +
          "Amount was successfully recomputed server-side — this endpoint is ready and will call Fastrr once credentials are added.",
        computedAmountPaise: amount,
        internalOrderId,
      });
    }

    const payload = {
      cart_data: {
        items: resolvedItems.map((i) => ({ variant_id: String(i.variantId), quantity: i.quantity })),
        mobile_app: false,
      },
      redirect_url: redirectUrl || "https://take.health/checkout/complete",
      timestamp: new Date().toISOString(),
    };
    const rawBody = JSON.stringify(payload);
    const signature = signBody(rawBody, FASTRR_API_SECRET);

    const response = await fetch(`${FASTRR_BASE_URL}/api/v1/access-token/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": FASTRR_API_KEY,
        "X-Api-HMAC-SHA256": signature,
      },
      body: rawBody,
    });
    const result = await response.json();

    if (!result.ok) {
      return res.status(502).json({ error: result.error || "Fastrr rejected the request" });
    }

    const order = await Order.create({
      internalOrderId,
      idempotencyKey,
      items: resolvedItems,
      amount,
      paymentStatus: "pending",
      checkoutSource: "fastrr",
      fastrrOrderId: result.result.data.order_id,
      fastrrToken: result.result.token,
      fastrrTokenExpiresAt: result.result.expires_at,
      statusHistory: [{ status: "pending", source: "system", changedAt: new Date() }],
    });

    res.json({
      token: order.fastrrToken,
      expiresAt: order.fastrrTokenExpiresAt,
      fastrrOrderId: order.fastrrOrderId,
      internalOrderId: order.internalOrderId,
    });
  } catch (error) {
    console.error("[fastrr/checkout/start]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── 3. Order webhook receiver (Fastrr -> us) ────────────────────────────────
// POST /api/fastrr/webhook
//
// NOTE: Fastrr's docs do not document a signature scheme for this specific
// webhook (open question in the integration plan). Until confirmed, this is
// the interim security model (see fastrr-integration-reference-and-test-plan.md
// Edge Case #1):
//   1. Reject events for any fastrr_order_id we have no pending Order record
//      for — an attacker can't guess our internally-generated order ids.
//   2. Reject if the payload amount doesn't match what we recorded when we
//      started this checkout.
//   3. Reject/skip duplicates via ProcessedWebhook (Edge Case #2 — Fastrr
//      explicitly says webhooks may be sent more than once).
router.post("/api/fastrr/webhook", express.json(), async (req, res) => {
  try {
    const event = req.body;
    const fastrrOrderId = event.fastrr_order_id || event.platform_order_id;

    if (!fastrrOrderId) {
      return res.status(400).json({ error: "missing order identifier" });
    }

    // 1. Must match an order we actually initiated.
    const order = await Order.findOne({ fastrrOrderId });
    if (!order) {
      console.warn("[fastrr/webhook] REJECTED — no matching pending order", { fastrrOrderId });
      // Return 200 so Fastrr doesn't retry-storm us over an order that will
      // never exist on our side; we simply never act on it.
      return res.status(200).json({ received: true, ignored: true });
    }

    // 2. Duplicate-delivery guard.
    const eventId = event.cart_id || `${fastrrOrderId}:${event.status}`;
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
    try {
      await ProcessedWebhook.create({ source: "fastrr", eventId, payloadHash });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        console.log("[fastrr/webhook] duplicate delivery, skipping", { fastrrOrderId, eventId });
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw dupErr;
    }

    // 3. Amount must match what we computed server-side at checkout start.
    const webhookAmountPaise = event.total_amount_payable
      ? toRupeeAmountPaise(event.total_amount_payable)
      : null;
    if (webhookAmountPaise !== null && webhookAmountPaise !== order.amount) {
      console.error("[fastrr/webhook] AMOUNT MISMATCH — refusing to mark paid", {
        fastrrOrderId,
        expected: order.amount,
        received: webhookAmountPaise,
      });
      order.recordStatusChange("amount_mismatch_flagged", "webhook", eventId);
      await order.save();
      return res.status(200).json({ received: true, flagged: "amount_mismatch" });
    }

    // Apply the status.
    if (event.status === "SUCCESS" && order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.razorpayPaymentId = event.payments?.find((p) => p.gateway === "Razorpay")?.pg_transaction_id;
      order.fastrrCartId = event.cart_id;
      order.recordStatusChange("paid", "webhook", eventId);
      // TODO: enqueue Shopify order-creation job here (Stage E of the
      // integration plan) — BullMQ + idempotency + retry/backoff.
    } else if (event.status === "FAILED") {
      order.paymentStatus = "failed";
      order.recordStatusChange("failed", "webhook", eventId);
    } else {
      order.recordStatusChange(event.status || "unknown", "webhook", eventId);
    }
    await order.save();

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[fastrr/webhook]", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
