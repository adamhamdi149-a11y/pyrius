import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { openGraph, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { AppStoreProvider } from "@/lib/store/AppStore";
import "@/styles/tokens.css";
import "@/styles/motion.css";
import "@/styles/accents.css";
import "@/styles/base.css";
import "@/styles/shell.css";
import "@/styles/chat.css";
import "@/styles/results.css";
import "@/styles/flow.css";
import "@/styles/pages.css";
import "@/styles/fx.css";
import "@/styles/marketing.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Pyrius" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["AI travel concierge", "AI flight search", "flight search", "cheap flights", "travel planner", "trip planner", "price tracking", "flights from Canada", "Pyrius"],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "travel",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: openGraph("/"),
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }] },
  // Search Console's HTML-tag verification, if you use that method (set it in Vercel's environment variables).
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090A0D" },
    { media: "(prefers-color-scheme: light)", color: "#F6F5F2" },
  ],
};

// Applies the saved theme and orb accent before paint to avoid a flash. Dark + Blazing Ember are the defaults.
const themeScript = `(function(){try{var t=localStorage.getItem("pyrius:theme")||"dark";var r=t==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;var a=localStorage.getItem("pyrius:accent");if(a==="arctic"||a==="violet"||a==="ember")document.documentElement.dataset.accent=a;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppStoreProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AppStoreProvider>
      </body>
    </html>
  );
}
