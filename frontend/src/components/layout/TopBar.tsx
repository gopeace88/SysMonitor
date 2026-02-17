"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function TopBar() {
  const { logout } = useAuth();
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

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-[#16213e] border-b border-[#2d3a4f] flex items-center justify-between px-4 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-sm-link tracking-wide">
          SysMonitor
        </span>
        <span className="text-[10px] text-sm-text-dim border border-sm-text-dim/30 rounded px-1.5 py-0.5">
          v2.0
        </span>
        <span className="text-[10px] text-sm-text-dim">
          Cloudflare & Claude & GPT/Gemini Dashboard
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-sm-text-dim">{currentTime}</span>

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
