"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServerMemory, useServers } from "@/hooks/useMetrics";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import { formatPercent } from "@/lib/format";

export default function MemoryPage() {
  const { selectedServer } = useServerStore();
  const { data: servers } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: memData, isLoading } = useServerMemory(serverId);

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
        <div className="text-sm-text-dim text-sm">Loading memory data...</div>
      </div>
    );
  }

  if (!memData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">
          No memory data available.
        </div>
      </div>
    );
  }

  const mem = memData.current;
  const memPercent = mem.percent;
  const swapPercent = mem.swap_percent ?? 0;

  // Convert history to chart format
  const historyData = memData.history.map((h) => ({
    timestamp: h.timestamp,
    value: h.percent,
  }));

  return (
    <div className="space-y-4">
      {/* Memory time series */}
      <TimeSeriesChart
        data={historyData}
        title="Memory Usage Over Time"
        color="#8b5cf6"
        height={250}
        yAxisFormat={(v) => `${v}%`}
      />

      {/* Memory breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Physical memory */}
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
            Physical Memory
          </h3>

          {/* Usage bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-sm-text-dim mb-1">
              <span>Used</span>
              <span className="font-mono">
                {formatPercent(memPercent)}
              </span>
            </div>
            <div className="h-3 bg-[#2d3a4f] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  memPercent < 60
                    ? "bg-sm-ok"
                    : memPercent < 85
                      ? "bg-sm-warn"
                      : "bg-sm-error"
                }`}
                style={{ width: `${Math.min(memPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div className="text-sm-text-dim">Total</div>
            <div className="font-mono text-sm-text text-right">
              {mem.total_gb.toFixed(1)} GB
            </div>

            <div className="text-sm-text-dim">Used</div>
            <div className="font-mono text-sm-text text-right">
              {mem.used_gb.toFixed(1)} GB
            </div>

            <div className="text-sm-text-dim">Available</div>
            <div className="font-mono text-sm-ok text-right">
              {mem.available_gb.toFixed(1)} GB
            </div>
          </div>
        </div>

        {/* Swap memory */}
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-sm-text mb-3 border-b border-[#2d3a4f] pb-2">
            Swap Memory
          </h3>

          {/* Usage bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-sm-text-dim mb-1">
              <span>Used</span>
              <span className="font-mono">
                {formatPercent(swapPercent)}
              </span>
            </div>
            <div className="h-3 bg-[#2d3a4f] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  swapPercent < 60
                    ? "bg-sm-ok"
                    : swapPercent < 85
                      ? "bg-sm-warn"
                      : "bg-sm-error"
                }`}
                style={{ width: `${Math.min(swapPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div className="text-sm-text-dim">Total</div>
            <div className="font-mono text-sm-text text-right">
              {mem.swap_total_gb.toFixed(1)} GB
            </div>

            <div className="text-sm-text-dim">Used</div>
            <div className="font-mono text-sm-text text-right">
              {mem.swap_used_gb.toFixed(1)} GB
            </div>

            <div className="text-sm-text-dim">Free</div>
            <div className="font-mono text-sm-ok text-right">
              {(mem.swap_total_gb - mem.swap_used_gb).toFixed(1)} GB
            </div>
          </div>
        </div>
      </div>

      {/* Memory distribution visual */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-sm-text mb-3">
          Memory Distribution
        </h3>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div
            className="bg-sm-error transition-all flex items-center justify-center"
            style={{
              width: `${mem.total_gb > 0 ? (mem.used_gb / mem.total_gb) * 100 : 0}%`,
            }}
            title={`Used: ${mem.used_gb.toFixed(1)} GB`}
          >
            <span className="text-[9px] text-white font-mono truncate px-1">
              Used
            </span>
          </div>
          <div
            className="bg-sm-ok transition-all flex items-center justify-center"
            style={{
              width: `${mem.total_gb > 0 ? (mem.available_gb / mem.total_gb) * 100 : 0}%`,
            }}
            title={`Available: ${mem.available_gb.toFixed(1)} GB`}
          >
            <span className="text-[9px] text-white font-mono truncate px-1">
              Avail
            </span>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-error" />
            <span className="text-sm-text-dim">
              Used ({mem.used_gb.toFixed(1)} GB)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-ok" />
            <span className="text-sm-text-dim">
              Available ({mem.available_gb.toFixed(1)} GB)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
