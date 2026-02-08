"use client";

import { useServers, useServerOverview } from "@/hooks/useMetrics";
import { useServerStore } from "@/stores/serverStore";
import { formatPercent, formatDuration, formatBytes } from "@/lib/format";
import GaugeChart from "@/components/charts/GaugeChart";
import React from "react";

function HostCard({ serverId }: { serverId: string }) {
  const { data: overview } = useServerOverview(serverId);
  const { setServer } = useServerStore();

  if (!overview) {
    return (
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#2d3a4f] rounded w-32 mb-3" />
        <div className="h-3 bg-[#2d3a4f] rounded w-48" />
      </div>
    );
  }

  const m = overview.metrics;
  const totalDiskGb = m?.disks?.reduce((s, d) => s + d.total_gb, 0) ?? 0;
  const usedDiskGb = m?.disks?.reduce((s, d) => s + d.used_gb, 0) ?? 0;
  const diskPercent = totalDiskGb > 0 ? (usedDiskGb / totalDiskGb) * 100 : 0;
  const dockerRunning = m?.docker?.filter((c) => c.state === "running").length ?? 0;
  const dockerTotal = m?.docker?.length ?? 0;

  return (
    <div
      className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4 hover:bg-sm-surface-hover transition-colors cursor-pointer"
      onClick={() => setServer(serverId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2d3a4f]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sm-ok animate-pulse" />
          <span className="text-sm font-semibold text-sm-text">{overview.name}</span>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-sm-text-dim">{overview.ip}</div>
          <div className="text-[10px] text-sm-text-dim">{overview.os}</div>
        </div>
      </div>

      {/* Gauges row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <GaugeChart value={m?.cpu?.usage_percent ?? 0} title="CPU" height={120} />
        <GaugeChart value={m?.memory?.percent ?? 0} title="MEM" height={120} />
        <GaugeChart value={diskPercent} title="Disk" height={120} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
        <div className="text-sm-text-dim">CPU Cores</div>
        <div className="font-mono text-sm-text text-right">
          {m?.cpu?.count?.physical ?? 0}P / {m?.cpu?.count?.logical ?? 0}L
        </div>

        <div className="text-sm-text-dim">Memory</div>
        <div className="font-mono text-sm-text text-right">
          {(m?.memory?.used_gb ?? 0).toFixed(1)} / {(m?.memory?.total_gb ?? 0).toFixed(1)} GB
        </div>

        <div className="text-sm-text-dim">Disk</div>
        <div className="font-mono text-sm-text text-right">
          {usedDiskGb.toFixed(1)} / {totalDiskGb.toFixed(1)} GB
        </div>

        <div className="text-sm-text-dim">Load Avg</div>
        <div className="font-mono text-sm-text text-right">
          {m?.cpu?.load_avg?.map((l) => l.toFixed(2)).join(", ") ?? "--"}
        </div>

        <div className="text-sm-text-dim">Processes</div>
        <div className="font-mono text-sm-text text-right">
          {m?.process_count?.total ?? 0}
        </div>

        <div className="text-sm-text-dim">Docker</div>
        <div className="font-mono text-sm-text text-right">
          <span className="text-sm-ok">{dockerRunning}</span>
          <span className="text-sm-text-dim"> / {dockerTotal}</span>
        </div>

        <div className="text-sm-text-dim">Network</div>
        <div className="font-mono text-sm-text text-right">
          {m?.network?.interfaces?.length ?? 0} iface(s)
        </div>

        <div className="text-sm-text-dim">Uptime</div>
        <div className="font-mono text-sm-text text-right">
          {formatDuration(m?.uptime_seconds ?? 0)}
        </div>
      </div>
    </div>
  );
}

export default function HostsPage() {
  const { data: servers, isLoading } = useServers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading hosts...</div>
      </div>
    );
  }

  if (!servers || servers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">No hosts found.</div>
      </div>
    );
  }

  const upCount = servers.filter((s) => s.status === "up").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">Hosts</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-ok" />
            <span className="font-mono text-sm-ok">{upCount}</span>
            <span className="text-sm-text-dim">up</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-error" />
            <span className="font-mono text-sm-error">{servers.length - upCount}</span>
            <span className="text-sm-text-dim">down</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {servers.map((s) => (
          <HostCard key={s.id} serverId={s.id} />
        ))}
      </div>
    </div>
  );
}
