from fastapi import APIRouter, Depends, HTTPException

from app.auth.jwt import verify_token
from app.collectors.llm_usage import LlmUsageCollector

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])
collector = LlmUsageCollector()


@router.get("/summary")
async def summary(_: str = Depends(verify_token)):
    return collector.get_summary()


@router.get("/models/{provider}")
async def models(provider: str, _: str = Depends(verify_token)):
    p = provider.lower()
    if p not in {"gpt", "gemini"}:
        raise HTTPException(status_code=400, detail="provider must be one of: gpt, gemini")
    return collector.get_models(p)
