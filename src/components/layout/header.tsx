"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { Languages, Plus, X } from "lucide-react";
import { useT } from "@/lib/useT";
import { useSession } from "next-auth/react";
import type { Entitlements } from "@/lib/entitlements";
import { PreTradeChecklistModal } from "@/components/ui/pre-trade-checklist";
import { TrevixeMark } from "@/components/brand/trascend-mark";

function TrialBanner({ entitlements }: { entitlements: Entitlements }) {
  const t = useT();
  const [now] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  if (!entitlements.trialEndsAt || entitlements.status !== "trialing") return null;

  const msLeft = new Date(entitlements.trialEndsAt).getTime() - now;
  const daysLeft = Math.ceil(msLeft / 86_400_000);

  if (daysLeft <= 0) return null;

  // Dismissible unless on day -3 or -1 (force re-show)
  const storageKey = `trial_dismissed_${daysLeft}`;
  if (dismissed) return null;

  const isUrgent = daysLeft <= 1;
  const message = isUrgent
    ? t("trial_banner_urgent")
    : t("trial_banner", { n: daysLeft });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-2 text-[12px] font-medium",
        isUrgent
          ? "bg-red-500/10 border-b border-red-500/20 text-red-400"
          : "bg-amber-500/8 border-b border-amber-500/15 text-amber-400"
      )}
    >
      <span className="flex-1 min-w-0 truncate">{message}</span>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/pricing"
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
            isUrgent
              ? "bg-red-500/15 hover:bg-red-500/25 text-red-300"
              : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
          )}
        >
          {t("trial_upgrade_cta")}
        </Link>
        <button
          onClick={() => {
            setDismissed(true);
            try { sessionStorage.setItem(storageKey, "1"); } catch {}
          }}
          className="text-ink-5 hover:text-ink-3 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const { sidebarCollapsed, lang, setLang } = useAppStore();
  const { data: session } = useSession();
  const t = useT();
  const router = useRouter();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);

  const dateLabel = new Date().toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    if (!session) return;
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then(setEntitlements)
      .catch(() => {});
  }, [session]);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex flex-col transition-all duration-300 header-glass",
        "left-0",
        sidebarCollapsed ? "md:left-[60px]" : "md:left-[220px]"
      )}
    >
      {/* Trial banner (conditional) */}
      {entitlements && <TrialBanner entitlements={entitlements} />}

      {/* Main header row */}
      <div className="flex h-14 items-center justify-between px-5">
        {/* ── Left: market status ── */}
        <div className="flex items-center gap-4">
          {/* Mobile logo */}
          <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight sm:hidden">
            <TrevixeMark size={28} />
            <span>
              Trevixe
            </span>
          </span>

          {/* Market status */}
          <div className="hidden md:flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] pulse-dot shrink-0" />
            <span className="editorial-label">{t("dash_markets_live")}</span>
          </div>
        </div>

        {/* ── Right: date · lang · new trade ── */}
        <div className="flex items-center gap-2">
          {/* Date */}
          <span className="editorial-label hidden lg:block mr-2 text-ink-5">
            {dateLabel}
          </span>

          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "ru" : "en")}
            title={lang === "en" ? "Switch to Russian" : "Switch to English"}
            aria-label={lang === "en" ? "Switch to Russian" : "Switch to English"}
            className="inline-flex items-center gap-1.5 rounded-md border border-stroke px-2 py-1 text-[11px] font-semibold text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors tracking-widest"
            data-no-auto-translate
          >
            <Languages className="h-3.5 w-3.5 text-ink-4" />
            <span className={cn(lang === "en" ? "text-brand" : "text-ink-4")}>EN</span>
            <span className="text-ink-5">/</span>
            <span className={cn(lang === "ru" ? "text-brand" : "text-ink-4")}>RU</span>
          </button>

          {/* New Trade CTA */}
          <button
            onClick={() => setShowChecklist(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
            style={{ boxShadow: "0 4px 14px rgba(240,114,64,0.28)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Trade
          </button>
        </div>
      </div>

      {showChecklist && (
        <PreTradeChecklistModal
          onProceed={() => { setShowChecklist(false); router.push("/trades?new=1"); }}
          onCancel={() => setShowChecklist(false)}
        />
      )}
    </header>
  );
}
