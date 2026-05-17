"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Upload, FileSpreadsheet, Check } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { useT } from "@/lib/useT";

const brokers = [
  "MetaTrader 4", "MetaTrader 5", "NinjaTrader", "Interactive Brokers", "TradingView",
  "Tradovate", "thinkorswim", "TradeLocker", "cTrader", "OANDA", "Rithmic",
  "Sierra Chart", "DXtrade", "TopstepX",
];

interface ImportModalProps { isOpen: boolean; onClose: () => void; }

export function ImportTradesModal({ isOpen, onClose }: ImportModalProps) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [broker, setBroker] = useState("");
  const [file, setFile] = useState<string>("");

  if (!isOpen) return null;

  return (
    <Portal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm anim-backdrop" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-stroke bg-card p-6 shadow-2xl anim-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-ink">{t("import_title")}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:text-ink transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                step >= s ? "bg-brand text-white" : "bg-tinted text-ink-4"
              )}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={cn("h-0.5 flex-1", step > s ? "bg-brand" : "bg-stroke-2")} />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3 mb-4">{t("import_select_broker")}</p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {brokers.map((b) => (
                <button key={b} onClick={() => { setBroker(b); setStep(2); }}
                  className={cn("rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
                    broker === b ? "border-brand bg-brand/10 text-brand-hover" : "border-stroke-2 text-ink-3 hover:border-brand/50 hover:text-ink"
                  )}>{b}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-3">Upload your trade file from <span className="text-brand">{broker}</span></p>
            <div className="rounded-xl border-2 border-dashed border-stroke-2 bg-tinted p-8 text-center hover:border-brand/50 transition-colors cursor-pointer">
              <Upload className="h-10 w-10 text-ink-4 mx-auto mb-3" />
              <p className="text-sm text-ink-3 mb-1">{t("import_drag_drop")}</p>
              <p className="text-xs text-ink-5">or click to browse</p>
              <p className="text-xs text-ink-5 mt-2">{t("import_supports")}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-stroke-2 py-2 text-sm text-ink-3 hover:text-ink transition-colors">Back</button>
              <button onClick={() => { setFile("trades.csv"); setStep(3); }} className="flex-1 rounded-lg bg-brand py-2 text-sm text-white hover:bg-brand transition-colors">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-3">{t("import_review")}</p>
            <div className="rounded-lg border border-stroke-2 bg-tinted p-4 space-y-2">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-brand" />
                <div>
                  <p className="text-sm text-ink font-medium">trades.csv</p>
                  <p className="text-xs text-ink-4">24 trades found • {broker}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-stroke-2 bg-tinted p-3">
              <div className="flex justify-between text-sm"><span className="text-ink-3">{t("import_total_trades")}</span><span className="text-ink">24</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-ink-3">{t("import_date_range")}</span><span className="text-ink">Mar 1 - Mar 31, 2026</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-ink-3">{t("import_symbols")}</span><span className="text-ink">ES, NQ, EUR/USD</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-stroke-2 py-2 text-sm text-ink-3 hover:text-ink transition-colors">Back</button>
              <button onClick={onClose} className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-deep py-2 text-sm text-white hover:from-brand-hover hover:to-brand transition-all shadow-lg shadow-brand/25">{t("import_title")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}
