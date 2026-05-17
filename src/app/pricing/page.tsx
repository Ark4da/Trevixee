"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/main-layout";
import { useAppStore } from "@/store";
import { TrevixeMark } from "@/components/brand/trascend-mark";
import "../landing.css";

const MONO = "var(--font-jetbrains-mono), monospace";
const SERIF = "var(--font-dm-serif), serif";
const BG = "#0A0908";
const CARD = "#15130F";
const STROKE = "rgba(255,255,255,.07)";
const INK = "#F4F1EE";
const INK2 = "#C8C4BF";
const INK3 = "#918D88";
const INK4 = "#5A5753";
const BRAND = "#F07240";

const CheckYes = ({ v = "" }: { v?: string }) => (
  <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto", background: v === "brand" ? "rgba(240,114,64,.15)" : v === "indigo" ? "rgba(99,102,241,.15)" : "rgba(34,197,94,.15)", color: v === "brand" ? BRAND : v === "indigo" ? "#8B8FF1" : "#4ADE80" }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
  </span>
);
const CheckNo = () => <span style={{ color: "#3A3835" }}>—</span>;

const PlanFeat = ({ icon, text, children }: { icon: string; text?: string; children?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: INK2, lineHeight: 1.5 }}>
    <span style={{ width: 16, height: 16, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, background: icon === "yes" ? "rgba(34,197,94,.15)" : icon === "brand" ? "rgba(240,114,64,.15)" : "rgba(99,102,241,.15)", color: icon === "yes" ? "#4ADE80" : icon === "brand" ? BRAND : "#8B8FF1" }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5L20 7"/></svg>
    </span>
    <span>{text}{children}</span>
  </div>
);

export default function PricingPage() {
  const { data: session, status } = useSession();
  const lang = useAppStore((s) => s.lang);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [teamSeats, setTeamSeats] = useState(5);
  const [checkoutLoading, setCheckoutLoading] = useState<"pro" | "team" | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [risk, setRisk] = useState(500);
  const [trades, setTrades] = useState(60);
  const [errorPct, setErrorPct] = useState(8);

  const pillRef = useRef<HTMLDivElement>(null);
  const btn1Ref = useRef<HTMLButtonElement>(null);
  const btn2Ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const pill = pillRef.current;
    const btn = interval === "monthly" ? btn1Ref.current : btn2Ref.current;
    if (pill && btn) {
      pill.style.width = btn.offsetWidth + "px";
      pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    }
  }, [interval]);

  const isRu = lang === "ru";
  const copy = (en: string, ru: string) => (isRu ? ru : en);
  const proPrice = interval === "annual" ? "$12" : "$19";
  const proBill = interval === "annual"
    ? copy("$144 / year · save 37%", "$144 / год · экономия 37%")
    : copy("monthly billing", "оплата помесячно");
  const teamPrice = interval === "annual" ? "$10" : "$15";
  const teamBill = interval === "annual"
    ? copy("annual billing · from 5 seats", "годовая оплата · от 5 мест")
    : copy("from 5 seats · up to 50", "от 5 мест · до 50");
  const teamSeatPrice = interval === "annual" ? 10 : 15;
  const teamTotal = teamSeatPrice * teamSeats;
  const highlights = [
    {
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
      title: copy("MAE / MFE for every trade", "MAE / MFE по каждой сделке"),
      desc: copy("Find the real exit point. Know how much you left on the table.", "Найди реальную точку выхода. Знай, сколько ты оставил на столе."),
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-2.5-3-3.5-6-3.5-9s1-6 3.5-9"/></svg>,
      title: copy("AI trade review", "AI разбор сделки"),
      desc: copy("GPT analysis of entry, exit, and context shows what could be improved.", "GPT-анализ входа, выхода и контекста показывает, что можно улучшить."),
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      title: copy("Time-of-day heatmap", "Тепловая карта по времени"),
      desc: copy("Learn which hour and session actually make money, and which only drain it.", "Узнай, в какой час и сессию ты реально зарабатываешь, а где только теряешь."),
    },
  ];
  const disciplineRows = [
    [copy("Unlimited trade journal", "Безлимитный журнал сделок"), true, true, true],
    [copy("Daily journal", "Ежедневный дневник"), true, true, true],
    [copy("Notebook with categories + trade links + recurring pattern detector", "Блокнот: категории, привязка к сделкам, детектор повторяющихся паттернов"), true, true, true],
    [copy("Strategy playbooks", "Плейбуки стратегий"), true, true, true],
    [copy("Goals and progress", "Цели и прогресс"), true, true, true],
    [copy("Pre-trade checklist + rule violation tracking", "Чеклист перед сделкой + трекинг нарушений правил"), true, true, true],
  ];
  const importRows = [
    [copy("CSV / XLSX import", "Импорт CSV / XLSX"), false, true, true],
    [copy("Broker CSV import", "Импорт CSV от брокера"), false, true, true],
    [copy("Data export", "Экспорт данных"), false, true, true],
    [copy("Multi-account (demo · live · prop)", "Мульти-аккаунт (демо · лайв · проп)"), false, true, true],
  ];
  const analyticsRows = [
    [copy("MAE / MFE tracking", "Учёт MAE / MFE"), true, true, true],
    [copy("Setup performance breakdown", "Разбор эффективности сетапов"), false, true, true],
    [copy("Time-of-day heatmap", "Тепловая карта по времени"), false, true, true],
    [copy("Advanced reports", "Расширенные отчёты"), false, true, true],
    [copy("Period comparisons", "Сравнения по периодам"), false, true, true],
  ];
  const aiRows = [
    [copy("AI trade review", "AI разбор сделки"), false, true, true],
    [copy("AI daily journal draft", "AI-черновик дневника дня"), false, true, true],
    [copy("Training program from weaknesses", "Программа обучения от слабостей"), false, true, true],
    [copy("Real-time risk alerts on dashboard", "Риск-алерты на дашборде в реальном времени"), false, true, true],
    [copy("TradingView webhook (auto open/close)", "TradingView webhook (авто открытие/закрытие)"), false, true, true],
  ];
  const teamRows = [
    [copy("Team workspace (up to 50 traders)", "Командное пространство (до 50 трейдеров)"), false, false, true],
    [copy("Team feed and leaderboard", "Лента команды и таблица лидеров"), false, false, true],
    [copy("Mentor comments on trades", "Комментарии ментора на сделках"), false, false, true],
    [copy("Push playbooks to the team", "Отправка плейбуков команде"), false, false, true],
    [copy("Weekly team digest email", "Еженедельный дайджест команды на почту"), false, false, true],
  ];
  const roiSliders = [
    { label: copy("Risk size", "Размер риска"), value: risk, min: 50, max: 2000, step: 50, format: `$${risk}`, setter: setRisk },
    { label: copy("Trades per month", "Сделок в месяц"), value: trades, min: 10, max: 200, step: 5, format: `${trades}`, setter: setTrades },
    { label: copy("Mistakes (%)", "Ошибок (%)"), value: errorPct, min: 2, max: 30, step: 1, format: `${errorPct}%`, setter: setErrorPct },
  ];
  const faqs = [
    {
      q: copy("Is the trial really free?", "Пробный период действительно бесплатный?"),
      a: copy(
        "Yes. 14 days of Pro without a credit card. When it ends, you automatically move to Free and your data stays saved.",
        "Да. 14 дней Pro без кредитной карты. По окончании автоматически переходишь на бесплатный план — данные сохраняются."
      ),
    },
    {
      q: copy("Can I cancel anytime?", "Можно ли отменить в любой момент?"),
      a: copy(
        "Yes, in one click from settings. Pro access remains until the end of the paid period.",
        "Да, в один клик из настроек. Доступ к Pro остаётся до конца оплаченного периода."
      ),
    },
    {
      q: copy("What happens to my Free data after the trial?", "Что с данными на бесплатном плане после окончания пробного периода?"),
      a: copy(
        "All trades, journal entries, and notes remain. Free shows the last 30 days; Pro unlocks full history.",
        "Все сделки, дневник и заметки остаются. Бесплатный план показывает последние 30 дней; на Pro — полная история без ограничений."
      ),
    },
    {
      q: copy("How does Team billing work?", "Как работает командная оплата?"),
      a: copy(
        "Billing is per seat. Minimum 5 seats, maximum 50. Pay in crypto (BTC, ETH, USDT) — each payment activates the workspace for 30 days.",
        "Подписка оплачивается за место. Минимум 5 мест, максимум 50. Оплата в крипте (BTC, ETH, USDT) — каждый платёж активирует команду на 30 дней."
      ),
    },
    {
      q: copy("Does broker CSV import support my broker?", "Поддерживается ли мой брокер для импорта CSV?"),
      a: copy(
        "Compatible with most popular brokers and exchanges: Binance, Bybit, Interactive Brokers, Tradovate. Export your trade history as CSV from the broker, upload it — the format is auto-detected.",
        "Совместимо с большинством популярных брокеров и бирж: Binance, Bybit, Interactive Brokers, Tradovate. Выгрузи историю сделок CSV у брокера, загрузи файл — формат распознаётся автоматически."
      ),
    },
    {
      q: copy("Can I get a refund?", "Получу ли я возврат средств?"),
      a: copy(
        "The 14-day trial lets you evaluate the full product. After payment, refunds are available within 7 days — contact support.",
        "14-дневный пробный период даёт оценить весь функционал. После оплаты возврат возможен в течение 7 дней — пиши в поддержку."
      ),
    },
    {
      q: copy("Student or group discounts?", "Студенческие или групповые скидки?"),
      a: copy(
        "Team gets a yearly discount: $10 per seat instead of $15. For prop firms and large groups, contact us for custom terms.",
        "На командном плане скидка включается при оплате за год — $10 за место вместо $15. Для проп-фирм и крупных групп напиши нам — обсудим персональные условия."
      ),
    },
  ];

  const saved = Math.round(risk * trades * (errorPct / 100) * 0.5);
  const roiX = Math.max(1, Math.round(saved / 19));

  const checkout = async (plan: "pro" | "team", method: "card" | "crypto" = "card") => {
    const planKey = `${plan}_${interval}`;
    const seats = plan === "team" ? teamSeats : undefined;
    setCheckoutError("");

    if (status !== "authenticated" || !session) {
      const params = new URLSearchParams({ plan: planKey });
      if (seats) params.set("seats", String(seats));
      if (method === "crypto") params.set("method", "crypto");
      window.location.href = `/auth/register?${params.toString()}`;
      return;
    }

    setCheckoutLoading(plan);
    try {
      const endpoint = method === "crypto"
        ? "/api/billing/crypto/checkout"
        : "/api/billing/checkout";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, ...(seats ? { seats } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setCheckoutError(data.error || copy("Could not start checkout. Try again.", "Не удалось открыть оплату. Попробуй снова."));
        setCheckoutLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setCheckoutError(copy("Could not start checkout. Try again.", "Не удалось открыть оплату. Попробуй снова."));
      setCheckoutLoading(null);
    }
  };

  const embedded = status === "authenticated" && !!session;

  const page = (
    <div
      data-no-auto-translate
      style={{
        background: BG,
        color: INK,
        minHeight: embedded ? "calc(100vh - 56px)" : "100vh",
        overflowX: "hidden",
        borderRadius: embedded ? 18 : 0,
      }}
    >
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: `radial-gradient(ellipse 70% 50% at 85% -5%,rgba(240,114,64,.08) 0%,transparent 55%), radial-gradient(ellipse 50% 40% at 5% 100%,rgba(99,102,241,.025) 0%,transparent 55%), linear-gradient(170deg,#060504 0%,#0A0908 50%,#0D0B09 100%)` }} />

      {/* NAV */}
      {!embedded && <nav className="lp-nav">
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <TrevixeMark size={40} />
            <span style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: "-.03em" }}>Trevixe</span>
          </Link>
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 28 }}>
            <Link href="/pricing" style={{ fontSize: 13, color: INK4, textDecoration: "none" }}>{copy("Pricing", "Тарифы")}</Link>
            <a href="#compare" style={{ fontSize: 13, color: INK4, textDecoration: "none" }}>{copy("Comparison", "Сравнение")}</a>
            <a href="#faq" style={{ fontSize: 13, color: INK4, textDecoration: "none" }}>FAQ</a>
            {!session && (
              <Link href="/auth/login" style={{ fontSize: 13, color: INK4, textDecoration: "none" }}>{copy("Sign in", "Войти")}</Link>
            )}
          </div>
          {session ? (
            <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
              {copy("To dashboard", "В dashboard")}
            </Link>
          ) : (
            <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
              {copy("Start free", "Начать бесплатно")}
            </Link>
          )}
        </div>
      </nav>}

      {/* HERO */}
      <section style={{ padding: "140px 0 40px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse,rgba(240,114,64,.1),transparent 60%)", pointerEvents: "none", zIndex: -1 }} />
        <div className="lp-container">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(240,114,64,.08)", border: "1px solid rgba(240,114,64,.2)", fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: BRAND }}>
            <span className="lp-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND, display: "inline-block" }}/>
            {copy("14 days of Pro free. No card.", "14 дней Pro бесплатно. Без карты.")}
          </div>
          <h1 style={{ fontSize: "clamp(48px,5.5vw,84px)", fontWeight: 800, lineHeight: .95, maxWidth: 900, margin: "24px auto 0", letterSpacing: "-.04em" }}>
            {copy("Simple. Honest.", "Просто. Честно.")}<br />
            <span className="grad-warm" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>{copy("No hidden fees.", "Без скрытых комиссий.")}</span>
          </h1>
          <p style={{ fontSize: 17, color: INK3, lineHeight: 1.7, maxWidth: 560, margin: "24px auto 0" }}>{copy("Start free. Upgrade to Pro when you want deeper analysis. No contracts, no obligations.", "Начни бесплатно. Перейди на Pro, когда захочешь больше глубины. Без контрактов и обязательств.")}</p>

          {/* Toggle */}
          <div style={{ marginTop: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="toggle-wrap">
              <div className="toggle-pill" ref={pillRef} />
              <button ref={btn1Ref} className={`toggle-btn${interval === "monthly" ? " active" : ""}`} onClick={() => setInterval("monthly")}>{copy("Monthly", "Помесячно")}</button>
              <button ref={btn2Ref} className={`toggle-btn${interval === "annual" ? " active" : ""}`} onClick={() => setInterval("annual")}>
                {copy("Annual", "Годовой")} <span className="save-badge">{copy("Save 37%", "Экономия 37%")}</span>
              </button>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>{copy("USD · cancel anytime", "USD · отмена в любой момент")}</span>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section style={{ padding: "0 0 64px" }}>
        <div className="lp-container">
          <div className="plans">

            {/* FREE */}
            <div className="plan">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: INK2 }}>{copy("Free", "Бесплатный")}</span>
                <span className="lp-chip lp-chip-ink">{copy("Always", "Всегда")}</span>
              </div>
              <p style={{ fontSize: 14, color: INK3, lineHeight: 1.6, marginTop: 6, minHeight: 44 }}>{copy("Journal and build discipline. No time limit.", "Веди журнал и строй дисциплину. Без ограничения времени.")}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24, minHeight: 64 }}>
                <span style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, letterSpacing: "-.05em", lineHeight: 1 }}>$0</span>
                <span style={{ fontSize: 13, color: INK4, fontFamily: MONO }}>{copy("forever", "навсегда")}</span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", color: INK4, marginTop: 4, minHeight: 14 }}>{copy("no credit card", "без карты")}</p>
              <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, width: "100%", padding: "11px 22px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: INK2, background: "transparent", border: "1px solid rgba(255,255,255,.12)", textDecoration: "none", transition: ".15s" }}>
                {copy("Start for free", "Начать бесплатно")}
              </Link>
              <div style={{ height: 1, background: STROKE, margin: "28px 0 20px" }} />
              <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 12 }}>{copy("What's included", "Что входит")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <PlanFeat icon="yes"><strong>{copy("Unlimited", "Безлимитный")}</strong> {copy("trade journal", "журнал сделок")}</PlanFeat>
                <PlanFeat icon="yes">{copy("Daily journal + notebook", "Ежедневный дневник + блокнот")}</PlanFeat>
                <PlanFeat icon="yes">{copy("Playbooks, goals, progress", "Плейбуки, цели, прогресс")}</PlanFeat>
                <PlanFeat icon="yes">{copy("Pre-trade checklist and rule violation tracking", "Чеклист перед сделкой и трекинг нарушений правил")}</PlanFeat>
                <PlanFeat icon="yes"><strong>MAE / MFE</strong> {copy("tracking per trade", "по каждой сделке")}</PlanFeat>
                <PlanFeat icon="yes">{copy("History for the", "История за")} <strong>{copy("last 62 days", "последние 62 дня")}</strong></PlanFeat>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 24 }}>
                <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: INK4, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  {copy("Data is yours only", "Данные только у тебя")}
                </p>
              </div>
            </div>

            {/* PRO */}
            <div className="plan featured">
              <span className="plan-tag">{copy("Most popular", "Популярный")}</span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: BRAND }}>Pro</span>
                <span className="lp-chip lp-chip-brand">{copy("14-day trial", "14 дней бесплатно")}</span>
              </div>
              <p style={{ fontSize: 14, color: INK3, lineHeight: 1.6, marginTop: 6, minHeight: 44 }}>{copy("Deep analytics. Find your real edge and scale it.", "Глубокий анализ. Найди своё реальное преимущество и масштабируй его.")}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24, minHeight: 64 }}>
                <span style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, letterSpacing: "-.05em", lineHeight: 1, background: "linear-gradient(135deg,#FFB075 0%,#F07240 60%,#C85A1A 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {proPrice}
                </span>
                <span style={{ fontSize: 13, color: INK4, fontFamily: MONO }}>/ {interval === "annual" ? copy("mo", "мес") : copy("month", "месяц")}</span>
                {interval === "annual" && <span style={{ fontFamily: MONO, fontSize: 18, color: "#3A3835", textDecoration: "line-through", marginLeft: 6, fontWeight: 500 }}>$19</span>}
              </div>
              <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", color: INK4, marginTop: 4, minHeight: 14 }}>{proBill}</p>
              <button disabled={checkoutLoading !== null} onClick={() => checkout("pro")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 24, width: "100%", padding: "11px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff", background: BRAND, border: "none", cursor: checkoutLoading ? "wait" : "pointer", boxShadow: "0 6px 24px rgba(240,114,64,.28)", transition: ".15s", fontFamily: "inherit", opacity: checkoutLoading && checkoutLoading !== "pro" ? .65 : 1 }}>
                {checkoutLoading === "pro" ? copy("Opening checkout...", "Открываем оплату...") : copy("Start 14-day trial", "Начать 14 дней бесплатно")}
              </button>
              <button
                type="button"
                disabled={checkoutLoading !== null}
                onClick={() => checkout("pro", "crypto")}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, width: "100%", padding: "8px 22px", borderRadius: 10, fontSize: 12, fontWeight: 500, color: INK3, background: "transparent", border: `1px solid ${STROKE}`, cursor: checkoutLoading ? "wait" : "pointer", transition: ".15s", fontFamily: "inherit" }}
                aria-label={copy("Pay with crypto", "Оплатить криптой")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/></svg>
                {copy("Pay with crypto (BTC, ETH, USDT)", "Оплатить криптой (BTC, ETH, USDT)")}
              </button>
              <div style={{ height: 1, background: STROKE, margin: "28px 0 20px" }} />
              <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: BRAND, marginBottom: 12 }}>{copy("Everything in Free, plus", "Всё из Бесплатного, плюс")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <PlanFeat icon="brand"><strong>{copy("Unlimited history", "Безлимитная история")}</strong> + {copy("period comparison", "сравнение периодов")}</PlanFeat>
                <PlanFeat icon="brand">CSV / XLSX {copy("import", "импорт")} + <strong>{copy("broker CSV import", "импорт CSV от брокера")}</strong></PlanFeat>
                <PlanFeat icon="brand">{copy("Setup performance + time-of-day heatmap", "Эффективность сетапов + тепловая карта по времени")}</PlanFeat>
                <PlanFeat icon="brand"><strong>{copy("AI trade review", "AI разбор сделки")}</strong> {copy("for every closed trade", "на каждую закрытую сделку")}</PlanFeat>
                <PlanFeat icon="brand"><strong>{copy("AI journal draft", "AI-черновик дневника")}</strong> {copy("from the day's trades", "из сделок дня")}</PlanFeat>
                <PlanFeat icon="brand">{copy("Real-time risk alerts on dashboard", "Риск-алерты на дашборде в реальном времени")}</PlanFeat>
                <PlanFeat icon="brand"><strong>TradingView webhook</strong> {copy("for auto trade logging", "для авто-логирования сделок")}</PlanFeat>
                <PlanFeat icon="brand">{copy("Training program from", "Учебная программа от")} <strong>{copy("your weaknesses", "твоих слабостей")}</strong></PlanFeat>
                <PlanFeat icon="brand">{copy("Multi-account: demo · live · prop", "Мульти-аккаунт: демо · лайв · проп")}</PlanFeat>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 24 }}>
                <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: BRAND, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7"/></svg>
                  {copy("Pays back with one good trade", "Окупается с одной правильной сделки")}
                </p>
              </div>
            </div>

            {/* TEAM */}
            <div className="plan">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "#8B8FF1" }}>{copy("Team", "Команда")}</span>
                <span className="lp-chip lp-chip-indigo">{copy("per seat", "за место")}</span>
              </div>
              <p style={{ fontSize: 14, color: INK3, lineHeight: 1.6, marginTop: 6, minHeight: 44 }}>{copy("Trade and learn with a group, mentor, or students.", "Торгуй и учись вместе с группой, ментором или студентами.")}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24, minHeight: 64 }}>
                <span style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, letterSpacing: "-.05em", lineHeight: 1 }}>{teamPrice}</span>
                <span style={{ fontSize: 13, color: INK4, fontFamily: MONO }}>
                  {copy("/ mo · seat", "/ мес · место")}
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", color: INK4, marginTop: 4, minHeight: 14 }}>{teamBill}</p>
              <div style={{ marginTop: 18, padding: 12, borderRadius: 12, border: "1px solid rgba(99,102,241,.18)", background: "rgba(99,102,241,.045)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "#8B8FF1" }}>
                    {copy("Team seats", "Места команды")}
                  </span>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setTeamSeats((value) => Math.max(5, value - 1))}
                      aria-label={copy("Remove seat", "Убрать место")}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(99,102,241,.28)", background: "rgba(10,9,8,.65)", color: INK2, cursor: teamSeats <= 5 ? "not-allowed" : "pointer", opacity: teamSeats <= 5 ? .45 : 1 }}
                    >
                      -
                    </button>
                    <span style={{ minWidth: 22, textAlign: "center", fontFamily: MONO, fontSize: 14, fontWeight: 700, color: INK }}>
                      {teamSeats}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTeamSeats((value) => Math.min(50, value + 1))}
                      aria-label={copy("Add seat", "Добавить место")}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(99,102,241,.28)", background: "rgba(10,9,8,.65)", color: INK2, cursor: teamSeats >= 50 ? "not-allowed" : "pointer", opacity: teamSeats >= 50 ? .45 : 1 }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: INK3, lineHeight: 1.5 }}>
                  {copy("Estimated checkout total:", "Сумма для тестовой оплаты:")}{" "}
                  <strong style={{ color: "#8B8FF1", fontFamily: MONO }}>${teamTotal}/{copy("mo", "мес")}</strong>
                </p>
              </div>
              <button disabled={checkoutLoading !== null} onClick={() => checkout("team")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 16, width: "100%", padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "#8B8FF1", background: "transparent", border: "1px solid rgba(99,102,241,.4)", cursor: checkoutLoading ? "wait" : "pointer", transition: ".15s", fontFamily: "inherit", opacity: checkoutLoading && checkoutLoading !== "team" ? .65 : 1 }}>
                {checkoutLoading === "team" ? copy("Opening checkout...", "Открываем оплату...") : copy("Start team trial", "Начать пробный период команды")}
              </button>
              <button
                type="button"
                disabled={checkoutLoading !== null}
                onClick={() => checkout("team", "crypto")}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, width: "100%", padding: "8px 22px", borderRadius: 10, fontSize: 12, fontWeight: 500, color: INK3, background: "transparent", border: `1px solid ${STROKE}`, cursor: checkoutLoading ? "wait" : "pointer", transition: ".15s", fontFamily: "inherit" }}
                aria-label={copy("Pay with crypto", "Оплатить криптой")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/></svg>
                {copy("Pay with crypto", "Оплатить криптой")}
              </button>
              {checkoutError && (
                <p style={{ marginTop: 12, fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>
                  {checkoutError}
                </p>
              )}
              <div style={{ height: 1, background: STROKE, margin: "28px 0 20px" }} />
              <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "#8B8FF1", marginBottom: 12 }}>{copy("Everything in Pro, plus", "Всё из Pro, плюс")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <PlanFeat icon="indigo"><strong>{copy("Workspace", "Рабочее пространство")}</strong> {copy("up to 50 traders", "до 50 трейдеров")}</PlanFeat>
                <PlanFeat icon="indigo">{copy("Team feed and leaderboard", "Командная лента и таблица лидеров")}</PlanFeat>
                <PlanFeat icon="indigo"><strong>{copy("Mentor comments", "Комментарии ментора")}</strong> {copy("on trades", "на сделках")}</PlanFeat>
                <PlanFeat icon="indigo">{copy("Push playbooks to the whole team in one click", "Отправка плейбуков всей команде одной кнопкой")}</PlanFeat>
                <PlanFeat icon="indigo">{copy("Weekly team digest by email", "Еженедельный дайджест команды на почту")}</PlanFeat>
                <PlanFeat icon="indigo">{copy("Roles:", "Роли:")} <strong>{copy("owner · mentor · member", "владелец · ментор · участник")}</strong></PlanFeat>
              </div>
              <div style={{ marginTop: "auto", paddingTop: 24 }}>
                <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "#8B8FF1", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="4"/></svg>
                  {copy("Pay in crypto · 30-day periods", "Оплата криптой · периоды по 30 дней")}
                </p>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 48, flexWrap: "wrap", color: INK4 }}>
            {[
              copy("No card for trial", "Без карты для пробного периода"),
              copy("Cancel in one click", "Отмена в один клик"),
              copy("Crypto secured", "Оплата криптой"),
              copy("Data stays saved after cancellation", "Данные сохраняются после отмены"),
            ].map(t => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5"><path d="M5 12l5 5L20 7"/></svg>
                {t}
              </span>
            ))}
          </div>

          {/* Highlight blocks */}
          <div className="highlight-grid">
            {highlights.map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: 20, borderRadius: 14, background: "linear-gradient(140deg,rgba(255,255,255,.025),rgba(255,255,255,.005))", border: `1px solid ${STROKE}`, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(240,114,64,.12)", color: BRAND }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{title}</p>
                  <p style={{ fontSize: 12.5, color: INK3, marginTop: 4, lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section id="compare" style={{ padding: "64px 0" }}>
        <div className="lp-container">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 12 }}>{copy("Feature comparison", "Сравнение функций")}</p>
            <h2 style={{ fontSize: "clamp(28px,3.2vw,42px)", fontWeight: 800, lineHeight: 1.1 }}>{copy("What each plan includes.", "Что входит в каждый план.")}</h2>
          </div>
          <div style={{ background: CARD, border: `1px solid ${STROKE}`, borderRadius: 16, overflow: "hidden", marginTop: 32 }}>
            <div className="compare-head">
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: INK3 }}>{copy("Feature", "Функция")}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: INK3, textAlign: "center" }}>{copy("Free", "Бесплатный")}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: BRAND, textAlign: "center" }}>Pro</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "#8B8FF1", textAlign: "center" }}>{copy("Team", "Команда")}</div>
            </div>

            <div className="compare-section-title">{copy("Journal and discipline", "Журнал и дисциплина")}</div>
            {disciplineRows.map(([feat, f, p, t]) => (
              <div key={feat as string} className="compare-row">
                <div style={{ fontSize: 13.5, color: INK2 }}>{feat as string}</div>
                <div style={{ textAlign: "center" }}>{f ? <CheckYes /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{p ? <CheckYes v="brand" /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{t ? <CheckYes v="indigo" /> : <CheckNo />}</div>
              </div>
            ))}

            <div className="compare-section-title">{copy("History and import", "История и импорт")}</div>
            <div className="compare-row">
              <div style={{ fontSize: 13.5, color: INK2 }}>{copy("Trade history", "История сделок")}</div>
              <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 12, color: INK3 }}>{copy("30 days", "30 дней")}</div>
              <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 600, color: BRAND }}>{copy("Unlimited", "Безлимит")}</div>
              <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "#8B8FF1" }}>{copy("Unlimited", "Безлимит")}</div>
            </div>
            {importRows.map(([feat, f, p, t]) => (
              <div key={feat as string} className="compare-row">
                <div style={{ fontSize: 13.5, color: INK2 }}>{feat as string}</div>
                <div style={{ textAlign: "center" }}>{f ? <CheckYes /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{p ? <CheckYes v="brand" /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{t ? <CheckYes v="indigo" /> : <CheckNo />}</div>
              </div>
            ))}

            <div className="compare-section-title">{copy("Deep analytics", "Глубокая аналитика")}</div>
            {analyticsRows.map(([feat, f, p, t]) => (
              <div key={feat as string} className="compare-row">
                <div style={{ fontSize: 13.5, color: INK2 }}>{feat as string}</div>
                <div style={{ textAlign: "center" }}>{f ? <CheckYes /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{p ? <CheckYes v="brand" /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{t ? <CheckYes v="indigo" /> : <CheckNo />}</div>
              </div>
            ))}

            <div className="compare-section-title">{copy("AI and learning", "AI и обучение")}</div>
            {aiRows.map(([feat, f, p, t]) => (
              <div key={feat as string} className="compare-row">
                <div style={{ fontSize: 13.5, color: INK2 }}>{feat as string}</div>
                <div style={{ textAlign: "center" }}>{f ? <CheckYes /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{p ? <CheckYes v="brand" /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{t ? <CheckYes v="indigo" /> : <CheckNo />}</div>
              </div>
            ))}

            <div className="compare-section-title">{copy("Team", "Команда")}</div>
            {teamRows.map(([feat, f, p, t], idx, arr) => (
              <div key={feat as string} className="compare-row" style={{ borderBottom: idx === arr.length - 1 ? "none" : undefined }}>
                <div style={{ fontSize: 13.5, color: INK2 }}>{feat as string}</div>
                <div style={{ textAlign: "center" }}>{f ? <CheckYes /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{p ? <CheckYes v="brand" /> : <CheckNo />}</div>
                <div style={{ textAlign: "center" }}>{t ? <CheckYes v="indigo" /> : <CheckNo />}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI CALCULATOR */}
      <section style={{ padding: "64px 0" }}>
        <div className="lp-container">
          <div style={{ padding: 48, borderRadius: 24, background: "linear-gradient(160deg,rgba(240,114,64,.05),rgba(240,114,64,.01) 40%,#15130F)", border: "1px solid rgba(240,114,64,.12)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -100, right: -50, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(closest-side,rgba(240,114,64,.08),transparent)", pointerEvents: "none" }} />
            <div className="roi-grid">
              <div>
                <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: BRAND, marginBottom: 16 }}>{copy("Payback", "Окупаемость")}</p>
                <h2 style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "clamp(28px,3.2vw,42px)", fontWeight: 400, lineHeight: 1.1 }}>
                  {copy("What is", "Сколько стоит")} <em style={{ color: BRAND }}>{copy("one", "одна")}</em> {copy("avoided mistake trade worth?", "сделка без ошибки?")}
                </h2>
                <p style={{ fontSize: 14, color: INK3, lineHeight: 1.7, marginTop: 16, maxWidth: 420 }}>{copy("Pro pays back from one trade you skip because you saw the pattern in your data. Estimate your savings.", "Pro окупается с одной сделки, которую ты не открыл, потому что увидел паттерн в данных. Прикинь свою экономию.")}</p>
              </div>
              <div style={{ background: CARD, border: `1px solid ${STROKE}`, borderRadius: 14, padding: 28 }}>
                {roiSliders.map(({ label, value, min, max, step, format, setter }) => (
                  <div key={label} className="slider-row">
                    <span style={{ fontSize: 12, color: INK3, width: 120, flexShrink: 0, fontFamily: MONO, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</span>
                    <input type="range" min={min} max={max} step={step} value={value} onChange={e => setter(+e.target.value)} style={{ flex: 1 }} />
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BRAND, minWidth: 60, textAlign: "right" }}>{format}</span>
                  </div>
                ))}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${STROKE}`, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>{copy("Pro saves per month", "Pro экономит в мес.")}</p>
                    <p className="grad-warm" style={{ fontFamily: MONO, fontWeight: 700, fontSize: 38, marginTop: 8 }}>${saved.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>{copy("Pro cost", "Стоимость Pro")}</p>
                    <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: INK3, marginTop: 8 }}>{copy("$19/mo", "$19/мес")}</p>
                    <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#4ADE80", marginTop: 4 }}>×{roiX} ROI</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "64px 0" }}>
        <div className="lp-container">
          <div className="faq-grid">
            <div className="faq-c4">
              <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 12 }}>FAQ</p>
              <h2 style={{ fontSize: "clamp(28px,3vw,40px)", fontWeight: 800, lineHeight: 1.1 }}>
                {copy("Questions before", "Вопросы перед")}<br />{copy("payment.", "оплатой.")}
              </h2>
              <p style={{ fontSize: 14, color: INK3, marginTop: 16, lineHeight: 1.7 }}>
                {copy("Didn't find an answer? Email", "Не нашёл ответа? Пиши")} <a href="mailto:hi@trevixe.com" style={{ color: BRAND, textDecoration: "none" }}>hi@trevixe.com</a>
              </p>
            </div>
            <div className="faq-c8">
              {faqs.map((item, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${STROKE}` }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "22px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: INK2 }}
                  >
                    <span>{item.q}</span>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${openFaq === i ? "rgba(240,114,64,.4)" : "rgba(255,255,255,.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, color: openFaq === i ? BRAND : INK4, transform: openFaq === i ? "rotate(45deg)" : "none", transition: ".2s" }}>+</span>
                  </button>
                  <div style={{ overflow: "hidden", maxHeight: openFaq === i ? 280 : 0, transition: "max-height .35s ease, padding .3s", paddingBottom: openFaq === i ? 20 : 0 }}>
                    <p style={{ fontSize: 14, color: INK3, lineHeight: 1.75 }}>{item.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section>
        <div className="lp-container">
          <div style={{ marginBottom: 96, padding: 64, borderRadius: 24, background: "linear-gradient(140deg,rgba(240,114,64,.1),rgba(240,114,64,.02) 50%,#15130F)", border: "1px solid rgba(240,114,64,.18)", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -100, right: -50, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(closest-side,rgba(240,114,64,.12),transparent)", pointerEvents: "none" }} />
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 16 }}>
              {copy("Start", "Старт")}
            </p>
            <h2 style={{ fontSize: "clamp(36px,4vw,60px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-.04em", maxWidth: 700, margin: "0 auto" }}>
              {copy("Open your first trade", "Открой первую сделку")}<br />
              <span className="grad-warm" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>
                {copy("with full review.", "с полным разбором.")}
              </span>
            </h2>
            <p style={{ fontSize: 15, color: INK3, marginTop: 20, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.75 }}>
              {copy("14 days of Pro. No card. Cancel in one click. Data stays saved.", "14 дней Pro. Без карты. Отмена в один клик. Данные сохраняются.")}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 32, flexWrap: "wrap", position: "relative" }}>
              <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
                {copy("Start 14-day trial", "Начать 14 дней бесплатно")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
              <Link href="/#features" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontSize: 15, fontWeight: 500, color: INK2, background: "transparent", border: "1px solid rgba(255,255,255,.12)", textDecoration: "none" }}>
                {copy("See features", "Посмотреть возможности")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      {!embedded && <footer style={{ padding: "48px 0 32px", borderTop: `1px solid ${STROKE}`, marginTop: 32 }}>
        <div className="lp-container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TrevixeMark size={22} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Trevixe</span>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835", marginLeft: 8 }}>© 2026 · {copy("Made in Ukraine", "Сделано в Украине")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {[
                [copy("Privacy", "Конфиденциальность"), "/privacy"],
                [copy("Terms", "Условия"), "/tos"],
                [copy("Refund", "Возврат"), "/refund"],
                ["hi@trevixe.com", "mailto:hi@trevixe.com"],
              ].map(([l,h]) => (
                <a key={l} href={h} style={{ fontSize: 12, color: INK4, textDecoration: "none", fontFamily: l.includes("@") ? MONO : undefined }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>}
    </div>
  );

  return embedded ? <MainLayout>{page}</MainLayout> : page;
}
