import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { LangHydrator } from "@/components/lang-hydrator";
import { GlobalTranslator } from "@/components/global-translator";
import { LanguageToggle } from "@/components/language-toggle";

export const metadata: Metadata = {
  title: "Trevixe — Trading Journal & Analytics",
  description: "The editorial trading journal for serious traders. Track, analyse, and systemise your edge.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full bg-canvas text-ink font-[family-name:var(--font-inter)]" suppressHydrationWarning>
        <AuthSessionProvider>
          <PostHogProvider>
            <LangHydrator />
            <GlobalTranslator />
            <LanguageToggle floating />
            {children}
          </PostHogProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
