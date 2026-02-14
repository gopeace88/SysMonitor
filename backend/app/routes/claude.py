from fastapi import APIRouter, Depends

from app.auth.jwt import verify_token
from app.collectors.claude_usage import ClaudeUsageCollector

router = APIRouter(prefix="/api/v1/claude", tags=["claude"])
collector = ClaudeUsageCollector()


@router.get("/summary")
async def summary(_: str = Depends(verify_token)):
    return collector.get_summary()


@router.get("/usage/daily")
async def daily_usage(_: str = Depends(verify_token)):
    return collector.get_daily_activity()


@router.get("/usage/models")
async def model_usage(_: str = Depends(verify_token)):
    return collector.get_model_usage()


@router.get("/usage/daily-models")
async def daily_model_tokens(_: str = Depends(verify_token)):
    return collector.get_daily_model_tokens()


@router.get("/cost")
async def cost_breakdown(_: str = Depends(verify_token)):
    return collector.get_cost_breakdown()


@router.get("/sessions")
async def sessions(_: str = Depends(verify_token)):
    return collector.get_sessions()


@router.get("/hours")
async def hour_counts(_: str = Depends(verify_token)):
    return collector.get_hour_counts()


@router.get("/rate-limits")
async def rate_limits(_: str = Depends(verify_token)):
    return collector.get_rate_limits()
