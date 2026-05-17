"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { cn } from "@/lib/utils";
import {
  Users, Mail, Send, Trash2, Crown, BookOpen, UserRound,
  Plus, X, Clock, Users2, ChevronRight, Search,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  TeamEmptyShowcase,
  TeamLoadingPanel,
} from "../_components/team-page-visuals";
import { MemberAvatar } from "../_components/member-identity";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

const MEMBER_ROW_COLUMNS = "minmax(220px,1fr) 9rem 7rem 6.5rem";

function RoleChip({ role }: { role: string }) {
  const cfg = {
    owner:  { bg: "rgba(251,191,36,0.10)", color: "#F59E0B", label: "Owner",  icon: Crown },
    mentor: { bg: "rgba(99,102,241,0.10)",  color: "#6366F1", label: "Mentor", icon: BookOpen },
    member: { bg: "rgba(148,148,174,0.08)", color: "#9494AE", label: "Member", icon: UserRound },
  }[role] ?? { bg: "rgba(148,148,174,0.08)", color: "#9494AE", label: role, icon: UserRound };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function RosterStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "text-ink",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-card p-4 shadow-deep">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">{label}</p>
      </div>
      <p className={cn("font-serif text-[28px] font-bold leading-none tracking-tight tnum", tone)}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-ink-5">{hint}</p>
    </div>
  );
}

export default function TeamMembersPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const router = useRouter();
  const { data: session } = useSession();
  const showToast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<string>("member");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const sessionUserId = session?.user?.id ?? null;
  const isOwner = myRole === "owner";
  const mentorCount = members.filter((member) => member.role === "mentor").length;
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const visibleMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
  });

  const fetchAll = useCallback(async (wsId: string, viewerId: string | null) => {
    setLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        fetch(`/api/workspaces/${wsId}/members`),
        fetch(`/api/workspaces/${wsId}/invites`),
      ]);
      if (mRes.ok) {
        const mData: Member[] = await mRes.json();
        setMembers(mData);
        if (viewerId) {
          const me = mData.find((m) => m.userId === viewerId);
          setMyRole(me?.role ?? "member");
        }
      }
      if (iRes.ok) setInvites(await iRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) { setMembers([]); setInvites([]); setMyRole("member"); return; }
    fetchAll(activeWorkspaceId, sessionUserId);
  }, [activeWorkspaceId, sessionUserId, fetchAll]);

  async function handleInvite() {
    if (!activeWorkspaceId || !inviteEmail.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to send invite", "error"); return; }
      showToast(`Invite sent to ${inviteEmail}`, "success");
      setInvites((prev) => [data, ...prev]);
      setInviteEmail("");
      setShowInviteForm(false);
    } finally {
      setSending(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!activeWorkspaceId) return;
    try {
      await fetch(`/api/workspaces/${activeWorkspaceId}/invites/${inviteId}`, { method: "DELETE" });
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      showToast("Invite revoked", "info");
    } catch { showToast("Failed to revoke invite", "error"); }
  }

  async function handleChangeRole(memberId: string, currentRole: string) {
    if (!activeWorkspaceId) return;
    const newRole = currentRole === "mentor" ? "member" : "mentor";
    setChangingRoleId(memberId);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Failed to change role", "error"); return; }
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
      showToast(`Role changed to ${newRole}`, "success");
    } finally { setChangingRoleId(null); }
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeWorkspaceId) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Failed to remove member", "error"); return; }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      showToast("Member removed", "info");
    } finally { setRemovingId(null); }
  }

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return (
      <TeamEmptyShowcase
        eyebrow="Участники Team Plan"
        title="Настрой команду, роли и приглашения."
        description={workspaceError
          ? "Локальный workspace API сейчас недоступен."
          : "Создай или выбери командный workspace, чтобы добавить трейдеров и менторов."}
        primaryHref="/settings?tab=account"
        primaryLabel="Создать workspace"
        secondaryHref="/team/feed"
        secondaryLabel="Открыть ленту"
        icon={Users2}
        checklist={["Роли владельца, ментора и участника","Отправка приглашений","Pending invites","Карточка участника"]}
        cards={[
          { icon: Crown, title: "Владелец", text: "Полный контроль над workspace, billing и удалением участников." },
          { icon: BookOpen, title: "Ментор", text: "Комментарии, закрепления и действия с playbook для команды." },
          { icon: UserRound, title: "Участник", text: "Доступ к ленте, рейтингу и командной работе с сделками." },
        ]}
      />
    );
  }

  if (resolvingWorkspace) {
    return <TeamLoadingPanel title="Загружаю участников" description="Проверяю workspace, роли и pending invites." cards={4} />;
  }

  return (
    <div className="space-y-6 page-enter">

      {/* ── Header ── */}
      <div className="pt-2 pb-5 border-b border-stroke space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="editorial-label">Team roster</p>
            <h1 className="font-serif text-[36px] leading-[0.98] tracking-[-0.03em] font-bold mt-2">
              Members<span className="text-brand">.</span>
            </h1>
            <p className="text-[13px] text-ink-5 mt-1.5">
              {members.length} {members.length === 1 ? "member" : "members"}
              {invites.length > 0 && <> · <span className="text-amber-400">{invites.length} pending</span></>}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowInviteForm((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover shrink-0"
            >
              <Plus className="h-4 w-4" />
              Invite
            </button>
          )}
        </div>
        {members.length > 4 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-stroke-2 bg-tinted text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
            />
          </div>
        )}
      </div>

      {/* ── Invite form ── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RosterStat icon={Users} label="Members" value={String(members.length)} hint="active seats" tone="text-brand" />
        <RosterStat icon={BookOpen} label="Mentors" value={String(mentorCount)} hint="can review and pin" tone="text-indigo-400" />
        <RosterStat icon={Crown} label="Owners" value={String(ownerCount)} hint="workspace admins" tone="text-amber-400" />
        <RosterStat icon={Clock} label="Pending" value={String(invites.length)} hint="open invites" tone={invites.length > 0 ? "text-amber-400" : "text-ink"} />
      </section>

      {showInviteForm && (
        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4 anim-fade-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-brand" />
              Send invite
            </p>
            <button onClick={() => setShowInviteForm(false)} className="text-ink-5 hover:text-ink transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              placeholder="colleague@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 min-w-[200px] h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-[13px] text-ink outline-none focus:border-brand transition-colors"
            >
              <option value="member">Member</option>
              <option value="mentor">Mentor</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={sending || !inviteEmail.trim()}
              className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-brand hover:bg-brand-hover px-4 text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* ── Members table ── */}
      <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep">
        {/* Table header */}
        <div className="grid px-5 py-2.5 border-b border-stroke" style={{ gridTemplateColumns: MEMBER_ROW_COLUMNS }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Member</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">Role</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-5 text-right">Joined</span>
          <span />
        </div>

        {loading ? (
          <div className="divide-y divide-stroke">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid px-5 py-3.5 animate-pulse items-center" style={{ gridTemplateColumns: MEMBER_ROW_COLUMNS }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-tinted shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="h-3 w-32 rounded bg-tinted" />
                    <div className="h-2.5 w-40 rounded bg-tinted" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded bg-tinted" />
                <div className="h-3 w-10 rounded bg-tinted ml-auto" />
                <div />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-ink-4">No members yet</div>
        ) : (
          <ul className="divide-y divide-stroke">
            {visibleMembers.map((m, i) => {
              const isYou = m.userId === sessionUserId;
              return (
                <li
                  key={m.id}
                  className="grid px-5 py-3.5 hover:bg-tinted/40 transition-colors cursor-pointer anim-fade-up items-center"
                  style={{ gridTemplateColumns: MEMBER_ROW_COLUMNS, animationDelay: `${i * 30}ms` }}
                  onClick={() => router.push(`/team/members/${m.id}`)}
                >
                  {/* Avatar + name + email */}
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar seed={m.userId} name={m.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-ink truncate">{m.name}</p>
                        {isYou && (
                          <span className="chip text-[10px] shrink-0" style={{ background: "rgba(34,197,94,0.10)", color: "#7BAF8A", padding: "1px 6px" }}>
                            you
                          </span>
                        )}
                      </div>
                      {m.email && <p className="text-[11px] text-ink-5 truncate mt-0.5">{m.email}</p>}
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <RoleChip role={m.role} />
                  </div>

                  {/* Joined */}
                  <p className="text-right text-[11px] text-ink-5 tnum whitespace-nowrap">
                    {timeAgo(m.joinedAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex min-w-[6rem] items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {isOwner && m.role !== "owner" && (
                      <>
                        <button
                          onClick={() => handleChangeRole(m.id, m.role)}
                          disabled={changingRoleId === m.id}
                          className="p-1.5 rounded-md text-ink-5 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors disabled:opacity-40"
                          title={m.role === "mentor" ? "Downgrade to member" : "Promote to mentor"}
                        >
                          {m.role === "mentor" ? <UserRound className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          disabled={removingId === m.id}
                          className="p-1.5 rounded-md text-ink-5 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <div className="p-1.5 rounded-md text-ink-5">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Pending invites ── */}
      {invites.length > 0 && (
        <div className="rounded-2xl border border-stroke bg-card overflow-hidden shadow-deep anim-fade-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stroke">
            <p className="text-[12px] font-semibold text-ink flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Pending invites
              <span className="chip text-[10px]" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", padding: "1px 6px" }}>
                {invites.length}
              </span>
            </p>
          </div>
          <ul className="divide-y divide-stroke">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <Mail className="h-3.5 w-3.5 text-ink-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink truncate">{inv.email}</p>
                  <p className="text-[11px] text-ink-5 mt-0.5 capitalize">{inv.role} · expires in {daysUntil(inv.expiresAt)}d</p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="p-1.5 rounded-md text-ink-5 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Revoke"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
