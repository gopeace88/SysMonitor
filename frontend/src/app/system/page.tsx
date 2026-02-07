"use client";

import { useServers, useServerOverview } from "@/hooks/useMetrics";
import GaugeChart from "@/components/charts/GaugeChart";
import { formatBytes, formatDuration, formatPercent } from "@/lib/format";

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

  return (
    <div className="space-y-4">
      {/* Gauge charts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeChart
          value={overview1?.cpu_percent ?? 0}
          title={`${overview1?.name ?? "Server 1"} CPU`}
          height={180}
        />
        <GaugeChart
          value={overview1?.memory_percent ?? 0}
          title={`${overview1?.name ?? "Server 1"} MEM`}
          height={180}
        />
        <GaugeChart
          value={overview2?.cpu_percent ?? 0}
          title={`${overview2?.name ?? "Server 2"} CPU`}
          height={180}
        />
        <GaugeChart
          value={overview2?.memory_percent ?? 0}
          title={`${overview2?.name ?? "Server 2"} MEM`}
          height={180}
        />
      </div>

      {/* Summary info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[overview1, overview2].map(
          (ov, idx) =>
            ov && (
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
                    {ov.cpu_cores}
                  </div>

                  <div className="text-sm-text-dim">CPU Usage</div>
                  <div className="font-mono text-sm-text text-right">
                    {formatPercent(ov.cpu_percent)}
                  </div>

                  <div className="text-sm-text-dim">Memory</div>
                  <div className="font-mono text-sm-text text-right">
                    {formatBytes(ov.memory_used)} / {formatBytes(ov.memory_total)}
                  </div>

                  <div className="text-sm-text-dim">Memory Usage</div>
                  <div className="font-mono text-sm-text text-right">
                    {formatPercent(ov.memory_percent)}
                  </div>

                  <div className="text-sm-text-dim">Disk</div>
                  <div className="font-mono text-sm-text text-right">
                    {formatBytes(ov.disk_used)} / {formatBytes(ov.disk_total)}
                  </div>

                  <div className="text-sm-text-dim">Load Average</div>
                  <div className="font-mono text-sm-text text-right">
                    {ov.load_avg?.map((l) => l.toFixed(2)).join(", ") ?? "--"}
                  </div>

                  <div className="text-sm-text-dim">Uptime</div>
                  <div className="font-mono text-sm-text text-right">
                    {formatDuration(ov.uptime)}
                  </div>
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}
