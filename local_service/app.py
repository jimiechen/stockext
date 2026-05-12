"""FastAPI application factory and route definitions.

Imports config values instead of hard-coding them.
"""

from fastapi import FastAPI, WebSocket

from local_service import config
from local_service.websocket_handler import WebSocketHandler

app = FastAPI()


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "tdx-deepseek-feishu-mvp",
        "version": "0.2.0",
    }


@app.websocket(config.WS_PATH)
async def plugin_ws(websocket: WebSocket) -> None:
    """WebSocket endpoint for plugin communication."""
    handler = WebSocketHandler()
    await handler.handle(websocket)
