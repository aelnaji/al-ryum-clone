import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Al Ryum Group | Stage 01",
  description: "Private first-stage preview of Al Ryum Group's clean scroll-driven experience.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <noscript>
          <style>{`
            .experience{height:auto!important}
            .stage{position:relative!important;height:auto!important;padding:190px 8% 100px}
            .story-panel{position:relative!important;inset:auto!important;translate:none!important;transform:none!important;opacity:1!important;visibility:visible!important;width:100%!important;margin-bottom:70px}
            .scene-fallback{opacity:.12}
            .stage-bottom,.menu-toggle,.navigation{display:none!important}
          `}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
