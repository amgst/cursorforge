import { Check, Eraser, Pencil, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { CURSOR_COLORS } from "@/lib/cursor-presets";

// Pixel-art cursor drawing pad: draws on a GRID×GRID canvas and exports a crisp EXPORT_SIZE PNG.
const GRID = 32;
const EXPORT_SIZE = 128;
const MAX_UNDO = 30;

type Tool = "pen" | "eraser";

export function DrawPad({ color, onColorChange, onCancel, onDone }: {
  color: string;
  onColorChange: (color: string) => void;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCell = useRef<[number, number] | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [brush, setBrush] = useState(1);
  const [canUndo, setCanUndo] = useState(false);

  const context = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;

  useEffect(() => { context()?.clearRect(0, 0, GRID, GRID); }, []);

  const paintCell = (x: number, y: number) => {
    const ctx = context();
    if (!ctx) return;
    const offset = Math.floor((brush - 1) / 2);
    if (tool === "eraser") ctx.clearRect(x - offset, y - offset, brush, brush);
    else { ctx.fillStyle = color; ctx.fillRect(x - offset, y - offset, brush, brush); }
  };

  // Bresenham line between cells so fast strokes don't leave gaps.
  const paintLine = (from: [number, number], to: [number, number]) => {
    let [x0, y0] = from;
    const [x1, y1] = to;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      paintCell(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x0 += sx; }
      if (doubled <= dx) { error += dx; y0 += sy; }
    }
  };

  const cellFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - box.left) / box.width) * GRID);
    const y = Math.floor(((event.clientY - box.top) / box.height) * GRID);
    return [Math.min(Math.max(x, 0), GRID - 1), Math.min(Math.max(y, 0), GRID - 1)];
  };

  const pushUndo = () => {
    const ctx = context();
    if (!ctx) return;
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), ctx.getImageData(0, 0, GRID, GRID)];
    setCanUndo(true);
  };

  const undo = () => {
    const snapshot = undoStack.current.pop();
    if (snapshot) context()?.putImageData(snapshot, 0, 0);
    setCanUndo(undoStack.current.length > 0);
  };

  const clear = () => { pushUndo(); context()?.clearRect(0, 0, GRID, GRID); };

  const isEmpty = () => {
    const data = context()?.getImageData(0, 0, GRID, GRID).data;
    return !data || !data.some((value, index) => index % 4 === 3 && value > 0);
  };

  const finish = () => {
    const source = canvasRef.current;
    if (!source || isEmpty()) return;
    const output = document.createElement("canvas");
    output.width = EXPORT_SIZE; output.height = EXPORT_SIZE;
    const ctx = output.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
    output.toBlob((blob) => { if (blob) onDone(new File([blob], "cursorforge-drawing.png", { type: "image/png" })); }, "image/png");
  };

  return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="inline-flex rounded-md bg-panel-raised p-1">
        <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="Pen"><Pencil size={14}/></ToolButton>
        <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser"><Eraser size={14}/></ToolButton>
      </div>
      <div className="inline-flex rounded-md bg-panel-raised p-1">{[1, 2, 3].map((value) => <ToolButton key={value} active={brush === value} onClick={() => setBrush(value)} label={`Brush ${value}px`}><span className="font-mono text-[10px]">{value}px</span></ToolButton>)}</div>
      <div className="flex items-center gap-1">{CURSOR_COLORS.map((swatch) => <button key={swatch.hex} type="button" aria-label={swatch.name} title={swatch.name} onClick={() => { onColorChange(swatch.hex); setTool("pen"); }} className={`size-6 rounded-sm ring-offset-2 ring-offset-workshop ${color.toLowerCase() === swatch.hex ? "ring-2 ring-foreground" : "ring-1 ring-border"}`} style={{ background: swatch.hex }}/>)}<input aria-label="Custom color" type="color" value={color} onChange={(event) => { onColorChange(event.target.value); setTool("pen"); }} className="size-6 cursor-pointer rounded-sm border-0 bg-transparent p-0"/></div>
      <div className="inline-flex gap-1"><Button variant="panel" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={14}/></Button><Button variant="panel" onClick={clear} aria-label="Clear"><Trash2 size={14}/></Button></div>
    </div>
    <canvas
      ref={canvasRef}
      width={GRID}
      height={GRID}
      aria-label="Cursor drawing canvas"
      className="draw-pad-canvas aspect-square w-full max-w-[min(384px,60vh)] touch-none rounded-md ring-1 ring-border"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pushUndo(); const cell = cellFromEvent(event); paintCell(...cell); lastCell.current = cell; }}
      onPointerMove={(event) => { if (!lastCell.current) return; const cell = cellFromEvent(event); paintLine(lastCell.current, cell); lastCell.current = cell; }}
      onPointerUp={() => { lastCell.current = null; }}
      onPointerCancel={() => { lastCell.current = null; }}
    />
    <p className="font-mono text-[9px] uppercase text-muted-foreground">{GRID}×{GRID} pixels · exported as {EXPORT_SIZE}px PNG · set the click point with Hotspot</p>
    <div className="flex gap-2"><Button variant="panel" onClick={onCancel}><X size={14}/>Cancel</Button><Button onClick={finish}><Check size={14}/>Use drawing</Button></div>
  </div>;
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={`grid h-7 min-w-8 place-items-center rounded-md px-2 ${active ? "bg-sky text-ink" : "text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}
