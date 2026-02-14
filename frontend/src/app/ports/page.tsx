"use client";

import { useState, useMemo } from "react";
import {
  usePortStatus,
  usePortRanges,
  PortEntry,
} from "@/hooks/useMetrics";
import DataTable from "@/components/tables/DataTable";

type StatusFilter = "all" | "active" | "inactive" | "configured" | "unregistered" | "conflict";

const statusColors: Record<string, string> = {
  active: "bg-sm-ok/20 text-sm-ok",
  inactive: "bg-sm-text-dim/20 text-sm-text-dim",
  configured: "bg-sm-link/20 text-sm-link",
  unregistered: "bg-sm-warn/20 text-sm-warn",
  conflict: "bg-sm-error/20 text-sm-error",
};

export default function PortsPage() {
  const { data: status, mutate } = usePortStatus();
  const { data: rangesData } = usePortRanges();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const ports = status?.ports ?? [];
  const summary = status?.summary;

  const filteredPorts = useMemo(() => {
    if (filter === "all") return ports;
    return ports.filter((p: PortEntry) => p.status === filter);
  }, [ports, filter]);

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: ports.length,
      active: 0,
      inactive: 0,
      configured: 0,
      unregistered: 0,
      conflict: 0,
    };
    for (const p of ports) {
      if (p.status in counts) {
        counts[p.status as StatusFilter]++;
      }
    }
    return counts;
  }, [ports]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "configured", label: "Configured" },
    { key: "unregistered", label: "Unregistered" },
    { key: "conflict", label: "Conflict" },
  ];

  // Build a set of active port numbers for range visualization
  const activePortSet = useMemo(() => {
    const set = new Set<number>();
    for (const p of ports) {
      if (p.status === "active") set.add(p.port);
    }
    return set;
  }, [ports]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-sm-text">Port Management</h1>
        <div className="flex items-center gap-3">
          {status && (
            <span className="text-[10px] text-sm-text-dim">
              Scanned: {new Date(status.scanned_at).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="text-[10px] px-2 py-1 rounded bg-sm-surface border border-[#2d3a4f] text-sm-text-dim hover:text-sm-text transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
            <div className="text-[10px] text-sm-text-dim mb-1">Registered</div>
            <div className="text-xl font-bold text-sm-text">{summary.registered}</div>
          </div>
          <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
            <div className="text-[10px] text-sm-text-dim mb-1">Active</div>
            <div className="text-xl font-bold text-sm-ok">{summary.active}</div>
          </div>
          <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
            <div className="text-[10px] text-sm-text-dim mb-1">Unregistered</div>
            <div className="text-xl font-bold text-sm-warn">{summary.unregistered}</div>
          </div>
          <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
            <div className="text-[10px] text-sm-text-dim mb-1">Conflicts</div>
            <div className="text-xl font-bold text-sm-error">{summary.conflict}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs + Port Table */}
      <div>
        <div className="flex gap-1 mb-3">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded font-medium transition-colors ${
                filter === f.key
                  ? "bg-sm-link text-white"
                  : "bg-sm-surface text-sm-text-dim hover:text-sm-text border border-[#2d3a4f]"
              }`}
            >
              {f.label} ({filterCounts[f.key]})
            </button>
          ))}
        </div>

        <DataTable
          columns={[
            {
              key: "port",
              label: "Port",
              width: "70px",
              align: "right",
            },
            {
              key: "status",
              label: "Status",
              width: "100px",
              format: (v) => (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    statusColors[v as string] ?? "text-sm-text-dim"
                  }`}
                >
                  {v as string}
                </span>
              ),
            },
            { key: "name", label: "Name" },
            { key: "project", label: "Project" },
            { key: "category", label: "Category", width: "100px" },
            { key: "process", label: "Process", width: "110px" },
            {
              key: "sources",
              label: "Source",
              format: (v) => {
                const arr = v as string[];
                return Array.isArray(arr) ? arr.join(", ") : String(v ?? "-");
              },
            },
          ]}
          data={filteredPorts as unknown as Record<string, unknown>[]}
          maxHeight="500px"
        />
      </div>

      {/* Range Visualization */}
      {rangesData && rangesData.ranges.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-sm-text-dim mb-2">Port Ranges</h2>
          <div className="space-y-2">
            {rangesData.ranges.map((range) => (
              <div
                key={range.category}
                className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-sm-text">
                    {range.category}
                  </span>
                  <span className="text-[10px] text-sm-text-dim">
                    {range.active}/{range.registered} active
                  </span>
                </div>
                <div className="relative h-4 bg-[#1a1a2e] rounded">
                  {range.ports.map((port) => {
                    const pct =
                      ((port - range.start) / (range.end - range.start)) * 100;
                    const isActive = activePortSet.has(port);
                    return (
                      <div
                        key={port}
                        className={`absolute top-1 w-2 h-2 rounded-full ${
                          isActive ? "bg-sm-ok" : "bg-sm-text-dim"
                        }`}
                        style={{ left: `${pct}%` }}
                        title={`Port ${port}${isActive ? " (active)" : ""}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-sm-text-dim">{range.start}</span>
                  <span className="text-[10px] text-sm-text-dim">{range.end}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
