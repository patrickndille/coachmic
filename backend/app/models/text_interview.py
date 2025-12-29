"""Pydantic models for Text Interview Mode.

This module defines the data models for text-based interview sessions,
which provide the same interview experience as voice interviews but
through a text chat interface.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class TextInterviewMessage(BaseModel):
    """A single message in the text interview conversation."""

    id: str = Field(..., description="Unique message ID")
    role: Literal["interviewer", "user"] = Field(
        ..., description="Who sent the message"
    )
    content: str = Field(..., description="Message text content")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")


class InterviewConfig(BaseModel):
    """Configuration for the interview session."""

    min_questions: int = Field(..., description="Minimum number of questions")
    max_questions: int = Field(..., description="Maximum number of questions")
    duration: str = Field(..., description="Expected duration (e.g., '20 minutes')")
    difficulty: str = Field(..., description="Difficulty level")
    interview_type: str = Field(
        ..., description="Type of interview (behavioral/technical/mixed)"
    )


class InterviewMetrics(BaseModel):
    """Real-time metrics tracked during the interview."""

    filler_word_count: int = Field(default=0, description="Total filler words detected")
    total_words_spoken: int = Field(default=0, description="Total words in user responses")
    total_speaking_time: int = Field(default=0, description="Estimated speaking time in seconds")
    filler_words_detected: list[str] = Field(
        default_factory=list, description="List of filler words found"
    )


class TextInterviewState(BaseModel):
    """Complete state of a text interview session."""

    session_id: str = Field(..., description="Session ID from main session")
    user_id: str = Field(..., description="Firebase user ID")
    status: Literal["active", "paused", "completed"] = Field(
        default="active", description="Current interview status"
    )
    system_prompt: str = Field(..., description="System prompt for Gemini")
    interview_config: InterviewConfig = Field(
        ..., description="Interview configuration"
    )
    messages: list[TextInterviewMessage] = Field(
        default_factory=list, description="Conversation history"
    )
    question_count: int = Field(default=1, description="Current question number")
    elapsed_time: int = Field(default=0, description="Elapsed time in seconds")
    metrics: InterviewMetrics = Field(
        default_factory=InterviewMetrics, description="Interview metrics"
    )
    started_at: Optional[datetime] = Field(default=None, description="When interview started")
    paused_at: Optional[datetime] = Field(default=None, description="When interview was paused")
    last_activity_at: Optional[datetime] = Field(
        default=None, description="Last activity timestamp"
    )


# Request/Response Models


class StartTextInterviewRequest(BaseModel):
    """Request to start a text interview."""

    clear_existing: bool = Field(
        default=False, description="Whether to clear any existing interview state"
    )


class StartTextInterviewResponse(BaseModel):
    """Response when starting a text interview."""

    session_id: str = Field(..., description="Session ID")
    first_message: str = Field(..., description="Interviewer's opening message")
    interview_config: InterviewConfig = Field(..., description="Interview configuration")
    candidate_name: Optional[str] = Field(
        default=None, description="Candidate name from resume"
    )


class TextInterviewMessageRequest(BaseModel):
    """Request to send a message in the interview."""

    message: str = Field(..., description="User's response text")
    elapsed_time: Optional[int] = Field(
        default=None, description="Current elapsed time in seconds"
    )


class TextInterviewMessageResponse(BaseModel):
    """Response after sending a message."""

    message: str = Field(..., description="Interviewer's response")
    question_count: int = Field(..., description="Current question number")
    max_questions: int = Field(..., description="Maximum questions for this interview")
    is_closing_statement: bool = Field(
        default=False, description="Whether this is the closing statement"
    )
    metrics: InterviewMetrics = Field(..., description="Updated metrics")


class PauseTextInterviewRequest(BaseModel):
    """Request to pause the interview."""

    elapsed_time: int = Field(..., description="Current elapsed time in seconds")
    metrics: Optional[InterviewMetrics] = Field(
        default=None, description="Current metrics to save"
    )


class TextInterviewStateResponse(BaseModel):
    """Response containing interview state for resume."""

    has_state: bool = Field(..., description="Whether there is saved state")
    session_id: Optional[str] = Field(default=None, description="Session ID")
    status: Optional[str] = Field(default=None, description="Interview status")
    messages: list[TextInterviewMessage] = Field(
        default_factory=list, description="Saved messages"
    )
    question_count: int = Field(default=0, description="Questions asked so far")
    elapsed_time: int = Field(default=0, description="Elapsed time in seconds")
    metrics: Optional[InterviewMetrics] = Field(default=None, description="Saved metrics")
    interview_config: Optional[InterviewConfig] = Field(
        default=None, description="Interview configuration"
    )


class ResumeTextInterviewResponse(BaseModel):
    """Response when resuming a text interview."""

    session_id: str = Field(..., description="Session ID")
    resume_message: str = Field(..., description="Interviewer's resume message")
    messages: list[TextInterviewMessage] = Field(
        ..., description="Previous conversation history"
    )
    question_count: int = Field(..., description="Current question number")
    elapsed_time: int = Field(..., description="Previously elapsed time")
    metrics: InterviewMetrics = Field(..., description="Previous metrics")
    interview_config: InterviewConfig = Field(..., description="Interview configuration")
