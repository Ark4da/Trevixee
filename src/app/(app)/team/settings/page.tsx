"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import {
  SlidersHorizontal, Save, Trash2, AlertTriangle, Users2,
  Building2, ShieldOff, LogOut, Loader2, EyeOff, Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  memberCount: number;
  role: string;
}

const inputCls =
  "w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2.5 text-sm text-ink placeholder-ink-5 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20";

export default function TeamSettingsPage() {
  const { activeWorkspaceId, resolvingWorkspace } = useTeamWorkspace();
  const setActiveWorkspaceId = useAppStore((s) => s.setActiveWorkspaceId);
  const router = useRouter();
  const showToast = useToast();

  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Privacy settings
  const [hideAmounts, setHideAmounts] = useState(false);
  const [privacyDays, setPrivacyDays] = useState(0);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const fetchInfo = useCallback(async (wsId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}`);
      if (!res.ok) return;
      const data: WorkspaceInfo = await res.json();
      setInfo(data);
      setName(data.name);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setInfo(null); return; }
    fetchInfo(activeWorkspaceId);
  }, [activeWorkspaceId, fetchInfo]);

  useEffect(() => {
    fetch("/api/me/privacy")
      .then((r) => r.json())
      .then((d) => {
        setHideAmounts(d.hideAmountsInTeam ?? false);
        setPrivacyDays(d.privacyPeriodDays ?? 0);
      })
      .catch(() => {});
  }, []);

  async function handleSavePrivacy() {
    setSavingPrivacy(true);
    try {
      const payload: { hideAmountsInTeam: boolean; privacyPeriodDays?: number } = {
        hideAmountsInTeam: hideAmounts,
      };
      if (isOwner) payload.privacyPeriodDays = privacyDays;

      const res = await fetch("/api/me/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showToast("Failed to save privacy settings", "error"); return; }
      showToast("Privacy settings saved", "success");
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleSave() {
    if (!activeWorkspaceId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? "Failed to save", "error");
        return;
      }
      const updated = await res.json();
      setInfo((prev) => prev ? { ...prev, name: updated.name } : prev);
      showToast("Workspace name updated", "success");
    } finally {
      setSaving(false);
    }
  }

  async function handleLeave() {
    if (!activeWorkspaceId || !info) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/leave`, { method: "POST" });
      if (res.status === 204 || res.ok) {
        setActiveWorkspaceId(null);
        showToast("You have left the workspace", "info");
        router.push("/dashboard");
      } else {
        const d = await res.json();
        showToast(d.error ?? "Failed to leave workspace", "error");
      }
    } catch {
      showToast("Failed to leave workspace", "error");
    } finally {
      setLeaving(false);
      setConfirmLeave(false);
    }
  }

  async function handleDelete() {
    if (!activeWorkspaceId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, { method: "DELETE" });
      if (res.status === 204 || res.ok) {
        setActiveWorkspaceId(null);
        showToast("Workspace deleted", "info");
        router.push("/dashboard");
      } else {
        const d = await res.json();
        showToast(d.error ?? "Failed to delete", "error");
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center page-enter">
        <Users2 className="h-14 w-14 text-ink-5 mb-4" />
        <h3 className="text-[15px] font-semibold text-ink mb-1.5">No team selected</h3>
        <p className="text-[13px] text-ink-3 max-w-xs leading-relaxed">
          Switch to a team workspace in the sidebar to access settings.
        </p>
      </div>
    );
  }

  const isOwner = info?.role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-5 page-enter">
      {/* Header */}
      <div className="pt-2 pb-5 border-b border-stroke">
        <p className="editorial-label">Team</p>
        <h1 className="font-serif text-[36px] leading-[0.98] tracking-[-0.03em] font-bold mt-2">
          Workspace Settings<span className="text-brand">.</span>
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-5">
          Compact controls for workspace identity, member visibility, and ownership actions.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-5 w-40 rounded bg-tinted" />
          <div className="h-10 w-full rounded-lg bg-tinted" />
          <div className="h-10 w-32 rounded-lg bg-tinted" />
        </div>
      ) : (
        <>
          {/* Workspace info */}
          <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep space-y-4 anim-fade-up">
            <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand" />
              Workspace
            </h2>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Slug</p>
                <p className="mt-2 truncate text-[13px] font-semibold text-ink jb-mono">{info?.slug ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Members</p>
                <p className="mt-2 font-serif text-[24px] font-bold leading-none tracking-tight text-brand tnum">{info?.memberCount ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Role</p>
                <p className="mt-2 text-[13px] font-semibold capitalize text-ink">{info?.role ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-stroke bg-tinted/45 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Seats</p>
                <p className="mt-2 font-serif text-[24px] font-bold leading-none tracking-tight text-ink tnum">50</p>
              </div>
            </div>
          </div>

          {/* Privacy settings — all members */}
          <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep space-y-4 anim-fade-up delay-100">
            <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-ink-4" />
              My team privacy
            </h2>
            <p className="text-[12px] text-ink-4 leading-relaxed">
              Control how your trading numbers appear across team views.
            </p>

            {/* Hide amounts toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-ink">Hide dollar amounts</p>
                <p className="text-[11px] text-ink-5 mt-0.5">
                  Your P/L and trade values are hidden in team feed and analytics. R-multiples remain visible.
                </p>
              </div>
              <button
                onClick={() => setHideAmounts((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${hideAmounts ? "bg-brand" : "bg-tinted border border-stroke-2"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hideAmounts ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {isOwner && (
              <div className="space-y-2 rounded-xl border border-stroke bg-tinted/35 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">New member privacy window</p>
                    <p className="text-[11px] text-ink-5 mt-0.5">
                      New invited members stay hidden from team analytics, feed, and journal for this many days after accepting the invite.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={privacyDays}
                      onChange={(e) => setPrivacyDays(Math.min(90, Math.max(0, Number(e.target.value))))}
                      className="w-16 h-9 rounded-lg border border-stroke-2 bg-card px-2 text-center text-[13px] text-ink outline-none focus:border-brand transition-colors"
                    />
                    <span className="text-[12px] text-ink-5">days</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSavePrivacy}
                disabled={savingPrivacy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
              >
                {savingPrivacy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                {savingPrivacy ? "Saving..." : "Save privacy"}
              </button>
              <span className="text-[11px] text-ink-5">
                {hideAmounts ? "Amounts hidden from team" : "Amounts visible"}
                {isOwner && privacyDays > 0 ? ` · ${privacyDays}d new-member window` : ""}
              </span>
            </div>
          </div>

          {/* Rename — owner only */}
          {isOwner && (
            <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep space-y-4 anim-fade-up delay-100">
              <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-ink-4" />
                Workspace name
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  maxLength={60}
                  placeholder="Workspace name"
                  className={inputCls}
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || name.trim() === info?.name}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Danger zone — owner only */}
          {isOwner && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 space-y-4 anim-fade-up delay-200">
              <h2 className="text-[13px] font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger zone
              </h2>

              {!confirmDelete ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Delete workspace</p>
                    <p className="text-[12px] text-ink-4 mt-0.5">
                      Permanently delete this workspace and remove all members. Your personal trades and data are not affected.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3.5 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-[13px] font-semibold text-red-400 mb-3">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-stroke px-4 py-2 text-[12px] font-medium text-ink-3 hover:text-ink hover:bg-tinted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-owner: leave workspace */}
          {!isOwner && (
            <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep anim-fade-up delay-100">
              <h2 className="text-[13px] font-semibold text-ink mb-3 flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-ink-4" />
                Leave workspace
              </h2>
              <p className="text-[12px] text-ink-4 mb-4">
                You will lose access to the team feed, leaderboard, and team content.
                Your personal trades and data are not affected.
              </p>

              {!confirmLeave ? (
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stroke px-3.5 py-2 text-[12px] font-medium text-ink-3 hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave workspace
                </button>
              ) : (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-[13px] font-semibold text-red-400 mb-3">
                    Leave «{info?.name}»? You&apos;ll need an invite to rejoin.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLeave}
                      disabled={leaving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      {leaving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <LogOut className="h-3.5 w-3.5" />}
                      {leaving ? "Leaving..." : "Yes, leave"}
                    </button>
                    <button
                      onClick={() => setConfirmLeave(false)}
                      className="rounded-lg border border-stroke px-4 py-2 text-[12px] font-medium text-ink-3 hover:text-ink hover:bg-tinted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
