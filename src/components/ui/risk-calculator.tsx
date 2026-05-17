"use client";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X, Calculator, TrendingUp, TrendingDown,
  AlertTriangle, Copy, Check, RotateCcw,
} from "lucide-react";
import { Portal } from "@/components/ui/portal";

interface Props {
  onClose: () => void;
}

type Side      = "long" | "short";
type AssetType = "stock" | "crypto" | "forex";
type Currency  = "USD" | "EUR" | "RUB";

const SYM:       Record<Currency,  string> = { USD: "$", EUR: "€", RUB: "₽" };
const ASSET_LBL: Record<AssetType, string> = { stock: "Акции", crypto: "Крипто", forex: "Форекс" };
const UNIT_LBL:  Record<AssetType, string> = { stock: "акций", crypto: "монет", forex: "лотов" };
const DEF_LEV:   Record<AssetType, number> = { stock: 1, crypto: 10, forex: 100 };

const LS_KEY = "risk-calc-prefs";

function loadPrefs(): Record<string, unknown> {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function savePrefs(p: object) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function RiskCalculator({ onClose }: Props) {
  const [accountBalance, setAccountBalance] = useState(50000);
  const [riskPct,        setRiskPct]        = useState(1);
  const [currency,       setCurrency]       = useState<Currency>("USD");
  const [assetType,      setAssetType]      = useState<AssetType>("stock");
  const [leverage,       setLeverage]       = useState(1);
  const [commission,     setCommission]     = useState(0);
  const [entryPrice,     setEntryPrice]     = useState("");
  const [stopLoss,       setStopLoss]       = useState("");
  const [takeProfit,     setTakeProfit]     = useState("");
  const [side,           setSide]           = useState<Side>("long");
  const [copied,         setCopied]         = useState(false);

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.accountBalance) setAccountBalance(Number(d.accountBalance));
        if (d.riskPerTrade)   setRiskPct(Number(d.riskPerTrade));
      })
      .catch(() => {});

    const id = setTimeout(() => {
      const p = loadPrefs();
      if (p.currency)                     setCurrency(p.currency as Currency);
      if (p.assetType)                    setAssetType(p.assetType as AssetType);
      if (typeof p.leverage   === "number") setLeverage(p.leverage);
      else if (p.assetType)               setLeverage(DEF_LEV[p.assetType as AssetType]);
      if (typeof p.commission === "number") setCommission(p.commission);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  /* ── Persist prefs ────────────────────────────────────────────────────── */
  useEffect(() => {
    savePrefs({ currency, assetType, leverage, commission });
  }, [currency, assetType, leverage, commission]);

  /* ── Escape ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* ── Calculations ──────────────────────────────────────────────────────── */
  const entry = parseFloat(entryPrice) || 0;
  const stop  = parseFloat(stopLoss)   || 0;
  const tp    = parseFloat(takeProfit) || 0;

  const sym       = SYM[currency];
  const unitLabel = UNIT_LBL[assetType];

  const dollarRisk    = (accountBalance * riskPct) / 100;
  const effectiveRisk = Math.max(0, dollarRisk - commission);
  const stopDistance  = entry > 0 && stop > 0
    ? (side === "long" ? entry - stop : stop - entry)
    : 0;

  // rawUnits = фактическое количество единиц актива
  const rawUnits     = stopDistance > 0 ? effectiveRisk / stopDistance : 0;
  // Форекс: 1 стандартный лот = 100 000 базовых единиц; Проп: 1 контракт обычно = 1 rawUnit
  const displayUnits = assetType === "forex" ? rawUnits / 100_000 : rawUnits;

  const tradeValue = rawUnits * entry;
  const margin     = leverage > 0 ? tradeValue / leverage : tradeValue;

  const tpDistance = tp > 0 ? (side === "long" ? tp - entry : entry - tp) : 0;
  const rrRatio    = stopDistance > 0 && tpDistance > 0 ? tpDistance / stopDistance : 0;
  const potProfit  = rawUnits * tpDistance - commission;

  /* ── Validation ────────────────────────────────────────────────────────── */
  const stopValid     = stop === 0 || (side === "long" ? stop < entry : stop > entry);
  const tpValid       = tp   === 0 || (side === "long" ? tp   > entry : tp   < entry);
  const ready         = entry > 0 && stop > 0 && stopValid;
  const marginWarning = ready && leverage > 0 && margin > accountBalance;

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  const fmtUnits = (n: number) =>
    n.toFixed(n < 0.001 ? 6 : n < 0.1 ? 4 : n < 100 ? 2 : 0);

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fmtUnits(displayUnits)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [displayUnits]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => { setEntryPrice(""); setStopLoss(""); setTakeProfit(""); };

  const handleAssetChange = (type: AssetType) => {
    setAssetType(type);
    setLeverage(DEF_LEV[type]);
  };

  const inputCls =
    "h-10 w-full rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink " +
    "placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-1 " +
    "focus:ring-brand/30 transition-colors";

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-md rounded-2xl border border-stroke bg-card shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

          {/* ── Header ── */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-stroke bg-card">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-brand/15 flex items-center justify-center">
                <Calculator className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Калькулятор риска</h2>
                <p className="text-xs text-ink-4">Расчёт размера позиции</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClear} title="Очистить цены"
                className="rounded-lg p-1.5 text-ink-4 hover:text-ink hover:bg-tinted transition-colors">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={onClose}
                className="rounded-lg p-1.5 text-ink-4 hover:text-ink hover:bg-tinted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">

            {/* ── Asset type ── */}
            <div className="grid grid-cols-3 gap-1.5">
              {(["stock", "crypto", "forex"] as AssetType[]).map((type) => (
                <button key={type} onClick={() => handleAssetChange(type)}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-semibold border transition-all",
                    assetType === type
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-stroke-2 text-ink-4 hover:bg-tinted hover:text-ink"
                  )}>
                  {ASSET_LBL[type]}
                </button>
              ))}
            </div>

            {/* ── Long / Short ── */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide("long")} className={cn(
                "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all",
                side === "long"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-stroke-2 text-ink-4 hover:bg-tinted"
              )}>
                <TrendingUp className="h-4 w-4" /> Long
              </button>
              <button onClick={() => setSide("short")} className={cn(
                "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all",
                side === "short"
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-stroke-2 text-ink-4 hover:bg-tinted"
              )}>
                <TrendingDown className="h-4 w-4" /> Short
              </button>
            </div>

            {/* ── Entry / Stop / TP ── */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Вход</label>
                <input type="number" step="any" value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Стоп</label>
                <input type="number" step="any" value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputCls, stop > 0 && !stopValid && "border-red-500/50")} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Тейк</label>
                <input type="number" step="any" value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="опц."
                  className={cn(inputCls, tp > 0 && !tpValid && "border-red-500/50")} />
              </div>
            </div>

            {/* ── Balance / Risk % / Currency ── */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Баланс</label>
                <input type="number" value={accountBalance}
                  onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Риск %</label>
                <input type="number" step="0.1" min="0.1" max="100" value={riskPct}
                  onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Валюта</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}
                  className={inputCls}>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="RUB">RUB ₽</option>
                </select>
              </div>
            </div>

            {/* ── Leverage / Commission ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">Плечо (x)</label>
                <input type="number" min="1" step="1" value={leverage}
                  onChange={(e) => setLeverage(parseFloat(e.target.value) || 1)}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-4 uppercase tracking-widest mb-1.5">
                  Комиссия ({sym})
                </label>
                <input type="number" min="0" step="0.01" value={commission}
                  onChange={(e) => setCommission(parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </div>
            </div>

            {/* ── Risk % presets ── */}
            <div className="flex gap-1.5">
              {[0.5, 1, 1.5, 2, 3].map((p) => (
                <button key={p} onClick={() => setRiskPct(p)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-semibold border transition-all",
                    riskPct === p
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-stroke-2 text-ink-4 hover:bg-tinted hover:text-ink"
                  )}>
                  {p}%
                </button>
              ))}
            </div>

            {/* ── Result box ── */}
            <div className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              ready ? "border-stroke bg-tinted/50" : "border-stroke-2 bg-tinted/30"
            )}>
              {!ready ? (
                <p className="text-sm text-ink-5 text-center py-2">Введите вход и стоп-лосс</p>
              ) : (
                <>
                  {/* PRIMARY: Position size */}
                  <div className="text-center py-1">
                    <p className="text-[11px] font-bold text-ink-5 uppercase tracking-widest mb-1">Размер позиции</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-3xl font-bold text-ink truncate max-w-[180px]">{fmtUnits(displayUnits)}</p>
                      <button onClick={handleCopy} title="Скопировать"
                        className="rounded-lg p-1.5 text-ink-4 hover:text-brand hover:bg-brand/10 transition-colors">
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-sm text-ink-4 mt-0.5">{unitLabel}</p>
                  </div>

                  {/* Trade value + Margin */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-card border border-stroke-2 px-3 py-2.5 text-center">
                      <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">Сумма в сделку</p>
                      <p className="text-sm font-bold text-ink">{sym}{fmtMoney(tradeValue)}</p>
                    </div>
                    <div className={cn(
                      "rounded-lg border px-3 py-2.5 text-center",
                      marginWarning ? "bg-amber-500/8 border-amber-500/30" : "bg-card border-stroke-2"
                    )}>
                      <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">Маржа (x{leverage})</p>
                      <p className={cn("text-sm font-bold", marginWarning ? "text-amber-400" : "text-ink")}>
                        {sym}{fmtMoney(margin)}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-stroke" />

                  {/* Risk + Stop */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-card border border-stroke-2 p-2.5 text-center">
                      <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">Риск на сделку</p>
                      <p className={cn("text-sm font-bold",
                        riskPct <= 1 ? "text-emerald-400" : riskPct <= 2 ? "text-amber-400" : "text-red-400"
                      )}>
                        {sym}{fmtMoney(effectiveRisk)}
                      </p>
                      <p className="text-[10px] text-ink-5">
                        {riskPct}%{commission > 0 ? " − комис." : " баланса"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-card border border-stroke-2 p-2.5 text-center">
                      <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">Стоп, пунктов</p>
                      <p className="text-sm font-bold text-ink">
                        {stopDistance.toFixed(stopDistance < 1 ? 4 : 2)}
                      </p>
                      <p className="text-[10px] text-ink-5">{sym}{fmtMoney(rawUnits)}/пункт</p>
                    </div>
                  </div>

                  {/* R:R + profit */}
                  {rrRatio > 0 && (
                    <>
                      <div className="h-px bg-stroke" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-2.5 text-center">
                          <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">Потенц. прибыль</p>
                          <p className="text-sm font-bold text-emerald-400">
                            +{sym}{fmtMoney(Math.max(0, potProfit))}
                          </p>
                          {commission > 0 && <p className="text-[10px] text-ink-5">с вычетом комис.</p>}
                        </div>
                        <div className={cn(
                          "rounded-lg border p-2.5 text-center",
                          rrRatio >= 2 ? "bg-emerald-500/8 border-emerald-500/20"
                            : rrRatio >= 1.5 ? "bg-amber-500/8 border-amber-500/20"
                            : "bg-red-500/8 border-red-500/20"
                        )}>
                          <p className="text-[10px] text-ink-5 uppercase tracking-wide mb-0.5">R/R</p>
                          <p className={cn("text-sm font-bold",
                            rrRatio >= 2 ? "text-emerald-400" : rrRatio >= 1.5 ? "text-amber-400" : "text-red-400"
                          )}>
                            1 : {rrRatio.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Visual R:R bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-ink-5">
                          <span>Риск</span>
                          <span>Прибыль</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden">
                          <div className="bg-red-500/60 rounded-l-full" style={{ flex: "1 0 0" }} />
                          <div className="w-px bg-card flex-shrink-0" />
                          <div className="bg-emerald-500/60 rounded-r-full" style={{ flex: `${rrRatio} 0 0` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-ink-5">
                          <span>−{sym}{fmtMoney(effectiveRisk)}</span>
                          <span>+{sym}{fmtMoney(Math.max(0, potProfit))}</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── Warnings ── */}
            {marginWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  Маржа ({sym}{fmtMoney(margin)}) превышает баланс. Нужно плечо x{Math.ceil(tradeValue / accountBalance)}.
                </p>
              </div>
            )}

            {riskPct > 2 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">
                  Риск {riskPct}% выше рекомендованного. Профессионалы рискуют 0.5–1% на сделку.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </Portal>
  );
}
