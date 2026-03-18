export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    primary: "#e84e3a",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    border: "#e5e5e5",
    card: "#ffffff",
    input: "#e5e5e5",
  },
  dark: {
    background: "#0a0a0f",
    foreground: "#f2f2f2",
    primary: "#8b5cf6",
    muted: "#1f1f26",
    mutedForeground: "#a1a1aa",
    border: "#27272e",
    card: "#141419",
    input: "#27272e",
  },
  brand: {
    traceRed: "#FF655B",
    tracePink: "#FD297B",
    traceGreen: "#00D665",
    amber50: "#FFFBEB",
    amber100: "#FEF3C7",
    amber200: "#FDE68A",
    amber400: "#FBBF24",
    amber500: "#F59E0B",
    amber600: "#D97706",
    orange500: "#F97316",
    rose500: "#F43F5E",
  },
} as const;

export type ThemeColors = typeof colors.light;
