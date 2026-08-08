import type { NextConfig } from "next";

/**
 * Content-Security-Policy notes:
 * - connect-src is 'self' only: every data feed is proxied through our API
 *   routes, so the browser never talks to third-party APIs directly.
 * - img-src whitelists the map tile CDNs (OSM, Esri, OpenTopoMap, RainViewer).
 * - 'unsafe-inline' for script/style is required by Next.js's bootstrap
 *   script and Leaflet's inline positioning styles; switch to nonces if your
 *   deployment adds a dynamic header layer.
 */
// React's dev tooling needs eval(); production keeps script-src strict.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org https://tilecache.rainviewer.com",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Native modules used by the community feature must not be bundled.
  serverExternalPackages: ["better-sqlite3", "sharp"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
