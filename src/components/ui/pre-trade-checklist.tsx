"use client";
/**
 * Pre-trade checklist (P1.5-32)
 *
 * Two modes:
 *  1. Inline widget — shows checklist progress on Dashboard
 *  2. Modal — appears when user clicks "New Trade" if any items unchecked
 *
 * Checklist items are stored in localStorage (user-configurable in future).
 * Checked state persists per calendar day (auto-resets at midnight).
 */
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ClipboardList, X, AlertTriangle } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { useT } from "@/lib/useT";

const DEFAULT_ITEMS = [
  "Рынок открыт и ликвиден",
  "Сетап соответствует плейбуку",
  "Риск не превышает дневной лимит",
  "Стоп-лосс выставлен до входа",
  "Нет новостей с высокой волатильностью",
  "Эмоциональное состояние — нейтральное или лучше",
];

const LS_ITEMS_KEY = "checklist_items_v1";
const LS_STATE_KEY = "checklist_state_v1";

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function loadItems(): string[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return DEFAULT_ITEMS;
}

function loadState(items: string[]): boolean[] {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    if (raw) {
      const { date, state } = JSON.parse(raw) as { date: string; state: boolean[] };
      if (date === todayKey() && Array.isArray(state) && state.length === items.length) return state;
    }
  } catch {}
  return items.map(() => false);
}

function saveState(state: boolean[]) {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify({ date: todayKey(), state }));
  } catch {}
}

/* ── Inline widget (for Dashboard) ─────────────────────────────────────────── */
export function PreTradeChecklistWidget() {
  const t = useT();
  const [items, setItems]       = useState<string[]>([]);
  const [checked, setChecked]   = useState<boolean[]>([]);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const its = loadItems();
      setItems(its);
      setChecked(loadState(its));
      setMounted(true);
    });
  }, []);

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[i] = !next[i];
      saveState(next);
      return next;
    });
  };

  if (!mounted || items.length === 0) return null;

  const doneCount  = checked.filter(Boolean).length;
  const allDone    = doneCount === items.length;
  const pct        = Math.round((doneCount / items.length) * 100);

  return (
    <div className="rounded-2xl border border-stroke bg-card shadow-deep p-5 relative overflow-hidden">
      {/* top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: allDone ? "#22C55E" : "rgba(255,255,255,0.06)" }} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="editorial-label flex items-center gap-1.5">
            <ClipboardList className="h-3 w-3" /> Pre-trade checklist
          </p>
          <p className="text-[11px] text-ink-5 mt-0.5">
            {allDone
              ? t("checklist_ready")
              : `${doneCount} / ${items.length} ${t("checklist_done")}`}
          </p>
        </div>
        <div className="relative h-10 w-10">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={allDone ? "#22C55E" : "var(--color-brand)"}
              strokeWidth="3"
              strokeDasharray={`${pct * 0.942} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-ink-3">
            {pct}%
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-xs",
              checked[i] ? "text-ink-4 line-through" : "text-ink-2 hover:bg-lift"
            )}
          >
            <div className={cn(
              "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
              checked[i] ? "bg-[#22C55E]/20 border-[#22C55E]/50" : "border-stroke-2 hover:border-brand/50"
            )}>
              {checked[i] && <Check className="h-2.5 w-2.5 text-[#22C55E]" />}
            </div>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Modal (shown before Add Trade if checklist incomplete) ─────────────────── */
interface PreTradeChecklistModalProps {
  onProceed: () => void;
  onCancel: () => void;
}

export function PreTradeChecklistModal({ onProceed, onCancel }: PreTradeChecklistModalProps) {
  const t = useT();
  const [items, setItems]     = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const its = loadItems();
      setItems(its);
      setChecked(loadState(its));
    });
  }, []);

  const toggle = useCallback((i: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[i] = !next[i];
      saveState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const doneCount = checked.filter(Boolean).length;
  const allDone   = doneCount === items.length;
  const unchecked = items.length - doneCount;

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm anim-backdrop" onClick={onCancel} />
        <div className="relative w-full max-w-md rounded-2xl border border-stroke bg-card shadow-2xl overflow-hidden anim-scale-in">

          <div className="flex items-center justify-between px-5 py-4 border-b border-stroke">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-brand/15 flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Pre-trade checklist</h2>
                <p className="text-xs text-ink-4">{t("checklist_before_trade")}</p>
              </div>
            </div>
            <button onClick={onCancel} className="rounded-lg p-1.5 text-ink-4 hover:text-ink hover:bg-tinted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-2">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                  checked[i]
                    ? "border-[#22C55E]/30 bg-[#22C55E]/8 text-ink-4"
                    : "border-stroke-2 bg-tinted hover:border-stroke text-ink-2"
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
                  checked[i] ? "bg-[#22C55E]/20 border-[#22C55E]/50" : "border-stroke-2"
                )}>
                  {checked[i] && <Check className="h-2.5 w-2.5 text-[#22C55E]" />}
                </div>
                <span className={cn("text-sm", checked[i] && "line-through")}>{item}</span>
              </button>
            ))}
          </div>

          {!allDone && unchecked > 0 && (
            <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                {unchecked} {t("checklist_unchecked")}
              </p>
            </div>
          )}

          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg border border-stroke-2 py-2.5 text-sm text-ink-3 hover:bg-tinted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              onClick={onProceed}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                allDone
                  ? "bg-[#22C55E]/90 hover:bg-[#22C55E] text-white"
                  : "bg-brand hover:bg-brand-hover text-white"
              )}
            >
              {allDone ? t("checklist_proceed_ready") : t("checklist_proceed_anyway")}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
