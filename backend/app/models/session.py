"""Session-related Pydantic models."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    """Request body for creating a new session."""

    target_role: str = Field(..., min_length=1, max_length=200, alias="targetRole")
    target_company: Optional[str] = Field(None, max_length=200, alias="targetCompany")
    interview_type: Literal["behavioral", "technical", "mixed"] = Field(
        default="behavioral", alias="interviewType"
    )
    interview_length: Literal["short", "medium", "long"] = Field(
        default="short", alias="interviewLength"  # Short by default (5-7 questions) to encourage usage
    )
    difficulty_level: Literal["easy", "medium", "hard"] = Field(
        default="easy", alias="difficultyLevel"  # Easy by default to encourage usage
    )
    # Saved job reference (single source of truth for artifacts)
    saved_job_id: Optional[str] = Field(None, alias="savedJobId")
    # Full job data for interviewer context
    job_data: Optional[dict] = Field(None, alias="jobData")

    class Config:
        populate_by_name = True


class SessionData(BaseModel):
    """Session data model."""

    session_id: str
    target_role: str
    target_company: Optional[str] = None
    interview_type: str
    interview_length: str = "short"
    difficulty_level: str = "easy"
    status: str = "created"
    interview_mode: Optional[Literal["voice", "text"]] = None  # Track which interview mode is being used
    created_at: datetime
    resume_data: Optional[dict] = None
    improved_resume_markdown: Optional[str] = None
    company_intel: Optional[dict] = None  # Stores generated company intelligence
    ai_discovery: Optional[dict] = None  # AI-recommended jobs data
    search_jobs: Optional[dict] = None  # Manual search jobs data
    # Saved job reference (single source of truth for artifacts)
    saved_job_id: Optional[str] = None
    # Full job data for interviewer context
    job_data: Optional[dict] = None


# ============================================================================
# JOB DISCOVERY MODELS
# ============================================================================


class TaskMeta(BaseModel):
    """Pipeline audit trail for job discovery operations."""

    resume_skills_extracted: Optional[list[str]] = Field(None, alias="resumeSkillsExtracted")
    suggested_roles_from_resume: Optional[list[str]] = Field(None, alias="suggestedRolesFromResume")
    query_generated: Optional[str] = Field(None, alias="queryGenerated")
    jsearch_params: Optional[dict] = Field(None, alias="jsearchParams")
    jsearch_results_count: Optional[int] = Field(None, alias="jsearchResultsCount")
    ai_matching_scores: Optional[list[dict]] = Field(None, alias="aiMatchingScores")
    pipeline_steps: Optional[list[dict]] = Field(None, alias="pipelineSteps")

    class Config:
        populate_by_name = True


class JobSearchFilters(BaseModel):
    """Search filters used for job search."""

    remote_only: bool = Field(default=False, alias="remoteOnly")
    country: str = "us"
    state_province: str = Field(default="", alias="stateProvince")
    city: str = ""
    date_posted: str = Field(default="all", alias="datePosted")
    employment_type: str = Field(default="", alias="employmentType")
    experience_level: str = Field(default="", alias="experienceLevel")
    salary_min: Optional[int] = Field(None, alias="salaryMin")

    class Config:
        populate_by_name = True


class AIDiscoveryData(BaseModel):
    """AI-recommended jobs data stored in session."""

    jobs: list[dict] = Field(default_factory=list)
    career_advice: Optional[dict] = Field(None, alias="careerAdvice")
    generated_at: datetime = Field(..., alias="generatedAt")
    task_meta: Optional[TaskMeta] = Field(None, alias="taskMeta")

    class Config:
        populate_by_name = True


class SearchJobsData(BaseModel):
    """Manual search jobs data stored in session."""

    jobs: list[dict] = Field(default_factory=list)
    career_advice: Optional[dict] = Field(None, alias="careerAdvice")
    last_query: str = Field(default="", alias="lastQuery")
    filters: Optional[JobSearchFilters] = None
    generated_at: datetime = Field(..., alias="generatedAt")
    task_meta: Optional[TaskMeta] = Field(None, alias="taskMeta")

    class Config:
        populate_by_name = True


class UpdateSessionRequest(BaseModel):
    """Request body for updating a session."""

    target_role: Optional[str] = Field(None, min_length=1, max_length=200, alias="targetRole")
    target_company: Optional[str] = Field(None, max_length=200, alias="targetCompany")
    interview_type: Optional[Literal["behavioral", "technical", "mixed"]] = Field(
        None, alias="interviewType"
    )
    interview_length: Optional[Literal["short", "medium", "long"]] = Field(
        None, alias="interviewLength"
    )
    difficulty_level: Optional[Literal["easy", "medium", "hard"]] = Field(
        None, alias="difficultyLevel"
    )
    # Saved job reference (single source of truth for artifacts)
    saved_job_id: Optional[str] = Field(None, alias="savedJobId")
    # Full job data for interviewer context
    job_data: Optional[dict] = Field(None, alias="jobData")

    class Config:
        populate_by_name = True


class CreateSessionResponse(BaseModel):
    """Response body for session creation."""

    session_id: str = Field(..., alias="sessionId")
    status: str
    interview_mode: Optional[str] = Field(None, alias="interviewMode")  # 'voice' or 'text'
    created_at: datetime = Field(..., alias="createdAt")

    class Config:
        populate_by_name = True


class DeleteSessionResponse(BaseModel):
    """Response body for session deletion."""

    session_id: str = Field(..., alias="sessionId")
    deleted: bool = True
    message: str = "Session deleted successfully"

    class Config:
        populate_by_name = True


class SessionSummary(BaseModel):
    """Summary of a single session for history listing."""

    session_id: str = Field(..., alias="sessionId")
    target_role: str = Field(..., alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")
    interview_type: str = Field(..., alias="interviewType")
    status: str
    created_at: datetime = Field(..., alias="createdAt")
    overall_score: Optional[int] = Field(None, alias="overallScore")
    has_resume_data: bool = Field(default=False, alias="hasResumeData")
    has_improved_resume: bool = Field(default=False, alias="hasImprovedResume")

    class Config:
        populate_by_name = True


class SessionHistoryResponse(BaseModel):
    """Response body for session history."""

    sessions: list[SessionSummary]
    total: int
    limit: int
    offset: int

    class Config:
        populate_by_name = True


class FullSessionResponse(BaseModel):
    """Full session data for restoration (Practice Again)."""

    session_id: str = Field(..., alias="sessionId")
    target_role: str = Field(..., alias="targetRole")
    target_company: Optional[str] = Field(None, alias="targetCompany")
    interview_type: str = Field(..., alias="interviewType")
    interview_length: str = Field(default="short", alias="interviewLength")
    difficulty_level: str = Field(default="easy", alias="difficultyLevel")
    status: str
    created_at: datetime = Field(..., alias="createdAt")

    # Saved job reference (single source of truth for artifacts)
    saved_job_id: Optional[str] = Field(None, alias="savedJobId")
    # Full job data for interviewer context
    job_data: Optional[dict] = Field(None, alias="jobData")

    # Full data for restoration
    resume_data: Optional[dict] = Field(None, alias="resumeData")
    improved_resume_markdown: Optional[str] = Field(None, alias="improvedResumeMarkdown")
    company_intel: Optional[dict] = Field(None, alias="companyIntel")

    # Job discovery data for restoration
    ai_discovery: Optional[dict] = Field(None, alias="aiDiscovery")
    search_jobs: Optional[dict] = Field(None, alias="searchJobs")

    # Flags
    has_resume_data: bool = Field(default=False, alias="hasResumeData")
    has_improved_resume: bool = Field(default=False, alias="hasImprovedResume")
    has_company_intel: bool = Field(default=False, alias="hasCompanyIntel")
    has_ai_discovery: bool = Field(default=False, alias="hasAiDiscovery")
    has_search_jobs: bool = Field(default=False, alias="hasSearchJobs")
    has_saved_job: bool = Field(default=False, alias="hasSavedJob")

    class Config:
        populate_by_name = True
