import "@testing-library/jest-dom/vitest";

// Route handlers read env at import time in some cases; keep tests deterministic.
process.env.RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED ?? "";

// jsdom does not implement matchMedia (used by the theme provider).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
