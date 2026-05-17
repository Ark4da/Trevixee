"use client";

import type React from "react";
import { cn } from "@/lib/utils";

const MEMBER_PALETTES = [
  { bg: "rgba(240,114,64,0.12)", border: "rgba(240,114,64,0.24)", text: "#D9845E", soft: "rgba(240,114,64,0.055)" },
  { bg: "rgba(148,148,174,0.14)", border: "rgba(148,148,174,0.22)", text: "#AAA6BE", soft: "rgba(148,148,174,0.045)" },
  { bg: "rgba(123,175,138,0.12)", border: "rgba(123,175,138,0.22)", text: "#8DBA98", soft: "rgba(123,175,138,0.045)" },
  { bg: "rgba(172,90,86,0.12)", border: "rgba(172,90,86,0.22)", text: "#BC7975", soft: "rgba(172,90,86,0.045)" },
  { bg: "rgba(176,169,158,0.12)", border: "rgba(176,169,158,0.20)", text: "#B0A99E", soft: "rgba(176,169,158,0.04)" },
  { bg: "rgba(240,114,64,0.10)", border: "rgba(240,114,64,0.20)", text: "#C77A59", soft: "rgba(240,114,64,0.045)" },
  { bg: "rgba(122,112,104,0.15)", border: "rgba(122,112,104,0.24)", text: "#B7A99E", soft: "rgba(122,112,104,0.045)" },
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function memberInitials(name?: string | null): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return "TR";
}

export function getMemberIdentity(seed?: string | null, name?: string | null) {
  const key = seed || name || "team-member";
  const palette = MEMBER_PALETTES[hashSeed(key) % MEMBER_PALETTES.length];

  return {
    ...palette,
    initials: memberInitials(name || key),
  };
}

export function MemberAvatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name?: string | null;
  seed?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const identity = getMemberIdentity(seed, name);
  const sizeClass = {
    sm: "h-6 w-6 text-[9px]",
    md: "h-8 w-8 text-[10px]",
    lg: "h-11 w-11 text-[12px]",
  }[size];

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center rounded-full border font-bold", sizeClass, className)}
      style={{
        background: identity.bg,
        borderColor: identity.border,
        color: identity.text,
      }}
      aria-label={name ?? "Team member"}
    >
      {identity.initials}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card"
        style={{ background: identity.text }}
      />
    </div>
  );
}

export function MemberDot({
  name,
  seed,
  className,
}: {
  name?: string | null;
  seed?: string | null;
  className?: string;
}) {
  const identity = getMemberIdentity(seed, name);

  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ background: identity.text }}
      aria-hidden="true"
    />
  );
}

export function MemberAccentPanel({
  seed,
  name,
  children,
  className,
  ...props
}: {
  seed?: string | null;
  name?: string | null;
  children: React.ReactNode;
  className?: string;
} & React.ComponentPropsWithoutRef<"div">) {
  const identity = getMemberIdentity(seed, name);

  return (
    <div
      {...props}
      className={cn("relative overflow-hidden", className)}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: identity.border }} />
      <div
        className="absolute inset-0 opacity-70"
        style={{ background: `linear-gradient(135deg, ${identity.soft}, transparent 42%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
