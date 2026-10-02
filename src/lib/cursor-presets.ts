// Built-in cursor shapes. The editor preview and the published storefront cursor both use
// buildCursorSvg, so what merchants see in the editor is exactly what ships to the store.
// All shapes are drawn on a 64×64 grid; `hotspot` is the click point on that grid.

export const SHAPE_CATEGORIES = ["Pointers", "Shapes", "Fun"] as const;
export type ShapeCategory = (typeof SHAPE_CATEGORIES)[number];

export interface CursorShape {
  id: string;
  name: string;
  category: ShapeCategory;
  hotspot: [number, number];
  /** Inner SVG markup. `fill` is the cursor color, `edge` the outline color, `w` the outline width. */
  render: (fill: string, edge: string, w: number) => string;
}

const filled = (d: string) => (fill: string, edge: string, w: number) =>
  `<path d='${d}' fill='${fill}'${w > 0 ? ` stroke='${edge}' stroke-width='${w}' stroke-linejoin='round'` : ""}/>`;

// Line-based shapes get an outline by drawing a wider stroke in the edge color underneath.
const stroked = (markup: (color: string, width: number) => string, width: number) => (fill: string, edge: string, w: number) =>
  `${w > 0 ? markup(edge, width + w * 2) : ""}${markup(fill, width)}`;

/** Circle as a path, so several circles can share one outlined path. */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

function starPath(points: number, outer: number, inner: number, cx = 32, cy = 32) {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${coords.join(" L")}Z`;
}

// Shape ids are saved in published designs, so never rename or remove one.
export const CURSOR_SHAPES: CursorShape[] = [
  // Pointers
  { id: "arrow", name: "Arrow", category: "Pointers", hotspot: [8, 4], render: filled("M8 4 52 36 30 39 20 58Z") },
  { id: "classic", name: "Classic", category: "Pointers", hotspot: [12, 4], render: filled("M12 4 L12 50 L23 40 L31 58 L39 54 L31 37 L46 37Z") },
  { id: "dart", name: "Dart", category: "Pointers", hotspot: [6, 6], render: filled("M6 6 L58 24 L30 30 L24 58Z") },
  { id: "pixel", name: "Pixel", category: "Pointers", hotspot: [8, 4], render: filled("M8 4 H12 V8 H16 V12 H20 V16 H24 V20 H28 V24 H32 V28 H36 V32 H40 V36 H44 V40 H32 L38 52 L31 55 L25 43 L18 50 H8Z") },
  { id: "hand", name: "Hand", category: "Pointers", hotspot: [28, 3], render: filled("M24 7 C24 4.8 25.8 3 28 3 C30.2 3 32 4.8 32 7 V26 H34 C36 24 40 24 41 27 C43 25 47 25 48 29 C50 27 55 28 55 32 V44 C55 53 49 60 40 60 H32 C26 60 22 57 19 52 L10 38 C8 35 9 32 12 31 C14 30 17 31 19 34 L24 40Z") },
  { id: "up", name: "Up", category: "Pointers", hotspot: [32, 4], render: filled("M32 4 L56 30 H41 V60 H23 V30 H8Z") },
  { id: "pencil", name: "Pencil", category: "Pointers", hotspot: [8, 56], render: filled("M8 56 L12 42 L44 10 L54 20 L22 52Z") },
  {
    id: "wand",
    name: "Wand",
    category: "Pointers",
    hotspot: [46, 18],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M10 54 L38 26' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/>`, 6)(fill, edge, w) +
      filled(starPath(5, 14, 6, 46, 18))(fill, edge, w),
  },
  {
    id: "crosshair",
    name: "Crosshair",
    category: "Pointers",
    hotspot: [32, 32],
    render: stroked(
      (c, sw) => `<path d='M32 6V24M32 40V58M6 32H24M40 32H58' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/><circle cx='32' cy='32' r='3' fill='${c}'/>`,
      5,
    ),
  },
  {
    id: "ibeam",
    name: "I-beam",
    category: "Pointers",
    hotspot: [32, 32],
    render: stroked((c, sw) => `<path d='M22 8 H42 M32 8 V56 M22 56 H42' fill='none' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/>`, 5),
  },
  { id: "chevron", name: "Chevron", category: "Pointers", hotspot: [50, 32], render: filled("M8 8 L50 32 L8 56 L22 32Z") },
  {
    id: "compass-tip",
    name: "Compass",
    category: "Pointers",
    hotspot: [32, 4],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M32 36 V58' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/>`, 3)(fill, edge, w) +
      filled("M32 4 L44 44 L32 36 L20 44Z")(fill, edge, w),
  },
  { id: "diagonal", name: "Resize", category: "Pointers", hotspot: [32, 32], render: filled("M6 26 V6 H26 L18 14 L50 46 L58 38 V58 H38 L46 50 L14 18Z") },
  {
    id: "scope",
    name: "Scope",
    category: "Pointers",
    hotspot: [32, 32],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M32 4 V16 M32 48 V60 M4 32 H16 M48 32 H60' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/>`, 3)(fill, edge, w) +
      stroked((c, sw) => `<circle cx='32' cy='32' r='12' fill='none' stroke='${c}' stroke-width='${sw}'/>`, 4)(fill, edge, w),
  },
  {
    id: "brush",
    name: "Brush",
    category: "Pointers",
    hotspot: [6, 56],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M20 42 L46 6 L58 16 L28 48Z' fill='none' stroke='${c}' stroke-width='${sw}' stroke-linejoin='round'/>`, 4)(fill, edge, w) +
      filled("M20 42 C10 38 6 46 6 56 C18 56 26 52 20 42Z")(fill, edge, w),
  },
  // Shapes
  { id: "dot", name: "Dot", category: "Shapes", hotspot: [32, 32], render: filled("M32 20 A12 12 0 1 1 31.99 20Z") },
  {
    id: "ring",
    name: "Ring",
    category: "Shapes",
    hotspot: [32, 32],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<circle cx='32' cy='32' r='20' fill='none' stroke='${c}' stroke-width='${sw}'/>`, 6)(fill, edge, w) +
      filled("M32 28 A4 4 0 1 1 31.99 28Z")(fill, edge, w),
  },
  {
    id: "target",
    name: "Target",
    category: "Shapes",
    hotspot: [32, 32],
    render: stroked((c, sw) => `<circle cx='32' cy='32' r='22' fill='none' stroke='${c}' stroke-width='${sw}'/><circle cx='32' cy='32' r='11' fill='none' stroke='${c}' stroke-width='${sw}'/><circle cx='32' cy='32' r='3' fill='${c}'/>`, 5),
  },
  { id: "plus", name: "Plus", category: "Shapes", hotspot: [32, 32], render: filled("M26 8 H38 V26 H56 V38 H38 V56 H26 V38 H8 V26 H26Z") },
  { id: "diamond", name: "Diamond", category: "Shapes", hotspot: [32, 32], render: filled("M32 4 L60 32 L32 60 L4 32Z") },
  { id: "star", name: "Star", category: "Shapes", hotspot: [32, 32], render: filled(starPath(5, 28, 12)) },
  { id: "drop", name: "Drop", category: "Shapes", hotspot: [32, 4], render: filled("M32 4 C32 4 12 28 12 42 C12 53 21 60 32 60 C43 60 52 53 52 42 C52 28 32 4 32 4Z") },
  {
    id: "bullseye",
    name: "Bullseye",
    category: "Shapes",
    hotspot: [32, 32],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<circle cx='32' cy='32' r='22' fill='none' stroke='${c}' stroke-width='${sw}'/><circle cx='32' cy='32' r='12' fill='none' stroke='${c}' stroke-width='${sw}'/>`, 4)(fill, edge, w) +
      filled(circle(32, 32, 4))(fill, edge, w),
  },
  {
    id: "bracket",
    name: "Bracket",
    category: "Shapes",
    hotspot: [32, 32],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M22 8 H10 V56 H22 M42 8 H54 V56 H42' fill='none' stroke='${c}' stroke-width='${sw}' stroke-linecap='round' stroke-linejoin='round'/>`, 4)(fill, edge, w) +
      filled(circle(32, 32, 6))(fill, edge, w),
  },
  // Fun
  { id: "heart", name: "Heart", category: "Fun", hotspot: [32, 28], render: filled("M32 56 C12 42 4 30 4 20 C4 11 11 4 20 4 C26 4 30 8 32 12 C34 8 38 4 44 4 C53 4 60 11 60 20 C60 30 52 42 32 56Z") },
  { id: "sparkle", name: "Sparkle", category: "Fun", hotspot: [32, 32], render: filled("M32 4 C34 22 42 30 60 32 C42 34 34 42 32 60 C30 42 22 34 4 32 C22 30 30 22 32 4Z") },
  { id: "bolt", name: "Bolt", category: "Fun", hotspot: [38, 4], render: filled("M38 4 L14 36 H30 L24 60 L50 26 H34Z") },
  { id: "moon", name: "Moon", category: "Fun", hotspot: [32, 32], render: filled("M40 6 A26 26 0 1 0 58 44 A20 20 0 1 1 40 6Z") },
  { id: "crown", name: "Crown", category: "Fun", hotspot: [32, 10], render: filled("M6 50 L10 18 L22 32 L32 10 L42 32 L54 18 L58 50Z") },
  { id: "leaf", name: "Leaf", category: "Fun", hotspot: [8, 56], render: filled("M8 56 C8 26 26 8 56 8 C56 38 38 56 8 56Z") },
  { id: "paw", name: "Paw", category: "Fun", hotspot: [32, 36], render: filled(`M32 34 C22 34 16 44 16 51 C16 57 22 59 32 59 C42 59 48 57 48 51 C48 44 42 34 32 34Z${circle(14, 30, 6)}${circle(24, 18, 6)}${circle(40, 18, 6)}${circle(50, 30, 6)}`) },
  {
    id: "ghost",
    name: "Ghost",
    category: "Fun",
    hotspot: [32, 8],
    render: (fill, edge, w) =>
      filled("M12 58 V28 C12 15 21 6 32 6 C43 6 52 15 52 28 V58 L45 52 L38 58 L32 52 L26 58 L19 52Z")(fill, edge, w) +
      `<ellipse cx='25' cy='28' rx='4' ry='6' fill='${edge}'/><ellipse cx='39' cy='28' rx='4' ry='6' fill='${edge}'/>`,
  },
  {
    id: "smiley",
    name: "Smiley",
    category: "Fun",
    hotspot: [32, 32],
    render: (fill, edge, w) =>
      filled(circle(32, 32, 27))(fill, edge, w) +
      `<circle cx='23' cy='26' r='4' fill='${edge}'/><circle cx='41' cy='26' r='4' fill='${edge}'/><path d='M20 38 Q32 50 44 38' fill='none' stroke='${edge}' stroke-width='4' stroke-linecap='round'/>`,
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Fun",
    hotspot: [32, 32],
    // Eight petals: a top/bottom pair rotated in 45° steps. All outlines go underneath all fills.
    render: stroked(
      (c, sw) =>
        [0, 45, 90, 135]
          .map((angle) => `<path d='${ellipse(32, 16, 6, 12)}${ellipse(32, 48, 6, 12)}' transform='rotate(${angle} 32 32)' fill='${c}' stroke='${c}' stroke-width='${sw}'/>`)
          .join(""),
      3,
    ),
  },
  {
    id: "comet",
    name: "Comet",
    category: "Fun",
    hotspot: [46, 18],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M34 30 L8 56 M24 30 L6 38 M34 42 L26 58' stroke='${c}' stroke-width='${sw}' stroke-linecap='round'/>`, 4)(fill, edge, w) +
      filled(circle(46, 18, 10))(fill, edge, w),
  },
  { id: "crescent", name: "Crescent", category: "Fun", hotspot: [32, 32], render: filled("M46 8 A24 24 0 1 0 56 48 A24 24 0 0 1 46 8Z") },
  {
    id: "camera",
    name: "Camera",
    category: "Fun",
    hotspot: [32, 36],
    render: (fill, edge, w) =>
      stroked((c, sw) => `<path d='M6 18 H18 L22 10 H42 L46 18 H58 V56 H6Z' fill='none' stroke='${c}' stroke-width='${sw}' stroke-linejoin='round'/><circle cx='32' cy='36' r='12' fill='none' stroke='${c}' stroke-width='${sw}'/>`, 4)(fill, edge, w) +
      filled(circle(32, 36, 4))(fill, edge, w),
  },
];

export const CURSOR_COLORS = [
  { name: "Neon", hex: "#f4511e" },
  { name: "Mint", hex: "#2fd49a" },
  { name: "Frost", hex: "#2fb4f5" },
  { name: "Amber", hex: "#f5c518" },
  { name: "Grape", hex: "#8b5cf6" },
  { name: "Rose", hex: "#ff4f8b" },
  { name: "Ink", hex: "#1f2330" },
  { name: "Snow", hex: "#ffffff" },
] as const;

export const DEFAULT_SHAPE_ID = "arrow";

export function getCursorShape(id: string | null | undefined) {
  return CURSOR_SHAPES.find((shape) => shape.id === id) ?? CURSOR_SHAPES[0]!;
}

/** Light cursors get a dark outline so they stay visible on white pages, and vice versa. */
function edgeColor(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.7 ? "#1f2330" : "#ffffff";
}

export function buildCursorSvg(shapeId: string, options: { color: string; outline: number; shadow: boolean; size: number }) {
  const shape = getCursorShape(shapeId);
  const body = shape.render(options.color, edgeColor(options.color), options.outline);
  const shadow = options.shadow
    ? "<defs><filter id='s' x='-20%' y='-20%' width='160%' height='160%'><feDropShadow dx='1' dy='2' stdDeviation='1.5' flood-opacity='0.4'/></filter></defs>"
    : "";
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${options.size}' height='${options.size}' viewBox='0 0 64 64'>${shadow}<g${options.shadow ? " filter='url(#s)'" : ""}>${body}</g></svg>`;
}

export function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Scales a shape's 64-grid hotspot to the chosen cursor size in px. */
export function shapeHotspot(shapeId: string, size: number): [number, number] {
  const [x, y] = getCursorShape(shapeId).hotspot;
  return [Math.round((x / 64) * size), Math.round((y / 64) * size)];
}
