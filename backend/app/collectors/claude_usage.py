import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("sysmonitor.claude")

_JSONL_CACHE: dict[str, Any] = {}       # model → cumulative tokens
_JSONL_DAILY_CACHE: dict[str, Any] = {} # date → model → tokens
_JSONL_CACHE_TIME: float = 0
_JSONL_CACHE_TTL = 300  # 5 minutes

# Anthropic pricing per 1M tokens
PRICING = {
    "claude-opus-4-5-20251101": {"input": 15.0, "output": 75.0},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-5-20250929": {"input": 3.0, "output": 15.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.8, "output": 4.0},
}
DEFAULT_PRICING = {"input": 3.0, "output": 15.0}
CACHE_READ_DISCOUNT = 0.9   # 90% cheaper
CACHE_CREATE_PREMIUM = 0.25  # 25% more expensive


class ClaudeUsageCollector:
    def __init__(self):
        self.data_dir: Path = settings.claude_data_dir

    def _read_stats_cache(self) -> dict[str, Any]:
        path = self.data_dir / "stats-cache.json"
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except Exception as e:
            logger.error(f"Failed to read stats-cache.json: {e}")
            return {}

    def _read_history(self) -> list[dict[str, Any]]:
        path = self.data_dir / "history.jsonl"
        if not path.exists():
            return []
        results = []
        try:
            for line in path.read_text().splitlines():
                line = line.strip()
                if line:
                    results.append(json.loads(line))
        except Exception as e:
            logger.error(f"Failed to read history.jsonl: {e}")
        return results

    def _build_jsonl_cache(self) -> None:
        """JSONL 파일 스캔 → 모델별/날짜별 집계 (5분 캐시)."""
        global _JSONL_CACHE, _JSONL_DAILY_CACHE, _JSONL_CACHE_TIME
        now = time.time()
        if _JSONL_CACHE and (now - _JSONL_CACHE_TIME) < _JSONL_CACHE_TTL:
            return

        cumulative: dict[str, dict] = {}
        daily: dict[str, dict] = {}  # date → {model → tokens}

        projects_dir = self.data_dir / "projects"
        if projects_dir.exists():
            for jsonl_file in projects_dir.rglob("*.jsonl"):
                try:
                    for line in jsonl_file.read_text(errors="ignore").splitlines():
                        if not line.strip():
                            continue
                        d = json.loads(line)
                        msg = d.get("message", {})
                        model = msg.get("model", "")
                        if not model or model == "<synthetic>":
                            continue
                        usage = msg.get("usage", {})
                        if not usage:
                            continue
                        it = usage.get("input_tokens", 0)
                        ot = usage.get("output_tokens", 0)
                        cr = usage.get("cache_read_input_tokens", 0)
                        cc = usage.get("cache_creation_input_tokens", 0)

                        if model not in cumulative:
                            cumulative[model] = {"inputTokens": 0, "outputTokens": 0,
                                                  "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0}
                        cumulative[model]["inputTokens"] += it
                        cumulative[model]["outputTokens"] += ot
                        cumulative[model]["cacheReadInputTokens"] += cr
                        cumulative[model]["cacheCreationInputTokens"] += cc

                        ts = d.get("timestamp", "")
                        date = ts[:10] if ts else ""
                        if date:
                            if date not in daily:
                                daily[date] = {}
                            if model not in daily[date]:
                                daily[date][model] = 0
                            daily[date][model] += it + ot
                except Exception:
                    continue

        _JSONL_CACHE = cumulative
        _JSONL_DAILY_CACHE = daily
        _JSONL_CACHE_TIME = now

    def _read_jsonl_model_usage(self, exclude_models: set) -> dict[str, dict]:
        """stats-cache에 없는 모델만 반환 (double-count 방지)."""
        self._build_jsonl_cache()
        return {m: v for m, v in _JSONL_CACHE.items() if m not in exclude_models}

    def _merged_model_usage(self) -> dict[str, dict]:
        """stats-cache + JSONL 보완 데이터 병합."""
        stats = self._read_stats_cache()
        model_usage = dict(stats.get("modelUsage", {}))
        extra = self._read_jsonl_model_usage(exclude_models=set(model_usage.keys()))
        model_usage.update(extra)
        return model_usage

    def get_summary(self) -> dict[str, Any]:
        stats = self._read_stats_cache()
        if not stats:
            return {"total_sessions": 0, "total_messages": 0, "model_count": 0, "total_cost_usd": 0}

        model_usage = self._merged_model_usage()
        cost = self._calculate_total_cost(model_usage)

        return {
            "total_sessions": stats.get("totalSessions", 0),
            "total_messages": stats.get("totalMessages", 0),
            "model_count": len(model_usage),
            "total_cost_usd": round(cost, 2),
            "first_session_date": stats.get("firstSessionDate"),
            "last_computed_date": stats.get("lastComputedDate"),
            "longest_session": stats.get("longestSession"),
        }

    def get_daily_activity(self) -> list[dict[str, Any]]:
        stats = self._read_stats_cache()
        return stats.get("dailyActivity", [])

    def get_model_usage(self) -> list[dict[str, Any]]:
        model_usage = self._merged_model_usage()
        result = []
        for model_id, usage in model_usage.items():
            pricing = PRICING.get(model_id, DEFAULT_PRICING)
            input_tokens = usage.get("inputTokens", 0)
            output_tokens = usage.get("outputTokens", 0)
            cache_read = usage.get("cacheReadInputTokens", 0)
            cache_create = usage.get("cacheCreationInputTokens", 0)

            input_cost = (input_tokens / 1_000_000) * pricing["input"]
            output_cost = (output_tokens / 1_000_000) * pricing["output"]
            cache_read_cost = (cache_read / 1_000_000) * pricing["input"] * (1 - CACHE_READ_DISCOUNT)
            cache_create_cost = (cache_create / 1_000_000) * pricing["input"] * (1 + CACHE_CREATE_PREMIUM)

            result.append({
                "model": model_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_read_tokens": cache_read,
                "cache_create_tokens": cache_create,
                "total_tokens": input_tokens + output_tokens,
                "cost_usd": round(input_cost + output_cost + cache_read_cost + cache_create_cost, 4),
            })
        return result

    def get_daily_model_tokens(self) -> list[dict[str, Any]]:
        stats = self._read_stats_cache()
        base = {entry["date"]: dict(entry["tokensByModel"])
                for entry in stats.get("dailyModelTokens", [])}

        # JSONL에서 stats-cache에 없는 모델의 날짜별 토큰 보완
        self._build_jsonl_cache()
        cached_models = set(stats.get("modelUsage", {}).keys())
        for date, model_tokens in _JSONL_DAILY_CACHE.items():
            for model, tokens in model_tokens.items():
                if model in cached_models:
                    continue  # 이미 stats-cache에 있는 모델은 skip
                if date not in base:
                    base[date] = {}
                base[date][model] = base[date].get(model, 0) + tokens

        return [{"date": d, "tokensByModel": m} for d, m in sorted(base.items())]

    def get_cost_breakdown(self) -> dict[str, Any]:
        model_usage = self._merged_model_usage()
        models = []
        total_cost = 0.0

        for model_id, usage in model_usage.items():
            pricing = PRICING.get(model_id, DEFAULT_PRICING)
            input_tokens = usage.get("inputTokens", 0)
            output_tokens = usage.get("outputTokens", 0)
            cache_read = usage.get("cacheReadInputTokens", 0)
            cache_create = usage.get("cacheCreationInputTokens", 0)

            input_cost = (input_tokens / 1_000_000) * pricing["input"]
            output_cost = (output_tokens / 1_000_000) * pricing["output"]
            cache_read_cost = (cache_read / 1_000_000) * pricing["input"] * (1 - CACHE_READ_DISCOUNT)
            cache_create_cost = (cache_create / 1_000_000) * pricing["input"] * (1 + CACHE_CREATE_PREMIUM)
            model_cost = input_cost + output_cost + cache_read_cost + cache_create_cost

            models.append({
                "model": model_id,
                "input_cost": round(input_cost, 4),
                "output_cost": round(output_cost, 4),
                "cache_read_cost": round(cache_read_cost, 4),
                "cache_create_cost": round(cache_create_cost, 4),
                "total_cost": round(model_cost, 4),
            })
            total_cost += model_cost

        return {
            "total_cost_usd": round(total_cost, 2),
            "models": models,
        }

    def get_sessions(self) -> list[dict[str, Any]]:
        history = self._read_history()
        sessions: dict[str, dict] = {}
        for entry in history:
            sid = entry.get("sessionId", "unknown")
            ts = entry.get("timestamp", 0)
            project = entry.get("project", "")
            display = entry.get("display", "")

            if sid not in sessions:
                sessions[sid] = {
                    "session_id": sid,
                    "project": project,
                    "message_count": 0,
                    "first_message": ts,
                    "last_message": ts,
                    "first_display": display[:100] if display else "",
                }
            sessions[sid]["message_count"] += 1
            if ts < sessions[sid]["first_message"]:
                sessions[sid]["first_message"] = ts
            if ts > sessions[sid]["last_message"]:
                sessions[sid]["last_message"] = ts

        result = sorted(sessions.values(), key=lambda s: s["last_message"], reverse=True)
        return result

    def get_hour_counts(self) -> dict[str, int]:
        stats = self._read_stats_cache()
        return stats.get("hourCounts", {})

    def get_rate_limits(self) -> dict[str, Any]:
        cache_path = self.data_dir / "plugins" / "claude-hud" / ".usage-cache.json"
        if not cache_path.exists():
            return {"available": False}
        try:
            data = json.loads(cache_path.read_text())
            info = data.get("data", {})
            now = datetime.now(timezone.utc)

            five_pct = info.get("fiveHour", 0)
            five_reset = info.get("fiveHourResetAt")
            if five_reset:
                reset_dt = datetime.fromisoformat(five_reset.replace("Z", "+00:00"))
                if now > reset_dt:
                    five_pct = 0
                    five_reset = None

            seven_pct = info.get("sevenDay", 0)
            seven_reset = info.get("sevenDayResetAt")
            if seven_reset:
                reset_dt = datetime.fromisoformat(seven_reset.replace("Z", "+00:00"))
                if now > reset_dt:
                    seven_pct = 0
                    seven_reset = None

            return {
                "available": True,
                "plan": info.get("planName", "Unknown"),
                "five_hour": {
                    "used_pct": five_pct,
                    "remaining_pct": 100 - five_pct,
                    "reset_at": five_reset,
                },
                "seven_day": {
                    "used_pct": seven_pct,
                    "remaining_pct": 100 - seven_pct,
                    "reset_at": seven_reset,
                },
                "cached_at": data.get("timestamp"),
            }
        except Exception as e:
            logger.error(f"Failed to read usage-cache.json: {e}")
            return {"available": False}

    def _calculate_total_cost(self, model_usage: dict) -> float:
        total = 0.0
        for model_id, usage in model_usage.items():
            pricing = PRICING.get(model_id, DEFAULT_PRICING)
            input_tokens = usage.get("inputTokens", 0)
            output_tokens = usage.get("outputTokens", 0)
            cache_read = usage.get("cacheReadInputTokens", 0)
            cache_create = usage.get("cacheCreationInputTokens", 0)

            total += (input_tokens / 1_000_000) * pricing["input"]
            total += (output_tokens / 1_000_000) * pricing["output"]
            total += (cache_read / 1_000_000) * pricing["input"] * (1 - CACHE_READ_DISCOUNT)
            total += (cache_create / 1_000_000) * pricing["input"] * (1 + CACHE_CREATE_PREMIUM)
        return total
