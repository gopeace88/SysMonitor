import json
import logging
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("sysmonitor.llm")


class LlmUsageCollector:
    def __init__(self):
        self.sessions_path: Path = settings.openclaw_sessions_path

    def _read_sessions(self) -> list[dict[str, Any]]:
        if not self.sessions_path.exists():
            return []
        try:
            raw = json.loads(self.sessions_path.read_text())
            if isinstance(raw, dict):
                return [v for v in raw.values() if isinstance(v, dict)]
            return []
        except Exception as e:
            logger.error(f"Failed to read OpenClaw sessions file: {e}")
            return []

    def _provider_key(self, provider: str, model: str) -> str:
        provider_l = (provider or "").lower()
        model_l = (model or "").lower()

        if provider_l in {"openai", "openai-codex"} or "gpt" in model_l or "codex" in model_l:
            return "gpt"
        if provider_l in {"gemini", "google"} or "gemini" in model_l:
            return "gemini"
        return "other"

    def get_summary(self) -> dict[str, Any]:
        sessions = self._read_sessions()
        agg: dict[str, dict[str, Any]] = {
            "gpt": {"session_count": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "last_updated_at": None},
            "gemini": {"session_count": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "last_updated_at": None},
        }

        for s in sessions:
            model = str(s.get("model") or "")
            provider = str(s.get("modelProvider") or "")
            kind = self._provider_key(provider, model)
            if kind not in agg:
                continue

            input_tokens = int(s.get("inputTokens") or 0)
            output_tokens = int(s.get("outputTokens") or 0)
            total_tokens = int(s.get("totalTokens") or (input_tokens + output_tokens))
            updated_at = s.get("updatedAt")

            agg[kind]["session_count"] += 1
            agg[kind]["input_tokens"] += input_tokens
            agg[kind]["output_tokens"] += output_tokens
            agg[kind]["total_tokens"] += total_tokens
            if isinstance(updated_at, int):
                prev = agg[kind]["last_updated_at"]
                agg[kind]["last_updated_at"] = max(prev or 0, updated_at)

        return agg

    def get_models(self, provider: str) -> list[dict[str, Any]]:
        provider = provider.lower()
        sessions = self._read_sessions()
        buckets: dict[str, dict[str, Any]] = {}

        for s in sessions:
            model = str(s.get("model") or "unknown")
            p = str(s.get("modelProvider") or "")
            kind = self._provider_key(p, model)
            if kind != provider:
                continue

            if model not in buckets:
                buckets[model] = {
                    "model": model,
                    "session_count": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "last_updated_at": None,
                }

            input_tokens = int(s.get("inputTokens") or 0)
            output_tokens = int(s.get("outputTokens") or 0)
            total_tokens = int(s.get("totalTokens") or (input_tokens + output_tokens))
            updated_at = s.get("updatedAt")

            buckets[model]["session_count"] += 1
            buckets[model]["input_tokens"] += input_tokens
            buckets[model]["output_tokens"] += output_tokens
            buckets[model]["total_tokens"] += total_tokens
            if isinstance(updated_at, int):
                prev = buckets[model]["last_updated_at"]
                buckets[model]["last_updated_at"] = max(prev or 0, updated_at)

        return sorted(buckets.values(), key=lambda x: x["total_tokens"], reverse=True)
