"use client";

import { formatPercent, formatDuration } from "@/lib/format";
import type { Server } from "@/hooks/useMetrics";

interface ServerCardProps {
  server: Server;
  onClick?: () => void;
}

export default function ServerCard({ server, onClick }: ServerCardProps) {
  const isUp = server.status === "up";
  const statusColor = isUp ? "bg-sm-ok" : "bg-sm-error";

  const cpuColor =
    server.cpu_percent < 60
      ? "text-sm-ok"
      : server.cpu_percent < 85
        ? "text-sm-warn"
        : "text-sm-error";

  const memColor =
    server.mem_percent < 60
      ? "text-sm-ok"
      : server.mem_percent < 85
        ? "text-sm-warn"
        : "text-sm-error";

  return (
    <div
      onClick={onClick}
      className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3 hover:bg-sm-surface-hover transition-colors cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${statusColor} ${
              isUp ? "animate-pulse" : ""
            }`}
          />
          <span className="text-sm font-semibold text-sm-text">
            {server.name}
          </span>
        </div>
        <span className="font-mono text-[10px] text-sm-text-dim">
          {server.ip}
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        {/* CPU */}
        <div>
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            CPU
          </div>
          <div className={`font-mono text-sm font-semibold ${cpuColor}`}>
            {formatPercent(server.cpu_percent)}
          </div>
          <div className="mt-1 h-1 bg-[#2d3a4f] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                server.cpu_percent < 60
                  ? "bg-sm-ok"
                  : server.cpu_percent < 85
                    ? "bg-sm-warn"
                    : "bg-sm-error"
              }`}
              style={{ width: `${Math.min(server.cpu_percent, 100)}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            MEM
          </div>
          <div className={`font-mono text-sm font-semibold ${memColor}`}>
            {formatPercent(server.mem_percent)}
          </div>
          <div className="mt-1 h-1 bg-[#2d3a4f] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                server.mem_percent < 60
                  ? "bg-sm-ok"
                  : server.mem_percent < 85
                    ? "bg-sm-warn"
                    : "bg-sm-error"
              }`}
              style={{ width: `${Math.min(server.mem_percent, 100)}%` }}
            />
          </div>
        </div>

        {/* Uptime */}
        <div>
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Uptime
          </div>
          <div className="font-mono text-sm font-semibold text-sm-text">
            {formatDuration(server.uptime_seconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
