"use client";
import { useAppStore } from "@/store";
import { translations, type TKey } from "@/lib/i18n";

export function useT() {
  const lang = useAppStore((s) => s.lang);
  return (key: TKey, vars?: Record<string, string | number>): string => {
    const dict = translations[lang] as Record<string, string>;
    let str = dict[key] ?? (translations.en as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };
}
