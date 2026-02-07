"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useServerStore } from "@/stores/serverStore";
import { useServers } from "@/hooks/useMetrics";

const tabs = [
  { label: "Overview", href: "/system" },
  { label: "CPU", href: "/system/cpu" },
  { label: "Memory", href: "/system/memory" },
  { label: "Disks", href: "/system/disks" },
  { label: "Docker", href: "/system/docker" },
];

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: servers } = useServers();
  const { selectedServer, setServer } = useServerStore();

  const isActiveTab = (href: string) => {
    if (href === "/system") return pathname === "/system";
    return pathname.startsWith(href);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-sm-text">System</h1>
        <div className="flex items-center gap-3">
          <label className="text-xs text-sm-text-dim">Server:</label>
          <select
            value={selectedServer}
            onChange={(e) => setServer(e.target.value)}
            className="bg-sm-surface text-sm-text text-xs border border-[#2d3a4f] rounded px-2 py-1 outline-none focus:border-sm-link"
          >
            <option value="">Select server</option>
            {servers?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-[#2d3a4f]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
              isActiveTab(tab.href)
                ? "border-sm-link text-sm-link"
                : "border-transparent text-sm-text-dim hover:text-sm-text hover:border-sm-text-dim/30"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
