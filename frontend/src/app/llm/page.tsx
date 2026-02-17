"use client";

import Link from "next/link";
import { useLlmSummary } from "@/hooks/useMetrics";
import { formatTokens, formatNumber } from "@/lib/format";

function ProviderCard({
  title,
  href,
  data,
}: {
  title: string;
  href: string;
  data?: {
    session_count: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}) {
  return (
    <Link href={href} className="block bg-sm-surface border border-[#2d3a4f] rounded-lg p-4 hover:border-sm-link transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-sm-text-dim">{title}</div>
        <div className="text-[10px] text-sm-link">View details →</div>
      </div>
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
    </Link>
  );
}

export default function LlmUsagePage() {
  const { data: summary } = useLlmSummary();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-sm-text">GPT & Gemini Usage</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProviderCard title="GPT (OpenAI/Codex)" href="/llm/gpt" data={summary?.gpt} />
        <ProviderCard title="Gemini" href="/llm/gemini" data={summary?.gemini} />
      </div>
    </div>
  );
}
