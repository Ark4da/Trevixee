"use client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";
    if (!key) return;

    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      capture_pageview: false, // handled below via router events
      capture_pageleave: true,
    });
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

/** Identifies the signed-in user with PostHog. Drop inside a client layout. */
export function PostHogIdentify() {
  const { data: session } = useSession();
  useEffect(() => {
    if (!session?.user?.id || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(session.user.id, {
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
    });
  }, [session]);
  return null;
}
