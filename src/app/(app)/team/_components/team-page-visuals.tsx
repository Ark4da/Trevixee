"use client";

import Link from "next/link";
import type React from "react";
import { ArrowRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualItem {
  icon: React.ElementType;
  title: string;
  text: string;
}

interface TeamPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  actions?: React.ReactNode;
}

export function TeamPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: TeamPageHeaderProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stroke bg-card">
      <div className="flex flex-wrap items-end justify-between gap-4 p-6">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="font-serif text-[40px] font-bold leading-none text-ink">
            {title}<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ink-5">
            {description}
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function TeamLoadingPanel({
  title = "Загружаю командные данные",
  description = "Проверяю workspace, права доступа и последние командные события.",
  cards = 4,
}: {
  title?: string;
  description?: string;
  cards?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stroke bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/20 bg-brand/10">
            <Clock3 className="h-5 w-5 animate-pulse text-brand" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[12px] text-ink-5">{description}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-stroke bg-card p-4">
            <div className="mb-3 h-3 w-20 rounded bg-tinted" />
            <div className="h-7 w-24 rounded bg-tinted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <p className="text-[13px] font-semibold text-ink">Не удалось загрузить данные</p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-ink-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-[12px] font-semibold text-red-300 transition-colors hover:bg-red-500/15"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Повторить
        </button>
      )}
    </div>
  );
}

export function TeamEmptyShowcase({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  icon: Icon,
  checklist,
  cards,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  icon: React.ElementType;
  checklist: string[];
  cards: VisualItem[];
}) {
  return (
    <div className="space-y-5 page-enter">
      <section className="overflow-hidden rounded-2xl border border-stroke bg-card">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-7">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand">
                <Icon className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h1 className="max-w-xl font-serif text-[40px] font-bold leading-none text-ink">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-4">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {secondaryHref && secondaryLabel && (
                <Link
                  href={secondaryHref}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-stroke bg-tinted px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-lift"
                >
                  {secondaryLabel}
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-tinted/45 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-5">
              Что проверить
            </p>
            <div className="space-y-2.5">
              {checklist.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-stroke bg-card px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" />
                  <span className="text-[12px] font-medium text-ink-3">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-stroke bg-card p-5">
            <card.icon className="mb-4 h-5 w-5 text-brand" />
            <h2 className="text-[14px] font-semibold text-ink">{card.title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-5">{card.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function TeamPillButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
        active
          ? "border-brand/35 bg-brand/10 text-brand"
          : "border-stroke bg-tinted text-ink-4 hover:bg-lift hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
