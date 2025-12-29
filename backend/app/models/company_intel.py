"""Company Intelligence models for interview preparation."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# NEWS AND UPDATES MODELS
# ============================================================================


class NewsItem(BaseModel):
    """Recent news or press release about the company."""

    title: str
    summary: str
    date: Optional[str] = None
    source: Optional[str] = None
    relevance_to_interview: Optional[str] = Field(None, alias="relevanceToInterview")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class LeadershipChange(BaseModel):
    """Leadership or organizational change."""

    name: str
    role: str
    change_type: Literal["new_hire", "departure", "promotion", "restructure", "no_change", "other"] = Field(
        ..., alias="changeType"
    )
    date: Optional[str] = None
    implications: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    @field_validator("change_type", mode="before")
    @classmethod
    def normalize_change_type(cls, v: str) -> str:
        """Normalize change_type to valid values - Gemini sometimes returns variations."""
        if not isinstance(v, str):
            return "other"
        v_lower = v.lower().strip()
        # Map common variations to valid values
        if "new_hire" in v_lower or "hire" in v_lower or "appointment" in v_lower or "joined" in v_lower:
            return "new_hire"
        if "departure" in v_lower or "left" in v_lower or "resigned" in v_lower or "retired" in v_lower:
            return "departure"
        if "promotion" in v_lower or "promoted" in v_lower:
            return "promotion"
        if "restructure" in v_lower or "reorgan" in v_lower:
            return "restructure"
        if "no_change" in v_lower or "no change" in v_lower:
            return "no_change"
        # If it's already a valid value, return as-is
        if v_lower in ["new_hire", "departure", "promotion", "restructure", "no_change", "other"]:
            return v_lower
        return "other"


# ============================================================================
# STRATEGIC AND CULTURE MODELS
# ============================================================================


class StrategicInitiative(BaseModel):
    """Company strategic initiative or direction."""

    title: str
    description: str
    relevance: Optional[str] = None
    interview_angle: Optional[str] = Field(None, alias="interviewAngle")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class CultureSignal(BaseModel):
    """Culture signal from job postings and public info."""

    signal: str
    evidence: str
    interview_tip: Optional[str] = Field(None, alias="interviewTip")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class FinancialHealth(BaseModel):
    """Financial health indicators (for public companies)."""

    is_public: bool = Field(..., alias="isPublic")
    stock_trend: Optional[str] = Field(None, alias="stockTrend")
    recent_earnings: Optional[str] = Field(None, alias="recentEarnings")
    growth_indicators: list[str] = Field(default_factory=list, alias="growthIndicators")
    concerns: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# INTERVIEW PREPARATION MODELS
# ============================================================================


class InterviewAngle(BaseModel):
    """Suggested interview angle or talking point."""

    topic: str
    why_relevant: str = Field(..., alias="whyRelevant")
    how_to_use: str = Field(..., alias="howToUse")
    sample_phrases: list[str] = Field(default_factory=list, alias="samplePhrases")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class PredictedQuestion(BaseModel):
    """AI-predicted interview question based on company context."""

    question: str
    question_type: Literal["behavioral", "technical", "situational", "company-specific"] = Field(
        ..., alias="type"
    )
    reasoning: str  # Why this question is likely
    preparation_tip: str = Field(..., alias="preparationTip")
    related_news: Optional[str] = Field(None, alias="relatedNews")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    @field_validator("question_type", mode="before")
    @classmethod
    def normalize_question_type(cls, v: str) -> str:
        """Normalize question_type to valid values."""
        if not isinstance(v, str):
            return "behavioral"
        v_lower = v.lower().strip()
        if "behavioral" in v_lower or "behavior" in v_lower:
            return "behavioral"
        if "technical" in v_lower or "tech" in v_lower:
            return "technical"
        if "situational" in v_lower or "situation" in v_lower:
            return "situational"
        if "company" in v_lower or "specific" in v_lower:
            return "company-specific"
        if v_lower in ["behavioral", "technical", "situational", "company-specific"]:
            return v_lower
        return "behavioral"  # Default fallback


class StoryToCompanyMapping(BaseModel):
    """Mapping of candidate's STAR story to company context."""

    story_theme: str = Field(..., alias="storyTheme")
    story_summary: str = Field(..., alias="storySummary")
    company_initiative: str = Field(..., alias="companyInitiative")
    connection_explanation: str = Field(..., alias="connectionExplanation")
    framing_tip: str = Field(..., alias="framingTip")
    emphasis_score: int = Field(..., alias="emphasisScore", ge=1, le=10)

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# MAIN COMPANY INTEL MODEL
# ============================================================================


class CompanyIntel(BaseModel):
    """Complete company intelligence briefing."""

    company_name: str = Field(..., alias="companyName")
    industry: Optional[str] = None
    headquarters: Optional[str] = None
    company_size: Optional[str] = Field(None, alias="companySize")
    founded: Optional[str] = None
    website: Optional[str] = None

    @field_validator("founded", mode="before")
    @classmethod
    def coerce_founded_to_string(cls, v):
        """Convert founded year (int) to string if necessary."""
        if v is None:
            return None
        return str(v)

    generated_at: str = Field(..., alias="generatedAt")
    data_freshness: Literal["real-time", "cached"] = Field(..., alias="dataFreshness")

    # Executive summary
    executive_summary: str = Field(..., alias="executiveSummary")
    key_talking_points: list[str] = Field(default_factory=list, alias="keyTalkingPoints")

    # Intelligence sections
    recent_news: list[NewsItem] = Field(default_factory=list, alias="recentNews")
    leadership_changes: list[LeadershipChange] = Field(
        default_factory=list, alias="leadershipChanges"
    )
    strategic_initiatives: list[StrategicInitiative] = Field(
        default_factory=list, alias="strategicInitiatives"
    )
    culture_signals: list[CultureSignal] = Field(default_factory=list, alias="cultureSignals")
    financial_health: Optional[FinancialHealth] = Field(None, alias="financialHealth")
    interview_angles: list[InterviewAngle] = Field(default_factory=list, alias="interviewAngles")

    # Question Predictor
    predicted_questions: list[PredictedQuestion] = Field(
        default_factory=list, alias="predictedQuestions"
    )

    # Story-to-Company Connector (requires resume)
    story_mappings: list[StoryToCompanyMapping] = Field(
        default_factory=list, alias="storyMappings"
    )

    # Source citations from Google Search grounding
    sources: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


# ============================================================================
# API REQUEST/RESPONSE MODELS
# ============================================================================


class GenerateCompanyIntelRequest(BaseModel):
    """Request to generate company intelligence."""

    company_name: str = Field(..., alias="companyName")
    target_role: Optional[str] = Field(None, alias="targetRole")
    job_id: Optional[str] = Field(None, alias="jobId")  # If from job discovery
    include_questions: bool = Field(True, alias="includeQuestions")
    include_story_mapping: bool = Field(True, alias="includeStoryMapping")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class CompanyIntelResponse(BaseModel):
    """Response with company intelligence."""

    success: bool
    intel: Optional[CompanyIntel] = None
    cached: bool = False
    cache_expires_at: Optional[str] = Field(None, alias="cacheExpiresAt")
    error: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
