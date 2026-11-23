// The editor preview runs the exact effects engine that ships to the storefront
// (extensions/cursor-embed/assets/cursorforge-effects.js, served by a plugin in vite.config.ts).
import "virtual:cursorforge-effects";
import type { EffectStyle } from "@/lib/cursor-config";

export interface EffectOptions {
  /** null = no falling effect; bursts still work. */
  style: EffectStyle | null;
  color: string | null;
  density: number;
  speed: number;
  size: number;
}

export interface EffectsInstance {
  update: (options: EffectOptions) => void;
  burst: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    CursorForgeEffects?: {
      create: (config: { canvas: HTMLCanvasElement; options: EffectOptions }) => EffectsInstance;
    };
  }
}

export function createEffects(
  canvas: HTMLCanvasElement,
  options: EffectOptions,
): EffectsInstance | null {
  return window.CursorForgeEffects?.create({ canvas, options }) ?? null;
}
