"""User preference models."""

from pydantic import BaseModel, Field
from typing import Optional


class UserPreferences(BaseModel):
    """User preference settings."""

    # Interview preferences
    default_interview_type: str = Field(
        default="behavioral",
        description="Default interview type: behavioral, technical, or mixed"
    )
    default_interview_length: str = Field(
        default="short",
        description="Default interview length: short (5-7 questions), medium (10-12), long (15-20)"
    )
    difficulty_level: str = Field(
        default="easy",
        description="Question difficulty: easy, medium, or hard"
    )

    # Voice preferences
    voice_speed: float = Field(
        default=1.0,
        ge=0.8,
        le=1.2,
        description="Voice playback speed (0.8x - 1.2x)"
    )
    voice_accent: str = Field(
        default="us-english",
        description="Voice accent preference"
    )

    # Notification preferences
    email_notifications: bool = Field(
        default=True,
        description="Receive email notifications"
    )
    practice_reminders: bool = Field(
        default=True,
        description="Receive practice reminders"
    )
    weekly_summary: bool = Field(
        default=True,
        description="Receive weekly progress summaries"
    )

    # Privacy
    share_anonymous_data: bool = Field(
        default=False,
        description="Share anonymous usage data for product improvement"
    )

    # Display
    show_real_time_metrics: bool = Field(
        default=True,
        description="Show filler word counter and pacing during interview"
    )
    auto_save_transcripts: bool = Field(
        default=True,
        description="Automatically save interview transcripts"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "default_interview_type": "behavioral",
                "default_interview_length": "short",
                "difficulty_level": "easy",
                "voice_speed": 1.0,
                "voice_accent": "us-english",
                "email_notifications": True,
                "practice_reminders": True,
                "weekly_summary": True,
                "share_anonymous_data": False,
                "show_real_time_metrics": True,
                "auto_save_transcripts": True,
            }
        }
