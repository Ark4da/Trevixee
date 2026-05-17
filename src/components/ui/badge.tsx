"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "danger" | "warning" | "outline";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        {
          "bg-brand/20 text-brand-hover": variant === "default",
          "bg-emerald-500/20 text-emerald-400": variant === "success",
          "bg-red-500/20 text-red-400": variant === "danger",
          "bg-amber-500/20 text-amber-400": variant === "warning",
          "border border-stroke-2 text-ink-3": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };
