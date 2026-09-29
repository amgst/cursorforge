// The editor preview runs the exact trail engine that ships to the storefront
// (extensions/cursor-embed/assets/cursorforge-trail.js, served by a plugin in vite.config.ts).
import "virtual:cursorforge-trail";
import type { TrailStyle } from "@/lib/cursor-config";

export interface TrailOptions {
  style: TrailStyle;
  color: string;
  length: number;
  size: number;
}

export interface TrailInstance {
  update: (options: TrailOptions) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    CursorForgeTrail?: {
      create: (config: { canvas: HTMLCanvasElement; target: EventTarget; mouseOnly?: boolean; options: TrailOptions }) => TrailInstance;
    };
  }
}

export function createTrail(canvas: HTMLCanvasElement, target: EventTarget, options: TrailOptions): TrailInstance | null {
  return window.CursorForgeTrail?.create({ canvas, target, options }) ?? null;
}
