"use client";

import { useClaudeDailyModels, useClaudeModelUsage } from "@/hooks/useMetrics";
import { formatTokens, formatModelName, formatUSD } from "@/lib/format";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import DataTable from "@/components/tables/DataTable";

export default function ClaudeUsagePage() {
  const { data: dailyModels } = useClaudeDailyModels();
  const { data: modelUsage } = useClaudeModelUsage();

  // Get all unique models, sorted by priority
  const MODEL_ORDER = ["opus-4-6", "sonnet-4-6", "haiku-4-5", "opus-4-5", "sonnet-4-5"];
  const sortModels = (a: string, b: string) => {
    const ai = MODEL_ORDER.findIndex((p) => a.includes(p));
    const bi = MODEL_ORDER.findIndex((p) => b.includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  };
  const allModels = new Set<string>();
  (dailyModels ?? []).forEach((d) => {
    Object.keys(d.tokensByModel).forEach((m) => allModels.add(m));
  });
  const models = Array.from(allModels).sort(sortModels);
  const sortedModelUsage = [...(modelUsage ?? [])].sort((a, b) => sortModels(a.model, b.model));

  // Build per-model daily time series
  const modelColors: Record<string, string> = {};
  const colorPalette = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
  models.forEach((m, i) => {
    modelColors[m] = colorPalette[i % colorPalette.length];
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">Claude Usage Details</h1>

      {/* Per-model daily charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map((model) => {
          const chartData = (dailyModels ?? []).map((d) => ({
            timestamp: d.date,
            value: d.tokensByModel[model] ?? 0,
          }));
          return (
            <TimeSeriesChart
              key={model}
              data={chartData}
              title={`${formatModelName(model)} - Daily Output Tokens`}
              color={modelColors[model]}
              height={200}
              yAxisFormat={(v) => formatTokens(v)}
            />
          );
        })}
      </div>

      {/* Model Detail Table */}
      <DataTable
        title="Model Usage Breakdown"
        columns={[
          {
            key: "model",
            label: "Model",
            format: (v) => (
              <span className="font-medium text-sm-link">
                {formatModelName(v as string)}
              </span>
            ),
          },
          {
            key: "input_tokens",
            label: "Input",
            align: "right",
            format: (v) => formatTokens(v as number),
          },
          {
            key: "output_tokens",
            label: "Output",
            align: "right",
            format: (v) => formatTokens(v as number),
          },
          {
            key: "cache_read_tokens",
            label: "Cache Read",
            align: "right",
            format: (v) => formatTokens(v as number),
          },
          {
            key: "cache_create_tokens",
            label: "Cache Create",
            align: "right",
            format: (v) => formatTokens(v as number),
          },
          {
            key: "cost_usd",
            label: "Cost",
            align: "right",
            format: (v) => (
              <span className="text-sm-warn font-mono">{formatUSD(v as number)}</span>
            ),
          },
        ]}
        data={sortedModelUsage as unknown as Record<string, unknown>[]}
        maxHeight="400px"
      />
    </div>
  );
}
