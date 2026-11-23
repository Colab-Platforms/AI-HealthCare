// Shared look-and-feel for the Admin / Take Admin / Super Admin panels.
// Colors mirror the Take Health Flutter theme.

export const BRAND = {
  blue: "#205AE2",
  action: "#4B81FF",
  teal: "#1E8E76",
  tealSoft: "#E7F4F0",
  mint: "#5DD9A0",
  warn: "#F5C24C",
  error: "#D9544D",
  info: "#57B4E8",
};

// Categorical chart palette (blue first so the primary series is always brand blue).
export const CHART_COLORS = [BRAND.blue, BRAND.teal, BRAND.mint, BRAND.warn, BRAND.info, BRAND.error];

// Tone -> icon tile + trend chip classes.
export const TONES = {
  blue: { tile: "bg-tk-blue/10 text-tk-blue", ring: "group-hover:ring-tk-blue/20" },
  teal: { tile: "bg-tk-teal/10 text-tk-teal", ring: "group-hover:ring-tk-teal/20" },
  mint: { tile: "bg-tk-mint/20 text-tk-teal", ring: "group-hover:ring-tk-mint/30" },
  amber: { tile: "bg-tk-warn/20 text-amber-700", ring: "group-hover:ring-tk-warn/30" },
  info: { tile: "bg-tk-info/15 text-sky-700", ring: "group-hover:ring-tk-info/30" },
  error: { tile: "bg-tk-error/10 text-tk-error", ring: "group-hover:ring-tk-error/20" },
};

// Motion presets. Components also check useReducedMotion() and skip movement.
export const EASE = [0.22, 1, 0.36, 1];

export const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const riseIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
