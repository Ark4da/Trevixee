"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Target, X, Trash2, Edit2, AlertTriangle,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, Power,
  FlaskConical, Share2, Library, Copy, Lock,
  Activity, Gauge, Link2, ArrowRight, RefreshCcw,
} from "lucide-react";
import { useT } from "@/lib/useT";
import { Portal } from "@/components/ui/portal";
import { useToast } from "@/components/ui/toast";
import { ContextTip } from "@/components/ui/context-tip";
import { PlaybookBacktestTab } from "@/components/playbooks/backtest-tab";
import { computeResult, type BacktestTrade } from "@/lib/backtest";
import { useAppStore } from "@/store";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

// Editorial palette
const SAGE  = "#22C55E";
const BRICK = "#EF4444";
const AMBER = "#B08050";
const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;

function rotateBySeed<T>(items: T[], seed: number) {
  if (items.length === 0) return [];
  const offset = ((seed % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function useRefreshCycle() {
  return useState(() => {
    const now = new Date();
    return {
      weekIndex: Math.floor(now.getTime() / WEEK_MS),
      label: now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
    };
  })[0];
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface PlaybookRule {
  id?: string;
  type: string;
  text: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  market: string;
  timeframe: string | null;
  tags: string | null;
  isActive: boolean;
  isReadOnly?: boolean;
  sourcePlaybookId?: string | null;
  pushedByUserId?: string | null;
  pushedAt?: string | null;
  rules: PlaybookRule[];
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgR: number;
}

const RULE_TYPE_HEX: Record<string, string> = {
  entry:   SAGE,
  exit:    "#6E8FAF",
  risk:    BRICK,
  general: "var(--color-ink-3)",
};
function ruleTypeStyle(type: string): React.CSSProperties {
  const hex = RULE_TYPE_HEX[type] || RULE_TYPE_HEX.general;
  return { color: hex, background: `${hex}20` };
}

const inputCls = "h-10 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";

function tradeMoment(trade: Pick<BacktestTrade, "entryDate" | "exitDate">) {
  return trade.exitDate || trade.entryDate;
}

function tagList(value?: string | null) {
  return (value || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

function matchesPlaybookTrade(pb: Playbook, trade: BacktestTrade) {
  if (trade.playbookId === pb.id) return true;
  if (trade.setup && trade.setup.toLowerCase() === pb.name.toLowerCase()) return true;
  const pbTags = tagList(pb.tags);
  if (pbTags.length === 0) return false;
  const tradeTags = tagList(trade.tags);
  return pbTags.some((tag) => tradeTags.includes(tag));
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function fmtR(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
}

// в”Ђв”Ђ Modal wrapper with correct backdrop в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[200] overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// в”Ђв”Ђ Playbook Editor в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function PlaybookEditor({ playbook, onSave, onClose }: {
  playbook?: Playbook | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState(playbook?.name || "");
  const [description, setDescription] = useState(playbook?.description || "");
  const [market, setMarket] = useState(playbook?.market || "futures");
  const [timeframe, setTimeframe] = useState(playbook?.timeframe || "5min");
  const [tags, setTags] = useState(playbook?.tags || "");
  const [rules, setRules] = useState<{ type: string; text: string }[]>(
    playbook?.rules.map((r) => ({ type: r.type, text: r.text })) || [{ type: "entry", text: "" }]
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const url = playbook ? `/api/playbooks/${playbook.id}` : "/api/playbooks";
      const res = await fetch(url, {
        method: playbook ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, market, timeframe, tags, rules: rules.filter((r) => r.text.trim()) }),
      });
      if (!res.ok) throw new Error("failed");
      onSave();
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="rounded-xl border border-stroke bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-ink">
            {playbook ? t("pb_edit_title") : t("pb_create_title")}
          </h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Market in 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-ink-3 mb-1.5">{t("pb_name")} *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("pb_name_ph")} className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm text-ink-3 mb-1.5">{t("pb_market")}</label>
              <select value={market} onChange={(e) => setMarket(e.target.value)} className={inputCls}>
                <option value="futures">{t("common_futures")}</option>
                <option value="forex">Forex</option>
                <option value="stocks">{t("common_stocks")}</option>
                <option value="crypto">{t("common_crypto")}</option>
                <option value="options">{t("common_options")}</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-ink-3 mb-1.5">{t("pb_description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("pb_description_ph")}
              rows={2}
              className="w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none resize-none"
            />
          </div>

          {/* Timeframe + Tags in 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-ink-3 mb-1.5">{t("pb_timeframe")}</label>
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={inputCls}>
                <option value="1min">1min</option>
                <option value="5min">5min</option>
                <option value="15min">15min</option>
                <option value="1H">1H</option>
                <option value="4H">4H</option>
                <option value="Daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-ink-3 mb-1.5">{t("pb_tags")}</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("pb_tags_ph")} className={inputCls} />
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-ink-3">{t("pb_rules")}</label>
              <button type="button" onClick={() => setRules([...rules, { type: "entry", text: "" }])} className="text-xs text-brand hover:text-brand-deep">
                {t("pb_add_rule")}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={rule.type}
                    onChange={(e) => { const nr = [...rules]; nr[i].type = e.target.value; setRules(nr); }}
                    className="h-9 rounded-lg border border-stroke-2 bg-tinted px-2 text-xs text-ink focus:outline-none w-24 shrink-0"
                  >
                    <option value="entry">{t("pb_rule_entry")}</option>
                    <option value="exit">{t("pb_rule_exit")}</option>
                    <option value="risk">{t("pb_rule_risk")}</option>
                    <option value="general">{t("pb_rule_general")}</option>
                  </select>
                  <input
                    value={rule.text}
                    onChange={(e) => { const nr = [...rules]; nr[i].text = e.target.value; setRules(nr); }}
                    placeholder={t("pb_rule_ph")}
                    className="flex-1 h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
                  />
                  <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-ink-5 hover:text-ink-2 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-stroke">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors">
              {t("cancel")}
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-deep py-2.5 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all disabled:opacity-50 shadow-lg shadow-brand/20">
              {saving ? t("pb_saving") : playbook ? t("pb_update") : t("pb_save")}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// в”Ђв”Ђ Delete Modal в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function DeleteModal({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-xl border border-stroke bg-card p-6 shadow-xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: `${BRICK}1A` }}>
                <AlertTriangle className="h-6 w-6" style={{ color: BRICK }} />
              </div>
              <h3 className="text-lg font-semibold text-ink">{t("pb_delete_title")}</h3>
              <p className="text-sm text-ink-3">{t("pb_delete_desc", { name })}</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors">{t("cancel")}</button>
              <button onClick={onConfirm} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors" style={{ background: BRICK }}>{t("delete")}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// в”Ђв”Ђ Playbook Card в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function PlaybookCard({ pb, onEdit, onDelete, onToggleActive, onPushToTeam, onBacktest }: {
  pb: Playbook;
  onEdit: (pb: Playbook) => void;
  onDelete: (id: string) => void;
  onToggleActive: (pb: Playbook) => void;
  onPushToTeam?: (pb: Playbook) => void;
  onBacktest: (pb: Playbook) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const ruleTypeLabelKey = (type: string): Parameters<typeof t>[0] => {
    const map: Record<string, Parameters<typeof t>[0]> = {
      entry: "pb_rule_entry", exit: "pb_rule_exit", risk: "pb_rule_risk", general: "pb_rule_general",
    };
    return map[type] || "pb_rule_general";
  };

  const accent = pb.totalTrades === 0
    ? "rgba(160,160,170,0.5)"
    : pb.totalPnl >= 0 ? SAGE : BRICK;

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-deep p-6 relative overflow-hidden transition-all",
      pb.isActive ? "border-stroke hover:border-brand/30" : "border-stroke opacity-60"
    )}>
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}20)` }} />
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="editorial-label">{pb.market}{pb.timeframe ? ` - ${pb.timeframe}` : ""}</p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <h3 className="font-serif text-[22px] font-bold tracking-tight text-ink">{pb.name}</h3>
            {!pb.isActive && (
              <span className="chip" style={{ background: "rgba(160,160,170,0.15)", color: "var(--color-ink-3)" }}>{t("pb_inactive")}</span>
            )}
            {pb.isReadOnly && (
              <span className="chip" title="Pushed by a team mentor" style={{ background: "rgba(110,143,175,0.16)", color: "#6E8FAF" }}>
                <Lock className="h-3 w-3" /> Read-only
              </span>
            )}
          </div>
          {pb.description && <p className="text-sm text-ink-3 mt-2 line-clamp-2 font-serif italic">{pb.description}</p>}
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          {!pb.isReadOnly && (
            <>
              <button
                onClick={() => onToggleActive(pb)}
                title={pb.isActive ? t("pb_deactivate") : t("pb_activate")}
                className="rounded p-1 transition-colors text-ink-5 hover:text-ink-2"
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onEdit(pb)} className="rounded p-1 text-ink-5 hover:text-brand transition-colors">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(pb.id)} className="rounded p-1 text-ink-5 hover:text-ink-2 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {onPushToTeam && (
            <button
              onClick={() => onPushToTeam(pb)}
              title="Create read-only copies for team members"
              className="inline-flex items-center gap-1 rounded-md border border-stroke bg-tinted px-2 py-1 text-[11px] font-semibold text-ink-4 hover:border-brand/40 hover:text-brand transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Team
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        <div className="rounded-lg bg-tinted border border-stroke px-2 py-2 min-w-0 overflow-hidden">
          <p className="editorial-label text-[9px] leading-tight">{t("pb_win_rate")}</p>
          <p className="font-serif text-base font-bold mt-0.5 tnum truncate leading-tight" style={{ color: pb.winRate >= 60 ? SAGE : pb.winRate >= 50 ? AMBER : pb.totalTrades === 0 ? "var(--color-ink-5)" : BRICK }}>
            {pb.totalTrades > 0 ? <>{pb.winRate}<span className="text-[10px]">%</span></> : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-tinted border border-stroke px-2 py-2 min-w-0 overflow-hidden">
          <p className="editorial-label text-[9px] leading-tight">{t("pb_trades")}</p>
          <p className="font-serif text-base font-bold mt-0.5 tnum text-ink truncate leading-tight">{pb.totalTrades}</p>
        </div>
        <div className="rounded-lg bg-tinted border border-stroke px-2 py-2 min-w-0 overflow-hidden">
          <p className="editorial-label text-[9px] leading-tight">{t("pb_total_pl")}</p>
          <p className="font-mono text-sm font-bold mt-0.5 tnum truncate leading-tight" style={{ color: pb.totalPnl >= 0 ? SAGE : BRICK }}>
            {pb.totalTrades > 0 ? fmtCompact(pb.totalPnl) : "-"}
          </p>
        </div>
        <div className="rounded-lg bg-tinted border border-stroke px-2 py-2 min-w-0 overflow-hidden">
          <p className="editorial-label text-[9px] leading-tight">{t("pb_avg_r")}</p>
          <p className="font-serif text-base font-bold mt-0.5 tnum truncate leading-tight" style={{ color: pb.avgR >= 0 ? SAGE : BRICK }}>
            {pb.totalTrades > 0 ? <>{pb.avgR}<span className="text-[10px]">R</span></> : "-"}
          </p>
        </div>
      </div>

      {/* Win rate bar (if has trades) */}
      {pb.totalTrades > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="editorial-label">{t("pb_win_rate")}</span>
            <span className="font-mono font-semibold tnum" style={{ color: pb.winRate >= 50 ? SAGE : BRICK }}>{pb.winRate}%</span>
          </div>
          <div className="h-1 rounded-full bg-lift overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pb.winRate}%`, background: pb.winRate >= 60 ? `linear-gradient(90deg, ${SAGE}, #B08050)` : pb.winRate >= 50 ? AMBER : BRICK }}
            />
          </div>
        </div>
      )}

      {/* Test this setup */}
      <button
        onClick={() => onBacktest(pb)}
        className="w-full mb-3 flex items-center justify-center gap-1.5 rounded-lg border border-stroke-2 py-1.5 text-xs text-ink-4 hover:border-brand/40 hover:text-brand transition-colors"
      >
        <FlaskConical className="h-3.5 w-3.5" /> Backtest
      </button>

      {/* Tags */}
      {pb.tags && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {pb.tags.split(",").map((tag) => (
            <span key={tag} className="chip" style={{ background: "rgba(240,114,64,0.1)", color: "var(--color-brand)" }}>{tag.trim()}</span>
          ))}
        </div>
      )}

      {/* Rules toggle */}
      {pb.rules.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-ink-4 hover:text-ink transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? t("pb_hide_rules") : t("pb_show_rules")} ({pb.rules.length})
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-stroke space-y-2">
              {pb.rules.map((r, i) => (
                <div key={r.id || i} className="flex items-start gap-2">
                  <span className="rounded-md px-1.5 py-0.5 text-xs font-medium mt-0.5 shrink-0" style={ruleTypeStyle(r.type)}>
                    {t(ruleTypeLabelKey(r.type))}
                  </span>
                  <span className="text-sm text-ink-2">{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pb.rules.length === 0 && (
        <p className="text-xs text-ink-5">{t("pb_no_rules")}</p>
      )}
    </div>
  );
}

type PlaybookAnalyticsRow = {
  playbook: Playbook;
  trades: BacktestTrade[];
  result: ReturnType<typeof computeResult>;
  score: number;
  recentPnl: number;
  linkedById: number;
  linkedBySetup: number;
  linkedByTags: number;
};

function scorePlaybook(result: ReturnType<typeof computeResult>, ruleCount: number) {
  if (result.totalTrades === 0) return 0;
  const edge = Math.max(-30, Math.min(45, result.avgRMultiple * 25));
  const profit = result.netPnl > 0 ? 18 : result.netPnl < 0 ? -18 : 0;
  const sample = Math.min(18, result.totalTrades * 1.5);
  const drawdownPenalty = result.maxDrawdown > Math.max(1, Math.abs(result.netPnl)) ? -12 : 0;
  const ruleBonus = Math.min(12, ruleCount * 2);
  return Math.round(Math.max(0, Math.min(100, 45 + edge + profit + sample + ruleBonus + drawdownPenalty)));
}

function AnalyticsTooltip({ active, payload, label, dark }: { active?: boolean; payload?: unknown; label?: unknown; dark: boolean }) {
  const items = Array.isArray(payload) ? payload as Array<{ value?: unknown; payload?: { trades?: number; winRate?: number } }> : [];
  if (!active || items.length === 0) return null;
  const value = Number(items[0]?.value ?? 0);
  const row = items[0]?.payload;
  return (
    <div style={{
      background: dark ? "#1D1C1A" : "#FFFFFF",
      border: `1px solid ${dark ? "rgba(255,190,120,0.12)" : "#D4D4E0"}`,
      borderRadius: 10,
      padding: "9px 12px",
      fontSize: 12,
      minWidth: 140,
    }}>
      <p style={{ color: dark ? "#8A8177" : "#7A7068", marginBottom: 5 }}>{typeof label === "string" ? label : ""}</p>
      <p style={{ color: value >= 0 ? SAGE : BRICK, fontWeight: 700 }}>{fmtCompact(value)}</p>
      {row && (
        <p style={{ color: dark ? "#8A8177" : "#7A7068", marginTop: 3, fontSize: 10 }}>
          {row.trades ?? 0} trades / {row.winRate ?? 0}% WR
        </p>
      )}
    </div>
  );
}

function PlaybookAnalyticsTab({ playbooks, onBacktest }: { playbooks: Playbook[]; onBacktest: (pb: Playbook) => void }) {
  const { darkMode } = useAppStore();
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trades?limit=2000&status=closed&sort=entryDate&dir=asc");
      const data = await res.json();
      setTrades(Array.isArray(data.trades) ? data.trades : []);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const rows = useMemo<PlaybookAnalyticsRow[]>(() => {
    return playbooks.map((pb) => {
      const matched = trades.filter((trade) => matchesPlaybookTrade(pb, trade));
      const sorted = [...matched].sort((a, b) => tradeMoment(a).localeCompare(tradeMoment(b)));
      const result = computeResult(sorted);
      const recentPnl = computeResult(sorted.slice(-10)).netPnl;
      const pbTags = tagList(pb.tags);
      let linkedById = 0;
      let linkedBySetup = 0;
      let linkedByTags = 0;
      for (const trade of trades) {
        if (trade.playbookId === pb.id) linkedById += 1;
        else if (trade.setup && trade.setup.toLowerCase() === pb.name.toLowerCase()) linkedBySetup += 1;
        else if (pbTags.length > 0 && pbTags.some((tag) => tagList(trade.tags).includes(tag))) linkedByTags += 1;
      }
      return {
        playbook: pb,
        trades: sorted,
        result,
        recentPnl,
        linkedById,
        linkedBySetup,
        linkedByTags,
        score: scorePlaybook(result, pb.rules.length),
      };
    }).sort((a, b) => b.score - a.score || b.result.netPnl - a.result.netPnl);
  }, [playbooks, trades]);

  useEffect(() => {
    if (selectedId && rows.some((row) => row.playbook.id === selectedId)) return;
    setSelectedId(rows[0]?.playbook.id || "");
  }, [rows, selectedId]);

  const selected = rows.find((row) => row.playbook.id === selectedId) || rows[0];

  const selectedRuleStats = useMemo(() => {
    if (!selected) return [] as { type: string; count: number }[];
    const stats = selected.playbook.rules.reduce<Record<string, number>>((acc, rule) => {
      const type = rule.type || "general";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const ordered = ["entry", "exit", "risk", "general"];
    const known = ordered.map((type) => ({ type, count: stats[type] || 0 }));
    const custom = Object.entries(stats)
      .filter(([type]) => !ordered.includes(type))
      .map(([type, count]) => ({ type, count }));
    return [...known, ...custom].filter((item) => item.count > 0);
  }, [selected]);

  const selectedRecentTrades = useMemo(() => {
    if (!selected) return [] as BacktestTrade[];
    return [...selected.trades].slice(-5).reverse();
  }, [selected]);

  const selectedSignals = useMemo(() => {
    if (!selected) return [] as { title: string; body: string; tone: string }[];
    return [
      selected.result.totalTrades === 0 ? {
        title: "No linked sample",
        body: "Connect trades through playbook, setup, or tags before judging the strategy.",
        tone: AMBER,
      } : null,
      selected.result.totalTrades > 0 && selected.result.totalTrades < 10 ? {
        title: "Small sample",
        body: "Treat the result as a hypothesis until it has at least 10 closed trades.",
        tone: AMBER,
      } : null,
      selected.result.totalTrades >= 10 && selected.result.netPnl > 0 && selected.result.avgRMultiple > 0 ? {
        title: "Edge is forming",
        body: "The playbook has positive P/L and positive average R. Keep execution strict.",
        tone: SAGE,
      } : null,
      selected.result.totalTrades > 0 && selected.result.netPnl < 0 ? {
        title: "Needs review",
        body: "Losses are bigger than the current edge. Check risk rules and recent entries.",
        tone: BRICK,
      } : null,
      selected.playbook.rules.length < 4 ? {
        title: "Rules are thin",
        body: "Add clearer entry, exit, invalidation, and risk conditions.",
        tone: AMBER,
      } : null,
      selected.result.maxConsecLosses >= 3 ? {
        title: "Loss streak risk",
        body: `${selected.result.maxConsecLosses} losses in a row. Consider a cool-down rule.`,
        tone: BRICK,
      } : null,
    ].filter(Boolean) as { title: string; body: string; tone: string }[];
  }, [selected]);

  const matchedTradeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) row.trades.forEach((trade) => ids.add(trade.id));
    return ids;
  }, [rows]);

  const portfolioResult = useMemo(
    () => computeResult(trades.filter((trade) => matchedTradeIds.has(trade.id)).sort((a, b) => tradeMoment(a).localeCompare(tradeMoment(b)))),
    [matchedTradeIds, trades]
  );

  const unlinkedTrades = trades.length - matchedTradeIds.size;
  const coverage = trades.length > 0 ? Math.round((matchedTradeIds.size / trades.length) * 100) : 0;
  const topEdge = rows.find((row) => row.result.totalTrades >= 3 && row.result.netPnl > 0);
  const weakest = rows.filter((row) => row.result.totalTrades > 0).sort((a, b) => a.result.netPnl - b.result.netPnl)[0];
  const dormant = rows.filter((row) => row.playbook.isActive && row.result.totalTrades === 0).length;
  const compareData = rows.slice(0, 8).map((row) => ({
    name: row.playbook.name.length > 16 ? `${row.playbook.name.slice(0, 15)}...` : row.playbook.name,
    pnl: Math.round(row.result.netPnl * 100) / 100,
    trades: row.result.totalTrades,
    winRate: row.result.winRate,
    score: row.score,
  }));

  const actionItems = [
    unlinkedTrades > 0 ? {
      tone: AMBER,
      title: "Link trades",
      body: `${unlinkedTrades} closed trades are not connected to any playbook yet. This makes strategy analytics less reliable.`,
    } : null,
    dormant > 0 ? {
      tone: AMBER,
      title: "Review active strategies",
      body: `${dormant} active playbooks have no linked trades. Connect them to setups or deactivate them.`,
    } : null,
    weakest && weakest.result.netPnl < 0 ? {
      tone: BRICK,
      title: "Review drawdown",
      body: `${weakest.playbook.name}: ${fmtCompact(weakest.result.netPnl)} across ${weakest.result.totalTrades} trades.`,
    } : null,
    topEdge ? {
      tone: SAGE,
      title: "Scale working edge",
      body: `${topEdge.playbook.name}: ${fmtR(topEdge.result.avgRMultiple)} avg R and ${fmtPct(topEdge.result.winRate)} win rate.`,
    } : null,
  ].filter(Boolean) as { tone: string; title: string; body: string }[];

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-tinted" />)}
        </div>
        <div className="h-72 rounded-2xl bg-tinted" />
      </div>
    );
  }

  if (playbooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-stroke-2 rounded-2xl">
        <Activity className="h-12 w-12 text-stroke-2 mb-3" />
        <h2 className="text-xl font-semibold text-ink mb-2">Analytics cockpit</h2>
        <p className="text-sm text-ink-4 max-w-md">Create or clone a playbook to see how strategy rules, linked trades, and results connect.</p>
      </div>
    );
  }

  const c = {
    grid: darkMode ? "rgba(255,255,255,0.04)" : "#D4D4E0",
    axis: darkMode ? "#7A7068" : "#9494AE",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-brand" />
            <p className="editorial-label">System coverage</p>
          </div>
          <p className="text-2xl font-bold font-mono text-ink">{coverage}%</p>
          <p className="text-[11px] text-ink-5 mt-1">{matchedTradeIds.size} of {trades.length} closed trades linked</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4" style={{ color: portfolioResult.netPnl >= 0 ? SAGE : BRICK }} />
            <p className="editorial-label">Playbook P/L</p>
          </div>
          <p className="text-2xl font-bold font-mono" style={{ color: portfolioResult.netPnl >= 0 ? SAGE : BRICK }}>{fmtCompact(portfolioResult.netPnl)}</p>
          <p className="text-[11px] text-ink-5 mt-1">{portfolioResult.totalTrades} strategy trades</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-4 w-4 text-brand" />
            <p className="editorial-label">Best edge</p>
          </div>
          <p className="text-lg font-bold text-ink truncate">{topEdge?.playbook.name || "No edge yet"}</p>
          <p className="text-[11px] text-ink-5 mt-1">{topEdge ? `${fmtR(topEdge.result.avgRMultiple)} / ${fmtPct(topEdge.result.winRate)}` : "Need more linked trades"}</p>
        </div>
        <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-4 w-4 text-brand" />
            <p className="editorial-label">Connection health</p>
          </div>
          <p className="text-2xl font-bold font-mono text-ink">{rows.filter((row) => row.result.totalTrades > 0).length}/{playbooks.length}</p>
          <p className="text-[11px] text-ink-5 mt-1">playbooks have live trade data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] gap-5">
        <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="editorial-label">Strategy performance map</p>
              <h2 className="text-lg font-semibold text-ink">P/L by playbook</h2>
            </div>
            <button
              onClick={fetchTrades}
              className="flex items-center gap-1.5 rounded-lg border border-stroke-2 px-3 py-1.5 text-xs text-ink-4 hover:text-ink transition-colors"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          {compareData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280} minWidth={1}>
              <BarChart data={compareData} margin={{ top: 6, right: 8, left: 0, bottom: 8 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="2 6" stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => fmtCompact(Number(v)).replace(".0", "")} />
                <ReferenceLine y={0} stroke={c.axis} strokeOpacity={0.35} />
                <Tooltip content={(props) => <AnalyticsTooltip {...props} dark={darkMode} />} cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {compareData.map((row) => (
                    <Cell key={row.name} fill={row.pnl >= 0 ? SAGE : BRICK} fillOpacity={0.82} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-ink-5 border border-dashed border-stroke-2 rounded-xl">No linked closed trades yet</div>
          )}
        </div>

        <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep min-w-0">
          <p className="editorial-label mb-3">Action queue</p>
          <div className="space-y-3">
            {actionItems.length > 0 ? actionItems.map((item) => (
              <div key={item.title} className="border-l-2 pl-3 py-1" style={{ borderColor: item.tone }}>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-ink-4 mt-1 leading-relaxed">{item.body}</p>
              </div>
            )) : (
              <div className="rounded-xl border border-stroke bg-tinted p-4 text-sm text-ink-4">Connections look clean: trades are distributed across strategies and no obvious data gaps were found.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
        <div className="rounded-2xl border border-stroke bg-card shadow-deep overflow-hidden">
          <div className="p-4 border-b border-stroke">
            <p className="editorial-label">Playbook stack</p>
          </div>
          <div className="divide-y divide-stroke max-h-[460px] overflow-y-auto">
            {rows.map((row) => {
              const isSelected = selected?.playbook.id === row.playbook.id;
              return (
                <button
                  key={row.playbook.id}
                  onClick={() => setSelectedId(row.playbook.id)}
                  className={cn("w-full text-left p-4 transition-colors", isSelected ? "bg-lift" : "hover:bg-tinted/50")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{row.playbook.name}</p>
                      <p className="text-[11px] text-ink-5 mt-1">{row.result.totalTrades} trades / {fmtPct(row.result.winRate)} WR / {fmtR(row.result.avgRMultiple)}</p>
                    </div>
                    <span className="rounded-md border border-stroke px-2 py-1 text-[11px] font-mono text-ink">{row.score}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-tinted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${row.score}%`, background: row.score >= 70 ? SAGE : row.score >= 45 ? AMBER : BRICK }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep min-w-0">
          {selected ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="editorial-label">Selected playbook</p>
                  <h2 className="text-xl font-semibold text-ink truncate">{selected.playbook.name}</h2>
                  <p className="text-xs text-ink-5 mt-1">
                    {selected.linkedById} by ID / {selected.linkedBySetup} by setup / {selected.linkedByTags} by tags
                  </p>
                </div>
                <button
                  onClick={() => onBacktest(selected.playbook)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover transition-colors"
                >
                  Backtest <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Score", value: String(selected.score), color: selected.score >= 70 ? SAGE : selected.score >= 45 ? AMBER : BRICK },
                  { label: "Net P/L", value: fmtCompact(selected.result.netPnl), color: selected.result.netPnl >= 0 ? SAGE : BRICK },
                  { label: "Win rate", value: fmtPct(selected.result.winRate), color: selected.result.winRate >= 50 ? SAGE : AMBER },
                  { label: "Avg R", value: fmtR(selected.result.avgRMultiple), color: selected.result.avgRMultiple >= 0 ? SAGE : BRICK },
                  { label: "Trades", value: String(selected.result.totalTrades), color: undefined },
                  { label: "Recent 10", value: fmtCompact(selected.recentPnl), color: selected.recentPnl >= 0 ? SAGE : BRICK },
                  { label: "Profit factor", value: Number.isFinite(selected.result.profitFactor) ? selected.result.profitFactor.toFixed(2) : "Inf", color: selected.result.profitFactor >= 1 ? SAGE : BRICK },
                  { label: "Max DD", value: selected.result.maxDrawdown > 0 ? `-${fmtCompact(selected.result.maxDrawdown).replace("+", "")}` : "$0", color: selected.result.maxDrawdown > 0 ? BRICK : SAGE },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-stroke bg-tinted p-3 min-w-0">
                    <p className="editorial-label text-[9px]">{item.label}</p>
                    <p className="mt-1 text-lg font-bold font-mono truncate" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-3">
                <div className="rounded-xl border border-stroke bg-tinted p-4">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="editorial-label">Connection map</p>
                      <p className="text-sm text-ink-4 mt-1">How this playbook gets its trade data</p>
                    </div>
                    <span className="rounded-md border border-stroke bg-card px-2 py-1 text-[11px] font-mono text-ink">
                      {selected.linkedById + selected.linkedBySetup + selected.linkedByTags}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Direct ID", value: selected.linkedById, tone: SAGE },
                      { label: "Setup name", value: selected.linkedBySetup, tone: AMBER },
                      { label: "Shared tags", value: selected.linkedByTags, tone: "#6E8FAF" },
                    ].map((item) => {
                      const total = selected.linkedById + selected.linkedBySetup + selected.linkedByTags;
                      const width = total > 0 ? Math.max(6, Math.round((item.value / total) * 100)) : 0;
                      return (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-semibold text-ink">{item.label}</span>
                            <span className="font-mono text-ink-5">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-card overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${width}%`, background: item.tone }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-stroke bg-tinted p-4">
                  <p className="editorial-label mb-3">Decision brief</p>
                  <div className="space-y-3">
                    {selectedSignals.length > 0 ? selectedSignals.slice(0, 3).map((item) => (
                      <div key={item.title} className="border-l-2 pl-3 py-0.5" style={{ borderColor: item.tone }}>
                        <p className="text-sm font-semibold text-ink">{item.title}</p>
                        <p className="text-xs text-ink-4 mt-1 leading-relaxed">{item.body}</p>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-stroke bg-card p-3">
                        <p className="text-sm font-semibold text-ink">Clean operating state</p>
                        <p className="text-xs text-ink-4 mt-1">Rules, sample, and recent performance do not show an obvious warning.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-stroke bg-tinted p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="editorial-label">Rule matrix</p>
                      <p className="text-xs text-ink-5 mt-1">{selected.playbook.rules.length} rules logged</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {selectedRuleStats.map((item) => (
                        <span key={item.type} className="rounded-md px-2 py-1 text-[10px] font-semibold" style={ruleTypeStyle(item.type)}>
                          {item.type} {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selected.playbook.rules.length > 0 ? selected.playbook.rules.slice(0, 4).map((rule, idx) => (
                      <div key={`${rule.type}-${idx}`} className="rounded-lg border border-stroke bg-card p-2.5">
                        <span className="mb-1 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold" style={ruleTypeStyle(rule.type)}>{rule.type}</span>
                        <p className="text-xs text-ink-3 leading-relaxed">{rule.text}</p>
                      </div>
                    )) : <span className="text-xs text-ink-5">No rules logged</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-stroke bg-tinted p-4">
                  <p className="editorial-label mb-3">Recent linked trades</p>
                  <div className="space-y-2">
                    {selectedRecentTrades.length > 0 ? selectedRecentTrades.map((trade) => (
                      <div key={trade.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-stroke bg-card p-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{trade.symbol} <span className="text-[10px] uppercase text-ink-5">{trade.side}</span></p>
                          <p className="text-[11px] text-ink-5">{new Date(tradeMoment(trade)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm font-bold" style={{ color: trade.netPnl >= 0 ? SAGE : BRICK }}>{fmtCompact(trade.netPnl)}</p>
                          <p className="text-[11px] font-mono text-ink-5">{fmtR(trade.rMultiple)}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-lg border border-dashed border-stroke-2 p-4 text-sm text-ink-5">
                        No linked trades yet. Use the same playbook, setup name, or tags in Journal trades.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-ink-5">No playbook selected</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string | null;
  market: string;
  timeframe: string | null;
  tags: string | null;
  proOnly?: boolean;
  locked?: boolean;
  rules: PlaybookRule[];
}

function getTemplateEducation(templateId: string) {
  const data: Record<string, { trains: string; skip: string; mistake: string }> = {
    tpl_orb: {
      trains: "Дисциплину времени: вход только после сформированного opening range.",
      skip: "Пропускай, если первый диапазон слишком широкий или пробой без объёма.",
      mistake: "Покупать сам пробой без ретеста и получать плохой R:R.",
    },
    tpl_smb_breakout: {
      trains: "Отбор сильных momentum-акций с катализатором и понятной базой.",
      skip: "Не торгуй, если общий рынок слабый или объём на пробое обычный.",
      mistake: "Гнаться за свечой вместо ожидания первого контролируемого отката.",
    },
    tpl_ict_silver_bullet: {
      trains: "Работу с ликвидностью, FVG и ограниченным временным окном.",
      skip: "Пропускай окно с близкими high-impact news или без явного sweep.",
      mistake: "Искать FVG в каждом движении и расширять стоп после неудачного входа.",
    },
    tpl_vwap_reversion: {
      trains: "Контртренд только в range-условиях и с понятным экстремумом.",
      skip: "Не fade-ить новости, earnings и сильный трендовый день.",
      mistake: "Шортить сильный catalyst-move только потому, что цена далеко от VWAP.",
    },
    tpl_swing_pullback: {
      trains: "Терпение в тренде: вход на pullback, а не на перегретом импульсе.",
      skip: "Пропускай вход перед earnings или при пробое последнего swing low.",
      mistake: "Ставить стоп слишком близко к EMA вместо структурного уровня.",
    },
    tpl_crypto_dca: {
      trains: "Торговлю границ диапазона без плеча и без попытки угадать breakout.",
      skip: "Не торгуй диапазон после двух закрытий за его пределами.",
      mistake: "Усредняться внутри пробитой поддержки и называть это range trade.",
    },
    tpl_opening_drive_pullback: {
      trains: "Терпение после открытия: не гнаться за первой свечой, а ждать контролируемый pullback.",
      skip: "Пропускай, если откат слишком глубокий или спред нестабилен.",
      mistake: "Покупать первый импульс без места для стопа и получать плохой R:R.",
    },
    tpl_crypto_liquidity_sweep: {
      trains: "Работу с ложными пробоями и reclaim уровня после снятия ликвидности.",
      skip: "Не входи, если цена закрепилась за диапазоном, а не вернулась внутрь.",
      mistake: "Ловить нож до закрытия свечи обратно в диапазон.",
    },
    tpl_earnings_gap_continuation: {
      trains: "Торговлю catalyst gap только после принятия цены рынком.",
      skip: "Пропускай, если гэп быстро заполняется или база не формируется.",
      mistake: "Входить в первую эмоциональную свечу после earnings.",
    },
    tpl_london_fx_breakout: {
      trains: "Дисциплину сессионного breakout и фильтр ложных пробоев Asian range.",
      skip: "Пропускай окно с важными новостями по валютам пары.",
      mistake: "Входить по фитилю без закрытия за диапазоном.",
    },
    tpl_failed_breakout_reversal: {
      trains: "Распознавание trapped traders и разворот только после reclaim уровня.",
      skip: "Не разворачивай сильный catalyst breakout или трендовый день.",
      mistake: "Шортить силу только потому, что цена кажется высокой.",
    },
  };

  return data[templateId] ?? {
    trains: "Чёткое повторение правил вместо случайных входов.",
    skip: "Пропускай, если условия шаблона не выполняются полностью.",
    mistake: "Адаптировать стратегию в моменте, пока сделка уже открыта.",
  };
}

function TemplatesTab({ onCloned }: { onCloned: () => void }) {
  const toast = useToast();
  const [templates, setTemplates] = useState<PlaybookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [market, setMarket] = useState("all");
  const [query, setQuery] = useState("");
  const cycle = useRefreshCycle();

  useEffect(() => {
    fetch("/api/playbook-templates")
      .then((res) => res.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const cloneTemplate = async (template: PlaybookTemplate) => {
    if (template.locked) {
      window.location.href = "/pricing";
      return;
    }
    setCloningId(template.id);
    try {
      const res = await fetch("/api/playbook-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clone template");
      toast("Template added to playbooks", "success");
      onCloned();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to clone template", "error");
    } finally {
      setCloningId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-ink-5">Loading templates...</div>;
  }

  const markets = ["all", ...Array.from(new Set(templates.map((tpl) => tpl.market).filter(Boolean)))];
  const orderedTemplates = rotateBySeed(templates, cycle.weekIndex);
  const spotlight = orderedTemplates[0];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = orderedTemplates.filter((tpl) => {
    const matchesMarket = market === "all" || tpl.market === market;
    const haystack = [
      tpl.name,
      tpl.description ?? "",
      tpl.market,
      tpl.timeframe ?? "",
      tpl.tags ?? "",
      ...tpl.rules.map((rule) => rule.text),
    ].join(" ").toLowerCase();
    return matchesMarket && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Template Library</p>
            <h2 className="text-xl font-semibold text-ink">Готовые стратегии теперь живут здесь</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-4">
              Клонируй шаблон в свои playbooks, тестируй его на сделках и дорабатывай правила под свой рынок.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <RefreshCcw className="h-3 w-3" />
            refresh {cycle.label}
          </span>
        </div>

        {spotlight && (
          <div className="mt-4 rounded-xl border border-brand/25 bg-brand/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-brand">Spotlight</p>
                <h3 className="text-base font-semibold text-ink">{spotlight.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-4">{spotlight.description}</p>
              </div>
              <button
                onClick={() => cloneTemplate(spotlight)}
                disabled={cloningId === spotlight.id}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand/40 px-3 py-1.5 text-xs text-brand transition-colors hover:bg-brand/10 disabled:opacity-50"
              >
                {spotlight.locked ? "Upgrade" : cloningId === spotlight.id ? "Adding..." : "Use template"}
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {markets.map((item) => (
            <button
              key={item}
              onClick={() => setMarket(item)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                market === item ? "border-brand/50 bg-brand/10 text-brand" : "border-stroke-2 text-ink-4 hover:bg-tinted"
              )}
            >
              {item === "all" ? "All markets" : item}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="h-10 w-full rounded-lg border border-stroke-2 bg-tinted pl-9 pr-3 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => {
            const education = getTemplateEducation(tpl.id);
            return (
        <div key={tpl.id} className="rounded-2xl border border-stroke bg-card p-5 shadow-deep">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink truncate">{tpl.name}</h3>
                {tpl.proOnly && <span className="chip text-[9px] text-brand bg-brand/10">PRO</span>}
              </div>
              <p className="mt-2 text-sm text-ink-4 leading-relaxed">{tpl.description}</p>
              <p className="mt-3 text-[11px] text-ink-5">
                {tpl.market} {tpl.timeframe ? `- ${tpl.timeframe}` : ""} {tpl.tags ? `- ${tpl.tags}` : ""}
              </p>
            </div>
            {tpl.locked && <Lock className="h-4 w-4 text-ink-5 shrink-0" />}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Trains</p>
              <p className="text-xs text-ink-3 leading-relaxed">{education.trains}</p>
            </div>
            <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Skip when</p>
              <p className="text-xs text-ink-3 leading-relaxed">{education.skip}</p>
            </div>
            <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Common error</p>
              <p className="text-xs text-ink-3 leading-relaxed">{education.mistake}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {tpl.rules.slice(0, 8).map((rule, idx) => (
              <span key={`${tpl.id}-${rule.type}-${idx}`} className="rounded-md px-2 py-1 text-[10px] font-semibold" style={ruleTypeStyle(rule.type)}>
                {rule.type}
              </span>
            ))}
          </div>

          <button
            onClick={() => cloneTemplate(tpl)}
            disabled={cloningId === tpl.id}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {tpl.locked ? "Upgrade" : cloningId === tpl.id ? "Adding..." : "Use template"}
            <Copy className="h-4 w-4" />
          </button>
        </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stroke-2 bg-card p-8 text-center">
          <Library className="mx-auto mb-3 h-8 w-8 text-ink-5" />
          <p className="text-sm font-semibold text-ink">No templates found</p>
          <p className="mt-1 text-xs text-ink-5">Change the market filter or search query.</p>
        </div>
      )}
    </div>
  );
}

function BacktestTabWithSelector({ playbooks, initialId }: { playbooks: Playbook[]; initialId?: string }) {
  const [selectedId, setSelectedId] = useState(initialId || playbooks[0]?.id || "");
  const pb = playbooks.find(p => p.id === selectedId) || playbooks[0];

  React.useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  if (!pb) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-[11px] uppercase tracking-wider text-ink-5 font-medium shrink-0">Strategy:</label>
        <div className="flex flex-wrap gap-1.5">
          {playbooks.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                selectedId === p.id
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-stroke-2 text-ink-4 hover:bg-tinted hover:text-ink"
              )}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <PlaybookBacktestTab
        key={pb.id}
        playbookId={pb.id}
        playbookName={pb.name}
        playbookMarket={pb.market}
        playbookTags={pb.tags}
      />
    </div>
  );
}

type Tab = "list" | "analytics" | "backtest" | "templates";

export default function PlaybooksPage() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("list");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [backtestPlaybookId, setBacktestPlaybookId] = useState<string | undefined>(undefined);
  const [mentorWorkspaces, setMentorWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [pushingPlaybook, setPushingPlaybook] = useState<Playbook | null>(null);
  const [pushingToWs, setPushingToWs] = useState("");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces")
      .then(r => r.json())
      .then((data: { id: string; name: string; role: string }[]) => {
        if (Array.isArray(data))
          setMentorWorkspaces(data.filter(w => w.role === "mentor" || w.role === "owner"));
      })
      .catch(() => {});
  }, []);

  const handlePushToTeam = async () => {
    if (!pushingPlaybook || !pushingToWs) return;
    setPushLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${pushingToWs}/playbooks/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookId: pushingPlaybook.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      toast(`Playbook sent to ${data.pushed} members`, "success");
      setPushingPlaybook(null);
      setPushingToWs("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setPushLoading(false);
    }
  };

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playbooks");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPlaybooks(data);
    } catch {
      toast(t("error_load"), "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchPlaybooks(); }, [fetchPlaybooks]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setDeletingId(null);
      fetchPlaybooks();
    } catch {
      toast(t("error_delete"), "error");
    }
  };

  const handleToggleActive = async (pb: Playbook) => {
    try {
      const res = await fetch(`/api/playbooks/${pb.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pb, isActive: !pb.isActive, rules: pb.rules }),
      });
      if (!res.ok) throw new Error("failed");
      fetchPlaybooks();
    } catch {
      toast(t("error_save"), "error");
    }
  };

  const handleSave = () => {
    setShowEditor(false);
    setEditingPlaybook(null);
    fetchPlaybooks();
  };

  const handleBacktest = (pb: Playbook) => {
    setBacktestPlaybookId(pb.id);
    setTab("backtest");
  };

  const filtered = playbooks.filter(
    (pb) =>
      pb.name.toLowerCase().includes(search.toLowerCase()) ||
      (pb.tags || "").toLowerCase().includes(search.toLowerCase())
  );

  const active = filtered.filter((pb) => pb.isActive);
  const inactive = filtered.filter((pb) => !pb.isActive);

  const totalTrades = playbooks.reduce((s, pb) => s + pb.totalTrades, 0);
  const totalPnl = playbooks.reduce((s, pb) => s + pb.totalPnl, 0);
  const bestPb = playbooks.length > 0
    ? playbooks.reduce((best, pb) => pb.totalPnl > best.totalPnl ? pb : best, playbooks[0])
    : null;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "list",      label: "Strategies", icon: Target },
    { id: "analytics", label: "Analytics",  icon: Activity },
    { id: "backtest",  label: "Backtest",   icon: FlaskConical },
    { id: "templates", label: "Templates",  icon: Library },
  ];

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("pb_title")}</h1>
          <p className="text-sm text-ink-3">{t("pb_desc")}</p>
        </div>
        {tab === "list" && (
          <button
            onClick={() => { setEditingPlaybook(null); setShowEditor(true); }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand-deep px-4 py-2 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all shadow-lg shadow-brand/20"
          >
            <Plus className="h-4 w-4" /> {t("pb_create")}
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-stroke overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id
                ? "border-brand text-brand"
                : "border-transparent text-ink-4 hover:text-ink"
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <ContextTip
        id="first-playbook"
        message="A strong playbook connects entry conditions, invalidation, risk, exits, and review notes."
        condition={playbooks.length > 0}
        delay={2000}
      />

      {tab === "analytics" && (
        <div key="analytics" className="anim-fade-up">
          <PlaybookAnalyticsTab playbooks={playbooks} onBacktest={handleBacktest} />
        </div>
      )}

      {tab === "backtest" && (
        <div key="backtest" className="anim-fade-up">
          {playbooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FlaskConical className="h-16 w-16 text-stroke-2 mb-4" />
              <h2 className="text-xl font-semibold text-ink mb-2">Backtest</h2>
              <p className="text-ink-4 text-sm max-w-md">
                Create a strategy first, then come back here to test it.
              </p>
              <button onClick={() => setTab("list")}
                className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors">
                Create strategy
              </button>
            </div>
          ) : (
            <BacktestTabWithSelector playbooks={playbooks} initialId={backtestPlaybookId} />
          )}
        </div>
      )}

      {/* Templates tab */}
      {tab === "templates" && <div key="templates" className="anim-fade-up"><TemplatesTab onCloned={() => { fetchPlaybooks(); setTab("list"); }} /></div>}

      {/* List tab */}
      {tab === "list" && <>

      {/* Summary stats bar (only if data exists) */}
      {playbooks.length > 0 && totalTrades > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-stroke bg-card p-4 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-brand" />
              <span className="text-xs text-ink-5">{t("pb_trades")}</span>
            </div>
            <p className="text-xl font-bold text-ink truncate">{totalTrades}</p>
          </div>
          <div className="rounded-xl border border-stroke bg-card p-4 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" style={{ color: SAGE }} /> : <TrendingDown className="h-4 w-4" style={{ color: BRICK }} />}
              <span className="text-xs text-ink-5">{t("pb_total_pl")}</span>
            </div>
            <p className="text-xl font-bold truncate" style={{ color: totalPnl >= 0 ? SAGE : BRICK }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString("en-US")}
            </p>
          </div>
          <div className="rounded-xl border border-stroke bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-brand" />
              <span className="text-xs text-ink-5">{t("pb_best_strategy")}</span>
            </div>
            <p className="text-base font-bold text-ink truncate">{bestPb?.name || "-"}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("pb_search")}
          className="h-9 w-full rounded-lg border border-stroke-2 bg-tinted pl-9 pr-4 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink-5">{t("loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Target className="h-16 w-16 text-stroke-2 mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">
            {search ? t("pb_no_results") : t("pb_empty")}
          </h2>
          <p className="text-ink-3 mb-6 max-w-md">{t("pb_empty_desc")}</p>
          {!search && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowEditor(true)}
                className="rounded-lg bg-gradient-to-r from-brand to-brand-deep px-6 py-2.5 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all shadow-lg shadow-brand/20"
              >
                {t("pb_create_first")}
              </button>
              <button
                onClick={() => setTab("templates")}
                className="flex items-center gap-2 rounded-lg border border-stroke-2 px-5 py-2 text-sm text-ink-3 hover:text-ink hover:border-stroke transition-colors"
              >
                <Library className="h-4 w-4" /> Choose from template library
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              {inactive.length > 0 && (
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: `${SAGE}B3` }}>Active ({active.length})</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map((pb) => (
                  <PlaybookCard
                    key={pb.id}
                    pb={pb}
                    onEdit={(p) => { setEditingPlaybook(p); setShowEditor(true); }}
                    onDelete={(id) => setDeletingId(id)}
                    onToggleActive={handleToggleActive}
                    onBacktest={handleBacktest}
                    onPushToTeam={mentorWorkspaces.length > 0 ? (p) => { setPushingPlaybook(p); setPushingToWs(mentorWorkspaces[0]?.id || ""); } : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-4 uppercase tracking-wider mb-3">{t("pb_inactive")} ({inactive.length})</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inactive.map((pb) => (
                  <PlaybookCard
                    key={pb.id}
                    pb={pb}
                    onEdit={(p) => { setEditingPlaybook(p); setShowEditor(true); }}
                    onDelete={(id) => setDeletingId(id)}
                    onToggleActive={handleToggleActive}
                    onBacktest={handleBacktest}
                    onPushToTeam={mentorWorkspaces.length > 0 ? (p) => { setPushingPlaybook(p); setPushingToWs(mentorWorkspaces[0]?.id || ""); } : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <PlaybookEditor
          playbook={editingPlaybook}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingPlaybook(null); }}
        />
      )}

      {deletingId && (() => {
        const pb = playbooks.find((p) => p.id === deletingId);
        return pb ? (
          <DeleteModal
            name={pb.name}
            onConfirm={() => handleDelete(deletingId)}
            onClose={() => setDeletingId(null)}
          />
        ) : null;
      })()}
      {/* Push to team modal */}
      {pushingPlaybook && (
        <Portal>
          <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm" onClick={() => setPushingPlaybook(null)} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-stroke bg-card p-6 shadow-deep">
              <h3 className="text-lg font-semibold text-ink mb-1">Push playbook to team</h3>
              <p className="text-sm text-ink-4 mb-5 leading-relaxed">
                Create read-only copies of <span className="font-semibold text-ink">{pushingPlaybook.name}</span> for team members. They get the rules, market, timeframe and tags without changing your original playbook.
              </p>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Market", value: pushingPlaybook.market },
                  { label: "Timeframe", value: pushingPlaybook.timeframe || "Any" },
                  { label: "Rules", value: String(pushingPlaybook.rules.length) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-stroke bg-tinted p-3 min-w-0">
                    <p className="editorial-label text-[9px]">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-ink-3">Workspace</label>
                {mentorWorkspaces.length > 1 ? (
                  <select
                    value={pushingToWs}
                    onChange={e => setPushingToWs(e.target.value)}
                    className="w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm text-ink"
                  >
                    {mentorWorkspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm font-medium text-ink">
                    {mentorWorkspaces[0]?.name || "Team workspace"}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-ink-5">
                  Members receive a locked copy so your team shares the same execution rules.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePushToTeam}
                  disabled={pushLoading || !pushingToWs}
                  className="flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  {pushLoading ? "Pushing..." : "Push read-only copy"}
                </button>
                <button
                  onClick={() => setPushingPlaybook(null)}
                  className="rounded-lg border border-stroke-2 px-4 py-2.5 text-sm text-ink-4 hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      </>}
    </div>
  );
}
