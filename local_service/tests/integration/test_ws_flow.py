"""Integration tests for WebSocket connection flow.

Tests full connection lifecycle via FastAPI TestClient.
"""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from local_service.app import app
from local_service.core import config


@pytest.fixture
def valid_token(monkeypatch: pytest.MonkeyPatch) -> str:
    token = "integration-test-token-42"
    monkeypatch.setattr(config, "WS_TOKEN", token)
    return token


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class TestWsAuthFlow:
    def test_connect_without_token_gets_403(self, client: TestClient) -> None:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/plugin"):
                pass
        assert exc_info.value.code == 403

    def test_connect_with_invalid_token_gets_403(self, client: TestClient) -> None:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/plugin?token=invalid"):
                pass
        assert exc_info.value.code == 403

    def test_connect_with_valid_token_succeeds(
        self, client: TestClient, valid_token: str
    ) -> None:
        with client.websocket_connect(f"/ws/plugin?token={valid_token}") as ws:
            ws.send_text("hello")
            response = ws.receive_text()
            assert response == "pong"


class TestWsPingPong:
    def test_server_responds_ping_with_pong(
        self, client: TestClient, valid_token: str
    ) -> None:
        with client.websocket_connect(f"/ws/plugin?token={valid_token}") as ws:
            ws.send_text("ping")
            response = ws.receive_text()
            assert response == "pong"

    def test_server_responds_any_message_with_pong(
        self, client: TestClient, valid_token: str
    ) -> None:
        with client.websocket_connect(f"/ws/plugin?token={valid_token}") as ws:
            ws.send_text("random data")
            response = ws.receive_text()
            assert response == "pong"


class TestWsDisconnectCleanup:
    def test_client_disconnect_does_not_crash_server(
        self, client: TestClient, valid_token: str
    ) -> None:
        with client.websocket_connect(f"/ws/plugin?token={valid_token}") as ws:
            ws.send_text("ping")
            ws.receive_text()
        # If we reach here without exception, cleanup succeeded
