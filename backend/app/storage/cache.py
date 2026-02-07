from collections import deque
from typing import Optional
import threading


class MetricsCache:
    def __init__(self, max_history: int = 60):
        self._data: dict = {}
        self._max = max_history
        self._lock = threading.Lock()

    def update(self, server_id: str, data: dict):
        with self._lock:
            if server_id not in self._data:
                self._data[server_id] = {
                    "latest": None,
                    "history": deque(maxlen=self._max),
                }
            self._data[server_id]["latest"] = data
            self._data[server_id]["history"].append(data)

    def get_latest(self, server_id: str) -> Optional[dict]:
        with self._lock:
            entry = self._data.get(server_id)
            return entry["latest"] if entry else None

    def get_history(self, server_id: str, count: int = 0) -> list:
        with self._lock:
            entry = self._data.get(server_id)
            if not entry:
                return []
            hist = list(entry["history"])
            return hist[-count:] if count > 0 else hist

    def get_all_latest(self) -> dict:
        with self._lock:
            return {sid: e["latest"] for sid, e in self._data.items() if e["latest"]}
