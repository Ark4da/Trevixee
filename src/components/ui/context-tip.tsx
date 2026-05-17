"use client";
import React, { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { Lightbulb } from "lucide-react";

interface ContextTipProps {
  /** Storage key — tip показывается только один раз */
  id: string;
  /** Текст подсказки */
  message: string;
  /** Delay перед показом (ms) */
  delay?: number;
  /** Trigger condition — если false, не показывать */
  condition?: boolean;
}

/**
 * P1.5-35: Contextual education layer — ContextTip
 * Показывает toast-подсказку один раз (на основе localStorage).
 * Рендери его внутри компонента, где нужен trigger.
 */
export function ContextTip({ id, message, delay = 1500, condition = true }: ContextTipProps) {
  const toast = useToast();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!condition || shownRef.current) return;
    const key = `tz-tip-${id}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch { /* noop */ }

    shownRef.current = true;
    const timer = setTimeout(() => {
      toast(`💡 ${message}`, "info");
      try { localStorage.setItem(key, "1"); } catch { /* noop */ }
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition]);

  return null;
}

/** Inline hint card — показывается внутри страницы */
export function InlineHint({ message, icon: Icon = Lightbulb }: {
  message: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3">
      <Icon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-ink-3 leading-relaxed">{message}</p>
    </div>
  );
}
