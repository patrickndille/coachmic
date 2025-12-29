"""Integration tests for session API endpoints."""

import json

import pytest
from fastapi.testclient import TestClient


class TestSessionEndpoints:
    """Tests for session management endpoints."""

    @pytest.mark.integration
    def test_create_session(self, client: TestClient):
        """Test creating a new session."""
        response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "sessionId" in data
        assert data["status"] == "created"
        assert "createdAt" in data

    @pytest.mark.integration
    def test_create_session_with_camelCase(self, client: TestClient):
        """Test that API accepts camelCase field names."""
        response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Data Scientist",
                "targetCompany": "Microsoft",
                "interviewType": "technical",
            },
        )

        assert response.status_code == 200
        assert response.json()["status"] == "created"

    @pytest.mark.integration
    def test_create_session_minimal(self, client: TestClient):
        """Test creating session with minimal data."""
        response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Developer",
                "targetCompany": "",
                "interviewType": "mixed",
            },
        )

        assert response.status_code == 200

    @pytest.mark.integration
    def test_get_session(self, client: TestClient):
        """Test retrieving a session."""
        # First create a session
        create_response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        session_id = create_response.json()["sessionId"]

        # Then get it
        get_response = client.get(f"/api/v1/session/{session_id}")

        assert get_response.status_code == 200
        data = get_response.json()
        assert data["sessionId"] == session_id
        assert data["status"] == "created"

    @pytest.mark.integration
    def test_get_session_not_found(self, client: TestClient):
        """Test getting a non-existent session."""
        response = client.get("/api/v1/session/nonexistent-id")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.integration
    def test_update_session(self, client: TestClient):
        """Test updating a session."""
        # Create session
        create_response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        session_id = create_response.json()["sessionId"]

        # Update session
        update_response = client.put(
            f"/api/v1/session/{session_id}",
            json={
                "targetRole": "Senior Backend Developer",
                "targetCompany": "Amazon",
            },
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert data["sessionId"] == session_id

    @pytest.mark.integration
    def test_update_session_partial(self, client: TestClient):
        """Test partial session update."""
        # Create session
        create_response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        session_id = create_response.json()["sessionId"]

        # Update only role
        update_response = client.put(
            f"/api/v1/session/{session_id}",
            json={"targetRole": "Staff Engineer"},
        )

        assert update_response.status_code == 200

    @pytest.mark.integration
    def test_update_session_not_found(self, client: TestClient):
        """Test updating a non-existent session."""
        response = client.put(
            "/api/v1/session/nonexistent-id",
            json={"targetRole": "Developer"},
        )

        assert response.status_code == 404

    @pytest.mark.integration
    def test_delete_session(self, client: TestClient):
        """Test deleting a session."""
        # Create session
        create_response = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        session_id = create_response.json()["sessionId"]

        # Delete session
        delete_response = client.delete(f"/api/v1/session/{session_id}")

        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data["deleted"] is True
        assert data["sessionId"] == session_id

        # Verify session is gone
        get_response = client.get(f"/api/v1/session/{session_id}")
        assert get_response.status_code == 404

    @pytest.mark.integration
    def test_delete_session_not_found(self, client: TestClient):
        """Test deleting a non-existent session."""
        response = client.delete("/api/v1/session/nonexistent-id")

        assert response.status_code == 404


class TestSessionValidation:
    """Tests for session request validation."""

    @pytest.mark.integration
    def test_create_session_invalid_json(self, client: TestClient):
        """Test creating session with invalid JSON."""
        response = client.post(
            "/api/v1/session",
            data="invalid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    @pytest.mark.integration
    def test_create_session_missing_fields(self, client: TestClient):
        """Test creating session with missing required fields."""
        response = client.post(
            "/api/v1/session",
            json={},
        )

        assert response.status_code == 422


class TestSessionWorkflow:
    """Tests for complete session workflows."""

    @pytest.mark.integration
    def test_session_lifecycle(self, client: TestClient):
        """Test complete session lifecycle: create -> update -> get -> delete."""
        # Create
        create_resp = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["sessionId"]

        # Update
        update_resp = client.put(
            f"/api/v1/session/{session_id}",
            json={"targetRole": "Senior Backend Developer"},
        )
        assert update_resp.status_code == 200

        # Get
        get_resp = client.get(f"/api/v1/session/{session_id}")
        assert get_resp.status_code == 200

        # Delete
        delete_resp = client.delete(f"/api/v1/session/{session_id}")
        assert delete_resp.status_code == 200

        # Verify deleted
        get_resp_after = client.get(f"/api/v1/session/{session_id}")
        assert get_resp_after.status_code == 404

    @pytest.mark.integration
    def test_multiple_sessions(self, client: TestClient):
        """Test creating multiple independent sessions."""
        # Create first session
        resp1 = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Backend Developer",
                "targetCompany": "Google",
                "interviewType": "behavioral",
            },
        )
        session_id_1 = resp1.json()["sessionId"]

        # Create second session
        resp2 = client.post(
            "/api/v1/session",
            json={
                "targetRole": "Frontend Developer",
                "targetCompany": "Amazon",
                "interviewType": "technical",
            },
        )
        session_id_2 = resp2.json()["sessionId"]

        # Verify both exist independently
        assert session_id_1 != session_id_2
        assert client.get(f"/api/v1/session/{session_id_1}").status_code == 200
        assert client.get(f"/api/v1/session/{session_id_2}").status_code == 200
