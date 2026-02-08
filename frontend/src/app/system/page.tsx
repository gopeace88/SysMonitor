"use client";

import { useServers, useServerOverview } from "@/hooks/useMetrics";
import GaugeChart from "@/components/charts/GaugeChart";
import { formatDuration, formatPercent } from "@/lib/format";

export default function SystemOverviewPage() {
  const { data: servers, isLoading } = useServers();
  const server1Id = servers?.[0]?.id ?? null;
  const server2Id = servers?.[1]?.id ?? null;

  const { data: overview1 } = useServerOverview(server1Id);
  const { data: overview2 } = useServerOverview(server2Id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading...</div>
      </div>
    );
  }

  const overviews = [overview1, overview2].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Gauge charts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeChart
          value={overview1?.metrics?.cpu?.usage_percent ?? 0}
          title={`${overview1?.name ?? "Server 1"} CPU`}
          height={180}
        />
        <GaugeChart
          value={overview1?.metrics?.memory?.percent ?? 0}
          title={`${overview1?.name ?? "Server 1"} MEM`}
          height={180}
        />
        <GaugeChart
          value={overview2?.metrics?.cpu?.usage_percent ?? 0}
          title={`${overview2?.name ?? "Server 2"} CPU`}
          height={180}
        />
        <GaugeChart
          value={overview2?.metrics?.memory?.percent ?? 0}
          title={`${overview2?.name ?? "Server 2"} MEM`}
          height={180}
        />
      </div>

      {/* Summary info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {overviews.map((ov, idx) => {
          if (!ov) return null;
          const m = ov.metrics;
          const totalDiskGb = m?.disks?.reduce((s, d) => s + d.total_gb, 0) ?? 0;
          const usedDiskGb = m?.disks?.reduce((s, d) => s + d.used_gb, 0) ?? 0;

          return (
            <div
              key={idx}
              className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4"
            >
              <h3 className="text-sm font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
                {ov.name}
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div className="text-sm-text-dim">CPU Cores</div>
                <div className="font-mono text-sm-text text-right">
                  {m?.cpu?.count?.physical ?? 0}P / {m?.cpu?.count?.logical ?? 0}L
                </div>

                <div className="text-sm-text-dim">CPU Usage</div>
                <div className="font-mono text-sm-text text-right">
                  {formatPercent(m?.cpu?.usage_percent ?? 0)}
                </div>

                <div className="text-sm-text-dim">Memory</div>
                <div className="font-mono text-sm-text text-right">
                  {(m?.memory?.used_gb ?? 0).toFixed(1)} GB / {(m?.memory?.total_gb ?? 0).toFixed(1)} GB
                </div>

                <div className="text-sm-text-dim">Memory Usage</div>
                <div className="font-mono text-sm-text text-right">
                  {formatPercent(m?.memory?.percent ?? 0)}
                </div>

                <div className="text-sm-text-dim">Disk</div>
                <div className="font-mono text-sm-text text-right">
                  {usedDiskGb.toFixed(1)} GB / {totalDiskGb.toFixed(1)} GB
                </div>

                <div className="text-sm-text-dim">Load Average</div>
                <div className="font-mono text-sm-text text-right">
                  {m?.cpu?.load_avg?.map((l) => l.toFixed(2)).join(", ") ?? "--"}
                </div>

                <div className="text-sm-text-dim">Uptime</div>
                <div className="font-mono text-sm-text text-right">
                  {formatDuration(m?.uptime_seconds ?? 0)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
