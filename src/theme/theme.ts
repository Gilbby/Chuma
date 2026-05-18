export const lightColors = {
  background: "#F9FAF9",
  surface: "#FFFFFF",
  surfaceSecondary: "#F3F5F4",
  primary: "#0A5C36",
  primaryAccent: "#10B981",
  primarySoft: "#E6F4ED",
  textMain: "#064E3B",
  textBody: "#1F2937",
  textMuted: "#6B7280",
  textInverse: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  success: "#059669",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#0EA5E9",
  overlay: "rgba(6, 78, 59, 0.55)",
};

export const darkColors = {
  background: "#050A07",
  surface: "#0C1410",
  surfaceSecondary: "#15241C",
  primary: "#10B981",
  primaryAccent: "#34D399",
  primarySoft: "#0F2A20",
  textMain: "#F9FAF9",
  textBody: "#E5E7EB",
  textMuted: "#A3A3A3",
  textInverse: "#050A07",
  border: "#1E3328",
  borderStrong: "#2B4A38",
  success: "#10B981",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
  overlay: "rgba(0, 0, 0, 0.7)",
};

export type ColorScheme = typeof lightColors;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
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
