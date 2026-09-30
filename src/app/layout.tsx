import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_ACCENT, ensureReadableOnWhite, hexToRgb, rgbToHsl, hslToRgb, rgbToHex, readableTextOn } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "Fintarg - know where your money goes",
    template: "%s | Fintarg",
  },
  description:
    "Fintarg helps you see whether you can make it this month: one clear number, plain language, and no bank feeds.",
  applicationName: "Fintarg",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#090e1a" },
  ],
}

/** Triplet string ("15 118 110") for the CSS custom properties Tailwind reads. */
function triplet(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function softTriplet(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return triplet(rgbToHex(hslToRgb({ h: hsl.h, s: Math.min(0.85, hsl.s), l: 0.94 })));
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  const accent = ensureReadableOnWhite(user?.themeAccent ?? DEFAULT_ACCENT.hex);
  const accentContrast = readableTextOn(accent);
  const mode = user?.themeMode ?? "system";
  const fontScale = user?.fontScale ?? "medium";
  const density = user?.density ?? "comfortable";

  return (
    <html
      lang="en"
      data-theme={mode === "system" ? "system" : mode}
      data-font-scale={fontScale}
      data-density={density}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript
          accent={triplet(accent)}
          accentContrast={triplet(accentContrast)}
          accentSoft={softTriplet(accent)}
          mode={mode}
          fontScale={fontScale}
          density={density}
        />
      </head>
      <body>
        <a href="#main" className="skip-link text-sm font-medium text-accent">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
