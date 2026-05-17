import type { Article, Category } from "@/lib/education-content";
import type { Lang } from "@/lib/i18n";

type ArticleEn = {
  title: string;
  author?: string;
  quote: string;
  body: string;
};

const categoryEn: Record<string, string> = {
  psychology: "Psychology",
  risk: "Risk Management",
  strategy: "Strategies",
  basics: "Basics",
};

const articleEn: Record<string, ArticleEn> = {
  "discipline-over-strategy": {
    title: "Discipline Is More Important Than Strategy",
    author: "Mark Douglas",
    quote: "The best traders are not right more often. They simply follow their rules more consistently.",
    body: `Most new traders believe the problem is strategy. They search for the perfect indicator, the perfect setup, and the perfect entry. Professionals learn a different truth: a strategy is only useful when it is executed consistently.

Mark Douglas described the market paradox well: two traders can use the same system and produce completely different results. One follows the rules through wins and losses; the other changes behavior after every emotional swing. The difference is not the system. The difference is discipline.

Discipline is not a personality trait. It is a trained skill. Choose a system, test it, confirm it has positive expectancy, then follow it for a meaningful sample of trades before judging it. Every rule break damages the statistical edge you worked to build.`,
  },
  "cut-losses-let-profits-run": {
    title: "Cut Losses and Let Profits Run",
    author: "Jesse Livermore",
    quote: "It never was my thinking that made the big money for me. It was always my sitting.",
    body: `Jesse Livermore made and lost several fortunes, but one idea followed him through his career: money is often made by holding the winners, not by constantly finding new entries.

The human brain wants to lock in profit quickly and delay accepting a loss. That creates the classic trader error: small winners, large losers. Professionals reverse the pattern. They close invalid trades without negotiation and give valid winners enough room to develop.

In practice, this means the stop is placed before entry and never widened out of hope. Profit targets can be managed, trailed, or scaled, but the original risk must stay controlled. A few large winners can pay for many small controlled losses.`,
  },
  "risk-management-only-control": {
    title: "Risk Is the Only Thing You Control",
    author: "Van Tharp",
    quote: "You don't trade the markets. You trade your beliefs about the markets.",
    body: `A trader cannot control news, liquidity, volatility, or what large participants do next. The one variable fully under your control is position risk.

R-multiple thinking makes that control measurable. One R is the amount you risk at entry. If you risk $100 and make $300, the trade returned 3R. Thinking in R removes the emotional noise of account size and lets you compare execution quality across markets.

Position sizing is the practical expression of risk management. Wide stop means smaller size. Tight stop means larger size. The percentage of account risk should remain deliberate and consistent, because survival comes before performance.`,
  },
  "fomo-kills-traders": {
    title: "FOMO: The Quiet Account Killer",
    quote: "The market will always be there tomorrow. Your capital may not.",
    body: `FOMO starts with a simple thought: everyone is making money except me. That thought pushes traders into late entries, oversized positions, and setups they would normally reject.

The market will always create another opportunity. Your job is not to catch every move. Your job is to trade the moves that match your plan, your risk, and your tested edge.

The antidote is pre-commitment. Define your setup before the session begins, write the invalidation point, and decide when you will not trade. Missing a move is a professional outcome when the move was not yours.`,
  },
  "trading-journal-best-teacher": {
    title: "Your Trading Journal Is Your Best Teacher",
    quote: "Those who cannot remember the past are condemned to repeat it.",
    body: `Experience alone does not create improvement. Only reviewed experience does. A trading journal turns each win, loss, and mistake into material you can study.

A useful journal records more than entry and exit. It captures why you entered, what you felt, what rule applied, how you managed risk, and what you would repeat or avoid next time.

The goal is not to write perfect notes. The goal is to make patterns visible. Once a pattern is visible, it can become a rule, a checklist item, or a measurable training focus.`,
  },
  "trading-plan-ignored": {
    title: "Why 90% of Traders Ignore Their Plan",
    quote: "Plan the trade. Trade the plan.",
    body: `Most trading plans fail because they are written when the trader is calm and tested when the trader is emotional. Under pressure, vague rules are easy to reinterpret.

A strong plan is specific. It defines the setup, the entry trigger, the invalidation point, the maximum risk, the management rule, and the conditions for not trading.

The plan should be simple enough to execute when stressed. If a rule cannot be checked quickly before entry, it will probably be ignored when price starts moving.`,
  },
  "psychology-of-loss": {
    title: "The Psychology of Loss: How the Brain Sabotages Trading",
    quote: "Losses loom larger than gains. This is not wisdom. It is wiring.",
    body: `A loss hurts more than an equal-sized win feels good. That bias can make a trader hold losing trades, move stops, or take revenge trades to erase discomfort.

The market does not care about emotional closure. A loss is information: either the setup failed, the execution failed, or normal variance appeared.

Build a loss protocol before you need it. After a loss, pause, record what happened, check whether rules were followed, and only take the next trade if the next setup stands on its own.`,
  },
  "r-multiple-thinking": {
    title: "R-Multiple: Think in Units of Risk",
    author: "Van Tharp",
    quote: "Risk 1R to make 3R. Repeat.",
    body: `Dollar results can be misleading. A $200 gain is poor if you risked $500, and excellent if you risked $50. R-multiple adds the missing context.

R is your initial risk in the trade. A +3R result means you made three times what you risked. A -0.5R result means you exited before the full stop. This lets you compare trades across different account sizes and instruments.

Track planned R before entry and actual R after exit. The gap between the two shows execution quality: early exits, moved stops, poor targets, and emotional management all become visible.`,
  },
  "best-trading-sessions": {
    title: "Best Trading Times: Sessions and Volume",
    quote: "Trade when the market wants to move. Rest when it doesn't.",
    body: `Not all hours are equal. Some sessions have clean liquidity and directional movement. Others are noisy, slow, or expensive to trade.

Your journal should reveal when you make money and when you give it back. Track P/L by hour, session, and day of week. The best schedule is not the busiest schedule; it is the one aligned with your edge.

Once weak windows appear, remove them or reduce risk. Protecting capital during bad hours is often easier than finding a new strategy.`,
  },
  "beginner-mistakes": {
    title: "10 Mistakes Every Beginner Trader Makes",
    quote: "Every expert was once a beginner who refused to quit.",
    body: `Most beginner mistakes are simple and repeated: trading without a plan, ignoring stops, revenge trading, overtrading, risking too much, and switching strategies too quickly.

These mistakes are not fixed by motivation. They are fixed by constraints: a written plan, a pre-trade checklist, a maximum daily loss, a maximum number of trades, and a journal review after every session.

Progress comes from reducing repeated damage. You do not need a perfect week. You need one fewer avoidable mistake, repeated long enough to become your new baseline.`,
  },
  "pre-market-routine": {
    title: "Pre-Market Routine: Prepare Before the First Trade",
    quote: "Preparation is where impulsive trades go to die.",
    body: `A strong session starts before the first order. Check the calendar, define the active instruments, mark invalidation levels, and decide when you will stop trading.

The goal is not to predict the whole day. The goal is to reduce decisions under pressure. If no clean setup appears during preparation, doing nothing is a valid professional outcome.

Before your next session, write the main level, max risk, and one allowed setup. After the session, check whether you traded the map or reacted to noise.`,
  },
  "daily-loss-limit": {
    title: "Daily Loss Limit: Protect Against a Bad Day",
    quote: "A daily stop is not fear. It is professional damage control.",
    body: `Large drawdowns usually start when a trader refuses to stop after several poor decisions. A daily loss limit protects the account when judgment is already degraded.

Use money and process limits: for example, stop after -2R, two process mistakes, or three low-quality trades. The point is to preserve capital and attention for the next session.

Pick one daily stop rule and record whether it should have stopped you earlier at the end of each trading day.`,
  },
  "news-volatility-filter": {
    title: "News Volatility Filter: When to Skip a Setup",
    quote: "A good setup near bad news is not the same setup.",
    body: `News changes market behavior. A technical pattern that works on a normal day can fail around CPI, FOMC, payrolls, earnings, or other volatility events.

A news filter is not about predicting the reaction. It is about avoiding new risk when spreads widen, stops slip, and normal structure disappears.

Add high-impact news to your pre-market checklist and compare trades taken near news with your normal average R.`,
  },
  "liquidity-spread-costs": {
    title: "Liquidity and Spread: The Hidden Cost of Entry",
    quote: "The trade starts losing before the chart proves you wrong.",
    body: `Risk is not only distance to stop. Spread, fees, and slippage can quietly destroy an otherwise attractive R:R profile.

This matters most for frequent trades, thin stocks, altcoins, and fast news moves. If execution is expensive, the setup may not be tradeable.

Review your last 20 trades and estimate how much result was lost to fees and poor fills. If costs are high, reduce frequency or trade only liquid windows.`,
  },
  "weekly-review-loop": {
    title: "Weekly Review: Turn a Week Into Improvement",
    quote: "A week without review is just repeated experience.",
    body: `A journal becomes useful only when reviewed. Weekly review turns trades into rules: what to repeat, what to remove, where to reduce risk, and what to focus on next.

Ask five questions: best average R, worst P/L source, repeated mistakes, emotional weak spots, and one rule for next week.

Do not judge only by profit. A profitable week with poor process can teach the wrong lesson. Improve one process metric at a time.`,
  },
};

export function categoryLabel(category: Category | undefined, lang: Lang) {
  if (!category) return "";
  return lang === "en" ? categoryEn[category.id] ?? category.labelRu : category.labelRu;
}

export function articleTitle(article: Article | undefined, lang: Lang) {
  if (!article) return "";
  return lang === "en" ? articleEn[article.id]?.title ?? article.titleRu : article.titleRu;
}

export function articleAuthor(article: Article, lang: Lang) {
  if (lang === "en") return articleEn[article.id]?.author ?? article.author;
  return article.author;
}

export function articleQuote(article: Article, lang: Lang) {
  if (lang === "en") return articleEn[article.id]?.quote ?? article.quote;
  return article.quoteRu;
}

export function articleBody(article: Article, lang: Lang) {
  if (lang === "en") return articleEn[article.id]?.body ?? article.bodyRu;
  return article.bodyRu;
}
