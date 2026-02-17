export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "-" + formatBytes(-bytes);

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(k, idx);

  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatBps(bytesPerSec: number): string {
  const bitsPerSec = bytesPerSec * 8;

  if (bitsPerSec === 0) return "0 bps";
  if (bitsPerSec < 0) return "-" + formatBps(-bytesPerSec);

  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  const k = 1000;
  const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
  const idx = Math.min(i, units.length - 1);
  const value = bitsPerSec / Math.pow(k, idx);

  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0s";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || secs > 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatUSD(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function formatTokens(count: number): string {
  if (count === 0) return "0";
  if (count < 1000) return count.toString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1_000_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${(count / 1_000_000_000).toFixed(2)}B`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatModelName(modelId: string): string {
  if (modelId.includes("opus-4-6")) return "Opus 4.6";
  if (modelId.includes("opus-4-5")) return "Opus 4.5";
  if (modelId.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (modelId.includes("haiku-4-5")) return "Haiku 4.5";
  if (modelId.includes("opus")) return "Opus";
  if (modelId.includes("sonnet")) return "Sonnet";
  if (modelId.includes("haiku")) return "Haiku";
  return modelId;
}
