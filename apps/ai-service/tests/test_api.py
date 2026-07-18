from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_api_rejects_unknown_fields() -> None:
    with TestClient(app) as client:
        response = client.post("/v1/personalization/analyze-event", json={"unexpected": True})
        assert response.status_code == 422
