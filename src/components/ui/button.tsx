"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "link";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-brand text-white hover:bg-brand-hover shadow-[0_2px_8px_rgba(200,90,26,0.28)] hover:shadow-[0_4px_16px_rgba(200,90,26,0.38)] active:scale-[0.98]":
              variant === "default",
            "border border-stroke-2 bg-transparent text-ink-2 hover:bg-tinted hover:text-ink":
              variant === "outline",
            "bg-transparent text-ink-2 hover:bg-tinted hover:text-ink":
              variant === "ghost",
            "bg-red-600 text-white hover:bg-red-500": variant === "destructive",
            "bg-transparent text-brand hover:text-brand-hover underline-offset-4 hover:underline p-0":
              variant === "link",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
