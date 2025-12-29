"""Pytest configuration and shared fixtures."""

import os
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def test_env():
    """Set up test environment variables."""
    os.environ["GOOGLE_CLOUD_PROJECT"] = "test-project"
    os.environ["ELEVENLABS_API_KEY"] = "test-elevenlabs-key"
    os.environ["ELEVENLABS_AGENT_ID"] = "test-agent-id"
    os.environ["CORS_ORIGINS"] = "http://localhost:3000"
    yield
    # Cleanup handled by OS


@pytest.fixture
def client(test_env) -> Generator[TestClient, None, None]:
    """FastAPI test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_resume_text() -> str:
    """Sample resume text for testing."""
    return """
    Patrick Ejelle-Ndille
    patrick@example.com | (123) 456-7890

    PROFESSIONAL SUMMARY
    Back-End Tester and QA Analyst with 2+ years of experience in software testing,
    security analysis, and API testing. Proven track record of identifying critical
    vulnerabilities and improving software quality.

    EXPERIENCE

    Back-End Tester / QA Analyst
    Guhuza Technologies | Toronto, ON | Jan 2023 - Present
    • Conducted comprehensive API testing using Postman and automated test scripts
    • Identified and documented 50+ critical bugs and security vulnerabilities
    • Implemented automated testing pipelines reducing testing time by 40%
    • Collaborated with development team to resolve issues and improve code quality

    Junior Software Developer
    TechStart Inc. | Toronto, ON | May 2021 - Dec 2022
    • Developed and maintained RESTful APIs using Python and FastAPI
    • Wrote unit tests achieving 85% code coverage
    • Participated in Agile development processes and sprint planning

    EDUCATION

    Information Technology Diploma
    triOS College | Toronto, ON | Expected January 2026

    SKILLS
    Python, JavaScript, FastAPI, React, SQL, PostgreSQL, Docker, Git, REST API,
    API Testing, Security Testing, Postman, Pytest, CI/CD, Agile, Scrum

    CERTIFICATIONS
    • CompTIA Security+ CE
    • Microsoft Azure Fundamentals
    • IBM Hackathon Winner (2x) - BrainStormX, Meeting Ledger
    """


@pytest.fixture
def sample_pdf_content() -> bytes:
    """Sample PDF content for testing (minimal valid PDF)."""
    # This is a minimal valid PDF file with "Test Resume" text
    return b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
50 700 Td
(Test Resume) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000368 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
457
%%EOF"""


@pytest.fixture
def sample_transcript() -> list[dict]:
    """Sample interview transcript for testing."""
    return [
        {
            "speaker": "agent",
            "text": "Tell me about a challenging project you worked on.",
            "timestamp": 1000,
        },
        {
            "speaker": "user",
            "text": "Um, so I worked on, like, a really challenging project at Guhuza where I, you know, "
                    "had to test the entire authentication system. The situation was that we had reports "
                    "of security vulnerabilities. My task was to identify all potential issues. "
                    "I took action by conducting comprehensive security testing and found a critical "
                    "MFA bypass vulnerability. The result was that we fixed it before any exploitation occurred.",
            "timestamp": 3000,
        },
        {
            "speaker": "agent",
            "text": "That's interesting. Can you tell me more about how you approached the testing?",
            "timestamp": 8000,
        },
        {
            "speaker": "user",
            "text": "Basically, I, like, created a testing framework using Pytest and, um, automated the "
                    "security checks. I mean, it was pretty comprehensive.",
            "timestamp": 10000,
        },
    ]


@pytest.fixture
def sample_session_data() -> dict:
    """Sample session data for testing."""
    return {
        "session_id": "test-session-123",
        "target_role": "Backend Developer",
        "target_company": "Google",
        "interview_type": "behavioral",
        "status": "created",
    }


@pytest.fixture
def mock_gemini_service(monkeypatch):
    """Mock Gemini AI service responses."""
    from app.services import gemini_service

    async def mock_parse_resume(text: str) -> dict:
        """Mock resume parsing response."""
        return {
            "name": "Patrick Ejelle-Ndille",
            "email": "patrick@example.com",
            "phone": "(123) 456-7890",
            "summary": "Back-End Tester and QA Analyst with 2+ years of experience",
            "skills": ["Python", "JavaScript", "FastAPI", "React", "SQL", "Docker"],
            "experience": [
                {
                    "company": "Guhuza Technologies",
                    "title": "Back-End Tester / QA Analyst",
                    "startDate": "Jan 2023",
                    "endDate": "Present",
                    "responsibilities": ["API testing", "Security analysis"],
                }
            ],
            "education": [
                {
                    "institution": "triOS College",
                    "degree": "Information Technology Diploma",
                    "graduationDate": "Expected January 2026",
                }
            ],
            "key_achievements": [
                "2x IBM Hackathon Winner",
                "CompTIA Security+ certified",
            ],
            "suggested_roles": ["Backend Developer", "QA Engineer", "Security Analyst"],
            "skill_graph": {
                "technical": [
                    {"name": "Python", "level": "Advanced", "years": 3},
                    {"name": "API Testing", "level": "Expert", "years": 2},
                ],
                "soft_skills": [
                    {"name": "Problem Solving", "level": "Advanced"},
                ],
            },
            "career_signals": {
                "seniority_level": "Mid-level",
                "years_experience": 4,
                "career_trajectory": "Upward",
                "industries": ["Technology", "Software"],
            },
            "star_stories": [
                {
                    "title": "Critical Security Vulnerability",
                    "situation": "Reports of security vulnerabilities in authentication",
                    "task": "Identify all potential security issues",
                    "action": "Conducted comprehensive security testing",
                    "result": "Found and fixed critical MFA bypass before exploitation",
                }
            ],
            "talking_points": {
                "elevator_pitch": "Experienced QA professional specializing in security testing",
                "key_strengths": ["Security testing", "API testing", "Problem solving"],
                "unique_selling_points": ["2x hackathon winner", "Security certified"],
            },
        }

    async def mock_analyze_transcript(transcript: list[dict], target_role: str) -> dict:
        """Mock transcript analysis response."""
        return {
            "content_score": 75,
            "delivery_score": 68,
            "structure_score": 80,
            "relevance_score": 85,
            "strengths": [
                "Used STAR method effectively",
                "Provided specific technical details",
                "Demonstrated problem-solving skills",
            ],
            "areas_for_improvement": [
                "Reduce filler words (um, like, you know)",
                "Speak more confidently without hedging",
                "Provide more quantifiable results",
            ],
            "question_analyses": [
                {
                    "question": "Tell me about a challenging project you worked on.",
                    "response_summary": "Discussed security testing at Guhuza",
                    "score": 78,
                    "feedback": "Good use of STAR method, but contained several filler words",
                    "star_detected": {
                        "situation": "Security vulnerabilities in authentication",
                        "task": "Identify potential issues",
                        "action": "Comprehensive security testing",
                        "result": "Fixed critical MFA bypass",
                    },
                    "improvement_suggestion": "Reduce filler words and speak more confidently",
                }
            ],
        }

    monkeypatch.setattr(gemini_service, "parse_resume_with_gemini", mock_parse_resume)
    monkeypatch.setattr(gemini_service, "analyze_transcript", mock_analyze_transcript)

    return {
        "parse_resume": mock_parse_resume,
        "analyze_transcript": mock_analyze_transcript,
    }


@pytest.fixture
def mock_elevenlabs_service(monkeypatch):
    """Mock ElevenLabs API responses."""
    from app.services import elevenlabs_service

    async def mock_create_signed_url(session_id: str, agent_id: str, overrides: dict) -> dict:
        """Mock signed URL creation."""
        return {
            "signed_url": f"wss://api.elevenlabs.io/mock/{session_id}",
        }

    monkeypatch.setattr(
        elevenlabs_service,
        "create_signed_url",
        mock_create_signed_url,
    )

    return {"create_signed_url": mock_create_signed_url}
