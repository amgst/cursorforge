import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "sun" | "panel" | "ghost" | "paper";
export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground hover:brightness-105",
    sun: "bg-sun text-ink hover:brightness-105",
    panel: "bg-panel-raised text-foreground hover:bg-panel-raised/75",
    ghost: "text-muted-foreground hover:bg-panel-raised hover:text-foreground",
    paper: "bg-paper text-ink hover:bg-paper/85",
  };
  return <button className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-45", variants[variant], className)} {...props} />;
}