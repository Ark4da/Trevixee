"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { GradientAreaChart } from "@/components/ui/gradient-area-chart";
import {
  BarChart3, Users2, Target, BookOpen, Pin, TrendingUp,
  Activity, Trophy, Layers, Download, X, ShieldCheck,
} from "lucide-react";
import {
  TeamEmptyShowcase,
  TeamLoadingPanel,
} from "../_components/team-page-visuals";
import { MemberAvatar } from "../_components/member-identity";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SetupRow {
  setup: string;
  count: number;
  avgR: number;
  winRate: number;
  avgHoldMinutes: number | null;
  profitFactor: number | null;
  trades: {
    id: string;
    symbol: string;
    side: string;
    netPnl: number | null;
    rMultiple: number;
    exitDate: string | null;
  }[];
}

interface MemberRow {
  memberId: string | null;
  userId: string;
  name: string;
  tradeCount: number;
  avgR: number;
  winRate: number;
}

interface PnlPoint {
  day: string;
  pnl: number;
}

interface AmountMember {
  userId: string;
  name: string;
}

interface Analytics {
  period: string;
  totalMembers: number;
  visibleMembers: number;
  activeContributors: number;
  tradeCount: number;
  totalPnl: number | null;
  avgWinRate: number;
  avgRMultiple: number;
  avgRulesFollowedPct: number;
  avgJournalConsistencyPct: number;
  pinnedCount: number;
  bySetup: SetupRow[];
  byMember: MemberRow[];
  pnlByDay: PnlPoint[];
  pnlByMemberDay: Record<string, string | number>[];
  visibleAmountMembers: AmountMember[];
}

type Period = "7d" | "30d" | "90d";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep anim-fade-up">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-3.5 w-3.5", accent ?? "text-ink-4")} />
        <p className="text-[10px] font-medium uppercase tracking-widest text-ink-5">{label}</p>
      </div>
      <p className="font-serif text-[28px] font-bold leading-none tracking-tight text-ink tnum">{value}</p>
      {sub && <p className="text-[11px] text-ink-5 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stroke bg-card px-3 py-2 shadow-deep">
      <p className="mb-1 text-[11px] text-ink-5">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="flex items-center justify-between gap-4 text-[12px]">
            <span className="text-ink-4">{item.name}</span>
            <span className="font-semibold jb-mono" style={{ color: item.color }}>
              {fmtMoney(Number(item.value ?? 0))}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function PnlChart({
  data,
  byMemberData,
  members,
  mode,
  dark,
}: {
  data: PnlPoint[];
  byMemberData: Record<string, string | number>[];
  members: AmountMember[];
  mode: "team" | "member";
  dark: boolean;
}) {
  if ((mode === "team" ? data.length : byMemberData.length) < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-[12px] text-ink-5">
        Not enough data to chart
      </div>
    );
  }
  const colors = ["#F07240", "#6366F1", "#22C55E", "#F59E0B", "#EC4899", "#06B6D4"];

  if (mode === "member" && members.length > 0) {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={byMemberData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" stroke="#737373" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis stroke="#737373" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={58} />
            <Tooltip content={<ChartTooltip />} />
            {members.map((member, index) => (
              <Line
                key={member.userId}
                type="monotone"
                dataKey={member.userId}
                name={member.name}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const cumulativeData = data.reduce<{ label: string; value: number }[]>((points, point) => {
    const previous = points.at(-1)?.value ?? 0;
    return points.concat({
      label: new Date(point.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      value: Math.round((previous + point.pnl) * 100) / 100,
    });
  }, []);

  return (
    <GradientAreaChart
      data={cumulativeData}
      dark={dark}
      height={288}
      tooltipFormatter={fmtMoney}
    />
  );
}

function fmtMoney(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtHold(minutes: number | null) {
  if (minutes === null) return "--";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function contributorTone(metric: "avgR" | "winRate", value: number) {
  if (metric === "avgR") {
    if (value >= 0.75) return { label: "Good", color: "#7BAF8A", bg: "rgba(123,175,138,0.10)", bar: "#7BAF8A" };
    if (value >= 0.25) return { label: "Watch", color: "#D6A05C", bg: "rgba(214,160,92,0.10)", bar: "#D6A05C" };
    return { label: "Review", color: "#AC5A56", bg: "rgba(172,90,86,0.10)", bar: "#AC5A56" };
  }

  if (value >= 55) return { label: "Good", color: "#7BAF8A", bg: "rgba(123,175,138,0.10)", bar: "#7BAF8A" };
  if (value >= 45) return { label: "Watch", color: "#D6A05C", bg: "rgba(214,160,92,0.10)", bar: "#D6A05C" };
  return { label: "Review", color: "#AC5A56", bg: "rgba(172,90,86,0.10)", bar: "#AC5A56" };
}

function contributorValue(member: MemberRow, metric: "avgR" | "winRate") {
  return metric === "avgR" ? member.avgR : member.winRate;
}

export default function TeamAnalyticsPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const darkMode = useAppStore((state) => state.darkMode);
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [pnlMode, setPnlMode] = useState<"team" | "member">("team");
  const [memberMetric, setMemberMetric] = useState<"avgR" | "winRate">("avgR");
  const [selectedSetup, setSelectedSetup] = useState<SetupRow | null>(null);

  const fetchData = useCallback(async (wsId: string, p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/analytics?period=${p}`);
      if (!res.ok) return;
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setData(null); return; }
    fetchData(activeWorkspaceId, period);
  }, [activeWorkspaceId, period, fetchData]);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const header = [
      "setup",
      "count",
      "avg_r",
      "win_rate",
      "avg_hold_minutes",
      "profit_factor",
    ];
    const rows = data.bySetup.map((setup) => [
      setup.setup,
      setup.count,
      setup.avgR,
      setup.winRate,
      setup.avgHoldMinutes ?? "",
      setup.profitFactor ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-analytics-${data.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const rankedMembers = data
    ? [...data.byMember]
        .sort((a, b) => contributorValue(b, memberMetric) - contributorValue(a, memberMetric))
        .slice(0, 8)
    : [];
  const maxContributorValue = Math.max(
    1,
    ...rankedMembers.map((member) =>
      memberMetric === "avgR" ? Math.max(0, member.avgR) : member.winRate
    )
  );

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return (
      <TeamEmptyShowcase
        eyebrow="Аналитика Team Plan"
        title="Покажи командные паттерны без раскрытия приватных сумм."
        description={
          workspaceError
            ? "Локальный workspace API сейчас недоступен, поэтому агрегированная аналитика не отображается."
            : "Выбери командный workspace, чтобы сравнить сетапы, участников, P/L, journaling и rule discipline."
        }
        primaryHref="/settings?tab=account"
        primaryLabel="Создать workspace"
        secondaryHref="/team/leaderboard"
        secondaryLabel="Открыть рейтинг"
        icon={BarChart3}
        checklist={[
          "Проверить переключатель периода 7/30/90 дней",
          "Проверить Team P/L и privacy скрытых сумм",
          "Проверить лучшие сетапы",
          "Проверить график участников",
        ]}
        cards={[
          { icon: Layers, title: "Сетапы", text: "Показывает, какие playbook setups реально работают у команды." },
          { icon: Users2, title: "Участники", text: "Сравнение contributors помогает видеть, где нужна помощь ментора." },
          { icon: ShieldCheck, title: "Приватность", text: "Скрытые суммы исключаются из агрегатов и не раскрываются в UI." },
        ]}
      />
    );
  }

  if (resolvingWorkspace) {
    return (
      <TeamLoadingPanel
        title="Загружаю аналитику команды"
        description="Собираю агрегаты по сетапам, участникам, P/L и privacy rules."
        cards={8}
      />
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
          <div className="pt-2 pb-5 border-b border-stroke flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="editorial-label">Team Insights</p>
          <h1 className="font-serif text-[36px] leading-[0.98] tracking-[-0.03em] font-bold mt-2">
            Analytics<span className="text-brand">.</span>
          </h1>
          <p className="text-[12px] text-ink-5 mt-1.5">
            Aggregate stats — amounts hidden by individual members are excluded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!data?.bySetup.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[12px] font-medium text-ink-3 transition-colors hover:bg-tinted hover:text-ink disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                  period === p ? "bg-tinted text-ink" : "text-ink-4 hover:text-ink-2"
                )}
              >
                {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-stroke bg-card p-4 animate-pulse">
              <div className="h-3 w-20 rounded bg-tinted mb-3" />
              <div className="h-6 w-16 rounded bg-tinted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users2}     label="Active members"       value={String(data.activeContributors)} sub={`of ${data.visibleMembers} visible`} accent="text-indigo-400" />
            <StatCard icon={Activity}   label="Trades"                value={String(data.tradeCount)}                                                  accent="text-brand" />
            <StatCard icon={TrendingUp} label="Total P/L"             value={fmtMoney(data.totalPnl)} sub={data.totalPnl === null ? "All members hide amounts" : undefined} accent={data.totalPnl !== null && data.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} />
            <StatCard icon={Trophy}     label="Win rate"              value={`${data.avgWinRate}%`}                                                    accent="text-amber-400" />
            <StatCard icon={BarChart3}  label="Avg R"                 value={`${data.avgRMultiple >= 0 ? "+" : ""}${data.avgRMultiple.toFixed(2)}R`}   accent={data.avgRMultiple >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} />
            <StatCard icon={Target}     label="Rules followed"        value={`${data.avgRulesFollowedPct}%`}                                            accent="text-brand" />
            <StatCard icon={BookOpen}   label="Journal consistency"   value={`${data.avgJournalConsistencyPct}%`}                                       accent="text-indigo-400" />
            <StatCard icon={Pin}        label="Pinned content"        value={String(data.pinnedCount)}                                                  accent="text-amber-400" />
          </div>

          {/* P/L chart */}
          <div className="min-w-0 rounded-2xl border border-stroke bg-card p-6 shadow-deep anim-fade-up">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-ink-4" />
                Team P/L by day
              </h2>
              <div className="flex items-center gap-2">
                {data.visibleAmountMembers.length > 1 && (
                  <div className="inline-flex rounded-lg border border-stroke bg-tinted/50 p-0.5 gap-0.5">
                    {(["team", "member"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPnlMode(mode)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                          pnlMode === mode ? "bg-card text-ink" : "text-ink-4 hover:text-ink-2"
                        )}
                      >
                        {mode === "team" ? "Team" : "By member"}
                      </button>
                    ))}
                  </div>
                )}
                {data.totalPnl !== null && (
                  <span className={cn(
                    "text-[13px] jb-mono font-semibold",
                    data.totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                  )}>
                    {fmtMoney(data.totalPnl)}
                  </span>
                )}
              </div>
            </div>
            <PnlChart
              data={data.pnlByDay}
              byMemberData={data.pnlByMemberDay}
              members={data.visibleAmountMembers}
              mode={pnlMode}
              dark={darkMode}
            />
          </div>

          {/* Top setups + Top members */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Setups */}
            <div className="rounded-xl border border-stroke bg-card overflow-hidden anim-fade-up">
              <div className="px-5 py-3.5 border-b border-stroke">
                <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
                  <Layers className="h-4 w-4 text-ink-4" />
                  Top setups across the team
                </h2>
              </div>
              {data.bySetup.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-ink-4">No closed trades yet.</div>
              ) : (
                <ul className="divide-y divide-stroke">
                  {data.bySetup.map((s) => (
                    <li
                      key={s.setup}
                      onClick={() => setSelectedSetup(s)}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-tinted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">{s.setup}</p>
                        <p className="text-[11px] text-ink-5">
                          {s.count} trades · {s.winRate}% win · {fmtHold(s.avgHoldMinutes)} avg hold
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={cn(
                          "text-[13px] jb-mono font-semibold",
                          s.avgR >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                        )}>
                          {s.avgR >= 0 ? "+" : ""}{s.avgR.toFixed(2)}R
                        </span>
                        <p className="text-[10px] text-ink-5">PF {s.profitFactor ?? "--"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Members */}
            <div className="rounded-xl border border-stroke bg-card overflow-hidden anim-fade-up delay-100">
              <div className="px-5 py-3.5 border-b border-stroke flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-ink-4" />
                  Top contributors
                </h2>
                <div className="inline-flex rounded-lg border border-stroke bg-tinted/50 p-0.5 gap-0.5">
                  {(["avgR", "winRate"] as const).map((metric) => (
                    <button
                      key={metric}
                      onClick={() => setMemberMetric(metric)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                        memberMetric === metric ? "bg-card text-ink" : "text-ink-4 hover:text-ink-2"
                      )}
                    >
                      {metric === "avgR" ? "Avg R" : "Win %"}
                    </button>
                  ))}
                </div>
              </div>
              {data.byMember.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-ink-4">No active contributors yet.</div>
              ) : (
                <div>
                  <div className="border-b border-stroke px-5 py-4">
                    <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Baseline</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { label: "Good", color: "#7BAF8A", bg: "rgba(123,175,138,0.10)" },
                            { label: "Watch", color: "#D6A05C", bg: "rgba(214,160,92,0.10)" },
                            { label: "Review", color: "#AC5A56", bg: "rgba(172,90,86,0.10)" },
                          ].map((tone) => (
                            <span
                              key={tone.label}
                              className="rounded-md border border-stroke px-2 py-1 text-[10px] font-semibold"
                              style={{ background: tone.bg, color: tone.color }}
                            >
                              {tone.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-ink-5">
                        {memberMetric === "avgR"
                          ? "Good: +0.75R and higher. Watch: +0.25R to +0.74R. Lower values need review."
                          : "Good: 55% and higher. Watch: 45% to 54%. Lower values need review."}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-stroke">
                    {rankedMembers.map((m, index) => {
                      const value = contributorValue(m, memberMetric);
                      const tone = contributorTone(memberMetric, value);
                      const barValue =
                        m.tradeCount === 0
                          ? 0
                        : memberMetric === "avgR"
                          ? Math.max(5, (Math.max(0, m.avgR) / maxContributorValue) * 100)
                          : Math.max(5, Math.min(100, m.winRate));

                      return (
                        <li
                          key={m.userId}
                          className="px-5 py-3.5 hover:bg-tinted/35 cursor-pointer transition-colors"
                          onClick={() => router.push(m.memberId ? `/team/members/${m.memberId}` : `/team/members`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-[11px] font-semibold text-ink-5 jb-mono">
                              #{index + 1}
                            </span>
                            <MemberAvatar seed={m.userId} name={m.name} />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-[13px] font-semibold text-ink">{m.name}</p>
                                <span className="rounded-md border border-stroke px-2 py-0.5 text-[10px] font-semibold" style={{ background: tone.bg, color: tone.color }}>
                                  {tone.label}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-ink-5">{m.tradeCount} trades · {m.winRate}% win</p>
                            </div>
                            <span className="shrink-0 text-[13px] font-semibold jb-mono" style={{ color: tone.color }}>
                              {memberMetric === "avgR" ? `${m.avgR >= 0 ? "+" : ""}${m.avgR.toFixed(2)}R` : `${m.winRate}%`}
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tinted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${barValue}%`,
                                background: tone.bar,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {selectedSetup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-stroke bg-card shadow-deep">
                <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
                  <div>
                    <p className="editorial-label">Setup detail</p>
                    <h3 className="mt-1 text-[18px] font-semibold text-ink">{selectedSetup.setup}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedSetup(null)}
                    className="rounded-lg p-1.5 text-ink-5 transition-colors hover:bg-tinted hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 border-b border-stroke p-4">
                  <StatCard icon={Activity} label="Trades" value={String(selectedSetup.count)} />
                  <StatCard icon={Trophy} label="Profit factor" value={String(selectedSetup.profitFactor ?? "--")} />
                  <StatCard icon={BarChart3} label="Avg hold" value={fmtHold(selectedSetup.avgHoldMinutes)} />
                </div>
                <div className="max-h-[42vh] overflow-y-auto">
                  <ul className="divide-y divide-stroke">
                    {selectedSetup.trades.map((trade) => {
                      const positive = trade.netPnl !== null ? trade.netPnl >= 0 : trade.rMultiple >= 0;
                      return (
                        <li
                          key={trade.id}
                          onClick={() => router.push(`/trades/${trade.id}`)}
                          className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-tinted/40"
                        >
                          <div className="flex w-32 shrink-0 items-center gap-2">
                            <span className="chip border border-stroke bg-tinted text-[10px] font-bold text-ink">{trade.symbol}</span>
                            <span
                              className="chip text-[10px] font-semibold"
                              style={{
                                background: trade.side === "long" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                                color: trade.side === "long" ? "#22C55E" : "#EF4444",
                              }}
                            >
                              {trade.side.toUpperCase()}
                            </span>
                          </div>
                          <p className="min-w-0 flex-1 text-[11px] text-ink-5">
                            {trade.exitDate ? new Date(trade.exitDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "--"}
                          </p>
                          <span className={cn("text-[12px] font-semibold jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
                            {trade.rMultiple >= 0 ? "+" : ""}{trade.rMultiple.toFixed(2)}R
                          </span>
                          <span className={cn("w-24 text-right text-[12px] font-semibold jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
                            {fmtMoney(trade.netPnl)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
