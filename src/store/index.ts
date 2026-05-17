import { create } from "zustand";
import type { Lang } from "@/lib/i18n";

function readDark(): boolean { return true; }
function saveDark(_value: boolean) { /* dark mode is always on */ }

function saveLang(value: Lang) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("tz-lang", value); } catch { /* noop */ }
}

function readActiveWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem("tz-active-workspace"); } catch { return null; }
}

function saveActiveWorkspace(value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem("tz-active-workspace", value);
    else localStorage.removeItem("tz-active-workspace");
  } catch { /* noop */ }
}

function readSelectedAccount(): string {
  if (typeof window === "undefined") return "all";
  try { return localStorage.getItem("tz-selected-account") || "all"; } catch { return "all"; }
}

function saveSelectedAccount(value: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("tz-selected-account", value || "all"); } catch { /* noop */ }
}

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedAccountId: string;
  setSelectedAccount: (id: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
  userName: string;
  setUserName: (name: string) => void;
  // Team workspace
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  hydrateClientState: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  selectedAccountId: "all",
  setSelectedAccount: (id) => {
    saveSelectedAccount(id);
    set({ selectedAccountId: id || "all" });
  },
  activeTab: "overview",
  setActiveTab: (tab) => set({ activeTab: tab }),
  darkMode: true,
  toggleDarkMode: () => { /* always dark */ },
  lang: "en" as Lang, // always "en" on SSR; client hydrates via LangHydrator
  setLang: (lang) => {
    saveLang(lang);
    set({ lang });
  },
  userName: "Trader",
  setUserName: (name) => set({ userName: name }),
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => {
    saveActiveWorkspace(id);
    set({ activeWorkspaceId: id });
  },
  hydrateClientState: () => {
    set({
      selectedAccountId: readSelectedAccount(),
      activeWorkspaceId: readActiveWorkspace(),
    });
  },
}));
