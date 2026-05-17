"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { TrevixeMark } from "@/components/brand/trascend-mark";
import { useAppStore } from "@/store";

function RecoverPageInner() {
  const { lang } = useAppStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, locale: lang }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Не удалось отправить письмо. Попробуй ещё раз.");
        return;
      }

      setSent(true);
    } catch {
      setError("Ошибка соединения. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "h-12 w-full rounded-[10px] border border-white/[0.12] bg-[#0A0908] px-4 text-sm text-[#F4F1EE] placeholder:text-[#5A5753] outline-none transition-all focus:border-[#F07240]/60 focus:ring-4 focus:ring-[#F07240]/10";

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-[#F4F1EE]"
      style={{
        background:
          "radial-gradient(ellipse 72% 50% at 88% -8%, rgba(240,114,64,.08) 0%, transparent 56%), linear-gradient(170deg,#060504 0%,#0A0908 54%,#0D0B09 100%)",
      }}
    >
      <Link href="/" className="mb-10 flex items-center gap-2.5 no-underline">
        <TrevixeMark size={36} />
        <span className="text-[20px] font-bold tracking-[-0.03em]">Trevixe</span>
      </Link>

      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "#15130F",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 24px 64px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)",
        }}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <CheckCircle className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h2 className="mb-1 text-[20px] font-bold text-[#F4F1EE]">Письмо отправлено</h2>
              <p className="text-sm leading-relaxed text-[#918D88]">
                Мы отправили ссылку для сброса пароля на{" "}
                <span className="font-medium text-[#F4F1EE]">{email.trim().toLowerCase()}</span>
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium no-underline transition-colors"
              style={{ color: "#F07240" }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Вернуться ко входу</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <h2 className="mb-1.5 text-[22px] font-bold text-[#F4F1EE]">Сброс пароля</h2>
              <p className="text-sm leading-relaxed text-[#918D88]">
                Введи свой email, и мы пришлём ссылку для установки нового пароля.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-[10px] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#918D88]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: "#F07240",
                  boxShadow: "0 6px 24px rgba(240,114,64,.28)",
                }}
              >
                {loading ? "Отправляем..." : "Отправить ссылку"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[#918D88]">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 font-medium no-underline transition-colors"
                style={{ color: "#F07240" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Вернуться ко входу</span>
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <Suspense>
      <RecoverPageInner />
    </Suspense>
  );
}
