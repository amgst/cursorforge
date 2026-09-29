export const SHOPIFY_API_VERSION = "2025-07";
// Public Storefront credentials from .env; fallbacks keep Lovable builds working without env vars.
export const SHOPIFY_STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? "vgpcreatives.myshopify.com";
export const SHOPIFY_STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN ?? "3bb13278a3e681670b37ced0d6ac58d9";
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    productType: string;
    priceRange: { minVariantPrice: Money };
    images: { edges: Array<{ node: { url: string; altText: string | null } }> };
    variants: { edges: Array<{ node: ShopifyVariant }> };
    options: Array<{ name: string; values: string[] }>;
  };
}

export interface Money { amount: string; currencyCode: string }
export interface ShopifyVariant {
  id: string;
  title: string;
  price: Money;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

const PRODUCT_FIELDS = `
  id title description handle productType
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 5) { edges { node { url altText } } }
  variants(first: 30) { edges { node { id title availableForSale price { amount currencyCode } selectedOptions { name value } } } }
  options { name values }
`;

const PRODUCTS_QUERY = `query Products($first:Int!){ products(first:$first){ edges { node { ${PRODUCT_FIELDS} } } } }`;
const PRODUCT_QUERY = `query Product($handle:String!){ product(handle:$handle){ ${PRODUCT_FIELDS} } }`;

export async function storefrontApiRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Shopify request failed (${response.status})`);
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join(", "));
  if (!payload.data) throw new Error("Shopify returned no data");
  return payload.data;
}

export async function getProducts(first = 12) {
  const data = await storefrontApiRequest<{ products: { edges: ShopifyProduct[] } }>(PRODUCTS_QUERY, { first });
  return data.products.edges;
}

export async function getProduct(handle: string) {
  const data = await storefrontApiRequest<{ product: ShopifyProduct["node"] | null }>(PRODUCT_QUERY, { handle });
  return data.product;
}

export const CART_QUERY = `query Cart($id:ID!){ cart(id:$id){ id totalQuantity checkoutUrl } }`;
export const CART_CREATE = `mutation Create($input:CartInput!){ cartCreate(input:$input){ cart{ id checkoutUrl lines(first:100){ edges{ node{ id merchandise{ ... on ProductVariant{ id } } } } } } userErrors{ field message } } }`;
export const CART_ADD = `mutation Add($cartId:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$cartId,lines:$lines){ cart{ id checkoutUrl lines(first:100){ edges{ node{ id merchandise{ ... on ProductVariant{ id } } } } } } userErrors{ field message } } }`;
export const CART_UPDATE = `mutation Update($cartId:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$cartId,lines:$lines){ cart{ id } userErrors{ field message } } }`;
export const CART_REMOVE = `mutation Remove($cartId:ID!,$lineIds:[ID!]!){ cartLinesRemove(cartId:$cartId,lineIds:$lineIds){ cart{ id } userErrors{ field message } } }`;

export function checkoutUrlWithChannel(value: string) {
  try { const url = new URL(value); url.searchParams.set("channel", "online_store"); return url.toString(); }
  catch { return value; }
}