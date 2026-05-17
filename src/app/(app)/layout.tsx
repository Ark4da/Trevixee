"use client";
import { MainLayout } from "@/components/layout/main-layout";
import { ToastProvider } from "@/components/ui/toast";
import { SettingsHydrator } from "@/components/settings-hydrator";
import { PostHogIdentify } from "@/components/providers/posthog-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SettingsHydrator />
      <PostHogIdentify />
      <MainLayout>{children}</MainLayout>
    </ToastProvider>
  );
}
