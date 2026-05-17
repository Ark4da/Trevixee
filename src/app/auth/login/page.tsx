"use client";
import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, BarChart3, BookOpen, Eye, EyeOff, ShieldCheck, Target } from "lucide-react";
import { TrevixeMark } from "@/components/brand/trascend-mark";
import { CHECKOUT_PLAN_LABELS, formatCheckoutPlanQuery, getPendingCheckoutPlan } from "@/lib/checkout-plan";
import { useAppStore } from "@/store";

/* ── SVG-иконки для OAuth кнопок ── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-155.5-127.1c-43.3-81.5-81.6-212.1-81.6-335.1 0-195.6 127.4-299.1 252.7-299.1 66.1 0 121.2 43.4 162.6 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
  );
}

/* ── Компонент OAuth-кнопки ── */
function OAuthButton({
  label, icon, onClick, loading,
}: {
  label: string; icon: React.ReactNode;
  onClick: () => void; loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-[10px] border border-white/[0.12] bg-[#15130F] text-sm font-medium text-[#F4F1EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all hover:border-white/[0.18] hover:bg-[#1B1916] active:scale-[.98] disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin text-ink-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : icon}
      {label}
    </button>
  );
}

function getLoginErrorMessage(errorCode: string | null) {
  if (errorCode === "email_not_verified") return "Email не подтверждён. Проверь почту или отправь письмо ещё раз.";
  if (errorCode === "CredentialsSignin") return "Неверный email или пароль";
  if (errorCode === "OAuthAccountNotLinked") return "Этот email уже используется с другим способом входа";
  return errorCode ? "Ошибка входа. Попробуй снова." : "";
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useAppStore();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError]           = useState(() => getLoginErrorMessage(searchParams.get("error")));
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState(() => searchParams.get("email") ?? "");
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState(() => {
    const v = searchParams.get("verified");
    const verify = searchParams.get("verify");
    const reset = searchParams.get("reset");
    if (verify === "sent") return "Мы отправили письмо для подтверждения аккаунта. Проверь почту.";
    if (verify === "failed") return "Аккаунт создан, но письмо не отправилось. Попробуй отправить подтверждение ещё раз.";
    if (reset === "1") return "Пароль обновлён. Теперь можешь войти.";
    if (v === "1") return "Email подтверждён! Теперь можешь войти.";
    if (v === "already") return "Email уже подтверждён. Можно войти.";
    return "";
  });
  const pendingPlan = getPendingCheckoutPlan(searchParams);
  const pendingPlanQuery = formatCheckoutPlanQuery(pendingPlan);

  // Read active OAuth providers from server
  useEffect(() => {
    fetch("/api/auth/oauth-providers")
      .then(r => r.json())
      .then(d => setOauthProviders(d.providers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const err = searchParams.get("error");
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      setUnverifiedEmail(emailFromQuery);
      setEmail(emailFromQuery);
    }
    if (err === "email_not_verified") {
      setError("Email не подтверждён. Проверь почту или отправь письмо ещё раз.");
      return;
    }
    if (err === "CredentialsSignin") setError("Неверный email или пароль");
    else if (err === "OAuthAccountNotLinked") setError("Этот email уже используется с другим способом входа");
    else if (err === "invalid_token") setError("Ссылка подтверждения недействительна.");
    else if (err === "token_used") setError("Эта ссылка уже была использована. Если email уже подтверждён, просто войди.");
    else if (err === "token_expired") setError("Срок действия ссылки истёк. Зарегистрируйся снова.");
    else if (err) setError("Ошибка входа. Попробуй снова.");

    const verify = searchParams.get("verify");
    if (verify === "sent") setSuccessMsg("Мы отправили письмо для подтверждения аккаунта. Проверь почту.");
    if (verify === "failed") setSuccessMsg("Аккаунт создан, но письмо не отправилось. Попробуй отправить подтверждение ещё раз.");
    if (searchParams.get("reset") === "1") {
      setError("");
      setSuccessMsg("Пароль обновлён. Теперь можешь войти.");
    }

    const v = searchParams.get("verified");
    if (v === "1") setSuccessMsg("Email подтверждён! Теперь можешь войти.");
    if (v === "already") {
      setError("");
      setSuccessMsg("Email уже подтверждён. Можно войти.");
    }
  }, [searchParams]);

  const startCheckout = async () => {
    if (!pendingPlan) return false;
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: pendingPlan.plan,
        ...(pendingPlan.seats ? { seats: pendingPlan.seats } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setError(data.error || "Не удалось открыть тестовую оплату. Проверь Stripe настройки.");
      setLoading(false);
      return true;
    }
    window.location.href = data.url;
    return true;
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Введи email"); return; }
    if (!password)     { setError("Введи пароль"); return; }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.error === "email_not_verified") {
          const normalizedEmail = email.trim().toLowerCase();
          setUnverifiedEmail(normalizedEmail);
          setError("Email не подтверждён. Проверь почту или отправь письмо ещё раз.");
          setLoading(false);
          return;
        }
        setError("Неверный email или пароль");
        setLoading(false);
      } else {
        if (await startCheckout()) return;
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Ошибка соединения. Попробуй снова.");
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (unverifiedEmail || email).trim().toLowerCase();
    if (!targetEmail) {
      setError("Введи email, чтобы отправить письмо подтверждения.");
      return;
    }

    setResendLoading(true);
    setResendMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, locale: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось отправить письмо. Попробуй ещё раз.");
        return;
      }
      setUnverifiedEmail(targetEmail);
      setError("");
      if (data.alreadyVerified) {
        setSuccessMsg("Email уже подтверждён. Можно войти.");
        setResendMessage("");
        return;
      }
      setResendMessage("Письмо отправлено. Проверь почту и папку спам.");
    } catch {
      setError("Ошибка соединения. Попробуй ещё раз.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider);
    setError("");
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError("Ошибка OAuth. Попробуй снова.");
      setOauthLoading(null);
    }
  };

  const features = [
    { icon: BarChart3, text: "MAE / MFE, P&L и винрейт в одном журнале" },
    { icon: Target, text: "Правила, сетапы и дисциплина перед каждой сделкой" },
    { icon: BookOpen, text: "Заметки, ошибки и выводы после торгового дня" },
  ];

  const hasOAuth = oauthProviders.length > 0;
  const inputCls =
    "h-12 w-full rounded-[10px] border border-white/[0.12] bg-[#0A0908] px-4 text-sm text-[#F4F1EE] placeholder:text-[#5A5753] outline-none transition-all focus:border-[#F07240]/60 focus:ring-4 focus:ring-[#F07240]/10";

  return (
    <div
      className="min-h-screen overflow-hidden text-[#F4F1EE]"
      style={{
        background:
          "radial-gradient(ellipse 72% 50% at 88% -8%, rgba(240,114,64,.08) 0%, transparent 56%), linear-gradient(170deg,#060504 0%,#0A0908 54%,#0D0B09 100%)",
      }}
    >
      <main className="mx-auto grid min-h-screen w-full max-w-5xl grid-cols-1 items-center gap-12 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_410px] lg:px-10">
        <section className="hidden lg:block">
          <div className="flex flex-col">
          <Link href="/" className="flex items-center gap-2.5">
            <TrevixeMark size={36} />
            <span className="text-[20px] font-bold tracking-[-0.03em]">
              Trevixe
            </span>
          </Link>

          <div className="mt-10 max-w-[540px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F07240]/20 bg-[#F07240]/[0.08] px-3.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#F07240]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F07240] pulse-dot" />
              Trading journal
            </div>

            <h1 className="text-[clamp(40px,4.2vw,58px)] font-extrabold leading-[0.98] tracking-[-0.04em]">
              Discipline.
              <br />
              <span className="font-editorial font-normal italic text-gradient-brand">Readable</span>
              <br />
              as a chart.
            </h1>

            <p className="mt-5 max-w-sm text-[16px] leading-7 text-[#918D88]" suppressHydrationWarning>
              Веди журнал, анализируй результаты и расти как трейдер системно.
            </p>

            <div className="mt-8 space-y-3.5">
              {features.map((f) => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#F07240]">
                    <f.icon className="h-4 w-4 text-[#F07240]" />
                  </div>
                  <span className="text-sm text-[#C8C4BF]" suppressHydrationWarning>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
        <div className="w-full max-w-[410px]">
          <Link href="/" className="mb-9 flex items-center gap-2.5 lg:hidden">
            <TrevixeMark size={34} />
            <span className="text-[19px] font-bold tracking-[-0.03em]">
              Trevixe
            </span>
          </Link>

          <div className="rounded-2xl border border-white/[0.10] bg-[linear-gradient(180deg,rgba(240,114,64,.055),rgba(240,114,64,.015)_34%,#15130F_100%)] p-7 shadow-[0_24px_80px_rgba(0,0,0,.42),0_0_0_1px_rgba(240,114,64,.025)] sm:p-8">
            <div className="mb-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-[#F07240]/[0.12] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#F07240]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Sign in
              </div>
              <h2 className="text-2xl font-bold tracking-[-0.03em]" suppressHydrationWarning>Добро пожаловать</h2>
              <p className="mt-2 text-sm leading-6 text-[#918D88]" suppressHydrationWarning>Войди в аккаунт, чтобы продолжить.</p>
            </div>

            {successMsg && (
              <div className="mb-5 rounded-[10px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {successMsg}
              </div>
            )}

            {pendingPlan && (
              <div className="mb-5 rounded-[10px] border border-[#F07240]/25 bg-[#F07240]/10 px-4 py-3 text-sm text-[#C8C4BF]">
                <div className="flex items-center justify-between gap-3">
                  <span>Выбран план</span>
                  <strong className="text-[#F07240]">{CHECKOUT_PLAN_LABELS[pendingPlan.plan]}</strong>
                </div>
                {pendingPlan.seats && (
                  <p className="mt-1 text-xs text-[#918D88]">{pendingPlan.seats} мест в команде. После входа откроем тестовую оплату.</p>
                )}
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-[10px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {(error.includes("Email не подтверждён") || searchParams.get("verify") === "failed") && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="mb-5 inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#F07240]/30 bg-[#F07240]/10 text-sm font-semibold text-[#F07240] transition-colors hover:bg-[#F07240]/15 disabled:opacity-60"
              >
                {resendLoading ? "Отправляем..." : "Отправить письмо подтверждения ещё раз"}
              </button>
            )}

            {resendMessage && (
              <div className="mb-5 rounded-[10px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {resendMessage}
              </div>
            )}

            {hasOAuth && (
              <>
                <div className="mb-5 space-y-2.5">
                  {oauthProviders.includes("google") && (
                    <OAuthButton
                      label="Войти через Google"
                      icon={<GoogleIcon />}
                      onClick={() => handleOAuth("google")}
                      loading={oauthLoading === "google"}
                    />
                  )}
                  {oauthProviders.includes("apple") && (
                    <OAuthButton
                      label="Войти через Apple"
                      icon={<AppleIcon />}
                      onClick={() => handleOAuth("apple")}
                      loading={oauthLoading === "apple"}
                    />
                  )}
                </div>

                <div className="mb-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.08]" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5A5753]">или пароль</span>
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>
              </>
            )}

            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#918D88]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#918D88]" suppressHydrationWarning>Пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#5A5753] transition-colors hover:text-[#F4F1EE]"
                    aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Link href="/auth/recover" className="text-xs font-medium text-[#F07240] transition-colors hover:text-[#FF8252]">
                  Забыл пароль?
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#F07240] text-sm font-semibold text-white shadow-[0_6px_24px_rgba(240,114,64,.28)] transition-all hover:bg-[#FF8252] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Вход...
                  </>
                ) : (
                  <>
                    Войти
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

          </div>

          <p className="mt-7 text-center text-sm text-[#918D88]" suppressHydrationWarning>
            Нет аккаунта?{" "}
            <Link href={`/auth/register${pendingPlanQuery}`} className="font-medium text-[#F07240] transition-colors hover:text-[#FF8252]" suppressHydrationWarning>
              Зарегистрироваться
            </Link>
          </p>
        </div>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
