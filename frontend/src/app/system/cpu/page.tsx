"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServerCpu, useServers } from "@/hooks/useMetrics";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import { formatPercent } from "@/lib/format";

export default function CpuPage() {
  const { selectedServer } = useServerStore();
  const { data: servers } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: cpuData, isLoading } = useServerCpu(serverId);

  if (!serverId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">
          Please select a server above.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">Loading CPU data...</div>
      </div>
    );
  }

  if (!cpuData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">No CPU data available.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CPU info header */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
              Model
            </div>
            <div className="text-xs text-sm-text mt-0.5 truncate">
              {cpuData.cpu_model}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
              Cores
            </div>
            <div className="font-mono text-xs text-sm-text mt-0.5">
              {cpuData.cpu_cores}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
              Threads
            </div>
            <div className="font-mono text-xs text-sm-text mt-0.5">
              {cpuData.cpu_threads}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
              Current Usage
            </div>
            <div
              className={`font-mono text-xs mt-0.5 font-semibold ${
                cpuData.current_percent < 60
                  ? "text-sm-ok"
                  : cpuData.current_percent < 85
                    ? "text-sm-warn"
                    : "text-sm-error"
              }`}
            >
              {formatPercent(cpuData.current_percent)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
              Load Average
            </div>
            <div className="font-mono text-xs text-sm-text mt-0.5">
              {cpuData.load_avg.map((l) => l.toFixed(2)).join(" / ")}
            </div>
          </div>
        </div>
      </div>

      {/* CPU usage time series */}
      <TimeSeriesChart
        data={cpuData.usage_history}
        title="CPU Usage Over Time"
        color="#3b82f6"
        height={250}
        yAxisFormat={(v) => `${v}%`}
      />

      {/* Per-core usage */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
        <h3 className="text-xs font-semibold text-sm-text mb-3">
          Per-Core Usage
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {cpuData.per_core.map((core) => {
            const color =
              core.percent < 60
                ? "bg-sm-ok"
                : core.percent < 85
                  ? "bg-sm-warn"
                  : "bg-sm-error";
            const textColor =
              core.percent < 60
                ? "text-sm-ok"
                : core.percent < 85
                  ? "text-sm-warn"
                  : "text-sm-error";
            return (
              <div
                key={core.core}
                className="bg-sm-bg border border-[#2d3a4f] rounded p-2 text-center"
              >
                <div className="text-[10px] text-sm-text-dim">
                  Core {core.core}
                </div>
                <div className={`font-mono text-sm font-semibold ${textColor}`}>
                  {formatPercent(core.percent)}
                </div>
                <div className="mt-1 h-1 bg-[#2d3a4f] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(core.percent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load average details */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
        <h3 className="text-xs font-semibold text-sm-text mb-3">
          Load Average
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {["1 min", "5 min", "15 min"].map((label, i) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
                {label}
              </div>
              <div className="font-mono text-xl font-semibold text-sm-text mt-1">
                {cpuData.load_avg[i]?.toFixed(2) ?? "--"}
              </div>
              <div className="text-[10px] text-sm-text-dim mt-0.5">
                {cpuData.cpu_cores > 0
                  ? `${((cpuData.load_avg[i] / cpuData.cpu_cores) * 100).toFixed(0)}% of capacity`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
