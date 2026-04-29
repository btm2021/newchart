"use client";

import { useEffect, useState } from "react";
import { getDatasourceRegistry } from "@/lib/datasources/registry";
import { TradingViewHost } from "@/components/chart/tradingview-host";
import { defaultWorkspaceState, loadWorkspaceState, saveWorkspaceState, type UserWorkspaceState } from "@/lib/storage/workspace-state";

function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}

export function ChartAppShell() {
  const [workspace, setWorkspace] = useState<UserWorkspaceState>(defaultWorkspaceState);
  const [ready, setReady] = useState(false);

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
