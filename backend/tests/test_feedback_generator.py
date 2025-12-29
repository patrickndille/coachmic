"""Tests for feedback generation service."""

import pytest

from app.services.feedback_generator import (
    _build_question_feedback,
    _calculate_speaking_metrics,
    generate_interview_feedback,
)


class TestSpeakingMetrics:
    """Tests for speaking metrics calculation."""

    @pytest.mark.unit
    def test_calculate_speaking_metrics_basic(self, sample_transcript):
        """Test basic speaking metrics calculation."""
        metrics = _calculate_speaking_metrics(sample_transcript)

        assert metrics.words_per_minute > 0
        assert metrics.words_per_minute >= 80  # Minimum reasonable WPM
        assert metrics.words_per_minute <= 200  # Maximum reasonable WPM
        assert metrics.filler_word_count > 0
        assert isinstance(metrics.filler_words, list)
        assert metrics.average_response_time > 0
        assert metrics.total_speaking_time > 0

    @pytest.mark.unit
    def test_calculate_speaking_metrics_filler_words(self, sample_transcript):
        """Test filler word detection."""
        metrics = _calculate_speaking_metrics(sample_transcript)

        # The sample transcript contains "um", "like", "you know", "basically", "I mean"
        assert metrics.filler_word_count >= 5
        assert any(word in ["um", "like", "you know"] for word in metrics.filler_words)

    @pytest.mark.unit
    def test_calculate_speaking_metrics_empty_transcript(self):
        """Test metrics calculation with empty transcript."""
        metrics = _calculate_speaking_metrics([])

        assert metrics.words_per_minute == 0
        assert metrics.filler_word_count == 0
        assert metrics.filler_words == []
        assert metrics.average_response_time == 0
        assert metrics.total_speaking_time == 0

    @pytest.mark.unit
    def test_calculate_speaking_metrics_no_user_entries(self):
        """Test metrics calculation when transcript has no user entries."""
        transcript = [
            {"speaker": "agent", "text": "Question 1", "timestamp": 1000},
            {"speaker": "agent", "text": "Question 2", "timestamp": 2000},
        ]
        metrics = _calculate_speaking_metrics(transcript)

        assert metrics.words_per_minute == 0
        assert metrics.filler_word_count == 0

    @pytest.mark.unit
    def test_calculate_speaking_metrics_response_time(self):
        """Test response time calculation."""
        transcript = [
            {"speaker": "agent", "text": "Question", "timestamp": 1000},
            {"speaker": "user", "text": "Answer with twenty words in total to test the word count calculation accurately", "timestamp": 3000},
            {"speaker": "agent", "text": "Follow up", "timestamp": 5000},
            {"speaker": "user", "text": "Another response here", "timestamp": 7000},
        ]
        metrics = _calculate_speaking_metrics(transcript)

        # Response time should be around 2 seconds (3000 - 1000 = 2000ms = 2s)
        assert metrics.average_response_time > 0
        assert metrics.average_response_time < 30  # Should be reasonable

    @pytest.mark.unit
    def test_calculate_speaking_metrics_wpm_clamping(self):
        """Test that WPM is clamped to reasonable range."""
        # Very short response
        transcript = [
            {"speaker": "user", "text": "Yes", "timestamp": 1000},
        ]
        metrics = _calculate_speaking_metrics(transcript)

        assert 80 <= metrics.words_per_minute <= 200

    @pytest.mark.unit
    def test_filler_word_patterns(self):
        """Test various filler word patterns."""
        transcript = [
            {
                "speaker": "user",
                "text": "Um, I think, like, you know, basically, actually, so, I mean, this is a test",
                "timestamp": 1000,
            }
        ]
        metrics = _calculate_speaking_metrics(transcript)

        assert metrics.filler_word_count >= 6
        assert len(metrics.filler_words) > 0


class TestQuestionFeedback:
    """Tests for question feedback building."""

    @pytest.mark.unit
    def test_build_question_feedback_with_star(self):
        """Test building feedback with STAR analysis."""
        analyses = [
            {
                "question": "Tell me about a challenging project.",
                "response_summary": "Discussed security testing project",
                "score": 85,
                "feedback": "Excellent use of STAR method",
                "star_detected": {
                    "situation": "Security vulnerabilities reported",
                    "task": "Identify and fix issues",
                    "action": "Comprehensive security testing",
                    "result": "Fixed critical vulnerability",
                },
                "improvement_suggestion": "Provide more quantifiable results",
            }
        ]

        feedback_list = _build_question_feedback(analyses)

        assert len(feedback_list) == 1
        assert feedback_list[0].question == "Tell me about a challenging project."
        assert feedback_list[0].score == 85
        assert feedback_list[0].star_analysis is not None
        assert feedback_list[0].star_analysis.situation == "Security vulnerabilities reported"
        assert feedback_list[0].suggested_improvement == "Provide more quantifiable results"

    @pytest.mark.unit
    def test_build_question_feedback_without_star(self):
        """Test building feedback without STAR analysis."""
        analyses = [
            {
                "question": "What are your strengths?",
                "response_summary": "Listed technical skills",
                "score": 70,
                "feedback": "Good list of skills",
                "star_detected": {},
            }
        ]

        feedback_list = _build_question_feedback(analyses)

        assert len(feedback_list) == 1
        assert feedback_list[0].star_analysis is None

    @pytest.mark.unit
    def test_build_question_feedback_empty(self):
        """Test building feedback with empty analyses."""
        feedback_list = _build_question_feedback([])
        assert feedback_list == []

    @pytest.mark.unit
    def test_build_question_feedback_multiple(self):
        """Test building feedback for multiple questions."""
        analyses = [
            {
                "question": "Question 1",
                "response_summary": "Answer 1",
                "score": 80,
                "feedback": "Good",
                "star_detected": {},
            },
            {
                "question": "Question 2",
                "response_summary": "Answer 2",
                "score": 75,
                "feedback": "Needs improvement",
                "star_detected": {},
            },
        ]

        feedback_list = _build_question_feedback(analyses)

        assert len(feedback_list) == 2
        assert all(f.question_id for f in feedback_list)  # All have IDs


class TestFeedbackGeneration:
    """Tests for complete feedback generation."""

    @pytest.mark.unit
    async def test_generate_interview_feedback(
        self, sample_transcript, sample_session_data, mock_gemini_service
    ):
        """Test complete feedback generation with mocked Gemini."""
        feedback = await generate_interview_feedback(
            session_id=sample_session_data["session_id"],
            transcript=sample_transcript,
            target_role=sample_session_data["target_role"],
            interview_type=sample_session_data["interview_type"],
        )

        assert feedback.session_id == sample_session_data["session_id"]
        assert 0 <= feedback.overall_score <= 100
        assert feedback.category_scores is not None
        assert feedback.speaking_metrics is not None
        assert isinstance(feedback.strengths, list)
        assert isinstance(feedback.areas_for_improvement, list)
        assert isinstance(feedback.question_feedback, list)
        assert feedback.generated_at is not None

    @pytest.mark.unit
    async def test_feedback_overall_score_calculation(
        self, sample_transcript, mock_gemini_service
    ):
        """Test overall score calculation formula."""
        feedback = await generate_interview_feedback(
            session_id="test-123",
            transcript=sample_transcript,
            target_role="Backend Developer",
            interview_type="behavioral",
        )

        # Verify score is weighted average
        expected_score = (
            feedback.category_scores.content * 0.35
            + feedback.category_scores.delivery * 0.20
            + feedback.category_scores.structure * 0.25
            + feedback.category_scores.relevance * 0.20
        )

        assert abs(feedback.overall_score - expected_score) < 1  # Allow rounding difference

    @pytest.mark.unit
    async def test_feedback_category_scores(
        self, sample_transcript, mock_gemini_service
    ):
        """Test that category scores are within valid range."""
        feedback = await generate_interview_feedback(
            session_id="test-123",
            transcript=sample_transcript,
            target_role="Backend Developer",
            interview_type="behavioral",
        )

        assert 0 <= feedback.category_scores.content <= 100
        assert 0 <= feedback.category_scores.delivery <= 100
        assert 0 <= feedback.category_scores.structure <= 100
        assert 0 <= feedback.category_scores.relevance <= 100

    @pytest.mark.unit
    async def test_feedback_with_minimal_transcript(self, mock_gemini_service):
        """Test feedback generation with minimal transcript."""
        minimal_transcript = [
            {"speaker": "agent", "text": "Question?", "timestamp": 1000},
            {"speaker": "user", "text": "Short answer", "timestamp": 2000},
        ]

        feedback = await generate_interview_feedback(
            session_id="test-123",
            transcript=minimal_transcript,
            target_role="Backend Developer",
            interview_type="behavioral",
        )

        assert feedback is not None
        assert feedback.overall_score >= 0
        assert feedback.speaking_metrics is not None


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    @pytest.mark.unit
    def test_speaking_metrics_extreme_response_times(self):
        """Test handling of extreme response times."""
        transcript = [
            {"speaker": "agent", "text": "Question", "timestamp": 1000},
            {"speaker": "user", "text": "Answer", "timestamp": 50000},  # 49 second delay
        ]
        metrics = _calculate_speaking_metrics(transcript)

        # Should filter out unreasonably long response times (>30s)
        assert metrics.average_response_time < 30 or metrics.average_response_time == 2.0

    @pytest.mark.unit
    def test_star_analysis_partial_data(self):
        """Test STAR analysis with partial data."""
        analyses = [
            {
                "question": "Tell me about a project.",
                "response_summary": "Project description",
                "score": 70,
                "feedback": "Good",
                "star_detected": {
                    "situation": "Situation here",
                    "task": None,
                    "action": "Action taken",
                    "result": None,
                },
            }
        ]

        feedback_list = _build_question_feedback(analyses)

        # Should still create StarAnalysis even with partial data
        assert feedback_list[0].star_analysis is not None
        assert feedback_list[0].star_analysis.situation == "Situation here"
        assert feedback_list[0].star_analysis.action == "Action taken"

    @pytest.mark.unit
    def test_filler_word_count_accuracy(self):
        """Test accurate filler word counting."""
        transcript = [
            {
                "speaker": "user",
                "text": "um um um like like you know",
                "timestamp": 1000,
            }
        ]
        metrics = _calculate_speaking_metrics(transcript)

        # Should count: 3 "um" + 2 "like" + 1 "you know" = 6
        assert metrics.filler_word_count == 6
