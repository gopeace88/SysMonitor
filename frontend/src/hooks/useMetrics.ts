"use client";

import useSWR from "swr";
import { apiGet } from "@/lib/api";

const REFRESH_INTERVAL = 60000; // 60 seconds

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

export interface Server {
  id: string;
  name: string;
  ip: string;
  status: "online" | "offline" | "warning";
  cpu_percent: number;
  memory_percent: number;
  uptime: number;
  os: string;
  hostname: string;
}

export interface ServerOverview {
  id: string;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  network_rx: number;
  network_tx: number;
  uptime: number;
  load_avg: [number, number, number];
  cpu_cores: number;
}

export interface CpuData {
  usage_history: Array<{ timestamp: string; value: number }>;
  per_core: Array<{ core: number; percent: number }>;
  load_avg: [number, number, number];
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  current_percent: number;
}

export interface MemoryData {
  usage_history: Array<{ timestamp: string; value: number }>;
  total: number;
  used: number;
  available: number;
  swap_total: number;
  swap_used: number;
  percent: number;
}

export interface DiskInfo {
  mount: string;
  device: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface DiskData {
  disks: DiskInfo[];
}

export interface NetworkData {
  rx_history: Array<{ timestamp: string; value: number }>;
  tx_history: Array<{ timestamp: string; value: number }>;
  interfaces: Array<{
    name: string;
    rx_bytes: number;
    tx_bytes: number;
    rx_rate: number;
    tx_rate: number;
    status: string;
  }>;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
}

export interface DockerData {
  containers: DockerContainer[];
}

export interface Alert {
  id: string;
  server_id: string;
  server_name: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  acknowledged: boolean;
  type: string;
}

export function useServers() {
  return useFetch<Server[]>("/api/v1/servers");
}

export function useServerOverview(id: string | null) {
  return useFetch<ServerOverview>(id ? `/api/v1/servers/${id}/overview` : null);
}

export function useServerCpu(id: string | null) {
  return useFetch<CpuData>(id ? `/api/v1/servers/${id}/cpu` : null);
}

export function useServerMemory(id: string | null) {
  return useFetch<MemoryData>(id ? `/api/v1/servers/${id}/memory` : null);
}

export function useServerDisk(id: string | null) {
  return useFetch<DiskData>(id ? `/api/v1/servers/${id}/disks` : null);
}

export function useServerNetwork(id: string | null) {
  return useFetch<NetworkData>(id ? `/api/v1/servers/${id}/network` : null);
}

export function useServerDocker(id: string | null) {
  return useFetch<DockerData>(id ? `/api/v1/servers/${id}/docker` : null);
}

export function useAlerts() {
  return useFetch<Alert[]>("/api/v1/alerts");
}

export function useActiveAlerts() {
  return useFetch<Alert[]>("/api/v1/alerts/active");
}
