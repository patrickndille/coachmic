"""Tests for account deletion service and API endpoint."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from firebase_admin import auth

from app.services.account_deletion_service import (
    delete_user_account,
    _delete_collection_by_user_id,
    _delete_saved_jobs,
    _delete_user_profile,
    _delete_user_credentials,
    _delete_firebase_auth_user,
)


class TestDeleteCollectionByUserId:
    """Tests for _delete_collection_by_user_id helper function."""

    @pytest.mark.asyncio
    async def test_delete_collection_success(self):
        """Test successful deletion of documents from a collection."""
        mock_doc1 = MagicMock()
        mock_doc1.reference = MagicMock()
        mock_doc2 = MagicMock()
        mock_doc2.reference = MagicMock()

        mock_batch = MagicMock()
        mock_batch.commit = MagicMock()

        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = [mock_doc1, mock_doc2]

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = mock_batch

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_collection_by_user_id('sessions', 'test-uid-123')

        assert result['deleted'] == 2
        assert result['errors'] == 0
        mock_batch.delete.assert_called()
        mock_batch.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_collection_empty(self):
        """Test deletion when no documents exist."""
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = []

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_collection_by_user_id('sessions', 'test-uid-123')

        assert result['deleted'] == 0
        assert result['errors'] == 0

    @pytest.mark.asyncio
    async def test_delete_collection_batch_error(self):
        """Test handling of batch commit errors."""
        mock_doc = MagicMock()
        mock_doc.reference = MagicMock()

        mock_batch = MagicMock()
        mock_batch.commit.side_effect = Exception("Firestore error")

        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = [mock_doc]

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = mock_batch

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_collection_by_user_id('sessions', 'test-uid-123')

        assert result['deleted'] == 0
        assert result['errors'] == 1


class TestDeleteSavedJobs:
    """Tests for _delete_saved_jobs helper function."""

    @pytest.mark.asyncio
    async def test_delete_saved_jobs_success(self):
        """Test successful deletion of saved jobs by uid prefix."""
        mock_doc1 = MagicMock()
        mock_doc1.id = "test-uid-123_job-abc"
        mock_doc1.reference = MagicMock()

        mock_doc2 = MagicMock()
        mock_doc2.id = "test-uid-123_job-def"
        mock_doc2.reference = MagicMock()

        mock_doc3 = MagicMock()  # Different user's job
        mock_doc3.id = "other-user_job-xyz"
        mock_doc3.reference = MagicMock()

        mock_batch = MagicMock()
        mock_batch.commit = MagicMock()

        mock_collection = MagicMock()
        mock_collection.stream.return_value = [mock_doc1, mock_doc2, mock_doc3]

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = mock_batch

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_saved_jobs('test-uid-123')

        assert result == 2  # Only 2 docs belong to the test user
        assert mock_batch.delete.call_count == 2

    @pytest.mark.asyncio
    async def test_delete_saved_jobs_none(self):
        """Test deletion when user has no saved jobs."""
        mock_doc = MagicMock()
        mock_doc.id = "other-user_job-xyz"

        mock_collection = MagicMock()
        mock_collection.stream.return_value = [mock_doc]

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_saved_jobs('test-uid-123')

        assert result == 0


class TestDeleteUserProfile:
    """Tests for _delete_user_profile helper function."""

    @pytest.mark.asyncio
    async def test_delete_user_profile_success(self):
        """Test successful deletion of user profile."""
        mock_doc = MagicMock()
        mock_doc.delete = MagicMock()

        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_user_profile('test-uid-123')

        assert result is True
        mock_doc.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_user_profile_error(self):
        """Test handling of delete errors."""
        mock_doc = MagicMock()
        mock_doc.delete.side_effect = Exception("Firestore error")

        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_user_profile('test-uid-123')

        assert result is False


class TestDeleteUserCredentials:
    """Tests for _delete_user_credentials helper function."""

    @pytest.mark.asyncio
    async def test_delete_user_credentials_success(self):
        """Test successful deletion of user credentials."""
        mock_doc = MagicMock()
        mock_doc.delete = MagicMock()

        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            result = await _delete_user_credentials('test-uid-123')

        assert result is True
        mock_doc.delete.assert_called_once()


class TestDeleteFirebaseAuthUser:
    """Tests for _delete_firebase_auth_user helper function."""

    @pytest.mark.asyncio
    async def test_delete_firebase_auth_success(self):
        """Test successful deletion of Firebase Auth user."""
        with patch('app.services.account_deletion_service.auth.delete_user') as mock_delete:
            result = await _delete_firebase_auth_user('test-uid-123')

        assert result is True
        mock_delete.assert_called_once_with('test-uid-123')

    @pytest.mark.asyncio
    async def test_delete_firebase_auth_user_not_found(self):
        """Test idempotent behavior when user already deleted."""
        with patch('app.services.account_deletion_service.auth.delete_user') as mock_delete:
            mock_delete.side_effect = auth.UserNotFoundError("User not found")
            result = await _delete_firebase_auth_user('test-uid-123')

        assert result is True  # Should return True for idempotency

    @pytest.mark.asyncio
    async def test_delete_firebase_auth_error(self):
        """Test handling of Firebase Auth errors."""
        with patch('app.services.account_deletion_service.auth.delete_user') as mock_delete:
            mock_delete.side_effect = Exception("Firebase error")
            result = await _delete_firebase_auth_user('test-uid-123')

        assert result is False


class TestDeleteUserAccount:
    """Tests for the main delete_user_account function."""

    @pytest.mark.asyncio
    async def test_full_account_deletion_success(self):
        """Test complete account deletion across all collections."""
        mock_doc = MagicMock()
        mock_doc.reference = MagicMock()
        mock_doc.id = "test-uid-123_job-abc"

        mock_batch = MagicMock()
        mock_batch.commit = MagicMock()

        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = [mock_doc]
        mock_collection.stream.return_value = [mock_doc]
        mock_collection.document.return_value.delete = MagicMock()

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = mock_batch

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            with patch('app.services.account_deletion_service.auth.delete_user'):
                result = await delete_user_account('test-uid-123')

        assert result['success'] is True
        assert result['errors'] is None
        assert 'sessions' in result['deleted_counts']
        assert 'feedback' in result['deleted_counts']
        assert 'coaching_sessions' in result['deleted_counts']
        assert 'saved_jobs' in result['deleted_counts']
        assert 'user_credentials' in result['deleted_counts']
        assert 'users' in result['deleted_counts']
        assert 'firebase_auth' in result['deleted_counts']

    @pytest.mark.asyncio
    async def test_account_deletion_with_no_data(self):
        """Test deletion for user with no data in any collection."""
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = []
        mock_collection.stream.return_value = []
        mock_collection.document.return_value.delete = MagicMock()

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = MagicMock()

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            with patch('app.services.account_deletion_service.auth.delete_user'):
                result = await delete_user_account('test-uid-no-data')

        assert result['success'] is True
        assert result['deleted_counts']['sessions'] == 0
        assert result['deleted_counts']['feedback'] == 0

    @pytest.mark.asyncio
    async def test_account_deletion_partial_failure(self):
        """Test deletion continues on partial failures."""
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.side_effect = Exception("Firestore error")
        mock_collection.stream.return_value = []
        mock_collection.document.return_value.delete = MagicMock()

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = MagicMock()

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            with patch('app.services.account_deletion_service.auth.delete_user'):
                result = await delete_user_account('test-uid-123')

        # Should still succeed if auth deletion works and profile is deleted
        assert result['deleted_counts']['sessions'] == 0
        assert len(result['errors']) > 0

    @pytest.mark.asyncio
    async def test_account_deletion_auth_failure(self):
        """Test failure when Firebase Auth deletion fails."""
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = []
        mock_collection.stream.return_value = []
        mock_collection.document.return_value.delete = MagicMock()

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = MagicMock()

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            with patch('app.services.account_deletion_service.auth.delete_user') as mock_auth:
                mock_auth.side_effect = Exception("Firebase Auth error")
                result = await delete_user_account('test-uid-123')

        assert result['success'] is False
        assert result['deleted_counts']['firebase_auth'] == 0
        assert any('Firebase Auth' in err for err in result['errors'])

    @pytest.mark.asyncio
    async def test_account_deletion_idempotent(self):
        """Test that deletion can be called multiple times safely."""
        mock_collection = MagicMock()
        mock_collection.where.return_value.stream.return_value = []
        mock_collection.stream.return_value = []
        mock_collection.document.return_value.delete = MagicMock()

        mock_db = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_db.batch.return_value = MagicMock()

        with patch('app.services.account_deletion_service.get_firestore_client', return_value=mock_db):
            with patch('app.services.account_deletion_service.auth.delete_user') as mock_auth:
                # First call - user exists
                result1 = await delete_user_account('test-uid-123')
                assert result1['success'] is True

                # Second call - user already deleted
                mock_auth.side_effect = auth.UserNotFoundError("User not found")
                result2 = await delete_user_account('test-uid-123')
                assert result2['success'] is True  # Should still succeed


class TestAccountDeletionEndpoint:
    """Tests for the DELETE /api/v1/auth/account endpoint."""

    def test_delete_account_requires_auth(self, client):
        """Test that endpoint requires authentication."""
        response = client.delete("/api/v1/auth/account")
        assert response.status_code in [401, 403]

    def test_delete_account_success(self, client):
        """Test successful account deletion with valid auth."""
        # This would require mocking the auth middleware
        # For integration tests, use actual Firebase tokens
        pass  # Placeholder for integration test
