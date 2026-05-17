"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/useT";
import {
  User,
  Settings,
  Download,
  Upload,
  Check,
  Bell,
  ChevronDown,
  Save,
  CreditCard,
  ExternalLink,
  Layers,
  Plus,
  Trash2,
  Webhook,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import type { Entitlements } from "@/lib/entitlements";
import { PaywallCard } from "@/components/billing/paywall-card";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/store";
import { useToast } from "@/components/ui/toast";

const SAGE  = "#6E9F7F";
const BRICK = "#A85550";


// Tabs resolved inside component using useT()

type TabId = "profile" | "preferences" | "import-export" | "account" | "accounts";

interface TradingAccount {
  id: string; name: string; kind: string; broker: string | null;
  currency: string; balance: number; isActive: boolean;
}

const inputClass =
  "w-full rounded-lg border border-stroke-2 bg-tinted px-3 py-2.5 text-sm text-ink placeholder-ink-4 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-3";
const selectClass =
  "w-full appearance-none rounded-lg border border-stroke-2 bg-tinted px-3 py-2.5 pr-8 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/20";

export default function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const lang = useAppStore((s) => s.lang);
  const c = useCallback((en: string, ru: string) => lang === "ru" ? ru : en, [lang]);
  const tabs = [
    { id: "profile" as TabId, label: t("settings_tab_profile"), icon: User },
    { id: "preferences" as TabId, label: t("settings_tab_prefs"), icon: Settings },
    { id: "import-export" as TabId, label: t("settings_tab_import"), icon: Download },
    { id: "account" as TabId, label: t("settings_account"), icon: CreditCard },
    { id: "accounts" as TabId, label: c("Accounts", "Аккаунты"), icon: Layers },
  ];
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [name, setName] = useState("");
  const [defaultMarket, setDefaultMarket] = useState("futures");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/New_York");
  const [riskPerTrade, setRiskPerTrade] = useState("1.0");
  const [accountBalance, setAccountBalance] = useState("0");
  const [maxDailyLoss, setMaxDailyLoss] = useState("0");
  const [maxDailyTrades, setMaxDailyTrades] = useState("0");
  const { setUserName, setActiveWorkspaceId } = useAppStore();
  const [hideAmountsInTeam, setHideAmountsInTeam] = useState(false);
  const [privacyPeriodDays, setPrivacyPeriodDays] = useState(0);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; role: string }[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [tradingAccounts, setTradingAccounts] = useState<TradingAccount[]>([]);
  const [newAccName, setNewAccName] = useState("");
  const [newAccKind, setNewAccKind] = useState("live");
  const [newAccBroker, setNewAccBroker] = useState("");
  const [newAccCurrency, setNewAccCurrency] = useState("USD");
  const [newAccBalance, setNewAccBalance] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brokerFileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [brokerImporting, setBrokerImporting] = useState(false);
  const [brokerImportResult, setBrokerImportResult] = useState<{ imported: number; skipped: number; errors: string[]; broker?: string } | null>(null);
  const [brokerImportBroker, setBrokerImportBroker] = useState("MetaTrader 5");
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [tradingViewSetup, setTradingViewSetup] = useState<{ webhookUrl: string; examplePayload: Record<string, unknown> } | null>(null);
  const [loadingTradingView, setLoadingTradingView] = useState(false);
  const [advancedAlerts, setAdvancedAlerts] = useState<{ alerts: Array<{ id: string; level: string; title: string; body: string }> } | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (
      tab === "profile" ||
      tab === "preferences" ||
      tab === "import-export" ||
      tab === "account" ||
      tab === "accounts"
    ) {
      setActiveTab(tab);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setName(data.userName || "");
      setDefaultMarket(data.defaultMarket || "futures");
      setCurrency(data.defaultCurrency || "USD");
      setTimezone(data.timezone || "America/New_York");
      setRiskPerTrade(String(data.riskPerTrade ?? 1));
      setAccountBalance(String(data.accountBalance ?? 50000));
      setMaxDailyLoss(String(data.maxDailyLoss ?? 0));
      setMaxDailyTrades(String(data.maxDailyTrades ?? 0));
      setHideAmountsInTeam(!!data.hideAmountsInTeam);
      setPrivacyPeriodDays(Number(data.privacyPeriodDays ?? 0));
    } catch {
      toast(t("error_load"), "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then(setEntitlements)
      .catch(() => {});
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWorkspaces(data); })
      .catch(() => {});
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTradingAccounts(data); })
      .catch(() => {});
  }, []);

  const refreshAccounts = () =>
    fetch("/api/accounts").then(r => r.json()).then(d => { if (Array.isArray(d)) setTradingAccounts(d); }).catch(() => {});

  const refreshWorkspaces = () =>
    fetch("/api/workspaces").then(r => r.json()).then(d => { if (Array.isArray(d)) setWorkspaces(d); }).catch(() => {});

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    setCreatingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? c("Failed to create workspace", "Не получилось создать рабочее пространство"), "error");
        return;
      }
      await refreshWorkspaces();
      setActiveWorkspaceId(data.id);
      setNewWorkspaceName("");
      toast(c("Workspace created", "Рабочее пространство создано"), "success");
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccName.trim()) return;
    setAddingAccount(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAccName, kind: newAccKind, broker: newAccBroker, currency: newAccCurrency, balance: newAccBalance }),
      });
      if (res.status === 403) { toast(c("Multi-account requires Pro plan", "Мультиаккаунт требует Pro-план"), "error"); return; }
      if (!res.ok) throw new Error("failed");
      setNewAccName(""); setNewAccKind("live"); setNewAccBroker(""); setNewAccBalance(""); setShowAddAccount(false);
      await refreshAccounts();
    } catch { toast(t("error_save"), "error"); }
    finally { setAddingAccount(false); }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Удалить аккаунт? Сделки с этим аккаунтом не удалятся.")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    await refreshAccounts();
  };

  const handleToggleActive = async (acc: TradingAccount) => {
    await fetch(`/api/accounts/${acc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !acc.isActive }),
    });
    await refreshAccounts();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: name,
          defaultMarket,
          defaultCurrency: currency,
          timezone,
          riskPerTrade,
          accountBalance,
          maxDailyLoss,
          maxDailyTrades,
          hideAmountsInTeam,
          privacyPeriodDays,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSaved(true);
      setUserName(name);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/trades/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setImportResult(data);
    } catch {
      toast(t("error_save"), "error");
    } finally {
      setImporting(false);
    }
  };

  const downloadCsv = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent.startsWith("\uFEFF") ? csvContent : "\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBrokerImportFile = async (file: File) => {
    if (!file) return;
    setBrokerImporting(true);
    setBrokerImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/trades/broker-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker: brokerImportBroker, csv: text }),
      });
      if (!res.ok) throw new Error(c("Broker import failed", "Импорт брокера не удался"));
      setBrokerImportResult(await res.json());
    } catch {
      toast(c("Broker import failed", "Импорт брокера не удался"), "error");
    } finally {
      setBrokerImporting(false);
    }
  };

  const handleExport = async (type: "trades" | "all") => {
    setExportError("");
    setExporting(true);
    try {
      const exportRes = await fetch(`/api/export?type=${type}`);
      if (!exportRes.ok) throw new Error(c("Export failed", "Экспорт не удался"));
      const disposition = exportRes.headers.get("content-disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1]
        ?? `${type === "all" ? "trevixe_export" : "trades"}_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCsv(await exportRes.text(), filename);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : c("Export error. Try again.", "Ошибка экспорта. Попробуй снова."));
    } finally {
      setExporting(false);
    }
  };

  const loadTradingViewSetup = async () => {
    setLoadingTradingView(true);
    try {
      const res = await fetch("/api/tradingview/webhook");
      if (!res.ok) throw new Error(c("TradingView webhook setup failed", "Не удалось настроить TradingView webhook"));
      setTradingViewSetup(await res.json());
    } catch {
      toast(c("TradingView webhook setup failed", "Не удалось настроить TradingView webhook"), "error");
    } finally {
      setLoadingTradingView(false);
    }
  };

  const loadAdvancedAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await fetch("/api/alerts/advanced");
      if (!res.ok) throw new Error(c("Advanced alerts failed", "Продвинутые алерты не загрузились"));
      setAdvancedAlerts(await res.json());
    } catch {
      toast(c("Advanced alerts failed", "Продвинутые алерты не загрузились"), "error");
    } finally {
      setLoadingAlerts(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-ink-5">{t("settings_loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <h1 className="text-2xl font-bold text-ink">{t("settings_title")}</h1>

      <div className="flex gap-6">
        {/* Tab Navigation */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-brand-tint text-brand"
                      : "text-ink-3 hover:bg-lift hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {/* PROFILE */}
          {activeTab === "profile" && (
            <div className="rounded-xl border border-stroke bg-card p-6">
              <h2 className="mb-6 text-lg font-semibold text-ink">{t("settings_profile_title")}</h2>

              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-xl font-bold text-white">
                  {name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "T"}
                </div>
                <div>
                  <button className="rounded-lg border border-stroke-2 bg-tinted px-3 py-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
                    {t("settings_change_avatar")}
                  </button>
                  <p className="mt-1 text-xs text-ink-5">{t("settings_avatar_hint")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{t("settings_display_name")}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t("settings_timezone")}</label>
                  <div className="relative">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
                      <option value="America/New_York">{t("tz_et")}</option>
                      <option value="America/Chicago">{t("tz_ct")}</option>
                      <option value="America/Denver">{t("tz_mt")}</option>
                      <option value="America/Los_Angeles">{t("tz_pt")}</option>
                      <option value="Europe/London">{t("tz_london")}</option>
                      <option value="Europe/Moscow">{t("tz_moscow")}</option>
                      <option value="Asia/Tokyo">{t("tz_tokyo")}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-ink-5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t("settings_account_balance")}</label>
                    <input type="number" step="any" value={accountBalance} onChange={(e) => setAccountBalance(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>{t("settings_risk_per_trade")}</label>
                    <input type="number" step="0.1" value={riskPerTrade} onChange={(e) => setRiskPerTrade(e.target.value)} className={inputClass} />
                  </div>
                </div>

                {/* Risk Management */}
                <div className="rounded-lg border border-stroke bg-tinted p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-ink mb-0.5">{t("settings_risk_management")}</p>
                    <p className="text-xs text-ink-5">{t("settings_risk_desc")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        {t("settings_max_daily_loss")}
                        <span className="ml-1 text-xs text-ink-5 font-normal">{t("settings_zero_disabled")}</span>
                      </label>
                      <input
                        type="number" step="any" min="0"
                        value={maxDailyLoss}
                        onChange={(e) => setMaxDailyLoss(e.target.value)}
                        className={inputClass}
                        placeholder={t("settings_max_loss_ph")}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("settings_max_daily_trades")}
                        <span className="ml-1 text-xs text-ink-5 font-normal">{t("settings_zero_disabled")}</span>
                      </label>
                      <input
                        type="number" step="1" min="0"
                        value={maxDailyTrades}
                        onChange={(e) => setMaxDailyTrades(e.target.value)}
                        className={inputClass}
                        placeholder={t("settings_max_trades_ph")}
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  {saved ? <><Check className="h-4 w-4" /> {t("settings_saved")}</> : saving ? t("settings_saving") : <><Save className="h-4 w-4" /> {t("settings_save_changes")}</>}
                </button>
              </div>
            </div>
          )}

          {/* PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="rounded-xl border border-stroke bg-card p-6">
              <h2 className="mb-6 text-lg font-semibold text-ink">{t("settings_prefs_title")}</h2>
              <div className="space-y-6">
                <div>
                  <label className={labelClass}>{t("settings_default_currency")}</label>
                  <div className="relative">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                      <option value="RUB">RUB</option>
                      <option value="CAD">CAD</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-ink-5" />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("settings_default_market")}</label>
                  <div className="relative">
                    <select value={defaultMarket} onChange={(e) => setDefaultMarket(e.target.value)} className={selectClass}>
                      <option value="futures">{t("common_futures")}</option>
                      <option value="forex">Forex</option>
                      <option value="stocks">{t("common_stocks")}</option>
                      <option value="crypto">{t("common_crypto")}</option>
                      <option value="options">{t("common_options")}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-ink-5" />
                  </div>
                </div>


                <div className="flex items-center justify-between rounded-lg border border-stroke bg-tinted p-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-brand" />
                    <div>
                      <p className="text-sm font-medium text-ink">{t("settings_notifications")}</p>
                      <p className="text-xs text-ink-5">{t("settings_notif_desc")}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifications(!notifications)}
                    className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors", notifications ? "bg-brand" : "bg-stroke-2")}
                  >
                    <span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", notifications ? "translate-x-5" : "translate-x-0")} />
                  </button>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  {saved ? <><Check className="h-4 w-4" /> {t("settings_saved")}</> : saving ? t("settings_saving") : <><Save className="h-4 w-4" /> {t("settings_save_prefs")}</>}
                </button>
              </div>
            </div>
          )}

          {/* IMPORT / EXPORT */}
          {activeTab === "import-export" && (
            <div className="space-y-4">
              {entitlements && !entitlements.capabilities.canUseCsvImport && (
                <PaywallCard feature="csv_import" />
              )}
              <div className={cn("rounded-xl border border-stroke bg-card p-6", entitlements && !entitlements.capabilities.canUseCsvImport ? "opacity-40 pointer-events-none select-none" : "")}>
                <h2 className="mb-1 text-lg font-semibold text-ink">{t("settings_import_title")}</h2>
                <p className="mb-4 text-sm text-ink-3">
                  {t("settings_import_desc")} <span className="text-ink">symbol, side, entryPrice, entryDate</span>.{" "}
                  {t("settings_import_optional")}
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleImportFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
                    dragOver ? "border-brand/60 bg-brand-tint" : "border-stroke-2 bg-tinted hover:border-brand/30"
                  )}
                >
                  <Upload className="mb-2 h-8 w-8 text-ink-5" />
                  <p className="text-sm text-ink-3">
                    {importing ? t("settings_importing") : t("settings_drag_drop")}
                  </p>
                  <p className="mt-1 text-xs text-ink-4">{t("settings_csv_only")}</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Result */}
                {importResult && (
                  <div
                    className="mt-4 rounded-lg border p-4 text-sm"
                    style={{ borderColor: importResult.imported > 0 ? `${SAGE}50` : `${BRICK}50`, background: importResult.imported > 0 ? `${SAGE}0D` : `${BRICK}0D` }}
                  >
                    <p className="font-medium text-ink mb-1">
                      {importResult.imported > 0 ? `✓ ${t("settings_import_ok", { n: String(importResult.imported), s: importResult.imported !== 1 ? "s" : "" })}` : t("settings_import_fail")}
                      {importResult.skipped > 0 && <span className="text-ink-3 ml-2">{t("settings_skipped", { n: String(importResult.skipped) })}</span>}
                    </p>
                    {importResult.errors.length > 0 && (
                      <ul className="text-xs text-ink-3 space-y-0.5 mt-2">
                        {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {/* Example format */}
                <details className="mt-4">
                  <summary className="text-xs text-ink-5 cursor-pointer hover:text-ink-3 transition-colors">
                    {t("settings_show_example")}
                  </summary>
                  <pre className="mt-2 rounded-lg border border-stroke bg-tinted p-3 text-xs text-ink-3 overflow-x-auto">
{`symbol,side,entryPrice,exitPrice,quantity,entryDate,exitDate,fees,setup,market,notes
ES,long,5200.50,5215.25,1,2026-04-01 09:35,2026-04-01 10:05,4.20,Breakout,futures,Good entry
NQ,short,18200,18150,2,2026-04-02 10:15,,2.10,Reversal,futures,`}
                  </pre>
                </details>
              </div>

              {entitlements && !entitlements.capabilities.canUseBrokerImport && (
                <PaywallCard
                  feature="broker_import"
                  title={c("Broker import (Pro)", "Импорт брокера (Pro)")}
                  body={c(
                    "Import broker CSV exports from MT4, MT5, Interactive Brokers, Tradovate, TradingView, and similar reports.",
                    "Импортируй CSV-экспорты брокеров из MT4, MT5, Interactive Brokers, Tradovate, TradingView и похожих отчетов."
                  )}
                />
              )}
              <div className={cn("rounded-xl border border-stroke bg-card p-6", entitlements && !entitlements.capabilities.canUseBrokerImport ? "opacity-40 pointer-events-none select-none" : "")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-ink">
                      <Layers className="h-4 w-4 text-brand" />
                      {c("Broker import", "Импорт брокера")}
                    </h2>
                    <p className="mb-4 text-sm text-ink-3">
                      {c(
                        "Upload an export from your broker. TREVIXE maps common columns like Symbol, Side, Price, Qty, Time, P/L, Commission, Ticket.",
                        "Загрузи экспорт от брокера. TREVIXE сопоставит типовые колонки: Symbol, Side, Price, Qty, Time, P/L, Commission, Ticket."
                      )}
                    </p>
                  </div>
                  <select
                    value={brokerImportBroker}
                    onChange={(e) => setBrokerImportBroker(e.target.value)}
                    className="w-48 rounded-lg border border-stroke-2 bg-tinted px-3 py-2 text-sm text-ink outline-none"
                  >
                    <option>MetaTrader 5</option>
                    <option>MetaTrader 4</option>
                    <option>Interactive Brokers</option>
                    <option>Tradovate</option>
                    <option>TradingView</option>
                    <option value="Generic broker CSV">{c("Generic broker CSV", "Обычный CSV брокера")}</option>
                  </select>
                </div>
                <button
                  onClick={() => brokerFileInputRef.current?.click()}
                  disabled={brokerImporting}
                  className="inline-flex items-center gap-2 rounded-lg border border-stroke-2 bg-tinted px-4 py-2.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {brokerImporting ? c("Importing...", "Импорт...") : c("Upload broker CSV", "Загрузить CSV брокера")}
                </button>
                <input
                  ref={brokerFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBrokerImportFile(file);
                    e.target.value = "";
                  }}
                />
                {brokerImportResult && (
                  <div className="mt-4 rounded-lg border border-stroke bg-tinted p-4 text-sm text-ink-3">
                    <p className="font-medium text-ink">
                      {c("Imported", "Импортировано")} {brokerImportResult.imported} {c("from", "из")} {brokerImportResult.broker ?? brokerImportBroker}
                      {brokerImportResult.skipped > 0 && <span className="ml-2 text-ink-4">{c("Skipped", "Пропущено")} {brokerImportResult.skipped}</span>}
                    </p>
                    {brokerImportResult.errors.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-ink-4">
                        {brokerImportResult.errors.map((error, i) => <li key={i}>{error}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {entitlements && !entitlements.capabilities.canExportData && (
                <PaywallCard
                  feature="export_data"
                  title={c("Data export (Pro)", "Экспорт данных (Pro)")}
                  body={c("Export your full trade history and journal as CSV.", "Экспортируй всю историю сделок и журнал в CSV.")}
                />
              )}
              <div className={cn("rounded-xl border border-stroke bg-card p-6", entitlements && !entitlements.capabilities.canExportData ? "opacity-40 pointer-events-none select-none" : "")}>
                <h2 className="mb-4 text-lg font-semibold text-ink">{t("settings_export_title")}</h2>
                <p className="mb-4 text-sm text-ink-3">{t("settings_export_desc")}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleExport("trades")}
                    disabled={exporting}
                    className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {exporting ? c("Exporting...", "Экспорт...") : t("settings_export_trades")}
                  </button>
                  <button
                    onClick={() => handleExport("all")}
                    disabled={exporting}
                    className="flex items-center gap-2 rounded-lg border border-stroke-2 bg-tinted px-4 py-2.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {exporting ? c("Exporting...", "Экспорт...") : t("settings_export_all")}
                  </button>
                </div>
                {exportError && (
                  <p className="mt-3 text-sm rounded-lg border px-3 py-2" style={{ color: BRICK, background: `${BRICK}18`, borderColor: `${BRICK}40` }}>
                    {exportError}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-stroke bg-card p-6">
                <h2 className="mb-1 text-lg font-semibold text-ink">{c("Pro automation and alerts", "Автоматизация и алерты Pro")}</h2>
                <p className="mb-4 text-sm text-ink-3">
                  {c(
                    "TradingView webhook setup and advanced risk alerts are gated server-side for Pro.",
                    "Настройка TradingView webhook и продвинутые риск-алерты доступны на сервере только для Pro."
                  )}
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-stroke bg-tinted p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-brand" />
                      <p className="text-sm font-semibold text-ink">{c("TradingView webhook", "TradingView webhook")}</p>
                    </div>
                    {entitlements && !entitlements.capabilities.canUseTradingViewWebhook ? (
                      <PaywallCard
                        feature="tradingview_webhook"
                        title={c("TradingView webhook (Pro)", "TradingView webhook (Pro)")}
                        body={c("Open and close trades from signed TradingView alerts.", "Открывай и закрывай сделки из подписанных алертов TradingView.")}
                      />
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={loadTradingViewSetup}
                          disabled={loadingTradingView}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {loadingTradingView ? c("Loading...", "Загрузка...") : c("Generate URL", "Создать URL")}
                        </button>
                        {tradingViewSetup && (
                          <textarea
                            readOnly
                            value={tradingViewSetup.webhookUrl}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-stroke-2 bg-card px-3 py-2 text-xs text-ink-3 outline-none"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-stroke bg-tinted p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-brand" />
                      <p className="text-sm font-semibold text-ink">{c("Advanced alerts", "Продвинутые алерты")}</p>
                    </div>
                    {entitlements && !entitlements.capabilities.canUseAdvancedAlerts ? (
                      <PaywallCard
                        feature="advanced_alerts"
                        title={c("Advanced alerts (Pro)", "Продвинутые алерты (Pro)")}
                        body={c(
                          "Detect daily loss, overtrading, win-rate, and negative-R risk.",
                          "Отслеживай дневной убыток, овертрейдинг, win-rate и риск отрицательного R."
                        )}
                      />
                    ) : (
                      <div className="space-y-3">
                        <button
                          onClick={loadAdvancedAlerts}
                          disabled={loadingAlerts}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {loadingAlerts ? c("Checking...", "Проверка...") : c("Check alerts", "Проверить алерты")}
                        </button>
                        {advancedAlerts && (
                          <div className="space-y-2">
                            {advancedAlerts.alerts.map((alert) => (
                              <div key={alert.id} className="rounded-lg border border-stroke-2 bg-card px-3 py-2">
                                <p className="text-xs font-semibold text-ink">{alert.title}</p>
                                <p className="mt-0.5 text-[11px] text-ink-4">{alert.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ACCOUNT */}
          {activeTab === "account" && (
            <div className="space-y-5">
              {/* Plan status */}
              <div className="rounded-xl border border-stroke bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-ink">{t("settings_plan")}</h2>
                {entitlements ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink capitalize">
                            {entitlements.plan === "free" ? c("Free", "Free") : entitlements.plan === "pro" ? "Pro" : "Team"}
                          </span>
                          {entitlements.status === "trialing" && (
                            <span className="chip text-[10px]" style={{ background: "rgba(234,179,8,0.12)", color: "#CA8A04", padding: "1px 8px" }}>
                              {c("Trial", "Пробный период")}
                            </span>
                          )}
                          {entitlements.status === "past_due" && (
                            <span className="chip text-[10px]" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444", padding: "1px 8px" }}>
                              {t("plan_past_due")}
                            </span>
                          )}
                        </div>
                        {entitlements.status === "trialing" && entitlements.trialEndsAt && (
                          <p className="text-xs text-ink-4 mt-0.5">
                            {t("settings_trial_ends")}: {new Date(entitlements.trialEndsAt).toLocaleDateString()}
                          </p>
                        )}
                        {entitlements.currentPeriodEnd && entitlements.plan !== "free" && entitlements.status !== "trialing" && (
                          <p className="text-xs text-ink-4 mt-0.5">
                            {t("settings_billing_period")}: {c("until", "до")} {new Date(entitlements.currentPeriodEnd).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {entitlements.plan === "free" && (
                          <a
                            href="/pricing"
                            className="flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                          >
                            {t("billing_upgrade")}
                          </a>
                        )}
                        {entitlements.plan !== "free" && (
                          <a
                            href="/api/billing/portal"
                            className="flex items-center gap-1.5 rounded-lg border border-stroke-2 bg-tinted hover:bg-lift px-3.5 py-2 text-xs font-medium text-ink-3 hover:text-ink transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("billing_manage")}
                          </a>
                        )}
                      </div>
                    </div>

                    {entitlements.plan === "team" && entitlements.maxSeats > 0 && (
                      <div className="rounded-lg border border-stroke bg-tinted px-4 py-3">
                        <p className="text-xs text-ink-4">{t("settings_seats")}</p>
                        <p className="text-sm font-medium text-ink mt-0.5">
                          {workspaces.reduce((sum) => sum + 1, 0)} / {entitlements.maxSeats} {c("used", "использовано")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-20 rounded-lg bg-tinted animate-pulse" />
                )}
              </div>

              {/* Workspaces */}
              {entitlements?.plan === "team" && (
                <div className="rounded-xl border border-stroke bg-card p-6">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">{t("settings_workspaces")}</h2>
                      <p className="mt-1 text-xs leading-relaxed text-ink-5">
                        {c(
                          "Create a team workspace, then switch to it from the sidebar to unlock feed, members, leaderboard, and analytics.",
                          "Создай командное рабочее пространство, затем переключись на него в сайдбаре, чтобы открыть ленту, участников, лидерборд и аналитику."
                        )}
                      </p>
                    </div>
                    <span className="chip shrink-0 text-[10px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1", padding: "2px 8px" }}>
                      {workspaces.length} / {entitlements.maxWorkspaces}
                    </span>
                  </div>

                  {entitlements.capabilities.canCreateWorkspace && workspaces.length < entitlements.maxWorkspaces && (
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                        maxLength={60}
                        placeholder="Alpha Traders"
                        className={inputClass}
                      />
                      <button
                        onClick={handleCreateWorkspace}
                        disabled={creatingWorkspace || !newWorkspaceName.trim()}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        {creatingWorkspace ? c("Creating...", "Создание...") : t("workspace_create")}
                      </button>
                    </div>
                  )}

                  {workspaces.length > 0 ? (
                    <div className="space-y-2">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => setActiveWorkspaceId(ws.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-stroke bg-tinted px-4 py-3 text-left transition-colors hover:bg-lift"
                        >
                          <div>
                            <p className="text-sm font-medium text-ink">{ws.name}</p>
                            <p className="text-xs text-ink-4 capitalize">{ws.role}</p>
                          </div>
                          <span className="text-xs font-medium text-brand">{c("Open", "Открыть")}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-stroke bg-tinted/40 px-4 py-5 text-center text-sm text-ink-4">
                      {c("No workspaces yet. Create one to start testing the Team plan.", "Рабочих пространств пока нет. Создай первое, чтобы протестировать Team-план.")}
                    </div>
                  )}
                </div>
              )}

              {/* Team privacy settings */}
              {entitlements?.plan === "team" && (
                <div className="rounded-xl border border-stroke bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-ink">{c("Team privacy", "Приватность команды")}</h2>
                  <div className="space-y-5">
                    {/* Hide $ amounts toggle */}
                    <div className="flex items-center justify-between rounded-lg border border-stroke bg-tinted p-4">
                      <div className="pr-4">
                        <p className="text-sm font-medium text-ink">{t("settings_hide_amounts")}</p>
                        <p className="text-xs text-ink-5 mt-0.5">
                          Другие члены команды увидят проценты (%) вместо абсолютных значений P&L.
                        </p>
                      </div>
                      <button
                        onClick={() => setHideAmountsInTeam(h => !h)}
                        className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors", hideAmountsInTeam ? "bg-brand" : "bg-stroke-2")}
                      >
                        <span className={cn("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", hideAmountsInTeam ? "translate-x-5" : "translate-x-0")} />
                      </button>
                    </div>

                    {/* Privacy period */}
                    <div>
                      <label className={labelClass}>{t("settings_privacy_period")}</label>
                      <p className="text-xs text-ink-5 mb-2">{t("settings_privacy_period_desc")}</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={0} max={30} step={1}
                          value={privacyPeriodDays}
                          onChange={e => setPrivacyPeriodDays(Number(e.target.value))}
                          className="flex-1 accent-brand"
                        />
                        <span className="w-20 text-right text-sm font-mono text-ink">
                          {privacyPeriodDays === 0 ? "Выключено" : `${privacyPeriodDays} дн.`}
                        </span>
                      </div>
                      <p className="text-xs text-ink-5 mt-1">
                        Новые участники не видят чужие данные первые N дней после вступления.
                      </p>
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                    >
                      {saved ? <><Check className="h-4 w-4" /> {t("settings_saved")}</> : saving ? t("settings_saving") : <><Save className="h-4 w-4" /> {t("settings_save_changes")}</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ACCOUNTS */}
          {activeTab === "accounts" && (
            <div className="space-y-4">
              {entitlements && !entitlements.capabilities.canUseMultiAccount && (
                <PaywallCard
                  feature="csv_import"
                  title={c("Multi-account (Pro)", "Мультиаккаунт (Pro)")}
                  body={c(
                    "Track demo, live, and prop firm accounts separately. Upgrade to Pro to add more accounts.",
                    "Отслеживай demo, live и prop firm аккаунты отдельно. Перейди на Pro, чтобы добавить больше аккаунтов."
                  )}
                />
              )}

              <div className="rounded-xl border border-stroke bg-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{c("Trading accounts", "Торговые аккаунты")}</h2>
                    <p className="text-xs text-ink-5 mt-0.5">
                      {entitlements?.capabilities.canUseMultiAccount ? c("Unlimited accounts (Pro)", "Безлимитные аккаунты (Pro)") : `${tradingAccounts.length} / 1 (${c("Free", "Free")})`}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddAccount(s => !s)}
                    className="flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> {c("Add", "Добавить")}
                  </button>
                </div>

                {/* Add form */}
                {showAddAccount && (
                  <div className="mb-5 rounded-xl border border-stroke-2 bg-tinted p-4 space-y-3">
                    <p className="text-xs font-semibold text-ink uppercase tracking-wide">{c("New account", "Новый аккаунт")}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{c("Name", "Название")}</label>
                        <input value={newAccName} onChange={e => setNewAccName(e.target.value)}
                          placeholder="Live FTMO, Demo NQ..."
                          className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>{c("Type", "Тип")}</label>
                        <div className="relative">
                          <select value={newAccKind} onChange={e => setNewAccKind(e.target.value)} className={selectClass}>
                            <option value="live">Live</option>
                            <option value="demo">Demo</option>
                            <option value="prop">Prop Firm</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-ink-5" />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>{c("Broker", "Брокер")}</label>
                        <input value={newAccBroker} onChange={e => setNewAccBroker(e.target.value)}
                          placeholder="FTMO, NinjaTrader..." className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>{c("Currency", "Валюта")}</label>
                        <div className="relative">
                          <select value={newAccCurrency} onChange={e => setNewAccCurrency(e.target.value)} className={selectClass}>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-ink-5" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass}>{c("Starting balance", "Начальный баланс")}</label>
                        <input type="number" step="any" value={newAccBalance}
                          onChange={e => setNewAccBalance(e.target.value)}
                          placeholder="50000" className={inputClass} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddAccount} disabled={addingAccount || !newAccName.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors">
                        <Check className="h-3.5 w-3.5" /> {addingAccount ? c("Saving...", "Сохранение...") : c("Create", "Создать")}
                      </button>
                      <button onClick={() => setShowAddAccount(false)}
                        className="rounded-lg border border-stroke-2 px-4 py-2 text-xs text-ink-4 hover:text-ink transition-colors">
                        {c("Cancel", "Отмена")}
                      </button>
                    </div>
                  </div>
                )}

                {/* Accounts list */}
                {tradingAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-stroke-2 rounded-xl">
                    <Layers className="h-8 w-8 text-ink-5 mb-2" />
                    <p className="text-sm text-ink-4">{c("No accounts", "Нет аккаунтов")}</p>
                    <p className="text-xs text-ink-5 mt-0.5">{c("Add your first account to start tracking", "Добавь первый аккаунт для трекинга")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-stroke rounded-xl border border-stroke overflow-hidden">
                    {tradingAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between px-4 py-3 bg-card">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0",
                            acc.kind === "live" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                            acc.kind === "prop" ? "bg-brand/10 text-brand" :
                            "bg-stroke-2 text-ink-4")}>
                            {acc.kind}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{acc.name}</p>
                            <p className="text-xs text-ink-5">{acc.broker || acc.currency} {acc.balance > 0 ? `· $${acc.balance.toLocaleString()}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleToggleActive(acc)}
                            className={cn("text-xs px-2 py-1 rounded-md border transition-colors",
                              acc.isActive ? "border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5" : "border-stroke-2 text-ink-5 hover:text-ink")}>
                            {acc.isActive ? c("Active", "Активный") : c("Inactive", "Неактивный")}
                          </button>
                          <button onClick={() => handleDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg text-ink-5 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
