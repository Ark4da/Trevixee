"use client";
import Link from "next/link";
import { useAppStore } from "@/store";
import { TrevixeMark } from "@/components/brand/trascend-mark";

export default function RefundPage() {
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
          {c("Refund Policy", "Политика возврата")}
        </h1>
        <p className="text-sm text-ink-5 mb-10">
          {c("Effective date: 1 May 2026", "Дата вступления в силу: 1 мая 2026")}
        </p>

        <div className="prose prose-neutral max-w-none text-ink-3 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("14-Day Trial", "14-дневный пробный период")}
            </h2>
            <p>{c(
              "All new Pro and Team accounts start with a 14-day free trial — no card required. You can evaluate the full feature set before committing.",
              "Все новые аккаунты Pro и Team начинаются с 14-дневного бесплатного пробного периода — без карты. Вы можете оценить весь функционал до оплаты."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("Subscription Refunds", "Возвраты по подписке")}
            </h2>
            <p>
              {c(
                "We offer a",
                "Мы предлагаем"
              )}{" "}
              <strong className="text-ink">
                {c("7-day money-back guarantee", "7-дневную гарантию возврата")}
              </strong>{" "}
              {c(
                "on the first payment of any new Pro or Team subscription. If you are unsatisfied within 7 days of your first charge, contact us and we will issue a full refund — no questions asked.",
                "на первый платёж любой новой подписки Pro или Team. Если в течение 7 дней с первого списания вас что-то не устраивает — напишите нам, и мы вернём деньги полностью, без вопросов."
              )}
            </p>
            <p className="mt-2">{c("Возврат не предоставляется на:", "Возврат не предоставляется на:")}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>{c("Renewal charges after the first billing cycle.", "Платежи продления после первого цикла.")}</li>
              <li>{c("Partial months or unused time after cancellation (unless required by local law).", "Неполные месяцы или неиспользованное время после отмены (кроме случаев, требуемых местным законом).")}</li>
              <li>{c("Team seat upgrades mid-cycle (prorated charges are not refundable).", "Добавление мест в команде в середине цикла (пропорциональные доплаты не возвращаются).")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("Cancellation", "Отмена")}
            </h2>
            <p>
              {c(
                "You can cancel your subscription at any time via",
                "Вы можете отменить подписку в любой момент через"
              )}{" "}
              <strong className="text-ink">
                {c("Settings → Account → Manage billing", "Settings → Account → Manage billing")}
              </strong>{" "}
              {c(
                "(Stripe Customer Portal). Your plan downgrades to Free at the end of the current billing period. Your data is preserved.",
                "(Stripe Customer Portal). Тариф понизится до Free в конце текущего цикла оплаты. Ваши данные сохранятся."
              )}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("Payment Failures", "Неудачные платежи")}
            </h2>
            <p>{c(
              "If a payment fails, your subscription enters a 3-day grace period during which you retain Pro/Team access. If payment is not recovered, your plan downgrades to Free. We will notify you by email.",
              "Если платёж не прошёл, у подписки есть 3-дневный льготный период с сохранением доступа Pro/Team. Если платёж не восстановится — тариф понизится до Free. Мы уведомим по email."
            )}</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("How to Request a Refund", "Как запросить возврат")}
            </h2>
            <p>
              {c("Email", "Напиши на")}{" "}
              <a href="mailto:hi@trevixe.com" className="text-brand hover:underline">hi@trevixe.com</a>{" "}
              {c(
                "with your account email and a brief description. We respond within 1 business day. Refunds are credited to the original payment method within 5–10 business days.",
                "с email аккаунта и кратким описанием. Мы отвечаем в течение 1 рабочего дня. Возврат зачисляется на исходный способ оплаты в течение 5–10 рабочих дней."
              )}
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-ink mb-2">
              {c("Disputes", "Споры")}
            </h2>
            <p>
              {c(
                "Please contact us before initiating a chargeback. We will work to resolve any issue quickly. Unresolved chargebacks may result in account suspension per our",
                "Пожалуйста, свяжитесь с нами до подачи chargeback. Мы постараемся решить любой вопрос быстро. Неразрешённые chargeback могут привести к блокировке аккаунта согласно нашим"
              )}{" "}
              <Link href="/tos" className="text-brand hover:underline">
                {c("Terms of Service", "Условиям использования")}
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
