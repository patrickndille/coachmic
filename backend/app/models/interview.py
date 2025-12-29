"""Interview-related Pydantic models."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Question(BaseModel):
    """Interview question model."""

    id: str
    text: str
    type: Literal["behavioral", "technical", "situational"]
    category: str


class QuestionsResponse(BaseModel):
    """Response body for retrieving interview questions."""

    session_id: str = Field(..., alias="sessionId")
    questions: list[Question]
    total_count: int = Field(..., alias="totalCount")

    class Config:
        populate_by_name = True


class StartInterviewRequest(BaseModel):
    """Request body for starting an interview."""

    session_id: str = Field(..., alias="session_id")

    class Config:
        populate_by_name = True


class ConversationOverrides(BaseModel):
    """Overrides for ElevenLabs conversation."""

    system_prompt: str = Field(..., alias="systemPrompt")
    first_message: str = Field(..., alias="firstMessage")

    class Config:
        populate_by_name = True


class StartInterviewResponse(BaseModel):
    """Response body for starting an interview."""

    signed_url: str = Field(..., alias="signedUrl")
    agent_id: str = Field(..., alias="agentId")
    expires_at: str = Field(..., alias="expiresAt")
    overrides: ConversationOverrides

    class Config:
        populate_by_name = True


class EndInterviewRequest(BaseModel):
    """Request body for ending an interview."""

    session_id: str


# ============================================================================
# INTERVIEW STATE PERSISTENCE MODELS
# ============================================================================


class InterviewTranscriptEntry(BaseModel):
    """Single transcript entry for persistence."""

    id: str
    speaker: Literal["agent", "user"]
    text: str
    timestamp: int  # Unix timestamp in milliseconds

    model_config = ConfigDict(populate_by_name=True)


class InterviewMetrics(BaseModel):
    """Real-time interview metrics."""

    filler_word_count: int = Field(0, alias="fillerWordCount")
    total_words_spoken: int = Field(0, alias="totalWordsSpoken")
    total_speaking_time: int = Field(0, alias="totalSpeakingTime")  # in seconds

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class InterviewStateData(BaseModel):
    """Complete interview state for persistence and resume."""

    session_id: str = Field(..., alias="sessionId")
    user_id: str  # No alias - stored as snake_case for consistency with other collections
    status: Literal["active", "paused", "completed"] = "active"
    transcript: list[InterviewTranscriptEntry] = Field(default_factory=list)
    elapsed_time: int = Field(0, alias="elapsedTime")  # in seconds
    question_count: int = Field(0, alias="questionCount")
    metrics: InterviewMetrics = Field(default_factory=InterviewMetrics)
    started_at: datetime = Field(..., alias="startedAt")
    paused_at: Optional[datetime] = Field(None, alias="pausedAt")
    last_activity_at: datetime = Field(..., alias="lastActivityAt")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# Request/Response models for API endpoints


class SaveTranscriptEntryRequest(BaseModel):
    """Request to save a single transcript entry."""

    entry: InterviewTranscriptEntry

    model_config = ConfigDict(populate_by_name=True)


class SaveTranscriptBatchRequest(BaseModel):
    """Request to save multiple transcript entries."""

    entries: list[InterviewTranscriptEntry]
    elapsed_time: Optional[int] = Field(None, alias="elapsedTime")
    question_count: Optional[int] = Field(None, alias="questionCount")
    metrics: Optional[InterviewMetrics] = None

    model_config = ConfigDict(populate_by_name=True)


class PauseInterviewRequest(BaseModel):
    """Request to pause an interview."""

    elapsed_time: int = Field(..., alias="elapsedTime")
    question_count: int = Field(..., alias="questionCount")
    metrics: Optional[InterviewMetrics] = None

    model_config = ConfigDict(populate_by_name=True)


class InterviewStateResponse(BaseModel):
    """Response with interview state for resuming."""

    has_state: bool = Field(..., alias="hasState")
    session_id: Optional[str] = Field(None, alias="sessionId")
    transcript: list[InterviewTranscriptEntry] = Field(default_factory=list)
    elapsed_time: int = Field(0, alias="elapsedTime")
    question_count: int = Field(0, alias="questionCount")
    metrics: Optional[InterviewMetrics] = None
    paused_at: Optional[str] = Field(None, alias="pausedAt")
    status: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
