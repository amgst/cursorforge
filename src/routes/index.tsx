import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, Pencil, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import { CartButton, CartDrawer } from "@/components/cart-drawer";
import { useCartSync } from "@/hooks/use-cart-sync";
import { getProducts, type ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cart-store";

export const Route = createFileRoute("/")({
  loader: () => getProducts(12),
  head: () => ({ meta: [
    { title: "CursorForge — Custom Cursor Studio" },
    { name: "description", content: "Create, preview, customize, and shop precision cursors in one playful studio." },
    { property: "og:title", content: "CursorForge — Custom Cursor Studio" },
    { property: "og:description", content: "Create, preview, customize, and shop precision cursors in one playful studio." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CursorStudio,
});

const states = ["Default", "Pointer", "Text", "Loading"] as const;
const presets = [
  { name: "Neon", color: "bg-primary" }, { name: "Mint", color: "bg-mint" },
  { name: "Frost", color: "bg-sky" }, { name: "Amber", color: "bg-sun" },
];

function CursorStudio() {
  const products = Route.useLoaderData();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeState, setActiveState] = useState<(typeof states)[number]>("Default");
  const [size, setSize] = useState(42);
  const [hotspotX, setHotspotX] = useState(8);
  const [hotspotY, setHotspotY] = useState(8);
  const [outline, setOutline] = useState(2);
  const [shadow, setShadow] = useState(true);
  const [trail, setTrail] = useState(8);
  const [cursorImage, setCursorImage] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 48 });
  const uploadRef = useRef<HTMLInputElement>(null);
  useCartSync();
  useEffect(() => () => { if (cursorImage) URL.revokeObjectURL(cursorImage); }, [cursorImage]);

  const transform = useMemo(() => ({ left: `${cursorPosition.x}%`, top: `${cursorPosition.y}%` }), [cursorPosition]);
  const handleUpload = (file?: File) => { if (!file) return; if (cursorImage) URL.revokeObjectURL(cursorImage); setCursorImage(URL.createObjectURL(file)); setDrawing(false); };
  const downloadPreset = () => {
    const blob = new Blob([JSON.stringify({ name: "Aurora set", state: activeState, size, hotspot: [hotspotX, hotspotY], outline, shadow, trail }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "cursorforge-aurora.json"; link.click(); URL.revokeObjectURL(link.href);
  };

  return <div className="min-h-screen bg-workshop text-foreground">
    <input ref={uploadRef} type="file" accept="image/png,image/gif,image/svg+xml" className="hidden" onChange={(event) => handleUpload(event.target.files?.[0])} />
    <header className="flex h-14 items-center gap-4 border-b border-border bg-panel/95 px-3 sm:px-4">
      <div className="flex shrink-0 items-center gap-2.5"><div className="relative grid size-8 place-items-center rounded-md bg-primary"><span className="cursor-mark" /></div><div className="leading-none"><div className="text-sm font-semibold">CursorForge</div><div className="mt-1 hidden font-mono text-[9px] uppercase text-muted-foreground sm:block">Precision cursor studio</div></div></div>
      <div className="mx-auto hidden items-center gap-2 md:flex"><span className="font-mono text-[10px] uppercase text-muted-foreground">Project</span><div className="flex items-center gap-2 rounded-md bg-paper px-3 py-1.5 text-ink"><span className="text-sm font-medium">Aurora set</span><span className="font-mono text-[9px] text-ink/50">v1.2</span></div><Button variant="panel" onClick={() => setSaved(true)}>{saved ? <Check size={14}/> : null}{saved ? "Duplicated" : "Duplicate"}</Button></div>
      <div className="ml-auto flex items-center gap-2"><CartButton open={cartOpen} onOpenChange={setCartOpen}/><Button className="hidden sm:inline-flex" onClick={downloadPreset}><Download size={15}/>Export</Button></div>
    </header>

    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[192px_minmax(0,1fr)_256px]">
      <aside className="order-2 border-t border-border bg-panel p-3 lg:order-none lg:border-r lg:border-t-0">
        <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">Assets</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1"><Button variant="sun" onClick={() => uploadRef.current?.click()}><Upload size={15}/>Upload image</Button><Button variant="panel" onClick={() => { setDrawing(true); setCursorImage(null); }}><Pencil size={15}/>Draw cursor</Button></div>
        <p className="mb-2 mt-5 font-mono text-[10px] uppercase text-muted-foreground">Library</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">{presets.map((preset, index) => <button key={preset.name} onClick={() => { setCursorImage(null); setSize(28 + index * 8); }} className="flex items-center gap-2 rounded-md p-2 text-left text-sm text-muted-foreground transition hover:bg-panel-raised hover:text-foreground"><span className={`grid size-6 place-items-center rounded-sm text-[10px] font-bold text-ink ${preset.color}`}>{preset.name[0]}</span>{preset.name}</button>)}</div>
        <p className="mt-4 font-mono text-[9px] text-muted-foreground">98 PRODUCTS IN STORE</p>
      </aside>

      <main className="order-1 flex min-h-[520px] min-w-0 flex-col lg:order-none">
        <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-border px-3 py-1.5"><div className="flex rounded-md bg-panel-raised p-1">{states.map((state) => <button key={state} onClick={() => setActiveState(state)} className={`h-7 rounded-md px-2.5 font-mono text-[10px] transition sm:px-3 ${activeState === state ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{state}</button>)}</div><div className="ml-auto flex gap-2 font-mono text-[9px] text-muted-foreground"><span>HOTSPOT {hotspotX},{hotspotY}</span><span>/</span><span>{size}px</span></div></div>
        <div className="cursor-grid relative flex-1 overflow-hidden bg-workshop" onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setCursorPosition({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 }); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleUpload(event.dataTransfer.files[0]); }}>
          <div className="pointer-events-none absolute -translate-x-[var(--hotspot-x)] -translate-y-[var(--hotspot-y)]" style={{ ...transform, "--hotspot-x": `${(hotspotX / Math.max(size, 1)) * 100}%`, "--hotspot-y": `${(hotspotY / Math.max(size, 1)) * 100}%` } as React.CSSProperties}>
            {cursorImage ? <img src={cursorImage} alt="Uploaded cursor preview" className={shadow ? "cursor-preview-shadow object-contain" : "object-contain"} style={{ width: size, height: size }} /> : drawing ? <div className="cursor-pulse rounded-full border-4 border-sky bg-mint" style={{ width: size, height: size }} /> : <div className={activeState === "Loading" ? "cursor-pulse" : ""} style={{ width: size, height: size }}><svg viewBox="0 0 64 64" className={shadow ? "cursor-preview-shadow size-full" : "size-full"} aria-label="Cursor preview"><path d="M8 4 52 36 30 39 20 58Z" fill="var(--primary)" stroke="var(--paper)" strokeWidth={outline}/></svg></div>}
            <span className="absolute left-0 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sun ring-2 ring-workshop" />
          </div>
          <div className="absolute left-4 top-3 font-mono text-[9px] text-muted-foreground">LIVE PREVIEW · MOVE ANYWHERE</div><div className="absolute right-4 top-3 font-mono text-[9px] text-mint">● TRACKING</div><div className="absolute bottom-3 left-4 font-mono text-[9px] text-muted-foreground">DROP PNG / GIF / SVG · GRID 22</div>
        </div>
        <div className="border-t border-border bg-panel px-4 py-3"><div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">Presets</span>{presets.map((preset) => <Button key={preset.name} variant="panel" onClick={() => setCursorImage(null)} className="shrink-0"><span className={`size-4 rounded-sm ${preset.color}`}/>{preset.name}</Button>)}<Button variant="paper" className="shrink-0" onClick={() => setSaved(true)}>{saved ? <Check size={14}/> : null}{saved ? "Saved" : "+ Save current"}</Button></div></div>
      </main>

      <aside className="order-3 border-t border-border bg-panel p-3.5 lg:border-l lg:border-t-0"><p className="mb-5 font-mono text-[10px] uppercase text-muted-foreground">Inspector</p><Control label="Size" value={`${size} px`} accent="text-sun"><input aria-label="Cursor size" type="range" min="16" max="96" value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-full accent-[var(--sun)]"/></Control><Control label="Hotspot" value={`X ${hotspotX} · Y ${hotspotY}`} accent="text-primary"><div className="grid grid-cols-2 gap-2"><NumberInput label="Hotspot X" value={hotspotX} setValue={setHotspotX}/><NumberInput label="Hotspot Y" value={hotspotY} setValue={setHotspotY}/></div></Control><Control label="Outline" value={`${outline} px`} accent="text-sky"><Segmented values={[0,2,4]} active={outline} setActive={setOutline}/></Control><Control label="Shadow" value={shadow ? "soft" : "off"} accent="text-mint"><Segmented values={["On","Off"]} active={shadow ? "On" : "Off"} setActive={(value) => setShadow(value === "On")}/></Control><Control label="Trail" value={`${trail} ms`}><input aria-label="Cursor trail" type="range" min="0" max="20" value={trail} onChange={(event) => setTrail(Number(event.target.value))} className="w-full accent-[var(--primary)]"/></Control><div className="mt-6 border-t border-border pt-4"><Button className="w-full" onClick={downloadPreset}><Download size={15}/>Export cursor set</Button><p className="mt-3 text-center font-mono text-[9px] uppercase text-muted-foreground">PNG · GIF · CUR preset</p></div></aside>
    </div>
    <ProductShelf products={products} onCartOpen={() => setCartOpen(true)}/>
    <CartDrawer open={cartOpen} onOpenChange={setCartOpen}/>
  </div>;
}

function Control({ label, value, accent = "text-muted-foreground", children }: { label: string; value: string; accent?: string; children: React.ReactNode }) { return <div className="mb-5"><div className="mb-2 flex justify-between"><label className="text-sm font-medium">{label}</label><span className={`font-mono text-[10px] ${accent}`}>{value}</span></div>{children}</div>; }
function NumberInput({ label, value, setValue }: { label: string; value: number; setValue: (value: number) => void }) { return <input aria-label={label} type="number" min="0" max="96" value={value} onChange={(event) => setValue(Number(event.target.value))} className="h-9 min-w-0 rounded-md border border-border bg-panel-raised px-2.5 font-mono text-sm text-foreground outline-none focus:border-sun"/>; }
function Segmented<T extends string | number>({ values, active, setActive }: { values: T[]; active: T; setActive: (value: T) => void }) { return <div className="inline-flex rounded-md bg-panel-raised p-1">{values.map((value) => <button key={value} onClick={() => setActive(value)} className={`h-7 min-w-12 rounded-md px-3 font-mono text-[10px] ${active === value ? "bg-sky font-bold text-ink" : "text-muted-foreground"}`}>{value}</button>)}</div>; }

function ProductShelf({ products, onCartOpen }: { products: ShopifyProduct[]; onCartOpen: () => void }) {
  const addItem = useCartStore((state) => state.addItem); const loading = useCartStore((state) => state.isLoading);
  return <section className="bg-paper py-9 text-ink"><div className="mx-auto max-w-7xl px-5"><div className="mb-5 flex items-end justify-between gap-4"><div><p className="font-mono text-[9px] uppercase text-ink/50">Live Shopify catalog</p><h2 className="mt-1 text-3xl font-bold">Ready-made additions</h2><p className="mt-1 text-sm text-ink/55">Real products from your connected store.</p></div><span className="shrink-0 font-mono text-[10px] text-ink/45">98 ITEMS</span></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{products.slice(0, 8).map((product) => { const variant = product.node.variants.edges.find((edge) => edge.node.availableForSale)?.node; const image = product.node.images.edges[0]?.node; return <article key={product.node.id} className="group min-w-0"><Link to="/product/$handle" params={{ handle: product.node.handle }} className="block aspect-square overflow-hidden rounded-md bg-ink/5 ring-1 ring-ink/10">{image ? <img src={image.url} alt={image.altText ?? product.node.title} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"/> : <div className="grid size-full place-items-center font-mono text-[9px] text-ink/40">NO IMAGE</div>}</Link><div className="mt-3"><Link to="/product/$handle" params={{ handle: product.node.handle }} className="line-clamp-2 min-h-10 text-sm font-semibold hover:text-primary">{product.node.title}</Link><div className="mt-2 flex items-center justify-between gap-2"><span className="font-mono text-xs">{product.node.priceRange.minVariantPrice.currencyCode} {Number(product.node.priceRange.minVariantPrice.amount).toFixed(2)}</span><Button variant="panel" className="h-8 bg-ink px-2.5 text-paper" disabled={!variant || loading} onClick={async () => { if (!variant) return; await addItem({ product, variantId: variant.id, variantTitle: variant.title, price: variant.price, quantity: 1, selectedOptions: variant.selectedOptions }); onCartOpen(); }}>Add</Button></div></div></article>; })}</div></div></section>;
}