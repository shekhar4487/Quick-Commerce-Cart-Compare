import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "CartCompare — Quick commerce ka sabse sasta option",
  description:
    "Compare your grocery cart across Zepto, Swiggy Instamart, BigBasket and Flipkart Minutes — with your bank card offers applied. Always pay the lowest effective price.",
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-xl px-5 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
