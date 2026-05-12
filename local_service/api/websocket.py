"""WebSocket endpoint for plugin communication."""

from fastapi import WebSocket

from local_service.core.config import WS_PATH
from local_service.services.ws_handler import WebSocketHandler


async def plugin_ws(websocket: WebSocket) -> None:
    """WebSocket endpoint for plugin communication."""
    handler = WebSocketHandler()
    await handler.handle(websocket)
