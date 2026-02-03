import type { ThemeColor } from "./site";

const lightMap: Record<ThemeColor | string, { theme: string; hover: string }> = {
  pink: { theme: "#ea868f", hover: "#d1606e" },
  green: { theme: "#5fae8a", hover: "#3f8f6a" },
  blue: { theme: "#6482db", hover: "#4f6fdc" },
  yellow: { theme: "#e5b96e", hover: "#cfa24d" },
  red: { theme: "#cd575f", hover: "#b84a4a" },
  purple: { theme: "#8f7acb", hover: "#6d5fb3" },
  cyan: { theme: "#5fb3b8", hover: "#3f8f93" },
  orange: { theme: "#e39a5c", hover: "#c97a3f" }
};

const darkMap: Record<ThemeColor | string, { theme: string; hover: string }> = {
  pink: { theme: "#bf677a", hover: "#d6728a" },
  green: { theme: "#3f8a6c", hover: "#2f6f56" },
  blue: { theme: "#44579a", hover: "#5b6fc4" },
  yellow: { theme: "#ab8748", hover: "#cfa24d" },
  red: { theme: "#9a444b", hover: "#b84a4a" },
  purple: { theme: "#5f548a", hover: "#7668a8" },
  cyan: { theme: "#3f7a7f", hover: "#5f9ea3" },
  orange: { theme: "#9f5a2f", hover: "#b86a3a" }
};

export function getThemeTokens(color: ThemeColor | string) {
  const light = lightMap[color] ?? lightMap.pink;
  const dark = darkMap[color] ?? darkMap.pink;
  return { light, dark };
}
