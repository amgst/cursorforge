import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import { getProduct, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export const Route = createFileRoute("/product/$handle")({
  loader: ({ params }) => getProduct(params.handle),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.title ?? "Product"} — CursorForge` },
    { name: "description", content: loaderData?.description || "View this product in the CursorForge Shopify catalog." },
    { property: "og:title", content: `${loaderData?.title ?? "Product"} — CursorForge` },
    { property: "og:description", content: loaderData?.description || "View this product in the CursorForge Shopify catalog." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ...(loaderData?.images.edges[0]?.node.url ? [{ property: "og:image", content: loaderData.images.edges[0].node.url }, { name: "twitter:image", content: loaderData.images.edges[0].node.url }] : []),
  ] }),
  component: ProductDetail,
});

function ProductDetail() {
  const productNode = Route.useLoaderData(); const [cartOpen, setCartOpen] = useState(false); const [variantIndex, setVariantIndex] = useState(0); const addItem = useCartStore((state) => state.addItem);
  if (!productNode) return <div className="grid min-h-screen place-items-center bg-workshop"><div className="text-center"><h1 className="text-3xl font-bold">Product unavailable</h1><Link to="/" className="mt-4 inline-block text-sun">Back to studio</Link></div></div>;
  const product: ShopifyProduct = { node: productNode }; const variant = productNode.variants.edges[variantIndex]?.node; const image = productNode.images.edges[0]?.node;
  return <div className="min-h-screen bg-workshop text-foreground"><header className="flex h-14 items-center justify-between border-b border-border bg-panel px-4"><Link to="/" className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16}/>CursorForge Studio</Link><CartButton open={cartOpen} onOpenChange={setCartOpen}/></header><main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-2"> <div className="aspect-square overflow-hidden rounded-md bg-panel-raised">{image ? <img src={image.url} alt={image.altText ?? productNode.title} className="size-full object-cover"/> : <div className="grid size-full place-items-center font-mono text-muted-foreground">NO IMAGE</div>}</div><div className="flex flex-col justify-center"><p className="font-mono text-[10px] uppercase text-mint">{productNode.productType || "Shopify product"}</p><h1 className="mt-2 text-4xl font-bold">{productNode.title}</h1><p className="mt-4 text-muted-foreground">{productNode.description || "Product details are available at checkout."}</p>{productNode.variants.edges.length > 1 && <div className="mt-6"><label className="mb-2 block font-mono text-[10px] uppercase text-muted-foreground">Choose option</label><select className="h-11 w-full rounded-md border border-border bg-panel-raised px-3" value={variantIndex} onChange={(event) => setVariantIndex(Number(event.target.value))}>{productNode.variants.edges.map((edge, index) => <option key={edge.node.id} value={index}>{edge.node.title} — {edge.node.price.currencyCode} {Number(edge.node.price.amount).toFixed(2)}</option>)}</select></div>}<div className="mt-8 flex items-center justify-between"><span className="font-mono text-xl">{variant?.price.currencyCode} {variant ? Number(variant.price.amount).toFixed(2) : "—"}</span><Button disabled={!variant?.availableForSale} onClick={async () => { if (!variant) return; await addItem({ product, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions }); setCartOpen(true); }}><ShoppingCart size={16}/>{variant?.availableForSale ? "Add to cart" : "Unavailable"}</Button></div></div></main><CartDrawer open={cartOpen} onOpenChange={setCartOpen}/></div>;
}