"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/useT";
import {
  LayoutDashboard, LineChart, BarChart3,
  MoreHorizontal, BookMarked, Target, Settings, X, BookOpen, CreditCard, Users2, LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",  labelKey: "nav_dashboard"  as const, icon: LayoutDashboard },
  { href: "/trades",     labelKey: "nav_trades"     as const, icon: LineChart },
  { href: "/playbooks",  labelKey: "nav_playbooks"  as const, icon: Target },
  { href: "/settings",   labelKey: "nav_settings"   as const, icon: Settings },
] as const;

const MORE_ITEMS = [
  { href: "/notebook", labelKey: "nav_notebook"  as const, icon: BookMarked },
  { href: "/analytics", labelKey: "nav_analytics"  as const, icon: BarChart3 },
  { href: "/learn",    labelKey: "nav_education" as const, icon: BookOpen },
  { href: "/team",     labelKey: "nav_team_dashboard" as const, icon: Users2 },
  { href: "/pricing",  labelKey: "nav_subscription" as const, icon: CreditCard },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useT();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href)
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden h-16 items-stretch border-t border-stroke bg-rail">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
                isActive ? "text-brand" : "text-ink-4 hover:text-ink-2"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-brand" : "")} />
              <span className="truncate leading-tight">{t(item.labelKey).split(" ")[0]}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
            isMoreActive ? "text-brand" : "text-ink-4 hover:text-ink-2"
          )}
        >
          <MoreHorizontal className={cn("h-5 w-5 shrink-0", isMoreActive ? "text-brand" : "")} />
          <span className="leading-tight">{t("nav_more")}</span>
        </button>
      </nav>

      {/* More sheet */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden rounded-t-2xl border-t border-stroke bg-rail px-4 pt-4 pb-6 anim-slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-ink">{t("nav_more")}</p>
              <button
                onClick={() => setShowMore(false)}
                className="rounded-lg p-1.5 text-ink-4 hover:bg-tinted hover:text-ink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                      isActive
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-stroke bg-card text-ink-3 hover:border-brand/20 hover:text-ink"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center leading-tight">
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("nav_logout")}</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
