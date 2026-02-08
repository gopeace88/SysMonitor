"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServers, useServerNetwork } from "@/hooks/useMetrics";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import DataTable from "@/components/tables/DataTable";
import { formatBytes, formatBps } from "@/lib/format";
import React from "react";

export default function InterfacesPage() {
  const { selectedServer } = useServerStore();
  const { data: servers, isLoading: serversLoading } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: netData, isLoading } = useServerNetwork(serverId);

  if (serversLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading network data...</div>
      </div>
    );
  }

  if (!netData || !netData.current?.interfaces) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">No network data available.</div>
      </div>
    );
  }

  const interfaces = netData.current.interfaces;

  const columns = [
    {
      key: "name",
      label: "Interface",
      format: (value: unknown) => (
        <span className="font-semibold text-sm-text">{value as string}</span>
      ),
    },
    {
      key: "is_up",
      label: "Status",
      format: (value: unknown) => {
        const up = value as boolean;
        return (
          <span className={`font-semibold ${up ? "text-sm-ok" : "text-sm-error"}`}>
            {up ? "UP" : "DOWN"}
          </span>
        );
      },
    },
    {
      key: "speed_mbps",
      label: "Speed",
      align: "right" as const,
      format: (value: unknown) => {
        const speed = value as number;
        return (
          <span className="font-mono">
            {speed >= 1000 ? `${(speed / 1000).toFixed(0)} Gbps` : `${speed} Mbps`}
          </span>
        );
      },
    },
    {
      key: "rx_bytes_sec",
      label: "RX Rate",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono text-sm-ok">{formatBps(value as number)}</span>
      ),
    },
    {
      key: "tx_bytes_sec",
      label: "TX Rate",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono text-sm-warn">{formatBps(value as number)}</span>
      ),
    },
    {
      key: "rx_bytes",
      label: "RX Total",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono text-sm-text-dim">{formatBytes(value as number)}</span>
      ),
    },
    {
      key: "tx_bytes",
      label: "TX Total",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono text-sm-text-dim">{formatBytes(value as number)}</span>
      ),
    },
    {
      key: "errors_in",
      label: "Errors",
      align: "right" as const,
      format: (value: unknown, row: Record<string, unknown>) => {
        const errIn = value as number;
        const errOut = (row.errors_out as number) ?? 0;
        const total = errIn + errOut;
        return (
          <span className={`font-mono ${total > 0 ? "text-sm-error" : "text-sm-text-dim"}`}>
            {total}
          </span>
        );
      },
    },
    {
      key: "drops_in",
      label: "Drops",
      align: "right" as const,
      format: (value: unknown, row: Record<string, unknown>) => {
        const dropIn = value as number;
        const dropOut = (row.drops_out as number) ?? 0;
        const total = dropIn + dropOut;
        return (
          <span className={`font-mono ${total > 0 ? "text-sm-warn" : "text-sm-text-dim"}`}>
            {total}
          </span>
        );
      },
    },
  ];

  // Build traffic history chart for the primary interface
  const primaryIface = interfaces[0]?.name;
  const rxHistory =
    netData.history?.map((h) => {
      const iface = h.interfaces?.find((i) => i.name === primaryIface);
      return { timestamp: h.timestamp, value: iface?.rx_bytes_sec ?? 0 };
    }) ?? [];

  const txHistory =
    netData.history?.map((h) => {
      const iface = h.interfaces?.find((i) => i.name === primaryIface);
      return { timestamp: h.timestamp, value: iface?.tx_bytes_sec ?? 0 };
    }) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">Network Interfaces</h1>
        <span className="text-xs text-sm-text-dim font-mono">
          {interfaces.length} interface(s)
        </span>
      </div>

      {/* Traffic charts */}
      {primaryIface && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TimeSeriesChart
            data={rxHistory}
            title={`RX Traffic - ${primaryIface}`}
            color="#22c55e"
            height={200}
            yAxisFormat={(v) => formatBps(v)}
          />
          <TimeSeriesChart
            data={txHistory}
            title={`TX Traffic - ${primaryIface}`}
            color="#f59e0b"
            height={200}
            yAxisFormat={(v) => formatBps(v)}
          />
        </div>
      )}

      {/* Interface cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {interfaces.map((iface) => (
          <div
            key={iface.name}
            className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    iface.is_up ? "bg-sm-ok animate-pulse" : "bg-sm-error"
                  }`}
                />
                <span className="text-sm font-semibold text-sm-text">{iface.name}</span>
              </div>
              <span className="text-[10px] text-sm-text-dim font-mono">
                {iface.speed_mbps >= 1000
                  ? `${(iface.speed_mbps / 1000).toFixed(0)} Gbps`
                  : `${iface.speed_mbps} Mbps`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <div className="text-sm-text-dim">RX Rate</div>
              <div className="font-mono text-sm-ok text-right">
                {formatBps(iface.rx_bytes_sec)}
              </div>
              <div className="text-sm-text-dim">TX Rate</div>
              <div className="font-mono text-sm-warn text-right">
                {formatBps(iface.tx_bytes_sec)}
              </div>
              <div className="text-sm-text-dim">RX Total</div>
              <div className="font-mono text-sm-text text-right">
                {formatBytes(iface.rx_bytes)}
              </div>
              <div className="text-sm-text-dim">TX Total</div>
              <div className="font-mono text-sm-text text-right">
                {formatBytes(iface.tx_bytes)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed table */}
      <DataTable
        columns={columns}
        data={interfaces as unknown as Record<string, unknown>[]}
        title="Interface Details"
        maxHeight="400px"
      />
    </div>
  );
}
