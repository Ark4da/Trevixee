"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { useT } from "@/lib/useT";

interface TradeRow {
  id: number; date: string; symbol: string; side: "long" | "short"; entry: number; exit: number;
  qty: number; pnl: number; netPnl: number; rMultiple: number; duration: string;
  setup: string; rating: number; market: string; notes: string; tags: string[];
}

const mockTrades: TradeRow[] = [
  { id: 1, date: "2026-04-02 09:35", symbol: "ES", side: "long", entry: 5245.50, exit: 5258.75, qty: 2, pnl: 1325.00, netPnl: 1315.80, rMultiple: 2.1, duration: "45m", setup: "Breakout", rating: 5, market: "futures", notes: "Clean breakout of opening range", tags: ["A+ Setup", "Morning"] },
  { id: 2, date: "2026-04-02 10:15", symbol: "NQ", side: "short", entry: 18320.00, exit: 18285.00, qty: 1, pnl: 700.00, netPnl: 690.80, rMultiple: 1.8, duration: "22m", setup: "Reversal", rating: 4, market: "futures", notes: "Reversal at resistance", tags: ["Reversal"] },
  { id: 3, date: "2026-04-01 14:20", symbol: "EUR/USD", side: "long", entry: 1.0845, exit: 1.0812, qty: 100000, pnl: -330.00, netPnl: -335.20, rMultiple: -1.0, duration: "1h 15m", setup: "Pullback", rating: 2, market: "forex", notes: "Chased entry, should have waited", tags: ["Mistake"] },
  { id: 4, date: "2026-04-01 09:45", symbol: "ES", side: "long", entry: 5230.00, exit: 5248.25, qty: 2, pnl: 1825.00, netPnl: 1815.80, rMultiple: 2.8, duration: "55m", setup: "Trend Following", rating: 5, market: "futures", notes: "Trend day, held for bigger move", tags: ["A+ Setup", "Trend Day"] },
  { id: 5, date: "2026-03-31 11:30", symbol: "GBP/USD", side: "short", entry: 1.2645, exit: 1.2678, qty: 100000, pnl: -330.00, netPnl: -335.20, rMultiple: -1.1, duration: "40m", setup: "Range", rating: 2, market: "forex", notes: "Range failed, stop hit", tags: ["Failed Setup"] },
  { id: 6, date: "2026-03-31 09:50", symbol: "NQ", side: "long", entry: 18150.00, exit: 18195.00, qty: 1, pnl: 900.00, netPnl: 890.80, rMultiple: 2.3, duration: "35m", setup: "Breakout", rating: 4, market: "futures", notes: "Opening range breakout", tags: ["Morning"] },
  { id: 7, date: "2026-03-28 10:05", symbol: "ES", side: "short", entry: 5275.00, exit: 5262.50, qty: 2, pnl: 1250.00, netPnl: 1240.80, rMultiple: 1.9, duration: "28m", setup: "Reversal", rating: 4, market: "futures", notes: "Failed new highs reversal", tags: ["Reversal"] },
  { id: 8, date: "2026-03-28 13:15", symbol: "EUR/USD", side: "long", entry: 1.0790, exit: 1.0825, qty: 100000, pnl: 350.00, netPnl: 344.80, rMultiple: 1.4, duration: "2h", setup: "Trend Following", rating: 3, market: "forex", notes: "Rode the trend", tags: ["Swing"] },
  { id: 9, date: "2026-03-27 09:40", symbol: "NQ", side: "short", entry: 18400.00, exit: 18430.00, qty: 1, pnl: -600.00, netPnl: -609.20, rMultiple: -1.5, duration: "15m", setup: "Scalp", rating: 1, market: "futures", notes: "Impulsive trade, no real setup", tags: ["Mistake", "Revenge"] },
  { id: 10, date: "2026-03-27 10:30", symbol: "ES", side: "long", entry: 5220.00, exit: 5235.50, qty: 2, pnl: 1550.00, netPnl: 1540.80, rMultiple: 2.4, duration: "42m", setup: "Pullback", rating: 5, market: "futures", notes: "Perfect pullback to VWAP", tags: ["A+ Setup", "VWAP"] },
  { id: 11, date: "2026-03-26 09:35", symbol: "ES", side: "long", entry: 5200.00, exit: 5210.25, qty: 2, pnl: 1025.00, netPnl: 1015.80, rMultiple: 1.6, duration: "30m", setup: "Breakout", rating: 4, market: "futures", notes: "Clean ORB", tags: ["Morning"] },
  { id: 12, date: "2026-03-26 11:00", symbol: "CL", side: "short", entry: 78.50, exit: 79.20, qty: 1, pnl: -700.00, netPnl: -709.20, rMultiple: -1.8, duration: "50m", setup: "Range", rating: 2, market: "futures", notes: "Oil squeezed higher", tags: ["Mistake"] },
];

export function TradeTable() {
  const tx = useT();
  const [sortField, setSortField] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 inline-block">
      {sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />) : null}
    </span>
  );

  const totalPages = Math.ceil(mockTrades.length / perPage);
  const paginated = mockTrades.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="rounded-xl border border-stroke bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-tinted">
              {[
                { key: "date", label: "Date" },
                { key: "symbol", label: "Symbol" },
                { key: "side", label: "Side" },
                { key: "entry", label: "Entry" },
                { key: "exit", label: "Exit" },
                { key: "qty", label: "Qty" },
                { key: "pnl", label: "P/L" },
                { key: "rMultiple", label: "R" },
                { key: "duration", label: "Duration" },
                { key: "setup", label: "Setup" },
                { key: "rating", label: "Rating" },
              ].map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="px-4 py-3 text-left text-xs font-medium text-ink-4 uppercase tracking-wider cursor-pointer hover:text-ink-2 transition-colors whitespace-nowrap">
                  {col.label}<SortIcon field={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((t) => (
              <React.Fragment key={t.id}>
                <tr onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="border-b border-stroke/50 hover:bg-tinted transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-ink-3 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3 font-medium text-ink">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", t.side === "long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{t.entry.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-ink-2">{t.exit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-ink-2">{t.qty}</td>
                  <td className={cn("px-4 py-3 font-medium", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className={cn("px-4 py-3 font-medium", t.rMultiple >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {t.rMultiple >= 0 ? "+" : ""}{t.rMultiple.toFixed(1)}R
                  </td>
                  <td className="px-4 py-3 text-ink-3">{t.duration}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-brand/20 text-brand-hover px-2 py-0.5 text-xs">{t.setup}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("h-3 w-3", s <= t.rating ? "fill-amber-400 text-amber-400" : "text-ink-5")} />
                      ))}
                    </div>
                  </td>
                </tr>
                {expandedId === t.id && (
                  <tr className="bg-tinted">
                    <td colSpan={11} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-ink-4 mb-1">Notes</p>
                          <p className="text-sm text-ink-2">{t.notes}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-4 mb-1">Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {t.tags.map((tag) => (
                              <span key={tag} className="rounded-md bg-tinted border border-stroke-2 px-2 py-0.5 text-xs text-ink-3">{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-ink-4 mb-1">P/L Breakdown</p>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-ink-3">{tx("trade_gross_pl")}</span><span className={t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>${t.pnl.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-ink-3">Fees</span><span className="text-red-400">-${(t.pnl - t.netPnl).toFixed(2)}</span></div>
                            <div className="flex justify-between border-t border-stroke-2 pt-1"><span className="text-ink-2 font-medium">{tx("trade_net_pl")}</span><span className={cn("font-medium", t.netPnl >= 0 ? "text-emerald-400" : "text-red-400")}>${t.netPnl.toFixed(2)}</span></div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-stroke px-4 py-3">
        <span className="text-sm text-ink-4">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, mockTrades.length)} of {mockTrades.length}</span>
        <div className="flex gap-1">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg px-3 py-1 text-sm text-ink-3 hover:bg-tinted disabled:opacity-50 transition-colors">Prev</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)} className={cn("rounded-lg px-3 py-1 text-sm transition-colors", page === i + 1 ? "bg-brand text-white" : "text-ink-3 hover:bg-tinted")}>{i + 1}</button>
          ))}
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1 text-sm text-ink-3 hover:bg-tinted disabled:opacity-50 transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
}
