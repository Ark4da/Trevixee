import { prisma } from "@/lib/db";
import { requireCapability } from "@/lib/guards";
import { chat, extractJson, isOpenRouterEnabled, OpenRouterRequestError } from "@/lib/openrouter";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

type ArtifactKind = "note" | "playbook";
type RuleType = "entry" | "exit" | "risk" | "general";

interface ArtifactRequest {
  kind?: ArtifactKind;
  content?: string;
  sourceQuestion?: string;
  sourceTradeId?: string;
}

interface NoteDraft {
  title: string;
  category: "lesson" | "rule" | "idea" | "mistake" | "general";
  content: string;
  tags?: string;
}

interface PlaybookDraft {
  name: string;
  description: string;
  market?: string;
  timeframe?: string | null;
  tags?: string;
  rules: Array<{ type: RuleType; text: string }>;
}

const RULE_TYPES = new Set<RuleType>(["entry", "exit", "risk", "general"]);
const ARTIFACT_AI_TIMEOUT_MS = 4500;

export async function POST(req: NextRequest) {
  const gate = await requireCapability("canUseAiTradeReview");
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;
  const limited = rateLimit(req, { key: `ai:artifacts:${userId}`, limit: 30, windowMs: 60 * 60_000 });
  if (limited) return limited;

  let body: ArtifactRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind;
  const content = String(body.content ?? "").trim().slice(0, 12000);
  if (kind !== "note" && kind !== "playbook") {
    return NextResponse.json({ error: "Invalid artifact kind" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "Empty content" }, { status: 400 });
  }

  if (kind === "note") {
    const draft = await buildNoteDraft(content, body.sourceQuestion);
    const note = await prisma.note.create({
      data: {
        userId,
        title: draft.title,
        content: draft.content,
        category: draft.category,
        tags: draft.tags || "ai,lens,analysis",
        isPinned: false,
      },
    });
    if (body.sourceTradeId) {
      await linkNoteToTrade({
        userId,
        noteId: note.id,
        tradeId: body.sourceTradeId,
      });
    }
    return NextResponse.json({ kind, artifact: note }, { status: 201 });
  }

  const draft = await buildPlaybookDraft(content, body.sourceQuestion);
  const playbook = await prisma.playbook.create({
    data: {
      userId,
      name: draft.name,
      description: draft.description,
      market: draft.market || "futures",
      timeframe: draft.timeframe || null,
      tags: draft.tags || "ai,lens,generated",
      isActive: true,
      isReadOnly: false,
      rules: {
        create: draft.rules.map((rule, i) => ({
          type: rule.type,
          text: rule.text,
          sortOrder: i,
        })),
      },
    },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ kind, artifact: playbook }, { status: 201 });
}

async function linkNoteToTrade({ userId, noteId, tradeId }: { userId: string; noteId: string; tradeId: string }) {
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
    select: { id: true },
  });
  if (!trade) return;

  const existing = await prisma.notebookLink.findFirst({
    where: { userId, noteId, tradeId, journalId: null },
    select: { id: true },
  });
  if (existing) return;

  await prisma.notebookLink.create({
    data: { userId, noteId, tradeId, journalId: null },
  });
}

async function buildNoteDraft(content: string, sourceQuestion?: string): Promise<NoteDraft> {
  // Notebook needs to feel instant and should be a compact digest, not a second AI answer.
  // The deterministic condenser is faster and avoids copying the original response verbatim.
  void sourceQuestion;
  return fallbackNoteDraft(content);
}

async function buildPlaybookDraft(content: string, sourceQuestion?: string): Promise<PlaybookDraft> {
  if (isOpenRouterEnabled()) {
    try {
      const raw = await chatWithTimeout({
        json: true,
        temperature: 0.15,
        maxTokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You convert a trading analysis into a real trading playbook. " +
              "Return strict JSON only: {\"name\":string,\"description\":string,\"market\":string,\"timeframe\":string|null,\"tags\":string,\"rules\":[{\"type\":\"entry\"|\"exit\"|\"risk\"|\"general\",\"text\":string}]}. " +
              "Do not copy the whole answer. Extract actionable rules only. Rules must be concise, testable, and operational. Use the same language as the source.",
          },
          {
            role: "user",
            content: JSON.stringify({ sourceQuestion, analysis: content }),
          },
        ],
      }, ARTIFACT_AI_TIMEOUT_MS);
      const parsed = extractJson<Partial<PlaybookDraft>>(raw);
      const normalized = normalizePlaybookDraft(parsed, content);
      if (normalized) return normalized;
    } catch (err) {
      if (!(err instanceof OpenRouterRequestError && err.isTransient)) {
        console.error("[ai/artifacts] playbook builder failed", err);
      }
    }
  }

  return fallbackPlaybookDraft(content);
}

async function chatWithTimeout(opts: Parameters<typeof chat>[0], timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await chat({ ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePlaybookDraft(draft: Partial<PlaybookDraft> | null, source: string): PlaybookDraft | null {
  if (!draft) return null;
  const name = cleanText(draft.name).slice(0, 90);
  const rules = Array.isArray(draft.rules)
    ? draft.rules
        .map((rule) => ({
          type: RULE_TYPES.has(rule.type) ? rule.type : classifyRule(rule.text),
          text: cleanText(rule.text).slice(0, 240),
        }))
        .filter((rule) => rule.text.length >= 12)
        .slice(0, 10)
    : [];

  if (!name || rules.length === 0) return null;

  return {
    name,
    description: cleanText(draft.description).slice(0, 700) || fallbackPlaybookDescription(source),
    market: cleanText(draft.market || "futures") || "futures",
    timeframe: draft.timeframe ? cleanText(draft.timeframe).slice(0, 40) : null,
    tags: cleanTags(draft.tags) || "ai,lens,generated",
    rules,
  };
}

function fallbackNoteDraft(content: string): NoteDraft {
  const title = artifactTitle(content);
  return {
    title: `AI: ${title}`,
    category: inferNoteCategory(content),
    tags: "ai,lens,analysis",
    content: condensedNoteContent(content),
  };
}

function fallbackPlaybookDraft(content: string): PlaybookDraft {
  const rules = extractRules(content);
  return {
    name: artifactTitle(content),
    description: fallbackPlaybookDescription(content),
    market: "futures",
    timeframe: null,
    tags: "ai,lens,generated",
    rules: rules.length > 0 ? rules : [{ type: "general", text: firstUsefulSentence(content) || "Review this AI analysis before taking the setup." }],
  };
}

function fallbackPlaybookDescription(content: string) {
  return [
    "Создано из анализа Trevixe Lens.",
    "",
    cleanText(content).slice(0, 420),
  ].join("\n");
}

function extractRules(content: string): PlaybookDraft["rules"] {
  const sections = splitSections(content);
  const sectionRules = sections.flatMap((section) => {
    const titleType = classifyRule(section.title);
    return section.body
      .map(stripListPrefix)
      .map(cleanText)
      .filter((line) => isActionable(line))
      .map((text) => ({
        type: titleType === "general" ? classifyRule(text) : titleType,
        text: text.slice(0, 240),
      }));
  });

  const sentenceRules = cleanText(content)
    .split(/[.!?]\s+/)
    .map(cleanText)
    .filter(isActionable)
    .map((text) => ({ type: classifyRule(text), text: text.slice(0, 240) }));

  const source = sectionRules.length > 0 ? sectionRules : sentenceRules;
  const seen = new Set<string>();
  return source.filter((rule) => {
    const key = rule.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function splitSections(content: string) {
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | null = null;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,3}\s+(.+)/)?.[1] || line.match(/^\*\*([^*]+)\*\*:?$/)?.[1];
    if (heading) {
      current = { title: cleanText(heading), body: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "general", body: [] };
      sections.push(current);
    }
    current.body.push(line);
  }

  return sections;
}

function stripListPrefix(line: string) {
  return line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
}

function isActionable(text: string) {
  return text.length >= 18 && !/^что говорят|^анализ|^вывод/i.test(text);
}

function classifyRule(text = ""): RuleType {
  const t = text.toLowerCase();
  if (/(risk|риск|стоп|stop|loss|убыт|просад|размер|позици|лимит)/.test(t)) return "risk";
  if (/(exit|выход|закр|тейк|take|tp|фикс|прибыл)/.test(t)) return "exit";
  if (/(entry|вход|сетап|setup|confirm|подтвержд|услов|паттерн|trigger)/.test(t)) return "entry";
  return "general";
}

function inferNoteCategory(text: string): NoteDraft["category"] {
  const t = text.toLowerCase();
  if (/(ошиб|mistake|наруш|revenge|убыт)/.test(t)) return "mistake";
  if (/(правил|rule|playbook|нельзя|всегда|только)/.test(t)) return "rule";
  if (/(идея|idea|гипотез)/.test(t)) return "idea";
  return "lesson";
}

function artifactTitle(content: string) {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => /^#{1,3}\s+/.test(line));
  const source = heading?.replace(/^#{1,3}\s+/, "") || lines.find((line) => !/^[-*•]|\d+\./.test(line)) || "AI analysis";
  return cleanText(source).slice(0, 72) || "AI analysis";
}

function firstUsefulSentence(content: string) {
  return cleanText(content).split(/[.!?]\s+/).find((line) => line.length > 24)?.slice(0, 220) || "";
}

function condensedNoteContent(source: string) {
  const title = artifactTitle(source);
  const sentences = uniqueLines(
    cleanText(source)
      .split(/[.!?]\s+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 24)
  );
  const bulletLines = uniqueLines(
    source
      .split("\n")
      .map((line) => cleanText(stripListPrefix(line.trim())))
      .filter((line) => line.length >= 18)
  );

  const takeaway = sentences[0] || title;
  const evidence = rankImportant([...bulletLines, ...sentences]).slice(0, 3);
  const actions = rankActions([...bulletLines, ...sentences]).slice(0, 3);

  return [
    "## Ключевой вывод",
    takeaway,
    "",
    "## Почему важно",
    ...(evidence.length ? evidence : [title]).map((line) => `- ${line}`),
    "",
    "## Что сделать",
    ...(actions.length ? actions : [
      "Проверить этот вывод на последних сделках в журнале.",
      "Если паттерн повторяется, оформить его как правило playbook.",
    ]).map((line) => `- ${line}`),
  ].join("\n").slice(0, 1400);
}

function rankImportant(lines: string[]) {
  return uniqueLines(lines)
    .filter((line) => /\d|%|\$|R\b|win|loss|p\/l|сетап|риск|убыт|прибыл|сделк|данн/i.test(line))
    .sort((a, b) => scoreImportance(b) - scoreImportance(a));
}

function rankActions(lines: string[]) {
  return uniqueLines(lines)
    .filter((line) => /(нужно|сделай|проверь|перестань|избегай|добавь|правило|следующ|only|check|avoid|stop|add|rule)/i.test(line))
    .sort((a, b) => scoreImportance(b) - scoreImportance(a));
}

function scoreImportance(line: string) {
  let score = 0;
  if (/\d|%|\$|R\b/.test(line)) score += 3;
  if (/(риск|убыт|ошиб|наруш|прибыл|win|loss|risk|mistake)/i.test(line)) score += 2;
  if (/(нужно|проверь|правило|следующ|check|rule|avoid|stop)/i.test(line)) score += 2;
  score += Math.min(line.length / 80, 2);
  return score;
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const normalized = line.toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTags(value: unknown) {
  return cleanText(value)
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8)
    .join(",");
}
