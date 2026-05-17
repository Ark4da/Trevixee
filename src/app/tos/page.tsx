"use client";
import Link from "next/link";
import { useAppStore } from "@/store";
import { TrevixeMark } from "@/components/brand/trascend-mark";

export default function TosPage() {
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
          {c("Terms of Service", "Условия использования")}
        </h1>
        <p className="text-sm text-ink-5 mb-10">
          {c("Effective date: 1 May 2026", "Дата вступления в силу: 1 мая 2026")}
        </p>

        <div className="prose prose-neutral max-w-none text-ink-3 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              1. {c("Acceptance of Terms", "Принятие условий")}
            </h2>
            <p>{c(
              "By accessing or using Trevixe (\"Service\"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.",
              "Используя Trevixe («Сервис»), вы соглашаетесь с настоящими Условиями использования. Если вы не согласны — не используйте Сервис."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              2. {c("Description of Service", "Описание Сервиса")}
            </h2>
            <p>{c(
              "Trevixe is a trading journal and analytics platform that helps traders track, analyse, and improve their trading performance. The Service is provided on a subscription basis with Free, Pro, and Team tiers.",
              "Trevixe — журнал и аналитика для трейдеров: учёт, анализ и улучшение торговой статистики. Сервис работает по подписке с тарифами Free, Pro и Team."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              3. {c("User Accounts", "Аккаунты пользователей")}
            </h2>
            <p>{c(
              "You must provide accurate information when creating an account. You are responsible for maintaining the security of your credentials. Notify us immediately of any unauthorised access.",
              "При регистрации указывайте достоверные данные. Вы отвечаете за безопасность своих учётных данных. Сообщите нам немедленно о любом несанкционированном доступе."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              4. {c("Acceptable Use", "Допустимое использование")}
            </h2>
            <p>{c(
              "You agree not to: (a) use the Service for illegal purposes; (b) upload malicious code; (c) attempt to gain unauthorised access to other users' data; (d) reverse-engineer or resell the Service.",
              "Вы обязуетесь не: (а) использовать Сервис в незаконных целях; (б) загружать вредоносный код; (в) пытаться получить несанкционированный доступ к данным других пользователей; (г) реверсировать или перепродавать Сервис."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              5. {c("Subscription and Billing", "Подписка и оплата")}
            </h2>
            <p>
              {c(
                "Paid subscriptions are billed through Stripe. Prices are shown in USD. Subscriptions renew automatically unless cancelled. Refunds are governed by our",
                "Платные подписки обрабатываются через Stripe. Цены указаны в USD. Подписка продлевается автоматически, пока не будет отменена. Возвраты регулируются нашей"
              )}{" "}
              <Link href="/refund" className="text-brand hover:underline">
                {c("Refund Policy", "Политикой возврата")}
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              6. {c("Data and Privacy", "Данные и конфиденциальность")}
            </h2>
            <p>
              {c(
                "We handle your data in accordance with our",
                "Мы обрабатываем ваши данные в соответствии с нашей"
              )}{" "}
              <Link href="/privacy" className="text-brand hover:underline">
                {c("Privacy Policy", "Политикой конфиденциальности")}
              </Link>
              . {c(
                "Your trading data belongs to you. We do not sell it to third parties.",
                "Ваши торговые данные принадлежат вам. Мы не продаём их третьим лицам."
              )}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              7. {c("No Financial Advice", "Не финансовая консультация")}
            </h2>
            <p>{c(
              "Trevixe provides journaling and analytics tools only. Nothing in the Service constitutes financial, investment, or trading advice. Past performance of any strategy is not indicative of future results.",
              "Trevixe предоставляет только инструменты ведения журнала и аналитики. Ничто в Сервисе не является финансовой, инвестиционной или торговой консультацией. Прошлые результаты любой стратегии не гарантируют будущих."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              8. {c("Disclaimer of Warranties", "Отказ от гарантий")}
            </h2>
            <p>{c(
              "The Service is provided \"as is\" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.",
              "Сервис предоставляется «как есть», без каких-либо гарантий. Мы не гарантируем бесперебойной или безошибочной работы."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              9. {c("Limitation of Liability", "Ограничение ответственности")}
            </h2>
            <p>{c(
              "To the maximum extent permitted by law, Trevixe shall not be liable for indirect, incidental, or consequential damages arising from use of the Service.",
              "В максимальной степени, разрешённой законом, Trevixe не несёт ответственности за косвенные, случайные или вытекающие убытки, возникшие в результате использования Сервиса."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              10. {c("Termination", "Прекращение")}
            </h2>
            <p>{c(
              "We may suspend or terminate your account for violation of these terms. You may cancel your subscription at any time through the billing portal.",
              "Мы можем приостановить или закрыть ваш аккаунт за нарушение этих условий. Вы можете отменить подписку в любой момент через биллинг-портал."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              11. {c("Changes", "Изменения")}
            </h2>
            <p>{c(
              "We may update these terms. Continued use after changes constitutes acceptance. We will notify users of material changes by email.",
              "Мы можем обновлять эти условия. Продолжение использования после изменений означает их принятие. О существенных изменениях мы уведомим по email."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              12. {c("Contact", "Контакты")}
            </h2>
            <p>
              {c("Questions? Email us at", "Вопросы? Пиши на")}{" "}
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
