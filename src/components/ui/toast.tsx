"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const icons = {
    success: <Check className="h-4 w-4 text-emerald-400 shrink-0" />,
    error: <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />,
    info: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
  };

  const borders = {
    success: "border-emerald-500/30",
    error: "border-red-500/30",
    info: "border-blue-500/30",
    warning: "border-amber-500/30",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg min-w-[260px] max-w-sm",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        borders[toast.type],
        visible ? "opacity-100 translate-x-0 translate-y-0" : "opacity-0 translate-x-4 translate-y-1"
      )}
    >
      {icons[toast.type]}
      <span className="text-sm text-ink flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-ink-4 hover:text-ink-2 transition-colors ml-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}
