/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare global {
  interface Window {
    THEME_URL: string;
    renderLatex?: () => void;
  }
}

export {};
