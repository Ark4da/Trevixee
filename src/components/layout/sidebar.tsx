"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { useT } from "@/lib/useT";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  LineChart,
  Target,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Languages,
  Calculator,
  LogOut,
  Users,
  Rss,
  Trophy,
  SlidersHorizontal,
  ChevronDown,
  Plus,
  Check,
  BookOpen,
  NotebookPen,
  Eye,
} from "lucide-react";
import { RiskCalculator } from "@/components/ui/risk-calculator";
import type { Entitlements } from "@/lib/entitlements";
import { TrevixeMark } from "@/components/brand/trascend-mark";

/* ── Logo mark SVG ── */
function LogoMark({ size = 24 }: { size?: number }) {
  return <TrevixeMark size={size} title="Trevixe" />;
}

/* ── Plan chip ── */
function PlanChip({ entitlements }: { entitlements: Entitlements | null }) {
  const t = useT();
  const [now] = useState(() => Date.now());
  if (!entitlements || entitlements.plan === "free") return null;

  let label = "";
  let bg = "rgba(240,114,64,0.12)";
  let color = "var(--color-brand)";

  if (entitlements.status === "trialing" && entitlements.trialEndsAt) {
    const days = Math.ceil(
      (new Date(entitlements.trialEndsAt).getTime() - now) / 86_400_000
    );
    label = t("plan_trial_days", { n: days });
    bg = "rgba(234,179,8,0.12)";
    color = "#CA8A04";
  } else if (entitlements.status === "past_due") {
    label = t("plan_past_due");
    bg = "rgba(239,68,68,0.12)";
    color = "#EF4444";
  } else if (entitlements.plan === "team") {
    label = t("plan_team");
    bg = "rgba(99,102,241,0.12)";
    color = "#6366F1";
  } else {
    label = t("plan_pro");
  }

  return (
    <span
      className="chip text-[9px] shrink-0"
      style={{ background: bg, color, padding: "2px 7px" }}
    >
      {label}
    </span>
  );
}

/* ── Personal workspace item ── */
interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

interface WorkspaceSwitcherProps {
  collapsed: boolean;
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  onSelect: (id: string | null) => void;
  canCreateWorkspace: boolean;
}

function WorkspaceSwitcher({
  collapsed,
  workspaces,
  activeWorkspaceId,
  onSelect,
  canCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const active = workspaces.find((w) => w.id === activeWorkspaceId);
  const label = active ? active.name : t("workspace_personal");

  if (collapsed) return null;

  return (
    <div ref={ref} className="relative px-3 pt-2 pb-1 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="trader-card flex w-full items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-ink-2 hover:bg-white/[0.04] transition-colors"
      >
        <div className="h-5 w-5 rounded-md bg-brand/20 border border-brand/30 flex items-center justify-center text-brand text-[9px] font-bold shrink-0 select-none">
          {label[0]?.toUpperCase() ?? "P"}
        </div>
        <span className="flex-1 min-w-0 truncate text-left">{label}</span>
        <ChevronDown className={cn("h-3 w-3 text-ink-5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-xl border border-stroke bg-card shadow-deep py-1">
          {/* Personal */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-tinted transition-colors"
          >
            <div className="h-5 w-5 rounded-md bg-brand/20 border border-brand/30 flex items-center justify-center text-brand text-[9px] font-bold shrink-0">
              P
            </div>
            <span className="flex-1 text-left text-ink-2">{t("workspace_personal")}</span>
            {activeWorkspaceId === null && <Check className="h-3 w-3 text-brand" />}
          </button>

          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSelect(ws.id); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-tinted transition-colors"
            >
              <div className="h-5 w-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[9px] font-bold shrink-0">
                {ws.name[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-left text-ink-2 truncate">{ws.name}</span>
              {activeWorkspaceId === ws.id && <Check className="h-3 w-3 text-brand" />}
            </button>
          ))}

          <div className="my-1 mx-2 h-px bg-stroke" />

          {canCreateWorkspace ? (
            <button
              onClick={() => { router.push("/settings?tab=account"); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-ink-4 hover:text-ink-2 hover:bg-tinted transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>{t("workspace_create")}</span>
            </button>
          ) : (
            <button
              onClick={() => { router.push("/pricing"); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-ink-4 hover:text-ink-2 hover:bg-tinted transition-colors"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>{t("workspace_create")}</span>
              <span
                className="chip text-[9px] ml-auto shrink-0"
                style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1", padding: "1px 5px" }}
              >
                TEAM
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Nav items ── */
const PERSONAL_NAV = [
  { href: "/dashboard",  labelKey: "nav_dashboard"  as const, icon: LayoutDashboard },
  { href: "/trades",     labelKey: "nav_trades"     as const, icon: LineChart },
  { href: "/playbooks",  labelKey: "nav_playbooks"  as const, icon: Target },
  { href: "/analytics",  labelKey: "nav_analytics"  as const, icon: BarChart3 },
  { href: "/notebook",   labelKey: "nav_notebook"   as const, icon: NotebookPen },
  { href: "/sage",       labelKey: "nav_sage"       as const, icon: Eye },
  { href: "/learn",      labelKey: "nav_education"  as const, icon: BookOpen },
] as const;

const TEAM_NAV = [
  { href: "/team",             labelKey: "nav_team_dashboard"   as const, icon: LayoutDashboard },
  { href: "/team/analytics",   labelKey: "nav_team_analytics"   as const, icon: BarChart3 },
  { href: "/team/journal",     labelKey: "nav_team_journal"     as const, icon: NotebookPen },
  { href: "/team/feed",        labelKey: "nav_team_feed"        as const, icon: Rss },
  { href: "/team/members",     labelKey: "nav_members"          as const, icon: Users },
  { href: "/team/leaderboard", labelKey: "nav_leaderboard"      as const, icon: Trophy },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, lang, setLang, activeWorkspaceId, setActiveWorkspaceId } = useAppStore();
  const { data: session } = useSession();
  const [showCalc, setShowCalc] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const t = useT();

  const displayName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "Trader";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then(setEntitlements)
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (entitlements && !entitlements.capabilities?.canViewTeamFeed && activeWorkspaceId) {
      setActiveWorkspaceId(null);
    }
  }, [activeWorkspaceId, entitlements, setActiveWorkspaceId]);

  useEffect(() => {
    if (!entitlements?.capabilities?.canViewTeamFeed) return;
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setWorkspaces(data);
        if (activeWorkspaceId && !data.some((workspace: WorkspaceItem) => workspace.id === activeWorkspaceId)) {
          setActiveWorkspaceId(pathname?.startsWith("/team") ? data[0]?.id ?? null : null);
          return;
        }
        if (!activeWorkspaceId && pathname?.startsWith("/team") && data[0]) {
          setActiveWorkspaceId(data[0].id);
        }
      })
      .catch(() => {});
  }, [activeWorkspaceId, entitlements, pathname, setActiveWorkspaceId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const isTeamMode = activeWorkspaceId !== null;
  const isOwner = activeWorkspace?.role === "owner";

  const renderNavItem = (
    href: string,
    labelKey: Parameters<typeof t>[0],
    Icon: React.ElementType
  ) => {
    const isActive =
      pathname === href ||
      (href !== "/dashboard" && href !== "/team" && pathname?.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        title={sidebarCollapsed ? t(labelKey) : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium",
          "transition-all duration-200 ease-out",
          isActive
            ? "text-brand bg-brand/[0.07] shadow-[inset_0_0_0_1px_rgba(240,114,64,0.12)]"
            : "text-ink-3 hover:text-ink-2 hover:bg-white/[0.04]"
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-brand anim-fade-in" />
        )}
        <Icon className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          isActive ? "text-brand scale-110" : "text-ink-4"
        )} />
        {!sidebarCollapsed && <span>{t(labelKey)}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col sidebar-glass",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          sidebarCollapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* Separator aligned exactly with header bottom border */}
        <div className="absolute top-14 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        {/* ── Logo ── */}
        <div
          className={cn(
            "flex h-14 items-center shrink-0",
            sidebarCollapsed ? "justify-center px-0" : "px-4 gap-2.5"
          )}
        >
          <LogoMark size={36} />

          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[20px] font-bold tracking-tight text-ink leading-none">
                Trevixe
              </span>
            </div>
          )}

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="rounded-md p-1 text-ink-5 hover:bg-lift hover:text-ink-2 transition-colors shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="absolute right-0 translate-x-1/2 top-5 rounded-full border border-stroke bg-card p-0.5 text-ink-5 hover:text-brand transition-colors shadow-sm"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* ── Trader card ── */}
        {!sidebarCollapsed && session?.user && (
          <div className="px-3 pt-3 shrink-0">
            <div className="trader-card flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-700 flex items-center justify-center text-white font-bold text-[11px] select-none">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#16A34A] border-2 border-[#1D1C1A]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[12px] font-semibold text-ink truncate leading-tight">
                    {displayName}
                  </p>
                  <PlanChip entitlements={entitlements} />
                </div>
                <p className="editorial-label mt-0.5">{t("common_active")}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Workspace switcher ── */}
        <WorkspaceSwitcher
          collapsed={sidebarCollapsed}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelect={setActiveWorkspaceId}
          canCreateWorkspace={entitlements?.capabilities?.canCreateWorkspace ?? false}
        />

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
          {/* Personal nav (always visible) */}
          {!sidebarCollapsed && (
            <p className="editorial-label px-3 pb-1.5 pt-1">{t("sidebar_workspace")}</p>
          )}
          {PERSONAL_NAV.map((item) => renderNavItem(item.href, item.labelKey, item.icon))}

          {/* Team nav (only when a workspace is active) */}
          {isTeamMode && (
            <>
              {!sidebarCollapsed ? (
                <p className="editorial-label px-3 pb-1.5 pt-4">{activeWorkspace?.name ?? "Team"}</p>
              ) : (
                <div className="my-2 mx-3 h-px bg-stroke" />
              )}
              {TEAM_NAV.map((item) => renderNavItem(item.href, item.labelKey, item.icon))}
              {isOwner && renderNavItem("/team/settings", "nav_workspace_settings", SlidersHorizontal)}
            </>
          )}
        </nav>

        {/* ── Bottom: risk calc / team mgmt / settings / lang / logout ── */}
        <div className="sidebar-divider-top px-2 py-2 space-y-px shrink-0">
          {/* Risk calculator */}
          {sidebarCollapsed ? (
            <button
              onClick={() => setShowCalc(true)}
              title={t("nav_risk_calc")}
              className="flex w-full items-center justify-center rounded-lg p-2 text-ink-5 hover:text-brand transition-colors"
            >
              <Calculator className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowCalc(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-ink-4 hover:text-brand hover:bg-white/[0.04] transition-all"
            >
              <Calculator className="h-4 w-4 shrink-0" />
              <span>{t("nav_risk_calc")}</span>
            </button>
          )}
          <Link
            href="/settings"
            title={sidebarCollapsed ? t("nav_settings") : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-200 ease-out",
              pathname === "/settings"
                ? "text-brand bg-brand/[0.07] shadow-[inset_0_0_0_1px_rgba(240,114,64,0.12)]"
                : "text-ink-3 hover:text-ink-2 hover:bg-white/[0.04]"
            )}
          >
            {pathname === "/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-brand anim-fade-in" />
            )}
            <Settings className="h-4 w-4 shrink-0 text-ink-4" />
            {!sidebarCollapsed && <span>{t("nav_settings")}</span>}
          </Link>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ru" : "en")}
            title={
              sidebarCollapsed
                ? lang === "en"
                  ? "Switch to Russian"
                  : "Switch to English"
                : undefined
            }
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150 text-ink-3 hover:text-ink-2 hover:bg-white/[0.04]"
          >
            <Languages className="h-4 w-4 shrink-0 text-ink-4" />
            {!sidebarCollapsed && (
              <span className="flex items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold", lang === "en" ? "text-brand" : "text-ink-4")}>EN</span>
                <span className="text-ink-5">/</span>
                <span className={cn("text-[11px] font-semibold", lang === "ru" ? "text-brand" : "text-ink-4")}>RU</span>
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            title={sidebarCollapsed ? t("nav_logout") : undefined}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150 text-ink-5 hover:bg-red-500/8 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>{t("nav_logout")}</span>}
          </button>
        </div>
      </aside>

      {showCalc && <RiskCalculator onClose={() => setShowCalc(false)} />}
    </>
  );
}
