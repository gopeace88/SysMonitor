"use client";

import {
  useClaudeSummary,
  useClaudeDailyActivity,
  useClaudeModelUsage,
  useClaudeHours,
  useClaudeRateLimits,
} from "@/hooks/useMetrics";
import { formatUSD, formatTokens, formatModelName } from "@/lib/format";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import PieChart from "@/components/charts/PieChart";

function UsageBar({ label, usedPct, resetAt }: { label: string; usedPct: number; resetAt?: string | null }) {
  const remaining = 100 - usedPct;
  const barColor =
    usedPct >= 90 ? "bg-sm-error" : usedPct >= 70 ? "bg-sm-warn" : "bg-sm-ok";
  const resetTime = resetAt
    ? new Date(resetAt).toLocaleString("en-US", {
        hour12: false,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-sm-text">{label}</span>
        <span className="text-xs font-mono text-sm-text-dim">
          {remaining}% remaining
        </span>
      </div>
      <div className="w-full h-4 bg-[#2d3a4f] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-sm-text-dim">
          Used: <span className="font-mono font-bold text-sm-text">{usedPct}%</span>
        </span>
        {resetTime && (
          <span className="text-[10px] text-sm-text-dim">
            Resets: {resetTime}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClaudeOverviewPage() {
  const { data: summary } = useClaudeSummary();
  const { data: dailyActivity } = useClaudeDailyActivity();
  const { data: modelUsage } = useClaudeModelUsage();
  const { data: hourCounts } = useClaudeHours();
  const { data: rateLimits } = useClaudeRateLimits();

  const summaryCards = [
    {
      label: "Total Sessions",
      value: summary?.total_sessions?.toLocaleString() ?? "0",
      color: "text-sm-link",
    },
    {
      label: "Total Messages",
      value: summary?.total_messages?.toLocaleString() ?? "0",
      color: "text-sm-ok",
    },
    {
      label: "Models Used",
      value: summary?.model_count?.toString() ?? "0",
      color: "text-sm-warn",
    },
    {
      label: "Est. Total Cost",
      value: formatUSD(summary?.total_cost_usd ?? 0),
      color: "text-sm-error",
    },
  ];

  const dailyChartData = (dailyActivity ?? []).map((d) => ({
    timestamp: d.date,
    value: d.messageCount,
  }));

  const pieData = (modelUsage ?? []).map((m) => ({
    name: formatModelName(m.model),
    value: m.total_tokens,
  }));

  const hourData = Object.entries(hourCounts ?? {})
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count: count as number,
    }))
    .sort((a, b) => a.hour - b.hour);

  const maxHourCount = Math.max(...hourData.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">Claude Code Overview</h1>

      {/* Rate Limits */}
      {rateLimits?.available && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-semibold text-sm-text-dim">Rate Limits</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sm-link/20 text-sm-link font-medium">
              {rateLimits.plan}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UsageBar
              label="5-Hour Window"
              usedPct={rateLimits.five_hour?.used_pct ?? 0}
              resetAt={rateLimits.five_hour?.reset_at}
            />
            <UsageBar
              label="7-Day Window"
              usedPct={rateLimits.seven_day?.used_pct ?? 0}
              resetAt={rateLimits.seven_day?.reset_at}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4"
          >
            <div className="text-[10px] text-sm-text-dim mb-1">{card.label}</div>
            <div className={`text-xl font-bold font-mono ${card.color}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TimeSeriesChart
          data={dailyChartData}
          title="Daily Messages"
          color="#3b82f6"
          height={250}
        />
        <PieChart
          data={pieData}
          title="Token Distribution by Model"
          height={250}
          formatter={(v) => formatTokens(v)}
        />
      </div>

      {/* Hour Heatmap */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
        <h3 className="text-xs font-medium text-sm-text mb-3">Session Activity by Hour (UTC)</h3>
        <div className="flex gap-1 items-end h-24">
          {Array.from({ length: 24 }, (_, h) => {
            const entry = hourData.find((d) => d.hour === h);
            const count = entry?.count ?? 0;
            const heightPct = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(heightPct, 2)}%`,
                    backgroundColor:
                      count === 0
                        ? "#2d3a4f"
                        : heightPct > 60
                          ? "#22c55e"
                          : heightPct > 30
                            ? "#3b82f6"
                            : "#475569",
                  }}
                  title={`${h}:00 - ${count} sessions`}
                />
                <span className="text-[8px] text-sm-text-dim">{h}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meta Info */}
      {summary?.first_session_date && (
        <div className="text-[10px] text-sm-text-dim">
          Data since {new Date(summary.first_session_date).toLocaleDateString()}{" "}
          &middot; Last computed: {summary.last_computed_date}
        </div>
      )}
    </div>
  );
}
