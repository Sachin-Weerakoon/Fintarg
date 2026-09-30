import type { Edition } from "@/lib/plans";

/**
 * Inlined theme bootstrap. Runs before paint so a dark-mode or accent change
 * never flashes white, and so first meaningful paint stays fast (NFR: < 2.5s).
 * Values are written by the server from the signed-in profile.
 */
export function ThemeScript({
  accent,
  accentContrast,
  accentSoft,
  mode,
  fontScale,
  density,
}: {
  accent: string;
  accentContrast: string;
  accentSoft: string;
  mode: string;
  fontScale: string;
  density: string;
}) {
  const payload = JSON.stringify({ accent, accentContrast, accentSoft, mode, fontScale, density });
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=${payload};var r=document.documentElement;var dark=t.mode==='dark'||(t.mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.setAttribute('data-theme',dark?'dark':'light');r.setAttribute('data-font-scale',t.fontScale);r.setAttribute('data-density',t.density);r.style.setProperty('--c-accent',t.accent);r.style.setProperty('--c-accent-contrast',t.accentContrast);r.style.setProperty('--c-accent-soft',t.accentSoft);r.style.setProperty('--c-focus-ring',t.accent);}catch(e){}})();`,
      }}
    />
  );
}

export function appearanceAttributes(appearance: {
  themeAccent: string;
  themeMode: string;
  fontScale: string;
  density: string;
} | null): Record<string, string> {
  if (!appearance) return {};
  return {
    "data-theme": appearance.themeMode === "system" ? "system" : appearance.themeMode,
    "data-font-scale": appearance.fontScale,
    "data-density": appearance.density,
  };
}

export function editionLabel(edition: Edition): string {
  return edition === "business" ? "Business" : "Basic";
}
