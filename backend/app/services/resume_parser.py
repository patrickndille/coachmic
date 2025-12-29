"""Resume parsing service."""

import io
import re
from typing import Optional

from pypdf import PdfReader
from docx import Document

from app.models.resume import ResumeData, ATSAnalysis, ATSIssue, KeywordGap
from app.services.gemini_service import parse_resume_with_gemini, calculate_ats_score_and_keywords


async def parse_resume_file(content: bytes, content_type: str) -> ResumeData:
    """Parse resume content from PDF or DOCX file."""
    if content_type == "application/pdf":
        text = _extract_pdf_text(content)
    else:
        text = _extract_docx_text(content)

    print(f"[ResumeParser] Extracted text length: {len(text)}")
    print(f"[ResumeParser] First 500 chars: {text[:500]}")

    # Use Gemini AI to parse the resume text
    try:
        parsed = await parse_resume_with_gemini(text)
        print(f"[ResumeParser] Gemini parsed name: {parsed.get('name')}")
        print(f"[ResumeParser] Gemini parsed skills: {parsed.get('skills', [])[:5]}")
        print(f"[ResumeParser] Gemini parsed skill_graph: {parsed.get('skill_graph') is not None}")
        print(f"[ResumeParser] Gemini parsed star_stories count: {len(parsed.get('star_stories', []))}")
        print(f"[ResumeParser] Gemini parsed career_signals: {parsed.get('career_signals') is not None}")
        print(f"[ResumeParser] Gemini parsed talking_points: {parsed.get('talking_points') is not None}")

        # Calculate ATS score and keyword suggestions
        skills = parsed.get("skills", [])
        suggested_roles = parsed.get("suggested_roles", [])
        target_role = suggested_roles[0] if suggested_roles else None

        try:
            ats_data = await calculate_ats_score_and_keywords(text, skills, target_role)
            print(f"[ResumeParser] ATS score calculated: {ats_data.get('ats_score')}")

            # Convert keyword gaps to KeywordGap objects
            keyword_gaps = []
            for gap in ats_data.get("keyword_gaps", []):
                keyword_gaps.append(KeywordGap(
                    keyword=gap.get("keyword"),
                    category=gap.get("category", "technical"),
                    importance=gap.get("importance", "medium"),
                    where_to_add=gap.get("where_to_add"),
                ))

            ats_analysis = ATSAnalysis(
                ats_score=ats_data.get("ats_score", 70),
                score_breakdown=ats_data.get("score_breakdown", {}),
                ats_issues=ats_data.get("ats_issues", []),
                keyword_gaps=keyword_gaps,
                formatting_tips=ats_data.get("formatting_tips", []),
                industry_keywords=ats_data.get("industry_keywords", {}),
            )
        except Exception as ats_error:
            print(f"[ResumeParser] ATS calculation failed: {ats_error}")
            ats_analysis = None

        return ResumeData(
            raw_text=text,
            name=parsed.get("name"),
            email=parsed.get("email"),
            phone=parsed.get("phone"),
            summary=parsed.get("summary"),
            skills=parsed.get("skills", []),
            experience=parsed.get("experience", []),
            education=parsed.get("education", []),
            key_achievements=parsed.get("key_achievements", []),
            suggested_roles=parsed.get("suggested_roles", []),
            # Enhanced parsing fields
            skill_graph=parsed.get("skill_graph"),
            career_signals=parsed.get("career_signals"),
            star_stories=parsed.get("star_stories", []),
            talking_points=parsed.get("talking_points"),
            ats_analysis=ats_analysis,
        )
    except Exception as e:
        print(f"[ResumeParser] Gemini parsing failed: {e}, falling back to regex")
        # Fallback to regex-based parsing
        return _parse_resume_text(text)










def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes."""
    reader = PdfReader(io.BytesIO(content))
    text_parts = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)

    return "\n".join(text_parts)

















def _extract_docx_text(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    doc = Document(io.BytesIO(content))
    text_parts = []

    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)

    return "\n".join(text_parts)











def _parse_resume_text(text: str) -> ResumeData:
    """Parse structured data from resume text."""
    # Extract email
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    email_match = re.search(email_pattern, text)
    email = email_match.group() if email_match else None

    # Extract phone
    phone_pattern = r"[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}"
    phone_match = re.search(phone_pattern, text)
    phone = phone_match.group() if phone_match else None

    # Extract name (usually first line or near email)
    name = _extract_name(text)

    # Extract skills (common patterns)
    skills = _extract_skills(text)

    # Extract experience sections
    experience = _extract_experience(text)

    # Extract education
    education = _extract_education(text)

    # Generate summary from first few meaningful lines
    summary = _generate_summary(text)

    return ResumeData(
        raw_text=text,
        name=name,
        email=email,
        phone=phone,
        summary=summary,
        skills=skills,
        experience=experience,
        education=education,
    )


def _extract_name(text: str) -> Optional[str]:
    """Extract candidate name from resume text."""
    lines = text.strip().split("\n")

    # Usually the name is in the first few lines
    for line in lines[:5]:
        line = line.strip()
        # Skip if line looks like email, phone, or header
        if "@" in line or re.search(r"\d{3}", line):
            continue
        if len(line) > 5 and len(line) < 50:
            # Check if it looks like a name (mostly letters and spaces)
            if re.match(r"^[A-Za-z\s\.\-]+$", line):
                return line

    return None


def _extract_skills(text: str) -> list[str]:
    """Extract skills from resume text."""
    skills = []

    # Common technical skills to look for
    common_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Node.js", "Java",
        "C++", "SQL", "AWS", "GCP", "Docker", "Kubernetes", "Git",
        "Machine Learning", "Data Analysis", "Agile", "Scrum", "REST API",
        "GraphQL", "MongoDB", "PostgreSQL", "Redis", "CI/CD",
    ]

    text_lower = text.lower()
    for skill in common_skills:
        if skill.lower() in text_lower:
            skills.append(skill)

    return skills[:15]  # Limit to top 15 skills


def _extract_experience(text: str) -> list[dict]:
    """Extract work experience from resume text."""
    experience = []

    # Look for experience section
    exp_patterns = [
        r"(?:experience|work history|employment)",
        r"(?:professional experience)",
    ]

    text_lower = text.lower()
    for pattern in exp_patterns:
        match = re.search(pattern, text_lower)
        if match:
            # Extract text after the header
            start = match.end()
            section_text = text[start:start + 2000]

            # Look for company/title patterns
            job_pattern = r"([A-Z][A-Za-z\s&]+)\s*[-–|]\s*([A-Z][A-Za-z\s]+)"
            jobs = re.findall(job_pattern, section_text[:1000])

            for company, title in jobs[:5]:
                experience.append({
                    "company": company.strip(),
                    "title": title.strip(),
                })
            break

    return experience


def _extract_education(text: str) -> list[dict]:
    """Extract education from resume text."""
    education = []

    # Common degree patterns
    degree_patterns = [
        r"(Bachelor[']?s?|B\.?S\.?|B\.?A\.?)\s+(?:of\s+)?(?:Science|Arts)?\s*(?:in)?\s*([A-Za-z\s]+)",
        r"(Master[']?s?|M\.?S\.?|M\.?A\.?|MBA)\s+(?:of\s+)?(?:Science|Arts|Business)?\s*(?:in)?\s*([A-Za-z\s]+)",
        r"(Ph\.?D\.?|Doctorate)\s*(?:in)?\s*([A-Za-z\s]+)",
    ]

    for pattern in degree_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if len(match) >= 2:
                education.append({
                    "degree": match[0].strip(),
                    "field": match[1].strip()[:50],
                })

    return education[:3]  # Limit to 3 entries


def _generate_summary(text: str) -> Optional[str]:
    """Generate a brief summary from resume text."""
    # Look for summary/objective section
    summary_patterns = [
        r"(?:summary|objective|profile|about)[\s:]+(.{50,300})",
    ]

    for pattern in summary_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()[:300]

    # If no summary section, use first meaningful paragraph
    paragraphs = text.split("\n\n")
    for para in paragraphs:
        para = para.strip()
        if len(para) > 100 and "@" not in para:
            return para[:300]

    return None
