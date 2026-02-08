"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServers, useServerNetwork } from "@/hooks/useMetrics";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import { formatBytes, formatBps } from "@/lib/format";
import React from "react";

export default function FlowsPage() {
  const { selectedServer } = useServerStore();
  const { data: servers, isLoading: serversLoading } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: netData, isLoading } = useServerNetwork(serverId);

  if (serversLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading flow data...</div>
      </div>
    );
  }

  if (!netData || !netData.current?.interfaces) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">No flow data available.</div>
      </div>
    );
  }

  const interfaces = netData.current.interfaces.filter((i) => i.is_up);
  const history = netData.history ?? [];

  // Total throughput across all interfaces
  const totalRx = interfaces.reduce((s, i) => s + i.rx_bytes_sec, 0);
  const totalTx = interfaces.reduce((s, i) => s + i.tx_bytes_sec, 0);
  const totalRxBytes = interfaces.reduce((s, i) => s + i.rx_bytes, 0);
  const totalTxBytes = interfaces.reduce((s, i) => s + i.tx_bytes, 0);

  // Aggregate traffic history
  const rxHistory = history.map((h) => ({
    timestamp: h.timestamp,
    value: h.interfaces?.reduce((s, i) => s + (i.rx_bytes_sec ?? 0), 0) ?? 0,
  }));

  const txHistory = history.map((h) => ({
    timestamp: h.timestamp,
    value: h.interfaces?.reduce((s, i) => s + (i.tx_bytes_sec ?? 0), 0) ?? 0,
  }));

  const combinedHistory = history.map((h) => ({
    timestamp: h.timestamp,
    value:
      h.interfaces?.reduce(
        (s, i) => s + (i.rx_bytes_sec ?? 0) + (i.tx_bytes_sec ?? 0),
        0
      ) ?? 0,
  }));

  // Per-interface breakdown
  const ifaceNames = interfaces.map((i) => i.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">Network Flows</h1>
        <span className="text-xs text-sm-text-dim font-mono">
          {servers?.find((s) => s.id === serverId)?.name ?? serverId}
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            RX Rate
          </div>
          <div className="font-mono text-lg font-semibold text-sm-ok">
            {formatBps(totalRx)}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            TX Rate
          </div>
          <div className="font-mono text-lg font-semibold text-sm-warn">
            {formatBps(totalTx)}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Total Received
          </div>
          <div className="font-mono text-lg font-semibold text-sm-text">
            {formatBytes(totalRxBytes)}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Total Sent
          </div>
          <div className="font-mono text-lg font-semibold text-sm-text">
            {formatBytes(totalTxBytes)}
          </div>
        </div>
      </div>

      {/* Combined traffic chart */}
      <TimeSeriesChart
        data={combinedHistory}
        title="Total Network Throughput (RX + TX)"
        color="#3b82f6"
        height={250}
        yAxisFormat={(v) => formatBps(v)}
      />

      {/* RX / TX split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimeSeriesChart
          data={rxHistory}
          title="Inbound (RX)"
          color="#22c55e"
          height={200}
          yAxisFormat={(v) => formatBps(v)}
        />
        <TimeSeriesChart
          data={txHistory}
          title="Outbound (TX)"
          color="#f59e0b"
          height={200}
          yAxisFormat={(v) => formatBps(v)}
        />
      </div>

      {/* Per-interface breakdown */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
          Per-Interface Breakdown
        </h3>
        <div className="space-y-3">
          {interfaces.map((iface) => {
            const total = iface.rx_bytes_sec + iface.tx_bytes_sec;
            const rxPct = total > 0 ? (iface.rx_bytes_sec / total) * 100 : 50;
            return (
              <div key={iface.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sm-ok" />
                    <span className="font-semibold text-sm-text">{iface.name}</span>
                    <span className="text-sm-text-dim font-mono">
                      {iface.speed_mbps >= 1000
                        ? `${(iface.speed_mbps / 1000).toFixed(0)} Gbps`
                        : `${iface.speed_mbps} Mbps`}
                    </span>
                  </div>
                  <span className="font-mono text-sm-text-dim">{formatBps(total)}</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sm-ok transition-all"
                    style={{ width: `${rxPct}%` }}
                    title={`RX: ${formatBps(iface.rx_bytes_sec)}`}
                  />
                  <div
                    className="bg-sm-warn transition-all"
                    style={{ width: `${100 - rxPct}%` }}
                    title={`TX: ${formatBps(iface.tx_bytes_sec)}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-sm-text-dim mt-0.5">
                  <span>RX: {formatBps(iface.rx_bytes_sec)}</span>
                  <span>TX: {formatBps(iface.tx_bytes_sec)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-2 border-t border-[#2d3a4f] text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-ok" />
            <span className="text-sm-text-dim">Inbound (RX)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-warn" />
            <span className="text-sm-text-dim">Outbound (TX)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
