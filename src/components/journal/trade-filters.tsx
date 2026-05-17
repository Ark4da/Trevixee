"use client";
import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/useT";

export function TradeFilters({ onFilterChange }: { onFilterChange?: (filters: Record<string, string>) => void }) {
  const t = useT();
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("all");
  const [market, setMarket] = useState("all");
  const [setup, setSetup] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const clearFilters = () => {
    setSymbol(""); setSide("all"); setMarket("all"); setSetup("all"); setDateFrom(""); setDateTo("");
  };

  const selCls = "rounded-lg border border-stroke-2 bg-tinted px-3 py-1.5 text-sm text-ink-2 focus:border-brand focus:outline-none";
  const inputCls = "h-8 rounded-lg border border-stroke-2 bg-tinted px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-card p-4">
      {/* Symbol search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
        <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={t("common_symbol") + "..."} className={`${inputCls} pl-8 w-32`} />
      </div>

      {/* Date range */}
      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputCls} w-36`} />
      <span className="text-ink-4 text-sm">to</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputCls} w-36`} />

      {/* Side */}
      <select value={side} onChange={(e) => setSide(e.target.value)} className={selCls}>
        <option value="all">{t("common_all_sides")}</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>

      {/* Market */}
      <select value={market} onChange={(e) => setMarket(e.target.value)} className={selCls}>
        <option value="all">{t("common_all_markets")}</option>
        <option value="futures">{t("common_futures")}</option>
        <option value="forex">Forex</option>
        <option value="stocks">{t("common_stocks")}</option>
        <option value="crypto">{t("common_crypto")}</option>
        <option value="options">{t("common_options")}</option>
      </select>

      {/* Setup */}
      <select value={setup} onChange={(e) => setSetup(e.target.value)} className={selCls}>
        <option value="all">{t("common_all_setups")}</option>
        <option value="breakout">{t("setup_breakout")}</option>
        <option value="pullback">{t("setup_pullback")}</option>
        <option value="reversal">{t("setup_reversal")}</option>
        <option value="trend">{t("setup_trend_following")}</option>
        <option value="scalp">Scalp</option>
        <option value="range">Range</option>
      </select>

      {/* Clear */}
      <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-ink-3 hover:text-ink hover:bg-tinted transition-colors">
        <X className="h-3.5 w-3.5" /> Clear
      </button>
    </div>
  );
}
