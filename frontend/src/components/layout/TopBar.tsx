"use client";

import { useState, useEffect } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useServers, useActiveAlerts } from "@/hooks/useMetrics";
import { useAuth } from "@/hooks/useAuth";

export default function TopBar() {
  const { data: servers } = useServers();
  const { data: activeAlerts } = useActiveAlerts();
  const { logout } = useAuth();
  const { selectedServer, setServer } = useServerStore();
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleString("en-US", {
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const alertCount = activeAlerts?.length ?? 0;

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-[#16213e] border-b border-[#2d3a4f] flex items-center justify-between px-4 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-sm-link tracking-wide">
          SysMonitor
        </span>
        <span className="text-[10px] text-sm-text-dim border border-sm-text-dim/30 rounded px-1.5 py-0.5">
          v1.0
        </span>
      </div>

      {/* Server selector */}
      <div className="flex items-center gap-4">
        <label className="text-xs text-sm-text-dim">Server:</label>
        <select
          value={selectedServer}
          onChange={(e) => setServer(e.target.value)}
          className="bg-sm-surface text-sm-text text-xs border border-[#2d3a4f] rounded px-2 py-1 outline-none focus:border-sm-link"
        >
          <option value="">All Servers</option>
          {servers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.ip})
            </option>
          ))}
        </select>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Time */}
        <span className="font-mono text-xs text-sm-text-dim">{currentTime}</span>

        {/* Alert bell */}
        <button className="relative text-sm-text hover:text-sm-warn transition-colors">
          <span className="text-lg" role="img" aria-label="alerts">
            &#x1F514;
          </span>
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-sm-error text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </button>

        {/* User */}
        <button
          onClick={logout}
          className="text-sm-text-dim hover:text-sm-text transition-colors text-xs flex items-center gap-1"
          title="Logout"
        >
          <span className="text-base">&#x1F464;</span>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
