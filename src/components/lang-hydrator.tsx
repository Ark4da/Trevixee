"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store";
import type { Lang } from "@/lib/i18n";

export function LangHydrator() {
  const setLang = useAppStore((s) => s.setLang);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tz-lang") as Lang | null;
      if (saved === "ru" || saved === "en") setLang(saved);
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
