"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, TrendingUp, TrendingDown, Star, Tag,
  Calendar, BarChart2, Brain,
  FileText, Edit2, Trash2, ExternalLink, BookOpen, Link2, X, Plus, Check,
  MessageSquare, Send, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/useT";
import { useAppStore } from "@/store";
import { PaywallCard } from "@/components/billing/paywall-card";
import type { Entitlements } from "@/lib/entitlements";

const IMG_SEP = "\n\n---images---\n";
function decodeImages(content: string): { text: string; images: string[] } {
  const idx = content.indexOf(IMG_SEP);
  if (idx === -1) return { text: content, images: [] };
  return {
    text: content.slice(0, idx),
    images: content.slice(idx + IMG_SEP.length).split("\n").filter(Boolean),
  };
}

interface Trade {
  id: string; symbol: string; side: string; market: string;
  entryPrice: number; exitPrice: number | null; quantity: number;
  entryDate: string; exitDate: string | null;
  pnl: number; fees: number; netPnl: number; rMultiple: number;
  stopLoss: number | null; takeProfit: number | null;
  setup: string | null; notes: string | null; tags: string | null;
  rating: number | null; emotionalState: string | null; status: string;
  playbookId: string | null;
}

interface PlaybookRule { id: string; text: string; type: string; }
interface RuleViolation { id: string; ruleId: string; note: string | null; }
interface TeamWorkspace { id: string; name: string; role?: string; }
interface TeamComment { id: string; authorName: string; body: string; createdAt: string; }
interface MaeMfeRecord { tradeId: string; mae: number; mfe: number; computedAt: string; }
interface AiReview {
  score: number;
  summary: string;
  strengths: string[];
  risks: string[];
  actions: string[];
  aiPowered?: boolean;
  context: { mae: number | null; mfe: number | null; ruleViolations: number; playbookRules: number };
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? "+" : "-") + "$" + abs;
}
function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Muted palette — Institutional Matte ─────────────────────────────────────
const SAGE    = "#22C55E";
const BRICK  = "#EF4444";

const KL = "text-[10px] uppercase tracking-widest text-ink-5 font-medium";

const EMOTION_LABELS: Record<string, string> = {
  confident: "Уверен", neutral: "Нейтрален", fearful: "Страх",
  greedy: "Жадность", frustrated: "Раздражён", patient: "Терпелив",
};
const MARKET_LABELS: Record<string, string> = {
  crypto: "Crypto (Spot)", futures: "Futures / Perp",
  forex: "Forex", stocks: "Stocks", options: "Options",
};

function StatBox({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-4 min-w-0 overflow-hidden">
      <p className={cn(KL, "mb-1")}>{label}</p>
      <p className="text-xl font-bold font-mono truncate" style={{ color: positive === true ? SAGE : positive === false ? BRICK : undefined }}>{value}</p>
      {sub && <p className={cn(KL, "mt-0.5 truncate")}>{sub}</p>}
    </div>
  );
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { activeWorkspaceId } = useAppStore();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  // Notebook links state
  interface NoteLink { id: string; noteId: string; note: { id: string; title: string; category: string; tags: string | null; content: string } }
  interface AllNote { id: string; title: string; category: string; tags: string | null }
  const [linkedNotes, setLinkedNotes] = useState<NoteLink[]>([]);
  const [allNotes, setAllNotes] = useState<AllNote[]>([]);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null);
  const [violations, setViolations]       = useState<RuleViolation[]>([]);
  const [playbookRules, setPlaybookRules] = useState<PlaybookRule[]>([]);
  const [savingViolation, setSavingViolation] = useState<string | null>(null);
  const [teamWorkspaces, setTeamWorkspaces] = useState<TeamWorkspace[]>([]);
  const [teamComments, setTeamComments] = useState<TeamComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [maeMfe, setMaeMfe] = useState<MaeMfeRecord | null>(null);
  const [editingMaeMfe, setEditingMaeMfe] = useState(false);
  const [maeInput, setMaeInput] = useState("");
  const [mfeInput, setMfeInput] = useState("");
  const [savingMaeMfe, setSavingMaeMfe] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [loadingAiReview, setLoadingAiReview] = useState(false);

  useEffect(() => {
    fetch(`/api/trades/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setTrade(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/me/entitlements").then(r => r.json()).then(setEntitlements);
  }, []);

  useEffect(() => {
    if (!entitlements) return;
    fetch("/api/trades/maemfe")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const records = Array.isArray(data) ? data as MaeMfeRecord[] : [];
        setMaeMfe(records.find((record) => record.tradeId === id) ?? null);
      })
      .catch(() => {});
  }, [entitlements, id]);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTeamWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const activeTeam = teamWorkspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const canWriteTeamComment = activeTeam?.role === "owner" || activeTeam?.role === "mentor";

  const fetchTeamComments = () => {
    if (!id || !activeWorkspaceId) {
      setTeamComments([]);
      return;
    }
    fetch(`/api/workspaces/${activeWorkspaceId}/trades/${id}/comments`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTeamComments(Array.isArray(data) ? data : []))
      .catch(() => setTeamComments([]));
  };

  useEffect(() => {
    fetchTeamComments();
  }, [id, activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTeamComment = async () => {
    if (!activeWorkspaceId || !commentDraft.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/trades/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Comment failed", "error");
        return;
      }
      setCommentDraft("");
      fetchTeamComments();
      toast("Team comment added", "success");
    } finally {
      setSavingComment(false);
    }
  };

  // Fetch violations for this trade
  const fetchViolations = () => {
    if (!id) return;
    fetch(`/api/violations?tradeId=${id}`)
      .then(r => r.json())
      .then(d => setViolations(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(() => { fetchViolations(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch playbook rules when trade has a linked playbook
  useEffect(() => {
    if (!trade?.playbookId) return;
    fetch(`/api/playbooks/${trade.playbookId}`)
      .then(r => r.json())
      .then(d => setPlaybookRules(Array.isArray(d?.rules) ? d.rules : []))
      .catch(() => {});
  }, [trade?.playbookId]);

  const handleToggleViolation = async (rule: PlaybookRule) => {
    if (!trade) return;
    const existing = violations.find(v => v.ruleId === rule.id);
    setSavingViolation(rule.id);
    try {
      if (existing) {
        await fetch(`/api/violations/${existing.id}`, { method: "DELETE" });
        setViolations(prev => prev.filter(v => v.id !== existing.id));
      } else {
        const res = await fetch("/api/violations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradeId: trade.id, playbookId: trade.playbookId, ruleId: rule.id }),
        });
        if (res.ok) {
          const v = await res.json();
          setViolations(prev => [...prev, v]);
        }
      }
    } finally {
      setSavingViolation(null);
    }
  };

  // Fetch linked notes and all notes for this trade
  const fetchLinkedNotes = () => {
    if (!id) return;
    fetch(`/api/notebook-links?tradeId=${id}`)
      .then((r) => r.json())
      .then((d) => setLinkedNotes(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(() => { fetchLinkedNotes(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch("/api/notes").then((r) => r.json()).then((d) => setAllNotes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleLink = async (noteId: string) => {
    setLinkingNoteId(noteId);
    await fetch("/api/notebook-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, tradeId: id }),
    });
    fetchLinkedNotes();
    setLinkingNoteId(null);
  };
  const handleUnlink = async (linkId: string) => {
    await fetch(`/api/notebook-links?id=${linkId}`, { method: "DELETE" });
    fetchLinkedNotes();
  };

  const handleDelete = async () => {
    if (!confirm("Удалить эту сделку?")) return;
    setDeleting(true);
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    toast("Сделка удалена", "success");
    router.push("/trades");
  };

  const handleAiReview = async () => {
    setLoadingAiReview(true);
    try {
      const res = await fetch(`/api/trades/${id}/ai-review`);
      if (!res.ok) throw new Error("AI review failed");
      setAiReview(await res.json());
    } catch {
      toast("AI review failed", "error");
    } finally {
      setLoadingAiReview(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-tinted" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-tinted" />)}
          </div>
          <div className="h-64 rounded-xl bg-tinted" />
        </div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center">
        <p className="text-ink-4 mb-4">Сделка не найдена.</p>
        <button onClick={() => router.push("/trades")} className="text-brand hover:text-brand-hover text-sm">← Назад к сделкам</button>
      </div>
    );
  }

  const { text: notes, images } = trade.notes ? decodeImages(trade.notes) : { text: "", images: [] };
  const tags = trade.tags ? trade.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const isLong = trade.side === "long";
  const isWin = trade.netPnl > 0;
  const dollarSize = trade.quantity * trade.entryPrice;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/trades")}
            className="flex items-center gap-1.5 text-sm text-ink-4 hover:text-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <div className="h-4 w-px bg-stroke-2" />
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-ink">{trade.symbol}</span>
            <span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
              style={{ background: `${isLong ? SAGE : BRICK}18`, color: isLong ? SAGE : BRICK }}>
              {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isLong ? "LONG" : "SHORT"}
            </span>
            <span className="rounded-lg bg-tinted px-2.5 py-1 text-xs text-ink-4">
              {MARKET_LABELS[trade.market] || trade.market}
            </span>
            <span className="rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ background: `${isWin ? SAGE : BRICK}18`, color: isWin ? SAGE : BRICK }}>
              {trade.status === "open" ? "Открыта" : isWin ? "Прибыль" : "Убыток"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/trades?edit=${trade.id}`)}
            className="flex items-center gap-1.5 rounded-lg border border-stroke-2 px-4 py-2 text-sm text-ink-3 hover:text-ink hover:bg-tinted transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" /> Редактировать
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-stroke px-4 py-2 text-sm text-ink-4 hover:text-ink-2 hover:bg-tinted transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Удалить
          </button>
        </div>
      </div>

      {/* P/L Banner */}
      <div className="rounded-2xl border border-stroke bg-card shadow-deep p-6 flex items-center justify-between gap-4 overflow-hidden"
        style={{ borderColor: `${isWin ? SAGE : BRICK}50`, background: `${isWin ? SAGE : BRICK}08` }}>
        <div className="min-w-0">
          <p className={cn(KL, "mb-2")}>Чистый P/L</p>
          <p className="text-3xl font-bold font-mono truncate" style={{ color: isWin ? SAGE : BRICK }}>{fmt(trade.netPnl)}</p>
          {trade.fees > 0 && <p className={cn(KL, "mt-2 truncate")}>Gross: {fmt(trade.pnl)} · Fees: ${trade.fees.toFixed(2)}</p>}
        </div>
        <div className="text-right shrink-0">
          {trade.rMultiple !== 0 && (
            <div>
              <p className={cn(KL, "mb-1")}>R-кратное</p>
              <p className="text-2xl font-bold font-mono" style={{ color: trade.rMultiple >= 0 ? SAGE : BRICK }}>
                {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple.toFixed(2)}R
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Цена входа" value={`$${fmtPrice(trade.entryPrice)}`} />
        <StatBox label="Цена выхода" value={trade.exitPrice ? `$${fmtPrice(trade.exitPrice)}` : "—"} />
        <StatBox label="Объём позиции" value={`$${dollarSize.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} sub={`${trade.quantity.toFixed(6)} ед.`} />
        <StatBox label="Изменение %" value={trade.exitPrice ? `${(((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * (isLong ? 1 : -1)).toFixed(2)}%` : "—"} positive={isWin} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Dates */}
          <div className="rounded-xl border border-stroke bg-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-ink-4" /> Время</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-4">Открытие</span>
                <span className="text-sm text-ink font-medium">{fmtDate(trade.entryDate)}</span>
              </div>
              {trade.exitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-4">Закрытие</span>
                  <span className="text-sm text-ink font-medium">{fmtDate(trade.exitDate)}</span>
                </div>
              )}
              {trade.exitDate && (
                <div className="flex items-center justify-between border-t border-stroke-2 pt-3">
                  <span className="text-xs text-ink-4">Длительность</span>
                  <span className="text-sm text-ink-2">
                    {(() => {
                      const diff = (new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / 1000;
                      if (diff < 3600) return `${Math.round(diff / 60)} мин`;
                      if (diff < 86400) return `${(diff / 3600).toFixed(1)} ч`;
                      return `${(diff / 86400).toFixed(1)} д`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Levels */}
          {(trade.stopLoss || trade.takeProfit) && (
            <div className="rounded-xl border border-stroke bg-card p-5">
              <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-ink-4" /> Уровни</h3>
              <div className="space-y-3">
                {trade.stopLoss && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-4">{t("trade_stop_loss_label")}</span>
                    <span className="text-sm font-medium font-mono" style={{ color: BRICK }}>${fmtPrice(trade.stopLoss)}</span>
                  </div>
                )}
                {trade.takeProfit && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-4">{t("trade_take_profit_label")}</span>
                    <span className="text-sm font-medium font-mono" style={{ color: SAGE }}>${fmtPrice(trade.takeProfit)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Psychology */}
          <div className="rounded-xl border border-stroke bg-card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><Brain className="h-4 w-4 text-ink-4" /> Психология</h3>
            <div className="space-y-3">
              {trade.emotionalState && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-4">Эмоции</span>
                  <span className="text-sm text-ink">{EMOTION_LABELS[trade.emotionalState] || trade.emotionalState}</span>
                </div>
              )}
              {trade.setup && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-4">Setup</span>
                  <span className="text-sm text-ink">{trade.setup}</span>
                </div>
              )}
              {trade.rating !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-4">Качество</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={cn("h-4 w-4", s <= (trade.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-stroke-2")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="rounded-xl border border-stroke bg-card p-5">
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Tag className="h-4 w-4 text-ink-4" /> Теги</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-lg bg-tinted px-3 py-1 text-xs text-ink-3">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — Notes & Images */}
        <div className="space-y-4">
          {notes && (
            <div className="rounded-xl border border-stroke bg-card p-5">
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-ink-4" /> Заметки</h3>
              <p className="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">{notes}</p>
            </div>
          )}
          {images.length > 0 && (
            <div className="rounded-xl border border-stroke bg-card p-5">
              <h3 className="text-sm font-semibold text-ink mb-3">Скриншоты ({images.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {images.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-stroke-2 hover:border-brand/40 transition-colors group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Screenshot ${i + 1}`} className="w-full h-32 object-cover group-hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {!notes && images.length === 0 && (
            <div className="rounded-xl border border-stroke-2 border-dashed p-8 text-center">
              <FileText className="h-8 w-8 text-ink-5 mx-auto mb-2" />
              <p className="text-sm text-ink-4">Нет заметок или скриншотов</p>
              <button
                onClick={() => router.push(`/trades?edit=${trade.id}`)}
                className="mt-3 text-xs text-brand hover:text-brand-hover transition-colors"
              >
                Добавить заметки →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAE/MFE Analysis */}
      {entitlements && (
        <div className="rounded-xl border border-stroke bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-ink-4" /> MAE / MFE
            </h3>
            {!editingMaeMfe && (
              <button
                onClick={() => {
                  setMaeInput(maeMfe ? maeMfe.mae.toString() : "");
                  setMfeInput(maeMfe ? maeMfe.mfe.toString() : "");
                  setEditingMaeMfe(true);
                }}
                className="rounded-md border border-stroke-2 bg-tinted px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:border-brand/40 hover:text-brand transition-colors"
              >
                {maeMfe ? <span className="flex items-center gap-1"><Edit2 className="h-3 w-3" /> Edit</span> : "+ Add"}
              </button>
            )}
          </div>

          {editingMaeMfe ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={cn(KL, "block mb-1")}>MAE</span>
                  <input
                    type="number"
                    step="0.01"
                    value={maeInput}
                    onChange={(e) => setMaeInput(e.target.value)}
                    placeholder="-12.50"
                    className="h-9 w-full rounded-md border border-stroke-2 bg-tinted px-3 text-sm font-mono text-ink placeholder:text-ink-5 focus:border-brand/40 focus:outline-none"
                  />
                  <span className="text-[10px] text-ink-5 mt-1 block">Max adverse excursion ($)</span>
                </label>
                <label className="block">
                  <span className={cn(KL, "block mb-1")}>MFE</span>
                  <input
                    type="number"
                    step="0.01"
                    value={mfeInput}
                    onChange={(e) => setMfeInput(e.target.value)}
                    placeholder="34.20"
                    className="h-9 w-full rounded-md border border-stroke-2 bg-tinted px-3 text-sm font-mono text-ink placeholder:text-ink-5 focus:border-brand/40 focus:outline-none"
                  />
                  <span className="text-[10px] text-ink-5 mt-1 block">Max favorable excursion ($)</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingMaeMfe(false);
                    setMaeInput("");
                    setMfeInput("");
                  }}
                  disabled={savingMaeMfe}
                  className="rounded-md border border-stroke-2 bg-tinted px-3 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const mae = parseFloat(maeInput);
                    const mfe = parseFloat(mfeInput);
                    if (!Number.isFinite(mae) || !Number.isFinite(mfe)) {
                      toast("Enter valid numbers for MAE and MFE", "error");
                      return;
                    }
                    setSavingMaeMfe(true);
                    try {
                      const res = await fetch("/api/trades/maemfe", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tradeId: id, mae, mfe }),
                      });
                      if (!res.ok) {
                        toast("Failed to save MAE/MFE", "error");
                        return;
                      }
                      const record = (await res.json()) as MaeMfeRecord;
                      setMaeMfe(record);
                      setEditingMaeMfe(false);
                      toast("MAE/MFE saved", "success");
                    } catch {
                      toast("Failed to save MAE/MFE", "error");
                    } finally {
                      setSavingMaeMfe(false);
                    }
                  }}
                  disabled={savingMaeMfe}
                  className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                  {savingMaeMfe ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : maeMfe ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={cn(KL, "mb-1")}>MAE</p>
                  <p className="text-xl font-bold font-mono" style={{ color: BRICK }}>
                    {maeMfe.mae >= 0 ? "+" : ""}{maeMfe.mae.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-ink-5 mt-1">Max adverse excursion</p>
                </div>
                <div>
                  <p className={cn(KL, "mb-1")}>MFE</p>
                  <p className="text-xl font-bold font-mono" style={{ color: SAGE }}>
                    {maeMfe.mfe >= 0 ? "+" : ""}{maeMfe.mfe.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-ink-5 mt-1">Max favorable excursion</p>
                </div>
              </div>
              {trade && maeMfe.mfe > 0 && (() => {
                const capture = (trade.netPnl / maeMfe.mfe) * 100;
                const captureClamped = Math.max(0, Math.min(100, capture));
                return (
                  <div className="mt-4 pt-4 border-t border-stroke">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={KL}>MFE capture</p>
                      <p className="tnum text-[12px] font-mono font-semibold" style={{ color: capture >= 50 ? SAGE : capture >= 25 ? "#B08050" : BRICK }}>
                        {capture.toFixed(1)}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${captureClamped}%`, background: capture >= 50 ? SAGE : capture >= 25 ? "#B08050" : BRICK }} />
                    </div>
                    <p className="text-[10px] text-ink-5 mt-1.5">How much of the favorable move you actually captured.</p>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-sm text-ink-4">No MAE/MFE record has been saved for this trade yet. Click <span className="text-ink-2 font-medium">+ Add</span> above to enter values.</p>
          )}
        </div>
      )}

      {entitlements && !entitlements.capabilities.canUseAiTradeReview && (
        <PaywallCard
          feature="ai_trade_review"
          title="AI trade review (Pro)"
          body="Get a structured review with score, strengths, risks, and next actions for each trade."
        />
      )}

      {entitlements?.capabilities.canUseAiTradeReview && (
        <div className="rounded-xl border border-stroke bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Brain className="h-4 w-4 text-brand" /> AI trade review
            </h3>
            <button
              onClick={handleAiReview}
              disabled={loadingAiReview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Brain className="h-3.5 w-3.5" />
              {loadingAiReview ? "Analysing…" : aiReview ? "Refresh" : "Review trade"}
            </button>
          </div>

          {loadingAiReview && (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-4 rounded-xl border border-stroke bg-tinted p-4">
                <div className="h-16 w-16 rounded-full bg-stroke shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-stroke" />
                  <div className="h-3 w-full rounded bg-stroke" />
                  <div className="h-3 w-4/5 rounded bg-stroke" />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-xl border border-stroke-2 bg-tinted p-3 space-y-2">
                    <div className="h-2.5 w-1/2 rounded bg-stroke" />
                    {[0, 1, 2].map(j => <div key={j} className="h-2.5 rounded bg-stroke" />)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadingAiReview && aiReview && (() => {
            const score = aiReview.score;
            const r = 28;
            const circ = 2 * Math.PI * r;
            const scoreColor = score >= 70 ? "#22C55E" : score >= 45 ? "#B08050" : "#EF4444";
            const sections: Array<{ key: string; items: string[]; color: string; bg: string; icon: string }> = [
              { key: "Strengths", items: aiReview.strengths, color: "#22C55E", bg: "rgba(34,197,94,0.08)", icon: "✓" },
              { key: "Risks",     items: aiReview.risks,     color: "#EF4444", bg: "rgba(239,68,68,0.08)",  icon: "⚠" },
              { key: "Actions",   items: aiReview.actions,   color: "#6366F1", bg: "rgba(99,102,241,0.08)", icon: "→" },
            ];
            return (
              <div className="space-y-4">
                {/* Score + summary */}
                <div className="flex items-center gap-4 rounded-xl border border-stroke bg-tinted p-4">
                  <div className="relative shrink-0 h-16 w-16">
                    <svg viewBox="0 0 64 64" className="rotate-[-90deg]">
                      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r={r} fill="none"
                        stroke={scoreColor} strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - score / 100)}
                        style={{ transition: "stroke-dashoffset 0.8s ease" }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold font-mono" style={{ color: scoreColor }}>
                      {score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-5 mb-1">Execution score</p>
                    <p className="text-[13px] text-ink-3 leading-relaxed">{aiReview.summary}</p>
                  </div>
                </div>

                {/* Strengths / Risks / Actions */}
                <div className="grid gap-3 md:grid-cols-3">
                  {sections.map(({ key, items, color, bg, icon }) => (
                    <div key={key} className="rounded-xl border border-stroke-2 p-3" style={{ background: bg }}>
                      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
                        <span>{icon}</span> {key}
                      </p>
                      <ul className="space-y-2">
                        {items.map((item, idx) => (
                          <li key={idx} className="flex gap-2 text-[12px] text-ink-3 leading-snug">
                            <span className="mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {!loadingAiReview && !aiReview && (
            <div className="rounded-xl border border-dashed border-stroke-2 p-6 text-center">
              <Brain className="mx-auto mb-3 h-8 w-8 text-ink-5 opacity-40" />
              <p className="text-[13px] text-ink-4">Запусти ревью чтобы получить оценку исполнения, сильные стороны, риски и следующие шаги.</p>
            </div>
          )}
        </div>
      )}

      {/* Team mentor comments */}
      {activeWorkspaceId && activeTeam && (
        <div className="rounded-xl border border-stroke bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              Team comments
            </h3>
            <span className="chip text-[10px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1", padding: "2px 7px" }}>
              {activeTeam.name}
            </span>
          </div>

          {teamComments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stroke-2 p-4 text-center">
              <p className="text-[12px] text-ink-4">No mentor comments yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamComments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-stroke-2 bg-tinted px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12px] font-semibold text-ink flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      {comment.authorName}
                    </span>
                    <span className="text-[10px] text-ink-5">
                      {new Date(comment.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-2 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                </div>
              ))}
            </div>
          )}

          {canWriteTeamComment ? (
            <div className="mt-4 flex items-start gap-2">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Add a mentor note for this trade..."
                className="flex-1 rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-[13px] text-ink placeholder:text-ink-5 outline-none focus:border-brand resize-none"
              />
              <button
                onClick={handleAddTeamComment}
                disabled={savingComment || !commentDraft.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {savingComment ? "Saving" : "Send"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-ink-5">
              Only team owners and mentors can add comments.
            </p>
          )}
        </div>
      )}

      {/* ── Notebook panel (P1.5-26/27) ───────────────────────────────────── */}
      <div className="rounded-xl border border-stroke bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand" /> Из Notebook
          </h3>
          <button
            onClick={() => setShowLinkPanel(!showLinkPanel)}
            className="flex items-center gap-1.5 rounded-lg border border-stroke-2 px-3 py-1.5 text-xs text-ink-4 hover:text-ink hover:border-stroke transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" /> Прикрепить заметку
          </button>
        </div>

        {/* Link picker */}
        {showLinkPanel && (
          <div className="mb-4 rounded-lg border border-stroke-2 bg-tinted p-3 space-y-2 max-h-48 overflow-y-auto">
            {allNotes.length === 0 && <p className="text-xs text-ink-5 text-center py-2">Нет заметок в Notebook</p>}
            {allNotes.map((n) => {
              const isLinked = linkedNotes.some((l) => l.noteId === n.id);
              return (
                <button
                  key={n.id}
                  disabled={isLinked || linkingNoteId === n.id}
                  onClick={() => !isLinked && handleLink(n.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors",
                    isLinked ? "bg-brand/8 text-brand cursor-default" : "hover:bg-lift text-ink-2 hover:text-ink"
                  )}
                >
                  <span className="truncate">{n.title}</span>
                  {isLinked ? <Check className="h-3.5 w-3.5 text-brand shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-ink-5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Linked notes */}
        {linkedNotes.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center">
            <BookOpen className="h-8 w-8 text-stroke-2 mb-2" />
            <p className="text-xs text-ink-5">Нет прикреплённых заметок</p>
            <p className="text-[11px] text-ink-5 mt-0.5">Прикрепите заметки из Notebook для двустороннего контекста</p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedNotes.map((l) => (
              <div key={l.id} className="flex items-start gap-3 rounded-lg border border-stroke-2 bg-tinted px-3 py-2.5 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{l.note.title}</p>
                  <p className="text-xs text-ink-4 line-clamp-2 mt-0.5">
                    {l.note.content.split("\n\n---images---\n")[0].slice(0, 120)}
                  </p>
                </div>
                <button
                  onClick={() => handleUnlink(l.id)}
                  className="shrink-0 rounded p-1 text-ink-5 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Auto-surface: relevant notes by tag overlap */}
        {linkedNotes.length === 0 && tags.length > 0 && (() => {
          const relevant = allNotes.filter((n) =>
            n.tags && tags.some((tag) => n.tags!.toLowerCase().includes(tag.toLowerCase()))
          ).slice(0, 3);
          if (relevant.length === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-stroke">
              <p className="text-[11px] text-ink-5 uppercase tracking-wider mb-2">Возможно, относится к этой сделке:</p>
              <div className="space-y-1.5">
                {relevant.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleLink(n.id)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-ink-4 hover:text-ink hover:bg-tinted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">{n.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Rule Violations Panel ───────────────────────────────────────────── */}
      {trade.playbookId && playbookRules.length > 0 && (
        <div className="rounded-xl border border-stroke bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-ink-4" /> Нарушения правил
              {violations.length > 0 && (
                <span
                  className="chip text-[10px]"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", padding: "2px 8px" }}
                >
                  {violations.length}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-ink-5">Отметь нарушенные правила</p>
          </div>
          <div className="space-y-2">
            {playbookRules.map((rule) => {
              const violated = violations.some(v => v.ruleId === rule.id);
              const isSaving = savingViolation === rule.id;
              return (
                <button
                  key={rule.id}
                  onClick={() => handleToggleViolation(rule)}
                  disabled={isSaving}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                    violated
                      ? "border-red-500/30 bg-red-500/8 hover:bg-red-500/12"
                      : "border-stroke-2 bg-tinted hover:border-stroke hover:bg-lift"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    violated ? "border-red-500/60 bg-red-500/20" : "border-stroke-2"
                  )}>
                    {violated && <X className="h-2.5 w-2.5 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-xs leading-relaxed", violated ? "text-red-300" : "text-ink-2")}>
                      {rule.text}
                    </span>
                    <span className="ml-2 text-[10px] text-ink-5 uppercase tracking-wide">{rule.type}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {violations.length === 0 && (
            <p className="text-xs text-ink-5 mt-3 text-center">Нет нарушений — сделка выполнена по правилам</p>
          )}
        </div>
      )}
    </div>
  );
}
