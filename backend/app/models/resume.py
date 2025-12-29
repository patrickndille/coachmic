"""Resume-related Pydantic models."""

from datetime import datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# RESUME VERSION MODELS (Firebase Storage persistence)
# ============================================================================


class ResumeVersion(BaseModel):
    """Represents a stored resume file version in Firebase Storage."""
    model_config = ConfigDict(populate_by_name=True)

    version_id: str = Field(..., alias="versionId")
    storage_path: str = Field(..., alias="storagePath")
    download_url: str = Field(..., alias="downloadUrl")
    file_name: str = Field(..., alias="fileName")
    file_type: str = Field(..., alias="fileType")  # pdf, docx
    file_size: int = Field(..., alias="fileSize")
    uploaded_at: datetime = Field(..., alias="uploadedAt")
    is_ai_improved: bool = Field(default=False, alias="isAiImproved")
    source_version_id: Optional[str] = Field(None, alias="sourceVersionId")


class ResumeVersionResponse(BaseModel):
    """Response for a single resume version."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    version: ResumeVersion
    message: Optional[str] = None


class ResumeVersionListResponse(BaseModel):
    """Response for listing all resume versions."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    versions: List[ResumeVersion]
    current_version_id: Optional[str] = Field(None, alias="currentVersionId")
    message: Optional[str] = None


class SetCurrentVersionRequest(BaseModel):
    """Request to set current resume version."""
    model_config = ConfigDict(populate_by_name=True)

    version_id: str = Field(..., alias="versionId")


class SetCurrentVersionResponse(BaseModel):
    """Response for setting current version."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    message: Optional[str] = None


class GenerateImprovedPDFRequest(BaseModel):
    """Request to generate PDF from improved resume markdown."""
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(..., alias="sessionId")
    set_as_current: bool = Field(default=False, alias="setAsCurrent")


class GenerateImprovedPDFResponse(BaseModel):
    """Response for PDF generation."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    version: Optional[ResumeVersion] = None
    message: Optional[str] = None


# ============================================================================
# ENHANCED RESUME PARSING MODELS
# ============================================================================


class SkillItem(BaseModel):
    """Individual skill with assessment."""

    name: str
    level: Literal["beginner", "intermediate", "expert"] = "intermediate"
    years: Optional[float] = None  # Float to handle fractional years (e.g., 0.25 = 3 months)
    evidence: Optional[str] = None


class SkillGraph(BaseModel):
    """Comprehensive skill assessment."""

    technical: list[SkillItem] = Field(default_factory=list)
    soft: list[SkillItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class CareerSignals(BaseModel):
    """Career trajectory indicators."""
    model_config = ConfigDict(populate_by_name=True)

    seniority_level: Optional[str] = Field(None, alias="seniorityLevel")
    industry_focus: list[str] = Field(default_factory=list, alias="industryFocus")
    career_trajectory: Optional[str] = Field(None, alias="careerTrajectory")
    years_experience: Optional[float] = Field(None, alias="yearsExperience")  # Float to handle 9.3 years etc.


class StarStory(BaseModel):
    """Pre-extracted STAR story from resume."""

    theme: str  # e.g., "leadership", "problem-solving", "technical"
    situation: str
    task: str
    action: str
    result: str
    metrics: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)


class TalkingPoints(BaseModel):
    """Generated talking points for interviews."""
    model_config = ConfigDict(populate_by_name=True)

    elevator_pitch: Optional[str] = Field(None, alias="elevatorPitch")
    key_strengths: list[str] = Field(default_factory=list, alias="keyStrengths")
    unique_value: Optional[str] = Field(None, alias="uniqueValue")


class CandidateLocation(BaseModel):
    """Extracted location from resume for job search targeting."""
    model_config = ConfigDict(populate_by_name=True)

    raw_address: Optional[str] = Field(None, alias="rawAddress")  # Original text from resume
    city: Optional[str] = None
    state_province: Optional[str] = Field(None, alias="stateProvince")  # e.g., "ON", "CA", "NY"
    country: Optional[str] = None  # e.g., "Canada", "United States"
    country_code: Optional[str] = Field(None, alias="countryCode")  # e.g., "ca", "us"


class SkillGap(BaseModel):
    """Individual skill gap for a target role."""
    model_config = ConfigDict(populate_by_name=True)

    skill: str
    importance: Literal["low", "medium", "high"] = "medium"
    current_level: Optional[str] = Field(None, alias="currentLevel")
    required_level: Optional[str] = Field(None, alias="requiredLevel")
    recommendation: Optional[str] = None
    resources: list[dict] = Field(default_factory=list)


class GapAnalysis(BaseModel):
    """Gap analysis for a target role."""
    model_config = ConfigDict(populate_by_name=True)

    target_role: Optional[str] = Field(None, alias="targetRole")
    readiness_score: Optional[int] = Field(None, alias="readinessScore")
    strengths_for_role: list[str] = Field(default_factory=list, alias="strengthsForRole")
    gaps: list[SkillGap] = Field(default_factory=list)
    action_plan: dict = Field(default_factory=dict, alias="actionPlan")


class KeywordGap(BaseModel):
    """Missing keyword for ATS optimization."""
    model_config = ConfigDict(populate_by_name=True)

    keyword: str
    category: str  # technical, soft, industry, certification
    importance: Literal["low", "medium", "high"] = "medium"
    where_to_add: Optional[str] = Field(None, alias="whereToAdd")


class ATSIssue(BaseModel):
    """Individual ATS issue with description and severity."""

    issue: str
    description: str = ""
    severity: Literal["low", "medium", "high"] = "medium"


class ATSAnalysis(BaseModel):
    """ATS optimization analysis."""
    model_config = ConfigDict(populate_by_name=True)

    ats_score: int = Field(..., alias="atsScore")
    score_breakdown: dict = Field(default_factory=dict, alias="scoreBreakdown")
    ats_issues: list[ATSIssue] = Field(default_factory=list, alias="atsIssues")
    keyword_gaps: list[KeywordGap] = Field(default_factory=list, alias="keywordGaps")
    formatting_tips: list[str] = Field(default_factory=list, alias="formattingTips")
    industry_keywords: dict = Field(default_factory=dict, alias="industryKeywords")


# ============================================================================
# MAIN RESUME MODEL
# ============================================================================


class ResumeData(BaseModel):
    """Parsed resume data with enhanced analysis."""
    model_config = ConfigDict(populate_by_name=True)

    # Original fields
    raw_text: str = Field(..., alias="rawText")
    file_name: Optional[str] = Field(None, alias="fileName")  # Required by frontend
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[CandidateLocation] = None  # Extracted location for job search
    summary: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    experience: list[dict] = Field(default_factory=list, alias="experiences")  # Frontend uses 'experiences'
    education: list[dict] = Field(default_factory=list)
    key_achievements: list[str] = Field(default_factory=list, alias="keyAchievements")
    suggested_roles: list[str] = Field(default_factory=list, alias="suggestedRoles")
    suggested_questions: list[str] = Field(default_factory=list, alias="suggestedQuestions")  # Frontend expects this

    # NEW: Enhanced parsing fields
    skill_graph: Optional[SkillGraph] = Field(None, alias="skillGraph")
    career_signals: Optional[CareerSignals] = Field(None, alias="careerSignals")
    star_stories: list[StarStory] = Field(default_factory=list, alias="starStories")
    talking_points: Optional[TalkingPoints] = Field(None, alias="talkingPoints")
    gap_analysis: Optional[GapAnalysis] = Field(None, alias="gapAnalysis")
    ats_analysis: Optional[ATSAnalysis] = Field(None, alias="atsAnalysis")


class ParseResumeResponse(BaseModel):
    """Response body for resume parsing."""
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    parsed_data: ResumeData = Field(..., alias="parsedData")
    message: Optional[str] = None
    session_id: Optional[str] = Field(None, alias="sessionId")
