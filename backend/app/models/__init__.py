"""Pydantic models for request/response validation."""

from app.models.feedback import (
    FeedbackData,
    FeedbackStatusResponse,
    GenerateFeedbackRequest,
    QuestionFeedback,
    SpeakingMetrics,
    StarAnalysis,
)
from app.models.interview import (
    EndInterviewRequest,
    StartInterviewRequest,
    StartInterviewResponse,
)
from app.models.job import (
    CareerAdvice,
    CareerTrajectory,
    FitAnalysis,
    InterviewPrepPlan,
    JobDetailRequest,
    JobDetailResponse,
    JobMatch,
    JobPosting,
    JobSearchRequest,
    JobSearchResponse,
    PrepareForJobRequest,
    PreparationItem,
    SalaryRange,
    SkillMatch,
)
from app.models.resume import ParseResumeResponse, ResumeData
from app.models.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    SessionData,
)

__all__ = [
    # Session
    "CreateSessionRequest",
    "CreateSessionResponse",
    "SessionData",
    # Resume
    "ParseResumeResponse",
    "ResumeData",
    # Interview
    "StartInterviewRequest",
    "StartInterviewResponse",
    "EndInterviewRequest",
    # Feedback
    "GenerateFeedbackRequest",
    "FeedbackData",
    "FeedbackStatusResponse",
    "QuestionFeedback",
    "StarAnalysis",
    "SpeakingMetrics",
    # Job Board
    "JobPosting",
    "JobMatch",
    "JobSearchRequest",
    "JobSearchResponse",
    "JobDetailRequest",
    "JobDetailResponse",
    "PrepareForJobRequest",
    "InterviewPrepPlan",
    "FitAnalysis",
    "CareerTrajectory",
    "CareerAdvice",
    "SalaryRange",
    "SkillMatch",
    "PreparationItem",
]
