"use client";

import { useServerStore } from "@/stores/serverStore";
import { useServerDocker, useServers } from "@/hooks/useMetrics";
import DataTable from "@/components/tables/DataTable";
import React from "react";

export default function DockerPage() {
  const { selectedServer } = useServerStore();
  const { data: servers } = useServers();
  const serverId = selectedServer || servers?.[0]?.id || null;
  const { data: dockerData, isLoading } = useServerDocker(serverId);

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
        <div className="text-sm-text-dim text-sm">Loading Docker data...</div>
      </div>
    );
  }

  if (!dockerData || !dockerData.containers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm-text-dim text-sm">
          No Docker data available.
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      format: (value: unknown) => (
        <span className="font-semibold text-sm-text">{value as string}</span>
      ),
    },
    {
      key: "image",
      label: "Image",
      format: (value: unknown) => (
        <span className="text-sm-text-dim">{value as string}</span>
      ),
    },
    {
      key: "state",
      label: "Status",
      format: (value: unknown) => {
        const state = value as string;
        const color =
          state === "running"
            ? "text-sm-ok"
            : state === "exited"
              ? "text-sm-error"
              : "text-sm-warn";
        return <span className={`font-semibold ${color}`}>{state}</span>;
      },
    },
    {
      key: "ports",
      label: "Ports",
      format: (value: unknown) => (
        <span className="font-mono text-sm-text-dim text-[10px]">
          {(value as string) || "-"}
        </span>
      ),
    },
  ];

  const running = dockerData.containers.filter(
    (c) => c.state === "running"
  ).length;
  const total = dockerData.containers.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4">
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg px-4 py-2">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Total Containers
          </div>
          <div className="font-mono text-lg font-semibold text-sm-text">
            {total}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg px-4 py-2">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Running
          </div>
          <div className="font-mono text-lg font-semibold text-sm-ok">
            {running}
          </div>
        </div>
        <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg px-4 py-2">
          <div className="text-[10px] text-sm-text-dim uppercase tracking-wider">
            Stopped
          </div>
          <div className="font-mono text-lg font-semibold text-sm-error">
            {total - running}
          </div>
        </div>
      </div>

      {/* Containers table */}
      <DataTable
        columns={columns}
        data={
          dockerData.containers as unknown as Record<string, unknown>[]
        }
        title="Docker Containers"
        maxHeight="500px"
      />
    </div>
  );
}
