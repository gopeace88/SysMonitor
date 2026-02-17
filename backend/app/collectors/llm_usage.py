import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("sysmonitor.llm")


# rough estimates per 1M tokens
GPT_PRICING = {
    "gpt-5": {"input": 5.0, "output": 15.0},
    "gpt-4": {"input": 10.0, "output": 30.0},
    "codex": {"input": 5.0, "output": 15.0},
}
GEMINI_PRICING = {
    "gemini-2.5-pro": {"input": 3.5, "output": 10.5},
    "gemini-2.5-flash": {"input": 0.3, "output": 2.5},
    "gemini": {"input": 1.0, "output": 4.0},
}
DEFAULT_ESTIMATE = {"input": 1.0, "output": 4.0}


class LlmUsageCollector:
    def _read_provider_usage(self) -> dict[str, Any]:
        try:
            cmd = [settings.openclaw_bin, "status", "--usage", "--json"]
            if settings.openclaw_node_bin:
                cmd = [settings.openclaw_node_bin, settings.openclaw_bin, "status", "--usage", "--json"]

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=12,
                check=False,
                env={**os.environ, "OPENCLAW_STATE_DIR": str(settings.openclaw_state_dir)},
            )
            if proc.returncode != 0 or not proc.stdout:
                return {}
            data = json.loads(proc.stdout)
            return data.get("usage", {}) if isinstance(data, dict) else {}
        except Exception as e:
            logger.error(f"Failed to read provider usage from openclaw status: {e}")
            return {}

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

    def _pricing_for(self, provider: str, model: str) -> dict[str, float]:
        m = model.lower()
        price_map = GPT_PRICING if provider == "gpt" else GEMINI_PRICING
        for key, pricing in price_map.items():
            if key in m:
                return pricing
        return DEFAULT_ESTIMATE

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

    def get_rate_limits(self, provider: str) -> dict[str, Any]:
        usage = self._read_provider_usage()
        providers = usage.get("providers", []) if isinstance(usage, dict) else []

        if provider == "gpt":
            p = next((x for x in providers if str(x.get("provider")) == "openai-codex"), None)
            if not p:
                return {"available": False}
            windows = p.get("windows", [])
            return {
                "available": True,
                "source_provider": p.get("provider"),
                "plan": p.get("plan"),
                "windows": [
                    {
                        "label": w.get("label"),
                        "used_pct": w.get("usedPercent", 0),
                        "remaining_pct": max(0, 100 - int(w.get("usedPercent", 0) or 0)),
                        "reset_at": w.get("resetAt"),
                    }
                    for w in windows
                ],
            }

        # gemini: accept native gemini provider or antigravity gemini-labelled windows
        gemini_provider = next((x for x in providers if "gemini" in str(x.get("provider", "")).lower()), None)
        if gemini_provider:
            windows = gemini_provider.get("windows", [])
            return {
                "available": True,
                "source_provider": gemini_provider.get("provider"),
                "plan": gemini_provider.get("plan"),
                "windows": [
                    {
                        "label": w.get("label"),
                        "used_pct": w.get("usedPercent", 0),
                        "remaining_pct": max(0, 100 - int(w.get("usedPercent", 0) or 0)),
                        "reset_at": w.get("resetAt"),
                    }
                    for w in windows
                ],
            }

        antigravity = next((x for x in providers if str(x.get("provider")) == "google-antigravity"), None)
        if antigravity:
            windows = [w for w in antigravity.get("windows", []) if "gemini" in str(w.get("label", "")).lower()]
            return {
                "available": True,
                "source_provider": antigravity.get("provider"),
                "plan": antigravity.get("plan"),
                "windows": [
                    {
                        "label": w.get("label"),
                        "used_pct": w.get("usedPercent", 0),
                        "remaining_pct": max(0, 100 - int(w.get("usedPercent", 0) or 0)),
                        "reset_at": w.get("resetAt"),
                    }
                    for w in windows
                ],
            }

        return {"available": False}

    def get_cost(self, provider: str) -> dict[str, Any]:
        models = self.get_models(provider)
        rows = []
        total_cost = 0.0

        for m in models:
            pricing = self._pricing_for(provider, str(m.get("model") or ""))
            input_tokens = int(m.get("input_tokens") or 0)
            output_tokens = int(m.get("output_tokens") or 0)
            input_cost = (input_tokens / 1_000_000) * pricing["input"]
            output_cost = (output_tokens / 1_000_000) * pricing["output"]
            model_cost = input_cost + output_cost
            total_cost += model_cost
            rows.append(
                {
                    "model": m.get("model"),
                    "input_cost": round(input_cost, 4),
                    "output_cost": round(output_cost, 4),
                    "total_cost": round(model_cost, 4),
                    "session_count": m.get("session_count", 0),
                }
            )

        return {"provider": provider, "total_cost_usd": round(total_cost, 2), "models": rows}
