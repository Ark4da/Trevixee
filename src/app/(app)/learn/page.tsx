"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  BookOpen, Target, BarChart2, Lightbulb, Clock, ChevronLeft,
  CheckCircle, TrendingDown, AlertTriangle, Star, Flame,
  Timer, Brain, Gauge, TrendingUp, Award, CalendarDays, ListChecks,
  ShieldCheck, Compass, Activity, Link2, RotateCcw, Flag, ClipboardCheck,
  Library, CheckSquare, MessageCircle, Search,
} from "lucide-react";
import { CATEGORIES, ARTICLES, type Article } from "@/lib/education-content";
import { articleAuthor, articleBody, articleQuote, articleTitle, categoryLabel } from "@/lib/education-i18n";
import { useStats, type StatsData } from "@/hooks/use-trades";
import { PaywallCard } from "@/components/billing/paywall-card";
import { useAppStore } from "@/store";

const SAGE  = "#22C55E";
const BRICK = "#EF4444";
const AMBER = "#B08050";
const MUTED_SCORE = "#7A7068";

const AiLearnChat = dynamic(
  () => import("@/components/ai/ai-learn-chat").then((mod) => mod.AiLearnChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-canvas text-sm text-ink-5">
        Загружаю ментора...
      </div>
    ),
  }
);

type LearnStats = Partial<StatsData>;

type CurriculumPriority = "high" | "medium" | "low";

type CurriculumItem = {
  id: string;
  title: string;
  summary: string;
  metric: string;
  metricValue: string;
  nextAction: string;
  articles: string[];
  color: string;
  icon: React.ElementType;
  priority: CurriculumPriority;
};

type LessonPlanItem = {
  day: number;
  title: string;
  focus: string;
  action: string;
  successMetric: string;
  articleId?: string;
};

type SkillScore = {
  id: string;
  label: string;
  score: number;
  detail: string;
  action: string;
  color: string;
  icon: React.ElementType;
};

type ArticlePractice = {
  idea: string;
  exercise: string;
  successMetric: string;
};

type LearningSnapshot = {
  readCount: number;
  practiceCount: number;
  appliedCount: number;
  completedDays: number[];
  adoptedMistakes: string[];
};

type MistakeItem = {
  id: string;
  title: string;
  signal: string;
  catchRule: string;
  drill: string;
  articleId: string;
  icon: React.ElementType;
  color: string;
};

type RecoveryStep = {
  id: string;
  title: string;
  body: string;
};

const EMPTY_LEARNING_SNAPSHOT: LearningSnapshot = {
  readCount: 0,
  practiceCount: 0,
  appliedCount: 0,
  completedDays: [],
  adoptedMistakes: [],
};

const priorityRank: Record<CurriculumPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const BENCHMARKS = {
  winRate: 48,
  avgRMultiple: 1.4,
  profitFactor: 1.5,
};

const DAY_MS = 86_400_000;
const WEEK_MS = DAY_MS * 7;
const PLAN_COMPLETION_KEY = "learn-plan-completed-days-v1";
const MISTAKE_RULES_KEY = "learn-adopted-mistakes-v1";
const LEARNING_EVENT = "learn-progress-change";

const MISTAKE_LIBRARY: MistakeItem[] = [
  {
    id: "fomo-entry",
    title: "FOMO-вход",
    signal: "Вход после резкой свечи без заранее отмеченного уровня отмены идеи.",
    catchRule: "Если сетап появился только после движения, сделка переносится в watchlist, а не в рынок.",
    drill: "Зафиксируй 3 пропущенных движения и проверь, сколько из них дали нормальный R:R после отката.",
    articleId: "fomo-kills-traders",
    icon: Flame,
    color: BRICK,
  },
  {
    id: "revenge-trade",
    title: "Реванш-сделка",
    signal: "Следующая сделка открывается быстрее обычного после убытка.",
    catchRule: "После любого убытка 10 минут паузы и повторный чек-лист входа.",
    drill: "Отметь 5 убыточных сделок и посмотри, была ли следующая сделка качественной или импульсивной.",
    articleId: "psychology-of-loss",
    icon: RotateCcw,
    color: BRICK,
  },
  {
    id: "early-exit",
    title: "Ранний выход",
    signal: "Прибыль закрывается до плана, а убыток получает больше времени.",
    catchRule: "До входа записывается точка частичной фиксации и условие полного выхода.",
    drill: "Раздели последние 10 прибыльных сделок на: выход по плану, выход от страха, выход без причины.",
    articleId: "cut-losses-let-profits-run",
    icon: Timer,
    color: AMBER,
  },
  {
    id: "moved-stop",
    title: "Двинул стоп",
    signal: "Стоп переносится дальше от входа после того, как идея уже сломалась.",
    catchRule: "Стоп можно двигать только в сторону уменьшения риска.",
    drill: "Найди сделки, где фактический убыток больше планового R, и выпиши общий триггер.",
    articleId: "risk-management-only-control",
    icon: ShieldCheck,
    color: BRICK,
  },
  {
    id: "overtrading",
    title: "Овертрейдинг",
    signal: "Количество сделок растёт, а качество заметок и R:R падает.",
    catchRule: "Лимит: 3 сделки в день или стоп после 2 ошибок процесса.",
    drill: "Сравни первые 3 сделки дня со всеми последующими по avg R и качеству исполнения.",
    articleId: "best-trading-sessions",
    icon: Activity,
    color: AMBER,
  },
  {
    id: "missing-review",
    title: "Нет вывода после сделки",
    signal: "Сделка закрыта, но в журнале нет причины выхода и урока.",
    catchRule: "Сделка не считается завершённой, пока не записан один проверяемый вывод.",
    drill: "Заполни уроки по последним 5 сделкам и выбери одно правило на следующую сессию.",
    articleId: "trading-journal-best-teacher",
    icon: ClipboardCheck,
    color: SAGE,
  },
];

const RECOVERY_STEPS: RecoveryStep[] = [
  {
    id: "cooldown",
    title: "Пауза 20 минут",
    body: "Никаких новых входов, пока эмоция после убытка не стала нейтральной.",
  },
  {
    id: "risk-down",
    title: "Риск вдвое ниже",
    body: "Следующая разрешённая сделка открывается только с уменьшенным риском.",
  },
  {
    id: "one-setup",
    title: "Один сетап",
    body: "Торгуется только заранее описанный сетап, без импровизации.",
  },
  {
    id: "post-note",
    title: "Заметка до входа",
    body: "Перед сделкой записывается причина входа, стоп и что отменяет идею.",
  },
];

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const formatPercent = (value: number | undefined) => `${Math.round((value ?? 0) * 10) / 10}%`;
const formatR = (value: number | undefined) => `${Math.round((value ?? 0) * 100) / 100}R`;
const formatMoneyMetric = (value: number | undefined) => {
  const n = Math.round((value ?? 0) * 100) / 100;
  return n > 0 ? `+$${n}` : `-$${Math.abs(n)}`;
};

const formatScore = (score: number) => `${Math.round(score)}/100`;

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function rotateBySeed<T>(items: T[], seed: number) {
  if (items.length === 0) return [];
  const offset = ((seed % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function useRefreshCycle() {
  return useState(() => {
    const now = new Date();
    return {
      dayIndex: Math.floor(now.getTime() / DAY_MS),
      weekIndex: Math.floor(now.getTime() / WEEK_MS),
      label: now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
    };
  })[0];
}

function readArticleIds() {
  if (typeof window === "undefined") return [];
  return ARTICLES.filter((article) => localStorage.getItem(`learn-read-${article.id}`) === "1").map((article) => article.id);
}

function readStoredList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredList(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(uniqueIds(values)));
  window.dispatchEvent(new Event(LEARNING_EVENT));
}

function getLearningSnapshot(): LearningSnapshot {
  if (typeof window === "undefined") {
    return EMPTY_LEARNING_SNAPSHOT;
  }

  return {
    readCount: ARTICLES.filter((a) => localStorage.getItem(`learn-read-${a.id}`) === "1").length,
    practiceCount: ARTICLES.filter((a) => localStorage.getItem(`learn-practice-${a.id}`) === "1").length,
    appliedCount: ARTICLES.filter((a) => localStorage.getItem(`learn-applied-${a.id}`) === "1").length,
    completedDays: readStoredList(PLAN_COMPLETION_KEY).map(Number).filter((day) => Number.isFinite(day)),
    adoptedMistakes: readStoredList(MISTAKE_RULES_KEY),
  };
}

function useLearningSnapshot() {
  const raw = React.useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(LEARNING_EVENT, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(LEARNING_EVENT, callback);
      };
    },
    () => JSON.stringify(getLearningSnapshot()),
    () => JSON.stringify(EMPTY_LEARNING_SNAPSHOT)
  );

  return React.useMemo(() => JSON.parse(raw) as LearningSnapshot, [raw]);
}

function getRecoveryKey(stepId: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `learn-recovery-${day}-${stepId}`;
}

function getRecoverySnapshot() {
  if (typeof window === "undefined") return [];
  return RECOVERY_STEPS.filter((step) => localStorage.getItem(getRecoveryKey(step.id)) === "1").map((step) => step.id);
}

function useRecoverySnapshot() {
  const raw = React.useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(LEARNING_EVENT, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(LEARNING_EVENT, callback);
      };
    },
    () => JSON.stringify(getRecoverySnapshot()),
    () => "[]"
  );

  return React.useMemo(() => JSON.parse(raw) as string[], [raw]);
}

function shouldShowRecovery(stats: LearnStats | null | undefined) {
  return (stats?.currentLossStreak ?? 0) >= 2 || (stats?.maxConsecutiveLosses ?? 0) >= 4 || (stats?.avgRMultiple ?? 0) < 0;
}

function getMistakePriority(stats: LearnStats | null | undefined, curriculum: CurriculumItem[]) {
  const ids = new Set<string>();
  const avgR = stats?.avgRMultiple ?? 0;
  const winRate = stats?.winRate ?? 0;
  const currentLossStreak = stats?.currentLossStreak ?? 0;

  if (currentLossStreak >= 2) ids.add("revenge-trade");
  if (winRate < 45) ids.add("fomo-entry");
  if (avgR < 0.5) ids.add("early-exit");
  if ((stats?.profitFactor ?? 0) > 0 && (stats?.profitFactor ?? 0) < 1.2) ids.add("moved-stop");
  if ((stats?.totalTrades ?? 0) >= 10) ids.add("overtrading");
  if (curriculum.some((item) => item.id === "hold-duration")) ids.add("early-exit");

  return [
    ...MISTAKE_LIBRARY.filter((mistake) => ids.has(mistake.id)),
    ...MISTAKE_LIBRARY.filter((mistake) => !ids.has(mistake.id)),
  ].slice(0, 4);
}

function getArticleTitle(id: string, lang: "en" | "ru") {
  const article = ARTICLES.find((a) => a.id === id);
  return article ? articleTitle(article, lang) : id;
}

function getArticlePractice(id: string): ArticlePractice {
  const practices: Record<string, ArticlePractice> = {
    "discipline-over-strategy": {
      idea: "Одна серия сделок важнее одной сделки.",
      exercise: "Выбери один сетап и опиши 5 условий, без которых вход запрещён.",
      successMetric: "Следующие 5 сделок имеют заметку: правило соблюдено или нарушено.",
    },
    "cut-losses-let-profits-run": {
      idea: "Большая прибыль появляется не на входе, а на удержании победителей.",
      exercise: "Разбери последние 10 выходов и отметь, где прибыль закрылась раньше плана.",
      successMetric: "Для следующих 3 сделок заранее записан план частичной фиксации и трейла.",
    },
    "risk-management-only-control": {
      idea: "Ты не контролируешь рынок, но полностью контролируешь размер риска.",
      exercise: "Перед следующей сделкой посчитай риск в R и проверь, что он не превышает лимит.",
      successMetric: "Ни одна новая сделка не открыта без стопа и расчёта R.",
    },
    "fomo-kills-traders": {
      idea: "Пропущенное движение не является убытком.",
      exercise: "Запиши одну сделку, которую ты сознательно пропустил, и причину пропуска.",
      successMetric: "Есть минимум 1 пропущенный вход, который соответствовал твоему анти-FOMO правилу.",
    },
    "trading-journal-best-teacher": {
      idea: "Без записей опыт не превращается в улучшение.",
      exercise: "Добавь к последним сделкам причину входа, причину выхода и урок.",
      successMetric: "5 последних сделок имеют вывод, который можно проверить на следующей неделе.",
    },
    "trading-plan-ignored": {
      idea: "План нужен, чтобы не принимать ключевые решения в моменте.",
      exercise: "Сократи торговый план до одной страницы: рынок, время, сетап, риск, стоп торговли.",
      successMetric: "Перед входом можно за 30 секунд проверить, разрешена ли сделка.",
    },
    "psychology-of-loss": {
      idea: "После убытка мозг сильнее тянет к реваншу, чем к качественному решению.",
      exercise: "Создай ритуал после убыточной сделки: пауза, заметка, повторная проверка условий.",
      successMetric: "После каждого убытка есть отметка о паузе или причина, почему торговля продолжилась.",
    },
    "r-multiple-thinking": {
      idea: "Доллары без контекста риска не показывают качество торговли.",
      exercise: "Пересчитай последние 10 сделок в R и найди средний результат.",
      successMetric: "Следующая сделка имеет плановый R:R до входа и фактический R после выхода.",
    },
    "best-trading-sessions": {
      idea: "Торговать меньше, но в правильное время часто прибыльнее.",
      exercise: "Найди 2 лучших и 2 худших торговых часа в своей статистике.",
      successMetric: "На следующую неделю выбран временной фильтр: когда торговать и когда не торговать.",
    },
    "beginner-mistakes": {
      idea: "Большие просадки чаще складываются из повторяемых простых ошибок.",
      exercise: "Отметь 3 ошибки из списка, которые чаще всего появляются в твоём журнале.",
      successMetric: "Для каждой ошибки есть одно правило защиты перед следующей торговой сессией.",
    },
    "pre-market-routine": {
      idea: "Сессия становится спокойнее, когда главные решения приняты до движения цены.",
      exercise: "Перед следующей сессией запиши watchlist, ключевой уровень, дневной риск и один разрешённый сетап.",
      successMetric: "Первая сделка дня совпадает с заранее подготовленной картой.",
    },
    "daily-loss-limit": {
      idea: "Главная задача плохого дня — не дать ему стать катастрофой.",
      exercise: "Выбери дневной стоп в R или процентах и добавь второе условие остановки по ошибкам процесса.",
      successMetric: "После достижения лимита нет новых сделок в этот день.",
    },
    "news-volatility-filter": {
      idea: "Новость меняет условия сетапа, даже если график выглядит знакомо.",
      exercise: "Отметь в календаре ближайшие high-impact события и сравни сделки рядом с ними с обычными.",
      successMetric: "Новые сделки не открываются в запрещённом окне перед новостью.",
    },
    "liquidity-spread-costs": {
      idea: "Плохое исполнение может съесть преимущество ещё до движения к стопу.",
      exercise: "Проверь последние 20 сделок: комиссии, спред и проскальзывание как долю результата.",
      successMetric: "В watchlist остаются только инструменты с приемлемым спредом и объёмом.",
    },
    "weekly-review-loop": {
      idea: "Улучшение появляется после разбора, а не после самого факта торговли.",
      exercise: "Сделай недельный разбор по пяти пунктам: лучший R, худший источник потерь, ошибка, эмоция, правило недели.",
      successMetric: "На следующую неделю выбрано одно измеримое правило процесса.",
    },
  };

  return practices[id] ?? {
    idea: "Один маленький вывод должен изменить следующее торговое решение.",
    exercise: "Запиши одну мысль из урока и где она появится в твоём процессе.",
    successMetric: "Следующая сделка или дневник содержит проверяемый вывод из урока.",
  };
}

function buildCurriculum(stats: LearnStats | null | undefined): CurriculumItem[] {
  if (!stats || (stats.totalTrades ?? 0) < 5) return [];

  const items: CurriculumItem[] = [];
  const totalTrades = stats.totalTrades ?? 0;
  const winRate = stats.winRate ?? 0;
  const avgRMultiple = stats.avgRMultiple ?? 0;
  const profitFactor = stats.profitFactor ?? 0;
  const currentLossStreak = stats.currentLossStreak ?? 0;
  const maxConsecutiveLosses = stats.maxConsecutiveLosses ?? 0;
  const avgWinDuration = stats.avgWinDuration ?? 0;
  const avgLossDuration = stats.avgLossDuration ?? 0;

  if (currentLossStreak >= 3 || maxConsecutiveLosses >= 4) {
    items.push({
      id: "loss-streak",
      title: "Стабилизируйся после серии убытков",
      summary: "Серия потерь повышает риск реванш-сделок и нарушения размера позиции.",
      metric: currentLossStreak >= 3 ? "Текущая серия" : "Макс. серия",
      metricValue: `${Math.max(currentLossStreak, maxConsecutiveLosses)} убытка подряд`,
      nextAction: "Следующие 3 сделки открывай только после чек-листа и с риском не выше 0.5-1R.",
      articles: ["discipline-over-strategy", "beginner-mistakes"],
      color: BRICK,
      icon: Flame,
      priority: "high",
    });
  }

  if (winRate < 45) {
    items.push({
      id: "entry-quality",
      title: "Отфильтруй слабые входы",
      summary: "Низкий win rate чаще говорит не о плохом рынке, а о лишних входах вне понятного сетапа.",
      metric: "Win rate",
      metricValue: formatPercent(winRate),
      nextAction: "На неделю оставь 1-2 сетапа и пропускай входы без заранее заданного уровня отмены идеи.",
      articles: ["discipline-over-strategy", "beginner-mistakes"],
      color: BRICK,
      icon: TrendingDown,
      priority: "high",
    });
  }

  if (avgRMultiple < 0) {
    items.push({
      id: "negative-expectancy",
      title: "Верни систему в положительное ожидание",
      summary: "Средний результат сделки отрицательный, значит серия сделок статистически тянет счет вниз.",
      metric: "Avg R",
      metricValue: formatR(avgRMultiple),
      nextAction: "Перед каждым входом фиксируй плановый R:R минимум 1:2 и не двигай стоп в убыточную сторону.",
      articles: ["r-multiple-thinking", "risk-management-only-control"],
      color: BRICK,
      icon: Gauge,
      priority: "high",
    });
  } else if (avgRMultiple < 0.5) {
    items.push({
      id: "small-edge",
      title: "Увеличь качество результата на сделку",
      summary: "Плюсовая или почти нулевая средняя R все еще слишком хрупкая после комиссий и ошибок исполнения.",
      metric: "Avg R",
      metricValue: formatR(avgRMultiple),
      nextAction: "Разбери последние 10 выходов: где прибыль закрывалась раньше плана, а убыток держался дольше.",
      articles: ["cut-losses-let-profits-run", "r-multiple-thinking"],
      color: AMBER,
      icon: TrendingUp,
      priority: "medium",
    });
  }

  if (profitFactor > 0 && profitFactor < 1.2) {
    items.push({
      id: "profit-factor",
      title: "Подними profit factor",
      summary: "Суммарная прибыль почти не перекрывает убытки, поэтому любая ошибка быстро съедает преимущество.",
      metric: "Profit Factor",
      metricValue: String(Math.round(profitFactor * 100) / 100),
      nextAction: "Ищи сделки, где риск больше плана: уменьши размер позиции или откажись от входа до улучшения R:R.",
      articles: ["risk-management-only-control", "cut-losses-let-profits-run"],
      color: AMBER,
      icon: AlertTriangle,
      priority: "medium",
    });
  }

  if (avgWinDuration > 0 && avgLossDuration > 0 && avgLossDuration > avgWinDuration * 1.4) {
    items.push({
      id: "hold-duration",
      title: "Не держи убытки дольше победителей",
      summary: "Средний убыточный трейд живет заметно дольше прибыльного: это признак надежды вместо плана.",
      metric: "Hold time",
      metricValue: `${Math.round(avgWinDuration)}m win / ${Math.round(avgLossDuration)}m loss`,
      nextAction: "Ставь стоп до входа и добавь правило: если причина входа сломалась, выход без ожидания разворота.",
      articles: ["cut-losses-let-profits-run", "risk-management-only-control"],
      color: AMBER,
      icon: Timer,
      priority: "medium",
    });
  }

  const weakEmotion = stats.byEmotionalState
    ?.filter((e) => e.trades >= 2 && e.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)[0];
  if (weakEmotion) {
    items.push({
      id: "emotion-state",
      title: `Снизь торговлю в состоянии "${weakEmotion.state}"`,
      summary: "Эмоциональное состояние уже видно в статистике как отдельный источник потерь.",
      metric: "P/L по состоянию",
      metricValue: formatMoneyMetric(weakEmotion.pnl),
      nextAction: "Добавь паузу 10 минут и короткую заметку перед входом, если это состояние появляется до сделки.",
      articles: ["discipline-over-strategy", "beginner-mistakes"],
      color: BRICK,
      icon: Brain,
      priority: "high",
    });
  }

  const weakSetup = stats.tradesBySetup
    ?.filter((s) => s.trades >= 3 && s.avgR < 0)
    .sort((a, b) => a.avgR - b.avgR)[0];
  if (weakSetup) {
    items.push({
      id: "setup-drag",
      title: `Поставь сетап "${weakSetup.name}" на ревизию`,
      summary: "Сетап торгуется достаточно часто, но средний R отрицательный.",
      metric: `${weakSetup.trades} сделок`,
      metricValue: formatR(weakSetup.avgR),
      nextAction: "Не удаляй сетап сразу: выпиши 3 условия, при которых он работал лучше всего, и торгуй только их.",
      articles: ["discipline-over-strategy", "r-multiple-thinking"],
      color: BRICK,
      icon: Target,
      priority: "high",
    });
  }

  const weakHour = stats.tradesByHour
    ?.filter((h) => h.trades >= 3 && h.pnl < 0)
    ?.sort((a, b) => a.pnl - b.pnl)[0];
  if (weakHour && totalTrades >= 10) {
    items.push({
      id: "time-filter",
      title: `Ограничь торговлю в ${String(weakHour.hour).padStart(2, "0")}:00`,
      summary: "Отдельный час дает отрицательный вклад: это хороший кандидат для временного фильтра.",
      metric: `${weakHour.trades} сделок`,
      metricValue: formatMoneyMetric(weakHour.pnl),
      nextAction: "На 2 недели запрети новые входы в этот час или снизь риск вдвое и сравни статистику.",
      articles: ["best-trading-sessions", "beginner-mistakes"],
      color: AMBER,
      icon: Clock,
      priority: "medium",
    });
  }

  return items
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])
    .slice(0, 4);
}

function buildSkillScores(stats: LearnStats | null | undefined): SkillScore[] {
  const totalTrades = stats?.totalTrades ?? 0;
  const hasTrades = totalTrades > 0;
  const winRate = stats?.winRate ?? 0;
  const avgRMultiple = stats?.avgRMultiple ?? 0;
  const profitFactor = stats?.profitFactor ?? 0;
  const currentLossStreak = stats?.currentLossStreak ?? 0;
  const maxConsecutiveLosses = stats?.maxConsecutiveLosses ?? 0;
  const avgWinDuration = stats?.avgWinDuration ?? 0;
  const avgLossDuration = stats?.avgLossDuration ?? 0;
  const weakEmotion = stats?.byEmotionalState
    ?.filter((e) => e.trades >= 2 && e.pnl < 0)
    .sort((a, b) => a.pnl - b.pnl)[0];
  const weakSetup = stats?.tradesBySetup
    ?.filter((s) => s.trades >= 3 && s.avgR < 0)
    .sort((a, b) => a.avgR - b.avgR)[0];

  const disciplineScore = clamp(92 - currentLossStreak * 14 - maxConsecutiveLosses * 5);
  const riskScore = clamp(35 + avgRMultiple * 32 + profitFactor * 14);
  const exitPenalty = avgWinDuration > 0 && avgLossDuration > avgWinDuration
    ? Math.min(28, ((avgLossDuration / avgWinDuration) - 1) * 18)
    : 0;
  const exitScore = clamp(58 + avgRMultiple * 28 - exitPenalty);
  const setupScore = clamp(45 + winRate * 0.55 + (weakSetup ? -22 : 8));
  const emotionScore = clamp(88 - (weakEmotion ? 28 : 0) - currentLossStreak * 8);
  const emptyDetail = "Пока нет данных по сделкам";

  return [
    {
      id: "discipline",
      label: "Дисциплина",
      score: hasTrades ? disciplineScore : 0,
      detail: hasTrades ? currentLossStreak > 0 ? `Текущая серия: ${currentLossStreak} убытка` : "Серии под контролем" : emptyDetail,
      action: "После убыточной сделки обязательна пауза и короткая заметка.",
      color: !hasTrades ? MUTED_SCORE : disciplineScore >= 70 ? SAGE : disciplineScore >= 50 ? AMBER : BRICK,
      icon: ShieldCheck,
    },
    {
      id: "risk",
      label: "Риск",
      score: hasTrades ? riskScore : 0,
      detail: hasTrades ? `Avg R ${formatR(avgRMultiple)} · PF ${Math.round(profitFactor * 100) / 100}` : emptyDetail,
      action: "Проверяй R:R и риск до входа, не после сделки.",
      color: !hasTrades ? MUTED_SCORE : riskScore >= 70 ? SAGE : riskScore >= 50 ? AMBER : BRICK,
      icon: Gauge,
    },
    {
      id: "exit",
      label: "Качество выхода",
      score: hasTrades ? exitScore : 0,
      detail: !hasTrades ? emptyDetail : avgWinDuration && avgLossDuration
        ? `${Math.round(avgWinDuration)}m win / ${Math.round(avgLossDuration)}m loss`
        : "Нужны закрытые сделки с временем выхода",
      action: "Пиши причину выхода и сравнивай её с исходным планом.",
      color: !hasTrades ? MUTED_SCORE : exitScore >= 70 ? SAGE : exitScore >= 50 ? AMBER : BRICK,
      icon: Timer,
    },
    {
      id: "setup",
      label: "Качество сетапа",
      score: hasTrades ? setupScore : 0,
      detail: hasTrades ? weakSetup ? `Слабый сетап: ${weakSetup.name}` : `Винрейт ${formatPercent(winRate)}` : emptyDetail,
      action: "Оставь только сетапы, где условия входа можно проверить заранее.",
      color: !hasTrades ? MUTED_SCORE : setupScore >= 70 ? SAGE : setupScore >= 50 ? AMBER : BRICK,
      icon: Target,
    },
    {
      id: "emotion",
      label: "Контроль эмоций",
      score: hasTrades ? emotionScore : 0,
      detail: hasTrades ? weakEmotion ? `"${weakEmotion.state}" даёт ${formatMoneyMetric(weakEmotion.pnl)}` : "Нет явного эмоционального провала" : emptyDetail,
      action: "Фиксируй состояние до сделки, а не только после результата.",
      color: !hasTrades ? MUTED_SCORE : emotionScore >= 70 ? SAGE : emotionScore >= 50 ? AMBER : BRICK,
      icon: Brain,
    },
  ];
}

function buildLessonPlan(curriculum: CurriculumItem[], stats: LearnStats | null | undefined): LessonPlanItem[] {
  const primary = curriculum[0];
  const secondary = curriculum[1];
  const avgRMultiple = stats?.avgRMultiple ?? 0;
  const winRate = stats?.winRate ?? 0;

  return [
    {
      day: 1,
      title: "Диагностика недели",
      focus: primary?.title ?? "Найди главный повторяющийся паттерн",
      action: primary?.nextAction ?? "Разбери последние 5 сделок и отметь одну повторяющуюся ошибку.",
      successMetric: primary ? `${primary.metric} зафиксирован как главный фокус` : "Есть один фокус на неделю",
      articleId: primary?.articles[0] ?? "trading-journal-best-teacher",
    },
    {
      day: 2,
      title: "Правило входа",
      focus: winRate < 45 ? "Качество входов" : "Чёткий фильтр сетапа",
      action: "Запиши 3 условия, без которых вход запрещён, и держи их рядом с формой сделки.",
      successMetric: "Каждая новая сделка имеет причину входа и сетап",
      articleId: "discipline-over-strategy",
    },
    {
      day: 3,
      title: "Риск и R:R",
      focus: avgRMultiple < 0.8 ? "Поднять средний R" : "Защитить текущее преимущество",
      action: "Перед входом рассчитай плановый R:R и откажись от сделки, если потенциал меньше 1:2.",
      successMetric: "У следующих 3 сделок есть плановый R:R до входа",
      articleId: "r-multiple-thinking",
    },
    {
      day: 4,
      title: "Выходы",
      focus: "Ранние фиксации и затянутые убытки",
      action: "Разбери последние 10 выходов: плановый выход, фактический выход, причина расхождения.",
      successMetric: "Есть одно новое правило выхода",
      articleId: "cut-losses-let-profits-run",
    },
    {
      day: 5,
      title: "Эмоциональный фильтр",
      focus: "Состояние перед сделкой",
      action: "Добавь запрет на вход при усталости, злости или желании отыграться.",
      successMetric: "Каждая сделка имеет emotional state до сохранения",
      articleId: "psychology-of-loss",
    },
    {
      day: 6,
      title: "Практика на одной сделке",
      focus: secondary?.title ?? "Применить один урок без усложнения",
      action: secondary?.nextAction ?? "Открой только одну сделку, которая полностью проходит чеклист.",
      successMetric: "Сделка оценена по качеству исполнения, не только по P&L",
      articleId: secondary?.articles[0] ?? "trading-plan-ignored",
    },
    {
      day: 7,
      title: "Разбор",
      focus: "Что улучшилось, что повторилось",
      action: "Сравни неделю с фокусом дня 1 и запиши одно правило на следующую неделю.",
      successMetric: "Есть недельный разбор и правило недели",
      articleId: "trading-journal-best-teacher",
    },
  ];
}

function buildWeeklyReview(stats: LearnStats | null | undefined, curriculum: CurriculumItem[]) {
  const hasTrades = (stats?.totalTrades ?? 0) > 0;
  const bestSetup = stats?.tradesBySetup
    ?.filter((s) => s.trades >= 2)
    .sort((a, b) => b.avgR - a.avgR)[0];
  const weakSetup = stats?.tradesBySetup
    ?.filter((s) => s.trades >= 2)
    .sort((a, b) => a.avgR - b.avgR)[0];
  const main = curriculum[0];

  if (!hasTrades) {
    return {
      headline: "Главная тема недели: собрать первые чистые данные.",
      best: "Нет сделок для сравнения",
      risk: "Нет выборки по убыткам",
      rule: "Следующая неделя: каждая сделка должна иметь причину входа, стоп и урок после выхода.",
    };
  }

  return {
    headline: main
      ? `Главная тема недели: ${main.title.toLowerCase()}.`
      : "Главная тема недели: закрепить процесс и собрать больше качественных данных.",
    best: bestSetup
      ? `${bestSetup.name}: ${formatR(bestSetup.avgR)} за ${bestSetup.trades} сделок`
      : `Лучший результат: ${formatMoneyMetric(stats?.biggestWin)}`,
    risk: weakSetup
      ? `${weakSetup.name}: ${formatR(weakSetup.avgR)} требует ревизии`
      : `Самый большой убыток: ${formatMoneyMetric(stats?.biggestLoss)}`,
    rule: main?.nextAction ?? "Следующая неделя: каждая сделка должна иметь причину входа, стоп и урок после выхода.",
  };
}

function buildBenchmarks(stats: LearnStats | null | undefined) {
  const hasTrades = (stats?.totalTrades ?? 0) > 0;
  if (!hasTrades) {
    return [
      {
        label: "Винрейт",
        yours: "n/a",
        benchmark: formatPercent(BENCHMARKS.winRate),
        status: "Пока нет выборки",
        ok: false,
        hasSample: false,
      },
      {
        label: "Средний R",
        yours: "n/a",
        benchmark: formatR(BENCHMARKS.avgRMultiple),
        status: "Пока нет выборки",
        ok: false,
        hasSample: false,
      },
      {
        label: "Profit Factor",
        yours: "n/a",
        benchmark: String(BENCHMARKS.profitFactor),
        status: "Пока нет выборки",
        ok: false,
        hasSample: false,
      },
    ];
  }
  const winRate = stats?.winRate ?? 0;
  const avgRMultiple = stats?.avgRMultiple ?? 0;
  const profitFactor = stats?.profitFactor ?? 0;

  return [
    {
      label: "Винрейт",
      yours: formatPercent(winRate),
      benchmark: formatPercent(BENCHMARKS.winRate),
      status: winRate >= BENCHMARKS.winRate ? "Сильнее группы" : "Ниже группы",
      ok: winRate >= BENCHMARKS.winRate,
      hasSample: true,
    },
    {
      label: "Средний R",
      yours: formatR(avgRMultiple),
      benchmark: formatR(BENCHMARKS.avgRMultiple),
      status: avgRMultiple >= BENCHMARKS.avgRMultiple ? "Цели держатся" : "Подтяни выходы и цели",
      ok: avgRMultiple >= BENCHMARKS.avgRMultiple,
      hasSample: true,
    },
    {
      label: "Profit Factor",
      yours: String(Math.round(profitFactor * 100) / 100),
      benchmark: String(BENCHMARKS.profitFactor),
      status: profitFactor >= BENCHMARKS.profitFactor ? "Запас прочности" : "Мало запаса после ошибок",
      ok: profitFactor >= BENCHMARKS.profitFactor,
      hasSample: true,
    },
  ];
}

// ── Glossary terms ────────────────────────────────────────────────────────────
const GLOSSARY = [
  { term: "MAE", def: "Maximum Adverse Excursion — максимальное неблагоприятное движение цены против позиции до её закрытия." },
  { term: "MFE", def: "Maximum Favorable Excursion — максимальное благоприятное движение цены в пользу позиции." },
  { term: "R-Multiple", def: "Отношение прибыли/убытка к изначальному риску (стоп-лосс). 1R = риск, 2R = двойной риск в прибыли." },
  { term: "Win Rate", def: "Процент прибыльных сделок от общего числа. Сам по себе не показывает прибыльность — важен в связке с R:R." },
  { term: "Profit Factor", def: "Сумма всех выигрышей / сумма всех убытков. PF > 1.5 считается хорошим результатом." },
  { term: "Expectancy", def: "Математическое ожидание: средняя прибыль на сделку. (WR × Avg Win) − (LR × Avg Loss)." },
  { term: "Drawdown", def: "Снижение капитала от пикового значения. Max Drawdown — максимальный спад за выбранный период." },
  { term: "Opening Range", def: "Диапазон (хай/лоу) первых 15–30 минут торговой сессии. Основа стратегии ORB." },
  { term: "Scalping", def: "Стиль торговли с очень короткими удержаниями (секунды–минуты), малыми целями и высокой частотой сделок." },
  { term: "Swing Trading", def: "Удержание позиций от нескольких часов до нескольких дней. Цель — захват «свинга» рыночного движения." },
  { term: "Stop-Loss", def: "Ценовой уровень, при достижении которого позиция закрывается с убытком для ограничения потерь." },
  { term: "Risk:Reward (R:R)", def: "Соотношение риска к потенциальной прибыли. R:R 1:2 означает риск $1 ради $2 прибыли." },
  { term: "FOMO", def: "Fear Of Missing Out — страх упустить движение, толкающий трейдера входить без плана." },
  { term: "Overtrading", def: "Торговля слишком часто или с размером позиции выше планируемого, обычно из-за эмоций." },
  { term: "Confluence", def: "Совпадение нескольких независимых сигналов/уровней, усиливающих вероятность движения в одну сторону." },
  { term: "Liquidity Sweep", def: "Краткий пробой очевидного high/low для сбора стопов, после которого цена часто возвращается обратно в диапазон." },
  { term: "Reclaim", def: "Возврат цены выше пробитой поддержки или ниже пробитого сопротивления после ложного пробоя." },
  { term: "Acceptance", def: "Закрепление цены в новой зоне через несколько закрытий свечей, объём и отсутствие быстрого возврата." },
  { term: "Invalidation", def: "Условие или уровень, при котором торговая идея считается сломанной и позиция должна быть закрыта." },
  { term: "Catalyst", def: "Новость или событие, способное резко изменить спрос, объём и волатильность инструмента." },
  { term: "Relative Volume", def: "Текущий объём относительно среднего объёма за аналогичный период. Помогает отличить живое движение от шума." },
  { term: "Slippage", def: "Разница между ожидаемой ценой исполнения и фактической ценой сделки." },
  { term: "Spread", def: "Разница между лучшей ценой покупки и продажи. Чем шире спред, тем дороже вход и выход." },
  { term: "Market Structure", def: "Последовательность highs/lows и зон реакции цены, по которой читают тренд, диапазон и смену поведения." },
  { term: "Higher Low", def: "Минимум выше предыдущего минимума; часто показывает, что покупатели защищают цену выше." },
  { term: "Lower High", def: "Максимум ниже предыдущего максимума; часто показывает, что продавцы удерживают давление." },
  { term: "Breakout Retest", def: "Возврат цены к пробитому уровню, чтобы проверить, стал ли он поддержкой или сопротивлением." },
  { term: "Failed Breakout", def: "Пробой уровня без продолжения, после которого цена быстро возвращается в прежний диапазон." },
  { term: "Session Bias", def: "Предпочтительное направление торговли на сессию, основанное на тренде, уровнях, открытии дня и контексте рынка." },
  { term: "Daily Stop", def: "Заранее заданный лимит убытка или ошибок процесса, после которого торговля в этот день прекращается." },
  { term: "Process Error", def: "Нарушение торгового процесса: вход без плана, перенос стопа, превышение риска или сделка вне сетапа." },
  { term: "Watchlist", def: "Список инструментов, заранее отобранных для наблюдения и возможной торговли в текущую сессию." },
  { term: "Base", def: "Период сжатия цены перед потенциальным продолжением движения или разворотом." },
  { term: "Tape", def: "Краткое название текущего поведения рынка: скорость сделок, объём, реакция на уровни и общее давление." },
  { term: "Trade Management", def: "Управление открытой позицией: перенос стопа, частичная фиксация, трейлинг и условия выхода." },
];

const MICRO_LESSONS = [
  {
    title: "После серии убытков уменьши размер",
    body: "Если день начинается с двух ошибок подряд, следующая лучшая сделка часто не вход, а пауза.",
  },
  {
    title: "Сначала риск, потом сетап",
    body: "Хороший вход перестаёт быть хорошим, если стоп-лосс делает риск больше заранее заданного лимита.",
  },
  {
    title: "Журналируй причину выхода",
    body: "Запись выхода показывает, закрыл ли ты позицию по плану или под давлением эмоций.",
  },
  {
    title: "Один сетап лучше пяти случайных идей",
    body: "Стабильность появляется быстрее, когда ты повторяешь один проверяемый паттерн и смотришь статистику.",
  },
];

function MicroLessonWidget({ stats }: { stats: LearnStats | null | undefined }) {
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));
  const offset = (stats?.maxConsecutiveLosses ?? 0) >= 3 ? 0 : day;
  const lesson = MICRO_LESSONS[offset % MICRO_LESSONS.length];

  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Lightbulb className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Микроурок</p>
          <h3 className="text-sm font-semibold text-ink">{lesson.title}</h3>
          <p className="text-xs text-ink-4 mt-1 leading-relaxed">{lesson.body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Article Reader ────────────────────────────────────────────────────────────
function ArticleReader({ article, onBack }: { article: Article; onBack: () => void }) {
  const lang = useAppStore((s) => s.lang);
  const practice = getArticlePractice(article.id);
  const [showMentor, setShowMentor] = useState(false);
  const [read, setRead] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`learn-read-${article.id}`) === "1";
  });
  const [practiceSaved, setPracticeSaved] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`learn-practice-${article.id}`) === "1";
  });
  const [applied, setApplied] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`learn-applied-${article.id}`) === "1";
  });
  const cat = CATEGORIES.find((c) => c.id === article.categoryId);
  const title = articleTitle(article, lang);
  const author = articleAuthor(article, lang);
  const body = articleBody(article, lang);
  const quote = articleQuote(article, lang);

  const handleMarkRead = () => {
    localStorage.setItem(`learn-read-${article.id}`, "1");
    window.dispatchEvent(new Event(LEARNING_EVENT));
    setRead(true);
  };

  const handlePractice = () => {
    localStorage.setItem(`learn-practice-${article.id}`, "1");
    window.dispatchEvent(new Event(LEARNING_EVENT));
    setPracticeSaved(true);
  };

  const handleApplied = () => {
    localStorage.setItem(`learn-applied-${article.id}`, "1");
    localStorage.setItem(`learn-practice-${article.id}`, "1");
    window.dispatchEvent(new Event(LEARNING_EVENT));
    setApplied(true);
    setPracticeSaved(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-4 hover:text-ink transition-colors">
        <ChevronLeft className="h-4 w-4" /> Назад
      </button>
      <div className="rounded-2xl border border-stroke bg-card p-7">
        <div className="flex items-center gap-2 mb-5">
          <span>{cat?.icon}</span>
          <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: cat?.color }}>{categoryLabel(cat, lang)}</span>
          <span className="text-ink-5 text-xs">·</span>
          <span className="flex items-center gap-1 text-ink-5 text-xs"><Clock className="h-3 w-3" /> {article.readMinutes} мин</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-ink leading-tight mb-2">{title}</h1>
        <p className="text-sm text-ink-4 mb-6">— {author}</p>
        <blockquote className="border-l-2 border-brand pl-5 mb-8">
          <p className="font-serif italic text-lg text-ink-2 leading-relaxed">«{quote}»</p>
        </blockquote>
        <div className="space-y-4">
          {body.split("\n\n").filter(Boolean).map((p, i) => (
            <p key={i} className="text-base text-ink-2 leading-[1.75]">{p}</p>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-stroke bg-tinted/50 p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <ListChecks className="h-4 w-4 text-brand" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Практика</p>
              <h3 className="text-sm font-semibold text-ink">{practice.idea}</h3>
              <p className="text-sm text-ink-3 mt-2 leading-relaxed">{practice.exercise}</p>
              <p className="text-xs text-ink-5 mt-2">Критерий: {practice.successMetric}</p>
              <button
                onClick={handlePractice}
                disabled={practiceSaved}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  practiceSaved ? "bg-card text-ink-4 cursor-default" : "bg-brand text-white hover:bg-brand-hover"
                )}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {practiceSaved ? "Взято в работу" : "Взять в работу"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-stroke bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4 text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Связать с реальной сделкой</p>
              <h3 className="text-sm font-semibold text-ink">После следующей сделки вернись и отметь применение урока</h3>
              <p className="text-sm text-ink-4 mt-2 leading-relaxed">
                В журнале проверь три поля: причина входа, риск в R и вывод после выхода. Так урок превращается в измеримый навык.
              </p>
              <button
                onClick={handleApplied}
                disabled={applied}
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  applied
                    ? "border-stroke-2 bg-tinted text-ink-4 cursor-default"
                    : "border-brand/40 text-brand hover:bg-brand/10"
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {applied ? "Применено в сделке" : "Отметить как применено"}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-stroke bg-card">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">AI-ментор по уроку</p>
                <h3 className="text-sm font-semibold text-ink">Разбери этот материал на своих сделках</h3>
                <p className="text-sm text-ink-4 mt-1 leading-relaxed">
                  Ментор получит контекст статьи и сможет объяснить, где этот принцип уже виден в журнале.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMentor((value) => !value)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-brand/40 px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {showMentor ? "Скрыть ментора" : "Открыть ментора"}
            </button>
          </div>
          {showMentor && (
            <div className="h-[620px] border-t border-stroke bg-canvas">
              <AiLearnChat articleContext={{ title, author, body }} />
            </div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-stroke">
          <button
            onClick={handleMarkRead}
            disabled={read}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              read ? "bg-tinted text-ink-4 cursor-default" : "bg-brand text-white hover:bg-brand-hover"
            )}
          >
            <CheckCircle className="h-4 w-4" />
            {read ? "Прочитано ✓" : "Отметить прочитанным"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-tinted overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${clamp(score)}%`, background: color }}
      />
    </div>
  );
}

function SkillScoreGrid({ scores }: { scores: SkillScore[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {scores.map((score) => {
        const Icon = score.icon;
        return (
          <div key={score.id} className="rounded-xl border border-stroke bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${score.color}15` }}>
                <Icon className="h-4 w-4" style={{ color: score.color }} />
              </div>
              <span className="font-mono text-xs font-semibold" style={{ color: score.color }}>
                {formatScore(score.score)}
              </span>
            </div>
            <p className="text-sm font-semibold text-ink">{score.label}</p>
            <p className="text-[11px] text-ink-5 mt-1 leading-relaxed min-h-8">{score.detail}</p>
            <div className="mt-3"><ScoreBar score={score.score} color={score.color} /></div>
          </div>
        );
      })}
    </div>
  );
}

function CoachSummary({ stats, curriculum }: { stats: LearnStats | null | undefined; curriculum: CurriculumItem[] }) {
  const main = curriculum[0];
  const totalTrades = stats?.totalTrades ?? 0;
  const avgR = stats?.avgRMultiple ?? 0;
  const winRate = stats?.winRate ?? 0;

  return (
    <div className="rounded-xl border border-stroke bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-2">Pro-коуч по слабым местам</p>
          <h2 className="text-xl font-semibold text-ink">
            {main ? main.title : "Сейчас главная задача — набрать чистую статистику"}
          </h2>
          <p className="text-sm text-ink-4 mt-2 max-w-2xl leading-relaxed">
            {main
              ? `${main.summary} На этой неделе фокус не на большем количестве сделок, а на одном проверяемом улучшении.`
              : "Добавляй сделки с причиной входа, стопом, эмоциональным состоянием и выводом. Тогда программа начнёт точнее подбирать уроки."}
          </p>
        </div>
        <div className="hidden md:grid grid-cols-3 gap-2 shrink-0">
          <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2 text-center">
            <p className="font-mono text-sm font-semibold text-ink">{totalTrades}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-5">trades</p>
          </div>
          <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2 text-center">
            <p className="font-mono text-sm font-semibold text-ink">{formatPercent(winRate)}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-5">WR</p>
          </div>
          <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2 text-center">
            <p className="font-mono text-sm font-semibold text-ink">{formatR(avgR)}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-5">Средний R</p>
          </div>
        </div>
      </div>
      {main && (
        <div className="mt-5 rounded-lg border border-stroke-2 bg-tinted/50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Правило недели</p>
          <p className="text-sm text-ink-3 leading-relaxed">{main.nextAction}</p>
        </div>
      )}
    </div>
  );
}

function SevenDayPlan({ plan, onRead }: { plan: LessonPlanItem[]; onRead: (a: Article) => void }) {
  const lang = useAppStore((s) => s.lang);
  const { completedDays } = useLearningSnapshot();

  const toggleDay = (day: number) => {
    const next = completedDays.includes(day)
      ? completedDays.filter((d) => d !== day)
      : [...completedDays, day].sort((a, b) => a - b);
    writeStoredList(PLAN_COMPLETION_KEY, next.map(String));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-semibold text-ink">7-дневный учебный план</h2>
        </div>
        <span className="rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {completedDays.length}/7 done
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-2">
        {plan.map((item) => {
          const article = item.articleId ? ARTICLES.find((a) => a.id === item.articleId) : undefined;
          const done = completedDays.includes(item.day);
          return (
            <div
              key={item.day}
              className={cn(
                "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors",
                done ? "border-brand/40 bg-brand/5" : "border-stroke"
              )}
            >
              <div>
                <p className="font-mono text-[11px] text-brand mb-1">ДЕНЬ {item.day}</p>
                <h3 className="text-sm font-semibold text-ink leading-snug">{item.title}</h3>
                <p className="text-[11px] text-ink-5 mt-1 leading-relaxed">{item.focus}</p>
              </div>
              <p className="text-xs text-ink-3 leading-relaxed">{item.action}</p>
              <p className="text-[11px] text-ink-5 leading-relaxed mt-auto">Готово: {item.successMetric}</p>
              {article && (
                <button
                  onClick={() => onRead(article)}
                  className="rounded-lg border border-stroke-2 px-2.5 py-1.5 text-left text-[11px] text-brand hover:bg-brand/10 transition-colors"
                >
                  {articleTitle(article, lang)}
                </button>
              )}
              <button
                onClick={() => toggleDay(item.day)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors",
                  done ? "bg-brand text-white" : "bg-tinted text-ink-4 hover:text-ink"
                )}
              >
                {done ? "День завершён" : "Отметить день"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LearningProgressPanel() {
  const snapshot = useLearningSnapshot();
  const totalArticles = ARTICLES.length || 1;
  const progressScore = clamp(
    (snapshot.readCount / totalArticles) * 30 +
    (snapshot.practiceCount / totalArticles) * 25 +
    (snapshot.appliedCount / Math.max(1, totalArticles)) * 25 +
    (snapshot.completedDays.length / 7) * 20
  );

  const rows = [
    { label: "Уроки прочитаны", value: `${snapshot.readCount}/${ARTICLES.length}`, width: (snapshot.readCount / totalArticles) * 100 },
    { label: "Практики взяты", value: `${snapshot.practiceCount}/${ARTICLES.length}`, width: (snapshot.practiceCount / totalArticles) * 100 },
    { label: "Применено в сделке", value: String(snapshot.appliedCount), width: Math.min(100, snapshot.appliedCount * 20) },
    { label: "Дни плана", value: `${snapshot.completedDays.length}/7`, width: (snapshot.completedDays.length / 7) * 100 },
  ];

  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Прогресс обучения</p>
          <h2 className="text-lg font-semibold text-ink">Навык растёт, когда урок дошёл до сделки</h2>
          <p className="text-sm text-ink-4 mt-1 leading-relaxed">
            Это локальный трекер: чтение, практика, применение и завершённые дни плана.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-stroke-2 bg-tinted/50 px-4 py-3 text-center">
          <p className="font-mono text-xl font-semibold text-brand">{Math.round(progressScore)}%</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-5">process</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] text-ink-4">{row.label}</p>
              <p className="font-mono text-xs text-ink">{row.value}</p>
            </div>
            <ScoreBar score={row.width} color={SAGE} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyReviewCard({ stats, curriculum }: { stats: LearnStats | null | undefined; curriculum: CurriculumItem[] }) {
  const review = buildWeeklyReview(stats, curriculum);
  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Award className="h-4 w-4 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Еженедельный разбор обучения</p>
          <h2 className="text-base font-semibold text-ink">{review.headline}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Сильная зона</p>
              <p className="text-xs text-ink-3 leading-relaxed">{review.best}</p>
            </div>
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Риск недели</p>
              <p className="text-xs text-ink-3 leading-relaxed">{review.risk}</p>
            </div>
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Правило</p>
              <p className="text-xs text-ink-3 leading-relaxed">{review.rule}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecoveryProtocolCard({ stats }: { stats: LearnStats | null | undefined }) {
  const checked = useRecoverySnapshot();
  const active = shouldShowRecovery(stats);
  const streak = stats?.currentLossStreak ?? 0;

  const toggleStep = (stepId: string) => {
    const next = checked.includes(stepId)
      ? checked.filter((id) => id !== stepId)
      : [...checked, stepId];
    localStorage.setItem(getRecoveryKey(stepId), next.includes(stepId) ? "1" : "0");
    window.dispatchEvent(new Event(LEARNING_EVENT));
  };

  return (
    <div className={cn("rounded-xl border p-5", active ? "border-red-500/30 bg-red-500/5" : "border-stroke bg-card")}>
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
          <RotateCcw className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">After-loss recovery protocol</p>
          <h2 className="text-lg font-semibold text-ink">
            {active ? "Включи защитный режим перед следующей сделкой" : "Протокол готов, если появится серия потерь"}
          </h2>
          <p className="text-sm text-ink-4 mt-1 leading-relaxed">
            {active
              ? `Текущая серия: ${streak} убытка. Цель — не отбиться, а вернуть качество решений.`
              : "Используй это как аварийный чек-лист после тяжёлого дня или эмоциональной сделки."}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {RECOVERY_STEPS.map((step) => {
          const done = checked.includes(step.id);
          return (
            <button
              key={step.id}
              onClick={() => toggleStep(step.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                done ? "border-brand/40 bg-brand/10" : "border-stroke-2 bg-tinted/50 hover:border-stroke"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className={cn("h-3.5 w-3.5", done ? "text-brand" : "text-ink-5")} />
                <p className="text-xs font-semibold text-ink">{step.title}</p>
              </div>
              <p className="text-[11px] text-ink-5 leading-relaxed">{step.body}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MistakeLibraryPanel({
  stats,
  curriculum,
  onRead,
}: {
  stats: LearnStats | null | undefined;
  curriculum: CurriculumItem[];
  onRead: (a: Article) => void;
}) {
  const lang = useAppStore((s) => s.lang);
  const { adoptedMistakes: adopted } = useLearningSnapshot();
  const mistakes = getMistakePriority(stats, curriculum);

  const toggleMistake = (id: string) => {
    const next = adopted.includes(id) ? adopted.filter((item) => item !== id) : [...adopted, id];
    writeStoredList(MISTAKE_RULES_KEY, next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-semibold text-ink">Библиотека ошибок</h2>
        </div>
        <span className="rounded-md bg-tinted px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-4">
          {adopted.length} правил принято
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {mistakes.map((mistake) => {
          const Icon = mistake.icon;
          const article = ARTICLES.find((a) => a.id === mistake.articleId);
          const active = adopted.includes(mistake.id);
          return (
            <div key={mistake.id} className="rounded-xl border border-stroke bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${mistake.color}15` }}>
                  <Icon className="h-4 w-4" style={{ color: mistake.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">{mistake.title}</h3>
                  <p className="text-xs text-ink-5 mt-1 leading-relaxed">{mistake.signal}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Как поймать</p>
                  <p className="text-xs text-ink-3 leading-relaxed">{mistake.catchRule}</p>
                </div>
                <div className="rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Тренировка</p>
                  <p className="text-xs text-ink-3 leading-relaxed">{mistake.drill}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleMistake(mistake.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    active ? "bg-brand text-white" : "bg-tinted text-ink-4 hover:text-ink"
                  )}
                >
                  {active ? "Правило добавлено" : "Добавить правило"}
                </button>
                {article && (
                  <button
                    onClick={() => onRead(article)}
                    className="rounded-lg border border-stroke-2 px-3 py-1.5 text-xs text-brand hover:bg-brand/10 transition-colors"
                  >
                    Урок: {articleTitle(article, lang)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyCurriculumRecap({ stats, curriculum }: { stats: LearnStats | null | undefined; curriculum: CurriculumItem[] }) {
  const snapshot = useLearningSnapshot();
  const review = buildWeeklyReview(stats, curriculum);
  const appliedLabel = snapshot.appliedCount > 0
    ? `${snapshot.appliedCount} уроков уже дошли до реальных сделок`
    : "Пока нет уроков, отмеченных как применённые в сделке";
  const nextRule = curriculum[0]?.nextAction ?? review.rule;

  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Flag className="h-4 w-4 text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Итоги учебной недели</p>
          <h2 className="text-base font-semibold text-ink">{appliedLabel}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Изучено</p>
              <p className="text-xs text-ink-3 leading-relaxed">
                {snapshot.readCount} прочитано · {snapshot.practiceCount} практик · {snapshot.completedDays.length}/7 дней плана
              </p>
            </div>
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Замечено</p>
              <p className="text-xs text-ink-3 leading-relaxed">{review.risk}</p>
            </div>
            <div className="rounded-lg bg-tinted/50 border border-stroke-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-5 mb-1">Следующее правило</p>
              <p className="text-xs text-ink-3 leading-relaxed">{nextRule}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenchmarkCard({ stats }: { stats: LearnStats | null | undefined }) {
  const rows = buildBenchmarks(stats);
  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Compass className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-semibold text-ink">Личные ориентиры</h2>
      </div>
      <p className="text-sm text-ink-4 mb-4 leading-relaxed">
        Сравнение с базовым профилем активного retail-трейдера. Это не рейтинг, а подсказка, что именно подтянуть.
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-stroke-2 bg-tinted/50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-ink">{row.label}</p>
              <p className={cn("text-[11px]", row.hasSample === false ? "text-ink-5" : row.ok ? "text-emerald-400" : "text-amber-400")}>{row.status}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-ink">{row.yours}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-5">ты</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-ink-4">{row.benchmark}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-5">ориентир</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProPreviewPanel({ curriculum, stats }: { curriculum: CurriculumItem[]; stats: LearnStats | null | undefined }) {
  const scores = buildSkillScores(stats).slice(0, 3);
  const first = curriculum[0];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stroke bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4 text-brand" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Превью Pro</p>
            <h2 className="text-base font-semibold text-ink">
              {first ? `Первый учебный сигнал: ${first.metric} = ${first.metricValue}` : "Персональная диагностика готовится"}
            </h2>
            <p className="text-sm text-ink-4 mt-1 leading-relaxed">
              Pro открывает 7-дневный план, оценку навыков, еженедельный разбор и сравнение с ориентирами по твоим сделкам.
            </p>
          </div>
        </div>
      </div>
      <div className="pointer-events-none select-none opacity-45">
        <SkillScoreGrid scores={scores} />
      </div>
      <PaywallCard
        feature="advanced_reports"
        title="Открой Pro-коуча по обучению"
        body="Получай персональные уроки по слабым местам, правила недели и практические задания на основе своей статистики."
        inline
      />
    </div>
  );
}

function RecommendedArticles({ articles, onRead }: { articles: Article[]; onRead: (a: Article) => void }) {
  const lang = useAppStore((s) => s.lang);
  if (articles.length === 0) return null;

  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-ink">Следующие уроки</h2>
        <span className="text-[11px] text-ink-5">{articles.length} в очереди</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {articles.slice(0, 4).map((a) => {
          const cat = CATEGORIES.find((c) => c.id === a.categoryId);
          return (
            <button
              key={a.id}
              onClick={() => onRead(a)}
              className="rounded-lg border border-stroke-2 bg-tinted/40 px-3 py-2 text-left hover:border-stroke transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{cat?.icon}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: cat?.color }}>{categoryLabel(cat, lang)}</span>
                <span className="ml-auto text-[11px] text-ink-5 flex items-center gap-1"><Clock className="h-3 w-3" />{a.readMinutes} мин</span>
              </div>
              <p className="text-xs font-semibold text-ink group-hover:text-brand transition-colors">{articleTitle(a, lang)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FreshContentPanel({ onRead }: { onRead: (a: Article) => void }) {
  const lang = useAppStore((s) => s.lang);
  const cycle = useRefreshCycle();
  const snapshot = useLearningSnapshot();
  const readIds = new Set(readArticleIds());
  const weeklyArticles = rotateBySeed(
    ARTICLES.filter((article) => !readIds.has(article.id)).concat(ARTICLES.filter((article) => readIds.has(article.id))),
    cycle.weekIndex + snapshot.completedDays.length + snapshot.practiceCount
  ).slice(0, 3);
  const glossaryTerms = rotateBySeed(GLOSSARY, cycle.dayIndex).slice(0, 3);

  return (
    <div className="rounded-xl border border-stroke bg-card p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Свежая ротация</p>
          <h2 className="text-lg font-semibold text-ink">Новая подборка на сегодня</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-4">
            Уроки меняются по недельному циклу, термины — каждый день. Уже прочитанное уходит ниже.
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {cycle.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke-2 bg-tinted/45 p-3">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold text-ink">Уроки недели</p>
          </div>
          <div className="space-y-2">
            {weeklyArticles.map((article) => {
              const category = CATEGORIES.find((c) => c.id === article.categoryId);
              return (
                <button
                  key={article.id}
                  onClick={() => onRead(article)}
                  className="block w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-card"
                >
                  <span className="mb-0.5 block text-[10px] uppercase tracking-wider" style={{ color: category?.color }}>
                    {categoryLabel(category, lang)}
                  </span>
                  <span className="block text-xs font-semibold leading-snug text-ink">{articleTitle(article, lang)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-stroke-2 bg-tinted/45 p-3">
          <div className="mb-2 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold text-ink">Термины дня</p>
          </div>
          <div className="space-y-2">
            {glossaryTerms.map((term) => (
              <div key={term.term} className="rounded-md px-2 py-1.5">
                <p className="text-xs font-semibold text-brand">{term.term}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-4">{term.def}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── For You Tab (weakness curriculum) ────────────────────────────────────────
function ForYouTab({
  stats,
  canUseWeaknessCurriculum,
  onRead,
}: {
  stats: LearnStats | null | undefined;
  canUseWeaknessCurriculum: boolean;
  onRead: (a: Article) => void;
}) {
  const [mode, setMode] = useState<"today" | "plan" | "mistakes" | "review">("today");
  const lang = useAppStore((s) => s.lang);
  const curriculum = buildCurriculum(stats);
  const skillScores = buildSkillScores(stats);
  const lessonPlan = buildLessonPlan(curriculum, stats);
  const snapshot = useLearningSnapshot();
  const totalTrades = stats?.totalTrades ?? 0;
  const nextLesson = lessonPlan.find((item) => !snapshot.completedDays.includes(item.day)) ?? lessonPlan[0];
  const nextLessonArticle = nextLesson.articleId ? ARTICLES.find((a) => a.id === nextLesson.articleId) : undefined;

  const readArticles = ARTICLES.filter((a) => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`learn-read-${a.id}`) === "1";
  });
  const curriculumArticleIds = uniqueIds(curriculum.flatMap((item) => item.articles));
  const suggestedFromCurriculum = curriculumArticleIds
    .map((id) => ARTICLES.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a))
    .filter((a) => !readArticles.includes(a));
  const unread = [
    ...suggestedFromCurriculum,
    ...ARTICLES.filter((a) => !readArticles.includes(a) && !curriculumArticleIds.includes(a.id)),
  ];
  const modes: { id: typeof mode; label: string; hint: string; icon: React.ElementType }[] = [
    { id: "today", label: "Сегодня", hint: "1 фокус", icon: Compass },
    { id: "plan", label: "План", hint: `${snapshot.completedDays.length}/7`, icon: CalendarDays },
    { id: "mistakes", label: "Ошибки", hint: "тренировки", icon: Library },
    { id: "review", label: "Разбор", hint: "метрики", icon: Award },
  ];

  const renderFocusCards = () => (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Твой учебный фокус</h2>
          <p className="text-xs text-ink-4 mt-0.5">Самые важные приоритеты по текущей статистике.</p>
        </div>
        <span className="rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {totalTrades} сделок
        </span>
      </div>
      {curriculum.slice(0, 3).map((item) => {
        const Icon = item.icon;
        const relatedArticles = ARTICLES.filter((a) => item.articles.includes(a.id));
        return (
          <div key={item.id} className="rounded-xl border border-stroke bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                <Icon className="h-4 w-4" style={{ color: item.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: `${item.color}15`, color: item.color }}
                  >
                    {item.metric}: {item.metricValue}
                  </span>
                </div>
                <p className="text-xs text-ink-4 mt-1 leading-relaxed">{item.nextAction}</p>
                {relatedArticles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {relatedArticles.slice(0, 2).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onRead(a)}
                        className="rounded-md border border-stroke-2 px-2 py-1 text-left text-[11px] text-brand hover:bg-brand/10 transition-colors"
                      >
                        {getArticleTitle(a.id, lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <LearningProgressPanel />
      <FreshContentPanel onRead={onRead} />

      {curriculum.length > 0 && !canUseWeaknessCurriculum ? (
        <div className="space-y-4">
          <ProPreviewPanel curriculum={curriculum} stats={stats} />
          <RecommendedArticles articles={unread} onRead={onRead} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {modes.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  mode === id ? "border-brand/50 bg-brand/10" : "border-stroke bg-card hover:border-stroke-2"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", mode === id ? "text-brand" : "text-ink-5")} />
                  <span className={cn("text-sm font-semibold", mode === id ? "text-brand" : "text-ink")}>{label}</span>
                </div>
                <p className="text-[11px] text-ink-5 mt-1">{hint}</p>
              </button>
            ))}
          </div>

          {mode === "today" && (
            <div className="space-y-4">
              {totalTrades < 5 ? (
                <div className="rounded-xl border border-stroke-2 border-dashed p-6 text-center">
                  <Star className="h-10 w-10 text-stroke-2 mx-auto mb-3" />
                  <p className="text-ink-2 font-semibold">Нужно минимум 5 сделок для персонального режима коуча</p>
                  <p className="text-ink-4 text-sm mt-1">Пока фокус — пройти базовый план и собрать чистые данные.</p>
                </div>
              ) : (
                <CoachSummary stats={stats} curriculum={curriculum} />
              )}
              <div className="rounded-xl border border-stroke bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Сегодня</p>
                    <h2 className="text-lg font-semibold text-ink">{nextLesson.title}</h2>
                    <p className="text-sm text-ink-4 mt-1 leading-relaxed">{nextLesson.action}</p>
                    <p className="text-xs text-ink-5 mt-2">Готово: {nextLesson.successMetric}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    день {nextLesson.day}
                  </span>
                </div>
                {nextLessonArticle && (
                  <button
                    onClick={() => onRead(nextLessonArticle)}
                    className="mt-4 rounded-lg border border-stroke-2 px-3 py-1.5 text-xs text-brand hover:bg-brand/10 transition-colors"
                  >
                    Открыть урок: {articleTitle(nextLessonArticle, lang)}
                  </button>
                )}
              </div>
              {shouldShowRecovery(stats) && <RecoveryProtocolCard stats={stats} />}
              <RecommendedArticles articles={unread} onRead={onRead} />
            </div>
          )}

          {mode === "plan" && <SevenDayPlan plan={lessonPlan} onRead={onRead} />}

          {mode === "mistakes" && (
            <div className="space-y-4">
              <RecoveryProtocolCard stats={stats} />
              <MistakeLibraryPanel stats={stats} curriculum={curriculum} onRead={onRead} />
            </div>
          )}

          {mode === "review" && (
            <div className="space-y-4">
              <SkillScoreGrid scores={skillScores} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WeeklyReviewCard stats={stats} curriculum={curriculum} />
                <BenchmarkCard stats={stats} />
              </div>
              <WeeklyCurriculumRecap stats={stats} curriculum={curriculum} />
              {curriculum.length > 0 && renderFocusCards()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Articles Tab ──────────────────────────────────────────────────────────────
function ArticlesTab({ onRead }: { onRead: (a: Article) => void }) {
  const lang = useAppStore((s) => s.lang);
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const cycle = useRefreshCycle();
  const orderedArticles = rotateBySeed(ARTICLES, cycle.weekIndex);
  const weeklySpotlight = orderedArticles.slice(0, 3);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = orderedArticles.filter((a) => {
    const category = CATEGORIES.find((c) => c.id === a.categoryId);
    const matchesCategory = cat === "all" || a.categoryId === cat;
    const haystack = [
      articleTitle(a, lang),
      articleAuthor(a, lang),
      articleQuote(a, lang),
      categoryLabel(category, lang),
      a.id,
    ].join(" ").toLowerCase();
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stroke bg-card p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Еженедельное обновление статей</p>
            <h2 className="text-lg font-semibold text-ink">Подборка меняется каждую неделю</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-4">
              База уроков та же, но верхние материалы и порядок выдачи обновляются, чтобы пользователь не застревал на старом списке.
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
            обновлено {cycle.label}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {weeklySpotlight.map((article) => {
            const category = CATEGORIES.find((c) => c.id === article.categoryId);
            return (
              <button
                key={article.id}
                onClick={() => onRead(article)}
                className="rounded-lg border border-stroke-2 bg-tinted/45 p-3 text-left transition-colors hover:border-stroke"
              >
                <span className="mb-1 block text-[10px] uppercase tracking-wider" style={{ color: category?.color }}>
                  {categoryLabel(category, lang)}
                </span>
                <span className="block text-sm font-semibold leading-snug text-ink">{articleTitle(article, lang)}</span>
                <span className="mt-2 flex items-center gap-1 text-[11px] text-ink-5"><Clock className="h-3 w-3" />{article.readMinutes} мин</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCat("all")}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
              cat === "all" ? "border-brand/50 bg-brand/10 text-brand" : "border-stroke-2 text-ink-4 hover:bg-tinted")}>
            Все
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                cat === c.id ? "border-brand/50 bg-brand/10 text-brand" : "border-stroke-2 text-ink-4 hover:bg-tinted")}>
              {c.icon} {categoryLabel(c, lang)}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти урок..."
            className="h-10 w-full rounded-lg border border-stroke-2 bg-tinted pl-9 pr-3 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
          />
        </label>
      </div>
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a) => {
            const c = CATEGORIES.find((c) => c.id === a.categoryId);
            const read = typeof window !== "undefined" && localStorage.getItem(`learn-read-${a.id}`) === "1";
            return (
              <button key={a.id} onClick={() => onRead(a)}
                className="rounded-xl border border-stroke bg-card p-4 text-left hover:border-stroke-2 transition-colors group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span>{c?.icon}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: c?.color }}>{categoryLabel(c, lang)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {read && <CheckCircle className="h-3.5 w-3.5" style={{ color: SAGE }} />}
                    <span className="text-[11px] text-ink-5 flex items-center gap-1"><Clock className="h-3 w-3" />{a.readMinutes} мин</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">{articleTitle(a, lang)}</p>
                <p className="text-xs text-ink-4 mt-0.5">— {articleAuthor(a, lang)}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stroke-2 bg-card p-8 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-ink-5" />
          <p className="text-sm font-semibold text-ink">Уроков не найдено</p>
          <p className="mt-1 text-xs text-ink-5">Попробуй изменить категорию или поисковый запрос.</p>
        </div>
      )}
    </div>
  );
}

// ── Glossary Tab ──────────────────────────────────────────────────────────────
function GlossaryTab() {
  const [search, setSearch] = useState("");
  const cycle = useRefreshCycle();
  const orderedTerms = rotateBySeed(GLOSSARY, cycle.dayIndex);
  const termsOfDay = orderedTerms.slice(0, 3);
  const filtered = orderedTerms.filter((g) =>
    g.term.toLowerCase().includes(search.toLowerCase()) ||
    g.def.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stroke bg-card p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-5 mb-1">Ежедневное обновление глоссария</p>
            <h2 className="text-lg font-semibold text-ink">Термины дня</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-4">Каждый день наверху другой набор терминов, чтобы глоссарий не выглядел мёртвым справочником.</p>
          </div>
          <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
            {cycle.label}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {termsOfDay.map((g) => (
            <div key={g.term} className="rounded-lg border border-stroke-2 bg-tinted/45 px-3 py-2">
              <p className="text-sm font-semibold text-brand">{g.term}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-4">{g.def}</p>
            </div>
          ))}
        </div>
      </div>

      <label className="relative block w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-5" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск термина..."
          className="h-10 w-full rounded-lg border border-stroke-2 bg-tinted pl-9 pr-3 text-sm text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
        />
      </label>
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((g) => (
            <div key={g.term} className="rounded-xl border border-stroke bg-card px-5 py-4">
              <p className="text-sm font-semibold text-brand mb-1">{g.term}</p>
              <p className="text-sm text-ink-3 leading-relaxed">{g.def}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stroke-2 bg-card p-8 text-center">
          <BarChart2 className="mx-auto mb-3 h-8 w-8 text-ink-5" />
          <p className="text-sm font-semibold text-ink">Термины не найдены</p>
          <p className="mt-1 text-xs text-ink-5">Попробуй другой запрос.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
type Tab = "foryou" | "articles" | "glossary";

export default function LearnPage() {
  const { stats } = useStats();
  const [tab, setTab] = useState<Tab>("foryou");
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [canUseWeaknessCurriculum, setCanUseWeaknessCurriculum] = useState(false);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then((d) => {
        setCanUseWeaknessCurriculum(Boolean(d?.capabilities?.canUseWeaknessCurriculum));
      })
      .catch(() => {});
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "foryou",   label: "Для тебя",        icon: Star },
    { id: "articles", label: "Статьи",           icon: BookOpen },
    { id: "glossary", label: "Глоссарий",        icon: BarChart2 },
  ];

  if (readingArticle) {
    return (
      <div className="space-y-6">
        <ArticleReader article={readingArticle} onBack={() => setReadingArticle(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Обучение</h1>
        <p className="text-sm text-ink-4 mt-0.5">Учись на своих ошибках. Расти как трейдер.</p>
      </div>

      <MicroLessonWidget stats={stats} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stroke">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink"
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="anim-fade-up">
        {tab === "foryou"   && <ForYouTab stats={stats} canUseWeaknessCurriculum={canUseWeaknessCurriculum} onRead={setReadingArticle} />}
        {tab === "articles" && <ArticlesTab onRead={setReadingArticle} />}
        {tab === "glossary" && <GlossaryTab />}
      </div>
    </div>
  );
}
