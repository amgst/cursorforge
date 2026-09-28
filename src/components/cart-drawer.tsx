import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/button";
import { useCartStore } from "@/stores/cart-store";

export function CartButton({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const items = useCartStore((state) => state.items);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return <Button variant="panel" onClick={() => onOpenChange(true)} aria-label={`Open cart with ${count} items`}><span className="font-mono text-[10px] text-mint">Shopify</span><ShoppingCart size={15} />Cart{count > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[10px] text-primary-foreground">{count}</span>}</Button>;
}

export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const { items, checkoutUrl, isLoading, updateQuantity, removeItem, syncCart } = useCartStore();
  useEffect(() => { if (open) void syncCart(); }, [open, syncCart]);
  if (!open) return null;
  const total = items.reduce((sum, item) => sum + Number(item.price.amount) * item.quantity, 0);
  const currency = items[0]?.price.currencyCode ?? "USD";
  return <div className="fixed inset-0 z-50 bg-overlay" onClick={() => onOpenChange(false)}>
    <aside className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex h-16 items-center justify-between border-b border-border px-5"><div><p className="font-mono text-[10px] uppercase text-muted-foreground">Shopify cart</p><h2 className="font-display text-xl font-bold">Your selection</h2></div><Button variant="ghost" className="size-9 p-0" onClick={() => onOpenChange(false)} aria-label="Close cart"><X size={18} /></Button></header>
      <div className="flex-1 overflow-y-auto p-5">{items.length === 0 ? <div className="grid h-full place-items-center text-center"><div><ShoppingCart className="mx-auto mb-3 text-muted-foreground" size={36}/><p className="font-semibold">Your cart is empty</p><p className="mt-1 text-sm text-muted-foreground">Add a real product from the shelf.</p></div></div> : <div className="space-y-4">{items.map((item) => <article key={item.variantId} className="flex gap-3 border-b border-border pb-4"><div className="size-16 shrink-0 overflow-hidden rounded-md bg-panel-raised">{item.product.node.images.edges[0] && <img src={item.product.node.images.edges[0].node.url} alt={item.product.node.images.edges[0].node.altText ?? item.product.node.title} className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.product.node.title}</p><p className="font-mono text-[10px] text-muted-foreground">{item.variantTitle}</p><p className="mt-1 text-sm">{item.price.currencyCode} {Number(item.price.amount).toFixed(2)}</p><div className="mt-2 flex items-center gap-1"><Button variant="panel" className="size-7 p-0" onClick={() => void updateQuantity(item.variantId, item.quantity - 1)}><Minus size={12}/></Button><span className="w-7 text-center font-mono text-xs">{item.quantity}</span><Button variant="panel" className="size-7 p-0" onClick={() => void updateQuantity(item.variantId, item.quantity + 1)}><Plus size={12}/></Button><Button variant="ghost" className="ml-auto size-7 p-0" onClick={() => void removeItem(item.variantId)} aria-label={`Remove ${item.product.node.title}`}><Trash2 size={13}/></Button></div></div></article>)}</div>}</div>
      {items.length > 0 && <footer className="border-t border-border p-5"><div className="mb-4 flex justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><strong>{currency} {total.toFixed(2)}</strong></div><Button className="w-full" disabled={isLoading || !checkoutUrl} onClick={() => { if (checkoutUrl) window.open(checkoutUrl, "_blank", "noopener,noreferrer"); onOpenChange(false); }}>Checkout with Shopify</Button><p className="mt-2 text-center font-mono text-[9px] text-muted-foreground">SECURE CHECKOUT OPENS IN A NEW TAB</p></footer>}
    </aside>
  </div>;
}