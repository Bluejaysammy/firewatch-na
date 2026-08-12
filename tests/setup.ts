import "@testing-library/jest-dom/vitest";
import os from "node:os";
import path from "node:path";

// Community tests must never touch the real ./data database. Setup files run
// before test modules are imported, so this wins over db.ts's import-time
// DATA_DIR resolution (an inline assignment in the test file would lose to
// import hoisting).
process.env.DATA_DIR = path.join(
  os.tmpdir(),
  `fw-test-${process.pid}-${Math.floor(Math.random() * 1e9)}`
);

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
