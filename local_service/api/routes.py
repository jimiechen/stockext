"""HTTP API route definitions.

Imports config values instead of hard-coding them.
"""

from fastapi import APIRouter

from local_service.core.config import HOST, PORT, WS_PATH

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "tdx-deepseek-feishu-mvp",
        "version": "0.2.0",
    }
