import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "Real-time active wildfire map and dashboard for Canada, the United States and Mexico — fires, perimeters, smoke, air quality, evacuation alerts and fire-affected highways from official CWFIS, NIFC/WFIGS, NWS, NOAA and 511 data.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "FireWatch NA — North American Wildfire Map",
    template: "%s — FireWatch NA",
  },
  description: DESCRIPTION,
  applicationName: "FireWatch NA",
  keywords: [
    "wildfire map",
    "forest fire",
    "fire tracker",
    "Canada wildfires",
    "US wildfires",
    "evacuation alerts",
    "smoke forecast",
    "air quality",
    "road closures",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FireWatch NA",
    title: "FireWatch NA — North American Wildfire Map",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "FireWatch NA — North American Wildfire Map",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

/** Applies stored theme before hydration to avoid a flash of wrong theme. */
const themeInit = `
try {
  var m = localStorage.getItem('fw-theme') || 'system';
  var dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
  document.documentElement.dataset.contrast =
    localStorage.getItem('fw-contrast') === 'high' ? 'high' : 'normal';
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="h-dvh overflow-hidden antialiased">
        <a href="#fire-list" className="skip-link">
          Skip to fire list
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
