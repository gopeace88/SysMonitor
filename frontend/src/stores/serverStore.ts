import { create } from "zustand";

interface ServerStore {
  selectedServer: string;
  timeRange: string;
  setServer: (id: string) => void;
  setTimeRange: (range: string) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  selectedServer: "",
  timeRange: "1h",
  setServer: (id: string) => set({ selectedServer: id }),
  setTimeRange: (range: string) => set({ timeRange: range }),
}));
