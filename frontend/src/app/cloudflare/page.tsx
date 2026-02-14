"use client";

import { useState } from "react";
import { useTunnels, useDnsRecords, useWarpDevices } from "@/hooks/useMetrics";
import DataTable from "@/components/tables/DataTable";

export default function CloudflarePage() {
  const { data: tunnels, isLoading: tunnelsLoading } = useTunnels();
  const { data: warpDevices } = useWarpDevices();
  const [dnsZone, setDnsZone] = useState<string>("purions");
  const { data: dnsRecords } = useDnsRecords(dnsZone);
  const [selectedTunnel, setSelectedTunnel] = useState<number>(0);

  const currentTunnel = tunnels?.[selectedTunnel];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">Cloudflare Infrastructure</h1>

      {/* Tunnel Tabs + Detail */}
      <div>
        <h2 className="text-xs font-semibold text-sm-text-dim mb-2">Tunnels</h2>
        {tunnelsLoading ? (
          <div className="text-sm-text-dim text-xs">Loading tunnels...</div>
        ) : (tunnels ?? []).length === 0 ? (
          <div className="text-sm-text-dim text-xs">No tunnels found</div>
        ) : (
          <>
            {/* Tunnel Tabs */}
            <div className="flex gap-1 mb-3">
              {(tunnels ?? []).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTunnel(i)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedTunnel === i
                      ? "bg-sm-link text-white"
                      : "bg-sm-surface text-sm-text-dim hover:text-sm-text border border-[#2d3a4f]"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Selected Tunnel Detail */}
            {currentTunnel && (
              <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-sm-text">{currentTunnel.name}</h3>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      currentTunnel.status === "healthy"
                        ? "bg-sm-ok/20 text-sm-ok"
                        : currentTunnel.status === "inactive"
                          ? "bg-sm-text-dim/20 text-sm-text-dim"
                          : "bg-sm-warn/20 text-sm-warn"
                    }`}
                  >
                    {currentTunnel.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-sm-text-dim mb-0.5">Tunnel ID</div>
                    <div className="text-sm font-mono text-sm-text">{currentTunnel.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-sm-text-dim mb-0.5">Connections</div>
                    <div className="text-sm font-mono text-sm-text">{currentTunnel.connections}</div>
                  </div>
                </div>

                {currentTunnel.ingress && currentTunnel.ingress.length > 0 && (
                  <div>
                    <div className="text-xs text-sm-text-dim mb-2">Ingress Rules</div>
                    <div className="space-y-1.5">
                      {currentTunnel.ingress.map((ing, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-[#1a1a2e] rounded px-3 py-2"
                        >
                          <span className="text-sm font-mono text-sm-link flex-1 truncate">
                            {ing.hostname}
                          </span>
                          <span className="text-sm-text-dim text-xs">→</span>
                          <span className="text-sm font-mono text-sm-text flex-1 truncate text-right">
                            {ing.service}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* DNS Records */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xs font-semibold text-sm-text-dim">DNS Records</h2>
          <div className="flex gap-1">
            {["purions", "rtk"].map((zone) => (
              <button
                key={zone}
                onClick={() => setDnsZone(zone)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  dnsZone === zone
                    ? "bg-sm-link text-white"
                    : "bg-sm-surface text-sm-text-dim hover:text-sm-text border border-[#2d3a4f]"
                }`}
              >
                {zone}.com
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={[
            { key: "type", label: "Type", width: "60px" },
            { key: "name", label: "Name" },
            { key: "content", label: "Content" },
            {
              key: "proxied",
              label: "Proxied",
              width: "70px",
              align: "center",
              format: (v) => (
                <span className={v ? "text-sm-ok" : "text-sm-text-dim"}>
                  {v ? "Yes" : "No"}
                </span>
              ),
            },
          ]}
          data={(dnsRecords ?? []) as unknown as Record<string, unknown>[]}
          maxHeight="400px"
        />
      </div>

      {/* WARP Devices */}
      <div>
        <h2 className="text-xs font-semibold text-sm-text-dim mb-2">WARP Devices</h2>
        <DataTable
          columns={[
            { key: "name", label: "Device" },
            { key: "type", label: "Type" },
            { key: "version", label: "Version" },
            { key: "ip", label: "IP" },
            {
              key: "last_seen",
              label: "Last Seen",
              format: (v) => {
                if (!v) return "-";
                return new Date(v as string).toLocaleString("en-US", {
                  hour12: false,
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              },
            },
          ]}
          data={(warpDevices ?? []) as unknown as Record<string, unknown>[]}
          maxHeight="300px"
        />
      </div>
    </div>
  );
}
