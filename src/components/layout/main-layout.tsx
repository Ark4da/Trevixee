"use client";
import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileBottomNav } from "./mobile-nav";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, darkMode, toggleDarkMode, hydrateClientState } = useAppStore();
  const pathname = usePathname();

  // On first mount, sync the Zustand store with localStorage value
  useEffect(() => {
    hydrateClientState();
    const saved = localStorage.getItem("tz-dark") === "1";
    if (saved !== darkMode) {
      toggleDarkMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the html class in sync with store state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen app-bg" data-app-shell="true">
      <Sidebar />
      <Header />
      <main
        className={cn(
          "pt-14 transition-all duration-300 min-h-screen pb-16 md:pb-0",
          "pl-0",
          sidebarCollapsed ? "md:pl-[60px]" : "md:pl-[220px]"
        )}
      >
        <div key={pathname} className="p-4 md:p-6 page-enter">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
