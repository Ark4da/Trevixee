"use client";
import Link from "next/link";
import { useAppStore } from "@/store";
import { TrevixeMark } from "@/components/brand/trascend-mark";

export default function PrivacyPage() {
  const lang = useAppStore((s) => s.lang);
  const isRu = lang === "ru";
  const c = (en: string, ru: string) => (isRu ? ru : en);

  return (
    <div className="min-h-screen bg-paper" data-no-auto-translate>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5 group">
          <TrevixeMark size={28} />
          <span className="text-[18px] font-bold tracking-tight text-ink leading-none group-hover:text-brand transition-colors">Trevixe</span>
        </Link>
        <Link href="/" className="text-xs text-ink-5 hover:text-brand transition-colors mb-8 ml-4 inline-block">
          {c("← Back", "← Назад")}
        </Link>

        <h1 className="text-3xl font-bold text-ink mb-2">
          {c("Privacy Policy", "Политика конфиденциальности")}
        </h1>
        <p className="text-sm text-ink-5 mb-10">
          {c("Effective date: 1 May 2026", "Дата вступления в силу: 1 мая 2026")}
        </p>

        <div className="prose prose-neutral max-w-none text-ink-3 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              1. {c("What We Collect", "Что мы собираем")}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-ink">{c("Account data", "Данные аккаунта")}</strong>
                : {c(
                  "email address, name, OAuth provider info.",
                  "email, имя, данные OAuth-провайдера."
                )}
              </li>
              <li>
                <strong className="text-ink">{c("Trading data", "Торговые данные")}</strong>
                : {c(
                  "trades, journal entries, notes, playbooks you create.",
                  "сделки, записи дневника, заметки, плейбуки, которые вы создаёте."
                )}
              </li>
              <li>
                <strong className="text-ink">{c("Usage data", "Данные использования")}</strong>
                : {c(
                  "pages visited, features used (via PostHog analytics, anonymised).",
                  "посещённые страницы, используемые функции (через PostHog, обезличено)."
                )}
              </li>
              <li>
                <strong className="text-ink">{c("Payment data", "Платёжные данные")}</strong>
                : {c(
                  "processed entirely by Stripe. We store only a Stripe Customer ID.",
                  "полностью обрабатываются Stripe. Мы храним только Stripe Customer ID."
                )}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              2. {c("How We Use Your Data", "Как мы используем данные")}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{c("To provide and improve the Service.", "Для предоставления и улучшения Сервиса.")}</li>
              <li>{c(
                "To send transactional emails (trial expiry, payment receipts, invite emails).",
                "Для отправки транзакционных email (окончание trial, чеки, приглашения)."
              )}</li>
              <li>{c(
                "To generate anonymised aggregate statistics (community benchmarks) — never tied to your identity.",
                "Для построения обезличенной агрегированной статистики (бенчмарки сообщества) — никогда не привязанной к вам лично."
              )}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              3. {c("Data Sharing", "Передача данных")}
            </h2>
            <p>{c("We do not sell your personal data. We share data only with:", "Мы не продаём ваши персональные данные. Мы делимся ими только с:")}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong className="text-ink">Stripe</strong> —{" "}
                {c("payment processing.", "обработка платежей.")}
              </li>
              <li>
                <strong className="text-ink">Resend</strong> —{" "}
                {c("transactional email delivery.", "доставка транзакционных email.")}
              </li>
              <li>
                <strong className="text-ink">PostHog</strong> —{" "}
                {c("product analytics (self-hosted or EU-region).", "продуктовая аналитика (self-hosted или EU-регион).")}
              </li>
              <li>
                <strong className="text-ink">Sentry</strong> —{" "}
                {c("error monitoring (anonymised stack traces).", "мониторинг ошибок (обезличенные stack traces).")}
              </li>
              <li>
                <strong className="text-ink">{c("Team workspace members", "Участники Team workspace")}</strong> —{" "}
                {c(
                  "if you join a team, your trades and journal key metrics are visible to other members per the visibility settings.",
                  "если вы в команде, ваши сделки и ключевые метрики дневника видны другим участникам согласно настройкам видимости."
                )}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              4. {c("Team Visibility", "Видимость в команде")}
            </h2>
            <p>{c(
              "Inside a Team workspace, members can see each other's trades, win rate, P&L, and journal activity. Dollar amounts can be hidden if \"Hide $ amounts\" is enabled. New members can have a privacy grace period (0–30 days) during which their data is hidden from others.",
              "Внутри Team workspace участники видят сделки друг друга, win rate, P&L и активность в дневнике. Долларовые суммы можно скрыть опцией «Hide $ amounts». У новых участников может быть privacy grace period (0–30 дней), в течение которого их данные скрыты от других."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              5. {c("Data Retention", "Хранение данных")}
            </h2>
            <p>{c(
              "Your data is retained as long as your account is active. You can export or delete your data at any time. Deleted accounts are purged within 30 days.",
              "Ваши данные хранятся всё время существования аккаунта. Вы можете экспортировать или удалить данные в любой момент. Удалённые аккаунты полностью стираются в течение 30 дней."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              6. {c("Security", "Безопасность")}
            </h2>
            <p>{c(
              "We use industry-standard encryption (TLS in transit, encrypted at rest on PostgreSQL). Passwords are hashed with bcrypt. We never log raw passwords.",
              "Мы используем индустриальные стандарты шифрования (TLS при передаче, шифрование at rest в PostgreSQL). Пароли хэшируются bcrypt. Мы никогда не логируем пароли в открытом виде."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              7. {c("Cookies", "Cookies")}
            </h2>
            <p>{c(
              "We use session cookies for authentication (NextAuth.js). No third-party advertising cookies.",
              "Мы используем session cookies для аутентификации (NextAuth.js). Никаких сторонних рекламных cookies."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              8. {c("Your Rights (GDPR / CCPA)", "Ваши права (GDPR / CCPA)")}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{c("Access, correct, or delete your personal data.", "Получить доступ, исправить или удалить свои персональные данные.")}</li>
              <li>{c("Export your data (CSV export in Settings).", "Экспортировать данные (CSV-экспорт в Settings).")}</li>
              <li>{c("Opt out of analytics by contacting us.", "Отказаться от аналитики, написав нам.")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              9. {c("Contact", "Контакты")}
            </h2>
            <p>
              {c("Privacy questions:", "Вопросы по конфиденциальности:")}{" "}
              <a href="mailto:hi@trevixe.com" className="text-brand hover:underline">
                hi@trevixe.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
