"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import {
  Send, RotateCcw, Copy, Trash2, Check,
  Paperclip, Image as ImageIcon, X, ChevronDown, TrendingUp, TrendingDown,
  BarChart3, AlertTriangle, Brain, NotebookPen, Target, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useAppStore } from "@/store";
import type { Lang } from "@/lib/i18n";

interface Msg {
  role: "user" | "assistant";
  content: string;
  attachedTrade?: TradeSummary;
  attachedImage?: string;
  aiMeta?: AiMeta;
}

interface TradeSummary {
  id: string; symbol: string; side: string; status: string;
  entryDate: string; exitDate?: string | null;
  entryPrice: number; exitPrice?: number | null;
  netPnl: number; rMultiple: number;
  setup?: string | null; tags?: string | null;
  emotionalState?: string | null; notes?: string | null; market: string;
}

interface ArticleContext { title?: string; author?: string; body?: string; }

interface AiMeta {
  aiPowered: boolean;
  limited: boolean;
  reason?: string;
}

const PROMPT_CARDS = [
  {
    cat: { en: "Analysis", ru: "Анализ" },
    catColor: "#7BAF8A",
    icon: BarChart3,
    text: {
      en: "Find leaks in my losing trades from the last 30 days",
      ru: "Найди утечки в моих убыточных сделках за последние 30 дней",
    },
  },
  {
    cat: { en: "Critique", ru: "Критика" },
    catColor: "#AC5A56",
    icon: AlertTriangle,
    text: {
      en: "Where did I break my playbook in this trade?",
      ru: "Где в этой сделке я нарушил свой плейбук?",
    },
  },
  {
    cat: { en: "Psychology", ru: "Психология" },
    catColor: "#8B8FF1",
    icon: Brain,
    text: {
      en: "Why did I close profit early again? Explain it from my data",
      ru: "Почему я снова рано закрыл прибыль? Объясни в данных",
    },
  },
];

const STORAGE_KEY = "trevixe_learn_chat_history";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

type ArtifactState = "idle" | "saving" | "saved";

// ── Markdown renderer ─────────────────────────────────────────────────────────
function MdLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded px-1 py-0.5 font-mono text-[12px]" style={{ background: "rgba(240,114,64,.12)", color: "#F07240" }}>{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function isTableRow(line: string) { const t = line.trim(); return t.startsWith("|") && t.endsWith("|") && t.length > 2; }
function isSeparatorRow(line: string) { return /^\|[\s\-:|]+\|$/.test(line.trim()); }
function parseTableCells(line: string) { return line.trim().slice(1, -1).split("|").map(c => c.trim()); }

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const isFirst = elements.length === 0;
      elements.push(
        <p key={i} className={cn(isFirst ? "mt-0" : "mt-3", "mb-1 text-[14px] font-semibold leading-[34px] text-ink")}>
          <MdLine text={headingMatch[2]} />
        </p>
      );
      i++; continue;
    }
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) { tableLines.push(lines[i]); i++; }
      const nonSep = tableLines.filter(l => !isSeparatorRow(l));
      if (nonSep.length >= 1) {
        const [headerLine, ...dataLines] = nonSep;
        const headers = parseTableCells(headerLine);
        elements.push(
          <div key={`t-${i}`} className="my-3 overflow-x-auto rounded-xl border border-stroke bg-card">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-stroke bg-tinted/60">
                  {headers.map((h, j) => (
                    <th key={j} className="px-4 py-2 text-left text-[11px] font-semibold whitespace-nowrap font-mono uppercase text-ink-5">
                      <MdLine text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataLines.map(parseTableCells).map((row, j) => (
                  <tr key={j} className={j < dataLines.length - 1 ? "border-b border-stroke" : ""}>
                    {row.map((cell, k) => (
                      <td key={k} className="px-4 py-2.5 text-[13px] text-ink-3">
                        <MdLine text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/);
    const numMatch    = trimmed.match(/^\d+\.\s+(.+)/);
    if (bulletMatch || numMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const t2 = lines[i].trim();
        const bm = t2.match(/^[-*•]\s+(.+)/);
        const nm = t2.match(/^\d+\.\s+(.+)/);
        if (bm || nm) { items.push((bm ?? nm)![1]); i++; } else break;
      }
      elements.push(
        <ul key={`l-${i}`} className="my-2 space-y-1.5 pl-0">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(240,114,64,.5)" }} />
              <span className="text-[13.5px] leading-relaxed text-ink-2"><MdLine text={item} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (trimmed) elements.push(
      <p key={i} className="leading-relaxed text-ink-2" style={{ fontSize: 13.5 }}>
        <MdLine text={line} />
      </p>
    );
    else if (elements.length > 0) elements.push(<div key={i} className="h-2" />);
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text, lang }: { text: string; lang: Lang }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-md transition-all"
      style={{ color: copied ? "#F07240" : "#5A5753" }}
      title={lang === "ru" ? "Копировать" : "Copy"}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ArtifactAction({
  icon: Icon,
  label,
  state,
  onClick,
  lang,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  state: ArtifactState;
  onClick: () => void;
  lang: Lang;
}) {
  const done = state === "saved";
  const saving = state === "saving";
  return (
    <button
      onClick={onClick}
      disabled={saving || done}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-medium transition-all",
        "border-stroke bg-transparent text-ink-3 hover:border-stroke-2 hover:bg-white/[0.035] hover:text-ink",
        "disabled:cursor-default disabled:hover:bg-transparent",
        done && "border-brand/25 bg-brand/10 text-brand"
      )}
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      {saving ? (lang === "ru" ? "Сохраняю" : "Saving") : done ? (lang === "ru" ? "Готово" : "Done") : label}
    </button>
  );
}

function sanitizeMessagesForStorage(items: Msg[]): Msg[] {
  return items.slice(-30).map((message) => ({
    ...message,
    attachedImage: undefined,
  }));
}

function LimitedAnswerBadge({ meta, lang }: { meta?: AiMeta; lang: Lang }) {
  if (!meta?.limited) return null;
  const label = meta.reason === "openrouter_timeout"
    ? (lang === "ru" ? "Ограниченно: AI не успел ответить" : "Limited: AI timeout")
    : meta.reason === "openrouter_disabled"
      ? (lang === "ru" ? "Ограниченно: локальный ответ" : "Limited: local fallback")
      : (lang === "ru" ? "Ограниченный AI-ответ" : "Limited AI answer");
  return (
    <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-normal text-amber-400">
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Trade chip ────────────────────────────────────────────────────────────────
function TradeChip({ trade, onRemove }: { trade: TradeSummary; onRemove?: () => void }) {
  const isWin = trade.netPnl > 0;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-stroke bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-2">
      {trade.side === "long" ? <TrendingUp className="h-3 w-3" style={{ color: "#7BAF8A" }} /> : <TrendingDown className="h-3 w-3" style={{ color: "#AC5A56" }} />}
      {trade.symbol}
      <span className="text-ink-5">{new Date(trade.entryDate).toLocaleDateString("ru", { day: "2-digit", month: "short" })}</span>
      <span style={{ color: isWin ? "#7BAF8A" : "#AC5A56" }}>{isWin ? "+" : ""}${Math.abs(trade.netPnl).toFixed(0)}</span>
      {onRemove && <button onClick={onRemove} className="ml-0.5 text-ink-5 hover:text-ink transition-colors"><X className="h-3 w-3" /></button>}
    </span>
  );
}

// ── Trade picker ──────────────────────────────────────────────────────────────
function TradePicker({ trades, onSelect, onClose, lang }: { trades: TradeSummary[]; onSelect: (t: TradeSummary) => void; onClose: () => void; lang: Lang }) {
  const [q, setQ] = useState("");
  const filtered = trades.filter(t =>
    t.symbol.toLowerCase().includes(q.toLowerCase()) ||
    (t.setup ?? "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 12);
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-stroke bg-card shadow-elevated">
      <div className="border-b border-stroke p-2">
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={lang === "ru" ? "Поиск трейда…" : "Search trades..."}
          className="w-full rounded-lg bg-tinted px-3 py-1.5 text-[12px] text-ink focus:outline-none" />
      </div>
      <div className="max-h-52 overflow-y-auto p-1">
        {filtered.length === 0 && <p className="px-3 py-3 text-center text-[12px] text-ink-5">{lang === "ru" ? "Нет трейдов" : "No trades"}</p>}
        {filtered.map(t => {
          const isWin = t.netPnl > 0;
          return (
            <button key={t.id} onClick={() => { onSelect(t); onClose(); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-ink-2 transition-colors hover:bg-tinted"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-ink">{t.symbol} <span className="font-normal text-ink-5">{t.side.toUpperCase()}</span></p>
                <p className="text-[10px] text-ink-5">{new Date(t.entryDate).toLocaleDateString("ru", { day: "2-digit", month: "short" })}{t.setup ? ` · ${t.setup}` : ""}</p>
              </div>
              <span className="text-[12px] font-semibold font-mono shrink-0" style={{ color: isWin ? "#7BAF8A" : "#AC5A56" }}>
                {isWin ? "+" : ""}${Math.abs(t.netPnl).toFixed(0)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────
function AiAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      className={cn("shrink-0 flex items-center justify-center rounded-[10px] text-white", pulse && "animate-pulse")}
      style={{
        width: 34,
        height: 34,
        background: "radial-gradient(circle at 74% 24%, rgba(255,138,84,.48) 0%, rgba(240,114,64,.18) 29%, transparent 54%), linear-gradient(145deg,#3B3936 0%,#242321 50%,#151413 100%)",
        boxShadow: "0 0 0 1px rgba(240,114,64,.16), 0 5px 14px rgba(0,0,0,.24)",
      }}
      aria-label="Trevixe Lens"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3.8 12s2.9-5 8.2-5 8.2 5 8.2 5-2.9 5-8.2 5-8.2-5-8.2-5Z"
          fill="rgba(255,255,255,.10)"
          stroke="rgba(255,255,255,.78)"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3.15" fill="#F07240" />
        <circle cx="12" cy="12" r="1.35" fill="#171513" />
        <circle cx="13.05" cy="10.85" r=".75" fill="#FFFFFF" fillOpacity=".92" />
      </svg>
    </div>
  );
}

// ── User Avatar ───────────────────────────────────────────────────────────────
function UserAvatar() {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[9px] text-[12px] font-semibold"
      style={{
        width: 32, height: 32, order: 2,
        background: "var(--color-card)",
        border: "1px solid var(--color-stroke)",
        color: "var(--color-ink-3)",
      }}
    >
      Y
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await loadImage(source);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function AiLearnChat({ articleContext, initialPrompt }: { articleContext?: ArticleContext; initialPrompt?: string }) {
  const toast = useToast();
  const lang = useAppStore((s) => s.lang);
  const copy = useCallback((en: string, ru: string) => lang === "ru" ? ru : en, [lang]);
  const [messages, setMessages]         = useState<Msg[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput]               = useState("");
  const [streaming, setStreaming]       = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [trades, setTrades]             = useState<TradeSummary[]>([]);
  const [attachedTrade, setAttachedTrade]   = useState<TradeSummary | null>(null);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [attachedImage, setAttachedImage]     = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState("");
  const [artifactStates, setArtifactStates] = useState<Record<string, ArtifactState>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const initialPromptSentRef = useRef(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Msg[];
      setMessages(raw.filter(m => m && typeof m.content === "string"));
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetch("/api/trades?limit=200&sort=entryDate&dir=desc")
      .then(r => r.json())
      .then((d: { trades?: TradeSummary[] }) => { if (Array.isArray(d.trades)) setTrades(d.trades); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeMessagesForStorage(messages)));
  }, [messages, historyLoaded]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }, []);

  useEffect(() => { scrollDown(); }, [messages, streamBuffer, scrollDown]);

  const handleImageFile = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast(copy("PNG, JPG, and WebP are supported", "Поддерживаются PNG, JPG и WebP"), "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES * 2) {
      toast(copy("Screenshot is too large. Maximum 8 MB before compression.", "Скриншот слишком большой. Максимум 8 MB до сжатия."), "error");
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      const approxBytes = Math.floor((dataUrl.split(",")[1]?.length ?? 0) * 3 / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        toast(copy("Screenshot is still too large after compression. Try cropping it.", "Скриншот слишком большой даже после сжатия. Попробуй обрезать изображение."), "error");
        return;
      }
      setAttachedImage(dataUrl);
      setAttachedImageName(file.name);
    } catch {
      toast(copy("Could not process the image", "Не получилось обработать изображение"), "error");
    }
  };

  const send = useCallback(async (questionRaw?: string, historyOverride?: Msg[]) => {
    const question = (questionRaw ?? input).trim();
    if (!question || streaming) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const base = historyOverride ?? messages;
    const newMsg: Msg = { role: "user", content: question, attachedTrade: attachedTrade ?? undefined, attachedImage: attachedImage ?? undefined };
    const next = [...base, newMsg];
    setMessages(next); setInput(""); setAttachedTrade(null); setAttachedImage(null); setAttachedImageName("");
    setStreaming(true); setStreamBuffer(""); setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      const res = await fetch("/api/ai/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: base.slice(-10).map(m => ({ role: m.role, content: m.content })),
          articleContext,
          tradeReference: attachedTrade,
          imageBase64: attachedImage,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(j.error ?? `Error ${res.status}`); }
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/event-stream") && res.body) {
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let meta: AiMeta = { aiPowered: true, limited: false };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value, { stream: true }).split("\n")) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const d = t.slice(5).trim();
            if (d === "[DONE]") break;
            try {
              const p = JSON.parse(d) as { token?: string; meta?: AiMeta };
              if (p.meta) meta = p.meta;
              if (p.token) { acc += p.token; setStreamBuffer(acc); }
            } catch { /* skip */ }
          }
        }
        setMessages([...next, { role: "assistant", content: acc || copy("No answer was received.", "Ответ не был получен."), aiMeta: meta }]);
        setStreamBuffer("");
      } else {
        const j = (await res.json()) as { answer?: string; aiPowered?: boolean; limited?: boolean; reason?: string };
        setMessages([...next, {
          role: "assistant",
          content: j.answer ?? copy("No answer was received.", "Ответ не был получен."),
          aiMeta: { aiPowered: Boolean(j.aiPowered), limited: Boolean(j.limited), reason: j.reason },
        }]);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally { setStreaming(false); setStreamBuffer(""); }
  }, [input, messages, streaming, articleContext, attachedTrade, attachedImage, copy]);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (!prompt || initialPromptSentRef.current || !historyLoaded || streaming) return;
    initialPromptSentRef.current = true;
    void send(prompt);
  }, [initialPrompt, historyLoaded, streaming, send]);

  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    send(lastUser.content, messages.slice(0, messages.lastIndexOf(lastUser)));
  }, [messages, send]);

  const clearChat = () => { abortRef.current?.abort(); setMessages([]); setArtifactStates({}); setStreamBuffer(""); setError(null); localStorage.removeItem(STORAGE_KEY); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const hasInput = input.trim().length > 0;

  const setArtifactState = (key: string, state: ArtifactState) => {
    setArtifactStates((prev) => ({ ...prev, [key]: state }));
  };

  const createArtifact = async (
    kind: "note" | "playbook",
    content: string,
    key: string,
    source?: { question?: string; tradeId?: string }
  ) => {
    if (artifactStates[key] === "saving" || artifactStates[key] === "saved") return;
    setArtifactState(key, "saving");
    try {
      const res = await fetch("/api/ai/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          content,
          sourceQuestion: source?.question,
          sourceTradeId: source?.tradeId,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setArtifactState(key, "saved");
      toast(kind === "note" ? copy("Note created", "Заметка создана") : copy("Playbook created", "Плейбук создан"), "success");
    } catch {
      setArtifactState(key, "idle");
      toast(kind === "note" ? copy("Could not create note", "Не получилось создать заметку") : copy("Could not create playbook", "Не получилось создать плейбук"), "error");
    }
  };

  const previousUserContext = (messageIndex: number) => {
    for (let i = messageIndex - 1; i >= 0; i--) {
      const message = messages[i];
      if (message?.role === "user") {
        return {
          question: message.content,
          tradeId: message.attachedTrade?.id,
        };
      }
    }
    return undefined;
  };

  return (
    <div className="flex h-full flex-col bg-canvas">

      {/* ── Scroll area ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: 38, paddingBottom: 18 }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 28px", display: "flex", flexDirection: "column", gap: 34 }}>

          {/* ── Empty / Greeting state ── */}
          {messages.length === 0 && !streaming && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 border-b border-stroke pb-4">
                <AiAvatar />
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-[32px] font-bold leading-none tracking-normal text-ink">
                    <span className="font-serif italic font-normal" style={{ color: "var(--color-brand)" }}>Trevixe</span>
                    Lens
                    <span className="rounded border border-brand/25 bg-brand/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-brand">
                      {copy("Beta", "Бета")}
                    </span>
                  </h2>
                  <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-3">
                    {copy(
                      "Your personal trading mentor. It knows your journal and trades, and helps find mistakes without extra noise.",
                      "Твой персональный ментор по торговле. Знает журнал, сделки и помогает находить ошибки без лишнего шума."
                    )}
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 md:grid-cols-3">
                {PROMPT_CARDS.map(card => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.text.en}
                      onClick={() => send(card.text[lang])}
                      className="sage-prompt-card group flex min-h-[104px] flex-col gap-2 rounded-xl px-4 py-3.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-medium uppercase" style={{ color: card.catColor }}>
                        <Icon className="h-3.5 w-3.5" />
                        {card.cat[lang]}
                      </span>
                      <span className="text-[13.5px] font-medium leading-snug text-ink-2">
                        {card.text[lang]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          {messages.map((m, i) =>
            m.role === "user" ? (
              /* USER turn */
              <div key={i} style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {(m.attachedTrade || m.attachedImage) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                      {m.attachedTrade && <TradeChip trade={m.attachedTrade} />}
                      {m.attachedImage && (
                        <NextImage
                          src={m.attachedImage}
                          alt="screenshot"
                          width={192}
                          height={128}
                          unoptimized
                          style={{ maxHeight: 128, width: "auto", borderRadius: 12, border: "1px solid var(--color-stroke)", objectFit: "contain" }}
                        />
                      )}
                    </div>
                  )}
                  <div style={{
                    padding: "11px 16px", borderRadius: 16, borderBottomRightRadius: 6,
                    background: "var(--color-card)",
                    border: "1px solid var(--color-stroke-2)",
                    fontSize: 14.5, lineHeight: 1.55, color: "var(--color-ink)",
                  }}>
                    {m.content}
                  </div>
                </div>
                <UserAvatar />
              </div>
            ) : (
              /* AI turn */
              <div key={i} className="group" style={{ display: "flex", gap: 14 }}>
                <AiAvatar />
                <div style={{ flex: 1, minWidth: 0, paddingTop: 0, fontSize: 15, lineHeight: 1.72 }}>
                  <MarkdownContent content={m.content} />
                  <LimitedAnswerBadge meta={m.aiMeta} lang={lang} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ArtifactAction
                      icon={NotebookPen}
                      label={copy("Save to notes", "В заметки")}
                      state={artifactStates[`note-${i}`] ?? "idle"}
                      onClick={() => createArtifact("note", m.content, `note-${i}`, previousUserContext(i))}
                      lang={lang}
                    />
                    <ArtifactAction
                      icon={Target}
                      label={copy("Create playbook", "Создать плейбук")}
                      state={artifactStates[`playbook-${i}`] ?? "idle"}
                      onClick={() => createArtifact("playbook", m.content, `playbook-${i}`, previousUserContext(i))}
                      lang={lang}
                    />
                  </div>
                  {/* Action row */}
                  <div style={{ display: "flex", gap: 4, marginTop: 12, opacity: 0, transition: ".2s" }}
                    className="group-hover:opacity-100">
                    <CopyButton text={m.content} lang={lang} />
                    {i === messages.length - 1 && (
                      <button
                        onClick={regenerate}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md transition-all"
                        style={{ color: "var(--color-ink-4)" }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-2)")}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-4)")}
                        title={copy("Regenerate", "Повторить")}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── Typing indicator ── */}
          {streaming && (
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <AiAvatar pulse />
              <div style={{ flex: 1, minWidth: 0, paddingTop: 0, fontSize: 15, lineHeight: 1.72 }}>
                {streamBuffer ? (
                  <MarkdownContent content={streamBuffer} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "12px 16px",
                      background: "var(--color-card)", border: "1px solid var(--color-stroke)",
                      borderRadius: 14, borderBottomLeftRadius: 4,
                    }}>
                      {[0, 1, 2].map(idx => (
                        <span key={idx} style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: "#F07240", opacity: .4, display: "inline-block",
                          animation: "trevixe-typd 1.4s ease-in-out infinite",
                          animationDelay: `${idx * 0.2}s`,
                        }} />
                      ))}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 10.5, textTransform: "uppercase", color: "var(--color-ink-4)" }}>
                      {copy("Trevixe Lens is reading the journal...", "Trevixe Lens читает журнал…")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 18px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", fontSize: 13, color: "#F87171" }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Attachment preview strip ── */}
      {(attachedTrade || attachedImage) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 28px", borderTop: "1px solid var(--color-stroke)", background: "var(--color-canvas)" }}>
          {attachedTrade && <TradeChip trade={attachedTrade} onRemove={() => setAttachedTrade(null)} />}
          {attachedImage && (
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--color-card)", border: "1px solid var(--color-stroke)", color: "var(--color-ink-2)" }}>
              <ImageIcon className="h-3 w-3" style={{ color: "#F07240" }} />
              {attachedImageName || "screenshot"}
              <button onClick={() => { setAttachedImage(null); setAttachedImageName(""); }} style={{ color: "var(--color-ink-4)" }} className="ml-0.5 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Composer ── */}
      <div
        style={{
          padding: "0 28px 18px",
          position: "relative",
          zIndex: 1,
          background: "var(--color-canvas)",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto" }}>

          {/* Composer box */}
          <div
            className="composer-box"
            style={{
              background: "linear-gradient(180deg, var(--color-card) 0%, var(--color-card) 100%)",
              border: "1px solid var(--color-stroke-2)",
              borderRadius: 18, padding: 6,
              boxShadow: "none",
              transition: "border-color .2s, box-shadow .2s",
            }}
          >
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={copy("Ask about a setup, mistake, psychology, or your data...", "Спроси про сетап, ошибку, психологию или свои данные…")}
              disabled={streaming}
              style={{
                width: "100%", resize: "none", background: "transparent",
                border: "none", outline: "none", padding: "14px 12px 6px",
                fontSize: 14.5, lineHeight: 1.55, color: "var(--color-ink)",
                fontFamily: "inherit", maxHeight: 200,
              }}
            />

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 8px" }}>
              {/* Left: attach buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {/* Attach trade */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowTradePicker(v => !v)}
                    disabled={streaming}
                    title={copy("Attach trade", "Прикрепить трейд")}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, padding: "7px 11px",
                      borderRadius: 8, border: "1px solid var(--color-stroke)",
                      background: "transparent", color: "var(--color-ink-3)", fontSize: 12,
                      cursor: "pointer", transition: ".15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--color-tinted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <Paperclip style={{ width: 14, height: 14 }} />
                    {copy("Trade", "Трейд")}
                    <ChevronDown style={{ width: 11, height: 11 }} />
                  </button>
                  {showTradePicker && trades.length > 0 && (
                    <TradePicker trades={trades} onSelect={t => setAttachedTrade(t)} onClose={() => setShowTradePicker(false)} lang={lang} />
                  )}
                </div>

                {/* Attach image */}
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={streaming}
                  title={copy("Attach screenshot", "Прикрепить скриншот")}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "none",
                    background: "transparent", color: "var(--color-ink-3)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: ".15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--color-tinted)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-3)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <ImageIcon style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Right: clear + send */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    title={copy("Clear chat", "Очистить чат")}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: "none",
                      background: "transparent", color: "var(--color-ink-4)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: ".15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,.06)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-ink-4)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}

                {/* Send */}
                <button
                  onClick={() => send()}
                  disabled={streaming || !hasInput}
                  aria-label={copy("Send message", "Отправить сообщение")}
                  style={{
                    width: 36, height: 36, borderRadius: 9, border: "none",
                    background: hasInput && !streaming ? "#F07240" : "var(--color-tinted)",
                    color: hasInput && !streaming ? "#fff" : "var(--color-ink-4)",
                    cursor: hasInput && !streaming ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: hasInput && !streaming ? "0 4px 12px rgba(240,114,64,.3)" : "none",
                    transition: ".15s", transform: "translateY(0)",
                  }}
                  onMouseEnter={e => { if (hasInput && !streaming) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
                >
                  {streaming
                    ? <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin 1s linear infinite", display: "inline-block" }} />
                    : <Send style={{ width: 15, height: 15 }} />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Typing dots animation */}
      <style>{`
        @keyframes trevixe-typd {
          0%,80%,100% { opacity:.3; transform:translateY(0); }
          40%          { opacity:1;  transform:translateY(-3px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
        .sage-prompt-card {
          background:
            linear-gradient(145deg, rgba(255,255,255,.038), rgba(255,255,255,.016));
          border: 1px solid var(--color-stroke);
          box-shadow:
            0 4px 12px rgba(0,0,0,.18),
            inset 0 1px 0 rgba(255,255,255,.035);
          transition:
            background-color .16s ease,
            border-color .16s ease,
            box-shadow .16s ease,
            transform .16s ease;
        }
        .sage-prompt-card:hover,
        .sage-prompt-card:focus-visible {
          background:
            linear-gradient(140deg, rgba(240,114,64,.07), rgba(255,255,255,.018));
          border-color: rgba(240,114,64,.34);
          box-shadow:
            0 6px 14px rgba(0,0,0,.20),
            0 0 0 1px rgba(240,114,64,.08),
            inset 0 1px 0 rgba(255,255,255,.045);
          transform: translateY(-1px);
          outline: none;
        }
        .sage-prompt-card:active {
          background:
            linear-gradient(140deg, rgba(240,114,64,.12), rgba(255,255,255,.02));
          border-color: rgba(240,114,64,.48);
          box-shadow:
            0 2px 8px rgba(0,0,0,.18),
            0 0 0 3px rgba(240,114,64,.07),
            inset 0 1px 2px rgba(0,0,0,.18);
          transform: translateY(0) scale(.985);
        }
      `}</style>
    </div>
  );
}
