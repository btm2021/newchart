"use client";

import { useEffect, useState } from "react";
import { getDatasourceRegistry } from "@/lib/datasources/registry";
import { TradingViewHost } from "@/components/chart/tradingview-host";
import { useNativePwa } from "@/lib/pwa/use-native-pwa";
import { defaultWorkspaceState, loadWorkspaceState, saveWorkspaceState, type UserWorkspaceState } from "@/lib/storage/workspace-state";

function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const reloadIfUpdated = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const updateServiceWorker = () => {
      void registration?.update().catch(() => undefined);
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    };

    const triggerUpdateCheck = () => {
      if (!disposed && document.visibilityState === "visible") {
        updateServiceWorker();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadIfUpdated);
    window.addEventListener("focus", triggerUpdateCheck);
    document.addEventListener("visibilitychange", triggerUpdateCheck);

    navigator.serviceWorker
      .register("/sw.js", {
        updateViaCache: "none",
        scope: "/",
      })
      .then((nextRegistration) => {
        registration = nextRegistration;

        if (registration.waiting) {
          updateServiceWorker();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              updateServiceWorker();
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      window.removeEventListener("focus", triggerUpdateCheck);
      document.removeEventListener("visibilitychange", triggerUpdateCheck);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadIfUpdated);
    };
  }, []);

  return null;
}

export function ChartAppShell() {
  const [workspace, setWorkspace] = useState<UserWorkspaceState>(defaultWorkspaceState);
  const [ready, setReady] = useState(false);
  useNativePwa(workspace.keepScreenAwake);

  useEffect(() => {
    setWorkspace(loadWorkspaceState());
    void getDatasourceRegistry().initialize();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveWorkspaceState(workspace);
  }, [ready, workspace]);

  return (
    <div className="chart-page">
      <PwaRegistrar />
      <TradingViewHost
        symbol={workspace.activeSymbol}
        interval={workspace.activeInterval}
        chartType={workspace.chartType}
        keepScreenAwake={workspace.keepScreenAwake}
        onToggleKeepScreenAwake={() => {
          setWorkspace((current) => ({
            ...current,
            keepScreenAwake: !current.keepScreenAwake,
          }));
        }}
        onChartStateChange={({ symbol, interval }) => {
          setWorkspace((current) => ({
            ...current,
            activeSymbol: symbol,
            activeDatasourceId: symbol.split(":")[0] ?? current.activeDatasourceId,
            activeInterval: interval,
          }));
        }}
      />
    </div>
  );
}
