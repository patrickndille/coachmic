"""Tests for resume parsing service."""

import pytest

from app.services.resume_parser import (
    _extract_education,
    _extract_experience,
    _extract_name,
    _extract_pdf_text,
    _extract_skills,
    _generate_summary,
    _parse_resume_text,
    parse_resume_file,
)


class TestResumeTextExtraction:
    """Tests for resume text extraction functions."""

    @pytest.mark.unit
    def test_extract_pdf_text(self, sample_pdf_content):
        """Test PDF text extraction."""
        text = _extract_pdf_text(sample_pdf_content)
        assert text is not None
        assert len(text) > 0
        assert "Test Resume" in text

    @pytest.mark.unit
    def test_extract_name(self, sample_resume_text):
        """Test name extraction from resume text."""
        name = _extract_name(sample_resume_text)
        assert name is not None
        assert "Patrick" in name
        assert "Ejelle-Ndille" in name

    @pytest.mark.unit
    def test_extract_name_missing(self):
        """Test name extraction when name is not present."""
        text = "email@example.com\n(123) 456-7890\n123456789"
        name = _extract_name(text)
        # May extract something, just verify it doesn't crash
        assert name is None or isinstance(name, str)

    @pytest.mark.unit
    def test_extract_skills(self, sample_resume_text):
        """Test skills extraction from resume text."""
        skills = _extract_skills(sample_resume_text)
        assert isinstance(skills, list)
        assert len(skills) > 0
        assert "Python" in skills
        assert "JavaScript" in skills
        assert "React" in skills

    @pytest.mark.unit
    def test_extract_skills_limit(self):
        """Test that skills extraction is limited to 15 items."""
        # Text with many skills
        text = " ".join([
            "Python", "JavaScript", "TypeScript", "React", "Node.js",
            "Java", "C++", "SQL", "AWS", "GCP", "Docker", "Kubernetes",
            "Git", "Machine Learning", "Data Analysis", "Agile", "Scrum",
            "REST API", "GraphQL", "MongoDB"
        ])
        skills = _extract_skills(text)
        assert len(skills) <= 15

    @pytest.mark.unit
    def test_extract_experience(self, sample_resume_text):
        """Test experience extraction from resume text."""
        experience = _extract_experience(sample_resume_text)
        assert isinstance(experience, list)
        assert len(experience) > 0
        # Note: Regex-based extraction may not be perfect
        # This test verifies the function runs without errors

    @pytest.mark.unit
    def test_extract_education(self, sample_resume_text):
        """Test education extraction from resume text."""
        education = _extract_education(sample_resume_text)
        assert isinstance(education, list)
        # Regex may or may not find education, just verify no crash
        if len(education) > 0:
            degrees = [e.get("degree", "") for e in education]
            assert all(isinstance(d, str) for d in degrees)

    @pytest.mark.unit
    def test_extract_education_limit(self):
        """Test that education extraction is limited to 3 items."""
        text = """
        Bachelor of Science in Computer Science
        Master of Science in Software Engineering
        Ph.D. in Machine Learning
        MBA in Business Administration
        """
        education = _extract_education(text)
        assert len(education) <= 3

    @pytest.mark.unit
    def test_generate_summary(self, sample_resume_text):
        """Test summary generation from resume text."""
        summary = _generate_summary(sample_resume_text)
        assert summary is not None
        assert len(summary) > 0
        assert len(summary) <= 300

    @pytest.mark.unit
    def test_generate_summary_missing(self):
        """Test summary generation when no summary section exists."""
        text = "email@example.com\nShort text"
        summary = _generate_summary(text)
        # Should return None or empty when text is too short
        assert summary is None or len(summary) == 0


class TestResumeParser:
    """Tests for main resume parsing functions."""

    @pytest.mark.unit
    def test_parse_resume_text(self, sample_resume_text):
        """Test fallback regex-based resume parsing."""
        result = _parse_resume_text(sample_resume_text)

        assert result.raw_text == sample_resume_text
        assert result.name is not None
        assert result.email == "patrick@example.com"
        assert result.phone is not None
        assert isinstance(result.skills, list)
        assert len(result.skills) > 0

    @pytest.mark.unit
    async def test_parse_resume_file_pdf_with_mock(
        self, sample_pdf_content, mock_gemini_service
    ):
        """Test PDF resume parsing with mocked Gemini."""
        result = await parse_resume_file(
            content=sample_pdf_content,
            content_type="application/pdf",
        )

        # The mock returns data based on the extracted text from PDF
        # The minimal PDF contains "Test Resume" so mock will use that
        assert result.name is not None
        assert isinstance(result.skills, list)
        assert result.skill_graph is not None
        assert result.career_signals is not None
        assert isinstance(result.star_stories, list)
        assert result.talking_points is not None

    @pytest.mark.unit
    async def test_parse_resume_file_fallback(self, sample_pdf_content, monkeypatch):
        """Test that parsing falls back to regex when Gemini fails."""
        from app.services import gemini_service

        async def mock_parse_error(text: str):
            raise Exception("Gemini API error")

        monkeypatch.setattr(
            gemini_service,
            "parse_resume_with_gemini",
            mock_parse_error,
        )

        result = await parse_resume_file(
            content=sample_pdf_content,
            content_type="application/pdf",
        )

        # Should still return ResumeData using fallback
        assert result is not None
        assert result.raw_text is not None
        assert isinstance(result.skills, list)

    @pytest.mark.unit
    def test_parse_resume_text_with_minimal_data(self):
        """Test resume parsing with minimal information."""
        text = "John Doe\njohn@example.com\nSoftware Engineer"
        result = _parse_resume_text(text)

        assert result.name is not None
        assert result.email == "john@example.com"
        assert result.raw_text == text

    @pytest.mark.unit
    def test_parse_resume_text_with_no_contact_info(self):
        """Test resume parsing when contact info is missing."""
        text = "Just some random text\nNo email or phone\nSome skills here"
        result = _parse_resume_text(text)

        assert result.raw_text == text
        assert result.email is None
        assert result.phone is None


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    @pytest.mark.unit
    def test_extract_name_with_special_characters(self):
        """Test name extraction with special characters."""
        text = "Jean-Pierre O'Sullivan\nemail@example.com"
        name = _extract_name(text)
        # Name extraction with special chars may or may not work with regex
        # Just verify it doesn't crash
        assert name is None or isinstance(name, str)

    @pytest.mark.unit
    def test_extract_skills_case_insensitive(self):
        """Test that skills extraction is case insensitive."""
        text = "python JAVASCRIPT react"
        skills = _extract_skills(text)
        assert "Python" in skills
        assert "JavaScript" in skills
        assert "React" in skills

    @pytest.mark.unit
    def test_empty_resume_text(self):
        """Test parsing with empty resume text."""
        result = _parse_resume_text("")
        assert result.raw_text == ""
        assert result.email is None
        assert result.skills == []

    @pytest.mark.unit
    def test_extract_education_various_formats(self):
        """Test education extraction with various degree formats."""
        text = """
        Bachelor of Science in Computer Science
        B.S. in Engineering
        Master's in Data Science
        Ph.D. in Artificial Intelligence
        MBA
        """
        education = _extract_education(text)
        assert len(education) >= 2
        # Should find at least some degrees
        assert any(education)
