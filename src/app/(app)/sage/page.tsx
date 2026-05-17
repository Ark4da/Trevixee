"use client";
import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const AiLearnChat = dynamic(
  () => import("@/components/ai/ai-learn-chat").then(mod => mod.AiLearnChat),
  {
    ssr: false,
    loading: () => <div className="flex h-full bg-canvas" />,
  }
);

function SagePageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? undefined;

  return (
    <div className="-m-4 flex h-[calc(100vh-56px)] flex-col bg-canvas md:-m-6">
      <AiLearnChat initialPrompt={initialPrompt} />
    </div>
  );
}

export default function SagePage() {
  return (
    <Suspense fallback={<div className="-m-4 flex h-[calc(100vh-56px)] flex-col bg-canvas md:-m-6" />}>
      <SagePageContent />
    </Suspense>
  );
}
