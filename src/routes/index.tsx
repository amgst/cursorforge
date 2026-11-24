import { createFileRoute, Link } from "@tanstack/react-router";
import { CloudUpload, Gift, LoaderCircle, PartyPopper, Pencil, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import { DrawPad } from "@/components/draw-pad";
import { SetupGuide } from "@/components/setup-guide";
import { getSessionToken, isEmbeddedInAdmin, requestReview, showToast } from "@/lib/app-bridge";
import {
  CURSOR_IMAGE_MAX_BYTES, CURSOR_IMAGE_TYPES, CURSOR_STATES, DEFAULT_EFFECTS, DEFAULT_STATE_MODES, EFFECT_DEFAULT_COLORS, EFFECT_PAGES, EFFECT_STYLES, MULTICOLOR_EFFECTS, MULTICOLOR_TRAILS, TRAIL_STYLES,
  type CursorConfig, type CursorDesign, type CursorEffects, type CursorImage, type CursorStateId, type CursorStateMode, type DefaultCursorMode, type EffectPage, type TrailStyle,
} from "@/lib/cursor-config";
import { createEffects, type EffectOptions, type EffectsInstance } from "@/lib/cursor-effects";
import { deleteCursorImage, listCursorImages, loadCursorConfig, saveCursorConfig, uploadCursorImage } from "@/lib/cursor-config.functions";
import { buildCursorSvg, CURSOR_COLORS, CURSOR_SHAPES, DEFAULT_SHAPE_ID, getCursorShape, HOLIDAY_LOOKS, SHAPE_CATEGORIES, shapeHotspot, svgDataUri, type HolidayLook } from "@/lib/cursor-presets";
import { createTrail } from "@/lib/cursor-trail";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "CursorForge — Custom Cursor Studio" },
    { name: "description", content: "Design a custom cursor and publish it to your Shopify store." },
    { property: "og:title", content: "CursorForge — Custom Cursor Studio" },
    { property: "og:description", content: "Design a custom cursor and publish it to your Shopify store." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CursorStudio,
});

type StateTab = "default" | CursorStateId;
type Modes = Record<CursorStateId, CursorStateMode>;

// Each tab maps to CSS selectors in extensions/cursor-embed/blocks/cursor.liquid.
const STATE_TABS: Array<{ id: StateTab; label: string; target: string; systemCursor: string }> = [
  { id: "default", label: "Default", target: "Everywhere on your store", systemCursor: "default" },
  { id: "pointer", label: "Pointer", target: "Links and buttons", systemCursor: "pointer" },
  { id: "text", label: "Text", target: "Text fields", systemCursor: "text" },
  { id: "loading", label: "Loading", target: "While the next page loads", systemCursor: "progress" },
];
const MODE_OPTIONS: Array<{ id: CursorStateMode; label: string }> = [
  { id: "match", label: "Same as Default" }, { id: "system", label: "Standard cursor" }, { id: "custom", label: "Custom" },
];
const DEFAULT_MODE_OPTIONS = MODE_OPTIONS.filter((option): option is { id: DefaultCursorMode; label: string } => option.id !== "match");
const EFFECT_PAGE_LABELS: Record<EffectPage, string> = { index: "Home", product: "Product", collection: "Collection", cart: "Cart" };

/** A cursor design being edited. `image` is a blob: URL until published, then a Shopify CDN URL. */
interface Design { shapeId: string; color: string; size: number; hotspotX: number; hotspotY: number; outline: number; shadow: boolean; image: string | null; file: File | null }
type Designs = Record<StateTab, Design>;
interface Trail { style: TrailStyle | "off"; length: number; size: number; color: string | null }
type PublishState = "preview" | "never" | "published" | "standard" | "changed";

function newDesign(): Design {
  const [hotspotX, hotspotY] = shapeHotspot(DEFAULT_SHAPE_ID, 42);
  return { shapeId: DEFAULT_SHAPE_ID, color: CURSOR_COLORS[0].hex, size: 42, hotspotX, hotspotY, outline: 2, shadow: true, image: null, file: null };
}
function newDesigns(): Designs {
  return { default: newDesign(), pointer: newDesign(), text: newDesign(), loading: newDesign() };
}
const DEFAULT_TRAIL: Trail = { style: "sparkles", length: 8, size: 6, color: null };
function designFromSaved(saved: CursorDesign): Design {
  return { shapeId: getCursorShape(saved.shape).id, color: saved.color, size: saved.size, hotspotX: saved.hotspot_x, hotspotY: saved.hotspot_y, outline: saved.outline, shadow: saved.shadow, image: saved.image_url, file: null };
}
function designSvg(design: Design) {
  return buildCursorSvg(design.shapeId, { color: design.color, outline: design.outline, shadow: design.shadow, size: design.size });
}
function savedDesign(design: Design, imageUrl: string | null): CursorDesign {
  const round = (value: number) => Math.max(0, Math.round(value));
  return {
    size: design.size, hotspot_x: round(design.hotspotX), hotspot_y: round(design.hotspotY), color: design.color, outline: design.outline, shadow: design.shadow,
    image_url: imageUrl, shape: imageUrl ? null : design.shapeId, svg: imageUrl ? null : designSvg(design),
  };
}

/** Fingerprint of everything that gets published, for the Published / Unpublished changes badge. */
function designKeyOf(designs: Designs, defaultMode: DefaultCursorMode, modes: Modes, trail: Trail, effects: CursorEffects) {
  const strip = (design: Design) => ({ ...design, file: undefined, hotspotX: Math.round(design.hotspotX), hotspotY: Math.round(design.hotspotY), color: design.color.toLowerCase() });
  const effectsKey = { ...effects, color: effects.color?.toLowerCase() ?? null, pages: [...effects.pages].sort() };
  return JSON.stringify({ default: strip(designs.default), defaultMode, states: CURSOR_STATES.map((id) => [id, modes[id], modes[id] === "custom" ? strip(designs[id]) : null]), trail, effects: effectsKey });
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function CursorStudio() {
  const [activeState, setActiveState] = useState<StateTab>("default");
  const [designs, setDesigns] = useState<Designs>(newDesigns);
  const [defaultMode, setDefaultMode] = useState<DefaultCursorMode>("custom");
  const [modes, setModes] = useState<Modes>(DEFAULT_STATE_MODES);
  const [trail, setTrail] = useState<Trail>(DEFAULT_TRAIL);
  const [effects, setEffects] = useState<CursorEffects>(DEFAULT_EFFECTS);
  // Effects as last loaded from / published to the store. Reset to computer default keeps them.
  const publishedEffectsRef = useRef<CursorEffects>(DEFAULT_EFFECTS);
  const [drawing, setDrawing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 48 });
  const [publishing, setPublishing] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  // Design as last loaded from / published to the store; compared with the current design for the status badge.
  const [publishedKey, setPublishedKey] = useState<string | null>(null);
  // The store shows the normal computer cursor (published with enabled: false).
  const [liveStandard, setLiveStandard] = useState(false);
  const [resetting, setResetting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<EffectsInstance | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Cursor images already in the shop's Files (null while loading).
  const [library, setLibrary] = useState<CursorImage[] | null>(null);
  const [savingImages, setSavingImages] = useState(0);
  // Uploads to Shopify Files keyed by the local blob: URL, so each image is uploaded only once.
  const uploadsRef = useRef(new Map<string, Promise<CursorImage>>());

  const tab = STATE_TABS.find((item) => item.id === activeState) ?? STATE_TABS[0]!;
  const mode = activeState === "default" ? (defaultMode === "system" ? "system" : null) : modes[activeState];
  // States set to Match or Browser show (and start editing from) the Default design.
  const editingOwnDesign = mode === null || mode === "custom";
  const current = editingOwnDesign ? designs[activeState] : designs.default;
  /** The cursor a state shows on the store; null = the browser's own cursor. Match follows Default, including its Standard cursor. */
  const designFor = (id: StateTab): Design | null => {
    if (id === "default") return defaultMode === "system" ? null : designs.default;
    if (modes[id] === "system") return null;
    if (modes[id] === "custom") return designs[id];
    return defaultMode === "system" ? null : designs.default;
  };
  // The preview area under the pointer (null when the pointer is outside the preview).
  const [hoveredZone, setHoveredZone] = useState<StateTab | null>(null);
  const shownState = hoveredZone ?? activeState;
  const shownTab = STATE_TABS.find((item) => item.id === shownState) ?? STATE_TABS[0]!;
  const shownMode = shownState === "default" ? defaultMode : modes[shownState];
  const previewDesign = designFor(shownState);

  // Inside Shopify admin, start from the cursor that's currently published to the store.
  useEffect(() => {
    if (!isEmbeddedInAdmin()) return;
    setEmbedded(true);
    let cancelled = false;
    getSessionToken()
      .then((idToken) => loadCursorConfig({ data: { idToken } }))
      .then((config) => {
        if (cancelled || !config) return;
        const defaultDesign = designFromSaved(config);
        const nextDesigns: Designs = { default: defaultDesign, pointer: defaultDesign, text: defaultDesign, loading: defaultDesign };
        const nextModes = { ...DEFAULT_STATE_MODES };
        for (const id of CURSOR_STATES) {
          const saved = config.states[id];
          nextModes[id] = saved.mode;
          nextDesigns[id] = saved.design ? designFromSaved(saved.design) : { ...defaultDesign };
        }
        const nextTrail: Trail = { style: config.trail_enabled ? config.trail_style : "off", length: config.trail_length, size: config.trail_size, color: config.trail_color };
        setDesigns(nextDesigns); setDefaultMode(config.default_mode); setModes(nextModes); setTrail(nextTrail); setEffects(config.effects); setDrawing(false);
        publishedEffectsRef.current = config.effects;
        setPublishedKey(designKeyOf(nextDesigns, config.default_mode, nextModes, nextTrail, config.effects)); setLiveStandard(!config.enabled);
        // A returning merchant with a live custom cursor is past Shopify's 24-hour "recently installed" block,
        // so ask here too; asking only after Publish misses merchants who publish in their first session.
        if (config.enabled) requestReview(4000);
      })
      .catch((error: unknown) => showToast(`Couldn't load saved cursor: ${error instanceof Error ? error.message : String(error)}`, true));
    getSessionToken()
      .then((idToken) => listCursorImages({ data: { idToken } }))
      .then((images) => { if (!cancelled) setLibrary(images); })
      .catch((error: unknown) => { if (!cancelled) setLibrary([]); showToast(`Couldn't load your uploads: ${error instanceof Error ? error.message : String(error)}`, true); });
    return () => { cancelled = true; };
  }, []);

  const designKey = designKeyOf(designs, defaultMode, modes, trail, effects);
  const status: PublishState = !embedded ? "preview" : publishedKey === null ? "never" : publishedKey !== designKey ? "changed" : liveStandard ? "standard" : "published";
  const transform = useMemo(() => ({ left: `${cursorPosition.x}%`, top: `${cursorPosition.y}%` }), [cursorPosition]);
  // Shadow is baked into the SVG so the preview matches the storefront exactly.
  const previewSvg = useMemo(() => previewDesign && !previewDesign.image ? designSvg(previewDesign) : null, [previewDesign]);
  const trailOptions = useMemo(() => trail.style === "off" ? null : { style: trail.style, color: trail.color ?? designs.default.color, length: trail.length, size: trail.size }, [trail, designs.default.color]);
  // Live trail preview using the same engine as the storefront. The preview area remounts after drawing.
  useEffect(() => {
    const canvas = trailCanvasRef.current, preview = previewRef.current;
    if (!canvas || !preview || !trailOptions) return;
    const trailInstance = createTrail(canvas, preview, trailOptions);
    return () => trailInstance?.destroy();
  }, [drawing, trailOptions]);
  // Live effects preview using the same engine as the storefront, kept across option changes so
  // flakes don't restart while a slider moves.
  const effectOptions = useMemo<EffectOptions>(() => ({ style: effects.enabled ? effects.style : null, color: effects.color, density: effects.density, speed: effects.speed, size: effects.size }), [effects.enabled, effects.style, effects.color, effects.density, effects.speed, effects.size]);
  const effectOptionsRef = useRef(effectOptions);
  effectOptionsRef.current = effectOptions;
  useEffect(() => {
    const canvas = effectsCanvasRef.current;
    if (!canvas) return;
    const instance = createEffects(canvas, effectOptionsRef.current);
    effectsRef.current = instance;
    return () => { instance?.destroy(); effectsRef.current = null; };
  }, [drawing]);
  useEffect(() => { effectsRef.current?.update(effectOptions); }, [effectOptions]);
  const updateEffects = (patch: Partial<CursorEffects>) => setEffects((prev) => ({ ...prev, ...patch }));
  const toggleEffectPage = (page: EffectPage) => updateEffects({ pages: effects.pages.includes(page) ? effects.pages.filter((item) => item !== page) : [...effects.pages, page] });
  const scheduleInvalid = !!effects.start_date && !!effects.end_date && effects.end_date < effects.start_date;

  /** Edits the active state's design. Editing a Match/Browser state turns it into a Custom copy of Default. */
  const updateDesign = (patch: Partial<Design>) => {
    const id = activeState;
    if (id === "default") setDefaultMode("custom");
    const ownDesign = id === "default" || modes[id] === "custom";
    setDesigns((prev) => ({ ...prev, [id]: { ...(ownDesign ? prev[id] : prev.default), ...patch } }));
    if (id !== "default" && !ownDesign) setModes((prev) => ({ ...prev, [id]: "custom" }));
  };
  const setMode = (id: CursorStateId, next: CursorStateMode) => {
    if (next === "custom" && modes[id] !== "custom") setDesigns((prev) => ({ ...prev, [id]: { ...prev.default } }));
    setModes((prev) => ({ ...prev, [id]: next }));
  };
  const selectShape = (shapeId: string) => {
    const [hotspotX, hotspotY] = shapeHotspot(shapeId, current.size);
    updateDesign({ shapeId, image: null, file: null, hotspotX, hotspotY }); setDrawing(false);
  };
  /** Applies a holiday look: the Default cursor's shape and color plus a matching trail. Other settings are kept. */
  const applyLook = (look: HolidayLook) => {
    const [hotspotX, hotspotY] = shapeHotspot(look.shapeId, designs.default.size);
    setActiveState("default"); setDefaultMode("custom"); setDrawing(false);
    setDesigns((prev) => ({ ...prev, default: { ...prev.default, shapeId: look.shapeId, color: look.color, image: null, file: null, hotspotX, hotspotY } }));
    setTrail((prev) => ({ ...prev, style: look.trail.style, color: look.trail.color }));
  };
  const lookActive = (look: HolidayLook) =>
    defaultMode === "custom" && !designs.default.image && designs.default.shapeId === look.shapeId && designs.default.color.toLowerCase() === look.color && trail.style === look.trail.style && trail.color === look.trail.color;
  const selectColor = (color: string) => updateDesign(drawing ? { color } : { color, image: null, file: null });
  /** Uploads a local image to Shopify Files once; later calls for the same blob: URL reuse the upload. */
  const saveImage = (blobUrl: string, file: File) => {
    const existing = uploadsRef.current.get(blobUrl);
    if (existing) return existing;
    const pending = getSessionToken().then(async (idToken) => uploadCursorImage({ data: {
      idToken, filename: file.name, mimeType: file.type as (typeof CURSOR_IMAGE_TYPES)[number], dataBase64: await readFileAsBase64(file),
    } }));
    uploadsRef.current.set(blobUrl, pending);
    pending.catch(() => uploadsRef.current.delete(blobUrl));
    return pending;
  };
  /** Points every design using a local preview at its uploaded CDN URL. */
  const swapImage = (blobUrl: string, url: string) =>
    setDesigns((prev) => Object.fromEntries(Object.entries(prev).map(([id, design]) => [id, design.image === blobUrl ? { ...design, image: url, file: null } : design])) as Designs);
  const handleUpload = (file: File | undefined, patch: Partial<Design> = {}) => {
    if (!file) return;
    if (!(CURSOR_IMAGE_TYPES as readonly string[]).includes(file.type)) { showToast("Use a PNG, GIF, or SVG image.", true); return; }
    if (file.size > CURSOR_IMAGE_MAX_BYTES) { showToast("Cursor image must be 1 MB or smaller.", true); return; }
    const blobUrl = URL.createObjectURL(file);
    updateDesign({ image: blobUrl, file, ...patch }); setDrawing(false);
    // Inside Shopify admin, save to the shop's Files right away so the image isn't lost before publishing.
    if (!isEmbeddedInAdmin()) return;
    setSavingImages((count) => count + 1);
    saveImage(blobUrl, file)
      .then((image) => { swapImage(blobUrl, image.url); setLibrary((prev) => [image, ...(prev ?? []).filter((item) => item.id !== image.id)]); })
      .catch((error: unknown) => showToast(`Couldn't save image to your store: ${error instanceof Error ? error.message : String(error)}. It will be uploaded again when you publish.`, true))
      .finally(() => setSavingImages((count) => count - 1));
  };
  const selectUpload = (image: CursorImage) => { updateDesign({ image: image.url, file: null, hotspotX: 0, hotspotY: 0 }); setDrawing(false); };
  const deleteUpload = async (image: CursorImage) => {
    if (Object.values(designs).some((design) => design.image === image.url)) { showToast("This image is in use in one of your cursor states. Switch that state to another design first.", true); return; }
    if (!window.confirm("Delete this image from your store's Files?")) return;
    try {
      await deleteCursorImage({ data: { idToken: await getSessionToken(), fileId: image.id } });
      setLibrary((prev) => (prev ?? []).filter((item) => item.id !== image.id));
      showToast("Image deleted");
    } catch (error) {
      showToast(`Couldn't delete image: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  /** Removes all customization: the store goes back to the visitor's normal computer cursor and the editor starts over. */
  const resetToComputerDefault = async () => {
    if (!window.confirm("Remove your custom cursor and trail from the store and go back to the normal computer cursor? Your uploads stay in My uploads, and published celebration effects stay on.")) return;
    const keptEffects = publishedEffectsRef.current;
    const nextDesigns = newDesigns();
    const applyReset = () => { setDesigns(nextDesigns); setDefaultMode("custom"); setModes(DEFAULT_STATE_MODES); setTrail(DEFAULT_TRAIL); setDrawing(false); setActiveState("default"); };
    if (!embedded) { applyReset(); return; }
    setResetting(true);
    try {
      const config: CursorConfig = {
        enabled: false, default_mode: "custom", ...savedDesign(nextDesigns.default, null),
        trail_enabled: false, trail_style: DEFAULT_TRAIL.style === "off" ? "sparkles" : DEFAULT_TRAIL.style, trail_length: DEFAULT_TRAIL.length, trail_size: DEFAULT_TRAIL.size, trail_color: null,
        states: Object.fromEntries(CURSOR_STATES.map((id) => [id, { mode: DEFAULT_STATE_MODES[id], design: null }])) as CursorConfig["states"],
        effects: keptEffects,
      };
      await saveCursorConfig({ data: { idToken: await getSessionToken(), config } });
      applyReset();
      setPublishedKey(designKeyOf(nextDesigns, "custom", DEFAULT_STATE_MODES, DEFAULT_TRAIL, keptEffects)); setLiveStandard(true);
      showToast("Your store now uses the normal computer cursor");
    } catch (error) {
      showToast(`Reset failed: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      setResetting(false);
    }
  };

  const publishToStore = async () => {
    if (!isEmbeddedInAdmin()) { window.alert("Open CursorForge from your Shopify admin to publish the cursor to your store."); return; }
    if (scheduleInvalid) { showToast("The effect's end date is before its start date.", true); return; }
    setPublishing(true);
    try {
      // Reuses uploads already saved (or still saving) to Files, so each image is uploaded once.
      const upload = async (design: Design) => {
        if (!design.image?.startsWith("blob:")) return design.image;
        if (!design.file) return null;
        return (await saveImage(design.image, design.file)).url;
      };
      const toSaved = async (design: Design) => savedDesign(design, (await upload(design)) ?? null);
      const stateEntries = await Promise.all(CURSOR_STATES.map(async (id) => [id, { mode: modes[id], design: modes[id] === "custom" ? await toSaved(designs[id]) : null }] as const));
      const config: CursorConfig = {
        enabled: true, default_mode: defaultMode, ...(await toSaved(designs.default)),
        trail_enabled: trail.style !== "off", trail_style: trail.style === "off" ? "sparkles" : trail.style,
        trail_length: trail.length, trail_size: trail.size, trail_color: trail.color,
        states: Object.fromEntries(stateEntries) as CursorConfig["states"],
        effects,
      };
      await saveCursorConfig({ data: { idToken: await getSessionToken(), config } });
      publishedEffectsRef.current = effects;

      // Swap local previews for the uploaded CDN URLs so the next publish doesn't upload again.
      const uploaded = new Map<string, string>();
      for (const design of Object.values(designs)) {
        const pending = design.image ? uploadsRef.current.get(design.image) : undefined;
        if (design.image && pending) uploaded.set(design.image, (await pending).url);
      }
      const published = Object.fromEntries(Object.entries(designs).map(([id, design]) => {
        const url = design.image ? uploaded.get(design.image) : undefined;
        return [id, url ? { ...design, image: url, file: null } : design];
      })) as Designs;
      setDesigns(published);
      setPublishedKey(designKeyOf(published, defaultMode, modes, trail, effects)); setLiveStandard(false);
      showToast("Cursor published to your store");
      // Publishing is the merchant's "it works" moment, so it's the right time to ask for a review.
      requestReview();
    } catch (error) {
      showToast(`Publish failed: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      setPublishing(false);
    }
  };

  return <div className="min-h-screen bg-workshop text-foreground">
    <input ref={uploadRef} type="file" accept="image/png,image/gif,image/svg+xml" className="hidden" onChange={(event) => { handleUpload(event.target.files?.[0]); event.target.value = ""; }} />
    <header className="flex h-14 items-center gap-4 border-b border-border bg-panel/95 px-3 sm:px-4">
      <div className="flex shrink-0 items-center gap-2.5"><div className="relative grid size-8 place-items-center rounded-md bg-primary"><span className="cursor-mark" /></div><div className="leading-none"><div className="text-sm font-semibold">CursorForge</div><div className="mt-1 hidden font-mono text-[9px] uppercase text-muted-foreground sm:block">Precision cursor studio</div></div></div>
      <div className="ml-auto flex items-center gap-3"><Link to="/privacy" title="Privacy policy" aria-label="Privacy policy" className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-panel-raised hover:text-foreground"><ShieldCheck size={15}/><span className="hidden md:inline">Privacy</span></Link><span className="hidden sm:inline"><PublishStatus status={status}/></span><PublishButton publishing={publishing} onPublish={publishToStore}/></div>
    </header>
    <SetupGuide apiKey={import.meta.env.VITE_SHOPIFY_API_KEY} embedded={embedded} published={publishedKey !== null}/>

    <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[192px_minmax(0,1fr)_256px]">
      <aside className="order-2 flex flex-col border-t border-border bg-panel p-3 lg:sticky lg:top-0 lg:order-none lg:h-[calc(100vh-3.5rem)] lg:self-start lg:border-r lg:border-t-0">
        <p className="mb-2 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">Assets</p>
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-1"><Button variant="sun" onClick={() => uploadRef.current?.click()}><Upload size={15}/>Upload image</Button><Button variant={drawing ? "sun" : "panel"} onClick={() => setDrawing(true)}><Pencil size={15}/>Draw cursor</Button></div>
        {embedded ? <section className="mt-5 shrink-0" aria-label="My uploads">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">My uploads{savingImages > 0 ? <><LoaderCircle size={10} className="animate-spin"/>saving…</> : library ? ` · ${library.length}` : ""}</p>
          {library === null ? <p className="text-xs text-muted-foreground">Loading…</p> : library.length === 0 ? <p className="text-xs text-muted-foreground">Images you upload or draw are saved to your store's Files and appear here.</p> : <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-6 lg:grid-cols-3">{library.map((image) => { const active = mode !== "system" && current.image === image.url; return <div key={image.id} className="group relative">
            <button type="button" title="Use this image" aria-label="Use uploaded cursor image" aria-pressed={active} onClick={() => selectUpload(image)} className={`grid aspect-square w-full place-items-center rounded-md bg-panel-raised p-1.5 ${active ? "ring-1 ring-sun" : "hover:ring-1 hover:ring-border"}`}><img src={image.url} alt="" loading="lazy" className="max-h-8 max-w-8 object-contain"/></button>
            <button type="button" aria-label="Delete uploaded image" title="Delete from your store's Files" onClick={() => void deleteUpload(image)} className="absolute -right-1 -top-1 hidden size-4 place-items-center rounded-full bg-ink text-paper ring-1 ring-border group-hover:grid focus-visible:grid"><X size={10}/></button>
          </div>; })}</div>}
        </section> : null}
        <p className="mb-2 mt-5 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">Library · {CURSOR_SHAPES.length} shapes</p>
        <div className="scroll-slim -mr-2 max-h-80 min-h-0 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
        {SHAPE_CATEGORIES.map((category) => <section key={category} className="mb-3" aria-label={`${category} shapes`}><p className="sticky top-0 z-10 mb-1 bg-panel py-1 font-mono text-[9px] uppercase text-muted-foreground/70">{category}</p><div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">{CURSOR_SHAPES.filter((shape) => shape.category === category).map((shape) => { const active = mode !== "system" && !current.image && !drawing && current.shapeId === shape.id; return <button key={shape.id} type="button" title={shape.name} aria-label={`${shape.name} cursor`} aria-pressed={active} onClick={() => selectShape(shape.id)} className={`flex flex-col items-center gap-1 rounded-md p-1.5 text-[9px] transition ${active ? "bg-panel-raised text-foreground ring-1 ring-sun" : "text-muted-foreground hover:bg-panel-raised hover:text-foreground"}`}><img src={svgDataUri(buildCursorSvg(shape.id, { color: current.color, outline: 2, shadow: false, size: 28 }))} alt="" className="size-7"/>{shape.name}</button>; })}</div></section>)}
        </div>
      </aside>

      <main className="order-1 flex min-h-[520px] min-w-0 flex-col lg:sticky lg:top-0 lg:order-none lg:h-[calc(100vh-3.5rem)] lg:self-start">
        <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
          <div className="flex rounded-md bg-panel-raised p-1" role="tablist" aria-label="Cursor state">{STATE_TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeState === item.id} title={item.target} onClick={() => { setActiveState(item.id); setDrawing(false); }} className={`h-7 rounded-md px-2.5 font-mono text-[10px] transition sm:px-3 ${activeState === item.id ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{item.label}{item.id === "default" ? (defaultMode === "custom" ? " •" : "") : modes[item.id] === "custom" ? " •" : ""}</button>)}</div>
          {activeState === "default" ? <ModePicker options={DEFAULT_MODE_OPTIONS} mode={defaultMode} onChange={setDefaultMode}/> : <ModePicker options={MODE_OPTIONS} mode={modes[activeState]} onChange={(next) => setMode(activeState, next)}/>}
          <div className="ml-auto flex gap-2 font-mono text-[9px] text-muted-foreground"><span>HOTSPOT {Math.round(current.hotspotX)},{Math.round(current.hotspotY)}</span><span>/</span><span>{current.size}px</span></div>
        </div>
        {drawing ? null : <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-panel px-3 py-2" aria-label="Holiday looks"><span className="flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase text-holly"><Gift size={12}/>Holiday looks</span>{HOLIDAY_LOOKS.map((look) => { const active = lookActive(look); return <button key={look.id} type="button" aria-pressed={active} title={`${look.name} cursor with a ${look.trail.style} trail`} onClick={() => applyLook(look)} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-panel-raised px-2.5 text-xs font-medium transition ${active ? "text-foreground ring-1 ring-sun" : "text-muted-foreground hover:text-foreground"}`}><img src={svgDataUri(buildCursorSvg(look.shapeId, { color: look.color, outline: 2, shadow: false, size: 20 }))} alt="" className="size-5"/>{look.name}</button>; })}</div>}
        {drawing ? <div className="cursor-grid flex flex-1 bg-workshop"><DrawPad color={current.color} onColorChange={(color) => updateDesign({ color })} onCancel={() => setDrawing(false)} onDone={(file) => handleUpload(file, { hotspotX: 0, hotspotY: 0 })}/></div> : <div ref={previewRef} className="cursor-grid cursor-preview relative flex-1 overflow-hidden bg-workshop" style={{ cursor: previewDesign ? "none" : shownTab.systemCursor }} onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setCursorPosition({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 }); setHoveredZone(((event.target as HTMLElement).closest<HTMLElement>("[data-cursor-zone]")?.dataset["cursorZone"] as StateTab | undefined) ?? "default"); }} onPointerLeave={() => setHoveredZone(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleUpload(event.dataTransfer.files[0]); }}>
          {/* A mini storefront: hover each area to see the cursor shoppers get there; click one to edit that state. */}
          <div className="absolute inset-0 grid place-items-center overflow-y-auto px-4 py-10"><div className="grid w-full max-w-xl grid-cols-2 gap-3">
            {STATE_TABS.map((item) => <PreviewZone key={item.id} tab={item} active={activeState === item.id} standard={designFor(item.id) === null} onSelect={() => { setActiveState(item.id); setDrawing(false); }}/>)}
          </div></div>
          <canvas ref={effectsCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] size-full" />
          <canvas ref={trailCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 size-full" />
          {previewDesign ? <div className="pointer-events-none absolute z-20 -translate-x-[var(--hotspot-x)] -translate-y-[var(--hotspot-y)]" style={{ ...transform, "--hotspot-x": `${(previewDesign.hotspotX / Math.max(previewDesign.size, 1)) * 100}%`, "--hotspot-y": `${(previewDesign.hotspotY / Math.max(previewDesign.size, 1)) * 100}%` } as React.CSSProperties}>
            <img src={previewDesign.image ?? svgDataUri(previewSvg ?? "")} alt={`${shownTab.label} cursor preview`} className="object-contain" style={{ width: previewDesign.size, height: previewDesign.size }} />
            <span className="absolute left-0 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sun ring-2 ring-workshop" />
          </div> : null}
          <div className="absolute left-4 right-4 top-3 truncate font-mono text-[9px] uppercase text-muted-foreground sm:right-24">Live preview · hover each area · showing {shownTab.label} ({shownMode === "custom" ? "custom" : shownMode === "system" ? "standard" : `same as Default${defaultMode === "system" ? ", standard" : ""}`})</div><div className="absolute right-4 top-3 hidden font-mono text-[9px] text-mint sm:block">● TRACKING</div><div className="absolute bottom-3 left-4 hidden font-mono text-[9px] text-muted-foreground sm:block">DROP PNG / GIF / SVG · GRID 22</div>
        </div>}
        <div className="border-t border-border bg-panel px-4 py-3"><div className="flex items-center gap-2 overflow-x-auto"><span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">Colors</span>{CURSOR_COLORS.map((swatch) => { const active = mode !== "system" && current.color.toLowerCase() === swatch.hex; return <Button key={swatch.hex} variant="panel" aria-pressed={active} onClick={() => selectColor(swatch.hex)} className={`shrink-0 ${active ? "ring-1 ring-sun" : ""}`}><span className="size-4 rounded-sm ring-1 ring-border" style={{ background: swatch.hex }}/>{swatch.name}</Button>; })}<label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-panel-raised px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"><input aria-label="Custom cursor color" type="color" value={current.color} onChange={(event) => selectColor(event.target.value)} className="size-4 cursor-pointer border-0 bg-transparent p-0"/>Custom</label></div></div>
      </main>

      <aside className="scroll-slim order-3 border-t border-border bg-panel p-3.5 lg:sticky lg:top-0 lg:h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-t-0">
        <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Inspector · {tab.label}</p>
        <p className="mb-5 text-xs text-muted-foreground">{mode === "match" ? `${tab.target} use the Default cursor${defaultMode === "system" ? " (the standard computer cursor)" : ""}. Change anything below to customize it.` : mode === "system" ? `${tab.target} use the standard computer cursor. Change anything below to customize it.` : tab.target}</p>
        <Control label="Size" value={`${current.size} px`} accent="text-sun"><input aria-label="Cursor size" type="range" min="16" max="96" value={current.size} onChange={(event) => updateDesign({ size: Number(event.target.value) })} className="w-full accent-[var(--sun)]"/></Control>
        <Control label="Hotspot" value={`X ${Math.round(current.hotspotX)} · Y ${Math.round(current.hotspotY)}`} accent="text-primary"><div className="grid grid-cols-2 gap-2"><NumberInput label="Hotspot X" value={current.hotspotX} setValue={(hotspotX) => updateDesign({ hotspotX })}/><NumberInput label="Hotspot Y" value={current.hotspotY} setValue={(hotspotY) => updateDesign({ hotspotY })}/></div></Control>
        <Control label="Outline" value={`${current.outline} px`} accent="text-sky"><Segmented values={[0, 2, 4]} active={current.outline} setActive={(outline) => updateDesign({ outline })}/></Control>
        <Control label="Shadow" value={current.shadow ? "soft" : "off"} accent="text-mint"><Segmented values={["On", "Off"]} active={current.shadow ? "On" : "Off"} setActive={(value) => updateDesign({ shadow: value === "On" })}/></Control>
        <div className="mb-4 mt-6 border-t border-border pt-4 font-mono text-[10px] uppercase text-muted-foreground">Trail · all states</div>
        <Control label="Trail" value={trail.style} accent="text-primary"><div className="grid grid-cols-3 gap-1 rounded-md bg-panel-raised p-1">{(["off", ...TRAIL_STYLES] as const).map((style) => <button key={style} type="button" aria-pressed={trail.style === style} onClick={() => setTrail((prev) => ({ ...prev, style }))} className={`h-7 rounded-md px-2 font-mono text-[10px] capitalize ${trail.style === style ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{style}</button>)}</div></Control>
        {trail.style !== "off" ? <><Control label="Trail length" value={`${trail.length}`}><input aria-label="Trail length" type="range" min="3" max="20" value={trail.length} onChange={(event) => setTrail((prev) => ({ ...prev, length: Number(event.target.value) }))} className="w-full accent-[var(--primary)]"/></Control><Control label="Trail size" value={`${trail.size} px`}><input aria-label="Trail size" type="range" min="2" max="16" value={trail.size} onChange={(event) => setTrail((prev) => ({ ...prev, size: Number(event.target.value) }))} className="w-full accent-[var(--primary)]"/></Control>{MULTICOLOR_TRAILS.includes(trail.style) ? <p className="mb-5 text-xs text-muted-foreground">Festive sparkles are red, green, and gold.</p> : <Control label="Trail color" value={trail.color ?? "cursor"}><div className="flex items-center gap-2"><Segmented values={["Cursor", "Custom"]} active={trail.color ? "Custom" : "Cursor"} setActive={(value) => setTrail((prev) => ({ ...prev, color: value === "Custom" ? (prev.color ?? designs.default.color) : null }))}/>{trail.color ? <input aria-label="Trail color" type="color" value={trail.color} onChange={(event) => setTrail((prev) => ({ ...prev, color: event.target.value }))} className="size-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"/> : null}</div></Control>}</> : null}
        <div className="mb-4 mt-6 flex items-center gap-1.5 border-t border-border pt-4 font-mono text-[10px] uppercase text-muted-foreground"><PartyPopper size={12}/>Celebration effects · whole store</div>
        <Control label="Falling effect" value={effects.enabled ? effects.style : "off"} accent="text-primary"><div className="grid grid-cols-3 gap-1 rounded-md bg-panel-raised p-1">{(["off", ...EFFECT_STYLES] as const).map((style) => { const active = style === "off" ? !effects.enabled : effects.enabled && effects.style === style; return <button key={style} type="button" aria-pressed={active} onClick={() => updateEffects(style === "off" ? { enabled: false } : { enabled: true, style })} className={`h-7 rounded-md px-2 font-mono text-[10px] capitalize ${active ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{style}</button>; })}</div></Control>
        {effects.enabled ? <>
          <Control label="Amount" value={`${effects.density}`}><input aria-label="Effect amount" type="range" min="1" max="10" value={effects.density} onChange={(event) => updateEffects({ density: Number(event.target.value) })} className="w-full accent-[var(--primary)]"/></Control>
          <Control label="Speed" value={`${effects.speed}`}><input aria-label="Effect speed" type="range" min="1" max="10" value={effects.speed} onChange={(event) => updateEffects({ speed: Number(event.target.value) })} className="w-full accent-[var(--primary)]"/></Control>
          <Control label="Size" value={`${effects.size} px`}><input aria-label="Effect size" type="range" min="6" max="32" value={effects.size} onChange={(event) => updateEffects({ size: Number(event.target.value) })} className="w-full accent-[var(--primary)]"/></Control>
          {MULTICOLOR_EFFECTS.includes(effects.style) ? <p className="mb-5 text-xs text-muted-foreground">{effects.style === "confetti" ? "Confetti uses a mix of bright colors." : "Leaves use autumn reds, oranges, and golds."}</p> : <Control label="Effect color" value={effects.color ?? "default"}><div className="flex items-center gap-2"><Segmented values={["Default", "Custom"]} active={effects.color ? "Custom" : "Default"} setActive={(value) => updateEffects({ color: value === "Custom" ? (effects.color ?? EFFECT_DEFAULT_COLORS[effects.style]) : null })}/>{effects.color ? <input aria-label="Effect color" type="color" value={effects.color} onChange={(event) => updateEffects({ color: event.target.value })} className="size-7 cursor-pointer rounded-sm border-0 bg-transparent p-0"/> : null}</div></Control>}
          <Control label="Show on" value={effects.pages.length ? `${effects.pages.length} page type${effects.pages.length > 1 ? "s" : ""}` : "all pages"}><div className="flex flex-wrap gap-1"><Chip active={effects.pages.length === 0} onClick={() => updateEffects({ pages: [] })}>All pages</Chip>{EFFECT_PAGES.map((page) => <Chip key={page} active={effects.pages.includes(page)} onClick={() => toggleEffectPage(page)}>{EFFECT_PAGE_LABELS[page]}</Chip>)}</div></Control>
          <Control label="Schedule" value={effects.start_date || effects.end_date ? "dates set" : "always"}><div className="grid grid-cols-2 gap-2"><DateInput label="Start date" value={effects.start_date} setValue={(start_date) => updateEffects({ start_date })}/><DateInput label="End date" value={effects.end_date} setValue={(end_date) => updateEffects({ end_date })}/></div><p className={`mt-1.5 text-xs ${scheduleInvalid ? "text-holly" : "text-muted-foreground"}`}>{scheduleInvalid ? "End date is before the start date." : "Optional. Uses each shopper's local date, so a holiday effect can switch itself on and off."}</p></Control>
        </> : null}
        <Control label="Add-to-cart confetti" value={effects.cart_burst ? "on" : "off"} accent="text-mint"><div className="flex items-center gap-2"><Segmented values={["On", "Off"]} active={effects.cart_burst ? "On" : "Off"} setActive={(value) => updateEffects({ cart_burst: value === "On" })}/><Button variant="panel" onClick={() => effectsRef.current?.burst()} disabled={drawing} title="Show the burst in the preview">Preview</Button></div><p className="mt-1.5 text-xs text-muted-foreground">A confetti burst when a shopper adds a product to the cart, on every page.</p></Control>
        <p className="mb-2 text-xs text-muted-foreground">Effects are skipped for shoppers who turn on reduced motion.</p>
        <div className="mt-6 border-t border-border pt-4"><Button variant="panel" className="mb-2 w-full" disabled={publishing || resetting || status === "standard"} onClick={() => void resetToComputerDefault()}>{resetting ? <LoaderCircle size={15} className="animate-spin"/> : <RotateCcw size={15}/>}Reset to computer default</Button><PublishButton publishing={publishing} onPublish={publishToStore} className="w-full"/><div className="mt-3 flex justify-center"><PublishStatus status={status}/></div></div>
      </aside>
    </div>
  </div>;
}

function Control({ label, value, accent = "text-muted-foreground", children }: { label: string; value: string; accent?: string; children: React.ReactNode }) { return <div className="mb-5"><div className="mb-2 flex justify-between"><label className="text-sm font-medium">{label}</label><span className={`font-mono text-[10px] ${accent}`}>{value}</span></div>{children}</div>; }
function NumberInput({ label, value, setValue }: { label: string; value: number; setValue: (value: number) => void }) { return <input aria-label={label} type="number" min="0" max="96" value={value} onChange={(event) => setValue(Number(event.target.value))} className="h-9 min-w-0 rounded-md border border-border bg-panel-raised px-2.5 font-mono text-sm text-foreground outline-none focus:border-sun"/>; }
function DateInput({ label, value, setValue }: { label: string; value: string | null; setValue: (value: string | null) => void }) { return <input aria-label={label} title={label} type="date" value={value ?? ""} onChange={(event) => setValue(event.target.value || null)} className="h-9 min-w-0 rounded-md border border-border bg-panel-raised px-2 font-mono text-[11px] text-foreground outline-none [color-scheme:dark] focus:border-sun"/>; }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`h-7 rounded-md px-2.5 font-mono text-[10px] ${active ? "bg-sky font-bold text-ink" : "bg-panel-raised text-muted-foreground hover:text-foreground"}`}>{children}</button>; }
function Segmented<T extends string | number>({ values, active, setActive }: { values: T[]; active: T; setActive: (value: T) => void }) { return <div className="inline-flex rounded-md bg-panel-raised p-1">{values.map((value) => <button key={value} onClick={() => setActive(value)} className={`h-7 min-w-12 rounded-md px-3 font-mono text-[10px] ${active === value ? "bg-sky font-bold text-ink" : "text-muted-foreground"}`}>{value}</button>)}</div>; }
function ModePicker<T extends CursorStateMode>({ options, mode, onChange }: { options: Array<{ id: T; label: string }>; mode: T; onChange: (mode: T) => void }) {
  return <div className="inline-flex rounded-md bg-panel-raised p-1" role="radiogroup" aria-label="Cursor for this state">{options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={mode === option.id} title={option.id === "match" ? "Use the Default cursor" : option.id === "system" ? "Use the normal system cursor" : "Design a separate cursor"} onClick={() => onChange(option.id)} className={`h-7 rounded-md px-2.5 font-mono text-[10px] ${mode === option.id ? "bg-sky font-bold text-ink" : "text-muted-foreground hover:text-foreground"}`}>{option.label}</button>)}</div>;
}
// Sample storefront content for each preview area, matching what each state targets on the store.
const ZONE_MOCKS: Record<StateTab, React.ReactNode> = {
  default: <><span className="h-2 w-4/5 rounded-full bg-muted-foreground/25"/><span className="h-2 w-3/5 rounded-full bg-muted-foreground/25"/><span className="h-2 w-2/3 rounded-full bg-muted-foreground/25"/></>,
  pointer: <><span className="inline-flex h-8 w-fit items-center rounded-md bg-sun px-3 text-xs font-semibold text-ink">Add to cart</span><span className="text-xs text-sky underline">View details</span></>,
  text: <span className="flex h-8 items-center rounded-md border border-border bg-workshop px-2.5 text-xs text-muted-foreground">Search products…<span className="ml-0.5 h-3.5 w-px animate-pulse bg-foreground"/></span>,
  loading: <><span className="h-1.5 overflow-hidden rounded-full bg-panel-raised"><span className="block h-full w-1/2 animate-pulse rounded-full bg-primary"/></span><span className="text-xs text-muted-foreground">Next page loading…</span></>,
};
function PreviewZone({ tab, active, standard, onSelect }: { tab: (typeof STATE_TABS)[number]; active: boolean; standard: boolean; onSelect: () => void }) {
  return <button type="button" data-cursor-zone={tab.id} aria-pressed={active} aria-label={`Edit the ${tab.label} cursor`} onClick={onSelect} className={`flex min-h-32 flex-col gap-3 rounded-lg border bg-panel/80 p-3 text-left transition sm:min-h-36 ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/50"}`}>
    <span className="flex items-baseline justify-between gap-2 font-mono text-[9px] uppercase"><span className={active ? "font-bold text-primary" : "text-muted-foreground"}>{tab.label}</span><span className="text-muted-foreground/70">{standard ? "standard" : "custom"}</span></span>
    <span aria-hidden="true" className="flex flex-1 flex-col justify-center gap-2">{ZONE_MOCKS[tab.id]}</span>
    <span className="font-mono text-[9px] text-muted-foreground">{tab.target}</span>
  </button>;
}
function PublishButton({ publishing, onPublish, className = "" }: { publishing: boolean; onPublish: () => void; className?: string }) {
  return <Button variant="sun" className={className} disabled={publishing} onClick={onPublish}>{publishing ? <LoaderCircle size={15} className="animate-spin"/> : <CloudUpload size={15}/>}{publishing ? "Publishing…" : "Publish to store"}</Button>;
}
function PublishStatus({ status }: { status: PublishState }) {
  const [label, tone] = {
    preview: ["Open in Shopify admin to publish", "text-muted-foreground"],
    never: ["Not published yet", "text-muted-foreground"],
    published: ["● Published", "text-mint"],
    standard: ["● Computer default cursor", "text-mint"],
    changed: ["● Unpublished changes", "text-sun"],
  }[status];
  return <span role="status" className={`font-mono text-[10px] uppercase ${tone}`}>{label}</span>;
}
