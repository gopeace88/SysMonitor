"use client";

import DataTable from "@/components/tables/DataTable";
import { useLlmCost, useLlmModels } from "@/hooks/useMetrics";
import { formatNumber, formatTokens, formatUSD } from "@/lib/format";

export default function ProviderUsageView({ provider }: { provider: "gpt" | "gemini" }) {
  const { data: models } = useLlmModels(provider);
  const { data: cost } = useLlmCost(provider);

  const title = provider === "gpt" ? "GPT" : "Gemini";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">{title} Usage</h1>

      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-6 text-center">
        <div className="text-xs text-sm-text-dim mb-1">Estimated Total Cost</div>
        <div className="text-3xl font-bold font-mono text-sm-warn">{formatUSD(cost?.total_cost_usd ?? 0)}</div>
        <div className="text-[10px] text-sm-text-dim mt-1">Estimated from model token usage</div>
      </div>

      <DataTable
        title={`${title} Model Usage`}
        columns={[
          { key: "model", label: "Model" },
          {
            key: "session_count",
            label: "Sessions",
            align: "right",
            format: (v: unknown) => formatNumber((v as number) ?? 0),
          },
          {
            key: "input_tokens",
            label: "Input",
            align: "right",
            format: (v: unknown) => formatTokens((v as number) ?? 0),
          },
          {
            key: "output_tokens",
            label: "Output",
            align: "right",
            format: (v: unknown) => formatTokens((v as number) ?? 0),
          },
          {
            key: "total_tokens",
            label: "Total",
            align: "right",
            format: (v: unknown) => formatTokens((v as number) ?? 0),
          },
        ]}
        data={(models ?? []) as unknown as Record<string, unknown>[]}
        maxHeight="360px"
      />

      <DataTable
        title={`${title} Cost Breakdown`}
        columns={[
          { key: "model", label: "Model" },
          {
            key: "input_cost",
            label: "Input",
            align: "right",
            format: (v: unknown) => formatUSD((v as number) ?? 0),
          },
          {
            key: "output_cost",
            label: "Output",
            align: "right",
            format: (v: unknown) => formatUSD((v as number) ?? 0),
          },
          {
            key: "total_cost",
            label: "Total",
            align: "right",
            format: (v: unknown) => <span className="font-mono text-sm-warn">{formatUSD((v as number) ?? 0)}</span>,
          },
        ]}
        data={((cost?.models ?? []) as unknown) as Record<string, unknown>[]}
        maxHeight="360px"
      />
    </div>
  );
}
