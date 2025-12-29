"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict # type: ignore


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars not defined in the model
    )

    # Application
    app_name: str = "CoachMic"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    # Server
    host: str = "0.0.0.0"
    port: int = 8080

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,https://coachmic.com,https://voiceprep-ai-prod.web.app,https://voiceprep-ai-prod.firebaseapp.com"

    # Google Cloud
    gcp_project_id: Optional[str] = None
    gcp_location: str = "us-central1"
    gcs_bucket_name: Optional[str] = None
    gcp_api_key: Optional[str] = None  # For Gemini API key auth

    # Vertex AI / Gemini
    # Supported GA models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite,
    #                      gemini-2.0-flash, gemini-2.0-flash-001, gemini-2.0-flash-lite
    gemini_model: str = "gemini-2.5-flash"  # Default model
    
    # Task-specific model overrides (leave empty to use default gemini_model)
    # Pro models: Better quality, slower, more expensive
    # Flash models: Good balance of speed and quality
    # Lite models: Fastest, cheapest, good for simple tasks
    gemini_model_resume_parse: Optional[str] = "gemini-2.5-pro"  # Fallback for single-call mode
    # Split resume parsing for parallel execution (faster)
    gemini_model_resume_parse_basic: Optional[str] = "gemini-2.5-flash-lite"  # Basic extraction (name, skills, experience)
    gemini_model_resume_parse_career: Optional[str] = "gemini-2.5-pro"  # Career analysis (skill_graph, star_stories)
    gemini_model_ats_score: Optional[str] = "gemini-2.5-pro"  # e.g., "gemini-2.5-flash"
    gemini_model_resume_improve: Optional[str] = "gemini-2.5-pro"  # e.g., "gemini-2.5-pro"
    
    gemini_model_gap_analysis: Optional[str] = "gemini-2.5-flash-lite"  # e.g., "gemini-2.5-flash"
    gemini_model_job_matching: Optional[str] = "gemini-2.5-flash-lite"  # Stable model for job analysis (2.5-flash truncates)
    # Granular job-matching sub-task models (defaults to job_matching if not set)
    gemini_model_job_fit_analysis: Optional[str] = "gemini-2.5-flash-lite" # Main fit scoring - uses job_matching default
    gemini_model_career_trajectory: Optional[str] = "gemini-2.5-flash-lite"  # Growth path analysis - uses job_matching default
    gemini_model_career_advice: Optional[str] = "gemini-2.5-flash"  # Summary generation - uses job_matching default
    gemini_model_query_optimization: Optional[str] = "gemini-2.5-flash-lite"  # Search query scoring - uses job_matching default

    # Company Intel sub-task models (for interview prep research)
    gemini_model_company_intel: Optional[str] = "gemini-2.5-pro"  # Core intel with Google Search grounding
    gemini_model_predicted_questions: Optional[str] = "gemini-2.5-flash" # Falls back to company_intel
    gemini_model_story_mapping: Optional[str] = "gemini-2.5-flash-lite"  # Falls back to company_intel

    gemini_model_transcript: Optional[str] = "gemini-2.5-pro"  # e.g., "gemini-2.5-flash-lite"
    gemini_model_feedback: Optional[str] = "gemini-2.5-pro"  # e.g., "gemini-2.5-flash"
    gemini_model_cover_letter: Optional[str] = "gemini-2.5-pro"  # e.g., "gemini-2.5-flash"
    gemini_model_text_interview: Optional[str] = "gemini-2.5-pro"  # Text-based interview responses

    # JSearch (Job Search API)
    jsearch_api_url: str = "https://api.openwebninja.com/jsearch"
    jsearch_api_key: Optional[str] = None
    jsearch_default_country: str = "us"  # Default country for job search
    jsearch_cache_ttl: int = 900  # Cache results for 15 minutes

    # ElevenLabs
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_agent_id: Optional[str] = None

    # Firebase
    firebase_project_id: Optional[str] = None
    firebase_admin_key_path: Optional[str] = None
    firebase_database_url: Optional[str] = None

    # Encryption (Google Cloud KMS)
    kms_key_name: Optional[str] = None

    # Authentication
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Feature Flags
    require_auth_for_interviews: bool = True
    allow_anonymous_sessions: bool = True

    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds

    # File Upload
    max_upload_size: int = 5 * 1024 * 1024  # 5MB

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
