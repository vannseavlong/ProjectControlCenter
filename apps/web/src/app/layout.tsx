import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Falls back to the Vercel-provided deploy URL so OG tags resolve correctly on every preview
// and production deploy without a new required env var; set NEXT_PUBLIC_SITE_URL to pin a
// custom domain instead.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const title = "Project Control Center";
const description =
  "Mission Control for your projects: Render backend uptime, Vercel deploy status, and a roster of Claude Code agents, backed by Google Sheets.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
