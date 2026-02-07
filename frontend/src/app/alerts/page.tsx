"use client";

import { useState } from "react";
import { useAlerts, useActiveAlerts, Alert } from "@/hooks/useMetrics";
import { apiPost } from "@/lib/api";
import DataTable from "@/components/tables/DataTable";
import React from "react";

export default function AlertsPage() {
  const [tab, setTab] = useState<"active" | "all">("active");
  const {
    data: activeAlerts,
    isLoading: activeLoading,
    mutate: mutateActive,
  } = useActiveAlerts();
  const {
    data: allAlerts,
    isLoading: allLoading,
    mutate: mutateAll,
  } = useAlerts();

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiPost(`/api/alerts/${alertId}/acknowledge`, {});
      mutateActive();
      mutateAll();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const columns = [
    {
      key: "severity",
      label: "Severity",
      width: "80px",
      format: (value: unknown) => {
        const sev = value as string;
        const colorMap: Record<string, string> = {
          critical: "bg-sm-error",
          warning: "bg-sm-warn",
          info: "bg-sm-link",
        };
        return (
          <span
            className={`inline-block px-2 py-0.5 rounded text-[10px] text-white font-medium uppercase ${colorMap[sev] || "bg-sm-text-dim"}`}
          >
            {sev}
          </span>
        );
      },
    },
    {
      key: "server_name",
      label: "Server",
      format: (value: unknown) => (
        <span className="font-semibold text-sm-text">{value as string}</span>
      ),
    },
    { key: "type", label: "Type" },
    { key: "message", label: "Message" },
    {
      key: "timestamp",
      label: "Time",
      format: (value: unknown) => (
        <span className="font-mono text-sm-text-dim">
          {new Date(value as string).toLocaleString("en-US", {
            hour12: false,
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "acknowledged",
      label: "Status",
      format: (value: unknown, row: Record<string, unknown>) => {
        const acked = value as boolean;
        if (acked) {
          return (
            <span className="text-sm-text-dim text-[10px]">Acknowledged</span>
          );
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAcknowledge(row.id as string);
            }}
            className="bg-sm-link/20 text-sm-link text-[10px] px-2 py-0.5 rounded hover:bg-sm-link/30 transition-colors"
          >
            Acknowledge
          </button>
        );
      },
    },
  ];

  const isLoading = tab === "active" ? activeLoading : allLoading;
  const alerts: Alert[] =
    tab === "active" ? activeAlerts ?? [] : allAlerts ?? [];

  // Sort by severity: critical > warning > info
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const sortedAlerts = [...alerts].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">Alerts</h1>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-error" />
            <span className="font-mono text-sm-error">{criticalCount}</span>
            <span className="text-sm-text-dim">critical</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-warn" />
            <span className="font-mono text-sm-warn">{warningCount}</span>
            <span className="text-sm-text-dim">warning</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sm-link" />
            <span className="font-mono text-sm-link">{infoCount}</span>
            <span className="text-sm-text-dim">info</span>
          </span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-[#2d3a4f]">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === "active"
              ? "border-sm-link text-sm-link"
              : "border-transparent text-sm-text-dim hover:text-sm-text"
          }`}
        >
          Active Alerts
          {activeAlerts && activeAlerts.length > 0 && (
            <span className="ml-2 bg-sm-error/20 text-sm-error text-[10px] font-mono px-1.5 py-0.5 rounded">
              {activeAlerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === "all"
              ? "border-sm-link text-sm-link"
              : "border-transparent text-sm-text-dim hover:text-sm-text"
          }`}
        >
          All Alerts
          {allAlerts && (
            <span className="ml-2 text-sm-text-dim text-[10px] font-mono">
              {allAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm-text-dim text-sm">Loading alerts...</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={sortedAlerts as unknown as Record<string, unknown>[]}
          title={tab === "active" ? "Active Alerts" : "All Alerts"}
          maxHeight="600px"
        />
      )}
    </div>
  );
}
