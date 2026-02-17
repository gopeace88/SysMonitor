"use client";

import DataTable from "@/components/tables/DataTable";
import { useLlmCost, useLlmModels, useLlmRateLimits } from "@/hooks/useMetrics";
import { formatNumber, formatTokens, formatUSD } from "@/lib/format";

export default function ProviderUsageView({ provider }: { provider: "gpt" | "gemini" }) {
  const { data: models } = useLlmModels(provider);
  const { data: cost } = useLlmCost(provider);
  const { data: rateLimits } = useLlmRateLimits(provider);

  const title = provider === "gpt" ? "GPT" : "Gemini";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">{title} Usage</h1>

      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-sm-text-dim">Rate Limits</h2>
          {rateLimits?.plan && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sm-link/20 text-sm-link font-medium">
              {rateLimits.plan}
            </span>
          )}
        </div>

        {rateLimits?.available && (rateLimits.windows?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {(rateLimits.windows ?? []).map((w) => {
              const resetText = w.reset_at ? new Date(w.reset_at).toLocaleString() : "-";
              const used = Math.max(0, Math.min(100, w.used_pct ?? 0));
              return (
                <div key={w.label} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm-text">{w.label}</span>
                    <span className="text-sm-text-dim">남은 {w.remaining_pct}%</span>
                  </div>
                  <div className="w-full h-3 bg-[#2d3a4f] rounded-full overflow-hidden">
                    <div className={`h-full ${used >= 90 ? "bg-sm-error" : used >= 70 ? "bg-sm-warn" : "bg-sm-ok"}`} style={{ width: `${used}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-sm-text-dim">사용 {used}% · 리셋 {resetText}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-sm-text-dim">
            {rateLimits?.available
              ? "현재 활성 세션이 없어 rate-limit 윈도우가 없습니다."
              : "현재 rate-limit 데이터를 불러오지 못했습니다. 잠시 후 새로고침해주세요."}
          </div>
        )}
      </div>

      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-6 text-center">
        <div className="text-xs text-sm-text-dim mb-1">Monthly Cost</div>
        <div className="text-3xl font-bold font-mono text-sm-warn">{cost?.total_cost_usd == null ? "N/A" : formatUSD(cost.total_cost_usd)}</div>
        <div className="text-[10px] text-sm-text-dim mt-1">{cost?.reason ?? "Provider source"}</div>
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
