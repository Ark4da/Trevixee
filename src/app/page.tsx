import { Fragment } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrevixeMark } from "@/components/brand/trascend-mark";
import { LanguageToggle } from "@/components/language-toggle";
import "./landing.css";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const BG = "#0A0908";
  const CARD = "#15130F";
  const CANVAS = "#0A0908";
  const STROKE = "rgba(255,255,255,.07)";
  const INK = "#F4F1EE";
  const INK2 = "#C8C4BF";
  const INK3 = "#918D88";
  const INK4 = "#5A5753";
  const BRAND = "#F07240";
  const MONO = "var(--font-jetbrains-mono), monospace";
  const SERIF = "var(--font-dm-serif), serif";

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", overflowX: "hidden" }}>
      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: `radial-gradient(ellipse 70% 50% at 85% -5%,rgba(240,114,64,.08) 0%,transparent 55%), radial-gradient(ellipse 50% 40% at 5% 100%,rgba(99,102,241,.025) 0%,transparent 55%), linear-gradient(170deg,#060504 0%,#0A0908 50%,#0D0B09 100%)` }} />

      {/* NAV */}
      <nav className="lp-nav">
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <TrevixeMark size={40} />
            <span style={{ fontSize: 20, fontWeight: 700, color: INK, letterSpacing: "-.03em" }}>Trevixe</span>
          </Link>
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 28 }}>
            {[["#features","Возможности"],["#workflow","Как это работает"]].map(([h,l]) => (
              <a key={h} href={h} style={{ fontSize: 13, color: INK4, textDecoration: "none", transition: "color .15s" }}>{l}</a>
            ))}
            <Link href="/pricing" style={{ fontSize: 13, color: INK4, textDecoration: "none" }}>Тарифы</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LanguageToggle />
            <Link href="/auth/login" className="lp-nav-login" style={{ alignItems: "center", padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: INK2, background: "transparent", border: "1px solid rgba(255,255,255,.14)", textDecoration: "none" }}>
              Войти
            </Link>
            <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
              Начать бесплатно
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "140px 0 80px" }}>
        <div className="lp-container">
          <div className="hero-grid">
            {/* Left: text */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(240,114,64,.08)", border: "1px solid rgba(240,114,64,.2)", fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: BRAND }}>
                <span className="lp-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND, display: "inline-block" }} />
                v2.0 · AI разбор сделки
              </div>
              <h1 style={{ fontSize: "clamp(48px,6vw,92px)", fontWeight: 800, lineHeight: .94, letterSpacing: "-.04em", marginTop: 24 }}>
                Журнал, который<br />
                превращает сделки в <span className="grad-warm" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>edge</span>.
              </h1>
              <p style={{ fontSize: 17, color: INK2, lineHeight: 1.7, marginTop: 24, maxWidth: 520 }}>
                Дисциплина, MAE/MFE анализ, AI-разборы и команда — в одном месте. Веди журнал бесплатно. Открой Pro, когда будешь готов копать глубже.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
                  Начать бесплатно
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontSize: 15, fontWeight: 600, color: INK, background: "transparent", border: "1px solid rgba(255,255,255,.18)", textDecoration: "none" }}>
                  Войти
                </Link>
                <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "14px 18px", fontSize: 14, fontWeight: 500, color: INK3, textDecoration: "none" }}>
                  <span>Тарифы</span>
                  <span aria-hidden style={{ marginLeft: 2 }}>→</span>
                </Link>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 32, flexWrap: "wrap", color: INK4 }}>
                {["14 дней Pro бесплатно","Без карты","Безлимит сделок"].map(t => (
                  <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5"><path d="M5 12l5 5L20 7"/></svg>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: equity card */}
            <div className="eq-card lp-fade-up">
              <div className="eq-head">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: INK3 }}>Equity · 90d</span>
                  <span className="lp-chip lp-chip-sage">+18.4%</span>
                </div>
                <div className="eq-tabs">
                  {["7d","30d","90d","All"].map(t => <span key={t} className={`eq-tab${t==="90d"?" active":""}`}>{t}</span>)}
                </div>
              </div>
              <div className="eq-body">
                <div className="eq-stats">
                  <div className="s"><p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Net P&amp;L</p><p className="lp-fade-up" style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: "#4ADE80", marginTop: 4 }}>+$8,420</p></div>
                  <div className="s"><p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Win rate</p><p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, marginTop: 4 }}>62.4%</p></div>
                  <div className="s"><p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Profit factor</p><p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: BRAND, marginTop: 4 }}>2.18</p></div>
                  <div className="s"><p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Сделок</p><p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, marginTop: 4 }}>147</p></div>
                </div>
                <svg viewBox="0 0 600 220" style={{ width: "100%", height: "auto" }} className="grid-lines" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="eq-g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#F07240" stopOpacity=".25"/>
                      <stop offset="1" stopColor="#F07240" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,180 L40,175 L80,170 L120,150 L160,160 L200,140 L240,135 L280,115 L320,125 L360,95 L400,85 L440,90 L480,65 L520,55 L560,40 L600,30" fill="none" stroke="#F07240" strokeWidth="2.5" className="draw"/>
                  <path d="M0,180 L40,175 L80,170 L120,150 L160,160 L200,140 L240,135 L280,115 L320,125 L360,95 L400,85 L440,90 L480,65 L520,55 L560,40 L600,30 L600,220 L0,220 Z" fill="url(#eq-g)"/>
                  <circle cx="600" cy="30" r="4" fill="#F07240"/>
                  <circle cx="600" cy="30" r="9" fill="#F07240" opacity=".25" className="lp-pulse"/>
                </svg>
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Сегодня · 4 сделки</span>
                    <span className="lp-chip lp-chip-sage">3W / 1L</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {[["NQ · 09:45","+$340","#4ADE80"],["ES · 10:12","+$215","#4ADE80"],["NQ · 11:30","-$125","#F87171"],["ES · 13:20","+$420","#4ADE80"]].map(([inst,pnl,c]) => (
                      <div key={inst} style={{ padding: 10, background: CANVAS, border: `1px solid ${STROKE}`, borderRadius: 8 }}>
                        <p style={{ fontSize: 10, color: INK4, fontFamily: MONO }}>{inst}</p>
                        <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: c, marginTop: 4 }}>{pnl}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pillars */}
          <div className="pillars">
            {[
              ["/ 01", "30", "дней истории на Free, безлимит на Pro", "дней"],
              ["/ 02", "14", "дней Pro trial без карты", "дней"],
              ["/ 03", "$19", "или $12 при годовой", "/мес"],
              ["/ 04", "50", "в Team workspace", "seats"],
            ].map(([num, val, lbl, suffix]) => (
              <div key={num} style={{ padding: "32px 24px", background: CARD, textAlign: "center" }}>
                <p style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".15em", color: INK4, marginBottom: 24 }}>{num}</p>
                <p className={num === "/ 03" ? "grad-warm" : ""} style={{ fontFamily: MONO, fontSize: 42, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1, color: num === "/ 01" ? "var(--color-brand)" : undefined }}>
                  {val}{suffix && <span style={{ fontSize: 18, color: INK3, marginLeft: 4 }}>{suffix}</span>}
                </p>
                <p style={{ fontSize: 13, color: INK3, marginTop: 10, lineHeight: 1.55 }}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "32px 0 0" }}>
        <div className="lp-container">
          <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto", paddingBottom: 32 }}>
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 12 }}>Возможности</p>
            <h2 style={{ fontSize: "clamp(36px,4vw,60px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-.04em" }}>
              Не просто журнал.<br />
              <span className="grad-warm" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>Аналитический партнёр.</span>
            </h2>
          </div>

          {/* Feature 1: AI */}
          <div className="feat-row">
            <div>
              <span className="lp-chip lp-chip-brand">AI · Pro</span>
              <h3 style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.1, marginTop: 14 }}>
                Разбор каждой сделки <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>от AI.</span>
              </h3>
              <p style={{ fontSize: 15, color: INK3, lineHeight: 1.75, marginTop: 20, maxWidth: 480 }}>Trevixe читает контекст рынка, твой вход, выход и плейбук — и пишет персональный разбор. Что сделано правильно. Что было лишним. Какой паттерн повторяется.</p>
              <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Анализ по фактам сделки + контексту дня","Сравнение с твоим плейбуком и историей","Еженедельный разбор недели по сделкам","Курс обучения, построенный из твоих ошибок"].map(item => (
                  <li key={item} style={{ fontSize: 13.5, color: INK2, display: "flex", gap: 10, alignItems: "flex-start", listStyle: "none" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: BRAND, marginTop: 9, flexShrink: 0, display: "block" }}/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feat-vis">
              <div className="vis-card">
                <div className="vis-head">
                  <div className="vis-dots"><span/><span/><span/></div>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>AI Review · NQ short · 2026-04-15</span>
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ padding: 14, background: CANVAS, border: `1px solid ${STROKE}`, borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span className="lp-chip lp-chip-sage">+$420 · 1.8R</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>10:42 · 14m hold</span>
                    </div>
                    <p style={{ fontSize: 12, color: INK3, fontFamily: MONO }}>NQ · short @ 18,420 · TP @ 18,375</p>
                  </div>
                  <div style={{ padding: 16, background: "linear-gradient(140deg,rgba(240,114,64,.06),transparent)", border: "1px solid rgba(240,114,64,.2)", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: BRAND }}>AI Review</span>
                    </div>
                    <p style={{ fontSize: 13, color: INK2, lineHeight: 1.7 }}>«Хороший вход в зоне отвержения. <strong>Но: ты вышел на 1.8R при цели 2.5R</strong> — третий раз за неделю. Паттерн: ранний выход после прибыли в +1R. Закрепи цель в плейбуке и используй trailing stop вместо ручного выхода.»</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                      <span className="lp-chip lp-chip-amber" style={{ fontSize: 9 }}>early exit</span>
                      <span className="lp-chip lp-chip-amber" style={{ fontSize: 9 }}>3rd this week</span>
                      <span className="lp-chip lp-chip-sage" style={{ fontSize: 9 }}>good entry</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: MAE/MFE */}
          <div className="feat-row flip">
            <div>
              <span className="lp-chip lp-chip-brand">Pro</span>
              <h3 style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.1, marginTop: 14 }}>
                MAE / MFE: сколько ты <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>оставил на столе.</span>
              </h3>
              <p style={{ fontSize: 15, color: INK3, lineHeight: 1.75, marginTop: 20, maxWidth: 480 }}>Maximum Adverse / Favorable Excursion на каждую сделку. Узнай реальную просадку каждой позиции и максимальную потенциальную прибыль — найди оптимальные точки выхода.</p>
              <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Просадка и максимум на каждую сделку — автоматически","Сравнение реального выхода с MFE","Подсветка систематических ошибок выхода","Калибровка стоп-лоссов от твоей реальной MAE"].map(item => (
                  <li key={item} style={{ fontSize: 13.5, color: INK2, display: "flex", gap: 10, alignItems: "flex-start", listStyle: "none" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: BRAND, marginTop: 9, flexShrink: 0, display: "block" }}/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feat-vis">
              <div className="vis-card">
                <div className="vis-head">
                  <div className="vis-dots"><span/><span/><span/></div>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Excursion analysis · last 30 trades</span>
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                    <div style={{ padding: 14, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 10 }}>
                      <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#4ADE80" }}>Avg MFE captured</p>
                      <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color: "#4ADE80", marginTop: 8 }}>68%</p>
                      <p style={{ fontSize: 11, color: INK4, marginTop: 4 }}>из доступного движения</p>
                    </div>
                    <div style={{ padding: 14, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10 }}>
                      <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#F87171" }}>Avg MAE</p>
                      <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color: "#F87171", marginTop: 8 }}>-0.6R</p>
                      <p style={{ fontSize: 11, color: INK4, marginTop: 4 }}>средняя просадка перед TP</p>
                    </div>
                  </div>
                  <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835", marginBottom: 12 }}>Распределение MFE</p>
                  <svg viewBox="0 0 400 80" style={{ width: "100%", height: "auto" }} preserveAspectRatio="none">
                    {[
                      [0,50,30,"#3A3835",0],[28,35,45,"#5A5753",.05],[56,20,60,"#918D88",.1],
                      [84,10,70,"#F07240",.15],[112,5,75,"#FF8252",.2],[140,22,58,"#F07240",.25],
                      [168,40,40,"#918D88",.3],[196,55,25,"#5A5753",.35],[224,62,18,"#3A3835",.4],
                      [252,68,12,"#3A3835",.45],[280,72,8,"#3A3835",.5],[308,74,6,"#3A3835",.55],
                    ].map(([x,y,h,fill,delay]) => (
                      <rect key={x} x={x} y={y} width="22" height={h} fill={fill as string} rx="2" className="lp-bar" style={{ animationDelay: `${delay}s` }}/>
                    ))}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: INK4, fontFamily: MONO }}>
                    <span>0R</span><span>1R</span><span>2R</span><span>3R</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Heatmap */}
          <div className="feat-row">
            <div>
              <span className="lp-chip lp-chip-brand">Pro</span>
              <h3 style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.1, marginTop: 14 }}>
                Когда ты <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>реально</span> зарабатываешь.
              </h3>
              <p style={{ fontSize: 15, color: INK3, lineHeight: 1.75, marginTop: 20, maxWidth: 480 }}>Тепловая карта по дням недели и часам сессии. Найди свой золотой час и убери из расписания то, что только сжигает капитал.</p>
              <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Тепловая карта по дням и часам","Сравнение эффективности по сессиям","Подсветка часов с отрицательным ожиданием","Рекомендации по оптимальному окну торговли"].map(item => (
                  <li key={item} style={{ fontSize: 13.5, color: INK2, display: "flex", gap: 10, alignItems: "flex-start", listStyle: "none" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: BRAND, marginTop: 9, flexShrink: 0, display: "block" }}/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feat-vis">
              <div className="vis-card">
                <div className="vis-head">
                  <div className="vis-dots"><span/><span/><span/></div>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Performance heatmap · 90d · NQ</span>
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto repeat(8,1fr)", gap: 4 }}>
                    <div/>{["9","10","11","12","13","14","15","16"].map(h => <div key={h} style={{ fontFamily: MONO, fontSize: 9, textAlign: "center", color: "#3A3835" }}>{h}</div>)}
                    {[
                      ["Mon","#5A5753","#F07240","#FF8252","#918D88","#5A5753","#AC5A56","#5A5753","#3A3835"],
                      ["Tue","#918D88","#FF8252","#FF8252","#F07240","#918D88","#5A5753","#3A3835","#3A3835"],
                      ["Wed","#5A5753","#F07240","#FF8252","#FFB075","#5A5753","#3A3835","#AC5A56","#3A3835"],
                      ["Thu","#918D88","#F07240","#5A5753","#5A5753","#AC5A56","#5A5753","#3A3835","#3A3835"],
                      ["Fri","#5A5753","#F07240","#FF8252","#918D88","#3A3835","#3A3835","#3A3835","#3A3835"],
                    ].map(([day, ...colors]) => (
                      <Fragment key={day as string}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: "#3A3835", alignSelf: "center" }}>{day}</div>
                        {colors.map((c, i) => <div key={i} style={{ aspectRatio: "1", background: c as string, borderRadius: 3 }}/>)}
                      </Fragment>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, justifyContent: "flex-end", fontSize: 10, color: INK4, fontFamily: MONO }}>
                    <span>−$$</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {["#AC5A56","#3A3835","#5A5753","#918D88","#F07240","#FFB075"].map(c => <div key={c} style={{ width: 14, height: 8, background: c, borderRadius: 2 }}/>)}
                    </div>
                    <span>+$$</span>
                  </div>
                  <div style={{ marginTop: 18, padding: 12, background: CANVAS, borderLeft: `2px solid ${BRAND}`, borderRadius: "0 8px 8px 0" }}>
                    <p style={{ fontSize: 12.5, color: INK2, lineHeight: 1.5 }}><strong style={{ color: BRAND }}>Вывод:</strong> Твой золотой час — вторник 10–11, +$890/час. Четверг с 13:00 системно теряет $230/час.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 4: Team */}
          <div className="feat-row flip" style={{ borderBottom: "none" }}>
            <div>
              <span className="lp-chip lp-chip-indigo">Team</span>
              <h3 style={{ fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.1, marginTop: 14 }}>
                Группа, ментор, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>push playbook.</span>
              </h3>
              <p style={{ fontSize: 15, color: INK3, lineHeight: 1.75, marginTop: 20, maxWidth: 480 }}>Командное пространство до 50 трейдеров с лентой, таблицей лидеров и комментариями ментора. Раздавай плейбуки в один клик. Получай еженедельный дайджест команды.</p>
              <ul style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Лента сделок и таблица лидеров команды","Комментарии ментора прямо на сделках","Отправить плейбук всей группе одной кнопкой","Роли: владелец · ментор · участник · пропорциональная оплата"].map(item => (
                  <li key={item} style={{ fontSize: 13.5, color: INK2, display: "flex", gap: 10, alignItems: "flex-start", listStyle: "none" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: BRAND, marginTop: 9, flexShrink: 0, display: "block" }}/>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="feat-vis">
              <div className="vis-card">
                <div className="vis-head">
                  <div className="vis-dots"><span/><span/><span/></div>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>Team feed · 12 traders · today</span>
                </div>
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ padding: 14, background: CANVAS, border: `1px solid ${STROKE}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#059669)", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>АС</div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Анна С.</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>2m ago</span>
                      <span className="lp-chip lp-chip-sage" style={{ marginLeft: "auto" }}>+$420 · 1.8R</span>
                    </div>
                    <p style={{ fontSize: 12, color: INK3, fontFamily: MONO }}>NQ short · played &quot;rejection-zone&quot; playbook</p>
                    <div style={{ marginTop: 10, padding: 10, background: "rgba(99,102,241,.06)", borderLeft: "2px solid #8B8FF1", borderRadius: "0 6px 6px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8B8FF1" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
                        <span style={{ fontSize: 10, color: "#8B8FF1", fontFamily: MONO, letterSpacing: ".05em", fontWeight: 600 }}>MENTOR · Виктор</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: INK2, lineHeight: 1.55 }}>«Чистый сетап. В следующий раз дай стопу буфер 0.5R — рынок дышит.»</p>
                    </div>
                  </div>
                  <div style={{ padding: 14, background: CANVAS, border: `1px solid ${STROKE}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#d97706)", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>МК</div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Микола К.</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835" }}>14m ago</span>
                      <span className="lp-chip lp-chip-brick" style={{ marginLeft: "auto" }}>-$130 · -0.5R</span>
                    </div>
                    <p style={{ fontSize: 12, color: INK3, fontFamily: MONO }}>ES long · ❗ нарушил pre-trade checklist</p>
                  </div>
                  <div style={{ padding: "12px 14px", background: "linear-gradient(140deg,rgba(99,102,241,.08),transparent)", border: "1px solid rgba(99,102,241,.18)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B8FF1" strokeWidth="2"><path d="M12 2v6m0 0L9 5m3 3l3-3M5 12h14"/></svg>
                    <span style={{ fontSize: 12, color: INK2 }}><strong style={{ color: "#8B8FF1" }}>Виктор</strong> запушил playbook <strong>«FOMC fade»</strong> всей команде</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835", marginLeft: "auto" }}>1h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" style={{ padding: "96px 0" }}>
        <div className="lp-container">
          <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 12 }}>Воркфлоу</p>
            <h2 style={{ fontSize: "clamp(32px,3.6vw,48px)", fontWeight: 800, lineHeight: 1.05 }}>Один день в Trevixe.</h2>
          </div>
          <div className="wf-grid">
            {[
              ["01 · УТРО","Pre-trade checklist","Открой день с дневником: эмоции, план, сетапы. Чеклист блокирует импульс."],
              ["02 · ТОРГОВЛЯ","Импорт сделок","Загрузи CSV от своего брокера — формат распознаётся автоматически. Без ручного ввода."],
              ["03 · ВЕЧЕР","AI-разбор","AI читает контекст и возвращает разбор каждой сделки. Каждый день."],
              ["04 · НЕДЕЛЯ","Разбор + курс","Итог недели по сделкам и программа обучения от твоих слабых мест."],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ padding: 24, background: CARD, border: `1px solid ${STROKE}`, borderRadius: 14 }}>
                <p style={{ fontFamily: MONO, fontSize: 11, color: BRAND, letterSpacing: ".1em", fontWeight: 600 }}>{num}</p>
                <p style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>{title}</p>
                <p style={{ fontSize: 13, color: INK3, lineHeight: 1.6, marginTop: 8 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{ padding: "64px 0" }}>
        <div className="lp-container">
          <div style={{ padding: "64px 48px", borderRadius: 24, background: "linear-gradient(140deg,rgba(240,114,64,.08),rgba(240,114,64,.01) 50%,#15130F)", border: "1px solid rgba(240,114,64,.15)", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: INK4, marginBottom: 16 }}>Цены</p>
            <h2 style={{ fontSize: "clamp(32px,4vw,56px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-.04em", maxWidth: 680, margin: "0 auto" }}>
              Free навсегда. Pro <span className="grad-warm" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>от $12/мес.</span>
            </h2>
            <p style={{ fontSize: 15, color: INK3, marginTop: 20, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>14 дней Pro бесплатно. Без карты. Без подвоха. Окупается одной сделкой.</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
              <Link href="/auth/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "15px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#fff", background: BRAND, textDecoration: "none", boxShadow: "0 6px 24px rgba(240,114,64,.28)" }}>
                Начать бесплатно
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </Link>
              <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 12, fontSize: 15, fontWeight: 600, color: INK, background: "transparent", border: "1px solid rgba(255,255,255,.18)", textDecoration: "none" }}>
                Войти
              </Link>
              <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "14px 18px", fontSize: 14, fontWeight: 500, color: INK3, textDecoration: "none" }}>
                <span>Тарифы</span>
                <span aria-hidden style={{ marginLeft: 2 }}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "48px 0 32px", borderTop: `1px solid ${STROKE}`, marginTop: 32 }}>
        <div className="lp-container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TrevixeMark size={22} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Trevixe</span>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#3A3835", marginLeft: 8 }}>© 2026 · Made in 🇺🇦</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {[["Тарифы","/pricing"],["Конфиденциальность","/privacy"],["Условия","/tos"],["Возврат","/refund"],["hi@trevixe.com","mailto:hi@trevixe.com"]].map(([l,h]) => (
                <a key={l} href={h} style={{ fontSize: 12, color: INK4, textDecoration: "none", fontFamily: l.includes("@") ? MONO : undefined }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
