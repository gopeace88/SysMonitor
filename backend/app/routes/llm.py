from fastapi import APIRouter, Depends, HTTPException

from app.auth.jwt import verify_token
from app.collectors.llm_usage import LlmUsageCollector

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])
collector = LlmUsageCollector()


@router.get("/summary")
async def summary(_: str = Depends(verify_token)):
    return collector.get_summary()


def _validate_provider(provider: str) -> str:
    p = provider.lower()
    if p not in {"gpt", "gemini"}:
        raise HTTPException(status_code=400, detail="provider must be one of: gpt, gemini")
    return p


@router.get("/models/{provider}")
async def models(provider: str, _: str = Depends(verify_token)):
    p = _validate_provider(provider)
    return collector.get_models(p)


@router.get("/cost/{provider}")
async def cost(provider: str, _: str = Depends(verify_token)):
    p = _validate_provider(provider)
    return collector.get_cost(p)


@router.get("/rate-limits/{provider}")
async def rate_limits(provider: str, _: str = Depends(verify_token)):
    p = _validate_provider(provider)
    return collector.get_rate_limits(p)
