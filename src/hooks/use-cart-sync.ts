import { useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";

export function useCartSync() {
  const syncCart = useCartStore((state) => state.syncCart);
  useEffect(() => {
    void syncCart();
    const handleVisibility = () => { if (document.visibilityState === "visible") void syncCart(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncCart]);
}