"""Feedback generation service."""

import re
import uuid
from datetime import datetime
from typing import Optional

from app.models.feedback import (
    CategoryScores,
    FeedbackData,
    QuestionFeedback,
    SpeakingMetrics,
    StarAnalysis,
)
from app.services.gemini_service import analyze_transcript


async def generate_interview_feedback(
    session_id: str,
    transcript: list[dict],
    target_role: str,
    interview_type: str,
) -> FeedbackData:
    """
    Generate comprehensive feedback for an interview.

    Args:
        session_id: The session identifier
        transcript: List of transcript entries
        target_role: The role being interviewed for
        interview_type: Type of interview (behavioral, technical, mixed)

    Returns:
        Complete FeedbackData object
    """
    # Calculate speaking metrics from transcript
    speaking_metrics = _calculate_speaking_metrics(transcript)

    # Count actual questions asked (agent messages)
    actual_question_count = sum(1 for e in transcript if e.get("speaker") == "agent")
    print(f"[Feedback] Actual questions in transcript: {actual_question_count}")

    # Analyze transcript with Gemini
    analysis = await analyze_transcript(transcript, target_role)

    # Extract question feedback from analysis
    question_analyses = analysis.get("question_analyses", [])

    # Validate: truncate if Gemini hallucinated extra questions
    if len(question_analyses) > actual_question_count:
        print(f"[Feedback] WARNING: Gemini returned {len(question_analyses)} questions but only {actual_question_count} were asked. Truncating.")
        question_analyses = question_analyses[:actual_question_count]

    question_feedback = _build_question_feedback(question_analyses)

    # Calculate overall score
    category_scores = CategoryScores(
        content=analysis.get("content_score", 70),
        delivery=analysis.get("delivery_score", 70),
        structure=analysis.get("structure_score", 70),
        relevance=analysis.get("relevance_score", 70),
    )

    overall_score = (
        category_scores.content * 0.35
        + category_scores.delivery * 0.20
        + category_scores.structure * 0.25
        + category_scores.relevance * 0.20
    )

    return FeedbackData(
        sessionId=session_id,
        overallScore=int(overall_score),
        categoryScores=category_scores,
        speakingMetrics=speaking_metrics,
        strengths=analysis.get("strengths", []),
        areasForImprovement=analysis.get("areas_for_improvement", []),
        questionFeedback=question_feedback,
        generatedAt=datetime.utcnow().isoformat(),
    )


def _calculate_speaking_metrics(transcript: list[dict]) -> SpeakingMetrics:
    """Calculate speaking metrics from transcript."""
    user_entries = [e for e in transcript if e.get("speaker") == "user"]

    if not user_entries:
        return SpeakingMetrics(
            wordsPerMinute=0,
            fillerWordCount=0,
            fillerWords=[],
            averageResponseTime=0,
            totalSpeakingTime=0,
        )

    # Calculate total words and speaking time
    total_words = 0
    filler_counts: dict[str, int] = {}
    response_times: list[float] = []

    filler_patterns = [
        r"\bum\b", r"\buh\b", r"\blike\b", r"\byou know\b",
        r"\bbasically\b", r"\bactually\b", r"\bso\b", r"\bi mean\b",
    ]

    prev_timestamp = None
    for i, entry in enumerate(transcript):
        if entry.get("speaker") == "user":
            text = entry.get("text", "")
            words = text.split()
            total_words += len(words)

            # Count filler words
            text_lower = text.lower()
            for pattern in filler_patterns:
                matches = re.findall(pattern, text_lower)
                if matches:
                    word = pattern.replace(r"\b", "").strip()
                    filler_counts[word] = filler_counts.get(word, 0) + len(matches)

            # Calculate response time (time since last agent message)
            if i > 0 and transcript[i - 1].get("speaker") == "agent":
                prev_ts = transcript[i - 1].get("timestamp", 0)
                curr_ts = entry.get("timestamp", 0)
                if prev_ts and curr_ts:
                    response_time = (curr_ts - prev_ts) / 1000  # ms to seconds
                    if 0 < response_time < 30:  # Reasonable range
                        response_times.append(response_time)

    # Estimate speaking time based on average words per minute (150 WPM average)
    estimated_speaking_time = int((total_words / 150) * 60)

    # Calculate WPM
    wpm = int((total_words / max(estimated_speaking_time, 60)) * 60) if total_words else 0
    wpm = min(max(wpm, 80), 200)  # Clamp to reasonable range

    # Get top filler words
    sorted_fillers = sorted(filler_counts.items(), key=lambda x: x[1], reverse=True)
    top_fillers = [word for word, _ in sorted_fillers[:5]]

    return SpeakingMetrics(
        wordsPerMinute=wpm,
        fillerWordCount=sum(filler_counts.values()),
        fillerWords=top_fillers,
        averageResponseTime=round(sum(response_times) / len(response_times), 1) if response_times else 2.0,
        totalSpeakingTime=estimated_speaking_time,
    )


def _build_question_feedback(analyses: list[dict]) -> list[QuestionFeedback]:
    """Build QuestionFeedback objects from Gemini analysis."""
    feedback_list = []

    for analysis in analyses:
        star_data = analysis.get("star_detected", {})
        star_analysis = None

        if star_data and any(star_data.values()):
            star_analysis = StarAnalysis(
                situation=star_data.get("situation"),
                task=star_data.get("task"),
                action=star_data.get("action"),
                result=star_data.get("result"),
            )

        # Handle None values for score - Gemini sometimes returns null
        raw_score = analysis.get("score")
        score = int(raw_score) if raw_score is not None else 70

        feedback_list.append(
            QuestionFeedback(
                questionId=str(uuid.uuid4()),
                question=analysis.get("question", ""),
                userResponse=analysis.get("response_summary", ""),
                score=score,
                feedback=analysis.get("feedback", ""),
                starAnalysis=star_analysis,
                suggestedImprovement=analysis.get("improvement_suggestion"),
            )
        )

    return feedback_list
