"use client";

import { useClaudeCost } from "@/hooks/useMetrics";
import { formatUSD, formatModelName } from "@/lib/format";
import PieChart from "@/components/charts/PieChart";
import DataTable from "@/components/tables/DataTable";

export default function ClaudeCostPage() {
  const { data: costData } = useClaudeCost();

  const totalCost = costData?.total_cost_usd ?? 0;
  const models = costData?.models ?? [];

  const pieData = models.map((m) => ({
    name: formatModelName(m.model),
    value: m.total_cost,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">Claude Cost Analysis</h1>

      {/* Total Cost Card */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-6 text-center">
        <div className="text-xs text-sm-text-dim mb-1">Estimated Total Cost</div>
        <div className="text-3xl font-bold font-mono text-sm-warn">
          {formatUSD(totalCost)}
        </div>
        <div className="text-[10px] text-sm-text-dim mt-1">
          Based on Anthropic API pricing (input/output/cache)
        </div>
      </div>

      {/* Cost Pie + Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PieChart
          data={pieData}
          title="Cost Distribution by Model"
          height={280}
          formatter={(v) => formatUSD(v)}
        />

        <DataTable
          title="Cost Breakdown by Model"
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
              key: "input_cost",
              label: "Input",
              align: "right",
              format: (v) => formatUSD(v as number),
            },
            {
              key: "output_cost",
              label: "Output",
              align: "right",
              format: (v) => formatUSD(v as number),
            },
            {
              key: "cache_read_cost",
              label: "Cache Read",
              align: "right",
              format: (v) => formatUSD(v as number),
            },
            {
              key: "cache_create_cost",
              label: "Cache Create",
              align: "right",
              format: (v) => formatUSD(v as number),
            },
            {
              key: "total_cost",
              label: "Total",
              align: "right",
              format: (v) => (
                <span className="text-sm-warn font-bold font-mono">
                  {formatUSD(v as number)}
                </span>
              ),
            },
          ]}
          data={models as unknown as Record<string, unknown>[]}
          maxHeight="400px"
        />
      </div>

      {/* Pricing Reference */}
      <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-3">
        <h3 className="text-xs font-medium text-sm-text mb-2">Pricing Reference (per 1M tokens)</h3>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="text-sm-text-dim">
            <span className="text-sm-link font-medium">Opus 4.5/4.6</span>
            <br />Input: $15 / Output: $75
          </div>
          <div className="text-sm-text-dim">
            <span className="text-sm-link font-medium">Sonnet 4.5</span>
            <br />Input: $3 / Output: $15
          </div>
          <div className="text-sm-text-dim">
            <span className="text-sm-link font-medium">Cache</span>
            <br />Read: 90% off / Create: 25% premium
          </div>
        </div>
      </div>
    </div>
  );
}
