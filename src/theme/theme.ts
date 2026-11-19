export const lightColors = {
  background: "#F8FAF9",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3F5F4",
  primary: "#075C3D",
  // Filled brand surfaces (buttons, balance card, active pills, selected
  // chips). Forest green in BOTH themes so dark mode reads as the same app.
  brand: "#075C3D",
  onBrand: "#FFFFFF",
  primaryAccent: "#10B981",
  primarySoft: "#E6F3ED",
  textMain: "#123D30",
  textBody: "#1F2937",
  textMuted: "#6A7470",
  textInverse: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  success: "#059669",
  warning: "#F59E0B",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  info: "#0EA5E9",
  overlay: "rgba(18, 61, 48, 0.55)",
};

export const darkColors = {
  background: "#0B1210",
  surface: "#141F1B",
  surfaceSecondary: "#1C2923",
  // Dark-mode primary is the bright accent: icons, indicators, progress bars,
  // links and small highlights only. Large fills use `brand`.
  primary: "#35C58A",
  brand: "#075C3D",
  onBrand: "#FFFFFF",
  primaryAccent: "#34D399",
  primarySoft: "#183D2E",
  textMain: "#F1F5F2",
  textBody: "#E5E7EB",
  textMuted: "#9AA9A1",
  textInverse: "#0B1210",
  border: "#293831",
  borderStrong: "#2B4A38",
  success: "#35C58A",
  warning: "#F2B84B",
  danger: "#F07171",
  dangerSoft: "#2A1215",
  info: "#38BDF8",
  overlay: "rgba(0, 0, 0, 0.7)",
};

export type ColorScheme = typeof lightColors;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const fontFamily = {
  heading: "System",
  body: "System",
};

export const typography = {
  h1: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.6 },
  h2: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.4 },
  h3: { fontSize: 22, fontWeight: "600" as const, letterSpacing: -0.2 },
  h4: { fontSize: 18, fontWeight: "600" as const },
  bodyLg: { fontSize: 17, fontWeight: "400" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodySm: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  overline: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
};
