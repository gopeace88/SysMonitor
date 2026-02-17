"use client";

import ProviderUsageView from "@/app/llm/ProviderUsageView";
import { useLlmSummary } from "@/hooks/useMetrics";
import { formatTokens, formatNumber } from "@/lib/format";

function SummaryCard({
  title,
  data,
}: {
  title: string;
  data?: {
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
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

export default function GptUsagePage() {
  const { data: summary } = useLlmSummary();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-sm-text-dim uppercase tracking-wide">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SummaryCard title="GPT (OpenAI/Codex)" data={summary?.gpt} />
          <SummaryCard title="Gemini (Google)" data={summary?.gemini} />
        </div>
      </div>

      <ProviderUsageView provider="gpt" />
    </div>
  );
}
