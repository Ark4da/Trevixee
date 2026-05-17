"use client";
import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toDateTimeLocalInputValue, toLocalDayKey } from "@/lib/date";
import { useToast } from "@/components/ui/toast";
import { Portal } from "@/components/ui/portal";
import { useT } from "@/lib/useT";
import Link from "next/link";
import {
  Plus, Trash2, Edit2, Star, X, Search, Copy,
  ChevronDown, ChevronUp, SlidersHorizontal,
  Image as ImageIcon, Upload, ZoomIn, CheckCircle,
  AlertTriangle, ShieldAlert, Tag, ExternalLink, BookText,
} from "lucide-react";
import { useAlerts } from "@/lib/use-alerts";

// ── Muted palette — Institutional Matte ─────────────────────────────────────
const SAGE    = "#22C55E";
const BRICK  = "#EF4444";

// ── Image helpers (shared with Notebook) ────────────────────────────────────
const IMG_SEP = "\n\n---images---\n";
function encodeImages(text: string, images: string[]) {
  return images.length === 0 ? text : text + IMG_SEP + images.join("\n");
}
function decodeImages(content: string): { text: string; images: string[] } {
  const idx = content.indexOf(IMG_SEP);
  if (idx === -1) return { text: content, images: [] };
  return {
    text: content.slice(0, idx),
    images: content.slice(idx + IMG_SEP.length).split("\n").filter(Boolean),
  };
}
async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const d = await res.json();
  return d.url as string;
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={onClose}><X className="h-6 w-6" /></button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

interface Trade {
  id: string; symbol: string; side: string; entryPrice: number;
  exitPrice: number | null; quantity: number; entryDate: string;
  exitDate: string | null; pnl: number; fees: number; netPnl: number;
  rMultiple: number; stopLoss: number | null; setup: string | null;
  market: string; notes: string | null; tags: string | null;
  rating: number | null; emotionalState: string | null; status: string;
  accountId: string | null;
}

interface TradingAccount {
  id: string;
  name: string;
  kind: string;
  broker: string | null;
  isActive: boolean;
}

const inputCls = "h-10 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 transition-colors";
const labelCls = "block text-sm font-medium text-ink-3 mb-1.5";

// Small tooltip hint next to a label
function Hint({ text }: { text: string }) {
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full border border-stroke-2 text-[9px] text-ink-5 cursor-help align-middle" title={text}>
      ?
    </span>
  );
}

// ── Trade Form ───────────────────────────────────────────────────────────────
function TradeForm({
  trade, isDuplicate, accounts, defaultAccountId, onSave, onCancel,
}: {
  trade?: Trade | null;
  isDuplicate?: boolean;
  accounts: TradingAccount[];
  defaultAccountId?: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const decoded = trade?.notes ? decodeImages(trade.notes) : { text: "", images: [] };
  const [form, setForm] = useState({
    symbol: trade?.symbol || "",
    side: trade?.side || "long",
    entryPrice: trade?.entryPrice ? (trade.entryPrice !== 0 ? trade.entryPrice.toString() : "") : "",
    exitPrice: trade?.exitPrice?.toString() || "",
    quantity: trade?.quantity && trade.entryPrice ? (trade.quantity * trade.entryPrice).toFixed(2) : "",
    contractSize: "1",
    manualPnl: "",
    entryDate: trade?.entryDate ? toDateTimeLocalInputValue(trade.entryDate) : "",
    exitDate: trade?.exitDate ? toDateTimeLocalInputValue(trade.exitDate) : "",
    fees: trade?.fees?.toString() || "0",
    stopLoss: trade?.stopLoss?.toString() || "",
    takeProfit: (trade as Trade & { takeProfit?: number | null })?.takeProfit?.toString() || "",
    setup: trade?.setup || "",
    market: trade?.market || "futures",
    accountId: trade?.accountId || defaultAccountId || "",
    notes: decoded.text,
    tags: trade?.tags || "",
    rating: trade?.rating || 0,
    emotionalState: trade?.emotionalState || "neutral",
  });
  const [images, setImages] = useState<string[]>(decoded.images);
  const [uploading, setUploading] = useState(false);
  const [sizeMode, setSizeMode] = useState<"$" | "units">("$");
  const [playbooks, setPlaybooks] = useState<{ id: string; name: string; isActive: boolean }[]>([]);

  useEffect(() => {
    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => setPlaybooks(Array.isArray(data) ? data.filter((p) => p.isActive) : []))
      .catch(() => {});
  }, []);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setUploading(true);
    for (const f of imgs) {
      const url = await uploadFile(f);
      if (url) setImages((p) => [...p, url]);
    }
    setUploading(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (file) await handleImageUpload([file]);
  };

  const set = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  // P/L preview — prefer manualPnl if filled
  const manualPnlVal  = parseFloat(form.manualPnl);
  const entry         = parseFloat(form.entryPrice) || 0;
  const exit          = parseFloat(form.exitPrice) || 0;
  const qty           = parseFloat(form.quantity) || 0;
  // effectiveQty in units: if $ mode → divide by entry; if units → use directly
  const effectiveQty  = sizeMode === "$"
    ? (entry > 0 && qty > 0 ? qty / entry : 0)
    : qty;
  const calcPnl = !isNaN(manualPnlVal) && form.manualPnl !== ""
    ? manualPnlVal
    : (exit > 0 && entry > 0 && effectiveQty > 0
      ? (form.side === "long" ? (exit - entry) * effectiveQty : (entry - exit) * effectiveQty)
      : null);

  // Planned Risk/Reward and realised R-multiple
  const slPrice  = parseFloat(form.stopLoss) || 0;
  const tpPrice  = parseFloat(form.takeProfit) || 0;
  const riskPerUnit = entry > 0 && slPrice > 0
    ? (form.side === "long" ? entry - slPrice : slPrice - entry)
    : 0;
  const rewardPerUnit = entry > 0 && tpPrice > 0
    ? (form.side === "long" ? tpPrice - entry : entry - tpPrice)
    : 0;
  const slInvalid = entry > 0 && slPrice > 0 && riskPerUnit <= 0;
  const tpInvalid = entry > 0 && tpPrice > 0 && rewardPerUnit <= 0;
  const rrRatio = riskPerUnit > 0 && rewardPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
  const riskDollars = riskPerUnit > 0 && effectiveQty > 0 ? riskPerUnit * effectiveQty : 0;
  const rewardDollars = rewardPerUnit > 0 && effectiveQty > 0 ? rewardPerUnit * effectiveQty : 0;
  const rMultiple = riskDollars > 0 && calcPnl !== null ? calcPnl / riskDollars : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol || !form.entryDate) return;
    setSaving(true);
    try {
      const isEdit = trade && !isDuplicate;
      const url = isEdit ? `/api/trades/${trade.id}` : "/api/trades";
      const submitForm = {
        ...form,
        notes: encodeImages(form.notes, images),
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        // Convert to units for server P&L calc
        quantity: sizeMode === "$"
          ? (entry > 0 && qty > 0 ? String(qty / entry) : "0")
          : String(qty || 0),
      };
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast(
        isDuplicate ? t("trades_toast_duplicated") : trade ? t("trades_toast_updated") : t("trades_toast_added"),
        "success"
      );
      onSave();
    } catch {
      toast(t("trades_toast_save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
    {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div
        className={cn("relative w-full max-w-4xl rounded-xl border bg-card shadow-2xl my-auto transition-colors",
          dragging ? "border-brand border-2" : "border-stroke")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleImageUpload(Array.from(e.dataTransfer.files)); }}
        onPaste={handlePaste}
      >
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-brand/10 border-2 border-brand border-dashed pointer-events-none">
          <div className="text-center"><Upload className="h-10 w-10 text-brand mx-auto mb-2" /><p className="text-brand font-medium">{t("trade_drop_screenshot")}</p></div>
        </div>
      )}
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stroke">
          <h2 className="text-xl font-semibold text-ink">{isDuplicate ? t("trades_duplicate_title") : trade ? t("trades_edit_title") : t("trade_add")}</h2>
          <button onClick={onCancel} className="text-ink-5 hover:text-ink transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* ── BUY / SELL toggle ───────────────────────────────────────── */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-ink-3 mb-2">{t("trades_direction")}</label>
            <div className="flex w-full rounded-xl border border-stroke-2 p-1 bg-tinted gap-1">
              <button
                type="button"
                onClick={() => set("side", "long")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150"
                style={form.side === "long"
                  ? { background: SAGE, color: "#fff" }
                  : { color: "var(--color-ink-3)" }}
              >
                ▲ BUY / LONG
              </button>
              <button
                type="button"
                onClick={() => set("side", "short")}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150"
                style={form.side === "short"
                  ? { background: BRICK, color: "#fff" }
                  : { color: "var(--color-ink-3)" }}
              >
                ▼ SELL / SHORT
              </button>
            </div>
          </div>

          {/* ── Row 1: Symbol + Market + Account + Entry Date + Exit Date ── */}
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-1">
              <label className={labelCls}>{t("trades_symbol_req")}</label>
              <input value={form.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="BTCUSD" className={inputCls} required />
            </div>
            <div className="col-span-1">
              <label className={labelCls}>{t("trades_market_label")}</label>
              <select value={form.market} onChange={(e) => { set("market", e.target.value); set("contractSize", "1"); }} className={inputCls}>
                <option value="crypto">{t("common_crypto_spot")}</option>
                <option value="futures">{t("common_futures_perp")}</option>
                <option value="forex">Forex</option>
                <option value="stocks">{t("common_stocks")}</option>
                <option value="options">{t("common_options")}</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className={labelCls}>{t("trades_account")}</label>
              <select value={form.accountId} onChange={(e) => set("accountId", e.target.value)} className={inputCls}>
                <option value="">{t("trades_unassigned")}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.kind ? ` (${account.kind})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{t("trades_entry_dt_req")}</label>
              <input type="datetime-local" value={form.entryDate} onChange={(e) => set("entryDate", e.target.value)} className={inputCls} required />
            </div>
            <div className="col-span-1">
              <label className={labelCls}>{t("trades_exit_dt_label")}</label>
              <input type="datetime-local" value={form.exitDate} onChange={(e) => set("exitDate", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* ── Row 2: Prices + Trade Size + SL + TP ── */}
          <div className="grid grid-cols-5 gap-3 items-end">
            <div>
              <label className={labelCls}>{t("trades_entry_price")} <Hint text={t("trades_entry_price")} /></label>
              <input type="number" step="any" value={form.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} placeholder="66212.02" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("trades_exit_price")} <Hint text={t("trades_exit_price")} /></label>
              <input type="number" step="any" value={form.exitPrice} onChange={(e) => set("exitPrice", e.target.value)} placeholder="66783.54" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                {sizeMode === "$" ? t("trades_size_label_dollars") : t("trades_size_label_units")}
                <Hint text={sizeMode === "$" ? t("trades_size_hint_dollars") : t("trades_size_hint_units")} />
              </label>
              <div className="flex rounded-lg border border-stroke-2 bg-tinted overflow-hidden focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/50 transition-colors">
                <input
                  type="number" step="any" value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  placeholder={sizeMode === "$" ? "1000" : "0.5"}
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink placeholder:text-ink-4 outline-none h-9"
                />
                <div className="flex border-l border-stroke-2 shrink-0">
                  <button type="button" onClick={() => setSizeMode("$")}
                    className={cn("px-2 text-[11px] font-bold transition-colors h-full",
                      sizeMode === "$" ? "bg-brand text-white" : "text-ink-4 hover:text-ink hover:bg-tinted")}>
                    $
                  </button>
                  <button type="button" onClick={() => setSizeMode("units")}
                    className={cn("px-2 text-[11px] font-bold transition-colors h-full border-l border-stroke-2",
                      sizeMode === "units" ? "bg-brand text-white" : "text-ink-4 hover:text-ink hover:bg-tinted")}>
                    U
                  </button>
                </div>
              </div>
            </div>
            <div className="relative">
              <label className={labelCls}>{t("trade_stop_loss_label")} <Hint text={t("trade_stop_loss_label")} /></label>
              <input
                type="number" step="any" value={form.stopLoss}
                onChange={(e) => set("stopLoss", e.target.value)}
                placeholder="S/L"
                className={cn(inputCls, slInvalid && "border-red-500/60 focus:border-red-500")}
              />
              {slInvalid && (
                <p className="absolute left-0 top-full mt-0.5 text-[10px] font-medium leading-tight whitespace-nowrap" style={{ color: BRICK }}>
                  {form.side === "long" ? t("trades_sl_invalid_long") : t("trades_sl_invalid_short")}
                </p>
              )}
            </div>
            <div className="relative">
              <label className={labelCls}>{t("trade_take_profit_label")} <Hint text={t("trade_take_profit_label")} /></label>
              <input
                type="number" step="any" value={form.takeProfit}
                onChange={(e) => set("takeProfit", e.target.value)}
                placeholder="T/P"
                className={cn(inputCls, tpInvalid && "border-red-500/60 focus:border-red-500")}
              />
              {tpInvalid && (
                <p className="absolute left-0 top-full mt-0.5 text-[10px] font-medium leading-tight whitespace-nowrap" style={{ color: BRICK }}>
                  {form.side === "long" ? t("trades_tp_invalid_long") : t("trades_tp_invalid_short")}
                </p>
              )}
            </div>
          </div>

          {/* ── Row 3: Broker P/L + Commission (highlighted) ── */}
          <div className="rounded-lg border border-brand/40 bg-brand/5 px-4 py-3">
            <p className="text-xs font-semibold text-brand mb-3 uppercase tracking-wide">
              {t("trades_result_label")} <Hint text={t("trades_result_label")} />
            </p>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>{t("trades_profit_label")}</label>
                <input type="number" step="any" value={form.manualPnl} onChange={(e) => set("manualPnl", e.target.value)} placeholder="742.98" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("trades_fees_swap")} <Hint text={t("trades_fees_swap")} /></label>
                <input type="number" step="any" value={form.fees} onChange={(e) => set("fees", e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              {/* P/L preview inline */}
              {calcPnl !== null ? (
                <div className="rounded-lg bg-card border border-stroke-2 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[10px] text-ink-5 uppercase">{t("trades_result_total")}</span>
                  <span className="text-base font-bold font-mono" style={{ color: calcPnl >= 0 ? SAGE : BRICK }}>
                    {calcPnl >= 0 ? "+" : ""}${calcPnl.toFixed(2)}
                  </span>
                  {parseFloat(form.fees) > 0 && (
                    <span className="text-xs font-mono" style={{ color: (calcPnl - parseFloat(form.fees)) >= 0 ? SAGE : BRICK }}>
                      {t("trades_result_net")} {(calcPnl - parseFloat(form.fees)) >= 0 ? "+" : ""}${(calcPnl - parseFloat(form.fees)).toFixed(2)}
                    </span>
                  )}
                  {effectiveQty > 0 && (
                    <span className="text-[10px] text-ink-5 mt-0.5">{effectiveQty.toFixed(6)} {t("trades_size_units_short")}</span>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-card border border-stroke-2 px-3 py-2">
                  <span className="text-[10px] text-ink-5">{t("trades_result_pending")}</span>
                </div>
              )}
            </div>

            {/* Risk / Reward / R:R / R-multiple strip — always visible */}
            <div className="mt-3 pt-3 border-t border-brand/20 grid grid-cols-4 gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-ink-5">{t("trades_risk_label")}</span>
                <span className="text-sm font-mono font-bold tabular-nums" style={{ color: riskDollars > 0 ? BRICK : "var(--color-ink-5)" }}>
                  {riskDollars > 0 ? `−$${riskDollars.toFixed(2)}` : "—"}
                </span>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: riskDollars > 0 ? BRICK : "var(--color-ink-5)" }}>
                  {riskDollars > 0 ? "−1.00R" : ""}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-ink-5">{t("trades_reward_label")}</span>
                <span className="text-sm font-mono font-bold tabular-nums" style={{ color: rewardDollars > 0 ? SAGE : "var(--color-ink-5)" }}>
                  {rewardDollars > 0 ? `+$${rewardDollars.toFixed(2)}` : "—"}
                </span>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: rewardDollars > 0 && riskPerUnit > 0 ? SAGE : "var(--color-ink-5)" }}>
                  {rrRatio > 0 ? `+${rrRatio.toFixed(2)}R` : ""}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-ink-5">{t("trades_rr_label")}</span>
                <span className="text-sm font-mono font-bold tabular-nums" style={{ color: rrRatio > 0 ? "var(--color-brand)" : "var(--color-ink-5)" }}>
                  {rrRatio > 0 ? `1 : ${rrRatio.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-ink-5">{t("trades_r_multiple_label")}</span>
                <span className="text-sm font-mono font-bold tabular-nums" style={{ color: rMultiple !== 0 ? (rMultiple >= 0 ? SAGE : BRICK) : "var(--color-ink-5)" }}>
                  {rMultiple !== 0 ? `${rMultiple >= 0 ? "+" : ""}${rMultiple.toFixed(2)}R` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Row 4: Playbook + Setup + Emotional + Tags + Rating ── */}
          <div className="grid grid-cols-5 gap-3 items-end">
            {/* Playbook selector — auto-fills Setup */}
            <div className="flex flex-col">
              <label className={labelCls}>{t("trade_playbook")}</label>
              <select
                value={playbooks.find((p) => p.name === form.setup)?.id || ""}
                onChange={(e) => {
                  const pb = playbooks.find((p) => p.id === e.target.value);
                  set("setup", pb ? pb.name : "");
                }}
                className={inputCls}
              >
                <option value="">{t("trades_pb_none")}</option>
                {playbooks.map((pb) => (
                  <option key={pb.id} value={pb.id}>{pb.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className={labelCls}>{t("trade_setup")} <Hint text={t("trades_setup_hint")} /></label>
              <select value={form.setup} onChange={(e) => set("setup", e.target.value)} className={inputCls}>
                <option value="">{t("trades_setup_none")}</option>
                <option value="Breakout">{t("setup_breakout")}</option><option value="Pullback">{t("setup_pullback")}</option><option value="Reversal">{t("setup_reversal")}</option>
                <option value="Trend Following">{t("setup_trend_following")}</option>
                <option value="Range">{t("setup_range")}</option>
                <option value="Scalp">{t("setup_scalp")}</option>
                <option value="VWAP">{t("setup_vwap")}</option>
                <option value="Gap Fill">{t("setup_gap_fill")}</option>
                {playbooks
                  .filter((pb) => !["Breakout","Pullback","Reversal","Trend Following","Range","Scalp","VWAP","Gap Fill"].includes(pb.name))
                  .map((pb) => <option key={pb.id}>{pb.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className={labelCls}>{t("trade_emotion")}</label>
              <select value={form.emotionalState} onChange={(e) => set("emotionalState", e.target.value)} className={cn(inputCls, "mt-auto")}>
                <option value="neutral">{t("es_neutral")}</option>
                <option value="confident">{t("es_confident")}</option>
                <option value="fearful">{t("es_fearful")}</option>
                <option value="greedy">{t("es_greedy")}</option>
                <option value="frustrated">{t("es_frustrated")}</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className={labelCls}>{t("trade_tags")}</label>
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="breakout, FOMO…" className={cn(inputCls, "mt-auto")} />
            </div>
            <div className="flex flex-col">
              <label className={labelCls}>{t("trade_rating")} <Hint text={t("trades_rating_hint")} /></label>
              <div className="flex gap-1 h-10 items-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => set("rating", s === form.rating ? 0 : s)}>
                    <Star className={cn("h-6 w-6 transition-colors", s <= (form.rating as number) ? "fill-amber-400 text-amber-400" : "text-stroke-2 hover:text-ink-5")} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Row 5: Notes + Screenshots side by side ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Notes */}
            <div>
              <label className={labelCls}>{t("trade_notes")}</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
                placeholder={t("trades_notes_placeholder")} rows={4}
                className="w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none resize-none" />
            </div>

            {/* Screenshots */}
            <div className="rounded-lg border border-stroke-2 bg-tinted p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-ink-3 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> {t("trades_screenshots")}
                </p>
                <div className="flex items-center gap-2">
                  {uploading && <div className="h-3.5 w-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="text-xs text-ink-5 hover:text-brand transition-colors flex items-center gap-1">
                    <Upload className="h-3 w-3" /> {t("trades_upload")}
                  </button>
                </div>
              </div>
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((url) => (
                    <div key={url} className="group relative rounded-lg overflow-hidden bg-card aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => setLightbox(url)}
                          className="opacity-0 group-hover:opacity-100 rounded-full bg-white/20 p-1 text-white transition-all hover:bg-white/30">
                          <ZoomIn className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => setImages((p) => p.filter((u) => u !== url))}
                          className="opacity-0 group-hover:opacity-100 rounded-full p-1 text-white transition-all" style={{ background: BRICK }}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="rounded-lg border-2 border-dashed border-stroke-2 aspect-video flex flex-col items-center justify-center text-ink-5 hover:border-brand hover:text-brand transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-ink-5 hover:text-brand transition-colors mt-2">
                  <ImageIcon className="h-3.5 w-3.5" /> {t("trades_paste_hint")}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors">{t("cancel")}</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-deep py-2.5 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all disabled:opacity-50 shadow-lg shadow-brand/20">
              {saving ? t("trades_saving") : trade ? t("trades_save_btn") : t("trades_add_btn")}
            </button>
          </div>
        </form>
      </div>
    </div>
    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
      onChange={(e) => { handleImageUpload(Array.from(e.target.files || [])); if (fileRef.current) fileRef.current.value = ""; }} />
    </Portal>
  );
}

// ── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative rounded-xl border border-stroke bg-card p-6 shadow-2xl w-80 text-center">
          <Trash2 className="h-10 w-10 mx-auto mb-3" style={{ color: BRICK }} />
          <h3 className="text-base font-semibold text-ink mb-1">{t("trades_delete_title")}</h3>
          <p className="text-sm text-ink-3 mb-5">{t("trades_delete_desc")}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-lg border border-stroke-2 py-2 text-sm text-ink-3 hover:text-ink transition-colors">{t("cancel")}</button>
            <button onClick={onConfirm} className="flex-1 rounded-lg py-2 text-sm font-medium text-white transition-colors" style={{ background: BRICK }}>{t("delete")}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Close Trade Modal ────────────────────────────────────────────────────────
function CloseTradeModal({ trade, onClose, onSaved }: { trade: Trade; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const now = toDateTimeLocalInputValue(new Date());
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(now);
  const [manualPnl, setManualPnl] = useState("");
  const [fees, setFees] = useState(trade.fees?.toString() || "0");
  const [saving, setSaving] = useState(false);

  const entry = trade.entryPrice;
  const exit = parseFloat(exitPrice) || 0;
  const qty = trade.quantity;
  const calcPnl = exit > 0 && entry > 0 && qty > 0
    ? (trade.side === "long" ? (exit - entry) * qty : (entry - exit) * qty)
    : null;
  const preview = manualPnl !== "" ? parseFloat(manualPnl) : calcPnl;

  const handleSave = async () => {
    if (!exitDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trade,
          exitPrice: exitPrice || undefined,
          exitDate,
          clientTimezoneOffset: new Date().getTimezoneOffset(),
          manualPnl: manualPnl || undefined,
          fees,
          quantity: trade.quantity,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Сделка закрыта", "success");
      onSaved();
    } catch {
      toast("Ошибка сохранения", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "h-10 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 transition-colors";

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm rounded-xl border border-stroke bg-card shadow-2xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" style={{ color: SAGE }} />
                <h3 className="text-base font-semibold text-ink">Закрыть сделку</h3>
              </div>
              <p className="text-xs text-ink-4 mt-0.5">
                <span className="font-medium" style={{ color: trade.side === "long" ? SAGE : BRICK }}>
                  {trade.side.toUpperCase()}
                </span>
                {" "}{trade.symbol} · вход {trade.entryPrice}
              </p>
            </div>
            <button onClick={onClose} className="text-ink-5 hover:text-ink transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Exit price */}
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-1.5">Цена выхода</label>
              <input
                type="number" step="any" autoFocus
                value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </div>

            {/* Exit date */}
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-1.5">Дата выхода</label>
              <input
                type="datetime-local"
                value={exitDate} onChange={(e) => setExitDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* P&L preview or manual */}
            {calcPnl !== null && (
              <div className="rounded-lg px-4 py-2.5 flex items-center justify-between border"
                style={{ background: `${calcPnl >= 0 ? SAGE : BRICK}12`, borderColor: `${calcPnl >= 0 ? SAGE : BRICK}35` }}>
                <span className="text-xs text-ink-4">Расчётный P&L</span>
                <span className="text-lg font-bold" style={{ color: calcPnl >= 0 ? SAGE : BRICK }}>
                  {calcPnl >= 0 ? "+" : ""}${calcPnl.toFixed(2)}
                </span>
              </div>
            )}

            {/* Manual P&L override */}
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-1.5">
                P&L от брокера <span className="text-ink-5 font-normal">(если отличается от расчётного)</span>
              </label>
              <input
                type="number" step="any"
                value={manualPnl} onChange={(e) => setManualPnl(e.target.value)}
                placeholder={calcPnl !== null ? calcPnl.toFixed(2) : "742.98"}
                className={inputCls}
              />
            </div>

            {/* Fees */}
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-1.5">Комиссия</label>
              <input
                type="number" step="any"
                value={fees} onChange={(e) => setFees(e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </div>

            {/* Net preview */}
            {preview !== null && (
              <div className="text-xs text-ink-4 text-right">
                Нетто: <span className="font-semibold" style={{ color: (preview - parseFloat(fees || "0")) >= 0 ? SAGE : BRICK }}>
                  {(preview - parseFloat(fees || "0")) >= 0 ? "+" : ""}${(preview - parseFloat(fees || "0")).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={onClose}
              className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors">
              Отмена
            </button>
            <button onClick={handleSave} disabled={saving || !exitDate}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 shadow-lg" style={{ background: SAGE }}>
              {saving ? "Сохранение..." : "Закрыть сделку"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type SortField = "entryDate" | "symbol" | "pnl" | "netPnl" | "rMultiple" | "entryPrice" | "quantity";

function TradesPageInner() {
  const t = useT();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [filterPnl, setFilterPnl] = useState(0);
  const [filterNetPnl, setFilterNetPnl] = useState(0);
  const [filterTrades, setFilterTrades] = useState(0);
  const [filterWins, setFilterWins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineRow, setInlineRow] = useState({
    date: "", symbol: "", side: "long", entryPrice: "", exitPrice: "",
    quantity: "", pnl: "", fees: "0", market: "crypto",
  });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [tradesTab, setTradesTab] = useState<"list" | "journal">("list");

  // Risk limits (from settings)
  const [maxDailyLoss, setMaxDailyLoss] = useState(0);
  const [maxDailyTrades, setMaxDailyTrades] = useState(0);

  // Load risk limits once
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setMaxDailyLoss(Number(d.maxDailyLoss ?? 0));
        setMaxDailyTrades(Number(d.maxDailyTrades ?? 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Alerts: daily loss limit + 3 losses streak
  useAlerts(trades, { maxDailyLoss }, toast);

  // Filters
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterSide, setFilterSide] = useState("all");
  const [filterSetup, setFilterSetup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterFrom, setFilterFrom] = useState(searchParams.get("from") || "");
  const [filterTo, setFilterTo] = useState(searchParams.get("to") || "");
  const [filterTag, setFilterTag] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("entryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      sort: sortField,
      dir: sortDir,
    });
    if (filterSymbol) params.set("symbol", filterSymbol);
    if (filterSide !== "all") params.set("side", filterSide);
    if (filterSetup !== "all") params.set("setup", filterSetup);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterAccount !== "all") params.set("accountId", filterAccount);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    if (filterTag) params.set("tag", filterTag);

    try {
      const res = await fetch(`/api/trades?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTrades(data.trades);
      setTotal(data.total);
      setFilterPnl(data.filterPnl ?? 0);
      setFilterNetPnl(data.filterNetPnl ?? 0);
      setFilterTrades(data.filterTrades ?? 0);
      setFilterWins(data.filterWins ?? 0);
    } catch {
      toast("Failed to load trades", "error");
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, filterSymbol, filterSide, filterSetup, filterStatus, filterAccount, filterFrom, filterTo, filterTag, toast]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Open add modal when ?new=1 is in URL (from header "New Trade" button via checklist)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
      setEditingTrade(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      router.replace(`/trades${params.size > 0 ? `?${params}` : ""}`, { scroll: false });
    }
  }, [searchParams, router]);

  // Open edit modal when ?edit=<id> is in URL (e.g. from trade detail page)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading) return;
    const trade = trades.find(t => t.id === editId);
    if (trade) {
      setEditingTrade(trade);
      setIsDuplicate(false);
      setShowForm(true);
      // Clear the param from URL without re-navigating
      const params = new URLSearchParams(searchParams.toString());
      params.delete("edit");
      router.replace(`/trades${params.size > 0 ? `?${params}` : ""}`, { scroll: false });
    }
  }, [searchParams, trades, loading, router]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Trade deleted", "success");
      setDeletingId(null);
      fetchTrades();
    } catch {
      toast("Failed to delete trade", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selected].map((id) => fetch(`/api/trades/${id}`, { method: "DELETE" })));
      toast(`Deleted ${selected.size} trades`, "success");
      setSelected(new Set());
      fetchTrades();
    } catch {
      toast("Failed to delete", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === trades.length) setSelected(new Set());
    else setSelected(new Set(trades.map((t) => t.id)));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingTrade(null);
    fetchTrades();
  };

  const handleInlineSave = async () => {
    if (!inlineRow.symbol || !inlineRow.date) return;
    setInlineSaving(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: inlineRow.symbol,
          side: inlineRow.side,
          entryPrice: inlineRow.entryPrice || "0",
          exitPrice: inlineRow.exitPrice || null,
          clientTimezoneOffset: new Date().getTimezoneOffset(),
          quantity: inlineRow.entryPrice && inlineRow.quantity
            ? String(parseFloat(inlineRow.quantity) / parseFloat(inlineRow.entryPrice))
            : "0",
          entryDate: inlineRow.date,
          manualPnl: inlineRow.pnl !== "" ? inlineRow.pnl : undefined,
          fees: inlineRow.fees,
          market: inlineRow.market,
          accountId: filterAccount !== "all" && filterAccount !== "unassigned" ? filterAccount : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Trade added", "success");
      setInlineRow({ date: "", symbol: "", side: "long", entryPrice: "", exitPrice: "", quantity: "", pnl: "", fees: "0", market: "crypto" });
      setShowInlineAdd(false);
      fetchTrades();
    } catch {
      toast("Failed to save trade", "error");
    } finally {
      setInlineSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterSymbol(""); setFilterSide("all"); setFilterSetup("all");
    setFilterStatus("all"); setFilterAccount("all"); setFilterFrom(""); setFilterTo(""); setFilterTag(""); setPage(1);
  };

  const hasFilters = filterSymbol || filterSide !== "all" || filterSetup !== "all" || filterStatus !== "all" || filterAccount !== "all" || filterFrom || filterTo || filterTag;
  const defaultAccountId = filterAccount !== "all" && filterAccount !== "unassigned" ? filterAccount : "";
  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));

  // Collect unique tags from current trades for chips
  const allTags = Array.from(
    new Set(
      trades.flatMap((tr) => (tr.tags ? tr.tags.split(",").map((t) => t.trim()).filter(Boolean) : []))
    )
  ).sort();
  const totalPages = Math.ceil(total / 20);

  const winRate = filterTrades > 0 ? ((filterWins / filterTrades) * 100).toFixed(1) : "0";

  // Today's P/L and trade count (from loaded trades, no-filter snapshot)
  const todayStr = toLocalDayKey(new Date());
  const todayTrades = trades.filter((tr) =>
    toLocalDayKey(tr.entryDate) === todayStr
  );
  const todayPnl = todayTrades.reduce((s, tr) => s + (tr.netPnl || tr.pnl || 0), 0);
  const todayCount = todayTrades.length;

  const dailyLossBreached = maxDailyLoss > 0 && todayPnl <= -maxDailyLoss;
  const dailyTradesBreached = maxDailyTrades > 0 && todayCount >= maxDailyTrades;

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />)
      : null;

  return (
    <div className="space-y-5 page-enter">
      {/* Editorial Header */}
      <div className="pt-2 pb-5 border-b border-stroke flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="editorial-label">Ledger</p>
          <h1 className="font-serif text-[44px] leading-[0.98] tracking-[-0.03em] font-bold mt-2">
            {t("trades_title")} <span className="italic text-ink-3">&mdash; {total}</span>
          </h1>
          <p className="text-[13px] text-ink-3 mt-2 max-w-md font-serif italic">
            &laquo;Every position a sentence. Every exit a full stop.&raquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
              style={{ background: `${BRICK}18`, borderColor: `${BRICK}50`, color: BRICK }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bulkDeleting ? t("trades_deleting") : t("trades_delete_n", { n: String(selected.size) })}
            </button>
          )}
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[11px] font-medium text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors"
          >
            <BookText className="h-3.5 w-3.5" /> {t("nav_journal")}
          </Link>
          <Link
            href="/settings?tab=import-export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[11px] font-medium text-ink-3 hover:text-ink hover:border-stroke-2 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </Link>
          <button
            onClick={() => { setEditingTrade(null); setIsDuplicate(false); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover transition-colors shadow-deep"
          >
            <Plus className="h-4 w-4" /> {t("trades_add")}
          </button>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 border-b border-stroke -mt-2 pb-0">
        {(["list", "journal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTradesTab(tab)}
            className={cn(
              "px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors",
              tradesTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-ink-4 hover:text-ink-2"
            )}
          >
            {tab === "list" ? t("nav_trades") : t("nav_journal")}
          </button>
        ))}
      </div>

      {/* ── Journal tab ── */}
      {tradesTab === "journal" && (
        <div className="rounded-xl border border-stroke bg-card p-6 text-center space-y-3">
          <p className="text-sm text-ink-3">
            The full Journal is available as a dedicated section.
          </p>
          <a
            href="/journal"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            Open Journal
          </a>
        </div>
      )}

      {/* ── List tab content ── */}
      {tradesTab === "list" && <>

      {/* Daily risk limit banners */}
      {(dailyLossBreached || dailyTradesBreached) && (
        <div className="space-y-2">
          {dailyLossBreached && (
            <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ borderColor: `${BRICK}50`, background: `${BRICK}12` }}>
              <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: BRICK }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: BRICK }}>Дневной лимит потерь достигнут</p>
                <p className="text-xs mt-0.5" style={{ color: `${BRICK}CC` }}>
                  Убыток сегодня: <span className="font-bold">${Math.abs(todayPnl).toFixed(2)}</span> из лимита ${maxDailyLoss.toFixed(2)}.
                  Рекомендуется прекратить торговлю на сегодня.
                </p>
              </div>
            </div>
          )}
          {dailyTradesBreached && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-400">Лимит сделок в день достигнут</p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  Открыто <span className="font-bold">{todayCount}</span> сделок сегодня — лимит {maxDailyTrades}.
                  Дальнейшие сделки нарушают торговый план.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="flex gap-3 flex-wrap">
        {[
          {
            label: hasFilters ? "Filtered P/L" : "Total P/L",
            value: filterPnl >= 0 ? `+$${filterPnl.toFixed(2)}` : `-$${Math.abs(filterPnl).toFixed(2)}`,
            hex: filterPnl >= 0 ? SAGE : BRICK,
          },
          {
            label: hasFilters ? "Filtered Net P/L" : "Net P/L",
            value: filterNetPnl >= 0 ? `+$${filterNetPnl.toFixed(2)}` : `-$${Math.abs(filterNetPnl).toFixed(2)}`,
            hex: filterNetPnl >= 0 ? SAGE : BRICK,
          },
          {
            label: "Win Rate",
            value: `${winRate}%`,
            hex: parseFloat(winRate) >= 50 ? SAGE : BRICK,
          },
          { label: hasFilters ? "Matched" : "Total Trades", value: `${total}`, hex: undefined as string | undefined },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-stroke bg-card shadow-deep px-4 py-3 min-w-[140px] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${s.hex || "rgba(240,114,64,0.9)"}, rgba(240,114,64,0.05))` }} />
            <p className="editorial-label">{s.label}</p>
            <p className="font-serif text-2xl font-bold tnum mt-1" style={s.hex ? { color: s.hex } : undefined}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-5" />
          <input
            type="text" value={filterSymbol}
            onChange={(e) => { setFilterSymbol(e.target.value.toUpperCase()); setPage(1); }}
            placeholder="Symbol…"
            className="h-9 rounded-lg border border-stroke-2 bg-tinted pl-8 pr-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none w-28"
          />
        </div>

        <select value={filterSide} onChange={(e) => { setFilterSide(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink focus:border-brand focus:outline-none">
          <option value="all">{t("trades_all_sides")}</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink focus:border-brand focus:outline-none">
          <option value="all">{t("trades_all_status")}</option>
          <option value="closed">{t("trades_status_closed")}</option>
          <option value="open">{t("trades_status_open")}</option>
        </select>

        <select value={filterAccount} onChange={(e) => { setFilterAccount(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink focus:border-brand focus:outline-none">
          <option value="all">All accounts</option>
          <option value="unassigned">Unassigned</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}{account.kind ? ` (${account.kind})` : ""}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn("flex items-center gap-1.5 h-9 rounded-lg border px-3 text-sm transition-colors",
            showFilters || hasFilters ? "border-brand/50 bg-brand/10 text-brand" : "border-stroke-2 text-ink-3 hover:text-ink"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("trades_filters")}{hasFilters ? " •" : ""}
        </button>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-ink-5 hover:text-ink transition-colors">
            {t("trades_clear")}
          </button>
        )}
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag className="h-3.5 w-3.5 text-ink-5 flex-shrink-0" />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { setFilterTag(filterTag === tag ? "" : tag); setPage(1); }}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all",
                filterTag === tag
                  ? "border-brand/50 bg-brand/15 text-brand"
                  : "border-stroke-2 text-ink-4 hover:border-brand/30 hover:text-ink-2"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Extended filters */}
      {showFilters && (
        <div className="rounded-xl border border-stroke bg-tinted p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-ink-5 mb-1">{t("trades_from")}</label>
            <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-stroke-2 bg-card px-3 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-ink-5 mb-1">{t("trades_to")}</label>
            <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-stroke-2 bg-card px-3 text-sm text-ink focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-ink-5 mb-1">{t("trades_setup_filter")}</label>
            <select value={filterSetup} onChange={(e) => { setFilterSetup(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-stroke-2 bg-card px-3 text-sm text-ink focus:border-brand focus:outline-none">
              <option value="all">{t("trades_all_setups")}</option>
              {["Breakout","Pullback","Reversal","Trend Following","Range","Scalp","VWAP","Gap Fill"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-stroke bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke bg-tinted">
                  {[10, 80, 72, 52, 56, 56, 60, 72, 72, 60, 48, 36].map((w, i) => (
                    <th key={i} className="px-4 py-3">
                      <div className="h-3 rounded animate-pulse bg-stroke" style={{ width: w }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-stroke">
                    <td className="px-4 py-3.5"><div className="h-3.5 w-3.5 rounded animate-pulse bg-tinted" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 76 }} /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 60 }} /></td>
                    <td className="px-4 py-3.5"><div className="h-5 w-12 rounded-md animate-pulse bg-tinted" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 52 }} /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 52 }} /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 56 }} /></td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 rounded animate-pulse" style={{ width: 64, background: i % 3 === 0 ? "rgba(123,175,138,0.2)" : i % 3 === 1 ? "rgba(172,90,86,0.2)" : undefined }} />
                    </td>
                    <td className="px-4 py-3.5"><div className="h-3.5 rounded animate-pulse bg-tinted" style={{ width: 64 }} /></td>
                    <td className="px-4 py-3.5"><div className="h-5 w-16 rounded-md animate-pulse bg-tinted" /></td>
                    <td className="px-4 py-3.5"><div className="flex gap-0.5">{[1,2,3,4,5].map((s) => <div key={s} className="h-3 w-3 rounded animate-pulse bg-tinted" />)}</div></td>
                    <td className="px-4 py-3.5"><div className="flex gap-1">{[1,2,3].map((s) => <div key={s} className="h-6 w-6 rounded animate-pulse bg-tinted" />)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-ink-3 mb-4">{hasFilters ? t("trades_no_match") : t("trades_no_trades")}</p>
          {!hasFilters && (
            <button onClick={() => setShowForm(true)} className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-hover transition-colors">
              {t("trades_add_first")}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-stroke bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke bg-tinted">
                  {[
                    { key: "checkbox" as const, label: "", sortable: false },
                    { key: "entryDate" as SortField, label: t("trades_col_date"), sortable: true },
                    { key: "symbol" as SortField, label: t("trades_col_symbol"), sortable: true },
                    { key: "side" as const, label: t("trades_col_side"), sortable: false },
                    { key: "entryPrice" as SortField, label: t("trades_col_entry"), sortable: true },
                    { key: "exitPrice" as const, label: t("trades_col_exit"), sortable: false },
                    { key: "quantity" as SortField, label: "Size ($)", sortable: false },
                    { key: "pnl" as SortField, label: "P/L", sortable: true },
                    { key: "netPnl" as SortField, label: "Net P/L", sortable: true },
                    { key: "setup" as const, label: t("trades_col_setup"), sortable: false },
                    { key: "rating" as const, label: t("trades_col_rating"), sortable: false },
                    { key: "actions" as const, label: "", sortable: false },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key as SortField)}
                      className={cn("editorial-label text-left px-4 py-2.5 whitespace-nowrap select-none",
                        col.sortable && "cursor-pointer hover:text-ink-2",
                        col.key === "checkbox" && "w-10")}
                    >
                      {col.key === "checkbox" ? (
                        <input type="checkbox"
                          checked={trades.length > 0 && selected.size === trades.length}
                          onChange={toggleSelectAll}
                          className="rounded accent-brand cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>{col.label}{col.sortable && <SortIcon field={col.key as SortField} />}</>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((tr) => {
                  const { text: tNotes, images: tImages } = decodeImages(tr.notes || "");
                  return (
                  <React.Fragment key={tr.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === tr.id ? null : tr.id)}
                      className={cn("border-b border-stroke hover:bg-tinted/40 transition-colors cursor-pointer row-press",
                        selected.has(tr.id) && "bg-brand/5")}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(tr.id)} onChange={() => toggleSelect(tr.id)}
                          className="rounded accent-brand cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-ink-3 font-mono whitespace-nowrap tnum text-xs">
                        {new Date(tr.entryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        {" "}
                        <span className="text-ink-4">
                          {new Date(tr.entryDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                      </td>
                      <td className="px-2 py-3 font-mono font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/trades/${tr.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-brand transition-colors flex items-center gap-1 group"
                          >
                            {tr.symbol}
                            <ExternalLink className="h-3 w-3 text-ink-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          {tImages.length > 0 && <ImageIcon className="h-3 w-3 text-ink-5" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="chip" style={{ background: `${tr.side === "long" ? SAGE : BRICK}26`, color: tr.side === "long" ? SAGE : BRICK, fontWeight: 700 }}>
                          {tr.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-mono tnum">{tr.entryPrice}</td>
                      <td className="px-4 py-3 text-ink-2 font-mono tnum">
                        {tr.exitPrice !== null ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{tr.exitPrice}</span>
                            <span className="chip" style={{ background: "var(--color-tinted)", color: "var(--color-ink-4)", fontSize: 9 }}>
                              <span className="h-1.5 w-1.5 rounded-full bg-ink-5 inline-block mr-1" />
                              CLOSED
                            </span>
                          </div>
                        ) : (
                          <span className="chip" style={{ background: `${SAGE}20`, color: SAGE, fontWeight: 700 }}>
                            <span className="pulse-dot" style={{ background: SAGE, width: 6, height: 6, borderRadius: 999, display: "inline-block", marginRight: 4 }} />
                            OPEN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-mono tnum">${(tr.quantity * tr.entryPrice).toFixed(0)}</td>
                      <td className="px-4 py-3 font-mono font-bold tnum" style={{ color: tr.pnl >= 0 ? SAGE : BRICK }}>
                        {tr.pnl >= 0 ? "+" : ""}${tr.pnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold tnum" style={{ color: tr.netPnl >= 0 ? SAGE : BRICK }}>
                        {tr.netPnl >= 0 ? "+" : ""}${tr.netPnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {tr.setup && <span className="chip" style={{ background: "rgba(240,114,64,0.12)", color: "#F07240" }}>{tr.setup}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {tr.rating && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={cn("h-3 w-3", s <= tr.rating! ? "fill-amber-400 text-amber-400" : "text-stroke-2")} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {tr.exitPrice === null && (
                            <button
                              onClick={() => setClosingTrade(tr)}
                              title="Закрыть сделку"
                              className="rounded p-1 transition-colors" style={{ color: SAGE }}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => { setEditingTrade(tr); setIsDuplicate(false); setShowForm(true); }}
                            title="Редактировать"
                            className="rounded p-1 text-ink-5 hover:text-brand transition-colors">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditingTrade(tr); setIsDuplicate(true); setShowForm(true); }}
                            title="Дублировать"
                            className="rounded p-1 text-ink-5 hover:text-ink-2 transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeletingId(tr.id)}
                            title="Удалить"
                            className="rounded p-1 text-ink-5 hover:text-ink-2 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === tr.id && (
                      <tr className="bg-canvas">
                        <td colSpan={12} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-ink-5 mb-1">{t("trades_notes_label")}</p>
                              <p className="text-sm text-ink-2">{tNotes || <span className="text-ink-4 italic">{t("trades_no_notes")}</span>}</p>
                              {tImages.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {tImages.map((url) => (
                                    <div key={url} className="rounded-lg overflow-hidden aspect-video bg-tinted cursor-pointer"
                                      onClick={() => setLightbox(url)}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-ink-5 mb-1">{t("trade_tags")}</p>
                              <p className="mb-2 text-xs text-ink-5">
                                Account: <span className="text-ink-2">{tr.accountId ? accountNameById.get(tr.accountId) ?? "Unknown" : "Unassigned"}</span>
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {tr.tags
                                  ? tr.tags.split(",").map((tag) => (
                                    <span key={tag} className="rounded-md bg-tinted border border-stroke-2 px-2 py-0.5 text-xs text-ink-3">{tag.trim()}</span>
                                  ))
                                  : <span className="text-ink-4 italic text-xs">{t("trades_no_tags")}</span>}
                              </div>
                              {tr.emotionalState && (
                                <p className="mt-2 text-xs text-ink-5">{t("trades_state")}: <span className="text-ink-2 capitalize">{tr.emotionalState}</span></p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-ink-5">{t("trades_gross_pl")}</span>
                                <span style={{ color: tr.pnl >= 0 ? SAGE : BRICK }}>{tr.pnl >= 0 ? "+" : ""}${tr.pnl.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-ink-5">{t("trades_fees_label")}</span>
                                <span style={{ color: BRICK }}>-${tr.fees.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm border-t border-stroke pt-1.5">
                                <span className="text-ink-2 font-medium">{t("trades_net_label")}</span>
                                <span className="font-medium" style={{ color: tr.netPnl >= 0 ? SAGE : BRICK }}>
                                  {tr.netPnl >= 0 ? "+" : ""}${tr.netPnl.toFixed(2)}
                                </span>
                              </div>
                              {tr.rMultiple !== 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-ink-5">{t("trades_r_multiple")}</span>
                                  <span style={{ color: tr.rMultiple >= 0 ? SAGE : BRICK }}>{tr.rMultiple >= 0 ? "+" : ""}{tr.rMultiple}R</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inline Add Row */}
          {showInlineAdd ? (
            <div className="border-t border-brand/30 bg-brand/5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      {/* Date */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <input
                          type="datetime-local"
                          value={inlineRow.date}
                          onChange={(e) => setInlineRow((r) => ({ ...r, date: e.target.value }))}
                          className="h-8 w-36 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Symbol */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={inlineRow.symbol}
                          onChange={(e) => setInlineRow((r) => ({ ...r, symbol: e.target.value.toUpperCase() }))}
                          placeholder="BTCUSD"
                          className="h-8 w-24 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Side */}
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setInlineRow((r) => ({ ...r, side: "long" }))}
                            className="rounded px-2 py-1 text-xs font-medium transition-colors border"
                            style={inlineRow.side === "long" ? { background: `${SAGE}30`, color: SAGE, borderColor: `${SAGE}60` } : { borderColor: "var(--color-stroke-2)", color: "var(--color-ink-4)" }}
                          >L</button>
                          <button
                            onClick={() => setInlineRow((r) => ({ ...r, side: "short" }))}
                            className="rounded px-2 py-1 text-xs font-medium transition-colors border"
                            style={inlineRow.side === "short" ? { background: `${BRICK}30`, color: BRICK, borderColor: `${BRICK}60` } : { borderColor: "var(--color-stroke-2)", color: "var(--color-ink-4)" }}
                          >S</button>
                        </div>
                      </td>
                      {/* Entry */}
                      <td className="px-2 py-2">
                        <input
                          type="number" step="any"
                          value={inlineRow.entryPrice}
                          onChange={(e) => setInlineRow((r) => ({ ...r, entryPrice: e.target.value }))}
                          placeholder={t("trade_entry")}
                          className="h-8 w-24 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Exit */}
                      <td className="px-2 py-2">
                        <input
                          type="number" step="any"
                          value={inlineRow.exitPrice}
                          onChange={(e) => setInlineRow((r) => ({ ...r, exitPrice: e.target.value }))}
                          placeholder={t("trade_exit")}
                          className="h-8 w-24 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Qty */}
                      <td className="px-2 py-2">
                        <input
                          type="number" step="any"
                          value={inlineRow.quantity}
                          onChange={(e) => setInlineRow((r) => ({ ...r, quantity: e.target.value }))}
                          placeholder="$1000"
                          className="h-8 w-20 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* PnL (broker) */}
                      <td className="px-2 py-2">
                        <input
                          type="number" step="any"
                          value={inlineRow.pnl}
                          onChange={(e) => setInlineRow((r) => ({ ...r, pnl: e.target.value }))}
                          placeholder="Profit"
                          className="h-8 w-20 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Fees */}
                      <td className="px-2 py-2">
                        <input
                          type="number" step="any"
                          value={inlineRow.fees}
                          onChange={(e) => setInlineRow((r) => ({ ...r, fees: e.target.value }))}
                          placeholder={t("trade_fees")}
                          className="h-8 w-20 rounded border border-stroke-2 bg-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
                        />
                      </td>
                      {/* Empty setup / rating cols */}
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2" />
                      {/* Save / Cancel */}
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={handleInlineSave}
                            disabled={inlineSaving || !inlineRow.symbol || !inlineRow.date}
                            className="rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-hover disabled:opacity-40 transition-colors"
                          >
                            {inlineSaving ? "…" : "✓"}
                          </button>
                          <button
                            onClick={() => { setShowInlineAdd(false); setInlineRow({ date: "", symbol: "", side: "long", entryPrice: "", exitPrice: "", quantity: "", pnl: "", fees: "0", market: "crypto" }); }}
                            className="rounded border border-stroke-2 px-2 py-1 text-xs text-ink-4 hover:text-ink transition-colors"
                          >✕</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border-t border-stroke px-4 py-2.5">
              <button
                onClick={() => setShowInlineAdd(true)}
                className="flex items-center gap-2 w-full rounded-lg border border-dashed border-stroke-2 px-4 py-2 text-sm text-ink-4 hover:border-brand/50 hover:text-brand transition-colors justify-center"
              >
                <Plus className="h-4 w-4" /> {t("trades_add_inline")}
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-stroke px-4 py-3">
              <span className="text-sm text-ink-5">
                {t("trades_page_of", { page: String(page), total: String(totalPages), n: String(total) })}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="rounded-lg px-3 py-1 text-sm text-ink-3 hover:bg-tinted disabled:opacity-40">{t("trades_prev")}</button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="rounded-lg px-3 py-1 text-sm text-ink-3 hover:bg-tinted disabled:opacity-40">{t("trades_next")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <TradeForm
          trade={editingTrade}
          isDuplicate={isDuplicate}
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingTrade(null); setIsDuplicate(false); }}
        />
      )}

      {deletingId && (
        <DeleteModal
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onClose={() => setClosingTrade(null)}
          onSaved={() => { setClosingTrade(null); fetchTrades(); }}
        />
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      </>}
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense>
      <TradesPageInner />
    </Suspense>
  );
}
