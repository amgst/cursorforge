import { z } from "zod";

export const TRAIL_STYLES = ["dots", "comet", "sparkles", "bubbles"] as const;
export type TrailStyle = (typeof TRAIL_STYLES)[number];

/** Cursor states besides Default. Each can match Default, use the browser's cursor, or be custom. */
export const CURSOR_STATES = ["pointer", "text", "loading"] as const;
export type CursorStateId = (typeof CURSOR_STATES)[number];
export const CURSOR_STATE_MODES = ["match", "system", "custom"] as const;
export type CursorStateMode = (typeof CURSOR_STATE_MODES)[number];
/** The Default cursor is either custom or the visitor's normal computer cursor. */
export const DEFAULT_CURSOR_MODES = ["custom", "system"] as const;
export type DefaultCursorMode = (typeof DEFAULT_CURSOR_MODES)[number];
export const DEFAULT_STATE_MODES: Record<CursorStateId, CursorStateMode> = {
  pointer: "match",
  text: "system",
  loading: "system",
};

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

// One cursor design. Liquid renders it from image_url, or from svg when there's no image.
const designShape = {
  size: z.number().int().min(16).max(128),
  hotspot_x: z.number().int().min(0).max(128),
  hotspot_y: z.number().int().min(0).max(128),
  color: hex,
  outline: z.number().int().min(0).max(8),
  shadow: z.boolean(),
  image_url: z.string().url().nullable(),
  // Built-in shape (see cursor-presets.ts) and its rendered SVG.
  // Defaults keep configs saved before presets existed valid.
  shape: z.string().max(40).nullable().default(null),
  svg: z.string().max(20000).startsWith("<svg").nullable().default(null),
};
export const cursorDesignSchema = z.object(designShape);
export type CursorDesign = z.infer<typeof cursorDesignSchema>;

const stateSchema = (mode: CursorStateMode) =>
  z
    .object({ mode: z.enum(CURSOR_STATE_MODES), design: cursorDesignSchema.nullable() })
    .default({ mode, design: null });

// Saved on the app installation as the `cursorforge.config` JSON metafield and read by
// the theme app extension (extensions/cursor-embed) as `app.metafields.cursorforge.config`.
// Keys are snake_case so Liquid can read them directly. The Default cursor's design is at the top level.
export const cursorConfigSchema = z.object({
  // false = the store shows the visitor's normal computer cursor (Reset to computer default).
  enabled: z.boolean().default(true),
  // system = the Default cursor is the normal computer cursor; states set to match follow it.
  default_mode: z.enum(DEFAULT_CURSOR_MODES).default("custom"),
  ...designShape,
  trail_enabled: z.boolean(),
  trail_length: z.number().int().min(3).max(20),
  trail_style: z.enum(TRAIL_STYLES).default("dots"),
  trail_size: z.number().int().min(2).max(16).default(6),
  // null = match the cursor color.
  trail_color: hex.nullable().default(null),
  states: z
    .object({
      pointer: stateSchema(DEFAULT_STATE_MODES.pointer),
      text: stateSchema(DEFAULT_STATE_MODES.text),
      loading: stateSchema(DEFAULT_STATE_MODES.loading),
    })
    .default({}),
});

export type CursorConfig = z.infer<typeof cursorConfigSchema>;

export const CURSOR_METAFIELD = { namespace: "cursorforge", key: "config" } as const;

export const CURSOR_IMAGE_TYPES = ["image/png", "image/gif", "image/svg+xml"] as const;
export const CURSOR_IMAGE_MAX_BYTES = 1024 * 1024;

/** Uploaded images are named `cursorforge-…` in the shop's Files so the app can list its own uploads. */
export const CURSOR_FILE_PREFIX = "cursorforge-";
export interface CursorImage {
  id: string;
  url: string;
}
