"use client";

import { useLlmSummary, useLlmModels } from "@/hooks/useMetrics";
import { formatTokens, formatNumber } from "@/lib/format";
import DataTable from "@/components/tables/DataTable";

function ProviderCard({
  title,
  data,
}: {
  title: string;
  data?: {
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    last_updated_at: number | null;
  };
}) {
  return (
    <div className="bg-sm-surface border border-[#2d3a4f] rounded-lg p-4">
      <div className="text-xs text-sm-text-dim mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-sm-text-dim">Sessions</div>
          <div className="font-mono text-sm-text">{formatNumber(data?.session_count ?? 0)}</div>
        </div>
        <div>
          <div className="text-sm-text-dim">Total Tokens</div>
          <div className="font-mono text-sm-text">{formatTokens(data?.total_tokens ?? 0)}</div>
        </div>
        <div>
          <div className="text-sm-text-dim">Input</div>
          <div className="font-mono text-sm-text">{formatTokens(data?.input_tokens ?? 0)}</div>
        </div>
        <div>
          <div className="text-sm-text-dim">Output</div>
          <div className="font-mono text-sm-text">{formatTokens(data?.output_tokens ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}

export default function LlmUsagePage() {
  const { data: summary } = useLlmSummary();
  const { data: gptModels } = useLlmModels("gpt");
  const { data: geminiModels } = useLlmModels("gemini");

  const columns = [
    { key: "model", label: "Model" },
    {
      key: "session_count",
      label: "Sessions",
      align: "right" as const,
      format: (v: unknown) => formatNumber((v as number) ?? 0),
    },
    {
      key: "input_tokens",
      label: "Input",
      align: "right" as const,
      format: (v: unknown) => formatTokens((v as number) ?? 0),
    },
    {
      key: "output_tokens",
      label: "Output",
      align: "right" as const,
      format: (v: unknown) => formatTokens((v as number) ?? 0),
    },
    {
      key: "total_tokens",
      label: "Total",
      align: "right" as const,
      format: (v: unknown) => formatTokens((v as number) ?? 0),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">GPT & Gemini Usage</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProviderCard title="GPT (OpenAI/Codex)" data={summary?.gpt} />
        <ProviderCard title="Gemini" data={summary?.gemini} />
      </div>

      <DataTable
        title="GPT Models"
        columns={columns}
        data={(gptModels ?? []) as unknown as Record<string, unknown>[]}
        maxHeight="320px"
      />

      <DataTable
        title="Gemini Models"
        columns={columns}
        data={(geminiModels ?? []) as unknown as Record<string, unknown>[]}
        maxHeight="320px"
      />
    </div>
  );
}
