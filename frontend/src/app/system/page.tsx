"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServers, useServerOverview } from "@/hooks/useMetrics";
import GaugeChart from "@/components/charts/GaugeChart";
import { formatDuration, formatPercent } from "@/lib/format";

export default function SystemOverviewPage() {
  const { selectedServer } = useServerStore();
  const { data: servers, isLoading } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: overview } = useServerOverview(serverId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading...</div>
      </div>
    );
  }

  if (!serverId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Please select a server.</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading server data...</div>
      </div>
    );
  }

  const m = overview.metrics;
  const totalDiskGb = m?.disks?.reduce((s, d) => s + d.total_gb, 0) ?? 0;
  const usedDiskGb = m?.disks?.reduce((s, d) => s + d.used_gb, 0) ?? 0;
  const diskPercent = totalDiskGb > 0 ? (usedDiskGb / totalDiskGb) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Gauge charts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GaugeChart
          value={m?.cpu?.usage_percent ?? 0}
          title="CPU Usage"
          height={180}
        />
        <GaugeChart
          value={m?.memory?.percent ?? 0}
          title="Memory Usage"
          height={180}
        />
        <GaugeChart
          value={diskPercent}
          title="Disk Usage"
          height={180}
        />
        <GaugeChart
          value={m?.memory?.swap_percent ?? 0}
          title="Swap Usage"
          height={180}
        />
      </div>

      {/* Server detail card */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
          {overview.name} &middot; {overview.ip}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-xs">
          <div>
            <div className="text-sm-text-dim">OS</div>
            <div className="font-mono text-sm-text mt-0.5">{overview.os}</div>
          </div>
          <div>
            <div className="text-sm-text-dim">CPU Cores</div>
            <div className="font-mono text-sm-text mt-0.5">
              {m?.cpu?.count?.physical ?? 0}P / {m?.cpu?.count?.logical ?? 0}L
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">CPU Usage</div>
            <div className="font-mono text-sm-text mt-0.5">
              {formatPercent(m?.cpu?.usage_percent ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Load Average</div>
            <div className="font-mono text-sm-text mt-0.5">
              {m?.cpu?.load_avg?.map((l) => l.toFixed(2)).join(", ") ?? "--"}
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Memory</div>
            <div className="font-mono text-sm-text mt-0.5">
              {(m?.memory?.used_gb ?? 0).toFixed(1)} / {(m?.memory?.total_gb ?? 0).toFixed(1)} GB
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Memory Usage</div>
            <div className="font-mono text-sm-text mt-0.5">
              {formatPercent(m?.memory?.percent ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Swap</div>
            <div className="font-mono text-sm-text mt-0.5">
              {(m?.memory?.swap_used_gb ?? 0).toFixed(1)} / {(m?.memory?.swap_total_gb ?? 0).toFixed(1)} GB
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Uptime</div>
            <div className="font-mono text-sm-text mt-0.5">
              {formatDuration(m?.uptime_seconds ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Disk</div>
            <div className="font-mono text-sm-text mt-0.5">
              {usedDiskGb.toFixed(1)} / {totalDiskGb.toFixed(1)} GB
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Processes</div>
            <div className="font-mono text-sm-text mt-0.5">
              {m?.process_count?.total ?? 0} total, {m?.process_count?.running ?? 0} running
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Docker</div>
            <div className="font-mono text-sm-text mt-0.5">
              {m?.docker?.filter((c) => c.state === "running").length ?? 0} running / {m?.docker?.length ?? 0} total
            </div>
          </div>
          <div>
            <div className="text-sm-text-dim">Network</div>
            <div className="font-mono text-sm-text mt-0.5">
              {m?.network?.interfaces?.length ?? 0} interface(s)
            </div>
          </div>
        </div>
      </div>

      {/* Top processes */}
      {m?.top_processes && m.top_processes.length > 0 && (
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
            Top Processes
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-sm-text-dim text-left">
                  <th className="py-1 pr-4">PID</th>
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4 text-right">CPU %</th>
                  <th className="py-1 text-right">MEM %</th>
                </tr>
              </thead>
              <tbody>
                {m.top_processes.map((p) => (
                  <tr key={p.pid} className="border-t border-[#2d3a4f]/50">
                    <td className="py-1 pr-4 font-mono text-sm-text-dim">{p.pid}</td>
                    <td className="py-1 pr-4 text-sm-text">{p.name}</td>
                    <td className="py-1 pr-4 font-mono text-right text-sm-text">
                      {formatPercent(p.cpu_percent)}
                    </td>
                    <td className="py-1 font-mono text-right text-sm-text">
                      {formatPercent(p.memory_percent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
