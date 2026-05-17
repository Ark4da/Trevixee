"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Pin, Trash2, X, Tag,
  AlertTriangle, Lightbulb, BookMarked, Pencil, FileText, Check, BookOpen,
  Image as ImageIcon, Upload, ZoomIn, Link2, TrendingUp, TrendingDown,
  CalendarDays, ChevronDown,
} from "lucide-react";
import { useT } from "@/lib/useT";
import { useToast } from "@/components/ui/toast";
import { Portal } from "@/components/ui/portal";

interface TradeLink {
  id: string;
  tradeId: string | null;
  journalId: string | null;
  trade: { symbol: string; pnl: number; netPnl: number; entryDate: string; side: string } | null;
}

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  links?: TradeLink[];
}

// Institutional matte palette
const SAGE  = "#6E9F7F";
const BRICK = "#A85550";
const AMBER = "#B08050";

const CAT_HEX: Record<string, string> = {
  mistake: BRICK,
  lesson:  AMBER,
  idea:    SAGE,
  rule:    "var(--color-brand)",
  general: "var(--color-ink-3)",
};
function catStyle(cat: string): React.CSSProperties {
  const hex = CAT_HEX[cat] || CAT_HEX.general;
  return { color: hex, background: `${hex}18`, borderColor: `${hex}40` };
}

const IMG_SEP = "\n\n---images---\n";

function encodeImages(text: string, images: string[]): string {
  if (images.length === 0) return text;
  return text + IMG_SEP + images.join("\n");
}

function decodeImages(content: string): { text: string; images: string[] } {
  const idx = content.indexOf(IMG_SEP);
  if (idx === -1) return { text: content, images: [] };
  const text = content.slice(0, idx);
  const images = content.slice(idx + IMG_SEP.length).split("\n").filter(Boolean);
  return { text, images };
}

async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url as string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function hasStructuredHeadings(text: string) {
  return /^##\s+/m.test(text);
}

function buildStructuredContent(raw: string, category: string) {
  const text = raw.trim();
  const primaryTitle =
    category === "mistake" ? "Что пошло не так" :
    category === "rule" ? "Правило" :
    category === "idea" ? "Идея" :
    "Ключевой вывод";

  const base = hasStructuredHeadings(text)
    ? text
    : [`## ${primaryTitle}`, text || "-"].join("\n");

  const required = [
    { title: primaryTitle, aliases: [primaryTitle, "Ключевой вывод", "Key takeaway", "What went wrong", "Rule", "Idea"] },
    { title: "Почему важно", aliases: ["Почему важно", "Why it matters"] },
    { title: "Следующее действие", aliases: ["Следующее действие", "Что сделать", "Next action"] },
  ];

  const sectionsToAdd = required.filter((section) => !hasAnySection(base, section.aliases));
  if (sectionsToAdd.length === 0) return base;

  return [
    base,
    ...sectionsToAdd.flatMap((section) => ["", `## ${section.title}`, "-"]),
  ].join("\n");
}

function hasAnySection(text: string, aliases: string[]) {
  return aliases.some((alias) => new RegExp(`^##\\s+${escapeRegExp(alias)}\\s*$`, "im").test(text));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionPreview(text: string, sectionNames: string[]) {
  const lines = text.split("\n");
  let active = false;
  const out: string[] = [];
  for (const raw of lines) {
    const heading = raw.trim().match(/^##\s+(.+)/)?.[1]?.toLowerCase();
    if (heading) {
      active = sectionNames.some((name) => heading.includes(name.toLowerCase()));
      continue;
    }
    if (active && raw.trim()) {
      const cleaned = raw.trim().replace(/^[-*]\s*/, "").trim();
      if (cleaned) out.push(cleaned);
    }
    if (out.length >= 2) break;
  }
  return out.join(" ");
}

function timeAgo(dateStr: string, t: ReturnType<typeof useT>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("notebook_just_now");
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function noteMonthKey(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function noteMonthLabel(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function noteMonthSortValue(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getFullYear() * 100 + date.getMonth();
}

function isCurrentMonthKey(key: string) {
  return key === noteMonthKey(new Date().toISOString());
}

function compareNotes(a: Note, b: Note) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
        <button className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors" onClick={onClose}>
          <X className="h-6 w-6" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Note image" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </Portal>
  );
}

interface TradeSearchResult {
  id: string; symbol: string; pnl: number; netPnl: number;
  entryDate: string; side: string;
}

function NoteEditor({ note, onSave, onClose }: {
  note?: Note | null; onSave: () => void; onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const decoded = note ? decodeImages(note.content) : { text: "", images: [] };

  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(decoded.text);
  const [images, setImages] = useState<string[]>(decoded.images);
  const [category, setCategory] = useState(note?.category || "general");
  const [tags, setTags] = useState(note?.tags || "");
  const [isPinned, setIsPinned] = useState(note?.isPinned || false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [linkedTrades, setLinkedTrades] = useState<TradeLink[]>(note?.links?.filter(l => l.tradeId) ?? []);
  const [tradeSearch, setTradeSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TradeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showTradeSearch, setShowTradeSearch] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tradeSearch.trim() || !showTradeSearch) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/trades?symbol=${encodeURIComponent(tradeSearch)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data.trades) ? data.trades : []);
        }
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [tradeSearch, showTradeSearch]);

  const linkTrade = async (trade: TradeSearchResult) => {
    const alreadyLinked = linkedTrades.some(l => l.tradeId === trade.id);
    if (alreadyLinked) return;

    if (!note?.id) {
      setLinkedTrades(prev => [
        ...prev,
        { id: `pending:${trade.id}`, tradeId: trade.id, journalId: null, trade },
      ]);
      setTradeSearch("");
      setSearchResults([]);
      setShowTradeSearch(false);
      return;
    }

    setLinkingId(trade.id);
    try {
      const res = await fetch("/api/notebook-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.id, tradeId: trade.id }),
      });
      if (res.ok) {
        const link = await res.json();
        setLinkedTrades(prev => [...prev, { ...link, trade: link.trade ?? trade }]);
        setTradeSearch("");
        setSearchResults([]);
        setShowTradeSearch(false);
      }
    } finally { setLinkingId(null); }
  };

  const unlinkTrade = async (linkId: string) => {
    if (linkId.startsWith("pending:")) {
      setLinkedTrades(prev => prev.filter(l => l.id !== linkId));
      return;
    }

    try {
      const res = await fetch(`/api/notebook-links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) setLinkedTrades(prev => prev.filter(l => l.id !== linkId));
    } catch { /* silent */ }
  };

  const wrapSelection = (wrapper: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const newContent =
      content.slice(0, start) + wrapper + selected + wrapper + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + wrapper.length, end + wrapper.length);
    }, 0);
  };

  const applyStructureTemplate = () => {
    setContent((current) => buildStructuredContent(current, category));
    setTimeout(() => textareaRef.current?.focus(), 0);
    toast("Структура добавлена", "success");
  };

  useEffect(() => { titleRef.current?.focus(); }, []);

  const CATEGORIES = [
    { id: "mistake", labelKey: "notebook_cat_mistake" as const, icon: AlertTriangle },
    { id: "lesson",  labelKey: "notebook_cat_lesson" as const,  icon: BookMarked },
    { id: "idea",    labelKey: "notebook_cat_idea" as const,    icon: Lightbulb },
    { id: "rule",    labelKey: "notebook_cat_rule" as const,    icon: Pencil },
    { id: "general", labelKey: "notebook_cat_general" as const, icon: FileText },
  ] as const;

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imgItem = items.find((i) => i.type.startsWith("image/"));
    if (!imgItem) return;
    e.preventDefault();
    setUploading(true);
    const file = imgItem.getAsFile();
    if (file) {
      const url = await uploadFile(file);
      if (url) setImages((prev) => [...prev, url]);
    }
    setUploading(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setImages((prev) => [...prev, url]);
    }
    setUploading(false);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) setImages((prev) => [...prev, url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && images.length === 0 && linkedTrades.length === 0) return;
    setSaving(true);
    try {
      const url = note?.id ? `/api/notes/${note.id}` : "/api/notes";
      const res = await fetch(url, {
        method: note?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled",
          content: encodeImages(content, images),
          category,
          tags: tags || null,
          isPinned,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const savedNote = await res.json();

      if (!note?.id && linkedTrades.length > 0) {
        await Promise.all(
          linkedTrades
            .filter((link) => link.tradeId)
            .map((link) => fetch("/api/notebook-links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noteId: savedNote.id, tradeId: link.tradeId }),
            }))
        );
      }

      onSave();
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const activeCatStyle = catStyle(category);
  const currentCat = CATEGORIES.find((c) => c.id === category);

  return (
    <Portal>
      {/* Fixed backdrop */}
      <div className="fixed inset-0 z-50 bg-black/80" onClick={onClose} />

      {/* Scrollable container */}
      <div className="notebook-focus-soft fixed inset-0 z-50 overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={cn(
              "relative flex max-h-[calc(100vh-32px)] w-full max-w-4xl flex-col rounded-xl border bg-card shadow-2xl pointer-events-auto transition-colors anim-scale-in",
              dragging ? "border-brand border-2" : "border-stroke"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 px-5 pt-5 pb-4 border-b border-stroke flex-wrap">
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium border transition-all"
                    style={category === cat.id ? catStyle(cat.id) : { borderColor: "var(--color-stroke-2)", color: "var(--color-ink-5)" }}
                  >
                    {t(cat.labelKey)}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg p-1.5 text-ink-5 hover:text-brand hover:bg-brand/10 transition-colors"
                  title={t("notebook_img_add_hint")}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsPinned(!isPinned)}
                  className={cn("rounded-lg p-1.5 transition-colors", isPinned ? "text-amber-400" : "text-ink-5 hover:text-ink-2")}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button onClick={onClose} className="text-ink-5 hover:text-ink transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drag overlay */}
            {dragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-brand/10 border-2 border-brand border-dashed pointer-events-none">
                <div className="text-center">
                  <Upload className="h-10 w-10 text-brand mx-auto mb-2" />
                  <p className="text-brand font-medium">{t("notebook_drop_hint")}</p>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" onPaste={handlePaste}>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("notebook_title_ph")}
                className="w-full bg-transparent text-2xl font-semibold text-ink placeholder:text-ink-4 outline-none"
              />
              {/* Markdown toolbar */}
              <div className="flex items-center gap-1 -mt-1 -mb-1">
                <button
                  type="button"
                  onClick={() => wrapSelection("**")}
                  title="Bold (**text**)"
                  className="rounded px-2 py-0.5 text-xs font-bold text-ink-4 hover:bg-tinted hover:text-ink transition-colors"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection("*")}
                  title="Italic (*text*)"
                  className="rounded px-2 py-0.5 text-xs italic font-medium text-ink-4 hover:bg-tinted hover:text-ink transition-colors"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={applyStructureTemplate}
                  title="Добавить структуру"
                  className="rounded px-2 py-0.5 text-xs font-medium text-ink-4 hover:bg-tinted hover:text-ink transition-colors"
                >
                  Структура
                </button>
                <span className="text-[10px] text-ink-5 ml-1">{t("common_markdown")}</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  category === "mistake" ? (t("notebook_cat_mistake") + "...") :
                  category === "lesson"  ? (t("notebook_cat_lesson") + "...") :
                  category === "idea"    ? (t("notebook_cat_idea") + "...") :
                  category === "rule"    ? (t("notebook_cat_rule") + "...") :
                  t("notebook_img_add_hint")
                }
                rows={18}
                className="min-h-[420px] w-full bg-transparent text-sm text-ink placeholder:text-ink-4 outline-none resize-none leading-relaxed"
              />

              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-ink-4 shrink-0" />
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t("notebook_tags_ph")}
                  className="flex-1 bg-transparent text-xs text-ink-3 placeholder:text-ink-4 outline-none"
                />
              </div>

              {/* ── Trade links — inline row, same weight as tags ── */}
              <div className="relative flex flex-wrap items-center gap-1.5">
                <Link2 className="h-3 w-3 text-ink-5 shrink-0" />

                {linkedTrades.map((l) => {
                    const tr = l.trade;
                    const profit = (tr?.pnl ?? 0) >= 0;
                    return (
                      <div key={l.id} className="group flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                        style={{ background: profit ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
                        <a href={`/trades/${l.tradeId}`} target="_blank" rel="noopener noreferrer"
                          className="font-medium hover:underline"
                          style={{ color: profit ? "#22C55E" : "#EF4444" }}
                          onClick={(e) => e.stopPropagation()}>
                          {tr ? `${tr.symbol} ${profit ? "+" : ""}${tr.pnl.toFixed(0)}` : "Trade"}
                        </a>
                        {tr && (
                          <span className="text-ink-5 text-[10px]">
                            {new Date(tr.entryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                        <button type="button" onClick={() => unlinkTrade(l.id)}
                          className="opacity-0 group-hover:opacity-100 text-ink-5 hover:text-ink-2 transition-all ml-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                })}

                {showTradeSearch ? (
                    <>
                      <input
                        type="text"
                        value={tradeSearch}
                        onChange={(e) => setTradeSearch(e.target.value.toUpperCase())}
                        placeholder="Symbol..."
                        className="h-6 w-28 rounded-md border border-stroke-2 bg-tinted px-2 text-[11px] text-ink placeholder:text-ink-5 focus:border-stroke-2 focus:outline-none"
                        autoFocus
                        onBlur={() => { if (!tradeSearch) setShowTradeSearch(false); }}
                      />
                      {searching && <div className="h-3 w-3 border border-brand border-t-transparent rounded-full animate-spin" />}
                      <button type="button" onClick={() => { setShowTradeSearch(false); setTradeSearch(""); setSearchResults([]); }}
                        className="text-[11px] text-ink-5 hover:text-ink-2 transition-colors">
                        <X className="h-3 w-3" />
                      </button>

                      {(searchResults.length > 0 || (tradeSearch && !searching)) && (
                        <div className="absolute top-full left-0 mt-1 z-20 rounded-xl border border-stroke bg-card shadow-deep py-1 w-64 max-h-48 overflow-y-auto">
                          {searchResults.length > 0 ? searchResults.map((tr) => {
                            const profit = tr.pnl >= 0;
                            const already = linkedTrades.some(l => l.tradeId === tr.id);
                            return (
                              <button key={tr.id} type="button"
                                disabled={already || linkingId === tr.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => linkTrade(tr)}
                                className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-tinted transition-colors disabled:opacity-50">
                                <div className="flex items-center gap-2">
                                  {profit
                                    ? <TrendingUp className="h-3 w-3 shrink-0" style={{ color: "#22C55E" }} />
                                    : <TrendingDown className="h-3 w-3 shrink-0" style={{ color: "#EF4444" }} />}
                                  <span className="font-semibold text-ink">{tr.symbol}</span>
                                  <span className="text-ink-5 text-[10px]">
                                    {new Date(tr.entryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                  </span>
                                </div>
                                <span className="font-medium shrink-0" style={{ color: profit ? "#22C55E" : "#EF4444" }}>
                                  {profit ? "+" : ""}{tr.pnl.toFixed(0)}
                                </span>
                              </button>
                            );
                          }) : (
                            <div className="px-3 py-2 text-xs text-ink-5">No trades found</div>
                          )}
                        </div>
                      )}
                    </>
                ) : (
                    <button type="button" onClick={() => setShowTradeSearch(true)}
                      className="text-[11px] text-ink-5 hover:text-brand transition-colors">
                      + Link trade
                    </button>
                )}
              </div>

              {/* Image gallery */}
              {(images.length > 0 || uploading) && (
                <div className="border-t border-stroke pt-3">
                  <p className="text-xs text-ink-5 mb-2 flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" /> {t("notebook_img_label")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((url) => (
                      <div key={url} className="group relative rounded-lg overflow-hidden bg-tinted aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                          <button onClick={() => setLightbox(url)} className="opacity-0 group-hover:opacity-100 rounded-full bg-white/20 p-1.5 text-white transition-all hover:bg-white/30">
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => removeImage(url)} className="opacity-0 group-hover:opacity-100 rounded-full p-1.5 text-white transition-all" style={{ background: BRICK }}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {uploading && (
                      <div className="rounded-lg bg-tinted aspect-video flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="rounded-lg border-2 border-dashed border-stroke-2 aspect-video flex flex-col items-center justify-center text-ink-5 hover:border-brand hover:text-brand transition-colors"
                    >
                      <Plus className="h-4 w-4 mb-1" />
                      <span className="text-[10px]">{t("notebook_img_add")}</span>
                    </button>
                  </div>
                </div>
              )}

              {images.length === 0 && !uploading && (
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-xs text-ink-5 hover:text-ink-3 transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{t("notebook_img_add_hint")}</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between px-5 py-3 border-t border-stroke rounded-b-xl" style={{ background: activeCatStyle.background }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-md border" style={activeCatStyle}>
                  {currentCat ? t(currentCat.labelKey) : ""}
                </span>
                {isPinned && <span className="text-xs text-amber-400 flex items-center gap-1"><Pin className="h-3 w-3" /> {t("notebook_pinned_label")}</span>}
                {images.length > 0 && (
                  <span className="text-xs text-ink-5 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {images.length}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-1.5 text-sm text-ink-3 hover:text-ink transition-colors">
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (!title.trim() && !content.trim() && images.length === 0 && linkedTrades.length === 0)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-40"
                >
                  {saving ? t("notebook_saving") : <><Check className="h-3.5 w-3.5" /> {t("notebook_save")}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </Portal>
  );
}

function NoteCard({ note, onEdit, onDelete, onTogglePin }: {
  note: Note; onEdit: (n: Note) => void;
  onDelete: (id: string) => void; onTogglePin: (note: Note) => void;
}) {
  const t = useT();
  const cs = catStyle(note.category);
  const { text, images } = decodeImages(note.content);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const nextAction = sectionPreview(text, ["Next action", "Что сделать", "Следующее действие"]);
  const takeaway = sectionPreview(text, ["Key takeaway", "Ключевой вывод", "Вывод", "Rule", "Правило", "Что пошло не так", "Идея"]);
  const linkedTrades = note.links?.filter(l => l.tradeId && l.trade) ?? [];
  const linkedTradeCount = linkedTrades.length;
  const linkedNetPnl = linkedTrades.reduce((sum, l) => sum + (l.trade?.netPnl ?? l.trade?.pnl ?? 0), 0);
  const linkedPnlSign = linkedNetPnl >= 0 ? "+" : "−";
  const linkedPnlAbs = Math.abs(linkedNetPnl);

  const CATEGORIES_MAP: Record<string, { labelKey: Parameters<typeof t>[0]; icon: React.ComponentType<{ className?: string }> }> = {
    mistake: { labelKey: "notebook_cat_mistake", icon: AlertTriangle },
    lesson:  { labelKey: "notebook_cat_lesson",  icon: BookMarked },
    idea:    { labelKey: "notebook_cat_idea",    icon: Lightbulb },
    rule:    { labelKey: "notebook_cat_rule",    icon: Pencil },
    general: { labelKey: "notebook_cat_general", icon: FileText },
  };

  const catDef = CATEGORIES_MAP[note.category] || CATEGORIES_MAP.general;
  const CatIcon = catDef.icon;

  return (
    <>
      <div
        onClick={() => onEdit(note)}
        className={cn(
          "group relative rounded-xl border bg-card p-4 cursor-pointer transition-all hover:border-brand/30 card-hover",
          note.isPinned ? "border-amber-500/30" : "border-stroke"
        )}
      >
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onTogglePin(note)} className={cn("rounded p-1 transition-colors", note.isPinned ? "text-amber-400" : "text-ink-4 hover:text-amber-400")}>
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(note.id)} className="rounded p-1 text-ink-4 hover:text-ink-2 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border" style={cs}>
            <CatIcon className="h-3 w-3" />
            {t(catDef.labelKey)}
          </span>
          {note.isPinned && <Pin className="h-3 w-3 text-amber-400" />}
          {images.length > 0 && <span className="flex items-center gap-0.5 text-[10px] text-ink-5"><ImageIcon className="h-3 w-3" /> {images.length}</span>}
          {linkedTradeCount > 0 && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border tnum"
              title={t("notebook_linked_pnl")}
              style={{
                color: linkedNetPnl >= 0 ? "#22C55E" : "#EF4444",
                borderColor: linkedNetPnl >= 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
                background: linkedNetPnl >= 0 ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              }}
            >
              <Link2 className="h-2.5 w-2.5" />
              {linkedTradeCount} · {linkedPnlSign}${linkedPnlAbs.toFixed(0)}
            </span>
          )}
        </div>

        {images.length > 0 && (
          <div className="rounded-lg overflow-hidden mb-3 aspect-video bg-tinted" onClick={(e) => { e.stopPropagation(); setLightbox(images[0]); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[0]} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
          </div>
        )}

        <h3 className="text-sm font-semibold text-ink mb-1 pr-12 line-clamp-1">{note.title}</h3>
        {(nextAction || takeaway) && (
          <div className="mb-2 rounded-lg border border-stroke bg-tinted px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-widest text-ink-5 mb-1">
              {nextAction ? "Next action" : "Takeaway"}
            </p>
            <p className="text-[11px] leading-relaxed text-ink-2 line-clamp-2">
              {nextAction || takeaway}
            </p>
          </div>
        )}
        {text && <p className="text-xs text-ink-3 leading-relaxed line-clamp-3 mb-3" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />}

        {note.tags && (
          <div className="flex flex-wrap gap-1 mb-2">
            {note.tags.split(",").slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-tinted text-ink-5 px-1.5 py-0.5 text-[10px]">{tag.trim()}</span>
            ))}
          </div>
        )}

        {/* Linked trades */}
        {(note.links?.filter(l => l.tradeId) ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-stroke" onClick={(e) => e.stopPropagation()}>
            {note.links!.filter(l => l.tradeId).map((l) => {
              const isProfit = (l.trade?.pnl ?? 0) >= 0;
              return (
                <a
                  key={l.id}
                  href={`/trades/${l.tradeId}`}
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border transition-colors hover:opacity-80"
                  style={{
                    borderColor: isProfit ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
                    background: isProfit ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    color: isProfit ? "#22C55E" : "#EF4444",
                  }}
                >
                  <Link2 className="h-2.5 w-2.5" />
                  {l.trade
                    ? `${l.trade.symbol} ${isProfit ? "+" : ""}${l.trade.pnl.toFixed(0)}`
                    : "Trade"}
                </a>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-ink-4 mt-2">{timeAgo(note.updatedAt, t)}</p>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

export default function NotebookPage() {
  const t = useT();
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeMonth, setActiveMonth] = useState("all");
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const CATEGORIES = [
    { id: "all",     labelKey: "notebook_cat_all" as const,     icon: FileText },
    { id: "mistake", labelKey: "notebook_cat_mistake" as const, icon: AlertTriangle },
    { id: "lesson",  labelKey: "notebook_cat_lesson" as const,  icon: BookMarked },
    { id: "idea",    labelKey: "notebook_cat_idea" as const,    icon: Lightbulb },
    { id: "rule",    labelKey: "notebook_cat_rule" as const,    icon: Pencil },
    { id: "general", labelKey: "notebook_cat_general" as const, icon: FileText },
  ] as const;

  const CAT_HEX_MAP: Record<string, string> = {
    all: "var(--color-ink-3)", mistake: BRICK, lesson: AMBER,
    idea: SAGE, rule: "var(--color-brand)", general: "var(--color-ink-3)",
  };

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/notes?${params}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setNotes(data);
    } catch {
      toast(t("error_load"), "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast(t("error_delete"), "error");
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...note, isPinned: !note.isPinned }),
      });
      if (!res.ok) throw new Error("failed");
      fetchNotes();
    } catch {
      toast(t("error_save"), "error");
    }
  };

  const handleSave = () => {
    setShowEditor(false);
    setEditingNote(null);
    fetchNotes();
  };

  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat.id === "all" ? notes.length : notes.filter((n) => n.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  const monthBuckets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; sortValue: number; isCurrent: boolean }>();
    for (const note of notes) {
      const key = noteMonthKey(note.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          label: noteMonthLabel(note.createdAt),
          count: 1,
          sortValue: noteMonthSortValue(note.createdAt),
          isCurrent: isCurrentMonthKey(key),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sortValue - a.sortValue);
  }, [notes]);

  const recurringPattern = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = notes.filter((n) => {
      const ts = new Date(n.createdAt).getTime();
      return Number.isFinite(ts) && ts >= cutoff && (n.category === "mistake" || n.category === "lesson");
    });
    if (recent.length === 0) return null;

    const tagBuckets = new Map<string, { tag: string; count: number; mistakes: number; lessons: number }>();
    for (const note of recent) {
      const tags = (note.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const raw of tags) {
        const key = raw.toLowerCase();
        const existing = tagBuckets.get(key) ?? { tag: raw, count: 0, mistakes: 0, lessons: 0 };
        existing.count += 1;
        if (note.category === "mistake") existing.mistakes += 1;
        else existing.lessons += 1;
        tagBuckets.set(key, existing);
      }
    }

    const topTag = Array.from(tagBuckets.values()).sort((a, b) => b.count - a.count)[0];
    if (topTag && topTag.count >= 3) {
      const dominant = topTag.mistakes >= topTag.lessons ? "mistake" : "lesson";
      return { kind: "tag" as const, tag: topTag.tag, count: topTag.count, category: dominant };
    }

    const mistakeCount = recent.filter((n) => n.category === "mistake").length;
    const lessonCount = recent.filter((n) => n.category === "lesson").length;
    if (mistakeCount >= 5) return { kind: "category" as const, count: mistakeCount, category: "mistake" as const };
    if (lessonCount >= 5) return { kind: "category" as const, count: lessonCount, category: "lesson" as const };
    return null;
  }, [notes]);

  useEffect(() => {
    if (activeMonth !== "all" && !monthBuckets.some((month) => month.key === activeMonth)) {
      setActiveMonth("all");
    }
  }, [activeMonth, monthBuckets]);

  const visibleNotes = useMemo(() => {
    const filtered = activeMonth === "all"
      ? notes
      : notes.filter((note) => noteMonthKey(note.createdAt) === activeMonth);
    return [...filtered].sort(compareNotes);
  }, [activeMonth, notes]);

  const visibleMonthGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; notes: Note[]; sortValue: number; isCurrent: boolean }>();
    for (const note of visibleNotes) {
      const key = noteMonthKey(note.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.notes.push(note);
      } else {
        map.set(key, {
          key,
          label: noteMonthLabel(note.createdAt),
          notes: [note],
          sortValue: noteMonthSortValue(note.createdAt),
          isCurrent: isCurrentMonthKey(key),
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.sortValue - a.sortValue)
      .map((group) => ({ ...group, notes: [...group.notes].sort(compareNotes) }));
  }, [visibleNotes]);

  const activeMonthLabel = activeMonth === "all"
    ? "All months"
    : monthBuckets.find((month) => month.key === activeMonth)?.label ?? "Month";

  return (
    <div className="notebook-focus-soft space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("notebook_title")}</h1>
          <p className="text-sm text-ink-3">{t("notebook_desc")}</p>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true); }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand-deep px-4 py-2 text-sm font-medium text-white hover:from-brand-hover hover:to-brand transition-all shadow-lg shadow-brand/20"
        >
          <Plus className="h-4 w-4" /> {t("notebook_new")}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-44 shrink-0 space-y-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  activeCategory === cat.id
                    ? "bg-brand/15 text-white border border-brand/20"
                    : "text-ink-3 hover:bg-tinted hover:text-ink"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: CAT_HEX_MAP[cat.id] }} />
                  <span>{t(cat.labelKey)}</span>
                </div>
                {counts[cat.id] > 0 && <span className="text-xs text-ink-4">{counts[cat.id]}</span>}
              </button>
            );
          })}

          <div className="pt-3 border-t border-stroke">
            <button
              type="button"
              onClick={() => setMonthsOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-3 transition-colors hover:bg-tinted hover:text-ink"
              aria-expanded={monthsOpen}
            >
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-brand" />
                <div className="min-w-0 text-left">
                  <p className="text-[10px] uppercase tracking-wider text-ink-5">Months</p>
                  <p className="truncate text-sm text-ink">{activeMonthLabel}</p>
                </div>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-5 transition-transform", monthsOpen && "rotate-180")} />
            </button>

            {monthsOpen && (
              <div className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1">
                <button
                  onClick={() => { setActiveMonth("all"); setMonthsOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    activeMonth === "all"
                      ? "bg-tinted text-ink border border-stroke-2"
                      : "text-ink-3 hover:bg-tinted hover:text-ink"
                  )}
                >
                  <span>All months</span>
                  {notes.length > 0 && <span className="text-xs text-ink-4">{notes.length}</span>}
                </button>
                {monthBuckets.map((month) => (
                  <button
                    key={month.key}
                    onClick={() => { setActiveMonth(month.key); setMonthsOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      activeMonth === month.key
                        ? "bg-brand/15 text-white border border-brand/20"
                        : "text-ink-3 hover:bg-tinted hover:text-ink"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays className={cn("h-4 w-4 shrink-0", month.isCurrent ? "text-brand" : "text-ink-4")} />
                      <span className="truncate">{month.label}</span>
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-ink-4">{month.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-stroke space-y-1">
            <p className="text-xs text-ink-4 px-3 mb-2">{t("notebook_quick")}</p>
            {(["mistake", "lesson", "idea", "rule"] as const).map((catId) => {
              const catDef = CATEGORIES.find((c) => c.id === catId)!;
              return (
                <button
                  key={catId}
                  onClick={() => {
                    setEditingNote({ id: "", title: "", content: "", category: catId, tags: null, isPinned: false, createdAt: "", updatedAt: "" });
                    setShowEditor(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs border transition-colors hover:opacity-80"
                  style={catStyle(catId)}
                >
                  <Plus className="h-3 w-3" /> {t(catDef.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {recurringPattern && (() => {
            const accent = recurringPattern.category === "mistake" ? BRICK : AMBER;
            const kindKey: Parameters<typeof t>[0] =
              recurringPattern.category === "mistake" ? "notebook_kind_mistakes" : "notebook_kind_lessons";
            const message = recurringPattern.kind === "tag"
              ? t("notebook_recurring_tag")
                  .replace("{tag}", recurringPattern.tag)
                  .replace("{count}", String(recurringPattern.count))
                  .replace("{kind}", t(kindKey))
              : t("notebook_recurring_category")
                  .replace("{count}", String(recurringPattern.count))
                  .replace("{kind}", t(kindKey));
            return (
              <div
                className="mb-4 flex items-start gap-3 rounded-xl border p-3"
                style={{ borderColor: `${accent}55`, background: `${accent}12` }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: accent }}>
                    {t("notebook_recurring_title")}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{message}</p>
                </div>
                <a
                  href="/playbooks"
                  className="shrink-0 rounded-md border border-stroke-2 bg-card px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:border-brand/40 hover:text-brand transition-colors"
                >
                  {t("notebook_recurring_cta")}
                </a>
              </div>
            );
          })()}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("notebook_search")}
              className="h-9 w-full max-w-sm rounded-lg border border-stroke-2 bg-tinted pl-9 pr-4 text-sm text-ink placeholder:text-ink-5 focus:border-stroke-2 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-ink-5">{t("loading")}</div>
          ) : visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <BookOpen className="h-16 w-16 text-stroke-2 mb-4" />
              <h3 className="text-lg font-semibold text-ink mb-2">
                {search || activeCategory !== "all" || activeMonth !== "all" ? t("notebook_no_results") : t("notebook_empty")}
              </h3>
              <p className="text-ink-5 text-sm mb-6 max-w-sm">
                {search || activeCategory !== "all" || activeMonth !== "all" ? t("notebook_no_results_desc") : t("notebook_empty_desc")}
              </p>
              {!search && activeCategory === "all" && activeMonth === "all" && (
                <button onClick={() => setShowEditor(true)} className="rounded-lg bg-gradient-to-r from-brand to-brand-deep px-5 py-2 text-sm font-medium text-white">
                  {t("notebook_write_first")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {visibleMonthGroups.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stroke pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays className={cn("h-4 w-4 shrink-0", group.isCurrent ? "text-brand" : "text-ink-4")} />
                      <h2 className="truncate text-sm font-semibold text-ink">{group.label}</h2>
                      {group.isCurrent && (
                        <span className="rounded-md border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink-4">
                      {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {group.notes.map((note) => (
                      <NoteCard key={note.id} note={note}
                        onEdit={(n) => { setEditingNote(n); setShowEditor(true); }}
                        onDelete={handleDelete} onTogglePin={handleTogglePin}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditor && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}
