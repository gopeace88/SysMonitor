import json
import logging
import time
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("sysmonitor.llm")

# Provider to dashboard mapping
_PROVIDER_MAP = {
    "gpt": "openai-codex",
    "gemini": "google-antigravity",
}

_CACHE_TTL = 300  # 5 minutes


class LlmUsageCollector:
    """Reads OpenClaw session files directly for GPT/Gemini usage data."""

    def __init__(self) -> None:
        self._cache: dict[str, Any] | None = None
        self._cache_time: float = 0

    def _sessions_dir(self) -> Path:
        return settings.openclaw_state_dir / "agents" / "main" / "sessions"

    def _ensure_cache(self) -> dict[str, Any]:
        now = time.time()
        if self._cache and (now - self._cache_time) < _CACHE_TTL:
            return self._cache

        self._cache = self._build_cache()
        self._cache_time = now
        return self._cache

    def _build_cache(self) -> dict[str, Any]:
        """Scan all session files once and build aggregated data."""
        sessions_dir = self._sessions_dir()
        # provider -> { sessions: int, models: { model -> {tokens} }, last_updated: int }
        providers: dict[str, dict[str, Any]] = {}

        for jsonl_file in sessions_dir.glob("*.jsonl"):
            if ".bak" in jsonl_file.name or ".deleted" in jsonl_file.name:
                continue

            provider, model_data = self._scan_session(jsonl_file)
            if not provider or provider not in _PROVIDER_MAP.values():
                continue

            if provider not in providers:
                providers[provider] = {
                    "sessions": 0,
                    "models": {},
                    "last_updated": 0,
                }

            p = providers[provider]
            p["sessions"] += 1

            mtime = int(jsonl_file.stat().st_mtime * 1000)
            if mtime > p["last_updated"]:
                p["last_updated"] = mtime

            for model_id, data in model_data.items():
                if model_id not in p["models"]:
                    p["models"][model_id] = {
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "total_tokens": 0,
                        "input_cost": 0.0,
                        "output_cost": 0.0,
                        "total_cost": 0.0,
                        "session_count": 0,
                    }
                m = p["models"][model_id]
                m["session_count"] += 1
                m["input_tokens"] += data["input_tokens"]
                m["output_tokens"] += data["output_tokens"]
                m["total_tokens"] += data["total_tokens"]
                m["input_cost"] += data["input_cost"]
                m["output_cost"] += data["output_cost"]
                m["total_cost"] += data["total_cost"]

        # Read sessions index for context window info
        index = self._read_sessions_index()
        session_windows: dict[str, list[dict]] = {}
        for _key, sd in index.items():
            if not isinstance(sd, dict) or "sessionId" not in sd:
                continue
            sid = sd["sessionId"]
            sf = sessions_dir / f"{sid}.jsonl"
            # Find which provider this session belongs to
            for oc_prov, p_data in providers.items():
                # We need to check provider for this session
                pass

        # Get plan names
        plans: dict[str, str | None] = {}
        for dashboard_key, oc_key in _PROVIDER_MAP.items():
            plans[oc_key] = self._get_plan_name(dashboard_key)

        # Build rate limit windows from sessions index
        provider_windows: dict[str, list[dict]] = {k: [] for k in _PROVIDER_MAP.values()}
        # We need provider info per session - store it during scan
        # For now, use the scan results

        return {
            "providers": providers,
            "plans": plans,
            "index": index,
        }

    def _scan_session(self, session_file: Path) -> tuple[str | None, dict[str, dict[str, float]]]:
        """Quick scan of a session file. Returns (provider, {model: usage_data})."""
        provider = None
        current_model = "unknown"
        models: dict[str, dict[str, float]] = {}

        try:
            with open(session_file) as f:
                for line in f:
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    etype = entry.get("type")

                    if etype == "model_change":
                        provider = entry.get("provider")
                        current_model = entry.get("modelId", "unknown")
                        continue

                    if etype != "message":
                        continue

                    msg = entry.get("message", {})
                    if msg.get("role") != "assistant":
                        continue

                    usage = msg.get("usage")
                    if not usage:
                        continue

                    if current_model not in models:
                        models[current_model] = {
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0,
                            "input_cost": 0.0,
                            "output_cost": 0.0,
                            "total_cost": 0.0,
                        }

                    m = models[current_model]
                    m["input_tokens"] += usage.get("input", 0)
                    m["output_tokens"] += usage.get("output", 0)
                    m["total_tokens"] += usage.get("totalTokens", 0)

                    cost = usage.get("cost", {})
                    m["input_cost"] += cost.get("input", 0)
                    m["output_cost"] += cost.get("output", 0) + cost.get("cacheRead", 0)
                    m["total_cost"] += cost.get("total", 0)

        except Exception as e:
            logger.error(f"Failed to scan session {session_file.name}: {e}")

        return provider, models

    def _read_sessions_index(self) -> dict[str, Any]:
        path = self._sessions_dir() / "sessions.json"
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            return {}

    def _get_plan_name(self, provider: str) -> str | None:
        """Extract plan name from auth profile JWT."""
        path = settings.openclaw_state_dir / "agents" / "main" / "agent" / "auth-profiles.json"
        try:
            with open(path) as f:
                profiles = json.load(f)
        except Exception:
            return None

        oc_provider = _PROVIDER_MAP.get(provider, provider)
        last_good = profiles.get("lastGood", {})
        profile_key = last_good.get(oc_provider)
        if not profile_key:
            return None

        profile = profiles.get("profiles", {}).get(profile_key, {})

        if oc_provider == "openai-codex":
            access = profile.get("access", "")
            try:
                import base64
                parts = access.split(".")
                if len(parts) >= 2:
                    payload = parts[1] + "=" * (4 - len(parts[1]) % 4)
                    data = json.loads(base64.urlsafe_b64decode(payload))
                    plan = data.get("https://api.openai.com/auth", {}).get("chatgpt_plan_type")
                    if plan:
                        return plan.title()
            except Exception:
                pass

        if oc_provider == "google-antigravity":
            return "Gemini"

        return None

    def _provider_data(self, provider: str) -> dict[str, Any] | None:
        cache = self._ensure_cache()
        oc_provider = _PROVIDER_MAP.get(provider, provider)
        return cache["providers"].get(oc_provider)

    def get_summary(self) -> dict[str, Any]:
        cache = self._ensure_cache()
        result = {}
        for dashboard_key, oc_key in _PROVIDER_MAP.items():
            p = cache["providers"].get(oc_key)
            if not p:
                result[dashboard_key] = {
                    "available": False,
                    "source": "session-files",
                    "session_count": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "last_updated_at": None,
                }
                continue

            total_in = sum(m["input_tokens"] for m in p["models"].values())
            total_out = sum(m["output_tokens"] for m in p["models"].values())
            total_tok = sum(m["total_tokens"] for m in p["models"].values())

            result[dashboard_key] = {
                "available": True,
                "source": "session-files",
                "plan": cache["plans"].get(oc_key),
                "session_count": p["sessions"],
                "input_tokens": total_in,
                "output_tokens": total_out,
                "total_tokens": total_tok,
                "last_updated_at": p["last_updated"],
            }
        return result

    def get_models(self, provider: str) -> list[dict[str, Any]]:
        p = self._provider_data(provider)
        if not p:
            return []

        return sorted(
            [
                {
                    "model": model_id,
                    "session_count": data["session_count"],
                    "input_tokens": data["input_tokens"],
                    "output_tokens": data["output_tokens"],
                    "total_tokens": data["total_tokens"],
                }
                for model_id, data in p["models"].items()
            ],
            key=lambda x: x["total_tokens"],
            reverse=True,
        )

    def get_cost(self, provider: str) -> dict[str, Any]:
        cache = self._ensure_cache()
        oc_provider = _PROVIDER_MAP.get(provider, provider)
        p = cache["providers"].get(oc_provider)

        if not p:
            return {
                "provider": provider,
                "available": False,
                "source": "session-files",
                "reason": "No sessions found for this provider.",
                "total_cost_usd": None,
                "models": [],
            }

        total_cost = sum(m["total_cost"] for m in p["models"].values())
        model_list = sorted(
            [
                {
                    "model": model_id,
                    "input_cost": round(data["input_cost"], 6),
                    "output_cost": round(data["output_cost"], 6),
                    "total_cost": round(data["total_cost"], 6),
                    "session_count": data["session_count"],
                }
                for model_id, data in p["models"].items()
            ],
            key=lambda x: x["total_cost"],
            reverse=True,
        )

        return {
            "provider": provider,
            "available": True,
            "source": "session-files",
            "reason": "Computed from OpenClaw session logs",
            "total_cost_usd": round(total_cost, 4),
            "models": model_list,
        }

    def get_rate_limits(self, provider: str) -> dict[str, Any]:
        cache = self._ensure_cache()
        oc_provider = _PROVIDER_MAP.get(provider, provider)
        p = cache["providers"].get(oc_provider)

        if not p:
            return {"available": False, "source": "session-files"}

        # Build windows from sessions index (context window usage)
        index = cache.get("index", {})
        windows = []

        # Map session IDs to providers by checking our scan results
        sessions_dir = self._sessions_dir()
        for _key, sd in index.items():
            if not isinstance(sd, dict) or "sessionId" not in sd:
                continue

            sid = sd["sessionId"]
            context_tokens = sd.get("contextTokens", 0)
            total_tokens = sd.get("totalTokens", 0)
            pct_used = sd.get("percentUsed", 0)

            if context_tokens <= 0:
                continue

            # Check if this session file exists and belongs to our provider
            sf = sessions_dir / f"{sid}.jsonl"
            if not sf.exists():
                continue

            # Quick provider check - read first few lines
            try:
                session_provider = None
                with open(sf) as f:
                    for i, line in enumerate(f):
                        if i > 10:
                            break
                        entry = json.loads(line)
                        if entry.get("type") == "model_change":
                            session_provider = entry.get("provider")
                            break
            except Exception:
                continue

            if session_provider != oc_provider:
                continue

            model_name = sd.get("model", "unknown")
            windows.append({
                "label": f"{model_name} ({sid[:8]})",
                "used_pct": pct_used,
                "remaining_pct": max(0, 100 - pct_used),
                "reset_at": None,
            })

        return {
            "available": True,
            "source": "session-files",
            "source_provider": oc_provider,
            "plan": cache["plans"].get(oc_provider),
            "windows": windows,
        }
