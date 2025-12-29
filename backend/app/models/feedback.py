"""Feedback-related Pydantic models."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class TranscriptEntry(BaseModel):
    """Single transcript entry."""

    id: str
    speaker: Literal["agent", "user"]
    text: str
    timestamp: int


class GenerateFeedbackRequest(BaseModel):
    """Request body for generating feedback."""

    session_id: str
    transcript: list[TranscriptEntry]


class StarAnalysis(BaseModel):
    """STAR method analysis for behavioral questions."""

    situation: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None


class QuestionFeedback(BaseModel):
    """Feedback for a single question."""

    question_id: str = Field(..., alias="questionId")
    question: str
    user_response: str = Field(..., alias="userResponse")
    score: int = Field(..., ge=0, le=100)
    feedback: str
    star_analysis: Optional[StarAnalysis] = Field(None, alias="starAnalysis")
    suggested_improvement: Optional[str] = Field(None, alias="suggestedImprovement")

    class Config:
        populate_by_name = True


class CategoryScores(BaseModel):
    """Scores by category."""

    content: int = Field(..., ge=0, le=100)
    delivery: int = Field(..., ge=0, le=100)
    structure: int = Field(..., ge=0, le=100)
    relevance: int = Field(..., ge=0, le=100)


class SpeakingMetrics(BaseModel):
    """Speaking metrics analysis."""

    words_per_minute: int = Field(..., alias="wordsPerMinute")
    filler_word_count: int = Field(..., alias="fillerWordCount")
    filler_words: list[str] = Field(default_factory=list, alias="fillerWords")
    average_response_time: float = Field(..., alias="averageResponseTime")
    total_speaking_time: int = Field(..., alias="totalSpeakingTime")

    class Config:
        populate_by_name = True


class FeedbackData(BaseModel):
    """Complete feedback data."""

    session_id: str = Field(..., alias="sessionId")
    overall_score: int = Field(..., ge=0, le=100, alias="overallScore")
    category_scores: CategoryScores = Field(..., alias="categoryScores")
    speaking_metrics: SpeakingMetrics = Field(..., alias="speakingMetrics")
    strengths: list[str]
    areas_for_improvement: list[str] = Field(..., alias="areasForImprovement")
    question_feedback: list[QuestionFeedback] = Field(..., alias="questionFeedback")
    generated_at: str = Field(..., alias="generatedAt")
    # Session context (for displaying feedback without needing to fetch session separately)
    target_role: Optional[str] = Field(None, alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")

    class Config:
        populate_by_name = True


class FeedbackStatusResponse(BaseModel):
    """Response for feedback status check."""

    status: Literal["processing", "completed", "failed"]
    progress: Optional[int] = Field(None, ge=0, le=100)
    message: Optional[str] = None
