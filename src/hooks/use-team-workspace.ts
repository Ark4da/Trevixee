"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useAppStore } from "@/store";

interface WorkspaceOption {
  id: string;
}

interface TeamWorkspaceState {
  activeWorkspaceId: string | null;
  resolvingWorkspace: boolean;
  workspaceError: boolean;
}

export function useTeamWorkspace() {
  const { activeWorkspaceId, setActiveWorkspaceId } = useAppStore();
  const [state, setState] = useState<TeamWorkspaceState>({
    activeWorkspaceId: null,
    resolvingWorkspace: true,
    workspaceError: false,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setState((prev) => ({ ...prev, resolvingWorkspace: true, workspaceError: false }));

    fetch("/api/workspaces", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load workspaces");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setState({ activeWorkspaceId: null, resolvingWorkspace: false, workspaceError: true });
          return;
        }

        const nextId =
          activeWorkspaceId && data.some((workspace: WorkspaceOption) => workspace.id === activeWorkspaceId)
            ? activeWorkspaceId
            : data[0]?.id ?? null;

        if (nextId !== activeWorkspaceId) setActiveWorkspaceId(nextId);
        setState({ activeWorkspaceId: nextId, resolvingWorkspace: false, workspaceError: false });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ activeWorkspaceId: null, resolvingWorkspace: false, workspaceError: true });
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeWorkspaceId, setActiveWorkspaceId]);

  return state;
}
