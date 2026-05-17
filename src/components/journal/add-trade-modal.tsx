"use client";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Star, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { useT } from "@/lib/useT";

interface PlaybookOption {
  id: string;
  name: string;
}

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

const MARKET_OPTIONS = [
  { value: "crypto",  label: "Crypto (Spot)" },
  { value: "futures", label: "Futures / Perp" },
  { value: "forex",   label: "Forex" },
  { value: "stocks",  label: "Stocks" },
  { value: "options", label: "Options" },
];


const SETUP_OPTIONS = [
  "Breakout", "Pullback", "Reversal", "Trend Following",
  "Range", "Scalp", "VWAP Bounce", "Gap Fill", "Momentum",
];

const EMOTION_OPTIONS = [
  { value: "confident",  label: "Confident" },
  { value: "neutral",    label: "Neutral" },
  { value: "fearful",    label: "Fearful" },
  { value: "greedy",     label: "Greedy" },
  { value: "frustrated", label: "Frustrated" },
  { value: "patient",    label: "Patient" },
];

export function AddTradeModal({ isOpen, onClose, onAdded }: AddTradeModalProps) {
  const t = useT();
  const [side, setSide]           = useState<"long" | "short">("long");
  const [rating, setRating]       = useState(0);
  const [symbol, setSymbol]       = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice]   = useState("");
  const [tradeSize, setTradeSize]   = useState("");
  const [entryDate, setEntryDate]   = useState("");
  const [exitDate, setExitDate]     = useState("");
  const [fees, setFees]             = useState("");
  const [market, setMarket]         = useState("crypto");
  const [setup, setSetup]           = useState("");
  const [notes, setNotes]           = useState("");
  const [tags, setTags]             = useState("");
  const [emotion, setEmotion]       = useState("neutral");
  const [stopLoss, setStopLoss]     = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [sizeMode, setSizeMode]     = useState<"$" | "units">("$");
  const [playbookId, setPlaybookId] = useState("");
  const [playbooks, setPlaybooks]   = useState<PlaybookOption[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/playbooks")
      .then(r => r.json())
      .then((data: PlaybookOption[]) => setPlaybooks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isOpen]);

  const entry    = parseFloat(entryPrice) || 0;
  const exit     = parseFloat(exitPrice) || 0;
  const size     = parseFloat(tradeSize) || 0;
  const feeVal   = parseFloat(fees) || 0;

  // Compute P&L preview based on sizeMode
  const calcPnl  = entry > 0 && size > 0
    ? sizeMode === "$"
      ? (side === "long"
          ? (exit - entry) / entry * size
          : (entry - exit) / entry * size)
      : (side === "long"
          ? (exit - entry) * size
          : (entry - exit) * size)
    : 0;
  const calcNet  = calcPnl - feeVal;
  const showPreview = entry > 0 && exit > 0 && size > 0;

  function reset() {
    setSide("long"); setRating(0); setSymbol(""); setEntryPrice(""); setExitPrice("");
    setTradeSize(""); setEntryDate(""); setExitDate(""); setFees("");
    setMarket("crypto"); setSetup(""); setNotes(""); setTags(""); setEmotion("neutral");
    setStopLoss(""); setTakeProfit(""); setErrors({}); setSizeMode("$"); setPlaybookId("");
  }

  async function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!symbol.trim()) newErrors.symbol = "Символ обязателен";
    if (!entryPrice || parseFloat(entryPrice) <= 0) newErrors.entryPrice = "Цена входа обязательна";
    if (!entryDate) newErrors.entryDate = "Дата входа обязательна";
    if (tradeSize && parseFloat(tradeSize) <= 0) newErrors.tradeSize = "Объём должен быть больше 0";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        symbol,
        side,
        market,
        clientTimezoneOffset: new Date().getTimezoneOffset(),
        entryPrice,
        exitPrice: exitPrice || undefined,
        quantity: sizeMode === "$"
          ? (entry > 0 ? String(size / entry) : String(size))  // convert $ → units
          : String(size),  // already units
        entryDate,
        exitDate: exitDate || undefined,
        fees: fees || "0",
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        setup: setup || undefined,
        playbookId: playbookId || undefined,
        notes: notes || undefined,
        tags: tags || undefined,
        rating: rating || undefined,
        emotionalState: emotion,
      };

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        reset();
        onAdded?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const inputCls = "h-9 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors";
  const labelCls = "block text-xs font-medium text-ink-3 mb-1";
  const selCls   = "h-9 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink focus:border-brand focus:outline-none appearance-none cursor-pointer";

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] overflow-y-auto">
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm anim-backdrop" onClick={onClose} />
        <div className="relative flex min-h-full items-center justify-center p-4 pointer-events-none">
          <div className="relative pointer-events-auto w-full max-w-3xl rounded-xl border border-stroke bg-card p-6 shadow-2xl anim-scale-in">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-ink">{t("trade_add_new")}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── BUY / SELL toggle ─────────────────────────────────────────── */}
            <div className="mb-5">
              <div className="inline-flex rounded-xl border border-stroke-2 p-1 bg-tinted gap-1">
                <button
                  type="button"
                  onClick={() => setSide("long")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-150",
                    side === "long"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : "text-ink-4 hover:text-ink"
                  )}
                >
                  <TrendingUp className="h-4 w-4" />
                  BUY / LONG
                </button>
                <button
                  type="button"
                  onClick={() => setSide("short")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-150",
                    side === "short"
                      ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                      : "text-ink-4 hover:text-ink"
                  )}
                >
                  <TrendingDown className="h-4 w-4" />
                  SELL / SHORT
                </button>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              {/* LEFT COLUMN */}
              <div className="space-y-4">

                {/* Symbol + Market */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("common_symbol")}</label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="BTC, ETH, ES, EURUSD"
                      className={cn(inputCls, errors.symbol && "border-red-500 focus:border-red-500 focus:ring-red-500/50")}
                    />
                    {errors.symbol && <p className="text-xs text-red-400 mt-1">{errors.symbol}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{t("trade_market")}</label>
                    <div className="relative">
                      <select
                        value={market}
                        onChange={(e) => setMarket(e.target.value)}
                        className={selCls}
                      >
                        {MARKET_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                    </div>
                  </div>
                </div>

                {/* Entry / Exit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("trade_entry_price")}</label>
                    <input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" className={cn(inputCls, errors.entryPrice && "border-red-500 focus:border-red-500 focus:ring-red-500/50")} />
                    {errors.entryPrice && <p className="text-xs text-red-400 mt-1">{errors.entryPrice}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{t("trade_exit_price")}</label>
                    <input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                </div>

                {/* Trade Size */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-ink-3">
                      Trade Size {sizeMode === "$" ? "($)" : "(units)"}
                    </label>
                    <div className="inline-flex rounded-md border border-stroke-2 bg-tinted overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSizeMode("$")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          sizeMode === "$"
                            ? "bg-brand text-white"
                            : "text-ink-4 hover:text-ink"
                        )}
                      >
                        $
                      </button>
                      <button
                        type="button"
                        onClick={() => setSizeMode("units")}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          sizeMode === "units"
                            ? "bg-brand text-white"
                            : "text-ink-4 hover:text-ink"
                        )}
                      >
                        Units
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={tradeSize}
                    onChange={(e) => setTradeSize(e.target.value)}
                    placeholder={sizeMode === "$" ? "1000" : "0.5"}
                    className={cn(inputCls, errors.tradeSize && "border-red-500 focus:border-red-500 focus:ring-red-500/50")}
                  />
                  {errors.tradeSize && <p className="text-xs text-red-400 mt-1">{errors.tradeSize}</p>}
                </div>

                {/* Stop Loss / Take Profit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("trade_stop_loss_label")}</label>
                    <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("trade_take_profit_label")}</label>
                    <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="0.00" className={inputCls} />
                  </div>
                </div>

                {/* Entry / Exit date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("trade_entry_datetime")}</label>
                    <input type="datetime-local" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={cn(inputCls, errors.entryDate && "border-red-500 focus:border-red-500 focus:ring-red-500/50")} />
                    {errors.entryDate && <p className="text-xs text-red-400 mt-1">{errors.entryDate}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{t("trade_exit_datetime")}</label>
                    <input type="datetime-local" value={exitDate} onChange={(e) => setExitDate(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Fees */}
                <div>
                  <label className={labelCls}>{t("trade_commission")}</label>
                  <input type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>

                {/* P&L Preview */}
                {showPreview && (
                  <div className="rounded-lg border border-stroke-2 bg-tinted px-4 py-3 space-y-1">
                    <p className="text-xs text-ink-4 mb-1">Calculated P&L</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-ink-5">Gross</span>
                      <span className={cn("text-lg font-bold", calcPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {calcPnl >= 0 ? "+" : ""}${calcPnl.toFixed(2)}
                      </span>
                    </div>
                    {feeVal > 0 && (
                      <div className="flex items-baseline justify-between border-t border-stroke-2 pt-1">
                        <span className="text-xs text-ink-5">Net (after fees)</span>
                        <span className={cn("text-sm font-semibold", calcNet >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {calcNet >= 0 ? "+" : ""}${calcNet.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">

                {/* Setup */}
                <div>
                  <label className={labelCls}>Setup</label>
                  <div className="relative">
                    <select value={setup} onChange={(e) => setSetup(e.target.value)} className={selCls}>
                      <option value="">Select setup...</option>
                      {SETUP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                  </div>
                </div>

                {/* Playbook */}
                {playbooks.length > 0 && (
                  <div>
                    <label className={labelCls}>Playbook</label>
                    <div className="relative">
                      <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} className={selCls}>
                        <option value="">None</option>
                        {playbooks.map(pb => <option key={pb.id} value={pb.id}>{pb.name}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                    </div>
                  </div>
                )}

                {/* Emotional State */}
                <div>
                  <label className={labelCls}>Emotional State</label>
                  <div className="relative">
                    <select value={emotion} onChange={(e) => setEmotion(e.target.value)} className={selCls}>
                      {EMOTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className={labelCls}>Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="A+ Setup, VWAP, News Play"
                    className={inputCls}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What happened? What did you learn?"
                    rows={5}
                    className="w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors resize-none"
                  />
                </div>

                {/* Rating */}
                <div>
                  <label className={labelCls}>Trade Quality</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s === rating ? 0 : s)}
                        className="p-0.5"
                      >
                        <Star className={cn("h-6 w-6 transition-colors", s <= rating ? "fill-amber-400 text-amber-400" : "text-ink-5 hover:text-amber-400/60")} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-5 pt-5 border-t border-stroke-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm font-medium text-ink-3 hover:text-ink hover:bg-tinted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !symbol || !entryPrice || !tradeSize || !entryDate}
                className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-deep py-2.5 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all shadow-lg shadow-brand/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Add Trade"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
