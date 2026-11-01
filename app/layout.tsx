import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Caveat, Figtree, Young_Serif } from "next/font/google";
import "./globals.css";

const display = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-hand" });

export const metadata: Metadata = {
  title: { default: "Oma's Kitchen", template: "%s · Oma's Kitchen" },
  description: "Oma's family recipes: the bakes, the puddings and the Sunday dinners.",
};

export const viewport: Viewport = { themeColor: "#fffaf2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body>
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="brand">Oma&apos;s Kitchen</Link>
            <nav className="nav">
              <Link href="/add" className="btn small">+ Add a recipe</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
