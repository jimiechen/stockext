"""Unit tests for WebSocket token authentication.

TDD approach: write the test first, then implement the handler.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from local_service.websocket_handler import WebSocketHandler, mask_token


class TestMaskToken:
    def test_mask_short_token(self) -> None:
        assert mask_token("abcd") == "abcd"

    def test_mask_exact_8_chars(self) -> None:
        assert mask_token("abcdefgh") == "abcdefgh"

    def test_mask_long_token(self) -> None:
        assert mask_token("my-secret-token-12345") == "my-s...2345"

    def test_mask_empty(self) -> None:
        assert mask_token("") == ""


class TestValidateToken:
    @pytest.fixture
    def handler(self) -> WebSocketHandler:
        return WebSocketHandler(expected_token="valid-token-1234")

    def test_valid_token(self, handler: WebSocketHandler) -> None:
        assert handler.validate_token("valid-token-1234") is True

    def test_invalid_token(self, handler: WebSocketHandler) -> None:
        assert handler.validate_token("wrong-token") is False

    def test_empty_token(self, handler: WebSocketHandler) -> None:
        assert handler.validate_token("") is False

    def test_none_token(self, handler: WebSocketHandler) -> None:
        assert handler.validate_token(None) is False


class TestHandleConnection:
    @pytest.fixture
    def mock_ws(self) -> MagicMock:
        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.close = AsyncMock()
        ws.receive_text = AsyncMock()
        ws.send_text = AsyncMock()
        ws.query_params = {}
        return ws

    @pytest.fixture
    def handler(self) -> WebSocketHandler:
        return WebSocketHandler(expected_token="test-token-42")

    @pytest.mark.asyncio
    async def test_missing_token_closes_connection(
        self, mock_ws: MagicMock, handler: WebSocketHandler
    ) -> None:
        mock_ws.query_params = {}
        await handler.handle(mock_ws)
        mock_ws.close.assert_awaited_once()
        mock_ws.accept.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_invalid_token_closes_connection(
        self, mock_ws: MagicMock, handler: WebSocketHandler
    ) -> None:
        mock_ws.query_params = {"token": "bad-token"}
        await handler.handle(mock_ws)
        mock_ws.close.assert_awaited_once()
        mock_ws.accept.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_valid_token_accepts_and_runs_loop(
        self, mock_ws: MagicMock, handler: WebSocketHandler
    ) -> None:
        mock_ws.query_params = {"token": "test-token-42"}
        mock_ws.receive_text.side_effect = ["ping", Exception("break")]

        with patch.object(handler, "_message_loop", new_callable=AsyncMock) as mock_loop:
            await handler.handle(mock_ws)

        mock_ws.accept.assert_awaited_once()
        mock_ws.close.assert_not_awaited()
        mock_loop.assert_awaited_once_with(mock_ws)

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up(
        self, mock_ws: MagicMock, handler: WebSocketHandler
    ) -> None:
        mock_ws.query_params = {"token": "test-token-42"}
        mock_ws.receive_text.side_effect = Exception("client disconnected")

        await handler.handle(mock_ws)

        mock_ws.accept.assert_awaited_once()
        mock_ws.close.assert_not_awaited()
