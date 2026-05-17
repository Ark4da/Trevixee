/**
 * OpenRouter client. Uses a stable free model first and OpenRouter's free router as fallback.
 * Free models are rate-limited and availability can change, so fallback routing keeps requests resilient.
 *
 * Env:
 *   OPENROUTER_API_KEY  — required, get one at https://openrouter.ai/keys
 *   OPENROUTER_MODEL             - optional, e.g. "openrouter/owl-alpha"
 *   OPENROUTER_FALLBACK_MODELS   - optional comma list, e.g. "openrouter/free"
 *   OPENROUTER_VISION_MODEL      - optional image-capable model, defaults to "openrouter/free"
 */

export type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
};

const DEFAULT_MODEL = "openrouter/owl-alpha";
const DEFAULT_FALLBACK_MODELS = ["openrouter/free"];
const DEFAULT_VISION_MODEL = "openrouter/free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TRANSIENT_ATTEMPTS = 2;

export class OpenRouterDisabledError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not configured");
    this.name = "OpenRouterDisabledError";
  }
}

export class OpenRouterRequestError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`OpenRouter ${status}: ${body.slice(0, 300)}`);
    this.name = "OpenRouterRequestError";
    this.status = status;
    this.body = body;
  }

  get isTransient(): boolean {
    return this.status === 408 || this.status === 409 || this.status === 425 || this.status === 429 || this.status >= 500;
  }
}

export function isOpenRouterEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  needsVision?: boolean;
  signal?: AbortSignal;
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  needsVision?: boolean;
  signal?: AbortSignal;
}

export class OpenRouterInvalidJsonError extends Error {
  constructor() {
    super("OpenRouter returned invalid JSON");
    this.name = "OpenRouterInvalidJsonError";
  }
}

function parseModelList(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function getConfiguredModels(needsVision = false): string[] {
  if (needsVision) {
    return [process.env.OPENROUTER_VISION_MODEL || DEFAULT_VISION_MODEL];
  }

  const models = [
    process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    ...(
      process.env.OPENROUTER_FALLBACK_MODELS
        ? parseModelList(process.env.OPENROUTER_FALLBACK_MODELS)
        : DEFAULT_FALLBACK_MODELS
    ),
  ];
  return [...new Set(models)];
}

function requestHeaders(key: string, referer: string) {
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": "Trevixe",
  };
}

async function postOpenRouter(
  key: string,
  referer: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: OpenRouterRequestError | null = null;

  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: requestHeaders(key, referer),
      body: JSON.stringify(body),
      signal,
    });

    if (res.ok) return res;

    const text = await res.text().catch(() => "");
    const err = new OpenRouterRequestError(res.status, text);
    if (!err.isTransient || attempt === MAX_TRANSIENT_ATTEMPTS || signal?.aborted) {
      throw err;
    }
    lastError = err;
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  throw lastError ?? new OpenRouterRequestError(500, "OpenRouter request failed");
}

function withJsonRepair(messages: ChatMessage[], invalidContent: string): ChatMessage[] {
  return [
    ...messages,
    { role: "assistant", content: invalidContent.slice(0, 2000) },
    {
      role: "user",
      content: "The previous response was not valid JSON. Return only valid JSON matching the requested shape. No markdown, no prose.",
    },
  ];
}

function shouldTryNextModel(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false;
  if (!(err instanceof OpenRouterRequestError)) return false;
  return err.status !== 401 && err.status !== 403;
}

export async function chatStream(opts: ChatStreamOptions): Promise<ReadableStream<string>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new OpenRouterDisabledError();

  const referer = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const baseBody: Record<string, unknown> = {
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 500,
    stream: true,
  };

  let res: Response | null = null;
  let lastError: unknown = null;
  const models = getConfiguredModels(opts.needsVision);
  for (const model of models) {
    try {
      res = await postOpenRouter(key, referer, { ...baseBody, model }, opts.signal);
      break;
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModel(err, opts.signal)) throw err;
    }
  }
  if (!res) throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) controller.enqueue(token);
          } catch { /* skip malformed */ }
        }
      }
    },
    cancel() { reader.cancel(); },
  });
}

export async function chat(opts: ChatOptions): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new OpenRouterDisabledError();

  const referer = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const models = getConfiguredModels(opts.needsVision);
  let messages = opts.messages;
  let temperature = opts.temperature ?? 0.4;
  let lastError: unknown = null;
  let invalidContent = "";

  for (let repairAttempt = 0; repairAttempt < 2; repairAttempt++) {
    invalidContent = "";

    for (const model of models) {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: opts.maxTokens ?? 700,
      };
      if (opts.json) body.response_format = { type: "json_object" };

      try {
        const res = await postOpenRouter(key, referer, body, opts.signal);
        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error("OpenRouter returned no content");
          continue;
        }
        if (!opts.json || extractJson(content) !== null) return content;

        invalidContent = content;
        lastError = new OpenRouterInvalidJsonError();
      } catch (err) {
        lastError = err;
        if (!shouldTryNextModel(err, opts.signal)) throw err;
      }
    }

    if (!opts.json || !invalidContent) {
      break;
    }
    messages = withJsonRepair(opts.messages, invalidContent);
    temperature = 0;
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
}

/** Extract first JSON object/array substring from a string (Gemma sometimes wraps in fences). */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = Math.min(
    ...[candidate.indexOf("{"), candidate.indexOf("[")].filter((i) => i >= 0),
  );
  if (!Number.isFinite(start) || start < 0) {
    try { return JSON.parse(candidate.trim()) as T; } catch { return null; }
  }
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)) as T; } catch { return null; }
}
