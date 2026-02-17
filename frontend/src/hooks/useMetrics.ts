"use client";

import useSWR from "swr";
import { apiGet } from "@/lib/api";

const REFRESH_INTERVAL = 60000;

function useFetch<T>(path: string | null) {
  return useSWR<T>(
    path,
    (url: string) => apiGet<T>(url),
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );
}

// --- Cloudflare Types ---

export interface TunnelIngress {
  hostname: string;
  service: string;
}

export interface Tunnel {
  id: string;
  name: string;
  status: string;
  created_at: string;
  connections: number;
  ingress: TunnelIngress[];
}

export interface DnsRecord {
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

export interface WarpDevice {
  name: string;
  type: string;
  version: string;
  ip: string;
  last_seen: string | null;
}

// --- Claude Types ---

export interface ClaudeSummary {
  total_sessions: number;
  total_messages: number;
  model_count: number;
  total_cost_usd: number;
  first_session_date: string | null;
  last_computed_date: string | null;
  longest_session: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  } | null;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface ModelUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface CostBreakdown {
  total_cost_usd: number;
  models: Array<{
    model: string;
    input_cost: number;
    output_cost: number;
    cache_read_cost: number;
    cache_create_cost: number;
    total_cost: number;
  }>;
}

export interface RateLimitWindow {
  used_pct: number;
  remaining_pct: number;
  reset_at: string | null;
}

export interface ClaudeRateLimits {
  available: boolean;
  plan?: string;
  five_hour?: RateLimitWindow;
  seven_day?: RateLimitWindow;
  cached_at?: number;
}

export interface ClaudeSession {
  session_id: string;
  project: string;
  message_count: number;
  first_message: number;
  last_message: number;
  first_display: string;
}

export interface ProviderSummary {
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  last_updated_at: number | null;
}

export interface LlmSummary {
  gpt: ProviderSummary;
  gemini: ProviderSummary;
}

export interface LlmModelUsage {
  model: string;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  last_updated_at: number | null;
}

export interface LlmCostBreakdown {
  provider: "gpt" | "gemini";
  total_cost_usd: number;
  models: Array<{
    model: string;
    input_cost: number;
    output_cost: number;
    total_cost: number;
    session_count: number;
  }>;
}

// --- Cloudflare Hooks ---

export function useTunnels() {
  return useFetch<Tunnel[]>("/api/v1/cloudflare/tunnels");
}

export function useDnsRecords(zone: string | null) {
  return useFetch<DnsRecord[]>(zone ? `/api/v1/cloudflare/dns/${zone}` : null);
}

export function useWarpDevices() {
  return useFetch<WarpDevice[]>("/api/v1/cloudflare/warp/devices");
}

// --- Claude Hooks ---

export function useClaudeSummary() {
  return useFetch<ClaudeSummary>("/api/v1/claude/summary");
}

export function useClaudeDailyActivity() {
  return useFetch<DailyActivity[]>("/api/v1/claude/usage/daily");
}

export function useClaudeModelUsage() {
  return useFetch<ModelUsage[]>("/api/v1/claude/usage/models");
}

export function useClaudeDailyModels() {
  return useFetch<DailyModelTokens[]>("/api/v1/claude/usage/daily-models");
}

export function useClaudeCost() {
  return useFetch<CostBreakdown>("/api/v1/claude/cost");
}

export function useClaudeSessions() {
  return useFetch<ClaudeSession[]>("/api/v1/claude/sessions");
}

export function useClaudeHours() {
  return useFetch<Record<string, number>>("/api/v1/claude/hours");
}

export function useClaudeRateLimits() {
  return useFetch<ClaudeRateLimits>("/api/v1/claude/rate-limits");
}

export function useLlmSummary() {
  return useFetch<LlmSummary>("/api/v1/llm/summary");
}

export function useLlmModels(provider: "gpt" | "gemini") {
  return useFetch<LlmModelUsage[]>(`/api/v1/llm/models/${provider}`);
}

export function useLlmCost(provider: "gpt" | "gemini") {
  return useFetch<LlmCostBreakdown>(`/api/v1/llm/cost/${provider}`);
}

// --- Port Types ---

export interface PortEntry {
  port: number;
  status: "active" | "inactive" | "configured" | "unregistered" | "conflict";
  sources: string[];
  name: string;
  project: string;
  category: string;
  process: string;
  pid: number;
  bind: string;
}

export interface PortStatus {
  scanned_at: string;
  summary: {
    total: number;
    registered: number;
    active: number;
    inactive: number;
    configured: number;
    unregistered: number;
    conflict: number;
  };
  ports: PortEntry[];
}

export interface PortRange {
  category: string;
  start: number;
  end: number;
  total_slots: number;
  registered: number;
  active: number;
  ports: number[];
}

export interface PortRanges {
  ranges: PortRange[];
}

// --- Port Hooks ---

export function usePortStatus() {
  return useFetch<PortStatus>("/api/v1/ports/status");
}

export function usePortRanges() {
  return useFetch<PortRanges>("/api/v1/ports/ranges");
}
