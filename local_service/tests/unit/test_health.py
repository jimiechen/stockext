"""Unit tests for the /health endpoint.

TDD approach: write the test first, then implement the endpoint.
"""

import pytest
from fastapi.testclient import TestClient

from local_service.app import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "tdx-deepseek-feishu-mvp",
        "version": "0.2.0",
    }
