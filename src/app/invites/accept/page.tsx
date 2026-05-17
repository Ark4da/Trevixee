"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, CheckCircle, XCircle, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { TrevixeMark } from "@/components/brand/trascend-mark";

type State = "loading" | "ready" | "accepting" | "success" | "error" | "needs-auth";

interface InviteInfo {
  workspaceName: string;
  inviterName?: string;
  role: string;
}

function InviteAcceptInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");

  // Validate token by peeking at the invite (server-side peek via API)
  useEffect(() => {
    if (!token || authStatus !== "authenticated") return;

    // Logged in — fetch invite preview
    fetch(`/api/invites/preview?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setState("error");
          setError(d.error);
        } else {
          setInfo(d);
          setState("ready");
        }
      })
      .catch(() => {
        setState("error");
        setError("Не удалось загрузить приглашение. Попробуй позже.");
      });
  }, [token, authStatus]);

  async function handleAccept() {
    setState("accepting");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setError(data.error ?? "Не удалось принять приглашение.");
        return;
      }
      setState("success");
      setTimeout(() => router.push("/team/feed"), 2000);
    } catch {
      setState("error");
      setError("Сетевая ошибка. Проверь соединение и попробуй снова.");
    }
  }

  const roleLabel: Record<string, string> = {
    owner: "Владелец",
    mentor: "Ментор",
    member: "Участник",
  };

  const displayState: State = !token
    ? "error"
    : authStatus === "loading"
      ? "loading"
      : authStatus === "unauthenticated"
        ? "needs-auth"
        : state;
  const displayError = !token
    ? "Ссылка некорректна — токен отсутствует."
    : error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0D09] px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <TrevixeMark size={36} />
        <span className="text-[20px] font-semibold tracking-tight text-[#E8E4DC]">Trevixe</span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-[#2A2620] bg-[#1A1710] p-8 shadow-2xl">

        {/* LOADING */}
        {displayState === "loading" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#F07240]" />
            <p className="text-sm text-[#9A9285]">Загружаем приглашение…</p>
          </div>
        )}

        {/* NEEDS AUTH */}
        {displayState === "needs-auth" && (
          <div className="flex flex-col items-center text-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-[#F07240]/10 border border-[#F07240]/20 flex items-center justify-center">
              <LogIn className="h-7 w-7 text-[#F07240]" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#E8E4DC] mb-1">Войди, чтобы принять</h1>
              <p className="text-sm text-[#9A9285] leading-relaxed">
                Тебя пригласили в команду на Trevixe. Войди или зарегистрируйся, чтобы принять приглашение.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Link
                href={`/auth/login?callbackUrl=${encodeURIComponent(`/invites/accept?token=${token}`)}`}
                className="w-full rounded-xl bg-[#F07240] hover:bg-[#D96530] py-3 text-sm font-semibold text-white text-center transition-colors"
              >
                Войти в аккаунт
              </Link>
              <Link
                href={`/auth/register?callbackUrl=${encodeURIComponent(`/invites/accept?token=${token}`)}`}
                className="w-full rounded-xl border border-[#2A2620] py-3 text-sm font-medium text-[#9A9285] hover:text-[#E8E4DC] hover:bg-[#2A2620] text-center transition-colors"
              >
                Создать аккаунт
              </Link>
            </div>
          </div>
        )}

        {/* READY */}
        {displayState === "ready" && info && (
          <div className="flex flex-col items-center text-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-[#F07240]/10 border border-[#F07240]/20 flex items-center justify-center">
              <Users className="h-7 w-7 text-[#F07240]" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#E8E4DC] mb-1">Приглашение в команду</h1>
              <p className="text-sm text-[#9A9285] leading-relaxed">
                Тебя приглашают в воркспейс{" "}
                <span className="font-semibold text-[#E8E4DC]">«{info.workspaceName}»</span>{" "}
                в роли{" "}
                <span className="font-semibold text-[#F07240]">
                  {roleLabel[info.role] ?? info.role}
                </span>
                .
              </p>
            </div>

            <div className="w-full rounded-xl border border-[#2A2620] bg-[#12100C] p-4 text-left text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#6A6355] text-[11px] uppercase tracking-widest">Аккаунт</span>
                <span className="text-[#9A9285]">{session?.user?.email}</span>
              </div>
            </div>

            <button
              onClick={handleAccept}
              className="w-full rounded-xl bg-[#F07240] hover:bg-[#D96530] py-3 text-sm font-semibold text-white transition-colors"
            >
              Принять приглашение
            </button>
            <p className="text-[11px] text-[#6A6355]">
              Ты можешь покинуть команду в любой момент в настройках.
            </p>
          </div>
        )}

        {/* ACCEPTING */}
        {displayState === "accepting" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#F07240]" />
            <p className="text-sm text-[#9A9285]">Вступаем в команду…</p>
          </div>
        )}

        {/* SUCCESS */}
        {displayState === "success" && (
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#E8E4DC] mb-1">Готово! Ты в команде</h1>
              <p className="text-sm text-[#9A9285]">Перенаправляем тебя в Team Feed…</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {displayState === "error" && (
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#E8E4DC] mb-1">Приглашение недействительно</h1>
              <p className="text-sm text-[#9A9285] leading-relaxed">{displayError}</p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-[#F07240] hover:underline"
            >
              На главную →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0F0D09]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F07240]" />
      </div>
    }>
      <InviteAcceptInner />
    </Suspense>
  );
}
