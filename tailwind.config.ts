import type { Config } from "tailwindcss";

// =====================================================================
// Design tokens — "circadian flight-deck" direction.
// Deliberately avoids the generic cream+terracotta and near-black+neon
// dashboard defaults. The palette is drawn from the subject itself:
// cortisol/energy curves (amber peak -> slate trough) rendered like an
// analog instrument panel, since this product's whole job is showing
// the user their own biological rhythm.
// =====================================================================
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deck: {
          bg: "#0F1419",       // deep slate-navy — the instrument panel
          surface: "#171F26",  // panel cards
          surfaceRaised: "#1F2933",
          line: "#2A343E",     // hairline dividers/gauge ticks
        },
        energy: {
          peak: "#E8A33D",     // amber — cortisol peak / high focus
          high: "#D4914F",
          medium: "#8A97A3",   // neutral steel
          low: "#4A6C82",
          trough: "#2E4A5E",   // cool teal-slate — low energy
        },
        signal: {
          cost: "#C15C4A",     // muted rust — financial cost of delay / loss
          success: "#5B9279",  // muted sage — completed / on track
          info: "#5B84A8",
        },
        ink: {
          primary: "#EDEEF0",
          muted: "#8A97A3",
          faint: "#5A6570",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"], // technical, geometric — headers & gauge labels
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],     // numbers: time, $, %
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        deck: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
