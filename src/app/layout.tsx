import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { FilterBar } from "@/components/shell/FilterBar";
import { Inspector } from "@/components/shell/Inspector";
import { LeftRail } from "@/components/shell/LeftRail";
import { Providers } from "@/components/shell/Providers";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Capital Atlas", template: "%s · Capital Atlas" },
  description: "Internal fundraising console: investors, VC math, competitors and raise strategy.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexCondensed.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <Providers>
          <div className="flex h-dvh overflow-hidden">
            <LeftRail />
            <div className="flex min-w-0 flex-1 flex-col">
              <FilterBar />
              <div className="flex min-h-0 flex-1">
                <main
                  id="main"
                  tabIndex={-1}
                  className="min-w-0 flex-1 overflow-y-auto outline-none"
                >
                  {children}
                </main>
                <Inspector />
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
