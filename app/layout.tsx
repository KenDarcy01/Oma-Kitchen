import type { Metadata, Viewport } from "next";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/figtree/index.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

// Fonts are bundled from npm (@fontsource) so builds never depend on reaching Google Fonts.

export const metadata: Metadata = {
  title: { default: "Oma's Kitchen", template: "%s · Oma's Kitchen" },
  description: "Oma's family recipes: the bakes, the puddings and the Sunday dinners.",
};

export const viewport: Viewport = { themeColor: "#fffaf2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE">
      <body>
        <TopBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
