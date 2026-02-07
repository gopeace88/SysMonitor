"use client";

import {
  useServers,
  useServerOverview,
  useServerCpu,
  useServerMemory,
  useServerDisk,
  useServerNetwork,
  useServerDocker,
  useActiveAlerts,
} from "@/hooks/useMetrics";
import ServerCard from "@/components/cards/ServerCard";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import BarChart from "@/components/charts/BarChart";
import DataTable from "@/components/tables/DataTable";
import { formatBytes, formatPercent, formatBps } from "@/lib/format";
import { useServerStore } from "@/stores/serverStore";
import React from "react";

export default function DashboardPage() {
  const { data: servers, isLoading: serversLoading } = useServers();
  const { setServer } = useServerStore();
  const { data: activeAlerts } = useActiveAlerts();

  // Get first two servers (Purions00, RTK NAS)
  const server1Id = servers?.[0]?.id ?? null;
  const server2Id = servers?.[1]?.id ?? null;

  const { data: overview1 } = useServerOverview(server1Id);
  const { data: overview2 } = useServerOverview(server2Id);
  const { data: cpu1 } = useServerCpu(server1Id);
  const { data: mem1 } = useServerMemory(server1Id);
  const { data: disk1 } = useServerDisk(server1Id);
  const { data: net1 } = useServerNetwork(server1Id);
  const { data: docker1 } = useServerDocker(server1Id);

  if (serversLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading dashboard...</div>
      </div>
    );
  }

  // Docker containers table columns
  const dockerColumns = [
    { key: "name", label: "Name" },
    { key: "image", label: "Image" },
    {
      key: "state",
      label: "Status",
      format: (value: unknown) => {
        const state = value as string;
        const color =
          state === "running"
            ? "text-sm-ok"
            : state === "exited"
              ? "text-sm-error"
              : "text-sm-warn";
        return <span className={color}>{state}</span>;
      },
    },
    {
      key: "cpu_percent",
      label: "CPU",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono">{formatPercent(value as number)}</span>
      ),
    },
    {
      key: "memory_usage",
      label: "Memory",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono">{formatBytes(value as number)}</span>
      ),
    },
  ];

  // Alerts table columns
  const alertColumns = [
    {
      key: "severity",
      label: "Sev",
      width: "50px",
      format: (value: unknown) => {
        const sev = value as string;
        const colors: Record<string, string> = {
          critical: "bg-sm-error",
          warning: "bg-sm-warn",
          info: "bg-sm-link",
        };
        return (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] text-white font-medium ${colors[sev] || "bg-sm-text-dim"}`}
          >
            {sev}
          </span>
        );
      },
    },
    { key: "server_name", label: "Server" },
    { key: "message", label: "Message" },
    {
      key: "timestamp",
      label: "Time",
      format: (value: unknown) => (
        <span className="font-mono text-sm-text-dim">
          {new Date(value as string).toLocaleTimeString("en-US", { hour12: false })}
        </span>
      ),
    },
  ];

  // Disk data for bar chart
  const diskBarData =
    disk1?.disks.map((d) => ({
      label: d.mount,
      value: d.used,
      max: d.total,
    })) ?? [];

  // Network data for time series chart
  const networkData =
    net1?.rx_history.map((d, i) => ({
      timestamp: d.timestamp,
      value: d.value + (net1?.tx_history[i]?.value ?? 0),
    })) ?? [];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-sm-text-dim">
            Servers: <span className="font-mono text-sm-text">{servers?.length ?? 0}</span>
          </span>
          {activeAlerts && activeAlerts.length > 0 && (
            <span className="text-[10px] bg-sm-error/20 text-sm-error px-2 py-0.5 rounded">
              <span className="font-mono">{activeAlerts.length}</span> active alerts
            </span>
          )}
        </div>
      </div>

      {/* Row 1: Server cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servers?.[0] && (
          <ServerCard
            server={servers[0]}
            onClick={() => setServer(servers[0].id)}
          />
        )}
        {servers?.[1] && (
          <ServerCard
            server={servers[1]}
            onClick={() => setServer(servers[1].id)}
          />
        )}
      </div>

      {/* Row 2: CPU + Memory time series */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimeSeriesChart
          data={cpu1?.usage_history ?? []}
          title={`CPU Usage - ${overview1?.name ?? "Server 1"}`}
          color="#3b82f6"
          height={200}
          yAxisFormat={(v) => `${v}%`}
        />
        <TimeSeriesChart
          data={mem1?.usage_history ?? []}
          title={`Memory Usage - ${overview1?.name ?? "Server 1"}`}
          color="#8b5cf6"
          height={200}
          yAxisFormat={(v) => `${v}%`}
        />
      </div>

      {/* Row 3: Disk usage + Network traffic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BarChart
          data={diskBarData}
          title="Disk Usage"
          height={Math.max(120, diskBarData.length * 40 + 50)}
        />
        <TimeSeriesChart
          data={networkData}
          title="Network Traffic (RX + TX)"
          color="#22c55e"
          height={200}
          yAxisFormat={(v) => formatBps(v)}
        />
      </div>

      {/* Row 4: Docker containers + Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataTable
          columns={dockerColumns}
          data={(docker1?.containers as unknown as Record<string, unknown>[]) ?? []}
          title={`Docker Containers - ${overview1?.name ?? "Server 1"}`}
          maxHeight="250px"
        />
        <DataTable
          columns={alertColumns}
          data={(activeAlerts as unknown as Record<string, unknown>[]) ?? []}
          title="Recent Alerts"
          maxHeight="250px"
        />
      </div>

      {/* Summary stats footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Total CPU
          </div>
          <div className="font-mono text-lg font-semibold text-sm-link">
            {overview1 ? formatPercent(overview1.cpu_percent) : "--"}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Total Memory
          </div>
          <div className="font-mono text-lg font-semibold text-purple-400">
            {overview1 ? formatBytes(overview1.memory_used) : "--"}{" "}
            <span className="text-xs text-sm-text-dim">
              / {overview1 ? formatBytes(overview1.memory_total) : "--"}
            </span>
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Network RX
          </div>
          <div className="font-mono text-lg font-semibold text-sm-ok">
            {overview1 ? formatBps(overview1.network_rx) : "--"}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Network TX
          </div>
          <div className="font-mono text-lg font-semibold text-sm-warn">
            {overview1 ? formatBps(overview1.network_tx) : "--"}
          </div>
        </div>
      </div>
    </div>
  );
}
