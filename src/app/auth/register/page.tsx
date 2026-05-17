"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { TrevixeMark } from "@/components/brand/trascend-mark";
import { CHECKOUT_PLAN_LABELS, PendingCheckoutPlan, formatCheckoutPlanQuery, getPendingCheckoutPlan } from "@/lib/checkout-plan";
import { useT } from "@/lib/useT";
import { useAppStore } from "@/store";

function readPendingPlan(): PendingCheckoutPlan | null {
  if (typeof window === "undefined") return null;
  return getPendingCheckoutPlan(new URLSearchParams(window.location.search));
}

/* ── SVG-иконки (те же что в login) ── */
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
      className="flex items-center justify-center gap-3 w-full h-11 rounded-xl border border-stroke-2 bg-card text-sm font-medium text-ink hover:bg-tinted active:scale-[.98] transition-all disabled:opacity-60"
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

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { lang } = useAppStore();
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError]         = useState("");
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);
  const [pendingPlan, setPendingPlan] = useState<PendingCheckoutPlan | null>(null);

  useEffect(() => {
    fetch("/api/auth/oauth-providers")
      .then(r => r.json())
      .then(d => setOauthProviders(d.providers ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPendingPlan(readPendingPlan());
  }, []);

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
      setError(data.error || "Аккаунт создан, но тест оплаты не открылся. Проверь Stripe настройки.");
      setLoading(false);
      return true;
    }
    window.location.href = data.url;
    return true;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Введи email"); return; }
    if (!password) { setError("Введи пароль"); return; }
    if (password.length < 8) { setError("Пароль должен быть минимум 8 символов"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password, locale: lang }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error === "Email already in use"
            ? "Этот email уже зарегистрирован"
            : (data.error || "Ошибка регистрации")
        );
        setLoading(false);
        return;
      }

      if (!data.emailVerified) {
        const params = new URLSearchParams({
          verify: data.emailSent ? "sent" : "failed",
          email: email.trim().toLowerCase(),
        });
        if (pendingPlan) {
          params.set("plan", pendingPlan.plan);
          if (pendingPlan.seats) params.set("seats", String(pendingPlan.seats));
        }
        router.push(`/auth/login?${params.toString()}`);
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Аккаунт создан. Войди вручную.");
        router.push(`/auth/login${formatCheckoutPlanQuery(pendingPlan)}`);
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

  const inputCls = "h-11 w-full rounded-xl border border-stroke-2 bg-card px-4 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all";
  const hasOAuth = oauthProviders.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-canvas">
      <div className="w-full max-w-md space-y-8">
        {/* Логотип */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <TrevixeMark size={40} />
            <span className="text-[22px] font-bold text-ink tracking-tight">Trevixe</span>
          </div>
          <p className="text-sm text-ink-4">{t("auth_tagline")}</p>
        </div>

        {/* Карточка */}
        <div className="rounded-2xl border border-stroke bg-card p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-ink mb-1" suppressHydrationWarning>Создать аккаунт</h2>
          <p className="text-sm text-ink-4 mb-6" suppressHydrationWarning>Начни отслеживать свои сделки уже сегодня</p>

          {pendingPlan && (
            <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-ink-2 mb-5">
              <div className="flex items-center justify-between gap-3">
                <span suppressHydrationWarning>Выбран план</span>
                <strong className="text-brand">{CHECKOUT_PLAN_LABELS[pendingPlan.plan]}</strong>
              </div>
              {pendingPlan.seats && (
                <p className="mt-1 text-xs text-ink-4">{pendingPlan.seats} мест в команде. После регистрации откроем тестовую оплату.</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 mb-5">
              {error}
            </div>
          )}

          {/* OAuth кнопки */}
          {hasOAuth && (
            <>
              <div className="space-y-2.5 mb-5">
                {oauthProviders.includes("google") && (
                  <OAuthButton
                    label="Зарегистрироваться через Google"
                    icon={<GoogleIcon />}
                    onClick={() => handleOAuth("google")}
                    loading={oauthLoading === "google"}
                  />
                )}
                {oauthProviders.includes("apple") && (
                  <OAuthButton
                    label="Зарегистрироваться через Apple"
                    icon={<AppleIcon />}
                    onClick={() => handleOAuth("apple")}
                    loading={oauthLoading === "apple"}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-stroke-2" />
                <span className="text-xs text-ink-5" suppressHydrationWarning>или создай аккаунт с паролем</span>
                <div className="flex-1 h-px bg-stroke-2" />
              </div>
            </>
          )}

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-2" suppressHydrationWarning>
                Имя <span className="text-ink-5" suppressHydrationWarning>(необязательно)</span>
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Твоё имя" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-3 mb-2" suppressHydrationWarning>Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  className={`${inputCls} pr-11`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 transition-colors"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 shadow-lg mt-2"
              style={{ background: "linear-gradient(135deg, #C85A1A, #A04514)", boxShadow: "0 4px 24px rgba(200, 90, 26, 0.35)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Создание аккаунта...
                </span>
              ) : "Создать аккаунт"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-4" suppressHydrationWarning>
          Уже есть аккаунт?{" "}
          <Link href={`/auth/login${formatCheckoutPlanQuery(pendingPlan)}`} className="text-brand hover:text-brand-hover font-medium transition-colors" suppressHydrationWarning>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
