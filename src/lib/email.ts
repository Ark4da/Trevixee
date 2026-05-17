import { Resend } from "resend";

let _resend: Resend | undefined;
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@trevixe.com";
const APP_URL = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
const APP_HOST = getAppHost(APP_URL);

type Locale = "en" | "ru";

function subject(en: string, ru: string, locale: Locale) {
  return locale === "ru" ? ru : en;
}

export function hasEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY);
}

// ─── Verification ────────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: Locale = "en"
) {
  const url = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const html =
    locale === "ru"
      ? verificationHtmlRu(url)
      : verificationHtmlEn(url);

  const result = await getResend().emails.send({
    from: FROM,
    to,
    subject: subject("Verify your Trevixe account", "Подтвердите аккаунт Trevixe", locale),
    html,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  locale: Locale = "en"
) {
  const url = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html =
    locale === "ru"
      ? passwordResetHtmlRu(url)
      : passwordResetHtmlEn(url);

  const result = await getResend().emails.send({
    from: FROM,
    to,
    subject: subject("Reset your Trevixe password", "Сброс пароля Trevixe", locale),
    html,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

function verificationHtmlEn(url: string) {
  return emailShell(`
    <h2>Confirm your email</h2>
    <p>Click the button below to verify your Trevixe account. The link expires in 24 hours.</p>
    <p><a href="${url}" class="btn">Verify email</a></p>
    <p style="color:#888;font-size:13px;">If you didn't create an account, you can ignore this email.</p>
  `);
}

function verificationHtmlRu(url: string) {
  return emailShell(`
    <h2>Подтвердите email</h2>
    <p>Нажмите кнопку ниже, чтобы подтвердить аккаунт Trevixe. Ссылка действительна 24 часа.</p>
    <p><a href="${url}" class="btn">Подтвердить email</a></p>
    <p style="color:#888;font-size:13px;">Если вы не создавали аккаунт, просто проигнорируйте это письмо.</p>
  `);
}

// ─── Invite ──────────────────────────────────────────────────────────────────

function passwordResetHtmlEn(url: string) {
  return emailShell(`
    <h2>Reset your password</h2>
    <p>Click the button below to set a new Trevixe password. The link expires in 1 hour.</p>
    <p><a href="${url}" class="btn">Reset password</a></p>
    <p style="color:#888;font-size:13px;">If you did not request this, you can ignore this email.</p>
  `);
}

function passwordResetHtmlRu(url: string) {
  return emailShell(`
    <h2>Сброс пароля</h2>
    <p>Нажмите кнопку ниже, чтобы задать новый пароль Trevixe. Ссылка действительна 1 час.</p>
    <p><a href="${url}" class="btn">Сбросить пароль</a></p>
    <p style="color:#888;font-size:13px;">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
  `);
}

export async function sendInviteEmail(
  to: string,
  opts: { workspaceName: string; inviterName: string; token: string; role: string },
  locale: Locale = "en"
) {
  const url = `${APP_URL}/invites/accept?token=${opts.token}`;

  const html =
    locale === "ru"
      ? inviteHtmlRu(url, opts)
      : inviteHtmlEn(url, opts);

  return getResend().emails.send({
    from: FROM,
    to,
    subject: subject(
      `You're invited to ${opts.workspaceName} on Trevixe`,
      `Вас приглашают в ${opts.workspaceName} на Trevixe`,
      locale
    ),
    html,
  });
}

function inviteHtmlEn(
  url: string,
  opts: { workspaceName: string; inviterName: string; role: string }
) {
  return emailShell(`
    <h2>You've been invited</h2>
    <p>${opts.inviterName} invited you to join <strong>${opts.workspaceName}</strong> as a <strong>${opts.role}</strong>.</p>
    <p><a href="${url}" class="btn">Accept invitation</a></p>
    <p style="color:#888;font-size:13px;">This invite expires in 7 days.</p>
  `);
}

function inviteHtmlRu(
  url: string,
  opts: { workspaceName: string; inviterName: string; role: string }
) {
  return emailShell(`
    <h2>Вас приглашают</h2>
    <p>${opts.inviterName} приглашает вас в <strong>${opts.workspaceName}</strong> в роли <strong>${opts.role}</strong>.</p>
    <p><a href="${url}" class="btn">Принять приглашение</a></p>
    <p style="color:#888;font-size:13px;">Приглашение действительно 7 дней.</p>
  `);
}

// ─── Trial ending ─────────────────────────────────────────────────────────────

export async function sendTrialEndingEmail(
  to: string,
  daysLeft: number,
  locale: Locale = "en"
) {
  const upgradeUrl = `${APP_URL}/pricing`;

  const html =
    locale === "ru"
      ? trialEndingHtmlRu(daysLeft, upgradeUrl)
      : trialEndingHtmlEn(daysLeft, upgradeUrl);

  return getResend().emails.send({
    from: FROM,
    to,
    subject: subject(
      `Your Trevixe Pro trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      `Ваш Pro пробный период заканчивается через ${daysLeft} ${dayWordRu(daysLeft)}`,
      locale
    ),
    html,
  });
}

function trialEndingHtmlEn(daysLeft: number, upgradeUrl: string) {
  return emailShell(`
    <h2>Your trial is ending soon</h2>
    <p>You have <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> left in your Trevixe Pro trial.</p>
    <p>Upgrade now to keep access to advanced analytics, CSV import, AI trade review, and all Pro features.</p>
    <p><a href="${upgradeUrl}" class="btn">Upgrade to Pro</a></p>
    <p style="color:#888;font-size:13px;">After the trial, your account moves to the free plan. Your data is always preserved.</p>
  `);
}

function trialEndingHtmlRu(daysLeft: number, upgradeUrl: string) {
  return emailShell(`
    <h2>Пробный период заканчивается</h2>
    <p>У вас осталось <strong>${daysLeft} ${dayWordRu(daysLeft)}</strong> Pro пробного периода.</p>
    <p>Перейдите на Pro, чтобы сохранить доступ к расширенной аналитике, CSV импорту, AI-разборам и всем Pro функциям.</p>
    <p><a href="${upgradeUrl}" class="btn">Перейти на Pro</a></p>
    <p style="color:#888;font-size:13px;">После окончания пробного периода аккаунт переходит на бесплатный план. Данные сохраняются.</p>
  `);
}

// ─── Payment failed ────────────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(
  to: string,
  locale: Locale = "en"
) {
  const portalUrl = `${APP_URL}/api/billing/portal`;

  const html =
    locale === "ru"
      ? paymentFailedHtmlRu(portalUrl)
      : paymentFailedHtmlEn(portalUrl);

  return getResend().emails.send({
    from: FROM,
    to,
    subject: subject(
      "Action required: payment failed for your Trevixe subscription",
      "Требуется действие: платёж по подписке Trevixe не прошёл",
      locale
    ),
    html,
  });
}

function paymentFailedHtmlEn(portalUrl: string) {
  return emailShell(`
    <h2>Payment failed</h2>
    <p>We couldn't process the payment for your Trevixe subscription. You have a <strong>3-day grace period</strong> to update your payment method.</p>
    <p><a href="${portalUrl}" class="btn">Update payment method</a></p>
    <p style="color:#888;font-size:13px;">After 3 days without payment, your account will be downgraded to the free plan. Your data is always preserved.</p>
  `);
}

function paymentFailedHtmlRu(portalUrl: string) {
  return emailShell(`
    <h2>Платёж не прошёл</h2>
    <p>Мы не смогли обработать платёж по вашей подписке Trevixe. У вас есть <strong>3 дня</strong>, чтобы обновить способ оплаты.</p>
    <p><a href="${portalUrl}" class="btn">Обновить способ оплаты</a></p>
    <p style="color:#888;font-size:13px;">Через 3 дня без оплаты аккаунт переходит на бесплатный план. Данные сохраняются.</p>
  `);
}

// ─── Subscription canceled ────────────────────────────────────────────────────

export async function sendSubscriptionCanceledEmail(
  to: string,
  periodEnd: Date,
  locale: Locale = "en"
) {
  const upgradeUrl = `${APP_URL}/pricing`;
  const endStr = periodEnd.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html =
    locale === "ru"
      ? canceledHtmlRu(endStr, upgradeUrl)
      : canceledHtmlEn(endStr, upgradeUrl);

  return getResend().emails.send({
    from: FROM,
    to,
    subject: subject("Your Trevixe subscription has been canceled", "Подписка Trevixe отменена", locale),
    html,
  });
}

function canceledHtmlEn(endStr: string, upgradeUrl: string) {
  return emailShell(`
    <h2>Subscription canceled</h2>
    <p>Your Trevixe Pro subscription has been canceled. You'll keep Pro access until <strong>${endStr}</strong>.</p>
    <p>After that, your account moves to the free plan. All your trades, journal, and notes are preserved.</p>
    <p><a href="${upgradeUrl}" class="btn">Resubscribe</a></p>
  `);
}

function canceledHtmlRu(endStr: string, upgradeUrl: string) {
  return emailShell(`
    <h2>Подписка отменена</h2>
    <p>Ваша подписка Trevixe Pro отменена. Доступ к Pro сохраняется до <strong>${endStr}</strong>.</p>
    <p>После этого аккаунт переходит на бесплатный план. Все сделки, журнал и заметки сохраняются.</p>
    <p><a href="${upgradeUrl}" class="btn">Возобновить подписку</a></p>
  `);
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function emailShell(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#e8e8e4; }
  .wrap { max-width:560px; margin:40px auto; padding:40px 32px; background:#1a1a1a; border-radius:8px; border:1px solid #2a2a2a; }
  .logo { font-size:20px; font-weight:600; color:#e8e8e4; margin-bottom:32px; letter-spacing:-0.5px; }
  h2 { margin:0 0 16px; font-size:22px; font-weight:600; color:#e8e8e4; }
  p { margin:0 0 16px; font-size:15px; line-height:1.6; color:#b0b0a8; }
  .btn { display:inline-block; padding:12px 24px; background:#e8e8e4; color:#0f0f0f; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; margin:8px 0; }
  .footer { margin-top:32px; padding-top:24px; border-top:1px solid #2a2a2a; font-size:12px; color:#666; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Trevixe</div>
  ${body}
  <div class="footer">
    Trevixe &mdash; Trading Journal &middot; <a href="${APP_URL}" style="color:#888;">${APP_HOST}</a>
  </div>
</div>
</body>
</html>`;
}

function getAppHost(appUrl: string) {
  try {
    return new URL(appUrl).host.replace(/^www\./, "");
  } catch {
    return "trevixe.com";
  }
}

function dayWordRu(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}
