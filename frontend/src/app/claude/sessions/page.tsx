"use client";

import { useClaudeSessions } from "@/hooks/useMetrics";
import DataTable from "@/components/tables/DataTable";

export default function ClaudeSessionsPage() {
  const { data: sessions } = useClaudeSessions();

  const formatTimestamp = (ts: unknown) => {
    if (!ts || ts === 0) return "-";
    const date = new Date(ts as number);
    return date.toLocaleString("en-US", {
      hour12: false,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatProject = (v: unknown) => {
    const project = v as string;
    if (!project) return "-";
    // Show last 2 path segments for readability
    const parts = project.split("/").filter(Boolean);
    return parts.slice(-2).join("/") || project;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-sm-text">Claude Sessions</h1>
        <span className="text-xs text-sm-text-dim">
          {(sessions ?? []).length} sessions
        </span>
      </div>

      <DataTable
        columns={[
          {
            key: "project",
            label: "Project",
            format: (v) => (
              <span className="font-mono text-sm-link">{formatProject(v)}</span>
            ),
          },
          {
            key: "first_display",
            label: "First Message",
            format: (v) => (
              <span className="text-sm-text truncate max-w-[200px] inline-block" title={v as string}>
                {(v as string) || "-"}
              </span>
            ),
          },
          {
            key: "message_count",
            label: "Messages",
            align: "right",
            format: (v) => (
              <span className="font-mono">{(v as number).toLocaleString()}</span>
            ),
          },
          {
            key: "first_message",
            label: "Started",
            format: formatTimestamp,
          },
          {
            key: "last_message",
            label: "Last Activity",
            format: formatTimestamp,
          },
          {
            key: "session_id",
            label: "Session ID",
            format: (v) => (
              <span className="font-mono text-sm-text-dim">
                {(v as string).slice(0, 8)}...
              </span>
            ),
          },
        ]}
        data={(sessions ?? []) as unknown as Record<string, unknown>[]}
        maxHeight="calc(100vh - 180px)"
      />
    </div>
  );
}
