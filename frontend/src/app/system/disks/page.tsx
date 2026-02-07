"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServerDisk, useServers } from "@/hooks/useMetrics";
import BarChart from "@/components/charts/BarChart";
import DataTable from "@/components/tables/DataTable";
import { formatBytes, formatPercent } from "@/lib/format";
import React from "react";

export default function DisksPage() {
  const { selectedServer } = useServerStore();
  const { data: servers } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: diskData, isLoading } = useServerDisk(serverId);

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
        <div className="text-sm-text-dim text-sm">Loading disk data...</div>
      </div>
    );
  }

  if (!diskData || !diskData.disks) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">No disk data available.</div>
      </div>
    );
  }

  const barData = diskData.disks.map((d) => ({
    label: d.mount,
    value: d.used,
    max: d.total,
  }));

  const diskColumns = [
    { key: "mount", label: "Mount Point" },
    { key: "device", label: "Device" },
    { key: "fstype", label: "FS Type" },
    {
      key: "total",
      label: "Total",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono">{formatBytes(value as number)}</span>
      ),
    },
    {
      key: "used",
      label: "Used",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono">{formatBytes(value as number)}</span>
      ),
    },
    {
      key: "free",
      label: "Free",
      align: "right" as const,
      format: (value: unknown) => (
        <span className="font-mono">{formatBytes(value as number)}</span>
      ),
    },
    {
      key: "percent",
      label: "Usage",
      align: "right" as const,
      format: (value: unknown) => {
        const pct = value as number;
        const color =
          pct < 60
            ? "text-sm-ok"
            : pct < 85
              ? "text-sm-warn"
              : "text-sm-error";
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 bg-[#2d3a4f] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  pct < 60
                    ? "bg-sm-ok"
                    : pct < 85
                      ? "bg-sm-warn"
                      : "bg-sm-error"
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`font-mono ${color}`}>{formatPercent(pct)}</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <BarChart
        data={barData}
        title="Disk Usage by Mount Point"
        height={Math.max(120, barData.length * 40 + 50)}
      />

      {/* Disk details table */}
      <DataTable
        columns={diskColumns}
        data={diskData.disks as unknown as Record<string, unknown>[]}
        title="Disk Details"
        maxHeight="400px"
      />

      {/* Disk cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {diskData.disks.map((disk) => {
          const pct = disk.percent;
          const color =
            pct < 60
              ? "text-sm-ok"
              : pct < 85
                ? "text-sm-warn"
                : "text-sm-error";
          const barColor =
            pct < 60
              ? "bg-sm-ok"
              : pct < 85
                ? "bg-sm-warn"
                : "bg-sm-error";

          return (
            <div
              key={disk.mount}
              className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-sm-text truncate">
                  {disk.mount}
                </span>
                <span className={`font-mono text-xs font-semibold ${color}`}>
                  {formatPercent(pct)}
                </span>
              </div>
              <div className="h-2 bg-[#2d3a4f] rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-sm-text-dim">
                <span>
                  {formatBytes(disk.used)} / {formatBytes(disk.total)}
                </span>
                <span>{formatBytes(disk.free)} free</span>
              </div>
              <div className="text-[10px] text-sm-text-dim mt-1">
                {disk.device} &middot; {disk.fstype}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
