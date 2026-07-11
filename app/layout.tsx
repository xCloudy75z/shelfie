import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Display serif for headings/wordmark, grotesk for body, mono for prices.
// Exposed as CSS variables so globals.css can wire them into the design tokens.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const splineSansMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shelfie",
  description: "Log a grocery purchase, see each item's price story, and watch the month against a budget.",
};

// No-flash theme init: set data-theme on <html> before first paint by reading
// the saved preference (or the system default). Mirrors docs/mockup.html.
const themeInitScript = `(function(){try{var t=localStorage.getItem('shelfie-theme');if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hankenGrotesk.variable} ${splineSansMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
