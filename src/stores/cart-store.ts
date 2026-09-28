import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CART_ADD, CART_CREATE, CART_QUERY, CART_REMOVE, CART_UPDATE, checkoutUrlWithChannel, storefrontApiRequest, type Money, type ShopifyProduct } from "@/lib/shopify";

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: Money;
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

interface CartState {
  items: CartItem[]; cartId: string | null; checkoutUrl: string | null; isLoading: boolean; isSyncing: boolean;
  addItem: (item: Omit<CartItem, "lineId">) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void; syncCart: () => Promise<void>;
}

type UserError = { message: string };
const cartMissing = (errors: UserError[]) => errors.some((error) => /not found|does not exist/i.test(error.message));

export const useCartStore = create<CartState>()(persist((set, get) => ({
  items: [], cartId: null, checkoutUrl: null, isLoading: false, isSyncing: false,
  clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
  addItem: async (item) => {
    set({ isLoading: true });
    try {
      const state = get();
      const existing = state.items.find((entry) => entry.variantId === item.variantId);
      if (!state.cartId) {
        const data = await storefrontApiRequest<{ cartCreate: { cart: { id: string; checkoutUrl: string; lines: { edges: Array<{ node: { id: string } }> } } | null; userErrors: UserError[] } }>(CART_CREATE, { input: { lines: [{ quantity: item.quantity, merchandiseId: item.variantId }] } });
        const cart = data.cartCreate.cart;
        if (!cart || data.cartCreate.userErrors.length) throw new Error(data.cartCreate.userErrors[0]?.message ?? "Could not create cart");
        set({ cartId: cart.id, checkoutUrl: checkoutUrlWithChannel(cart.checkoutUrl), items: [{ ...item, lineId: cart.lines.edges[0]?.node.id ?? null }] });
      } else if (existing?.lineId) {
        await get().updateQuantity(item.variantId, existing.quantity + item.quantity);
      } else {
        const data = await storefrontApiRequest<{ cartLinesAdd: { cart: { lines: { edges: Array<{ node: { id: string; merchandise: { id: string } } }> } }; userErrors: UserError[] } }>(CART_ADD, { cartId: state.cartId, lines: [{ quantity: item.quantity, merchandiseId: item.variantId }] });
        if (cartMissing(data.cartLinesAdd.userErrors)) return get().clearCart();
        if (data.cartLinesAdd.userErrors.length) throw new Error(data.cartLinesAdd.userErrors[0]?.message);
        const line = data.cartLinesAdd.cart.lines.edges.find((edge) => edge.node.merchandise.id === item.variantId);
        set({ items: [...get().items, { ...item, lineId: line?.node.id ?? null }] });
      }
    } finally { set({ isLoading: false }); }
  },
  updateQuantity: async (variantId, quantity) => {
    if (quantity <= 0) return get().removeItem(variantId);
    const state = get(); const item = state.items.find((entry) => entry.variantId === variantId);
    if (!state.cartId || !item?.lineId) return;
    set({ isLoading: true });
    try {
      const data = await storefrontApiRequest<{ cartLinesUpdate: { userErrors: UserError[] } }>(CART_UPDATE, { cartId: state.cartId, lines: [{ id: item.lineId, quantity }] });
      if (cartMissing(data.cartLinesUpdate.userErrors)) return get().clearCart();
      if (data.cartLinesUpdate.userErrors.length) throw new Error(data.cartLinesUpdate.userErrors[0]?.message);
      set({ items: get().items.map((entry) => entry.variantId === variantId ? { ...entry, quantity } : entry) });
    } finally { set({ isLoading: false }); }
  },
  removeItem: async (variantId) => {
    const state = get(); const item = state.items.find((entry) => entry.variantId === variantId);
    if (!state.cartId || !item?.lineId) return;
    set({ isLoading: true });
    try {
      const data = await storefrontApiRequest<{ cartLinesRemove: { userErrors: UserError[] } }>(CART_REMOVE, { cartId: state.cartId, lineIds: [item.lineId] });
      if (cartMissing(data.cartLinesRemove.userErrors)) return get().clearCart();
      const items = get().items.filter((entry) => entry.variantId !== variantId);
      if (items.length) set({ items }); else get().clearCart();
    } finally { set({ isLoading: false }); }
  },
  syncCart: async () => {
    const { cartId, isSyncing } = get(); if (!cartId || isSyncing) return;
    set({ isSyncing: true });
    try { const data = await storefrontApiRequest<{ cart: { totalQuantity: number } | null }>(CART_QUERY, { id: cartId }); if (!data.cart || data.cart.totalQuantity === 0) get().clearCart(); }
    catch (error) { console.error("Cart sync failed", error); }
    finally { set({ isSyncing: false }); }
  },
}), { name: "cursorforge-shopify-cart", storage: createJSONStorage(() => localStorage), partialize: ({ items, cartId, checkoutUrl }) => ({ items, cartId, checkoutUrl }) }));