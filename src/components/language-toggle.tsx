"use client";

import { Languages } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { translatePhrase } from "@/lib/phrase-i18n";

const appRoutes = [
  "/dashboard",
  "/trades",
  "/journal",
  "/notebook",
  "/playbooks",
  "/analytics",
  "/progress",
  "/reports",
  "/backtesting",
  "/education",
  "/learn",
  "/sage",
  "/settings",
  "/team",
];

// Routes that have their own language toggle in the nav — hide the floating one
const routesWithOwnToggle = ["/"];

export function LanguageToggle({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname();
  const { status } = useSession();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  if (floating && appRoutes.some((route) => pathname?.startsWith(route))) return null;
  if (floating && pathname?.startsWith("/pricing") && status === "authenticated") return null;
  if (floating && routesWithOwnToggle.includes(pathname ?? "")) return null;

  const nextLang = lang === "en" ? "ru" : "en";
  const title = nextLang === "ru" ? "Switch to Russian" : "Switch to English";

  return (
    <button
      type="button"
      onClick={() => setLang(nextLang)}
      title={translatePhrase(title, lang)}
      aria-label={translatePhrase(title, lang)}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#15130F]/90 px-3 text-[11px] font-semibold tracking-widest text-[#F4F1EE] shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur transition-colors hover:border-[#F07240]/40 hover:text-[#F07240]",
        floating && "fixed right-4 top-4 z-[80]"
      )}
      data-no-auto-translate
    >
      <Languages className="h-3.5 w-3.5" />
      <span className={lang === "en" ? "text-[#F07240]" : ""}>EN</span>
      <span className="text-[#5A5753]">/</span>
      <span className={lang === "ru" ? "text-[#F07240]" : ""}>RU</span>
    </button>
  );
}
