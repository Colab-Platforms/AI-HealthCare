// Pure checks for a Shopify order that Fastrr created from our WebView URL
// (shopify_webview mode). The cart in that URL is readable and editable on the
// phone, so the Shopify order is NOT trusted until it matches what our server
// priced: same variants, same quantities, same unit prices. Anything else goes
// to admin review instead of being marked "placed" silently.
//
// Accepts both shapes Shopify uses:
//   GraphQL  { customAttributes:[{key,value}], currencyCode,
//              lineItems:{nodes:[{ quantity, variant:{legacyResourceId},
//                customAttributes:[{key,value}],
//                originalUnitPriceSet:{shopMoney:{amount}} }]},
//              totalDiscountsSet:{shopMoney:{amount}} }
//   REST / webhook  { note_attributes:[{name,value}], currency, total_discounts,
//              line_items:[{ quantity, variant_id, price, properties:[{name,value}] }] }

const { toPaise } = require('./money');

const KEY = 'internal_order_id';

// GraphQL fields the link step should fetch (kept here so the verifier and the
// query never drift apart).
const VERIFY_ORDER_FIELDS = `
  currencyCode
  customAttributes { key value }
  totalDiscountsSet { shopMoney { amount } }
  lineItems(first: 100) {
    nodes {
      quantity
      variant { legacyResourceId }
      customAttributes { key value }
      originalUnitPriceSet { shopMoney { amount } }
    }
  }
`;

const attrValue = (list, key) => {
    if (!Array.isArray(list)) return null;
    const hit = list.find((a) => a && (a.key ?? a.name) === key);
    const v = hit ? String(hit.value ?? '').trim() : '';
    return v || null;
};

const lineNodes = (node) => {
    if (Array.isArray(node?.line_items)) return node.line_items;
    if (Array.isArray(node?.lineItems?.nodes)) return node.lineItems.nodes;
    if (Array.isArray(node?.lineItems?.edges)) return node.lineItems.edges.map((e) => e.node);
    return [];
};

const normLine = (l) => ({
    variantId: String(l.variant?.legacyResourceId ?? l.variant_id ?? '').trim(),
    quantity: Number(l.quantity) || 0,
    unitPaise: toPaise(l.originalUnitPriceSet?.shopMoney?.amount ?? l.price),
    internalOrderId: attrValue(l.customAttributes ?? l.properties, KEY),
});

/**
 * Which TH-... order does this Shopify order belong to?
 * Cart attributes (note_attributes) first; line-item properties as backup.
 * @returns {{ internalOrderId: string|null, source: 'cart'|'line_item'|null, conflict: boolean }}
 */
const extractInternalOrderId = (node) => {
    const fromCart = attrValue(node?.customAttributes ?? node?.note_attributes, KEY);
    const fromLines = [...new Set(lineNodes(node).map(normLine).map((l) => l.internalOrderId).filter(Boolean))];
    const all = new Set([fromCart, ...fromLines].filter(Boolean));
    if (fromCart) return { internalOrderId: fromCart, source: 'cart', conflict: all.size > 1 };
    if (fromLines.length) return { internalOrderId: fromLines[0], source: 'line_item', conflict: fromLines.length > 1 };
    return { internalOrderId: null, source: null, conflict: false };
};

/**
 * @param {object} order  our Order { internalOrderId, amount, items:[{variantId, quantity, priceSnapshot}] }
 * @param {object} node   Shopify order (GraphQL or REST shape)
 * @returns {{ ok: boolean, reasons: string[], summary: object }}
 *   reasons: ORDER_ID_MISMATCH, ORDER_ID_CONFLICT, CURRENCY_MISMATCH,
 *            ITEMS_MISMATCH, PRICE_MISMATCH:<variantId>, PRICE_MISSING:<variantId>,
 *            SUBTOTAL_MISMATCH
 */
const verifyShopifyOrderAgainstOurs = (order, node) => {
    const reasons = [];

    const link = extractInternalOrderId(node);
    if (link.internalOrderId && link.internalOrderId !== order.internalOrderId) reasons.push('ORDER_ID_MISMATCH');
    if (link.conflict) reasons.push('ORDER_ID_CONFLICT');

    const currency = String(node?.currencyCode ?? node?.currency ?? 'INR').toUpperCase();
    if (currency !== 'INR') reasons.push('CURRENCY_MISMATCH');

    // Ours, by variant (an order never has the same variant twice, but merge anyway).
    const ours = new Map();
    for (const i of order.items || []) {
        const id = String(i.variantId);
        const prev = ours.get(id);
        ours.set(id, { quantity: (prev?.quantity || 0) + i.quantity, unitPaise: i.priceSnapshot });
    }

    // Theirs, by variant. Shopify may split one variant over several lines.
    const theirs = new Map();
    for (const l of lineNodes(node).map(normLine)) {
        const prev = theirs.get(l.variantId);
        theirs.set(l.variantId, {
            quantity: (prev?.quantity || 0) + l.quantity,
            prices: [...(prev?.prices || []), l.unitPaise],
            subtotal: (prev?.subtotal || 0) + (l.unitPaise ?? 0) * l.quantity,
        });
    }

    const sameVariants = ours.size === theirs.size && [...ours.keys()].every((k) => theirs.has(k));
    const sameQty = sameVariants && [...ours].every(([k, v]) => theirs.get(k).quantity === v.quantity);
    if (!sameVariants || !sameQty) reasons.push('ITEMS_MISMATCH');

    for (const [variantId, mine] of ours) {
        const t = theirs.get(variantId);
        if (!t) continue;
        if (t.prices.some((p) => p === null)) reasons.push(`PRICE_MISSING:${variantId}`);
        else if (t.prices.some((p) => p !== mine.unitPaise)) reasons.push(`PRICE_MISMATCH:${variantId}`);
    }

    const shopifySubtotalPaise = [...theirs.values()].reduce((s, t) => s + t.subtotal, 0);
    if (shopifySubtotalPaise !== order.amount) reasons.push('SUBTOTAL_MISMATCH');

    // A store coupon applied on Fastrr's page is allowed (the store gave it),
    // so it is reported, not flagged.
    const discountPaise = toPaise(node?.totalDiscountsSet?.shopMoney?.amount ?? node?.total_discounts) || 0;

    return {
        ok: reasons.length === 0,
        reasons,
        summary: {
            internalOrderId: link.internalOrderId,
            linkSource: link.source,
            expectedPaise: order.amount,
            shopifySubtotalPaise,
            discountPaise,
        },
    };
};

module.exports = { VERIFY_ORDER_FIELDS, extractInternalOrderId, verifyShopifyOrderAgainstOurs };
