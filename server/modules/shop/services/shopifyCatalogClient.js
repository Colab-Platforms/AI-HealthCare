// Read-only Shopify Admin GraphQL queries for the shop catalog (Take Limited
// store). Reuses services/shopifyAdminService.graphql — same timeout, same
// 429 / THROTTLED backoff. Needs the `read_products` (+ `read_inventory`) scope.
//
// Page sizes are kept small on purpose: Shopify rejects a query whose
// *requested* cost is over 1000 points, and nested connections multiply
// (10 products × 20 variants × media/inventoryItem ≈ 800).

const { graphql } = require('../../../services/shopifyAdminService');

const PRODUCTS_PER_PAGE = 10;
const VARIANTS_PER_PRODUCT = 20;
const COLLECTIONS_PER_PAGE = 50;
const COLLECTION_PRODUCT_IDS_PER_PAGE = 250;

const PRODUCT_FIELDS = `
  legacyResourceId
  title
  handle
  descriptionHtml
  vendor
  productType
  tags
  status
  createdAt
  updatedAt
  media(first: 5) { nodes { ... on MediaImage { image { url altText } } } }
  collections(first: 10) { nodes { legacyResourceId handle title } }
  variants(first: ${VARIANTS_PER_PRODUCT}) {
    pageInfo { hasNextPage }
    nodes {
      legacyResourceId
      title
      sku
      price
      compareAtPrice
      inventoryQuantity
      inventoryPolicy
      taxable
      createdAt
      updatedAt
      selectedOptions { name value }
      media(first: 1) { nodes { ... on MediaImage { image { url } } } }
      inventoryItem { legacyResourceId tracked measurement { weight { unit value } } }
    }
  }
`;

const COLLECTION_FIELDS = `
  legacyResourceId
  handle
  title
  descriptionHtml
  updatedAt
  image { url }
`;

const warnIfVariantsTruncated = (node) => {
    if (node?.variants?.pageInfo?.hasNextPage) {
        console.warn(`[ShopCatalog] product ${node.legacyResourceId} has more than ${VARIANTS_PER_PRODUCT} variants — extra variants not synced`);
    }
};

const fetchProductsPage = async (after = null) => {
    const data = await graphql(
        `query ($first: Int!, $after: String) {
           products(first: $first, after: $after, sortKey: ID) {
             pageInfo { hasNextPage endCursor }
             nodes { ${PRODUCT_FIELDS} }
           }
         }`,
        { first: PRODUCTS_PER_PAGE, after }
    );
    data.products.nodes.forEach(warnIfVariantsTruncated);
    return data.products;
};

const fetchProduct = async (productId) => {
    const data = await graphql(
        `query ($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
        { id: `gid://shopify/Product/${productId}` }
    );
    if (data.product) warnIfVariantsTruncated(data.product);
    return data.product || null;
};

const fetchCollectionsPage = async (after = null) => {
    const data = await graphql(
        `query ($first: Int!, $after: String) {
           collections(first: $first, after: $after, sortKey: ID) {
             pageInfo { hasNextPage endCursor }
             nodes { ${COLLECTION_FIELDS} }
           }
         }`,
        { first: COLLECTIONS_PER_PAGE, after }
    );
    return data.collections;
};

const fetchCollection = async (collectionId) => {
    const data = await graphql(
        `query ($id: ID!) { collection(id: $id) { ${COLLECTION_FIELDS} } }`,
        { id: `gid://shopify/Collection/${collectionId}` }
    );
    return data.collection || null;
};

// All product ids in one collection (for refreshing membership after collections/update).
const fetchCollectionProductIds = async (collectionId) => {
    const ids = [];
    let after = null;
    do {
        const data = await graphql(
            `query ($id: ID!, $first: Int!, $after: String) {
               collection(id: $id) {
                 products(first: $first, after: $after) {
                   pageInfo { hasNextPage endCursor }
                   nodes { legacyResourceId }
                 }
               }
             }`,
            { id: `gid://shopify/Collection/${collectionId}`, first: COLLECTION_PRODUCT_IDS_PER_PAGE, after }
        );
        const conn = data.collection?.products;
        if (!conn) return null; // collection gone
        conn.nodes.forEach((n) => ids.push(String(n.legacyResourceId)));
        after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (after);
    return ids;
};

module.exports = {
    fetchProductsPage,
    fetchProduct,
    fetchCollectionsPage,
    fetchCollection,
    fetchCollectionProductIds,
};
