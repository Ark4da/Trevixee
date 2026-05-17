"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { cn } from "@/lib/utils";
import {
  Rss,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Users,
  Pin,
  PinOff,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  X as XIcon,
} from "lucide-react";
import {
  TeamEmptyShowcase,
  TeamErrorPanel,
  TeamLoadingPanel,
  TeamPageHeader,
  TeamPillButton,
} from "../_components/team-page-visuals";
import { MemberAvatar, MemberDot, MemberAccentPanel } from "../_components/member-identity";

interface FeedItem {
  kind: "trade";
  id: string;
  userId: string;
  userName: string;
  symbol: string;
  side: string;
  netPnl: number | null;
  rMultiple: number;
  entryDate: string | null;
  exitDate: string | null;
  setup: string | null;
  notes: string | null;
  createdAt: string;
}

interface PinnedItem {
  id: string;
  kind: string;
  pinnedAt: string;
  pinnedByName: string;
  item: FeedItem | null;
  noteContent: { title: string; body: string; createdAt: string } | null;
}

interface TradeComment {
  id: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TradeCard({
  item,
  canPin,
  canComment,
  isPinned,
  commentsOpen,
  comments,
  commentDraft,
  submittingComment,
  onOpen,
  onPin,
  onUnpin,
  onToggleComments,
  onCommentDraftChange,
  onSubmitComment,
}: {
  item: FeedItem;
  canPin?: boolean;
  canComment?: boolean;
  isPinned?: boolean;
  commentsOpen?: boolean;
  comments?: TradeComment[];
  commentDraft?: string;
  submittingComment?: boolean;
  onOpen: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onToggleComments?: () => void;
  onCommentDraftChange?: (value: string) => void;
  onSubmitComment?: () => void;
}) {
  const positive = item.netPnl === null ? item.rMultiple >= 0 : item.netPnl >= 0;

  return (
    <MemberAccentPanel
      seed={item.userId}
      name={item.userName}
      onClick={onOpen}
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-deep card-hover anim-fade-up cursor-pointer",
        isPinned ? "border-brand/35" : "border-stroke"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <MemberAvatar seed={item.userId} name={item.userName} />
          <div>
            <p className="text-[13px] font-medium text-ink leading-tight">{item.userName}</p>
            <p className="text-[11px] text-ink-5 mt-0.5">{timeAgo(item.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPinned && (
            <span className="flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold text-brand">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[#EF4444]" />
            )}
            <span className={cn("text-[13px] font-semibold jb-mono", positive ? "text-[#22C55E]" : "text-[#EF4444]")}>
              {item.netPnl !== null
                ? (positive ? "+" : "") + "$" + Math.abs(item.netPnl).toFixed(2)
                : item.rMultiple !== 0
                ? (positive ? "+" : "") + item.rMultiple.toFixed(2) + "R"
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Trade info */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip text-[10px] font-bold text-ink bg-tinted border border-stroke">
          {item.symbol}
        </span>
        <span
          className={cn(
            "chip text-[10px] font-semibold",
            item.side === "long"
              ? "text-[#22C55E]"
              : "text-[#EF4444]"
          )}
          style={{
            background: item.side === "long" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
          }}
        >
          {item.side?.toUpperCase()}
        </span>
        {item.setup && (
          <span className="chip text-[10px] text-ink-4 bg-tinted border border-stroke">
            {item.setup}
          </span>
        )}
        {item.rMultiple !== 0 && item.netPnl !== null && (
          <span className="text-[11px] text-ink-5 jb-mono ml-auto">
            {item.rMultiple >= 0 ? "+" : ""}{item.rMultiple.toFixed(2)}R
          </span>
        )}
      </div>

      {item.notes && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-tinted/60 px-3 py-2 text-[12px] leading-relaxed text-ink-4 border border-stroke">
          {item.notes}
        </p>
      )}

      {(canPin || canComment || (comments?.length ?? 0) > 0) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-stroke pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComments?.();
            }}
            className="rounded-lg border border-stroke px-2.5 py-1.5 text-[11px] font-medium text-ink-4 transition-colors hover:bg-tinted hover:text-ink"
          >
            Comment{comments?.length ? ` · ${comments.length}` : ""}
          </button>
          {canPin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isPinned) onUnpin?.();
                else onPin?.();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                isPinned
                  ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/15"
                  : "border-stroke text-ink-4 hover:bg-tinted hover:text-ink"
              )}
            >
              {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {isPinned ? "Unpin" : "Pin for team"}
            </button>
          )}
        </div>
      )}

      {commentsOpen && (
        <div
          className="mt-3 space-y-3 border-t border-stroke pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {(comments ?? []).length > 0 && (
            <div className="space-y-2">
              {(comments ?? []).map((comment) => (
                <div key={comment.id} className="flex gap-2 rounded-lg bg-tinted/50 p-2">
                  <MemberAvatar seed={comment.authorUserId} name={comment.authorName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p className="truncate text-[11px] font-semibold text-ink">{comment.authorName}</p>
                      <p className="text-[10px] text-ink-5">{timeAgo(comment.createdAt)}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-3">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canComment && (
            <div className="space-y-2">
              <textarea
                value={commentDraft ?? ""}
                onChange={(e) => onCommentDraftChange?.(e.target.value)}
                placeholder="Leave mentor feedback..."
                rows={3}
                className="w-full resize-none rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-[12px] text-ink placeholder:text-ink-5 outline-none transition-colors focus:border-brand"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSubmitComment}
                  disabled={submittingComment || !(commentDraft ?? "").trim()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-40"
                >
                  {submittingComment ? "Saving..." : "Save comment"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </MemberAccentPanel>
  );
}

function EmptyState({ hasWorkspace, workspaceError }: { hasWorkspace: boolean; workspaceError?: boolean }) {
  if (!hasWorkspace) {
    return (
      <TeamEmptyShowcase
        eyebrow="Лента Team Plan"
        title="Собери поток разборов, сделок и обратной связи ментора."
        description={
          workspaceError
            ? "Локальный workspace API сейчас недоступен, поэтому живая лента команды не отображается."
            : "Выбери или создай командный workspace, чтобы увидеть сделки участников, закрепления и комментарии."
        }
        primaryHref="/settings?tab=account"
        primaryLabel="Создать workspace"
        secondaryHref="/team/members"
        secondaryLabel="Участники"
        icon={Rss}
        checklist={[
          "Проверить загрузку живых сделок",
          "Проверить закрепления для команды",
          "Проверить комментарии ментора",
          "Проверить фильтр по участникам",
        ]}
        cards={[
          {
            icon: Pin,
            title: "Закрепления",
            text: "Важные сделки остаются над лентой, чтобы команда видела лучший материал для разбора.",
          },
          {
            icon: MessageSquare,
            title: "Комментарии",
            text: "Менторы могут оставлять короткую обратную связь прямо под сделкой.",
          },
          {
            icon: Users,
            title: "Фильтр участников",
            text: "Лента быстро сужается до конкретного трейдера, когда нужно провести персональный разбор.",
          },
        ]}
      />
    );
  }
  return (
    <TeamEmptyShowcase
      eyebrow="Лента пока пустая"
      title="Первые командные сделки появятся здесь."
      description="Когда участники начнут закрывать сделки, лента покажет символы, R-multiple, суммы с учетом privacy и mentor actions."
      primaryHref="/trades"
      primaryLabel="Добавить сделку"
      secondaryHref="/team/members"
      secondaryLabel="Открыть участников"
      icon={Rss}
      checklist={[
        "Добавить сделку от участника",
        "Открыть comments под сделкой",
        "Закрепить важный пример",
        "Проверить privacy для сумм",
      ]}
      cards={[
        { icon: TrendingUp, title: "Сделки", text: "Закрытые сделки будут появляться в общей командной хронологии." },
        { icon: ShieldCheck, title: "Privacy", text: "Скрытые суммы не ломают ленту и остаются приватными." },
        { icon: MessageSquare, title: "Review", text: "Комментарии превращают ленту в рабочий инструмент разбора." },
      ]}
    />
  );
}

interface FeedMember { id: string; userId: string; name: string; }

export default function TeamFeedPage() {
  const { activeWorkspaceId, resolvingWorkspace, workspaceError } = useTeamWorkspace();
  const router = useRouter();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pins, setPins] = useState<PinnedItem[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [members, setMembers] = useState<FeedMember[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterSetup, setFilterSetup] = useState("");
  const [filterDays, setFilterDays] = useState<"" | "7" | "30" | "90">("");
  const [showFilters, setShowFilters] = useState(false);
  const [canPin, setCanPin] = useState(false);
  const [canComment, setCanComment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentsByTrade, setCommentsByTrade] = useState<Record<string, TradeComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentTradeId, setOpenCommentTradeId] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchFeed = useCallback(async (wsId: string, cursor?: string, opts?: { symbol?: string; setup?: string; days?: string }) => {
    const isFirst = !cursor;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (opts?.symbol) params.set("symbol", opts.symbol);
      if (opts?.setup) params.set("setup", opts.setup);
      if (opts?.days) params.set("since", new Date(Date.now() - Number(opts.days) * 86_400_000).toISOString());
      const url = `/api/workspaces/${wsId}/feed?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setFeed((prev) => isFirst ? data.feed : [...prev, ...data.feed]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Failed to load team feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const fetchPins = useCallback(async (wsId: string) => {
    const res = await fetch(`/api/workspaces/${wsId}/pins`);
    if (!res.ok) return;
    const data = await res.json();
    setPins(Array.isArray(data.pins) ? data.pins.filter((p: PinnedItem) => p.item || p.noteContent) : []);
  }, []);

  const postMentorNote = async () => {
    if (!activeWorkspaceId || !noteDraft.trim()) return;
    setPostingNote(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "note", text: noteDraft.trim(), title: noteTitle.trim() || "Mentor note" }),
      });
      if (res.ok) {
        setNoteDraft(""); setNoteTitle(""); setShowNoteForm(false);
        await fetchPins(activeWorkspaceId);
      }
    } finally { setPostingNote(false); }
  };

  const fetchMembers = useCallback(async (wsId: string) => {
    const res = await fetch(`/api/workspaces/${wsId}/members`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setMembers(data.map((m: { id: string; userId: string; name: string }) => ({ id: m.id, userId: m.userId, name: m.name })));
  }, []);

  const activeFilters = { symbol: filterSymbol, setup: filterSetup, days: filterDays };

  useEffect(() => {
    if (!activeWorkspaceId) { setFeed([]); setPins([]); setMembers([]); setFilterUserId(null); return; }
    fetchFeed(activeWorkspaceId, undefined, activeFilters);
    fetchPins(activeWorkspaceId);
    fetchMembers(activeWorkspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, fetchFeed, fetchPins, fetchMembers]);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then((d) => {
        setCanPin(Boolean(d?.capabilities?.canPinTeamContent));
        setCanComment(Boolean(d?.capabilities?.canCommentOnMemberTrade));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId || !nextCursor || filterUserId || loadingMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor) {
          fetchFeed(activeWorkspaceId, nextCursor);
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeWorkspaceId, fetchFeed, filterUserId, loadingMore, nextCursor]);

  const pinTrade = async (tradeId: string) => {
    if (!activeWorkspaceId) return;
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "trade", refId: tradeId }),
    });
    if (res.ok) await fetchPins(activeWorkspaceId);
  };

  const unpin = async (pinId: string) => {
    if (!activeWorkspaceId) return;
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/pins/${pinId}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchPins(activeWorkspaceId);
  };

  const fetchComments = async (tradeId: string) => {
    if (!activeWorkspaceId || commentsByTrade[tradeId]) return;
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}/trades/${tradeId}/comments`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) {
      setCommentsByTrade((prev) => ({ ...prev, [tradeId]: data }));
    }
  };

  const toggleComments = async (tradeId: string) => {
    const nextOpen = openCommentTradeId === tradeId ? null : tradeId;
    setOpenCommentTradeId(nextOpen);
    if (nextOpen) await fetchComments(tradeId);
  };

  const submitComment = async (tradeId: string) => {
    if (!activeWorkspaceId) return;
    const body = (commentDrafts[tradeId] ?? "").trim();
    if (!body) return;
    setSubmittingCommentId(tradeId);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/trades/${tradeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      setCommentsByTrade((prev) => ({
        ...prev,
        [tradeId]: [
          ...(prev[tradeId] ?? []),
          {
            id: saved.id,
            authorUserId: saved.authorUserId,
            authorName: saved.authorName ?? "Mentor",
            body: saved.body,
            createdAt: saved.createdAt,
          },
        ],
      }));
      setCommentDrafts((prev) => ({ ...prev, [tradeId]: "" }));
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const pinByTradeId = new Map(pins.filter((p) => p.item).map((p) => [p.item!.id, p.id]));
  const visibleFeed = (filterUserId ? feed.filter((t) => t.userId === filterUserId) : feed)
    .filter((t) => filterUserId || !pinByTradeId.has(t.id));
  const contributorCount = new Set(feed.map((item) => item.userId)).size;

  if (!activeWorkspaceId && !resolvingWorkspace) {
    return <EmptyState hasWorkspace={false} workspaceError={workspaceError} />;
  }

  return (
    <div className="space-y-5 page-enter">
      <TeamPageHeader
        eyebrow="Team Activity"
        title="Лента команды"
        description="Сделки, закрепления, комментарии и быстрый mentor review в одном рабочем потоке."
        icon={Rss}
        actions={
          <>
          {/* Member filter chips */}
          {members.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TeamPillButton active={filterUserId === null} onClick={() => setFilterUserId(null)}>
                All
              </TeamPillButton>
              {members.map((m) => (
                <TeamPillButton
                  key={m.userId}
                  active={filterUserId === m.userId}
                  onClick={() => setFilterUserId(filterUserId === m.userId ? null : m.userId)}
                >
                  <span className="inline-flex items-center gap-2">
                    <MemberDot seed={m.userId} name={m.name} />
                    {m.name}
                  </span>
                </TeamPillButton>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {canPin && (
              <button
                onClick={() => setShowNoteForm((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  showNoteForm ? "border-brand/40 bg-brand/10 text-brand" : "border-stroke text-ink-3 hover:text-ink hover:bg-tinted"
                )}
              >
                <Pin className="h-3.5 w-3.5" />
                Pin note
              </button>
            )}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                showFilters || filterSymbol || filterSetup || filterDays
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-stroke text-ink-3 hover:text-ink hover:bg-tinted"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {(filterSymbol || filterSetup || filterDays) && (
                <span className="rounded-full bg-brand w-1.5 h-1.5" />
              )}
            </button>
            {activeWorkspaceId && (
              <button
                onClick={() => fetchFeed(activeWorkspaceId, undefined, activeFilters)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink hover:bg-tinted transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            )}
          </div>
          </>
        }
      />

      {/* Filter bar */}
      {showFilters && (
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 anim-fade-up space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (e.g. NQ)"
              className="h-9 w-32 rounded-lg border border-stroke-2 bg-tinted px-3 text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
            />
            <input
              type="text"
              value={filterSetup}
              onChange={(e) => setFilterSetup(e.target.value)}
              placeholder="Setup name"
              className="h-9 flex-1 min-w-[140px] rounded-lg border border-stroke-2 bg-tinted px-3 text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
            />
            <div className="inline-flex rounded-lg border border-stroke bg-card p-0.5 gap-0.5">
              {(["", "7", "30", "90"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDays(d)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filterDays === d ? "bg-tinted text-ink" : "text-ink-4 hover:text-ink-2"
                  )}
                >
                  {d === "" ? "All time" : `${d}d`}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!activeWorkspaceId) return;
                fetchFeed(activeWorkspaceId, undefined, { symbol: filterSymbol, setup: filterSetup, days: filterDays });
              }}
              className="h-9 rounded-lg bg-brand hover:bg-brand-hover px-4 text-[13px] font-semibold text-white transition-colors"
            >
              Apply
            </button>
            {(filterSymbol || filterSetup || filterDays) && (
              <button
                onClick={() => {
                  setFilterSymbol(""); setFilterSetup(""); setFilterDays("");
                  if (activeWorkspaceId) fetchFeed(activeWorkspaceId, undefined, {});
                }}
                className="flex items-center gap-1 text-[12px] text-ink-4 hover:text-red-400 transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mentor note creation form */}
      {showNoteForm && canPin && (
        <div className="rounded-xl border border-brand/25 bg-brand/5 p-4 anim-fade-up space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
              <Pin className="h-4 w-4 text-brand" />
              Pin a mentor note
            </p>
            <button onClick={() => setShowNoteForm(false)} className="text-ink-5 hover:text-ink transition-colors">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full h-9 rounded-lg border border-stroke-2 bg-tinted px-3 text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
          />
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Write your note for the team…"
            rows={4}
            className="w-full resize-none rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-[13px] text-ink placeholder-ink-5 outline-none focus:border-brand transition-colors"
          />
          <div className="flex justify-end">
            <button
              onClick={postMentorNote}
              disabled={postingNote || !noteDraft.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
            >
              <Pin className="h-3.5 w-3.5" />
              {postingNote ? "Pinning…" : "Pin to team"}
            </button>
          </div>
        </div>
      )}

      {(feed.length > 0 || pins.length > 0) && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Loaded trades", value: String(feed.length), hint: "recent closed entries" },
            { label: "Contributors", value: String(contributorCount), hint: `${members.length} members available` },
            { label: "Pinned reviews", value: String(pins.length), hint: "mentor examples" },
            {
              label: "Current view",
              value: filterUserId ? members.find((m) => m.userId === filterUserId)?.name ?? "Member" : "All",
              hint: filterUserId ? `${visibleFeed.length} loaded trades` : `${visibleFeed.length} visible cards`,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-stroke bg-card p-4 shadow-deep">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-5">{item.label}</p>
              <p className="mt-2 truncate font-serif text-[26px] font-bold leading-none tracking-tight text-ink tnum">{item.value}</p>
              <p className="mt-1 truncate text-[11px] text-ink-5">{item.hint}</p>
            </div>
          ))}
        </section>
      )}

      {/* Content */}
      {loading || resolvingWorkspace ? (
        <TeamLoadingPanel
          title="Загружаю ленту команды"
          description="Проверяю сделки, закрепления, участников и права на комментарии."
          cards={6}
        />
      ) : error ? (
        <TeamErrorPanel message={error} onRetry={() => activeWorkspaceId && fetchFeed(activeWorkspaceId)} />
      ) : feed.length === 0 ? (
        <EmptyState hasWorkspace={true} />
      ) : (
        <>
          {/* Pinned — hidden when filtering by member */}
          {!filterUserId && pins.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-semibold text-ink">Pinned by mentors</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pins.map((pin, i) => (
                  <div key={pin.id} style={{ animationDelay: `${i * 30}ms` }}>
                    {pin.item ? (
                      <TradeCard
                        item={pin.item}
                        canPin={canPin}
                        canComment={canComment}
                        isPinned
                        commentsOpen={openCommentTradeId === pin.item.id}
                        comments={commentsByTrade[pin.item.id]}
                        commentDraft={commentDrafts[pin.item.id] ?? ""}
                        submittingComment={submittingCommentId === pin.item.id}
                        onOpen={() => router.push(`/trades/${pin.item!.id}`)}
                        onUnpin={() => unpin(pin.id)}
                        onToggleComments={() => toggleComments(pin.item!.id)}
                        onCommentDraftChange={(value) =>
                          setCommentDrafts((prev) => ({ ...prev, [pin.item!.id]: value }))
                        }
                        onSubmitComment={() => submitComment(pin.item!.id)}
                      />
                    ) : pin.noteContent ? (
                      <div className="rounded-2xl border border-brand/30 bg-card p-5 shadow-deep anim-fade-up">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <Pin className="h-3.5 w-3.5 text-brand shrink-0" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-brand">Mentor note</span>
                          </div>
                          {canPin && (
                            <button
                              onClick={() => unpin(pin.id)}
                              className="p-1 rounded-md text-ink-5 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              title="Unpin"
                            >
                              <PinOff className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {pin.noteContent.title && (
                          <h3 className="text-[14px] font-semibold text-ink mb-1.5">{pin.noteContent.title}</h3>
                        )}
                        <p className="text-[13px] leading-relaxed text-ink-3 whitespace-pre-wrap">{pin.noteContent.body}</p>
                        <p className="mt-3 text-[10px] text-ink-5">
                          by {pin.pinnedByName} · {timeAgo(pin.pinnedAt)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {visibleFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Users className="h-12 w-12 text-ink-5 mb-3" />
              <p className="text-[13px] text-ink-3">No trades from this member yet.</p>
              <button
                onClick={() => setFilterUserId(null)}
                className="mt-2 text-[12px] text-brand hover:text-brand-hover transition-colors"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleFeed.map((item, i) => (
                <div key={item.id} style={{ animationDelay: `${i * 30}ms` }}>
                  <TradeCard
                    item={item}
                    canPin={canPin}
                    canComment={canComment}
                    isPinned={pinByTradeId.has(item.id)}
                    commentsOpen={openCommentTradeId === item.id}
                    comments={commentsByTrade[item.id]}
                    commentDraft={commentDrafts[item.id] ?? ""}
                    submittingComment={submittingCommentId === item.id}
                    onOpen={() => router.push(`/trades/${item.id}`)}
                    onPin={() => pinTrade(item.id)}
                    onUnpin={() => {
                      const pinId = pinByTradeId.get(item.id);
                      if (pinId) unpin(pinId);
                    }}
                    onToggleComments={() => toggleComments(item.id)}
                    onCommentDraftChange={(value) =>
                      setCommentDrafts((prev) => ({ ...prev, [item.id]: value }))
                    }
                    onSubmitComment={() => submitComment(item.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {nextCursor && !filterUserId && (
            <div ref={loadMoreRef} className="flex justify-center pt-2">
              <span className="rounded-lg border border-stroke px-5 py-2 text-[13px] font-medium text-ink-4">
                {loadingMore ? "Loading..." : "Scroll for more"}
              </span>
            </div>
          )}
          {nextCursor && filterUserId && (
            <p className="text-center text-[11px] text-ink-5 pt-1">
              Showing all loaded trades for this member. Clear filter to load more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
