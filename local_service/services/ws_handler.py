"""WebSocket connection manager with token auth and heartbeat.

Handles:
- Token extraction from query params
- Validation against config.WS_TOKEN
- Masked logging (never prints full token)
- PING/PONG message loop
- Graceful disconnect cleanup
"""

import logging

from fastapi import WebSocket, WebSocketDisconnect

from local_service.core import config

logger = logging.getLogger(__name__)

WS_AUTH_FAILED = 403


def mask_token(token: str | None) -> str:
    """Return a masked version of the token for logging.

    Shows first 4 and last 4 chars; everything in between is replaced with '...'.
    """
    if not token:
        return ""
    if len(token) <= 8:
        return token
    return f"{token[:4]}...{token[-4:]}"


class WebSocketHandler:
    """Manages a single WebSocket connection lifecycle."""

    def __init__(self, expected_token: str | None = None) -> None:
        self.expected_token = expected_token if expected_token is not None else config.WS_TOKEN

    def validate_token(self, token: str | None) -> bool:
        """Return True if the supplied token matches the expected token."""
        if not token or not self.expected_token:
            return False
        return token == self.expected_token

    async def handle(self, websocket: WebSocket) -> None:
        """Run the full connection lifecycle."""
        token = websocket.query_params.get("token")
        masked = mask_token(token)

        if not self.validate_token(token):
            logger.warning("WS auth failed, token=%s", masked)
            await websocket.close(code=WS_AUTH_FAILED)
            return

        await websocket.accept()
        logger.info("WS connection accepted, token=%s", masked)

        try:
            await self._message_loop(websocket)
        except WebSocketDisconnect:
            logger.info("WS client disconnected, token=%s", masked)
        except Exception:
            logger.exception("WS error, token=%s", masked)
        finally:
            logger.info("WS connection cleaned up, token=%s", masked)

    async def _message_loop(self, websocket: WebSocket) -> None:
        """Read messages and respond with pong until the client disconnects."""
        while True:
            try:
                message = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            if message.lower() == "ping":
                await websocket.send_text("pong")
            else:
                # For any other message, also respond with pong as heartbeat
                await websocket.send_text("pong")
