import json
import logging
import os
import subprocess
from typing import Any

from app.config import settings

logger = logging.getLogger("sysmonitor.llm")


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
                timeout=20,
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

    def _provider_entry(self, provider: str) -> dict[str, Any] | None:
        usage = self._read_provider_usage()
        providers = usage.get("providers", []) if isinstance(usage, dict) else []

        if provider == "gpt":
            return next((x for x in providers if str(x.get("provider")) == "openai-codex"), None)

        gemini_provider = next((x for x in providers if "gemini" in str(x.get("provider", "")).lower()), None)
        if gemini_provider:
            return gemini_provider

        antigravity = next((x for x in providers if str(x.get("provider")) == "google-antigravity"), None)
        return antigravity

    def get_summary(self) -> dict[str, Any]:
        def summarize(provider: str) -> dict[str, Any]:
            entry = self._provider_entry(provider)
            if not entry:
                return {
                    "available": False,
                    "source": "provider-usage",
                    "session_count": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "last_updated_at": None,
                }
            windows = entry.get("windows", [])
            return {
                "available": True,
                "source": "provider-usage",
                "plan": entry.get("plan"),
                "window_count": len(windows),
                "session_count": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "last_updated_at": None,
            }

        return {"gpt": summarize("gpt"), "gemini": summarize("gemini")}

    def get_models(self, provider: str) -> list[dict[str, Any]]:
        if settings.llm_local_fallback_enabled:
            return []
        return []

    def get_cost(self, provider: str) -> dict[str, Any]:
        return {
            "provider": provider,
            "available": False,
            "source": "provider-usage",
            "reason": "Official provider usage endpoint does not expose monthly token/cost breakdown in current auth mode.",
            "total_cost_usd": None,
            "models": [],
        }

    def get_rate_limits(self, provider: str) -> dict[str, Any]:
        entry = self._provider_entry(provider)
        if not entry:
            return {"available": False, "source": "provider-usage"}

        windows = entry.get("windows", [])
        if provider == "gemini":
            windows = [w for w in windows if "gemini" in str(w.get("label", "")).lower()]

        return {
            "available": True,
            "source": "provider-usage",
            "source_provider": entry.get("provider"),
            "plan": entry.get("plan"),
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
