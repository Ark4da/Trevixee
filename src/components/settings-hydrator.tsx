"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store";

export function SettingsHydrator() {
  const setUserName = useAppStore((s) => s.setUserName);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { if (d.userName) setUserName(d.userName); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
