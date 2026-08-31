"use client";

// =====================================================================
// InfoTooltip
// Small "(i)" affordance placed next to a gauge/ticker title. Explains
// what the instrument means and how it's computed, in plain language.
// Hover on desktop, tap-to-toggle on mobile (no hover state there) —
// closes on outside click/blur so it never gets stuck open.
// =====================================================================
import { useEffect, useRef, useState } from "react";

interface InfoTooltipProps {
  text: string;
  label?: string; // accessible name for the trigger, defaults to "More info"
  align?: "left" | "right" | "center";
}

export default function InfoTooltip({ text, label = "More info", align = "center" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const alignClass =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <span ref={rootRef} className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-deck-line font-mono text-[9px] leading-none text-ink-faint transition hover:border-energy-peak/60 hover:text-energy-peak focus:border-energy-peak/60 focus:text-energy-peak focus:outline-none"
      >
        i
      </button>

      <span
        role="tooltip"
        dir="rtl"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-56 rounded-deck border border-deck-line bg-deck-surfaceRaised p-3 text-right font-body text-[11px] leading-relaxed text-ink-primary shadow-panel transition-opacity duration-150 ${alignClass} ${
          open ? "opacity-100 group-hover:pointer-events-auto" : "opacity-0"
        } group-hover:opacity-100 group-hover:pointer-events-auto`}
      >
        {text}
      </span>
    </span>
  );
}
