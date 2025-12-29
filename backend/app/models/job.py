"""Job board and career matching Pydantic models."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# JOB POSTING MODELS
# ============================================================================


class SalaryRange(BaseModel):
    """Salary range for a job posting."""

    min_salary: Optional[int] = Field(None, alias="minSalary")
    max_salary: Optional[int] = Field(None, alias="maxSalary")
    currency: str = "USD"
    period: Literal["hourly", "yearly"] = "yearly"

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class JobPosting(BaseModel):
    """Job posting from a job board."""

    job_id: str = Field(..., alias="jobId")
    source: str = "mock"  # mock, indeed, linkedin, etc.
    title: str
    company: str
    location: str
    remote_type: Literal["remote", "hybrid", "onsite"] = Field(
        "onsite", alias="remoteType"
    )
    salary_range: Optional[SalaryRange] = Field(None, alias="salaryRange")
    posted_date: str = Field(..., alias="postedDate")
    description: str
    requirements: list[str] = Field(default_factory=list)
    nice_to_have: list[str] = Field(default_factory=list, alias="niceToHave")
    benefits: list[str] = Field(default_factory=list)
    url: Optional[str] = None
    company_logo: Optional[str] = Field(None, alias="companyLogo")
    experience_level: Optional[str] = Field(None, alias="experienceLevel")
    employment_type: Literal["full-time", "part-time", "contract", "internship"] = Field(
        "full-time", alias="employmentType"
    )

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# JOB FIT ANALYSIS MODELS
# ============================================================================


class SkillMatch(BaseModel):
    """Individual skill matching result."""

    skill: str
    required: bool = True
    candidate_level: Optional[str] = Field(None, alias="candidateLevel")
    required_level: Optional[str] = Field(None, alias="requiredLevel")
    match_score: int = Field(0, alias="matchScore")  # 0-100

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class PreparationItem(BaseModel):
    """Interview preparation recommendation."""

    topic: str
    urgency: Literal["low", "medium", "high"] = "medium"
    reason: Optional[str] = None
    resources: list[str] = Field(default_factory=list)

    @field_validator("urgency", mode="before")
    @classmethod
    def normalize_urgency(cls, v: str) -> str:
        """Normalize urgency to lowercase - Gemini sometimes returns 'High' instead of 'high'."""
        if isinstance(v, str):
            return v.lower().strip()
        return "medium"


class FitAnalysis(BaseModel):
    """AI-generated job fit analysis."""

    overall_match: int = Field(..., alias="overallMatch")  # 0-100
    skill_match: int = Field(..., alias="skillMatch")  # 0-100
    experience_match: int = Field(..., alias="experienceMatch")  # 0-100
    culture_signals: Optional[str] = Field(None, alias="cultureSignals")

    strengths_for_role: list[str] = Field(default_factory=list, alias="strengthsForRole")
    potential_concerns: list[str] = Field(default_factory=list, alias="potentialConcerns")
    interview_focus_areas: list[str] = Field(
        default_factory=list, alias="interviewFocusAreas"
    )
    preparation_priority: list[PreparationItem] = Field(
        default_factory=list, alias="preparationPriority"
    )
    skill_matches: list[SkillMatch] = Field(default_factory=list, alias="skillMatches")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class CareerTrajectory(BaseModel):
    """Career trajectory insights for a job."""

    current_fit: str = Field(..., alias="currentFit")
    growth_path: Optional[str] = Field(None, alias="growthPath")
    adjacent_roles: list[str] = Field(default_factory=list, alias="adjacentRoles")
    long_term_outlook: Optional[str] = Field(None, alias="longTermOutlook")
    time_to_next_level: Optional[str] = Field(None, alias="timeToNextLevel")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# JOB MATCH RESULT
# ============================================================================


class JobMatch(BaseModel):
    """Combined job posting with AI fit analysis."""

    job: JobPosting
    fit_analysis: FitAnalysis = Field(..., alias="fitAnalysis")
    career_trajectory: Optional[CareerTrajectory] = Field(
        None, alias="careerTrajectory"
    )
    saved: bool = False
    applied: bool = False
    
    # Auto-save tracking
    auto_saved: Optional[bool] = Field(None, alias="autoSaved")
    
    # Cover letter
    cover_letter: Optional[str] = Field(None, alias="coverLetter")
    cover_letter_generated_at: Optional[str] = Field(None, alias="coverLetterGeneratedAt")
    
    # Application tracking
    application_status: Optional[str] = Field(None, alias="applicationStatus")
    applied_at: Optional[str] = Field(None, alias="appliedAt")
    status_updated_at: Optional[str] = Field(None, alias="statusUpdatedAt")
    notes: Optional[str] = None
    follow_up_date: Optional[str] = Field(None, alias="followUpDate")

    # Company intelligence (job-specific)
    company_intel: Optional[dict] = Field(None, alias="companyIntel")
    company_intel_generated_at: Optional[str] = Field(None, alias="companyIntelGeneratedAt")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# CAREER ADVICE
# ============================================================================


class CareerAdvice(BaseModel):
    """AI-generated career advisory summary."""

    recommended_trajectory: str = Field(..., alias="recommendedTrajectory")
    immediate_opportunities: list[str] = Field(
        default_factory=list, alias="immediateOpportunities"
    )
    skill_investments: list[str] = Field(default_factory=list, alias="skillInvestments")
    market_insights: Optional[str] = Field(None, alias="marketInsights")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# API REQUEST/RESPONSE MODELS
# ============================================================================


class JobSearchRequest(BaseModel):
    """Request body for job search."""

    query: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    location: Optional[str] = None
    remote_only: bool = Field(False, alias="remoteOnly")
    experience_level: Optional[str] = Field(None, alias="experienceLevel")
    salary_min: Optional[int] = Field(None, alias="salaryMin")
    country: Optional[str] = None  # Country code for JSearch (us, ca, uk, etc.)
    limit: int = 10
    # New filter fields for JSearch API
    date_posted: Optional[str] = Field(None, alias="datePosted")  # all, today, 3days, week, month
    employment_type: Optional[str] = Field(None, alias="employmentType")  # FULLTIME, PARTTIME, CONTRACT, INTERN

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class JobSearchResponse(BaseModel):
    """Response body for job search with matches."""

    jobs: list[JobMatch] = Field(default_factory=list)
    total_count: int = Field(0, alias="totalCount")
    career_advice: Optional[CareerAdvice] = Field(None, alias="careerAdvice")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class JobDetailRequest(BaseModel):
    """Request for detailed job analysis."""

    job_id: str = Field(..., alias="jobId")
    session_id: Optional[str] = Field(None, alias="sessionId")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class JobDetailResponse(BaseModel):
    """Detailed job with full analysis."""

    job: JobPosting
    fit_analysis: Optional[FitAnalysis] = Field(None, alias="fitAnalysis")
    career_trajectory: Optional[CareerTrajectory] = Field(
        None, alias="careerTrajectory"
    )
    preparation_plan: Optional[dict] = Field(None, alias="preparationPlan")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class PrepareForJobRequest(BaseModel):
    """Request to generate interview prep for a specific job."""

    job_id: str = Field(..., alias="jobId")
    session_id: str = Field(..., alias="sessionId")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class InterviewPrepPlan(BaseModel):
    """Customized interview preparation plan for a job."""

    job_id: str = Field(..., alias="jobId")
    company: str
    role: str

    # Preparation sections
    key_topics: list[str] = Field(default_factory=list, alias="keyTopics")
    likely_questions: list[dict] = Field(default_factory=list, alias="likelyQuestions")
    star_stories_to_use: list[str] = Field(default_factory=list, alias="starStoriesToUse")
    skills_to_highlight: list[str] = Field(default_factory=list, alias="skillsToHighlight")
    gaps_to_address: list[str] = Field(default_factory=list, alias="gapsToAddress")
    company_research_points: list[str] = Field(
        default_factory=list, alias="companyResearchPoints"
    )
    questions_to_ask: list[str] = Field(default_factory=list, alias="questionsToAsk")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
