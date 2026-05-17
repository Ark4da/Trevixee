"use client";
import React from "react";
import { Lock } from "lucide-react";
import { useT } from "@/lib/useT";
import { cn } from "@/lib/utils";

export type PaywallFeature =
  | "csv_import"
  | "broker_import"
  | "mae_mfe"
  | "advanced_reports"
  | "time_heatmap"
  | "advanced_backtesting"
  | "custom_date_range"
  | "ai_trade_review"
  | "tradingview_webhook"
  | "advanced_alerts"
  | "export_data"
  | "workspace"
  | "multi_account";

export type PaywallRequired = "pro" | "team";

interface PaywallCardProps {
  feature: PaywallFeature;
  required?: PaywallRequired;
  title?: string;
  body?: string;
  inline?: boolean;
  blur?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const FEATURE_KEYS: Record<PaywallFeature, { title: string; body: string; required: PaywallRequired }> = {
  csv_import:           { title: "paywall_csv_title",         body: "paywall_csv_body",         required: "pro"  },
  broker_import:        { title: "paywall_broker_title",       body: "paywall_broker_body",       required: "pro"  },
  mae_mfe:              { title: "paywall_maemfe_title",       body: "paywall_maemfe_body",       required: "pro"  },
  advanced_reports:     { title: "paywall_reports_title",      body: "paywall_reports_body",      required: "pro"  },
  time_heatmap:         { title: "paywall_heatmap_title",      body: "paywall_heatmap_body",      required: "pro"  },
  advanced_backtesting: { title: "paywall_backtesting_title",  body: "paywall_backtesting_body",  required: "pro"  },
  custom_date_range:    { title: "paywall_daterange_title",    body: "paywall_daterange_body",    required: "pro"  },
  ai_trade_review:      { title: "paywall_ai_title",           body: "paywall_ai_body",           required: "pro"  },
  tradingview_webhook:  { title: "paywall_webhook_title",      body: "paywall_webhook_body",      required: "pro"  },
  advanced_alerts:      { title: "paywall_alerts_title",       body: "paywall_alerts_body",       required: "pro"  },
  export_data:          { title: "paywall_export_title",       body: "paywall_export_body",       required: "pro"  },
  workspace:            { title: "paywall_workspace_title",    body: "paywall_workspace_body",    required: "team" },
  multi_account:        { title: "paywall_multiaccount_title", body: "paywall_multiaccount_body", required: "pro"  },
};

/**
 * Universal soft-paywall component.
 *
 * Inline card:   <PaywallCard feature="csv_import" />
 * Blur overlay:  <PaywallCard feature="mae_mfe" blur><LockedWidget /></PaywallCard>
 */
export function PaywallCard({
  feature,
  required,
  title,
  body,
  inline = false,
  blur = false,
  children,
  className,
}: PaywallCardProps) {
  const t = useT();

  const meta      = FEATURE_KEYS[feature];
  const req       = required ?? meta.required;
  const titleStr  = title ?? t(meta.title as Parameters<typeof t>[0]);
  const bodyStr   = body  ?? t(meta.body  as Parameters<typeof t>[0]);
  const ctaKey    = req === "pro" ? "paywall_cta_pro"    : "paywall_cta_team";
  const badgeKey  = req === "pro" ? "paywall_pro_title"  : "paywall_team_title";
  const badgeBg   = req === "pro" ? "rgba(240,114,64,0.12)" : "rgba(99,102,241,0.12)";
  const badgeClr  = req === "pro" ? "var(--color-brand)" : "#6366F1";

  const card = (
    <div
      className={cn(
        "rounded-xl border border-stroke bg-tinted flex flex-col gap-3 p-4",
        inline && "border-dashed",
        !blur && className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: badgeBg }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: badgeClr }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-[13px] font-semibold text-ink leading-tight">{titleStr}</p>
            <span
              className="chip text-[9px] shrink-0"
              style={{ background: badgeBg, color: badgeClr, padding: "2px 7px" }}
            >
              {t(badgeKey as Parameters<typeof t>[0])}
            </span>
          </div>
          <p className="text-[12px] text-ink-4 leading-relaxed">{bodyStr}</p>
        </div>
      </div>

      <a
        href="/pricing"
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-90"
        style={{ background: "var(--color-brand)", color: "#fff" }}
      >
        {t(ctaKey as Parameters<typeof t>[0])}
      </a>
    </div>
  );

  if (blur && children) {
    return (
      <div className={cn("relative", className)}>
        <div className="pointer-events-none select-none" style={{ filter: "blur(5px)", opacity: 0.35 }}>
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">{card}</div>
        </div>
      </div>
    );
  }

  return card;
}
