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

// GET /api/v1/servers
export interface Server {
  id: string;
  name: string;
  ip: string;
  os: string;
  status: string; // "up" | "down"
  cpu_percent: number;
  mem_percent: number;
  uptime_seconds: number;
}

// GET /api/v1/servers/{id}/overview
export interface ServerOverview {
  id: string;
  name: string;
  ip: string;
  os: string;
  metrics: {
    cpu: {
      usage_percent: number;
      per_core: number[];
      load_avg: number[];
      count: { physical: number; logical: number };
    };
    memory: {
      total_gb: number;
      used_gb: number;
      available_gb: number;
      percent: number;
      swap_total_gb: number;
      swap_used_gb: number;
      swap_percent: number;
    };
    disks: Array<{
      device: string;
      mountpoint: string;
      fstype: string;
      total_gb: number;
      used_gb: number;
      free_gb: number;
      percent: number;
    }>;
    network: {
      interfaces: Array<{
        name: string;
        is_up: boolean;
        speed_mbps: number;
        rx_bytes: number;
        tx_bytes: number;
        rx_bytes_sec: number;
        tx_bytes_sec: number;
      }>;
    };
    docker: Array<{
      id: string;
      name: string;
      image: string;
      status: string;
      state: string;
      created: string;
      ports: string;
    }>;
    uptime_seconds: number;
    process_count: {
      total: number;
      running: number;
      sleeping: number;
      zombie: number;
    };
    top_processes: Array<{
      pid: number;
      name: string;
      cpu_percent: number;
      memory_percent: number;
    }>;
    timestamp: number;
  };
}

// GET /api/v1/servers/{id}/cpu
export interface CpuData {
  current: {
    usage_percent: number;
    per_core: number[];
    load_avg: number[];
    count: { physical: number; logical: number };
  };
  history: Array<{ timestamp: number; usage_percent: number }>;
}

// GET /api/v1/servers/{id}/memory
export interface MemoryData {
  current: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    percent: number;
    swap_total_gb: number;
    swap_used_gb: number;
    swap_percent: number;
  };
  history: Array<{ timestamp: number; percent: number }>;
}

// GET /api/v1/servers/{id}/disk
export interface DiskInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface DiskData {
  disks: DiskInfo[];
}

// GET /api/v1/servers/{id}/network
export interface NetworkInterface {
  name: string;
  is_up: boolean;
  speed_mbps: number;
  rx_bytes: number;
  tx_bytes: number;
  rx_bytes_sec: number;
  tx_bytes_sec: number;
  rx_packets: number;
  tx_packets: number;
  errors_in: number;
  errors_out: number;
  drops_in: number;
  drops_out: number;
}

export interface NetworkData {
  current: {
    interfaces: NetworkInterface[];
  };
  history: Array<{
    timestamp: number;
    interfaces: NetworkInterface[];
  }>;
}

// GET /api/v1/servers/{id}/docker
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface DockerData {
  containers: DockerContainer[];
}

// GET /api/v1/servers/{id}/processes
export interface ProcessData {
  count: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  top: Array<{
    pid: number;
    name: string;
    cpu_percent: number;
    memory_percent: number;
  }>;
}

// GET /api/v1/alerts
export interface Alert {
  id: number;
  server_id: string;
  metric: string;
  severity: string; // "warning" | "critical"
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
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
  return useFetch<DiskData>(id ? `/api/v1/servers/${id}/disk` : null);
}

export function useServerNetwork(id: string | null) {
  return useFetch<NetworkData>(id ? `/api/v1/servers/${id}/network` : null);
}

export function useServerDocker(id: string | null) {
  return useFetch<DockerData>(id ? `/api/v1/servers/${id}/docker` : null);
}

export function useServerProcesses(id: string | null) {
  return useFetch<ProcessData>(id ? `/api/v1/servers/${id}/processes` : null);
}

export function useAlerts() {
  return useFetch<Alert[]>("/api/v1/alerts");
}

export function useActiveAlerts() {
  return useFetch<Alert[]>("/api/v1/alerts/active");
}
